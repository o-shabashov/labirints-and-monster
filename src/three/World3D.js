import * as THREE from 'three';
import { TILE, isBlockingTile } from '../config/constants.js';

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

  // ---- Пол ----
  const floorTex = loadPixelTexture('assets/0x72/floor_1.png', w, h);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshLambertMaterial({ map: floorTex }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(w / 2, 0, h / 2);
  scene.add(floor);

  // ---- Потолок ----
  const ceilTex = loadPixelTexture('assets/0x72/wall_mid.png', w, h);
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshLambertMaterial({ map: ceilTex, color: 0x6a6a78 }),
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(w / 2, WALL_H, h / 2);
  scene.add(ceil);

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
  let wi = 0, si = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = grid[y][x];
      if (!isBlockingTile(t)) continue;
      m.makeTranslation(x + 0.5, WALL_H / 2, y + 0.5);
      if (t === TILE.SOLID_WALL) solidMesh.setMatrixAt(si++, m);
      else wallMesh.setMatrixAt(wi++, m);
    }
  }
  wallMesh.instanceMatrix.needsUpdate = true;
  solidMesh.instanceMatrix.needsUpdate = true;
  scene.add(wallMesh);
  scene.add(solidMesh);

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
    scene.add(pillar);
    const exitLight = new THREE.PointLight(0xffd54f, 1.4, 5);
    exitLight.position.set(exit.x + 0.5, WALL_H * 0.7, exit.y + 0.5);
    scene.add(exitLight);
  }

  return { floor, wallMesh, solidMesh, exit };
}
