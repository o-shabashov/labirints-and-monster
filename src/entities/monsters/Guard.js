import { Monster } from '../Monster.js';
import { bfsNextStep } from '../../systems/PathFinding.js';
import { PLAYER_SPEED, GUARD_PATROL_HALF } from '../../config/constants.js';

const REPATH_MS = 250;

export class Guard extends Monster {
  constructor(scene, x, y) {
    super(scene, x, y, 'monster_guard');
    this.speed = PLAYER_SPEED * 0.4;
    this.hp = 5;             // прокачен в танка
    this.homeTile = this.tilePos();
  }

  inHomeZone(tx, ty) {
    return Math.abs(tx - this.homeTile.x) <= GUARD_PATROL_HALF
        && Math.abs(ty - this.homeTile.y) <= GUARD_PATROL_HALF;
  }

  update(dtMs, player, map) {
    if (this.isStunned()) return;
    this.repathTimer -= dtMs;
    const mt = this.tilePos();
    const pt = this.getTargetTile(player);
    const playerInZone = this.inHomeZone(pt.x, pt.y);

    if (this.repathTimer <= 0 || !this.target) {
      this.repathTimer = REPATH_MS;
      const goal = playerInZone ? pt : this.homeTile;
      const step = bfsNextStep(map.tiles, mt.x, mt.y, goal.x, goal.y);
      this.target = step ? map.tileToWorld(step.x, step.y) : null;
    }
    if (this.target) {
      const dx = this.target.x - this.sprite.x;
      const dy = this.target.y - this.sprite.y;
      if (Math.hypot(dx, dy) < 2) this.target = null;
    }
    this.moveToward(this.target);
  }
}
