# Top-down Maze Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Браузерная top-down игра на Phaser 3: процедурный лабиринт, монстры, twin-stick стрельба, fog of war, поддержка Xbox-геймпада. Разработка идёт по 14 этапам — каждый даёт играбельный билд.

**Architecture:** Двуслойная модель мира (логическая tile-сетка + физические AABB-стены Phaser arcade). Унифицированный слой ввода (клавиатура+мышь+gamepad → один объект). Монстры pathfinding'ятся через BFS по логической сетке. Fog of war — Graphics-маска поверх сцены. Без сборщика, ES-модули в браузере, Node `node:test` для unit-тестов чистой логики.

**Tech Stack:** Phaser 3 (CDN) · Vanilla ES modules · `node:test` (встроенный test runner Node ≥18) · Python http.server для dev.

**Spec:** [docs/superpowers/specs/2026-05-23-maze-monsters-design.md](../specs/2026-05-23-maze-monsters-design.md)

---

## Соглашения

- **Запуск игры**: `python3 -m http.server 8080` из корня репо, открыть `http://localhost:8080/`.
- **Запуск тестов**: `node --test tests/` (тесты — отдельные `.test.js` файлы, работают через ESM, проект `package.json` помечается `"type": "module"`).
- **Сообщения коммитов**: conventional style (`feat:`, `test:`, `chore:`, `refactor:`). По одному коммиту на завершённый этап (или промежуточный шаг внутри сложного этапа).
- **Все пути от корня репо** `/Users/mooncake/labirints-and-monster/`.
- **Manual verification** после каждого этапа: открыть в браузере и проверить чек-лист. Если что-то не работает — фикс, потом commit.

---

## Task 0: Скелет проекта

**Цель:** запускающаяся Phaser-сцена с цветным фоном.

**Files:**
- Create: `index.html`
- Create: `package.json`
- Create: `src/main.js`
- Create: `src/scenes/GameScene.js`
- Create: `src/config/constants.js`

- [ ] **Step 1: Создать `package.json` для ESM-режима и тестов**

`package.json`:
```json
{
  "name": "labirints-and-monster",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "python3 -m http.server 8080",
    "test": "node --test tests/"
  }
}
```

- [ ] **Step 2: Создать `src/config/constants.js`**

```js
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
```

- [ ] **Step 3: Создать `src/scenes/GameScene.js` — пустая сцена**

```js
import { GAME_W, GAME_H, COLOR } from '../config/constants.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }
  create() {
    this.cameras.main.setBackgroundColor(COLOR.BG);
    this.add.text(GAME_W / 2, GAME_H / 2, 'GameScene', {
      fontFamily: 'monospace', fontSize: '24px', color: '#4ec9ff',
    }).setOrigin(0.5);
  }
}
```

- [ ] **Step 4: Создать `src/main.js`**

```js
import { GameScene } from './scenes/GameScene.js';
import { GAME_W, GAME_H } from './config/constants.js';

const config = {
  type: Phaser.AUTO,
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#111418',
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [GameScene],
};

new Phaser.Game(config);
```

- [ ] **Step 5: Создать `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Labirints and Monster</title>
  <style>
    html, body { margin: 0; padding: 0; background: #0a0d10; height: 100%; }
    body { display: flex; align-items: center; justify-content: center; }
    canvas { image-rendering: pixelated; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js"></script>
</head>
<body>
  <div id="game"></div>
  <script type="module" src="./src/main.js"></script>
</body>
</html>
```

- [ ] **Step 6: Manual verification**

Run: `python3 -m http.server 8080`
Open: `http://localhost:8080/`
Expected:
- Тёмный фон.
- В центре синяя надпись «GameScene».
- В DevTools Console — никаких ошибок.

- [ ] **Step 7: Commit**

```sh
git add package.json index.html src/
git commit -m "feat(stage-0): bootstrap Phaser scene with dark background"
```

---

## Task 1: Фиксированный лабиринт + игрок

**Цель:** игрок ходит по захардкоженной сетке, стены непроходимы.

**Files:**
- Create: `src/world/TileMap.js`
- Create: `src/entities/Player.js`
- Modify: `src/scenes/GameScene.js`
- Modify: `src/config/constants.js` (добавить PLAYER_SIZE)

- [ ] **Step 1: Добавить `PLAYER_SIZE` в `src/config/constants.js`**

В конец файла:
```js
export const PLAYER_SIZE = 20;  // меньше тайла, чтобы пролезать в коридоры
```

- [ ] **Step 2: Сгенерировать программно текстуру стены и пола в `BootScene`**

Сначала создаём `src/scenes/BootScene.js`:
```js
import { TILE_SIZE, PLAYER_SIZE, COLOR } from '../config/constants.js';

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

    // player
    g.fillStyle(COLOR.PLAYER, 1);
    g.fillRect(0, 0, PLAYER_SIZE, PLAYER_SIZE);
    g.lineStyle(2, 0xffffff, 1);
    g.strokeRect(1, 1, PLAYER_SIZE - 2, PLAYER_SIZE - 2);
    g.generateTexture('player', PLAYER_SIZE, PLAYER_SIZE);
    g.destroy();

    this.scene.start('GameScene');
  }
}
```

- [ ] **Step 3: Подключить `BootScene` в `src/main.js`**

Заменить scene-массив:
```js
import { BootScene } from './scenes/BootScene.js';
// ...
scene: [BootScene, GameScene],
```

- [ ] **Step 4: Создать `src/world/TileMap.js`**

```js
import { TILE_SIZE, TILE } from '../config/constants.js';

export class TileMap {
  constructor(scene, tiles) {
    this.scene = scene;
    this.tiles = tiles;  // tiles[y][x]
    this.height = tiles.length;
    this.width = tiles[0].length;
    this.walls = scene.physics.add.staticGroup();
    this.render();
  }

  render() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const px = x * TILE_SIZE + TILE_SIZE / 2;
        const py = y * TILE_SIZE + TILE_SIZE / 2;
        const t = this.tiles[y][x];
        if (t === TILE.WALL) {
          this.walls.create(px, py, 'wall').refreshBody();
        } else {
          this.scene.add.image(px, py, 'floor');
        }
      }
    }
  }

  isWall(x, y) {
    if (y < 0 || y >= this.height || x < 0 || x >= this.width) return true;
    return this.tiles[y][x] === TILE.WALL;
  }

  tileToWorld(x, y) {
    return {
      x: x * TILE_SIZE + TILE_SIZE / 2,
      y: y * TILE_SIZE + TILE_SIZE / 2,
    };
  }
}
```

- [ ] **Step 5: Создать `src/entities/Player.js`**

```js
import { PLAYER_SPEED } from '../config/constants.js';

export class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.sprite = scene.physics.add.sprite(x, y, 'player');
    this.sprite.setCollideWorldBounds(true);
  }

  update(input) {
    const body = this.sprite.body;
    body.setVelocity(input.move.x * PLAYER_SPEED, input.move.y * PLAYER_SPEED);
  }
}
```

- [ ] **Step 6: Hardcoded тестовый лабиринт + интеграция в `GameScene`**

Перепишем `src/scenes/GameScene.js`:
```js
import { TILE, TILE_SIZE, GRID_W, GRID_H } from '../config/constants.js';
import { TileMap } from '../world/TileMap.js';
import { Player } from '../entities/Player.js';

function makeFixedMaze() {
  // простая рамка + несколько перегородок
  const t = [];
  for (let y = 0; y < GRID_H; y++) {
    const row = [];
    for (let x = 0; x < GRID_W; x++) {
      const isBorder = x === 0 || y === 0 || x === GRID_W - 1 || y === GRID_H - 1;
      row.push(isBorder ? TILE.WALL : TILE.FLOOR);
    }
    t.push(row);
  }
  // две вертикальные перегородки с проёмами
  for (let y = 1; y < GRID_H - 1; y++) {
    if (y !== 5) t[y][10] = TILE.WALL;
    if (y !== 15) t[y][20] = TILE.WALL;
  }
  return t;
}

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.map = new TileMap(this, makeFixedMaze());
    const spawn = this.map.tileToWorld(2, 2);
    this.player = new Player(this, spawn.x, spawn.y);
    this.physics.add.collider(this.player.sprite, this.map.walls);

    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT');
  }

  update() {
    // временный inline-ввод, заменим в Task 5
    const k = this.keys;
    const move = { x: 0, y: 0 };
    if (k.A.isDown || k.LEFT.isDown) move.x = -1;
    else if (k.D.isDown || k.RIGHT.isDown) move.x = 1;
    if (k.W.isDown || k.UP.isDown) move.y = -1;
    else if (k.S.isDown || k.DOWN.isDown) move.y = 1;
    const len = Math.hypot(move.x, move.y);
    if (len > 0) { move.x /= len; move.y /= len; }

    this.player.update({ move });
  }
}
```

- [ ] **Step 7: Manual verification**

Run: `python3 -m http.server 8080` (если ещё не запущен).
Open: `http://localhost:8080/`
Expected:
- Виден лабиринт: внешняя рамка стен, две внутренние перегородки.
- Игрок-синий квадрат стоит в (2,2).
- WASD и стрелки двигают игрока.
- В стены не пройти, граница не пересекается.
- Диагональное движение не быстрее по осей (нормализовано).

- [ ] **Step 8: Commit**

```sh
git add src/
git commit -m "feat(stage-1): tilemap rendering, WASD player movement, AABB collisions"
```

---

## Task 2: Вход, выход, Victory scene

**Цель:** игрок спавнится на ENTRANCE, касается EXIT → переход в VictoryScene с кнопкой «Заново».

**Files:**
- Modify: `src/scenes/BootScene.js` (текстуры entrance/exit)
- Modify: `src/world/TileMap.js` (рендер entrance/exit + поиск spawn)
- Modify: `src/scenes/GameScene.js` (overlap с exit)
- Create: `src/scenes/VictoryScene.js`
- Modify: `src/main.js` (зарегистрировать VictoryScene)

- [ ] **Step 1: Добавить текстуры `entrance` и `exit` в `BootScene.create()`**

После `floor`:
```js
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
```

- [ ] **Step 2: TileMap рендерит entrance/exit + ищет их позицию**

Заменить `render()` в `src/world/TileMap.js`:
```js
render() {
  this.entrance = null;
  this.exit = null;
  for (let y = 0; y < this.height; y++) {
    for (let x = 0; x < this.width; x++) {
      const px = x * TILE_SIZE + TILE_SIZE / 2;
      const py = y * TILE_SIZE + TILE_SIZE / 2;
      const t = this.tiles[y][x];
      if (t === TILE.WALL) {
        this.walls.create(px, py, 'wall').refreshBody();
        continue;
      }
      this.scene.add.image(px, py, 'floor');
      if (t === TILE.ENTRANCE) {
        this.scene.add.image(px, py, 'entrance');
        this.entrance = { x, y };
      } else if (t === TILE.EXIT) {
        this.scene.add.image(px, py, 'exit');
        this.exit = { x, y };
      }
    }
  }
}
```

- [ ] **Step 3: Обновить hardcoded maze — добавить вход и выход**

В `GameScene.makeFixedMaze`, после строки `t.push(row);` (внутри двух циклов всё ок), а в конце функции до `return t;`:
```js
t[2][2] = TILE.ENTRANCE;
t[18][28] = TILE.EXIT;
```

- [ ] **Step 4: Создать `src/scenes/VictoryScene.js`**

```js
import { GAME_W, GAME_H } from '../config/constants.js';

export class VictoryScene extends Phaser.Scene {
  constructor() {
    super('VictoryScene');
  }

  create(data) {
    this.cameras.main.setBackgroundColor(0x102010);
    this.add.text(GAME_W / 2, GAME_H / 2 - 40, 'Победа!', {
      fontFamily: 'monospace', fontSize: '48px', color: '#66bb6a',
    }).setOrigin(0.5);

    this.add.text(GAME_W / 2, GAME_H / 2 + 20, 'Нажми ПРОБЕЛ для рестарта', {
      fontFamily: 'monospace', fontSize: '18px', color: '#dddddd',
    }).setOrigin(0.5);

    this.input.keyboard.once('keydown-SPACE', () => {
      this.scene.start('GameScene');
    });
  }
}
```

- [ ] **Step 5: Зарегистрировать VictoryScene**

В `src/main.js`:
```js
import { VictoryScene } from './scenes/VictoryScene.js';
// ...
scene: [BootScene, GameScene, VictoryScene],
```

- [ ] **Step 6: GameScene: спавн на entrance, overlap с exit**

