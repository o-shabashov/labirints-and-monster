import { GAME_W, GAME_H } from '../config/constants.js';
import { getSound } from '../systems/Sound.js';

export class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }
  create() {
    this.cameras.main.setBackgroundColor(0x0a0d10);
    this.add.text(GAME_W / 2, 120, 'Labirints & Monster', {
      fontFamily: 'monospace', fontSize: '40px', color: '#4ec9ff',
    }).setOrigin(0.5);
    this.add.text(GAME_W / 2, 200, 'WASD / стик — двигаться', { fontFamily: 'monospace', fontSize: '16px', color: '#aaaaaa' }).setOrigin(0.5);
    this.add.text(GAME_W / 2, 224, 'мышь / правый стик — целиться', { fontFamily: 'monospace', fontSize: '16px', color: '#aaaaaa' }).setOrigin(0.5);
    this.add.text(GAME_W / 2, 248, 'ЛКМ / RT — стрелять (самонаведение)', { fontFamily: 'monospace', fontSize: '16px', color: '#aaaaaa' }).setOrigin(0.5);
    this.add.text(GAME_W / 2, 272, 'Shift / LT — бежать', { fontFamily: 'monospace', fontSize: '16px', color: '#aaaaaa' }).setOrigin(0.5);
    this.add.text(GAME_W / 2, 296, 'Space / A — рывок', { fontFamily: 'monospace', fontSize: '16px', color: '#aaaaaa' }).setOrigin(0.5);
    this.add.text(GAME_W / 2, 320, 'E / X — взаимодействие', { fontFamily: 'monospace', fontSize: '16px', color: '#aaaaaa' }).setOrigin(0.5);

    this.add.text(GAME_W / 2, GAME_H - 100, 'Нажми ПРОБЕЛ или кнопку на геймпаде', {
      fontFamily: 'monospace', fontSize: '18px', color: '#ffd54f',
    }).setOrigin(0.5);

    // WebAudio требует user-gesture перед стартом — оба входа служат активатором.
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      const sound = getSound();
      sound.resume();
      sound.startMusic();
      this.scene.start('GameScene');
    };
    this.input.keyboard.once('keydown-SPACE', start);
    this.pollGamepad(start);
  }
  pollGamepad(start) {
    // edge-фильтр: запоминаем какие кнопки нажаты при заходе в меню, чтобы
    // зажатая ранее кнопка (например, при рестарте) не дёргала старт сразу.
    const initial = sampleButtons();
    const tick = () => {
      if (!this.scene.isActive()) return;
      const now = sampleButtons();
      if (now.some((v, i) => v && !initial[i])) {
        start();
        return;
      }
      this.time.delayedCall(50, tick);
    };
    tick();
  }
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
