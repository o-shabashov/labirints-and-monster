import { TILE } from '../config/constants.js';

// Грубая line-of-sight по сетке: дискретизируем отрезок (x0,y0)→(x1,y1) равными шагами
// и проверяем, попадает ли хоть один промежуточный тайл в стену. Стартовый и конечный
// тайлы НЕ проверяются — игрок и цель могут стоять «на» них.
export function hasLineOfSight(tiles, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  if (steps <= 1) return true;
  for (let i = 1; i < steps; i++) {
    const x = Math.round(x0 + (dx * i) / steps);
    const y = Math.round(y0 + (dy * i) / steps);
    const row = tiles[y];
    if (row && row[x] === TILE.WALL) return false;
  }
  return true;
}
