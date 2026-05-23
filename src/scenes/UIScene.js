import { PLAYER_MAX_HP, STARTING_AMMO, STAMINA_MAX } from '../config/constants.js';

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
    this.onUpdate({ hp: PLAYER_MAX_HP });
    this.onUpdate({ ammo: STARTING_AMMO });
    this.onUpdate({ stamina: STAMINA_MAX });
    this.onUpdate({ keys: [] });
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
  }
}
