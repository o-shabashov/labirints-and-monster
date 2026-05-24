import { TILE_SIZE, PLAYER_SIZE, COLOR, VISION_RADIUS_TILES } from '../config/constants.js';

// Маппинг логических ключей текстур (как они называются в игре) → файл из
// 0x72 DungeonTilesetII в assets/0x72/. Tinted-варианты (door_r/g/b,
// key_r/g/b) и т.п. делаются tint'ом во время использования.
const SPRITES = [
  ['floor',            'assets/0x72/floor_1.png'],
  ['wall',             'assets/0x72/wall_mid.png'],
  ['entrance',         'assets/0x72/floor_ladder.png'],
  ['exit',             'assets/0x72/floor_stairs.png'],
  ['player',           'assets/0x72/wizzard_m_idle_anim_f0.png'],
  ['monster',          'assets/0x72/chort_idle_anim_f0.png'],            // chaser
  ['monster_wanderer', 'assets/0x72/imp_idle_anim_f0.png'],
  ['monster_guard',    'assets/0x72/big_demon_idle_anim_f0.png'],
  ['monster_skeleton', 'assets/0x72/skelet_idle_anim_f0.png'],
  ['monster_bigzombie','assets/0x72/big_zombie_idle_anim_f0.png'],
  ['monster_goblin',   'assets/0x72/goblin_idle_anim_f0.png'],
  ['monster_masked',   'assets/0x72/masked_orc_idle_anim_f0.png'],
  ['monster_orc',      'assets/0x72/orc_warrior_idle_anim_f0.png'],
  ['monster_tinyzombie','assets/0x72/tiny_zombie_idle_anim_f0.png'],
  ['chest',            'assets/0x72/chest_full_open_anim_f0.png'],
  ['bullet',           'assets/0x72/weapon_arrow.png'],
  ['pickup_heart',     'assets/0x72/ui_heart_full.png'],
  ['pickup_ammo',      'assets/0x72/flask_yellow.png'],
  ['door_base',        'assets/0x72/doors_leaf_closed.png'],
  ['key_r',            'assets/0x72/flask_red.png'],
  ['key_g',            'assets/0x72/flask_green.png'],
  ['key_b',            'assets/0x72/flask_blue.png'],
];

const SFX = [
  ['sfx_shoot',          'assets/sfx/shoot.ogg'],
  ['sfx_hit',            'assets/sfx/hit.ogg'],
  ['sfx_player_hurt',    'assets/sfx/player_hurt.ogg'],
  ['sfx_monster_killed', 'assets/sfx/monster_killed.ogg'],
  ['sfx_heal',           'assets/sfx/heal.ogg'],
  ['sfx_key_pickup',     'assets/sfx/key_pickup.ogg'],
  ['sfx_dash',           'assets/sfx/dash.ogg'],
  ['sfx_door',           'assets/sfx/door.ogg'],
  ['sfx_chest_power',    'assets/sfx/chest_power.ogg'],
  ['sfx_chest_debuff',   'assets/sfx/chest_debuff.ogg'],
  ['sfx_victory',        'assets/sfx/victory.ogg'],
  ['sfx_gameover',       'assets/sfx/gameover.ogg'],
  ['sfx_pickup',         'assets/sfx/pickup.ogg'],
];

const MUSIC = [
  ['music_dungeon',      'assets/music/bg_dungeon.ogg'],
];

