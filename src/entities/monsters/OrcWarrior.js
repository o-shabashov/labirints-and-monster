import { Monster } from '../Monster.js';
import { bfsNextStep } from '../../systems/PathFinding.js';
import { PLAYER_SPEED } from '../../config/constants.js';

const REPATH_MS = 280;

// Орк-воин — средний боец: HP=4, скорость 0.5. Балансовый враг между гоблином
// и big zombie. Спрайт всегда идёт chase'ом, без vision-радиуса.
export class OrcWarrior extends Monster {
  constructor(scene, x, y) {
    super(scene, x, y, 'monster_orc');
    this.speed = PLAYER_SPEED * 0.5;
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
