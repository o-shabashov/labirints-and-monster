import { GAME_W, GAME_H } from '../config/constants.js';

export class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOverScene'); }
  create(data = {}) {
    const summary = data || {};
    this.cameras.main.setBackgroundColor(0x201010);
    this.add.text(GAME_W / 2, GAME_H / 2 - 80, 'Вы погибли', {
      fontFamily: 'monospace', fontSize: '48px', color: '#ff5252',
    }).setOrigin(0.5);
    const lines = [
      `Время: ${summary.timeSec ?? 0} с`,
      `Убито монстров: ${summary.killed ?? 0}`,
      `Исследовано: ${summary.explored ?? 0}%`,
    ];
    this.add.text(GAME_W / 2, GAME_H / 2, lines.join('\n'), {
      fontFamily: 'monospace', fontSize: '18px', color: '#dddddd', align: 'center',
    }).setOrigin(0.5);
    this.add.text(GAME_W / 2, GAME_H / 2 + 90, 'ПРОБЕЛ — заново', {
      fontFamily: 'monospace', fontSize: '16px', color: '#888888',
    }).setOrigin(0.5);
    this.input.keyboard.once('keydown-SPACE', () => this.scene.start('GameScene'));
  }
}
