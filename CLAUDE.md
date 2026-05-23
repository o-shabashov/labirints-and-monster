# CLAUDE.md — labirints-and-monster

Top-down браузерная игра «лабиринт + монстры» на Phaser 3. Этот файл — для агентов, которые продолжают работу. Полные детали — в OpenMemory под `user_id: oleg`, теги `project:labirints-and-monster`.

## Запуск

```sh
python3 serve.py 8080          # dev-сервер с Cache-Control: no-store
npm test                        # 14 node:test unit-тестов
```

Hot reload отсутствует — после правки достаточно Cmd+R в браузере, кеш отключён. State теряется (Vite не ставили).

## Стек

- Phaser 3.80.1 через CDN
- Vanilla ES modules, без сборщика
- `node --test` для тестов чистой логики
- Python http-сервер с no-cache headers (`serve.py`)

## Конвенции

- **БЕЗ `Co-Authored-By` и БЕЗ `🤖 Generated with Claude Code` в коммитах.** Это явный запрет пользователя (зафиксирован также в глобальном `~/.claude/CLAUDE.md`).
- Conventional commits: `feat:`, `fix:`, `feat(maze):`, `fix(bullet):`. Заголовок на русском, technical detail можно на английском — пользователь смешивает.
- Один осмысленный коммит на одну правку, прямой `git push origin main` (личный проект, без PR).
- **Всегда убивать dev-сервер после verification**: `lsof -nP -iTCP:8080 -sTCP:LISTEN -t | xargs kill`.
- При visual проверке через playwright: запускать сервер → screenshot → `browser_close` → kill server.

## Архитектура (краткая карта)

```
src/
  main.js                — Phaser config, window.__game для дев-доступа
  config/constants.js    — все параметры в одном месте
  scenes/
    BootScene            — preload + canvas-textures (soft_circle, fireball, enemy_orb, vignette)
    MenuScene            — gamepad polling в update() (НЕ delayedCall)
    GameScene            — gameplay; mobTier(), spawnMonster(), applyChestReward()
    UIScene              — HUD viewport 0..TOPBAR_H поверх GameScene
    ChestScene           — overlay выбор баффа, navigation update() polled
    GameOverScene / VictoryScene  — gamepad polling в update()
  world/
    MazeGenerator        — generateMaze(w,h,seed,style); 'hybrid'|'corridor'|'rooms'
    TileMap              — рендер + greedy 2D rectangle merge стен
    FogOfWar             — RenderTexture-штампы soft_circle с blend ERASE
  entities/
    Player               — HP/armor/shield/stamina/dash/weaponLevel/bulletDamage
    Monster              — base; takeDamage с tween анимациями (flash+death spin)
    monsters/            — 10 классов (см. OpenMemory)
    Bullet, Door, Chest, Pickup
  systems/
    Input                — клавиатура+мышь+gamepad → унифицированный объект
    Sound                — обёртка над Phaser SoundManager
    PathFinding          — bfsNextStep для AI
    Vision               — hasLineOfSight для shooter + homing target
    Combat, Effects
```

## Известные Phaser gotcha'и (в OpenMemory полный список)

1. `pixelArt: true` ломает текст и canvas-scale FIT. Текст pixelated — принять, это в стиле.
2. `scale.zoom = devicePixelRatio` ломает центрирование на retina — убрать.
3. `time.delayedCall` в overlay/start-сценах ненадёжно тикает — всё gamepad polling делать в `update()`.
4. `<div id="game">` в index.html перебивает `window.game` (autoglobal по id) — не использовать.
5. **Bullet.update после b.kill() в overlap-callback крашит loop** — обязательно guard на `dead || !sprite.active || !sprite.body`.
6. **Input edge-кнопки утекают между сценами** — после ChestScene выбора A зажата, Player сразу dash'ит. Решение: `_inputCooldownUntil` в GameScene при resume + `inputSys.prev.dash = true` в окне cooldown.
7. **Углы wall-тайлов цепляют круглый body** — greedy 2D rectangle merge всех walls в один static body.
8. **Player ↔ monster: collider** (физический блок + урон в callback), **monster ↔ monster: ничего** (проходят насквозь, не образуют пробок).

## Полный контекст

Запроси из OpenMemory:

```
openmemory_query "labirints-and-monster"
openmemory_query "phaser gotchas"
```

6 записей: семантика проекта · игровые механики · конвенции git · Phaser gotcha'и · файловая структура · управление.

## Документация

- [docs/superpowers/specs/2026-05-23-maze-monsters-design.md](docs/superpowers/specs/2026-05-23-maze-monsters-design.md)
- [docs/superpowers/plans/2026-05-23-maze-monsters-implementation.md](docs/superpowers/plans/2026-05-23-maze-monsters-implementation.md) — 14 этапов
- README.md — управление, ассеты, атрибуция (CC-BY)

## GitHub

https://github.com/o-shabashov/labirints-and-monster (public, main branch)
