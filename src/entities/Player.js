import { PLAYER_SPEED, PLAYER_MAX_HP, FIRE_RATE_MS, STARTING_AMMO } from '../config/constants.js';
import { applyKnockback, KNOCKBACK_DURATION, INVULNERABILITY_DURATION } from '../systems/Combat.js';

export class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.sprite = scene.physics.add.sprite(x, y, 'player');
    this.sprite.setCollideWorldBounds(true);
    this.hp = PLAYER_MAX_HP;
    this.knockbackUntil = 0;
    this.iframesUntil = 0;
    this.ammo = STARTING_AMMO;
    this.nextShotAt = 0;
    this.aim = null;
  }

  setAim(aim) { this.aim = aim; }

  tryShoot(now) {
    if (!this.aim) return null;
    if (this.ammo <= 0) return null;
    if (now < this.nextShotAt) return null;
    this.ammo -= 1;
    this.nextShotAt = now + FIRE_RATE_MS;
    return { x: this.aim.x, y: this.aim.y, ox: this.sprite.x, oy: this.sprite.y };
  }

  takeHit(fromX, fromY) {
    const now = this.scene.time.now;
    if (now < this.iframesUntil) return false;
    this.hp -= 1;
    this.iframesUntil = now + INVULNERABILITY_DURATION;
    this.knockbackUntil = now + KNOCKBACK_DURATION;
    applyKnockback(this.sprite, fromX, fromY);
    this.sprite.setTint(0xffffff);
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: { from: 0.3, to: 1 },
      duration: INVULNERABILITY_DURATION / 4,
      repeat: 3,
      yoyo: true,
      onComplete: () => { this.sprite.setAlpha(1); }
    });
    return true;
  }

  heal(n) {
    this.hp = Math.min(this.hp + n, PLAYER_MAX_HP);
  }

  update(input) {
    const now = this.scene.time.now;
    if (now < this.knockbackUntil) return; // knockback ведёт игрока
    const body = this.sprite.body;
    body.setVelocity(input.move.x * PLAYER_SPEED, input.move.y * PLAYER_SPEED);
  }

  isDead() {
    return this.hp <= 0;
  }
}