В `GameScene.create()` заменить блок spawn:
```js
this.map = new TileMap(this, makeFixedMaze());
const e = this.map.entrance;
const spawn = this.map.tileToWorld(e.x, e.y);
this.player = new Player(this, spawn.x, spawn.y);
this.physics.add.collider(this.player.sprite, this.map.walls);

const exitPos = this.map.tileToWorld(this.map.exit.x, this.map.exit.y);
this.exitZone = this.add.zone(exitPos.x, exitPos.y, TILE_SIZE, TILE_SIZE);
this.physics.add.existing(this.exitZone, true);
this.physics.add.overlap(this.player.sprite, this.exitZone, () => {
  this.scene.start('VictoryScene');
});
```

Не забыть импорт: `import { TILE_SIZE, TILE } from '../config/constants.js';` (уже есть).

- [ ] **Step 7: Manual verification**

Open: `http://localhost:8080/` (перезагрузить).
Expected:
- Игрок появляется на зелёной клетке (entrance) в (2,2).
- В правом нижнем углу — жёлтая клетка (exit).
- Дойти до выхода → экран «Победа!».
- Пробел → рестарт игры.

- [ ] **Step 8: Commit**

```sh
git add src/
git commit -m "feat(stage-2): entrance, exit and victory scene"
```

---

## Task 3: Процедурная генерация лабиринта

**Цель:** при каждом запуске — новый лабиринт через recursive backtracker. Вход — random leaf у края, выход — BFS-furthest leaf.

**Files:**
- Create: `src/world/MazeGenerator.js`
- Create: `tests/MazeGenerator.test.js`
- Modify: `src/scenes/GameScene.js` (использовать генератор вместо hardcoded)

- [ ] **Step 1: Тест — генератор возвращает массив правильного размера**

`tests/MazeGenerator.test.js`:
```js
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { generateMaze } from '../src/world/MazeGenerator.js';
import { TILE } from '../src/config/constants.js';

test('generateMaze: returns 2D grid of given size', () => {
  const grid = generateMaze(31, 21, 42);
  assert.equal(grid.length, 21);
  assert.equal(grid[0].length, 31);
});

test('generateMaze: borders are all walls', () => {
  const grid = generateMaze(31, 21, 42);
  for (let x = 0; x < 31; x++) {
    assert.equal(grid[0][x], TILE.WALL, `top row x=${x}`);
    assert.equal(grid[20][x], TILE.WALL, `bottom row x=${x}`);
  }
  for (let y = 0; y < 21; y++) {
    assert.equal(grid[y][0], TILE.WALL, `left col y=${y}`);
    assert.equal(grid[y][30], TILE.WALL, `right col y=${y}`);
  }
});

test('generateMaze: contains exactly one ENTRANCE and one EXIT', () => {
  const grid = generateMaze(31, 21, 42);
  let e = 0, x = 0;
  for (const row of grid) for (const t of row) {
    if (t === TILE.ENTRANCE) e++;
    if (t === TILE.EXIT) x++;
  }
  assert.equal(e, 1);
  assert.equal(x, 1);
});

test('generateMaze: all floor cells are reachable from entrance', () => {
  const grid = generateMaze(31, 21, 42);
  // find entrance
  let sx = -1, sy = -1;
  for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid[0].length; x++) {
    if (grid[y][x] === TILE.ENTRANCE) { sx = x; sy = y; }
  }
  // BFS
  const visited = Array.from({ length: grid.length }, () => new Array(grid[0].length).fill(false));
  const queue = [[sx, sy]];
  visited[sy][sx] = true;
  let reachable = 1;
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= grid[0].length || ny >= grid.length) continue;
      if (visited[ny][nx]) continue;
      if (grid[ny][nx] === TILE.WALL) continue;
      visited[ny][nx] = true;
      reachable++;
      queue.push([nx, ny]);
    }
  }
  // подсчёт всех non-wall клеток
  let nonWall = 0;
  for (const row of grid) for (const t of row) if (t !== TILE.WALL) nonWall++;
  assert.equal(reachable, nonWall, 'all non-wall cells must be reachable from entrance');
});

test('generateMaze: same seed -> same maze', () => {
  const a = generateMaze(31, 21, 1234);
  const b = generateMaze(31, 21, 1234);
  assert.deepEqual(a, b);
});
```

- [ ] **Step 2: Запустить тесты — должны падать (модуль ещё не существует)**

Run: `node --test tests/`
Expected: FAIL — `Cannot find module '../src/world/MazeGenerator.js'`

- [ ] **Step 3: Реализовать `src/world/MazeGenerator.js`**

```js
import { TILE } from '../config/constants.js';

// детерминированный PRNG (mulberry32)
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Recursive backtracker:
// сетка ячеек размера (w-1)/2 × (h-1)/2; между ячейками — клетки-стены.
// "Прокладываем" из (1,1) с шагом 2.
function carve(grid, w, h, seed) {
  const rand = rng(seed);
  const stack = [[1, 1]];
  grid[1][1] = TILE.FLOOR;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const dirs = shuffle([[2,0],[-2,0],[0,2],[0,-2]], rand);
    let carved = false;
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (nx <= 0 || ny <= 0 || nx >= w - 1 || ny >= h - 1) continue;
      if (grid[ny][nx] !== TILE.WALL) continue;
      grid[ny][nx] = TILE.FLOOR;
      grid[y + dy / 2][x + dx / 2] = TILE.FLOOR;
      stack.push([nx, ny]);
      carved = true;
      break;
    }
    if (!carved) stack.pop();
  }
}

function bfsDistances(grid, sx, sy) {
  const h = grid.length, w = grid[0].length;
  const dist = Array.from({ length: h }, () => new Array(w).fill(-1));
  dist[sy][sx] = 0;
  const queue = [[sx, sy]];
  let head = 0;
  while (head < queue.length) {
    const [x, y] = queue[head++];
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (grid[ny][nx] === TILE.WALL) continue;
      if (dist[ny][nx] !== -1) continue;
      dist[ny][nx] = dist[y][x] + 1;
      queue.push([nx, ny]);
    }
  }
  return dist;
}

export function generateMaze(width, height, seed = Date.now()) {
  if (width % 2 === 0) width++;
  if (height % 2 === 0) height++;
  const grid = Array.from({ length: height }, () => new Array(width).fill(TILE.WALL));
  carve(grid, width, height, seed);

  // Найти все leaf-floor-клетки у края (которые соединяются с рамкой).
  // Простая стратегия: вход — клетка (1,1), выход — клетка с максимальным BFS-расстоянием от входа.
  const sx = 1, sy = 1;
  grid[sy][sx] = TILE.ENTRANCE;
  const dist = bfsDistances(grid, sx, sy);
  let bestX = sx, bestY = sy, bestD = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (dist[y][x] > bestD) {
        bestD = dist[y][x];
        bestX = x;
        bestY = y;
      }
    }
  }
  grid[bestY][bestX] = TILE.EXIT;
  return grid;
}
```

- [ ] **Step 4: Запустить тесты — должны пройти**

Run: `node --test tests/`
Expected: PASS — все 5 тестов зелёные.

- [ ] **Step 5: Интегрировать генератор в `GameScene`**

В `src/scenes/GameScene.js`:
- Удалить функцию `makeFixedMaze`.
- Импортировать: `import { generateMaze } from '../world/MazeGenerator.js';`
- Заменить `new TileMap(this, makeFixedMaze())` на:
```js
const seed = Date.now();
this.map = new TileMap(this, generateMaze(GRID_W, GRID_H, seed));
```
- Добавить импорт `GRID_W, GRID_H` если ещё нет.

- [ ] **Step 6: Manual verification**

Reload `http://localhost:8080/`.
Expected:
- Каждый F5 — новый лабиринт.
- Игрок спавнится на зелёной (entrance) клетке.
- Выход в самом «дальнем» углу лабиринта (не виден сразу из спавна).
- Все коридоры однопроходны, нет циклов (perfect maze).
- Можно пройти от входа до выхода → Victory.

- [ ] **Step 7: Commit**

```sh
git add src/ tests/
git commit -m "feat(stage-3): procedural maze generation (recursive backtracker)"
```

---

## Task 4: Fog of War

**Цель:** видимость ограничена кругом ~5 тайлов вокруг игрока, explored клетки запоминаются и показываются приглушённо.

**Files:**
- Create: `src/world/FogOfWar.js`
- Modify: `src/config/constants.js` (добавить VISION_RADIUS_TILES)
- Modify: `src/scenes/GameScene.js`

- [ ] **Step 1: Добавить константу**

В `src/config/constants.js`:
```js
export const VISION_RADIUS_TILES = 5;
```

- [ ] **Step 2: Создать `src/world/FogOfWar.js`**

```js
import { TILE_SIZE, GAME_W, GAME_H, VISION_RADIUS_TILES } from '../config/constants.js';

export class FogOfWar {
  constructor(scene, gridW, gridH) {
    this.scene = scene;
    this.gridW = gridW;
    this.gridH = gridH;
    this.explored = Array.from({ length: gridH }, () => new Array(gridW).fill(false));

    // dim layer over explored cells
    this.dim = scene.add.graphics();
    this.dim.setDepth(10);

    // black overlay with circular hole (visibility mask)
    this.fog = scene.add.graphics();
    this.fog.setDepth(11);

    this.radiusPx = VISION_RADIUS_TILES * TILE_SIZE;
  }

  update(playerX, playerY) {
    // mark explored tiles within current vision
    const tx = Math.floor(playerX / TILE_SIZE);
    const ty = Math.floor(playerY / TILE_SIZE);
    const r = VISION_RADIUS_TILES;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const x = tx + dx, y = ty + dy;
        if (x < 0 || y < 0 || x >= this.gridW || y >= this.gridH) continue;
        this.explored[y][x] = true;
      }
    }

    // dim: explored-but-out-of-vision -> grey 40%, unexplored -> rendered by fog
    this.dim.clear();
    this.dim.fillStyle(0x000000, 0.55);
    for (let y = 0; y < this.gridH; y++) {
      for (let x = 0; x < this.gridW; x++) {
        if (!this.explored[y][x]) continue;
        const cx = x * TILE_SIZE + TILE_SIZE / 2;
        const cy = y * TILE_SIZE + TILE_SIZE / 2;
        const dxp = cx - playerX, dyp = cy - playerY;
        if (dxp * dxp + dyp * dyp > this.radiusPx * this.radiusPx) {
          this.dim.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }

    // fog: solid black over unexplored cells (also covers far area)
    this.fog.clear();
    this.fog.fillStyle(0x000000, 1);
    for (let y = 0; y < this.gridH; y++) {
      for (let x = 0; x < this.gridW; x++) {
        if (this.explored[y][x]) continue;
        this.fog.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }
}
```

- [ ] **Step 3: Подключить FogOfWar в GameScene**

В `src/scenes/GameScene.js`:
- Импорт: `import { FogOfWar } from '../world/FogOfWar.js';`
- В конце `create()`:
```js
this.fog = new FogOfWar(this, GRID_W, GRID_H);
this.player.sprite.setDepth(5);  // под маской, но над полом
```
- В `update()` после `this.player.update(...)`:
```js
this.fog.update(this.player.sprite.x, this.player.sprite.y);
```

- [ ] **Step 4: Manual verification**

Reload.
Expected:
- Видим только круг вокруг игрока, остальное чёрное.
- При движении круг едет с игроком.
- Где побывал — серое полупрозрачное (запомнено), но не полностью видно.
- Выход не виден из спавна — только если подойти близко.

- [ ] **Step 5: Commit**

```sh
git add src/
git commit -m "feat(stage-4): fog of war with explored memory"
```

---

## Task 5: Унифицированный ввод (клавиатура+мышь+gamepad)

**Цель:** заменить inline-ввод в GameScene на унифицированный `Input` слой, поддержать Xbox-геймпад.

**Files:**
- Create: `src/systems/Input.js`
- Create: `tests/Input.test.js`
- Modify: `src/scenes/GameScene.js`

- [ ] **Step 1: Тест чистых функций ввода (deadzone, normalize)**

