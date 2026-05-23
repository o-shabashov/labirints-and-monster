import { TILE_SIZE, VISION_RADIUS_TILES, BLINDNESS_VISION_RATIO } from '../config/constants.js';
import { hasEffect } from '../systems/Effects.js';

// Два слоя:
//   1. solid black per-tile для unexplored клеток (depth 9, под vignette)
//   2. radial-gradient image, центрированный на игроке (depth 11) — плавный
//      переход от прозрачного центра к чёрному краю vision-радиуса.
// Без полупрозрачного «explored memory» слоя: vignette за пределами radius
// почти полностью чёрный, чтобы старая память не «фонила» через градиент.
export class FogOfWar {
  constructor(scene, gridW, gridH) {
    this.scene = scene;
    this.gridW = gridW;
    this.gridH = gridH;
    this.explored = Array.from({ length: gridH }, () => new Array(gridW).fill(false));

    // unexplored cells: solid black per-tile
    this.fog = scene.add.graphics();
    this.fog.setDepth(9);

    // radial vignette image
    this.vignette = scene.add.image(0, 0, 'vignette').setOrigin(0.5).setDepth(11);
    this.fullRadiusPx = VISION_RADIUS_TILES * TILE_SIZE;
    this.currentRadiusPx = this.fullRadiusPx;
  }

  update(playerX, playerY) {
    const blind = this.scene.gameState ? hasEffect(this.scene.gameState, 'blindness') : false;
    const radiusTiles = blind ? Math.ceil(VISION_RADIUS_TILES * BLINDNESS_VISION_RATIO) : VISION_RADIUS_TILES;
    const radiusPx = radiusTiles * TILE_SIZE;
    this.currentRadiusPx = radiusPx;

    // обновляем explored по текущему радиусу
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

    // unexplored cells — solid black, чтобы карта вне исследованного не светилась через градиент
    this.fog.clear();
    this.fog.fillStyle(0x000000, 1);
    for (let y = 0; y < this.gridH; y++) {
      for (let x = 0; x < this.gridW; x++) {
        if (this.explored[y][x]) continue;
        this.fog.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }

    // vignette центрируем на игроке и масштабируем под blindness
    this.vignette.setPosition(playerX, playerY);
    this.vignette.setScale(radiusPx / this.fullRadiusPx);
  }
}
