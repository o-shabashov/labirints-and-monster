import { TILE_SIZE, VISION_RADIUS_TILES, BLINDNESS_VISION_RATIO } from '../config/constants.js';
import { hasEffect } from '../systems/Effects.js';

// Три слоя:
//   depth 9  — dim per-tile: чёрный 0.78 alpha поверх explored клеток,
//              которые сейчас вне vision-радиуса. Это «помню, но не вижу».
//   depth 10 — fog per-tile: solid чёрный для всего unexplored.
//   depth 11 — radial vignette image, центрированная на игроке — плавный
//              ободок-перехода между vision и dim/fog.
//
// Эта реализация устойчива: не использует BitmapMask и RenderTexture'ы, не
// зависит от текстурных фильтров — работает одинаково в pixelArt-режиме и
// в antialias-режиме.
export class FogOfWar {
  constructor(scene, gridW, gridH) {
    this.scene = scene;
    this.gridW = gridW;
    this.gridH = gridH;
    this.explored = Array.from({ length: gridH }, () => new Array(gridW).fill(false));

    this.dim = scene.add.graphics();
    this.dim.setDepth(9);

    this.fog = scene.add.graphics();
    this.fog.setDepth(10);

    this.vignette = scene.add.image(0, 0, 'vignette').setOrigin(0.5).setDepth(11);
    this.fullRadiusPx = VISION_RADIUS_TILES * TILE_SIZE;
    this.currentRadiusPx = this.fullRadiusPx;
  }

  update(playerX, playerY) {
    const gs = this.scene.gameState;
    const blind = gs ? hasEffect(gs, 'blindness') : false;
    const boosted = gs ? hasEffect(gs, 'vision_boost') : false;
    let radiusTiles = VISION_RADIUS_TILES;
    if (blind) radiusTiles = Math.ceil(VISION_RADIUS_TILES * BLINDNESS_VISION_RATIO);
    if (boosted) radiusTiles = VISION_RADIUS_TILES + 3;
    const radiusPx = radiusTiles * TILE_SIZE;
    this.currentRadiusPx = radiusPx;

    // расширяем explored по текущему vision
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

    // explored клетки вне текущего vision — приглушаем
    this.dim.clear();
    this.dim.fillStyle(0x000000, 0.78);
    const radiusPxSq = radiusPx * radiusPx;
    for (let y = 0; y < this.gridH; y++) {
      for (let x = 0; x < this.gridW; x++) {
        if (!this.explored[y][x]) continue;
        const cx = x * TILE_SIZE + TILE_SIZE / 2;
        const cy = y * TILE_SIZE + TILE_SIZE / 2;
        const ddx = cx - playerX, ddy = cy - playerY;
        if (ddx * ddx + ddy * ddy > radiusPxSq) {
          this.dim.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }

    // unexplored — solid black
    this.fog.clear();
    this.fog.fillStyle(0x000000, 1);
    for (let y = 0; y < this.gridH; y++) {
      for (let x = 0; x < this.gridW; x++) {
        if (this.explored[y][x]) continue;
        this.fog.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }

    // vignette — feathering на границе текущего vision
    this.vignette.setPosition(playerX, playerY);
    this.vignette.setScale(radiusPx / this.fullRadiusPx);
  }
}
