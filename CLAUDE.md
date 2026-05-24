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
  config/
    constants.js         — все параметры в одном месте (включая WALL_SUB,
                           ROCKET_*, BOMB_*, MAX_LEVELS, FLOOR colors)
    debug.js             — DEBUG=true если URL содержит ?debug=1
  scenes/
    BootScene            — preload + canvas-textures (soft_circle, fireball,
                           enemy_orb, vignette, rocket, pickup_rocket,
                           pickup_bomb, smoke_particle, explosion_particle,
                           wall_damage_brush, wall_char_brush, tile_eraser,
                           floor_plain)
    MenuScene            — gamepad polling в update() (НЕ delayedCall)
    GameScene            — gameplay; init(data) принимает {level, carry};
                           mobTier(), spawnMonster(), applyChestReward(),
                           explode(x,y,opts), explodeBomb(), _onReachExit()
    UIScene              — HUD: HP/armor/weapon/level/mob-tier + rocket
                           icon с cooldown bar + bombs icon×N
    ChestScene           — overlay выбор баффа, navigation update() polled
    GameOverScene / VictoryScene  — gamepad polling в update()
  world/
    MazeGenerator        — generateMaze(w,h,seed,style); 'hybrid'|'corridor'|'rooms';
                           markSolidWalls() пост-процесс на borders+door-frames
    TileMap              — rendering: wallsRT + floor_plain + burnt-floor.
                           Sub-grid физика 248×168 (WALL_SUB=8 → sub=4px).
                           damageAt(x,y,r): обнуляет sub-cells, erase wallsRT
                           hard brush, cleanup tile при >=25% empty (entire
                           tile erase + burn edges effect)
    FogOfWar             — RenderTexture-штампы soft_circle с blend ERASE
  entities/
    Player               — HP/armor/shield/stamina/dash/weaponLevel/bulletDamage
                           + hasRocketLauncher + bombsAmmo + tryShootRocket/
                           tryThrowBomb
    Monster              — base; takeDamage с tween анимациями (flash+death spin)
    monsters/            — 10 классов (см. OpenMemory)
    Bullet, Rocket, Bomb, Door, Chest, Pickup
  systems/
    Input                — клавиатура+мышь+gamepad → унифицированный объект.
                           rocket: ПКМ/Q/RB(button 5), bomb: F/LB(button 4)
    Sound                — обёртка над Phaser SoundManager + Web Audio synth
                           (rocketShoot, explosion) — без .ogg ассетов
    Logger               — log(category, msg, data) + circular buffer.
                           ?log=0 / ?log=wall,rocket / window.__logs()
    PathFinding          — bfsNextStep для AI
    Vision               — hasLineOfSight для shooter + homing target
    Combat, Effects