`tests/Input.test.js`:
```js
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { applyDeadzone, normalizeMove } from '../src/systems/Input.js';

test('applyDeadzone: zero inside deadzone', () => {
  assert.deepEqual(applyDeadzone({ x: 0.1, y: 0.05 }, 0.15), { x: 0, y: 0 });
});

test('applyDeadzone: passthrough outside deadzone', () => {
  const r = applyDeadzone({ x: 0.5, y: 0 }, 0.15);
  assert.ok(Math.abs(r.x - 0.5) < 0.001);
  assert.equal(r.y, 0);
});

test('applyDeadzone: respects magnitude (radial deadzone)', () => {
  // sqrt(0.1^2 + 0.1^2) ≈ 0.141 < 0.15 -> zero
  assert.deepEqual(applyDeadzone({ x: 0.1, y: 0.1 }, 0.15), { x: 0, y: 0 });
});

test('normalizeMove: diagonal stays unit length', () => {
  const r = normalizeMove({ x: 1, y: 1 });
  const len = Math.hypot(r.x, r.y);
  assert.ok(Math.abs(len - 1) < 0.001);
});

test('normalizeMove: zero stays zero', () => {
  assert.deepEqual(normalizeMove({ x: 0, y: 0 }), { x: 0, y: 0 });
});
```

- [ ] **Step 2: Запустить тесты — должны падать**

Run: `node --test tests/Input.test.js`
Expected: FAIL — Cannot find module.

- [ ] **Step 3: Реализовать `src/systems/Input.js`**

```js
export function applyDeadzone(v, dz) {
  const m = Math.hypot(v.x, v.y);
  if (m < dz) return { x: 0, y: 0 };
  return v;
}

export function normalizeMove(v) {
  const m = Math.hypot(v.x, v.y);
  if (m === 0) return { x: 0, y: 0 };
  if (m <= 1) return { x: v.x, y: v.y };
  return { x: v.x / m, y: v.y / m };
}

const STICK_DEADZONE_MOVE = 0.15;
const STICK_DEADZONE_AIM = 0.20;
const GAMEPAD_IDLE_TIMEOUT_MS = 500;

export class Input {
  constructor(scene) {
    this.scene = scene;
    this.keys = scene.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,SPACE,E,ESC');
    this.mouse = scene.input.activePointer;

    this.prev = {
      dash: false, interact: false, pause: false, shootEdge: false,
    };
    this.lastGamepadActivity = 0;
    this.activeDevice = 'keyboard';
  }

  read() {
    // ---- keyboard + mouse ----
    const k = this.keys;
    let kbMove = { x: 0, y: 0 };
    if (k.A.isDown || k.LEFT.isDown) kbMove.x = -1;
    else if (k.D.isDown || k.RIGHT.isDown) kbMove.x = 1;
    if (k.W.isDown || k.UP.isDown) kbMove.y = -1;
    else if (k.S.isDown || k.DOWN.isDown) kbMove.y = 1;
    kbMove = normalizeMove(kbMove);

    // mouse aim relative to player (set externally via setAimOrigin)
    let mAim = null;
    if (this.aimOrigin) {
      const dx = this.mouse.worldX - this.aimOrigin.x;
      const dy = this.mouse.worldY - this.aimOrigin.y;
      const m = Math.hypot(dx, dy);
      if (m > 1) mAim = { x: dx / m, y: dy / m };
    }
    const mShoot = this.mouse.isDown;
    const kbSprint = k.SHIFT.isDown;
    const kbDash = k.SPACE.isDown;
    const kbInteract = k.E.isDown;
    const kbPause = k.ESC.isDown;

    // ---- gamepad (standard mapping, first connected) ----
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) { if (p) { gp = p; break; } }

    let gpMove = { x: 0, y: 0 };
    let gpAim = null;
    let gpSprint = false, gpDash = false, gpShoot = false, gpInteract = false, gpPause = false;

    if (gp) {
      gpMove = applyDeadzone({ x: gp.axes[0] || 0, y: gp.axes[1] || 0 }, STICK_DEADZONE_MOVE);
      gpMove = normalizeMove(gpMove);
      const aim = applyDeadzone({ x: gp.axes[2] || 0, y: gp.axes[3] || 0 }, STICK_DEADZONE_AIM);
      if (aim.x !== 0 || aim.y !== 0) {
        const m = Math.hypot(aim.x, aim.y);
        gpAim = { x: aim.x / m, y: aim.y / m };
        gpShoot = true; // авто-fire при отклонённом правом стике
      }
      // standard mapping: 0=A, 2=X, 6=LT (axes-like trigger 0..1), 9=Start
      gpDash = !!(gp.buttons[0] && gp.buttons[0].pressed);
      gpInteract = !!(gp.buttons[2] && gp.buttons[2].pressed);
      gpPause = !!(gp.buttons[9] && gp.buttons[9].pressed);
      gpSprint = !!(gp.buttons[6] && gp.buttons[6].value > 0.2);

      // активность гейпада: ненулевые стики или нажатая кнопка
      const anyBtn = gp.buttons.some(b => b && b.pressed);
      if (anyBtn || gpMove.x !== 0 || gpMove.y !== 0 || gpAim) {
        this.lastGamepadActivity = performance.now();
      }
    }

    if (performance.now() - this.lastGamepadActivity < GAMEPAD_IDLE_TIMEOUT_MS) {
      this.activeDevice = 'gamepad';
    } else {
      this.activeDevice = 'keyboard';
    }

    // ---- combine: gamepad overrides keyboard when present ----
    const move = (gpMove.x !== 0 || gpMove.y !== 0) ? gpMove : kbMove;
    const aim = gpAim || mAim;
    const shoot = gpShoot || mShoot;
    const sprint = gpSprint || kbSprint;
    const dashHeld = gpDash || kbDash;
    const interactHeld = gpInteract || kbInteract;
    const pauseHeld = gpPause || kbPause;

    // edges
    const dash = dashHeld && !this.prev.dash;
    const interact = interactHeld && !this.prev.interact;
    const pause = pauseHeld && !this.prev.pause;
    this.prev.dash = dashHeld;
    this.prev.interact = interactHeld;
    this.prev.pause = pauseHeld;

    return { move, aim, sprint, shoot, dash, interact, pause };
  }

  setAimOrigin(x, y) {
    this.aimOrigin = { x, y };
  }
}
```

- [ ] **Step 4: Запустить тесты — должны пройти**

Run: `node --test tests/`
Expected: PASS — все тесты зелёные (старые + новые).

- [ ] **Step 5: Интегрировать Input в GameScene**

В `src/scenes/GameScene.js`:
- Импорт: `import { Input } from '../systems/Input.js';`
- В `create()` после создания player:
```js
this.inputSys = new Input(this);
```
- Удалить `this.keys = ...`.
- Заменить тело `update()`:
```js
update() {
  this.inputSys.setAimOrigin(this.player.sprite.x, this.player.sprite.y);
  const input = this.inputSys.read();
  this.player.update(input);
  this.fog.update(this.player.sprite.x, this.player.sprite.y);
}
```

- [ ] **Step 6: Manual verification (с подключённым геймпадом)**

Reload.
Expected:
- WASD/стрелки работают как раньше.
- Подключить Xbox геймпад через Bluetooth → нажать любую кнопку (Safari требует) → левый стик двигает игрока.
- Чтобы геймпад заработал в Chromium: открыть `chrome://settings/content/gamepads` если возникнут проблемы.

Edge case test: если оба источника работают одновременно, геймпад берёт верх (приоритет).

- [ ] **Step 7: Commit**

```sh
git add src/ tests/
git commit -m "feat(stage-5): unified input layer (keyboard + mouse + gamepad)"
```

---

## Task 6: Первый монстр (преследователь) + GameOver

**Цель:** монстр-преследователь с BFS-pathfinding'ом, касание = смерть.

**Files:**
- Create: `src/systems/PathFinding.js`
- Create: `tests/PathFinding.test.js`
- Create: `src/entities/Monster.js`
- Create: `src/entities/monsters/Chaser.js`
- Create: `src/scenes/GameOverScene.js`
- Modify: `src/scenes/BootScene.js` (текстура монстра)
- Modify: `src/main.js`
- Modify: `src/scenes/GameScene.js`

- [ ] **Step 1: Тест BFS pathfinding**

`tests/PathFinding.test.js`:
```js
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { bfsNextStep } from '../src/systems/PathFinding.js';
import { TILE } from '../src/config/constants.js';

const W = TILE.WALL, F = TILE.FLOOR;

test('bfsNextStep: straight line returns next tile', () => {
  const grid = [
    [W, W, W, W, W],
    [W, F, F, F, W],
    [W, W, W, W, W],
  ];
  const step = bfsNextStep(grid, 1, 1, 3, 1);
  assert.deepEqual(step, { x: 2, y: 1 });
});

test('bfsNextStep: walks around a wall', () => {
  const grid = [
    [W, W, W, W, W],
    [W, F, W, F, W],
    [W, F, F, F, W],
    [W, W, W, W, W],
  ];
  const step = bfsNextStep(grid, 1, 1, 3, 1);
  // путь: (1,1)->(1,2)->(2,2)->(3,2)->(3,1). next step = (1,2)
  assert.deepEqual(step, { x: 1, y: 2 });
});

test('bfsNextStep: returns null when unreachable', () => {
  const grid = [
    [W, W, W, W, W],
    [W, F, W, F, W],
    [W, W, W, W, W],
  ];
  assert.equal(bfsNextStep(grid, 1, 1, 3, 1), null);
});

test('bfsNextStep: same tile returns null', () => {
  const grid = [[W,W,W],[W,F,W],[W,W,W]];
  assert.equal(bfsNextStep(grid, 1, 1, 1, 1), null);
});
```

- [ ] **Step 2: Запустить — fail**

Run: `node --test tests/PathFinding.test.js`
Expected: FAIL.

- [ ] **Step 3: Реализовать `src/systems/PathFinding.js`**

```js
import { TILE } from '../config/constants.js';

const PASSABLE_DEFAULT = new Set([TILE.FLOOR, TILE.ENTRANCE, TILE.EXIT]);

export function bfsNextStep(grid, sx, sy, tx, ty, passable = PASSABLE_DEFAULT) {
  if (sx === tx && sy === ty) return null;
  const h = grid.length, w = grid[0].length;
  const prev = Array.from({ length: h }, () => new Array(w).fill(null));
  const visited = Array.from({ length: h }, () => new Array(w).fill(false));
  visited[sy][sx] = true;
  const queue = [[sx, sy]];
  let head = 0;
  let found = false;
  while (head < queue.length) {
    const [x, y] = queue[head++];
    if (x === tx && y === ty) { found = true; break; }
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (visited[ny][nx]) continue;
      if (!passable.has(grid[ny][nx])) continue;
      visited[ny][nx] = true;
      prev[ny][nx] = [x, y];
      queue.push([nx, ny]);
    }
  }
  if (!found) return null;
  // walk back to find first step from start
  let cx = tx, cy = ty;
  while (prev[cy][cx] && !(prev[cy][cx][0] === sx && prev[cy][cx][1] === sy)) {
    [cx, cy] = prev[cy][cx];
  }
  return { x: cx, y: cy };
}
```

- [ ] **Step 4: Run tests — pass**

Run: `node --test tests/`
Expected: PASS.

- [ ] **Step 5: Текстура монстра в BootScene**

В `BootScene.create()` перед `this.scene.start`:
```js
// monster
g.fillStyle(COLOR.MONSTER, 1);
g.fillRect(0, 0, PLAYER_SIZE, PLAYER_SIZE);
g.lineStyle(2, 0x000000, 1);
g.strokeRect(1, 1, PLAYER_SIZE - 2, PLAYER_SIZE - 2);
g.generateTexture('monster', PLAYER_SIZE, PLAYER_SIZE);
g.clear();
```

- [ ] **Step 6: Базовый класс `src/entities/Monster.js`**

```js
import { TILE_SIZE } from '../config/constants.js';

export class Monster {
  constructor(scene, x, y, texture = 'monster') {
    this.scene = scene;
    this.sprite = scene.physics.add.sprite(x, y, texture);
    this.sprite.setCollideWorldBounds(true);
    this.repathTimer = 0;
    this.target = null;          // { x, y } в pixel
    this.speed = 100;
  }

  tilePos() {
    return {
      x: Math.floor(this.sprite.x / TILE_SIZE),
      y: Math.floor(this.sprite.y / TILE_SIZE),
    };
  }

  moveToward(target) {
    if (!target) {
      this.sprite.body.setVelocity(0, 0);
      return;
    }
    const dx = target.x - this.sprite.x;
    const dy = target.y - this.sprite.y;
    const d = Math.hypot(dx, dy);
    if (d < 2) {
      this.sprite.body.setVelocity(0, 0);
      return;
    }
    this.sprite.body.setVelocity((dx / d) * this.speed, (dy / d) * this.speed);
  }

  update(_dt, _player, _map) {
    // override
  }
}
```

- [ ] **Step 7: Преследователь `src/entities/monsters/Chaser.js`**

