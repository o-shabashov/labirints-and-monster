import { BULLET_SPEED, BULLET_LIFETIME_MS } from '../config/constants.js';

export class Bullet {
  constructor(scene, x, y, dirX, dirY) {
    this.sprite = scene.physics.add.sprite(x, y, 'bullet');
    this.sprite.body.setAllowGravity(false);
    this.sprite.body.setVelocity(dirX * BULLET_SPEED, dirY * BULLET_SPEED);
    this.dieAt = scene.time.now + BULLET_LIFETIME_MS;
    this.dead = false;
  }
  update(now) {
    if (now >= this.dieAt) this.kill();
  }
  kill() {
    if (this.dead) return;
    this.dead = true;
    this.sprite.destroy();
  }
}
