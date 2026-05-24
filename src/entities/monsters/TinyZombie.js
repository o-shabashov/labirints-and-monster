import { Monster } from '../Monster.js';
import { bfsNextStep } from '../../systems/PathFinding.js';
import { PLAYER_SPEED } from '../../config/constants.js';

const REPATH_MS = 220;

// Мини-зомби — рой: HP=1, очень мелкий и быстрый, спавнится толпой. По
// поведению — обычный chaser с маленьким репасом и без vision-проверки.
export class TinyZombie extends Monster {
  constructor(scene, x, y) {
    super(scene, x, y, 'monster_tinyzombie');
    this.sprite.setScale(0.8);
    this.speed = PLAYER_SPEED * 0.90;
    this.hp = 1;
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
