import {
  TILE, TILE_SIZE, GRID_W, GRID_H, GAME_W, GAME_H, TOPBAR_H, VISION_RADIUS_TILES,
  POISON_TICK_MS, POISON_TICKS,
  SLOW_DURATION_MS, BLINDNESS_DURATION_MS,
  COMPASS_DURATION_MS, LURE_DURATION_MS, LURE_THROW_TILES, AMMO_PACK,
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
import { Pickup, PICKUP_TYPE } from '../entities/Pickup.js';
import { Bullet } from '../entities/Bullet.js';
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
    this.lure = null;
    this.lastMoveDir = { x: 1, y: 0 };
    this.lastAimDir = { x: 1, y: 0 };

    const seed = Date.now();
    const { grid, keys: keySpec } = generateMaze(GRID_W, GRID_H, seed);
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
      // распределение: 4 wanderer, 2 chaser, 1 guard (если есть слоты)
      const plan = [
        ...Array(4).fill(Wanderer),
        ...Array(2).fill(Chaser),
        ...Array(1).fill(Guard),
      ];
      for (const Cls of plan) {
        if (candidates.length === 0) break;
        const idx = Math.floor(Math.random() * candidates.length);
        const c = candidates.splice(idx, 1)[0];
        const w = this.map.tileToWorld(c.x, c.y);
        const m = new Cls(this, w.x, w.y);
        this.physics.add.collider(m.sprite, this.map.walls);
        this.physics.add.overlap(this.player.sprite, m.sprite, () => {
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
      }
    }

    this.fog = new FogOfWar(this, GRID_W, GRID_H);
    this.player.sprite.setDepth(5);  // под маской, но над полом

    this.pickups = [];
    this.chests = [];
    const deadEnds = findDeadEnds(this.map.tiles);
    // 3 клетки для аптечек
    for (let i = 0; i < 3 && deadEnds.length; i++) {
      const idx = Math.floor(Math.random() * deadEnds.length);
      const c = deadEnds.splice(idx, 1)[0];
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
    // 4 клетки для сундуков
    for (let i = 0; i < 4 && deadEnds.length; i++) {
      const idx = Math.floor(Math.random() * deadEnds.length);
      const c = deadEnds.splice(idx, 1)[0];
      const w = this.map.tileToWorld(c.x, c.y);
      const ch = new Chest(this, w.x, w.y);
      this.chests.push(ch);
    }
    this.nearestChest = null;

    // компас — стрелка-точка на краю круга видимости
    this.compassArrow = this.add.graphics().setDepth(12);

    // индикатор направления игрока — белая точка на «макушке» спрайта
    this.playerDir = this.add.graphics().setDepth(6);

    // двери (по тайлам в map) и ключи (по keySpec)
    this.doors = [];
    for (const d of this.map.findDoors()) {
      const door = new Door(this, d.x, d.y, d.tile, this.map);
      this.physics.add.collider(this.player.sprite, door.sprite, () => {
        if (this.player.hasKey(door.color)) {
          door.open();
          this.sound.door();
          this.doors = this.doors.filter(x => x !== door);
        }
      });
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
        this.physics.add.collider(b.sprite, this.map.walls, () => b.kill());
        for (const m of this.monsters) {
          if (!m.sprite.active) continue;
          this.physics.add.overlap(b.sprite, m.sprite, () => {
            if (b.dead) return;
            b.kill();
            this.sound.hit();
            if (m.takeDamage(1)) {
              this.sound.monsterKilled();
              this.stats.monstersKilled++;
              this.monsters = this.monsters.filter(x => x !== m);
            }
          });
        }
        this.bullets.push(b);
        this.sound.shoot();
      }
    }

    // bullet lifetime + homing turn
    const now = this.time.now;
    for (const b of this.bullets) b.update(now, delta);
    this.bullets = this.bullets.filter(b => !b.dead);

    for (const m of this.monsters) m.update(delta, this.player, this.map);

    // найти сундук в радиусе <1 тайла для подсказки и взаимодействия
    this.nearestChest = null;
    for (const ch of this.chests) {
      if (ch.opened) continue;
      const d = Math.hypot(ch.sprite.x - this.player.sprite.x, ch.sprite.y - this.player.sprite.y);
      if (d < TILE_SIZE) { this.nearestChest = ch; break; }
    }
    if (input.interact) {
      if (this.nearestChest) {
        const reward = this.nearestChest.open();
        this.applyChestReward(reward);
        this.chests = this.chests.filter(c => !c.opened);
        this.nearestChest = null;
      } else if ((this.player.lureCharges || 0) > 0) {
        this.throwLure();
        this.sound.pickup();
      }
    }

    // эффекты во времени
    const pNow = performance.now();
    tickEffects(this.gameState, pNow);
    // отравление: каждые POISON_TICK_MS — -1 HP, всего POISON_TICKS раз
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

    // индикатор направления — точка на краю спрайта в сторону lastMoveDir
    this.playerDir.clear();
    const dir = this.lastMoveDir;
    if (dir) {
      const off = 9;  // радиус смещения от центра, ~край sprite 20×20
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

    // HUD — единый emit с полным состоянием
    this.game.events.emit('hud:update', {
      hp: this.player.hp,
      ammo: this.player.ammo,
      stamina: this.player.stamina,
      armor: this.player.armor,
      effects: this.gameState.effects.map(e => ({ type: e.type, msLeft: e.expiresAt - pNow })),
      interactHint: this.nearestChest ? 'E / X — открыть сундук' : '',
      device: this.inputSys.activeDevice,
      lureCharges: this.player.lureCharges || 0,
    });
  }

  applyChestReward(type) {
    switch (type) {
      case 'armor':    this.player.addArmor(2); break;
      case 'heal':     this.player.heal(1); break;
      case 'ammo':     this.player.ammo += AMMO_PACK; break;
      case 'compass':  addEffect(this.gameState, 'compass', COMPASS_DURATION_MS); break;
      case 'lure':     this.player.lureCharges = (this.player.lureCharges || 0) + 1; break;
      case 'poison':   addEffect(this.gameState, 'poison', POISON_TICK_MS * POISON_TICKS, { nextTickAt: performance.now(), ticks: 0 }); break;
      case 'slow':     addEffect(this.gameState, 'slow', SLOW_DURATION_MS); break;
      case 'blindness':addEffect(this.gameState, 'blindness', BLINDNESS_DURATION_MS); break;
    }
    const POWER_UPS = new Set(['armor', 'heal', 'ammo', 'compass', 'lure']);
    if (POWER_UPS.has(type)) this.sound.chestPower();
    else this.sound.chestDebuff();
    const labels = {
      armor:     { text: 'Броня +2',     color: '#a3d977' },
      heal:      { text: '+1 HP',        color: '#a3d977' },
      ammo:      { text: '+6 патронов',  color: '#a3d977' },
      compass:   { text: 'Компас',       color: '#a3d977' },
      lure:      { text: 'Приманка +1',  color: '#a3d977' },
      poison:    { text: 'Отравление!',  color: '#ff5252' },
      slow:      { text: 'Замедление!',  color: '#ff5252' },
      blindness: { text: 'Слепота!',     color: '#ff5252' },
    };
    const l = labels[type];
    if (l) this.showToast(l.text, l.color);
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
    for (const row of this.map.tiles) for (const t of row) if (t !== TILE.WALL) n++;
    return n;
  }

  exploredPercent() {
    let n = 0;
    for (const row of this.fog.explored) for (const v of row) if (v) n++;
    return Math.round((n / this.stats.totalCells) * 100);
  }

  buildSummary() {
    return {
      timeSec: Math.floor((this.time.now - this.stats.startedAt) / 1000),
      killed: this.stats.monstersKilled,
      explored: this.exploredPercent(),
    };
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
        if (tiles[y + dy][x + dx] !== TILE.WALL) openSides++;
      }
      if (openSides === 1) result.push({ x, y });
    }
  }
  return result;
}
