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
