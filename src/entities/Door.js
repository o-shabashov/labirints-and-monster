import { TILE_SIZE, TILE } from '../config/constants.js';

const TINT = { r: 0xff5252, g: 0x66bb6a, b: 0x42a5f5 };

// Одна логическая «дверь» теперь занимает несколько тайлов (после widening
// проёмы 2-клеточные). Все спрайты двери привязаны к одной сущности — открыл
// один — открылись все.
export class Door {
  constructor(scene, color, cells, map) {
    this.scene = scene;
    this.color = color;
    this.cells = cells;
    this.map = map;
    this.sprites = cells.map(c => {
      const wx = c.x * TILE_SIZE + TILE_SIZE / 2;
      const wy = c.y * TILE_SIZE + TILE_SIZE / 2;
      const s = scene.physics.add.staticImage(wx, wy, 'door_base');
      s.setScale(2);
      s.setTint(TINT[color]);
      s.refreshBody();
      s.doorRef = this;
      return s;
    });
  }

  open() {
    for (const c of this.cells) this.map.tiles[c.y][c.x] = TILE.FLOOR;
    for (const s of this.sprites) s.destroy();
    this.sprites = [];
  }
}
