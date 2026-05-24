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

// Публичная точка входа: 50/50 случайно выбирает алгоритм.
// Публичная точка входа: по умолчанию hybrid (корридор-лабиринт + 3–5 комнат
// внутри). 'corridor' и 'rooms' доступны как чистые варианты.
export function generateMaze(width, height, seed = Date.now(), style = null) {
  if (!style) style = 'hybrid';
  let result;
  if (style === 'rooms') result = generateRoomDungeon(width, height, seed);
  else if (style === 'corridor') result = generateCorridorMaze(width, height, seed);
  else result = generateHybridDungeon(width, height, seed);
  markSolidWalls(result.grid, result.doors);
  return result;
}

// Помечает неразрушимые стены: внешний периметр + клетки, примыкающие к
// дверям. Так maze сохраняет смысл при разрушаемых стенах — нельзя пробить
// границу карты или обойти дверь по soft-стенке вокруг неё.
function markSolidWalls(grid, doors) {
  const h = grid.length, w = grid[0].length;
  for (let x = 0; x < w; x++) {
    if (grid[0][x]     === TILE.WALL) grid[0][x]     = TILE.SOLID_WALL;
    if (grid[h - 1][x] === TILE.WALL) grid[h - 1][x] = TILE.SOLID_WALL;
  }
  for (let y = 0; y < h; y++) {
    if (grid[y][0]     === TILE.WALL) grid[y][0]     = TILE.SOLID_WALL;
    if (grid[y][w - 1] === TILE.WALL) grid[y][w - 1] = TILE.SOLID_WALL;
  }
  for (const d of (doors || [])) {
    for (const cell of d.cells) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cell.x + dx, ny = cell.y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (grid[ny][nx] === TILE.WALL) grid[ny][nx] = TILE.SOLID_WALL;
      }
    }
  }
}

// Hybrid: сначала прокладываем corridor-maze step=3 (узкие проходы +
// расширения), затем вкрапливаем 3–5 случайных открытых комнат поверх стен.
// Комнаты автоматически связываются с maze, потому что carve gridit FLOOR
// поверх уже выстроенной сетки.
function generateHybridDungeon(width, height, seed) {
  if (width % 2 === 0) width++;
  if (height % 2 === 0) height++;
  const grid = Array.from({ length: height }, () => new Array(width).fill(TILE.WALL));
  const passages = carve(grid, width, height, seed);
  addRandomRooms(grid, width, height, seed ^ 0xC0FFEE);
  return placeEntranceExitDoors(grid, width, height, passages, seed);
}

function addRandomRooms(grid, width, height, seed) {
  const rand = mulberry(seed);
  const rooms = [];
  const target = 3 + Math.floor(rand() * 3);  // 3..5 комнат
  for (let tries = 0; tries < 40 && rooms.length < target; tries++) {
    const rw = 4 + Math.floor(rand() * 3);    // 4..6
    const rh = 4 + Math.floor(rand() * 3);
    if (width - rw - 4 < 1 || height - rh - 4 < 1) continue;
    const rx = 2 + Math.floor(rand() * (width - rw - 4));
    const ry = 2 + Math.floor(rand() * (height - rh - 4));
    // отступ 2 между комнатами, иначе rooms сливаются в одну гигантскую кашу
    const overlaps = rooms.some(r =>
      rx < r.x + r.w + 2 && rx + rw + 2 > r.x &&
      ry < r.y + r.h + 2 && ry + rh + 2 > r.y
    );
    if (overlaps) continue;
    for (let y = ry; y < ry + rh; y++) {
      for (let x = rx; x < rx + rw; x++) {
        if (x > 0 && x < width - 1 && y > 0 && y < height - 1) grid[y][x] = TILE.FLOOR;
      }
    }
    rooms.push({ x: rx, y: ry, w: rw, h: rh });
  }
  return rooms;
}

