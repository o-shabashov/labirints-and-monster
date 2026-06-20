// Синтетические звуки для 3D-режима через Web Audio API — без .ogg.
// Контекст создаётся лениво и резюмится по первому user-gesture (lock).

let actx = null;
function ctx() {
  if (!actx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) actx = new AC();
  }
  return actx;
}

export const Sound3D = {
  resume() {
    const c = ctx();
    if (c && c.state === 'suspended') c.resume();
  },

  // короткий «пиу» обычного выстрела
  shoot() {
    const c = ctx(); if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(660, t);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.12);
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + 0.12);
  },

  // whoosh ракеты
  rocket() {
    const c = ctx(); if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(280, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.3);
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + 0.3);
  },

  // boom + noise burst
  explosion() {
    const c = ctx(); if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator(), og = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.4);
    og.gain.setValueAtTime(0.5, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    o.connect(og).connect(c.destination);
    o.start(t); o.stop(t + 0.4);
    const len = Math.floor(c.sampleRate * 0.3);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1);
    const n = c.createBufferSource(); n.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(2200, t);
    f.frequency.exponentialRampToValueAtTime(200, t + 0.3);
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.4, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    n.connect(f).connect(ng).connect(c.destination);
    n.start(t); n.stop(t + 0.3);
  },

  // выстрел дробовика — шумовой burst + низкий удар
  shotgun() {
    const c = ctx(); if (!c) return;
    const t = c.currentTime;
    const len = Math.floor(c.sampleRate * 0.18);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const n = c.createBufferSource(); n.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(2000, t);
    f.frequency.exponentialRampToValueAtTime(300, t + 0.15);
    const g = c.createGain();
    g.gain.setValueAtTime(0.34, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    n.connect(f).connect(g).connect(c.destination);
    n.start(t); n.stop(t + 0.18);
    const o = c.createOscillator(), og = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.14);
    og.gain.setValueAtTime(0.3, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(og).connect(c.destination);
    o.start(t); o.stop(t + 0.14);
  },

  // звонкий «чпок» попадания по монстру
  hit() {
    const c = ctx(); if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(440, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + 0.08);
  },

  // глухой удар при получении урона
  hurt() {
    const c = ctx(); if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.2);
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + 0.2);
  },

  // тихий шаг
  step() {
    const c = ctx(); if (!c) return;
    const t = c.currentTime;
    const len = Math.floor(c.sampleRate * 0.05);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const n = c.createBufferSource(); n.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 350;
    const g = c.createGain(); g.gain.value = 0.08;
    n.connect(f).connect(g).connect(c.destination);
    n.start(t);
  },
};
