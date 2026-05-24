import {
  TILE_SIZE, GAME_W, GAME_H,
  TILE, isBlockingTile,
  WALL_SUB, WALL_ERASE_RADIUS_PX,
} from '../config/constants.js';

const SUB_SIZE = TILE_SIZE / WALL_SUB;  // 4px при WALL_SUB=8

export class TileMap {
  constructor(scene, tiles) {
    this.scene = scene;
    this.tiles = tiles;             // tiles[y][x] — pathfinding/AI grid
    this.height = tiles.length;
    this.width = tiles[0].length;
    this.subW = this.width * WALL_SUB;
    this.subH = this.height * WALL_SUB;
    // subGrid[sy][sx] — sub-tile физика стен (Uint8: 1=solid, 0=empty).
    // Разрушение работает только на этой сетке.
    this.subGrid = Array.from({ length: this.subH }, () => new Uint8Array(this.subW));
    this.walls = scene.physics.add.staticGroup();
    this._zones = [];

    this._initSubGrid();
    this._renderFloor();
    this._renderWalls();
    this._rebuildPhysics();
  }

  _initSubGrid() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (!isBlockingTile(this.tiles[y][x])) continue;
        const baseX = x * WALL_SUB, baseY = y * WALL_SUB;
        for (let dy = 0; dy < WALL_SUB; dy++) {
          for (let dx = 0; dx < WALL_SUB; dx++) {
            this.subGrid[baseY + dy][baseX + dx] = 1;
          }
        }
      }
    }
  }

  _renderFloor() {
    this.entrance = null;
    this.exit = null;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const px = x * TILE_SIZE + TILE_SIZE / 2;
        const py = y * TILE_SIZE + TILE_SIZE / 2;
        // floor_plain — однотонная canvas-текстура без бордер, 32×32.
        // Scale=1 (а не 2) потому что текстура уже целевого размера.
        this.scene.add.image(px, py, 'floor_plain').setDepth(0);
        const t = this.tiles[y][x];
        if (t === TILE.ENTRANCE) {
          this.scene.add.image(px, py, 'entrance').setScale(2).setDepth(0);
          this.entrance = { x, y };
        } else if (t === TILE.EXIT) {
          this.scene.add.image(px, py, 'exit').setScale(2).setDepth(0);
          this.exit = { x, y };
        }
      }
    }
  }

  _renderWalls() {
    // Единый RenderTexture для всех стен. Erase soft_circle при попадании
    // пули → пиксельные дырки. NEAREST filter, чтобы pixel-art tile-текстура
    // не размывалась при transient scale операциях RT.
    // depth=2 → над базовым floor (0). Обугленные края при взрыве идут
    // отдельными sprite'ами с MULTIPLY blend и depth=2.1 (см. damageAt).
    this.wallsRT = this.scene.add.renderTexture(0, 0, GAME_W, GAME_H).setOrigin(0, 0).setDepth(2);
    if (this.wallsRT.texture && this.wallsRT.texture.setFilter) {
      this.wallsRT.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const t = this.tiles[y][x];
        if (!isBlockingTile(t)) continue;
        this._stampWallTile(x, y, t);
      }
    }
  }

  _stampWallTile(tx, ty, tileType) {
    const px = tx * TILE_SIZE + TILE_SIZE / 2;
    const py = ty * TILE_SIZE + TILE_SIZE / 2;
    // ВАЖНО: stamp должен быть renderable (visible=true) — иначе
    // RenderTexture.draw() skip'нет его в WebGL pipeline. Destroy сразу же
    // после draw, флэша на frame не успеет.
    const stamp = this.scene.add.image(px, py, 'wall').setScale(2);
    // Визуально SOLID_WALL — холодный сине-стальной оттенок, чтобы игрок
    // видел: «эту не пробить».
    if (tileType === TILE.SOLID_WALL) stamp.setTint(0x6f7ea0);
    this.wallsRT.draw(stamp);
    stamp.destroy();
  }

  _rebuildPhysics() {
    // Уничтожаем все zones и пересоздаём greedy-merge на sub-grid.
    // 124×84 sub-клеток — терпимо для разовой операции при попадании.
    for (const z of this._zones) z.destroy();
    this._zones.length = 0;
    const covered = Array.from({ length: this.subH }, () => new Uint8Array(this.subW));
    for (let y = 0; y < this.subH; y++) {
      for (let x = 0; x < this.subW; x++) {
        if (!this.subGrid[y][x] || covered[y][x]) continue;
        let mw = 1;
        while (x + mw < this.subW
            && this.subGrid[y][x + mw]
            && !covered[y][x + mw]) mw++;
        let mh = 1;
        outer: while (y + mh < this.subH) {
          for (let dx = 0; dx < mw; dx++) {
            if (!this.subGrid[y + mh][x + dx] || covered[y + mh][x + dx]) break outer;
          }
          mh++;
        }
        for (let dy = 0; dy < mh; dy++) {
          for (let dx = 0; dx < mw; dx++) covered[y + dy][x + dx] = 1;
        }
        const cx = x * SUB_SIZE + (mw * SUB_SIZE) / 2;
        const cy = y * SUB_SIZE + (mh * SUB_SIZE) / 2;
        const zone = this.scene.add.zone(cx, cy, mw * SUB_SIZE, mh * SUB_SIZE);
        this.scene.physics.add.existing(zone, true);
        this.walls.add(zone);
        this._zones.push(zone);
      }
    }
  }

  // Повреждение стен в точке (worldX, worldY) кружком radius.
  // Возвращает true, если хоть что-то разрушилось.
  damageAt(worldX, worldY, radiusPx = WALL_ERASE_RADIUS_PX) {
    if (!this.wallsRT) return false;
    // Центральный tile — если SOLID_WALL, эффекта нет (попали в неразрушимое).
    const ctx = Math.floor(worldX / TILE_SIZE);
    const cty = Math.floor(worldY / TILE_SIZE);
    if (cty >= 0 && cty < this.height && ctx >= 0 && ctx < this.width
        && this.tiles[cty][ctx] === TILE.SOLID_WALL) {
      return false;
    }

    // Sub-grid mutations
    const r = radiusPx;
    const minSubX = Math.max(0, Math.floor((worldX - r) / SUB_SIZE));
    const maxSubX = Math.min(this.subW - 1, Math.floor((worldX + r) / SUB_SIZE));
    const minSubY = Math.max(0, Math.floor((worldY - r) / SUB_SIZE));
    const maxSubY = Math.min(this.subH - 1, Math.floor((worldY + r) / SUB_SIZE));
    const r2 = r * r;
    let touched = false;
    const touchedTiles = new Set();
    for (let sy = minSubY; sy <= maxSubY; sy++) {
      for (let sx = minSubX; sx <= maxSubX; sx++) {
        if (!this.subGrid[sy][sx]) continue;
        const subCx = sx * SUB_SIZE + SUB_SIZE / 2;
        const subCy = sy * SUB_SIZE + SUB_SIZE / 2;
        const dx = subCx - worldX, dy = subCy - worldY;
        if (dx * dx + dy * dy > r2) continue;
        const tx = Math.floor(sx / WALL_SUB);
        const ty = Math.floor(sy / WALL_SUB);
        // SOLID_WALL клетки остаются — кружок просто их обтекает.
        if (this.tiles[ty][tx] === TILE.SOLID_WALL) continue;
        this.subGrid[sy][sx] = 0;
        touched = true;
        touchedTiles.add(ty * this.width + tx);
      }
    }
    if (!touched) return false;

    // Brush 32×32 даёт «жёсткий» круг ~16px радиусом при scale=1.
    // Чтобы визуальная дырка совпадала с обнулёнными sub-cells,
    // масштабируем пропорционально radiusPx.
    const brushScale = radiusPx / 14;

    // 1. «Обугленные края» — тёмный stamp рисуется ВНУТРЬ wallsRT с blend
    //    MULTIPLY. На стенах (alpha>0) тинт умножается → потемнение. Где
    //    wallsRT уже прозрачен (старая дырка) — alpha остаётся 0, эффекта
    //    нет. Чуть шире erase radius (×1.6), чтобы кайма выходила за
    //    будущую дырку. Tint 0x5a5048 — светлее предыдущего (пользователь
    //    просил «чуть светлее»).
    const charStamp = this.scene.add.image(worldX, worldY, 'wall_damage_brush')
      .setOrigin(0.5)
      .setScale(brushScale * 1.6)
      .setTint(0x5a5048);
    charStamp.setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.wallsRT.draw(charStamp);
    charStamp.destroy();

    // 2. Erase — вырезаем центральную дырку поверх затемнения.
    const eraseImg = this.scene.add.image(worldX, worldY, 'wall_damage_brush')
      .setOrigin(0.5)
      .setScale(brushScale)
      .setVisible(false);
    this.wallsRT.erase(eraseImg);
    eraseImg.destroy();

    // SOLID_WALL клетки в радиусе erase'а — перерисовываем поверх, чтобы их
    // не «обкусило» кружком. Обычно 0–2 клеток в bbox.
    const minTx = Math.max(0, Math.floor((worldX - r) / TILE_SIZE));
    const maxTx = Math.min(this.width - 1, Math.floor((worldX + r) / TILE_SIZE));
    const minTy = Math.max(0, Math.floor((worldY - r) / TILE_SIZE));
    const maxTy = Math.min(this.height - 1, Math.floor((worldY + r) / TILE_SIZE));
    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (this.tiles[ty][tx] === TILE.SOLID_WALL) {
          this._stampWallTile(tx, ty, TILE.SOLID_WALL);
        }
      }
    }

    // Полностью разрушенный тайл становится FLOOR — pathfinding монстров
    // его автоматически обходит и пускает идти насквозь.
    for (const key of touchedTiles) {
      const ty = Math.floor(key / this.width);
      const tx = key % this.width;
      if (this._isTileFullyEmpty(tx, ty) && this.tiles[ty][tx] === TILE.WALL) {
        this.tiles[ty][tx] = TILE.FLOOR;
      }
    }

    this._rebuildPhysics();
    return true;
  }

  _isTileFullyEmpty(tx, ty) {
    const baseX = tx * WALL_SUB, baseY = ty * WALL_SUB;
    for (let dy = 0; dy < WALL_SUB; dy++) {
      for (let dx = 0; dx < WALL_SUB; dx++) {
        if (this.subGrid[baseY + dy][baseX + dx]) return false;
      }
    }
    return true;
  }

  findDoors() {
    const result = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const t = this.tiles[y][x];
        if (t === TILE.DOOR_R || t === TILE.DOOR_G || t === TILE.DOOR_B) {
          result.push({ x, y, tile: t });
        }
      }
    }
    return result;
  }

  isWall(x, y) {
    if (y < 0 || y >= this.height || x < 0 || x >= this.width) return true;
    return isBlockingTile(this.tiles[y][x]);
  }

  tileToWorld(x, y) {
    return {
      x: x * TILE_SIZE + TILE_SIZE / 2,
      y: y * TILE_SIZE + TILE_SIZE / 2,
    };
  }
}