```js
import { Monster } from '../Monster.js';
import { bfsNextStep } from '../../systems/PathFinding.js';
import { TILE_SIZE, PLAYER_SPEED } from '../../config/constants.js';

const REPATH_MS = 250;

export class Chaser extends Monster {
  constructor(scene, x, y) {
    super(scene, x, y);
    this.speed = PLAYER_SPEED * 0.7;
  }

  update(dtMs, player, map) {
    this.repathTimer -= dtMs;
    if (this.repathTimer <= 0 || !this.target) {
      this.repathTimer = REPATH_MS;
      const mt = this.tilePos();
      const pt = {
        x: Math.floor(player.sprite.x / TILE_SIZE),
        y: Math.floor(player.sprite.y / TILE_SIZE),
      };
      const step = bfsNextStep(map.tiles, mt.x, mt.y, pt.x, pt.y);
      if (step) this.target = map.tileToWorld(step.x, step.y);
      else this.target = null;
    }
    // если приехали — стираем target, чтобы пересчитать на следующем тике
    if (this.target) {
      const dx = this.target.x - this.sprite.x;
      const dy = this.target.y - this.sprite.y;
      if (Math.hypot(dx, dy) < 2) this.target = null;
    }
    this.moveToward(this.target);
  }
}
```

- [ ] **Step 8: `src/scenes/GameOverScene.js`**

```js
import { GAME_W, GAME_H } from '../config/constants.js';

export class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOverScene'); }
  create() {
    this.cameras.main.setBackgroundColor(0x201010);
    this.add.text(GAME_W / 2, GAME_H / 2 - 40, 'Вы погибли', {
      fontFamily: 'monospace', fontSize: '48px', color: '#ff5252',
    }).setOrigin(0.5);
    this.add.text(GAME_W / 2, GAME_H / 2 + 20, 'Нажми ПРОБЕЛ для рестарта', {
      fontFamily: 'monospace', fontSize: '18px', color: '#dddddd',
    }).setOrigin(0.5);
    this.input.keyboard.once('keydown-SPACE', () => this.scene.start('GameScene'));
  }
}
```

- [ ] **Step 9: Зарегистрировать GameOverScene в `src/main.js`**

```js
import { GameOverScene } from './scenes/GameOverScene.js';
// ...
scene: [BootScene, GameScene, GameOverScene, VictoryScene],
```

- [ ] **Step 10: Спавн монстра в GameScene**

В `src/scenes/GameScene.js`:
- Импорт: `import { Chaser } from '../entities/monsters/Chaser.js';`
- В `create()` после игрока, найти случайную FLOOR-клетку далеко от entrance:
```js
this.monsters = [];
{
  const minDistTiles = 8;
  const candidates = [];
  for (let y = 1; y < GRID_H - 1; y++) {
    for (let x = 1; x < GRID_W - 1; x++) {
      if (this.map.tiles[y][x] !== TILE.FLOOR) continue;
      const dx = x - this.map.entrance.x;
      const dy = y - this.map.entrance.y;
      if (Math.hypot(dx, dy) >= minDistTiles) candidates.push({ x, y });
    }
  }
  // 3 монстра-преследователя на этом этапе
  for (let i = 0; i < 3 && candidates.length; i++) {
    const idx = Math.floor(Math.random() * candidates.length);
    const c = candidates.splice(idx, 1)[0];
    const w = this.map.tileToWorld(c.x, c.y);
    const m = new Chaser(this, w.x, w.y);
    this.physics.add.collider(m.sprite, this.map.walls);
    this.physics.add.overlap(this.player.sprite, m.sprite, () => {
      this.scene.start('GameOverScene');
    });
    this.monsters.push(m);
  }
}
```
- В `update(_, delta)` (Phaser передаёт `time, delta` — добавить параметры) после fog:
```js
update(_time, delta) {
  this.inputSys.setAimOrigin(this.player.sprite.x, this.player.sprite.y);
  const input = this.inputSys.read();
  this.player.update(input);
  for (const m of this.monsters) m.update(delta, this.player, this.map);
  this.fog.update(this.player.sprite.x, this.player.sprite.y);
}
```

- [ ] **Step 11: Manual verification**

Reload.
Expected:
- На карте 3 красных монстра в случайных дальних клетках.
- Под fog of war их сначала не видно, но они вас находят.
- Касание любого монстра → экран «Вы погибли». Пробел → рестарт.

- [ ] **Step 12: Commit**

```sh
git add src/ tests/
git commit -m "feat(stage-6): chaser monsters with BFS pathfinding, game over scene"
```

---

## Task 7: HP, i-frames, knockback, аптечки

**Цель:** игрок не умирает с одного касания (HP=3), есть невосприимчивость к повторному урону, аптечки в тупиках восстанавливают HP. UIScene показывает HP.

**Files:**
- Create: `src/systems/Combat.js`
- Create: `src/scenes/UIScene.js`
- Create: `src/entities/Pickup.js`
- Modify: `src/config/constants.js`
- Modify: `src/entities/Player.js`
- Modify: `src/scenes/BootScene.js`
- Modify: `src/scenes/GameScene.js`
- Modify: `src/main.js`

- [ ] **Step 1: Константы**

В `src/config/constants.js`:
```js
export const PLAYER_MAX_HP = 3;
export const KNOCKBACK_SPEED = 220;
export const KNOCKBACK_MS = 200;
export const IFRAMES_MS = 400;
```

- [ ] **Step 2: Текстуры pickup**

В `BootScene.create()`:
```js
// pickup: heart
g.fillStyle(0xff5252, 1);
g.fillCircle(8, 8, 6);
g.generateTexture('pickup_heart', 16, 16);
g.clear();
```

- [ ] **Step 3: `src/entities/Pickup.js`**

```js
export const PICKUP_TYPE = {
  HEART: 'heart',
};

export class Pickup {
  constructor(scene, x, y, type) {
    this.type = type;
    const tex = type === PICKUP_TYPE.HEART ? 'pickup_heart' : 'pickup_heart';
    this.sprite = scene.physics.add.sprite(x, y, tex);
    this.sprite.body.setAllowGravity(false);
    this.sprite.body.setImmovable(true);
    this.sprite.pickupRef = this;
  }
}
```

- [ ] **Step 4: Combat-система — `src/systems/Combat.js`**

```js
import { KNOCKBACK_SPEED, KNOCKBACK_MS, IFRAMES_MS } from '../config/constants.js';

export function applyKnockback(targetSprite, fromX, fromY) {
  const dx = targetSprite.x - fromX;
  const dy = targetSprite.y - fromY;
  const d = Math.hypot(dx, dy) || 1;
  targetSprite.body.setVelocity((dx / d) * KNOCKBACK_SPEED, (dy / d) * KNOCKBACK_SPEED);
}

export const KNOCKBACK_DURATION = KNOCKBACK_MS;
export const INVULNERABILITY_DURATION = IFRAMES_MS;
```

- [ ] **Step 5: Обновить `src/entities/Player.js`**

```js
import { PLAYER_SPEED, PLAYER_MAX_HP } from '../config/constants.js';
import { applyKnockback, KNOCKBACK_DURATION, INVULNERABILITY_DURATION } from '../systems/Combat.js';

export class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.sprite = scene.physics.add.sprite(x, y, 'player');
    this.sprite.setCollideWorldBounds(true);
    this.hp = PLAYER_MAX_HP;
    this.knockbackUntil = 0;
    this.iframesUntil = 0;
  }

  takeHit(fromX, fromY) {
    const now = this.scene.time.now;
    if (now < this.iframesUntil) return false;
    this.hp -= 1;
    this.iframesUntil = now + INVULNERABILITY_DURATION;
    this.knockbackUntil = now + KNOCKBACK_DURATION;
    applyKnockback(this.sprite, fromX, fromY);
    this.sprite.setTint(0xffffff);
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: { from: 0.3, to: 1 },
      duration: INVULNERABILITY_DURATION / 4,
      repeat: 3,
      yoyo: true,
      onComplete: () => { this.sprite.setAlpha(1); }
    });
    return true;
  }

  heal(n) {
    this.hp = Math.min(this.hp + n, PLAYER_MAX_HP);
  }

  update(input) {
    const now = this.scene.time.now;
    if (now < this.knockbackUntil) return; // knockback ведёт игрока
    const body = this.sprite.body;
    body.setVelocity(input.move.x * PLAYER_SPEED, input.move.y * PLAYER_SPEED);
  }

  isDead() {
    return this.hp <= 0;
  }
}
```

- [ ] **Step 6: `src/scenes/UIScene.js`**

```js
import { PLAYER_MAX_HP } from '../config/constants.js';

export class UIScene extends Phaser.Scene {
  constructor() { super('UIScene'); }
  create() {
    this.hpText = this.add.text(12, 8, '', {
      fontFamily: 'monospace', fontSize: '20px', color: '#ff5252',
    });
    this.game.events.on('hud:update', this.onUpdate, this);
  }
  onUpdate(state) {
    this.hpText.setText('HP: ' + '♥'.repeat(state.hp) + '♡'.repeat(PLAYER_MAX_HP - state.hp));
  }
}
```

- [ ] **Step 7: Зарегистрировать UIScene**

В `src/main.js`:
```js
import { UIScene } from './scenes/UIScene.js';
// ...
scene: [BootScene, GameScene, UIScene, GameOverScene, VictoryScene],
```

- [ ] **Step 8: Интеграция в GameScene**

В `src/scenes/GameScene.js`:
- В `create()` в начале:
```js
this.scene.launch('UIScene');
this.game.events.emit('hud:update', { hp: 3 });
```
- Заменить overlap игрока с монстром:
```js
this.physics.add.overlap(this.player.sprite, m.sprite, () => {
  const took = this.player.takeHit(m.sprite.x, m.sprite.y);
  if (took) {
    this.game.events.emit('hud:update', { hp: this.player.hp });
    if (this.player.isDead()) this.scene.start('GameOverScene');
  }
});
```
- В конце `create()` — разбросать аптечки по тупикам:
```js
import { Pickup, PICKUP_TYPE } from '../entities/Pickup.js'; // в импорты
// ...
this.pickups = [];
const deadEnds = findDeadEnds(this.map.tiles);
for (let i = 0; i < Math.min(3, deadEnds.length); i++) {
  const idx = Math.floor(Math.random() * deadEnds.length);
  const c = deadEnds.splice(idx, 1)[0];
  const w = this.map.tileToWorld(c.x, c.y);
  const p = new Pickup(this, w.x, w.y, PICKUP_TYPE.HEART);
  this.physics.add.overlap(this.player.sprite, p.sprite, () => {
    p.sprite.destroy();
    this.player.heal(1);
    this.game.events.emit('hud:update', { hp: this.player.hp });
  });
  this.pickups.push(p);
}
```

Добавить в файл функцию (внизу, после класса):
```js
function findDeadEnds(tiles) {
  const result = [];
  const h = tiles.length, w = tiles[0].length;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (tiles[y][x] !== TILE.FLOOR) continue;
      let openSides = 0;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        if (tiles[y + dy][x + dx] !== TILE.WALL) openSides++;
      }
      if (openSides === 1) result.push({ x, y });
    }
  }
  return result;
}
```

- [ ] **Step 9: Manual verification**

Reload.
Expected:
- В левом верхнем углу — «HP: ♥♥♥».
- Касание монстра → одно сердечко становится пустым, игрок мигает ~0.4с, в это время повторное касание не вредит.
- В тупиках — красные точки (аптечки), при касании HP +1.
- После 3 касаний → Game Over.

- [ ] **Step 10: Commit**

```sh
git add src/
git commit -m "feat(stage-7): HP, i-frames, knockback, heart pickups, HUD"
```

---

## Task 8: Twin-stick стрельба

**Цель:** игрок стреляет в направлении прицела (мышь / правый стик), пули убивают монстров, расход боеприпасов.

**Files:**
- Create: `src/entities/Bullet.js`
- Modify: `src/config/constants.js`
- Modify: `src/scenes/BootScene.js`
- Modify: `src/entities/Player.js`
- Modify: `src/scenes/GameScene.js`
- Modify: `src/scenes/UIScene.js`
- Modify: `src/entities/Monster.js` (HP)

- [ ] **Step 1: Константы**

В `src/config/constants.js`:
```js
export const BULLET_SPEED = 500;
export const BULLET_LIFETIME_MS = 800;
export const FIRE_RATE_MS = 300;
export const STARTING_AMMO = 12;
export const MONSTER_HP_DEFAULT = 1;
```

- [ ] **Step 2: Текстура пули в BootScene**

