import { TILE_SIZE, GAME_W, GAME_H, VISION_RADIUS_TILES, BLINDNESS_VISION_RATIO } from '../config/constants.js';
import { hasEffect } from '../systems/Effects.js';

// Плавный fog через RenderTexture + soft_circle штампы.
//
//   fogRT — persistent чёрный 1.0 alpha слой, depth 10. Каждый кадр в позиции
//           игрока штампуется erase('soft_circle') — стирания накапливаются
//           и образуют «карту памяти» с плавными градиентными границами.
//   dimRT — каждый кадр fill чёрный 0.78 alpha, затем erase в текущей позиции.
//           Это «приглушение explored-памяти вне зрения»: видно где был, но
//           тускло. Тоже плавный, никакой блочности.
//
// Сильное преимущество перед старой tile-based реализацией: границы
// видимости абсолютно плавные, без «лесенки» по 32px-клеткам.
export class FogOfWar {
  constructor(scene, gridW, gridH) {
    this.scene = scene;
    this.gridW = gridW;
    this.gridH = gridH;
    this.explored = Array.from({ length: gridH }, () => new Array(gridW).fill(false));

    // explored-память: persistent, начинаем полностью закрытым
    this.fogRT = scene.add.renderTexture(0, 0, GAME_W, GAME_H).setOrigin(0, 0).setDepth(10);
    this.fogRT.fill(0x000000, 1);

    // dim текущего vision — каждый кадр перерисовывается
    this.dimRT = scene.add.renderTexture(0, 0, GAME_W, GAME_H).setOrigin(0, 0).setDepth(9);

    this.fullRadiusPx = VISION_RADIUS_TILES * TILE_SIZE;
    this.currentRadiusPx = this.fullRadiusPx;
    // soft_circle 2× radius на сторону (см. BootScene)
    this.brushHalf = this.fullRadiusPx;
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
    const scale = radiusPx / this.fullRadiusPx;
    const halfSized = this.brushHalf * scale;

    // обновляем grid explored для статистики Victory
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

    // 1. Штампуем soft_circle на persistent fogRT — расширяем «карту памяти».
    //    Создаём временный Image с нужным scale, рисуем erase'ом, уничтожаем.
    const stamp = this.scene.add.image(playerX, playerY, 'soft_circle')
      .setOrigin(0.5)
      .setScale(scale)
      .setVisible(false);
    this.fogRT.erase(stamp);
    // 2. dim — перезаливаем чёрным 0.78, затем стираем текущий vision полностью.
    this.dimRT.clear();
    this.dimRT.fill(0x000000, 0.78);
    this.dimRT.erase(stamp);
    stamp.destroy();
  }
}
