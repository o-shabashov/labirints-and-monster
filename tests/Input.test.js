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
