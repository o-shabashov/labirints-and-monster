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
    this.add.text(GAME_W / 2, GAME_H / 2 + 90, 'ПРОБЕЛ / любая кнопка геймпада — заново', {
      fontFamily: 'monospace', fontSize: '16px', color: '#888888',
    }).setOrigin(0.5);
    this._restart = () => this.scene.start('GameScene');
    this.input.keyboard.once('keydown-SPACE', this._restart);
    this._gpInitial = sampleButtons();
    this._done = false;
  }

  update() {
    if (this._done) return;
    const cur = sampleButtons();
    if (cur.some((v, i) => v && !this._gpInitial[i])) {
      this._done = true;
      this._restart();
      return;
    }
    this._gpInitial = cur;
  }
}

// общий поллер для конечных сцен — слушает любую кнопку до момента нажатия.
// Оставлен экспортом для VictoryScene, которая делегирует сюда.
export function pollGamepadOnce(scene, onPress) {
  scene._gpInitial = sampleButtons();
  scene._restart = onPress;
  scene._done = false;
}

function sampleButtons() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) {
    if (!p) continue;
    return p.buttons.map(b => !!(b && b.pressed));
  }
  return [];
}
