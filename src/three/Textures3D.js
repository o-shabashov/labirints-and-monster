import * as THREE from 'three';

// Процедурные canvas-текстуры для 3D: пламя факела, иконки пикапов.
// Кэшируются по ключу — одна текстура на все экземпляры.

const _cache = new Map();

function canvasTex(key, draw, size = 64) {
  if (_cache.has(key)) return _cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  draw(cv.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  _cache.set(key, tex);
  return tex;
}

// Пламя — каплевидная форма с горячим центром.
export function flameTexture() {
  return canvasTex('flame', (c, s) => {
    c.clearRect(0, 0, s, s);
    const g = c.createRadialGradient(s / 2, s * 0.6, 1, s / 2, s * 0.55, s * 0.45);
    g.addColorStop(0.0, 'rgba(255,255,220,1)');
    g.addColorStop(0.35, 'rgba(255,190,60,0.95)');
    g.addColorStop(0.7, 'rgba(235,100,20,0.7)');
    g.addColorStop(1.0, 'rgba(180,40,0,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(s / 2, s * 0.10);
    c.quadraticCurveTo(s * 0.88, s * 0.55, s / 2, s * 0.94);
    c.quadraticCurveTo(s * 0.12, s * 0.55, s / 2, s * 0.10);
    c.fill();
  });
}

// Иконка ракетницы — трубка + дульный срез + тёплый glow.
export function rocketPickupTexture() {
  return canvasTex('pk_rocket', (c, s) => {
    c.clearRect(0, 0, s, s);
    const g = c.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,140,60,0.45)');
    g.addColorStop(1, 'rgba(255,140,60,0)');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
    c.fillStyle = '#37474f'; c.fillRect(s * 0.18, s * 0.42, s * 0.5, s * 0.16);
    c.fillStyle = '#546e7a'; c.fillRect(s * 0.12, s * 0.37, s * 0.12, s * 0.26);
    c.fillStyle = '#263238'; c.fillRect(s * 0.66, s * 0.39, s * 0.04, s * 0.22);
    c.fillStyle = '#ff7043'; c.fillRect(s * 0.70, s * 0.45, s * 0.12, s * 0.1);
  });
}

// Дробовик для viewmodel (DOM, через data-URL). В 0x72 нет огнестрела —
// рисуем процедурно. Удерживается снизу-справа, стволы к центру.
let _shotgunURL = null;
export function shotgunDataURL() {
  if (_shotgunURL) return _shotgunURL;
  const W = 360, H = 240;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, W, H);
  // стволы + ресивер + цевьё — наклонённый блок, дуло вверх-влево
  c.save();
  c.translate(W * 0.6, H * 0.8);
  c.rotate(-0.6);
  c.fillStyle = '#3f434b'; c.fillRect(-16, -210, 30, 210);   // двойной ствол
  c.fillStyle = '#2c2f35'; c.fillRect(-1, -210, 2, 210);     // шов между стволами
  c.fillStyle = '#23262b'; c.fillRect(-18, -214, 34, 10);    // дульный срез
  c.fillStyle = '#54585f'; c.fillRect(-20, -6, 40, 54);      // ресивер
  c.fillStyle = '#6e4a28'; c.fillRect(-17, -66, 34, 30);     // цевьё (дерево)
  c.fillStyle = '#5a3c20'; c.fillRect(-17, -66, 34, 5);
  c.fillStyle = '#2c2f35'; c.fillRect(-6, 48, 12, 14);       // скоба
  c.restore();
  // приклад (дерево) — отдельно под другим углом
  c.save();
  c.translate(W * 0.74, H * 0.74);
  c.rotate(0.26);
  c.fillStyle = '#7a5230';
  c.beginPath();
  c.moveTo(0, -18); c.lineTo(74, 16); c.lineTo(66, 54); c.lineTo(-6, 14); c.closePath();
  c.fill();
  c.fillStyle = '#8a5f38'; c.fillRect(0, -18, 16, 42);
  c.restore();
  _shotgunURL = cv.toDataURL();
  return _shotgunURL;
}

// Иконка бомбы — чёрный шар, фитиль, искра + glow.
export function bombPickupTexture() {
  return canvasTex('pk_bomb', (c, s) => {
    c.clearRect(0, 0, s, s);
    const g = c.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,210,80,0.42)');
    g.addColorStop(1, 'rgba(255,210,80,0)');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
    c.fillStyle = '#161616';
    c.beginPath(); c.arc(s / 2, s * 0.58, s * 0.26, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#333'; c.fillRect(s * 0.47, s * 0.30, s * 0.06, s * 0.06);
    c.strokeStyle = '#8d6e63'; c.lineWidth = s * 0.05;
    c.beginPath(); c.moveTo(s / 2, s * 0.32); c.lineTo(s * 0.62, s * 0.18); c.stroke();
    c.fillStyle = '#ffeb3b';
    c.beginPath(); c.arc(s * 0.64, s * 0.16, s * 0.055, 0, Math.PI * 2); c.fill();
  });
}
