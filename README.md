# labirints-and-monster

Top-down браузерная игра: процедурный лабиринт, монстры с pathfinding, ракетница, бомбы, **разрушаемые стены**, fog of war, цветные двери, сундуки с power-up/debuff, поддержка Xbox-геймпада через Gamepad API.

## 🎮 Играть в браузере

**→ [o-shabashov.github.io/labirints-and-monster](https://o-shabashov.github.io/labirints-and-monster/)** ←

Ничего ставить не надо: открыл ссылку в Chrome / Firefox / Safari — играй.

> На первом запуске нажми любую кнопку, чтобы браузер разблокировал звук и геймпад.

## Управление

| Действие | Клавиатура / Мышь | Xbox-геймпад |
|---|---|---|
| Движение | WASD / стрелки | левый стик |
| Прицел | курсор мыши | правый стик |
| Стрельба | ЛКМ | автоматически при наклоне правого стика |
| **Ракета** | ПКМ или **Q** | **RB** (правый bumper) |
| **Бомба** | **F** | **LB** (левый bumper) |
| Спринт | Shift | LT |
| Рывок (i-frames) | Space | A |
| Взаимодействие / приманка | E | X |
| Пауза | Esc | Start |

Ракету и бомбу нужно сначала подобрать — pickups лежат рядом с зелёным входом в начале каждого уровня.

## Что в игре

- 🌀 **5 уровней** — выход (жёлтый тайл) ведёт на следующий, HP/прокачка/инвентарь переносятся
- 🧱 **Разрушаемые стены** — ракетой/бомбой пробивай стены и иди коротким путём. Внешний периметр и рамки дверей неразрушимы
- 👾 **10 типов монстров** — Wanderer, Chaser (равен по скорости игроку), Goblin (быстрее игрока), Guard, Shooter, Skeleton, BigZombie, OrcWarrior, TinyZombie, MaskedOrc
- 📈 **Адаптивная сложность** — игра считает kills/min и damage/min, подстраивает rate появления и tier монстров
- 🗝 **Двери и ключи** — 1-3 цветные двери на пути, ключи всегда достижимы
- 📦 **Сундуки** — слепой выбор: 70% power-up, 30% debuff
- 🌫 **Fog of war** — видишь только круг ~7 тайлов, исследованные зоны запоминаются

## Запустить локально (для разработчиков)

Игра — статичный сайт + Phaser через CDN. Нужен только локальный HTTP-сервер (ES-модули требуют его):

### Самые простые варианты (1 команда)

**Node.js** (любая ОС):
```sh
npx serve .
```

**Python 3** (macOS / Linux / Windows с Python):
```sh
python3 -m http.server 8080
```

**PHP** (если есть):
```sh
php -S localhost:8080
```

**VS Code**: установить расширение **Live Server**, ПКМ по `index.html` → "Open with Live Server".

После запуска открыть `http://localhost:8080`.

### Dev-сервер с no-cache (для агентов / hot-iterating)

В репо есть `serve.py` — обёртка над python `http.server` с `Cache-Control: no-store`. Полезно когда правишь JS и не хочешь Cmd+Shift+R каждый раз:

```sh
python3 serve.py 8080
```

### Тесты

```sh
npm test
```

Использует встроенный `node --test` runner (Node 18+). 15 unit-тестов на чистую логику (MazeGenerator, PathFinding, Input).

### Debug-режим

- `?debug=1` — ракетница даётся со старта
- `?log=all` (default) / `?log=wall,rocket` / `?log=0` — фильтр логов в DevTools console
- `window.__logs()` или `__logs('wall')` в console — дамп circular buffer'а событий

## Стек

- **Phaser 3.80.1** через CDN
- Vanilla ES-модули, **без сборщика** и npm install
- `node:test` для unit-тестов
- Python `http.server` для локальной разработки (опционально)

## Ассеты и кредиты

- **Графика** — `0x72`, [DungeonTilesetII v1.7](https://0x72.itch.io/dungeontileset-ii). Лицензия [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/). Файлы в `assets/0x72/`.
- **Спрайты оружия (3D-режим)** — [2D Guns](https://opengameart.org/content/2d-guns) от Kay Lousberg ([@KayLousberg](https://twitter.com/KayLousberg)). Лицензия [CC0](https://creativecommons.org/publicdomain/zero/1.0/). Файлы в `assets/weapons3d/`.
- **Звуковые эффекты** — [Kenney](https://kenney.nl/), паки [Interface Sounds](https://kenney.nl/assets/interface-sounds) и [Impact Sounds](https://kenney.nl/assets/impact-sounds). Лицензия [CC0](https://creativecommons.org/publicdomain/zero/1.0/). Файлы в `assets/sfx/`.
- **Музыка** — «Hidden Past» от [Kevin MacLeod](https://incompetech.com). Лицензия [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/). Файл в `assets/music/`.
- Звуки ракеты и взрыва генерируются runtime через Web Audio API — без .ogg-файлов.

## Документы

- [Дизайн-спека](docs/superpowers/specs/2026-05-23-maze-monsters-design.md)
- [План реализации](docs/superpowers/plans/2026-05-23-maze-monsters-implementation.md) — 14 этапов (все выполнены + расширено)
- [CLAUDE.md](CLAUDE.md) — архитектурная карта для AI-агентов и разработчиков
