import {
  PLAYER_MAX_HP, STAMINA_MAX,
  GAME_W, GAME_H, TOPBAR_H,
} from '../config/constants.js';

export class UIScene extends Phaser.Scene {
  constructor() { super('UIScene'); }
  create() {
    // топ-бар не зависит от мира и виден поверх него:
    this.cameras.main.setViewport(0, 0, GAME_W, TOPBAR_H);
    // фон топбара — тайлы стены из 0x72, чтобы UI выглядел как каменный
    // верх над dungeon, а не пустой прямоугольник. tileSprite повторяет 16×16
    // wall по всему верху, поверх — лёгкое затемнение для читабельности текста.
    this.bg = this.add.tileSprite(0, 0, GAME_W, TOPBAR_H, 'wall').setOrigin(0, 0);
    this.bg.tileScaleX = 2; this.bg.tileScaleY = 2;
    this.bgOverlay = this.add.rectangle(0, 0, GAME_W, TOPBAR_H, 0x000000, 0.55).setOrigin(0, 0);
    // нижняя кромка — линия пола, разделяет HUD и игровой мир
    this.add.line(0, TOPBAR_H - 2, 0, 0, GAME_W, 0, 0x6a5040).setOrigin(0, 0).setLineWidth(2);

    // ряд 1 (y=6)
    this.hpText = this.add.text(12, 6, '', {
      fontFamily: 'monospace', fontSize: '16px', color: '#ff5252',
    });
    this.armorText = this.add.text(140, 6, '', {
      fontFamily: 'monospace', fontSize: '16px', color: '#90caf9',
    });
    this.shieldText = this.add.text(220, 6, '', {
      fontFamily: 'monospace', fontSize: '16px', color: '#9fa8da',
    });
    // оружие: лейбл (ур. + урон + темп) + xp-бар прогресса до next level
    this.weaponLabel = this.add.text(260, 4, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#fff59d',
    });
    this.weaponBarBg = this.add.rectangle(260, 22, 90, 4, 0x333333).setOrigin(0, 0);
    this.weaponBar   = this.add.rectangle(260, 22, 0,  4, 0xfff59d).setOrigin(0, 0);