// Цветные двери — дублируем base PNG с tint'ом через runtime: Phaser tint
// применяется при создании sprite, поэтому отдельные текстуры не нужны.
// Door сам решает какой tint выставить по своему `color`.

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    for (const [key, path] of SPRITES) this.load.image(key, path);
    for (const [key, path] of SFX) this.load.audio(key, path);
    for (const [key, path] of MUSIC) this.load.audio(key, path);

    // прогресс-бар во время загрузки
    const w = this.cameras.main.width, h = this.cameras.main.height;
    const bar = this.add.rectangle(w / 2, h / 2, 300, 8, 0x222222).setOrigin(0.5);
    const fill = this.add.rectangle(w / 2 - 150, h / 2, 0, 8, 0x4ec9ff).setOrigin(0, 0.5);
    this.add.text(w / 2, h / 2 - 24, 'Loading…', {
      fontFamily: 'monospace', fontSize: '16px', color: '#aaaaaa',
    }).setOrigin(0.5);
    this.load.on('progress', (p) => { fill.width = 300 * p; });
  }

  create() {
    // Pixel-art ассеты должны рендериться NEAREST, чтобы спрайты оставались
    // чёткими при scale. Текст и canvas-level scaling остаются bilinear
    // (antialias=true в Phaser config) — UI и края градиента сглажены.
    for (const [key] of SPRITES) {
      const tex = this.textures.get(key);
      if (tex && tex.setFilter) tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    // Огненный шар (snaряд игрока) — мягкий радиальный градиент с белым
    // hot-center, оранжевой средней зоной и тёмно-красным краем. Размер
    // 16×16, чтобы выглядел компактно на canvas.
    const fbSize = 16;
    const fbCv = document.createElement('canvas');
    fbCv.width = fbCv.height = fbSize;
    const fbx = fbCv.getContext('2d');
    const fbg = fbx.createRadialGradient(fbSize/2, fbSize/2, 0, fbSize/2, fbSize/2, fbSize/2);
    fbg.addColorStop(0.0, 'rgba(255,255,210,1)');
    fbg.addColorStop(0.4, 'rgba(255,180,40,1)');
    fbg.addColorStop(0.9, 'rgba(220,60,0,0.95)');
    fbg.addColorStop(1.0, 'rgba(120,0,0,0)');
    fbx.fillStyle = fbg;
    fbx.fillRect(0, 0, fbSize, fbSize);
    this.textures.addCanvas('fireball', fbCv);

    // Орб врага — холодный фиолетовый шар, аналогичный gradient.
    const eoSize = 16;
    const eoCv = document.createElement('canvas');
    eoCv.width = eoCv.height = eoSize;
    const eox = eoCv.getContext('2d');
    const eog = eox.createRadialGradient(eoSize/2, eoSize/2, 0, eoSize/2, eoSize/2, eoSize/2);
    eog.addColorStop(0.0, 'rgba(255,240,255,1)');
    eog.addColorStop(0.4, 'rgba(180,140,255,1)');
    eog.addColorStop(0.9, 'rgba(100,40,200,0.95)');
    eog.addColorStop(1.0, 'rgba(40,0,80,0)');
    eox.fillStyle = eog;
    eox.fillRect(0, 0, eoSize, eoSize);
    this.textures.addCanvas('enemy_orb', eoCv);

    // Радиальный кольцевой brush для FogOfWar и (опционально) softCircle
    // accumulator для memory. Прозрачный в центре, peak alpha у границы,
    // снова прозрачный за пределами — сглаживает блочную границу зрения.
    const radius = VISION_RADIUS_TILES * TILE_SIZE;
    const size = radius * 3;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const cx = cv.getContext('2d');
    cx.clearRect(0, 0, size, size);
    const grad = cx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, radius * 1.05);
    grad.addColorStop(0.0,  'rgba(0,0,0,0)');
    grad.addColorStop(0.65, 'rgba(0,0,0,0)');
    grad.addColorStop(0.92, 'rgba(0,0,0,0.55)');
    grad.addColorStop(1.0,  'rgba(0,0,0,0)');
    cx.fillStyle = grad;
    cx.fillRect(0, 0, size, size);
    this.textures.addCanvas('vignette', cv);

    // Дым 20×20 — soft радиальный круг серого цвета, alpha=1 в центре,
    // 0 на краю. Используется как пуф за ракетой.
    const smSize = 20;
    const smCv = document.createElement('canvas');
    smCv.width = smCv.height = smSize;
    const smx = smCv.getContext('2d');
    const smgrad = smx.createRadialGradient(smSize/2, smSize/2, 0, smSize/2, smSize/2, smSize/2);
    smgrad.addColorStop(0.0, 'rgba(180,180,180,1)');
    smgrad.addColorStop(0.6, 'rgba(120,120,120,0.6)');
    smgrad.addColorStop(1.0, 'rgba(80,80,80,0)');
    smx.fillStyle = smgrad;
    smx.fillRect(0, 0, smSize, smSize);
    this.textures.addCanvas('smoke_particle', smCv);

    // Однотонный пол 32×32 — без бордер, лёгкий шум чтоб не казался
    // плоской заливкой. Цвет — приглушённый коричневый, ровно по всей
    // площади (не граничит как 0x72 floor_1).
    const flSize = 32;
    const flCv = document.createElement('canvas');
    flCv.width = flCv.height = flSize;
    const flx = flCv.getContext('2d');
    flx.fillStyle = '#3a302a';
    flx.fillRect(0, 0, flSize, flSize);
    for (let i = 0; i < 70; i++) {
      const xx = Math.floor(Math.random() * flSize);
      const yy = Math.floor(Math.random() * flSize);
      const a = 0.06 + Math.random() * 0.10;
      const v = 50 + Math.floor(Math.random() * 30);
      flx.fillStyle = `rgba(${v},${v - 6},${v - 12},${a})`;
      flx.fillRect(xx, yy, 1, 1);
    }
    this.textures.addCanvas('floor_plain', flCv);

    // Ракета — продолговатая 24×10 капля: серый корпус, оранжевый нос,
    // тонкая жёлтая полоса. Спрайт ориентирован «вправо» (поворачивается
    // через setRotation на лету).
    const rkW = 24, rkH = 10;
    const rkCv = document.createElement('canvas');
    rkCv.width = rkW; rkCv.height = rkH;
    const rkx = rkCv.getContext('2d');
    rkx.fillStyle = '#9e9e9e';
    rkx.beginPath();
    rkx.moveTo(0, 2); rkx.lineTo(18, 2); rkx.lineTo(22, rkH/2); rkx.lineTo(18, rkH-2); rkx.lineTo(0, rkH-2);
    rkx.closePath(); rkx.fill();
    rkx.fillStyle = '#ff7043';
    rkx.beginPath();
    rkx.moveTo(16, 2); rkx.lineTo(20, rkH/2); rkx.lineTo(16, rkH-2);
    rkx.closePath(); rkx.fill();
    rkx.fillStyle = '#ffeb3b';
    rkx.fillRect(2, rkH/2 - 1, 12, 2);
    // мини-хвост
    rkx.fillStyle = '#fff59d';
    rkx.beginPath();
    rkx.moveTo(0, rkH/2); rkx.lineTo(-4, rkH/2 - 2); rkx.lineTo(-4, rkH/2 + 2);
    rkx.closePath(); rkx.fill();
    this.textures.addCanvas('rocket', rkCv);

    // Иконка ракетницы (pickup) — короткая трубка с орудийным «срезом».
    const plW = 28, plH = 16;
    const plCv = document.createElement('canvas');
    plCv.width = plW; plCv.height = plH;
    const plx = plCv.getContext('2d');
    plx.fillStyle = '#37474f';
    plx.fillRect(4, 5, 20, 6);
    plx.fillStyle = '#546e7a';
    plx.fillRect(2, 4, 4, 8);   // rear grip
    plx.fillStyle = '#263238';
    plx.fillRect(22, 3, 2, 10);  // muzzle ring
    plx.fillStyle = '#ff7043';
    plx.fillRect(24, 6, 4, 4);   // muzzle flash hint
    this.textures.addCanvas('pickup_rocket', plCv);

    // Частица взрыва — маленький радиальный круг с горячим центром.
    const epSize = 12;
    const epCv = document.createElement('canvas');
    epCv.width = epCv.height = epSize;
    const epx = epCv.getContext('2d');
    const epg = epx.createRadialGradient(epSize/2, epSize/2, 0, epSize/2, epSize/2, epSize/2);
    epg.addColorStop(0.0, 'rgba(255,255,200,1)');
    epg.addColorStop(0.4, 'rgba(255,150,30,1)');
    epg.addColorStop(1.0, 'rgba(220,40,0,0)');
    epx.fillStyle = epg;
    epx.fillRect(0, 0, epSize, epSize);
    this.textures.addCanvas('explosion_particle', epCv);

    // Hard-edge brush для затемнения каймы вокруг дырки. Сплошной белый
    // круг с alpha=1 внутри радиуса 16, alpha=0 снаружи. Sharp edge нужен
    // чтобы при MULTIPLY blend alpha не «съедала» альфу стены — иначе
    // стена становится полупрозрачной. С hard edge alpha=1*1=1.
    const wcSize = 32;
    const wcCv = document.createElement('canvas');
    wcCv.width = wcCv.height = wcSize;
    const wcx = wcCv.getContext('2d');
    wcx.fillStyle = 'rgba(255,255,255,1)';
    wcx.beginPath();
    wcx.arc(wcSize / 2, wcSize / 2, wcSize / 2, 0, Math.PI * 2);
    wcx.fill();
    this.textures.addCanvas('wall_char_brush', wcCv);

    // Brush для erase'а стен от попаданий пуль — soft circle ~24px с резким
    // центром (alpha 1) и плавным схождением к 0. Радиус совпадает с
    // WALL_ERASE_RADIUS_PX (constants.js). Маленький размер — чтобы дырки были
    // пиксельные, без расплывчатых краев.
    const wdSize = 32;
    const wdCv = document.createElement('canvas');
    wdCv.width = wdCv.height = wdSize;
    const wdcx = wdCv.getContext('2d');
    const wdgrad = wdcx.createRadialGradient(wdSize/2, wdSize/2, 0, wdSize/2, wdSize/2, wdSize/2);
    wdgrad.addColorStop(0.0, 'rgba(255,255,255,1)');
    wdgrad.addColorStop(0.6, 'rgba(255,255,255,1)');
    wdgrad.addColorStop(1.0, 'rgba(255,255,255,0)');
    wdcx.fillStyle = wdgrad;
    wdcx.fillRect(0, 0, wdSize, wdSize);
    this.textures.addCanvas('wall_damage_brush', wdCv);

    // soft_circle — белый круг с alpha-градиентом, используется FogOfWar как
    // brush для накопительной explored-памяти и mask текущего зрения.
    const sSize = radius * 2;
    const sc = document.createElement('canvas');
    sc.width = sc.height = sSize;
    const scx = sc.getContext('2d');
    const sgrad = scx.createRadialGradient(sSize / 2, sSize / 2, 0, sSize / 2, sSize / 2, sSize / 2);
    sgrad.addColorStop(0.0, 'rgba(255,255,255,1)');
    sgrad.addColorStop(0.7, 'rgba(255,255,255,1)');
    sgrad.addColorStop(1.0, 'rgba(255,255,255,0)');
    scx.fillStyle = sgrad;
    scx.fillRect(0, 0, sSize, sSize);
    this.textures.addCanvas('soft_circle', sc);

    this.scene.start('MenuScene');
  }
}