// общий пост-процесс: entrance/exit + двери/ключи на bottleneck-клетках пути.
function placeEntranceExitDoors(grid, width, height, passages, seed) {
  const sx = 1, sy = 1;
  // если стартовая клетка попала под комнату, ENTRANCE всё равно ставим — она floor.
  grid[sy][sx] = TILE.ENTRANCE;
  const dist = bfsDistances(grid, sx, sy);
  let bestX = sx, bestY = sy, bestD = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (dist[y][x] > bestD) { bestD = dist[y][x]; bestX = x; bestY = y; }
  }
  grid[bestY][bestX] = TILE.EXIT;

  // двери — на passages, лежащих на пути. Сначала пробуем «узкие» (бутылочные
  // горла, где обоих боков остались стены — комнаты не съели). Если их мало —
  // расширяем пул до любых passages на пути.
  const path = findPath(grid, sx, sy, bestX, bestY);
  const onPath = new Set(path.map(p => p.y * width + p.x));
  const onPathPassages = (passages || []).filter(p =>
    p.cells.some(c => onPath.has(c.y * width + c.x))
  );
  const isNarrow = (p) => p.cells.every(c => {
    const horizontalGap = grid[c.y][c.x - 1] === TILE.WALL && grid[c.y][c.x + 1] === TILE.WALL;
    const verticalGap   = grid[c.y - 1] && grid[c.y - 1][c.x] === TILE.WALL && grid[c.y + 1] && grid[c.y + 1][c.x] === TILE.WALL;
    return horizontalGap || verticalGap;
  });
  const narrowPassages = onPathPassages.filter(isNarrow);
  // если узких нет (всё съели комнаты) — fall back на любые passages на пути
  const doorPool = narrowPassages.length >= 1 ? narrowPassages : onPathPassages;

  const doorColors = [TILE.DOOR_R, TILE.DOOR_G, TILE.DOOR_B];
  const keyColors = ['r', 'g', 'b'];
  const keys = [], doors = [];
  const rand = mulberry(seed ^ 0xABCDEF);
  const doorsToPlace = doorPool.length > 0
    ? Math.min(doorPool.length, 1 + Math.floor(rand() * 3))
    : 0;
  const used = new Set();
  for (let i = 0; i < doorsToPlace; i++) {
    let pick;
    for (let t = 0; t < 30; t++) {
      pick = doorPool[Math.floor(rand() * doorPool.length)];
      const key = pick.cells[0].y * width + pick.cells[0].x;
      if (!used.has(key)) { used.add(key); break; }
    }
    const tile = doorColors[i];
    // bounds — carve мог сохранить в passages cell за пределами области
    // (y+1 == height-1 на нижней строке), эти клетки скипаем.
    const inside = pick.cells.filter(c =>
      c.x > 0 && c.x < width - 1 && c.y > 0 && c.y < height - 1
    );
    if (inside.length === 0) { i--; continue; }
    for (const c of inside) grid[c.y][c.x] = tile;
    doors.push({ color: keyColors[i], cells: inside });
    const blocked = new Set(inside.map(c => c.y * width + c.x));
    const safe = findReachableExcludingMulti(grid, sx, sy, blocked);
    const far = safe.filter(c =>
      Math.hypot(c.x - pick.cells[0].x, c.y - pick.cells[0].y) >= 5
    );
    const pool = far.length ? far : safe;
    if (pool.length) {
      const cell = pool[Math.floor(rand() * pool.length)];
      keys.push({ color: keyColors[i], x: cell.x, y: cell.y });
    }
  }
  return { grid, keys, doors };
}

