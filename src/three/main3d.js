import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { generateMaze } from '../world/MazeGenerator.js';
import { GRID_W, GRID_H, TILE } from '../config/constants.js';
import { buildWorld } from './World3D.js';
import { FpsControls } from './FpsControls.js';
import { Monster3D, MONSTER_KINDS } from './Monster3D.js';
import { Rocket3D, Bomb3D, spawnExplosion, spawnSparks } from './Weapons3D.js';
import { Sound3D } from './Sound3D.js';
import { Difficulty } from '../systems/Difficulty.js';
import { rocketPickupTexture, bombPickupTexture, shotgunDataURL } from './Textures3D.js';

const EYE_H = 0.55;
const MONSTER_BASE = 8;
const MONSTERS_PER_LEVEL = 2;
const MAX_LEVELS = 5;
const TOUCH_DIST = 0.5;
const TOUCH_IFRAMES_MS = 900;
const ROCKET_CD_MS = 1200;
const ROCKET_RADIUS = 1.6;
const BOMB_RADIUS = 2.2;
const EXIT_DIST = 0.6;          // дистанция до exit-столба для перехода
const PICKUP_DIST = 0.6;
const BOMBS_PER_PICKUP = 3;

const canvas = document.getElementById('c');
const overlay = document.getElementById('overlay');
const crosshair = document.getElementById('crosshair');
const hud = document.getElementById('hud');
const hpEl = document.getElementById('hp');
const killEl = document.getElementById('killcnt');
const lvlEl = document.getElementById('lvl');
const flashEl = document.getElementById('flash');
const diffEl = document.getElementById('diff');
const hbRocketEl = document.getElementById('hbRocket');
const hbBombEl = document.getElementById('hbBomb');
const slotEls = {
  gun:    document.querySelector('.slot[data-w="gun"]'),
  rocket: document.querySelector('.slot[data-w="rocket"]'),
  bomb:   document.querySelector('.slot[data-w="bomb"]'),
};
let currentWeapon = 'gun';
const viewmodelEl = document.getElementById('viewmodel');
const staffEl = document.getElementById('staff');
const gunViewEl = document.getElementById('gunView');
gunViewEl.style.backgroundImage = `url(${shotgunDataURL()})`;
const compassEl = document.getElementById('compass');
const compassArrowEl = document.getElementById('compassArrow');
const compassDistEl = document.getElementById('compassDist');
const introhintEl = document.getElementById('introhint');
let introShown = false;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0c12);
scene.fog = new THREE.Fog(0x0a0c12, 3.5, 15);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 100);
scene.add(new THREE.AmbientLight(0x6c7890, 0.95));
const torch = new THREE.PointLight(0xffc080, 2.2, 13, 1.2);
scene.add(torch);

const controls = new PointerLockControls(camera, document.body);

// ---- Постоянное состояние игрока (через уровни) ----
let hp = 3;
let kills = 0;
let bombAmmo = 0;          // бомбы только из пикапов
let hasRocket = false;     // ракетница только из пикапа
let level = 1;
let dead = false;
let won = false;
const difficulty = new Difficulty();   // адаптивная сложность, персистентна

// ---- Уровень-специфичное (пересоздаётся в loadLevel) ----
let grid = null;
let world = null;
let monsters = [];
let pickups = [];          // {mesh, type, bobBase}
let exitTile = null;
let fps = null;
let transitioning = false;

// снаряды/эффекты
let rockets = [];
let bombs = [];
let tracers = [];          // видимые трассеры пуль (cosmetic, урон hitscan)
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
  for (const p of pickups) p.mesh.removeFromParent();
  pickups = [];
  explosions = [];
  if (world) { scene.remove(world.group); world = null; }
}