```js
g.fillStyle(COLOR.BULLET, 1);
g.fillCircle(4, 4, 4);
g.generateTexture('bullet', 8, 8);
g.clear();
```

- [ ] **Step 3: `src/entities/Bullet.js`**

```js
import { BULLET_SPEED, BULLET_LIFETIME_MS } from '../config/constants.js';

export class Bullet {
  constructor(scene, x, y, dirX, dirY) {
    this.sprite = scene.physics.add.sprite(x, y, 'bullet');
    this.sprite.body.setAllowGravity(false);
    this.sprite.body.setVelocity(dirX * BULLET_SPEED, dirY * BULLET_SPEED);
    this.dieAt = scene.time.now + BULLET_LIFETIME_MS;
    this.dead = false;
  }
  update(now) {
    if (now >= this.dieAt) this.kill();
  }
  kill() {
    if (this.dead) return;
    this.dead = true;
    this.sprite.destroy();
  }
}
```

- [ ] **Step 4: Стрельба в Player**

В `src/entities/Player.js`:
```js
import { FIRE_RATE_MS, STARTING_AMMO } from '../config/constants.js';
// ...
// в constructor():
this.ammo = STARTING_AMMO;
this.nextShotAt = 0;
this.aim = null;
// ...
setAim(aim) { this.aim = aim; }

tryShoot(now) {
  if (!this.aim) return null;
  if (this.ammo <= 0) return null;
  if (now < this.nextShotAt) return null;
  this.ammo -= 1;
  this.nextShotAt = now + FIRE_RATE_MS;
  return { x: this.aim.x, y: this.aim.y, ox: this.sprite.x, oy: this.sprite.y };
}
```

- [ ] **Step 5: Bullet HP на монстре**

В `src/entities/Monster.js`:
```js
// в constructor() в конце:
this.hp = 1;
// ...
takeDamage(n = 1) {
  this.hp -= n;
  if (this.hp <= 0) this.sprite.destroy();
  return this.hp <= 0;
}
```

- [ ] **Step 6: В Chaser задать HP=2**

В `src/entities/monsters/Chaser.js` после `super(...)`:
```js
this.hp = 2;
```

- [ ] **Step 7: GameScene — стрельба, коллизии пуль**

В `src/scenes/GameScene.js`:
- Импорт `Bullet`.
- В `create()`:
```js
this.bullets = [];
```
- В `update(_, delta)`:
```js
update(_time, delta) {
  this.inputSys.setAimOrigin(this.player.sprite.x, this.player.sprite.y);
  const input = this.inputSys.read();
  this.player.setAim(input.aim);
  this.player.update(input);

  // стрельба
  if (input.shoot) {
    const shot = this.player.tryShoot(this.time.now);
    if (shot) {
      const b = new Bullet(this, shot.ox, shot.oy, shot.x, shot.y);
      this.physics.add.collider(b.sprite, this.map.walls, () => b.kill());
      for (const m of this.monsters) {
        if (!m.sprite.active) continue;
        this.physics.add.overlap(b.sprite, m.sprite, () => {
          if (b.dead) return;
          b.kill();
          if (m.takeDamage(1)) {
            this.monsters = this.monsters.filter(x => x !== m);
          }
        });
      }
      this.bullets.push(b);
      this.game.events.emit('hud:update', { hp: this.player.hp, ammo: this.player.ammo });
    }
  }

  // bullet lifetime
  const now = this.time.now;
  for (const b of this.bullets) b.update(now);
  this.bullets = this.bullets.filter(b => !b.dead);

  for (const m of this.monsters) m.update(delta, this.player, this.map);
  this.fog.update(this.player.sprite.x, this.player.sprite.y);
}
```

- [ ] **Step 8: UIScene — показать ammo**

В `src/scenes/UIScene.js`:
```js
create() {
  this.hpText = this.add.text(12, 8, '', { fontFamily: 'monospace', fontSize: '20px', color: '#ff5252' });
  this.ammoText = this.add.text(12, 32, '', { fontFamily: 'monospace', fontSize: '18px', color: '#fff176' });
  this.game.events.on('hud:update', this.onUpdate, this);
}
onUpdate(state) {
  if (state.hp != null) this.hpText.setText('HP: ' + '♥'.repeat(state.hp) + '♡'.repeat(PLAYER_MAX_HP - state.hp));
  if (state.ammo != null) this.ammoText.setText('● ' + state.ammo);
}
```

И в `GameScene.create()` после `launch('UIScene')`:
```js
this.game.events.emit('hud:update', { hp: 3, ammo: this.player.ammo });
```

- [ ] **Step 9: Manual verification**

Reload.
Expected:
- В UI снизу/над HP — счётчик пуль (12 на старте).
- ЛКМ или правый стик в сторону → пуля летит, стенки гасят, в монстра — попадает.
- Преследователь умирает с двух попаданий.
- Стрельбу нельзя спамить чаще ~3 раз/сек.

- [ ] **Step 10: Commit**

```sh
git add src/
git commit -m "feat(stage-8): twin-stick shooting with bullets, ammo and monster HP"
```

---

## Task 9: Спринт и dash

**Цель:** Shift/L2 — спринт (с stamina), Space/A — dash (i-frames, проход сквозь монстров, cooldown).

**Files:**
- Modify: `src/config/constants.js`
- Modify: `src/entities/Player.js`
- Modify: `src/scenes/UIScene.js`
- Modify: `src/scenes/GameScene.js`

- [ ] **Step 1: Константы**

```js
export const STAMINA_MAX = 100;
export const STAMINA_SPRINT_PER_SEC = 40;
export const STAMINA_REGEN_PER_SEC = 25;
export const SPRINT_MULTIPLIER = 1.6;
export const DASH_DISTANCE = 200;     // px
export const DASH_DURATION_MS = 120;
export const DASH_COOLDOWN_MS = 1500;
```

- [ ] **Step 2: Player — sprint, dash, обновлённый update**

В `src/entities/Player.js`:
```js
// импорт констант ↑
// в constructor():
this.stamina = STAMINA_MAX;
this.dashUntil = 0;
this.dashCooldownUntil = 0;
this.dashDir = null;
// ...
update(input) {
  const now = this.scene.time.now;
  if (now < this.knockbackUntil) return;

  // dash в процессе → принудительная скорость, неуязвимость
  if (now < this.dashUntil) {
    const speed = DASH_DISTANCE / (DASH_DURATION_MS / 1000);
    this.sprite.body.setVelocity(this.dashDir.x * speed, this.dashDir.y * speed);
    return;
  }

  // активация dash
  if (input.dash && now >= this.dashCooldownUntil) {
    const dir = (input.move.x || input.move.y)
      ? { x: input.move.x, y: input.move.y }
      : (this.aim || { x: 1, y: 0 });
    this.dashDir = dir;
    this.dashUntil = now + DASH_DURATION_MS;
    this.dashCooldownUntil = now + DASH_COOLDOWN_MS;
    this.iframesUntil = Math.max(this.iframesUntil, this.dashUntil);
    return;
  }

  // sprint
  let speed = PLAYER_SPEED;
  const dtSec = this.scene.game.loop.delta / 1000;
  if (input.sprint && this.stamina > 0 && (input.move.x || input.move.y)) {
    speed *= SPRINT_MULTIPLIER;
    this.stamina = Math.max(0, this.stamina - STAMINA_SPRINT_PER_SEC * dtSec);
  } else {
    this.stamina = Math.min(STAMINA_MAX, this.stamina + STAMINA_REGEN_PER_SEC * dtSec);
  }

  this.sprite.body.setVelocity(input.move.x * speed, input.move.y * speed);
}
```

- [ ] **Step 3: UIScene — stamina-бар**

```js
// в create():
this.staminaBg = this.add.rectangle(12, 60, 120, 8, 0x222222).setOrigin(0, 0);
this.staminaBar = this.add.rectangle(12, 60, 120, 8, 0x4ec9ff).setOrigin(0, 0);
// ...
// в onUpdate(state):
if (state.stamina != null) {
  this.staminaBar.width = 120 * (state.stamina / 100);
}
```

- [ ] **Step 4: GameScene — слать stamina в HUD**

После `this.player.update(input)`:
```js
this.game.events.emit('hud:update', { stamina: this.player.stamina });
```

- [ ] **Step 5: Manual verification**

Reload.
- Shift или LT — игрок бежит быстрее, stamina-бар падает.
- Когда stamina на нуле — спринт не работает, бар восстанавливается через ~4 сек.
- Space или A — короткий рывок на 200 px, проходит сквозь монстров (overlap не сработает из-за i-frames).
- Повторный dash недоступен 1.5 сек.

- [ ] **Step 6: Commit**

```sh
git add src/
git commit -m "feat(stage-9): sprint with stamina and dash with i-frames"
```

---

## Task 10: Три типа монстров

**Цель:** добавить Wanderer (patrol + chase в радиусе видимости) и Guard (стационарный, охраняет зону).

**Files:**
- Create: `src/entities/monsters/Wanderer.js`
- Create: `src/entities/monsters/Guard.js`
- Modify: `src/scenes/BootScene.js` (две новые текстуры)
- Modify: `src/scenes/GameScene.js`
- Modify: `src/config/constants.js`

- [ ] **Step 1: Константы**

```js
export const WANDERER_VISION_TILES = 4;
export const WANDERER_LOSE_INTEREST_MS = 3000;
export const GUARD_PATROL_HALF = 1;  // охраняет 3×3 => half=1
```

- [ ] **Step 2: Текстуры (разные цвета для разных монстров)**

В `BootScene.create()`:
```js
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
```

- [ ] **Step 3: `src/entities/monsters/Wanderer.js`**

```js
import { Monster } from '../Monster.js';
import { bfsNextStep } from '../../systems/PathFinding.js';
import {
  TILE_SIZE, PLAYER_SPEED,
  WANDERER_VISION_TILES, WANDERER_LOSE_INTEREST_MS, TILE,
} from '../../config/constants.js';

const REPATH_MS = 250;
const WANDER_PICK_MS = 1500;

export class Wanderer extends Monster {
  constructor(scene, x, y) {
    super(scene, x, y, 'monster_wanderer');
    this.speed = PLAYER_SPEED * 0.9;
    this.mode = 'wander';   // 'wander' | 'chase'
    this.loseInterestAt = 0;
    this.wanderTargetAt = 0;
  }

  canSee(player, map) {
    const mt = this.tilePos();
    const pt = {
      x: Math.floor(player.sprite.x / TILE_SIZE),
      y: Math.floor(player.sprite.y / TILE_SIZE),
    };
    const dx = mt.x - pt.x, dy = mt.y - pt.y;
    if (Math.hypot(dx, dy) > WANDERER_VISION_TILES) return false;
    // прямой луч: грубо проверим, что нет стены между ними
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)));
    for (let i = 1; i < steps; i++) {
      const x = Math.round(mt.x - (dx * i / steps));
      const y = Math.round(mt.y - (dy * i / steps));
      if (map.tiles[y][x] === TILE.WALL) return false;
    }
    return true;
  }

  pickWanderTarget(map) {
    const mt = this.tilePos();
    const opts = [];
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = mt.x + dx, ny = mt.y + dy;
      if (map.tiles[ny] && map.tiles[ny][nx] === TILE.FLOOR) opts.push({ x: nx, y: ny });
    }
    if (opts.length === 0) return null;
    return opts[Math.floor(Math.random() * opts.length)];
  }

  update(dtMs, player, map) {
    const now = this.scene.time.now;
    if (this.canSee(player, map)) {
      this.mode = 'chase';
      this.loseInterestAt = now + WANDERER_LOSE_INTEREST_MS;
    } else if (now > this.loseInterestAt) {
      this.mode = 'wander';
    }

    this.repathTimer -= dtMs;
    if (this.mode === 'chase') {
      if (this.repathTimer <= 0 || !this.target) {
        this.repathTimer = REPATH_MS;
        const mt = this.tilePos();
        const pt = {
          x: Math.floor(player.sprite.x / TILE_SIZE),
          y: Math.floor(player.sprite.y / TILE_SIZE),
        };
        const step = bfsNextStep(map.tiles, mt.x, mt.y, pt.x, pt.y);
        this.target = step ? map.tileToWorld(step.x, step.y) : null;
      }
    } else {
      // wander
      if (!this.target || now > this.wanderTargetAt) {
        const pick = this.pickWanderTarget(map);
        this.target = pick ? map.tileToWorld(pick.x, pick.y) : null;
        this.wanderTargetAt = now + WANDER_PICK_MS;
      }
    }
    if (this.target) {
      const dx = this.target.x - this.sprite.x;
      const dy = this.target.y - this.sprite.y;
      if (Math.hypot(dx, dy) < 2) this.target = null;
    }
    this.moveToward(this.target);
  }
}
```

