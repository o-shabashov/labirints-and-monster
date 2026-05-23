import { GAME_W, GAME_H, TOPBAR_H, CANVAS_H } from '../config/constants.js';

const LABELS = {
  armor:        { name: 'Броня',          desc: '+2 щита', color: '#90caf9' },
  heal:         { name: 'Аптечка',        desc: '+1 HP', color: '#a3d977' },
  ammo:         { name: 'Патроны',        desc: '+10 пуль', color: '#fff176' },
  compass:      { name: 'Компас',         desc: '20с — стрелка к выходу', color: '#ffd54f' },
  lure:         { name: 'Приманка',       desc: '+1 заряд, отвлекает врагов', color: '#ce93d8' },
  speed:        { name: 'Быстрота',       desc: '+40% скорости, 20с', color: '#80deea' },
  damage:       { name: 'Сила атаки',     desc: '+1 урон, 20с', color: '#ff8a65' },
  rapid_fire:   { name: 'Скорострел',     desc: 'Стрельба ×2, 15с', color: '#ffab40' },
  vision_boost: { name: 'Глаз филина',    desc: '+3 тайла зрения, 25с', color: '#aed581' },
  regen:        { name: 'Регенерация',    desc: '+1 HP каждые 3с, 20с', color: '#f48fb1' },
  shield:       { name: 'Щит',            desc: '+1 заряд, поглощает удар', color: '#9fa8da' },
  weapon_upgrade: { name: 'Прокачка оружия', desc: 'Оружие +1 уровень', color: '#fff59d' },
};

export class ChestScene extends Phaser.Scene {
  constructor() { super('ChestScene'); }

  create(data) {
    const options = data?.options || ['heal', 'ammo', 'armor'];
    // полу-прозрачный фон поверх игры
    this.add.rectangle(0, 0, GAME_W, CANVAS_H, 0x000000, 0.65).setOrigin(0, 0);

    this.add.text(GAME_W / 2, 90, 'Сундук открыт!', {
      fontFamily: 'monospace', fontSize: '28px', color: '#ffd54f',
    }).setOrigin(0.5);
    this.add.text(GAME_W / 2, 130, 'Выбери награду — 1 / 2 / 3 (или A / B / X)', {
      fontFamily: 'monospace', fontSize: '14px', color: '#cccccc',
    }).setOrigin(0.5);

    const startY = 200;
    const step = 90;
    this.cards = options.map((opt, idx) => this.drawCard(idx, opt, startY + step * idx));

    // клавиатура
    for (let i = 0; i < options.length; i++) {
      const key = String(i + 1);
      this.input.keyboard.once('keydown-' + key, () => this.choose(options[i]));
    }
    // геймпад: A=0, B=1, X=2 — фиксированный mapping на 3 опции
    this._gpInitial = sampleButtons();
    this.gpTick = () => {
      if (!this.scene.isActive()) return;
      const cur = sampleButtons();
      const fresh = cur.map((v, i) => v && !this._gpInitial[i]);
      const gpMap = [0, 1, 2]; // first three buttons → options
      for (let i = 0; i < options.length; i++) {
        if (fresh[gpMap[i]]) { this.choose(options[i]); return; }
      }
      this.time.delayedCall(50, this.gpTick);
    };
    this.gpTick();
  }

  drawCard(idx, type, y) {
    const lbl = LABELS[type] || { name: type, desc: '', color: '#ffffff' };
    const w = 460, h = 70;
    const x = (GAME_W - w) / 2;
    const card = this.add.rectangle(x, y, w, h, 0x1c2027, 0.95).setOrigin(0, 0);
    card.setStrokeStyle(2, parseInt(lbl.color.slice(1), 16));
    this.add.text(x + 16, y + 8, `${idx + 1}. ${lbl.name}`, {
      fontFamily: 'monospace', fontSize: '20px', color: lbl.color,
    });
    this.add.text(x + 16, y + 36, lbl.desc, {
      fontFamily: 'monospace', fontSize: '14px', color: '#cccccc',
    });
    return card;
  }

  choose(type) {
    this.game.events.emit('chest:choice', type);
    this.scene.stop('ChestScene');
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
