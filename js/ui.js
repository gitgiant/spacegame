'use strict';
// ── UI Manager ────────────────────────────────────────────

// Slot visual positions as [left%, top%] on the ship canvas overlay (300×260)
G.SLOT_RING = {
  cockpit: { angle:   0, r:0.30, color:'#ffd24a' },
  sensor:  { angle:-120, r:0.42, color:'#44aaff' },
  jump:    { angle: -60, r:0.42, color:'#00ffcc' },
  weapon:  { angle:-150, r:0.38, color:'#ff4444' },
  turret:  { angle:-30,  r:0.38, color:'#ffaa00' },
  shield:  { angle: 150, r:0.38, color:'#4488ff' },
  armor:   { angle: 170, r:0.32, color:'#888888' },
  engine:  { angle:  90, r:0.44, color:'#ff8800' },
  cargo:   { angle: 120, r:0.38, color:'#886622' },
  fuel:    { angle:  60, r:0.38, color:'#ffcc00' },
  crew:    { angle:  30, r:0.42, color:'#44ff88' },
  special: { angle: -10, r:0.42, color:'#cc44ff' },
  power:   { angle:  10, r:0.32, color:'#ffff44' },
  hull:    { angle: 180, r:0.28, color:'#667799' },
};

G.UI = class {
  constructor() {
    this._msgs     = [];
    this._msgHistory = [];
    this._spTab    = 'trade';
    this._currentSysId = 'sol';
    this.els = {};
    this._cacheEls();
    this._bindControls();
    this._bindMobileControls();
    this._setupMenuNav();
  }

  // ── Module card helpers ───────────────────────────────────

  _modIconURL(visual) {
    if (!this._iconCache) this._iconCache = {};
    const v = visual || 'special';
    if (!this._iconCache[v]) {
      const sprite = G.Sprites.getMod(v);
      const c = document.createElement('canvas');
      c.width = c.height = 32;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sprite, 0, 0, 32, 32);
      this._iconCache[v] = c.toDataURL();
    }
    return this._iconCache[v];
  }

  _modStatRows(mod) {
    const rows = [];
    if (mod.slot === 'weapon' || mod.slot === 'turret') {
      // Weapons store pre-formatted stats string: "DMG:60  RNG:1100  RATE:0.6/s"
      for (const tok of (mod.stats || '').split(/\s+/).filter(Boolean)) {
        const i = tok.indexOf(':');
        if (i > 0) rows.push([tok.slice(0, i), tok.slice(i + 1)]);
      }
      if (mod.energyCost > 0) rows.push(['⚡/SH', String(mod.energyCost)]);
      if (mod.ammo) rows.push(['AMMO', mod.ammo.replace('kinetic_rounds','KINETIC').replace(/_/g,' ').slice(0,7).toUpperCase()]);
    } else {
      const s = mod.stats || {};
      if (s.thrust)         rows.push(['THRUST',  '+' + (s.thrust / 1000 | 0) + 'k']);
      if (s.turnSpeed)      rows.push(['TURN',    '+' + s.turnSpeed.toFixed(1)]);
      if (s.maxShields)     rows.push(['SHIELD',  '+' + s.maxShields]);
      if (s.shieldRegen)    rows.push(['SH/S',    '+' + s.shieldRegen]);
      if (s.maxHull)        rows.push(['HULL',    '+' + s.maxHull]);
      if (s.armor)          rows.push(['ARMOR',   '+' + s.armor]);
      if (s.cargoSpace)     rows.push(['CARGO',   '+' + s.cargoSpace]);
      if (s.maxFuel)        rows.push(['FUEL',    '+' + s.maxFuel]);
      if (s.maxEnergy)      rows.push(['ENERGY',  '+' + s.maxEnergy]);
      if (s.energyRegen)    rows.push(['EN/S',    '+' + s.energyRegen]);
      if (s.canJump)        rows.push(['JUMP',    '✓']);
      if (s.jumpRange)      rows.push(['RANGE',   '+' + s.jumpRange + ' sys']);
      if (s.sensorRange)    rows.push(['SENSOR',  '+' + s.sensorRange]);
      if (s.detectCloaked)  rows.push(['UNCLOAK', '✓']);
      if (s.canRadarScan)   rows.push(['RADAR',   '✓']);
      if (s.autoRepair)     rows.push(['REPAIR',  '+' + s.autoRepair + '/s']);
      if (s.canCraft)       rows.push(['CRAFT',   '✓']);
      if (s.tractorRange)   rows.push(['TRACTOR', '+' + s.tractorRange]);
      if (s.maxCrew)        rows.push(['CREW',    '+' + s.maxCrew]);
      if (s.crewEfficiency) rows.push(['CRWEFF',  '+' + Math.round(s.crewEfficiency * 100) + '%']);
      if (s.escapePods)     rows.push(['PODS',    '+' + s.escapePods]);
      if (s.mass)           rows.push(['MASS',    '+' + s.mass + 't']);
      if (mod.energyDraw)   rows.push(['⚡/S',    String(mod.energyDraw)]);
    }
    return rows;
  }

  _modCardHTML(mod, actionsHTML) {
    const icon    = this._modIconURL(mod.visual || mod.slot);
    const slotCol = G.SLOT_RING?.[mod.slot]?.color || '#aaa';
    const rarity  = G.RARITY?.[mod.rarity || 'c']?.label || '';
    const rows    = this._modStatRows(mod);
    const statsHTML = '<div class="mod-stat-grid">' +
      rows.map(([l, v]) =>
        `<div class="mod-stat-row"><span>${l}</span><span class="sv">${v}</span></div>`
      ).join('') + '</div>';
    return `<div class="mod-card-header">
        <img src="${icon}" class="mod-icon" alt="${mod.slot}">
        <div class="mod-card-title">
          <div class="item-name rarity-${mod.rarity||'c'}" style="font-size:6px;margin-bottom:2px">${mod.name}</div>
          <div style="font-size:5px;color:${slotCol}">${mod.slot.toUpperCase()}</div>
          <div style="font-size:4px;color:#334455;margin-top:1px">${rarity.toUpperCase()}</div>
        </div>
        <div class="item-price" style="font-size:6px;text-align:right">${mod.price ? '$' + G.fmt(mod.price) : ''}</div>
      </div>
      <div class="mod-card-divider"></div>
      ${statsHTML}
      <div style="font-size:5px;color:#334455;line-height:1.5;margin:3px 0">${mod.desc || ''}</div>
      ${actionsHTML}`;
  }

  _cacheEls() {
    const ids=['hud','hud-top','galaxy-overlay','spaceport-overlay','inventory-overlay',
      'gameover-overlay','main-menu','system-label','target-panel','tgt-name',
      'tgt-hull-bar','tgt-shld-bar','tgt-dist','tgt-canvas','tgt-arrow','tgt-hull-val','tgt-shld-val','tgt-intention','tgt-scan',
      'msgs','credits-hud','cargo-hud',
      'speed-hud','weapon-hud','bar-hull','bar-shield','bar-fuel',
      'sp-name','sp-body','sp-credits','sp-cargo','sp-ship',
      'jump-btn','gameover-title','gameover-stats',
      'hostile-alert'];
    for(const id of ids) this.els[id]=document.getElementById(id);

    const ln=document.createElement('div'); ln.id='loot-notif';
    document.getElementById('game-container').appendChild(ln);
    this.els['loot-notif']=ln;

    const ip=document.createElement('div'); ip.id='interact-prompt'; ip.classList.add('hidden');
    document.getElementById('game-container').appendChild(ip);
    this.els['interact-prompt']=ip;

    this.els['comms-overlay']     = document.getElementById('comms-overlay');
    this.els['comms-faction-tag'] = document.getElementById('comms-faction-tag');
    this.els['comms-ship-name']   = document.getElementById('comms-ship-name');
    this.els['comms-class-tag']   = document.getElementById('comms-class-tag');
    this.els['comms-response-text']= document.getElementById('comms-response-text');
    this.els['comms-options-list'] = document.getElementById('comms-options-list');

    document.getElementById('comms-close-btn')?.addEventListener('click',()=>this.closeComms());
    document.getElementById('close-log-btn')?.addEventListener('click',()=>this.hideMissionLog());
    document.getElementById('close-combat-log-btn')?.addEventListener('click',()=>this.hideCombatLog());
    this.els['comms-overlay']?.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && !this.els['comms-overlay']?.classList.contains('hidden')) {
        e.preventDefault();
        e.stopPropagation();
        this.closeComms();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE') {
        const spaceportOpen = this.els['spaceport-overlay'] && !this.els['spaceport-overlay']?.classList.contains('hidden');
        const inventoryOpen = this.els['inventory-overlay'] && !this.els['inventory-overlay']?.classList.contains('hidden');
        const charScreenOpen = document.getElementById('char-screen-overlay') && !document.getElementById('char-screen-overlay')?.classList.contains('hidden');
        if (spaceportOpen || inventoryOpen || charScreenOpen) {
          e.preventDefault();
          if (spaceportOpen) this.hideSpaceport();
          if (inventoryOpen) this.hideInventory();
          if (charScreenOpen) this.hideCharScreen();
        }
      }
    });
    this._commsNPC = null;
  }

  _bindControls() {
    // Menu click sound for any .btn or .tab element
    document.addEventListener('click', e=>{
      const id = e.target.id;
      if(id === 'start-btn' || id === 'continue-btn') return;
      if(e.target.classList.contains('btn') || e.target.classList.contains('tab')) {
        G.sound?.menuClick();
      }
    });

    document.getElementById('spaceport-overlay').addEventListener('click', e=>{
      if(e.target.classList.contains('tab')) {
        this._spTab=e.target.dataset.tab;
        document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
        e.target.classList.add('active');
        this.renderSpaceportTab(this._spTab);
      } else if(e.target.id === 'spaceport-overlay') {
        this.hideSpaceport();
      }
    });
    document.getElementById('launch-btn').addEventListener('click',()=>G.game.launch());
    document.getElementById('close-inv-btn')?.addEventListener('click',()=>this.hideInventory());
    document.getElementById('restart-btn').addEventListener('click',()=>G.game.restart());
    document.getElementById('gameover-load-btn')?.addEventListener('click',()=>{
      const save=localStorage.getItem(G.SAVE_KEY);
      if(save) G.game.loadGame(save);
    });
    this._updateLoadBtns();
    document.getElementById('start-btn').addEventListener('click',()=>G.game.start());
    document.getElementById('opt-save-btn')?.addEventListener('click',()=>{
      G.game.saveGame();
      this._updateLoadBtns();
    });
    document.getElementById('opt-load-btn')?.addEventListener('click',()=>{
      const save=localStorage.getItem(G.SAVE_KEY);
      if(save) {
        document.getElementById('options-overlay')?.classList.add('hidden');
        G.game.paused=false;
        G.game.loadGame(save);
      }
    });
    document.getElementById('opt-controls-btn')?.addEventListener('click',()=>{
      this.showControlsMenu();
    });
    // Sound & Music submenu
    document.getElementById('opt-sound-btn')?.addEventListener('click',()=>{
      document.getElementById('sound-overlay')?.classList.remove('hidden');
      this.refreshMusicPicker();
    });
    document.getElementById('sound-close-btn')?.addEventListener('click',()=>{
      document.getElementById('sound-overlay')?.classList.add('hidden');
    });
    document.getElementById('music-prev-btn')?.addEventListener('click',()=>{ G.sound?.musicPrev?.(); });
    document.getElementById('music-next-btn')?.addEventListener('click',()=>{ G.sound?.musicNext?.(); });
    document.getElementById('music-playstop-btn')?.addEventListener('click',()=>{
      const s=G.sound; if(!s) return;
      if(s.currentTrack().playing) s.musicStop(); else s.musicPlay();
    });
    document.getElementById('music-auto')?.addEventListener('change', e=>{ G.sound?.musicSetAuto?.(e.target.checked); });
    document.getElementById('ctrl-close-btn')?.addEventListener('click',()=>{
      document.getElementById('controls-overlay')?.classList.add('hidden');
    });
    document.getElementById('opt-fleet-btn')?.addEventListener('click',()=>{
      document.getElementById('options-overlay')?.classList.add('hidden');
      G.game.paused = false;
      this.showFleetMenu();
    });
    document.getElementById('fleet-close-btn')?.addEventListener('click',()=>{
      document.getElementById('fleet-overlay')?.classList.add('hidden');
      G.game.paused = false;
    });
    document.getElementById('opt-ship-btn')?.addEventListener('click',()=>{
      document.getElementById('options-overlay')?.classList.add('hidden');
      G.game.paused = true;
      this.showShipMenu();
    });
    document.getElementById('ship-close-btn')?.addEventListener('click',()=>{
      document.getElementById('ship-overlay')?.classList.add('hidden');
      G.game.paused = false;
    });
    // Boarding popup
    document.getElementById('board-loot-btn')?.addEventListener('click',()=>{
      const e = this._boardingTarget; if(!e) return;
      const el = document.getElementById('boarding-result');
      if(e.type === 'derelict') {
        const items = G.game.space.lootDerelict(e, G.game.player);
        if(el) el.innerHTML = items?.length
          ? `<span style="color:#ffcc00">Looted: ${items.map(i=>i.qty+'x '+(G.ITEMS[i.id]?.name||i.id)).join(', ')}</span>`
          : '<span style="color:#ff4444">Nothing to take.</span>';
        G.sound?.lootPickup();
      } else {
        const savedCreds = e.credits || 0;
        const res = G.game.space.boardEnemy(e, G.game.player);
        if(el) el.innerHTML = res
          ? `<span style="color:#ffcc00">Looted: +${G.fmtCredits(savedCreds)}${res.items?.length?' + '+res.items.length+' items':''}</span>`
          : '<span style="color:#ff4444">Nothing to take.</span>';
        G.sound?.lootPickup();
      }
      document.getElementById('boarding-options').style.display='none';
    });
    document.getElementById('board-scuttle-btn')?.addEventListener('click',()=>{
      const e = this._boardingTarget; if(!e) return;
      const el = document.getElementById('boarding-result');
      if(e.type === 'derelict') {
        G.game.space.scuttleDerelict(e);
        if(el) el.innerHTML = '<span style="color:#ff6644">Derelict scuttled — debris scattered.</span>';
      } else {
        G.game.space.scuttleEnemy(e);
        if(el) el.innerHTML = '<span style="color:#ff6644">Ship scuttled — debris scattered.</span>';
      }
      document.getElementById('boarding-options').style.display='none';
    });
    document.getElementById('board-commandeer-btn')?.addEventListener('click',()=>{
      const e = this._boardingTarget; if(!e) return;
      const el = document.getElementById('boarding-result');
      const res = e.type === 'derelict' ? G.game.commandeerDerelict(e) : G.game.commandeerShip(e);
      if(el) el.innerHTML = res.success
        ? `<span style="color:#44ff88">Success! ${res.entry.fleetName} joins your fleet.</span>`
        : `<span style="color:#ff4444">Failed (${Math.round(res.chance*100)}% odds): ${res.reason}</span>`;
      document.getElementById('boarding-options').style.display='none';
    });
    document.getElementById('boarding-close-btn')?.addEventListener('click',()=>this.closeBoardingPopup());
    document.getElementById('disabled-ship-close-btn')?.addEventListener('click',()=>this.closeDisabledShipPopup());
    document.getElementById('opt-quit-btn')?.addEventListener('click',()=>{
      document.getElementById('options-overlay')?.classList.add('hidden');
      G.game.paused = false;
      G.game.quitToMenu();
    });
    document.getElementById('opt-close-btn')?.addEventListener('click',()=>{
      document.getElementById('options-overlay')?.classList.add('hidden');
      G.game.paused = false;
    });
    document.getElementById('opt-log-btn')?.addEventListener('click',()=>this.showCombatLog());
    document.getElementById('opt-debug-btn')?.addEventListener('click',()=>{
      this.showDebugMenu();
    });
    document.getElementById('debug-close-btn')?.addEventListener('click',()=>{
      document.getElementById('debug-overlay')?.classList.add('hidden');
      if(G.game) G.game.paused = false;
    });
    document.getElementById('opt-camera-btn')?.addEventListener('click',()=>{
      this.showCameraMenu();
    });
    document.getElementById('camera-close-btn')?.addEventListener('click',()=>{
      document.getElementById('camera-overlay')?.classList.add('hidden');
    });
    document.getElementById('opt-sfx-enabled')?.addEventListener('change', e=>{
      const on = e.target.checked;
      document.getElementById('opt-sfx-label').textContent = on ? 'ON' : 'OFF';
      G.sound?.setEnabled(on);
    });
    document.getElementById('opt-volume')?.addEventListener('input', e=>{
      const v = parseInt(e.target.value) / 100;
      document.getElementById('opt-volume-val').textContent = e.target.value + '%';
      G.sound?.setVolume(v);
    });
    document.getElementById('opt-music-enabled')?.addEventListener('change', e=>{
      const on = e.target.checked;
      document.getElementById('opt-music-label').textContent = on ? 'ON' : 'OFF';
      G.sound?.setMusicEnabled(on);
      this.refreshMusicPicker();
      e.target.blur();
    });
    document.getElementById('opt-music-volume')?.addEventListener('input', e=>{
      const v = parseInt(e.target.value) / 100;
      document.getElementById('opt-music-vol-val').textContent = e.target.value + '%';
      G.sound?.setMusicVolume(v);
    });
    this._voiceEnabled = true;
    this._voiceVolume  = 0.25;
    document.getElementById('opt-voice-enabled')?.addEventListener('change', e=>{
      this._voiceEnabled = e.target.checked;
      document.getElementById('opt-voice-label').textContent = this._voiceEnabled ? 'ON' : 'OFF';
      if(!this._voiceEnabled && window.speechSynthesis) speechSynthesis.cancel();
      e.target.blur();
    });
    document.getElementById('opt-voice-volume')?.addEventListener('input', e=>{
      this._voiceVolume = parseInt(e.target.value) / 100;
      document.getElementById('opt-voice-vol-val').textContent = e.target.value + '%';
    });
    document.querySelectorAll('#opt-control-scheme .scheme-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        G.game?.setControlScheme(btn.dataset.scheme);
      });
    });
    this.refreshControlScheme();
    const _updateSteerBtns = () => {
      const joy = !!G.game?._joystickMode;
      document.getElementById('opt-steer-dpad')?.style.setProperty('color', joy ? '' : '#44ffcc');
      document.getElementById('opt-steer-dpad')?.style.setProperty('border-color', joy ? '' : '#44ffcc');
      document.getElementById('opt-steer-joy')?.style.setProperty('color', joy ? '#44ffcc' : '');
      document.getElementById('opt-steer-joy')?.style.setProperty('border-color', joy ? '#44ffcc' : '');
    };
    document.getElementById('opt-steer-dpad')?.addEventListener('click', ()=>{
      G.game?._saveSteerPref(false); _updateSteerBtns();
    });
    document.getElementById('opt-steer-joy')?.addEventListener('click', ()=>{
      G.game?._saveSteerPref(true); _updateSteerBtns();
    });
    document.getElementById('continue-btn')?.addEventListener('click',()=>{
      const save=localStorage.getItem(G.SAVE_KEY);
      if(save) G.game.loadGame(save);
    });
    // Minimap click → target nearest ship at position
    document.getElementById('minimap')?.addEventListener('click', e=>{
      if(!G.game?.space) return;
      const canvas=e.currentTarget;
      const rect=canvas.getBoundingClientRect();
      const mx=(e.clientX-rect.left)/rect.width;
      const my=(e.clientY-rect.top)/rect.height;
      const p=G.game.player;
      const RANGE=8000;
      const wx=p.x+(mx-0.5)*RANGE*2;
      const wy=p.y+(my-0.5)*RANGE*2;
      const all=G.game.space.allTargets();
      let nearest=null,nearestD=800;
      for(const s of all){
        const d=Math.hypot(s.x-wx,s.y-wy);
        if(d<nearestD){nearestD=d;nearest=s;}
      }
      if(nearest) { G.game.target=nearest; G.sound?.targetLock(); }
    });

    document.getElementById('minimap')?.addEventListener('dblclick', e=>{
      if(!G.game?.space) return;
      const canvas=e.currentTarget;
      const rect=canvas.getBoundingClientRect();
      const mx=(e.clientX-rect.left)/rect.width;
      const my=(e.clientY-rect.top)/rect.height;
      const p=G.game.player;
      const RANGE=8000;
      const wx=p.x+(mx-0.5)*RANGE*2;
      const wy=p.y+(my-0.5)*RANGE*2;
      const CLICK_RADIUS=200;
      const all=G.game.space.allTargets().filter(s=>!s._inDust&&s.type!=='derelict'&&s.type!=='turret');
      let best=null,bestD=CLICK_RADIUS;
      for(const s of all){
        const d=Math.hypot(s.x-wx,s.y-wy);
        if(d<bestD){bestD=d;best=s;}
      }
      if(best) { G.game.target=best; this.openComms(best); }
    });
  }

  // Highlight the active scheme button and show what 'auto' currently
  // resolves to, so the player can see which controls are live.
  refreshControlScheme() {
    const g = G.game;
    const sel = g ? g._controlScheme : 'auto';
    const btns = document.querySelectorAll('#opt-control-scheme .scheme-btn');
    btns.forEach(b=> b.classList.toggle('active', b.dataset.scheme === sel));
    const hint = document.getElementById('opt-control-hint');
    if(hint){
      const eff = g ? g._effectiveScheme() : 'keyboard';
      const NAMES = { keyboard:'KEYBOARD', touch:'TOUCH', gamepad:'CONTROLLER' };
      hint.textContent = sel === 'auto' ? ('AUTO → ' + (NAMES[eff]||eff)) : '';
    }
  }

  // ── Mobile touch controls ────────────────────────────────
  // Each .mbtn drives its data-key through Input.touchDown/Up so on-screen
  // buttons behave exactly like the physical key. Per-pointer capture lets
  // multiple buttons (e.g. turn + fire) be held at once.
  _bindMobileControls() {
    const root = document.getElementById('mobile-controls');
    if(!root) return;
    root.querySelectorAll('.mbtn').forEach(btn=>{
      const code = btn.dataset.key;
      const down = e=>{
        e.preventDefault();
        try { btn.setPointerCapture(e.pointerId); } catch(_){}
        btn.classList.add('held');
        G.game?.input.touchDown(code);
      };
      const up = e=>{
        e.preventDefault();
        btn.classList.remove('held');
        G.game?.input.touchUp(code);
      };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      // Block the synthetic click/contextmenu that long-press can raise.
      btn.addEventListener('contextmenu', e=>e.preventDefault());
    });

    // Zoom +/- buttons — tap = one step, hold = repeat.
    root.querySelectorAll('.mzbtn').forEach(btn=>{
      const dir = btn.dataset.zoom === 'in' ? 1 : -1;
      let rep = null;
      const stop = e=>{ if(e) e.preventDefault(); btn.classList.remove('held'); if(rep){ clearInterval(rep); rep=null; } };
      const start = e=>{
        e.preventDefault();
        try { btn.setPointerCapture(e.pointerId); } catch(_){}
        btn.classList.add('held');
        G.game?.zoomStep(dir);
        if(rep) clearInterval(rep);
        rep = setInterval(()=>G.game?.zoomStep(dir), 140);
      };
      btn.addEventListener('pointerdown', start);
      btn.addEventListener('pointerup', stop);
      btn.addEventListener('pointercancel', stop);
      btn.addEventListener('pointerleave', stop);
      btn.addEventListener('contextmenu', e=>e.preventDefault());
    });

    // Virtual joystick
    const joy = document.getElementById('mc-joystick');
    if(joy){
      const knob = document.getElementById('mc-joy-knob');
      const JOY_KEYS = ['KeyW','KeyS','KeyA','KeyD'];
      let _joyPtr = null;
      const _joyRelease = ()=>{
        JOY_KEYS.forEach(k=>G.game?.input.touchUp(k));
        knob.style.transform = 'translate(-50%, -50%)';
        joy.classList.remove('active');
      };
      const _joyUpdate = e=>{
        const rect = joy.getBoundingClientRect();
        const cx = rect.left + rect.width/2;
        const cy = rect.top  + rect.height/2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy);
        const maxR = rect.width/2 - 12;
        const clamp = Math.min(dist, maxR);
        const ang   = Math.atan2(dy, dx);
        const kx = Math.cos(ang) * clamp;
        const ky = Math.sin(ang) * clamp;
        knob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
        const DEAD = maxR * 0.22;
        const wW = dy < -DEAD, wS = dy > DEAD, wA = dx < -DEAD, wD = dx > DEAD;
        const inp = G.game?.input;
        if(inp){
          [['KeyW',wW],['KeyS',wS],['KeyA',wA],['KeyD',wD]]
            .forEach(([k,w])=>w ? inp.touchDown(k) : inp.touchUp(k));
        }
      };
      joy.addEventListener('pointerdown', e=>{
        e.preventDefault();
        if(_joyPtr !== null) return;
        _joyPtr = e.pointerId;
        try{ joy.setPointerCapture(e.pointerId); }catch(_){}
        joy.classList.add('active');
        _joyUpdate(e);
      });
      joy.addEventListener('pointermove', e=>{
        if(e.pointerId !== _joyPtr) return;
        e.preventDefault();
        _joyUpdate(e);
      });
      joy.addEventListener('pointerup',     e=>{ if(e.pointerId===_joyPtr){ _joyPtr=null; _joyRelease(); }});
      joy.addEventListener('pointercancel', e=>{ if(e.pointerId===_joyPtr){ _joyPtr=null; _joyRelease(); }});
    }

    // Tappable ability slots — the bar is re-rendered every frame, so use a
    // single delegated handler that reads data-aid off the tapped slot. This
    // lets touch players fire abilities that otherwise need the 1-0 number row.
    const abar = document.getElementById('ability-bar');
    if(abar){
      abar.addEventListener('pointerdown', e=>{
        const slot = e.target.closest?.('.ability-slot');
        if(!slot || !slot.dataset.aid) return;
        e.preventDefault();
        const g = G.game;
        if(!g || g.state!=='space' || !g.player || g.player.disabled) return;
        g._useAbility(slot.dataset.aid, g.player);
      });
      abar.addEventListener('contextmenu', e=>e.preventDefault());
    }
  }

  // ── HUD ──────────────────────────────────────────────────
  _getBrokenSystems(player) {
    const sysNames = {
      engine:'ENGINES', shield:'SHIELDS', weapon:'WEAPONS',
      turret:'TURRETS', jump:'JUMP DRIVE', power:'POWER CORE',
      fuel:'FUEL SYSTEM', cargo:'CARGO HOLD', sensor:'SENSORS',
      armor:'ARMOR', crew:'CREW', special:'SYSTEMS'
    };
    const systems = new Set();
    for(const inst of Object.values(player.modules)) {
      if(!inst.broken) continue;
      const mod = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
      const slot = mod?.slot || 'special';
      systems.add(sysNames[slot] || slot.toUpperCase());
    }
    return [...systems];
  }

  updateAbilityBar(player) {
    const bar = document.getElementById('ability-bar');
    if(!bar) return;
    const abilities = player?.abilities || [];
    const cds = player?.abilityCooldowns || {};
    const LABELS = ['1','2','3','4','5','6','7','8','9','0'];
    let html = '';
    const blocked = player?._abilityBlocked || {};
    for(let i=0;i<10;i++) {
      const aid = abilities[i];
      const def = aid ? G.ABILITIES?.[aid] : null;
      if(!def) continue;
      const cd = cds[aid] || 0;
      // Greyed out when the granting module is destroyed; hover shows the warning.
      const blk = blocked[aid];
      const style = blk
        ? `border-color:#33333388;box-shadow:none;opacity:0.4;filter:grayscale(1)`
        : `border-color:${def.color}88;box-shadow:0 0 6px ${def.color}33`;
      const title = blk ? `${blk} destroyed — ${def.name} unavailable` : def.name;
      html += `<div class="ability-slot${blk?' ability-blocked':''}" data-aid="${aid}" title="${title}" style="${style}">
        <div class="ability-slot-num">${LABELS[i]}</div>
        <div class="ability-slot-icon-wrap">
          <div class="ability-slot-icon" style="color:${blk?'#777':def.color}">${def.icon}</div>
          ${blk?`<div class="ability-slot-cd" style="color:#ff6644">✖</div>`:(cd>0?`<div class="ability-slot-cd">${Math.ceil(cd)}s</div>`:'')}
        </div>
        <div class="ability-slot-name" style="color:${blk?'#777':def.color+'dd'}">${def.name}</div>
      </div>`;
    }
    bar.innerHTML = html;
  }

  updateHUD(player, space, target) {
    const p=player, e=this.els;
    // No hull pool — the "hull" bar now shows CORE integrity (core destroyed =
    // explosion). Module damage is read off the ship grid HUD.
    const hPct = (p.coreIntegrity ? p.coreIntegrity() : 1) * 100;
    const sPct=G.pct(p.shields,Math.max(p.maxShields,1));
    const fPct=G.pct(p.fuel,p.maxFuel);
    if(e['bar-hull']) {
      e['bar-hull'].style.width=hPct+'%';
      e['bar-hull'].style.background = (p._invulTimer > 0) ? '#ffffff' : (hPct < 35 ? '#ff4444' : '');
    }
    if(e['bar-shield']) e['bar-shield'].style.width=sPct+'%';
    if(e['bar-fuel'])   e['bar-fuel'].style.width=fPct+'%';
    const ePct=G.pct(p.energy,Math.max(p.maxEnergy,1));
    const eBar=document.getElementById('bar-energy');
    if(eBar) eBar.style.width=ePct+'%';
    if(e['speed-hud']){
      const spd=Math.sqrt(p.vx*p.vx+p.vy*p.vy);
      e['speed-hud'].textContent=Math.round(spd)+' m/s';
      const velArrow=document.getElementById('vel-arrow');
      if(velArrow){
        if(spd>5){
          const deg=Math.atan2(p.vx,-p.vy)*180/Math.PI;
          velArrow.style.transform=`rotate(${deg.toFixed(1)}deg)`;
          velArrow.style.opacity=Math.min(1,spd/80).toFixed(2);
          velArrow.style.color='#00ffee';
        } else {
          velArrow.style.opacity='0.18';
          velArrow.style.color='#334455';
        }
      }
    }
    if(e['credits-hud'])e['credits-hud'].textContent=G.fmtCredits(G.game.credits);
    if(e['cargo-hud']){
      const used=G.game.fleetCargoUsed();
      const cap=G.game.fleetCargoSpace();
      e['cargo-hud'].textContent='CARGO '+used+'/'+cap+(G.game.fleet?.length?' [FLEET]':'');
      e['cargo-hud'].style.color=used>=cap?'#ff4444':'';
    }
    if(e['weapon-hud']&&p.weaponSlots.length>0){
      e['weapon-hud'].innerHTML=p.weaponSlots.map((w,i)=>{
        const wDef=G.WEAPONS[w.weaponId], ready=w.cooldown<=0, active=i===p.activeWeapon;
        let ammoStr='';
        if(wDef?.ammo){
          const cnt=p.ammo[wDef.ammo]||0;
          ammoStr=` <span style="color:${cnt>0?'#ffcc44':'#ff4444'}">${cnt}</span>`;
        }
        return `<div style="color:${active?'#00ffee':'#556677'};font-size:6px;margin-bottom:2px">${active?'▶':' '} ${wDef?.name||'?'}${ammoStr} ${ready?'<span style="color:#44ff44">RDY</span>':'<span style="color:#ff4444">—</span>'}</div>`;
      }).join('');
    }
    // Autopilot indicator
    const apEl=document.getElementById('autopilot-hud');
    if(apEl) apEl.classList.toggle('hidden', !G.game?._autopilot);
    // Broken module warnings
    const warnEl = document.getElementById('hud-warnings');
    if(warnEl) {
      const broken = this._getBrokenSystems(p);
      if(broken.length) {
        warnEl.innerHTML = broken.map(s=>`<span class="hud-warn-item">⚠ ${s} OFFLINE</span>`).join('');
        warnEl.classList.remove('hidden');
      } else {
        warnEl.classList.add('hidden');
      }
    }

    // Hostile enemy alert
    const inSpace = G.game?.state === 'space';
    const hostileAlertEl = e['hostile-alert'];
    if(hostileAlertEl && space && inSpace) {
      const hCount =
        space.enemies.filter(en=>!en.dead&&!en.boarded).length +
        space.npcs.filter(n=>!n.dead&&n.hostile).length +
        (space.turrets||[]).filter(t=>!t._dead&&t.hostile).length;
      if(hCount > 0) {
        hostileAlertEl.textContent = '⚠ ' + hCount + ' HOSTILE' + (hCount !== 1 ? 'S' : '') + ' IN SYSTEM';
        hostileAlertEl.classList.remove('hidden');
      } else {
        hostileAlertEl.classList.add('hidden');
      }
    } else if(hostileAlertEl) {
      hostileAlertEl.classList.add('hidden');
    }

    // Dodge cooldown indicator
    const dodgeEl = document.getElementById('dodge-cooldown-hud');
    if(dodgeEl && inSpace) {
      const cooldown = p._strafeCooldown || 0;
      if(cooldown > 0) {
        dodgeEl.textContent = 'DODGE ' + Math.ceil(cooldown * 10) / 10 + 's';
        dodgeEl.classList.remove('hidden');
      } else {
        dodgeEl.classList.add('hidden');
      }
    }

    // Target panel: always show sprite + bars when a target is locked
    if(target && !target.dead) {
      if(e['target-panel']) e['target-panel'].classList.remove('hidden');

      const isMissileTgt = target.type === 'missile';
      const tgtCanvas = e['tgt-canvas'];
      if(tgtCanvas) {
        const PORT = 48;
        const ctx2 = tgtCanvas.getContext('2d');
        if(isMissileTgt) {
          if(this._tgtPortTarget !== target) {
            this._tgtPortTarget = target; this._tgtPortEntries = null;
            ctx2.fillStyle = '#000a18'; ctx2.fillRect(0, 0, PORT, PORT);
            ctx2.save(); ctx2.translate(24, 24);
            ctx2.fillStyle = '#ff6600';
            ctx2.beginPath(); ctx2.moveTo(0,-14); ctx2.lineTo(5,0); ctx2.lineTo(3,14); ctx2.lineTo(0,16); ctx2.lineTo(-3,14); ctx2.lineTo(-5,0); ctx2.closePath(); ctx2.fill();
            ctx2.fillStyle = '#ffaa44';
            ctx2.beginPath(); ctx2.arc(0, -10, 3, 0, Math.PI*2); ctx2.fill();
            ctx2.restore();
          }
        } else {
          const renderer = G.game?.renderer;
          if(renderer) {
            if(this._tgtPortTarget !== target) {
              this._tgtPortTarget = target;
              const hullCol = G.FACTIONS[target.faction]?.color || target.color || '#667799';
              this._tgtPortEntries = target.modules
                ? renderer._playerTileEntries(target)
                : renderer._npcTileEntries(target, hullCol);
              if(this._tgtPortEntries?.length) {
                // Compute pixel bounding box at unit scale (size=1), then find the max
                // radial extent from centre so the scale works for any rotation angle.
                let mnx=Infinity,mxx=-Infinity,mny=Infinity,mxy=-Infinity;
                for(const en of this._tgtPortEntries) {
                  const p = G.hexToPixel(en.q, en.r, 1);
                  if(p.x<mnx)mnx=p.x; if(p.x>mxx)mxx=p.x;
                  if(p.y<mny)mny=p.y; if(p.y>mxy)mxy=p.y;
                }
                const bcx=(mnx+mxx)/2, bcy=(mny+mxy)/2;
                let maxRadUnit = 0;
                for(const en of this._tgtPortEntries) {
                  const p = G.hexToPixel(en.q, en.r, 1);
                  const d = Math.hypot(p.x-bcx, p.y-bcy);
                  if(d > maxRadUnit) maxRadUnit = d;
                }
                // +1 hex radius for the tile border; leave 4px padding inside PORT
                const hexR1 = G.HEX_R;
                this._tgtPortScale = maxRadUnit > 0
                  ? (PORT/2 - 4) / ((maxRadUnit + 1) * hexR1)
                  : 1;
              }
            }
            if(this._tgtPortEntries?.length) {
              ctx2.fillStyle = '#000a18'; ctx2.fillRect(0, 0, PORT, PORT);
              renderer.drawShipTileDisplay(PORT/2, PORT/2, this._tgtPortScale||1, this._tgtPortEntries, target.angle, null, ctx2);
            }
          }
        }
      }

      // Off-screen direction arrow — only visible when target is off-screen
      const arrowEl = e['tgt-arrow'];
      if(arrowEl && G.game) {
        const sx = target.x - G.game.camX;
        const sy = target.y - G.game.camY;
        const offScreen = sx < -60 || sx > G.CANVAS_W+60 || sy < -60 || sy > G.CANVAS_H+60;
        if(offScreen) {
          arrowEl.classList.remove('hidden');
          const rot = Math.atan2(target.x - p.x, -(target.y - p.y));
          arrowEl.style.transform = `rotate(${rot}rad)`;
        } else {
          arrowEl.classList.add('hidden');
        }
      }

      if(e['tgt-name']){
        const tplId  = target.templateId || target.shapeId;
        const tpl    = G.SHIPS[tplId];
        const tShip  = target.type === 'turret' ? 'TURRET' : target.type === 'missile' ? 'MISSILE' : (target.name || tpl?.name || 'SHIP');
        let statusTag = '';
        if(isMissileTgt) {
          statusTag = ' <span style="color:#ff4400">■ HOSTILE</span>';
          e['tgt-name'].innerHTML = 'MISSILE <span style="color:#ff6600">■ INCOMING</span>' + statusTag;
        } else {
          const tFac   = target.faction||'?';
          const facColor = G.FACTIONS[tFac]?.color || '#888888';
          const _cls = tpl?.class || target.class;
          const tClass = _cls ? ` <span style="color:#445566;font-size:5px">[${_cls.toUpperCase()}]</span>` : '';
          if(target.isFleetShip) {
            statusTag = ' <span style="color:#00ffee">■ ESCORT</span>';
          } else if(target.disabled || target._dead) {
            statusTag = ' <span style="color:#ff6600">■ DISABLED</span>';
          } else {
            const isHostile = target.hostile || (target.faction && (G.game?.getRel(target.faction)||0) < -30 && target !== G.game?.player);
            statusTag = isHostile ? ' <span style="color:#ff3333">■ HOSTILE</span>' : ' <span style="color:#44ff88">■ NEUTRAL</span>';
          }
          e['tgt-name'].innerHTML = tShip.toUpperCase() + tClass + ' <span style="color:' + facColor + '">■ ' + tFac.toUpperCase() + '</span>' + statusTag;
        }
      }
      if(isMissileTgt) {
        const spd = Math.round(Math.sqrt((target.vx||0)**2+(target.vy||0)**2));
        if(e['tgt-hull-bar']) { e['tgt-hull-bar'].style.width='100%'; e['tgt-hull-bar'].style.background='#ff6600'; }
        if(e['tgt-hull-val']) e['tgt-hull-val'].textContent = 'SPD:'+spd;
        if(e['tgt-shld-bar']) e['tgt-shld-bar'].style.width = '0%';
        if(e['tgt-shld-val']) e['tgt-shld-val'].textContent = '0/0';
      } else {
        // No hull pool — show CORE integrity (core destroyed = explosion).
        const _coreFrac = target.coreIntegrity ? target.coreIntegrity()
                        : (target.ship?.coreIntegrity ? target.ship.coreIntegrity() : 1);
        const pct = Math.round(_coreFrac * 100);
        if(e['tgt-hull-bar']) { e['tgt-hull-bar'].style.width=pct+'%'; e['tgt-hull-bar'].style.background = target.disabled ? '#ff6600' : (pct<35?'#ff4444':''); }
        if(e['tgt-hull-val']) e['tgt-hull-val'].textContent = target.disabled ? 'DISABLED' : ('CORE '+pct+'%');
      }
      if(!isMissileTgt) {
        const shields = target.shields||0;
        const maxShields = Math.max(target.maxShields,1);
        if(e['tgt-shld-bar']) e['tgt-shld-bar'].style.width=G.pct(shields,maxShields)+'%';
        if(e['tgt-shld-val']) e['tgt-shld-val'].textContent = Math.ceil(shields)+'/'+Math.ceil(maxShields);
      }
      const td=Math.sqrt((target.x-player.x)**2+(target.y-player.y)**2)|0;
      if(e['tgt-dist']) e['tgt-dist'].textContent=td+' units'+(target.disabled?' [DISABLED]':'');
      const intention = this._getTargetIntention(target);
      if(e['tgt-intention']) e['tgt-intention'].textContent = intention ? '◆ '+intention : '';

      // Extended scan readout — only once the target has been scanned.
      const scanEl = e['tgt-scan'];
      if(scanEl) {
        if(target._scanned && !isMissileTgt) {
          scanEl.innerHTML = this._buildScanReadout(target);
          scanEl.classList.remove('hidden');
        } else {
          scanEl.classList.add('hidden');
        }
      }
    } else {
      if(e['target-panel']) e['target-panel'].classList.add('hidden');
      if(e['tgt-scan']) e['tgt-scan'].classList.add('hidden');
      this._tgtPortTarget = null; this._tgtPortEntries = null;
    }
  }

  // Build the extended scan readout shown in the target panel after a Scan:
  // armament, cargo/inventory, modules and intel pulled from whatever fields
  // the target type exposes (enemies, NPCs, fleet ships, derelicts).
  _buildScanReadout(t) {
    const rows = [];
    const esc = s => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

    // Armament — enemies carry a `weapons` array, NPCs `weaponIds`.
    const wpnNames = [];
    if(Array.isArray(t.weapons)) for(const w of t.weapons) wpnNames.push(G.WEAPONS[w.weaponId]?.name || w.weaponId);
    else if(Array.isArray(t.weaponIds)) for(const id of t.weaponIds) wpnNames.push(G.WEAPONS[id]?.name || id);
    else if(t.weaponId) wpnNames.push(G.WEAPONS[t.weaponId]?.name || t.weaponId);
    if(wpnNames.length) rows.push(['ARMS', wpnNames.map(esc).join(', ')]);

    // Modules — installed module list, when the target ship has one.
    if(t.modules && typeof t.modules === 'object') {
      const mods = Object.values(t.modules)
        .map(m => (G.MODULES[m.moduleId]||G.WEAPONS[m.moduleId])?.name)
        .filter(Boolean);
      if(mods.length) rows.push(['MODS', mods.slice(0,6).map(esc).join(', ') + (mods.length>6?'…':'')]);
    }

    // Cargo / inventory — NPCs hold a `cargo` map; enemies/derelicts a count.
    if(t.cargo && typeof t.cargo === 'object') {
      const items = Object.entries(t.cargo).filter(([,q])=>q>0)
        .map(([id,q]) => (G.ITEMS[id]?.name || id) + ' ×' + q);
      rows.push(['CARGO', items.length ? items.map(esc).join(', ') : 'empty']);
    } else if(t.cargoDrops != null) {
      rows.push(['CARGO', t.cargoDrops > 0 ? (t.cargoDrops + ' crate' + (t.cargoDrops>1?'s':'')) : 'empty']);
    } else if(t.lootQty != null) {
      rows.push(['SALVAGE', t.lootQty + ' unit' + (t.lootQty>1?'s':'')]);
    }

    // Intel — credits aboard, top speed, crew.
    const intel = [];
    if(t.credits != null) intel.push('◈' + G.fmt(t.credits));
    if(t.speed != null)   intel.push(Math.round(t.speed) + ' spd');
    if(Array.isArray(t.crew) && t.crew.length) intel.push(t.crew.length + ' crew');
    if(intel.length) rows.push(['INTEL', intel.map(esc).join(' · ')]);

    const body = rows.map(([k,v]) =>
      `<div class="tgt-scan-row"><span class="tgt-scan-k">${k}</span><span class="tgt-scan-v">${v}</span></div>`
    ).join('');
    return `<div class="tgt-scan-hdr">⌖ SCAN</div>${body}`;
  }

  _getTargetIntention(target) {
    if(!target) return '';
    if(target.disabled) return 'DISABLED';
    if(target.type === 'enemy') {
      if(target.aiState === 'patrol') return 'PATROLLING';
      if(target.aiState === 'engage') return 'ATTACKING';
      if(target.aiState === 'flee') return 'FLEEING';
      return 'ENEMY';
    }
    if(target.type === 'npc') {
      if(target.jumpingOut) return 'JUMPING';
      if(target.aiState === 'entering') return 'ENTERING';
      if(target.aiState === 'seek_asteroid') return 'SEEKING ASTEROID';
      if(target.aiState === 'transit_to_asteroid') return 'TRANSITING';
      if(target.aiState === 'mining_asteroid') return 'MINING';
      if(target.aiState === 'transit_to_port') return 'LANDING';
      if(target.aiState === 'parking') return 'PARKING';
      if(target.aiState === 'docked') return 'DOCKED';
      if(target.aiState === 'departing') return 'TAKING OFF';
      if(target.aiState === 'charging_jump') return 'CHARGING JUMP';
      if(target.aiState === 'transit_to_jump') return 'TRANSITING';
      if(target.aiState === 'fuel_rendezvous') return 'REFUELING';
      if(target.hostile) return 'ATTACKING';
      return 'IDLE';
    }
    if(target.type === 'fleet') {
      if(target.dead) return 'DESTROYED';
      if(target.disabled) return 'DISABLED';
      return 'ESCORTING';
    }
    return '';
  }

  // ── Spaceport ────────────────────────────────────────────
  showSpaceport(name, sysId, tab='trade') {
    this._currentSysId=sysId;
    this._spTab=tab;
    if(this._cantinaCache) delete this._cantinaCache['cantina_'+sysId];
    if(this.els['sp-name']) this.els['sp-name'].textContent=name.toUpperCase();
    // Show cantina tab only at systems with a cantina
    const sys = G.SYSTEMS.find(s=>s.id===sysId);
    const cantinaTab = document.getElementById('cantina-tab');
    if(cantinaTab) cantinaTab.classList.toggle('hidden', !sys?.hasCantina);
    this._updateSpStatusBar();
    this.renderSpaceportTab(tab);
    document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===tab));
    this.els['spaceport-overlay']?.classList.remove('hidden');
    G.game._hideHUD();
  }

  hideSpaceport(){
    this.els['spaceport-overlay']?.classList.add('hidden');
  }

  _updateSpStatusBar(){
    const p=G.game.player;
    if(this.els['sp-credits']) this.els['sp-credits'].textContent='Credits: '+G.fmtCredits(G.game.credits);
    if(this.els['sp-cargo'])   this.els['sp-cargo'].textContent='Cargo: '+G.game.fleetCargoUsed()+'/'+G.game.fleetCargoSpace()+(G.game.fleet?.length?' [fleet]':'');
    if(this.els['sp-ship'])    this.els['sp-ship'].textContent='Ship: '+p.name;
  }

  renderSpaceportTab(tab){
    const body=this.els['sp-body'];
    if(!body) return;
    this._spTab=tab;
    if(tab!=='builder')  { this._builderSel=null; this._builderPickCell=null; this._stopBuilderCrewAnim(); }
    if(tab!=='inventory'){ this._stopInventoryCrewAnim(); }
    switch(tab){
      case 'trade':     body.innerHTML=this._buildTradeHTML();     break;
      case 'missions':  body.innerHTML=this._buildMissionsHTML();  this._bindMissions();  setTimeout(()=>this._drawMiniGalaxy(document.getElementById('mission-preview-canvas'),null),10); break;
      case 'outfitter': body.innerHTML=this._buildOutfitterHTML(); this._bindOutfitter(); setTimeout(()=>this._drawOutfitterShip(),30); break;
      case 'builder':   body.innerHTML=this._buildShipBuilderHTML(); this._bindShipBuilder(); break;
      case 'shipyard':  body.innerHTML=this._buildShipyardHTML();  this._bindShipyard();  setTimeout(()=>this._drawShipPreviews(),50); break;
      case 'crew':      body.innerHTML=this._buildCrewHTML();      this._bindCrew();      break;
      case 'repair':    body.innerHTML=this._buildRepairHTML();    this._bindRepair();    break;
      case 'craft':     body.innerHTML=this._buildCraftHTML();     this._bindCraft();     break;
      case 'inventory': body.innerHTML=this._buildModInventoryHTML(); this._bindModInventory(); setTimeout(()=>this._startInventoryCrewAnim(),50); break;
      case 'cantina':   body.innerHTML=this._buildCantinaHTML();      this._bindCantina();      break;
      case 'vendor':    body.innerHTML=this._buildVendorHTML();       this._bindVendor();       break;
      case 'stash':     body.innerHTML=this._buildStashHTML();        this._bindStash();        break;
    }
    this._updateSpStatusBar();
  }

  _tradeSortBy(col) {
    if(!this._tradeSort) this._tradeSort = { col: null, dir: 1 };
    if(this._tradeSort.col === col) this._tradeSort.dir *= -1;
    else { this._tradeSort.col = col; this._tradeSort.dir = 1; }
    this.renderSpaceportTab('trade');
  }

  // ── Gear Vendor (buy/sell rolled instances for credits) ──────────────────
  _vendorStock(sysId) {
    this._vendorCache = this._vendorCache || {};
    if(this._vendorCache[sysId]) return this._vendorCache[sysId];
    const sys = G.SYSTEMS.find(s => s.id === sysId);
    const ilvl = G.clamp(Math.round((sys?.danger || 1) + (G.game.playerCharacter?.()?.level || 1)), 1, 60);
    const bases = ['pistol','sword','shield','combat_helm','flak_vest','pauldrons','bracers','utility_belt','greaves','combat_boots','power_ring','vital_amulet','jetpack','storage_pack'];
    const stock = [];
    for(let i = 0; i < 8; i++) { const inst = G.rollItem(bases[(Math.random() * bases.length) | 0], ilvl); if(inst) stock.push(inst); }
    this._vendorCache[sysId] = stock;
    return stock;
  }
  _gearChip(v, priceLabel, dataAttr) {
    const col = G.gearColor(v), tip = G.gearTooltip(v).map(l => l.t).join(' · ').replace(/"/g, '');
    return `<div ${dataAttr} title="${tip}" style="display:flex;justify-content:space-between;align-items:center;gap:8px;background:rgba(0,20,40,0.9);border:1px solid ${col}66;padding:5px 8px;margin-bottom:3px;cursor:pointer;font-size:7px">
      <span style="color:${col}">${G.gearIcon(v)} ${G.gearName(v)}</span><span style="color:#ffcc44">${priceLabel}</span></div>`;
  }
  _buildVendorHTML() {
    const stock = this._vendorStock(this._currentSysId), gear = G.game.player.gear || [];
    const buy = stock.length ? stock.map((inst, i) => this._gearChip(inst, G.fmtCredits(G.gearPrice(inst)), `data-buy="${i}"`)).join('') : '<div style="color:#556677;font-size:7px">Sold out.</div>';
    const sell = gear.length ? gear.map((inst, i) => this._gearChip(inst, '+' + G.fmtCredits(G.gearSellPrice(inst)), `data-sell="${i}"`)).join('') : '<div style="color:#556677;font-size:7px">No loose gear to sell.</div>';
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-family:'Press Start 2P',monospace">
      <div><div style="color:#ff6688;font-size:8px;margin-bottom:8px;letter-spacing:2px">BUY · click to purchase</div><div style="max-height:340px;overflow-y:auto">${buy}</div></div>
      <div><div style="color:#44dd88;font-size:8px;margin-bottom:8px;letter-spacing:2px">SELL · your gear pool</div><div style="max-height:340px;overflow-y:auto">${sell}</div></div>
    </div>`;
  }
  _bindVendor() {
    const body = this.els['sp-body']; if(!body) return;
    const stock = this._vendorStock(this._currentSysId), gear = G.game.player.gear || (G.game.player.gear = []);
    body.querySelectorAll('[data-buy]').forEach(el => el.addEventListener('click', () => {
      const i = +el.dataset.buy, inst = stock[i]; if(!inst) return;
      const price = G.gearPrice(inst);
      if(G.game.credits < price) { this.addMsg('Not enough credits', '#ff4444'); return; }
      G.game.credits -= price; gear.push(inst); stock.splice(i, 1);
      this.addMsg('Bought ' + inst.name, G.gearColor(inst)); G.sound?.uiClick?.();
      this.renderSpaceportTab('vendor');
    }));
    body.querySelectorAll('[data-sell]').forEach(el => el.addEventListener('click', () => {
      const i = +el.dataset.sell, inst = gear[i]; if(!inst) return;
      G.game.credits += G.gearSellPrice(inst); gear.splice(i, 1);
      this.addMsg('Sold ' + inst.name, '#88ddaa'); G.sound?.uiClick?.();
      this.renderSpaceportTab('vendor');
    }));
  }

  // ── Stash (bank gear between runs; persists with the save) ────────────────
  _buildStashHTML() {
    const gear = G.game.player.gear || [], stash = G.game.stash || [];
    const left = gear.length ? gear.map((inst, i) => this._gearChip(inst, 'store ▸', `data-stow="${i}"`)).join('') : '<div style="color:#556677;font-size:7px">No loose gear aboard.</div>';
    const right = stash.length ? stash.map((inst, i) => this._gearChip(inst, '◂ take', `data-take="${i}"`)).join('') : '<div style="color:#556677;font-size:7px">Stash empty.</div>';
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-family:'Press Start 2P',monospace">
      <div><div style="color:#44dd88;font-size:8px;margin-bottom:8px;letter-spacing:2px">SHIP GEAR</div><div style="max-height:340px;overflow-y:auto">${left}</div></div>
      <div><div style="color:#aaccee;font-size:8px;margin-bottom:8px;letter-spacing:2px">STASH · ${stash.length}</div><div style="max-height:340px;overflow-y:auto">${right}</div></div>
    </div>`;
  }
  _bindStash() {
    const body = this.els['sp-body']; if(!body) return;
    const gear = G.game.player.gear || (G.game.player.gear = []), stash = G.game.stash || (G.game.stash = []);
    body.querySelectorAll('[data-stow]').forEach(el => el.addEventListener('click', () => {
      const i = +el.dataset.stow; if(gear[i]) { stash.push(gear.splice(i, 1)[0]); G.sound?.uiClick?.(); this.renderSpaceportTab('stash'); }
    }));
    body.querySelectorAll('[data-take]').forEach(el => el.addEventListener('click', () => {
      const i = +el.dataset.take; if(stash[i]) { gear.push(stash.splice(i, 1)[0]); G.sound?.uiClick?.(); this.renderSpaceportTab('stash'); }
    }));
  }

  // ── Trade ────────────────────────────────────────────────
  _buildTradeHTML(){
    const market=G.game.economy.getMarket(this._currentSysId);
    const p=G.game.player;
    const hasCargo = Object.values(p.cargo || {}).some(qty => qty > 0);
    const isSaleDay = market.length > 0 && market[0].isSaleDay;
    let html=`<div class="panel-title">MARKETPLACE${isSaleDay?' <span style="color:#ff4488;font-size:8px;margin-left:8px">★ MARKET DAY — SALES ACTIVE</span>':''}</div>
    <div style="font-size:6px;color:#556677;margin-bottom:6px;display:flex;align-items:center;gap:12px">
      <span>▲ above avg &nbsp; ▼ below avg</span>
      <button class="btn btn-sell" onclick="G.ui.tradeSellAll()" style="font-size:6px;padding:3px 8px;${!hasCargo?'opacity:0.4':'cursor:pointer'}" ${!hasCargo?'disabled':''}>SELL ALL CARGO</button>
    </div>
    <table class="trade-table">`;
    const RARITY_ORDER = {c:0,u:1,r:2,e:3,l:4};
    const TREND_ORDER  = {'▲ HIGH':2,'↑ RISING':1,'— AVG':0,'↓ FALLING':-1,'▼ LOW':-2};
    const sortBtn=(col)=>{
      const s=this._tradeSort;
      const active=s&&s.col===col;
      const arrow=active?(s.dir>0?'▲':'▼'):'⇅';
      const style=`font-size:5px;background:none;border:none;color:${active?'#00ffee':'#556677'};cursor:pointer;padding:0 2px`;
      return `<button style="${style}" onclick="G.ui._tradeSortBy('${col}')">${arrow}</button>`;
    };
    html+=`<tr>
      <th style="min-width:50px"></th>
      <th style="flex:1">ITEM ${sortBtn('name')}</th>
      <th>RARITY ${sortBtn('rarity')}</th>
      <th>BUY ${sortBtn('buy')}</th>
      <th>TREND ${sortBtn('trend')}</th>
      <th>SELL ${sortBtn('sell')}</th>
      <th>AVAIL ${sortBtn('avail')}</th>
      <th>OWN ${sortBtn('own')}</th>
    </tr>`;

    // Compute display rows first so we can sort them
    const rows = market.map(item => {
      const baseItem = G.ITEMS[item.id];
      const isAmmo   = baseItem?.cat==='ammo';
      const ownedNum = isAmmo ? (p.ammo[item.id]||0) : (p.cargo[item.id]||0);
      const owned    = isAmmo ? ownedNum+' rds' : ownedNum;
      const key=this._currentSysId+'_'+item.id;
      const mult=G.game.priceMultipliers[key]||1.0;
      const adjustedPrice=Math.floor(item.price*mult);
      const sell     = Math.floor(adjustedPrice * 0.82);
      const base     = baseItem?.base || item.price;
      const ratio    = adjustedPrice / base;
      let trend='', trendCol='#888';
      if(ratio > 1.12)      { trend='▲ HIGH';  trendCol='#ff6644'; }
      else if(ratio < 0.90) { trend='▼ LOW';   trendCol='#44dd66'; }
      else if(mult > 1.05)  { trend='↑ RISING'; trendCol='#ff9944'; }
      else if(mult < 0.98)  { trend='↓ FALLING'; trendCol='#66dd44'; }
      else                  { trend='— AVG';   trendCol='#888888'; }
      return { item, baseItem, isAmmo, owned, ownedNum, adjustedPrice, sell, trend, trendCol };
    });

    if(this._tradeSort?.col) {
      const { col, dir } = this._tradeSort;
      rows.sort((a,b) => {
        let av, bv;
        if(col==='name')   { av=a.item.name; bv=b.item.name; return dir*(av<bv?-1:av>bv?1:0); }
        if(col==='rarity') { av=RARITY_ORDER[a.item.rarity]||0; bv=RARITY_ORDER[b.item.rarity]||0; }
        else if(col==='buy')   { av=a.adjustedPrice; bv=b.adjustedPrice; }
        else if(col==='sell')  { av=a.sell; bv=b.sell; }
        else if(col==='trend') { av=TREND_ORDER[a.trend]||0; bv=TREND_ORDER[b.trend]||0; }
        else if(col==='avail') { av=a.item.available; bv=b.item.available; }
        else if(col==='own')   { av=a.ownedNum; bv=b.ownedNum; }
        else return 0;
        return dir*(av-bv);
      });
    }

    for(const { item, baseItem, isAmmo, owned, adjustedPrice, sell, trend, trendCol } of rows){
      const avBg = item.available === 0 ? 'color:#ff4444' : '';
      const saleTag = item.saleDiscount > 0
        ? ` <span style="color:#ff4488;font-size:5px;font-weight:bold">-${Math.round(item.saleDiscount*100)}%</span>`
        : '';
      const buyDisabled = item.available <= 0;
      const sellDisabled = isAmmo ? (p.ammo[item.id]||0) <= 0 : p.cargo[item.id] <= 0;
      html+=`<tr>
        <td style="text-align:center;gap:2px;display:flex;justify-content:center">
          <button class="btn" style="padding:2px 6px;font-size:6px;min-width:20px" ${buyDisabled?'disabled style="opacity:0.3"':''} onclick="G.ui.tradeBuy('${item.id}',${adjustedPrice},1)">+</button>
          <button class="btn" style="padding:2px 6px;font-size:6px;min-width:20px" ${sellDisabled?'disabled style="opacity:0.3"':''} onclick="${isAmmo?`G.ui.tradeSellAmmo('${item.id}',${sell})`:`G.ui.tradeSell('${item.id}',${sell},1)`}">−</button>
        </td>
        <td title="${baseItem?.desc||''}" style="flex:1">${item.name}${saleTag}</td>
        <td class="rarity-${item.rarity}">${G.RARITY[item.rarity]?.label||item.rarity}</td>
        <td class="price-good">$ ${adjustedPrice}</td>
        <td style="font-size:6px;color:${trendCol}">${trend}</td>
        <td class="price-bad">$ ${sell}</td>
        <td style="${avBg}">${item.available}</td>
        <td>${owned}</td>
      </tr>`;
    }
    return html+'</table>';
  }

  tradeBuy(itemId,price,qty){
    const market=G.game.economy.getMarket(this._currentSysId);
    const mItem=market.find(m=>m.id===itemId);
    if(!mItem||mItem.available<=0){this.addMsg('Out of stock!','#ff4444');return;}
    if(G.game.credits<price*qty){this.addMsg('Not enough credits!','#ff4444');return;}
    const item=G.ITEMS[itemId];
    if(!item) return;
    // Ammo items go to player.ammo pool, not cargo
    if(item.cat==='ammo') {
      G.game.credits-=price*qty;
      const rounds=(item.ammoRounds||1)*qty;
      G.game.player.ammo[itemId]=(G.game.player.ammo[itemId]||0)+rounds;
      mItem.available=Math.max(0,mItem.available-qty);
      this.addMsg('Loaded '+rounds+' '+item.name,'#44ff44');
      // Increase price multiplier when buying
      const key=this._currentSysId+'_'+itemId;
      if(!G.game.priceMultipliers[key]) G.game.priceMultipliers[key]=1.0;
      G.game.priceMultipliers[key]*=Math.pow(1.03,qty);
      this.renderSpaceportTab('trade');
      return;
    }
    if(G.game.fleetCargoFreeSpace()<(item.mass||1)*qty){this.addMsg('Cargo full!','#ff4444');return;}
    G.game.credits-=price*qty;
    G.game.player.addCargo(itemId,qty);
    mItem.available=Math.max(0,mItem.available-qty);
    this.addMsg('Bought '+qty+'x '+item.name,'#44ff44');
    // Increase price multiplier when buying
    const key=this._currentSysId+'_'+itemId;
    if(!G.game.priceMultipliers[key]) G.game.priceMultipliers[key]=1.0;
    G.game.priceMultipliers[key]*=Math.pow(1.03,qty);
    this.renderSpaceportTab('trade');
  }

  tradeSell(itemId,price,qty){
    if(!G.game.player.removeCargo(itemId,qty)){this.addMsg('Not enough cargo!','#ff4444');return;}
    G.game.credits+=price*qty;
    this.addMsg('Sold '+qty+'x '+(G.ITEMS[itemId]?.name||itemId)+' +'+G.fmtCredits(price*qty),'#ffcc00');
    // Decrease price multiplier when selling (symmetric with buy)
    const key=this._currentSysId+'_'+itemId;
    if(!G.game.priceMultipliers[key]) G.game.priceMultipliers[key]=1.0;
    G.game.priceMultipliers[key]=Math.max(0.5,G.game.priceMultipliers[key]/Math.pow(1.03,qty));
    this.renderSpaceportTab('trade');
  }

  tradeSellAmmo(itemId, pricePerPack){
    const p = G.game.player;
    const item = G.ITEMS[itemId];
    const rounds = p.ammo[itemId]||0;
    if(rounds <= 0){this.addMsg('No ammo to sell!','#ff4444');return;}
    const packsEquiv = rounds / (item?.ammoRounds||1);
    const total = Math.floor(pricePerPack * packsEquiv);
    p.ammo[itemId] = 0;
    G.game.credits += total;
    this.addMsg('Sold '+rounds+' '+item?.name+' +'+G.fmtCredits(total),'#ffcc00');
    // Decrease price multiplier when selling (symmetric with buy)
    const key=this._currentSysId+'_'+itemId;
    if(!G.game.priceMultipliers[key]) G.game.priceMultipliers[key]=1.0;
    G.game.priceMultipliers[key]=Math.max(0.5,G.game.priceMultipliers[key]/Math.pow(1.03,packsEquiv));
    this.renderSpaceportTab('trade');
  }

  tradeSellAll(){
    const market=G.game.economy.getMarket(this._currentSysId);
    const priceMap={};
    for(const item of market) priceMap[item.id]=Math.floor(item.price*0.82);
    let total=0, count=0;
    for(const [itemId,qty] of Object.entries(G.game.player.cargo)){
      if(qty<=0) continue;
      if(G.ITEMS[itemId]?.cat==='mission') continue;
      if(G.ITEMS[itemId]?.cat==='ammo') continue;
      const price=priceMap[itemId]||Math.floor((G.ITEMS[itemId]?.base||50)*0.82);
      G.game.player.removeCargo(itemId,qty);
      G.game.credits+=price*qty;
      total+=price*qty; count+=qty;
      // Decrease price multiplier when selling
      const key=this._currentSysId+'_'+itemId;
      if(!G.game.priceMultipliers[key]) G.game.priceMultipliers[key]=1.0;
      G.game.priceMultipliers[key]=Math.max(0.5,G.game.priceMultipliers[key]/Math.pow(1.03,qty));
    }
    if(count>0) this.addMsg('Sold '+count+' items for '+G.fmtCredits(total),'#ffcc00');
    else this.addMsg('No cargo to sell.','#888888');
    this.renderSpaceportTab('trade');
  }

  // ── Missions ─────────────────────────────────────────────
  _getMissionDestId(m) {
    return m.params?.dest || m.params?.target || m.params?.via || null;
  }

  _setupMapInteraction(canvas) {
    if (!canvas._mapInteractionSetup) {
      canvas._mapInteractionSetup = true;
      canvas._mapZoom = 1;
      canvas._mapPanX = 0;
      canvas._mapPanY = 0;
      canvas._isDragging = false;
      canvas._dragStartX = 0;
      canvas._dragStartY = 0;

      // Mouse wheel zoom
      canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const zoomSpeed = 0.15;
        const oldZoom = canvas._mapZoom;
        canvas._mapZoom = Math.max(0.5, Math.min(3, canvas._mapZoom - e.deltaY * zoomSpeed * 0.01));
        // Zoom centered on mouse: keep world-point under cursor fixed
        const ox = canvas._mapOx || 0, oy = canvas._mapOy || 0;
        canvas._mapPanX += (mouseX - ox) * (1 - canvas._mapZoom / oldZoom);
        canvas._mapPanY += (mouseY - oy) * (1 - canvas._mapZoom / oldZoom);
        this._drawMiniGalaxy(canvas, canvas._lastDestId || null);
      }, { passive: false });

      // Mouse drag
      canvas.addEventListener('mousedown', (e) => {
        canvas._isDragging = true;
        canvas._dragStartX = e.clientX;
        canvas._dragStartY = e.clientY;
      });

      document.addEventListener('mousemove', (e) => {
        if (canvas._isDragging) {
          const dx = e.clientX - canvas._dragStartX;
          const dy = e.clientY - canvas._dragStartY;
          canvas._mapPanX += dx / canvas._mapZoom;
          canvas._mapPanY += dy / canvas._mapZoom;
          canvas._dragStartX = e.clientX;
          canvas._dragStartY = e.clientY;
          // Redraw
          const label = document.getElementById('mission-preview-label') || document.getElementById('mission-log-map-label');
          const destId = label?.closest('[data-destid]')?.dataset.destid;
          this._drawMiniGalaxy(canvas, destId || null);
        }
      });

      document.addEventListener('mouseup', () => {
        canvas._isDragging = false;
      });
    }
  }

  _drawMiniGalaxy(canvasEl, destSysId) {
    if(!canvasEl) return;
    canvasEl._lastDestId = destSysId;
    const ctx = canvasEl.getContext('2d');
    const w = canvasEl.width, h = canvasEl.height;
    ctx.fillStyle = '#000810'; ctx.fillRect(0,0,w,h);

    const known    = G.game?.galaxy?.known || new Set();
    const visible  = G.SYSTEMS.filter(s => known.has(s.id));
    if(!visible.length) return;

    const minX=Math.min(...visible.map(s=>s.pos[0]));
    const maxX=Math.max(...visible.map(s=>s.pos[0]));
    const minY=Math.min(...visible.map(s=>s.pos[1]));
    const maxY=Math.max(...visible.map(s=>s.pos[1]));
    const spanX = Math.max(maxX-minX, 1), spanY = Math.max(maxY-minY, 1);
    const pad=16;
    const baseScale=Math.min((w-pad*2)/spanX, (h-pad*2)/spanY);
    const zoom = canvasEl._mapZoom || 1;
    const scale = baseScale * zoom;
    const ox=pad+(w-pad*2-spanX*baseScale)/2 + (canvasEl._mapPanX || 0);
    const oy=pad+(h-pad*2-spanY*baseScale)/2 + (canvasEl._mapPanY || 0);
    canvasEl._mapOx = ox; canvasEl._mapOy = oy;
    const gx=s=>ox+(s.pos[0]-minX)*scale;
    const gy=s=>oy+(s.pos[1]-minY)*scale;

    // Routes between known systems only
    const drawn=new Set();
    for(const [sysId,conns] of Object.entries(G.game.galaxy.routes)){
      if(!known.has(sysId)) continue;
      const a=G.SYSTEMS.find(s=>s.id===sysId); if(!a) continue;
      for(const cid of conns){
        if(!known.has(cid)) continue;
        const key=[sysId,cid].sort().join('_');
        if(drawn.has(key)) continue; drawn.add(key);
        const b=G.SYSTEMS.find(s=>s.id===cid); if(!b) continue;
        ctx.beginPath(); ctx.moveTo(gx(a),gy(a)); ctx.lineTo(gx(b),gy(b));
        ctx.strokeStyle='rgba(30,50,70,0.6)'; ctx.lineWidth=0.5; ctx.stroke();
      }
    }

    // Known systems
    for(const sys of visible){
      const fac=G.FACTIONS[sys.faction];
      ctx.beginPath(); ctx.arc(gx(sys),gy(sys),1.5,0,Math.PI*2);
      ctx.fillStyle=fac?.color||'#445566'; ctx.fill();
    }

    // Route highlight to destination
    const fromSysId=G.game.currentSysId;
    if(destSysId && destSysId!==fromSysId){
      const route=G.game.galaxy._findRoute(fromSysId,destSysId);
      if(route){
        const ids=[fromSysId,...route];
        for(let i=0;i<ids.length-1;i++){
          const a=G.SYSTEMS.find(s=>s.id===ids[i]);
          const b=G.SYSTEMS.find(s=>s.id===ids[i+1]);
          if(!a||!b) continue;
          ctx.beginPath(); ctx.moveTo(gx(a),gy(a)); ctx.lineTo(gx(b),gy(b));
          ctx.strokeStyle='rgba(0,180,255,0.55)'; ctx.lineWidth=1.5; ctx.stroke();
        }
        ctx.font=`5px "Press Start 2P",monospace`;
        ctx.fillStyle='rgba(0,180,255,0.7)';
        ctx.textAlign='center';
        ctx.fillText(route.length+' hop'+(route.length!==1?'s':''), w/2, h-4);
        ctx.textAlign='left';
      }
    }

    // Current position
    const fromSys=G.SYSTEMS.find(s=>s.id===fromSysId);
    if(fromSys){
      ctx.beginPath(); ctx.arc(gx(fromSys),gy(fromSys),4,0,Math.PI*2);
      ctx.fillStyle='#00ffee'; ctx.fill();
    }

    // Destination
    if(destSysId && known.has(destSysId)){
      const dst=G.SYSTEMS.find(s=>s.id===destSysId);
      if(dst){
        ctx.beginPath(); ctx.arc(gx(dst),gy(dst),4,0,Math.PI*2);
        ctx.fillStyle='#ffcc00'; ctx.fill();
        ctx.font='5px "Press Start 2P",monospace';
        ctx.fillStyle='#ffcc00'; ctx.textAlign='center';
        ctx.fillText(dst.name.length>9?dst.name.slice(0,9)+'…':dst.name, gx(dst), gy(dst)-7);
        ctx.textAlign='left';
      }
    }
  }

  _buildMissionsHTML(){
    const missions=G.game.economy.getMissions(this._currentSysId);
    const active=G.game.activeMissions.filter(m=>!m.completed&&!m.failed);
    let listHtml=`<div class="panel-title">MISSION BOARD</div>`;
    if(active.length){
      listHtml+=`<div class="section-title">ACTIVE MISSIONS</div>`;
      for(const m of active){
        const destId=this._getMissionDestId(m);
        const aRepStr = m.repReward ? `<div style="font-size:5px;color:#44ff88">+${m.repReward} REP</div>` : '';
      listHtml+=`<div class="mission-card" data-destid="${destId||''}" data-hover="mission">
          <div class="mission-info"><div class="mission-title">${m.title}</div><div class="mission-desc">${m.desc}</div></div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">
            <div class="mission-reward">$ ${G.fmt(m.reward)}</div>${aRepStr}
          </div>
        </div>`;
      }
    }
    listHtml+=`<div class="section-title">AVAILABLE</div>`;
    const available=missions.filter(m=>!G.game.activeMissions.find(am=>am.id===m.id));
    for(const m of available){
      const destId=this._getMissionDestId(m);
      const repStr = m.repReward ? `<div style="font-size:5px;color:#44ff88">+${m.repReward} ${(m.repFaction||m.faction||'').toUpperCase()} REP</div>` : '';
      listHtml+=`<div class="mission-card" data-destid="${destId||''}" data-hover="mission">
        <div class="mission-info"><div class="mission-title">${m.title}</div><div class="mission-desc">${m.desc}</div></div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          <div class="mission-reward">$ ${G.fmt(m.reward)}</div>
          ${repStr}
          <button class="btn btn-buy" data-missionid="${m.id}">ACCEPT</button>
        </div>
      </div>`;
    }
    return `<div class="mission-board-wrap">
      <div class="mission-board-list">${listHtml}</div>
      <div class="mission-map-pane">
        <canvas id="mission-preview-canvas" width="200" height="200"></canvas>
        <div class="mission-map-label" id="mission-preview-label">Hover a mission</div>
      </div>
    </div>`;
  }

  _bindMissions(){
    const missions=G.game.economy.getMissions(this._currentSysId);
    document.querySelectorAll('[data-missionid]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const m=missions.find(ms=>ms.id===btn.dataset.missionid);
        if(!m) return;
        const ok=G.game.economy.acceptMission(m,G.game.player);
        this.addMsg(ok?'Mission accepted: '+m.title:'Cannot accept – check cargo!', ok?'#44ff44':'#ff4444');
        if(ok) this.renderSpaceportTab('missions');
      });
    });
    // Galaxy preview on hover
    const canvas=document.getElementById('mission-preview-canvas');
    const label=document.getElementById('mission-preview-label');
    // Draw default (current system only)
    this._drawMiniGalaxy(canvas, null);
    document.querySelectorAll('[data-hover="mission"]').forEach(card=>{
      card.addEventListener('mouseenter',()=>{
        const destId=card.dataset.destid;
        this._drawMiniGalaxy(canvas, destId||null);
        const dest=G.SYSTEMS.find(s=>s.id===destId);
        if(label) label.textContent=dest?'Destination: '+dest.name:'Current system';
      });
    });

    // Add zoom and drag support to mission preview canvas
    if(canvas) this._setupMapInteraction(canvas);
  }

  // ── Mission Log ───────────────────────────────────────────
  refreshMissionChatbox(){
    const content = document.getElementById('mission-chatbox-content');
    if(!content) return;
    const active = G.game.activeMissions.filter(m=>!m.completed&&!m.failed);
    if(!active.length) {
      content.innerHTML = '<div style="color:#556677">No active missions.</div>';
      return;
    }
    let html = '';
    for(const m of active) {
      const destId = this._getMissionDestId(m);
      const dest = G.SYSTEMS.find(s=>s.id===destId);
      const destStr = dest ? ' → '+dest.name : '';
      html += `<div style="border-bottom:1px solid #223344;padding-bottom:4px;margin-bottom:4px">
        <div style="color:#ffaa44">${m.title}</div>
        <div style="font-size:5px;color:#888899;margin-top:2px">${m.desc}${destStr}</div>
      </div>`;
    }
    content.innerHTML = html;
  }

  _buildMissionLogHTML(){
    const active=G.game.activeMissions.filter(m=>!m.completed&&!m.failed);
    if(!active.length) return '<div style="color:var(--col-dim);font-size:8px;padding:20px">No active missions.</div>';
    return active.map(m=>{
      const destId=this._getMissionDestId(m);
      const dest=G.SYSTEMS.find(s=>s.id===destId);
      return `<div class="mission-card" data-destid="${destId||''}" data-logmission="1" style="cursor:pointer">
        <div class="mission-info">
          <div class="mission-title">${m.title}</div>
          <div class="mission-desc">${m.desc}</div>
          ${dest?`<div style="font-size:6px;color:#00ffee;margin-top:4px">→ ${dest.name}</div>`:''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          <div class="mission-reward">$ ${G.fmt(m.reward)}</div>
          <button class="btn btn-sell" data-abandonid="${m.id}" style="font-size:6px">ABANDON</button>
        </div>
      </div>`;
    }).join('');
  }

  showCharScreen() {
    const g = G.game;
    const FACTION_FILE = { earth:'earth', rebellion:'rebel', pirate:'pirate', alien:'alien', neutral:'independent' };
    const FACTION_NAMES = { earth:'EARTH GOV', rebellion:'REBELLION', pirate:'PIRATES', alien:'THE SHARD', neutral:'INDEPENDENT' };
    const FACTION_COLORS = { earth:'#4488ff', rebellion:'#ff6600', pirate:'#ff1111', alien:'#00ff88', neutral:'#888888' };
    const fid = g.playerFactionId || 'neutral';
    document.getElementById('char-screen-avatar').src = `avatars/${FACTION_FILE[fid]}_${g.playerSex || 'male'}.png`;
    document.getElementById('char-screen-name').textContent = g.playerName || 'Commander';
    document.getElementById('char-screen-sex').textContent = (g.playerSex || 'male').toUpperCase();
    const factionEl = document.getElementById('char-screen-faction');
    factionEl.textContent = FACTION_NAMES[fid] || fid.toUpperCase();
    factionEl.style.color = FACTION_COLORS[fid] || 'var(--col-text)';

    const classEl = document.getElementById('char-screen-class');
    if(classEl) {
      const cls = G.CLASSES?.[g.playerClassId];
      classEl.textContent = cls ? cls.name : '';
      classEl.style.color = cls ? cls.color : 'var(--col-text)';
    }

    const levelEl = document.getElementById('char-screen-level');
    if(levelEl) {
      const lvl = g.playerLevel || 1;
      const xp = g.playerXP || 0;
      const xpNext = g._xpForNextLevel ? g._xpForNextLevel(lvl) : lvl * 100;
      const xpPct = lvl >= 100 ? 100 : Math.min(100, Math.round(xp / xpNext * 100));
      levelEl.innerHTML = `
        <span style="color:#ffcc00;font-size:7px;letter-spacing:2px">LVL ${lvl}</span>
        <div style="margin-top:4px;background:#0a1a2a;border:1px solid #1a4a6a;height:4px;width:100%;border-radius:1px;overflow:hidden">
          <div style="width:${xpPct}%;height:100%;background:linear-gradient(90deg,#ffcc00,#ff8800);transition:width 0.3s"></div>
        </div>
        <div style="font-size:4px;color:#556677;margin-top:2px">${lvl < 100 ? xp+' / '+xpNext+' XP' : 'MAX LEVEL'}</div>
      `;
    }

    const stBtn = document.getElementById('char-screen-skilltree-btn');
    if(stBtn) {
      const cls = G.CLASSES?.[g.playerClassId];
      stBtn.style.borderColor = cls ? cls.color : '#446688';
      stBtn.style.color = cls ? cls.color : '#446688';
      stBtn.onclick = () => this.showSkillTree();
    }

    // Ability library
    // Ability library — draggable items
    const abilitiesDiv = document.getElementById('char-screen-abilities');
    if(abilitiesDiv && G.ABILITIES) {
      abilitiesDiv.innerHTML = '<div style="font-size:5px;color:#556677;margin-bottom:4px">ABILITY LIBRARY — drag to slot or click to add</div>' +
        Object.values(G.ABILITIES).map(def =>
          `<div draggable="true" data-ability-id="${def.id}"
            style="display:inline-block;background:rgba(0,20,40,0.9);border:1px solid ${def.color}55;
            padding:5px 7px;margin:2px;font-size:5px;cursor:grab;vertical-align:top;user-select:none">
            <span style="color:${def.color}">${def.icon} ${def.name}</span>
            <div style="color:#556677;font-size:4px;margin-top:2px">CD: ${def.cooldown}s · E: ${def.energyCost}</div>
          </div>`
        ).join('');
      abilitiesDiv.querySelectorAll('[data-ability-id]').forEach(el => {
        el.addEventListener('dragstart', e => {
          e.dataTransfer.setData('text/plain', JSON.stringify({src:'library', id:el.dataset.abilityId}));
          e.dataTransfer.effectAllowed = 'copy';
        });
        el.addEventListener('click', () => {
          const aid = el.dataset.abilityId;
          const p = G.game.player;
          if(p.abilities.includes(aid)) return;
          if(p.abilities.length >= 10) { this.addMsg('Ability slots full (10 max)','#ff4444'); return; }
          p.abilities.push(aid);
          this.showCharScreen();
        });
      });
    }

    // Assigned slots — drop targets + draggable
    const slotsDiv = document.getElementById('char-screen-ability-slots');
    if(slotsDiv) {
      const p = G.game.player;
      const LABELS = ['1','2','3','4','5','6','7','8','9','0'];
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-top:6px';
      for(let i=0;i<10;i++) {
        const aid = (p.abilities||[])[i];
        const def = aid ? G.ABILITIES?.[aid] : null;
        const slot = document.createElement('div');
        slot.dataset.slotIdx = i;
        slot.draggable = !!def;
        slot.style.cssText = `width:46px;height:52px;background:rgba(0,10,20,0.9);
          border:1px solid ${def?def.color+'66':'#1a4a6a'};border-radius:2px;
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          position:relative;font-size:5px;cursor:${def?'grab':'default'};user-select:none;
          transition:border-color 0.1s,background 0.1s`;
        slot.innerHTML = `<div style="position:absolute;top:2px;left:4px;font-size:5px;color:#446688">${LABELS[i]}</div>
          ${def
            ? `<div style="font-size:16px;color:${def.color}">${def.icon}</div>
               <div style="font-size:4px;color:${def.color}bb;text-align:center;margin-top:1px">${def.name}</div>
               <div data-remove-ability="${i}" style="position:absolute;top:1px;right:3px;font-size:6px;color:#ff4444;cursor:pointer;line-height:1">×</div>`
            : `<div style="font-size:9px;color:#1a3a5a">+</div>`
          }`;

        // drag FROM slot
        slot.addEventListener('dragstart', e => {
          if(!def) { e.preventDefault(); return; }
          e.dataTransfer.setData('text/plain', JSON.stringify({src:'slot', idx:i, id:aid}));
          e.dataTransfer.effectAllowed = 'move';
        });
        // drag OVER slot — highlight
        slot.addEventListener('dragover', e => {
          e.preventDefault();
          e.dataTransfer.dropEffect = e.dataTransfer.effectAllowed === 'move' ? 'move' : 'copy';
          slot.style.background = 'rgba(0,60,120,0.6)';
          slot.style.borderColor = '#00aaff';
        });
        slot.addEventListener('dragleave', () => {
          slot.style.background = 'rgba(0,10,20,0.9)';
          slot.style.borderColor = def ? def.color+'66' : '#1a4a6a';
        });
        // DROP onto slot
        slot.addEventListener('drop', e => {
          e.preventDefault();
          slot.style.background = 'rgba(0,10,20,0.9)';
          slot.style.borderColor = def ? def.color+'66' : '#1a4a6a';
          let payload;
          try { payload = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
          const abilities = p.abilities || (p.abilities = []);
          if(payload.src === 'library') {
            if(abilities[i] === payload.id) return;
            abilities[i] = payload.id;
          } else if(payload.src === 'slot') {
            const fromIdx = payload.idx;
            if(fromIdx === i) return;
            // swap
            const tmp = abilities[i];
            abilities[i] = abilities[fromIdx];
            abilities[fromIdx] = tmp;
          }
          this.showCharScreen();
        });
        // remove button
        const removeBtn = slot.querySelector('[data-remove-ability]');
        if(removeBtn) {
          removeBtn.addEventListener('click', e => {
            e.stopPropagation();
            p.abilities.splice(i, 1);
            this.showCharScreen();
          });
        }
        wrap.appendChild(slot);
      }
      slotsDiv.innerHTML = '';
      slotsDiv.appendChild(wrap);
    }

    this._buildCharGear();

    const overlay = document.getElementById('char-screen-overlay');
    overlay.classList.remove('hidden');
    // Close on background click or close button
    overlay.onclick = e => {
      if(e.target === overlay) this.hideCharScreen();
    };
    document.getElementById('char-screen-close').onclick = () => this.hideCharScreen();
  }

  // Paper-doll equip slots + vital stats (left panel) + inventory/skills (right panel).
  _buildCharGear() {
    const g = G.game, pc = g?.playerCharacter?.(), gear = g?.player?.gear || (g?.player ? (g.player.gear = []) : []);
    if(!pc) return;
    G.charRecompute(pc);
    const tip = v => G.gearTooltip(v).map(l => l.t).join(' · ').replace(/"/g, '');

    // === Paper-doll slot cells ===
    document.querySelectorAll('.cs-equip-slot').forEach(el => {
      const s = el.dataset.eslot, v = pc.equip[s];
      const col = v ? G.gearColor(v) : '#1a3a5a';
      el.style.borderColor = col;
      el.title = v ? tip(v) + ' — click to remove' : (G.EQUIP_LABELS[s] || s);
      el.style.cursor = v ? 'pointer' : 'default';
      el.draggable = !!v;
      el.innerHTML = v
        ? `<div style="font-size:14px;line-height:1">${G.gearIcon(v)}</div>`
        : `<div style="font-size:3.5px;color:#2a4a6a;text-align:center;padding:1px;letter-spacing:0">${G.EQUIP_LABELS[s]||s}</div>`;
    });

    // === Vital bars + attributes ===
    const statsEl = document.getElementById('char-screen-stats');
    if(statsEl) {
      const bar = (label, cur, max, col) => {
        const pct = max ? Math.max(0, Math.min(100, Math.round(cur/max*100))) : 0;
        return `<div style="margin-bottom:3px">
          <div style="display:flex;justify-content:space-between;font-size:5px;color:#8899aa;margin-bottom:1px"><span>${label}</span><span>${Math.round(cur)}/${max}</span></div>
          <div style="background:#0a1a2a;border:1px solid #1a4a6a;height:4px;border-radius:1px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${col}"></div></div>
        </div>`;
      };
      const plusBtn = pc.attrPoints > 0 ? ` <span data-attr="@" style="cursor:pointer;color:#44ff88;border:1px solid #2a6a3a;border-radius:2px;padding:0 2px">+</span>` : '';
      const pAttr = (lbl, key, v) => `<span style="color:#8899aa">${lbl}</span> <span style="color:#dfe8f4">${v}</span>${plusBtn.replace('@',key)}`;
      const attr  = (lbl, v) => `<span style="color:#8899aa">${lbl}</span> <span style="color:#dfe8f4">${v}</span>`;
      const need = 40 + (pc.level-1)*pc.level*12;
      const setBtn = pc._equipSets ? `<button id="swap-equip-btn" style="font-size:5px;background:#1a3a4a;border:1px solid #44aaff;color:#44aaff;padding:2px 6px;cursor:pointer;margin-top:6px;display:block">⟲ SWAP SET</button>` : '';
      statsEl.innerHTML = `
        ${bar('HP',     pc.hp,     pc.maxHp,     'linear-gradient(90deg,#ff4455,#ff8866)')}
        ${bar('MANA',   pc.mana,   pc.maxMana,   'linear-gradient(90deg,#3366ff,#33aaff)')}
        ${bar('ENERGY', pc.energy, pc.maxEnergy, 'linear-gradient(90deg,#ffcc00,#ffee66)')}
        <div style="font-size:6px;margin:3px 0 5px"><span style="color:#8899aa">ARMOR</span> <span style="color:#ccddff">🛡 ${pc.armor}</span></div>
        <div style="display:flex;flex-wrap:wrap;gap:3px 10px;font-size:6px">
          ${attr('LVL', pc.level)} ${attr('XP', Math.round(pc.xp)+'/'+need)}
          ${pAttr('STR','str',pc.str)} ${pAttr('DEX','dex',pc.dex)} ${pAttr('INT','int',pc.int)} ${pAttr('VIT','vit',pc.vit)}
          ${attr('CRIT', Math.round((pc.critChance||0)*100)+'%')}
          ${pc.attrPoints ? `<span style="color:#ffcc44">${pc.attrPoints} attr pts</span>` : ''}
        </div>${setBtn}`;
      statsEl.querySelectorAll('[data-attr]').forEach(el => {
        el.addEventListener('click', () => { if(G.charSpendAttr(pc, el.dataset.attr)) this.showCharScreen(); });
      });
    }

    // === Inventory + Skills (right panel) ===
    const host = document.getElementById('char-screen-gear'); if(!host) return;
    const rOrd = { legendary:0, rare:1, magic:2, common:3 };
    const sorted = gear.map((inst,i)=>({inst,i})).sort((a,b)=>(rOrd[a.inst.rarity]-rOrd[b.inst.rarity])||G.gearName(a.inst).localeCompare(G.gearName(b.inst)));
    const inv = `<div style="font-size:5px;color:#556677;margin-bottom:4px;letter-spacing:2px">INVENTORY · ${gear.length} item${gear.length===1?'':'s'} <span style="color:#445566;font-size:4px">(click to equip)</span></div>
      ${sorted.length
        ? `<div style="display:flex;flex-wrap:wrap;gap:3px;max-height:160px;overflow-y:auto">${sorted.map(({inst,i})=>{const col=G.gearColor(inst);return `<div data-gidx="${i}" title="${tip(inst)}" style="background:rgba(0,20,40,0.9);border:1px solid ${col}88;padding:3px 5px;font-size:5px;cursor:pointer"><span style="color:${col}">${G.gearIcon(inst)} ${G.gearName(inst)}</span></div>`;}).join('')}</div>`
        : `<div style="font-size:5px;color:#445566">No loose gear — kill enemies for drops.</div>`}`;
    const skills = `<div style="font-size:5px;color:#556677;margin:10px 0 4px;letter-spacing:2px;display:flex;justify-content:space-between;align-items:center">
        <span>SKILLS${pc.skillPoints?` · <span style="color:#ffcc44">${pc.skillPoints} pts</span>`:''} <span style="color:#445566">(hotbar 1-4)</span></span>
        <span data-respec="1" style="cursor:pointer;color:#ff8844;border:1px solid #6a3a2a;border-radius:2px;padding:1px 5px">RESPEC</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:3px">${G.CHAR_SKILL_IDS.map(id=>{
        const s=G.CHAR_SKILLS[id],unlocked=pc.skills.includes(id),slotIdx=pc.hotbar.indexOf(id),rank=G.charSkillRank(pc,id),maxed=rank>=G.SKILL_MAX_RANK;
        const can=pc.skillPoints>0&&(!unlocked||!maxed);
        const tag=!unlocked?(pc.skillPoints>0?'<span style="color:#ffcc44">+unlock</span>':'<span style="color:#556677">locked</span>')
                 :(maxed?'<span style="color:#88bbff">MAX</span>':(pc.skillPoints>0?'<span style="color:#ffcc44">+rank</span>':''));
        return `<div data-skill="${id}" title="${(s.desc||'').replace(/"/g,'')} — ${s.mana} mana · ${s.cooldown}s"
          style="background:rgba(0,20,40,0.9);border:1px solid ${s.color}${unlocked?'':'44'};padding:3px 5px;font-size:5px;cursor:${can?'pointer':'default'};opacity:${unlocked||can?1:0.45}">
          <span style="color:${s.color}">${s.icon} ${s.name}${unlocked?` R${rank}`:''}</span>${unlocked&&slotIdx>=0?` <span style="color:#9fb3c8">[${slotIdx+1}]</span>`:''} ${tag}</div>`;
      }).join('')}</div>`;
    host.innerHTML = inv + skills;

    // === Event binding ===
    // Equipment slots (static HTML in #cs-doll-wrap)
    document.querySelectorAll('.cs-equip-slot').forEach(el => {
      const slot = el.dataset.eslot;
      el.addEventListener('click', () => { if(pc.equip[slot] && G.charUnequip(pc, slot, gear)) this.showCharScreen(); });
      el.addEventListener('dragstart', ev => {
        if(!pc.equip[slot]) { ev.preventDefault(); return; }
        ev.dataTransfer.effectAllowed = 'move';
        ev.dataTransfer.setData('app/equip-slot', slot);
      });
      el.addEventListener('dragover', ev => { ev.preventDefault(); ev.dataTransfer.dropEffect='move'; el.style.opacity='0.6'; });
      el.addEventListener('dragleave', () => { el.style.opacity='1'; });
      el.addEventListener('drop', ev => {
        el.style.opacity='1'; ev.preventDefault();
        const srcSlot = ev.dataTransfer.getData('app/equip-slot');
        const gidx    = ev.dataTransfer.getData('app/gear-idx');
        if(srcSlot) {
          const srcItem = pc.equip[srcSlot], tgtItem = pc.equip[slot];
          if(srcItem && G.slotAccepts(slot, G.gearEquipSlot(srcItem))) {
            pc.equip[slot] = srcItem;
            if(tgtItem && G.slotAccepts(srcSlot, G.gearEquipSlot(tgtItem))) pc.equip[srcSlot] = tgtItem;
            else if(tgtItem) gear.push(pc.equip[srcSlot] = undefined);
            G.charRecompute(pc); this.showCharScreen();
          }
        } else if(gidx !== undefined) {
          const inst = gear[+gidx];
          if(inst && G.slotAccepts(slot, G.gearEquipSlot(inst))) {
            if(pc.equip[slot]) gear.push(pc.equip[slot]);
            pc.equip[slot] = inst; gear.splice(+gidx, 1);
            G.charRecompute(pc); this.showCharScreen();
          }
        }
      });
    });
    // Skills
    host.querySelectorAll('[data-skill]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.skill;
        const ok = pc.skills.includes(id) ? G.charRankSkill(pc, id) : G.charUnlockSkill(pc, id);
        if(ok) this.showCharScreen();
      });
    });
    host.querySelector('[data-respec]')?.addEventListener('click', () => { G.charRespec(pc); this.showCharScreen(); });
    // Inventory
    host.querySelectorAll('[data-gidx]').forEach(el => {
      el.draggable = true;
      el.addEventListener('click', () => {
        const inst = gear[+el.dataset.gidx]; if(!inst) return;
        const es = G.gearEquipSlot(inst);
        const target = G.EQUIP_SLOTS.find(s=>G.slotAccepts(s,es)&&!pc.equip[s]) || G.EQUIP_SLOTS.find(s=>G.slotAccepts(s,es));
        if(target && G.charEquip(pc, target, inst, gear)) this.showCharScreen();
      });
      el.addEventListener('dragstart', ev => { ev.dataTransfer.effectAllowed='move'; ev.dataTransfer.setData('app/gear-idx', el.dataset.gidx); });
      el.addEventListener('dragover',  ev => { ev.preventDefault(); ev.dataTransfer.dropEffect='move'; el.style.opacity='0.6'; });
      el.addEventListener('dragleave', () => { el.style.opacity='1'; });
    });
    // Swap equip set
    document.getElementById('swap-equip-btn')?.addEventListener('click', () => {
      if(!pc._equipSets) return;
      if(pc.equip.righthand) G.charUnequip(pc,'righthand',gear);
      if(pc.equip.lefthand)  G.charUnequip(pc,'lefthand', gear);
      pc._activeSet = 1 - pc._activeSet;
      const set = pc._equipSets[pc._activeSet];
      if(set.righthand) G.charEquip(pc,'righthand',set.righthand,gear);
      if(set.lefthand)  G.charEquip(pc,'lefthand', set.lefthand, gear);
      G.charRecompute(pc); this.showCharScreen();
    });
  }

  hideCharScreen() {
    document.getElementById('char-screen-overlay')?.classList.add('hidden');
    if(G.game?.player) this.updateAbilityBar(G.game.player);
  }

  // Sync the Sound menu's music picker with the engine state.
  refreshMusicPicker() {
    const s = G.sound; if(!s || !s.currentTrack) return;
    const t = s.currentTrack();
    const np  = document.getElementById('music-now-playing');
    const pos = document.getElementById('music-track-pos');
    const btn = document.getElementById('music-playstop-btn');
    const auto= document.getElementById('music-auto');
    if(np)  np.textContent  = t.name + (t.auto ? '  ◇ auto' : '  ◆ locked');
    if(pos) pos.textContent = 'TRACK ' + (t.idx + 1) + ' / ' + t.count + (t.playing ? '   ▶ PLAYING' : '   ◼ STOPPED');
    if(btn) { btn.textContent = t.playing ? '◼ STOP' : '▶ PLAY'; const c = t.playing ? '#ff6644' : '#44ff88'; btn.style.borderColor = c; btn.style.color = c; }
    if(auto) auto.checked = t.auto;
    // Keep the MUSIC on/off row in sync (play/stop flips musicEnabled).
    const mEn = document.getElementById('opt-music-enabled'), mLbl = document.getElementById('opt-music-label');
    if(mEn)  mEn.checked = !!s.musicEnabled;
    if(mLbl) mLbl.textContent = s.musicEnabled ? 'ON' : 'OFF';
  }

  showSkillTree() {
    const g = G.game;
    const classId = g.playerClassId || 'space_marine';
    const cls = G.CLASSES?.[classId];
    const tree = G.SKILL_TREES?.[classId] || [];
    const lvl = g.playerLevel || 1;
    const xp = g.playerXP || 0;
    const xpNext = g._xpForNextLevel ? g._xpForNextLevel(lvl) : lvl * 100;
    const xpPct = lvl >= 100 ? 100 : Math.min(100, Math.round(xp / xpNext * 100));

    const overlay = document.getElementById('skill-tree-overlay');
    if(!overlay) return;

    // Build node HTML — index 0 at bottom, 4 at top
    const nodeHtml = [...tree].reverse().map((node, revIdx) => {
      const isBottom = revIdx === tree.length - 1;
      const isAbility = node.isAbility;
      const abilDef = isAbility ? (G.ABILITIES?.[node.id] || {}) : {};
      const name  = isAbility ? (abilDef.name  || node.id) : node.name;
      const icon  = isAbility ? (abilDef.icon  || '?')     : node.icon;
      const color = isAbility ? (abilDef.color || cls?.color || '#44aaff') : (node.color || cls?.color || '#44aaff');
      const desc  = isAbility ? (abilDef.desc  || '')       : node.desc;
      const locked = !isBottom;

      return `
        <div class="st-node ${locked ? 'st-locked' : 'st-unlocked'}" style="border-color:${locked ? '#1a3a5a' : color}">
          <div class="st-node-icon" style="color:${locked ? '#334455' : color}">${locked ? '🔒' : icon}</div>
          <div class="st-node-name" style="color:${locked ? '#334455' : color}">${locked ? '???' : name}</div>
          ${!locked ? `<div class="st-node-desc">${desc}</div>` : ''}
        </div>
        ${revIdx < tree.length - 1 ? `<div class="st-connector" style="background:${locked ? '#1a3a5a' : color+'44'}"></div>` : ''}
      `;
    }).join('');

    overlay.innerHTML = `
      <div id="skill-tree-box">
        <div class="panel-title" style="letter-spacing:3px;margin-bottom:4px">${cls ? cls.icon+' '+cls.name : 'SKILL TREE'}</div>
        <div style="font-size:5px;color:#ffcc00;letter-spacing:2px;margin-bottom:2px">LVL ${lvl}</div>
        <div style="background:#0a1a2a;border:1px solid #1a4a6a;height:4px;width:200px;border-radius:1px;overflow:hidden;margin:0 auto 8px">
          <div style="width:${xpPct}%;height:100%;background:linear-gradient(90deg,#ffcc00,#ff8800)"></div>
        </div>
        <div style="font-size:4px;color:#445566;margin-bottom:16px">${lvl < 100 ? xp+' / '+xpNext+' XP TO LEVEL '+(lvl+1) : 'MAX LEVEL'}</div>
        <div id="st-tree-nodes" style="display:flex;flex-direction:column;align-items:center;gap:0">
          ${nodeHtml}
        </div>
        <button class="btn" id="skill-tree-close" style="margin-top:20px;font-size:6px">BACK [C]</button>
      </div>
    `;
    overlay.classList.remove('hidden');
    document.getElementById('skill-tree-close').onclick = () => this.hideSkillTree();
  }

  hideSkillTree() {
    document.getElementById('skill-tree-overlay')?.classList.add('hidden');
  }

  showMissionLog(){
    const overlay=document.getElementById('mission-log-overlay');
    if(!overlay) return;
    overlay.classList.remove('hidden');
    this._refreshMissionLog();
  }

  hideMissionLog(){
    document.getElementById('mission-log-overlay')?.classList.add('hidden');
  }

  // ── Combat Log ────────────────────────────────────────────
  showCombatLog() {
    const overlay = document.getElementById('combat-log-overlay');
    if(!overlay) return;
    overlay.classList.remove('hidden');
    const list = document.getElementById('combat-log-list');
    if(list) {
      const log = this._msgHistory || [];
      if(!log.length) {
        list.innerHTML = '<div style="color:#556677;font-size:7px;padding:16px">No events logged.</div>';
      } else {
        list.innerHTML = log.map(e =>
          `<div style="display:flex;gap:8px;margin-bottom:4px;font-size:6px;line-height:1.6">
            <span style="color:#445566;white-space:nowrap">${e.ts}</span>
            <span style="color:${e.color||'#aabbcc'}">${e.text}</span>
          </div>`
        ).join('');
      }
    }
  }

  hideCombatLog() {
    document.getElementById('combat-log-overlay')?.classList.add('hidden');
  }

  // ── Mission result popup ──────────────────────────────────
  showMissionResult(success, title, credits, rep) {
    const el = document.getElementById('mission-result-popup');
    if(!el) return;
    const color = success ? '#44ff88' : '#ff6644';
    const icon  = success ? '✓' : '✗';
    const repStr = rep > 0
      ? `<div style="color:${success?'#44ff88':'#ff4444'};font-size:7px">${success?'+':''}${rep} REP</div>`
      : '';
    el.innerHTML = `<div id="mission-result-body" style="border-color:${color}">
      <div style="color:${color};font-size:9px;margin-bottom:4px">${icon} MISSION ${success?'COMPLETE':'FAILED'}</div>
      <div style="font-size:6px;color:#aabbcc;margin-bottom:4px">${title}</div>
      ${credits ? `<div style="color:#ffcc00;font-size:7px">+${G.fmtCredits(credits)}</div>` : ''}
      ${repStr}
    </div>`;
    el.classList.remove('hidden');
    clearTimeout(this._missionResultTimer);
    this._missionResultTimer = setTimeout(() => el.classList.add('hidden'), 4000);
  }

  _refreshMissionLog(){
    const list=document.getElementById('mission-log-list');
    const canvas=document.getElementById('mission-log-canvas');
    const lbl=document.getElementById('mission-log-map-label');
    if(list) list.innerHTML=this._buildMissionLogHTML();
    if(canvas) this._drawMiniGalaxy(canvas, null);
    if(lbl) lbl.textContent='Hover a mission';

    // Hover → map preview
    document.querySelectorAll('[data-logmission]').forEach(card=>{
      card.addEventListener('mouseenter',()=>{
        const destId=card.dataset.destid;
        if(canvas) this._drawMiniGalaxy(canvas, destId||null);
        const dest=G.SYSTEMS.find(s=>s.id===destId);
        if(lbl) lbl.textContent=dest?'→ '+dest.name:'Current system';
      });
    });

    // Add zoom and drag support to mission log canvas
    if(canvas) this._setupMapInteraction(canvas);

    // Abandon buttons
    document.querySelectorAll('[data-abandonid]').forEach(btn=>{
      btn.addEventListener('click', e=>{
        e.stopPropagation();
        this.abandonMission(btn.dataset.abandonid);
      });
    });
  }

  abandonMission(missionId){
    const idx=G.game.activeMissions.findIndex(m=>m.id===missionId);
    if(idx<0) return;
    const m=G.game.activeMissions[idx];
    if(m.type==='cargo_haul') G.game.player.removeCargo(m.params.item, m.params.qty||1);
    if(m.type==='passenger')  G.game.player.removeCargo('mission_pkg', m.params.qty||1);
    G.game.activeMissions.splice(idx,1);
    const repLoss = Math.max(3, Math.round((m.repReward||5)*0.5));
    const fac = m.repFaction||m.faction;
    G.game.setRel(fac, G.game.getRel(fac)-repLoss, 'abandoned: '+m.title);
    this.addMsg('Mission abandoned: '+m.title,'#ff8844');
    G.game.addCombatLog('MISSION ABANDONED: '+m.title.toUpperCase()+' (-'+repLoss+' REP)', '#ff8844');
    this.showMissionResult(false, m.title, 0, -repLoss);
    this._refreshMissionLog();
    G.game.galaxy.draw(G.game.currentSysId);
  }

  _bindLogTab(){
    document.querySelectorAll('[data-abandonid]').forEach(btn=>{
      btn.addEventListener('click',()=>this.abandonMission(btn.dataset.abandonid));
    });
  }

  // ── Outfitter ─────────────────────────────────────────────
  _buildOutfitterHTML(){
    const p=G.game.player;
    const tpl=G.SHIPS[p.templateId];
    if(!Array.isArray(p.slots)) p.slots = new Array(tpl.slots).fill(null);
    const mods=G.game.economy.getOutfitter(this._currentSysId);

    // Ship stats
    const statHtml=`<div style="font-size:6px;color:#aaa;line-height:2">
      Hull ${Math.ceil(p.hull)}/${p.maxHull} &nbsp;
      Shld ${Math.ceil(p.shields)}/${p.maxShields} &nbsp;
      Enrg ${Math.ceil(p.energy)}/${p.maxEnergy}<br>
      Fuel ${Math.ceil(p.fuel)}/${p.maxFuel} &nbsp;
      Mass ${p.mass|0} &nbsp;
      Cargo ${G.game.fleetCargoUsed()}/${G.game.fleetCargoSpace()}${G.game.fleet?.length?' [fleet]':''}<br>
      Thrust ${p.thrustPower|0} &nbsp; Turn ${p.turnSpeed.toFixed(1)} &nbsp; Jump ${p.canJump?'YES':'NO'}
    </div>`;

    // Equipped modules displayed as full cards
    let equippedHtml='<div style="margin-bottom:10px"><div style="font-size:6px;color:#aaa;margin-bottom:5px">EQUIPPED</div>';
    let equipCount=0;
    p.slots.forEach((instId, idx)=>{
      if(!instId) return;
      equipCount++;
      const inst=p.modules[instId];
      const mod=inst?(G.MODULES[inst.moduleId]||G.WEAPONS[inst.moduleId]):null;
      if(!mod) return;
      equippedHtml+=`<div class="item-card" style="margin-bottom:8px">${this._modCardHTML(mod,'')}</div>`;
    });
    if(equipCount===0) equippedHtml+='<div style="font-size:6px;color:#556677">No modules installed</div>';
    equippedHtml+='</div>';

    // Modules for sale — BUY into module inventory (install happens in Ship Builder)
    const slotTypes=[...new Set(mods.map(m=>m.slot))].sort();
    let filterBtns='<div class="outfit-filter-row" id="outfit-filter">';
    filterBtns+='<button class="btn outfit-filter-btn active" data-filter="all" onclick="G.ui.filterOutfitter(\'all\')">ALL</button>';
    for(const st of slotTypes){
      filterBtns+=`<button class="btn outfit-filter-btn" data-filter="${st}" onclick="G.ui.filterOutfitter('${st}')">${st.toUpperCase()}</button>`;
    }
    filterBtns+='</div>';

    let saleList='<div id="outfit-sale-list" class="outfit-sale-grid">';
    for(const mod of mods){
      const canAfford=G.game.credits>=mod.price;
      const actions=`<button class="btn btn-buy" style="margin-top:5px;font-size:5px;width:100%"
        onclick="G.ui.buyModule('${mod.id}')"
        ${canAfford?'':'disabled style="opacity:0.35"'}>BUY $${G.fmt(mod.price)}</button>`;
      saleList+=`<div class="item-card outfit-sale-item" data-slot="${mod.slot}"
        style="opacity:${canAfford?1:0.5}">
        ${this._modCardHTML(mod, actions)}
      </div>`;
    }
    saleList+='</div>';

    // Stored modules — SELL only
    const modInv = p.moduleInventory || [];
    let invHtml = '';
    if (modInv.length > 0) {
      invHtml = `<div style="margin-top:15px;border-top:1px solid #1a4a6a;padding-top:10px">
        <div style="font-size:6px;color:#aaa;margin-bottom:5px">STORED MODULES (${modInv.length}) — install in Ship Builder</div>
        <div class="outfit-sale-grid">`;
      modInv.forEach((modId, idx) => {
        const mod = G.MODULES[modId] || G.WEAPONS[modId];
        if (!mod) return;
        const sellVal = Math.floor((mod.price||0)*0.5);
        const actions = `<button class="btn btn-sell" style="margin-top:5px;font-size:5px;width:100%" data-inv-sell="${idx}">SELL $${G.fmt(sellVal)}</button>`;
        invHtml += `<div class="item-card outfit-sale-item">${this._modCardHTML(mod, actions)}</div>`;
      });
      invHtml += `</div></div>`;
    }

    return `<div class="panel-title">OUTFITTER — ${p.name.toUpperCase()}</div>
    <div style="font-size:5px;color:#66aacc;margin:2px 0 8px">Buy modules to storage and sell here. Install them on your ship in the SHIP BUILDER.</div>
    <div class="outfit-main">
      <div class="outfit-left">
        ${equippedHtml}
        ${statHtml}
      </div>
      <div class="outfit-right">
        ${filterBtns}
        ${saleList}
        ${invHtml}
      </div>
    </div>`;
  }

  _drawOutfitterShip(){ /* slot grid replaces ship canvas — no-op */ }

  filterOutfitter(slotType){
    document.querySelectorAll('.outfit-filter-btn').forEach(b=>b.classList.toggle('active',b.dataset.filter===slotType));
    document.querySelectorAll('.outfit-sale-item').forEach(item=>{
      item.style.display=(slotType==='all'||item.dataset.slot===slotType)?'':'none';
    });
  }

  // Buy a module from the outfitter into module storage (install in Ship Builder)
  buyModule(modId){
    const mod=G.MODULES[modId]||G.WEAPONS[modId];
    if(!mod) return;
    if(G.game.credits<mod.price){ this.addMsg('Not enough credits!','#ff4444'); return; }
    const p=G.game.player;
    if(!p.moduleInventory) p.moduleInventory=[];
    G.game.credits-=mod.price;
    p.moduleInventory.push(mod.id);
    this.addMsg('Bought '+mod.name+' (stored — install in Ship Builder)','#44ff44');
    this.renderSpaceportTab('outfitter');
  }


  _bindOutfitter(){
    document.querySelectorAll('[data-inv-sell]').forEach(btn => {
      btn.addEventListener('click', () => this.sellFromInventory(+btn.dataset.invSell));
    });
  }

  sellFromInventory(idx) {
    const p = G.game.player;
    const modId = (p.moduleInventory||[])[idx];
    if (!modId) return;
    const mod = G.MODULES[modId] || G.WEAPONS[modId];
    const val = Math.floor((mod?.price||0)*0.5);
    p.moduleInventory.splice(idx, 1);
    G.game.credits += val;
    this.addMsg('Sold ' + (mod?.name||modId) + ' +'+G.fmtCredits(val), '#ffcc00');
    this.renderSpaceportTab('outfitter');
  }

  // ── Ship Builder (spaceport tab) ─────────────────────────
  // Ensure every module has a hex (q,r): core at origin, unplaced inner modules
  // dropped on a free perimeter hex, then the hull re-wrapped. Preserves the
  // player's existing custom placements; also migrates square-grid saves.
  _ensureBuilderCells(p) {
    // Core anchored at origin.
    for(const inst of Object.values(p.modules)) {
      if(G.MODULES[inst.moduleId]?.slot === 'core') { inst.q = 0; inst.r = 0; break; }
    }
    // Any inner module without a hex gets a free perimeter hex.
    for(const inst of Object.values(p.modules)) {
      const m = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
      if(m && m.slot === 'hull') continue;
      if(inst.q == null) { const c = p._freeBuilderCell(); inst.q = c.q; inst.r = c.r; }
    }
    // Rebuild the hull wrap only when the inner layout actually changed — this
    // runs every render frame, so it must be a cheap no-op in the steady state.
    const sig = Object.values(p.modules)
      .filter(m => { const md = G.MODULES[m.moduleId] || G.WEAPONS[m.moduleId]; return md && md.slot !== 'hull' && m.q != null; })
      .map(m => m.q + ',' + m.r).sort().join(';');
    if(sig !== p._hullSig) {
      for(const [id, inst] of Object.entries(p.modules)) {
        if(G.MODULES[inst.moduleId]?.slot === 'hull') { p.slots[inst.slotIdx] = null; delete p.modules[id]; }
      }
      p._wrapHull();
      p._hullSig = sig;
    }
  }

  _builderDirLabel(rot) { return ['▲ FORWARD','► RIGHT','▼ AFT','◄ LEFT'][rot & 3]; }

  // Stat-card markup for a module instance; controls shown only for the selected tile.
  _builderCardHTML(instId, withControls) {
    const p = G.game.player;
    const inst = p.modules[instId];
    if(!inst) return '';
    const mod = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
    if(!mod) return '';

    // Hull panel: show color picker + shape selector
    if(mod.slot === 'hull') {
      const hullCol = inst.color || '#667799';
      const COLORS = ['#8899bb','#4488ff','#ff6600','#cc3322','#00ff88','#ffcc00','#aa44ff','#44aaff','#ff88cc','#ffffff','#aaaaaa','#667799'];
      let controls = '';
      if(withControls) {
        const [r, g, b] = this._hexToRgb(hullCol);
        const swatches = COLORS.map(col =>
          `<div class="hull-color-swatch" style="background:${col};${col===hullCol?'border:2px solid #fff;':''}"
            onclick="G.ui.builderSetHullColor('${instId}','${col}')"></div>`
        ).join('');
        const rgbId = `rgb_${instId}`;
        controls = `
          <div style="margin-top:6px;font-size:5px;color:#aabbcc;margin-bottom:3px">HULL COLOR</div>
          <div style="display:flex;gap:2px;flex-wrap:wrap;margin-bottom:4px">${swatches}</div>
          <div style="font-size:5px;color:#556677;margin-bottom:2px">RGB SLIDERS</div>
          <div style="font-size:5px;margin-bottom:2px">R: <input type="range" min="0" max="255" value="${r}" style="width:70px;vertical-align:middle" data-rgb="${rgbId}" data-ch="r" oninput="G.ui._updateRgbDisplay(this,'${rgbId}')" onchange="G.ui._finalizeRgbSlider(this,'${instId}')"> <span style="color:#ff8888" id="${rgbId}_r">${r}</span></div>
          <div style="font-size:5px;margin-bottom:2px">G: <input type="range" min="0" max="255" value="${g}" style="width:70px;vertical-align:middle" data-rgb="${rgbId}" data-ch="g" oninput="G.ui._updateRgbDisplay(this,'${rgbId}')" onchange="G.ui._finalizeRgbSlider(this,'${instId}')"> <span style="color:#88ff88" id="${rgbId}_g">${g}</span></div>
          <div style="font-size:5px;margin-bottom:4px">B: <input type="range" min="0" max="255" value="${b}" style="width:70px;vertical-align:middle" data-rgb="${rgbId}" data-ch="b" oninput="G.ui._updateRgbDisplay(this,'${rgbId}')" onchange="G.ui._finalizeRgbSlider(this,'${instId}')"> <span style="color:#8888ff" id="${rgbId}_b">${b}</span></div>
          <button class="btn" style="font-size:5px;width:100%;margin-top:2px;border-color:#44ffaa;color:#44ffaa" onclick="G.ui.builderOpenPickerHere('${instId}')">＋ INSTALL MODULE HERE</button>`;
      }
      return `<div style="font-size:7px;color:#aabbcc;font-weight:bold;margin-bottom:4px">HULL PANEL</div>
        <div style="font-size:5px;color:#667799;margin-bottom:4px">Outer structural plating (perimeter build edge)</div>
        <div style="font-size:5px;display:flex;gap:4px;align-items:center;margin-bottom:2px">
          <span style="color:#889">COLOR</span>
          <span style="width:10px;height:10px;background:${hullCol};display:inline-block;border-radius:2px"></span>
          <span style="color:${hullCol}">${hullCol}</span>
        </div>` + controls;
    }

    const rot = inst.rot || 0;
    const isCore = mod.slot === 'core';
    let controls;
    if(inst.broken) {
      const repCost = Math.ceil((mod.price||500) * 0.3);
      const canAfford = G.game.credits >= repCost;
      controls = `
        <div style="color:#ff4444;font-weight:bold;font-size:7px;margin-top:6px">⚠ MODULE DESTROYED</div>
        <div style="font-size:5px;color:#ff6644;margin-top:2px;margin-bottom:6px">Non-functional until repaired</div>
        <div style="font-size:5px;color:#889;margin-bottom:4px">Module HP: 0 / ${mod.hp||50}</div>
        <button class="btn" style="font-size:5px;width:100%;border-color:${canAfford?'#44ff88':'#556677'};color:${canAfford?'#44ff88':'#556677'}"
          ${canAfford?`onclick="G.ui.builderRepairModule('${instId}')"`:' disabled'}>REPAIR — ${G.fmtCredits(repCost)}</button>
        ${!canAfford?`<div style="font-size:5px;color:#556677;margin-top:3px;text-align:center">Need ${G.fmtCredits(repCost-G.game.credits)} more</div>`:''}`;
    } else if(withControls) {
      controls = `<div style="display:flex;gap:4px;margin-top:6px;align-items:center">
        <button class="btn" style="font-size:6px;padding:3px 6px" onclick="G.ui.builderRotate(-1)">◄</button>
        <div style="flex:1;text-align:center;font-size:6px;color:#ffd24a">${this._builderDirLabel(rot)}</div>
        <button class="btn" style="font-size:6px;padding:3px 6px" onclick="G.ui.builderRotate(1)">►</button>
      </div>
      <div style="font-size:5px;color:#556677;margin-top:3px">Module HP: ${Math.ceil(inst.hp||mod.hp||50)} / ${mod.hp||50}</div>
      ${isCore ? `<div style="font-size:5px;color:#556677;margin-top:3px;text-align:center">Class core module — cannot remove</div>`
               : `<button class="btn btn-remove" style="font-size:5px;width:100%;margin-top:4px" onclick="G.ui.builderRemove()">REMOVE TO STORAGE</button>`}`;
    } else {
      controls = `<div style="margin-top:4px;font-size:6px;color:#ffd24a;text-align:center">${this._builderDirLabel(rot)}</div>`;
    }
    return this._modCardHTML(mod, '') + controls;
  }

  _buildShipBuilderHTML() {
    const p = G.game.player;
    const tpl = G.SHIPS[p.templateId];
    if(!Array.isArray(p.slots)) p.slots = new Array(tpl.slots).fill(null);
    this._ensureBuilderCells(p);

    // Count installed modules (slots are unlimited; this is informational only)
    const hullInstIds = new Set(Object.keys(p.modules).filter(id => G.MODULES[p.modules[id].moduleId]?.slot === 'hull'));
    const used = Object.keys(p.modules).filter(id => !hullInstIds.has(id)).length;
    const hullCount = hullInstIds.size;

    // Calculate energy consumed/produced
    let totalEnergyDraw = 0, totalEnergyRegen = 0;
    for(const inst of Object.values(p.modules || {})) {
      const m = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
      if(m) {
        if(m.energyDraw) totalEnergyDraw += m.energyDraw;
        if(m.energyCost) totalEnergyDraw += m.energyCost * 0.1;
        const s = m.stats || {};
        if(s.energyRegen) totalEnergyRegen += s.energyRegen;
      }
    }
    const energyNet = totalEnergyRegen - totalEnergyDraw;
    const energyCol = energyNet >= 0 ? '#44ff88' : '#ff6644';

    let flyTxt, flyCol;
    if(!p.flyable) {
      const _hc = Object.values(p.modules).some(i => G.MODULES[i.moduleId]?.slot === 'cockpit');
      const _hm = Object.values(p.modules).some(i => { const m = G.MODULES[i.moduleId]; return m?.slot === 'core'; });
      if(!_hc) { flyCol='#ff4444'; flyTxt='✦ NO COCKPIT — NOT FLYABLE'; }
      else if(!_hm) { flyCol='#ff4444'; flyTxt='✦ NO CORE MODULE — NOT FLYABLE'; }
      else { flyCol='#ffaa44'; flyTxt='✦ HULL NOT ENCLOSED — CANNOT FLY'; }
    } else { flyCol='#44ff88'; flyTxt='✦ FLYABLE'; }

    // The module assembly is drawn on a hex canvas (see _drawBuilderCanvas).

    // Card overlay (selected module). Hidden when nothing selected.
    const cardHtml = this._builderSel ? this._builderCardHTML(this._builderSel, true) : '';
    const cardStyle = this._builderSel ? '' : 'display:none';

    // Module picker overlay (opened by clicking an empty cell)
    let picker = '';
    if(this._builderPickCell != null){
      const inv = p.moduleInventory || [];
      let items = inv.length
        ? inv.map((modId, i)=>{
            const mod = G.MODULES[modId] || G.WEAPONS[modId];
            if(!mod) return '';
            return `<div class="item-card outfit-sale-item" style="cursor:pointer" onclick="G.ui.builderPlace(${i})">${this._modCardHTML(mod,'')}</div>`;
          }).join('')
        : '<div style="font-size:6px;color:#889">No stored modules. Buy some at the Outfitter.</div>';
      picker = `<div id="builder-picker" class="builder-picker">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-size:7px;color:#aaccdd">SELECT A MODULE TO INSTALL</div>
          <button class="btn" style="font-size:6px" onclick="G.ui.builderClosePicker()">CLOSE ✕</button>
        </div>
        <div class="outfit-sale-grid">${items}</div>
      </div>`;
    }

    // Inventory side panel
    const inv = p.moduleInventory || [];
    const invOpen = !!this._builderInvOpen;
    let invPanel = '';
    if(invOpen) {
      let items = inv.length ? inv.map((modId, i) => {
        const m = G.MODULES[modId] || G.WEAPONS[modId];
        if(!m) return '';
        const col = G.SLOT_RING[m.slot]?.color || '#33556a';
        const icon = this._modIconURL(m.visual || m.slot);
        return `<div class="binv-item" data-inv-idx="${i}" title="${m.name}: ${m.desc||''}"
          style="border-color:${col};cursor:grab">
          <img src="${icon}" class="binv-icon" draggable="false">
          <div class="binv-name">${m.name}</div>
          <div class="binv-slot" style="color:${col}">${(m.slot||'').toUpperCase()}</div>
        </div>`;
      }).join('') : `<div style="font-size:6px;color:#556677;padding:8px">No modules in storage.</div>`;
      invPanel = `<div id="builder-inv-panel">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-size:6px;color:#aaccdd">INVENTORY — ${inv.length} MODULE${inv.length!==1?'S':''}</div>
          <button class="btn" style="font-size:5px;padding:2px 6px" onclick="G.ui.builderToggleInv()">CLOSE ✕</button>
        </div>
        <div style="font-size:5px;color:#556677;margin-bottom:8px">Drag a module onto a grid cell to install it.</div>
        <div class="binv-grid">${items}</div>
      </div>`;
    }

    return `<style>
      .builder-root{position:relative;width:100%;height:100%;min-height:420px}
      .builder-hex{display:block;width:100%;aspect-ratio:1/1;max-height:78vh;margin:0 auto;image-rendering:pixelated;cursor:pointer;touch-action:none}
      .builder-card{position:absolute;top:0;right:0;width:155px;background:rgba(8,20,30,0.97);border:1px solid #1a4a6a;border-radius:4px;padding:8px;z-index:5}
      .builder-picker{position:absolute;inset:0;background:rgba(2,8,14,0.94);border:1px solid #1a4a6a;border-radius:4px;padding:14px;overflow:auto;z-index:10}
      #builder-inv-panel{position:absolute;top:0;right:0;width:44%;height:100%;overflow-y:auto;background:rgba(3,10,18,0.97);border:1px solid #1a4a6a;border-radius:4px;padding:10px;z-index:6;box-sizing:border-box}
      #builder-inv-panel.drag-transparent{pointer-events:none}
      .binv-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}
      .binv-item{background:#0a1722;border:1px solid #1a3a5a;border-radius:3px;padding:4px 2px;display:flex;flex-direction:column;align-items:center;gap:2px;user-select:none}
      .binv-item:hover{filter:brightness(1.3)}
      .binv-icon{width:32px;height:32px;image-rendering:pixelated;pointer-events:none}
      .binv-name{font-size:4px;color:#aabbcc;text-align:center;line-height:1.2;pointer-events:none}
      .binv-slot{font-size:4px;text-align:center;pointer-events:none}
      .hull-color-swatch{width:14px;height:14px;border-radius:2px;cursor:pointer;border:1px solid #444;box-sizing:border-box;display:inline-block}
      .hull-color-swatch:hover{transform:scale(1.2)}
    </style>
    <div class="panel-title">SHIP BUILDER — ${p.name.toUpperCase()} &nbsp;<span style="font-size:6px;color:${flyCol}">${flyTxt}</span> &nbsp;<span style="font-size:6px;color:#66aacc">${used} MODULE${used!==1?'S':''}</span> &nbsp;<span style="font-size:6px;color:#667799">${hullCount} HULL</span> &nbsp;<span style="font-size:6px;color:${energyCol}">ENERGY: +${totalEnergyRegen.toFixed(0)}/-${totalEnergyDraw.toFixed(1)}</span>
      &nbsp;<button class="btn" style="font-size:5px;padding:2px 8px;margin-left:8px" onclick="G.ui.builderToggleInv()">${invOpen?'CLOSE INV':'INVENTORY ('+inv.length+')'}</button>
    </div>
    <div style="font-size:5px;color:#66aacc;margin:2px 0 6px">Click a module to select (rotate/remove). Click a hull-edge hex to recolor or install. Drag a module to move it. ${invOpen?'Drag from inventory onto a hull hex to install.':''}</div>
    ${(()=>{
      const louts = this._getLoadouts();
      const btns = louts.map((l,i) =>
        `<span style="display:inline-flex;align-items:center;gap:1px;background:#0a1a2a;border:1px solid #1a4a6a;border-radius:2px;padding:1px 3px">
          <button class="btn" style="font-size:4px;padding:1px 4px;border:none;color:#aaccdd" onclick="G.ui.builderLoadLoadout(${i})">${l.name}</button>
          <button class="btn" style="font-size:4px;padding:1px 3px;border:none;color:#ff4444" onclick="G.ui.builderDeleteLoadout(${i})">✕</button>
        </span>`
      ).join('');
      return `<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin-bottom:6px;padding:4px 0;border-bottom:1px solid #1a3a5a">
        <span style="font-size:5px;color:#556677">LOADOUTS:</span>
        ${btns}
        <button class="btn" style="font-size:4px;padding:2px 6px;border-color:#44ffaa;color:#44ffaa" onclick="G.ui.builderSaveLoadout()">+ SAVE</button>
      </div>`;
    })()}
    <div id="builder-root" class="builder-root">
      <canvas id="builder-hex" class="builder-hex"></canvas>
      <div id="builder-card" class="builder-card" style="${cardStyle}">${cardHtml}</div>
      ${picker}${invPanel}
    </div>`;
  }

  _bindShipBuilder(){
    const root = document.getElementById('builder-root');
    const canvas = document.getElementById('builder-hex');
    if(!root || !canvas) return;

    // Pointer down on the hex canvas — begin a potential drag of a module.
    canvas.addEventListener('mousedown', e=>{
      if(e.button !== 0) return;
      const hex = this._builderHitHex(e.clientX, e.clientY);
      const inst = hex && this._builderInstAt(hex);
      if(inst) {
        const mod = G.MODULES[inst.id_mod] || G.WEAPONS[inst.id_mod];
        const movable = mod && mod.slot !== 'core' && mod.slot !== 'hull';
        this._builderDrag = movable
          ? { source:'canvas', instId: inst.id, startX:e.clientX, startY:e.clientY, active:false, ghost:null }
          : null;
      } else this._builderDrag = null;
      e.preventDefault();
    });

    // Click selects a hex (module → controls; hull → recolor/install; empty → deselect).
    canvas.addEventListener('click', e=>{
      if(this._builderDragJustEnded) { this._builderDragJustEnded = false; return; }
      const hex = this._builderHitHex(e.clientX, e.clientY);
      const inst = hex && this._builderInstAt(hex);
      if(inst) this.builderSelect(inst.id);
      else this.builderDeselect();
    });

    // Drag init on mousedown — inventory items
    const invPanel = document.getElementById('builder-inv-panel');
    if(invPanel) {
      invPanel.addEventListener('mousedown', e=>{
        if(e.button !== 0) return;
        const item = e.target.closest('.binv-item');
        if(!item) return;
        const invIdx = +item.dataset.invIdx;
        const p = G.game.player;
        const modId = (p.moduleInventory||[])[invIdx];
        if(modId == null) return;
        this._builderDrag = { source:'inventory', invIdx, modId, startX: e.clientX, startY: e.clientY, active: false, ghost: null };
        e.preventDefault();
      });
    }

    this._initBuilderDragHandlers();
    setTimeout(() => this._startBuilderCrewAnim(), 30);
  }

  // Map client coords → axial hex using the last drawn builder view transform.
  _builderHitHex(clientX, clientY) {
    const v = this._builderView, canvas = document.getElementById('builder-hex');
    if(!v || !canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if(!rect.width) return null;
    const sx = (clientX - rect.left) * (canvas.width / rect.width);
    const sy = (clientY - rect.top)  * (canvas.height / rect.height);
    return G.pixelToHex((sx - v.cx) / v.BR, (sy - v.cy) / v.BR, 1);
  }

  // Find the installed module instance occupying a hex; returns {id, id_mod} or null.
  _builderInstAt(hex) {
    const p = G.game?.player; if(!p) return null;
    for(const [id, inst] of Object.entries(p.modules))
      if(inst.q === hex.q && inst.r === hex.r) return { id, id_mod: inst.moduleId, inst };
    return null;
  }

  _initBuilderDragHandlers() {
    if(this._builderDragBound) return;
    this._builderDragBound = true;

    document.addEventListener('mousemove', e=>{
      const d = this._builderDrag;
      if(!d) return;
      if(!d.active && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 5) {
        d.active = true;
        const p = G.game.player;
        let mod;
        if(d.source === 'inventory') {
          mod = G.MODULES[d.modId] || G.WEAPONS[d.modId];
          document.getElementById('builder-inv-panel')?.classList.add('drag-transparent');
        } else {
          const inst = p?.modules[d.instId];
          mod = inst && (G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId]);
        }
        const col = G.SLOT_RING[mod?.slot]?.color || '#33556a';
        const ghost = document.createElement('div');
        ghost.id = 'builder-drag-ghost';
        ghost.style.cssText = `position:fixed;pointer-events:none;z-index:9999;width:32px;height:32px;border:2px solid ${col};border-radius:3px;background:#0a1722;display:flex;align-items:center;justify-content:center;opacity:0.85;transform:translate(-50%,-50%)`;
        ghost.innerHTML = `<img src="${this._modIconURL(mod?.visual||mod?.slot)}" style="width:74%;height:74%;image-rendering:pixelated" draggable="false">`;
        document.body.appendChild(ghost);
        d.ghost = ghost;
      }
      if(d.active && d.ghost) { d.ghost.style.left = e.clientX+'px'; d.ghost.style.top = e.clientY+'px'; }
    });

    document.addEventListener('mouseup', e=>{
      const d = this._builderDrag;
      if(!d) return;
      this._builderDrag = null;
      if(!d.active) return;
      document.getElementById('builder-inv-panel')?.classList.remove('drag-transparent');
      if(d.ghost) { d.ghost.remove(); d.ghost = null; }
      this._builderDragJustEnded = true;

      const hex = this._builderHitHex(e.clientX, e.clientY);
      const targetInst = hex && this._builderInstAt(hex);
      const targetMod = targetInst && (G.MODULES[targetInst.id_mod] || G.WEAPONS[targetInst.id_mod]);
      if(!hex || !targetInst) { this._builderDragJustEnded = false; return; }

      if(d.source === 'inventory') {
        // Install onto a hull (perimeter) hex.
        if(targetMod?.slot === 'hull') { this.builderInstallFromInv(d.invIdx, hex); return; }
      } else {
        const p = G.game.player;
        const dragged = p?.modules[d.instId];
        if(dragged) {
          if(targetInst.id === d.instId) { this._builderDragJustEnded = false; return; }
          if(targetMod?.slot === 'hull') {
            const draggedMod = G.MODULES[dragged.moduleId] || G.WEAPONS[dragged.moduleId];
            if(draggedMod?.slot === 'thruster') {
              // Thrusters must go outside the hull ring — find nearest outer cell.
              const occ = new Set(Object.values(p.modules).filter(i => i.q != null && i !== dragged).map(i => G.hexKey(i.q, i.r)));
              const outerNbs = G.hexNeighbors(hex.q, hex.r).filter(nb => !occ.has(G.hexKey(nb.q, nb.r)));
              outerNbs.sort((a, b) => G.hexDist(0, 0, b.q, b.r) - G.hexDist(0, 0, a.q, a.r));
              if(outerNbs[0]) { dragged.q = outerNbs[0].q; dragged.r = outerNbs[0].r; }
            } else {
              // Move dragged module onto the perimeter hex.
              dragged.q = hex.q; dragged.r = hex.r;
            }
            this.renderSpaceportTab('builder'); return;
          } else if(targetMod?.slot !== 'core') {
            const draggedMod = G.MODULES[dragged.moduleId] || G.WEAPONS[dragged.moduleId];
            // Thrusters must stay outside hull; only allow swapping thruster↔thruster.
            if((draggedMod?.slot === 'thruster') !== (targetMod?.slot === 'thruster')) {
              this._builderDragJustEnded = false; return;
            }
            // Swap two modules.
            const ti = targetInst.inst;
            const tq = dragged.q, tr = dragged.r;
            dragged.q = ti.q; dragged.r = ti.r; ti.q = tq; ti.r = tr;
            this.renderSpaceportTab('builder'); return;
          }
        }
      }
      this._builderDragJustEnded = false;
    });
  }

  _startBuilderCrewAnim() {
    this._stopBuilderCrewAnim();
    let last = performance.now();
    const step = (now) => {
      const canvas = document.getElementById('builder-hex');
      if(!canvas) { this._crewRaf = null; return; }
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if(G.game?.player) G.game._updateCrewPositions(dt, G.game.player);
      this._drawBuilderCanvas(canvas);
      this._crewRaf = requestAnimationFrame(step);
    };
    this._crewRaf = requestAnimationFrame(step);
  }

  _stopBuilderCrewAnim() {
    if(this._crewRaf) { cancelAnimationFrame(this._crewRaf); this._crewRaf = null; }
  }

  // Render the player's hex module assembly on the builder canvas, plus crew.
  _drawBuilderCanvas(canvas) {
    const p = G.game?.player;
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(1, rect.width | 0), H = Math.max(1, rect.height | 0);
    if(canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    if(!p?.modules) { this._builderView = null; return; }

    const mods = [];
    let umnx=Infinity,umxx=-Infinity,umny=Infinity,umxy=-Infinity;
    for(const [id, inst] of Object.entries(p.modules)) {
      if(inst.q == null) continue;
      const u = G.hexToPixel(inst.q, inst.r, 1);
      if(u.x<umnx)umnx=u.x; if(u.x>umxx)umxx=u.x; if(u.y<umny)umny=u.y; if(u.y>umxy)umxy=u.y;
      mods.push({ id, inst, u });
    }
    if(!mods.length) { this._builderView = null; return; }

    const pad = 26;
    const BR = Math.max(6, Math.min((W - pad) / ((umxx - umnx) + 2.2), (H - pad) / ((umxy - umny) + 2.2)));
    const cx = W / 2 - ((umnx + umxx) / 2) * BR;
    const cy = H / 2 - ((umny + umxy) / 2) * BR;
    this._builderView = { BR, cx, cy };
    const T = BR * 2;

    for(const pass of [0, 1]) {
      for(const { id, inst, u } of mods) {
        const mod = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
        const isHull = mod?.slot === 'hull';
        if((pass === 0) !== isHull) continue;
        if(inst.broken) continue;
        const px = cx + u.x * BR, py = cy + u.y * BR;
        let tile;
        if(isHull) tile = G.Sprites.getHexTile('hull', inst.color || '#667799', false);
        else {
          const slotCol = G.SLOT_RING[mod?.slot]?.color || '#334455';
          const visual = mod?.visual || (G.WEAPONS[inst.moduleId] ? 'weapon' : 'special');
          tile = G.Sprites.getHexTile(visual, slotCol, inst.broken);
        }
        const rot = isHull ? 0 : (inst.rot || 0) % 4;
        if(rot) {
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(rot * Math.PI / 2);
          ctx.drawImage(tile, -BR, -BR, T, T);
          ctx.restore();
        } else {
          ctx.drawImage(tile, (px - BR) | 0, (py - BR) | 0, T, T);
        }
        // Selection outline
        if(this._builderSel === id) {
          ctx.beginPath();
          for(let k=0;k<6;k++){ const a=Math.PI/180*(60*k-90); const vx=px+BR*Math.cos(a), vy=py+BR*Math.sin(a); k?ctx.lineTo(vx,vy):ctx.moveTo(vx,vy); }
          ctx.closePath();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
        }
      }
    }

    // Crew sprites (positions are unit hex-pixels)
    if(p.crew?.length) {
      const sz = Math.max(8, (BR * 0.9) | 0);
      for(const c of p.crew) {
        const st = G.CrewAnim._s.get(c.id);
        if(!st) continue;
        const sx = (cx + st.gx * BR - sz / 2) | 0;
        const sy = (cy + st.gy * BR - sz / 2) | 0;
        ctx.drawImage(G.Sprites.getCrewSprite(G.crewColor(c), st.walkFrame, c.role === 'pilot'), sx, sy, sz, sz);
      }
    }
  }

  _startInventoryCrewAnim() {
    this._stopInventoryCrewAnim();
    let last = performance.now();
    const step = (now) => {
      const canvas = document.getElementById('inv-crew-canvas');
      if(!canvas) { this._invCrewRaf = null; return; }
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const player = G.game?.player;
      if(player) G.game._updateCrewPositions(dt, player);
      this._drawHexMini(canvas, player);
      this._invCrewRaf = requestAnimationFrame(step);
    };
    this._invCrewRaf = requestAnimationFrame(step);
  }

  // Draw a small fixed-size hex assembly + crew into a canvas (cargo tab preview).
  _drawHexMini(canvas, player) {
    const W = canvas.width, H = canvas.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    if(!player?.modules) return;
    const mods = [];
    let umnx=Infinity,umxx=-Infinity,umny=Infinity,umxy=-Infinity;
    for(const [, inst] of Object.entries(player.modules)) {
      if(inst.q == null) continue;
      const u = G.hexToPixel(inst.q, inst.r, 1);
      if(u.x<umnx)umnx=u.x; if(u.x>umxx)umxx=u.x; if(u.y<umny)umny=u.y; if(u.y>umxy)umxy=u.y;
      mods.push({ inst, u });
    }
    if(!mods.length) { this._invHexView = null; return; }
    const BR = Math.max(3, Math.min((W - 8) / ((umxx - umnx) + 2.0), (H - 8) / ((umxy - umny) + 2.0)));
    const cx = W / 2 - ((umnx + umxx) / 2) * BR, cy = H / 2 - ((umny + umxy) / 2) * BR, T = BR * 2.05;
    this._invHexView = { BR, cx, cy };
    for(const pass of [0, 1]) {
      for(const { inst, u } of mods) {
        const mod = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
        const isHull = mod?.slot === 'hull';
        if((pass === 0) !== isHull) continue;
        if(inst.broken) continue;
        let tile;
        if(isHull) tile = G.Sprites.getHexTile('hull', inst.color || '#667799', false);
        else tile = G.Sprites.getHexTile(mod?.visual || (G.WEAPONS[inst.moduleId] ? 'weapon' : 'special'), G.SLOT_RING[mod?.slot]?.color || '#334455', inst.broken);
        const rot = isHull ? 0 : (inst.rot || 0) % 4;
        if(rot) {
          ctx.save();
          ctx.translate(cx + u.x*BR, cy + u.y*BR);
          ctx.rotate(rot * Math.PI / 2);
          ctx.drawImage(tile, -BR, -BR, T, T);
          ctx.restore();
        } else {
          ctx.drawImage(tile, (cx + u.x*BR - BR)|0, (cy + u.y*BR - BR)|0, T, T);
        }
      }
    }
    if(player.crew?.length) {
      const sz = Math.max(6, (BR * 0.9) | 0);
      for(const c of player.crew) {
        const st = G.CrewAnim._s.get(c.id); if(!st) continue;
        ctx.drawImage(G.Sprites.getCrewSprite(G.crewColor(c), st.walkFrame, c.role === 'pilot'),
          (cx + st.gx*BR - sz/2)|0, (cy + st.gy*BR - sz/2)|0, sz, sz);
      }
    }
  }

  _stopInventoryCrewAnim() {
    if(this._invCrewRaf) { cancelAnimationFrame(this._invCrewRaf); this._invCrewRaf = null; }
  }

  _showBuilderCard(instId, withControls){
    if(this._builderSel) return; // don't override while a cell is selected (protects color/shape controls)
    const el = document.getElementById('builder-card');
    if(!el) return;
    el.innerHTML = this._builderCardHTML(instId, withControls);
    el.style.display = '';
  }

  _restoreBuilderCard(){
    const el = document.getElementById('builder-card');
    if(!el) return;
    if(this._builderSel){ el.innerHTML = this._builderCardHTML(this._builderSel, true); el.style.display = ''; }
    else { el.style.display = 'none'; }
  }

  builderSelect(instId){
    this._builderSel = instId;
    this._builderPickCell = null;
    this.renderSpaceportTab('builder');
  }

  builderDeselect(){
    if(this._builderSel == null && this._builderPickCell == null) return;
    this._builderSel = null;
    this._builderPickCell = null;
    this.renderSpaceportTab('builder');
  }

  builderRotate(dir){
    if(!this._builderSel) return;
    const inst = G.game.player.modules[this._builderSel];
    if(!inst) return;
    const mod = G.MODULES[inst.moduleId];
    if(mod?.slot === 'hull') return; // hexes are symmetric — hull rotation is a no-op
    G.game.player.rotateModule(this._builderSel, dir);
    this.renderSpaceportTab('builder');
  }

  builderSetHullColor(instId, color){
    const inst = G.game.player.modules[instId];
    if(!inst) return;
    inst.color = color;
    this._builderSel = instId;
    this.renderSpaceportTab('builder');
  }

  builderSetHullColorRGB(instId, r, g, b){
    const inst = G.game.player.modules[instId];
    if(!inst) return;
    const rVal = Math.max(0, Math.min(255, parseInt(r)||0));
    const gVal = Math.max(0, Math.min(255, parseInt(g)||0));
    const bVal = Math.max(0, Math.min(255, parseInt(b)||0));
    inst.color = '#' + [rVal, gVal, bVal].map(x => x.toString(16).padStart(2,'0')).join('');
    this._builderSel = instId;
    this.renderSpaceportTab('builder');
  }

  _updateRgbDisplay(input, rgbId){
    const ch = input.dataset.ch;
    const val = parseInt(input.value);
    const el = document.getElementById(`${rgbId}_${ch}`);
    if(el) el.textContent = val;
  }

  _finalizeRgbSlider(input, instId){
    const rgbId = input.dataset.rgb;
    const rVal = parseInt(document.querySelector(`[data-rgb="${rgbId}"][data-ch="r"]`)?.value || 0);
    const gVal = parseInt(document.querySelector(`[data-rgb="${rgbId}"][data-ch="g"]`)?.value || 0);
    const bVal = parseInt(document.querySelector(`[data-rgb="${rgbId}"][data-ch="b"]`)?.value || 0);
    this.builderSetHullColorRGB(instId, rVal, gVal, bVal);
  }

  _hexToRgb(hex){
    const h = hex.replace('#','');
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  }

  // Open the install picker for the hull (perimeter) hex currently selected.
  builderOpenPickerHere(instId){
    const inst = G.game.player.modules[instId];
    if(!inst || inst.q == null) return;
    this._builderPickCell = { q: inst.q, r: inst.r };
    this._builderSel = null;
    this.renderSpaceportTab('builder');
  }

  builderClosePicker(){
    this._builderPickCell = null;
    this.renderSpaceportTab('builder');
  }

  builderToggleInv(){
    this._builderInvOpen = !this._builderInvOpen;
    this._builderPickCell = null;
    this.renderSpaceportTab('builder');
  }

  // ── Loadout save/load ─────────────────────────────────────
  _getLoadouts() {
    try { return JSON.parse(localStorage.getItem('nullpunkt_loadouts') || '[]'); } catch { return []; }
  }
  _saveLoadoutsData(arr) {
    localStorage.setItem('nullpunkt_loadouts', JSON.stringify(arr));
  }
  builderSaveLoadout() {
    const name = window.prompt('Loadout name:', 'Loadout ' + (this._getLoadouts().length + 1));
    if(!name) return;
    const p = G.game.player;
    const loadouts = this._getLoadouts();
    loadouts.push({
      name,
      modules: JSON.parse(JSON.stringify(p.modules)),
      moduleInventory: [...(p.moduleInventory || [])],
      timestamp: Date.now(),
    });
    this._saveLoadoutsData(loadouts);
    this.renderSpaceportTab('builder');
    this.addMsg('Loadout "' + name + '" saved.', '#44ffaa');
  }
  builderLoadLoadout(idx) {
    const lout = this._getLoadouts()[idx];
    if(!lout) return;
    if(!window.confirm('Load "' + lout.name + '"? Current configuration will be replaced.')) return;
    const p = G.game.player;
    p.modules = JSON.parse(JSON.stringify(lout.modules));
    p.moduleInventory = [...(lout.moduleInventory || [])];
    p._recompute();
    this._ensureBuilderCells(p);
    this._builderSel = null;
    this.renderSpaceportTab('builder');
    this.addMsg('Loadout "' + lout.name + '" loaded.', '#44ffaa');
  }
  builderDeleteLoadout(idx) {
    const lout = this._getLoadouts()[idx];
    if(!lout) return;
    if(!window.confirm('Delete loadout "' + lout.name + '"?')) return;
    const arr = this._getLoadouts();
    arr.splice(idx, 1);
    this._saveLoadoutsData(arr);
    this.renderSpaceportTab('builder');
  }

  // Install a stored module at a hex {q,r} (a perimeter hull hex). The hull
  // panel there is regenerated by _ensureBuilderCells on the next render.
  builderInstallFromInv(invIdx, hex) {
    const p = G.game.player;
    const inv = p.moduleInventory || [];
    const modId = inv[invIdx];
    if(modId == null || !hex) return;
    const mod = G.MODULES[modId] || G.WEAPONS[modId];
    // Thrusters go outside hull ring — redirect to outer cell adjacent to hull hex.
    let target = hex;
    if(mod?.slot === 'thruster') {
      const occ = new Set(Object.values(p.modules).filter(i => i.q != null).map(i => G.hexKey(i.q, i.r)));
      const outerNbs = G.hexNeighbors(hex.q, hex.r).filter(nb => !occ.has(G.hexKey(nb.q, nb.r)));
      outerNbs.sort((a, b) => G.hexDist(0, 0, b.q, b.r) - G.hexDist(0, 0, a.q, a.r));
      if(!outerNbs[0]) { this.addMsg('No room for thruster outside hull', '#ff4444'); return; }
      target = outerNbs[0];
    }
    const instId = p.installModule(modId);
    if(instId){
      p.modules[instId].q = target.q; p.modules[instId].r = target.r;
      inv.splice(invIdx, 1);
      this._builderSel = instId;
      this.addMsg('Installed '+mod?.name, '#44ff44');
      this.renderSpaceportTab('builder');
    } else {
      this.addMsg('Cannot install','#ff4444');
    }
  }

  builderPlace(invIdx){
    const p = G.game.player;
    const hex = this._builderPickCell;
    if(hex == null) return;
    const inv = p.moduleInventory || [];
    const modId = inv[invIdx];
    if(modId == null) return;
    const mod = G.MODULES[modId] || G.WEAPONS[modId];
    // Thrusters go outside hull ring.
    let target = hex;
    if(mod?.slot === 'thruster') {
      const occ = new Set(Object.values(p.modules).filter(i => i.q != null).map(i => G.hexKey(i.q, i.r)));
      const outerNbs = G.hexNeighbors(hex.q, hex.r).filter(nb => !occ.has(G.hexKey(nb.q, nb.r)));
      outerNbs.sort((a, b) => G.hexDist(0, 0, b.q, b.r) - G.hexDist(0, 0, a.q, a.r));
      if(!outerNbs[0]) { this.addMsg('No room for thruster outside hull', '#ff4444'); return; }
      target = outerNbs[0];
    }
    const instId = p.installModule(modId);
    if(instId){
      p.modules[instId].q = target.q; p.modules[instId].r = target.r;
      inv.splice(invIdx, 1);
      this._builderPickCell = null;
      this._builderSel = instId;
      this.addMsg('Installed '+mod.name, '#44ff44');
      this.renderSpaceportTab('builder');
    } else {
      this.addMsg('Cannot install','#ff4444');
    }
  }

  builderRemove(){
    const p = G.game.player;
    const instId = this._builderSel;
    const inst = instId ? p.modules[instId] : null;
    if(!inst) return;
    const mod = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
    if(!p.canRemoveModule(instId)){
      const reason = 'Class core module required';
      this.addMsg(reason+' — cannot remove','#ff8844'); return;
    }
    p.removeModule(instId);
    if(!p.moduleInventory) p.moduleInventory = [];
    p.moduleInventory.push(inst.moduleId);
    this._builderSel = null;
    this.addMsg('Removed '+(mod?.name||'module')+' to storage','#ffcc00');
    this.renderSpaceportTab('builder');
  }

  builderRepairModule(instId) {
    const p = G.game.player;
    const inst = p.modules[instId];
    if(!inst || !inst.broken) return;
    const mod = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
    const cost = Math.ceil((mod?.price || 500) * 0.3);
    if(G.game.credits < cost) { this.addMsg('Not enough credits!','#ff4444'); return; }
    G.game.credits -= cost;
    inst.broken = false;
    inst.hp = mod?.hp || 50;
    p._recompute();
    this.addMsg('Repaired: '+(mod?.name||instId),'#44ff88');
    this.renderSpaceportTab('builder');
  }

  // ── Module Inventory (spaceport tab) ─────────────────────
  _buildModInventoryHTML() {
    const p = G.game.player;
    const tpl = G.SHIPS[p.templateId];
    if(!Array.isArray(p.slots)) p.slots = new Array(tpl.slots).fill(null);
    const inv = p.moduleInventory || [];
    let html = `<div class="panel-title">CARGO & MODULES</div>`;

    // Mini ship grid with crew walking
    if(p.crew?.length) {
      html += `<div style="position:relative;width:108px;height:108px;margin-bottom:10px;border:1px solid #1a3a5a;background:#010a14">
        <canvas id="inv-crew-canvas" width="108" height="108" style="image-rendering:pixelated;display:block"></canvas>
      </div>`;
    }

    // Cargo section
    html += `<div style="margin-bottom:15px">
      <div style="font-size:6px;color:#aaa;margin-bottom:5px">CARGO (${G.game.fleetCargoUsed()}/${G.game.fleetCargoSpace()}${G.game.fleet?.length?' [fleet]':''})</div>`;
    const cargoItems = Object.entries(p.cargo || {});
    if (!cargoItems.length) {
      html += `<div style="color:#556677;font-size:6px">No cargo items.</div>`;
    } else {
      for (const [itemId, qty] of cargoItems) {
        const item = G.ITEMS[itemId];
        if (!item) continue;
        html += `<div style="font-size:6px;padding:4px;border-bottom:1px solid #1a4a6a;display:flex;justify-content:space-between">
          <span>${item.name}</span>
          <span style="color:#88aacc">${qty}x</span>
        </div>`;
      }
    }
    html += `</div>`;

    // Module inventory section
    html += `<div style="font-size:6px;color:#aaa;margin-bottom:5px">MODULES (${inv.length} stored)</div>`;
    if (!inv.length) {
      html += `<div style="color:#556677;font-size:6px">No modules in inventory.<br><br>Buy or craft modules to store them here, then install them in the Ship Builder.</div>`;
    } else {
      html += `<div class="outfit-sale-grid">`;
      inv.forEach((modId, idx) => {
        const mod = G.MODULES[modId] || G.WEAPONS[modId];
        if (!mod) return;
        const actions = `
          <button class="btn btn-buy" style="margin-top:5px;font-size:5px;width:100%" data-inv-install="${idx}">INSTALL</button>
          <button class="btn" style="margin-top:3px;font-size:5px;width:100%;border-color:#ff6644;color:#ff6644" data-inv-drop="${idx}">DROP</button>`;
        html += `<div class="item-card outfit-sale-item">${this._modCardHTML(mod, actions)}</div>`;
      });
      html += `</div>`;
    }
    return html;
  }

  _bindModInventory() {
    if(G.game?.player?.crew?.length) this._startInventoryCrewAnim();
    document.querySelectorAll('[data-inv-install]').forEach(btn => {
      btn.addEventListener('click', () => this.installFromInventory(+btn.dataset.invInstall));
    });
    document.querySelectorAll('[data-inv-drop]').forEach(btn => {
      btn.addEventListener('click', () => this.dropFromInventory(+btn.dataset.invDrop));
    });
  }

  installFromInventory(idx) {
    const p = G.game.player;
    const modId = (p.moduleInventory||[])[idx];
    if (!modId) return;
    const mod = G.MODULES[modId] || G.WEAPONS[modId];
    const ok = p.installModule(modId);
    if (ok) {
      p.moduleInventory.splice(idx, 1);
      this.addMsg('Installed ' + mod.name, '#44ff44');
      this.renderSpaceportTab('inventory');
    }
  }

  dropFromInventory(idx) {
    const p = G.game.player;
    const modId = (p.moduleInventory||[])[idx];
    if (!modId) return;
    const mod = G.MODULES[modId] || G.WEAPONS[modId];
    p.moduleInventory.splice(idx, 1);
    this.addMsg('Dropped ' + (mod?.name||modId), '#ffcc44');
    this.renderSpaceportTab('inventory');
  }

  // ── Shipyard ─────────────────────────────────────────────
  _buildShipyardHTML(){
    const ships = G.game.economy.getShipyard(this._currentSysId);
    const p     = G.game.player;
    const oldShipDef = G.SHIPS[p.templateId];
    let modRefund = 0;
    for(const inst of Object.values(p.modules)){
      const mod = G.MODULES[inst.moduleId]||G.WEAPONS[inst.moduleId];
      modRefund += Math.floor((mod?.price||0)*0.4);
    }
    const hullRefund  = Math.floor((oldShipDef?.price||0)*0.4);
    const totalRefund = modRefund + hullRefund;
    const modCount    = Object.keys(p.modules).length;

    const tpl = oldShipDef || {};
    const shapeId = tpl.shape || 'shuttle';
    const shipColor = tpl.color || '#8899bb';
    const liveStats = `HULL:${Math.ceil(p.maxHull)}  SHIELD:${Math.ceil(p.maxShields)}  CARGO:${p.cargoSpace}  FUEL:${Math.ceil(p.maxFuel)}  ENERGY:${Math.ceil(p.maxEnergy)}  THRUST:${Math.round(p.thrustPower/1000)}k  TURN:${p.turnSpeed.toFixed(1)}${p.jumpRange>0?'  JUMP:'+p.jumpRange:''}`;
    const installedMods = Object.values(p.modules).map(inst=>{
      const m = G.MODULES[inst.moduleId]||G.WEAPONS[inst.moduleId];
      if(!m) return `<span style="color:#aabbcc">${inst.moduleId}</span>`;
      const isWeapon = m.slot==='weapon'||m.slot==='turret';
      return `<span style="color:${isWeapon?'#ffaa44':'#aabbcc'}">${m.name}</span>`;
    });
    const installedHTML = installedMods.length
      ? `<div style="font-size:6px;color:#556677;margin-top:3px">Modules: ${installedMods.join(', ')}</div>`
      : '';
    let html = `<div class="panel-title">SHIPYARD</div>
    <div class="section-title">YOUR SHIP</div>
    <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:10px;background:rgba(0,255,238,0.04);border:1px solid rgba(0,200,255,0.2);padding:8px">
      <div style="background:#000a18;flex-shrink:0;display:flex;align-items:center;justify-content:center;width:90px;height:72px">
        <canvas width="88" height="70" class="ship-preview" data-shipid="player"></canvas>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:8px;color:#00ffee;font-weight:bold;margin-bottom:4px">${p.name.toUpperCase()} <span style="color:#667;font-size:6px">${tpl.name||''}</span></div>
        <div class="item-stats">${liveStats}</div>
        <div style="font-size:6px;color:#556677;margin-top:4px">
          Hull ${Math.ceil(p.hull)}/${Math.ceil(p.maxHull)} &nbsp; Cargo ${G.game.fleetCargoSpace()}${G.game.fleet?.length?' [fleet]':''}
        </div>
        ${installedHTML}
        <div style="font-size:6px;color:#556677;margin-top:2px">
          Trade-in: <span style="color:#ffcc00">${G.fmtCredits(hullRefund)}</span> hull
          ${modCount?`+ <span style="color:#ffcc00">${G.fmtCredits(modRefund)}</span> modules`:''}
          = <span style="color:#00ffee">${G.fmtCredits(totalRefund)}</span>
        </div>
      </div>
    </div>`;

    // Group available ships by class, in defined order
    const classOrder = Object.keys(G.SHIP_CLASSES);
    const byClass    = {};
    for(const s of ships) {
      if(!s.class) continue;
      (byClass[s.class] = byClass[s.class]||[]).push(s);
    }

    for(const cls of classOrder) {
      const list = byClass[cls]; if(!list||!list.length) continue;
      const clsDef = G.SHIP_CLASSES[cls];
      html += `<div class="section-title" style="margin-top:10px">${clsDef.label}</div><div class="three-col">`;

      for(const ship of list){
        const isCurrent = ship.id === p.templateId;
        const shipFac   = ship.faction;
        const isNeutral = !shipFac || shipFac==='neutral'||shipFac==='independent';
        const repReq    = ship.repRequired || 0;
        const playerRep = isNeutral ? 999 : (G.game.getRel(shipFac)||0);
        const repOk     = playerRep >= repReq;
        const facDef    = G.FACTIONS[shipFac];
        const facColor  = facDef?.color || '#888888';
        const playerFac = G.game.playerFactionId;
        const factionOk = isNeutral || shipFac === playerFac;

        const netCost = ship.price - totalRefund;
        const canAfford = G.game.credits >= netCost;
        const canBuy    = repOk && factionOk && !isCurrent;
        const netLabel  = netCost <= 0
          ? `<span style="color:#44ff44">+${G.fmtCredits(-netCost)} back</span>`
          : `<span style="color:#ffcc00">Net: ${G.fmtCredits(netCost)}</span>`;

        let lockBadge = '';
        if(!factionOk) {
          lockBadge = `<div style="font-size:5px;color:#ff6644;margin:2px 0">FACTION LOCKED — ${facDef?.name||shipFac} only</div>`;
        } else if(!repOk) {
          lockBadge = `<div style="font-size:5px;color:#ff6644;margin:2px 0">LOCKED — Need ${repReq} rep with ${facDef?.name||shipFac}</div>`;
        }
        const facBadge  = isNeutral ? '' : `<span style="color:${facColor};font-size:5px">${(facDef?.name||shipFac).toUpperCase()}</span>`;
        const _cs = G.MODULES['core_'+ship.id]?.stats || {};
        const fullStats = `HULL:${_cs.maxHull||0}  CARGO:${_cs.cargoSpace||0}  FUEL:${_cs.maxFuel||0}  ENERGY:${_cs.maxEnergy||0}  THRUST:${Math.round(ship.baseThrust/1000)}k  TURN:${(_cs.turnBase||0).toFixed(1)}`;
        const startModNames = (ship.startModules||[]).map(id=>{
          const m=G.MODULES[id]; return m?`<span style="color:#aabbcc">${m.name}</span>`:id;
        });
        const startWepNames = (ship.startWeapons||[]).map(id=>{
          const w=G.WEAPONS[id]; return w?`<span style="color:#ffaa44">${w.name}</span>`:id;
        });
        const allStart=[...startWepNames,...startModNames];
        const startHTML=allStart.length?`<div style="font-size:5px;color:#556677;margin:3px 0;line-height:1.5">Comes with: ${allStart.join(', ')}</div>`:'';

        html += `<div class="item-card" style="${!repOk?'opacity:0.5':''}">
          <div class="item-name">${ship.name}</div>
          ${facBadge}
          <div style="width:100%;height:90px;background:#000a18;margin:4px 0;display:flex;align-items:center;justify-content:center">
            <canvas width="120" height="88" class="ship-preview" data-shipid="${ship.id}"></canvas>
          </div>
          <div class="item-stats">${fullStats}</div>
          ${startHTML}
          <div style="font-size:6px;color:#667;margin:2px 0">${ship.desc}</div>
          ${lockBadge}
          <div class="item-price">$ ${G.fmt(ship.price)}</div>
          <div style="font-size:6px;margin-top:2px">${isCurrent?'<span style="color:#00ffee">CURRENT SHIP</span>':netLabel}</div>
          <button class="btn btn-buy" style="margin-top:4px" data-buyship="${ship.id}"
            ${canBuy&&canAfford?'':'disabled style="opacity:0.35"'}>
            ${!repOk?'LOCKED':isCurrent?'OWNED':'BUY'}</button>
        </div>`;
      }
      html += '</div>';
    }
    return html;
  }

  _drawShipPreviews(){
    const p = G.game?.player;
    document.querySelectorAll('.ship-preview').forEach(canvas=>{
      const ctx = canvas.getContext('2d');
      const cw = canvas.width || 120, ch = canvas.height || 88;
      ctx.clearRect(0, 0, cw, ch);
      ctx.fillStyle = '#000a18'; ctx.fillRect(0, 0, cw, ch);
      ctx.imageSmoothingEnabled = false;

      const shipId = canvas.dataset.shipid;
      const entries = (shipId === 'player' && p)
        ? G.game.renderer?._playerTileEntries(p) || []
        : G.hexLayoutForTemplate(shipId) || [];
      if(!entries.length) return;

      // Compute bounding box of hex centers in unit pixel space
      let mnx=Infinity,mxx=-Infinity,mny=Infinity,mxy=-Infinity;
      for(const e of entries) {
        const u = G.hexToPixel(e.q, e.r, 1);
        if(u.x<mnx)mnx=u.x; if(u.x>mxx)mxx=u.x;
        if(u.y<mny)mny=u.y; if(u.y>mxy)mxy=u.y;
      }
      const pad = 4;
      const BR = Math.max(3, Math.min(
        (cw - pad) / ((mxx - mnx) + 2.2),
        (ch - pad) / ((mxy - mny) + 2.2)
      ));
      const cx = cw/2 - ((mnx+mxx)/2)*BR;
      const cy = ch/2 - ((mny+mxy)/2)*BR;
      const T = BR * 2;

      for(const pass of [0, 1]) {
        for(const e of entries) {
          const isHull = e.slot === 'hull';
          if((pass === 0) !== isHull) continue;
          if(e.broken) continue;
          const u = G.hexToPixel(e.q, e.r, 1);
          const px = cx + u.x * BR, py = cy + u.y * BR;
          let tile;
          if(isHull) tile = G.Sprites.getHexTile('hull', e.color || '#667799', false);
          else {
            const slotCol = G.SLOT_RING[e.slot]?.color || '#334455';
            tile = G.Sprites.getHexTile(e.visual || 'special', slotCol, e.broken || false);
          }
          const erot = isHull ? 0 : (e.rot || 0) % 4;
          if(erot) {
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(erot * Math.PI / 2);
            ctx.drawImage(tile, -BR, -BR, T, T);
            ctx.restore();
          } else {
            ctx.drawImage(tile, (px - BR)|0, (py - BR)|0, T, T);
          }
        }
      }
    });
  }

  _bindShipyard(){
    document.querySelectorAll('[data-buyship]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const shipId=btn.dataset.buyship, ship=G.SHIPS[shipId];
        if(!ship||ship.price<=0) return;
        const p=G.game.player;
        const oldShipDef=G.SHIPS[p.templateId];
        let modRefund=0;
        for(const inst of Object.values(p.modules)){
          const mod=G.MODULES[inst.moduleId]||G.WEAPONS[inst.moduleId];
          modRefund+=Math.floor((mod?.price||0)*0.4);
        }
        const hullRefund=Math.floor((oldShipDef?.price||0)*0.4);
        const netCost=ship.price-modRefund-hullRefund;
        if(G.game.credits<netCost){this.addMsg('Not enough credits!','#ff4444');return;}
        const modCount=Object.keys(p.modules).length;
        const confirmMsg='Buy '+ship.name+' for '+G.fmtCredits(ship.price)+'?'
          +(modCount?'\n'+modCount+' modules stripped (+'+G.fmtCredits(modRefund)+')'  :'')
          +'\nShip trade-in: +'+G.fmtCredits(hullRefund)
          +'\nNet cost: '+(netCost<=0?G.fmtCredits(-netCost)+' back':G.fmtCredits(netCost))
          +'\nCargo and crew will transfer.';
        if(confirm(confirmMsg)){
          const oldCargo={...p.cargo}, oldCrew=[...p.crew];
          G.game.credits+=hullRefund+modRefund;
          G.game.credits-=ship.price;
          G.game.player=new G.Ship(shipId);
          G.game.player.crew=[]; // old crew replaces starting crew
          for(const[id,qty]of Object.entries(oldCargo)) if(G.ITEMS[id]?.cat!=='mission') G.game.player.addCargo(id,qty);
          for(const c of oldCrew.slice(0,G.game.player.maxCrew)) G.game.player.crew.push(c);
          this.addMsg('Purchased '+ship.name+'!'+(modCount?' All modules sold.':''),'#00ffee');
          this.renderSpaceportTab('shipyard');
        }
      });
    });
  }

  // ── Crew ─────────────────────────────────────────────────
  _buildCrewHTML(){
    const p=G.game.player, available=G.game.economy.getCrew(this._currentSysId);
    let html=`<div class="panel-title">CREW MANAGEMENT</div>
    <div class="section-title">CURRENT CREW (${p.crew.length}/${p.maxCrew})</div><div class="three-col" id="crew-list">`;
    if(!p.crew.length) html+='<div style="color:#556677;font-size:7px">No crew hired</div>';
    for(const c of p.crew){
      html+=`<div class="item-card crew-card" draggable="true" data-crew-id="${c.id}"><div class="item-name">${c.name}</div>
      <div class="item-stats">Role: ${c.roleName}<br>Skill: ${'★'.repeat(c.skill)}<br>Wage: ${G.fmtCredits(c.wage)}/jump<br>${c.desc}</div>
      <button class="btn btn-sell" data-firecrew="${c.id}">DISMISS</button></div>`;
    }
    html+=`</div><div class="section-title">FOR HIRE</div><div class="three-col">`;
    for(const c of available){
      const ok=G.game.credits>=c.hireCost&&p.crew.length<p.maxCrew;
      html+=`<div class="item-card"><div class="item-name">${c.name}</div>
      <div class="item-stats">Role: ${c.roleName}<br>Skill: ${'★'.repeat(c.skill)}<br>Hire: ${G.fmtCredits(c.hireCost)}<br>Wage: ${G.fmtCredits(c.wage)}/jump<br>${c.desc}</div>
      <button class="btn btn-buy" ${ok?'':'disabled style="opacity:0.3"'} data-hirecrew='${JSON.stringify(c)}'>HIRE</button></div>`;
    }
    return html+'</div>';
  }

  _bindCrew(){
    this._draggedCrewId = null;
    document.querySelectorAll('[data-firecrew]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const idx=G.game.player.crew.findIndex(c=>c.id===btn.dataset.firecrew);
        if(idx>=0){G.game.player.crew.splice(idx,1);G.game.player._recompute();}
        this.renderSpaceportTab('crew');
      });
    });
    document.querySelectorAll('[data-hirecrew]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        try{
          const c=JSON.parse(btn.dataset.hirecrew);
          if(G.game.credits<c.hireCost){this.addMsg('Not enough credits!','#ff4444');return;}
          if(G.game.player.crew.length>=G.game.player.maxCrew){this.addMsg('No crew capacity!','#ff4444');return;}
          G.game.credits-=c.hireCost; G.game.player.crew.push(c); G.game.player._recompute();
          this.addMsg('Hired '+c.name,'#44ff44'); this.renderSpaceportTab('crew');
        }catch(e){}
      });
    });
    document.querySelectorAll('.crew-card').forEach(card=>{
      card.addEventListener('dragstart',e=>{
        this._draggedCrewId=card.dataset.crewId;
        card.classList.add('dragging');
      });
      card.addEventListener('dragend',e=>{
        card.classList.remove('dragging');
        document.querySelectorAll('.crew-card').forEach(c=>c.classList.remove('drag-over'));
        this._draggedCrewId=null;
      });
      card.addEventListener('dragover',e=>{
        e.preventDefault();
        if(this._draggedCrewId && this._draggedCrewId!==card.dataset.crewId){
          card.classList.add('drag-over');
        }
      });
      card.addEventListener('dragleave',e=>{
        card.classList.remove('drag-over');
      });
      card.addEventListener('drop',e=>{
        e.preventDefault();
        e.stopPropagation();
        if(this._draggedCrewId && this._draggedCrewId!==card.dataset.crewId){
          const from=G.game.player.crew.findIndex(c=>c.id===this._draggedCrewId);
          const to=G.game.player.crew.findIndex(c=>c.id===card.dataset.crewId);
          if(from>=0 && to>=0){
            [G.game.player.crew[from],G.game.player.crew[to]]=[G.game.player.crew[to],G.game.player.crew[from]];
            this.renderSpaceportTab('crew');
          }
        }
      });
    });
  }

  // ── Repair ───────────────────────────────────────────────
  _buildRepairHTML(){
    const p=G.game.player;
    const modDmg=Math.ceil(p.moduleDamage());
    const hCost=Math.ceil(modDmg*5), sCost=Math.ceil((p.maxShields-p.shields)*3);
    const fCost=Math.ceil((p.maxFuel-p.fuel)*2);
    const broken=Object.entries(p.modules).filter(([,inst])=>inst.broken);
    let html=`<div class="panel-title">REPAIR BAY</div>
    <div class="two-col">
    <div class="item-card"><div class="item-name">Full Repair</div>
      <div class="item-stats">Module damage: ${modDmg} HP — Cost: ${G.fmtCredits(hCost)}</div>
      <button class="btn btn-buy" id="rep-hull" ${(modDmg>0||broken.length)?'':'disabled style="opacity:0.3"'}>REPAIR ALL</button>
    </div>
    <div class="item-card"><div class="item-name">Refuel</div>
      <div class="item-stats">Need: ${Math.ceil(p.maxFuel-p.fuel)} — Cost: ${G.fmtCredits(fCost)}</div>
      <button class="btn btn-buy" id="rep-fuel" ${p.fuel<p.maxFuel?'':'disabled style="opacity:0.3"'}>REFUEL</button>
    </div>
    ${p.maxShields>0?`<div class="item-card"><div class="item-name">Shield Recharge</div>
      <div class="item-stats">Depleted: ${Math.ceil(p.maxShields-p.shields)} — Cost: ${G.fmtCredits(sCost)}</div>
      <button class="btn btn-buy" id="rep-shld" ${p.shields<p.maxShields?'':'disabled style="opacity:0.3"'}>RECHARGE</button>
    </div>`:''}
    </div>`;
    if(broken.length){
      html+=`<div class="section-title">BROKEN MODULES</div><div class="two-col">`;
      for(const[instId,inst]of broken){
        const mod=G.MODULES[inst.moduleId]||G.WEAPONS[inst.moduleId];
        const cost=Math.ceil((mod?.price||500)*0.3);
        html+=`<div class="item-card"><div class="item-name" style="color:#ff4444">${mod?.name||inst.moduleId}</div>
        <div class="item-stats">Repair cost: ${G.fmtCredits(cost)}</div>
        <button class="btn btn-buy" ${G.game.credits>=cost?'':'disabled style="opacity:0.3"'} data-repmod="${instId}">REPAIR</button></div>`;
      }
      html+='</div>';
    }
    const damagedEscorts = (G.game.fleet || []).filter(e => e.ship && e.ship.moduleDamage() > 0);
    if(damagedEscorts.length){
      html+=`<div class="section-title">ESCORT REPAIRS</div><div class="two-col">`;
      for(const entry of damagedEscorts){
        const damage = Math.ceil(entry.ship.moduleDamage());
        const cost = Math.ceil(damage * 5);
        html+=`<div class="item-card"><div class="item-name" style="color:#44ff44">${entry.fleetName}</div>
        <div class="item-stats">Hull damage: ${damage} HP — Cost: ${G.fmtCredits(cost)}</div>
        <button class="btn btn-buy" data-repescort="${entry.id}">REPAIR</button></div>`;
      }
      html+='</div>';
    }
    // Save game button
    html+=`<div style="margin-top:16px;border-top:1px solid #1a4a6a;padding-top:12px">
      <button class="btn" id="save-game-btn" style="border-color:#00ffee;color:#00ffee">💾 SAVE GAME</button>
      <span style="font-size:6px;color:#556677;margin-left:12px">Save at this spaceport</span>
    </div>`;
    return html;
  }

  _bindRepair(){
    document.getElementById('rep-hull')?.addEventListener('click',()=>{
      const p=G.game.player;
      const damage = Math.ceil(p.moduleDamage());
      const hasBroken = Object.values(p.modules).some(i=>i.broken);
      if(damage <= 0 && !hasBroken) return;
      const cost = Math.ceil(damage * 5);
      if(G.game.credits >= cost){
        G.game.credits -= cost;
        p.repairFull();   // restore every module to full + un-break (revives systems)
        this.addMsg('All modules repaired — systems restored.','#44ff44');
        this.renderSpaceportTab('repair');
      } else {
        this.addMsg('Not enough credits for full repair.','#ff6644');
      }
    });
    document.getElementById('rep-fuel')?.addEventListener('click',()=>{
      const p=G.game.player;
      const need = p.maxFuel - p.fuel;
      if(need <= 0) return;
      const costPerUnit = 2;
      const refueled = Math.min(need, Math.floor(G.game.credits / costPerUnit));
      const cost = refueled * costPerUnit;
      if(refueled > 0){
        G.game.credits -= cost;
        p.fuel += refueled;
        const msg = refueled === need ? 'Refueled' : `Refueled ${refueled} of ${Math.ceil(need)}`;
        this.addMsg(msg,'#44ff44');
        this.renderSpaceportTab('repair');
      }
    });
    document.getElementById('rep-shld')?.addEventListener('click',()=>{
      const p=G.game.player;
      const depleted = p.maxShields - p.shields;
      if(depleted <= 0) return;
      const costPerHp = 3;
      const recharged = Math.min(depleted, Math.floor(G.game.credits / costPerHp));
      const cost = recharged * costPerHp;
      if(recharged > 0){
        G.game.credits -= cost;
        p.shields += recharged;
        const msg = recharged === depleted ? 'Shields recharged' : `Shields recharged ${recharged} of ${Math.ceil(depleted)} HP`;
        this.addMsg(msg,'#44ff44');
        this.renderSpaceportTab('repair');
      }
    });
    document.querySelectorAll('[data-repmod]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const inst=G.game.player.modules[btn.dataset.repmod];
        if(!inst) return;
        const mod=G.MODULES[inst.moduleId]||G.WEAPONS[inst.moduleId];
        const cost=Math.ceil((mod?.price||500)*0.3);
        if(G.game.credits>=cost){G.game.credits-=cost;inst.broken=false;inst.hp=mod?.hp||50;G.game.player._recompute();this.addMsg('Repaired '+mod?.name,'#44ff44');this.renderSpaceportTab('repair');}
      });
    });
    document.querySelectorAll('[data-repescort]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const escortId = btn.dataset.repescort;
        const entry = (G.game.fleet||[]).find(e => e.id === escortId);
        if(!entry || !entry.ship) return;
        const damage = Math.ceil(entry.ship.moduleDamage());
        if(damage <= 0) return;
        const cost = damage * 5;
        if(G.game.credits >= cost){
          G.game.credits -= cost;
          entry.ship.repairFull();
          const activeFleetShip = G.game.space?.fleetShips?.find(fs => fs.fleetDataId === escortId);
          if(activeFleetShip) G.aiDeriveStats(activeFleetShip);
          this.addMsg(entry.fleetName + ' fully repaired','#44ff44');
          this.renderSpaceportTab('repair');
        } else {
          this.addMsg('Not enough credits.','#ff6644');
        }
      });
    });
    document.getElementById('save-game-btn')?.addEventListener('click',()=>G.game.saveGame());
  }

  // ── Crafting ─────────────────────────────────────────────
  _buildCraftHTML(){
    const p=G.game.player;
    const tpl=G.SHIPS[p.templateId];
    if(!Array.isArray(p.slots)) p.slots = new Array(tpl.slots).fill(null);
    let html=`<div class="panel-title">CRAFTING ${p.canCraft?'<span style="color:#44ff44">[WORKSHOP ACTIVE]</span>':''}</div>`;
    for(const recipe of G.RECIPES){
      const canCraft=recipe.reqModule?p.canCraft:true;
      const hasIng=Object.entries(recipe.inputs).every(([id,qty])=>(p.cargo[id]||0)>=qty);
      let ingHtml=Object.entries(recipe.inputs).map(([id,qty])=>{
        const have=p.cargo[id]||0, item=G.ITEMS[id];
        return `<span style="color:${have>=qty?'#44ff44':'#ff4444'}">${item?.name||id}: ${have}/${qty}</span>`;
      }).join(' &nbsp; ');

      let outputDesc='';
      if(recipe.outputModule) {
        const mod=G.MODULES[recipe.outputModule]||G.WEAPONS[recipe.outputModule];
        outputDesc=`➜ <span style="color:#cc44ff">MODULE: ${mod?.name||recipe.outputModule}</span>`;
      } else {
        const outItem=G.ITEMS[recipe.output?.item];
        outputDesc=`➜ ${recipe.output?.qty||1}x ${outItem?.name||recipe.output?.item||'?'}`;
      }

      html+=`<div class="item-card" style="margin-bottom:8px">
        <div class="item-name">${recipe.name}${recipe.reqModule?'<span style="color:#888;font-size:5px"> (workshop)</span>':''}</div>
        <div class="item-stats">${ingHtml}</div>
        <div class="item-stats" style="margin-top:3px">${outputDesc}</div>
        <button class="btn btn-buy" style="margin-top:4px" ${canCraft&&hasIng?'':'disabled style="opacity:0.3"'} data-craft="${recipe.id}">CRAFT</button>
      </div>`;
    }
    return html;
  }

  _bindCraft(){
    document.querySelectorAll('[data-craft]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const recipe=G.RECIPES.find(r=>r.id===btn.dataset.craft);
        if(!recipe) return;
        if(recipe.outputModule) {
          // Craft a module directly
          const p=G.game.player;
          const mod=G.MODULES[recipe.outputModule]||G.WEAPONS[recipe.outputModule];
          if(!mod){this.addMsg('Unknown module!','#ff4444');return;}
          const canCraft=recipe.reqModule?p.canCraft:true;
          if(!canCraft){this.addMsg('Workshop required!','#ff4444');return;}
          const hasIng=Object.entries(recipe.inputs).every(([id,qty])=>(p.cargo[id]||0)>=qty);
          if(!hasIng){this.addMsg('Missing materials!','#ff4444');return;}
          for(const[id,qty]of Object.entries(recipe.inputs)) p.removeCargo(id,qty);
          p.installModule(recipe.outputModule);
          G.game?._addXP?.(30);
          this.addMsg('Crafted and installed: '+mod.name,'#cc44ff');
          this.renderSpaceportTab('craft');
        } else {
          const res=G.game.economy.craft(btn.dataset.craft,G.game.player);
          this.addMsg(res.msg,res.ok?'#44ff44':'#ff4444');
          if(res.ok) { G.game?._addXP?.(30); this.renderSpaceportTab('craft'); }
        }
      });
    });
  }

  // ── Inventory ────────────────────────────────────────────
  showInventory(){
    const p=G.game.player, body=document.getElementById('inv-body');
    if(!body) return;
    let html='';

    // ── Cargo section ──
    html+='<div style="font-size:6px;color:#aabbcc;margin-bottom:6px;letter-spacing:1px">CARGO</div>';
    html+='<div class="inv-grid">';
    const entries=Object.entries(p.cargo);
    if(!entries.length) html+='<div style="color:#556677;font-size:7px">Cargo hold is empty</div>';
    for(const[id,qty]of entries){
      const item=G.ITEMS[id]; if(!item) continue;
      const isMission = item.cat==='mission';
      html+=`<div class="inv-item rarity-${item.rarity||'c'}">
        <div class="inv-qty">${qty}</div>
        <div class="inv-name">${item.name}</div>
        <div style="font-size:5px;color:#556677;margin-top:2px">${G.RARITY[item.rarity||'c']?.label||item.rarity}</div>
        ${!isMission?`<button data-jettison="${id}" style="margin-top:3px;font-size:5px;padding:1px 3px;background:#331111;border:1px solid #663333;color:#ff6644;cursor:pointer">JETTISON</button>`:''}
      </div>`;
    }
    html+=`</div><div style="margin-top:6px;font-size:7px;color:#556677;margin-bottom:12px">Free space: ${Math.ceil(G.game.fleetCargoFreeSpace())} units${G.game.fleet?.length?' (fleet combined)':''}</div>`;

    // ── Stored modules section ──
    const modInv = p.moduleInventory || [];
    html+='<div style="font-size:6px;color:#aabbcc;margin-bottom:6px;letter-spacing:1px">STORED MODULES</div>';
    html+='<div class="inv-grid">';
    if(!modInv.length) html+='<div style="color:#556677;font-size:7px">No modules in storage</div>';
    for(let mi=0;mi<modInv.length;mi++){
      const modId=modInv[mi];
      const mod=G.MODULES[modId]||G.WEAPONS[modId]; if(!mod) continue;
      html+=`<div class="inv-item rarity-${mod.rarity||'c'}">
        <div class="inv-name" style="font-size:5px">${mod.name}</div>
        <div style="font-size:5px;color:#556677;margin-top:2px">${G.RARITY[mod.rarity||'c']?.label||mod.rarity||''}</div>
        <button data-jettison-mod="${mi}" style="margin-top:3px;font-size:5px;padding:1px 3px;background:#331111;border:1px solid #663333;color:#ff6644;cursor:pointer">JETTISON</button>
      </div>`;
    }
    html+='</div>';

    // ── Installed-module hex display (mirrors the Ship Builder layout) ──
    this._ensureBuilderCells(p);
    html+=`<div style="font-size:6px;color:#aabbcc;margin:12px 0 6px;letter-spacing:1px">SHIP MODULES <span style="color:#556677;font-size:5px">— hover or click a module for details</span></div>
    <style>
      .imod-wrap{display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap}
      .imod-canvas{width:270px;height:270px;flex:0 0 auto;image-rendering:pixelated;cursor:pointer;background:#050e18;border:1px solid #16303f;border-radius:2px}
      .imod-card{flex:1;min-width:135px;max-width:180px}
      .imod-card-empty{color:#556677;font-size:6px;padding:10px}
    </style>
    <div class="imod-wrap">
      <canvas class="imod-canvas" id="imod-canvas" width="270" height="270"></canvas>
      <div class="imod-card" id="imod-card"><div class="imod-card-empty">Hover or click a module to see its stats.</div></div>
    </div>`;

    body.innerHTML=html;

    // Bind hex canvas hover/select → render stat card
    const imodCanvas=document.getElementById('imod-canvas');
    const imodCard=document.getElementById('imod-card');
    if(imodCanvas&&imodCard){
      this._drawHexMini(imodCanvas, p);   // static draw (no crew loop needed here)
      const hitInst=(ev)=>{
        const v=this._invHexView; if(!v) return null;
        const rect=imodCanvas.getBoundingClientRect();
        const sx=(ev.clientX-rect.left)*(imodCanvas.width/rect.width);
        const sy=(ev.clientY-rect.top)*(imodCanvas.height/rect.height);
        const h=G.pixelToHex((sx-v.cx)/v.BR,(sy-v.cy)/v.BR,1);
        for(const [id,inst] of Object.entries(p.modules)) if(inst.q===h.q&&inst.r===h.r) return id;
        return null;
      };
      const showCard=(instId)=>{ if(instId&&p.modules[instId]) imodCard.innerHTML=this._builderCardHTML(instId,false); };
      imodCanvas.addEventListener('mousemove',e=>{ const id=hitInst(e); if(id) showCard(id); });
      imodCanvas.addEventListener('click',e=>{ const id=hitInst(e); if(id) showCard(id); });
    }

    // Bind cargo jettison buttons
    body.querySelectorAll('[data-jettison]').forEach(btn=>{
      btn.addEventListener('click', e=>{
        e.stopPropagation();
        const itemId=btn.dataset.jettison;
        const qty=p.cargo[itemId]||0;
        if(!qty) return;
        p.removeCargo(itemId, qty);
        const space=G.game.space;
        if(space) {
          const bx = -Math.sin(p.angle), by = Math.cos(p.angle); // behind vector
          space.floatingLoot.push({
            x: p.x + bx*55 + (Math.random()-0.5)*20,
            y: p.y + by*55 + (Math.random()-0.5)*20,
            vx: bx*120 + (Math.random()-0.5)*40,
            vy: by*120 + (Math.random()-0.5)*40,
            type:'item', itemId, qty, rarity:G.ITEMS[itemId]?.rarity||'c', ttl:60,
            color:G.rarityColor(G.ITEMS[itemId]?.rarity||'c'),
            pickupDelay: 2.5,
          });
        }
        this.addMsg('Jettisoned '+qty+'x '+(G.ITEMS[itemId]?.name||itemId),'#ff8844');
        this.showInventory();
      });
    });

    // Bind module jettison buttons
    body.querySelectorAll('[data-jettison-mod]').forEach(btn=>{
      btn.addEventListener('click', e=>{
        e.stopPropagation();
        const mi=+btn.dataset.jettisonMod;
        const inv=p.moduleInventory||[];
        const modId=inv[mi];
        if(!modId) return;
        inv.splice(mi,1);
        const mod=G.MODULES[modId]||G.WEAPONS[modId];
        const space=G.game.space;
        if(space) {
          const bx = -Math.sin(p.angle), by = Math.cos(p.angle);
          space.floatingLoot.push({
            x: p.x + bx*55 + (Math.random()-0.5)*20,
            y: p.y + by*55 + (Math.random()-0.5)*20,
            vx: bx*120 + (Math.random()-0.5)*40,
            vy: by*120 + (Math.random()-0.5)*40,
            type:'module', moduleId:modId, rarity:mod?.rarity||'u', ttl:60,
            color:G.rarityColor(mod?.rarity||'u'),
            pickupDelay: 2.5,
          });
        }
        this.addMsg('Jettisoned '+(mod?.name||modId),'#ff8844');
        this.showInventory();
      });
    });

    this.els['inventory-overlay']?.classList.remove('hidden');
  }

  hideInventory(){ this.els['inventory-overlay']?.classList.add('hidden'); }

  // ── Messages / notifications ─────────────────────────────
  addMsg(text, color='#88ccee'){
    const msgs=this.els['msgs'];
    if(!msgs) return;
    // Deduplicate: suppress identical message within 2s
    const now=Date.now();
    if(this._lastMsg===text && now-this._lastMsgT<2000) return;
    this._lastMsg=text; this._lastMsgT=now;
    // Persist to history for the log overlay
    const d=new Date(now);
    const ts=d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0')+':'+d.getSeconds().toString().padStart(2,'0');
    this._msgHistory.unshift({ts, text, color});
    if(this._msgHistory.length>200) this._msgHistory.length=200;
    // Cap visible lines at 5
    while(msgs.children.length>=5) msgs.removeChild(msgs.lastChild);
    const el=document.createElement('div');
    el.className='msg-line'; el.style.borderLeftColor=color; el.style.color=color;
    el.textContent=text;
    msgs.prepend(el);
    setTimeout(()=>{try{msgs.removeChild(el);}catch(e){}},4000);

    // TTS for ship messages: [Name]: "speech"
    const shipMatch = text.match(/^\[(.+?)\]: "(.*)"$/s);
    if(shipMatch && this._voiceEnabled && window.speechSynthesis) {
      const prefix  = '['+shipMatch[1]+']: "';
      const speech  = shipMatch[2];
      if(!speech) return;
      speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(speech);
      utter.volume = this._voiceVolume ?? 0.25;
      const npcCtx = this._commsNPC || { name: shipMatch[1], faction: 'independent' };
      const vp = this._voiceParamsForNPC(npcCtx);
      utter.pitch = vp.pitch;
      utter.rate  = vp.rate;
      el.textContent = prefix;
      utter.onboundary = (e) => {
        if(e.name !== 'word') return;
        el.textContent = prefix + speech.substring(0, e.charIndex + e.charLength);
      };
      utter.onend = utter.onerror = () => { el.textContent = text; };
      const estDuration = speech.split(/\s+/).length * 0.42 / (utter.rate || 0.95);
      G.sound?.voiceChannelOpen(estDuration);
      speechSynthesis.speak(utter);
    }
  }

  showLootNotif(name, qty, rarity){
    const ln=this.els['loot-notif']; if(!ln) return;
    const el=document.createElement('div');
    el.className='loot-item'; el.style.borderLeftColor=G.rarityColor(rarity);
    el.textContent='+'+qty+' '+name; ln.appendChild(el);
    setTimeout(()=>{try{ln.removeChild(el);}catch(e){}},3000);
  }

  setInteractPrompt(text){
    const ip=this.els['interact-prompt']; if(!ip) return;
    ip.classList.add('hidden');
  }

  _updateLoadBtns() {
    const hasSave = !!localStorage.getItem(G.SAVE_KEY);
    ['gameover-load-btn','opt-load-btn'].forEach(id=>{
      const btn=document.getElementById(id);
      if(!btn) return;
      btn.disabled=!hasSave;
      btn.style.opacity=hasSave?'1':'0.35';
      btn.style.cursor=hasSave?'pointer':'not-allowed';
    });
  }

  showSaveConfirm() {
    const el = document.getElementById('save-confirm');
    if(!el) return;
    el.classList.remove('hidden');
    void el.offsetWidth; // restart animation
    setTimeout(() => el.classList.add('hidden'), 2800);
  }

  updateJumpRouteHUD(player, galaxy, cooldown) {
    const el = document.getElementById('jump-route-hud');
    if(!el) return;
    const route = galaxy.jumpRoute;
    if(route.length === 0 && cooldown <= 0) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');

    const nextEl  = document.getElementById('jr-next');
    const fuelEl  = document.getElementById('jr-fuel');
    const cdEl    = document.getElementById('jr-cd');

    if(route.length > 0) {
      const nextSys = G.SYSTEMS.find(s=>s.id===route[0]);
      if(nextEl) nextEl.textContent = '▶ '+( nextSys?.name||route[0])+(route.length>1?' ['+route.length+' hops]':'');
    } else {
      if(nextEl) nextEl.textContent = '';
    }

    const fuelJumps = Math.floor(player.fuel / 10);
    if(fuelEl) fuelEl.textContent = '⛽ '+fuelJumps+' jump'+(fuelJumps!==1?'s':'')+' left';

    if(cdEl) {
      if(cooldown > 0) {
        cdEl.textContent = '⏱ '+Math.ceil(cooldown)+'s cooldown';
        cdEl.style.color = '#ff8844';
      } else {
        cdEl.textContent = route.length>0 ? 'HOLD [J] TO JUMP' : '';
        cdEl.style.color = '#00ffee';
      }
    }
  }

  showGameOver(stats){
    this.els['gameover-overlay']?.classList.remove('hidden');
    this.els['hud']?.classList.add('hidden');
    if(this.els['gameover-stats'])
      this.els['gameover-stats'].innerHTML=`<div>Credits: ${G.fmtCredits(stats.credits)}</div><div>Systems: ${stats.visited}</div><div>Kills: ${stats.kills}</div><div>Time: ${Math.floor(stats.time/60)}m ${stats.time%60|0}s</div>`;
    this._updateLoadBtns();
  }

  // ── Comms system ─────────────────────────────────────────
  openComms(target, forceAction, isRescueRequest = false) {
    if(!target) return;
    if(target.type === 'planet' || target.type === 'station') {
      this._openPlanetComms(target);
      return;
    }
    if(target.dead) return;

    // No-response check (skip for forced actions like fuel requests)
    if(!forceAction && Math.random() < G.commsNoResponseChance(target)) {
      this._showCommsNoResponse(target);
      return;
    }
    this._commsIsRescueRequest = isRescueRequest;

    G.sound?.commsPing();
    this._commsNPC = target;
    this._drawCommsPortrait(target);
    const fac  = G.FACTIONS[target.faction]||G.FACTIONS.independent;
    const displayName = target.name || (fac.name.toUpperCase()+' VESSEL');

    if(this.els['comms-faction-tag']) {
      this.els['comms-faction-tag'].textContent = fac.name.toUpperCase();
      this.els['comms-faction-tag'].style.color  = fac.color;
    }
    if(this.els['comms-ship-name']) this.els['comms-ship-name'].textContent = displayName;
    if(this.els['comms-class-tag']) {
      const cls = G.CLASSES?.[target.classId];
      const _lvlStr = target.level ? `  ·  LVL ${target.level}` : '';
      this.els['comms-class-tag'].textContent = cls ? cls.name + _lvlStr : _lvlStr.trim();
      this.els['comms-class-tag'].style.color  = cls ? cls.color : '#556677';
    }
    if(this.els['comms-response-text']) this.els['comms-response-text'].textContent = '';

    // Build options — enemies and fleet ships get special sets
    let opts;
    if(target.isFleetShip) {
      opts = [
        { key:'fleet_hail',    label:'Hail',                color:'#00ffee' },
        { key:'fleet_release', label:'Release from Fleet',  color:'#ffaa44' },
      ];
    } else if(target.type === 'enemy') {
      opts = [{ key:'hail', label:'Hail', color:'#00ffee' }];
      if(target.faction !== 'alien') {
        const cost   = G.npcForgivenessCost(target.faction);
        const chance = Math.round(G.npcForgivenessChance(target.faction) * 100);
        opts.push({ key:'forgive', label:`Beg Forgiveness — ${G.fmtCredits(cost)} (${chance}% success)`, color:'#ffaa00' });
      }
    } else {
      opts = target.getCommsOptions();
    }

    // When player is disabled and this is a rescue request, prepend rescue option
    if(this._commsIsRescueRequest && target.type !== 'enemy') {
      opts = [{ key:'request_rescue', label:'REQUEST RESCUE', color:'#ff8844' }, ...opts];
    }

    const list = this.els['comms-options-list'];
    if(list) {
      list.innerHTML = opts.map(o=>
        `<button class="btn comms-opt" data-key="${o.key}" style="color:${o.color};border-color:${o.color};margin:3px 0;width:100%;${o.disabled?'opacity:0.4;':''}"
          ${o.disabled?'disabled':''}>
          ${o.label}
        </button>`
      ).join('');
      list.querySelectorAll('.comms-opt').forEach(btn=>{
        btn.addEventListener('click', ()=>this._handleCommsAction(btn.dataset.key));
      });
    }

    this.els['comms-overlay']?.classList.remove('hidden');
    if(forceAction) this._handleCommsAction(forceAction);
  }

  _openPlanetComms(body) {
    if(!body.hasSpaceport) {
      // No inhabited port — no response
      this._showCommsNoResponse({ faction: body.faction || 'neutral', name: body.name });
      return;
    }
    G.sound?.commsPing();
    this._commsNPC = body;
    this._drawCommsPortrait(body);
    const fac = G.FACTIONS[body.faction] || G.FACTIONS.neutral;
    const rel = G.game.getRel(body.faction || 'neutral');
    const hostile = body.faction && body.faction !== 'neutral' && body.faction !== 'contested' && rel < -30;

    if(this.els['comms-faction-tag']) {
      this.els['comms-faction-tag'].textContent = fac.name.toUpperCase();
      this.els['comms-faction-tag'].style.color = fac.color;
    }
    if(this.els['comms-ship-name']) this.els['comms-ship-name'].textContent = body.spaceportName || body.name || 'PLANETARY CONTROL';
    if(this.els['comms-class-tag']) { this.els['comms-class-tag'].textContent = ''; }
    if(this.els['comms-response-text']) this.els['comms-response-text'].textContent = '';

    const opts = [{ key:'planet_hail', label:'Hail', color:'#00ffee' }];
    if(body.hasSpaceport) {
      opts.push({ key:'planet_landing', label:'Request Landing', color: hostile ? '#ff4444' : '#44ff88' });
    }

    const list = this.els['comms-options-list'];
    if(list) {
      list.innerHTML = opts.map(o =>
        `<button class="btn comms-opt" data-key="${o.key}" style="color:${o.color};border-color:${o.color};margin:3px 0;width:100%;">${o.label}</button>`
      ).join('');
      list.querySelectorAll('.comms-opt').forEach(btn => {
        btn.addEventListener('click', () => this._handleCommsAction(btn.dataset.key));
      });
    }
    this.els['comms-overlay']?.classList.remove('hidden');
  }

  _showCommsNoResponse(target) {
    this._commsNPC = target;
    this._drawCommsPortrait(target);
    const bank  = G.COMMS_LINES[target.faction]||G.COMMS_LINES.independent;
    const lines = bank.noresponse||['...'];
    const fac   = G.FACTIONS[target.faction]||G.FACTIONS.independent;
    const displayName = target.name || (fac.name.toUpperCase()+' VESSEL');
    const text  = lines[Math.floor(Math.random()*lines.length)].replace(/{name}/g, displayName);

    if(this.els['comms-faction-tag']) {
      this.els['comms-faction-tag'].textContent = fac.name.toUpperCase();
      this.els['comms-faction-tag'].style.color  = fac.color;
    }
    if(this.els['comms-ship-name']) this.els['comms-ship-name'].textContent = displayName;
    if(this.els['comms-class-tag']) {
      const cls = G.CLASSES?.[target.classId];
      const _lvlStr = target.level ? `  ·  LVL ${target.level}` : '';
      this.els['comms-class-tag'].textContent = cls ? cls.name + _lvlStr : _lvlStr.trim();
      this.els['comms-class-tag'].style.color  = cls ? cls.color : '#556677';
    }
    this._speakComms(text);
    const list = this.els['comms-options-list'];
    if(list) list.innerHTML = '';
    this.els['comms-overlay']?.classList.remove('hidden');
    // Auto-close after 2s
    clearTimeout(this._noRespTimer);
    this._noRespTimer = setTimeout(()=>this.closeComms(), 2000);
  }

  _handleCommsAction(action) {
    const target = this._commsNPC;
    if(!target) return;
    const resp = this.els['comms-response-text'];

    // Planet / station comms
    if(target.type === 'planet' || target.type === 'station') {
      if(action === 'planet_hail') {
        const portName = target.spaceportName || target.name || 'this location';
        const lines = [
          'This is planetary control. State your business.',
          'Approach vector acknowledged. Welcome to '+portName+'.',
          'Planetary control online. How can we assist you?',
          'Traffic control active. Please maintain holding pattern.',
          'Incoming vessel identified. You are cleared for approach.',
          portName+' Control here. Transmit your manifest and we will process clearance.',
          'This is '+portName+' Orbital. Channel Alpha-Seven is yours. Go ahead.',
          'Docking authority online. Identify yourself and state your purpose.',
          portName+' approach control. You are squawking on our grid — what is your request?',
          'Welcome to the '+portName+' system. Standard docking fees apply. State your business.',
          'Control to incoming vessel — you are on final approach corridor. Confirm heading.',
          portName+' traffic control. Lima Charlie on your transponder. What do you need?',
          'This is '+portName+'. We show you at grid reference Foxtrot-Nine. Proceed.',
          'Orbital station '+portName+'. Berth available. Standard rates apply, no questions asked.',
        ];
        this._speakComms('"'+lines[Math.floor(Math.random()*lines.length)]+'"');
        return;
      }
      if(action === 'planet_landing') {
        const pFac = target.faction;
        const rel = G.game.getRel(pFac || 'neutral');
        const hostile = pFac && pFac !== 'neutral' && pFac !== 'contested' && rel < -30;
        if(hostile) {
          const denied = [
            'You are not welcome here. Turn back immediately.',
            'Landing denied. Your record with us makes you unwelcome.',
            'Hostile vessel detected. Do not approach or you will be fired upon.',
            'Access denied. Code Tango on your transponder — break off approach now.',
            'Negative clearance. Your vessel is flagged. Withdraw or be fired upon.',
            'This is orbital defense. You are denied entry. One warning.',
          ];
          this._speakComms('"'+denied[Math.floor(Math.random()*denied.length)]+'"');
          setTimeout(() => this.closeComms(), 2200);
          return;
        }
        const p = G.game.player;
        const dist = Math.hypot(p.x - target.x, p.y - target.y);
        if(dist > target.r + 80) {
          const farLines = [
            'Clearance granted. Approach to docking range to initiate landing sequence.',
            'You are cleared for approach. Reduce speed and close to docking range.',
            'Approach approved. Proceed on heading and reduce velocity before final.',
            'Docking clearance issued. Close to docking range — we will take it from there.',
          ];
          this._speakComms('"'+farLines[Math.floor(Math.random()*farLines.length)]+'"');
          return;
        }
        const dockLines = [
          'Landing clearance granted. Reduce speed and prepare for docking.',
          'You are on approach. Docking clamps standing by. Welcome aboard.',
          'Final approach authorized. Autopilot handoff in three, two, one.',
          'Cleared to land. Bay Bravo-Four is yours. Stand by for docking.',
        ];
        this._speakComms('"'+dockLines[Math.floor(Math.random()*dockLines.length)]+'"');
        setTimeout(() => { this.closeComms(); G.sound.land(); G.game.land(target); }, 1400);
        return;
      }
      return;
    }

    // Fleet ships get their own comms handling
    if(target.isFleetShip) {
      if(action === 'fleet_hail') {
        const lines = ['Ready and standing by, Captain.','All systems nominal. Awaiting orders.',
                       'In formation. Target acquired when ready.','Escort standing by.'];
        this._speakComms('"'+lines[Math.floor(Math.random()*lines.length)]+'"');
        return;
      }
      if(action === 'fleet_release') {
        const farewells = ['It\'s been an honor, Captain. Safe travels.',
                           'Understood. Going our own way. Good luck out there.',
                           'Copy that. We\'ll find our own path. Fly safe.',
                           'Roger. Breaking formation. It was a pleasure serving with you.'];
        this._speakComms('"'+farewells[Math.floor(Math.random()*farewells.length)]+'"');
        G.game.releaseFleetShip(target.fleetDataId);
        setTimeout(()=>this.closeComms(), 2200);
        return;
      }
      return;
    }

    // For enemies, resolve comms manually (no getCommsResponse method)
    if(target.type === 'enemy') {
      if(action === 'hail') {
        const bank  = G.COMMS_LINES[target.faction]||G.COMMS_LINES.independent;
        const lines = bank.hail||['...'];
        const eName = target.name || 'vessel';
        const eLine = lines[Math.floor(Math.random()*lines.length)].replace(/{name}/g, eName);
        this._speakComms('"'+eLine+'"');
        return;
      }
      if(action === 'forgive') {
        this._resolveForgiveness(target, resp);
        return;
      }
      return;
    }

    if(action === 'request_rescue') {
      this._resolveRescueRequest(target, resp);
      return;
    }
    if(action === 'accept_rescue_payment') {
      const cost = this._rescueCreditDemand || 0;
      if(G.game.credits < cost) {
        this._speakComms('"You don\'t have enough credits. Good luck out there."');
        setTimeout(() => this.closeComms(), 2200);
      } else {
        G.game.credits -= cost;
        this._speakComms('"Credits received. Bringing you in — hang tight."');
        setTimeout(() => { this.closeComms(); G.game.rescueLand(); }, 2000);
      }
      return;
    }
    if(action === 'decline_rescue') {
      this._speakComms('"Understood. We\'ll stay on standby."');
      setTimeout(() => this.closeComms(), 1800);
      return;
    }

    const res = target.getCommsResponse(action);
    this._speakComms('"'+res.text+'"');

    if(action==='fuel' && res.fuelRendezvous) {
      this.addMsg(target.name+' is en route — fuel transfer on arrival.', '#ff8844');
      setTimeout(()=>this.closeComms(), 1800);
    }

    if(action==='trade' && res.tradeItems.length>0) {
      const tradeHtml = res.tradeItems.map(it=>{
        const item = G.ITEMS[it.id];
        return `<div style="display:flex;justify-content:space-between;font-size:6px;padding:2px 0">
          <span>${item?.name||it.id} ×${it.qty}</span>
          <span style="color:#ffcc00">$ ${it.price}</span>
          <button class="btn" style="font-size:5px;padding:2px 5px" onclick="G.ui._buyFromNPC('${it.id}',${it.qty},${it.price})">BUY</button>
        </div>`;
      }).join('');
      if(resp) resp.innerHTML = tradeHtml;
    }

    if(res.hostile) {
      target.hostile = true;
      target.combatTarget = null;
      const hBank = G.COMMS_LINES?.[target.faction]||G.COMMS_LINES?.independent;
      const hLines = hBank?.hostile||['Opening fire!'];
      const hMsg = hLines[Math.floor(Math.random()*hLines.length)];
      this.addMsg('['+target.name+']: "'+hMsg+'"', G.FACTIONS[target.faction]?.color||'#ff4444');
      if(target.faction!=='independent') G.game.setRel(target.faction, G.game.getRel(target.faction)-5);
      this.closeComms();
    }

    if(action==='tribute' && !res.hostile && res.tributeAmount) {
      G.game.credits += res.tributeAmount;
      this.addMsg('Tribute collected: +'+G.fmtCredits(res.tributeAmount), '#ffcc00');
      if(target.faction && target.faction!=='independent')
        G.game.setRel(target.faction, G.game.getRel(target.faction)-3, 'extortion');
      setTimeout(()=>this.closeComms(), 2000);
    }

    if(action==='forgive' && res.forgiveResult) {
      this._resolveForgiveness(target, resp, res.forgiveResult);
    }
  }

  _resolveRescueRequest(target, respEl) {
    const rel = G.game?.getRel(target.faction || 'neutral') || 0;
    // Outcome weights shift with faction relation: hostile factions refuse more
    const refuseW  = Math.max(0.1, 0.35 - rel * 0.003);
    const creditsW = 0.35;
    const helpW    = Math.max(0.1, 0.30 + rel * 0.003);
    const roll     = Math.random() * (refuseW + creditsW + helpW);

    const refuseLines = [
      'We\'ve got our own problems out here. You\'re on your own.',
      'Negative. Can\'t risk our hull for a stranger.',
      'Not our mission. Good luck.',
      'We don\'t do charity runs. Sorry.',
      'Too much heat in this sector. Can\'t stop.',
    ];
    const helpLines = [
      'Copy that. We\'re coming to get you. Sit tight.',
      'Understood — rescue inbound. Don\'t go anywhere.',
      'We read you. Bringing you to the nearest port. Stand by.',
      'You\'re lucky we\'re close by. Locking on your position now.',
    ];

    if(roll < refuseW) {
      // Refuse
      this._speakComms('"' + refuseLines[Math.floor(Math.random()*refuseLines.length)] + '"');
      setTimeout(() => this.closeComms(), 2200);
    } else if(roll < refuseW + creditsW) {
      // Demand credits
      const danger   = G.game?.space?.sys?.danger || 3;
      const cost     = (500 + danger * 200 + Math.floor(Math.random() * 500)) * 10;
      this._rescueCreditDemand = cost;
      this._speakComms('"We can pull you in — but it\'ll cost ' + G.fmtCredits(cost) + '. Your call."');
      const list = this.els['comms-options-list'];
      if(list) {
        list.innerHTML = `
          <button class="btn comms-opt" data-key="accept_rescue_payment" style="color:#ffcc00;border-color:#ffcc00;margin:3px 0;width:100%">
            PAY ${G.fmtCredits(cost)}
          </button>
          <button class="btn comms-opt" data-key="decline_rescue" style="color:#ff4444;border-color:#ff4444;margin:3px 0;width:100%">
            DECLINE
          </button>`;
        list.querySelectorAll('.comms-opt').forEach(btn => {
          btn.addEventListener('click', () => this._handleCommsAction(btn.dataset.key));
        });
      }
    } else {
      // Agree to help freely
      this._speakComms('"' + helpLines[Math.floor(Math.random()*helpLines.length)] + '"');
      setTimeout(() => { this.closeComms(); G.game.rescueLand(); }, 2200);
    }
  }

  _resolveForgiveness(target, respEl, result) {
    // For enemies, compute result here; for NPCs it's pre-computed
    if(!result) {
      const cost    = G.npcForgivenessCost(target.faction);
      const success = Math.random() < G.npcForgivenessChance(target.faction);
      const bank    = G.COMMS_LINES[target.faction]||G.COMMS_LINES.independent;
      const lines   = bank[success ? 'forgive_accept' : 'forgive_deny']||bank.hail;
      const text    = lines[Math.floor(Math.random()*lines.length)].replace('{cost}', G.fmtCredits(cost));
      this._speakComms('"'+text+'"');
      result = { success, cost };
    }

    if(!result.success) {
      G.sound?.forgiveness(false);
      this.addMsg('They refused. No deal.', '#ff4444');
      return;
    }
    if(G.game.credits < result.cost) {
      G.sound?.forgiveness(false);
      this._speakComms('"You can\'t afford it."');
      this.addMsg('Not enough credits for forgiveness.', '#ff4444');
      return;
    }
    G.sound?.forgiveness(true);
    G.game.credits -= result.cost;
    // Make target stand down
    target.hostile      = false;
    target.combatTarget = null;
    if(target.type === 'enemy') target.aiState = 'patrol';
    // Improve faction standing
    if(target.faction && target.faction !== 'independent') {
      const newRel = Math.min(100, G.game.getRel(target.faction) + 10);
      G.game.setRel(target.faction, newRel);
    }
    const nBank = G.COMMS_LINES?.[target.faction]||G.COMMS_LINES?.independent;
    const nLines = nBank?.neutral_resume||nBank?.forgive_accept||['Standing down.'];
    const nMsg = nLines[Math.floor(Math.random()*nLines.length)].replace('{cost}', G.fmtCredits(result.cost));
    this.addMsg('['+target.name+']: "'+nMsg+'"', G.FACTIONS[target.faction]?.color||'#88ccee');
    this.addMsg('Forgiveness purchased for '+G.fmtCredits(result.cost)+'.', '#ffaa00');
    setTimeout(()=>this.closeComms(), 1500);
  }

  _buyFromNPC(itemId, qty, price) {
    const item = G.ITEMS[itemId];
    if(!item) return;
    if(G.game.credits<price) { this.addMsg('Not enough credits!','#ff4444'); return; }
    if(G.game.fleetCargoFreeSpace()<(item.mass||1)*qty) { this.addMsg('Cargo full!','#ff4444'); return; }
    G.game.credits -= price;
    G.game.player.addCargo(itemId, qty);
    this.addMsg('Bought '+qty+'x '+item.name+' for '+G.fmtCredits(price),'#44ff44');
    this.closeComms();
  }

  showControlsMenu() {
    const overlay = document.getElementById('controls-overlay');
    const list = document.getElementById('controls-list');
    if(!overlay || !list) return;

    const keyCodeToName = (code) => {
      const names = {
        'KeyW':'W', 'KeyA':'A', 'KeyS':'S', 'KeyD':'D',
        'KeyQ':'Q', 'KeyE':'E', 'KeyC':'C', 'KeyT':'T', 'KeyY':'Y', 'KeyR':'R', 'KeyP':'P',
        'KeyM':'M', 'KeyJ':'J', 'KeyL':'L', 'KeyI':'I', 'KeyN':'N', 'KeyV':'V', 'KeyX':'X',
        'ArrowUp':'↑', 'ArrowDown':'↓', 'ArrowLeft':'←', 'ArrowRight':'→',
        'ShiftLeft':'SHIFT', 'ShiftRight':'SHIFT', 'Space':'SPACE', 'Escape':'ESC',
      };
      return names[code] || code;
    };

    const controls = [
      { action: 'thrust', name: 'THRUST' },
      { action: 'reverse', name: 'BRAKE' },
      { action: 'turnL', name: 'TURN LEFT' },
      { action: 'turnR', name: 'TURN RIGHT' },
      { action: 'strafeL', name: 'DODGE LEFT' },
      { action: 'strafeR', name: 'DODGE RIGHT' },
      { action: 'boost', name: 'BOOST' },
      { action: 'fire', name: 'FIRE WEAPONS' },
      { action: 'fireMissile', name: 'FIRE MISSILE' },
      { action: 'charPanel', name: 'CHARACTER' },
      { action: 'cycleTarget', name: 'CYCLE TARGET' },
      { action: 'nearestTarget', name: 'NEAREST TARGET' },
      { action: 'autopilot', name: 'AUTOPILOT' },
      { action: 'galaxyMap', name: 'GALAXY MAP' },
      { action: 'hyperspace', name: 'HYPERSPACE JUMP' },
      { action: 'land', name: 'LAND/BOARD' },
      { action: 'inventory', name: 'INVENTORY' },
      { action: 'missionLog', name: 'MISSION LOG' },
      { action: 'comms', name: 'COMMS' },
      { action: 'options', name: 'OPTIONS' },
    ];

    const input = G.game?.input;
    let html = '';
    html += `<div style="color:#ffaa44;margin-bottom:8px;letter-spacing:1px">KEYBOARD (Click to rebind)</div>`;
    for(const ctrl of controls) {
      const keys = (input?.keymap?.[ctrl.action] || []).map(keyCodeToName).join(' / ') || '?';
      html += `<div style="display:flex;justify-content:space-between;margin-bottom:6px;cursor:pointer" id="remap-${ctrl.action}" data-action="${ctrl.action}"><span>${ctrl.name}</span><span style="color:#ffaa44;border:1px solid #ffaa44;padding:1px 4px">${keys}</span></div>`;
    }
    html += `<button id="reset-keymap" style="margin-top:12px;padding:6px 12px;background:#667788;color:#fff;border:1px solid #aabbcc;cursor:pointer;font-family:monospace;font-size:6px">RESET TO DEFAULTS</button>`;

    // Add control mode selection
    html += `<div style="color:#44ffcc;margin:16px 0 8px;letter-spacing:1px">CONTROL MODE</div>`;
    const game = G.game;
    const currentScheme = game ? game._controlScheme : 'auto';
    html += `<div style="display:flex;gap:6px;margin-bottom:12px">`;
    for(const scheme of ['auto', 'keyboard', 'touch', 'gamepad']) {
      const isActive = scheme === currentScheme;
      const label = scheme === 'auto' ? 'AUTO' : scheme === 'keyboard' ? 'KEYS' : scheme === 'touch' ? 'TOUCH' : 'PAD';
      html += `<button id="scheme-${scheme}" data-scheme="${scheme}" style="flex:1;padding:4px;background:${isActive?'#44ffcc':'#556677'};color:${isActive?'#000':'#aabbcc'};border:1px solid ${isActive?'#44ffcc':'#778899'};cursor:pointer;font-family:monospace;font-size:6px;font-weight:bold">${label}</button>`;
    }
    html += `</div>`;

    list.innerHTML = html;
    overlay.classList.remove('hidden');

    // Control scheme buttons
    for(const scheme of ['auto', 'keyboard', 'touch', 'gamepad']) {
      document.getElementById('scheme-'+scheme)?.addEventListener('click', () => {
        if(game) game.setControlScheme(scheme);
        this.showControlsMenu();
      });
    }

    // Rebinding: click a row, then press a key. Use currentTarget (the row div)
    // so clicks on the child <span>s still resolve the action.
    // Shift+key adds to existing bindings, plain key replaces all bindings.
    this._rebindTarget = null;
    const startRebind = (e) => {
      const action = e.currentTarget.dataset.action;
      if(!action) return;
      this._rebindTarget = action;
      const el = document.getElementById('remap-'+action);
      if(el && el.lastElementChild) {
        el.lastElementChild.textContent = 'PRESS KEY (Shift to add)…';
        el.lastElementChild.style.color = '#ff6666';
        el.lastElementChild.style.borderColor = '#ff6666';
      }
    };
    for(const ctrl of controls) {
      const el = document.getElementById('remap-'+ctrl.action);
      if(el) el.addEventListener('click', startRebind);
    }
    document.getElementById('reset-keymap')?.addEventListener('click', () => {
      if(input) input.resetKeymap();   // resetKeymap() persists to localStorage
      this.showControlsMenu();
    });

    // One persistent capture-phase key listener (installed once). It only acts
    // while the controls overlay is visible and a rebind is pending, and it
    // swallows the key so the game doesn't also react to it.
    if(!this._rebindKeyHandler) {
      this._rebindKeyHandler = (e) => {
        if(!this._rebindTarget) return;
        const overlay = document.getElementById('controls-overlay');
        if(!overlay || overlay.classList.contains('hidden')) { this._rebindTarget = null; return; }
        e.preventDefault(); e.stopPropagation();
        const code = e.code;
        const inp = G.game?.input;
        if(code !== 'Escape' && inp) {
          const addToExisting = e.shiftKey;
          inp.rebindKey(this._rebindTarget, code, addToExisting);
        }
        this._rebindTarget = null;
        this.showControlsMenu();
      };
      window.addEventListener('keydown', this._rebindKeyHandler, true);
    }
  }

  showDebugMenu() {
    const overlay = document.getElementById('debug-overlay');
    const list = document.getElementById('debug-list');
    if(!overlay || !list) return;

    const game = G.game;
    const collisionsEnabled = game?.collisionsEnabled !== false;
    const fpsEnabled = game?._fpsEl != null;
    const godmodeEnabled = game?._godMode ?? false;

    let html = '<div style="color:#ff88ff;margin-bottom:12px;letter-spacing:1px">DEBUG MENU</div>';
    html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;font-size:6px">';
    html += '<span style="color:#aabbcc;min-width:80px">COLLISIONS</span>';
    html += '<label style="display:flex;align-items:center;gap:6px;cursor:pointer">';
    html += '<input type="checkbox" id="debug-collisions-toggle" '+(collisionsEnabled?'checked':'')+' style="accent-color:#ff88ff;width:13px;height:13px">';
    html += '<span id="debug-collisions-label" style="font-size:6px;color:#ff88ff;font-family:\'Press Start 2P\',monospace">'+(collisionsEnabled?'ON':'OFF')+'</span>';
    html += '</label></div>';
    html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;font-size:6px">';
    html += '<span style="color:#aabbcc;min-width:80px">FPS</span>';
    html += '<label style="display:flex;align-items:center;gap:6px;cursor:pointer">';
    html += '<input type="checkbox" id="debug-fps-toggle" '+(fpsEnabled?'checked':'')+' style="accent-color:#ffdd44;width:13px;height:13px">';
    html += '<span id="debug-fps-label" style="font-size:6px;color:#ffdd44;font-family:\'Press Start 2P\',monospace">'+(fpsEnabled?'ON':'OFF')+'</span>';
    html += '</label></div>';
    html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;font-size:6px">';
    html += '<span style="color:#aabbcc;min-width:80px">GOD MODE</span>';
    html += '<label style="display:flex;align-items:center;gap:6px;cursor:pointer">';
    html += '<input type="checkbox" id="debug-godmode-toggle" '+(godmodeEnabled?'checked':'')+' style="accent-color:#ff44ff;width:13px;height:13px">';
    html += '<span id="debug-godmode-label" style="font-size:6px;color:#ff44ff;font-family:\'Press Start 2P\',monospace">'+(godmodeEnabled?'ON':'OFF')+'</span>';
    html += '</label></div>';
    html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;font-size:6px">';
    html += '<span style="color:#aabbcc;min-width:80px">BG</span>';
    html += '<label style="display:flex;align-items:center;gap:6px;cursor:pointer">';
    html += '<input type="checkbox" id="debug-bg-toggle" '+(game?._bgEnabled!==false?'checked':'')+' style="accent-color:#88ccff;width:13px;height:13px">';
    html += '<span id="debug-bg-label" style="font-size:6px;color:#88ccff;font-family:\'Press Start 2P\',monospace">'+(game?._bgEnabled!==false?'ON':'OFF')+'</span>';
    html += '</label></div>';
    html += '<div style="margin-top:14px;border-top:1px solid #334;padding-top:12px">';
    html += '<button id="debug-clear-cache" style="font-family:\'Press Start 2P\',monospace;font-size:6px;color:#ff5544;background:rgba(40,12,12,0.9);border:2px solid #ff5544;padding:8px 10px;cursor:pointer;letter-spacing:1px">CLEAR CACHE &amp; RESTART</button>';
    html += '</div>';
    list.innerHTML = html;

    document.getElementById('debug-clear-cache')?.addEventListener('click', () => {
      if(!confirm('Clear all saved data and restart the game?')) return;
      try { localStorage.clear(); } catch(_) {}
      try { sessionStorage.clear(); } catch(_) {}
      if('caches' in window) { caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))).finally(() => location.reload()); }
      else location.reload();
    });

    document.getElementById('debug-collisions-toggle')?.addEventListener('change', e => {
      const enabled = e.target.checked;
      if(game) game.collisionsEnabled = enabled;
      document.getElementById('debug-collisions-label').textContent = enabled ? 'ON' : 'OFF';
    });

    document.getElementById('debug-fps-toggle')?.addEventListener('change', e => {
      const enabled = e.target.checked;
      const fpsEl = document.getElementById('fps-counter');
      if(fpsEl) {
        fpsEl.classList.toggle('hidden', !enabled);
        if(game) game._fpsEl = enabled ? fpsEl : null;
      }
      document.getElementById('debug-fps-label').textContent = enabled ? 'ON' : 'OFF';
    });

    document.getElementById('debug-godmode-toggle')?.addEventListener('change', e => {
      const enabled = e.target.checked;
      if(game) game._godMode = enabled;
      document.getElementById('debug-godmode-label').textContent = enabled ? 'ON' : 'OFF';
    });

    document.getElementById('debug-bg-toggle')?.addEventListener('change', e => {
      const enabled = e.target.checked;
      if(game) game._bgEnabled = enabled;
      document.getElementById('debug-bg-label').textContent = enabled ? 'ON' : 'OFF';
    });

    overlay.classList.remove('hidden');
    if(game) game.paused = true;
  }

  showCameraMenu() {
    const overlay = document.getElementById('camera-overlay');
    const list = document.getElementById('camera-list');
    if(!overlay || !list) return;

    const game = G.game;
    let html = '<div style="color:#00ddff;margin-bottom:12px;letter-spacing:1px">CAMERA</div>';

    // Spaceflight camera
    html += '<div style="color:#88ddff;margin-bottom:8px;margin-top:12px;font-size:6px;letter-spacing:1px">SPACEFLIGHT</div>';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:6px">';
    html += '<span style="color:#aabbcc;min-width:100px">MIN ZOOM</span>';
    html += '<input type="range" id="cam-space-minzoom" min="0.1" max="1.0" step="0.05" value="'+(game?.spacecam_minZoom||0.2875)+'" style="flex:1;accent-color:#00ddff">';
    html += '<span id="cam-space-minzoom-val" style="color:#00ddff;min-width:40px">'+((game?.spacecam_minZoom||0.2875).toFixed(2))+'</span>';
    html += '</div>';

    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:6px">';
    html += '<span style="color:#aabbcc;min-width:100px">MAX ZOOM</span>';
    html += '<input type="range" id="cam-space-maxzoom" min="1.0" max="6.0" step="0.1" value="'+(game?.spacecam_maxZoom||4.04)+'" style="flex:1;accent-color:#00ddff">';
    html += '<span id="cam-space-maxzoom-val" style="color:#00ddff;min-width:40px">'+((game?.spacecam_maxZoom||4.04).toFixed(2))+'</span>';
    html += '</div>';

    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:6px">';
    html += '<span style="color:#aabbcc;min-width:100px">SENSITIVITY</span>';
    html += '<input type="range" id="cam-space-sens" min="0.0001" max="0.005" step="0.0001" value="'+(game?.spacecam_sensitivity||0.0008)+'" style="flex:1;accent-color:#00ddff">';
    html += '<span id="cam-space-sens-val" style="color:#00ddff;min-width:50px">'+((game?.spacecam_sensitivity||0.0008).toFixed(4))+'</span>';
    html += '</div>';

    // Hexmap camera
    html += '<div style="color:#88ddff;margin-bottom:8px;margin-top:12px;font-size:6px;letter-spacing:1px">HEXMAP</div>';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:6px">';
    html += '<span style="color:#aabbcc;min-width:100px">MIN ZOOM</span>';
    html += '<input type="range" id="cam-hex-minzoom" min="0.1" max="1.0" step="0.05" value="'+(game?.hexmapcam_minZoom||0.3)+'" style="flex:1;accent-color:#00ddff">';
    html += '<span id="cam-hex-minzoom-val" style="color:#00ddff;min-width:40px">'+((game?.hexmapcam_minZoom||0.3).toFixed(2))+'</span>';
    html += '</div>';

    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:6px">';
    html += '<span style="color:#aabbcc;min-width:100px">MAX ZOOM</span>';
    html += '<input type="range" id="cam-hex-maxzoom" min="1.0" max="6.0" step="0.1" value="'+(game?.hexmapcam_maxZoom||3.5)+'" style="flex:1;accent-color:#00ddff">';
    html += '<span id="cam-hex-maxzoom-val" style="color:#00ddff;min-width:40px">'+((game?.hexmapcam_maxZoom||3.5).toFixed(2))+'</span>';
    html += '</div>';

    // Planet camera
    html += '<div style="color:#88ddff;margin-bottom:8px;margin-top:12px;font-size:6px;letter-spacing:1px">PLANET VIEW</div>';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:6px">';
    html += '<span style="color:#aabbcc;min-width:100px">MIN ZOOM</span>';
    html += '<input type="range" id="cam-planet-minzoom" min="0.1" max="1.0" step="0.05" value="'+(game?.planetcam_minZoom||0.4)+'" style="flex:1;accent-color:#00ddff">';
    html += '<span id="cam-planet-minzoom-val" style="color:#00ddff;min-width:40px">'+((game?.planetcam_minZoom||0.4).toFixed(2))+'</span>';
    html += '</div>';

    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:6px">';
    html += '<span style="color:#aabbcc;min-width:100px">MAX ZOOM</span>';
    html += '<input type="range" id="cam-planet-maxzoom" min="1.0" max="6.0" step="0.1" value="'+(game?.planetcam_maxZoom||1.0)+'" style="flex:1;accent-color:#00ddff">';
    html += '<span id="cam-planet-maxzoom-val" style="color:#00ddff;min-width:40px">'+((game?.planetcam_maxZoom||1.0).toFixed(2))+'</span>';
    html += '</div>';

    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:6px">';
    html += '<span style="color:#aabbcc;min-width:100px">SENSITIVITY</span>';
    html += '<input type="range" id="cam-planet-sens" min="0.0001" max="0.005" step="0.0001" value="'+(game?.planetcam_sensitivity||0.0008)+'" style="flex:1;accent-color:#00ddff">';
    html += '<span id="cam-planet-sens-val" style="color:#00ddff;min-width:50px">'+((game?.planetcam_sensitivity||0.0008).toFixed(4))+'</span>';
    html += '</div>';

    list.innerHTML = html;

    // Event listeners
    document.getElementById('cam-space-minzoom')?.addEventListener('input', e => {
      const val = parseFloat(e.target.value);
      if(game) game.spacecam_minZoom = val;
      document.getElementById('cam-space-minzoom-val').textContent = val.toFixed(2);
    });
    document.getElementById('cam-space-maxzoom')?.addEventListener('input', e => {
      const val = parseFloat(e.target.value);
      if(game) game.spacecam_maxZoom = val;
      document.getElementById('cam-space-maxzoom-val').textContent = val.toFixed(2);
    });
    document.getElementById('cam-space-sens')?.addEventListener('input', e => {
      const val = parseFloat(e.target.value);
      if(game) game.spacecam_sensitivity = val;
      document.getElementById('cam-space-sens-val').textContent = val.toFixed(4);
    });
    document.getElementById('cam-hex-minzoom')?.addEventListener('input', e => {
      const val = parseFloat(e.target.value);
      if(game) game.hexmapcam_minZoom = val;
      document.getElementById('cam-hex-minzoom-val').textContent = val.toFixed(2);
    });
    document.getElementById('cam-hex-maxzoom')?.addEventListener('input', e => {
      const val = parseFloat(e.target.value);
      if(game) game.hexmapcam_maxZoom = val;
      document.getElementById('cam-hex-maxzoom-val').textContent = val.toFixed(2);
    });
    document.getElementById('cam-planet-minzoom')?.addEventListener('input', e => {
      const val = parseFloat(e.target.value);
      if(game) game.planetcam_minZoom = val;
      document.getElementById('cam-planet-minzoom-val').textContent = val.toFixed(2);
    });
    document.getElementById('cam-planet-maxzoom')?.addEventListener('input', e => {
      const val = parseFloat(e.target.value);
      if(game) game.planetcam_maxZoom = val;
      document.getElementById('cam-planet-maxzoom-val').textContent = val.toFixed(2);
    });
    document.getElementById('cam-planet-sens')?.addEventListener('input', e => {
      const val = parseFloat(e.target.value);
      if(game) game.planetcam_sensitivity = val;
      document.getElementById('cam-planet-sens-val').textContent = val.toFixed(4);
    });

    overlay.classList.remove('hidden');
  }

  showShipMenu() {
    const overlay = document.getElementById('ship-overlay');
    const body = document.getElementById('ship-body');
    if(!overlay || !body) return;
    const p = G.game?.player;
    if(!p) return;

    const shipTpl = G.SHIPS[p.templateId];
    const maxHull = Math.max(p.maxHull, 1);
    const hullPct = Math.round(p.hull / maxHull * 100);
    const maxEnergy = Math.max(p.maxEnergy, 1);
    const energyPct = Math.round(p.energy / maxEnergy * 100);

    const modules = p.modules || {};
    let weaponsHtml = '';
    let modulesHtml = '';
    for(const [instId, inst] of Object.entries(modules)) {
      const def = G.WEAPONS[inst.moduleId] || G.MODULES[inst.moduleId];
      if(!def) continue;
      const isWpn = !!(G.WEAPONS[inst.moduleId]);
      const broken = inst.broken ? ' <span style="color:#ff4444">[BROKEN]</span>' : '';
      const hpBar = `<span style="color:#44ff88">${Math.ceil(inst.hp||0)}</span>hp`;
      const row = `<div style="font-size:6px;margin-bottom:1px;display:flex;justify-content:space-between"><span style="color:#aabbcc">${def.name}</span><span>${hpBar}${broken}</span></div>`;
      if(isWpn) weaponsHtml += row; else modulesHtml += row;
    }
    if(weaponsHtml) weaponsHtml = `<div style="margin-top:8px"><div style="color:#ff8844;margin-bottom:3px">WEAPONS</div>${weaponsHtml}</div>`;
    if(modulesHtml) modulesHtml = `<div style="margin-top:8px"><div style="color:#556677;margin-bottom:3px">MODULES</div>${modulesHtml}</div>`;

    // Ammo counts
    let ammoHtml = '';
    const ammo = p.ammo || {};
    for(const [id, qty] of Object.entries(ammo)) {
      if(qty > 0) ammoHtml += `<div style="font-size:6px;margin-bottom:1px"><span style="color:#ffcc44">${G.ITEMS[id]?.name || id}</span>: ${qty}</div>`;
    }
    if(ammoHtml) ammoHtml = `<div style="margin-top:8px"><div style="color:#556677;margin-bottom:3px">AMMO</div>${ammoHtml}</div>`;

    let html = `
      <div style="margin-bottom:12px">
        <div style="color:#ffcc44;margin-bottom:6px">PLAYER SHIP</div>
        <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
          <span style="color:#556677;font-size:6px">NAME:</span>
          <input id="ship-name-input" type="text" value="${p.name || 'Unnamed'}" style="background:transparent;border:1px solid #556677;color:#aaaaaa;padding:2px 4px;font-family:'Press Start 2P',monospace;font-size:6px;flex:1" maxlength="30">
          <button class="btn" id="ship-rename-btn" style="font-size:5px;padding:2px 8px">RENAME</button>
        </div>
      </div>
      <div style="color:#667788;line-height:1.6;font-size:6px">
        <div style="color:#556677;margin-bottom:3px">SHIP CLASS: <span style="color:#aabbcc">${shipTpl?.name || '?'}</span></div>
        <div>HULL: <span style="color:#44ff88">${Math.ceil(p.hull)} / ${p.maxHull}</span> (${hullPct}%)</div>
        <div>SHIELDS: <span style="color:#4488ff">${Math.ceil(p.shields)} / ${p.maxShields}</span></div>
        <div>ENERGY: <span style="color:#ffcc44">${Math.ceil(p.energy)} / ${p.maxEnergy}</span> (${energyPct}%)</div>
        <div>FUEL: <span style="color:#ffaa44">${Math.ceil(p.fuel)} / ${p.maxFuel}</span></div>
        <div style="margin-top:6px;color:#556677">STATS</div>
        <div>MASS: ${Math.round(p.mass)} t &nbsp; THRUST: ${Math.round(p.thrustPower)} N &nbsp; TURN: ${Math.round(p.turnSpeed*100)/100} rad/s</div>
        <div>CARGO: ${G.game.fleetCargoUsed()} / ${G.game.fleetCargoSpace()} &nbsp; SENSOR: ${p.sensorRange}</div>
        ${weaponsHtml}${ammoHtml}${modulesHtml}
      </div>
    `;

    body.innerHTML = html;
    document.getElementById('ship-rename-btn')?.addEventListener('click', () => {
      const newName = document.getElementById('ship-name-input')?.value.trim();
      if(newName) {
        p.name = newName;
        this.addMsg('Ship renamed to: ' + newName, '#ffcc44');
      }
      overlay.classList.add('hidden');
      G.game.paused = false;
    });
    overlay.classList.remove('hidden');
    G.game.paused = true;
  }

  _voiceParamsForNPC(npc) {
    let hash = 0;
    const key = (npc.name || npc.id || 'unknown') + (npc.faction || '');
    for (let i = 0; i < key.length; i++) hash = ((hash * 31) + key.charCodeAt(i)) >>> 0;
    const rng = (n) => ((hash * (n + 1) * 1664525 + 1013904223) >>> 0) / 0xFFFFFFFF;
    // Very low pitch for robot effect; minor per-NPC variation
    let pitch = Math.max(0.01, Math.min(0.25, 0.05 + rng(1) * 0.18));
    // Female captains: +0.12 pitch (about +1 octave)
    if(npc.captain && npc.captain.sex === 'female') pitch += 0.12;
    pitch = Math.max(0.01, Math.min(0.35, pitch));
    // Rate: 1.5× faster than base, small per-NPC variation
    const rate  = Math.max(0.8,  Math.min(2.0,  1.35 + rng(2) * 0.30));
    return { pitch, rate };
  }

  _speakComms(text) {
    // Resolve any leftover {name} placeholder before speaking/displaying — TTS
    // pronounces the bare word otherwise. Other unresolved {tokens} are stripped.
    const sn = this._commsNPC;
    const npcName = sn?.name
      || (sn?.faction && G.FACTIONS[sn.faction] ? G.FACTIONS[sn.faction].name.toUpperCase() + ' VESSEL' : 'vessel');
    text = text.replace(/\{name\}/g, npcName).replace(/\{[^}]*\}/g, '').replace(/\s{2,}/g, ' ');

    const resp = this.els['comms-response-text'];
    this._worldCommsText = '';
    if(window.speechSynthesis) speechSynthesis.cancel();
    if(!this._voiceEnabled || !window.speechSynthesis) {
      if(resp) resp.textContent = text;
      this._worldCommsText = text;
      return;
    }
    if(resp) resp.textContent = '';
    const utter = new SpeechSynthesisUtterance(text);
    utter.volume = this._voiceVolume ?? 0.25;
    const npc = this._commsNPC;
    if(npc) { const vp = this._voiceParamsForNPC(npc); utter.pitch = vp.pitch; utter.rate = vp.rate; }
    else { utter.pitch = 0.1; utter.rate = 1.45; }
    const estDuration = text.split(/\s+/).length * 0.42 / (utter.rate || 0.95);
    G.sound?.voiceChannelOpen(estDuration);
    utter.onboundary = (e) => {
      if(e.name !== 'word') return;
      const displayText = text.substring(0, e.charIndex + e.charLength);
      if(resp) resp.textContent = displayText;
      this._worldCommsText = displayText;
    };
    utter.onend = utter.onerror = () => { if(resp) resp.textContent = text; this._worldCommsText = text; };
    window.speechSynthesis.speak(utter);
  }

  openCommsHostile(npc, line) {
    const overlay = this.els['comms-overlay'];
    if (!overlay || !overlay.classList.contains('hidden')) return;
    this._commsNPC = npc;
    this._drawCommsPortrait(npc);
    const fac = G.FACTIONS[npc.faction] || G.FACTIONS.independent;
    const displayName = npc.name || (fac.name.toUpperCase() + ' VESSEL');
    if (this.els['comms-faction-tag']) {
      this.els['comms-faction-tag'].textContent = fac.name.toUpperCase();
      this.els['comms-faction-tag'].style.color = fac.color;
    }
    if (this.els['comms-ship-name']) this.els['comms-ship-name'].textContent = displayName;
    const list = this.els['comms-options-list'];
    if (list) list.innerHTML = '';
    G.sound?.commsPing();
    this._speakComms('"' + line + '"');
    overlay.classList.remove('hidden');
    clearTimeout(this._noRespTimer);
    this._noRespTimer = setTimeout(() => this.closeComms(), 3500);
  }

  closeComms() {
    clearTimeout(this._noRespTimer);
    if(window.speechSynthesis) speechSynthesis.cancel();
    this.els['comms-overlay']?.classList.add('hidden');
    this._commsNPC = null;
    this._worldCommsText = '';
  }

  showSTCWelcome(portName, faction, pod) {
    const overlay = this.els['comms-overlay'];
    if(!overlay) return;
    const stc = { type:'planet', faction: faction||'neutral', name: portName+' Control' };
    this._commsNPC = stc;
    this._drawCommsPortrait(stc);
    const fac = G.FACTIONS[stc.faction] || G.FACTIONS.neutral;
    if(this.els['comms-faction-tag']){ this.els['comms-faction-tag'].textContent='SPACE TRAFFIC CONTROL'; this.els['comms-faction-tag'].style.color=fac.color; }
    if(this.els['comms-ship-name']) this.els['comms-ship-name'].textContent = portName+' Control';
    if(this.els['comms-options-list']) this.els['comms-options-list'].innerHTML='';
    // Emergency escape-pod arrival gets its own rescue dialogue.
    if(pod) {
      const n = pod.survived || 1;
      const podLines = [
        'Distress beacon received — your escape pod is down safe at '+portName+'. '+n+' aboard recovered.',
        portName+' Control: emergency pod tracked and retrieved. '+n+' survivor'+(n!==1?'s':'')+' safe. Your ship was lost.',
        'Mayday acknowledged. Rescue crews have you, pilot — '+n+' made it to '+portName+'. Hang in there.',
      ];
      const line = podLines[Math.floor(Math.random()*podLines.length)];
      G.sound?.commsPing();
      this._speakComms('"'+line+'"');
      overlay.classList.remove('hidden');
      clearTimeout(this._noRespTimer);
      this._noRespTimer = setTimeout(()=>this.closeComms(), 5200);
      return;
    }
    const lines = [
      'Welcome to '+portName+'. Docking sequence complete — enjoy your stay.',
      portName+' Control to inbound vessel — docking confirmed. Welcome aboard.',
      'Berth assigned and locked. Welcome to '+portName+', pilot.',
      'Docking clamps secure. '+portName+' Control welcomes you. Safe harbor.',
      portName+' here — your bay is ready. Welcome. Have a good stay.',
      'Touchdown confirmed, '+portName+'. Fuel and supplies available dockside.',
      'Cleared and docked at '+portName+'. Control out — welcome.',
      portName+' Control: docking complete. Rest up, pilot. You\'ve earned it.',
    ];
    const line = lines[Math.floor(Math.random()*lines.length)];
    G.sound?.commsPing();
    this._speakComms('"'+line+'"');
    overlay.classList.remove('hidden');
    clearTimeout(this._noRespTimer);
    this._noRespTimer = setTimeout(()=>this.closeComms(), 3800);
  }

  // ── Boarding popup ────────────────────────────────────────
  showBoardingPopup(enemy) {
    this._boardingTarget = enemy;
    const popup = document.getElementById('boarding-popup');
    if(!popup) return;
    const fleetFull = G.game.fleet.length >= 5;
    const el = document.getElementById('boarding-ship-info');
    if(enemy.type === 'derelict') {
      const shape = (enemy.shapeId||'ship').replace(/_/g,' ').toUpperCase();
      if(el) el.innerHTML = `
        <div style="color:#445566">DERELICT ${shape}</div>
        <div><span style="color:#ff6600">ABANDONED</span> — Hull: ${Math.round((enemy.hp||0)/Math.max(enemy.maxHp||1,1)*100)}%</div>
        <div style="color:#44ffaa">Commandeer chance: 100% (no crew)</div>
        <div style="color:#${fleetFull?'ff4444':'556677'}">Fleet: ${G.game.fleet.length}/5 ships</div>`;
    } else {
      const player = G.game.player;
      const playerSize = G.SHIPS[player.templateId]?.size || 1.0;
      const enemyHpScale = (enemy.maxHp||120)/120;
      const enemyEff = (enemy.size||1.0) * enemyHpScale;
      const baseChance = enemy.disabled ? 0.90 : 0.65;
      const chance = G.clamp(baseChance*playerSize/enemyEff, 0.10, 0.95);
      const fac = (enemy.faction||'unknown').toUpperCase();
      const shape = (enemy.shapeId||'ship').replace(/_/g,' ').toUpperCase();
      const statusStr = enemy.disabled ? '<span style="color:#ff6600">DISABLED</span>' : `Hull: ${Math.round((enemy.hp||0)/Math.max(enemy.maxHp||1,1)*100)}%`;
      if(el) el.innerHTML = `
        <div>${fac} ${shape}</div>
        <div>${statusStr}</div>
        <div style="color:#ffcc44">Commandeer chance: ${Math.round(chance*100)}%</div>
        <div style="color:#${fleetFull?'ff4444':'556677'}">Fleet: ${G.game.fleet.length}/5 ships</div>`;
    }
    const resultEl = document.getElementById('boarding-result');
    if(resultEl) resultEl.innerHTML = '';
    const opts = document.getElementById('boarding-options');
    if(opts) opts.style.display = '';
    const cmdBtn = document.getElementById('board-commandeer-btn');
    if(cmdBtn){ cmdBtn.disabled=fleetFull; cmdBtn.style.opacity=fleetFull?'0.4':'1'; }
    popup.classList.remove('hidden');
  }

  closeBoardingPopup() {
    document.getElementById('boarding-popup')?.classList.add('hidden');
    this._boardingTarget = null;
    G.game.paused = false;
  }

  showDisabledShipPopup() {
    const popup = document.getElementById('disabled-ship-popup');
    if(!popup) return;
    const opts = document.getElementById('disabled-ship-options');
    if(!opts) return;
    opts.innerHTML = '';
    const player = G.game?.player;
    const podMods = player ? Object.values(player.modules||{}).filter(m=>m.moduleId==='escape_pod'&&!m.broken) : [];
    const hasPods = podMods.length > 0;

    const helpBtn = document.createElement('button');
    helpBtn.className = 'btn';
    helpBtn.style.fontSize = '6px';
    helpBtn.style.borderColor = '#00ffee';
    helpBtn.style.color = '#00ffee';
    helpBtn.textContent = 'CALL FOR HELP';
    helpBtn.onclick = () => { this.closeDisabledShipPopup(); this._openRescueComms(); };
    opts.appendChild(helpBtn);

    const ejectBtn = document.createElement('button');
    ejectBtn.className = 'btn';
    ejectBtn.style.fontSize = '6px';
    ejectBtn.style.borderColor = '#44ff88';
    ejectBtn.style.color = '#44ff88';
    ejectBtn.textContent = 'EJECT PODS';
    if(!hasPods) {
      ejectBtn.disabled = true;
      ejectBtn.style.borderColor = '#666666';
      ejectBtn.style.color = '#666666';
      ejectBtn.style.cursor = 'not-allowed';
      ejectBtn.style.opacity = '0.5';
      ejectBtn.title = 'no escape pods equipped!';
    } else {
      ejectBtn.onclick = () => {
        G.game.ejectEscapePods();
        this.closeDisabledShipPopup();
      };
    }
    opts.appendChild(ejectBtn);
    const downBtn = document.createElement('button');
    downBtn.className = 'btn';
    downBtn.style.fontSize = '6px';
    downBtn.style.borderColor = '#ff4444';
    downBtn.style.color = '#ff4444';
    downBtn.textContent = hasPods ? 'GO DOWN WITH SHIP' : 'ACCEPT FATE';
    downBtn.onclick = () => {
      G.game._playerDied();
      this.closeDisabledShipPopup();
    };
    opts.appendChild(downBtn);
    popup.classList.remove('hidden');
  }

  _openRescueComms() {
    const space = G.game?.space;
    if(!space) return;
    const rescuers = [...(space.npcs||[]), ...(space.fleetShips||[])]
      .filter(n => !n.dead && !n._deathDone && !n.hostile);
    if(!rescuers.length) {
      this._showCommsNoResponse({ faction:'neutral', name:'All vessels' });
      return;
    }
    const p = G.game.player;
    rescuers.sort((a,b) => Math.hypot(a.x-p.x,a.y-p.y) - Math.hypot(b.x-p.x,b.y-p.y));
    this.openComms(rescuers[0], null, true);
  }

  closeDisabledShipPopup() {
    document.getElementById('disabled-ship-popup')?.classList.add('hidden');
  }

  showLaunchFailedPopup(title, message) {
    const popup = document.getElementById('disabled-ship-popup');
    if(!popup) return;
    const titleEl = popup.querySelector('.panel-title');
    const infoEl = document.getElementById('disabled-ship-info');
    const optsEl = document.getElementById('disabled-ship-options');
    if(titleEl) titleEl.textContent = title;
    if(infoEl) infoEl.textContent = message;
    if(optsEl) optsEl.innerHTML = '';
    popup.classList.remove('hidden');
  }

  // ── Fleet management ──────────────────────────────────────
  showFleetMenu() {
    const overlay = document.getElementById('fleet-overlay');
    if(!overlay) return;
    this._renderFleetMenu();
    overlay.classList.remove('hidden');
    G.game.paused = true;
  }

  _renderFleetMenu() {
    const body = document.getElementById('fleet-body');
    if(!body) return;
    const fleet = G.game.fleet;
    if(!fleet.length) {
      body.innerHTML = `<div style="color:#556677;font-size:7px;padding:20px;text-align:center">No ships in fleet.<br><br>
        <div style="font-size:5px;color:#334455;margin-top:8px">Commandeer disabled enemy ships or hire ships at cantinas.</div></div>`;
      return;
    }
    let html = `<div style="font-size:5px;color:#556677;margin-bottom:10px">Fleet ships escort you in-system and attack your current target.</div>`;
    fleet.forEach((entry, idx) => {
      const s = entry.ship;
      const tpl = G.SHIPS[s.templateId];
      const hpPct = Math.round(s.hull/Math.max(s.maxHull,1)*100);
      const hpCol = hpPct>60?'#44ff88':hpPct>30?'#ffcc44':'#ff4444';
      const modCount = Object.keys(s.modules||{}).length;
      html += `<div style="border:1px solid #1a4a6a;padding:10px;margin-bottom:8px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <div>
            <div style="font-size:7px;color:#00ffee">${entry.fleetName}</div>
            <div style="font-size:5px;color:#556677;margin-top:2px">${tpl?.name||s.templateId} · SPD ${Math.round(entry.combatSpeed||280)}</div>
          </div>
          <button class="btn btn-sell" style="font-size:5px" onclick="G.ui.dismissFleetShip('${entry.id}')">DISMISS</button>
        </div>
        <div style="display:flex;gap:12px;margin-bottom:6px">
          <div style="font-size:5px;color:#aabbcc">HULL: <span style="color:${hpCol}">${Math.ceil(s.hull)}/${s.maxHull}</span></div>
          <div style="font-size:5px;color:#aabbcc">MODS: ${modCount}</div>
        </div>
        <button class="btn btn-buy" style="font-size:5px" onclick="G.ui.openFleetShipConfig(${idx})">CONFIGURE MODULES</button>
      </div>`;
    });
    body.innerHTML = html;
  }

  dismissFleetShip(id) {
    const farewells = ['It\'s been an honor, Captain. Safe travels.',
                       'Understood. Going our own way. Good luck out there.',
                       'Copy that. We\'ll find our own path. Fly safe.',
                       'Roger. Breaking formation. It was a pleasure serving with you.'];
    const msg = farewells[Math.floor(Math.random()*farewells.length)];
    const entry = G.game.fleet.find(e=>e.id===id);
    if(entry) this.addMsg(entry.fleetName+': "'+msg+'"','#00ffee');
    G.game.releaseFleetShip(id);
    this._renderFleetMenu();
  }

  openFleetShipConfig(fleetIdx) {
    const entry = G.game.fleet[fleetIdx];
    if(!entry) return;
    const body = document.getElementById('fleet-body');
    if(!body) return;
    const s = entry.ship;
    const playerInventory = G.game.player.moduleInventory || [];

    let equippedHtml = '<div style="font-size:6px;color:#aaa;margin-bottom:5px">INSTALLED MODULES</div>';
    let hasAny = false;
    (s.slots||[]).forEach((instId) => {
      if(!instId) return;
      hasAny = true;
      const inst = s.modules[instId];
      const mod = inst ? (G.MODULES[inst.moduleId]||G.WEAPONS[inst.moduleId]) : null;
      if(!mod) return;
      const removeBtn = `<button class="btn btn-remove" style="font-size:5px;padding:2px 4px;margin-top:3px;width:100%"
        onclick="G.ui.fleetRemoveModule(${fleetIdx},'${instId}')">REMOVE TO INVENTORY</button>`;
      equippedHtml += `<div class="item-card" style="margin-bottom:6px">${this._modCardHTML(mod, removeBtn)}</div>`;
    });
    if(!hasAny) equippedHtml += '<div style="font-size:6px;color:#556677">No modules installed.</div>';

    let inventoryHtml = '<div style="font-size:6px;color:#aaa;margin-top:12px;margin-bottom:5px">YOUR MODULE INVENTORY</div>';
    if(!playerInventory.length) {
      inventoryHtml += '<div style="font-size:6px;color:#556677">No modules in inventory.</div>';
    } else {
      playerInventory.forEach((modId, i) => {
        const mod = G.MODULES[modId]||G.WEAPONS[modId];
        if(!mod) return;
        const installBtn = `<button class="btn btn-buy" style="font-size:5px;padding:2px 4px;margin-top:3px;width:100%"
          onclick="G.ui.fleetInstallModule(${fleetIdx},${i})">INSTALL</button>`;
        inventoryHtml += `<div class="item-card" style="margin-bottom:6px">${this._modCardHTML(mod, installBtn)}</div>`;
      });
    }

    body.innerHTML = `
      <button class="btn" style="font-size:5px;margin-bottom:10px" onclick="G.ui._renderFleetMenu()">← BACK</button>
      <div style="font-size:7px;color:#00ffee;margin-bottom:8px">${entry.fleetName} — MODULES</div>
      <div style="font-size:5px;color:#556677;margin-bottom:10px">Stats: Hull ${Math.ceil(s.hull)}/${s.maxHull} · SPD ${Math.round(entry.combatSpeed||280)} · DMG ${Math.round(entry.combatDamage||15)}</div>
      ${equippedHtml}${inventoryHtml}`;
  }

  fleetRemoveModule(fleetIdx, instId) {
    const entry = G.game.fleet[fleetIdx];
    if(!entry) return;
    const inst = entry.ship.modules[instId];
    if(!inst) return;
    if(!entry.ship.canRemoveModule(instId)){
      const mod = G.MODULES[inst.moduleId];
      const reason = mod?.slot==='cockpit' ? 'Cockpit required' : mod?.slot==='core' ? 'Class core module required' : mod?.slot==='thruster' ? 'Minimum thrusters required' : 'Minimum power module required';
      this.addMsg(reason+' — cannot remove','#ff8844'); return;
    }
    entry.ship.removeModule(instId);
    if(!G.game.player.moduleInventory) G.game.player.moduleInventory=[];
    G.game.player.moduleInventory.push(inst.moduleId);
    this.addMsg('Module removed to your inventory.','#aabbcc');
    this.openFleetShipConfig(fleetIdx);
  }

  fleetInstallModule(fleetIdx, inventoryIdx) {
    const entry = G.game.fleet[fleetIdx];
    if(!entry) return;
    const player = G.game.player;
    const modId = (player.moduleInventory||[])[inventoryIdx];
    if(!modId) return;
    const instId = entry.ship.installModule(modId);
    if(instId) {
      player.moduleInventory.splice(inventoryIdx, 1);
      this.addMsg('Module installed on fleet ship.','#44ff88');
      this.openFleetShipConfig(fleetIdx);
    } else {
      this.addMsg('Cannot install module on fleet ship.','#ff4444');
    }
  }

  // ── Cantina ───────────────────────────────────────────────
  _buildCantinaHTML() {
    const sys = G.SYSTEMS.find(s=>s.id===this._currentSysId);
    const danger = sys?.danger || 1;
    const routes = G.game.galaxy.routes[this._currentSysId] || [];
    const intelCost = 120 + danger * 75;
    const options = this._getCantinaRecruits(sys);
    const fleetCount = G.game.fleet.length;

    const recruitHtml = options.map(r => {
      const canHire = fleetCount < 5 && G.game.credits >= r.cost;
      const fac = G.FACTIONS[r.faction];
      const tpl = G.SHIPS[r.templateId];
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px;border:1px solid #1a3a5a;margin-bottom:6px">
        <div style="flex:1">
          <div style="font-size:6px;color:${fac?.color||'#aabbcc'}">${r.name}</div>
          <div style="font-size:5px;color:#556677;margin-top:3px">${tpl?.name||r.templateId} · Hull ${tpl?.baseHull||160} · SPD ${Math.round(r.speed)}</div>
        </div>
        <button class="btn btn-buy" onclick="G.ui.cantinaHire('${r.id}',${r.cost})" ${canHire?'':'disabled style="opacity:0.4"'}>HIRE $${G.fmt(r.cost)}</button>
      </div>`;
    }).join('');

    return `<div class="panel-title">CANTINA</div>
      <div style="font-size:5px;color:#556677;margin-bottom:12px">"The Rusty Comet" — information, rogues, and questionable business.</div>
      <div class="section-title">INTEL BROKER</div>
      <div style="margin-bottom:14px">
        <div style="font-size:6px;color:#aabbcc;margin-bottom:6px">Purchase system intelligence: danger ratings, faction patrols, star charts for adjacent systems.</div>
        <div style="display:flex;align-items:center;gap:10px">
          <button class="btn btn-buy" onclick="G.ui.cantinaIntel(${intelCost})" ${G.game.credits<intelCost?'disabled style="opacity:0.4"':''}>BUY INTEL — $${intelCost}</button>
          <div id="cantina-intel-result" style="font-size:6px;color:#ffcc44"></div>
        </div>
      </div>
      <div class="section-title">MERCENARY CREWS</div>
      <div style="font-size:6px;color:#aabbcc;margin-bottom:4px">Hire ships to join your fleet. They will escort and fight alongside you.</div>
      <div style="font-size:5px;color:#${fleetCount>=5?'ff4444':'556677'};margin-bottom:8px">Fleet capacity: ${fleetCount}/5 ships</div>
      ${recruitHtml}`;
  }

  _bindCantina() {}

  cantinaIntel(cost) {
    if(G.game.credits < cost){ this.addMsg('Not enough credits!','#ff4444'); return; }
    G.game.credits -= cost;
    const routes = G.game.galaxy.routes[this._currentSysId] || [];
    const revealed = [];
    for(const sysId of routes) {
      if(!G.game.galaxy.known.has(sysId)){
        G.game.galaxy.known.add(sysId);
        const sys = G.SYSTEMS.find(s=>s.id===sysId);
        if(sys) revealed.push(sys);
      }
    }
    const el = document.getElementById('cantina-intel-result');
    if(revealed.length) {
      if(el) el.textContent = 'Revealed: '+revealed.map(s=>s.name+'[D'+s.danger+']').join(', ');
      this.addMsg('Intel: '+revealed.length+' new system(s) charted.','#ffcc44');
    } else {
      const adjInfo = routes.map(id=>G.SYSTEMS.find(s=>s.id===id)).filter(Boolean)
        .map(s=>s.name+'['+s.faction+'/D'+s.danger+']').join(', ');
      if(el) el.textContent = 'All known. Adjacent: '+adjInfo;
      G.game.credits += Math.floor(cost/2);
      this.addMsg('No new systems — partial refund.','#778899');
    }
    this.renderSpaceportTab('cantina');
  }

  cantinaHire(recruitId, cost) {
    if(G.game.fleet.length>=5){ this.addMsg('Fleet at capacity!','#ff4444'); return; }
    if(G.game.credits<cost){ this.addMsg('Not enough credits!','#ff4444'); return; }
    const sys = G.SYSTEMS.find(s=>s.id===this._currentSysId);
    const options = this._getCantinaRecruits(sys);
    const recruit = options.find(r=>r.id===recruitId);
    if(!recruit) return;
    G.game.credits -= cost;
    const tpl = G.SHIPS[recruit.templateId];
    const ship = new G.Ship(recruit.templateId);
    ship._recompute();
    const suffixes = ['Thunderbolt','Iron Claw','Voidstriker','Dawn Runner','Steel Fang','Apex'];
    const prefixes = { earth:'EGS',rebellion:'RFS',pirate:'RS',independent:'MV',neutral:'SS',contested:'RV' };
    const pre = prefixes[recruit.faction]||'MV';
    const suf = suffixes[Math.floor(Math.random()*suffixes.length)];
    const entry = {
      id: 'fleet_'+Date.now(),
      fleetName: pre+' '+suf,
      ship,
      combatSpeed: recruit.speed,
      combatTurnSpeed: G.MODULES['core_'+(tpl?.id||'')]?.stats?.turnBase || 2.0,
      combatDamage: 12 + (tpl?.size||1)*8,
      combatFireRate: 0.8 + Math.random()*0.6,
      combatWeaponType: 'laser',
      combatWeaponColor: G.FACTIONS[recruit.faction]?.color || '#44aaff',
    };
    G.game.fleet.push(entry);
    if(this._cantinaCache) delete this._cantinaCache['cantina_'+this._currentSysId];
    this.addMsg(entry.fleetName+' hired and joins fleet!','#44ff88');
    this.renderSpaceportTab('cantina');
  }

  _getCantinaRecruits(sys) {
    const key = 'cantina_'+(this._currentSysId||'?');
    if(!this._cantinaCache) this._cantinaCache = {};
    if(this._cantinaCache[key]) return this._cantinaCache[key];
    const danger = sys?.danger || 1;
    const faction = sys?.faction || 'independent';
    const poolsByFaction = {
      earth:       ['earth_shuttle','earth_corvette','shuttle'],
      rebellion:   ['rebel_runner','rebel_corvette','corvette'],
      pirate:      ['pirate_skiff','pirate_corvette','corvette'],
      contested:   ['pirate_skiff','shuttle','corvette'],
      independent: ['shuttle','miner_ship','corvette'],
      neutral:     ['shuttle','corvette'],
    };
    const pool = (poolsByFaction[faction]||poolsByFaction.independent).filter(id=>G.SHIPS[id]);
    const count = 2 + (danger>=5?1:0);
    const shuffled = [...pool].sort(()=>Math.random()-0.5).slice(0,count);
    const result = shuffled.map((tplId,i) => {
      const tpl = G.SHIPS[tplId];
      const sizeFactor = tpl?.size||1.0;
      const cost = Math.floor((1200 + sizeFactor*1800 + danger*180)*(0.85+Math.random()*0.3));
      const _rcMass = G.MODULES['core_'+(tpl?.id||'')]?.stats?.mass || 80;
      const speed = (tpl?.baseThrust||8000)/_rcMass*1.5 + 80;
      const factionLabels = { earth:'EGS Mercenary',rebellion:'Rebel Contractor',pirate:'Rogue Blade',
        independent:'Free Pilot',neutral:'Drifter',contested:'Scavenger' };
      return {
        id: 'recruit_'+tplId+'_'+i,
        name: (factionLabels[tpl?.faction||faction]||'Merc')+' — '+tpl?.name,
        templateId: tplId,
        faction: tpl?.faction||faction,
        cost, speed,
      };
    });
    this._cantinaCache[key] = result;
    return result;
  }

  updateFactionPanel() {
    const el = document.getElementById('opt-factions');
    if(!el || !G.game) return;

    const factionIds = ['earth','rebellion','pirate','alien'];
    const statusLabel = r => {
      if(r >= 50)  return { text:'ALLIED',      color:'#44ff88' };
      if(r >= 20)  return { text:'FRIENDLY',    color:'#88ff44' };
      if(r >= -20) return { text:'NEUTRAL',     color:'#aaaaaa' };
      if(r >= -50) return { text:'UNFRIENDLY',  color:'#ffaa00' };
      return            { text:'HOSTILE',       color:'#ff3333' };
    };

    el.innerHTML = factionIds.map(id => {
      const fac = G.FACTIONS[id];
      const rel = G.game.getRel(id);
      const pct = ((rel + 100) / 200 * 100).toFixed(1);
      const st  = statusLabel(rel);
      // bar colour: blend from red at 0% to green at 100% via faction colour
      const barCol = rel >= 0 ? '#44aa66' : '#aa3322';
      return `
        <div style="margin-bottom:9px">
          <div style="display:flex;justify-content:space-between;margin-bottom:3px">
            <span style="font-size:6px;font-family:'Press Start 2P',monospace;color:${fac.color}">${fac.name.toUpperCase()}</span>
            <span style="font-size:6px;font-family:'Press Start 2P',monospace;color:${st.color}">${st.text}</span>
          </div>
          <div style="position:relative;height:5px;background:#111;border:1px solid #223">
            <div style="position:absolute;top:0;left:0;height:100%;width:${pct}%;background:${barCol};transition:width 0.3s"></div>
            <div style="position:absolute;top:0;left:50%;width:1px;height:100%;background:#334"></div>
          </div>
          <div style="text-align:right;font-size:5px;font-family:'Press Start 2P',monospace;color:#445566;margin-top:2px">${rel > 0 ? '+' : ''}${rel}</div>
        </div>`;
    }).join('');
  }

  _drawCommsPortrait(target) {
    const el = document.getElementById('comms-portrait');
    if (!el) return;

    let canvas = el.querySelector('canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = 128; canvas.height = 128;
      el.innerHTML = '';
      el.appendChild(canvas);
    }

    const ctx = canvas.getContext('2d');
    const W = 128, H = 128;
    const fac = G.FACTIONS[target?.faction] || G.FACTIONS.independent;

    ctx.fillStyle = '#020a14';
    ctx.fillRect(0, 0, W, H);

    // Bottom gradient in faction color for atmosphere
    const grad = ctx.createLinearGradient(0, H * 0.55, 0, H);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, fac.color + '28');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    const isPlanet = target?.type === 'planet' || target?.type === 'station';
    const shapeId = target?.shapeId || null;

    if (target?.captain && !isPlanet) {
      const FACTION_FILE = { earth:'earth', rebellion:'rebel', pirate:'pirate', alien:'alien', neutral:'independent' };
      const fid = target.faction || 'neutral';
      const sex = target.captain.sex || 'male';
      const avatarUrl = `avatars/${FACTION_FILE[fid]}_${sex}.png`;
      const avatarImg = new Image();
      avatarImg.onload = () => {
        const scale = Math.min(W / 72, H / 90);
        const dw = (72 * scale) | 0, dh = (90 * scale) | 0;
        const dx = ((W - dw) / 2) | 0, dy = ((H - dh) / 2) | 0;
        ctx.globalCompositeOperation = 'lighten';
        ctx.drawImage(avatarImg, dx, dy, dw, dh);
        ctx.globalCompositeOperation = 'source-over';

        // Draw captain's name below avatar
        ctx.fillStyle = fac.color;
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const captainName = target.captain.name || 'UNKNOWN';
        ctx.fillText(captainName, W / 2, H - 14);
      };
      avatarImg.src = avatarUrl;
      if(avatarImg.complete) {
        avatarImg.onload();
      }
    } else if (isPlanet || !shapeId) {
      // Faction emblem: concentric rings + initial
      const cx = W / 2, cy = H / 2;
      ctx.strokeStyle = fac.color + '55';
      ctx.lineWidth = 1;
      for (const r of [44, 34, 24]) {
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.strokeStyle = fac.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = fac.color;
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((fac.name || '?')[0], cx, cy);
    } else {
      const sprite = G.Sprites.get(shapeId, target.color || '#8899bb');
      const SZ = G.Sprites.SZ;  // 32
      const SCALE = 3;
      const sx = ((W - SZ * SCALE) / 2) | 0;
      const sy = ((H - SZ * SCALE) / 2) | 0;

      // Glow pass
      ctx.save();
      ctx.shadowColor = fac.color;
      ctx.shadowBlur = 18;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sprite, sx, sy, SZ * SCALE, SZ * SCALE);
      ctx.restore();

      // Crisp sprite on top
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sprite, sx, sy, SZ * SCALE, SZ * SCALE);
    }

    // Scanline overlay for CRT feel
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    for (let y = 0; y < H; y += 2) ctx.fillRect(0, y, W, 1);

    // Corner bracket decorations
    const bl = 10;
    ctx.strokeStyle = fac.color + 'aa';
    ctx.lineWidth = 1.5;
    for (const [bx, by, dx, dy] of [[0,0,1,1],[W,0,-1,1],[0,H,1,-1],[W,H,-1,-1]]) {
      ctx.beginPath();
      ctx.moveTo(bx + dx*bl, by); ctx.lineTo(bx, by); ctx.lineTo(bx, by + dy*bl);
      ctx.stroke();
    }
  }

  showCharCreate(onConfirm) {
    const overlay = document.getElementById('char-create-overlay');
    overlay.classList.remove('hidden');
    document.getElementById('main-menu').classList.add('hidden');

    const FACTIONS = [
      { id:'earth',     name:'EARTH GOV',  color:'#4488ff' },
      { id:'rebellion', name:'REBELLION',   color:'#ff6600' },
      { id:'pirate',    name:'PIRATES',     color:'#ff1111' },
      { id:'alien',     name:'THE SHARD',   color:'#00ff88' },
      { id:'neutral',   name:'INDEPENDENT', color:'#888888' },
    ];

    let sex = 'female', factionId = 'earth', faceIdx = 0, shipId = 'shuttle', startingAbility = 'frost_nova', classId = 'space_marine';

    // Starting ship selection
    const STARTING_SHIPS = [
      { id: 'shuttle',    label: 'SHUTTLE',  desc: 'Shields, medium cargo' },
      { id: 'fighter',    label: 'FIGHTER',  desc: 'Missiles, no shields'  },
      { id: 'miner_ship', label: 'MINER',    desc: 'Tough hull, mining'    },
    ];
    const shipGrid = document.getElementById('char-ship-grid');
    shipGrid.innerHTML = '';
    STARTING_SHIPS.forEach((s, si) => {
      const wrap = document.createElement('div');
      wrap.className = 'char-ship-wrap' + (si === 0 ? ' selected' : '');

      const ship = new G.Ship(s.id);
      const entries = [];
      for(const [, inst] of Object.entries(ship.modules || {})) {
        if(inst.q == null) continue;
        const mod = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
        if(!mod) continue;
        const entry = {
          q: inst.q, r: inst.r,
          visual: mod.visual || (G.WEAPONS[inst.moduleId] ? 'weapon' : 'special'),
          slot: mod.slot || 'special',
          broken: false,
        };
        if(mod.slot === 'hull') entry.color = inst.color || '#667799';
        entries.push(entry);
      }

      const c = document.createElement('canvas');
      c.width = 140; c.height = 120;
      const ctx2 = c.getContext('2d');
      ctx2.imageSmoothingEnabled = false;

      if(entries.length > 0 && G.game?.renderer) {
        // Measure bounding box to find scale that fits canvas
        const R_test = G.HEX_R;
        let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
        for(const e of entries) {
          const p = G.hexToPixel(e.q, e.r, R_test);
          if(p.x - R_test < minx) minx = p.x - R_test;
          if(p.x + R_test > maxx) maxx = p.x + R_test;
          if(p.y - R_test < miny) miny = p.y - R_test;
          if(p.y + R_test > maxy) maxy = p.y + R_test;
        }
        const bw = maxx - minx, bh = maxy - miny;
        const scale = Math.min((c.width - 8) / bw, (c.height - 8) / bh, 3);

        // Render into an offscreen canvas at the computed scale, then blit
        const off = document.createElement('canvas');
        off.width = c.width * 2; off.height = c.height * 2;
        const renderer = G.game.renderer;
        const prevCtx = renderer.ctx;
        renderer.ctx = off.getContext('2d');
        renderer.ctx.imageSmoothingEnabled = false;
        renderer.drawShipTileDisplay(off.width / 2, off.height / 2, scale, entries, 0);
        renderer.ctx = prevCtx;

        ctx2.drawImage(off, 0, 0, c.width, c.height);
      }

      wrap.appendChild(c);
      wrap.insertAdjacentHTML('beforeend', `<div class="char-ship-name">${s.label}</div><div class="char-ship-desc">${s.desc}</div>`);
      wrap.addEventListener('click', () => {
        shipId = s.id;
        shipGrid.querySelectorAll('.char-ship-wrap').forEach((w, j) => w.classList.toggle('selected', j === si));
      });
      wrap.addEventListener('dblclick', () => {
        shipId = s.id;
        const name = nameInput.value.trim() || 'Commander';
        overlay.classList.add('hidden');
        onConfirm({ name, sex, faceIdx, factionId, shipId, classId });
      });
      shipGrid.appendChild(wrap);
    });

    // Faction buttons
    const factionRow = document.getElementById('char-faction-btns');
    factionRow.innerHTML = FACTIONS.map(f =>
      `<button class="btn char-faction-btn${f.id==='earth'?' active':''}" data-faction="${f.id}" style="border-color:${f.color};color:${f.color}">${f.name}</button>`
    ).join('');

    // Class selection grid
    const classGrid = document.getElementById('char-class-grid');
    if(classGrid && G.CLASSES) {
      classGrid.innerHTML = '';
      Object.values(G.CLASSES).forEach((cls, ci) => {
        const wrap = document.createElement('div');
        wrap.className = 'char-ship-wrap' + (cls.id === classId ? ' selected' : '');
        wrap.style.borderColor = cls.id === classId ? cls.color : '';
        wrap.innerHTML = `<div style="font-size:20px;color:${cls.color};margin:6px 0">${cls.icon}</div>
          <div class="char-ship-name" style="color:${cls.color}">${cls.name}</div>
          <div class="char-ship-desc">${cls.desc}</div>`;
        wrap.addEventListener('click', () => {
          classId = cls.id;
          classGrid.querySelectorAll('.char-ship-wrap').forEach((w, j) => {
            const c2 = Object.values(G.CLASSES)[j];
            w.classList.toggle('selected', c2.id === classId);
            w.style.borderColor = c2.id === classId ? c2.color : '';
          });
          redrawAbility();
        });
        classGrid.appendChild(wrap);
      });
    }

    // Single faction+sex avatar image
    const FACTION_FILE = { earth:'earth', rebellion:'rebel', pirate:'pirate', alien:'alien', neutral:'independent' };
    const faceGrid = document.getElementById('char-face-grid');
    faceGrid.innerHTML = '';
    const avatarImg = document.createElement('img');
    avatarImg.className = 'char-avatar-img';
    faceGrid.appendChild(avatarImg);

    const redraw = () => {
      avatarImg.src = `avatars/${FACTION_FILE[factionId]}_${sex}.png`;
    };

    // Reset form state
    const nameInput = document.getElementById('char-name-input');
    nameInput.value = '';
    document.getElementById('sex-male').classList.remove('active');
    document.getElementById('sex-female').classList.add('active');
    faceIdx = 0;

    document.getElementById('sex-male').onclick = () => {
      sex = 'male';
      document.getElementById('sex-male').classList.add('active');
      document.getElementById('sex-female').classList.remove('active');
      redraw();
    };
    document.getElementById('sex-female').onclick = () => {
      sex = 'female';
      document.getElementById('sex-female').classList.add('active');
      document.getElementById('sex-male').classList.remove('active');
      redraw();
    };

    factionRow.onclick = e => {
      const btn = e.target.closest('[data-faction]');
      if (!btn) return;
      factionId = btn.dataset.faction;
      factionRow.querySelectorAll('[data-faction]').forEach(b => b.classList.toggle('active', b === btn));
      redraw();
    };

    // Starting ability preview — updates with class selection
    const abilityGrid = document.getElementById('char-ability-grid');
    const redrawAbility = () => {
      if(!abilityGrid) return;
      const cls = G.CLASSES[classId];
      const def = cls?.startAbility ? G.ABILITIES?.[cls.startAbility] : null;
      abilityGrid.innerHTML = def
        ? `<div class="char-ship-wrap selected" style="text-align:center;cursor:default;border-color:${def.color}">
            <div style="font-size:20px;color:${def.color};margin:6px 0">${def.icon}</div>
            <div class="char-ship-name" style="color:${def.color}">${def.name}</div>
            <div class="char-ship-desc">${def.desc}</div>
            <div style="font-size:5px;color:#556677;margin-top:2px">CD: ${def.cooldown}s  E: ${def.energyCost}</div>
          </div>`
        : '<div style="font-size:6px;color:#556677;padding:8px">No starting ability</div>';
    };
    redrawAbility();

    document.getElementById('char-confirm-btn').onclick = () => {
      const name = nameInput.value.trim() || 'Commander';
      overlay.classList.add('hidden');
      onConfirm({ name, sex, faceIdx, factionId, shipId, classId });
    };

    redraw();
  }

  _drawFaceAvatar(canvas, faceIdx, sex, factionColor) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    const cx = 36, hcy = 30, hr = 16;

    const skins  = ['#f5d5b0','#d4956a','#7a4a2a','#c9a882','#eea880'];
    const eyeCol = ['#5599ee','#44bb66','#cc8820','#9988cc','#bb5522'];
    const skin   = skins[faceIdx];

    const mHair = [
      ['#3a1e0a','buzz'],
      ['#111111','spiky'],
      ['#c8a020','wavy'],
      ['#888888','receding'],
      ['#6b2c0c','medium'],
    ];
    const fHair = [
      ['#ddc020','long_straight'],
      ['#1a1a1a','pixie'],
      ['#aa2200','bun'],
      ['#cccccc','bob'],
      ['#5c3018','curly'],
    ];
    const [hairCol, hairStyle] = sex === 'male' ? mHair[faceIdx] : fHair[faceIdx];

    // Hair (behind head)
    ctx.fillStyle = hairCol;
    this._drawCharHair(ctx, cx, hcy, hr, hairStyle);

    // Ears
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.ellipse(cx - hr, hcy + 2, 3, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + hr, hcy + 2, 3, 4.5, 0, 0, Math.PI * 2); ctx.fill();

    // Head
    ctx.beginPath();
    ctx.ellipse(cx, hcy, hr - 1, hr, 0, 0, Math.PI * 2);
    ctx.fillStyle = skin;
    ctx.fill();

    // Eye whites
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(cx - 5, hcy - 2, 3.5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 5, hcy - 2, 3.5, 2.5, 0, 0, Math.PI * 2); ctx.fill();

    // Irises
    ctx.fillStyle = eyeCol[faceIdx];
    ctx.beginPath(); ctx.arc(cx - 5, hcy - 2, 2.0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 5, hcy - 2, 2.0, 0, Math.PI * 2); ctx.fill();

    // Pupils
    ctx.fillStyle = '#000000';
    ctx.beginPath(); ctx.arc(cx - 5, hcy - 2, 1.0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 5, hcy - 2, 1.0, 0, Math.PI * 2); ctx.fill();

    // Eyebrows
    ctx.strokeStyle = hairCol;
    ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 8, hcy - 7); ctx.lineTo(cx - 2.5, hcy - 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 8, hcy - 7); ctx.lineTo(cx + 2.5, hcy - 8); ctx.stroke();

    // Nose
    const skinD = this._shadeColor(skin, -25);
    ctx.strokeStyle = skinD; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - 2, hcy + 4); ctx.lineTo(cx, hcy + 6); ctx.lineTo(cx + 2, hcy + 4); ctx.stroke();

    // Mouth + optional beard
    ctx.strokeStyle = skinD; ctx.lineWidth = 1.5;
    if (sex === 'male' && faceIdx === 3) {
      ctx.beginPath(); ctx.moveTo(cx - 4, hcy + 10); ctx.lineTo(cx + 4, hcy + 10); ctx.stroke();
      ctx.fillStyle = 'rgba(136,136,136,0.55)';
      ctx.beginPath(); ctx.ellipse(cx, hcy + 13, 10, 5, 0, 0, Math.PI); ctx.fill();
    } else if (sex === 'male' && faceIdx === 4) {
      ctx.beginPath(); ctx.arc(cx, hcy + 11, 4, 0.2, Math.PI - 0.2); ctx.stroke();
      ctx.fillStyle = hairCol + 'bb';
      ctx.beginPath(); ctx.ellipse(cx, hcy + 13, 9, 4, 0, 0, Math.PI); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(cx, hcy + 10, 4, 0.2, Math.PI - 0.2); ctx.stroke();
    }

    // Neck
    ctx.fillStyle = skin;
    ctx.fillRect(cx - 5, hcy + hr - 2, 10, 8);

    // Body / faction clothing
    const bodyY = hcy + hr + 5;
    ctx.fillStyle = factionColor;
    ctx.beginPath();
    ctx.moveTo(cx - 20, H);
    ctx.lineTo(cx - 14, bodyY);
    ctx.lineTo(cx + 14, bodyY);
    ctx.lineTo(cx + 20, H);
    ctx.closePath(); ctx.fill();

    // Collar lapels
    ctx.fillStyle = this._shadeColor(factionColor, 50);
    ctx.beginPath(); ctx.moveTo(cx - 8, bodyY); ctx.lineTo(cx, bodyY + 8); ctx.lineTo(cx - 3, bodyY); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 8, bodyY); ctx.lineTo(cx, bodyY + 8); ctx.lineTo(cx + 3, bodyY); ctx.closePath(); ctx.fill();

    // Face highlight
    const hl = ctx.createRadialGradient(cx - 4, hcy - 5, 2, cx, hcy, hr);
    hl.addColorStop(0, 'rgba(255,255,255,0.15)');
    hl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hl;
    ctx.beginPath(); ctx.ellipse(cx, hcy, hr - 1, hr, 0, 0, Math.PI * 2); ctx.fill();
  }

  _drawCharHair(ctx, cx, hcy, hr, style) {
    switch (style) {
      case 'buzz':
        ctx.beginPath(); ctx.arc(cx, hcy, hr + 1, Math.PI, Math.PI * 2); ctx.fill();
        ctx.fillRect(cx - hr - 1, hcy - 2, (hr + 1) * 2, 3);
        break;
      case 'spiky': {
        ctx.beginPath(); ctx.arc(cx, hcy, hr + 1, Math.PI, Math.PI * 2); ctx.fill();
        const xs = [-hr, -hr + 5, 0, hr - 5, hr];
        const hs = [14, 18, 20, 16, 12];
        for (let i = 0; i < 5; i++) {
          const bx = cx + xs[i];
          ctx.beginPath();
          ctx.moveTo(bx - 3, hcy - hr + 1);
          ctx.lineTo(bx, hcy - hr - hs[i]);
          ctx.lineTo(bx + 3, hcy - hr + 1);
          ctx.closePath(); ctx.fill();
        }
        break;
      }
      case 'wavy':
        ctx.beginPath(); ctx.arc(cx, hcy - 3, hr + 4, Math.PI * 0.65, Math.PI * 2.35); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx - hr - 2, hcy + 5, 5, 9, 0.1, 0, Math.PI); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx + hr + 2, hcy + 5, 5, 9, -0.1, 0, Math.PI); ctx.fill();
        break;
      case 'receding':
        ctx.beginPath(); ctx.arc(cx, hcy, hr + 1, Math.PI * 1.15, Math.PI * 1.85); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx - hr + 1, hcy + 3, 4, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx + hr - 1, hcy + 3, 4, 8, 0, 0, Math.PI * 2); ctx.fill();
        break;
      case 'medium':
        ctx.beginPath(); ctx.arc(cx, hcy - 2, hr + 2, Math.PI * 0.8, Math.PI * 2.2); ctx.fill();
        ctx.fillRect(cx - hr - 3, hcy - 6, 5, 20);
        ctx.fillRect(cx + hr - 2, hcy - 6, 5, 20);
        break;
      case 'long_straight':
        ctx.beginPath(); ctx.arc(cx, hcy - 2, hr + 3, Math.PI * 0.75, Math.PI * 2.25); ctx.fill();
        ctx.fillRect(cx - hr - 4, hcy - 5, 7, 36);
        ctx.fillRect(cx + hr - 3, hcy - 5, 7, 36);
        break;
      case 'pixie':
        ctx.beginPath(); ctx.arc(cx, hcy - 4, hr + 2, Math.PI * 0.65, Math.PI * 2.35); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx + 9, hcy - hr, 5, 4, -0.5, 0, Math.PI * 2); ctx.fill();
        break;
      case 'bun':
        ctx.beginPath(); ctx.arc(cx, hcy - 1, hr + 1, Math.PI * 0.85, Math.PI * 2.15); ctx.fill();
        ctx.beginPath(); ctx.arc(cx, hcy - hr - 8, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath(); ctx.arc(cx, hcy - hr - 1, 3.5, 0, Math.PI * 2); ctx.fill();
        break;
      case 'bob':
        ctx.beginPath(); ctx.arc(cx, hcy - 1, hr + 4, Math.PI * 0.7, Math.PI * 2.3); ctx.fill();
        ctx.fillRect(cx - hr - 5, hcy - 3, 7, 22);
        ctx.fillRect(cx + hr - 2, hcy - 3, 7, 22);
        ctx.fillRect(cx - hr - 4, hcy + 18, hr * 2 + 8, 5);
        break;
      case 'curly': {
        const pts = [
          Math.PI * 1.0, Math.PI * 1.15, Math.PI * 1.3,
          Math.PI * 1.5, Math.PI * 1.7, Math.PI * 1.85, Math.PI * 2.0,
        ];
        for (const a of pts) {
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * (hr + 3), hcy + Math.sin(a) * (hr + 3), 6.5, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
    }
  }

  _shadeColor(hex, amount) {
    const h = hex.replace('#','').slice(0, 6).padEnd(6, '0');
    const n = parseInt(h, 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amount));
    const b = Math.max(0, Math.min(255, (n & 0xff) + amount));
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  _setupMenuNav() {
    const OVERLAYS = [
      'comms-overlay','options-overlay','spaceport-overlay',
      'inventory-overlay','mission-log-overlay','gameover-overlay','main-menu',
    ];

    const activeOverlay = () => {
      for (const id of OVERLAYS) {
        const el = document.getElementById(id);
        if (el && !el.classList.contains('hidden')) return el;
      }
      return null;
    };

    document.addEventListener('keydown', e => {
      const isNav   = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',
                       'KeyW','KeyS','KeyA','KeyD'].includes(e.code);
      const isEnter = e.code === 'Enter';
      if (!isNav && !isEnter) return;

      const container = activeOverlay();
      if (!container) return;

      // Get all focusable/interactive elements: tabs, buttons, mission cards, etc.
      const selectors = [
        'button.btn:not([disabled]):not(.hidden)',
        'button.tab:not([disabled])',
        '[role="button"][tabindex]',
        '.mission-card',
        '.item-card'
      ];
      const btns = [...container.querySelectorAll(selectors.join(','))];
      if (!btns.length) return;

      e.preventDefault();

      const focused = document.activeElement;
      let curIdx  = btns.indexOf(focused);

      // If currently focused is within a card, try to find the card itself
      if (curIdx < 0 && focused) {
        const card = focused.closest('.mission-card, .item-card');
        if (card) curIdx = btns.indexOf(card);
      }

      if (isEnter) {
        if (curIdx >= 0) {
          const btn = btns[curIdx];
          // If it's a card, click the button inside it
          const innerBtn = btn.querySelector('button');
          if (innerBtn) innerBtn.click();
          else btn.click();
        } else {
          btns[0].focus();
        }
        return;
      }

      const prev = ['ArrowUp','ArrowLeft','KeyW','KeyA'].includes(e.code);
      if (curIdx < 0) {
        btns[0].focus();
      } else if (prev) {
        btns[(curIdx - 1 + btns.length) % btns.length].focus();
      } else {
        btns[(curIdx + 1) % btns.length].focus();
      }
    });
  }
};
