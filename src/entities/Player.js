import {
  PLAYER_SPEED, PLAYER_MAX_HP, FIRE_RATE_MS, STARTING_AMMO,
  STAMINA_MAX, STAMINA_SPRINT_PER_SEC, STAMINA_REGEN_PER_SEC,
  SPRINT_MULTIPLIER, DASH_DISTANCE, DASH_DURATION_MS, DASH_COOLDOWN_MS,
} from '../config/constants.js';
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
    this.stamina = STAMINA_MAX;
    this.dashUntil = 0;
    this.dashCooldownUntil = 0;
    this.dashDir = null;
    this.keys = new Set();   // 'r', 'g', 'b'
  }

  addKey(color) { this.keys.add(color); }
  hasKey(color) { return this.keys.has(color); }

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

    // dash в процессе → принудительная скорость, неуязвимость
    if (now < this.dashUntil) {
      const speed = DASH_DISTANCE / (DASH_DURATION_MS / 1000);
      this.sprite.body.setVelocity(this.dashDir.x * speed, this.dashDir.y * speed);
      return;
    }

    // активация dash
    if (input.dash && now >= this.dashCooldownUntil) {
      const dir = (input.move.x || input.move.y)
        ? { x: input.move.x, y: input.move.y }
        : (this.aim || { x: 1, y: 0 });
      this.dashDir = dir;
      this.dashUntil = now + DASH_DURATION_MS;
      this.dashCooldownUntil = now + DASH_COOLDOWN_MS;
      this.iframesUntil = Math.max(this.iframesUntil, this.dashUntil);
      return;
    }

    // sprint
    let speed = PLAYER_SPEED;
    const dtSec = this.scene.game.loop.delta / 1000;
    if (input.sprint && this.stamina > 0 && (input.move.x || input.move.y)) {
      speed *= SPRINT_MULTIPLIER;
      this.stamina = Math.max(0, this.stamina - STAMINA_SPRINT_PER_SEC * dtSec);
    } else {
      this.stamina = Math.min(STAMINA_MAX, this.stamina + STAMINA_REGEN_PER_SEC * dtSec);
    }

    this.sprite.body.setVelocity(input.move.x * speed, input.move.y * speed);
  }

  isDead() {
    return this.hp <= 0;
  }
}
