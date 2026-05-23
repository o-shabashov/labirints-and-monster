import { GAME_W, GAME_H } from '../config/constants.js';

export class VictoryScene extends Phaser.Scene {
  constructor() {
    super('VictoryScene');
  }

  create(data) {
    this.cameras.main.setBackgroundColor(0x102010);
    this.add.text(GAME_W / 2, GAME_H / 2 - 40, 'Победа!', {
      fontFamily: 'monospace', fontSize: '48px', color: '#66bb6a',
    }).setOrigin(0.5);

    this.add.text(GAME_W / 2, GAME_H / 2 + 20, 'Нажми ПРОБЕЛ для рестарта', {
      fontFamily: 'monospace', fontSize: '18px', color: '#dddddd',
    }).setOrigin(0.5);

    this.input.keyboard.once('keydown-SPACE', () => {
      this.scene.start('GameScene');
    });
  }
}
