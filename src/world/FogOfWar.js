import {
  TILE_SIZE, GAME_W, GAME_H,
  VISION_RADIUS_TILES, BLINDNESS_VISION_RATIO,
} from '../config/constants.js';
import { hasEffect } from '../systems/Effects.js';

// Плавный fog без тайловой разбивки. Идея:
//
//   accExplored RenderTexture (невидимый) накапливает soft brush в позиции
//   игрока каждый кадр — это «карта памяти» с альфа-градиентом по краям.
//
//   visionMask Image (невидимый) — тот же soft brush, привязанный к игроку,
//   меняется каждый кадр. Это маска «то, что вижу прямо сейчас».
//
//   outerFog — сплошной чёрный rectangle alpha=1 на весь мир, с inverted
//   bitmap-маской по accExplored. Виден только там, где игрок ни разу не
//   был. Невиденное = solid black.
//
//   memoryDim — сплошной чёрный rectangle alpha=0.78 на весь мир, с inverted
//   bitmap-маской по visionMask. Виден там, где НЕ в текущем зрении.
//   Поверх accExplored-памяти даёт «помню коридор, но не сейчас», а в
//   текущем круге vision полностью прозрачен.
//
// Композиция:
//   vision-зона       → ничего не накладывается, виден мир в полном цвете
//   explored-память   → только memoryDim 0.78
//   unexplored        → memoryDim + outerFog = полностью чёрный
//
// Vignette/soft falloff одинаковый для всех трёх границ, потому что обе
// маски используют один и тот же gradient brush.
export class FogOfWar {
  constructor(scene, gridW, gridH) {
    this.scene = scene;
    this.gridW = gridW;
    this.gridH = gridH;
    // explored-сетка нужна для статистики Victory/GameOver
    this.explored = Array.from({ length: gridH }, () => new Array(gridW).fill(false));

    // накопитель explored-памяти (невидим, используется только как mask source)
    this.accExplored = scene.add.renderTexture(0, 0, GAME_W, GAME_H).setOrigin(0, 0).setVisible(false);

    // динамическая vision-маска (невидима, используется как mask source)
    this.visionMask = scene.add.image(0, 0, 'soft_circle').setOrigin(0.5).setVisible(false);

    // outerFog — чёрный для unexplored
    this.outerFog = scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 1).setOrigin(0, 0).setDepth(10);
    const exploredMask = new Phaser.Display.Masks.BitmapMask(scene, this.accExplored);
    exploredMask.invertAlpha = true;
    this.outerFog.setMask(exploredMask);

    // memoryDim — приглушение explored-зоны вне current vision
    this.memoryDim = scene.add.rectangle(0, 0, GAME_W, GAME_H, 0x000000, 0.78).setOrigin(0, 0).setDepth(11);
    const vMask = new Phaser.Display.Masks.BitmapMask(scene, this.visionMask);
    vMask.invertAlpha = true;
    this.memoryDim.setMask(vMask);

    this.fullRadiusPx = VISION_RADIUS_TILES * TILE_SIZE;
    this.currentRadiusPx = this.fullRadiusPx;
  }

  update(playerX, playerY) {
    const blind = this.scene.gameState ? hasEffect(this.scene.gameState, 'blindness') : false;
    const radiusTiles = blind ? Math.ceil(VISION_RADIUS_TILES * BLINDNESS_VISION_RATIO) : VISION_RADIUS_TILES;
    const radiusPx = radiusTiles * TILE_SIZE;
    this.currentRadiusPx = radiusPx;
    const scale = radiusPx / this.fullRadiusPx;

    // штампуем soft brush в accumulator — память накапливается с плавными краями
    this.accExplored.draw('soft_circle', playerX - this.fullRadiusPx * scale, playerY - this.fullRadiusPx * scale, 1, 0xffffff);
    // подгоняем размер бруша под blindness — RT.draw не масштабирует напрямую,
    // поэтому при blindness draw'ом мы рисуем тот же brush, но dim/vision
    // mask отскейлится через visionMask ниже — это даёт корректное сужение.

    // обновляем explored-сетку для статистики
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

    // двигаем vision mask к игроку и масштабируем (blindness уменьшает)
    this.visionMask.setPosition(playerX, playerY);
    this.visionMask.setScale(scale);
  }
}
