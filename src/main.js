import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';
import { ChestScene } from './scenes/ChestScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { VictoryScene } from './scenes/VictoryScene.js';
import { GAME_W, CANVAS_H } from './config/constants.js';

const config = {
  type: Phaser.AUTO,
  backgroundColor: '#111418',
  // Pixel-art стиль: NEAREST-сэмплинг для текстур, без blur'а на спрайтах
  // и стенах. Текст получается крупный и «пиксельный», но это вписывается
  // в стилистику dungeon-арта 0x72 — лучше чем мутный antialias.
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_W,
    height: CANVAS_H,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [BootScene, MenuScene, GameScene, UIScene, ChestScene, GameOverScene, VictoryScene],
};

import { getSound } from './systems/Sound.js';

window.__game = new Phaser.Game(config);
getSound().attach(window.__game);
