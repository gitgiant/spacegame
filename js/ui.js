'use strict';
// ── UI Manager ────────────────────────────────────────────

// Slot visual positions as [left%, top%] on the ship canvas overlay (300×260)
G.SLOT_RING = {
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
      if (s.autoRepair)     rows.push(['REPAIR',  '+' + s.autoRepair + '/s']);
      if (s.canMine)        rows.push(['MINE',    '✓']);
      if (s.mineRate)       rows.push(['RATE',    '+' + s.mineRate + '/s']);
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
      'tgt-hull-bar','tgt-shld-bar','tgt-dist','tgt-canvas','tgt-arrow',
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
    this.els['comms-response-text']= document.getElementById('comms-response-text');
    this.els['comms-options-list'] = document.getElementById('comms-options-list');

    document.getElementById('comms-close-btn')?.addEventListener('click',()=>this.closeComms());
    document.getElementById('close-log-btn')?.addEventListener('click',()=>this.hideMissionLog());
    document.getElementById('close-combat-log-btn')?.addEventListener('click',()=>this.hideCombatLog());
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
      }
    });
    document.getElementById('launch-btn').addEventListener('click',()=>G.game.launch());
    document.getElementById('close-inv-btn')?.addEventListener('click',()=>this.hideInventory());
    document.getElementById('restart-btn').addEventListener('click',()=>G.game.restart());
    document.getElementById('start-btn').addEventListener('click',()=>G.game.start());
    document.getElementById('opt-save-btn')?.addEventListener('click',()=>{
      G.game.saveGame();
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
    // Boarding popup
    document.getElementById('board-loot-btn')?.addEventListener('click',()=>{
      const e = this._boardingTarget; if(!e) return;
      const savedCreds = e.credits || 0;
      const res = G.game.space.boardEnemy(e, G.game.player);
      const el = document.getElementById('boarding-result');
      if(el) el.innerHTML = res
        ? `<span style="color:#ffcc00">Looted: +${G.fmtCredits(savedCreds)}${res.items?.length?' + '+res.items.length+' items':''}</span>`
        : '<span style="color:#ff4444">Nothing to take.</span>';
      document.getElementById('boarding-options').style.display='none';
      G.sound?.lootPickup();
    });
    document.getElementById('board-scuttle-btn')?.addEventListener('click',()=>{
      const e = this._boardingTarget; if(!e) return;
      G.game.space.scuttleEnemy(e);
      const el = document.getElementById('boarding-result');
      if(el) el.innerHTML = '<span style="color:#ff6644">Ship scuttled — debris scattered.</span>';
      document.getElementById('boarding-options').style.display='none';
    });
    document.getElementById('board-commandeer-btn')?.addEventListener('click',()=>{
      const e = this._boardingTarget; if(!e) return;
      const res = G.game.commandeerShip(e);
      const el = document.getElementById('boarding-result');
      if(el) el.innerHTML = res.success
        ? `<span style="color:#44ff88">Success! ${res.entry.fleetName} joins your fleet.</span>`
        : `<span style="color:#ff4444">Failed (${Math.round(res.chance*100)}% odds): ${res.reason}</span>`;
      document.getElementById('boarding-options').style.display='none';
    });
    document.getElementById('boarding-close-btn')?.addEventListener('click',()=>this.closeBoardingPopup());
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
    });
    document.getElementById('opt-music-volume')?.addEventListener('input', e=>{
      const v = parseInt(e.target.value) / 100;
      document.getElementById('opt-music-vol-val').textContent = e.target.value + '%';
      G.sound?.setMusicVolume(v);
    });
    document.getElementById('opt-fps-enabled')?.addEventListener('change', e=>{
      const on = e.target.checked;
      document.getElementById('opt-fps-label').textContent = on ? 'ON' : 'OFF';
      const el = document.getElementById('fps-counter');
      if(el) { el.classList.toggle('hidden', !on); G.game._fpsEl = on ? el : null; }
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

  updateHUD(player, space, target) {
    const p=player, e=this.els;
    const hPct=G.pct(p.hull,p.maxHull), sPct=G.pct(p.shields,Math.max(p.maxShields,1));
    const fPct=G.pct(p.fuel,p.maxFuel);
    if(e['bar-hull']) {
      e['bar-hull'].style.width=hPct+'%';
      e['bar-hull'].style.background = p.disabled ? '#556677' : '';
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
      const used=p.cargoCount();
      e['cargo-hud'].textContent='CARGO '+used+'/'+p.cargoSpace;
      e['cargo-hud'].style.color=used>=p.cargoSpace?'#ff4444':'';
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

    // Target panel: always show sprite + bars when a target is locked
    if(target && !target.dead) {
      if(e['target-panel']) e['target-panel'].classList.remove('hidden');

      // Draw sprite into panel canvas (only when shape/color changes)
      const shapeId = target.shapeId || 'shuttle';
      const color   = target.color   || '#8899bb';
      const tgtCanvas = e['tgt-canvas'];
      if(tgtCanvas && (this._tgtPortShape !== shapeId || this._tgtPortColor !== color)) {
        this._tgtPortShape = shapeId;
        this._tgtPortColor = color;
        const ctx = tgtCanvas.getContext('2d');
        ctx.fillStyle = '#000a18';
        ctx.fillRect(0, 0, 48, 48);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(G.Sprites.get(shapeId, color), 0, 0, 48, 48);
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
        const tShip  = target.name || tpl?.name || 'SHIP';
        const tFac   = target.faction||'?';
        const facColor = G.FACTIONS[tFac]?.color || '#888888';
        const isHostile = target.hostile || (target.faction && (G.game?.getRel(target.faction)||0) < -30 && target !== G.game?.player);
        const hostileTag = isHostile ? ' <span style="color:#ff3333">■ HOSTILE</span>' : ' <span style="color:#44ff88">■ NEUTRAL</span>';
        e['tgt-name'].innerHTML = tShip.toUpperCase() + ' <span style="color:' + facColor + '">■ ' + tFac.toUpperCase() + '</span>' + hostileTag;
      }
      if(target.disabled && (target.disabledHp !== undefined)) {
        if(e['tgt-hull-bar']) { e['tgt-hull-bar'].style.width=G.pct(Math.max(0,target.disabledHp),50)+'%'; e['tgt-hull-bar'].style.background='#ff6600'; }
      } else {
        if(e['tgt-hull-bar']) { e['tgt-hull-bar'].style.width=G.pct(target.hp||target.hull,target.maxHp||target.maxHull)+'%'; e['tgt-hull-bar'].style.background=''; }
      }
      if(e['tgt-shld-bar']) e['tgt-shld-bar'].style.width=G.pct(target.shields,Math.max(target.maxShields,1))+'%';
      const td=Math.sqrt((target.x-player.x)**2+(target.y-player.y)**2)|0;
      if(e['tgt-dist']) e['tgt-dist'].textContent=td+' units'+(target.disabled?' [DISABLED]':'');
    } else {
      if(e['target-panel']) e['target-panel'].classList.add('hidden');
      this._tgtPortShape = null; this._tgtPortColor = null;
    }
  }

  // ── Spaceport ────────────────────────────────────────────
  showSpaceport(name, sysId) {
    this._currentSysId=sysId;
    this._spTab='trade';
    if(this._cantinaCache) delete this._cantinaCache['cantina_'+sysId];
    if(this.els['sp-name']) this.els['sp-name'].textContent=name.toUpperCase();
    // Show cantina tab only at systems with a cantina
    const sys = G.SYSTEMS.find(s=>s.id===sysId);
    const cantinaTab = document.getElementById('cantina-tab');
    if(cantinaTab) cantinaTab.classList.toggle('hidden', !sys?.hasCantina);
    this._updateSpStatusBar();
    this.renderSpaceportTab('trade');
    document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab==='trade'));
    this.els['spaceport-overlay']?.classList.remove('hidden');
    G.game._hideHUD();
  }

  hideSpaceport(){
    this.els['spaceport-overlay']?.classList.add('hidden');
  }

  _updateSpStatusBar(){
    const p=G.game.player;
    if(this.els['sp-credits']) this.els['sp-credits'].textContent='Credits: '+G.fmtCredits(G.game.credits);
    if(this.els['sp-cargo'])   this.els['sp-cargo'].textContent='Cargo: '+p.cargoCount()+'/'+p.cargoSpace;
    if(this.els['sp-ship'])    this.els['sp-ship'].textContent='Ship: '+p.name;
  }

  renderSpaceportTab(tab){
    const body=this.els['sp-body'];
    if(!body) return;
    this._spTab=tab;
    switch(tab){
      case 'trade':     body.innerHTML=this._buildTradeHTML();     break;
      case 'missions':  body.innerHTML=this._buildMissionsHTML();  this._bindMissions();  setTimeout(()=>this._drawMiniGalaxy(document.getElementById('mission-preview-canvas'),null),10); break;
      case 'outfitter': body.innerHTML=this._buildOutfitterHTML(); this._bindOutfitter(); setTimeout(()=>this._drawOutfitterShip(),30); break;
      case 'shipyard':  body.innerHTML=this._buildShipyardHTML();  this._bindShipyard();  setTimeout(()=>this._drawShipPreviews(),50); break;
      case 'crew':      body.innerHTML=this._buildCrewHTML();      this._bindCrew();      break;
      case 'repair':    body.innerHTML=this._buildRepairHTML();    this._bindRepair();    break;
      case 'craft':     body.innerHTML=this._buildCraftHTML();     this._bindCraft();     break;
      case 'inventory': body.innerHTML=this._buildModInventoryHTML(); this._bindModInventory(); break;
      case 'cantina':   body.innerHTML=this._buildCantinaHTML();      this._bindCantina();      break;
    }
    this._updateSpStatusBar();
  }

  // ── Trade ────────────────────────────────────────────────
  _buildTradeHTML(){
    const market=G.game.economy.getMarket(this._currentSysId);
    const p=G.game.player;
    const hasCargo = Object.values(p.cargo || {}).some(qty => qty > 0);
    let html=`<div class="panel-title">MARKETPLACE</div>
    <div style="font-size:6px;color:#556677;margin-bottom:6px;display:flex;align-items:center;gap:12px">
      <span>▲ above avg &nbsp; ▼ below avg &nbsp; Sell = 82% of buy price</span>
      <button class="btn btn-sell" onclick="G.ui.tradeSellAll()" style="font-size:6px;padding:3px 8px;${!hasCargo?'opacity:0.4':'cursor:pointer'}" ${!hasCargo?'disabled':''}>SELL ALL CARGO</button>
    </div>
    <table class="trade-table">
    <tr><th>ITEM</th><th>RARITY</th><th>BUY</th><th>TREND</th><th>SELL</th><th>AVAIL</th><th>OWN</th><th style="min-width:80px">BUY</th><th style="min-width:80px">SELL</th></tr>`;
    for(const item of market){
      const baseItem = G.ITEMS[item.id];
      const isAmmo   = baseItem?.cat==='ammo';
      const owned    = isAmmo ? (p.ammo[item.id]||0)+' rds' : (p.cargo[item.id]||0);
      // Apply price multiplier from player purchases
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

      const avBg = item.available === 0 ? 'color:#ff4444' : '';
      html+=`<tr>
        <td title="${baseItem?.desc||''}">${item.name}</td>
        <td class="rarity-${item.rarity}">${G.RARITY[item.rarity]?.label||item.rarity}</td>
        <td class="price-good">$ ${adjustedPrice}</td>
        <td style="font-size:6px;color:${trendCol}">${trend}</td>
        <td class="price-bad">$ ${sell}</td>
        <td style="${avBg}">${item.available}</td>
        <td>${owned}</td>
        <td><button class="btn btn-buy" ${item.available>0?'':'disabled style="opacity:0.3"'} onclick="G.ui.tradeBuy('${item.id}',${adjustedPrice},1)">BUY</button></td>
        <td>${isAmmo
          ? `<button class="btn btn-sell" style="${(p.ammo[item.id]||0)>0?'':'visibility:hidden'}" onclick="G.ui.tradeSellAmmo('${item.id}',${sell})">SELL</button>`
          : `<button class="btn btn-sell" style="${p.cargo[item.id]>0?'':'visibility:hidden'}" onclick="G.ui.tradeSell('${item.id}',${sell},1)">SELL</button>`
        }</td>
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
      // Increase price multiplier exponentially when buying
      const key=this._currentSysId+'_'+itemId;
      if(!G.game.priceMultipliers[key]) G.game.priceMultipliers[key]=1.0;
      G.game.priceMultipliers[key]*=Math.pow(1.08,qty);
      this.renderSpaceportTab('trade');
      return;
    }
    if(G.game.player.cargoFreeSpace()<(item.mass||1)*qty){this.addMsg('Cargo full!','#ff4444');return;}
    G.game.credits-=price*qty;
    G.game.player.addCargo(itemId,qty);
    mItem.available=Math.max(0,mItem.available-qty);
    this.addMsg('Bought '+qty+'x '+item.name,'#44ff44');
    // Increase price multiplier exponentially when buying
    const key=this._currentSysId+'_'+itemId;
    if(!G.game.priceMultipliers[key]) G.game.priceMultipliers[key]=1.0;
    G.game.priceMultipliers[key]*=Math.pow(1.08,qty);
    this.renderSpaceportTab('trade');
  }

  tradeSell(itemId,price,qty){
    if(!G.game.player.removeCargo(itemId,qty)){this.addMsg('Not enough cargo!','#ff4444');return;}
    G.game.credits+=price*qty;
    this.addMsg('Sold '+qty+'x '+(G.ITEMS[itemId]?.name||itemId)+' +'+G.fmtCredits(price*qty),'#ffcc00');
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
        // Pan towards/away from mouse position
        canvas._mapPanX += mouseX * (1 / oldZoom - 1 / canvas._mapZoom);
        canvas._mapPanY += mouseY * (1 / oldZoom - 1 / canvas._mapZoom);
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
    const hasEmpty=p.slots.includes(null);

    // Ship stats
    const statHtml=`<div style="font-size:6px;color:#aaa;line-height:2">
      Hull ${Math.ceil(p.hull)}/${p.maxHull} &nbsp;
      Shld ${Math.ceil(p.shields)}/${p.maxShields} &nbsp;
      Enrg ${Math.ceil(p.energy)}/${p.maxEnergy}<br>
      Fuel ${Math.ceil(p.fuel)}/${p.maxFuel} &nbsp;
      Mass ${p.mass|0} &nbsp;
      Cargo ${p.cargoCount()}/${p.cargoSpace}<br>
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
      const removeBtn=`<button class="btn btn-remove" style="font-size:5px;padding:2px 4px;margin-top:3px;width:100%"
        onclick="G.ui.removeModuleFromSlot('${instId}')" title="Remove module to inventory">REMOVE</button>`;
      equippedHtml+=`<div class="item-card" style="margin-bottom:8px">${this._modCardHTML(mod,removeBtn)}</div>`;
    });
    if(equipCount===0) equippedHtml+='<div style="font-size:6px;color:#556677">No modules installed</div>';
    equippedHtml+='</div>';

    // Slot grid indicator (hidden)
    let slotGrid=`<div style="margin-bottom:10px;display:none"><div style="font-size:6px;color:#aaa;margin-bottom:5px">SLOTS</div><div id="outfit-slot-grid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px">`;
    p.slots.forEach((instId, idx)=>{
      const inst=instId?p.modules[instId]:null;
      const mod=inst?(G.MODULES[inst.moduleId]||G.WEAPONS[inst.moduleId]):null;
      const broken=inst?.broken;
      const col=G.SLOT_RING[mod?.slot]?.color||'#334455';
      slotGrid+=`<div class="outfit-slot-indicator ${instId?'filled':''} ${broken?'broken':''}"
        data-idx="${idx}" data-instid="${instId||''}"
        ondragover="event.preventDefault()"
        ondrop="G.ui.onDropModule(event,${idx})"
        style="border:1px solid ${col};background:#1a3a4a;width:25px;height:25px;display:flex;align-items:center;justify-content:center;font-size:4px;color:${col};cursor:pointer;border-radius:2px;position:relative"
        title="${mod?mod.name:'Empty'}">
        ${instId?'●':'◯'}
      </div>`;
    });
    slotGrid+=`</div></div>`;

    // Slot expansion
    const expLimit=tpl?.expansionLimit||3;
    const bought=this._countBoughtSlots(p);
    const expRemaining=expLimit-bought;
    const nextCost=2000+bought*500;
    const canExpand=expRemaining>0&&G.game.credits>=nextCost;
    const expColor=expRemaining<=0?'#ff4444':expRemaining===1?'#ff8844':'#cc44ff';
    const slotExpHtml=`<div style="margin-top:10px;border-top:1px solid #1a4a6a;padding-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <div style="font-size:6px;color:${expColor}">${p.slots.length} slots &nbsp;·&nbsp; ${expRemaining>0?expRemaining+' expansions left':'HULL FULL'}</div>
      <button class="btn" style="font-size:5px;padding:3px 6px;${canExpand?'':'opacity:0.4'}"
        ${canExpand?'':'disabled'} onclick="G.ui.buySlot()">
        +1 SLOT $${G.fmt(nextCost)}</button>
    </div>`;

    // Slots remaining indicator
    const freeSlots = p.slots.filter(s=>s===null).length;
    const totalSlots = p.slots.length;

    // Modules for sale — filterable by type
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
        onclick="G.ui.buyAndInstall('${mod.id}')"
        ${hasEmpty&&canAfford?'':'disabled style="opacity:0.35"'}>INSTALL</button>`;
      saleList+=`<div class="item-card outfit-sale-item" draggable="true"
        data-modid="${mod.id}" data-slot="${mod.slot}"
        ondragstart="G.ui.onDragModule(event,'${mod.id}')"
        style="opacity:${canAfford?1:0.5}">
        ${this._modCardHTML(mod, actions)}
      </div>`;
    }
    saleList+='</div>';

    // Module inventory section
    const modInv = p.moduleInventory || [];
    let invHtml = '';
    if (modInv.length > 0) {
      invHtml = `<div style="margin-top:15px;border-top:1px solid #1a4a6a;padding-top:10px">
        <div style="font-size:6px;color:#aaa;margin-bottom:5px">STORED MODULES (${modInv.length})</div>
        <div class="outfit-sale-grid">`;
      modInv.forEach((modId, idx) => {
        const mod = G.MODULES[modId] || G.WEAPONS[modId];
        if (!mod) return;
        const sellVal = Math.floor((mod.price||0)*0.5);
        const actions = `
          <button class="btn btn-buy" style="margin-top:5px;font-size:5px;width:100%" data-inv-install="${idx}">INSTALL</button>
          <button class="btn btn-sell" style="margin-top:3px;font-size:5px;width:100%" data-inv-sell="${idx}">SELL $${G.fmt(sellVal)}</button>`;
        invHtml += `<div class="item-card outfit-sale-item">${this._modCardHTML(mod, actions)}</div>`;
      });
      invHtml += `</div></div>`;
    }

    return `<div class="panel-title">OUTFITTER — ${p.name.toUpperCase()} &nbsp;<span style="font-size:6px;color:${freeSlots===0?'#ff4444':'#44ff88'}">${freeSlots}/${totalSlots} SLOTS FREE</span></div>
    <div class="outfit-main">
      <div class="outfit-left">
        ${equippedHtml}
        ${slotGrid}
        ${statHtml}
        ${slotExpHtml}
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

  onDragModule(ev, modId){
    ev.dataTransfer.setData('modId', modId);
  }

  onDropModule(ev, slotIdx){
    ev.preventDefault();
    const modId=ev.dataTransfer.getData('modId');
    if(!modId) return;
    const mod=G.MODULES[modId]||G.WEAPONS[modId];
    if(!mod){ this.addMsg('Unknown module!','#ff4444'); return; }
    if(G.game.credits<mod.price){ this.addMsg('Not enough credits!','#ff4444'); return; }
    const p=G.game.player;
    if(p.slots[slotIdx]!==null){ this.addMsg('Slot occupied — remove first','#ff4444'); return; }
    // Install into the specific slot by temporarily placing null at idx then restoring if needed
    const ok=p.installModule(modId);
    if(ok){ G.game.credits-=mod.price; this.addMsg('Installed '+mod.name,'#44ff44'); this.renderSpaceportTab('outfitter'); }
    else   { this.addMsg('No free slot!','#ff4444'); }
  }

  buyAndInstall(modId){
    const mod=G.MODULES[modId]||G.WEAPONS[modId];
    if(!mod) return;
    if(G.game.credits<mod.price){ this.addMsg('Not enough credits!','#ff4444'); return; }
    const p=G.game.player;
    if(!p.slots.includes(null)){ this.addMsg('No free module slots!','#ff4444'); return; }
    const ok=p.installModule(modId);
    if(ok){ G.game.credits-=mod.price; this.addMsg('Installed '+mod.name,'#44ff44'); this.renderSpaceportTab('outfitter'); }
  }

  _countBoughtSlots(player) {
    const tpl=G.SHIPS[player.templateId];
    if(!tpl) return 0;
    return Math.max(0, player.slots.length - tpl.slots);
  }

  buySlot() {
    const p=G.game.player;
    const tpl=G.SHIPS[p.templateId];
    const expLimit=tpl?.expansionLimit||3;
    const bought=this._countBoughtSlots(p);
    if(bought>=expLimit){ this.addMsg('Hull expansion limit reached ('+expLimit+' max)','#ff8844'); return; }
    const cost=2000+bought*500;
    if(G.game.credits<cost){ this.addMsg('Not enough credits — need '+G.fmtCredits(cost),'#ff4444'); return; }
    p.slots.push(null);
    G.game.credits-=cost;
    this.addMsg('Module bay expanded! ('+(bought+1)+'/'+expLimit+') Slot '+(p.slots.length),'#cc44ff');
    this.renderSpaceportTab('outfitter');
  }

  removeModuleFromSlot(instId){
    const inst=G.game.player.modules[instId];
    if(!inst) return;
    const mod=G.MODULES[inst.moduleId]||G.WEAPONS[inst.moduleId];
    G.game.player.removeModule(instId);
    // Store module in inventory instead of selling it
    if(!G.game.player.moduleInventory) G.game.player.moduleInventory=[];
    G.game.player.moduleInventory.push(inst.moduleId);
    this.addMsg('Removed '+mod?.name+' (stored in inventory)','#ffcc00');
    this.renderSpaceportTab('outfitter');
  }

  _bindOutfitter(){
    document.querySelectorAll('[data-inv-install]').forEach(btn => {
      btn.addEventListener('click', () => this.installFromInventory(+btn.dataset.invInstall));
    });
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

  // ── Module Inventory (spaceport tab) ─────────────────────
  _buildModInventoryHTML() {
    const p = G.game.player;
    const tpl = G.SHIPS[p.templateId];
    if(!Array.isArray(p.slots)) p.slots = new Array(tpl.slots).fill(null);
    const inv = p.moduleInventory || [];
    const hasSlot = p.slots.includes(null);
    let html = `<div class="panel-title">CARGO & MODULES</div>`;

    // Cargo section
    html += `<div style="margin-bottom:15px">
      <div style="font-size:6px;color:#aaa;margin-bottom:5px">CARGO (${p.cargoCount()}/${p.cargoSpace})</div>`;
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
      html += `<div style="color:#556677;font-size:6px">No modules in inventory.<br><br>Modules stored when all slots are full.</div>`;
    } else {
      html += `<div style="font-size:6px;color:#556677;margin-bottom:8px">${hasSlot?' ✓ Free slot available':'⚠ No free slots'}.</div>`;
      html += `<div class="outfit-sale-grid">`;
      inv.forEach((modId, idx) => {
        const mod = G.MODULES[modId] || G.WEAPONS[modId];
        if (!mod) return;
        const actions = `
          <button class="btn btn-buy" style="margin-top:5px;font-size:5px;width:100%" data-inv-install="${idx}"
            ${hasSlot?'':'disabled style="opacity:0.35"'}>INSTALL</button>
          <button class="btn" style="margin-top:3px;font-size:5px;width:100%;border-color:#ff6644;color:#ff6644" data-inv-drop="${idx}">DROP</button>`;
        html += `<div class="item-card outfit-sale-item">${this._modCardHTML(mod, actions)}</div>`;
      });
      html += `</div>`;
    }
    return html;
  }

  _bindModInventory() {
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
    if (!p.slots.includes(null)) { this.addMsg('No free module slots!', '#ff4444'); return; }
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

    let html = `<div class="panel-title">SHIPYARD</div>
    <div class="section-title">CURRENT: ${p.name.toUpperCase()} — Hull ${Math.ceil(p.hull)}/${p.maxHull} Cargo ${p.cargoSpace}</div>
    <div style="font-size:6px;color:#556677;margin-bottom:10px">
      Trade-in: <span style="color:#ffcc00">${G.fmtCredits(hullRefund)}</span> hull
      ${modCount?`+ <span style="color:#ffcc00">${G.fmtCredits(modRefund)}</span> modules`:''}
      = <span style="color:#00ffee">${G.fmtCredits(totalRefund)} total credit</span>
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

        const netCost = ship.price - totalRefund;
        const canAfford = G.game.credits >= netCost;
        const canBuy    = repOk && !isCurrent;
        const netLabel  = netCost <= 0
          ? `<span style="color:#44ff44">+${G.fmtCredits(-netCost)} back</span>`
          : `<span style="color:#ffcc00">Net: ${G.fmtCredits(netCost)}</span>`;

        const lockBadge = !repOk
          ? `<div style="font-size:5px;color:#ff6644;margin:2px 0">LOCKED — Need ${repReq} rep with ${facDef?.name||shipFac}</div>`
          : '';
        const facBadge  = isNeutral ? '' : `<span style="color:${facColor};font-size:5px">${(facDef?.name||shipFac).toUpperCase()}</span>`;
        const expLimit  = ship.expansionLimit || 3;

        html += `<div class="item-card" style="${!repOk?'opacity:0.5':''}">
          <div class="item-name">${ship.name}</div>
          ${facBadge}
          <div style="width:100%;height:90px;background:#000a18;margin:4px 0;display:flex;align-items:center;justify-content:center">
            <canvas width="120" height="88" class="ship-preview" data-shape="${ship.shape}" data-color="${ship.color}"></canvas>
          </div>
          <div class="item-stats">${ship.stats}</div>
          <div style="font-size:6px;color:#cc44ff;margin:2px 0">+${expLimit} expansion slots</div>
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
    document.querySelectorAll('.ship-preview').forEach(canvas=>{
      const ctx=canvas.getContext('2d');
      const cw=canvas.width||120, ch=canvas.height||88;
      ctx.clearRect(0,0,cw,ch);
      ctx.fillStyle='#000a18'; ctx.fillRect(0,0,cw,ch);
      const sprite=G.Sprites.get(canvas.dataset.shape, canvas.dataset.color);
      const SZ=G.Sprites.SZ; // 32
      const scale=2; // 64×64 centered
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(sprite, (cw-SZ*scale)/2|0, (ch-SZ*scale)/2|0, SZ*scale, SZ*scale);
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
    <div class="section-title">CURRENT CREW (${p.crew.length}/${p.maxCrew})</div><div class="three-col">`;
    if(!p.crew.length) html+='<div style="color:#556677;font-size:7px">No crew hired</div>';
    for(const c of p.crew){
      html+=`<div class="item-card"><div class="item-name">${c.name}</div>
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
  }

  // ── Repair ───────────────────────────────────────────────
  _buildRepairHTML(){
    const p=G.game.player;
    const hCost=Math.ceil((p.maxHull-p.hull)*5), sCost=Math.ceil((p.maxShields-p.shields)*3);
    const fCost=Math.ceil((p.maxFuel-p.fuel)*2);
    const broken=Object.entries(p.modules).filter(([,inst])=>inst.broken);
    let html=`<div class="panel-title">REPAIR BAY</div>
    <div class="two-col">
    <div class="item-card"><div class="item-name">Hull Repair</div>
      <div class="item-stats">Damage: ${Math.ceil(p.maxHull-p.hull)} HP — Cost: ${G.fmtCredits(hCost)}</div>
      <button class="btn btn-buy" id="rep-hull" ${p.hull<p.maxHull?'':'disabled style="opacity:0.3"'}>REPAIR HULL</button>
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
    const damagedEscorts = (G.game.fleet || []).filter(e => e.ship && e.ship.hull < e.ship.maxHull);
    if(damagedEscorts.length){
      html+=`<div class="section-title">ESCORT REPAIRS</div><div class="two-col">`;
      for(const entry of damagedEscorts){
        const damage = Math.ceil(entry.ship.maxHull - entry.ship.hull);
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
      const damage = p.maxHull - p.hull;
      if(damage <= 0) return;
      const costPerHp = 5;
      const fullCost = damage * costPerHp;
      const repaired = Math.min(damage, Math.floor(G.game.credits / costPerHp));
      const cost = repaired * costPerHp;
      if(repaired > 0){
        G.game.credits -= cost;
        p.hull += repaired;
        const msg = repaired === damage ? 'Hull repaired' : `Hull repaired ${repaired} of ${Math.ceil(damage)} HP`;
        this.addMsg(msg,'#44ff44');
        this.renderSpaceportTab('repair');
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
        const damage = entry.ship.maxHull - entry.ship.hull;
        if(damage <= 0) return;
        const costPerHp = 5;
        const repaired = Math.min(damage, Math.floor(G.game.credits / costPerHp));
        const cost = repaired * costPerHp;
        if(repaired > 0){
          G.game.credits -= cost;
          entry.ship.hull += repaired;
          const activeFleetShip = G.game.space?.fleetShips?.find(fs => fs.fleetDataId === escortId);
          if(activeFleetShip) activeFleetShip.hull += repaired;
          const msg = repaired === damage ? entry.fleetName + ' repaired' : `${entry.fleetName} repaired ${repaired} of ${Math.ceil(damage)} HP`;
          this.addMsg(msg,'#44ff44');
          this.renderSpaceportTab('repair');
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
        const hasFreeSlot = mod && p.slots.includes(null);
        outputDesc=`➜ <span style="color:#cc44ff">MODULE: ${mod?.name||recipe.outputModule}</span>`
          + (hasFreeSlot?'':' <span style="color:#ff4444">[no slot]</span>');
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
          if(!p.slots.includes(null)){this.addMsg('No free module slots!','#ff4444');return;}
          for(const[id,qty]of Object.entries(recipe.inputs)) p.removeCargo(id,qty);
          p.installModule(recipe.outputModule);
          this.addMsg('Crafted and installed: '+mod.name,'#cc44ff');
          this.renderSpaceportTab('craft');
        } else {
          const res=G.game.economy.craft(btn.dataset.craft,G.game.player);
          this.addMsg(res.msg,res.ok?'#44ff44':'#ff4444');
          if(res.ok) this.renderSpaceportTab('craft');
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
    html+=`</div><div style="margin-top:6px;font-size:7px;color:#556677;margin-bottom:12px">Free space: ${Math.ceil(p.cargoFreeSpace())} units</div>`;

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

    // ── Equipped modules section ──
    html+='<div style="font-size:6px;color:#aabbcc;margin:12px 0 6px;letter-spacing:1px">EQUIPPED MODULES</div>';
    html+='<div class="inv-grid">';
    let equippedAny=false;
    p.slots.forEach((instId)=>{
      if(!instId) return;
      const inst=p.modules[instId];
      const mod=inst?(G.MODULES[inst.moduleId]||G.WEAPONS[inst.moduleId]):null;
      if(!mod) return;
      equippedAny=true;
      html+=`<div class="inv-item rarity-${mod.rarity||'c'}" style="opacity:0.8">
        <div class="inv-name" style="font-size:5px">${mod.name}</div>
        <div style="font-size:5px;color:#556677;margin-top:2px">${G.RARITY[mod.rarity||'c']?.label||mod.rarity||''}</div>
        <div style="font-size:4px;color:#445566;margin-top:2px">equipped</div>
      </div>`;
    });
    if(!equippedAny) html+='<div style="color:#556677;font-size:7px">No modules equipped</div>';
    html+='</div>';

    body.innerHTML=html;

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
          space.floatingLoot.push({
            x:p.x+(Math.random()-0.5)*60, y:p.y+(Math.random()-0.5)*60,
            vx:(Math.random()-0.5)*60, vy:(Math.random()-0.5)*60,
            type:'item', itemId, qty, rarity:G.ITEMS[itemId]?.rarity||'c', ttl:60,
            color:G.rarityColor(G.ITEMS[itemId]?.rarity||'c'),
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
          space.floatingLoot.push({
            x:p.x+(Math.random()-0.5)*60, y:p.y+(Math.random()-0.5)*60,
            vx:(Math.random()-0.5)*60, vy:(Math.random()-0.5)*60,
            type:'module', moduleId:modId, rarity:mod?.rarity||'u', ttl:60,
            color:G.rarityColor(mod?.rarity||'u'),
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
    if(text){ip.textContent=text;ip.classList.remove('hidden');}
    else ip.classList.add('hidden');
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
  }

  // ── Comms system ─────────────────────────────────────────
  openComms(target, forceAction) {
    if(!target || target.dead) return;

    // No-response check (skip for forced actions like fuel requests)
    if(!forceAction && Math.random() < G.commsNoResponseChance(target)) {
      this._showCommsNoResponse(target);
      return;
    }

    G.sound?.commsPing();
    this._commsNPC = target;
    const fac  = G.FACTIONS[target.faction]||G.FACTIONS.independent;
    const fuel = G.game.player.fuel / G.game.player.maxFuel;
    const displayName = target.name || (fac.name.toUpperCase()+' VESSEL');

    if(this.els['comms-faction-tag']) {
      this.els['comms-faction-tag'].textContent = fac.name.toUpperCase();
      this.els['comms-faction-tag'].style.color  = fac.color;
    }
    if(this.els['comms-ship-name']) this.els['comms-ship-name'].textContent = displayName;
    if(this.els['comms-response-text']) this.els['comms-response-text'].textContent = '';

    // Build options — enemies get a stripped-down set
    let opts;
    if(target.type === 'enemy') {
      opts = [{ key:'hail', label:'Hail', color:'#00ffee' }];
      if(target.faction !== 'alien') {
        const cost   = G.npcForgivenessCost(target.faction);
        const chance = Math.round(G.npcForgivenessChance(target.faction) * 100);
        opts.push({ key:'forgive', label:`Beg Forgiveness — ${G.fmtCredits(cost)} (${chance}% success)`, color:'#ffaa00' });
      }
    } else {
      opts = target.getCommsOptions(fuel);
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

  _showCommsNoResponse(target) {
    const bank  = G.COMMS_LINES[target.faction]||G.COMMS_LINES.independent;
    const lines = bank.noresponse||['...'];
    const text  = lines[Math.floor(Math.random()*lines.length)];
    const fac   = G.FACTIONS[target.faction]||G.FACTIONS.independent;
    const displayName = target.name || (fac.name.toUpperCase()+' VESSEL');

    if(this.els['comms-faction-tag']) {
      this.els['comms-faction-tag'].textContent = fac.name.toUpperCase();
      this.els['comms-faction-tag'].style.color  = fac.color;
    }
    if(this.els['comms-ship-name'])    this.els['comms-ship-name'].textContent    = displayName;
    if(this.els['comms-response-text']) this.els['comms-response-text'].textContent = text;
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

    // For enemies, resolve comms manually (no getCommsResponse method)
    if(target.type === 'enemy') {
      if(action === 'hail') {
        const bank  = G.COMMS_LINES[target.faction]||G.COMMS_LINES.independent;
        const lines = bank.hail||['...'];
        if(resp) resp.textContent = '"'+lines[Math.floor(Math.random()*lines.length)]+'"';
        return;
      }
      if(action === 'forgive') {
        this._resolveForgiveness(target, resp);
        return;
      }
      return;
    }

    const res = target.getCommsResponse(action);
    if(resp) resp.textContent = '"'+res.text+'"';

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

    if(action==='forgive' && res.forgiveResult) {
      this._resolveForgiveness(target, resp, res.forgiveResult);
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
      if(respEl) respEl.textContent = '"'+text+'"';
      result = { success, cost };
    }

    if(!result.success) {
      G.sound?.forgiveness(false);
      this.addMsg('They refused. No deal.', '#ff4444');
      return;
    }
    if(G.game.credits < result.cost) {
      G.sound?.forgiveness(false);
      if(respEl) respEl.textContent = '"You can\'t afford it."';
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
    if(G.game.player.cargoFreeSpace()<(item.mass||1)*qty) { this.addMsg('Cargo full!','#ff4444'); return; }
    G.game.credits -= price;
    G.game.player.addCargo(itemId, qty);
    this.addMsg('Bought '+qty+'x '+item.name+' for '+G.fmtCredits(price),'#44ff44');
    this.closeComms();
  }

  closeComms() {
    clearTimeout(this._noRespTimer);
    this.els['comms-overlay']?.classList.add('hidden');
    this._commsNPC = null;
  }

  // ── Boarding popup ────────────────────────────────────────
  showBoardingPopup(enemy) {
    this._boardingTarget = enemy;
    const popup = document.getElementById('boarding-popup');
    if(!popup) return;
    const player = G.game.player;
    const playerSize = G.SHIPS[player.templateId]?.size || 1.0;
    const enemyHpScale = (enemy.maxHp||120)/120;
    const enemyEff = (enemy.size||1.0) * enemyHpScale;
    const chance = G.clamp(0.65*playerSize/enemyEff, 0.06, 0.78);
    const fleetFull = G.game.fleet.length >= 5;
    const fac = (enemy.faction||'unknown').toUpperCase();
    const shape = (enemy.shapeId||'ship').replace(/_/g,' ').toUpperCase();
    const hpPct = Math.round((enemy.hp||0)/Math.max(enemy.maxHp||1,1)*100);
    const el = document.getElementById('boarding-ship-info');
    if(el) el.innerHTML = `
      <div>${fac} ${shape}</div>
      <div>Hull: ${hpPct}% integrity</div>
      <div style="color:#ffcc44">Commandeer chance: ${Math.round(chance*100)}%</div>
      <div style="color:#${fleetFull?'ff4444':'556677'}">Fleet: ${G.game.fleet.length}/5 ships</div>`;
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
      const freeSlots = (s.slots||[]).filter(x=>x===null).length;
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
          <div style="font-size:5px;color:#aabbcc">MODS: ${modCount}/${(s.slots||[]).length}</div>
          <div style="font-size:5px;color:#aabbcc">FREE: ${freeSlots} slots</div>
        </div>
        <button class="btn btn-buy" style="font-size:5px" onclick="G.ui.openFleetShipConfig(${idx})">CONFIGURE MODULES</button>
      </div>`;
    });
    body.innerHTML = html;
  }

  dismissFleetShip(id) {
    const idx = G.game.fleet.findIndex(e=>e.id===id);
    if(idx<0) return;
    const entry = G.game.fleet[idx];
    const fs = G.game.space?.fleetShips?.find(f=>f.fleetDataId===id);
    if(fs) fs._deathDone = true;
    G.game.fleet.splice(idx,1);
    this.addMsg(entry.fleetName+' dismissed from fleet.','#ffaa44');
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
    const freeSlot = (s.slots||[]).includes(null);
    if(!playerInventory.length) {
      inventoryHtml += '<div style="font-size:6px;color:#556677">No modules in inventory.</div>';
    } else {
      playerInventory.forEach((modId, i) => {
        const mod = G.MODULES[modId]||G.WEAPONS[modId];
        if(!mod) return;
        const installBtn = `<button class="btn btn-buy" style="font-size:5px;padding:2px 4px;margin-top:3px;width:100%"
          onclick="G.ui.fleetInstallModule(${fleetIdx},${i})" ${freeSlot?'':'disabled style="opacity:0.4"'}>INSTALL</button>`;
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
      this.addMsg('No free slot on fleet ship!','#ff4444');
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
      combatTurnSpeed: tpl?.baseTurn || 2.0,
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
      const speed = (tpl?.baseThrust||8000)/(tpl?.baseMass||80)*1.5 + 80;
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