// Пикап-объект на floor-тайле: парящий billboard-спрайт с icon-текстурой.
function spawnPickup(type, tx, ty) {
  const tex = type === 'rocket' ? rocketPickupTexture() : bombPickupTexture();
  const mesh = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  mesh.scale.set(0.5, 0.5, 1);
  mesh.position.set(tx + 0.5, 0.45, ty + 0.5);
  scene.add(mesh);
  pickups.push({ mesh, type, bobBase: 0.45 });
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
  // смотреть в открытый проход, а не в стену
  const etx = Math.floor(spawn.x), ety = Math.floor(spawn.y);
  const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dz]) =>
    grid[ety + dz] && grid[ety + dz][etx + dx] === TILE.FLOOR);
  const od = open || [1, 0];
  camera.lookAt(spawn.x + od[0], EYE_H, spawn.y + od[1]);

  if (!fps) fps = new FpsControls(camera, grid);
  else fps.setGrid(grid);

  // монстры далеко от входа, число растёт с уровнем
  const floorTiles = [];
  for (let y = 1; y < GRID_H - 1; y++)
    for (let x = 1; x < GRID_W - 1; x++) {
      if (grid[y][x] !== TILE.FLOOR) continue;
      if (Math.hypot(x + 0.5 - spawn.x, y + 0.5 - spawn.y) >= 7) floorTiles.push({ x, y });
    }
  // Difficulty влияет на число монстров; уровень — на их HP (tier).
  const dm = difficulty.multiplier(performance.now());
  const tierHp = 1 + (lvl - 1) * 0.4;
  const count = MONSTER_BASE + (lvl - 1) * MONSTERS_PER_LEVEL + Math.max(0, Math.round((dm - 1) * 3));
  for (let i = 0; i < count && floorTiles.length; i++) {
    const c = floorTiles.splice(Math.floor(Math.random() * floorTiles.length), 1)[0];
    const kind = MONSTER_KINDS[i % MONSTER_KINDS.length];
    const hp = Math.max(kind.hp, Math.round(kind.hp * tierHp));
    monsters.push(new Monster3D(scene, grid, { ...kind, hp, tx: c.x, ty: c.y }));
  }
  window.__three_monsters = monsters;

  // Пикапы: ракетница (если ещё нет) + бомбы — на floor-тайлах средней
  // дистанции от входа, чтобы их находили по ходу.
  const midTiles = [];
  for (let y = 1; y < GRID_H - 1; y++)
    for (let x = 1; x < GRID_W - 1; x++) {
      if (grid[y][x] !== TILE.FLOOR) continue;
      const d = Math.hypot(x + 0.5 - spawn.x, y + 0.5 - spawn.y);
      if (d >= 3 && d <= 10) midTiles.push({ x, y });
    }
  const takeTile = () => midTiles.length
    ? midTiles.splice(Math.floor(Math.random() * midTiles.length), 1)[0] : null;
  if (!hasRocket) { const c = takeTile(); if (c) spawnPickup('rocket', c.x, c.y); }
  const bombDrops = 1 + (lvl % 2);   // 1-2 сумки бомб на уровень
  for (let i = 0; i < bombDrops; i++) { const c = takeTile(); if (c) spawnPickup('bomb', c.x, c.y); }

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
  difficulty.trackDamage(now);
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
  if (!hasRocket) return;
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
    const mp = m.sprite.position.clone();
    if (m.takeDamage(dmg, pos.x, pos.z)) {
      kills++; difficulty.trackKill(performance.now()); updateHud();
      explosions.push(spawnSparks(scene, mp, { count: 16, color: 0xff8844, spread: 2.4 }));
    }
  }
  if (world && world.damageWall) world.damageWall(pos.x, pos.z, radius);
}

// ---- Стрельба (hitscan + видимый трассер) ----
const raycaster = new THREE.Raycaster();
const SCREEN_CENTER = new THREE.Vector2(0, 0);
const TRACER_GEO = new THREE.SphereGeometry(0.05, 6, 6);
const TRACER_MAT = new THREE.MeshBasicMaterial({ color: 0xfff176 });
let nextShotAt = 0;
function shoot(now) {
  if (now < nextShotAt) return;
  // Дробовик: PELLETS картечин веером. Урон 1/картечина — мощно вблизи
  // (все попадают), слабо вдали (разлёт мимо). Медленная перезарядка.
  nextShotAt = now + 520;
  Sound3D.shotgun();
  vmRecoil = 44;
  crosshair.style.transform = 'translate(-50%,-50%) scale(2.4)';
  setTimeout(() => { crosshair.style.transform = 'translate(-50%,-50%)'; }, 100);
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const muzzle = camera.position.clone().addScaledVector(dir, 0.35);
  muzzle.y -= 0.06;
  const PELLETS = 8;
  const SPREAD = 0.075;   // разброс в NDC
  const live = monsters.filter(m => !m.dead).map(m => m.sprite);
  const counted = new Set();
  for (let i = 0; i < PELLETS; i++) {
    const sx = (Math.random() * 2 - 1) * SPREAD;
    const sy = (Math.random() * 2 - 1) * SPREAD;
    raycaster.setFromCamera(new THREE.Vector2(sx, sy), camera);
    const hits = raycaster.intersectObjects(live, false);
    let endpoint;
    if (hits.length) {
      endpoint = hits[0].point.clone();
      const m = monsters.find(mm => mm.sprite === hits[0].object);
      if (m && !m.dead) {
        const mp = m.sprite.position.clone();
        explosions.push(spawnSparks(scene, mp, { count: 4, color: 0xfff176, spread: 1.0 }));
        if (m.takeDamage(1, camera.position.x, camera.position.z) && !counted.has(m)) {
          counted.add(m);
          kills++; difficulty.trackKill(performance.now()); updateHud();
          explosions.push(spawnSparks(scene, mp, { count: 14, color: 0xff8844, spread: 2.2 }));
        }
      }
    } else {
      endpoint = muzzle.clone().addScaledVector(dir, 12);
    }
    const mesh = new THREE.Mesh(TRACER_GEO, TRACER_MAT);
    mesh.position.copy(muzzle);
    scene.add(mesh);
    tracers.push({ mesh, from: muzzle.clone(), to: endpoint, t: 0, dur: 0.08 });
  }
}

