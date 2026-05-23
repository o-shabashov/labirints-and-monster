import { PLAYER_MAX_HP } from '../config/constants.js';

export class UIScene extends Phaser.Scene {
  constructor() { super('UIScene'); }
  create() {
    this.hpText = this.add.text(12, 8, '', {
      fontFamily: 'monospace', fontSize: '20px', color: '#ff5252',
    });
    this.game.events.on('hud:update', this.onUpdate, this);
  }
  onUpdate(state) {
    this.hpText.setText('HP: ' + '♥'.repeat(state.hp) + '♡'.repeat(PLAYER_MAX_HP - state.hp));
  }
}
