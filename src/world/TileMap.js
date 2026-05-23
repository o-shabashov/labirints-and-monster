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
    // ассеты 16×16, тайл — 32×32, поэтому setScale(2) везде
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const px = x * TILE_SIZE + TILE_SIZE / 2;
        const py = y * TILE_SIZE + TILE_SIZE / 2;
        const t = this.tiles[y][x];
        if (t === TILE.WALL) {
          const w = this.walls.create(px, py, 'wall');
          w.setScale(2).refreshBody();
          continue;
        }
        if (t === TILE.DOOR_R || t === TILE.DOOR_G || t === TILE.DOOR_B) {
          this.scene.add.image(px, py, 'floor').setScale(2);
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
