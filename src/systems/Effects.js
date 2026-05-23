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
