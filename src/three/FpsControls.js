import * as THREE from 'three';
import { isBlockingTile } from '../config/constants.js';

// FPS-движение: читает yaw камеры (его крутит PointerLockControls), строит
// вектор движения в плоскости XZ, применяет grid-коллизию по осям отдельно
// (wall-sliding) — переиспользует ту же логику что и 2D-версия, только grid
// здесь служит и для физики, и для AI.

const PLAYER_RADIUS = 0.28;   // в тайл-юнитах
const BASE_SPEED    = 4.2;    // units/sec (~прежние 210px/32px)
const SPRINT_MULT   = 1.6;

export class FpsControls {
  constructor(camera, grid) {
    this.camera = camera;
    this.grid = grid;
    this.h = grid.length;
    this.w = grid[0].length;
    this.keys = new Set();
    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);

    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup',   (e) => this.keys.delete(e.code));
  }

  // при смене уровня — новый grid (collision читает его каждый кадр)
  setGrid(grid) {
    this.grid = grid;
    this.h = grid.length;
    this.w = grid[0].length;
  }

  update(dt) {
    const k = this.keys;
    let mf = 0, mr = 0;
    if (k.has('KeyW') || k.has('ArrowUp'))    mf += 1;
    if (k.has('KeyS') || k.has('ArrowDown'))  mf -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) mr += 1;
    if (k.has('KeyA') || k.has('ArrowLeft'))  mr -= 1;
    if (mf === 0 && mr === 0) return;

    // forward по направлению взгляда, спроецированному на пол
    this.camera.getWorldDirection(this._fwd);
    this._fwd.y = 0;
    this._fwd.normalize();
    // right = forward × up
    this._right.crossVectors(this._fwd, this._up).normalize();

    const speed = (k.has('ShiftLeft') || k.has('ShiftRight')) ? BASE_SPEED * SPRINT_MULT : BASE_SPEED;
    let dx = (this._fwd.x * mf + this._right.x * mr);
    let dz = (this._fwd.z * mf + this._right.z * mr);
    const len = Math.hypot(dx, dz) || 1;
    dx = (dx / len) * speed * dt;
    dz = (dz / len) * speed * dt;

    const pos = this.camera.position;
    // По осям отдельно — даёт скольжение вдоль стен
    if (!this._blocked(pos.x + dx, pos.z)) pos.x += dx;
    if (!this._blocked(pos.x, pos.z + dz)) pos.z += dz;
  }

  // true если круг игрока радиуса r в (px,pz) пересекает блокирующий тайл
  _blocked(px, pz) {
    const r = PLAYER_RADIUS;
    const minX = Math.floor(px - r), maxX = Math.floor(px + r);
    const minZ = Math.floor(pz - r), maxZ = Math.floor(pz + r);
    for (let ty = minZ; ty <= maxZ; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return true;
        if (!isBlockingTile(this.grid[ty][tx])) continue;
        // ближайшая точка AABB тайла [tx,tx+1]×[ty,ty+1] к центру круга
        const cx = Math.max(tx, Math.min(px, tx + 1));
        const cz = Math.max(ty, Math.min(pz, ty + 1));
        const ddx = px - cx, ddz = pz - cz;
        if (ddx * ddx + ddz * ddz < r * r) return true;
      }
    }
    return false;
  }
}
