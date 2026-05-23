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
    const restart = () => this.scene.start('GameScene');
    this.input.keyboard.once('keydown-SPACE', restart);
    pollGamepadOnce(this, restart);
  }
}

// общий поллер для конечных сцен — слушает любую кнопку до момента нажатия.
export function pollGamepadOnce(scene, onPress) {
  // снимаем «отпечаток» начального состояния, чтобы переход не сработал от
  // ещё зажатой кнопки, которая привела к смерти.
  const initial = sampleButtons();
  const tick = () => {
    if (!scene.scene.isActive()) return;
    const now = sampleButtons();
    if (now.some((v, i) => v && !initial[i])) {
      onPress();
      return;
    }
    scene.time.delayedCall(50, tick);
  };
  tick();
}

function sampleButtons() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const out = [];
  for (const p of pads) {
    if (!p) continue;
    for (let i = 0; i < p.buttons.length; i++) out[i] = !!(p.buttons[i] && p.buttons[i].pressed);
    return out;
  }
  return out;
}