// ---- Выбор оружия ----
function selectWeapon(w) {
  if (w === 'rocket' && !hasRocket) return;   // ракетница ещё не подобрана
  currentWeapon = w;
  refreshHotbar();
}
function fireCurrent(now) {
  if (currentWeapon === 'gun') shoot(now);
  else if (currentWeapon === 'rocket') fireRocket(now);
  else if (currentWeapon === 'bomb') { throwBomb(); if (bombAmmo <= 0) selectWeapon('gun'); }
}
function refreshHotbar() {
  slotEls.gun.classList.toggle('active', currentWeapon === 'gun');
  slotEls.rocket.classList.toggle('active', currentWeapon === 'rocket');
  slotEls.bomb.classList.toggle('active', currentWeapon === 'bomb');
  slotEls.rocket.classList.toggle('locked', !hasRocket);
  slotEls.bomb.classList.toggle('locked', bombAmmo <= 0);
  // viewmodel: дробовик для пушки, посох для ракеты/бомбы
  const gun = currentWeapon === 'gun';
  gunViewEl.style.display = gun ? 'block' : 'none';
  staffEl.style.display = gun ? 'none' : 'block';
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
  compassEl.style.display = 'block';
  prevPos.copy(camera.position);
  Sound3D.resume();
  // вводная подсказка — один раз, плавно гаснет
  if (!introShown) {
    introShown = true;
    introhintEl.style.display = 'block';
    introhintEl.style.opacity = '1';
    setTimeout(() => { introhintEl.style.opacity = '0'; }, 6000);
    setTimeout(() => { introhintEl.style.display = 'none'; }, 7200);
  }
});
controls.addEventListener('unlock', () => {
  overlay.style.display = 'flex';
  crosshair.style.display = 'none';
  hud.style.display = 'none';
  viewmodelEl.style.display = 'none';
  compassEl.style.display = 'none';
});
window.addEventListener('mousedown', (e) => {
  if (!controls.isLocked) return;
  if (e.button === 0) fireCurrent(performance.now());        // ЛКМ — текущее оружие
  else if (e.button === 2) { selectWeapon('rocket'); fireRocket(performance.now()); } // ПКМ — ракета
});
window.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('keydown', (e) => {
  if (!controls.isLocked) return;
  if (e.code === 'Digit1') selectWeapon('gun');
  else if (e.code === 'Digit2') selectWeapon('rocket');
  else if (e.code === 'Digit3') selectWeapon('bomb');
  else if (e.code === 'KeyQ') { selectWeapon('rocket'); fireRocket(performance.now()); }
  else if (e.code === 'KeyF') { selectWeapon('bomb'); throwBomb(); if (bombAmmo <= 0) selectWeapon('gun'); }
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// дев-доступ
window.__three = { scene, camera, renderer, get grid() { return grid; }, get world() { return world; }, get pickups() { return pickups; } };
window.__three_dbg = { fireRocket, throwBomb, explode, reachExit, loadLevel, selectWeapon, get hasRocket() { return hasRocket; }, get bombAmmo() { return bombAmmo; }, get currentWeapon() { return currentWeapon; } };

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

  // difficulty → скорость монстров (адаптивно, каждый кадр)
  const diffMul = difficulty.multiplier(now);

  // монстры
  for (const m of monsters) {
    if (m.dead) continue;
    m.speedMul = diffMul;
    m.update(dt, playerTile);
    const dx = m.sprite.position.x - camera.position.x;
    const dz = m.sprite.position.z - camera.position.z;
    if (dx * dx + dz * dz < TOUCH_DIST * TOUCH_DIST) damagePlayer(now);
  }
  monsters = monsters.filter(m => !m.dead);

  // пикапы: парят + подбираются по дистанции
  for (const p of pickups) {
    p.mesh.position.y = p.bobBase + Math.sin(now * 0.004) * 0.08;
    p.mesh.rotation.y += dt * 2;
    const dx = p.mesh.position.x - camera.position.x;
    const dz = p.mesh.position.z - camera.position.z;
    if (dx * dx + dz * dz < PICKUP_DIST * PICKUP_DIST) {
      if (p.type === 'rocket') { hasRocket = true; nextRocketAt = 0; selectWeapon('rocket'); }
      else { bombAmmo += BOMBS_PER_PICKUP; selectWeapon('bomb'); }
      Sound3D.step();
      p.mesh.removeFromParent();
      p.taken = true;
      updateHud();
    }
  }
  pickups = pickups.filter(p => !p.taken);

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

  // трассеры пуль — летят muzzle→endpoint, исчезают
  for (const tr of tracers) {
    tr.t += dt;
    const k = Math.min(1, tr.t / tr.dur);
    tr.mesh.position.lerpVectors(tr.from, tr.to, k);
    if (k >= 1) { tr.mesh.removeFromParent(); tr.done = true; }
  }
  tracers = tracers.filter(tr => !tr.done);

  // тряска камеры
  let sx = 0, sy = 0, sz = 0;
  if (shakeT > 0) {
    shakeT = Math.max(0, shakeT - dt);
    const amp = 0.04 * (shakeT / 0.18);
    sx = (Math.random() - 0.5) * amp; sy = (Math.random() - 0.5) * amp; sz = (Math.random() - 0.5) * amp;
    camera.position.x += sx; camera.position.y += sy; camera.position.z += sz;
  }

  refreshHotbar();
  hbRocketEl.textContent = hasRocket
    ? (now >= nextRocketAt ? '' : ` ${((nextRocketAt - now) / 1000).toFixed(1)}с`) : '';
  hbBombEl.textContent = bombAmmo > 0 ? ` ×${bombAmmo}` : '';
  diffEl.textContent = `Сложность ×${diffMul.toFixed(2)}`;

  // компас к выходу: стрелка крутится относительно взгляда
  if (exitTile) {
    const fdir = new THREE.Vector3();
    camera.getWorldDirection(fdir);
    const heading = Math.atan2(fdir.x, fdir.z);
    const ex = exitTile.x + 0.5 - camera.position.x;
    const ez = exitTile.y + 0.5 - camera.position.z;
    let rel = Math.atan2(ex, ez) - heading;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
    // знак инвертирован: CSS rotate по часовой, exit справа → стрелка вправо
    compassArrowEl.style.transform = `rotate(${-rel}rad)`;
    compassDistEl.textContent = `${Math.round(Math.hypot(ex, ez))} м`;
  }

  // viewmodel: bob при ходьбе + затухающий recoil; факел мерцает
  vmRecoil += (0 - vmRecoil) * Math.min(1, dt * 12);
  const bob = walking ? Math.sin(walkPhase) * 7 : 0;
  viewmodelEl.style.transform = `translateY(${bob + vmRecoil}px)`;
  torch.intensity = 2.2 + Math.sin(now * 0.012) * 0.2 + (Math.random() - 0.5) * 0.12;
  // мерцание настенных факелов — свет + пульсация пламени-спрайта
  if (world && world.torchLights) {
    for (const L of world.torchLights) L.intensity = L.userData.baseI + (Math.random() - 0.5) * 0.4;
  }
  if (world && world.torchFlames) {
    const fl = 1 + Math.sin(now * 0.02) * 0.12 + (Math.random() - 0.5) * 0.1;
    for (const f of world.torchFlames) f.scale.set(0.32 * fl, 0.42 * (0.9 + fl * 0.15), 1);
  }

  renderer.render(scene, camera);
  if (shakeT > 0) { camera.position.x -= sx; camera.position.y -= sy; camera.position.z -= sz; }
}
animate();
