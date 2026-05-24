import {
  TILE, TILE_SIZE, GRID_W, GRID_H, GAME_W, GAME_H, TOPBAR_H, VISION_RADIUS_TILES,
  isBlockingTile, BULLET_DESTROYS_WALLS,
  ROCKET_DAMAGE, ROCKET_AOE_DAMAGE, ROCKET_EXPLOSION_RADIUS,
  ROCKET_WALL_ERASE_RADIUS, ROCKET_MONSTER_KNOCKBACK,
  CAMERA_SHAKE_MS, CAMERA_SHAKE_INTENSITY,
  POISON_TICK_MS, POISON_TICKS,
  SLOW_DURATION_MS, BLINDNESS_DURATION_MS,
  COMPASS_DURATION_MS, LURE_DURATION_MS, LURE_THROW_TILES,
  SPEED_BOOST_DURATION_MS, DAMAGE_BOOST_DURATION_MS, RAPID_FIRE_DURATION_MS,
  VISION_BOOST_DURATION_MS, REGEN_DURATION_MS, REGEN_TICK_MS,
  EXHAUSTED_DURATION_MS, WEAKNESS_DURATION_MS,
  FIRE_RATE_MS, FIRE_RATE_PER_LEVEL,
  MOB_TIER_PERIOD_MS, MOB_TIER_MAX,
  MOB_TIER_HP_BONUS_PER, MOB_TIER_SPEED_BONUS_PER,
} from '../config/constants.js';
import { hasLineOfSight } from '../systems/Vision.js';
import { getSound } from '../systems/Sound.js';
import { TileMap } from '../world/TileMap.js';
import { Player } from '../entities/Player.js';
import { generateMaze } from '../world/MazeGenerator.js';
import { FogOfWar } from '../world/FogOfWar.js';
import { Input } from '../systems/Input.js';
import { Chaser } from '../entities/monsters/Chaser.js';
import { Wanderer } from '../entities/monsters/Wanderer.js';
import { Guard } from '../entities/monsters/Guard.js';
import { Shooter } from '../entities/monsters/Shooter.js';
import { Skeleton } from '../entities/monsters/Skeleton.js';
import { BigZombie } from '../entities/monsters/BigZombie.js';
import { Goblin } from '../entities/monsters/Goblin.js';
import { OrcWarrior } from '../entities/monsters/OrcWarrior.js';
import { TinyZombie } from '../entities/monsters/TinyZombie.js';
import { MaskedOrc } from '../entities/monsters/MaskedOrc.js';
import { Pickup, PICKUP_TYPE } from '../entities/Pickup.js';
import { Bullet } from '../entities/Bullet.js';
import { Rocket } from '../entities/Rocket.js';
import { Door } from '../entities/Door.js';
import { Chest } from '../entities/Chest.js';
import { addEffect, hasEffect, tickEffects } from '../systems/Effects.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    // мир рендерится ПОД топ-баром, чтобы HUD не накрывал лабиринт
    this.cameras.main.setViewport(0, TOPBAR_H, GAME_W, GAME_H);
    this.scene.launch('UIScene');
    this.sound = getSound();

    this.gameState = { effects: [] };
    this.bullets = [];
    this.rockets = [];
    this.enemyProjectiles = [];
    this.lure = null;
    this.lastMoveDir = { x: 1, y: 0 };
    this.lastAimDir = { x: 1, y: 0 };
    this._inputCooldownUntil = 0;

    const seed = Date.now();
    const { grid, keys: keySpec, doors: doorSpec } = generateMaze(GRID_W, GRID_H, seed);
    this.map = new TileMap(this, grid);

    this.stats = {
      startedAt: this.time.now,
      monstersKilled: 0,
      totalCells: this.countFloorCells(),
    };

    const e = this.map.entrance;
    const spawn = this.map.tileToWorld(e.x, e.y);
    this.player = new Player(this, spawn.x, spawn.y);
    this.physics.add.collider(this.player.sprite, this.map.walls);

    const exitPos = this.map.tileToWorld(this.map.exit.x, this.map.exit.y);
    this.exitZone = this.add.zone(exitPos.x, exitPos.y, TILE_SIZE, TILE_SIZE);
    this.physics.add.existing(this.exitZone, true);
    this.physics.add.overlap(this.player.sprite, this.exitZone, () => {
      this.sound.victory();
      this.scene.start('VictoryScene', this.buildSummary());
    });

    this.inputSys = new Input(this);

    this.monsters = [];
    {
      const minDistTiles = 8;
      const candidates = [];
      for (let y = 1; y < GRID_H - 1; y++) {
        for (let x = 1; x < GRID_W - 1; x++) {
          if (this.map.tiles[y][x] !== TILE.FLOOR) continue;
          const dx = x - this.map.entrance.x;
          const dy = y - this.map.entrance.y;
          if (Math.hypot(dx, dy) >= minDistTiles) candidates.push({ x, y });
        }
      }
      // Зоопарк: смесь всех 10 типов, ~25 монстров на старте (на треть меньше
      // прежних 37 — тестирование показало что было перебор).
      const plan = [
        ...Array(5).fill(Wanderer),
        ...Array(3).fill(Chaser),
        ...Array(2).fill(Guard),
        ...Array(2).fill(Shooter),
        ...Array(2).fill(Skeleton),
        ...Array(2).fill(BigZombie),
        ...Array(3).fill(Goblin),
        ...Array(2).fill(OrcWarrior),
        ...Array(2).fill(TinyZombie),
        ...Array(2).fill(MaskedOrc),
      ];
      for (const Cls of plan) {
        if (candidates.length === 0) break;
        const idx = Math.floor(Math.random() * candidates.length);
        const c = candidates.splice(idx, 1)[0];
        const w = this.map.tileToWorld(c.x, c.y);
        this.spawnMonster(Cls, w.x, w.y);
      }
    }
    // респаун-таймеры (волны чаще и злее)
    this.nextRespawnAt = this.time.now + 8000;
    this.nextWaveAt    = this.time.now + 18000;
    this.MAX_MONSTERS  = 55;  // на треть меньше — соответствует уменьшенному ростеру

    this.fog = new FogOfWar(this, GRID_W, GRID_H);
    this.player.sprite.setDepth(5);  // под маской, но над полом

    this.pickups = [];
    this.chests = [];

    // Ракетница — стартовый pickup в 2-3 тайлах от entrance.
    // Игрок видит её сразу при появлении.
    {
      const ent = this.map.entrance;
      const candidates = [];
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const d = Math.hypot(dx, dy);
          if (d < 1.5 || d > 3.5) continue;
          const tx = ent.x + dx, ty = ent.y + dy;
          if (tx < 1 || ty < 1 || tx >= GRID_W - 1 || ty >= GRID_H - 1) continue;
          if (this.map.tiles[ty][tx] === TILE.FLOOR) candidates.push({ x: tx, y: ty });
        }
      }
      if (candidates.length) {
        const c = candidates[Math.floor(Math.random() * candidates.length)];
        const w = this.map.tileToWorld(c.x, c.y);
        const rp = new Pickup(this, w.x, w.y, PICKUP_TYPE.ROCKET_LAUNCHER);
        this.physics.add.overlap(this.player.sprite, rp.sprite, () => {
          if (!rp.sprite.active) return;
          rp.sprite.destroy();
          this.player.hasRocketLauncher = true;
          this.sound.pickup();
          this.showToast?.('Ракетница! ПКМ / Q', '#ff7043');
        });
        this.pickups.push(rp);
      }
    }

    // После расширения maze (2×2 комнаты) почти нет «настоящих» dead-ends по
    // классическому правилу 1-open-side. Берём rooms — это верхние-левые
    // клетки 2×2 floor-блоков, исключая комнату со входом/выходом и слишком
    // близкие к ним.
    const rooms = findRooms(this.map.tiles, this.map.entrance, this.map.exit);
    // 3 аптечки
    for (let i = 0; i < 3 && rooms.length; i++) {
      const idx = Math.floor(Math.random() * rooms.length);
      const c = rooms.splice(idx, 1)[0];
      const w = this.map.tileToWorld(c.x, c.y);
      const p = new Pickup(this, w.x, w.y, PICKUP_TYPE.HEART);
      this.physics.add.overlap(this.player.sprite, p.sprite, () => {
        p.sprite.destroy();
        this.player.heal(1);
        this.sound.heal();
        this.game.events.emit('hud:update', { hp: this.player.hp });
      });
      this.pickups.push(p);
    }
    // 4 сундука с авто-открытием по overlap'у
    for (let i = 0; i < 4 && rooms.length; i++) {
      const idx = Math.floor(Math.random() * rooms.length);
      const c = rooms.splice(idx, 1)[0];
      const w = this.map.tileToWorld(c.x, c.y);
      const ch = new Chest(this, w.x, w.y);
      this.physics.add.overlap(this.player.sprite, ch.sprite, () => this.handleChestOverlap(ch));
      this.chests.push(ch);
    }
    this.nearestChest = null;

    // канал выбора из ChestScene. После resume — короткая блокировка
    // edge-инпута, иначе та же кнопка A/Space, которой подтвердили выбор,
    // мгновенно прожимается в Player как dash/shoot.
    this.game.events.on('chest:choice', this._chestChoiceHandler = (type) => {
      this.applyChestReward(type);
      this._inputCooldownUntil = this.time.now + 300;
      this.scene.resume();
    });
    this.events.once('shutdown', () => {
      this.game.events.off('chest:choice', this._chestChoiceHandler);
    });

    // компас — стрелка-точка на краю круга видимости
    this.compassArrow = this.add.graphics().setDepth(12);

    // индикатор направления игрока — белая точка на «макушке» спрайта
    this.playerDir = this.add.graphics().setDepth(6);

    // ореол вокруг игрока — синий мягкий halo, пульсирует. Помогает видеть
    // героя в толпе монстров. Рендерится ПОД игроком (depth 4 vs player 5).
    this.playerHalo = this.add.graphics().setDepth(4);
    this.tweens.add({
      targets: this.playerHalo,
      alpha: { from: 0.45, to: 0.85 },
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    // двери — одна логическая дверь = один sprite поверх проёма + body на каждом тайле
    this.doors = [];
    for (const spec of (doorSpec || [])) {
      const door = new Door(this, spec.color, spec.cells, this.map);
      const onTouch = () => {
        if (this.player.hasKey(door.color)) {
          door.open();
          this.sound.door();
          this.doors = this.doors.filter(x => x !== door);
        }
      };
      for (const z of door.bodies) {
        this.physics.add.collider(this.player.sprite, z, onTouch);
      }
      this.doors.push(door);
    }

    this.keyPickups = [];
    for (const k of keySpec) {
      const w = this.map.tileToWorld(k.x, k.y);
      const p = new Pickup(this, w.x, w.y, 'key_' + k.color);
      this.physics.add.overlap(this.player.sprite, p.sprite, () => {
        if (!p.sprite.active) return;
        p.sprite.destroy();
        this.player.addKey(k.color);
        this.sound.keyPickup();
        this.game.events.emit('hud:update', { keys: Array.from(this.player.keys) });
      });
      this.keyPickups.push(p);
    }
    this.game.events.emit('hud:update', { keys: [] });
  }

  update(_time, delta) {
    this.inputSys.setAimOrigin(this.player.sprite.x, this.player.sprite.y);
    const input = this.inputSys.read();
    // глушим edge-события сразу после resume из ChestScene — иначе кнопка
    // подтверждения тут же даёт dash/shoot/interact.
    if (this.time.now < this._inputCooldownUntil) {
      input.dash = false;
      input.shoot = false;
      input.interact = false;
      // edge-кнопки помечаем как «уже зажатые», чтобы фронт зарегистрировался
      // только после физического отпускания кнопки.
      this.inputSys.prev.dash = true;
      this.inputSys.prev.interact = true;
    }
    if (input.move.x !== 0 || input.move.y !== 0) {
      this.lastMoveDir = { x: input.move.x, y: input.move.y };
    }
    // sticky aim: запоминаем последнее активное направление прицела,
    // чтобы при отпущенном стике геймпада конус и стрельба не «забывали» цель.
    if (input.aim) {
      this.lastAimDir = { x: input.aim.x, y: input.aim.y };
    } else if (input.move.x !== 0 || input.move.y !== 0) {
      this.lastAimDir = { x: input.move.x, y: input.move.y };
    }
    this.player.setAim(this.lastAimDir);
    this.player.update(input);

    // стрельба + самонаведение на ближайшего видимого монстра
    if (input.shoot) {
      const shot = this.player.tryShoot(this.time.now);
      if (shot) {
        const target = this.findHomingTarget(shot.ox, shot.oy);
        let dx = shot.x, dy = shot.y;
        if (target) {
          const tdx = target.sprite.x - shot.ox;
          const tdy = target.sprite.y - shot.oy;
          const m = Math.hypot(tdx, tdy) || 1;
          dx = tdx / m; dy = tdy / m;
        }
        const b = new Bullet(this, shot.ox, shot.oy, dx, dy, target);
        this.physics.add.collider(b.sprite, this.map.walls, () => {
          if (BULLET_DESTROYS_WALLS) this.map.damageAt(b.sprite.x, b.sprite.y);
          b.kill();
        });
        const dmg = this.player.bulletDamage(this);
        for (const m of this.monsters) {
          if (!m.sprite.active) continue;
          this.physics.add.overlap(b.sprite, m.sprite, () => {
            if (b.dead || !m.sprite.active) return;
            const hitX = b.sprite.x, hitY = b.sprite.y;
            b.kill();
            this.sound.hit();
            if (m.takeDamage(dmg, hitX, hitY)) {
              this.sound.monsterKilled();
              this.stats.monstersKilled++;
              this.player.addWeaponXp();
              this.monsters = this.monsters.filter(x => x !== m);
            }
          });
        }
        this.bullets.push(b);
        this.sound.shoot();
      }
    }

    // Ракета — edge-кнопка (одиночный выстрел на нажатие, не auto-fire)
    if (input.rocket) {
      const shot = this.player.tryShootRocket(this.time.now);
      if (shot) {
        const r = new Rocket(this, shot.ox, shot.oy, shot.x, shot.y);
        r.sprite.setDepth(4);
        const trigger = () => {
          if (r.dead) return;
          const ex = r.sprite.x, ey = r.sprite.y;
          this.explode(ex, ey);
          r.kill();
        };
        this.physics.add.collider(r.sprite, this.map.walls, trigger);
        // Двери тоже останавливают ракету и взрываются. Сама дверь не
        // разрушается (door-frame вокруг — SOLID_WALL), но взрыв задевает
        // монстров рядом и тряску камеры даёт.
        for (const d of this.doors) {
          for (const zone of d.bodies) {
            this.physics.add.collider(r.sprite, zone, trigger);
          }
        }
        for (const m of this.monsters) {
          if (!m.sprite.active) continue;
          this.physics.add.overlap(r.sprite, m.sprite, () => {
            if (r.dead || !m.sprite.active) return;
            // прямое попадание — damage + взрыв (AoE добавит ещё)
            const hitX = r.sprite.x, hitY = r.sprite.y;
            if (m.takeDamage(ROCKET_DAMAGE, hitX, hitY)) {
              this.sound.monsterKilled();
              this.stats.monstersKilled++;
              this.player.addWeaponXp();
              this.monsters = this.monsters.filter(x => x !== m);
            }
            this.explode(hitX, hitY);
            r.kill();
          });
        }
        this.rockets.push(r);
        this.sound.rocketShoot();
      }
    }

    // bullet lifetime + homing turn — пропускаем мёртвых, их sprite уничтожен
    const now = this.time.now;
    for (const b of this.bullets) {
      if (!b.dead) b.update(now, delta);
    }
    this.bullets = this.bullets.filter(b => !b.dead);

    for (const r of this.rockets) {
      if (!r.dead) r.update(now);
    }
    this.rockets = this.rockets.filter(r => !r.dead);

    for (const m of this.monsters) m.update(delta, this.player, this.map);
    this.tickSpawns();

    // вражеские снаряды — летят прямолинейно от Shooter'а
    for (const p of this.enemyProjectiles) {
      if (!p.dead && this.time.now >= p.dieAt) {
        p.dead = true;
        p.sprite.destroy();
      }
    }
    this.enemyProjectiles = this.enemyProjectiles.filter(p => !p.dead);

    // сундуки теперь открываются по overlap'у; E/X — только для приманки
    if (input.interact && (this.player.lureCharges || 0) > 0) {
      this.throwLure();
      this.sound.pickup();
    }

    // эффекты во времени
    const pNow = performance.now();
    tickEffects(this.gameState, pNow);
    // отравление
    const poison = this.gameState.effects.find(e => e.type === 'poison');
    if (poison && pNow >= (poison.nextTickAt || 0) && (poison.ticks || 0) < POISON_TICKS) {
      this.player.hp = Math.max(0, this.player.hp - 1);
      this.sound.playerHurt();
      poison.ticks = (poison.ticks || 0) + 1;
      poison.nextTickAt = pNow + POISON_TICK_MS;
      if (this.player.isDead()) {
        this.sound.gameover();
        this.scene.start('GameOverScene', this.buildSummary());
        return;
      }
    }
    // регенерация
    const regen = this.gameState.effects.find(e => e.type === 'regen');
    if (regen && pNow >= (regen.nextTickAt || 0)) {
      this.player.heal(1);
      regen.nextTickAt = pNow + REGEN_TICK_MS;
      this.sound.heal();
    }

    // armor regen
    this.player.regenArmorTick(this.time.now);

    // компас
    this.compassArrow.clear();
    if (hasEffect(this.gameState, 'compass') && this.map.exit) {
      const ex = this.map.exit.x * TILE_SIZE + TILE_SIZE / 2;
      const ey = this.map.exit.y * TILE_SIZE + TILE_SIZE / 2;
      const dx = ex - this.player.sprite.x;
      const dy = ey - this.player.sprite.y;
      const len = Math.hypot(dx, dy) || 1;
      const r = (VISION_RADIUS_TILES - 1) * TILE_SIZE;
      const px = this.player.sprite.x + (dx / len) * r;
      const py = this.player.sprite.y + (dy / len) * r;
      this.compassArrow.fillStyle(0xffd54f, 1);
      this.compassArrow.fillCircle(px, py, 5);
    }

    // ореол под игроком — три кольца с убыванием прозрачности, читается даже
    // когда сверху бегают 5–10 монстров.
    this.playerHalo.clear();
    {
      const px = this.player.sprite.x, py = this.player.sprite.y + 4;
      this.playerHalo.fillStyle(0x4ec9ff, 0.15);
      this.playerHalo.fillCircle(px, py, 26);
      this.playerHalo.fillStyle(0x4ec9ff, 0.25);
      this.playerHalo.fillCircle(px, py, 18);
      this.playerHalo.fillStyle(0x4ec9ff, 0.35);
      this.playerHalo.fillCircle(px, py, 12);
    }

    // индикатор направления — точка на краю спрайта в сторону lastMoveDir
    this.playerDir.clear();
    const dir = this.lastMoveDir;
    if (dir) {
      const off = 9;
      this.playerDir.fillStyle(0xffffff, 1);
      this.playerDir.fillCircle(
        this.player.sprite.x + dir.x * off,
        this.player.sprite.y + dir.y * off,
        3,
      );
    }

    this.fog.update(this.player.sprite.x, this.player.sprite.y);

    // dynamic entities (monsters, bullets, lure) видны только в текущем радиусе зрения,
    // иначе их движение «просвечивает» через полупрозрачный dim explored-слой.
    const visionPxSq = this.fog.currentRadiusPx * this.fog.currentRadiusPx;
    const px = this.player.sprite.x, py = this.player.sprite.y;
    const inSight = (sx, sy) => {
      const ddx = sx - px, ddy = sy - py;
      return ddx * ddx + ddy * ddy <= visionPxSq;
    };
    for (const m of this.monsters) {
      if (!m.sprite.active) continue;
      m.sprite.setVisible(inSight(m.sprite.x, m.sprite.y));
    }
    for (const b of this.bullets) {
      if (b.dead || !b.sprite.active) continue;
      b.sprite.setVisible(inSight(b.sprite.x, b.sprite.y));
    }
    if (this.lure && this.lure.sprite && this.lure.sprite.active) {
      this.lure.sprite.setVisible(inSight(this.lure.x, this.lure.y));
    }

    // HUD — единый emit с полным состоянием. Включаем расчётный урон пули,
    // фактический интервал стрельбы и tier монстров с прогрессом до следующего.
    const dmg = this.player.bulletDamage(this);
    const fireMs = Math.round(FIRE_RATE_MS * (1 - FIRE_RATE_PER_LEVEL * (this.player.weaponLevel - 1)));
    this.game.events.emit('hud:update', {
      hp: this.player.hp,
      stamina: this.player.stamina,
      armor: this.player.armor,
      shield: this.player.shieldCharges || 0,
      effects: this.gameState.effects.map(e => ({ type: e.type, msLeft: e.expiresAt - pNow })),
      interactHint: '',
      device: this.inputSys.activeDevice,
      lureCharges: this.player.lureCharges || 0,
      weaponLevel: this.player.weaponLevel,
      weaponXp: this.player.weaponXp,
      weaponDamage: dmg,
      weaponRateMs: fireMs,
      mobTier: this.mobTier(),
      mobTierFraction: this.mobTierFraction(),
    });
  }

  // вызвать выбранный из ChestScene баф или из лоу-вероятности сундука дебаф
  applyChestReward(type) {
    switch (type) {
      // мгновенные
      case 'armor':           this.player.addArmor(2); break;
      case 'heal':            this.player.heal(1); break;
      case 'lure':            this.player.lureCharges = (this.player.lureCharges || 0) + 1; break;
      case 'shield':          this.player.shieldCharges = (this.player.shieldCharges || 0) + 1; break;
      case 'weapon_upgrade':  this.player.upgradeWeapon(); break;
      // временные позитивные
      case 'compass':         addEffect(this.gameState, 'compass', COMPASS_DURATION_MS); break;
      case 'speed':           addEffect(this.gameState, 'speed', SPEED_BOOST_DURATION_MS); break;
      case 'damage':          addEffect(this.gameState, 'damage', DAMAGE_BOOST_DURATION_MS); break;
      case 'rapid_fire':      addEffect(this.gameState, 'rapid_fire', RAPID_FIRE_DURATION_MS); break;
      case 'vision_boost':    addEffect(this.gameState, 'vision_boost', VISION_BOOST_DURATION_MS); break;
      case 'regen':           addEffect(this.gameState, 'regen', REGEN_DURATION_MS, { nextTickAt: performance.now() + REGEN_TICK_MS }); break;
    }
    const labels = {
      armor: 'Броня +2', heal: '+1 HP', lure: 'Приманка +1',
      shield: 'Щит +1', weapon_upgrade: 'Оружие +1 уровень',
      compass: 'Компас', speed: 'Быстрота', damage: 'Сила атаки',
      rapid_fire: 'Скорострел', vision_boost: 'Глаз филина', regen: 'Регенерация',
    };
    if (labels[type]) this.showToast(labels[type], '#a3d977');
  }

  applyDebuff(type) {
    switch (type) {
      case 'poison':    addEffect(this.gameState, 'poison', POISON_TICK_MS * POISON_TICKS, { nextTickAt: performance.now(), ticks: 0 }); break;
      case 'slow':      addEffect(this.gameState, 'slow', SLOW_DURATION_MS); break;
      case 'blindness': addEffect(this.gameState, 'blindness', BLINDNESS_DURATION_MS); break;
      case 'exhausted': addEffect(this.gameState, 'exhausted', EXHAUSTED_DURATION_MS); break;
      case 'weakness':  addEffect(this.gameState, 'weakness', WEAKNESS_DURATION_MS); break;
    }
    const labels = {
      poison: 'Отравление!', slow: 'Замедление!', blindness: 'Слепота!',
      exhausted: 'Усталость!', weakness: 'Слабость!',
    };
    if (labels[type]) this.showToast(labels[type], '#ff5252');
  }

  handleChestOverlap(ch) {
    if (ch.opened) return;
    const result = ch.roll();
    if (!result) return;
    this.chests = this.chests.filter(x => x !== ch);
    if (result.kind === 'debuff') {
      this.sound.chestDebuff();
      this.applyDebuff(result.type);
    } else {
      this.sound.chestPower();
      this.scene.pause();
      this.scene.launch('ChestScene', { options: result.options });
    }
  }

  showToast(text, color = '#ffffff') {
    const t = this.add.text(this.player.sprite.x, this.player.sprite.y - 28, text, {
      fontFamily: 'monospace', fontSize: '18px', color,
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(15);
    this.tweens.add({
      targets: t,
      y: t.y - 32,
      alpha: { from: 1, to: 0 },
      duration: 1500,
      onComplete: () => t.destroy(),
    });
  }

  // Снаряд из вражеского sprite-а к точке (tx, ty) — медленный, без homing.
  // При коллизии со стеной исчезает; при overlap с игроком наносит 1 урон.
  spawnEnemyProjectile(sx, sy, tx, ty, speed, lifetimeMs) {
    const dx = tx - sx, dy = ty - sy;
    const len = Math.hypot(dx, dy) || 1;
    const sprite = this.physics.add.sprite(sx, sy, 'enemy_orb');
    sprite.setScale(1.0);
    sprite.body.setAllowGravity(false);
    sprite.body.setCircle(4, sprite.width / 2 - 4, sprite.height / 2 - 4);
    sprite.body.setVelocity((dx / len) * speed, (dy / len) * speed);
    // фиолетовый шар тоже пульсирует
    this.tweens.add({
      targets: sprite,
      scale: { from: 0.85, to: 1.1 },
      duration: 250,
      yoyo: true,
      repeat: -1,
    });
    const proj = { sprite, dead: false, dieAt: this.time.now + lifetimeMs };
    this.physics.add.collider(sprite, this.map.walls, () => {
      if (proj.dead) return;
      proj.dead = true;
      sprite.destroy();
    });
    this.physics.add.overlap(sprite, this.player.sprite, () => {
      if (proj.dead) return;
      proj.dead = true;
      sprite.destroy();
      const took = this.player.takeHit(sx, sy);
      if (took) {
        this.sound.playerHurt();
        this.game.events.emit('hud:update', { hp: this.player.hp });
        if (this.player.isDead()) {
          this.sound.gameover();
          this.scene.start('GameOverScene', this.buildSummary());
        }
      }
    });
    this.enemyProjectiles.push(proj);
  }

  // Универсальный спавн монстра — initial и для волн/респаунов. Привязывает
  // обычные коллайдеры и overlap c игроком (с takeHit и GameOver-on-death).
  // Текущий tier монстров: 1 на старте, +1 каждые MOB_TIER_PERIOD_MS, cap MAX.
  mobTier() {
    const elapsedMs = this.time.now - (this.stats?.startedAt ?? this.time.now);
    return Math.min(MOB_TIER_MAX, 1 + Math.floor(elapsedMs / MOB_TIER_PERIOD_MS));
  }
  mobTierFraction() {
    const elapsedMs = this.time.now - (this.stats?.startedAt ?? this.time.now);
    const inTier = elapsedMs % MOB_TIER_PERIOD_MS;
    return Math.min(1, inTier / MOB_TIER_PERIOD_MS);
  }

  spawnMonster(Cls, wx, wy) {
    const m = new Cls(this, wx, wy);
    // прокачка под текущий tier — жирнее и шустрее
    const tier = this.mobTier();
    if (tier > 1) {
      const hpMult = 1 + (tier - 1) * MOB_TIER_HP_BONUS_PER;
      const spdMult = 1 + (tier - 1) * MOB_TIER_SPEED_BONUS_PER;
      m.hp = Math.max(1, Math.round(m.hp * hpMult));
      m.speed *= spdMult;
    }
    this.physics.add.collider(m.sprite, this.map.walls);
    // Player ↔ monster — collider (физический блок), не overlap. Игрок
    // упирается в моба, не проходит сквозь. Между monstr'ами collider'а нет —
    // они проходят друг через друга, не образуют пробок.
    this.physics.add.collider(this.player.sprite, m.sprite, () => {
      const took = this.player.takeHit(m.sprite.x, m.sprite.y);
      if (took) {
        this.sound.playerHurt();
        this.game.events.emit('hud:update', { hp: this.player.hp });
        if (this.player.isDead()) {
          this.sound.gameover();
          this.scene.start('GameOverScene', this.buildSummary());
        }
      }
    });
    this.monsters.push(m);
    return m;
  }

  // Случайный тип с весами. Со временем — больше танков и шутеров.
  pickMonsterClass() {
    const elapsedSec = (this.time.now - this.stats.startedAt) / 1000;
    const heavyW = Math.min(0.25, elapsedSec / 240);   // tank/shooter растут
    const r = Math.random();
    if (r < heavyW * 0.5) return Shooter;
    if (r < heavyW * 0.8) return BigZombie;
    if (r < heavyW) return Guard;
    // обычная фауна — даём шанс всем
    const pool = [Wanderer, Chaser, Goblin, Skeleton, OrcWarrior, TinyZombie, MaskedOrc];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // FLOOR-клетка далеко от игрока — чтобы новые враги не появлялись на голове
  spawnTileFarFromPlayer(minTiles = 6) {
    const ptx = Math.floor(this.player.sprite.x / TILE_SIZE);
    const pty = Math.floor(this.player.sprite.y / TILE_SIZE);
    const candidates = [];
    for (let y = 1; y < GRID_H - 1; y++) {
      for (let x = 1; x < GRID_W - 1; x++) {
        if (this.map.tiles[y][x] !== TILE.FLOOR) continue;
        if (Math.hypot(x - ptx, y - pty) < minTiles) continue;
        candidates.push({ x, y });
      }
    }
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  spawnRandomMonster(forcedClass = null) {
    if (this.monsters.length >= this.MAX_MONSTERS) return null;
    const tile = this.spawnTileFarFromPlayer();
    if (!tile) return null;
    const w = this.map.tileToWorld(tile.x, tile.y);
    return this.spawnMonster(forcedClass || this.pickMonsterClass(), w.x, w.y);
  }

  // L4D-style толпы. Три варианта:
  //   horde: 10–15 wanderer'ов лезут со всех сторон (классический "horde")
  //   sprint: 6–8 chaser'ов — несутся прямо к игроку
  //   mixed: 8–12 смешанная толпа
  triggerHorde() {
    const r = Math.random();
    let label, count, fixed;
    if (r < 0.4) {
      label = '🩸 Орда!'; count = 9 + Math.floor(Math.random() * 6); fixed = Wanderer;
    } else if (r < 0.7) {
      label = '⚡ Спринт!'; count = 5 + Math.floor(Math.random() * 3); fixed = Chaser;
    } else {
      label = '☠ Засада!'; count = 8 + Math.floor(Math.random() * 4); fixed = null;
    }
    for (let i = 0; i < count; i++) this.spawnRandomMonster(fixed);
    this.showToast(label, '#ff5252');
  }

  tickSpawns() {
    const now = this.time.now;
    if (now >= this.nextRespawnAt) {
      const burst = 1 + (Math.random() < 0.4 ? 1 : 0);  // 1–2 за тик
      for (let i = 0; i < burst; i++) this.spawnRandomMonster();
      const elapsedSec = (now - this.stats.startedAt) / 1000;
      const interval = Math.max(3500, 8000 - elapsedSec * 60);
      this.nextRespawnAt = now + interval;
    }
    if (now >= this.nextWaveAt) {
      if (Math.random() < 0.65) {
        this.triggerHorde();
      }
      this.nextWaveAt = now + 18000;
    }
  }

  // ближайший монстр в радиусе зрения и без стен на луче от точки выстрела
  findHomingTarget(ox, oy) {
    const visionPxSq = this.fog.currentRadiusPx * this.fog.currentRadiusPx;
    const otx = Math.floor(ox / TILE_SIZE);
    const oty = Math.floor(oy / TILE_SIZE);
    let best = null, bestDsq = Infinity;
    for (const m of this.monsters) {
      if (!m.sprite || !m.sprite.active) continue;
      const dx = m.sprite.x - ox;
      const dy = m.sprite.y - oy;
      const dsq = dx * dx + dy * dy;
      if (dsq > visionPxSq) continue;
      const mtx = Math.floor(m.sprite.x / TILE_SIZE);
      const mty = Math.floor(m.sprite.y / TILE_SIZE);
      if (!hasLineOfSight(this.map.tiles, otx, oty, mtx, mty)) continue;
      if (dsq < bestDsq) { bestDsq = dsq; best = m; }
    }
    return best;
  }

  countFloorCells() {
    let n = 0;
    for (const row of this.map.tiles) for (const t of row) if (!isBlockingTile(t)) n++;
    return n;
  }

  exploredPercent() {
    // считаем только non-wall клетки внутри explored, иначе vision-радиус
    // прихватывает соседние WALL и итог переваливает за 100%.
    let n = 0;
    for (let y = 0; y < this.fog.explored.length; y++) {
      for (let x = 0; x < this.fog.explored[0].length; x++) {
        if (this.fog.explored[y][x] && !isBlockingTile(this.map.tiles[y][x])) n++;
      }
    }
    return Math.min(100, Math.round((n / this.stats.totalCells) * 100));
  }

  buildSummary() {
    return {
      timeSec: Math.floor((this.time.now - this.stats.startedAt) / 1000),
      killed: this.stats.monstersKilled,
      explored: this.exploredPercent(),
    };
  }

  // Взрыв ракеты в (x,y): тряска камеры, частицы, AoE damage+knockback
  // монстрам, разрушение стен 1-3 рваными кратерами.
  explode(worldX, worldY) {
    this.cameras.main.shake(CAMERA_SHAKE_MS, CAMERA_SHAKE_INTENSITY);
    // 1-3 случайных кратера со смещением и разным радиусом → асимметричная
    // рваная дыра вместо идеального круга.
    const craters = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < craters; i++) {
      const r = ROCKET_WALL_ERASE_RADIUS * (0.7 + Math.random() * 0.6);  // 70-130%
      const ang = Math.random() * Math.PI * 2;
      const off = i === 0 ? 0 : Math.random() * (ROCKET_WALL_ERASE_RADIUS * 0.6);
      this.map.damageAt(
        worldX + Math.cos(ang) * off,
        worldY + Math.sin(ang) * off,
        r,
      );
    }

    // Частицы — 24 кругов explosion_particle разлетаются и затухают.
    // depth=11 — поверх fog (9, 10), чтобы вспышка не скрывалась туманом.
    const N = 24;
    for (let i = 0; i < N; i++) {
      const ang = (Math.PI * 2 * i) / N + Math.random() * 0.5;
      const dist = 14 + Math.random() * (ROCKET_EXPLOSION_RADIUS * 1.3);
      const tx = worldX + Math.cos(ang) * dist;
      const ty = worldY + Math.sin(ang) * dist;
      const p = this.add.image(worldX, worldY, 'explosion_particle')
        .setDepth(11)
        .setScale(0.8 + Math.random() * 0.8);
      this.tweens.add({
        targets: p,
        x: tx, y: ty,
        alpha: { from: 1, to: 0 },
        scale: { from: 2.2, to: 0.2 },
        duration: 380 + Math.random() * 220,
        ease: 'Cubic.easeOut',
        onComplete: () => p.destroy(),
      });
    }
    // Центральная вспышка — яркая, крупная, выше тумана.
    const flash = this.add.image(worldX, worldY, 'explosion_particle')
      .setDepth(11).setScale(0.5);
    this.tweens.add({
      targets: flash,
      scale: { from: 0.8, to: 6 },
      alpha: { from: 1, to: 0 },
      duration: 320,
      ease: 'Cubic.easeOut',
      onComplete: () => flash.destroy(),
    });
    // Shockwave — расширяющееся жёлтое кольцо.
    const shock = this.add.circle(worldX, worldY, 4, 0xffd54f, 0)
      .setStrokeStyle(3, 0xffeb3b)
      .setDepth(11);
    this.tweens.add({
      targets: shock,
      radius: ROCKET_EXPLOSION_RADIUS * 1.6,
      alpha: { from: 1, to: 0 },
      duration: 360,
      ease: 'Cubic.easeOut',
      onComplete: () => shock.destroy(),
    });

    // AoE damage + knockback монстрам в радиусе
    const r2 = ROCKET_EXPLOSION_RADIUS * ROCKET_EXPLOSION_RADIUS;
    for (const m of this.monsters.slice()) {
      if (!m.sprite || !m.sprite.active) continue;
      const dx = m.sprite.x - worldX, dy = m.sprite.y - worldY;
      if (dx * dx + dy * dy > r2) continue;
      const dist = Math.hypot(dx, dy) || 1;
      // knockback наружу
      if (m.sprite.body) {
        m.sprite.body.setVelocity(
          (dx / dist) * ROCKET_MONSTER_KNOCKBACK,
          (dy / dist) * ROCKET_MONSTER_KNOCKBACK,
        );
      }
      if (m.takeDamage(ROCKET_AOE_DAMAGE, worldX, worldY)) {
        this.sound.monsterKilled();
        this.stats.monstersKilled++;
        this.player.addWeaponXp();
        this.monsters = this.monsters.filter(x => x !== m);
      }
    }
    this.sound.explosion();
  }

  throwLure() {
    this.player.lureCharges -= 1;
    const dir = this.lastMoveDir || { x: 1, y: 0 };
    const tx = Math.floor(this.player.sprite.x / TILE_SIZE) + Math.round(dir.x * LURE_THROW_TILES);
    const ty = Math.floor(this.player.sprite.y / TILE_SIZE) + Math.round(dir.y * LURE_THROW_TILES);
    const safeTx = Math.max(1, Math.min(GRID_W - 2, tx));
    const safeTy = Math.max(1, Math.min(GRID_H - 2, ty));
    const w = this.map.tileToWorld(safeTx, safeTy);
    const lureSprite = this.add.circle(w.x, w.y, 8, 0xffeb3b).setDepth(6);
    this.lure = {
      x: w.x,
      y: w.y,
      tile: { x: safeTx, y: safeTy },
      expiresAt: this.time.now + LURE_DURATION_MS,
      sprite: lureSprite,
    };
    this.time.delayedCall(LURE_DURATION_MS, () => {
      lureSprite.destroy();
      if (this.lure && this.lure.sprite === lureSprite) this.lure = null;
    });
  }
}

function findDeadEnds(tiles) {
  const result = [];
  const h = tiles.length, w = tiles[0].length;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (tiles[y][x] !== TILE.FLOOR) continue;
      let openSides = 0;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        if (!isBlockingTile(tiles[y + dy][x + dx])) openSides++;
      }
      if (openSides === 1) result.push({ x, y });
    }
  }
  return result;
}

