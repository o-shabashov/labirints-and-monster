import { TILE_SIZE, TILE } from '../config/constants.js';

export class TileMap {
  constructor(scene, tiles) {
    this.scene = scene;
    this.tiles = tiles;  // tiles[y][x]
    this.height = tiles.length;
    this.width = tiles[0].length;
    this.walls = scene.physics.add.staticGroup();
    this.render();
  }

  render() {
    this.entrance = null;
    this.exit = null;
    // Визуал — рисуем тайл-за-тайлом (стены/пол/вход/выход), потому что
    // image должна быть NEAREST-pixel-art и не растягиваться.
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const px = x * TILE_SIZE + TILE_SIZE / 2;
        const py = y * TILE_SIZE + TILE_SIZE / 2;
        const t = this.tiles[y][x];
        if (t === TILE.WALL) {
          this.scene.add.image(px, py, 'wall').setScale(2);
          continue;
        }
        this.scene.add.image(px, py, 'floor').setScale(2);
        if (t === TILE.ENTRANCE) {
          this.scene.add.image(px, py, 'entrance').setScale(2);
          this.entrance = { x, y };
        } else if (t === TILE.EXIT) {
          this.scene.add.image(px, py, 'exit').setScale(2);
          this.exit = { x, y };
        }
      }
    }
    // Физика — мерджим стены в горизонтальные runs, чтобы вместо сетки из
    // тысячи маленьких AABB получить десятки длинных. Игрок больше не цепляется
    // за «уголки» между двумя смежными wall-тайлами.
    for (let y = 0; y < this.height; y++) {
      let x = 0;
      while (x < this.width) {
        if (this.tiles[y][x] !== TILE.WALL) { x++; continue; }
        let endX = x;
        while (endX + 1 < this.width && this.tiles[y][endX + 1] === TILE.WALL) endX++;
        const len = endX - x + 1;
        const cx = x * TILE_SIZE + (len * TILE_SIZE) / 2;
        const cy = y * TILE_SIZE + TILE_SIZE / 2;
        const zone = this.scene.add.zone(cx, cy, len * TILE_SIZE, TILE_SIZE);
        this.scene.physics.add.existing(zone, true);
        this.walls.add(zone);
        x = endX + 1;
      }
    }
  }

  findDoors() {
    const result = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const t = this.tiles[y][x];
        if (t === TILE.DOOR_R || t === TILE.DOOR_G || t === TILE.DOOR_B) {
          result.push({ x, y, tile: t });
        }
      }
    }
    return result;
  }

  isWall(x, y) {
    if (y < 0 || y >= this.height || x < 0 || x >= this.width) return true;
    return this.tiles[y][x] === TILE.WALL;
  }

  tileToWorld(x, y) {
    return {
      x: x * TILE_SIZE + TILE_SIZE / 2,
      y: y * TILE_SIZE + TILE_SIZE / 2,
    };
  }
}
