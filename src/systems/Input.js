export function applyDeadzone(v, dz) {
  const m = Math.hypot(v.x, v.y);
  if (m < dz) return { x: 0, y: 0 };
  return v;
}

export function normalizeMove(v) {
  const m = Math.hypot(v.x, v.y);
  if (m === 0) return { x: 0, y: 0 };
  if (m <= 1) return { x: v.x, y: v.y };
  return { x: v.x / m, y: v.y / m };
}

const STICK_DEADZONE_MOVE = 0.15;
const STICK_DEADZONE_AIM = 0.20;
const GAMEPAD_IDLE_TIMEOUT_MS = 500;

export class Input {
  constructor(scene) {
    this.scene = scene;
    this.keys = scene.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,SPACE,E,ESC');
    this.mouse = scene.input.activePointer;

    this.prev = {
      dash: false, interact: false, pause: false, shootEdge: false,
    };
    this.lastGamepadActivity = 0;
    this.activeDevice = 'keyboard';
  }

  read() {
    // ---- keyboard + mouse ----
    const k = this.keys;
    let kbMove = { x: 0, y: 0 };
    if (k.A.isDown || k.LEFT.isDown) kbMove.x = -1;
    else if (k.D.isDown || k.RIGHT.isDown) kbMove.x = 1;
    if (k.W.isDown || k.UP.isDown) kbMove.y = -1;
    else if (k.S.isDown || k.DOWN.isDown) kbMove.y = 1;
    kbMove = normalizeMove(kbMove);

    // mouse aim relative to player (set externally via setAimOrigin)
    let mAim = null;
    if (this.aimOrigin) {
      const dx = this.mouse.worldX - this.aimOrigin.x;
      const dy = this.mouse.worldY - this.aimOrigin.y;
      const m = Math.hypot(dx, dy);
      if (m > 1) mAim = { x: dx / m, y: dy / m };
    }
    const mShoot = this.mouse.isDown;
    const kbSprint = k.SHIFT.isDown;
    const kbDash = k.SPACE.isDown;
    const kbInteract = k.E.isDown;
    const kbPause = k.ESC.isDown;

    // ---- gamepad (standard mapping, first connected) ----
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) { if (p) { gp = p; break; } }

    let gpMove = { x: 0, y: 0 };
    let gpAim = null;
    let gpSprint = false, gpDash = false, gpShoot = false, gpInteract = false, gpPause = false;

    if (gp) {
      gpMove = applyDeadzone({ x: gp.axes[0] || 0, y: gp.axes[1] || 0 }, STICK_DEADZONE_MOVE);
      gpMove = normalizeMove(gpMove);
      const aim = applyDeadzone({ x: gp.axes[2] || 0, y: gp.axes[3] || 0 }, STICK_DEADZONE_AIM);
      if (aim.x !== 0 || aim.y !== 0) {
        const m = Math.hypot(aim.x, aim.y);
        gpAim = { x: aim.x / m, y: aim.y / m };
        gpShoot = true; // авто-fire при отклонённом правом стике
      }
      // standard mapping: 0=A, 2=X, 6=LT (axes-like trigger 0..1), 9=Start
      gpDash = !!(gp.buttons[0] && gp.buttons[0].pressed);
      gpInteract = !!(gp.buttons[2] && gp.buttons[2].pressed);
      gpPause = !!(gp.buttons[9] && gp.buttons[9].pressed);
      gpSprint = !!(gp.buttons[6] && gp.buttons[6].value > 0.2);

      // активность гейпада: ненулевые стики или нажатая кнопка
      const anyBtn = gp.buttons.some(b => b && b.pressed);
      if (anyBtn || gpMove.x !== 0 || gpMove.y !== 0 || gpAim) {
        this.lastGamepadActivity = performance.now();
      }
    }

    if (performance.now() - this.lastGamepadActivity < GAMEPAD_IDLE_TIMEOUT_MS) {
      this.activeDevice = 'gamepad';
    } else {
      this.activeDevice = 'keyboard';
    }

    // ---- combine: gamepad overrides keyboard when present ----
    const move = (gpMove.x !== 0 || gpMove.y !== 0) ? gpMove : kbMove;
    const aim = gpAim || mAim;
    const shoot = gpShoot || mShoot;
    const sprint = gpSprint || kbSprint;
    const dashHeld = gpDash || kbDash;
    const interactHeld = gpInteract || kbInteract;
    const pauseHeld = gpPause || kbPause;

    // edges
    const dash = dashHeld && !this.prev.dash;
    const interact = interactHeld && !this.prev.interact;
    const pause = pauseHeld && !this.prev.pause;
    this.prev.dash = dashHeld;
    this.prev.interact = interactHeld;
    this.prev.pause = pauseHeld;

    return { move, aim, sprint, shoot, dash, interact, pause };
  }

  setAimOrigin(x, y) {
    this.aimOrigin = { x, y };
  }
}
