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
