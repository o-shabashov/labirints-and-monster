import { Monster } from '../Monster.js';
import { TILE_SIZE } from '../../config/constants.js';
import { hasLineOfSight } from '../../systems/Vision.js';

const FIRE_INTERVAL_MS = 1800;
const PROJECTILE_SPEED = 140;  // медленнее обычных пуль, чтобы можно было увернуться
const PROJECTILE_LIFETIME_MS = 1400;
const VISION_TILES = 6;

// Стационарный монстр-снайпер: стоит и периодически плюёт магической точкой
// в игрока, если видит его через line-of-sight. Не приближается.
export class Shooter extends Monster {
  constructor(scene, x, y) {
    super(scene, x, y, 'monster_wanderer');
    // Используем спрайт wanderer но с фиолетовым тинтом — чтобы отличался.
    this.sprite.setTint(0x9966ff);
    this.speed = 0;
    this.hp = 1;
    this.nextShotAt = scene.time.now + Math.random() * FIRE_INTERVAL_MS;
  }

  update(_dt, player, map) {
    this.sprite.body.setVelocity(0, 0);
    const now = this.scene.time.now;
    if (now < this.nextShotAt) return;
    // проверяем LOS до игрока
    const mt = this.tilePos();
    const pt = { x: Math.floor(player.sprite.x / TILE_SIZE), y: Math.floor(player.sprite.y / TILE_SIZE) };
    if (Math.hypot(mt.x - pt.x, mt.y - pt.y) > VISION_TILES) return;
    if (!hasLineOfSight(map.tiles, mt.x, mt.y, pt.x, pt.y)) return;
    // стреляем
    this.scene.spawnEnemyProjectile(this.sprite.x, this.sprite.y, player.sprite.x, player.sprite.y, PROJECTILE_SPEED, PROJECTILE_LIFETIME_MS);
    this.nextShotAt = now + FIRE_INTERVAL_MS;
  }
}
