import { ROCKET_SPEED, ROCKET_LIFETIME_MS } from '../config/constants.js';

// Ракета — медленный AoE-снаряд. Не самонаводится, не пульсирует — летит
// прямолинейно. Взрыв (damage стен, AoE монстрам, тряска, knockback)
// обрабатывается в GameScene, чтобы централизованно дёргать map.damageAt и
// applyKnockback к монстрам в радиусе.
export class Rocket {
  constructor(scene, x, y, dirX, dirY) {
    this.scene = scene;
    this.sprite = scene.physics.add.sprite(x, y, 'rocket');
    this.sprite.setScale(1.0);
    this.sprite.setRotation(Math.atan2(dirY, dirX));
    this.sprite.body.setAllowGravity(false);
    this.sprite.body.setCircle(5, this.sprite.width / 2 - 5, this.sprite.height / 2 - 5);
    this.sprite.body.setVelocity(dirX * ROCKET_SPEED, dirY * ROCKET_SPEED);
    this.dirX = dirX;
    this.dirY = dirY;
    this.dieAt = scene.time.now + ROCKET_LIFETIME_MS;
    this.dead = false;
  }

  update(now) {
    if (this.dead || !this.sprite || !this.sprite.active || !this.sprite.body) return;
    if (now >= this.dieAt) this.kill();
  }

  kill() {
    if (this.dead) return;
    this.dead = true;
    if (this.sprite) this.sprite.destroy();
  }
}
