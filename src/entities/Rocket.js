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
    this._nextSmokeAt = scene.time.now;
  }

  update(now) {
    if (this.dead || !this.sprite || !this.sprite.active || !this.sprite.body) return;
    // Дымный след: пуф каждые ~40ms за хвостом ракеты (8px назад от центра).
    if (now >= this._nextSmokeAt) {
      this._nextSmokeAt = now + 40;
      const tx = this.sprite.x - this.dirX * 10;
      const ty = this.sprite.y - this.dirY * 10;
      const puff = this.scene.add.image(tx, ty, 'smoke_particle')
        .setDepth(3)
        .setScale(0.4 + Math.random() * 0.25)
        .setAlpha(0.55);
      this.scene.tweens.add({
        targets: puff,
        scale: { from: 0.5, to: 1.3 },
        alpha: { from: 0.55, to: 0 },
        duration: 500 + Math.random() * 250,
        ease: 'Sine.easeOut',
        onComplete: () => puff.destroy(),
      });
    }
    if (now >= this.dieAt) this.kill();
  }

  kill() {
    if (this.dead) return;
    this.dead = true;
    if (this.sprite) this.sprite.destroy();
  }
}
