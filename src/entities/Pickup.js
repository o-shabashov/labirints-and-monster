export const PICKUP_TYPE = {
  HEART: 'heart',
};

export class Pickup {
  constructor(scene, x, y, type) {
    this.type = type;
    const tex = type === PICKUP_TYPE.HEART ? 'pickup_heart' : 'pickup_heart';
    this.sprite = scene.physics.add.sprite(x, y, tex);
    this.sprite.body.setAllowGravity(false);
    this.sprite.body.setImmovable(true);
    this.sprite.pickupRef = this;
  }
}
