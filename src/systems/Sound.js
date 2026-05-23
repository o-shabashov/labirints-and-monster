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
