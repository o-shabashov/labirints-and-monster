// Простой WebAudio-синтезатор для SFX и фоновой музыки.
// Без внешних файлов: всё генерируется на лету (square/sawtooth/sine + noise buffers).

let instance = null;

export function getSound() {
  if (!instance) instance = new Sound();
  return instance;
}

class Sound {
  constructor() {
    this.ctx = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicNodes = null;
  }

  ensure() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.35;
    this.sfxGain.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.08;
    this.musicGain.connect(this.ctx.destination);
  }

  // должно вызываться из user-gesture (нажатие кнопки/клавиши), иначе браузер
  // оставляет ctx в состоянии 'suspended'.
  resume() {
    this.ensure();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  _beep(freq, dur, type = 'square', gain = 0.3, freqEnd = null) {
    this.ensure();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd != null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  _noise(dur, gain = 0.3, filterFreq = null, hipass = false) {
    this.ensure();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    let node = src;
    if (filterFreq) {
      const f = this.ctx.createBiquadFilter();
      f.type = hipass ? 'highpass' : 'lowpass';
      f.frequency.value = filterFreq;
      src.connect(f);
      node = f;
    }
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    node.connect(g).connect(this.sfxGain);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // ---- SFX ----
  shoot()         { this._beep(720, 0.07, 'square', 0.25, 360); }
  hit()           { this._noise(0.08, 0.35, 1500); }
  playerHurt()    { this._beep(440, 0.18, 'sawtooth', 0.3, 110); }
  monsterKilled() { this._noise(0.18, 0.4, 600); }
  pickup()        { this._beep(660, 0.1, 'sine', 0.35, 1320); }
  heal()          { this._beep(523, 0.12, 'sine', 0.35, 988); }
  chestPower()    { this._beep(523, 0.12, 'triangle', 0.35); setTimeout(() => this._beep(784, 0.18, 'triangle', 0.35), 90); }
  chestDebuff()   { this._beep(220, 0.18, 'sawtooth', 0.35, 110); setTimeout(() => this._beep(165, 0.18, 'sawtooth', 0.3, 82), 90); }
  dash()          { this._noise(0.15, 0.3, 1200, true); }
  door()          { this._beep(180, 0.12, 'square', 0.3); }
  keyPickup()     { this._beep(880, 0.08, 'triangle', 0.4); setTimeout(() => this._beep(1320, 0.1, 'triangle', 0.4), 60); }
  victory()       { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this._beep(f, 0.18, 'triangle', 0.4), i * 100)); }
  gameover()      { [330, 262, 196, 147].forEach((f, i) => setTimeout(() => this._beep(f, 0.28, 'sawtooth', 0.35), i * 140)); }

  // ---- Фоновая музыка ----
  // Бесконечный «dungeon ambient»: низкий sawtooth + триangle октавой выше через
  // медленно «дышащий» low-pass. Дёшево и атмосферно.
  startMusic() {
    this.ensure();
    if (!this.ctx || this.musicNodes) return;
    const ctx = this.ctx;
    const osc1 = ctx.createOscillator(); osc1.type = 'sawtooth'; osc1.frequency.value = 55;
    const osc2 = ctx.createOscillator(); osc2.type = 'triangle'; osc2.frequency.value = 110;
    const osc3 = ctx.createOscillator(); osc3.type = 'sine';     osc3.frequency.value = 165;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 360; filter.Q.value = 6;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 220;
    lfo.connect(lfoGain).connect(filter.frequency);
    osc1.connect(filter);
    osc2.connect(filter);
    osc3.connect(filter);
    filter.connect(this.musicGain);
    const t = ctx.currentTime;
    osc1.start(t); osc2.start(t); osc3.start(t); lfo.start(t);
    this.musicNodes = { osc1, osc2, osc3, lfo, filter };
  }

  stopMusic() {
    if (!this.musicNodes) return;
    const t = this.ctx.currentTime;
    try {
      this.musicNodes.osc1.stop(t);
      this.musicNodes.osc2.stop(t);
      this.musicNodes.osc3.stop(t);
      this.musicNodes.lfo.stop(t);
    } catch {}
    this.musicNodes = null;
  }
}
