import { TILE_SIZE, LURE_RANGE_TILES } from '../config/constants.js';

export class Monster {
  constructor(scene, x, y, texture = 'monster') {
    this.scene = scene;
    this.sprite = scene.physics.add.sprite(x, y, texture);
    this.sprite.setScale(1.5);
    this.sprite.setOrigin(0.5, 0.7);
    const w = this.sprite.width, h = this.sprite.height;
    const r = 5;
    this.sprite.body.setCircle(r, w / 2 - r, h * 0.7 - r);
    this.repathTimer = 0;
    this.target = null;          // { x, y } в pixel
    this.speed = 100;
    this.hp = 1;
  }

  takeDamage(n = 1) {
    this.hp -= n;
    if (this.hp <= 0) this.sprite.destroy();
    return this.hp <= 0;
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
