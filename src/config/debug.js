// Включается через query string: http://localhost:8080/?debug=1
//
// Что даёт:
//   • player.hasRocketLauncher = true с старта (без подбора pickup)
//   • можно расширять флагами под конкретный тест
//
// Использовать аккуратно — это «инструмент разработчика», не оставлять
// включённым в публичных билдах.
const params = (() => {
  try { return new URLSearchParams(globalThis.location?.search || ''); }
  catch { return new URLSearchParams(); }
})();

export const DEBUG = params.get('debug') === '1';
