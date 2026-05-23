import { PLAYER_SPEED } from '../config/constants.js';

export class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.sprite = scene.physics.add.sprite(x, y, 'player');
    this.sprite.setCollideWorldBounds(true);
  }

  update(input) {
    const body = this.sprite.body;
    body.setVelocity(input.move.x * PLAYER_SPEED, input.move.y * PLAYER_SPEED);
  }
}
