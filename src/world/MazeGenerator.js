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

  // Размещение дверей и ключей
  const path = findPath(grid, sx, sy, bestX, bestY);
  const bridges = findBridgesOnPath(grid, path);
  const doorColors = [TILE.DOOR_R, TILE.DOOR_G, TILE.DOOR_B];
  const keyColors = ['r', 'g', 'b'];
  const keys = [];   // { color, x, y }

  const rand = rng(seed ^ 0xABCDEF);
  const doorsToPlace = bridges.length > 0
    ? Math.min(bridges.length, 1 + Math.floor(rand() * 3))  // 1..3
    : 0;
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
}
