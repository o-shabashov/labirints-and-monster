import * as THREE from 'three';
import { isBlockingTile } from '../config/constants.js';

// Снаряды и взрывы для 3D-режима. Логика урона/AoE считается в main3d
// (там доступ к monsters/camera/world), здесь — сами летящие сущности и
// визуал взрыва (частицы).

const ROCKET_SPEED = 9;       // units/sec
const ROCKET_LIFE  = 2.2;     // sec
const BOMB_SPEED   = 6;
const BOMB_DRAG    = 3.0;     // замедление units/sec^2
const BOMB_FUSE    = 1.5;     // sec

// ---- Ракета ----
export class Rocket3D {
  constructor(scene, origin, dir) {
    this.scene = scene;
    this.dead = false;
    this.life = ROCKET_LIFE;
    this.vel = dir.clone().normalize().multiplyScalar(ROCKET_SPEED);
    const geo = new THREE.SphereGeometry(0.08, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffcc66 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(origin);
    scene.add(this.mesh);
    this.light = new THREE.PointLight(0xff8833, 1.2, 4);
    this.mesh.add(this.light);
  }
  // возвращает true если пора взрываться (стена/срок)
  update(dt, grid) {
    if (this.dead) return false;
    this.life -= dt;
    this.mesh.position.addScaledVector(this.vel, dt);
    const p = this.mesh.position;
    const tx = Math.floor(p.x), ty = Math.floor(p.z);
    if (ty < 0 || tx < 0 || ty >= grid.length || tx >= grid[0].length) return true;
    if (isBlockingTile(grid[ty][tx])) return true;
    if (this.life <= 0) return true;
    return false;
  }
  kill() {
    if (this.dead) return;
    this.dead = true;
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

// ---- Бомба ----
export class Bomb3D {
  constructor(scene, origin, dir) {
    this.scene = scene;
    this.dead = false;
    this.fuse = BOMB_FUSE;
    this.vel = dir.clone().setY(0).normalize().multiplyScalar(BOMB_SPEED);
    const geo = new THREE.SphereGeometry(0.12, 10, 10);
    const mat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(origin).setY(0.18);
    scene.add(this.mesh);
  }
  update(dt, grid) {
    if (this.dead) return false;
    this.fuse -= dt;
    // замедление
    const sp = this.vel.length();
    if (sp > 0) {
      const ns = Math.max(0, sp - BOMB_DRAG * dt);
      this.vel.multiplyScalar(ns / sp);
    }
    const next = this.mesh.position.clone().addScaledVector(this.vel, dt);
    const tx = Math.floor(next.x), ty = Math.floor(next.z);
    // отскок от стен — гасим компоненту в стену
    if (ty >= 0 && tx >= 0 && ty < grid.length && tx < grid[0].length
        && !isBlockingTile(grid[ty][tx])) {
      this.mesh.position.copy(next);
    } else {
      this.vel.multiplyScalar(-0.4);
    }
    // мигание ближе к взрыву
    const blink = Math.sin(this.fuse * 18) > 0;
    this.mesh.material.color.setHex(blink ? 0xff4444 : 0x222222);
    return this.fuse <= 0;
  }
  kill() {
    if (this.dead) return;
    this.dead = true;
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

// ---- Визуал взрыва: расширяющаяся вспышка + разлетающиеся частицы ----
const _pGeo = new THREE.SphereGeometry(0.06, 6, 6);
export function spawnExplosion(scene, pos, opts = {}) {
  const radius = opts.radius ?? 1.4;
  const count = opts.count ?? 20;
  // центральная вспышка
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xffdd88, transparent: true, opacity: 0.9 }),
  );
  flash.position.copy(pos);
  scene.add(flash);
  const flashLight = new THREE.PointLight(0xffaa44, 4, radius * 4);
  flashLight.position.copy(pos);
  scene.add(flashLight);

  // разлетающиеся искры
  const sparks = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(_pGeo, new THREE.MeshBasicMaterial({
      color: i % 2 ? 0xff7733 : 0xffcc55, transparent: true,
    }));
    m.position.copy(pos);
    const dir = new THREE.Vector3(
      Math.random() * 2 - 1, Math.random() * 1.2 - 0.2, Math.random() * 2 - 1,
    ).normalize().multiplyScalar(radius * (0.6 + Math.random() * 0.8));
    scene.add(m);
    sparks.push({ m, dir });
  }

  let t = 0;
  const DUR = 0.45;
  function tick(dt) {
    t += dt;
    const k = t / DUR;
    flash.scale.setScalar(1 + k * 4);
    flash.material.opacity = Math.max(0, 0.9 * (1 - k));
    flashLight.intensity = Math.max(0, 4 * (1 - k));
    for (const s of sparks) {
      s.m.position.addScaledVector(s.dir, dt);
      s.m.material.opacity = Math.max(0, 1 - k);
      s.m.scale.setScalar(Math.max(0.1, 1 - k));
    }
    if (t >= DUR) {
      flash.removeFromParent(); flash.geometry.dispose(); flash.material.dispose();
      flashLight.removeFromParent();
      for (const s of sparks) { s.m.removeFromParent(); s.m.material.dispose(); }
      return true; // done
    }
    return false;
  }
  return tick;
}

// Лёгкие искры от попадания по монстру — без света, дёшево (можно часто).
const _sparkGeo = new THREE.SphereGeometry(0.05, 5, 5);
export function spawnSparks(scene, pos, opts = {}) {
  const count = opts.count ?? 8;
  const color = opts.color ?? 0xfff176;
  const spread = opts.spread ?? 1.4;
  const sparks = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(_sparkGeo, new THREE.MeshBasicMaterial({ color, transparent: true }));
    m.position.copy(pos);
    const dir = new THREE.Vector3(
      Math.random() * 2 - 1, Math.random() * 1.5 - 0.3, Math.random() * 2 - 1,
    ).normalize().multiplyScalar(spread * (0.5 + Math.random()));
    scene.add(m);
    sparks.push({ m, dir });
  }
  let t = 0; const DUR = 0.3;
  return function tick(dt) {
    t += dt;
    const k = t / DUR;
    for (const s of sparks) {
      s.m.position.addScaledVector(s.dir, dt);
      s.m.material.opacity = Math.max(0, 1 - k);
      s.m.scale.setScalar(Math.max(0.1, 1 - k));
    }
    if (t >= DUR) {
      for (const s of sparks) { s.m.removeFromParent(); s.m.material.dispose(); }
      return true;
    }
    return false;
  };
}
