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
    // Gamepad: virtual key codes the pad is holding, kept separate from
    // `keys` so the controller never clobbers physical keyboard state.
    this.padKeys = {};
    this.gamepadIndex = null;
    this._bind();
  }

  _menuOpen() {
    const ids = ['options-overlay','spaceport-overlay',
                 'inventory-overlay','mission-log-overlay','gameover-overlay'];
    return ids.some(id => {
      const el = document.getElementById(id);
      return el && !el.classList.contains('hidden');
    });
  }

  _bind() {
    window.addEventListener('keydown', e => {
      // Don't let movement keys register while any menu is open
      const movementKey = ['KeyW','KeyA','KeyS','KeyD',
                           'ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code);
      if(movementKey && this._menuOpen()) return;

      if(!this.keys[e.code]) this.justPressed[e.code] = true;
      this.keys[e.code] = true;
      // Prevent page scroll on space/arrows
      if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab','KeyC'].includes(e.code)) {
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
    window.addEventListener('gamepadconnected', e => {
      if(this.gamepadIndex == null) this.gamepadIndex = e.gamepad.index;
    });
    window.addEventListener('gamepaddisconnected', e => {
      if(e.gamepad.index === this.gamepadIndex){
        this.gamepadIndex = null;
        this._releaseAllPad();
      }
    });
  }

  // True when at least one gamepad is connected (and has reported input —
  // browsers only expose pads after the first button press).
  hasGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for(const p of pads){ if(p && p.connected) return true; }
    return false;
  }

  // Set/clear a virtual pad key, mirroring the just-pressed/released edges so
  // `pressed()` works for controller buttons exactly like keyboard keys.
  _padSet(code, down) {
    const was = !!this.padKeys[code];
    if(down === was) return;
    this.padKeys[code] = down;
    if(down){ if(!this.keys[code]) this.justPressed[code] = true; }
    else { this.justReleased[code] = true; }
  }
  _releaseAllPad() {
    for(const code in this.padKeys){ if(this.padKeys[code]) this._padSet(code, false); }
  }

  // Poll the active gamepad once per frame and translate its buttons/sticks
  // into the same virtual key codes the rest of the game already reads.
  // `active` gates application so an unplugged-but-present pad (or a player
  // who chose keyboard/touch) is ignored. Standard mapping layout assumed.
  pollGamepad(active) {
    if(!active){ this._releaseAllPad(); return; }
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = (this.gamepadIndex != null) ? pads[this.gamepadIndex] : null;
    if(!gp || !gp.connected){
      gp = null;
      for(const p of pads){ if(p && p.connected){ gp = p; this.gamepadIndex = p.index; break; } }
    }
    if(!gp){ this._releaseAllPad(); return; }

    const DZ = 0.30;
    const btn = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const ax  = i => gp.axes[i] || 0;
    const lx = ax(0), ly = ax(1), rx = ax(2);

    // Movement — left stick or D-pad (rotate-to-turn flight model).
    this._padSet('KeyW', ly < -DZ || btn(12));  // thrust
    this._padSet('KeyS', ly >  DZ || btn(13));  // brake / reverse
    this._padSet('KeyA', lx < -DZ || btn(14));  // turn left
    this._padSet('KeyD', lx >  DZ || btn(15));  // turn right
    this._padSet('KeyQ', rx < -DZ);             // strafe left  (right stick)
    this._padSet('KeyE', rx >  DZ);             // strafe right (right stick)
    // Combat — triggers/bumpers + face buttons.
    this._padSet('Space',        btn(7));       // RT  → fire
    this._padSet('ShiftLeft',    btn(6));       // LT  → boost
    this._padSet('BracketRight', btn(5));       // RB  → cycle weapon
    this._padSet('KeyX',         btn(4));       // LB  → missile
    this._padSet('KeyL',         btn(0));       // A   → land / board
    this._padSet('KeyR',         btn(1));       // B   → target nearest
    this._padSet('KeyV',         btn(2));       // X   → comms
    this._padSet('KeyJ',         btn(3));       // Y   → hyperspace jump (hold)
    // Menus / misc.
    this._padSet('KeyM',  btn(8));              // Back/Select → galaxy map
    this._padSet('Escape',btn(9));              // Start       → options menu
    this._padSet('KeyP',  btn(10));             // L3 → autopilot toggle
    this._padSet('KeyT',  btn(11));             // R3 → cycle target
  }

  // Programmatic key press/release — used by on-screen mobile controls so
  // touch buttons drive the exact same code paths as physical keys.
  touchDown(code) {
    if(!code) return;
    if(!this.keys[code]) this.justPressed[code] = true;
    this.keys[code] = true;
  }
  touchUp(code) {
    if(!code) return;
    this.keys[code] = false;
    this.justReleased[code] = true;
  }

  is(code) { return !!this.keys[code] || !!this.padKeys[code]; }
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
  get altFire()  { return this.pressed('KeyX'); }
};
