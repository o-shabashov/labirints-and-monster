import { GAME_W, GAME_H } from '../config/constants.js';

export class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOverScene'); }
  create() {
    this.cameras.main.setBackgroundColor(0x201010);
    this.add.text(GAME_W / 2, GAME_H / 2 - 40, 'Вы погибли', {
      fontFamily: 'monospace', fontSize: '48px', color: '#ff5252',
    }).setOrigin(0.5);
    this.add.text(GAME_W / 2, GAME_H / 2 + 20, 'Нажми ПРОБЕЛ для рестарта', {
      fontFamily: 'monospace', fontSize: '18px', color: '#dddddd',
    }).setOrigin(0.5);
    this.input.keyboard.once('keydown-SPACE', () => this.scene.start('GameScene'));
  }
}
