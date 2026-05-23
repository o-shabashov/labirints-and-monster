import { Monster } from '../Monster.js';
import { bfsNextStep } from '../../systems/PathFinding.js';
import { PLAYER_SPEED } from '../../config/constants.js';

const REPATH_MS = 250;

export class Chaser extends Monster {
  constructor(scene, x, y) {
    super(scene, x, y);
    this.speed = PLAYER_SPEED * 0.7;
    this.hp = 2;
  }

  update(dtMs, player, map) {
    this.repathTimer -= dtMs;
    if (this.repathTimer <= 0 || !this.target) {
      this.repathTimer = REPATH_MS;
      const mt = this.tilePos();
      const pt = this.getTargetTile(player);
      const step = bfsNextStep(map.tiles, mt.x, mt.y, pt.x, pt.y);
      if (step) this.target = map.tileToWorld(step.x, step.y);
      else this.target = null;
    }
    // если приехали — стираем target, чтобы пересчитать на следующем тике
    if (this.target) {
      const dx = this.target.x - this.sprite.x;
      const dy = this.target.y - this.sprite.y;
      if (Math.hypot(dx, dy) < 2) this.target = null;
    }
    this.moveToward(this.target);
  }
}
