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
