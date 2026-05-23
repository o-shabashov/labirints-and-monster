import { TILE_SIZE, TILE } from '../config/constants.js';

const TINT = { r: 0xff5252, g: 0x66bb6a, b: 0x42a5f5 };

// Тайл двери (32×32) ставится отдельным sprite на каждую клетку проёма.
// Соседние тайлы зеркалятся (flipX/flipY), чтобы из двух одинаковых тайлов
// получалась симметричная «двустворчатая» дверь, не растянутая по размеру.
//
// Для 2-клеточного horizontal-проёма — второй sprite flipX.
// Для 2-клеточного vertical-проёма — второй sprite flipY.
// Body — невидимая зона на каждой клетке.
export class Door {
  constructor(scene, color, cells, map) {
    this.scene = scene;
    this.color = color;
    this.cells = cells;
    this.map = map;
    // определяем ориентацию pair
    const horizontal = cells.length >= 2 && cells[0].y === cells[1].y;
    this.visuals = cells.map((c, i) => {
      const wx = c.x * TILE_SIZE + TILE_SIZE / 2;
      const wy = c.y * TILE_SIZE + TILE_SIZE / 2;
      const img = scene.add.image(wx, wy, 'door_base');
      img.setTint(TINT[color]);
      if (i > 0) {
        if (horizontal) img.setFlipX(true);
        else img.setFlipY(true);
      }
      return img;
    });
    this.bodies = cells.map(c => {
      const wx = c.x * TILE_SIZE + TILE_SIZE / 2;
      const wy = c.y * TILE_SIZE + TILE_SIZE / 2;
      const zone = scene.add.zone(wx, wy, TILE_SIZE, TILE_SIZE);
      scene.physics.add.existing(zone, true);
      zone.doorRef = this;
      return zone;
    });
  }

  open() {
    for (const c of this.cells) this.map.tiles[c.y][c.x] = TILE.FLOOR;
    for (const v of this.visuals) v.destroy();
    for (const z of this.bodies) z.destroy();
    this.visuals = [];
    this.bodies = [];
  }
}
