import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { generateMaze } from '../src/world/MazeGenerator.js';
import { TILE } from '../src/config/constants.js';

test('generateMaze: returns 2D grid of given size', () => {
  const { grid } = generateMaze(31, 21, 42);
  assert.equal(grid.length, 21);
  assert.equal(grid[0].length, 31);
});

test('generateMaze: borders are all walls', () => {
  const { grid } = generateMaze(31, 21, 42);
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
  const { grid } = generateMaze(31, 21, 42);
  let e = 0, x = 0;
  for (const row of grid) for (const t of row) {
    if (t === TILE.ENTRANCE) e++;
    if (t === TILE.EXIT) x++;
  }
  assert.equal(e, 1);
  assert.equal(x, 1);
});

test('generateMaze: all floor cells are reachable from entrance', () => {
  const { grid } = generateMaze(31, 21, 42);
  // find entrance
  let sx = -1, sy = -1;
  for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid[0].length; x++) {
    if (grid[y][x] === TILE.ENTRANCE) { sx = x; sy = y; }
  }
  // BFS — двери НЕ проходимы, но floor/entrance/exit — да
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
  // подсчёт всех non-wall клеток (включая двери)
  let nonWall = 0;
  for (const row of grid) for (const t of row) if (t !== TILE.WALL) nonWall++;
  assert.equal(reachable, nonWall, 'all non-wall cells must be reachable from entrance');
});

test('generateMaze: same seed -> same maze', () => {
  const a = generateMaze(31, 21, 1234);
  const b = generateMaze(31, 21, 1234);
  assert.deepEqual(a, b);
});
