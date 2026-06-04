'use strict';
// ── Input handler ─────────────────────────────────────────
G.Input = class {
  constructor() {
    this.keys = {};
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseJustDown = false;
    this.mouseJustUp = false;
    this._prev = {};
    this.justPressed = {};
    this.justReleased = {};
    this._bind();
  }

  _menuOpen() {
    const ids = ['comms-overlay','options-overlay','spaceport-overlay',
                 'inventory-overlay','mission-log-overlay','gameover-overlay'];
    return ids.some(id => {
      const el = document.getElementById(id);
      return el && !el.classList.contains('hidden');
    });
  }

  _bind() {
    window.addEventListener('keydown', e => {
      // Don't let movement keys register while any menu is open
      const movementKey = ['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE',
                           'ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code);
      if(movementKey && this._menuOpen()) return;

      if(!this.keys[e.code]) this.justPressed[e.code] = true;
      this.keys[e.code] = true;
      // Prevent page scroll on space/arrows
      if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', e => {
      this.keys[e.code] = false;
      this.justReleased[e.code] = true;
    });
    window.addEventListener('mousemove', e => {
      const rect = document.getElementById('gameCanvas').getBoundingClientRect();
      this.mouseX = (e.clientX - rect.left) * (G.CANVAS_W / rect.width);
      this.mouseY = (e.clientY - rect.top)  * (G.CANVAS_H / rect.height);
    });
    window.addEventListener('mousedown', e => {
      if(e.button===0){ this.mouseDown=true; this.mouseJustDown=true; }
    });
    window.addEventListener('mouseup', e => {
      if(e.button===0){ this.mouseDown=false; this.mouseJustUp=true; }
    });
  }

  is(code) { return !!this.keys[code]; }
  pressed(code) { return !!this.justPressed[code]; }

  flush() {
    this.justPressed = {};
    this.justReleased = {};
    this.mouseJustDown = false;
    this.mouseJustUp  = false;
  }

  get thrust()   { return this.is('KeyW') || this.is('ArrowUp'); }
  get reverse()  { return this.is('KeyS') || this.is('ArrowDown'); }
  get turnL()    { return this.is('KeyA') || this.is('ArrowLeft'); }
  get turnR()    { return this.is('KeyD') || this.is('ArrowRight'); }
  get strafeL()  { return this.is('KeyQ'); }
  get strafeR()  { return this.is('KeyE'); }
  get boost()    { return this.is('ShiftLeft') || this.is('ShiftRight'); }
  get fire()     { return this.is('Space'); }
  get fireTap()  { return this.pressed('Space'); }
};
