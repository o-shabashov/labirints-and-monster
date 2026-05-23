export const TILE_SIZE = 32;
export const GRID_W = 31;  // нечётное — удобно для recursive backtracker
export const GRID_H = 21;
export const GAME_W = GRID_W * TILE_SIZE;  // 992
export const GAME_H = GRID_H * TILE_SIZE;  // 672

export const COLOR = {
  BG:        0x111418,
  WALL:      0x3a4250,
  FLOOR:     0x1c2027,
  PLAYER:    0x4ec9ff,
  ENTRANCE:  0x4caf50,
  EXIT:      0xffd54f,
  MONSTER:   0xff5252,
  BULLET:    0xfff176,
  KEY_R:     0xff5252,
  KEY_G:     0x66bb6a,
  KEY_B:     0x42a5f5,
  PICKUP:    0xb39ddb,
  CHEST:     0xa1887f,
};

export const TILE = {
  FLOOR:    0,
  WALL:     1,
  ENTRANCE: 2,
  EXIT:     3,
  DOOR_R:   10,
  DOOR_G:   11,
  DOOR_B:   12,
};

export const PLAYER_SPEED = 160;   // px/sec

export const PLAYER_SIZE = 20;  // меньше тайла, чтобы пролезать в коридоры

export const VISION_RADIUS_TILES = 5;

export const PLAYER_MAX_HP = 3;
export const KNOCKBACK_SPEED = 220;
export const KNOCKBACK_MS = 200;
export const IFRAMES_MS = 400;

export const BULLET_SPEED = 500;
export const BULLET_LIFETIME_MS = 800;
export const FIRE_RATE_MS = 300;
export const STARTING_AMMO = 12;
export const MONSTER_HP_DEFAULT = 1;

export const STAMINA_MAX = 100;
export const STAMINA_SPRINT_PER_SEC = 40;
export const STAMINA_REGEN_PER_SEC = 25;
export const SPRINT_MULTIPLIER = 1.6;
export const DASH_DISTANCE = 200;     // px
export const DASH_DURATION_MS = 120;
export const DASH_COOLDOWN_MS = 1500;
