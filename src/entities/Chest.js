const POWER_UPS = ['armor', 'lure', 'compass', 'heal', 'ammo'];
const DEBUFFS = ['poison', 'slow', 'blindness'];

export class Chest {
  constructor(scene, x, y) {
    this.scene = scene;
    this.sprite = scene.physics.add.staticImage(x, y, 'chest');
    this.sprite.setScale(1.6);
    this.sprite.refreshBody();
    this.sprite.chestRef = this;
    this.opened = false;
  }

  open(rand = Math.random) {
    if (this.opened) return null;
    this.opened = true;
    this.sprite.destroy();
    const isPower = rand() < 0.7;
    const pool = isPower ? POWER_UPS : DEBUFFS;
    return pool[Math.floor(rand() * pool.length)];
  }
}
