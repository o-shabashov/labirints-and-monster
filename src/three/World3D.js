import * as THREE from 'three';
import { TILE, isBlockingTile } from '../config/constants.js';
import { flameTexture } from './Textures3D.js';

// Строит 3D-геометрию мира из 2D-сетки лабиринта.
//
// Координаты: 1 тайл = 1 world-unit. Тайл grid[gy][gx] → world-центр
// (gx + 0.5, _, gy + 0.5). Y — вверх. Стены высотой 1, пол на y=0,
// потолок на y=1 (закрытый dungeon).
//
// Стены — единый InstancedMesh (один box-geometry, N инстансов) — это
// держит draw-call'ы низкими даже при сотнях стен.

const WALL_H = 1.0;

function loadPixelTexture(path, repeatX = 1, repeatY = 1) {
  const tex = new THREE.TextureLoader().load(path);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildWorld(scene, grid) {
  const h = grid.length, w = grid[0].length;
  // Все объекты уровня — в одну Group, чтобы при смене уровня снести разом
  // (scene.remove(group)).
  const group = new THREE.Group();
  scene.add(group);

  // ---- Пол ----
  const floorTex = loadPixelTexture('assets/0x72/floor_1.png', w, h);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshLambertMaterial({ map: floorTex }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(w / 2, 0, h / 2);
  group.add(floor);

  // ---- Потолок ----
  const ceilTex = loadPixelTexture('assets/0x72/wall_mid.png', w, h);
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshLambertMaterial({ map: ceilTex, color: 0x6a6a78 }),
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(w / 2, WALL_H, h / 2);
  group.add(ceil);

  // ---- Стены (InstancedMesh) ----
  const wallTex = loadPixelTexture('assets/0x72/wall_mid.png');
  const wallMat = new THREE.MeshLambertMaterial({ map: wallTex });
  const solidMat = new THREE.MeshLambertMaterial({ map: wallTex, color: 0x8090b0 });

  // считаем разрушаемые и solid отдельно — у solid холодный тинт
  let wallCount = 0, solidCount = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = grid[y][x];
      if (t === TILE.WALL) wallCount++;
      else if (t === TILE.SOLID_WALL) solidCount++;
    }
  }

  const box = new THREE.BoxGeometry(1, WALL_H, 1);
  const wallMesh = new THREE.InstancedMesh(box, wallMat, Math.max(1, wallCount));
  const solidMesh = new THREE.InstancedMesh(box, solidMat, Math.max(1, solidCount));
  const m = new THREE.Matrix4();
  // tileKey (ty*w+tx) → {mesh, index} для разрушаемых WALL — чтобы прятать
  // конкретный instance при damageWall.
  const instanceByTile = new Map();
  let wi = 0, si = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = grid[y][x];
      if (!isBlockingTile(t)) continue;
      m.makeTranslation(x + 0.5, WALL_H / 2, y + 0.5);
      if (t === TILE.SOLID_WALL) {
        solidMesh.setMatrixAt(si++, m);
      } else {
        instanceByTile.set(y * w + x, wi);
        wallMesh.setMatrixAt(wi++, m);
      }
    }
  }
  wallMesh.instanceMatrix.needsUpdate = true;
  solidMesh.instanceMatrix.needsUpdate = true;
  group.add(wallMesh);
  group.add(solidMesh);

  // Разрушение: прячем instance (zero-scale матрица) и переводим тайл в
  // FLOOR. grid — общий ref, поэтому коллизия игрока и BFS монстров
  // автоматически видят новый проход. SOLID_WALL не рушится.
  const _zero = new THREE.Matrix4().makeScale(0, 0, 0);
  function damageWall(worldX, worldZ, radius) {
    const r = Math.ceil(radius);
    const cx = Math.floor(worldX), cz = Math.floor(worldZ);
    let changed = false;
    for (let ty = cz - r; ty <= cz + r; ty++) {
      for (let tx = cx - r; tx <= cx + r; tx++) {
        if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
        if (grid[ty][tx] !== TILE.WALL) continue;   // только разрушаемые
        // центр тайла в радиусе взрыва?
        const dx = tx + 0.5 - worldX, dz = ty + 0.5 - worldZ;
        if (dx * dx + dz * dz > radius * radius) continue;
        const idx = instanceByTile.get(ty * w + tx);
        if (idx === undefined) continue;
        wallMesh.setMatrixAt(idx, _zero);
        instanceByTile.delete(ty * w + tx);
        grid[ty][tx] = TILE.FLOOR;
        changed = true;
      }
    }
    if (changed) wallMesh.instanceMatrix.needsUpdate = true;
    return changed;
  }

  // ---- Факелы по карте: свет + светящийся орб на стенах ----
  // Кандидаты — floor-тайлы, примыкающие к стене. Берём с минимальным
  // расстоянием между факелами, чтобы свет был распределён, а не кучей.
  const torchCands = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (grid[y][x] !== TILE.FLOOR) continue;
      // сторона со стеной → к ней прижмём орб
      let wallDir = null;
      if (isBlockingTile(grid[y - 1][x])) wallDir = { dx: 0, dz: -1 };
      else if (isBlockingTile(grid[y + 1][x])) wallDir = { dx: 0, dz: 1 };
      else if (isBlockingTile(grid[y][x - 1])) wallDir = { dx: -1, dz: 0 };
      else if (isBlockingTile(grid[y][x + 1])) wallDir = { dx: 1, dz: 0 };
      if (wallDir) torchCands.push({ x, y, wallDir });
    }
  }
  // прорежаем: min расстояние 4 тайла, максимум 14 факелов.
  // Факел = тёмная рукоять (cylinder) на стене + billboard-пламя + свет.
  const torchLights = [];
  const torchFlames = [];
  const flameTex = flameTexture();
  const placed = [];
  for (const c of torchCands) {
    if (placed.length >= 14) break;
    if (placed.some(p => Math.hypot(p.x - c.x, p.y - c.y) < 4)) continue;
    if (Math.random() < 0.45) continue;   // разрядим случайно
    placed.push(c);
    const ox = c.x + 0.5 + c.wallDir.dx * 0.4;
    const oz = c.y + 0.5 + c.wallDir.dz * 0.4;
    // рукоять — короткий тёмный стержень, торчит из стены под углом вверх
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.03, 0.28, 6),
      new THREE.MeshLambertMaterial({ color: 0x3b2a1a }),
    );
    handle.position.set(ox, 0.56, oz);
    handle.rotation.z = -c.wallDir.dx * 0.5;
    handle.rotation.x = c.wallDir.dz * 0.5;
    group.add(handle);
    // пламя — billboard-спрайт над рукоятью
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({
      map: flameTex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    flame.scale.set(0.32, 0.42, 1);
    flame.position.set(ox, 0.74, oz);
    group.add(flame);
    torchFlames.push(flame);
    const light = new THREE.PointLight(0xffa64d, 1.4, 4.8, 1.4);
    light.position.set(ox, 0.74, oz);
    light.userData.baseI = 1.4;
    group.add(light);
    torchLights.push(light);
  }

  // ---- Маркер выхода — светящийся жёлтый столб ----
  let exit = null;
  for (let y = 0; y < h && !exit; y++) {
    for (let x = 0; x < w && !exit; x++) {
      if (grid[y][x] === TILE.EXIT) exit = { x, y };
    }
  }
  if (exit) {
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, WALL_H, 12),
      new THREE.MeshBasicMaterial({ color: 0xffd54f }),
    );
    pillar.position.set(exit.x + 0.5, WALL_H / 2, exit.y + 0.5);
    group.add(pillar);
    const exitLight = new THREE.PointLight(0xffd54f, 1.4, 5);
    exitLight.position.set(exit.x + 0.5, WALL_H * 0.7, exit.y + 0.5);
    group.add(exitLight);
  }

  return { group, wallMesh, solidMesh, exit, damageWall, torchLights, torchFlames };
}
