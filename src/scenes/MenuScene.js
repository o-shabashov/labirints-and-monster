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

    this._started = false;
    this._start = () => {
      if (this._started) return;
      this._started = true;
      const sound = getSound();
      sound.resume();
      sound.startMusic();
      this.scene.start('GameScene');
    };
    this.input.keyboard.once('keydown-SPACE', this._start);
    // initial state — чтобы зажатая ранее кнопка (например, после рестарта)
    // не дёргала старт мгновенно при следующем заходе.
    this._gpInitial = sampleButtons();
  }

  // Polling в update() надёжнее, чем delayedCall — он точно тикает пока
  // scene активна, не зависит от внутренних таймеров.
  update() {
    if (this._started) return;
    const cur = sampleButtons();
    if (cur.some((v, i) => v && !this._gpInitial[i])) {
      this._start();
      return;
    }
    this._gpInitial = cur;
  }
}

function sampleButtons() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) {
    if (!p) continue;
    return p.buttons.map(b => !!(b && b.pressed));
  }
  return [];
}
