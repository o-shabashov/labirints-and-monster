import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { generateMaze } from '../world/MazeGenerator.js';
import { GRID_W, GRID_H, TILE } from '../config/constants.js';
import { buildWorld } from './World3D.js';
import { FpsControls } from './FpsControls.js';
import { Monster3D, MONSTER_KINDS } from './Monster3D.js';
import { Rocket3D, Bomb3D, spawnExplosion } from './Weapons3D.js';
import { Sound3D } from './Sound3D.js';

const EYE_H = 0.55;
const MONSTER_BASE = 14;
const MONSTERS_PER_LEVEL = 3;
const MAX_LEVELS = 5;
const TOUCH_DIST = 0.5;
const TOUCH_IFRAMES_MS = 900;
const ROCKET_CD_MS = 1200;
const ROCKET_RADIUS = 1.6;
const BOMB_RADIUS = 2.2;
const START_BOMBS = 5;
const EXIT_DIST = 0.6;          // дистанция до exit-столба для перехода

const canvas = document.getElementById('c');
const overlay = document.getElementById('overlay');
const crosshair = document.getElementById('crosshair');
const hud = document.getElementById('hud');
const hpEl = document.getElementById('hp');
const killEl = document.getElementById('killcnt');
const lvlEl = document.getElementById('lvl');
const flashEl = document.getElementById('flash');
const rocketStateEl = document.getElementById('rocketState');
const bombCountEl = document.getElementById('bombCount');
const viewmodelEl = document.getElementById('viewmodel');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060a);
scene.fog = new THREE.Fog(0x05060a, 2.5, 11);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 100);
scene.add(new THREE.AmbientLight(0x556070, 0.7));
const torch = new THREE.PointLight(0xffc080, 1.8, 10, 1.3);
scene.add(torch);

const controls = new PointerLockControls(camera, document.body);

// ---- Постоянное состояние игрока (через уровни) ----
let hp = 3;
let kills = 0;
let bombAmmo = START_BOMBS;
let level = 1;
let dead = false;
let won = false;

// ---- Уровень-специфичное (пересоздаётся в loadLevel) ----
let grid = null;
let world = null;
let monsters = [];
let exitTile = null;
let fps = null;
let transitioning = false;

// снаряды/эффекты
let rockets = [];
let bombs = [];
let explosions = [];
let nextRocketAt = 0;
let hurtUntil = 0;
let shakeT = 0;
// viewmodel / footstep
let vmRecoil = 0;
let walkPhase = 0;
let stepDist = 0;
const prevPos = new THREE.Vector3();

function clearLevel() {
  for (const m of monsters) m.kill();
  monsters = [];
  for (const r of rockets) r.kill();
  rockets = [];
  for (const b of bombs) b.kill();
  bombs = [];
  explosions = [];
  if (world) { scene.remove(world.group); world = null; }
}

function loadLevel(lvl) {
  clearLevel();
  level = lvl;
  transitioning = false;
  grid = generateMaze(GRID_W, GRID_H, Date.now() + lvl).grid;
  world = buildWorld(scene, grid);
  exitTile = world.exit;

  // спавн на entrance
  let spawn = { x: 1.5, y: 1.5 };
  for (let y = 0; y < GRID_H; y++)
    for (let x = 0; x < GRID_W; x++)
      if (grid[y][x] === TILE.ENTRANCE) spawn = { x: x + 0.5, y: y + 0.5 };
  camera.position.set(spawn.x, EYE_H, spawn.y);

  if (!fps) fps = new FpsControls(camera, grid);
  else fps.setGrid(grid);

  // монстры далеко от входа, число растёт с уровнем
  const floorTiles = [];
  for (let y = 1; y < GRID_H - 1; y++)
    for (let x = 1; x < GRID_W - 1; x++) {
      if (grid[y][x] !== TILE.FLOOR) continue;
      if (Math.hypot(x + 0.5 - spawn.x, y + 0.5 - spawn.y) >= 7) floorTiles.push({ x, y });
    }
  const count = MONSTER_BASE + (lvl - 1) * MONSTERS_PER_LEVEL;
  for (let i = 0; i < count && floorTiles.length; i++) {
    const c = floorTiles.splice(Math.floor(Math.random() * floorTiles.length), 1)[0];
    const kind = MONSTER_KINDS[i % MONSTER_KINDS.length];
    monsters.push(new Monster3D(scene, grid, { ...kind, tx: c.x, ty: c.y }));
  }
  window.__three_monsters = monsters;
  updateHud();
}