- [ ] **Step 4: `src/entities/monsters/Guard.js`**

```js
import { Monster } from '../Monster.js';
import { bfsNextStep } from '../../systems/PathFinding.js';
import { TILE_SIZE, PLAYER_SPEED, GUARD_PATROL_HALF, TILE } from '../../config/constants.js';

const REPATH_MS = 250;

export class Guard extends Monster {
  constructor(scene, x, y) {
    super(scene, x, y, 'monster_guard');
    this.speed = PLAYER_SPEED * 0.5;
    this.homeTile = this.tilePos();
  }

  inHomeZone(tx, ty) {
    return Math.abs(tx - this.homeTile.x) <= GUARD_PATROL_HALF
        && Math.abs(ty - this.homeTile.y) <= GUARD_PATROL_HALF;
  }

  update(dtMs, player, map) {
    this.repathTimer -= dtMs;
    const mt = this.tilePos();
    const pt = {
      x: Math.floor(player.sprite.x / TILE_SIZE),
      y: Math.floor(player.sprite.y / TILE_SIZE),
    };
    const playerInZone = this.inHomeZone(pt.x, pt.y);

    if (this.repathTimer <= 0 || !this.target) {
      this.repathTimer = REPATH_MS;
      const goal = playerInZone ? pt : this.homeTile;
      const step = bfsNextStep(map.tiles, mt.x, mt.y, goal.x, goal.y);
      this.target = step ? map.tileToWorld(step.x, step.y) : null;
    }
    if (this.target) {
      const dx = this.target.x - this.sprite.x;
      const dy = this.target.y - this.sprite.y;
      if (Math.hypot(dx, dy) < 2) this.target = null;
    }
    this.moveToward(this.target);
  }
}
```

- [ ] **Step 5: Распределение монстров в GameScene**

В `src/scenes/GameScene.js` — заменить блок спавна монстров:
```js
import { Wanderer } from '../entities/monsters/Wanderer.js';
import { Guard } from '../entities/monsters/Guard.js';
// ...
this.monsters = [];
{
  const minDistTiles = 8;
  const candidates = [];
  for (let y = 1; y < GRID_H - 1; y++) {
    for (let x = 1; x < GRID_W - 1; x++) {
      if (this.map.tiles[y][x] !== TILE.FLOOR) continue;
      const dx = x - this.map.entrance.x;
      const dy = y - this.map.entrance.y;
      if (Math.hypot(dx, dy) >= minDistTiles) candidates.push({ x, y });
    }
  }
  // распределение: 4 wanderer, 2 chaser, 1 guard (если есть слоты)
  const plan = [
    ...Array(4).fill(Wanderer),
    ...Array(2).fill(Chaser),
    ...Array(1).fill(Guard),
  ];
  for (const Cls of plan) {
    if (candidates.length === 0) break;
    const idx = Math.floor(Math.random() * candidates.length);
    const c = candidates.splice(idx, 1)[0];
    const w = this.map.tileToWorld(c.x, c.y);
    const m = new Cls(this, w.x, w.y);
    this.physics.add.collider(m.sprite, this.map.walls);
    this.physics.add.overlap(this.player.sprite, m.sprite, () => {
      const took = this.player.takeHit(m.sprite.x, m.sprite.y);
      if (took) {
        this.game.events.emit('hud:update', { hp: this.player.hp });
        if (this.player.isDead()) this.scene.start('GameOverScene');
      }
    });
    this.monsters.push(m);
  }
}
```

- [ ] **Step 6: Manual verification**

Reload.
- Оранжевые (wanderer) бродят рядом со своими стартами, но завидев игрока — преследуют, теряют интерес через 3 сек.
- Красные (chaser) всегда идут к игроку (через стены/лабиринт — нет, через коридор — да).
- Фиолетовый (guard) стоит на месте, активируется только если зайти в его 3×3 зону.

- [ ] **Step 7: Commit**

```sh
git add src/
git commit -m "feat(stage-10): three monster types (wanderer, chaser, guard)"
```

---

## Task 11: Двери и ключи

**Цель:** в лабиринте 1–3 цветные двери, в каждой ветке доступны соответствующие ключи. Касание двери своим ключом — открывает.

**Files:**
- Create: `src/entities/Door.js`
- Modify: `src/world/MazeGenerator.js` (добавить размещение дверей/ключей)
- Modify: `src/scenes/BootScene.js` (текстуры)
- Modify: `src/scenes/GameScene.js`
- Modify: `src/scenes/UIScene.js`

- [ ] **Step 1: Текстуры дверей и ключей**

В `BootScene.create()` для каждого цвета R/G/B:
```js
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
```

- [ ] **Step 2: MazeGenerator — размещение дверей и ключей**

В `src/world/MazeGenerator.js` дополнить:
```js
// внутри generateMaze, перед return:
const path = findPath(grid, sx, sy, bestX, bestY);
const bridges = findBridgesOnPath(grid, path);
const doorColors = [TILE.DOOR_R, TILE.DOOR_G, TILE.DOOR_B];
const keyColors = ['r', 'g', 'b'];
const keys = [];   // { color, x, y }

const rand = rng(seed ^ 0xABCDEF);
const doorsToPlace = Math.min(bridges.length, 1 + Math.floor(rand() * 3)); // 1..3
for (let i = 0; i < doorsToPlace; i++) {
  const bridge = bridges[Math.floor(rand() * bridges.length)];
  const tile = doorColors[i];
  grid[bridge.y][bridge.x] = tile;
  // ключ — в области ДО двери (доступной из входа без этой двери)
  const safe = findReachableExcluding(grid, sx, sy, bridge.x, bridge.y);
  if (safe.length > 0) {
    const cell = safe[Math.floor(rand() * safe.length)];
    keys.push({ color: keyColors[i], x: cell.x, y: cell.y });
  }
}
return { grid, keys };
```

Добавить helpers в файл:
```js
function findPath(grid, sx, sy, tx, ty) {
  const h = grid.length, w = grid[0].length;
  const prev = Array.from({ length: h }, () => new Array(w).fill(null));
  const visited = Array.from({ length: h }, () => new Array(w).fill(false));
  visited[sy][sx] = true;
  const q = [[sx, sy]];
  let head = 0;
  while (head < q.length) {
    const [x, y] = q[head++];
    if (x === tx && y === ty) {
      const path = [];
      let cx = x, cy = y;
      while (prev[cy][cx]) { path.unshift({ x: cx, y: cy }); [cx, cy] = prev[cy][cx]; }
      path.unshift({ x: sx, y: sy });
      return path;
    }
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (visited[ny][nx]) continue;
      if (grid[ny][nx] === TILE.WALL) continue;
      visited[ny][nx] = true;
      prev[ny][nx] = [x, y];
      q.push([nx, ny]);
    }
  }
  return [];
}

// В perfect maze любая клетка на пути — bridge. Но игроку нужны узкие места;
// в дереве почти все рёбра — bridges. Возьмём середины пути (исключая старт и финиш).
function findBridgesOnPath(grid, path) {
  if (path.length < 3) return [];
  return path.slice(1, -1);
}

function findReachableExcluding(grid, sx, sy, blockX, blockY) {
  const h = grid.length, w = grid[0].length;
  const visited = Array.from({ length: h }, () => new Array(w).fill(false));
  visited[sy][sx] = true;
  const q = [[sx, sy]];
  let head = 0;
  const result = [];
  while (head < q.length) {
    const [x, y] = q[head++];
    if (grid[y][x] === TILE.FLOOR) result.push({ x, y });
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (visited[ny][nx]) continue;
      if (nx === blockX && ny === blockY) continue;
      if (grid[ny][nx] === TILE.WALL) continue;
      visited[ny][nx] = true;
      q.push([nx, ny]);
    }
  }
  return result;
}
```

- [ ] **Step 3: Обновить вызывающий код**

В `src/scenes/GameScene.js`:
- `generateMaze(GRID_W, GRID_H, seed)` теперь возвращает объект `{ grid, keys }`. Адаптировать:
```js
const seed = Date.now();
const { grid, keys: keySpec } = generateMaze(GRID_W, GRID_H, seed);
this.map = new TileMap(this, grid);
```

- [ ] **Step 4: `src/entities/Door.js`**

```js
import { TILE_SIZE, TILE } from '../config/constants.js';

const TILE_TO_COLOR = {
  [TILE.DOOR_R]: 'r',
  [TILE.DOOR_G]: 'g',
  [TILE.DOOR_B]: 'b',
};

export class Door {
  constructor(scene, tx, ty, tile, map) {
    this.scene = scene;
    this.tx = tx;
    this.ty = ty;
    this.tile = tile;
    this.color = TILE_TO_COLOR[tile];
    this.map = map;
    const tex = 'door_' + this.color;
    const wx = tx * TILE_SIZE + TILE_SIZE / 2;
    const wy = ty * TILE_SIZE + TILE_SIZE / 2;
    this.sprite = scene.physics.add.staticImage(wx, wy, tex);
    this.sprite.doorRef = this;
  }

  open() {
    this.map.tiles[this.ty][this.tx] = TILE.FLOOR;
    this.sprite.destroy();
  }
}
```

- [ ] **Step 5: TileMap создаёт двери (по тайлу)**

В `src/world/TileMap.js` в render():
```js
} else if (t === TILE.DOOR_R || t === TILE.DOOR_G || t === TILE.DOOR_B) {
  // подложка пола под дверью
  this.scene.add.image(px, py, 'floor');
  // дверь добавится в GameScene как отдельная сущность
} else {
  this.scene.add.image(px, py, 'floor');
  // ...
}
```

Добавить вспомогательное:
```js
findDoors() {
  const result = [];
  for (let y = 0; y < this.height; y++) {
    for (let x = 0; x < this.width; x++) {
      const t = this.tiles[y][x];
      if (t === TILE.DOOR_R || t === TILE.DOOR_G || t === TILE.DOOR_B) {
        result.push({ x, y, tile: t });
      }
    }
  }
  return result;
}
```

- [ ] **Step 6: Pickup для ключей**

В `src/entities/Pickup.js` расширить:
```js
export const PICKUP_TYPE = {
  HEART: 'heart',
  KEY_R: 'key_r',
  KEY_G: 'key_g',
  KEY_B: 'key_b',
  AMMO: 'ammo',
};

const TEXTURES = {
  heart: 'pickup_heart',
  key_r: 'key_r',
  key_g: 'key_g',
  key_b: 'key_b',
  ammo:  'pickup_ammo',
};

export class Pickup {
  constructor(scene, x, y, type) {
    this.type = type;
    this.sprite = scene.physics.add.sprite(x, y, TEXTURES[type] || 'pickup_heart');
    this.sprite.body.setAllowGravity(false);
    this.sprite.body.setImmovable(true);
    this.sprite.pickupRef = this;
  }
}
```

(`pickup_ammo` будет добавлен позже; пока fallback на heart, чтоб не падало).

- [ ] **Step 7: GameScene — создать двери и ключи; инвентарь ключей в Player**

В `src/entities/Player.js` добавить:
```js
// в constructor():
this.keys = new Set();   // 'r', 'g', 'b'
addKey(color) { this.keys.add(color); }
hasKey(color) { return this.keys.has(color); }
```

В `src/scenes/GameScene.js` после создания map:
```js
import { Door } from '../entities/Door.js';
// ...
this.doors = [];
for (const d of this.map.findDoors()) {
  const door = new Door(this, d.x, d.y, d.tile, this.map);
  this.physics.add.collider(this.player.sprite, door.sprite, () => {
    if (this.player.hasKey(door.color)) {
      door.open();
      this.doors = this.doors.filter(x => x !== door);
    }
  });
  this.doors.push(door);
}

this.keyPickups = [];
for (const k of keySpec) {
  const w = this.map.tileToWorld(k.x, k.y);
  const p = new Pickup(this, w.x, w.y, 'key_' + k.color);
  this.physics.add.overlap(this.player.sprite, p.sprite, () => {
    if (!p.sprite.active) return;
    p.sprite.destroy();
    this.player.addKey(k.color);
    this.game.events.emit('hud:update', { keys: Array.from(this.player.keys) });
  });
  this.keyPickups.push(p);
}
this.game.events.emit('hud:update', { keys: [] });
```

- [ ] **Step 8: UIScene — показать ключи**

