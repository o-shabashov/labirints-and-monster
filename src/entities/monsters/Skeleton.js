import { Monster } from '../Monster.js';
import { bfsNextStep } from '../../systems/PathFinding.js';
import { PLAYER_SPEED } from '../../config/constants.js';

const REPATH_MS = 350;

// Скелет — медленный костяк, но живучий: HP=3, гарантированно держит удар.
// Идёт к игроку по BFS без vision-проверки (как Chaser, но медленнее).
export class Skeleton extends Monster {
  constructor(scene, x, y) {
    super(scene, x, y, 'monster_skeleton');
    this.speed = PLAYER_SPEED * 0.4;
    this.hp = 2;
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
