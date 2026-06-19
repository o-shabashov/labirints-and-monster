import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { generateMaze } from '../world/MazeGenerator.js';
import { GRID_W, GRID_H } from '../config/constants.js';
import { buildWorld } from './World3D.js';
import { FpsControls } from './FpsControls.js';
import { Monster3D, MONSTER_KINDS } from './Monster3D.js';
import { Rocket3D, Bomb3D, spawnExplosion } from './Weapons3D.js';
import { TILE } from '../config/constants.js';

const EYE_H = 0.55;
const MONSTER_COUNT = 16;
const TOUCH_DIST = 0.5;        // дистанция касания монстра
const TOUCH_IFRAMES_MS = 900;
const ROCKET_CD_MS = 1200;
const ROCKET_RADIUS = 1.6;
const BOMB_RADIUS = 2.2;
const START_BOMBS = 5;

const canvas = document.getElementById('c');
const overlay = document.getElementById('overlay');
const crosshair = document.getElementById('crosshair');
const hud = document.getElementById('hud');
const hpEl = document.getElementById('hp');
const killEl = document.getElementById('killcnt');
const flashEl = document.getElementById('flash');
const rocketStateEl = document.getElementById('rocketState');
const bombCountEl = document.getElementById('bombCount');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060a);
// Туман — атмосферная замена fog-of-war: дальше N тайлов всё тонет в темноте.
scene.fog = new THREE.Fog(0x05060a, 2.5, 11);

const camera = new THREE.PerspectiveCamera(
  75, window.innerWidth / window.innerHeight, 0.01, 100,
);

// ---- Свет ----
scene.add(new THREE.AmbientLight(0x556070, 0.7));
// Факел игрока — тёплый point-light, следует за камерой.
const torch = new THREE.PointLight(0xffc080, 1.8, 10, 1.3);
scene.add(torch);

// ---- Мир ----
const { grid } = generateMaze(GRID_W, GRID_H, Date.now());
const world = buildWorld(scene, grid);

// спавн на entrance
let spawn = { x: 1.5, y: 1.5 };
for (let y = 0; y < GRID_H; y++) {
  for (let x = 0; x < GRID_W; x++) {
    if (grid[y][x] === 2 /* TILE.ENTRANCE */) spawn = { x: x + 0.5, y: y + 0.5 };
  }
}
camera.position.set(spawn.x, EYE_H, spawn.y);

// ---- Монстры ----
// спавним на FLOOR-тайлах далеко от входа (как 2D-версия)
const floorTiles = [];
for (let y = 1; y < GRID_H - 1; y++) {
  for (let x = 1; x < GRID_W - 1; x++) {
    if (grid[y][x] !== TILE.FLOOR) continue;
    const d = Math.hypot(x + 0.5 - spawn.x, y + 0.5 - spawn.y);
    if (d >= 7) floorTiles.push({ x, y });
  }
}
let monsters = [];
for (let i = 0; i < MONSTER_COUNT && floorTiles.length; i++) {
  const idx = Math.floor(Math.random() * floorTiles.length);
  const c = floorTiles.splice(idx, 1)[0];
  const kind = MONSTER_KINDS[i % MONSTER_KINDS.length];
  monsters.push(new Monster3D(scene, grid, { ...kind, tx: c.x, ty: c.y }));
}

// ---- Состояние игрока ----
let hp = 3;
let kills = 0;
let hurtUntil = 0;
let dead = false;
function updateHud() {
  const shown = Math.max(0, Math.min(3, hp));
  hpEl.textContent = '♥'.repeat(shown) + '♡'.repeat(3 - shown);
  killEl.textContent = `  Убито: ${kills}`;
}
function damagePlayer(now) {
  if (dead || now < hurtUntil) return;
  hurtUntil = now + TOUCH_IFRAMES_MS;
  hp -= 1;
  updateHud();
  flashEl.style.opacity = '1';
  setTimeout(() => { flashEl.style.opacity = '0'; }, 120);
  if (hp <= 0) {
    dead = true;
    controls.unlock();
    overlay.querySelector('h1').textContent = 'ВЫ ПОГИБЛИ';
    overlay.querySelector('h1').style.color = '#ff5252';
    overlay.querySelector('.go').textContent = `Убито: ${kills} · Кликни для рестарта`;
  }
}
updateHud();
window.__three_monsters = monsters;

// ---- Оружие ----
let rockets = [];
let bombs = [];
let explosions = [];      // активные tick-функции взрывов
let nextRocketAt = 0;
let bombAmmo = START_BOMBS;
let shakeT = 0;           // оставшееся время тряски камеры (sec)

function fireRocket(now) {
  if (now < nextRocketAt) return;
  nextRocketAt = now + ROCKET_CD_MS;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const origin = camera.position.clone().addScaledVector(dir, 0.4);
  rockets.push(new Rocket3D(scene, origin, dir));
}
function throwBomb() {
  if (bombAmmo <= 0) return;
  bombAmmo -= 1;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const origin = camera.position.clone().addScaledVector(dir, 0.4);
  bombs.push(new Bomb3D(scene, origin, dir));
}

