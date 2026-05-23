export const PICKUP_TYPE = {
  HEART: 'heart',
  KEY_R: 'key_r',
  KEY_G: 'key_g',
  KEY_B: 'key_b',
  AMMO:  'ammo',
};

const TEXTURES = {
  heart: 'pickup_heart',
  key_r: 'key_r',
  key_g: 'key_g',
  key_b: 'key_b',
  ammo:  'pickup_ammo',
};

export class Pickup {
  constructor(scene, x, y, type) {
    this.type = type;
    const tex = TEXTURES[type] || 'pickup_heart';
    // pickup_ammo пока не создаётся в BootScene → fallback на heart
    const safeTex = scene.textures.exists(tex) ? tex : 'pickup_heart';
    this.sprite = scene.physics.add.sprite(x, y, safeTex);
    this.sprite.setScale(2);
    this.sprite.body.setAllowGravity(false);
    this.sprite.body.setImmovable(true);
    this.sprite.pickupRef = this;
  }
}
