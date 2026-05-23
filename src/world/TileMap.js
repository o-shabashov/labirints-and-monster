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
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const px = x * TILE_SIZE + TILE_SIZE / 2;
        const py = y * TILE_SIZE + TILE_SIZE / 2;
        const t = this.tiles[y][x];
        if (t === TILE.WALL) {
          this.walls.create(px, py, 'wall').refreshBody();
          continue;
        }
        if (t === TILE.DOOR_R || t === TILE.DOOR_G || t === TILE.DOOR_B) {
          // подложка пола под дверью; сама дверь будет создана в GameScene как сущность
          this.scene.add.image(px, py, 'floor');
          continue;
        }
        this.scene.add.image(px, py, 'floor');
        if (t === TILE.ENTRANCE) {
          this.scene.add.image(px, py, 'entrance');
          this.entrance = { x, y };
        } else if (t === TILE.EXIT) {
          this.scene.add.image(px, py, 'exit');
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