function updateHud() {
  const shown = Math.max(0, Math.min(3, hp));
  hpEl.textContent = '♥'.repeat(shown) + '♡'.repeat(3 - shown);
  killEl.textContent = `  Убито: ${kills}`;
  lvlEl.textContent = `  Уровень ${level}/${MAX_LEVELS}`;
}

function endGame(title, color, sub) {
  controls.unlock();
  overlay.querySelector('h1').textContent = title;
  overlay.querySelector('h1').style.color = color;
  overlay.querySelector('.go').textContent = sub;
}

function damagePlayer(now) {
  if (dead || won || now < hurtUntil) return;
  hurtUntil = now + TOUCH_IFRAMES_MS;
  hp -= 1;
  updateHud();
  Sound3D.hurt();
  flashEl.style.opacity = '1';
  setTimeout(() => { flashEl.style.opacity = '0'; }, 120);
  if (hp <= 0) {
    dead = true;
    endGame('ВЫ ПОГИБЛИ', '#ff5252', `Убито: ${kills} · Кликни для рестарта`);
  }
}

function reachExit() {
  if (transitioning) return;
  transitioning = true;
  if (level >= MAX_LEVELS) {
    won = true;
    endGame('ПОБЕДА!', '#66bb6a', `Убито: ${kills} · Кликни заново`);
    return;
  }
  loadLevel(level + 1);
}

// ---- Оружие ----
function fireRocket(now) {
  if (now < nextRocketAt) return;
  nextRocketAt = now + ROCKET_CD_MS;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  rockets.push(new Rocket3D(scene, camera.position.clone().addScaledVector(dir, 0.4), dir));
  Sound3D.rocket();
  vmRecoil = 42;
}
function throwBomb() {
  if (bombAmmo <= 0) return;
  bombAmmo -= 1;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  bombs.push(new Bomb3D(scene, camera.position.clone().addScaledVector(dir, 0.4), dir));
}
function explode(pos, opts = {}) {
  const radius = opts.radius ?? ROCKET_RADIUS;
  const dmg = opts.dmg ?? 3;
  explosions.push(spawnExplosion(scene, pos, { radius, count: opts.count ?? 22 }));
  Sound3D.explosion();
  shakeT = Math.max(shakeT, opts.shake ?? 0.18);
  const r2 = radius * radius;
  for (const m of monsters) {
    if (m.dead) continue;
    const dx = m.sprite.position.x - pos.x, dz = m.sprite.position.z - pos.z;
    if (dx * dx + dz * dz > r2) continue;
    if (m.takeDamage(dmg)) { kills++; updateHud(); }
  }
  if (world && world.damageWall) world.damageWall(pos.x, pos.z, radius);
}

// ---- Стрельба (hitscan) ----
const raycaster = new THREE.Raycaster();
const SCREEN_CENTER = new THREE.Vector2(0, 0);
let nextShotAt = 0;
function shoot(now) {
  if (now < nextShotAt) return;
  nextShotAt = now + 250;
  Sound3D.shoot();
  vmRecoil = 24;
  crosshair.style.transform = 'translate(-50%,-50%) scale(1.5)';
  setTimeout(() => { crosshair.style.transform = 'translate(-50%,-50%)'; }, 60);
  raycaster.setFromCamera(SCREEN_CENTER, camera);
  const hits = raycaster.intersectObjects(monsters.filter(m => !m.dead).map(m => m.sprite), false);
  if (!hits.length) return;
  const m = monsters.find(mm => mm.sprite === hits[0].object);
  if (m && m.takeDamage(1)) { kills++; updateHud(); }
}

