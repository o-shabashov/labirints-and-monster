import { TILE_SIZE, TILE } from '../config/constants.js';

const TINT = { r: 0xff5252, g: 0x66bb6a, b: 0x42a5f5 };

// Одна логическая дверь = один растянутый sprite поверх всех своих cells +
// невидимый body на каждой cell для коллизии. Раньше каждая cell получала
// собственную копию door PNG, что выглядело как «две двери рядом».
export class Door {
  constructor(scene, color, cells, map) {
    this.scene = scene;
    this.color = color;
    this.cells = cells;
    this.map = map;
    const xs = cells.map(c => c.x);
    const ys = cells.map(c => c.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const wTiles = maxX - minX + 1;
    const hTiles = maxY - minY + 1;
    const cx = (minX + maxX + 1) / 2 * TILE_SIZE;
    const cy = (minY + maxY + 1) / 2 * TILE_SIZE;
    // Один sprite door_base тонко растянут на весь проём — 16×32 base, scale
    // под актуальный размер в тайлах × 2 (т.к. 1 тайл = 2x асcет).
    this.visual = scene.add.image(cx, cy, 'door_base');
    this.visual.setScale(2 * wTiles, 2 * hTiles);
    this.visual.setTint(TINT[color]);
    // Колайдеры — невидимые зоны на каждой cell, чтобы дверь блокировала
    // оба прохода даже когда визуально это «одно полотно».
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
    this.visual.destroy();
    for (const z of this.bodies) z.destroy();
    this.bodies = [];
  }
}
