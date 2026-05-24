import { log } from './Logger.js';

// Адаптивная сложность через rolling-window метрики.
//
// Идея: трекаем убийства игрока и полученный урон за последние 60 секунд.
// Если игрок убивает много и не получает урон → multiplier растёт →
// монстры быстрее tier'аются и больше спавнятся. Если игрок страдает —
// multiplier падает, игра становится легче.
//
// Use:
//   trackKill(now)      — после убийства моба
//   trackDamage(now)    — после takeHit игрока
//   multiplier(now)     — текущий 0.7..1.6 (1.0 = baseline)
//
// State-machine скорее не FSM, а continuous: один float multiplier
// со sliding-window истории. Это проще FSM и реактивнее.

const WINDOW_MS              = 60_000;
const TARGET_KILLS_PER_MIN   = 12;     // baseline комфорт
const TARGET_DAMAGE_PER_MIN  = 2;
const KILL_WEIGHT            = 0.04;   // +4% multiplier за каждый kill сверх target
const DAMAGE_WEIGHT          = 0.10;   // -10% за каждый damage сверх target
const MULT_MIN               = 0.7;
const MULT_MAX               = 1.6;

export class Difficulty {
  constructor() {
    this.killTimes = [];
    this.damageTimes = [];
    this._lastLoggedMult = 1.0;
  }

  trackKill(now) {
    this.killTimes.push(now);
    this._trim(now);
  }

  trackDamage(now) {
    this.damageTimes.push(now);
    this._trim(now);
  }

  _trim(now) {
    const cutoff = now - WINDOW_MS;
    while (this.killTimes.length && this.killTimes[0] < cutoff) this.killTimes.shift();
    while (this.damageTimes.length && this.damageTimes[0] < cutoff) this.damageTimes.shift();
  }

  multiplier(now) {
    this._trim(now);
    const kpm = this.killTimes.length;
    const dpm = this.damageTimes.length;
    let m = 1.0;
    if (kpm > TARGET_KILLS_PER_MIN) m += (kpm - TARGET_KILLS_PER_MIN) * KILL_WEIGHT;
    if (dpm > TARGET_DAMAGE_PER_MIN) m -= (dpm - TARGET_DAMAGE_PER_MIN) * DAMAGE_WEIGHT;
    m = Math.max(MULT_MIN, Math.min(MULT_MAX, m));
    if (Math.abs(m - this._lastLoggedMult) > 0.05) {
      log('difficulty', 'shift', { from: this._lastLoggedMult.toFixed(2), to: m.toFixed(2), kpm, dpm });
      this._lastLoggedMult = m;
    }
    return m;
  }

  // Снимок для HUD/отладки.
  snapshot(now) {
    this._trim(now);
    return {
      multiplier: this.multiplier(now),
      kpm: this.killTimes.length,
      dpm: this.damageTimes.length,
    };
  }
}
