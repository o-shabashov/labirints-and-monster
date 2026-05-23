import { KNOCKBACK_SPEED, KNOCKBACK_MS, IFRAMES_MS } from '../config/constants.js';

export function applyKnockback(targetSprite, fromX, fromY) {
  const dx = targetSprite.x - fromX;
  const dy = targetSprite.y - fromY;
  const d = Math.hypot(dx, dy) || 1;
  targetSprite.body.setVelocity((dx / d) * KNOCKBACK_SPEED, (dy / d) * KNOCKBACK_SPEED);
}

export const KNOCKBACK_DURATION = KNOCKBACK_MS;
export const INVULNERABILITY_DURATION = IFRAMES_MS;
