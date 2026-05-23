import { GAME_W, GAME_H, COLOR } from '../config/constants.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }
  create() {
    this.cameras.main.setBackgroundColor(COLOR.BG);
    this.add.text(GAME_W / 2, GAME_H / 2, 'GameScene', {
      fontFamily: 'monospace', fontSize: '24px', color: '#4ec9ff',
    }).setOrigin(0.5);
  }
}
