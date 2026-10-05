/* ===================================================================
   Joystick - virtual stick for touch devices (left thumb) + the
   round action button (right thumb). Writes into controller.joy
   and fires the interact callback. Only activates on coarse pointers;
   on desktop the elements stay hidden via CSS.
   =================================================================== */
export class Joystick {
  constructor(controller, onInteract) {
    this.controller = controller;
    this.onInteract = onInteract;
    this.root = document.getElementById('touch');
    this.stick = document.getElementById('stick');
    this.nub = document.getElementById('stickNub');
    this.act = document.getElementById('btnAct');
    this.active = false;
    this.center = { x: 0, y: 0 };
    this.radius = 42;
    this.pointerId = null;

    const coarse = matchMedia('(pointer: coarse)').matches;
    if (coarse && this.root) this.root.hidden = false;

    this._bindStick();
    this._bindAct();
  }

  _bindStick() {
    if (!this.stick) return;
    const down = (e) => {
      e.preventDefault();
      this.active = true;
      this.pointerId = e.pointerId;
      const r = this.stick.getBoundingClientRect();
      this.center.x = r.left + r.width / 2;
      this.center.y = r.top + r.height / 2;
      this.stick.setPointerCapture(e.pointerId);
      this._apply(e.clientX, e.clientY);
    };
    const move = (e) => {
      if (!this.active || e.pointerId !== this.pointerId) return;
      this._apply(e.clientX, e.clientY);
    };
    const up = (e) => {
      if (e.pointerId !== this.pointerId) return;
      this.active = false;
      this.pointerId = null;
      this.controller.joy.x = 0;
      this.controller.joy.y = 0;
      if (this.nub) this.nub.style.transform = 'translate(0px, 0px)';
    };
    this.stick.addEventListener('pointerdown', down);
    this.stick.addEventListener('pointermove', move);
    this.stick.addEventListener('pointerup', up);
    this.stick.addEventListener('pointercancel', up);
  }

  _apply(cx, cy) {
    let dx = cx - this.center.x;
    let dy = cy - this.center.y;
    const d = Math.hypot(dx, dy);
    if (d > this.radius) { dx = (dx / d) * this.radius; dy = (dy / d) * this.radius; }
    this.controller.joy.x = dx / this.radius;
    this.controller.joy.y = dy / this.radius;
    if (this.nub) this.nub.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  _bindAct() {
    if (!this.act) return;
    this.act.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.onInteract) this.onInteract();
    });
  }
}
