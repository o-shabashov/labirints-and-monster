import { Monster } from '../Monster.js';
import { bfsNextStep } from '../../systems/PathFinding.js';
import { PLAYER_SPEED, TILE_SIZE, WANDERER_VISION_TILES, WANDERER_LOSE_INTEREST_MS, TILE } from '../../config/constants.js';

const REPATH_MS = 180;
const WANDER_PICK_MS = 900;

// Гоблин — самый шустрый: HP=1, очень быстро бегает, замечает игрока с того же
// радиуса что и Wanderer, но шустрее всех преследует. Один точный выстрел —
// и его нет, но настигнет он тебя моментально.
export class Goblin extends Monster {
  constructor(scene, x, y) {
    super(scene, x, y, 'monster_goblin');
    this.speed = PLAYER_SPEED * 0.85;
    this.hp = 1;
    this.mode = 'wander';
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
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)));
    for (let i = 1; i < steps; i++) {
      const x = Math.round(mt.x - (dx * i / steps));
      const y = Math.round(mt.y - (dy * i / steps));
      if (map.tiles[y][x] === TILE.WALL) return false;
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
    return opts.length ? opts[Math.floor(Math.random() * opts.length)] : null;
  }
  update(dtMs, player, map) {
    const now = this.scene.time.now;
    if (this.canSee(player, map)) {
      this.mode = 'chase';
      this.loseInterestAt = now + WANDERER_LOSE_INTEREST_MS;
    } else if (now > this.loseInterestAt) this.mode = 'wander';
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
      if (!this.target || now > this.wanderTargetAt) {
        const p = this.pickWanderTarget(map);
        this.target = p ? map.tileToWorld(p.x, p.y) : null;
        this.wanderTargetAt = now + WANDER_PICK_MS;
      }
    }
    if (this.target) {
      const dx = this.target.x - this.sprite.x, dy = this.target.y - this.sprite.y;
      if (Math.hypot(dx, dy) < 2) this.target = null;
    }
    this.moveToward(this.target);
  }
}
