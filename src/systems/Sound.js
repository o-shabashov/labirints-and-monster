// Тонкая обёртка над Phaser SoundManager.
// Все ассеты загружаются BootScene.preload (см. ключи 'sfx_*' и 'music_dungeon'),
// здесь — только удобные именованные методы и singleton-доступ.

let instance = null;

export function getSound() {
  if (!instance) instance = new Sound();
  return instance;
}

class Sound {
  constructor() {
    this.game = null;
    this.music = null;
  }

  attach(game) {
    this.game = game;
  }

  // Вызывается из MenuScene на первый нажатый «начать игру» — Phaser
  // автоматически unlock'ит audio context после этого user gesture.
  resume() {
    if (this.game && this.game.sound && this.game.sound.context && this.game.sound.context.state === 'suspended') {
      this.game.sound.context.resume();
    }
  }

  play(key, volume = 0.6) {
    if (!this.game || !this.game.cache.audio.has(key)) return;
    this.game.sound.play(key, { volume });
  }

  // ---- SFX ----
  shoot()         { this.play('sfx_shoot', 0.35); }
  hit()           { this.play('sfx_hit', 0.5); }
  playerHurt()    { this.play('sfx_player_hurt', 0.6); }
  monsterKilled() { this.play('sfx_monster_killed', 0.55); }
  heal()          { this.play('sfx_heal', 0.55); }
  keyPickup()     { this.play('sfx_key_pickup', 0.55); }
  pickup()        { this.play('sfx_pickup', 0.5); }
  dash()          { this.play('sfx_dash', 0.45); }
  door()          { this.play('sfx_door', 0.55); }
  chestPower()    { this.play('sfx_chest_power', 0.55); }
  chestDebuff()   { this.play('sfx_chest_debuff', 0.55); }
  victory()       { this.play('sfx_victory', 0.6); }
  gameover()      { this.play('sfx_gameover', 0.6); }

  // ---- Синтетические звуки через Web Audio (без новых .ogg ассетов) ----
  // Ракета: низкий «whoosh» — пилообразный sweep 280→60Hz за 0.3с.
  rocketShoot() {
    const ctx = this.game && this.game.sound && this.game.sound.context;
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.3);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  // Взрыв: суммарно ~0.4с — низкий sine boom + lowpass-filtered noise burst.
  explosion() {
    const ctx = this.game && this.game.sound && this.game.sound.context;
    if (!ctx) return;
    const t = ctx.currentTime;
    // 1. Низкий boom — sine 120→30 Hz
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.4);
    oscGain.gain.setValueAtTime(0.45, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(oscGain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
    // 2. Шумовой burst через lowpass-фильтр (сэмпл 0.3с белого шума)
    const len = Math.floor(ctx.sampleRate * 0.3);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() - 0.5) * 2;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(2200, t);
    filt.frequency.exponentialRampToValueAtTime(200, t + 0.3);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    noise.connect(filt).connect(noiseGain).connect(ctx.destination);
    noise.start(t);
    noise.stop(t + 0.3);
  }

  // ---- Фоновая музыка ----
  startMusic() {
    if (!this.game || this.music) return;
    if (!this.game.cache.audio.has('music_dungeon')) return;
    this.music = this.game.sound.add('music_dungeon', { loop: true, volume: 0.18 });
    this.music.play();
  }

  stopMusic() {
    if (!this.music) return;
    try { this.music.stop(); } catch {}
    this.music.destroy();
    this.music = null;
  }
}
