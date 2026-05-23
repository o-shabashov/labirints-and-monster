import { PLAYER_MAX_HP, STARTING_AMMO, STAMINA_MAX, GAME_W, GAME_H } from '../config/constants.js';

export class UIScene extends Phaser.Scene {
  constructor() { super('UIScene'); }
  create() {
    this.hpText = this.add.text(12, 8, '', {
      fontFamily: 'monospace', fontSize: '20px', color: '#ff5252',
    });
    this.ammoText = this.add.text(12, 32, '', {
      fontFamily: 'monospace', fontSize: '18px', color: '#fff176',
    });
    this.staminaBg = this.add.rectangle(12, 60, 120, 8, 0x222222).setOrigin(0, 0);
    this.staminaBar = this.add.rectangle(12, 60, 120, 8, 0x4ec9ff).setOrigin(0, 0);
    this.keysText = this.add.text(12, 84, '', {
      fontFamily: 'monospace', fontSize: '18px',
    });
    this.armorText = this.add.text(12, 108, '', {
      fontFamily: 'monospace', fontSize: '18px', color: '#90caf9',
    });
    this.effectsText = this.add.text(12, 132, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#dddddd',
    });
    this.interactHint = this.add.text(GAME_W / 2, GAME_H - 30, '', {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffd54f',
    }).setOrigin(0.5);

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
      this.keysText.setText('Keys: ' + state.keys.map(c => map[c]).join(' '));
    }
    if (state.armor != null) {
      this.armorText.setText('Armor: ' + '◆'.repeat(state.armor));
    }
    if (state.effects != null) {
      this.effectsText.setText(state.effects.map(e => `${e.type} ${Math.ceil(e.msLeft / 1000)}s`).join('  '));
    }
    if (state.interactHint != null) {
      this.interactHint.setText(state.interactHint);
    }
  }
}
