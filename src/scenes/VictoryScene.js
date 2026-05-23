import { GAME_W, GAME_H } from '../config/constants.js';
import { pollGamepadOnce } from './GameOverScene.js';

export class VictoryScene extends Phaser.Scene {
  constructor() {
    super('VictoryScene');
  }

  create(data = {}) {
    const summary = data || {};
    this.cameras.main.setBackgroundColor(0x102010);
    this.add.text(GAME_W / 2, GAME_H / 2 - 80, 'Победа!', {
      fontFamily: 'monospace', fontSize: '48px', color: '#66bb6a',
    }).setOrigin(0.5);
    const lines = [
      `Время: ${summary.timeSec ?? 0} с`,
      `Убито монстров: ${summary.killed ?? 0}`,
      `Исследовано: ${summary.explored ?? 0}%`,
    ];
    this.add.text(GAME_W / 2, GAME_H / 2, lines.join('\n'), {
      fontFamily: 'monospace', fontSize: '18px', color: '#dddddd', align: 'center',
    }).setOrigin(0.5);
    this.add.text(GAME_W / 2, GAME_H / 2 + 90, 'ПРОБЕЛ / любая кнопка геймпада — заново', {
      fontFamily: 'monospace', fontSize: '16px', color: '#888888',
    }).setOrigin(0.5);
    const restart = () => this.scene.start('GameScene');
    this.input.keyboard.once('keydown-SPACE', restart);
    pollGamepadOnce(this, restart);
  }
}
