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

// Recursive backtracker с шагом 3 — узкие стены, широкие проходы.
//
// Сетка nodes: каждый узел — это «комната» 2×2 floor-клеток в левом-верхнем
// углу (n*3+1, m*3+1). Между двумя соседними узлами по оси — одна wall-клетка.
// Carve между ними прорубает widening: само ребро (1 клетка) + расширения
// в перпендикулярную ось для обоих узлов.
//
// Результат: стены тонкие (1 клетка), проходы и комнаты — 2 клетки шириной.
function carve(grid, w, h, seed) {
  const rand = rng(seed);
  const stack = [[1, 1]];
  const passages = [];  // proходы между узлами: для placement дверей
  paintRoom(grid, 1, 1);
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const dirs = shuffle([[3,0],[-3,0],[0,3],[0,-3]], rand);
    let carved = false;
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (nx <= 0 || ny <= 0 || nx >= w - 1 || ny >= h - 1) continue;
      if (grid[ny][nx] !== TILE.WALL) continue;
      paintRoom(grid, nx, ny);
      // Стена между двумя 2×2 комнатами — это столбец/строка единичной толщины,
      // расположенный ВНЕ обеих комнат. От (x,y) топ-левт комнаты до (nx,ny)
      // топ-левт следующей: при dx>0 wall на колонке x+2, при dx<0 на x-1.
      let cells;
      if (dy === 0) {
        const bx = dx > 0 ? x + 2 : x - 1;
        cells = [{ x: bx, y }, { x: bx, y: y + 1 }];
      } else {
        const by = dy > 0 ? y + 2 : y - 1;
        cells = [{ x, y: by }, { x: x + 1, y: by }];
      }
      for (const c of cells) {
        if (c.x > 0 && c.x < w - 1 && c.y > 0 && c.y < h - 1) {
          grid[c.y][c.x] = TILE.FLOOR;
        }
      }
      passages.push({ cells, between: [{ x, y }, { x: nx, y: ny }] });
      stack.push([nx, ny]);
      carved = true;
      break;
    }
    if (!carved) stack.pop();
  }
  return passages;
}

function paintRoom(grid, x, y) {
  const h = grid.length, w = grid[0].length;
  grid[y][x] = TILE.FLOOR;
  if (x + 1 < w - 1) grid[y][x + 1] = TILE.FLOOR;
  if (y + 1 < h - 1) grid[y + 1][x] = TILE.FLOOR;
  if (x + 1 < w - 1 && y + 1 < h - 1) grid[y + 1][x + 1] = TILE.FLOOR;
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

export function generateMaze(width, height, seed = Date.now()) {
  if (width % 2 === 0) width++;
  if (height % 2 === 0) height++;
  const grid = Array.from({ length: height }, () => new Array(width).fill(TILE.WALL));
  const passages = carve(grid, width, height, seed);

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

  // двери — pairs клеток (проёмы шириной 2). Выбираем passages на пути.
  const path = findPath(grid, sx, sy, bestX, bestY);
  const onPath = new Set(path.map(p => p.y * width + p.x));
  const pathPassages = passages.filter(p =>
    p.cells.some(c => onPath.has(c.y * width + c.x))
  );

  const doorColors = [TILE.DOOR_R, TILE.DOOR_G, TILE.DOOR_B];
  const keyColors = ['r', 'g', 'b'];
  const keys = [];
  const doors = [];

  const rand = rng(seed ^ 0xABCDEF);
  const doorsToPlace = pathPassages.length > 0
    ? Math.min(pathPassages.length, 1 + Math.floor(rand() * 3))  // 1..3
    : 0;
  const used = new Set();
  for (let i = 0; i < doorsToPlace; i++) {
    let pick;
    for (let tries = 0; tries < 30; tries++) {
      pick = pathPassages[Math.floor(rand() * pathPassages.length)];
      const key = pick.cells[0].y * width + pick.cells[0].x;
      if (!used.has(key)) { used.add(key); break; }
    }
    const tile = doorColors[i];
    for (const c of pick.cells) grid[c.y][c.x] = tile;
    doors.push({ color: keyColors[i], cells: pick.cells.slice() });
    // ключ — в области, доступной из входа без этой двери; обязательно
    // НЕ рядом с ней самой (минимум 5 клеток), иначе подбор обесмысленный.
    const blocked = new Set(pick.cells.map(c => c.y * width + c.x));
    const safe = findReachableExcludingMulti(grid, sx, sy, blocked);
    const doorCenter = pick.cells[0];
    const MIN_KEY_DIST = 5;
    let far = safe.filter(c =>
      Math.hypot(c.x - doorCenter.x, c.y - doorCenter.y) >= MIN_KEY_DIST
    );
    if (far.length === 0) far = safe;  // fallback на крошечных лабиринтах
    if (far.length > 0) {
      const cell = far[Math.floor(rand() * far.length)];
      keys.push({ color: keyColors[i], x: cell.x, y: cell.y });
    }
  }
  return { grid, keys, doors };
}

function findReachableExcludingMulti(grid, sx, sy, blockedSet) {
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
      if (blockedSet.has(ny * w + nx)) continue;
      if (grid[ny][nx] === TILE.WALL) continue;
      visited[ny][nx] = true;
      q.push([nx, ny]);
    }
  }
  return result;
}
