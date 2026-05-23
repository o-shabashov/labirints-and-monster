// Список возможных бафов и дебафов. Дебафы применяются сразу,
// бафы — через ChestScene с предложением 3 вариантов.
export const POWER_UPS = [
  'armor', 'heal', 'compass', 'lure',
  'speed', 'damage', 'rapid_fire', 'vision_boost', 'regen',
  'shield', 'weapon_upgrade',
];

export const DEBUFFS = ['poison', 'slow', 'blindness', 'exhausted', 'weakness'];

export class Chest {
  constructor(scene, x, y) {
    this.scene = scene;
    this.sprite = scene.physics.add.staticImage(x, y, 'chest');
    this.sprite.setScale(1.2);
    this.sprite.refreshBody();
    this.sprite.chestRef = this;
    this.opened = false;
  }

  // Решение что в сундуке: 70% positive (3 случайных бафа на выбор),
  // 30% negative (один случайный дебаф, применяется сразу).
  roll(rand = Math.random) {
    if (this.opened) return null;
    this.opened = true;
    this.sprite.destroy();
    const isPower = rand() < 0.7;
    if (isPower) {
      // три уникальных варианта
      const pool = POWER_UPS.slice();
      const picks = [];
      for (let i = 0; i < 3 && pool.length; i++) {
        const idx = Math.floor(rand() * pool.length);
        picks.push(pool.splice(idx, 1)[0]);
      }
      return { kind: 'choose', options: picks };
    }
    return { kind: 'debuff', type: DEBUFFS[Math.floor(rand() * DEBUFFS.length)] };
  }
}
