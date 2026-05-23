import { BULLET_SPEED, BULLET_LIFETIME_MS } from '../config/constants.js';

// Пуля с лёгким самонаведением: если выстрел сделан в видимого через LOS монстра,
// каждый кадр доворачивает курс к нему с ограниченной угловой скоростью. Если цель
// убита или ушла в fog — продолжает лететь по последнему вектору.
const MAX_TURN_RAD_PER_SEC = Math.PI * 3;  // ~540°/сек — заметное, но не «магическое»

export class Bullet {
  constructor(scene, x, y, dirX, dirY, target = null) {
    this.sprite = scene.physics.add.sprite(x, y, 'bullet');
    this.sprite.setScale(1.8);
    // повернём sprite по направлению полёта — стрела «целится» куда летит
    this.sprite.setRotation(Math.atan2(dirY, dirX));
    this.sprite.body.setAllowGravity(false);
    this.sprite.body.setVelocity(dirX * BULLET_SPEED, dirY * BULLET_SPEED);
    this.dieAt = scene.time.now + BULLET_LIFETIME_MS;
    this.dead = false;
    this.target = target;
  }

  update(now, deltaMs = 16) {
    // пуля могла быть уничтожена в overlap-коллбэке ранее в этом же кадре —
    // sprite destroyed, body нет. Не лезем дальше: один такой crash тихо
    // ломал весь update loop и игра «зависала» в кадре столкновения.
    if (this.dead || !this.sprite || !this.sprite.active || !this.sprite.body) return;
    if (this.target && this.target.sprite && this.target.sprite.active) {
      const vx = this.sprite.body.velocity.x;
      const vy = this.sprite.body.velocity.y;
      const curAngle = Math.atan2(vy, vx);
      const desiredAngle = Math.atan2(
        this.target.sprite.y - this.sprite.y,
        this.target.sprite.x - this.sprite.x,
      );
      let diff = desiredAngle - curAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const maxTurn = MAX_TURN_RAD_PER_SEC * (deltaMs / 1000);
      const turn = Math.max(-maxTurn, Math.min(maxTurn, diff));
      const newAngle = curAngle + turn;
      this.sprite.body.setVelocity(Math.cos(newAngle) * BULLET_SPEED, Math.sin(newAngle) * BULLET_SPEED);
      this.sprite.setRotation(newAngle);
    } else {
      this.target = null;
    }
    if (now >= this.dieAt) this.kill();
  }

  kill() {
    if (this.dead) return;
    this.dead = true;
    this.sprite.destroy();
  }
}