```js
// в create():
this.keysText = this.add.text(12, 84, '', { fontFamily: 'monospace', fontSize: '18px' });
// в onUpdate(state):
if (state.keys != null) {
  const map = { r: '🔴', g: '🟢', b: '🔵' };
  this.keysText.setText('Keys: ' + state.keys.map(c => map[c]).join(' '));
}
```

- [ ] **Step 9: Монстры — не ходят через двери**

В `src/systems/PathFinding.js` параметр `passable` уже исключает DOOR. Это работает: монстры не пройдут через закрытые двери. После `open()` тайл становится `FLOOR` — проходимым.

- [ ] **Step 10: Manual verification**

Reload несколько раз.
- В лабиринте 1–3 цветные двери на пути от входа к выходу.
- В безопасной части (до двери) — ключ соответствующего цвета.
- Без ключа дверь непроходима (упёрлись).
- С ключом дверь исчезает при касании.
- Монстры не телепортятся через закрытые двери.

- [ ] **Step 11: Commit**

```sh
git add src/
git commit -m "feat(stage-11): colored doors and keys with guaranteed reachability"
```

---

## Task 12: Сундуки с power-ups и debuffs

**Цель:** разбросать сундуки в тупиках; при взаимодействии E/X — слепое выпадение: 70% power-up, 30% debuff. Все эффекты — броня (регенерирующая), приманка, очки-компас, отравление, замедление, слепота, аптечка, патроны.

**Files:**
- Create: `src/entities/Chest.js`
- Create: `src/systems/Effects.js`
- Modify: `src/config/constants.js`
- Modify: `src/scenes/BootScene.js`
- Modify: `src/entities/Player.js`
- Modify: `src/scenes/GameScene.js`
- Modify: `src/scenes/UIScene.js`
- Modify: `src/world/FogOfWar.js` (blindness multiplier)

- [ ] **Step 1: Константы эффектов**

```js
export const ARMOR_MAX = 2;
export const ARMOR_REGEN_DELAY_MS = 8000;
export const POISON_TICK_MS = 4000;
export const POISON_TICKS = 4;
export const SLOW_DURATION_MS = 8000;
export const SLOW_MULTIPLIER = 0.7;
export const BLINDNESS_DURATION_MS = 6000;
export const BLINDNESS_VISION_RATIO = 0.5;
export const COMPASS_DURATION_MS = 20000;
export const LURE_DURATION_MS = 5000;
export const LURE_RANGE_TILES = 8;
export const LURE_THROW_TILES = 6;
export const AMMO_PACK = 6;
```

- [ ] **Step 2: Текстуры**

В `BootScene.create()`:
```js
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
```

- [ ] **Step 3: `src/systems/Effects.js`**

```js
// Эффекты — стейт-машина в GameState.
// Хранятся как массив записей { id, type, expiresAt, extra }
// Эффекты могут одновременно действовать; одного типа — обновляется.

let nextId = 1;

export function addEffect(state, type, durationMs, extra = {}) {
  // если того же типа уже есть — обновим
  const now = performance.now();
  const expiresAt = now + durationMs;
  const existing = state.effects.find(e => e.type === type);
  if (existing) {
    existing.expiresAt = expiresAt;
    Object.assign(existing, extra);
    return existing;
  }
  const e = { id: nextId++, type, expiresAt, ...extra };
  state.effects.push(e);
  return e;
}

export function hasEffect(state, type) {
  return state.effects.some(e => e.type === type);
}

export function getEffect(state, type) {
  return state.effects.find(e => e.type === type);
}

export function tickEffects(state, now) {
  state.effects = state.effects.filter(e => now < e.expiresAt);
}
```

- [ ] **Step 4: Расширить Player — armor, эффекты-аппликация**

В `src/entities/Player.js`:
```js
import { ARMOR_MAX, ARMOR_REGEN_DELAY_MS, SLOW_MULTIPLIER } from '../config/constants.js';
import { hasEffect } from '../systems/Effects.js';
// ...
// в constructor():
this.armor = 0;
this.lastDamageAt = 0;
// ...
takeHit(fromX, fromY) {
  // ... поверх существующего кода:
  // если есть броня, поглощает HP-удар
}
// перепишем takeHit:
takeHit(fromX, fromY) {
  const now = this.scene.time.now;
  if (now < this.iframesUntil) return false;
  if (this.armor > 0) {
    this.armor -= 1;
  } else {
    this.hp -= 1;
  }
  this.lastDamageAt = now;
  this.iframesUntil = now + INVULNERABILITY_DURATION;
  this.knockbackUntil = now + KNOCKBACK_DURATION;
  applyKnockback(this.sprite, fromX, fromY);
  this.scene.tweens.add({
    targets: this.sprite,
    alpha: { from: 0.3, to: 1 },
    duration: INVULNERABILITY_DURATION / 4,
    repeat: 3,
    yoyo: true,
    onComplete: () => { this.sprite.setAlpha(1); }
  });
  return true;
}

addArmor(n) {
  this.armor = Math.min(this.armor + n, ARMOR_MAX);
}

regenArmorTick(now) {
  if (now - this.lastDamageAt > ARMOR_REGEN_DELAY_MS && this.armor < ARMOR_MAX) {
    this.armor = Math.min(this.armor + 1, ARMOR_MAX);
    this.lastDamageAt = now; // следующая регенерация через 8 сек
  }
}
```

Также в `update()` — учёт slow и dash как сейчас:
```js
let speed = PLAYER_SPEED;
const dtSec = this.scene.game.loop.delta / 1000;
if (input.sprint && this.stamina > 0 && (input.move.x || input.move.y)) {
  speed *= SPRINT_MULTIPLIER;
  this.stamina = Math.max(0, this.stamina - STAMINA_SPRINT_PER_SEC * dtSec);
} else {
  this.stamina = Math.min(STAMINA_MAX, this.stamina + STAMINA_REGEN_PER_SEC * dtSec);
}
if (hasEffect(this.scene.gameState, 'slow')) speed *= SLOW_MULTIPLIER;
this.sprite.body.setVelocity(input.move.x * speed, input.move.y * speed);
```

- [ ] **Step 5: `src/entities/Chest.js`**

```js
const POWER_UPS = ['armor', 'lure', 'compass', 'heal', 'ammo'];
const DEBUFFS = ['poison', 'slow', 'blindness'];

export class Chest {
  constructor(scene, x, y) {
    this.scene = scene;
    this.sprite = scene.physics.add.staticImage(x, y, 'chest');
    this.sprite.chestRef = this;
    this.opened = false;
  }

  open(rand = Math.random) {
    if (this.opened) return null;
    this.opened = true;
    this.sprite.destroy();
    const isPower = rand() < 0.7;
    const pool = isPower ? POWER_UPS : DEBUFFS;
    return pool[Math.floor(rand() * pool.length)];
  }
}
```

- [ ] **Step 6: GameScene — спавн сундуков, обработка взаимодействия**

```js
import { Chest } from '../entities/Chest.js';
import { addEffect, hasEffect, tickEffects } from '../systems/Effects.js';
import {
  POISON_TICK_MS, POISON_TICKS,
  SLOW_DURATION_MS, BLINDNESS_DURATION_MS,
  COMPASS_DURATION_MS, LURE_DURATION_MS, AMMO_PACK,
} from '../config/constants.js';
// ...
// в create():
this.gameState = { effects: [] };
this.chests = [];
{
  const deadEnds = findDeadEnds(this.map.tiles);
  const num = Math.min(4, deadEnds.length);
  for (let i = 0; i < num; i++) {
    const idx = Math.floor(Math.random() * deadEnds.length);
    const c = deadEnds.splice(idx, 1)[0];
    const w = this.map.tileToWorld(c.x, c.y);
    const ch = new Chest(this, w.x, w.y);
    this.chests.push(ch);
  }
}
this.nearestChest = null;
```

В `update(_time, delta)`:
```js
// найти сундук в радиусе <1 тайла для подсказки и взаимодействия
this.nearestChest = null;
for (const ch of this.chests) {
  if (ch.opened) continue;
  const d = Math.hypot(ch.sprite.x - this.player.sprite.x, ch.sprite.y - this.player.sprite.y);
  if (d < TILE_SIZE) { this.nearestChest = ch; break; }
}
if (input.interact && this.nearestChest) {
  const reward = this.nearestChest.open();
  this.applyChestReward(reward);
  this.chests = this.chests.filter(c => !c.opened);
}

// эффекты во времени
tickEffects(this.gameState, performance.now());
// отравление: каждые POISON_TICK_MS — -1 HP, всего POISON_TICKS раз
const poison = this.gameState.effects.find(e => e.type === 'poison');
if (poison && performance.now() >= (poison.nextTickAt || 0) && (poison.ticks || 0) < POISON_TICKS) {
  this.player.hp = Math.max(0, this.player.hp - 1);
  poison.ticks = (poison.ticks || 0) + 1;
  poison.nextTickAt = performance.now() + POISON_TICK_MS;
  this.game.events.emit('hud:update', { hp: this.player.hp });
  if (this.player.isDead()) this.scene.start('GameOverScene');
}

// armor regen
this.player.regenArmorTick(this.time.now);

// HUD
this.game.events.emit('hud:update', {
  hp: this.player.hp, ammo: this.player.ammo,
  stamina: this.player.stamina, armor: this.player.armor,
  effects: this.gameState.effects.map(e => ({ type: e.type, msLeft: e.expiresAt - performance.now() })),
});
```

Добавить метод в класс `GameScene`:
```js
applyChestReward(type) {
  switch (type) {
    case 'armor':    this.player.addArmor(2); break;
    case 'heal':     this.player.heal(1); break;
    case 'ammo':     this.player.ammo += AMMO_PACK; break;
    case 'compass':  addEffect(this.gameState, 'compass', COMPASS_DURATION_MS); break;
    case 'lure':     this.player.lureCharges = (this.player.lureCharges || 0) + 1; break;
    case 'poison':   addEffect(this.gameState, 'poison', POISON_TICK_MS * POISON_TICKS, { nextTickAt: performance.now(), ticks: 0 }); break;
    case 'slow':     addEffect(this.gameState, 'slow', SLOW_DURATION_MS); break;
    case 'blindness':addEffect(this.gameState, 'blindness', BLINDNESS_DURATION_MS); break;
  }
}
```

- [ ] **Step 7: FogOfWar — учёт blindness**

В `src/world/FogOfWar.js` в `update`:
```js
import { BLINDNESS_VISION_RATIO } from '../config/constants.js';
// ...
// если в state есть blindness → радиус в 2 раза меньше
const blind = this.scene.gameState?.effects?.some(e => e.type === 'blindness');
const radiusTiles = blind ? Math.ceil(VISION_RADIUS_TILES * BLINDNESS_VISION_RATIO) : VISION_RADIUS_TILES;
const radiusPx = radiusTiles * TILE_SIZE;
// — далее использовать radiusTiles, radiusPx вместо констант
```

- [ ] **Step 8: UIScene — броня, активные эффекты, компас-индикатор**

```js
// в create():
this.armorText = this.add.text(12, 108, '', { fontFamily: 'monospace', fontSize: '18px', color: '#90caf9' });
this.effectsText = this.add.text(12, 132, '', { fontFamily: 'monospace', fontSize: '14px', color: '#dddddd' });
this.interactHint = this.add.text(GAME_W / 2, GAME_H - 30, '', { fontFamily: 'monospace', fontSize: '16px', color: '#ffd54f' }).setOrigin(0.5);

// в onUpdate(state):
if (state.armor != null) this.armorText.setText('Armor: ' + '◆'.repeat(state.armor));
if (state.effects) {
  this.effectsText.setText(state.effects.map(e => `${e.type} ${Math.ceil(e.msLeft/1000)}s`).join('  '));
}
if (state.interactHint != null) this.interactHint.setText(state.interactHint);
```

В `GameScene.update`:
```js
this.game.events.emit('hud:update', {
  interactHint: this.nearestChest ? 'E / X — открыть сундук' : '',
});
```

