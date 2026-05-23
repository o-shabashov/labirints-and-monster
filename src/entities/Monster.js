import { TILE_SIZE, LURE_RANGE_TILES } from '../config/constants.js';

export class Monster {
  constructor(scene, x, y, texture = 'monster') {
    this.scene = scene;
    this.sprite = scene.physics.add.sprite(x, y, texture);
    this.sprite.setScale(2);  // ассеты 16×*, рендер 2x
    const w = this.sprite.width, h = this.sprite.height;
    const r = 5;
    this.sprite.body.setCircle(r, (w - r * 2) / 2, (h - r * 2) / 2);
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
    this.sprite.body.setVelocity((dx / d) * this.speed, (dy / d) * this.speed);
  }

  update(_dt, _player, _map) {
    // override
  }
}
