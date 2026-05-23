import { TILE_SIZE, GAME_W, GAME_H, VISION_RADIUS_TILES, BLINDNESS_VISION_RATIO } from '../config/constants.js';
import { hasEffect } from '../systems/Effects.js';

export class FogOfWar {
  constructor(scene, gridW, gridH) {
    this.scene = scene;
    this.gridW = gridW;
    this.gridH = gridH;
    this.explored = Array.from({ length: gridH }, () => new Array(gridW).fill(false));

    // dim layer over explored cells
    this.dim = scene.add.graphics();
    this.dim.setDepth(10);

    // black overlay with circular hole (visibility mask)
    this.fog = scene.add.graphics();
    this.fog.setDepth(11);

    this.radiusPx = VISION_RADIUS_TILES * TILE_SIZE;
  }

  update(playerX, playerY) {
    // если в state есть blindness → радиус в 2 раза меньше
    const blind = this.scene.gameState ? hasEffect(this.scene.gameState, 'blindness') : false;
    const radiusTiles = blind ? Math.ceil(VISION_RADIUS_TILES * BLINDNESS_VISION_RATIO) : VISION_RADIUS_TILES;
    const radiusPx = radiusTiles * TILE_SIZE;
    this.currentRadiusPx = radiusPx;

    // mark explored tiles within current vision
    const tx = Math.floor(playerX / TILE_SIZE);
    const ty = Math.floor(playerY / TILE_SIZE);
    const r = radiusTiles;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const x = tx + dx, y = ty + dy;
        if (x < 0 || y < 0 || x >= this.gridW || y >= this.gridH) continue;
        this.explored[y][x] = true;
      }
    }

    // dim: explored-but-out-of-vision -> сильнее затенено, чтобы было «вспоминаю», а не «вижу».
    this.dim.clear();
    this.dim.fillStyle(0x000000, 0.82);
    for (let y = 0; y < this.gridH; y++) {
      for (let x = 0; x < this.gridW; x++) {
        if (!this.explored[y][x]) continue;
        const cx = x * TILE_SIZE + TILE_SIZE / 2;
        const cy = y * TILE_SIZE + TILE_SIZE / 2;
        const dxp = cx - playerX, dyp = cy - playerY;
        if (dxp * dxp + dyp * dyp > radiusPx * radiusPx) {
          this.dim.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }

    // fog: solid black over unexplored cells (also covers far area)
    this.fog.clear();
    this.fog.fillStyle(0x000000, 1);
    for (let y = 0; y < this.gridH; y++) {
      for (let x = 0; x < this.gridW; x++) {
        if (this.explored[y][x]) continue;
        this.fog.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }
}