// Каждая «комната» — 2×2 floor-блок в узле сетки carve (x=1,4,7,…, y=1,4,7,…).
// Центр комнаты используем как точку спавна для сундуков/аптечек, кроме
// клеток рядом с входом и выходом (чтобы стартовая зона не была overstuffed).
function findRooms(tiles, entrance, exit) {
  const result = [];
  const h = tiles.length, w = tiles[0].length;
  const minDist = 4;
  for (let ry = 1; ry < h - 2; ry += 3) {
    for (let rx = 1; rx < w - 2; rx += 3) {
      // комната живая если все 4 клетки floor
      if (tiles[ry][rx] !== TILE.FLOOR) continue;
      if (tiles[ry][rx + 1] !== TILE.FLOOR) continue;
      if (tiles[ry + 1][rx] !== TILE.FLOOR) continue;
      if (tiles[ry + 1][rx + 1] !== TILE.FLOOR) continue;
      // центр комнаты — это серединная клетка (rx+0.5, ry+0.5). Берём (rx, ry).
      const cx = rx, cy = ry;
      if (entrance && Math.hypot(cx - entrance.x, cy - entrance.y) < minDist) continue;
      if (exit && Math.hypot(cx - exit.x, cy - exit.y) < minDist) continue;
      result.push({ x: cx, y: cy });
    }
  }
  return result;
}