function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// BSP room dungeon: рекурсивно делим прямоугольник, в каждом листе строим
// случайную комнату, соединяем сиблинг-комнаты L-shaped corridor'ом.
function generateRoomDungeon(width, height, seed) {
  if (width % 2 === 0) width++;
  if (height % 2 === 0) height++;
  const grid = Array.from({ length: height }, () => new Array(width).fill(TILE.WALL));
  const rand = mulberry(seed);

  const MIN_LEAF = 8;
  const MAX_DEPTH = 5;
  const leaves = [];
  function split(x, y, w, h, depth) {
    const canH = w >= MIN_LEAF * 2 + 2;
    const canV = h >= MIN_LEAF * 2 + 2;
    if (depth >= MAX_DEPTH || (!canH && !canV) || (w < MIN_LEAF * 1.6 && h < MIN_LEAF * 1.6)) {
      leaves.push({ x, y, w, h });
      return;
    }
    const horizontal = canH && canV ? rand() < 0.5 : canH;
    if (horizontal) {
      const cut = MIN_LEAF + Math.floor(rand() * (w - MIN_LEAF * 2));
      split(x, y, cut, h, depth + 1);
      split(x + cut, y, w - cut, h, depth + 1);
    } else {
      const cut = MIN_LEAF + Math.floor(rand() * (h - MIN_LEAF * 2));
      split(x, y, w, cut, depth + 1);
      split(x, y + cut, w, h - cut, depth + 1);
    }
  }
  split(1, 1, width - 2, height - 2, 0);

  // комнаты в каждом листе
  const rooms = [];
  for (const L of leaves) {
    const margin = 1;
    const rw = Math.max(4, L.w - margin * 2 - Math.floor(rand() * 3));
    const rh = Math.max(4, L.h - margin * 2 - Math.floor(rand() * 3));
    const rx = L.x + margin + Math.floor(rand() * Math.max(1, L.w - rw - margin));
    const ry = L.y + margin + Math.floor(rand() * Math.max(1, L.h - rh - margin));
    carveRect(grid, rx, ry, rw, rh);
    rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: Math.floor(rx + rw / 2), cy: Math.floor(ry + rh / 2) });
  }

  // коридоры — соединяем каждый room со следующим (chain), потом немного random links
  // для лупов и развилок.
  rooms.sort((a, b) => (a.cy - b.cy) || (a.cx - b.cx));
  for (let i = 1; i < rooms.length; i++) {
    carveCorridor(grid, rooms[i - 1].cx, rooms[i - 1].cy, rooms[i].cx, rooms[i].cy);
  }
  const extra = Math.floor(rooms.length / 4);
  for (let i = 0; i < extra; i++) {
    const a = rooms[Math.floor(rand() * rooms.length)];
    const b = rooms[Math.floor(rand() * rooms.length)];
    if (a === b) continue;
    carveCorridor(grid, a.cx, a.cy, b.cx, b.cy);
  }

  // entrance — центр первой комнаты, exit — самой дальней по BFS
  const sx = rooms[0].cx, sy = rooms[0].cy;
  grid[sy][sx] = TILE.ENTRANCE;
  const dist = bfsDistances(grid, sx, sy);
  let bestX = sx, bestY = sy, bestD = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (dist[y][x] > bestD) { bestD = dist[y][x]; bestX = x; bestY = y; }
  }
  grid[bestY][bestX] = TILE.EXIT;

  // двери и ключи — на узких местах коридоров между комнатами
  const path = findPath(grid, sx, sy, bestX, bestY);
  const onPath = new Set(path.map(p => p.y * width + p.x));
  const candidates = path.filter(p => {
    if (p.x === sx && p.y === sy) return false;
    if (p.x === bestX && p.y === bestY) return false;
    // wall с обоих боков — это бутылочное горло (corridor)
    const horizontalWalls = grid[p.y - 1] && grid[p.y - 1][p.x] === TILE.WALL && grid[p.y + 1] && grid[p.y + 1][p.x] === TILE.WALL;
    const verticalWalls   = grid[p.y][p.x - 1] === TILE.WALL && grid[p.y][p.x + 1] === TILE.WALL;
    return horizontalWalls || verticalWalls;
  });
  const doorColors = [TILE.DOOR_R, TILE.DOOR_G, TILE.DOOR_B];
  const keyColors = ['r', 'g', 'b'];
  const keys = [], doors = [];
  const doorsToPlace = candidates.length > 0 ? Math.min(candidates.length, 1 + Math.floor(rand() * 3)) : 0;
  const used = new Set();
  for (let i = 0; i < doorsToPlace; i++) {
    let pick;
    for (let t = 0; t < 30; t++) {
      pick = candidates[Math.floor(rand() * candidates.length)];
      const key = pick.y * width + pick.x;
      if (!used.has(key)) { used.add(key); break; }
    }
    const tile = doorColors[i];
    // door занимает 2 клетки в перпендикулярной коридору оси
    const horizontalCorridor = grid[pick.y][pick.x - 1] !== TILE.WALL && grid[pick.y][pick.x + 1] !== TILE.WALL;
    const cells = horizontalCorridor
      ? [{ x: pick.x, y: pick.y }, { x: pick.x, y: pick.y + 1 }]
      : [{ x: pick.x, y: pick.y }, { x: pick.x + 1, y: pick.y }];
    for (const c of cells) {
      if (c.x > 0 && c.x < width - 1 && c.y > 0 && c.y < height - 1) {
        grid[c.y][c.x] = tile;
      }
    }
    doors.push({ color: keyColors[i], cells });
    const blocked = new Set(cells.map(c => c.y * width + c.x));
    const safe = findReachableExcludingMulti(grid, sx, sy, blocked)
      .filter(c => Math.hypot(c.x - pick.x, c.y - pick.y) >= 5);
    if (safe.length) {
      const cell = safe[Math.floor(rand() * safe.length)];
      keys.push({ color: keyColors[i], x: cell.x, y: cell.y });
    }
  }
  return { grid, keys, doors };
}

function carveRect(grid, x, y, w, h) {
  const H = grid.length, W = grid[0].length;
  for (let yy = y; yy < y + h && yy < H - 1; yy++)
    for (let xx = x; xx < x + w && xx < W - 1; xx++)
      if (xx > 0 && yy > 0) grid[yy][xx] = TILE.FLOOR;
}

function carveCorridor(grid, x1, y1, x2, y2) {
  const H = grid.length, W = grid[0].length;
  // L-shape: сперва по X, потом по Y. Делаем коридор шириной 2 для широкого
  // ощущения, как в обычном maze.
  const stepX = x1 < x2 ? 1 : -1;
  for (let x = x1; x !== x2 + stepX; x += stepX) {
    if (x > 0 && x < W - 1 && y1 > 0 && y1 < H - 1) grid[y1][x] = TILE.FLOOR;
    if (x > 0 && x < W - 1 && y1 + 1 > 0 && y1 + 1 < H - 1) grid[y1 + 1][x] = TILE.FLOOR;
  }
  const stepY = y1 < y2 ? 1 : -1;
  for (let y = y1; y !== y2 + stepY; y += stepY) {
    if (x2 > 0 && x2 < W - 1 && y > 0 && y < H - 1) grid[y][x2] = TILE.FLOOR;
    if (x2 + 1 > 0 && x2 + 1 < W - 1 && y > 0 && y < H - 1) grid[y][x2 + 1] = TILE.FLOOR;
  }
}

function generateCorridorMaze(width, height, seed = Date.now()) {
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
