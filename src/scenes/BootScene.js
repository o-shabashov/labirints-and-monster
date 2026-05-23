import { TILE_SIZE, PLAYER_SIZE, COLOR } from '../config/constants.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }
  create() {
    const g = this.add.graphics();

    // wall
    g.fillStyle(COLOR.WALL, 1);
    g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    g.lineStyle(2, 0x000000, 0.4);
    g.strokeRect(1, 1, TILE_SIZE - 2, TILE_SIZE - 2);
    g.generateTexture('wall', TILE_SIZE, TILE_SIZE);
    g.clear();

    // floor
    g.fillStyle(COLOR.FLOOR, 1);
    g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    g.generateTexture('floor', TILE_SIZE, TILE_SIZE);
    g.clear();

    // entrance
    g.fillStyle(COLOR.ENTRANCE, 1);
    g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    g.generateTexture('entrance', TILE_SIZE, TILE_SIZE);
    g.clear();

    // exit
    g.fillStyle(COLOR.EXIT, 1);
    g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    g.lineStyle(3, 0x000000, 1);
    g.strokeRect(2, 2, TILE_SIZE - 4, TILE_SIZE - 4);
    g.generateTexture('exit', TILE_SIZE, TILE_SIZE);
    g.clear();

    // player
    g.fillStyle(COLOR.PLAYER, 1);
    g.fillRect(0, 0, PLAYER_SIZE, PLAYER_SIZE);
    g.lineStyle(2, 0xffffff, 1);
    g.strokeRect(1, 1, PLAYER_SIZE - 2, PLAYER_SIZE - 2);
    g.generateTexture('player', PLAYER_SIZE, PLAYER_SIZE);
    g.clear();

    // monster
    g.fillStyle(COLOR.MONSTER, 1);
    g.fillRect(0, 0, PLAYER_SIZE, PLAYER_SIZE);
    g.lineStyle(2, 0x000000, 1);
    g.strokeRect(1, 1, PLAYER_SIZE - 2, PLAYER_SIZE - 2);
    g.generateTexture('monster', PLAYER_SIZE, PLAYER_SIZE);
    g.clear();

    // pickup: heart
    g.fillStyle(0xff5252, 1);
    g.fillCircle(8, 8, 6);
    g.generateTexture('pickup_heart', 16, 16);
    g.clear();

    // bullet
    g.fillStyle(COLOR.BULLET, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture('bullet', 8, 8);
    g.clear();

    // wanderer (orange)
    g.fillStyle(0xff9800, 1);
    g.fillRect(0, 0, PLAYER_SIZE, PLAYER_SIZE);
    g.lineStyle(2, 0x000000, 1);
    g.strokeRect(1, 1, PLAYER_SIZE - 2, PLAYER_SIZE - 2);
    g.generateTexture('monster_wanderer', PLAYER_SIZE, PLAYER_SIZE);
    g.clear();

    // guard (purple)
    g.fillStyle(0x9c27b0, 1);
    g.fillRect(0, 0, PLAYER_SIZE, PLAYER_SIZE);
    g.lineStyle(2, 0x000000, 1);
    g.strokeRect(1, 1, PLAYER_SIZE - 2, PLAYER_SIZE - 2);
    g.generateTexture('monster_guard', PLAYER_SIZE, PLAYER_SIZE);
    g.destroy();

    this.scene.start('GameScene');
  }
}
