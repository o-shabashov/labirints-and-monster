import { TILE_SIZE, PLAYER_SIZE, COLOR, VISION_RADIUS_TILES } from '../config/constants.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }
  create() {
    const g = this.add.graphics();

    // wall
    g.fillStyle(COLOR.WALL, 1);
    g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    g.lineStyle(2, 0x000000, 0.4);
    g.strokeRect(1, 1, TILE_SIZE - 2, TILE_SIZE - 2);
    g.generateTexture('wall', TILE_SIZE, TILE_SIZE);
    g.clear();

    // floor
    g.fillStyle(COLOR.FLOOR, 1);
    g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    g.generateTexture('floor', TILE_SIZE, TILE_SIZE);
    g.clear();

    // entrance
    g.fillStyle(COLOR.ENTRANCE, 1);
    g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    g.generateTexture('entrance', TILE_SIZE, TILE_SIZE);
    g.clear();

    // exit
    g.fillStyle(COLOR.EXIT, 1);
    g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    g.lineStyle(3, 0x000000, 1);
    g.strokeRect(2, 2, TILE_SIZE - 4, TILE_SIZE - 4);
    g.generateTexture('exit', TILE_SIZE, TILE_SIZE);
    g.clear();

    // player
    g.fillStyle(COLOR.PLAYER, 1);
    g.fillRect(0, 0, PLAYER_SIZE, PLAYER_SIZE);
    g.lineStyle(2, 0xffffff, 1);
    g.strokeRect(1, 1, PLAYER_SIZE - 2, PLAYER_SIZE - 2);
    g.generateTexture('player', PLAYER_SIZE, PLAYER_SIZE);
    g.clear();

    // monster
    g.fillStyle(COLOR.MONSTER, 1);
    g.fillRect(0, 0, PLAYER_SIZE, PLAYER_SIZE);
    g.lineStyle(2, 0x000000, 1);
    g.strokeRect(1, 1, PLAYER_SIZE - 2, PLAYER_SIZE - 2);
    g.generateTexture('monster', PLAYER_SIZE, PLAYER_SIZE);
    g.clear();

    // pickup: heart
    g.fillStyle(0xff5252, 1);
    g.fillCircle(8, 8, 6);
    g.generateTexture('pickup_heart', 16, 16);
    g.clear();

    // bullet
    g.fillStyle(COLOR.BULLET, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture('bullet', 8, 8);
    g.clear();

    // wanderer (orange)
    g.fillStyle(0xff9800, 1);
    g.fillRect(0, 0, PLAYER_SIZE, PLAYER_SIZE);
    g.lineStyle(2, 0x000000, 1);
    g.strokeRect(1, 1, PLAYER_SIZE - 2, PLAYER_SIZE - 2);
    g.generateTexture('monster_wanderer', PLAYER_SIZE, PLAYER_SIZE);
    g.clear();

    // guard (purple)
    g.fillStyle(0x9c27b0, 1);
    g.fillRect(0, 0, PLAYER_SIZE, PLAYER_SIZE);
    g.lineStyle(2, 0x000000, 1);
    g.strokeRect(1, 1, PLAYER_SIZE - 2, PLAYER_SIZE - 2);
    g.generateTexture('monster_guard', PLAYER_SIZE, PLAYER_SIZE);
    g.clear();

    // doors R/G/B
    const doors = [
      ['door_r', COLOR.KEY_R],
      ['door_g', COLOR.KEY_G],
      ['door_b', COLOR.KEY_B],
    ];
    for (const [name, color] of doors) {
      g.fillStyle(color, 1);
      g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      g.lineStyle(3, 0x000000, 1);
      g.strokeRect(2, 2, TILE_SIZE - 4, TILE_SIZE - 4);
      g.generateTexture(name, TILE_SIZE, TILE_SIZE);
      g.clear();
    }

    // keys R/G/B
    const keys = [
      ['key_r', COLOR.KEY_R],
      ['key_g', COLOR.KEY_G],
      ['key_b', COLOR.KEY_B],
    ];
    for (const [name, color] of keys) {
      g.fillStyle(color, 1);
      g.fillCircle(8, 6, 4);
      g.fillRect(7, 6, 2, 8);
      g.fillRect(9, 10, 3, 2);
      g.generateTexture(name, 16, 16);
      g.clear();
    }

    // chest
    g.fillStyle(COLOR.CHEST, 1);
    g.fillRoundedRect(2, 6, 20, 16, 3);
    g.lineStyle(2, 0x000000, 1);
    g.strokeRoundedRect(2, 6, 20, 16, 3);
    g.fillStyle(0xffd54f, 1);
    g.fillRect(10, 12, 4, 4);
    g.generateTexture('chest', 24, 24);
    g.clear();

    // ammo pickup
    g.fillStyle(0xfff176, 1);
    g.fillRect(2, 6, 12, 4);
    g.fillRect(2, 10, 12, 4);
    g.generateTexture('pickup_ammo', 16, 16);
    g.clear();

    g.destroy();

    // Soft circular brush: белый круг с плавным альфа-спадом от 1 в центре
    // до 0 на радиусе. Используется FogOfWar для:
    //   1) накопления explored-маски (штампуется в RenderTexture при движении)
    //   2) текущей vision-маски (image у позиции игрока)
    // Один и тот же brush для обеих ролей — отличается только применением.
    const radius = VISION_RADIUS_TILES * TILE_SIZE;
    const size = radius * 2;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const cx = cv.getContext('2d');
    const grad = cx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, radius);
    grad.addColorStop(0.0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.85)');
    grad.addColorStop(1.0, 'rgba(255,255,255,0)');
    cx.fillStyle = grad;
    cx.fillRect(0, 0, size, size);
    this.textures.addCanvas('soft_circle', cv);

    this.scene.start('MenuScene');
  }
}
