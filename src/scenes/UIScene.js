import {
  PLAYER_MAX_HP, STARTING_AMMO, STAMINA_MAX,
  GAME_W, GAME_H, TOPBAR_H,
} from '../config/constants.js';

export class UIScene extends Phaser.Scene {
  constructor() { super('UIScene'); }
  create() {
    // топ-бар не зависит от мира и виден поверх него:
    // ставим собственный viewport во всю ширину и высоту TOPBAR_H, без скролла.
    this.cameras.main.setViewport(0, 0, GAME_W, TOPBAR_H);
    this.bg = this.add.rectangle(0, 0, GAME_W, TOPBAR_H, 0x0a0d10).setOrigin(0, 0);
    this.add.line(0, TOPBAR_H - 1, 0, 0, GAME_W, 0, 0x3a4250).setOrigin(0, 0);

    // ряд 1 (y=6)
    this.hpText = this.add.text(12, 6, '', {
      fontFamily: 'monospace', fontSize: '16px', color: '#ff5252',
    });
    this.armorText = this.add.text(140, 6, '', {
      fontFamily: 'monospace', fontSize: '16px', color: '#90caf9',
    });
    this.ammoText = this.add.text(260, 6, '', {
      fontFamily: 'monospace', fontSize: '16px', color: '#fff176',
    });
    this.keysText = this.add.text(340, 6, '', {
      fontFamily: 'monospace', fontSize: '16px',
    });
    this.deviceIndicator = this.add.text(GAME_W - 12, 6, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#888888',
    }).setOrigin(1, 0);

    // ряд 2 (y=28): stamina-бар и эффекты + interactHint по центру
    this.staminaBg = this.add.rectangle(12, 30, 120, 8, 0x222222).setOrigin(0, 0);
    this.staminaBar = this.add.rectangle(12, 30, 120, 8, 0x4ec9ff).setOrigin(0, 0);
    this.effectsText = this.add.text(140, 26, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#dddddd',
    });
    this.interactHint = this.add.text(GAME_W / 2, 28, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffd54f',
    }).setOrigin(0.5, 0);

    this.onUpdate({ hp: PLAYER_MAX_HP });
    this.onUpdate({ ammo: STARTING_AMMO });
    this.onUpdate({ stamina: STAMINA_MAX });
    this.onUpdate({ keys: [] });
    this.onUpdate({ armor: 0 });
    this.onUpdate({ effects: [] });
    this.onUpdate({ interactHint: '' });
    this.game.events.on('hud:update', this.onUpdate, this);
    this.events.once('shutdown', () => {
      this.game.events.off('hud:update', this.onUpdate, this);
    });
  }
  onUpdate(state) {
    if (state.hp != null) {
      this.hpText.setText('HP: ' + '♥'.repeat(state.hp) + '♡'.repeat(PLAYER_MAX_HP - state.hp));
    }
    if (state.ammo != null) this.ammoText.setText('● ' + state.ammo);
    if (state.stamina != null) this.staminaBar.width = 120 * (state.stamina / 100);
    if (state.keys != null) {
      const map = { r: '🔴', g: '🟢', b: '🔵' };
      this.keysText.setText(state.keys.length ? 'Keys: ' + state.keys.map(c => map[c]).join(' ') : '');
    }
    if (state.armor != null) {
      this.armorText.setText(state.armor > 0 ? 'Armor: ' + '◆'.repeat(state.armor) : '');
    }
    if (state.effects != null) {
      this.effectsText.setText(state.effects.map(e => `${e.type} ${Math.ceil(e.msLeft / 1000)}s`).join('  '));
    }
    if (state.interactHint != null) {
      this.interactHint.setText(state.interactHint);
    }
    if (state.device != null) {
      this.deviceIndicator.setText(state.device === 'gamepad' ? '🎮 Gamepad' : '⌨ Keyboard');
    }
  }
}
