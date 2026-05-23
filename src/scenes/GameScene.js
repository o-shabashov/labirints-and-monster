import { TILE, TILE_SIZE, GRID_W, GRID_H } from '../config/constants.js';
import { TileMap } from '../world/TileMap.js';
import { Player } from '../entities/Player.js';
import { generateMaze } from '../world/MazeGenerator.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    const seed = Date.now();
    this.map = new TileMap(this, generateMaze(GRID_W, GRID_H, seed));
    const e = this.map.entrance;
    const spawn = this.map.tileToWorld(e.x, e.y);
    this.player = new Player(this, spawn.x, spawn.y);
    this.physics.add.collider(this.player.sprite, this.map.walls);

    const exitPos = this.map.tileToWorld(this.map.exit.x, this.map.exit.y);
    this.exitZone = this.add.zone(exitPos.x, exitPos.y, TILE_SIZE, TILE_SIZE);
    this.physics.add.existing(this.exitZone, true);
    this.physics.add.overlap(this.player.sprite, this.exitZone, () => {
      this.scene.start('VictoryScene');
    });

    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT');
  }

  update() {
    // временный inline-ввод, заменим в Task 5
    const k = this.keys;
    const move = { x: 0, y: 0 };
    if (k.A.isDown || k.LEFT.isDown) move.x = -1;
    else if (k.D.isDown || k.RIGHT.isDown) move.x = 1;
    if (k.W.isDown || k.UP.isDown) move.y = -1;
    else if (k.S.isDown || k.DOWN.isDown) move.y = 1;
    const len = Math.hypot(move.x, move.y);
    if (len > 0) { move.x /= len; move.y /= len; }

    this.player.update({ move });
  }
}
