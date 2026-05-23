import { Monster } from '../Monster.js';
import { bfsNextStep } from '../../systems/PathFinding.js';
import { PLAYER_SPEED } from '../../config/constants.js';

const REPATH_MS = 500;

// Большой зомби — танк: HP=6, очень медленный, но «не остановить». Меньше
// дёргается (большой repath interval), катком прёт к игроку.
export class BigZombie extends Monster {
  constructor(scene, x, y) {
    super(scene, x, y, 'monster_bigzombie');
    this.sprite.setScale(1.2);
    this.speed = PLAYER_SPEED * 0.3;
    this.hp = 4;
  }
  update(dtMs, player, map) {
    this.repathTimer -= dtMs;
    if (this.repathTimer <= 0 || !this.target) {
      this.repathTimer = REPATH_MS;
      const mt = this.tilePos();
      const pt = this.getTargetTile(player);
      const step = bfsNextStep(map.tiles, mt.x, mt.y, pt.x, pt.y);
      this.target = step ? map.tileToWorld(step.x, step.y) : null;
    }
    if (this.target) {
      const dx = this.target.x - this.sprite.x, dy = this.target.y - this.sprite.y;
      if (Math.hypot(dx, dy) < 2) this.target = null;
    }
    this.moveToward(this.target);
  }
}