// ---- Ввод ----
overlay.addEventListener('click', () => {
  if (dead || won) { location.reload(); return; }
  controls.lock();
});
controls.addEventListener('lock', () => {
  overlay.style.display = 'none';
  crosshair.style.display = 'block';
  hud.style.display = 'block';
  viewmodelEl.style.display = 'block';
  prevPos.copy(camera.position);
  Sound3D.resume();
});
controls.addEventListener('unlock', () => {
  overlay.style.display = 'flex';
  crosshair.style.display = 'none';
  hud.style.display = 'none';
  viewmodelEl.style.display = 'none';
});
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
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// дев-доступ
window.__three = { scene, camera, renderer, get grid() { return grid; }, get world() { return world; } };
window.__three_dbg = { fireRocket, throwBomb, explode, reachExit, loadLevel };

// ---- Запуск ----
loadLevel(1);

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now();
  if (controls.isLocked && !dead && !won) fps.update(dt);
  torch.position.copy(camera.position);

  // движение игрока за кадр → шаги + bob viewmodel
  const moved = Math.hypot(camera.position.x - prevPos.x, camera.position.z - prevPos.z);
  prevPos.copy(camera.position);
  const walking = controls.isLocked && moved > 0.0005;
  if (walking) {
    walkPhase += moved * 9;
    stepDist += moved;
    if (stepDist > 0.9) { Sound3D.step(); stepDist = 0; }
  }

  const playerTile = { x: Math.floor(camera.position.x), y: Math.floor(camera.position.z) };

  // exit
  if (exitTile && !transitioning && !dead && !won) {
    const dx = exitTile.x + 0.5 - camera.position.x;
    const dz = exitTile.y + 0.5 - camera.position.z;
    if (dx * dx + dz * dz < EXIT_DIST * EXIT_DIST) reachExit();
  }

  // монстры
  for (const m of monsters) {
    if (m.dead) continue;
    m.update(dt, playerTile);
    const dx = m.sprite.position.x - camera.position.x;
    const dz = m.sprite.position.z - camera.position.z;
    if (dx * dx + dz * dz < TOUCH_DIST * TOUCH_DIST) damagePlayer(now);
  }
  monsters = monsters.filter(m => !m.dead);

  // ракеты
  for (const r of rockets) {
    if (r.update(dt, grid)) { explode(r.mesh.position.clone(), { radius: ROCKET_RADIUS, dmg: 3 }); r.kill(); continue; }
    for (const m of monsters) {
      if (m.dead) continue;
      const dx = m.sprite.position.x - r.mesh.position.x, dz = m.sprite.position.z - r.mesh.position.z;
      if (dx * dx + dz * dz < 0.25) { explode(r.mesh.position.clone(), { radius: ROCKET_RADIUS, dmg: 3 }); r.kill(); break; }
    }
  }
  rockets = rockets.filter(r => !r.dead);

  // бомбы
  for (const b of bombs) {
    if (b.update(dt, grid)) { explode(b.mesh.position.clone(), { radius: BOMB_RADIUS, dmg: 4, count: 30, shake: 0.28 }); b.kill(); }
  }
  bombs = bombs.filter(b => !b.dead);

  explosions = explosions.filter(tick => !tick(dt));

  // тряска камеры
  let sx = 0, sy = 0, sz = 0;
  if (shakeT > 0) {
    shakeT = Math.max(0, shakeT - dt);
    const amp = 0.04 * (shakeT / 0.18);
    sx = (Math.random() - 0.5) * amp; sy = (Math.random() - 0.5) * amp; sz = (Math.random() - 0.5) * amp;
    camera.position.x += sx; camera.position.y += sy; camera.position.z += sz;
  }

  rocketStateEl.textContent = now >= nextRocketAt ? 'готова' : `${((nextRocketAt - now) / 1000).toFixed(1)}с`;
  bombCountEl.textContent = bombAmmo;

  // viewmodel: bob при ходьбе + затухающий recoil; факел мерцает
  vmRecoil += (0 - vmRecoil) * Math.min(1, dt * 12);
  const bob = walking ? Math.sin(walkPhase) * 7 : 0;
  viewmodelEl.style.transform = `translateY(${bob + vmRecoil}px)`;
  torch.intensity = 1.8 + Math.sin(now * 0.012) * 0.18 + (Math.random() - 0.5) * 0.12;

  renderer.render(scene, camera);
  if (shakeT > 0) { camera.position.x -= sx; camera.position.y -= sy; camera.position.z -= sz; }
}
animate();