```

## Разрушаемые стены

Гибридный подход: визуал — единый wallsRT (RenderTexture) поверх floor,
физика — sub-grid 248×168 при WALL_SUB=8 (1 sub-cell = 4px).

- `damageAt(x,y,r)` в TileMap: обнуляет sub-cells в радиусе → erase
  hard-edge `wall_char_brush` в wallsRT → re-stamp SOLID_WALL клеток (они
  не разрушаются).
- При >=25% empty sub-cells в тайле — `_cleanupTile`: ставит tile=FLOOR,
  обнуляет остаток sub-grid, erase'ит весь 32×32 квадрат через
  `tile_eraser` (НЕ Rectangle — RT.erase их игнорирует), запускает
  `_burnTileEdges` (4 волны огоньков по периметру).
- `SOLID_WALL` (тинт 0x6f7ea0): внешний периметр + клетки-соседи дверей.
  Не разрушается, обтекается erase'ом.
- Источники damage: rocket (ROCKET_WALL_ERASE_RADIUS=36), bomb (56),
  explode() параметризован opts (eraseRadius, explosionRadius, aoeDamage,
  knockback, shake*). По умолчанию bullet НЕ разрушает
  (`BULLET_DESTROYS_WALLS=false`).

## Прогрессия

- `MAX_LEVELS=5`. EXIT → следующий уровень (state переносится: HP, armor,
  weapon, launcher, bombs; ключи нет). После 5-го → VictoryScene.
- `MOBS_PER_LEVEL_BONUS=2` доп. монстров на каждый уровень (Chaser/
  Wanderer/Goblin/Orc), поверх базы 25.
- `GameScene.init({level, carry})` — точка входа при transition.

## Дев-инструменты

- **`?debug=1`** — player.hasRocketLauncher=true сразу со старта.
- **`?log=all`** (default) / **`?log=wall,rocket`** / **`?log=0`** —
  фильтр логов. `window.__logs()` или `__logs('wall')` в console дампит
  circular buffer.
- **`?v=<tag>`** в index.html — cache-bust ESM-модулей. Браузер
  кэширует ESM по URL и `Cache-Control: no-store` не помогает; bump'аем
  query чтобы пробить кэш без Cmd+Shift+R.

## Известные Phaser gotcha'и (в OpenMemory полный список)

1. `pixelArt: true` ломает текст и canvas-scale FIT. Текст pixelated — принять, это в стиле.
2. `scale.zoom = devicePixelRatio` ломает центрирование на retina — убрать.
3. `time.delayedCall` в overlay/start-сценах ненадёжно тикает — всё gamepad polling делать в `update()`.
4. `<div id="game">` в index.html перебивает `window.game` (autoglobal по id) — не использовать.
5. **Bullet.update после b.kill() в overlap-callback крашит loop** — обязательно guard на `dead || !sprite.active || !sprite.body`.
6. **Input edge-кнопки утекают между сценами** — после ChestScene выбора A зажата, Player сразу dash'ит. Решение: `_inputCooldownUntil` в GameScene при resume + `inputSys.prev.dash = true` в окне cooldown.
7. **Углы wall-тайлов цепляют круглый body** — greedy 2D rectangle merge всех walls в один static body (теперь на sub-grid).
8. **Player ↔ monster: collider** (физический блок + урон в callback), **monster ↔ monster: ничего** (проходят насквозь, не образуют пробок).
9. **RenderTexture.draw(stamp) skip'ает invisible objects** — для draw нужно `visible=true` (destroy сразу после draw); для erase — пофиг.
10. **RenderTexture.erase(rectangle) silent no-op** — erase работает только с texture-based объектами (Image/Sprite). Rectangle — primitive geometry, игнорируется. Использовать canvas-text texture (`tile_eraser`).
11. **MULTIPLY blend в `draw` в RT убирает alpha вне круга brush'а** — `final.alpha = src.alpha × dst.alpha`, в углах bbox brush src.alpha=0 → стирает alpha. Избегать MULTIPLY draw в wallsRT.
12. **ESM-модули кэшируются по URL — `Cache-Control: no-store` не помогает**. Браузер держит модули в memory cache между reload'ами. Решение: `?v=<tag>` в `<script src>` index.html — bump при изменении кода. Или Cmd+Shift+R в Chrome (только в реальном Chrome, не в playwright).

## Полный контекст

Запроси из OpenMemory:

```
openmemory_query "labirints-and-monster"
openmemory_query "phaser gotchas"
```

6 записей: семантика проекта · игровые механики · конвенции git · Phaser gotcha'и · файловая структура · управление.

## Документация

- [docs/superpowers/specs/2026-05-23-maze-monsters-design.md](docs/superpowers/specs/2026-05-23-maze-monsters-design.md)
- [docs/superpowers/plans/2026-05-23-maze-monsters-implementation.md](docs/superpowers/plans/2026-05-23-maze-monsters-implementation.md) — 14 этапов (все выполнены, плюс прибавки сверху)
- README.md — управление, ассеты, атрибуция (CC-BY)

## Управление

- **WASD / стик** — движение
- **Мышь / правый стик** — прицел
- **ЛКМ / RT** — стрельба (обычная пуля, не разрушает стены)
- **ПКМ / Q / RB** — ракета (если есть launcher)
- **F / LB** — бомба (если есть в инвентаре)
- **Shift / LT** — спринт
- **Space / A** — рывок
- **E / X** — взаимодействие (приманка)

## GitHub

https://github.com/o-shabashov/labirints-and-monster (public, main branch)
