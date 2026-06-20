import * as THREE from 'three';
import { bfsNextStep } from '../systems/PathFinding.js';
import { isBlockingTile } from '../config/constants.js';
import { Sound3D } from './Sound3D.js';

// Монстр в 3D — billboard-спрайт (THREE.Sprite всегда повёрнут к камере).
// Использует те же 0x72-текстуры что и 2D-версия и тот же BFS-pathfinding
// по 2D-сетке. Движение — к центру следующего тайла на пути к игроку.

const REPATH_MS = 280;
const _loader = new THREE.TextureLoader();
const _texCache = new Map();

function spriteTexture(path) {
  if (_texCache.has(path)) return _texCache.get(path);
  const tex = _loader.load(path);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  _texCache.set(path, tex);
  return tex;
}

export class Monster3D {
  constructor(scene, grid, opts) {
    this.scene = scene;
    this.grid = grid;
    this.h = grid.length;
    this.w = grid[0].length;
    this.speed = opts.speed;          // units/sec
    this.hp = opts.hp ?? 1;
    this.dead = false;

    const mat = new THREE.SpriteMaterial({
      map: spriteTexture(opts.texture),
      transparent: true,
      alphaTest: 0.5,
    });
    this.sprite = new THREE.Sprite(mat);
    const s = opts.scale ?? 0.7;
    this.baseScaleX = s;
    this.baseScaleY = s * 1.3;
    this.sprite.scale.set(s, s * 1.3, 1);   // выше чем шире — человекоформа
    this.baseY = s * 0.65;
    this.sprite.position.set(opts.tx + 0.5, this.baseY, opts.ty + 0.5);
    scene.add(this.sprite);

    // Тень-блоб на полу под монстром — даёт объём/привязку к земле
    // (billboard сам по себе «плавает»).
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(s * 0.42, 14),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.set(opts.tx + 0.5, 0.02, opts.ty + 0.5);
    scene.add(this.shadow);

    this.target = null;
    this.repathMs = 0;
    this.speedMul = 1;   // множитель скорости от difficulty engine
    // процедурный bob (кадров анимации в 0x72 нет — оживляем покачиванием)
    this.bobT = Math.random() * Math.PI * 2;
    // импакт от попаданий
    this.knockX = 0; this.knockZ = 0;   // скорость отброса (затухает)
    this.flashUntil = 0;
    this.punchT = 0;
  }

  _blockedAt(x, z) {
    const tx = Math.floor(x), tz = Math.floor(z);
    return tx < 0 || tz < 0 || tx >= this.w || tz >= this.h || isBlockingTile(this.grid[tz][tx]);
  }

  tilePos() {
    return {
      x: Math.floor(this.sprite.position.x),
      y: Math.floor(this.sprite.position.z),
    };
  }

  update(dt, playerTile) {
    if (this.dead) return;
    this.repathMs -= dt * 1000;
    if (this.repathMs <= 0 || !this.target) {
      this.repathMs = REPATH_MS;
      const mt = this.tilePos();
      const step = bfsNextStep(this.grid, mt.x, mt.y, playerTile.x, playerTile.y);
      this.target = step ? { x: step.x + 0.5, z: step.y + 0.5 } : null;
    }
    let moving = false;
    if (this.target) {
      const p = this.sprite.position;
      const dx = this.target.x - p.x, dz = this.target.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.05) {
        this.target = null;
      } else {
        const step = Math.min(d, this.speed * this.speedMul * dt);
        p.x += (dx / d) * step;
        p.z += (dz / d) * step;
        moving = true;
      }
    }
    // отброс от попадания — затухает, не проходит сквозь стены
    if (this.knockX !== 0 || this.knockZ !== 0) {
      const p = this.sprite.position;
      const nx = p.x + this.knockX * dt, nz = p.z + this.knockZ * dt;
      if (!this._blockedAt(nx, p.z)) p.x = nx;
      if (!this._blockedAt(p.x, nz)) p.z = nz;
      const decay = Math.max(0, 1 - dt * 9);
      this.knockX *= decay; this.knockZ *= decay;
      if (Math.abs(this.knockX) < 0.02 && Math.abs(this.knockZ) < 0.02) { this.knockX = 0; this.knockZ = 0; }
    }

    // bob — покачивание вверх-вниз, быстрее при движении
    this.bobT += dt * (moving ? 9 : 3);
    this.sprite.position.y = this.baseY + Math.sin(this.bobT) * 0.05;

    // scale-punch при попадании — раздувается и опадает
    let punchMul = 1;
    if (this.punchT > 0) {
      this.punchT = Math.max(0, this.punchT - dt);
      punchMul = 1 + (this.punchT / 0.16) * 0.35;
    }
    this.sprite.scale.set(this.baseScaleX * punchMul, this.baseScaleY * punchMul, 1);

    // сброс вспышки
    if (this.flashUntil && performance.now() > this.flashUntil) {
      this.sprite.material.color.setHex(0xffffff);
      this.flashUntil = 0;
    }

    // тень следует за позицией (на полу, фикс. высота)
    this.shadow.position.x = this.sprite.position.x;
    this.shadow.position.z = this.sprite.position.z;
  }

  // fromX/fromZ — источник урона, для отброса в противоположную сторону.
  takeDamage(n, fromX, fromZ) {
    this.hp -= n;
    // яркая вспышка + scale-punch
    this.sprite.material.color.setHex(0xff3030);
    this.flashUntil = performance.now() + 120;
    this.punchT = 0.16;
    Sound3D.hit();
    // отброс от источника
    if (fromX !== undefined) {
      const dx = this.sprite.position.x - fromX, dz = this.sprite.position.z - fromZ;
      const d = Math.hypot(dx, dz) || 1;
      const KB = 3.2;
      this.knockX += (dx / d) * KB;
      this.knockZ += (dz / d) * KB;
    }
    if (this.hp <= 0) { this.kill(); return true; }
    return false;
  }

  kill() {
    if (this.dead) return;
    this.dead = true;
    this.sprite.removeFromParent();
    this.sprite.material.dispose();
    if (this.shadow) {
      this.shadow.removeFromParent();
      this.shadow.geometry.dispose();
      this.shadow.material.dispose();
    }
  }
}

// Зоопарк текстур + базовые скорости (units/sec; игрок ~4.2).
export const MONSTER_KINDS = [
  { texture: 'assets/0x72/chort_idle_anim_f0.png',       speed: 4.2, hp: 1, scale: 0.7 },
  { texture: 'assets/0x72/imp_idle_anim_f0.png',         speed: 3.6, hp: 1, scale: 0.6 },
  { texture: 'assets/0x72/goblin_idle_anim_f0.png',      speed: 4.6, hp: 1, scale: 0.6 },
  { texture: 'assets/0x72/skelet_idle_anim_f0.png',      speed: 2.8, hp: 2, scale: 0.7 },
  { texture: 'assets/0x72/big_zombie_idle_anim_f0.png',  speed: 2.4, hp: 4, scale: 1.0 },
  { texture: 'assets/0x72/orc_warrior_idle_anim_f0.png', speed: 3.2, hp: 2, scale: 0.8 },
  { texture: 'assets/0x72/masked_orc_idle_anim_f0.png',  speed: 3.6, hp: 1, scale: 0.7 },
  { texture: 'assets/0x72/tiny_zombie_idle_anim_f0.png', speed: 3.8, hp: 1, scale: 0.5 },
];
