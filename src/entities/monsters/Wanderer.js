import { Monster } from '../Monster.js';
import { bfsNextStep } from '../../systems/PathFinding.js';
import {
  TILE_SIZE, PLAYER_SPEED,
  WANDERER_VISION_TILES, WANDERER_LOSE_INTEREST_MS, TILE, isBlockingTile,
} from '../../config/constants.js';

const REPATH_MS = 250;
const WANDER_PICK_MS = 1500;

export class Wanderer extends Monster {
  constructor(scene, x, y) {
    super(scene, x, y, 'monster_wanderer');
    this.speed = PLAYER_SPEED * 0.65;
    this.mode = 'wander';   // 'wander' | 'chase'
    this.loseInterestAt = 0;
    this.wanderTargetAt = 0;
  }

  canSee(player, map) {
    const mt = this.tilePos();
    const pt = {
      x: Math.floor(player.sprite.x / TILE_SIZE),
      y: Math.floor(player.sprite.y / TILE_SIZE),
    };
    const dx = mt.x - pt.x, dy = mt.y - pt.y;
    if (Math.hypot(dx, dy) > WANDERER_VISION_TILES) return false;
    // прямой луч: грубо проверим, что нет стены между ними
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)));
    for (let i = 1; i < steps; i++) {
      const x = Math.round(mt.x - (dx * i / steps));
      const y = Math.round(mt.y - (dy * i / steps));
      if (isBlockingTile(map.tiles[y][x])) return false;
    }
    return true;
  }

  pickWanderTarget(map) {
    const mt = this.tilePos();
    const opts = [];
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = mt.x + dx, ny = mt.y + dy;
      if (map.tiles[ny] && map.tiles[ny][nx] === TILE.FLOOR) opts.push({ x: nx, y: ny });
    }
    if (opts.length === 0) return null;
    return opts[Math.floor(Math.random() * opts.length)];
  }

  update(dtMs, player, map) {
    if (this.isStunned()) return;
    const now = this.scene.time.now;
    if (this.canSee(player, map)) {
      this.mode = 'chase';
      this.loseInterestAt = now + WANDERER_LOSE_INTEREST_MS;
    } else if (now > this.loseInterestAt) {
      this.mode = 'wander';
    }

    this.repathTimer -= dtMs;
    if (this.mode === 'chase') {
      if (this.repathTimer <= 0 || !this.target) {
        this.repathTimer = REPATH_MS;
        const mt = this.tilePos();
        const pt = this.getTargetTile(player);
        const step = bfsNextStep(map.tiles, mt.x, mt.y, pt.x, pt.y);
        this.target = step ? map.tileToWorld(step.x, step.y) : null;
      }
    } else {
      // wander
      if (!this.target || now > this.wanderTargetAt) {
        const pick = this.pickWanderTarget(map);
        this.target = pick ? map.tileToWorld(pick.x, pick.y) : null;
        this.wanderTargetAt = now + WANDER_PICK_MS;
      }
    }
    if (this.target) {
      const dx = this.target.x - this.sprite.x;
      const dy = this.target.y - this.sprite.y;
      if (Math.hypot(dx, dy) < 2) this.target = null;
    }
    this.moveToward(this.target);
  }
}