    // Уровень (level прогрессии) — справа сверху, над device-индикатором.
    this.levelLabel = this.add.text(GAME_W - 12, 6, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffd54f',
    }).setOrigin(1, 0);

    // tier монстров — справа отдельный блок
    this.mobLabel = this.add.text(GAME_W - 12, 28, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#ff8a65',
    }).setOrigin(1, 0);
    this.mobBarBg = this.add.rectangle(GAME_W - 12 - 90, 44, 90, 4, 0x333333).setOrigin(0, 0);
    this.mobBar   = this.add.rectangle(GAME_W - 12 - 90, 44, 0,  4, 0xff8a65).setOrigin(0, 0);
    this.keysText = this.add.text(340, 6, '', {
      fontFamily: 'monospace', fontSize: '16px', color: '#dddddd',
    });

    // Иконка ракетницы + cooldown-bar. Скрыты пока пользователь не подобрал.
    this.rocketIcon = this.add.image(470, 14, 'pickup_rocket').setOrigin(0, 0.5);
    this.rocketIcon.setVisible(false);
    this.rocketBarBg = this.add.rectangle(470, 26, 32, 3, 0x222222).setOrigin(0, 0);
    this.rocketBar   = this.add.rectangle(470, 26, 32, 3, 0xff7043).setOrigin(0, 0);
    this.rocketBarBg.setVisible(false);
    this.rocketBar.setVisible(false);

    // Бомбы — иконка + счётчик ammo. Скрыты пока ammo=0.
    this.bombIcon = this.add.image(515, 14, 'pickup_bomb').setOrigin(0, 0.5);
    this.bombText = this.add.text(540, 6, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffeb3b',
    });
    this.bombIcon.setVisible(false);
    // живые иконки ключей — спрайты flask_*. Заполняются в onUpdate.
    this.keyIcons = [];
    // device-индикатор — под level
    this.deviceIndicator = this.add.text(GAME_W - 12, 44, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#888888',
    }).setOrigin(1, 0);

    // Сложность — текст справа в центре топбара, между HP-блоком и mobLabel.
    // Цвет реагирует на величину (зелёный=легко, жёлтый=norm, оранжевый,
    // красный=жесть).
    this.difficultyLabel = this.add.text(GAME_W / 2 + 40, 28, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#aaaaaa',
    }).setOrigin(0, 0);

    // ряд 2 (y=28): stamina-бар и эффекты + interactHint по центру
    this.staminaBg = this.add.rectangle(12, 30, 120, 8, 0x222222).setOrigin(0, 0);
    this.staminaBar = this.add.rectangle(12, 30, 120, 8, 0x4ec9ff).setOrigin(0, 0);
    this.effectsText = this.add.text(140, 26, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#dddddd',
    });
    this.interactHint = this.add.text(GAME_W / 2, 28, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffd54f',
    }).setOrigin(0.5, 0);

    this.onUpdate({ hp: PLAYER_MAX_HP });
    this.onUpdate({ stamina: STAMINA_MAX });
    this.onUpdate({ keys: [] });
    this.onUpdate({ armor: 0 });
    this.onUpdate({ effects: [] });
    this.onUpdate({ interactHint: '' });
    this.game.events.on('hud:update', this.onUpdate, this);
    this.events.once('shutdown', () => {
      this.game.events.off('hud:update', this.onUpdate, this);
    });
  }
  onUpdate(state) {
    if (state.hp != null) {
      // hp может уйти ниже 0 в момент смерти (до того как _gameOver()
      // запустит overlay). String.repeat(-1) кидает RangeError.
      const hp = Math.max(0, Math.min(PLAYER_MAX_HP, state.hp | 0));
      this.hpText.setText('HP: ' + '♥'.repeat(hp) + '♡'.repeat(PLAYER_MAX_HP - hp));
    }
    if (state.stamina != null) this.staminaBar.width = 120 * (state.stamina / 100);
    if (state.keys != null) {
      for (const i of this.keyIcons) i.destroy();
      this.keyIcons = [];
      if (state.keys.length) {
        this.keysText.setText('Keys:');
        let x = 340 + 60;
        for (const c of state.keys) {
          const img = this.add.image(x, 14, 'key_' + c).setOrigin(0, 0.5).setScale(1.5);
          this.keyIcons.push(img);
          x += 18;
        }
      } else {
        this.keysText.setText('');
      }
    }
    if (state.armor != null) {
      this.armorText.setText(state.armor > 0 ? 'Armor: ' + '◆'.repeat(state.armor) : '');
    }
    if (state.effects != null) {
      this.effectsText.setText(state.effects.map(e => `${e.type} ${Math.ceil(e.msLeft / 1000)}s`).join('  '));
    }
    if (state.interactHint != null) {
      this.interactHint.setText(state.interactHint);
    }
    if (state.device != null) {
      this.deviceIndicator.setText(state.device === 'gamepad' ? 'Gamepad' : 'Keyboard');
    }
    if (state.shield != null) {
      this.shieldText.setText(state.shield > 0 ? '■'.repeat(state.shield) : '');
    }
    if (state.weaponLevel != null) {
      const xp = state.weaponXp ?? 0;
      const dmg = state.weaponDamage ?? state.weaponLevel;
      const ms  = state.weaponRateMs ?? '?';
      this.weaponLabel.setText(`Оружие ур.${state.weaponLevel}  урон ${dmg}  ${ms}мс`);
      this.weaponBar.width = 90 * Math.min(1, xp / 5);
    }
    if (state.mobTier != null) {
      this.mobLabel.setText(`Монстры ур.${state.mobTier}`);
      this.mobBar.width = 90 * (state.mobTierFraction ?? 0);
    }
    if (state.level != null) {
      const max = state.maxLevel || '?';
      this.levelLabel.setText(`Уровень ${state.level}/${max}`);
    }
    if (state.difficulty != null) {
      const d = state.difficulty;
      const col = d < 0.85 ? '#81c784' : d < 1.05 ? '#aaaaaa' : d < 1.30 ? '#ffd54f' : '#ff7043';
      this.difficultyLabel.setColor(col);
      this.difficultyLabel.setText(`Сложность ×${d.toFixed(2)}`);
    }
    if (state.bombs != null) {
      const n = state.bombs;
      this.bombIcon.setVisible(n > 0);
      this.bombText.setText(n > 0 ? `×${n}` : '');
    }
    if (state.rocket != null) {
      const has = !!state.rocket.has;
      this.rocketIcon.setVisible(has);
      this.rocketBarBg.setVisible(has);
      this.rocketBar.setVisible(has);
      if (has) {
        // bar заполняется ПО МЕРЕ восстановления (1=ready, 0=just fired)
        const ready = 1 - (state.rocket.cooldownFrac ?? 0);
        this.rocketBar.width = 32 * ready;
        // tint: серый когда не готов, оранжевый когда готов
        this.rocketBar.fillColor = ready >= 0.999 ? 0xff7043 : 0x6a6a6a;
        this.rocketIcon.setAlpha(ready >= 0.999 ? 1 : 0.55);
      }
    }
  }
}
