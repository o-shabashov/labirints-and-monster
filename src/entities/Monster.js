import { TILE_SIZE, LURE_RANGE_TILES } from '../config/constants.js';

export class Monster {
  constructor(scene, x, y, texture = 'monster') {
    this.scene = scene;
    this.sprite = scene.physics.add.sprite(x, y, texture);
    this.sprite.setScale(1.0);
    this.sprite.setOrigin(0.5, 0.7);
    const w = this.sprite.width, h = this.sprite.height;
    const r = 5;
    this.sprite.body.setCircle(r, w / 2 - r, h * 0.7 - r);
    this.repathTimer = 0;
    this.target = null;          // { x, y } в pixel
    this.speed = 100;
    this.hp = 1;
    this.baseTint = 0xffffff;    // подклассы могут перезаписать после своего setTint
    this.dying = false;
  }

  takeDamage(n = 1) {
    if (this.dying) return false;
    this.hp -= n;
    if (this.hp > 0) {
      // мигание удара — белый flash на ~100мс
      this.sprite.setTintFill(0xffffff);
      this.scene.time.delayedCall(100, () => {
        if (this.sprite && this.sprite.active) this.sprite.setTint(this.baseTint);
      });
      // лёгкий kickback по scale для feedback
      this.scene.tweens.add({
        targets: this.sprite,
        scaleX: { from: this.sprite.scaleX * 1.3, to: this.sprite.scaleX },
        scaleY: { from: this.sprite.scaleY * 0.8, to: this.sprite.scaleY },
        duration: 110,
      });
      return false;
    }
    // смерть — анимация затухания и спин
    this.dying = true;
    this.sprite.body.enable = false;
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      scaleX: this.sprite.scaleX * 0.4,
      scaleY: this.sprite.scaleY * 0.4,
      angle: 180,
      duration: 350,
      onComplete: () => this.sprite.destroy(),
    });
    return true;
  }

  tilePos() {
    return {
      x: Math.floor(this.sprite.x / TILE_SIZE),
      y: Math.floor(this.sprite.y / TILE_SIZE),
    };
  }

  getTargetTile(player) {
    const lure = this.scene.lure;
    const mt = this.tilePos();
    if (lure) {
      const dx = lure.tile.x - mt.x, dy = lure.tile.y - mt.y;
      if (Math.hypot(dx, dy) <= LURE_RANGE_TILES) return lure.tile;
    }
    return {
      x: Math.floor(player.sprite.x / TILE_SIZE),
      y: Math.floor(player.sprite.y / TILE_SIZE),
    };
  }

  moveToward(target) {
    if (!target) {
      this.sprite.body.setVelocity(0, 0);
      return;
    }
    const dx = target.x - this.sprite.x;
    const dy = target.y - this.sprite.y;
    const d = Math.hypot(dx, dy);
    if (d < 2) {
      this.sprite.body.setVelocity(0, 0);
      return;
    }
    const vx = (dx / d) * this.speed;
    const vy = (dy / d) * this.speed;
    this.sprite.body.setVelocity(vx, vy);
    // flip спрайта по направлению движения; 0x72-арт смотрит вправо в дефолте
    if (Math.abs(vx) > 1) this.sprite.setFlipX(vx < 0);
  }

  update(_dt, _player, _map) {
    // override
  }
}
