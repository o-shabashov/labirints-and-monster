import { TILE, TILE_SIZE, GRID_W, GRID_H } from '../config/constants.js';
import { TileMap } from '../world/TileMap.js';
import { Player } from '../entities/Player.js';
import { generateMaze } from '../world/MazeGenerator.js';
import { FogOfWar } from '../world/FogOfWar.js';
import { Input } from '../systems/Input.js';
import { Chaser } from '../entities/monsters/Chaser.js';
import { Pickup, PICKUP_TYPE } from '../entities/Pickup.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.scene.launch('UIScene');
    this.game.events.emit('hud:update', { hp: 3 });

    const seed = Date.now();
    this.map = new TileMap(this, generateMaze(GRID_W, GRID_H, seed));
    const e = this.map.entrance;
    const spawn = this.map.tileToWorld(e.x, e.y);
    this.player = new Player(this, spawn.x, spawn.y);
    this.physics.add.collider(this.player.sprite, this.map.walls);

    const exitPos = this.map.tileToWorld(this.map.exit.x, this.map.exit.y);
    this.exitZone = this.add.zone(exitPos.x, exitPos.y, TILE_SIZE, TILE_SIZE);
    this.physics.add.existing(this.exitZone, true);
    this.physics.add.overlap(this.player.sprite, this.exitZone, () => {
      this.scene.start('VictoryScene');
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
      // 3 монстра-преследователя на этом этапе
      for (let i = 0; i < 3 && candidates.length; i++) {
        const idx = Math.floor(Math.random() * candidates.length);
        const c = candidates.splice(idx, 1)[0];
        const w = this.map.tileToWorld(c.x, c.y);
        const m = new Chaser(this, w.x, w.y);
        this.physics.add.collider(m.sprite, this.map.walls);
        this.physics.add.overlap(this.player.sprite, m.sprite, () => {
          const took = this.player.takeHit(m.sprite.x, m.sprite.y);
          if (took) {
            this.game.events.emit('hud:update', { hp: this.player.hp });
            if (this.player.isDead()) this.scene.start('GameOverScene');
          }
        });
        this.monsters.push(m);
      }
    }

    this.fog = new FogOfWar(this, GRID_W, GRID_H);
    this.player.sprite.setDepth(5);  // под маской, но над полом

    this.pickups = [];
    const deadEnds = findDeadEnds(this.map.tiles);
    for (let i = 0; i < Math.min(3, deadEnds.length); i++) {
      const idx = Math.floor(Math.random() * deadEnds.length);
      const c = deadEnds.splice(idx, 1)[0];
      const w = this.map.tileToWorld(c.x, c.y);
      const p = new Pickup(this, w.x, w.y, PICKUP_TYPE.HEART);
      this.physics.add.overlap(this.player.sprite, p.sprite, () => {
        p.sprite.destroy();
        this.player.heal(1);
        this.game.events.emit('hud:update', { hp: this.player.hp });
      });
      this.pickups.push(p);
    }
  }

  update(_time, delta) {
    this.inputSys.setAimOrigin(this.player.sprite.x, this.player.sprite.y);
    const input = this.inputSys.read();
    this.player.update(input);
    for (const m of this.monsters) m.update(delta, this.player, this.map);
    this.fog.update(this.player.sprite.x, this.player.sprite.y);
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
