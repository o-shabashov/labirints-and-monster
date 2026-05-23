import {
  PLAYER_SPEED, PLAYER_SIZE, PLAYER_MAX_HP, FIRE_RATE_MS, FIRE_RATE_PER_LEVEL, STARTING_AMMO,
  STAMINA_MAX, STAMINA_SPRINT_PER_SEC, STAMINA_REGEN_PER_SEC,
  SPRINT_MULTIPLIER, DASH_DISTANCE, DASH_DURATION_MS, DASH_COOLDOWN_MS, DASH_STAMINA_COST,
  ARMOR_MAX, ARMOR_REGEN_DELAY_MS, SLOW_MULTIPLIER,
  SPEED_BOOST_MULTIPLIER, RAPID_FIRE_FACTOR, DAMAGE_BOOST_BONUS,
  WEAPON_XP_PER_LEVEL, WEAPON_MAX_LEVEL,
} from '../config/constants.js';
import { applyKnockback, KNOCKBACK_DURATION, INVULNERABILITY_DURATION } from '../systems/Combat.js';
import { hasEffect } from '../systems/Effects.js';
import { getSound } from '../systems/Sound.js';

export class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.sprite = scene.physics.add.sprite(x, y, 'player');
    // scale 1.0 → display 16×28. Игрок занимает ~половину 32px-коридора,
    // ощущение «проход шире чем игрок».
    this.sprite.setScale(1.0);
    this.sprite.setOrigin(0.5, 0.7);
    // компактный body-circle, чтобы свободно пролезать в коридорах
    const w = this.sprite.width, h = this.sprite.height;
    const r = 5;
    this.sprite.body.setCircle(r, w / 2 - r, h * 0.7 - r);
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
    this.armor = 0;
    this.lastDamageAt = 0;
    this.lureCharges = 0;
    this.shieldCharges = 0;
    this.weaponLevel = 1;
    this.weaponXp = 0;
  }

  upgradeWeapon() {
    if (this.weaponLevel >= WEAPON_MAX_LEVEL) return;
    this.weaponLevel++;
    this.weaponXp = 0;
    this.scene.showToast?.(`Оружие → ур. ${this.weaponLevel}`, '#fff59d');
  }

  addWeaponXp(n = 1) {
    if (this.weaponLevel >= WEAPON_MAX_LEVEL) return;
    this.weaponXp += n;
    if (this.weaponXp >= WEAPON_XP_PER_LEVEL) {
      this.weaponXp -= WEAPON_XP_PER_LEVEL;
      this.weaponLevel++;
      this.scene.showToast?.(`Оружие → ур. ${this.weaponLevel}`, '#fff59d');
    }
  }

  // итоговый урон пули — уровень оружия + бонус damage, минус slbость
  bulletDamage(scene) {
    let d = this.weaponLevel;
    if (scene.gameState && hasEffect(scene.gameState, 'damage')) d += DAMAGE_BOOST_BONUS;
    if (scene.gameState && hasEffect(scene.gameState, 'weakness')) d = Math.max(1, d - 1);
    return d;
  }

  addKey(color) { this.keys.add(color); }
  hasKey(color) { return this.keys.has(color); }

  setAim(aim) { this.aim = aim; }

  // бесконечные снаряды — ограничен только fire-rate'ом (и его рапид-баффом)
  tryShoot(now) {
    if (!this.aim) return null;
    if (now < this.nextShotAt) return null;
    let interval = FIRE_RATE_MS * (1 - FIRE_RATE_PER_LEVEL * (this.weaponLevel - 1));
    if (this.scene.gameState && hasEffect(this.scene.gameState, 'rapid_fire')) {
      interval *= RAPID_FIRE_FACTOR;
    }
    this.nextShotAt = now + interval;
    return { x: this.aim.x, y: this.aim.y, ox: this.sprite.x, oy: this.sprite.y };
  }

  takeHit(fromX, fromY) {
    const now = this.scene.time.now;
    if (now < this.iframesUntil) return false;
    if (this.shieldCharges > 0) {
      this.shieldCharges -= 1;
    } else if (this.armor > 0) {
      this.armor -= 1;
    } else {
      this.hp -= 1;
    }
    this.lastDamageAt = now;
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

  addArmor(n) {
    this.armor = Math.min(this.armor + n, ARMOR_MAX);
  }

  regenArmorTick(now) {
    if (now - this.lastDamageAt > ARMOR_REGEN_DELAY_MS && this.armor < ARMOR_MAX) {
      this.armor = Math.min(this.armor + 1, ARMOR_MAX);
      this.lastDamageAt = now; // следующая регенерация через 8 сек
    }
  }

  update(input) {
    const now = this.scene.time.now;
    if (now < this.knockbackUntil) return; // knockback ведёт игрока

    // dash в процессе → принудительная скорость, неуязвимость.
    // Phaser arcade сам тормозит при коллизии со стеной — отдельный abort
    // не нужен, иначе игрок ощущает «трение» (резкая остановка вдоль стены).
    if (now < this.dashUntil) {
      const speed = DASH_DISTANCE / (DASH_DURATION_MS / 1000);
      this.sprite.body.setVelocity(this.dashDir.x * speed, this.dashDir.y * speed);
      return;
    }

    // активация dash — требует и cooldown'а, и хватает stamina
    if (input.dash && now >= this.dashCooldownUntil && this.stamina >= DASH_STAMINA_COST) {
      const dir = (input.move.x || input.move.y)
        ? { x: input.move.x, y: input.move.y }
        : (this.aim || { x: 1, y: 0 });
      this.dashDir = dir;
      this.dashUntil = now + DASH_DURATION_MS;
      this.dashCooldownUntil = now + DASH_COOLDOWN_MS;
      this.stamina = Math.max(0, this.stamina - DASH_STAMINA_COST);
      this.iframesUntil = Math.max(this.iframesUntil, this.dashUntil);
      getSound().dash();
      return;
    }

    // sprint и эффекты скорости
    let speed = PLAYER_SPEED;
    const dtSec = this.scene.game.loop.delta / 1000;
    const exhausted = this.scene.gameState && hasEffect(this.scene.gameState, 'exhausted');
    if (input.sprint && this.stamina > 0 && (input.move.x || input.move.y)) {
      speed *= SPRINT_MULTIPLIER;
      this.stamina = Math.max(0, this.stamina - STAMINA_SPRINT_PER_SEC * dtSec);
    } else if (!exhausted) {
      this.stamina = Math.min(STAMINA_MAX, this.stamina + STAMINA_REGEN_PER_SEC * dtSec);
    }

    if (this.scene.gameState && hasEffect(this.scene.gameState, 'slow')) {
      speed *= SLOW_MULTIPLIER;
    }
    if (this.scene.gameState && hasEffect(this.scene.gameState, 'speed')) {
      speed *= SPEED_BOOST_MULTIPLIER;
    }

    const vx = input.move.x * speed;
    const vy = input.move.y * speed;
    this.sprite.body.setVelocity(vx, vy);
    // flip спрайта по направлению — голова смотрит туда, куда движешься
    if (Math.abs(vx) > 1) this.sprite.setFlipX(vx < 0);
  }

  isDead() {
    return this.hp <= 0;
  }
}