(Объединить с предыдущим emit'ом или вызывать раз.)

- [ ] **Step 9: Компас — стрелка на краю круга видимости**

В `src/scenes/GameScene.js` после create() добавим `this.compassArrow = this.add.graphics().setDepth(12);` и в update:
```js
this.compassArrow.clear();
if (hasEffect(this.gameState, 'compass')) {
  const ex = this.map.exit.x * TILE_SIZE + TILE_SIZE / 2;
  const ey = this.map.exit.y * TILE_SIZE + TILE_SIZE / 2;
  const dx = ex - this.player.sprite.x;
  const dy = ey - this.player.sprite.y;
  const len = Math.hypot(dx, dy) || 1;
  const r = (VISION_RADIUS_TILES - 1) * TILE_SIZE;
  const px = this.player.sprite.x + (dx / len) * r;
  const py = this.player.sprite.y + (dy / len) * r;
  this.compassArrow.fillStyle(0xffd54f, 1);
  this.compassArrow.fillCircle(px, py, 5);
}
```

(Не забыть `import { VISION_RADIUS_TILES } from '../config/constants.js';`).

- [ ] **Step 10: Manual verification**

Reload.
- В лабиринте видны сундуки (коричневые с жёлтой точкой).
- Подходишь — внизу подсказка «E / X — открыть».
- При открытии случайно: power-up (с шансом 70%) или debuff (30%).
- Power-ups действуют:
  - armor — щиты ◆ появляются, поглощают удар, регенерируют через 8 сек.
  - heal — +1 HP.
  - ammo — +6 пуль.
  - compass — желтая точка на краю круга видимости указывает на выход 20 сек.
  - lure — пока без активации, число накопляется (используется в полировке).
- Debuffs:
  - poison — −1 HP каждые 4 сек, всего 4 раза.
  - slow — заметно медленнее ход 8 сек.
  - blindness — круг видимости вдвое меньше 6 сек.

- [ ] **Step 11: Commit**

```sh
git add src/
git commit -m "feat(stage-12): chests with power-ups/debuffs, armor, effects system"
```

---

## Task 13: Полировка — меню, экраны конца, статистика, приманка

**Цель:** MenuScene, экраны GameOver/Victory со статистикой и индикатор активного устройства; реализовать активацию приманки.

**Files:**
- Create: `src/scenes/MenuScene.js`
- Modify: `src/main.js`
- Modify: `src/scenes/GameScene.js` (стартовое время, статистика, исследовано %)
- Modify: `src/scenes/GameOverScene.js`
- Modify: `src/scenes/VictoryScene.js`
- Modify: `src/scenes/UIScene.js` (индикатор устройства)
- Modify: `src/entities/Player.js` (метрики: monstersKilled)

- [ ] **Step 1: `src/scenes/MenuScene.js`**

```js
import { GAME_W, GAME_H } from '../config/constants.js';

export class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }
  create() {
    this.cameras.main.setBackgroundColor(0x0a0d10);
    this.add.text(GAME_W / 2, 120, 'Labirints & Monster', {
      fontFamily: 'monospace', fontSize: '40px', color: '#4ec9ff',
    }).setOrigin(0.5);
    this.add.text(GAME_W / 2, 200, 'WASD / стик — двигаться', { fontFamily: 'monospace', fontSize: '16px', color: '#aaaaaa' }).setOrigin(0.5);
    this.add.text(GAME_W / 2, 224, 'мышь / правый стик — целиться', { fontFamily: 'monospace', fontSize: '16px', color: '#aaaaaa' }).setOrigin(0.5);
    this.add.text(GAME_W / 2, 248, 'ЛКМ / стик — стрелять', { fontFamily: 'monospace', fontSize: '16px', color: '#aaaaaa' }).setOrigin(0.5);
    this.add.text(GAME_W / 2, 272, 'Shift / LT — бежать', { fontFamily: 'monospace', fontSize: '16px', color: '#aaaaaa' }).setOrigin(0.5);
    this.add.text(GAME_W / 2, 296, 'Space / A — рывок', { fontFamily: 'monospace', fontSize: '16px', color: '#aaaaaa' }).setOrigin(0.5);
    this.add.text(GAME_W / 2, 320, 'E / X — взаимодействие', { fontFamily: 'monospace', fontSize: '16px', color: '#aaaaaa' }).setOrigin(0.5);

    this.add.text(GAME_W / 2, GAME_H - 100, 'Нажми ПРОБЕЛ для старта', {
      fontFamily: 'monospace', fontSize: '20px', color: '#ffd54f',
    }).setOrigin(0.5);

    this.input.keyboard.once('keydown-SPACE', () => this.scene.start('GameScene'));
    // также любая кнопка геймпада
    this.pollGamepad();
  }
  pollGamepad() {
    const tick = () => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const p of pads) {
        if (!p) continue;
        if (p.buttons.some(b => b && b.pressed)) {
          this.scene.start('GameScene');
          return;
        }
      }
      this.time.delayedCall(50, tick);
    };
    tick();
  }
}
```

- [ ] **Step 2: Регистрация MenuScene + старт с неё**

В `src/main.js`:
```js
import { MenuScene } from './scenes/MenuScene.js';
// ...
scene: [BootScene, MenuScene, GameScene, UIScene, GameOverScene, VictoryScene],
```

В `src/scenes/BootScene.js` в конце:
```js
this.scene.start('MenuScene');
```

- [ ] **Step 3: Статистика в GameScene**

В `create()`:
```js
this.stats = {
  startedAt: this.time.now,
  monstersKilled: 0,
  totalCells: this.countFloorCells(),
};
```
Метод:
```js
countFloorCells() {
  let n = 0;
  for (const row of this.map.tiles) for (const t of row) if (t !== TILE.WALL) n++;
  return n;
}
exploredPercent() {
  let n = 0;
  for (const row of this.fog.explored) for (const v of row) if (v) n++;
  return Math.round((n / this.stats.totalCells) * 100);
}
```

Учёт убитых: в коллбэке монстра при `takeDamage` возвращает true:
```js
if (m.takeDamage(1)) {
  this.stats.monstersKilled++;
  this.monsters = this.monsters.filter(x => x !== m);
}
```

При переходе на GameOver/Victory:
```js
const summary = {
  timeSec: Math.floor((this.time.now - this.stats.startedAt) / 1000),
  killed: this.stats.monstersKilled,
  explored: this.exploredPercent(),
};
this.scene.start('GameOverScene', summary);
// и для VictoryScene
this.scene.start('VictoryScene', summary);
```

- [ ] **Step 4: Показ статистики на конечных экранах**

`src/scenes/GameOverScene.js`:
```js
create(summary = {}) {
  this.cameras.main.setBackgroundColor(0x201010);
  this.add.text(GAME_W / 2, GAME_H / 2 - 80, 'Вы погибли', {
    fontFamily: 'monospace', fontSize: '48px', color: '#ff5252',
  }).setOrigin(0.5);
  const lines = [
    `Время: ${summary.timeSec ?? 0} с`,
    `Убито монстров: ${summary.killed ?? 0}`,
    `Исследовано: ${summary.explored ?? 0}%`,
  ];
  this.add.text(GAME_W / 2, GAME_H / 2, lines.join('\n'), {
    fontFamily: 'monospace', fontSize: '18px', color: '#dddddd', align: 'center',
  }).setOrigin(0.5);
  this.add.text(GAME_W / 2, GAME_H / 2 + 90, 'ПРОБЕЛ — заново', {
    fontFamily: 'monospace', fontSize: '16px', color: '#888888',
  }).setOrigin(0.5);
  this.input.keyboard.once('keydown-SPACE', () => this.scene.start('GameScene'));
}
```

Аналогично — `VictoryScene` (с зелёным заголовком).

- [ ] **Step 5: UIScene — индикатор устройства**

```js
// в create():
this.deviceIndicator = this.add.text(GAME_W - 12, 8, '', {
  fontFamily: 'monospace', fontSize: '14px', color: '#888888',
}).setOrigin(1, 0);
// в onUpdate(state):
if (state.device != null) {
  this.deviceIndicator.setText(state.device === 'gamepad' ? '🎮 Gamepad' : '⌨ Keyboard');
}
```

В `GameScene.update`:
```js
this.game.events.emit('hud:update', { device: this.inputSys.activeDevice });
```

- [ ] **Step 6: Активация приманки**

Решим через секретное нажатие `Q` / `B` на геймпаде, плюс добавим в Input edge для lure-throw — но проще: при взаимодействии (`interact`), если нет сундука рядом — выбрасывает приманку, если она в наличии.

В `GameScene.update`, в блоке `if (input.interact && this.nearestChest)` сделать так:
```js
if (input.interact) {
  if (this.nearestChest) {
    // ... как было
  } else if ((this.player.lureCharges || 0) > 0) {
    this.throwLure();
  }
}
```

Метод `throwLure()`:
```js
throwLure() {
  this.player.lureCharges -= 1;
  // направление: куда смотрит игрок (по последнему move; fallback — вправо)
  const dir = this.lastMoveDir || { x: 1, y: 0 };
  const tx = Math.floor(this.player.sprite.x / TILE_SIZE) + Math.round(dir.x * LURE_THROW_TILES);
  const ty = Math.floor(this.player.sprite.y / TILE_SIZE) + Math.round(dir.y * LURE_THROW_TILES);
  const safeTx = Math.max(1, Math.min(GRID_W - 2, tx));
  const safeTy = Math.max(1, Math.min(GRID_H - 2, ty));
  const w = this.map.tileToWorld(safeTx, safeTy);
  const lure = this.add.circle(w.x, w.y, 8, 0xffeb3b).setDepth(6);
  this.lure = { x: w.x, y: w.y, tile: { x: safeTx, y: safeTy }, expiresAt: this.time.now + LURE_DURATION_MS, sprite: lure };
  this.time.delayedCall(LURE_DURATION_MS, () => {
    lure.destroy();
    if (this.lure && this.lure.sprite === lure) this.lure = null;
  });
}
```

Сохранение `lastMoveDir`: в update после чтения input:
```js
if (input.move.x !== 0 || input.move.y !== 0) {
  this.lastMoveDir = { x: input.move.x, y: input.move.y };
}
```

Влияние приманки на монстров: в каждом монстре пересчёт target смотрит сначала на приманку, если она в радиусе.

В каждом monster.update заменить `const pt = player tile` на helper, который проверяет `scene.lure`:

В `src/entities/Monster.js` базовый класс:
```js
import { LURE_RANGE_TILES, TILE_SIZE } from '../config/constants.js';
// ...
getTargetTile(player) {
  const lure = this.scene.lure;
  const mt = this.tilePos();
  if (lure) {
    const dx = lure.tile.x - mt.x, dy = lure.tile.y - mt.y;
    if (Math.hypot(dx, dy) <= LURE_RANGE_TILES) return lure.tile;
  }
  return {
    x: Math.floor(player.sprite.x / TILE_SIZE),
    y: Math.floor(player.sprite.y / TILE_SIZE),
  };
}
```

И во всех конкретных классах вместо `pt = player tile` вызвать `const pt = this.getTargetTile(player);`.

- [ ] **Step 7: Manual verification**

Reload:
- При запуске — MenuScene. Пробел / кнопка геймпада → начало игры.
- В правом верхнем углу — иконка активного устройства (меняется при смене ввода).
- Game Over / Victory — статистика: время, убито монстров, % исследовано.
- При наличии приманки и отсутствии сундука рядом — нажатие E/X бросает приманку, монстры в радиусе 8 тайлов идут к ней 5 секунд.

- [ ] **Step 8: Commit**

```sh
git add src/
git commit -m "feat(stage-13): main menu, end-game stats, device indicator, lure throwing"
```

---

## Финальная проверка

- [ ] **Шаг A: Прогнать все тесты**

Run: `node --test tests/`
Expected: PASS — все тесты зелёные.

- [ ] **Шаг B: Полный playthrough в браузере**

- Сыграть полный круг: MenuScene → GameScene → пройти лабиринт → VictoryScene → MenuScene.
- Сыграть с поражением: погибнуть от монстра → GameOverScene → начать заново.
- Открыть несколько сундуков: получить и power-up, и debuff.
- Использовать все механики: спринт, dash, стрельба, ключ к двери, приманка, компас.
- Проверить оба устройства ввода: переключение и подсказка устройства.

- [ ] **Шаг C: Финальный коммит — обновить README с инструкцией запуска**

В `README.md` обновить раздел запуска:
```md
## Запуск

```sh
python3 -m http.server 8080
# открыть http://localhost:8080
```

## Тесты

```sh
node --test tests/
```

## Управление

| Действие | Клавиатура | Xbox-геймпад |
|---|---|---|
| Движение | WASD / стрелки | левый стик |
| Прицел | курсор мыши | правый стик |
| Стрельба | ЛКМ | правый стик отклонён (авто-fire) |
| Спринт | Shift | LT |
| Рывок | Space | A |
| Взаимодействие | E | X |
| Пауза | Esc | Start |
```

```sh
git add README.md
git commit -m "docs: add controls table and run instructions"
```

- [ ] **Шаг D: Push**

```sh
git push origin main
```
