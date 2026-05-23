import { TILE_SIZE, TILE } from '../config/constants.js';

const TILE_TO_COLOR = {
  [TILE.DOOR_R]: 'r',
  [TILE.DOOR_G]: 'g',
  [TILE.DOOR_B]: 'b',
};

export class Door {
  constructor(scene, tx, ty, tile, map) {
    this.scene = scene;
    this.tx = tx;
    this.ty = ty;
    this.tile = tile;
    this.color = TILE_TO_COLOR[tile];
    this.map = map;
    const tex = 'door_' + this.color;
    const wx = tx * TILE_SIZE + TILE_SIZE / 2;
    const wy = ty * TILE_SIZE + TILE_SIZE / 2;
    this.sprite = scene.physics.add.staticImage(wx, wy, tex);
    this.sprite.doorRef = this;
  }

  open() {
    this.map.tiles[this.ty][this.tx] = TILE.FLOOR;
    this.sprite.destroy();
  }
}
