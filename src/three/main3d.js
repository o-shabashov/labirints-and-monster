import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { generateMaze } from '../world/MazeGenerator.js';
import { GRID_W, GRID_H } from '../config/constants.js';
import { buildWorld } from './World3D.js';
import { FpsControls } from './FpsControls.js';

const EYE_H = 0.55;

const canvas = document.getElementById('c');
const overlay = document.getElementById('overlay');
const crosshair = document.getElementById('crosshair');

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
buildWorld(scene, grid);

// спавн на entrance
let spawn = { x: 1.5, y: 1.5 };
for (let y = 0; y < GRID_H; y++) {
  for (let x = 0; x < GRID_W; x++) {
    if (grid[y][x] === 2 /* TILE.ENTRANCE */) spawn = { x: x + 0.5, y: y + 0.5 };
  }
}
camera.position.set(spawn.x, EYE_H, spawn.y);

// ---- Управление ----
const controls = new PointerLockControls(camera, document.body);
const fps = new FpsControls(camera, grid);

overlay.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => {
  overlay.style.display = 'none';
  crosshair.style.display = 'block';
});
controls.addEventListener('unlock', () => {
  overlay.style.display = 'flex';
  crosshair.style.display = 'none';
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
  if (controls.isLocked) fps.update(dt);
  torch.position.copy(camera.position);
  renderer.render(scene, camera);
}
animate();
