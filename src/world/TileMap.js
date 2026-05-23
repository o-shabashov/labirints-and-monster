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
    // Физика — greedy 2D rectangle merge. Для каждой непокрытой wall-клетки
    // расширяем максимальный прямоугольник из walls (вправо до упора, потом
    // вниз пока вся полоска ещё wall). Это убирает швы и по горизонтали, и
    // по вертикали — игрок больше не цепляется за внутренние углы соседних
    // тайлов.
    const covered = Array.from({ length: this.height }, () => new Array(this.width).fill(false));
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.tiles[y][x] !== TILE.WALL || covered[y][x]) continue;
        let mw = 1;
        while (x + mw < this.width
            && this.tiles[y][x + mw] === TILE.WALL
            && !covered[y][x + mw]) mw++;
        let mh = 1;
        outer: while (y + mh < this.height) {
          for (let dx = 0; dx < mw; dx++) {
            if (this.tiles[y + mh][x + dx] !== TILE.WALL || covered[y + mh][x + dx]) {
              break outer;
            }
          }
          mh++;
        }
        for (let dy = 0; dy < mh; dy++) {
          for (let dx = 0; dx < mw; dx++) covered[y + dy][x + dx] = true;
        }
        const cx = x * TILE_SIZE + (mw * TILE_SIZE) / 2;
        const cy = y * TILE_SIZE + (mh * TILE_SIZE) / 2;
        const zone = this.scene.add.zone(cx, cy, mw * TILE_SIZE, mh * TILE_SIZE);
        this.scene.physics.add.existing(zone, true);
        this.walls.add(zone);
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
