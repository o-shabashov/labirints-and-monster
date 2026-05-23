import { GAME_W, GAME_H, TOPBAR_H, CANVAS_H } from '../config/constants.js';

const LABELS = {
  armor:        { name: 'Броня',          desc: '+2 щита', color: 0x90caf9 },
  heal:         { name: 'Аптечка',        desc: '+1 HP', color: 0xa3d977 },
  ammo:         { name: 'Патроны',        desc: '+10 пуль', color: 0xfff176 },
  compass:      { name: 'Компас',         desc: '20с — стрелка к выходу', color: 0xffd54f },
  lure:         { name: 'Приманка',       desc: '+1 заряд, отвлекает врагов', color: 0xce93d8 },
  speed:        { name: 'Быстрота',       desc: '+40% скорости, 20с', color: 0x80deea },
  damage:       { name: 'Сила атаки',     desc: '+1 урон, 20с', color: 0xff8a65 },
  rapid_fire:   { name: 'Скорострел',     desc: 'Стрельба ×2, 15с', color: 0xffab40 },
  vision_boost: { name: 'Глаз филина',    desc: '+3 тайла зрения, 25с', color: 0xaed581 },
  regen:        { name: 'Регенерация',    desc: '+1 HP каждые 3с, 20с', color: 0xf48fb1 },
  shield:       { name: 'Щит',            desc: '+1 заряд, поглощает удар', color: 0x9fa8da },
  weapon_upgrade: { name: 'Прокачка оружия', desc: 'Оружие +1 уровень', color: 0xfff59d },
};

export class ChestScene extends Phaser.Scene {
  constructor() { super('ChestScene'); }

  create(data) {
    this.options = data?.options || ['heal', 'ammo', 'armor'];
    this.selected = 0;

    this.add.rectangle(0, 0, GAME_W, CANVAS_H, 0x000000, 0.65).setOrigin(0, 0);
    this.add.text(GAME_W / 2, 90, 'Сундук открыт!', {
      fontFamily: 'monospace', fontSize: '28px', color: '#ffd54f',
    }).setOrigin(0.5);
    this.add.text(GAME_W / 2, 130, 'Стик / мышь / 1·2·3 — выбор, A / Enter / клик — подтвердить', {
      fontFamily: 'monospace', fontSize: '14px', color: '#cccccc',
    }).setOrigin(0.5);

    this.cards = this.options.map((opt, idx) => this.drawCard(idx, opt, 200 + idx * 90));
    this.refreshHighlight();

    // ---- ввод ----
    // мгновенное нажатие 1/2/3 — выбор + подтверждение
    for (let i = 0; i < this.options.length; i++) {
      this.input.keyboard.once('keydown-' + String(i + 1), () => this.choose(i));
    }
    // стрелки/WS меняют selected, Enter/Space подтверждают
    this.input.keyboard.on('keydown-UP',     () => this.move(-1));
    this.input.keyboard.on('keydown-DOWN',   () => this.move(+1));
    this.input.keyboard.on('keydown-W',      () => this.move(-1));
    this.input.keyboard.on('keydown-S',      () => this.move(+1));
    this.input.keyboard.on('keydown-ENTER',  () => this.choose(this.selected));
    this.input.keyboard.on('keydown-SPACE',  () => this.choose(this.selected));
    // мышь: hover подсвечивает, click подтверждает
    for (const c of this.cards) {
      c.bg.setInteractive({ useHandCursor: true });
      c.bg.on('pointerover', () => { this.selected = c.idx; this.refreshHighlight(); });
      c.bg.on('pointerdown', () => this.choose(c.idx));
    }
    // геймпад: стик Y или dpad — навигация; A / B / X — выбор соответствующего варианта;
    // RT/L2 — подтвердить текущий.
    this._gpInitial = sampleButtons();
    this._gpAxisCooldown = 0;
    this.gpTick = () => {
      if (!this.scene.isActive()) return;
      const pad = navigator.getGamepads ? Array.from(navigator.getGamepads()).find(p => p) : null;
      if (pad) {
        const cur = pad.buttons.map(b => !!(b && b.pressed));
        const fresh = (i) => cur[i] && !this._gpInitial[i];
        if (fresh(0)) { this.choose(this.selected); return; }
        if (fresh(1) && this.options[1]) { this.choose(1); return; }
        if (fresh(2) && this.options[2]) { this.choose(2); return; }
        // стик/dpad по Y
        const axisY = pad.axes[1] || 0;
        const dpadUp = cur[12], dpadDown = cur[13];
        const now = performance.now();
        if (now > this._gpAxisCooldown) {
          if (axisY < -0.4 || dpadUp) { this.move(-1); this._gpAxisCooldown = now + 250; }
          else if (axisY > 0.4 || dpadDown) { this.move(+1); this._gpAxisCooldown = now + 250; }
        }
        this._gpInitial = cur;
      }
      this.time.delayedCall(50, this.gpTick);
    };
    this.gpTick();
  }

  drawCard(idx, type, y) {
    const lbl = LABELS[type] || { name: type, desc: '', color: 0xffffff };
    const w = 460, h = 70;
    const x = (GAME_W - w) / 2;
    const bg = this.add.rectangle(x, y, w, h, 0x1c2027, 0.95).setOrigin(0, 0);
    bg.setStrokeStyle(2, lbl.color);
    const title = this.add.text(x + 16, y + 8, `${idx + 1}. ${lbl.name}`, {
      fontFamily: 'monospace', fontSize: '20px', color: '#' + lbl.color.toString(16).padStart(6, '0'),
    });
    const desc = this.add.text(x + 16, y + 36, lbl.desc, {
      fontFamily: 'monospace', fontSize: '14px', color: '#cccccc',
    });
    return { idx, bg, title, desc, color: lbl.color };
  }

  refreshHighlight() {
    for (const c of this.cards) {
      const active = c.idx === this.selected;
      c.bg.setStrokeStyle(active ? 4 : 2, c.color);
      c.bg.setFillStyle(active ? 0x2a313c : 0x1c2027, active ? 1 : 0.95);
    }
  }

  move(delta) {
    this.selected = (this.selected + delta + this.options.length) % this.options.length;
    this.refreshHighlight();
  }

  choose(idx) {
    this.game.events.emit('chest:choice', this.options[idx]);
    this.scene.stop('ChestScene');
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
