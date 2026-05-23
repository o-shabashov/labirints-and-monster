import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { VictoryScene } from './scenes/VictoryScene.js';
import { GAME_W, GAME_H } from './config/constants.js';

const config = {
  type: Phaser.AUTO,
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#111418',
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [BootScene, GameScene, GameOverScene, VictoryScene],
};

window.__game = new Phaser.Game(config);
