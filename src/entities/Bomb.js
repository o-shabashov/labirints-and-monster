import { BOMB_FUSE_MS, BOMB_THROW_SPEED, BOMB_DRAG } from '../config/constants.js';

// Бомба — катится с замедлением, отскакивает от стен, через FUSE_MS взрывается.
// Взрыв обрабатывается в GameScene (explodeBomb()) — это даёт единый pipeline
// для тряски, частиц и damageAt с радиусом BOMB_WALL_ERASE_RADIUS.
export class Bomb {
  constructor(scene, x, y, dirX, dirY) {
    this.scene = scene;
    this.sprite = scene.physics.add.sprite(x, y, 'pickup_bomb');
    this.sprite.setScale(1.2).setDepth(4);
    this.sprite.body.setAllowGravity(false);
    this.sprite.body.setCircle(6);
    this.sprite.body.setDrag(BOMB_DRAG, BOMB_DRAG);
    this.sprite.body.setBounce(0.55, 0.55);
    this.sprite.body.setVelocity(dirX * BOMB_THROW_SPEED, dirY * BOMB_THROW_SPEED);
    // Лёгкое мигание-пульсация, ускоряется к концу фитиля.
    scene.tweens.add({
      targets: this.sprite,
      scale: { from: 1.0, to: 1.3 },
      duration: 220,
      yoyo: true,
      repeat: -1,
    });
    this.dieAt = scene.time.now + BOMB_FUSE_MS;
    this.dead = false;
    // Финальные координаты для GameScene.explodeBomb()
    this.detonateX = x;
    this.detonateY = y;
    this.exploded = false;
  }

  update(now) {
    if (this.dead || !this.sprite || !this.sprite.active || !this.sprite.body) return;
    this.detonateX = this.sprite.x;
    this.detonateY = this.sprite.y;
    if (now >= this.dieAt && !this.exploded) {
      this.exploded = true;
      this.kill();
    }
  }

  kill() {
    if (this.dead) return;
    this.dead = true;
    if (this.sprite) this.sprite.destroy();
  }
}
