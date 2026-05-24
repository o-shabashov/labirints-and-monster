// Категоризированные логи + circular buffer.
//
// Использование:
//   import { log } from '../systems/Logger.js';
//   log('wall', 'damageAt', { x, y, r, tilesTouched });
//
// В console: "[wall] damageAt {x:..., y:..., r:..., tilesTouched:[...]}".
// Управление:
//   ?log=0           — выключить все логи (только critical errors)
//   ?log=wall,rocket — только эти категории
//   ?log=all         — все (default в DEBUG-режиме)
//
// Buffer держит последние N записей — `window.__logs` доступен в console.

const BUFFER_SIZE = 500;
const buffer = [];

let enabled = null;   // null=auto, Set, или 'all'

function parseFilter() {
  if (typeof globalThis.location === 'undefined') return 'all';
  const params = new URLSearchParams(globalThis.location.search);
  const v = params.get('log');
  if (v === '0' || v === 'off') return new Set();   // выключено
  if (!v) return 'all';                              // default — всё
  if (v === 'all') return 'all';
  return new Set(v.split(',').map(s => s.trim()));
}

function isEnabled(category) {
  if (enabled === null) enabled = parseFilter();
  if (enabled === 'all') return true;
  return enabled.has(category);
}

export function log(category, msg, data) {
  const entry = {
    t: Date.now(),
    cat: category,
    msg,
    data: data === undefined ? null : data,
  };
  buffer.push(entry);
  if (buffer.length > BUFFER_SIZE) buffer.shift();
  if (!isEnabled(category)) return;
  if (data !== undefined) {
    console.log(`[${category}] ${msg}`, data);
  } else {
    console.log(`[${category}] ${msg}`);
  }
}

export function getLogs(category) {
  if (!category) return buffer.slice();
  return buffer.filter(e => e.cat === category);
}

// Доступ из browser-console: window.__logs() / window.__logs('wall')
if (typeof globalThis.window !== 'undefined') {
  globalThis.window.__logs = getLogs;
}