// Взрыв: частицы + AoE урон монстрам + тряска + (разрушение стен — ②)
function explode(pos, opts = {}) {
  const radius = opts.radius ?? ROCKET_RADIUS;
  const dmg = opts.dmg ?? 3;
  explosions.push(spawnExplosion(scene, pos, { radius, count: opts.count ?? 22 }));
  shakeT = Math.max(shakeT, opts.shake ?? 0.18);
  const r2 = radius * radius;
  for (const m of monsters) {
    if (m.dead) continue;
    const dx = m.sprite.position.x - pos.x;
    const dz = m.sprite.position.z - pos.z;
    if (dx * dx + dz * dz > r2) continue;
    if (m.takeDamage(dmg)) { kills++; updateHud(); }
  }
  if (world.damageWall) world.damageWall(pos.x, pos.z, radius);
}

window.addEventListener('mousedown', (e) => {
  if (!controls.isLocked) return;
  if (e.button === 0) shoot(performance.now());
  else if (e.button === 2) fireRocket(performance.now());
});
window.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('keydown', (e) => {
  if (!controls.isLocked) return;
  if (e.code === 'KeyQ') fireRocket(performance.now());
  else if (e.code === 'KeyF') throwBomb();
});

// дев-хуки для verify (playwright не может pointer-lock)
window.__three_dbg = { fireRocket, throwBomb, explode, world, scene };

// ---- Управление ----
const controls = new PointerLockControls(camera, document.body);
const fps = new FpsControls(camera, grid);

overlay.addEventListener('click', () => {
  if (dead) { location.reload(); return; }
  controls.lock();
});
controls.addEventListener('lock', () => {
  overlay.style.display = 'none';
  crosshair.style.display = 'block';
  hud.style.display = 'block';
});
controls.addEventListener('unlock', () => {
  overlay.style.display = 'flex';
  crosshair.style.display = 'none';
  hud.style.display = 'none';
});

// ---- Стрельба: raycast из центра экрана ----
const raycaster = new THREE.Raycaster();
const SCREEN_CENTER = new THREE.Vector2(0, 0);
let nextShotAt = 0;
function shoot(now) {
  if (now < nextShotAt) return;
  nextShotAt = now + 250;       // fire-rate
  crosshair.style.transform = 'translate(-50%,-50%) scale(1.5)';
  setTimeout(() => { crosshair.style.transform = 'translate(-50%,-50%)'; }, 60);
  raycaster.setFromCamera(SCREEN_CENTER, camera);
  const sprites = monsters.filter(m => !m.dead).map(m => m.sprite);
  const hits = raycaster.intersectObjects(sprites, false);
  if (!hits.length) return;
  const m = monsters.find(mm => mm.sprite === hits[0].object);
  if (m && m.takeDamage(1)) { kills++; updateHud(); }
}
window.addEventListener('mousedown', (e) => {
  if (controls.isLocked && e.button === 0) shoot(performance.now());
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// дев-доступ
window.__three = { scene, camera, renderer, grid };

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now();
  if (controls.isLocked) fps.update(dt);
  torch.position.copy(camera.position);

  // монстры: BFS к тайлу игрока + проверка касания
  const playerTile = {
    x: Math.floor(camera.position.x),
    y: Math.floor(camera.position.z),
  };
  for (const m of monsters) {
    if (m.dead) continue;
    m.update(dt, playerTile);
    const dx = m.sprite.position.x - camera.position.x;
    const dz = m.sprite.position.z - camera.position.z;
    if (dx * dx + dz * dz < TOUCH_DIST * TOUCH_DIST) damagePlayer(now);
  }
  monsters = monsters.filter(m => !m.dead);

  // снаряды
  for (const r of rockets) {
    if (r.update(dt, grid)) { explode(r.mesh.position.clone(), { radius: ROCKET_RADIUS, dmg: 3 }); r.kill(); continue; }
    // прямое попадание в монстра
    for (const m of monsters) {
      if (m.dead) continue;
      const dx = m.sprite.position.x - r.mesh.position.x;
      const dz = m.sprite.position.z - r.mesh.position.z;
      if (dx * dx + dz * dz < 0.25) { explode(r.mesh.position.clone(), { radius: ROCKET_RADIUS, dmg: 3 }); r.kill(); break; }
    }
  }
  rockets = rockets.filter(r => !r.dead);

  for (const b of bombs) {
    if (b.update(dt, grid)) { explode(b.mesh.position.clone(), { radius: BOMB_RADIUS, dmg: 4, count: 30, shake: 0.28 }); b.kill(); }
  }
  bombs = bombs.filter(b => !b.dead);

  // взрывы (tick возвращает true когда отыграл)
  explosions = explosions.filter(tick => !tick(dt));

  // тряска камеры — джиттер позиции вокруг текущей, restore после render
  let sx = 0, sy = 0, sz = 0;
  if (shakeT > 0) {
    shakeT = Math.max(0, shakeT - dt);
    const amp = 0.04 * (shakeT / 0.18);
    sx = (Math.random() - 0.5) * amp;
    sy = (Math.random() - 0.5) * amp;
    sz = (Math.random() - 0.5) * amp;
    camera.position.x += sx; camera.position.y += sy; camera.position.z += sz;
  }

  // HUD оружия
  rocketStateEl.textContent = now >= nextRocketAt ? 'готова' : `${((nextRocketAt - now) / 1000).toFixed(1)}с`;
  bombCountEl.textContent = bombAmmo;

  renderer.render(scene, camera);
  if (shakeT > 0) { camera.position.x -= sx; camera.position.y -= sy; camera.position.z -= sz; }
}
animate();
