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
    this._spTab    = 'trade';
    this._currentSysId = 'sol';
    this.els = {};
    this._cacheEls();
    this._bindControls();
  }

  _cacheEls() {
    const ids=['hud','hud-top','galaxy-overlay','spaceport-overlay','inventory-overlay',
      'gameover-overlay','main-menu','system-label','target-panel','tgt-name',
      'tgt-hull-bar','tgt-shld-bar','tgt-dist','msgs','credits-hud','cargo-hud',
      'weapon-hud','bar-hull','bar-shield','bar-fuel',
      'sp-name','sp-body','sp-credits','sp-cargo','sp-ship',
      'jump-btn','gameover-title','gameover-stats',
      'hostile-alert',
      'target-offscreen','tgt-off-canvas','tgt-off-name','tgt-off-dist',
      'tgt-off-hull','tgt-off-shld','tgt-off-shld-row','tgt-off-arrow'];
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
    this._commsNPC = null;
  }

  _bindControls() {
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
    document.getElementById('opt-quit-btn')?.addEventListener('click',()=>{
      document.getElementById('options-overlay')?.classList.add('hidden');
      G.game.quitToMenu();
    });
    document.getElementById('opt-close-btn')?.addEventListener('click',()=>{
      document.getElementById('options-overlay')?.classList.add('hidden');
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
      if(nearest) G.game.target=nearest;
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
      systems.add(sysNames[inst.slotType] || inst.slotType.toUpperCase());
    }
    return [...systems];
  }

  updateHUD(player, space, target) {
    const p=player, e=this.els;
    const hPct=G.pct(p.hull,p.maxHull), sPct=G.pct(p.shields,Math.max(p.maxShields,1));
    const fPct=G.pct(p.fuel,p.maxFuel);
    if(e['bar-hull'])   e['bar-hull'].style.width=hPct+'%';
    if(e['bar-shield']) e['bar-shield'].style.width=sPct+'%';
    if(e['bar-fuel'])   e['bar-fuel'].style.width=fPct+'%';
    if(e['credits-hud'])e['credits-hud'].textContent=G.fmtCredits(G.game.credits);
    if(e['cargo-hud']){
      const used=p.cargoCount();
      e['cargo-hud'].textContent='CARGO '+used+'/'+p.cargoSpace;
      e['cargo-hud'].style.color=used>=p.cargoSpace?'#ff4444':'';
    }
    if(e['weapon-hud']&&p.weaponSlots.length>0){
      e['weapon-hud'].innerHTML=p.weaponSlots.map((w,i)=>{
        const wDef=G.WEAPONS[w.weaponId], ready=w.cooldown<=0, active=i===p.activeWeapon;
        return `<div style="color:${active?'#00ffee':'#556677'};font-size:6px;margin-bottom:2px">${active?'▶':' '} ${wDef?.name||'?'} ${ready?'<span style="color:#44ff44">RDY</span>':'<span style="color:#ff4444">—</span>'}</div>`;
      }).join('');
    }
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

    // Target off-screen portrait
    const tgtOffEl = e['target-offscreen'];
    if(tgtOffEl && inSpace) {
      if(target && !target.dead && G.game) {
        const sx = target.x - G.game.camX;
        const sy = target.y - G.game.camY;
        const onScreen = sx >= -60 && sx <= G.CANVAS_W+60 && sy >= -60 && sy <= G.CANVAS_H+60;
        if(onScreen) {
          tgtOffEl.classList.add('hidden');
        } else {
          tgtOffEl.classList.remove('hidden');
          // Sprite — only redraw when target shape/color changes
          const shapeId = target.shapeId || 'shuttle';
          const color   = target.color   || '#8899bb';
          const tgtCanvas = e['tgt-off-canvas'];
          if(tgtCanvas && (this._tgtPortShape !== shapeId || this._tgtPortColor !== color)) {
            this._tgtPortShape = shapeId;
            this._tgtPortColor = color;
            const ctx = tgtCanvas.getContext('2d');
            ctx.fillStyle = '#000a18';
            ctx.fillRect(0, 0, 64, 64);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(G.Sprites.get(shapeId, color), 0, 0, 64, 64);
          }
          // Direction arrow
          const arrowEl = e['tgt-off-arrow'];
          if(arrowEl) {
            const rot = Math.atan2(target.x - p.x, -(target.y - p.y));
            arrowEl.style.transform = `rotate(${rot}rad)`;
          }
          // Name
          const nameEl = e['tgt-off-name'];
          if(nameEl) nameEl.textContent = (target.name || 'TARGET').toUpperCase();
          // Distance
          const dist = Math.hypot(target.x - p.x, target.y - p.y) | 0;
          const distEl = e['tgt-off-dist'];
          if(distEl) distEl.textContent = dist + ' units';
          // HP bars
          const hullEl = e['tgt-off-hull'];
          const shldEl = e['tgt-off-shld'];
          if(hullEl) hullEl.style.width = G.pct(target.hp||target.hull, target.maxHp||target.maxHull) + '%';
          const shldRow = e['tgt-off-shld-row'];
          if(shldRow) shldRow.style.display = (target.maxShields||0) > 0 ? '' : 'none';
          if(shldEl && (target.maxShields||0) > 0) shldEl.style.width = G.pct(target.shields, target.maxShields) + '%';
        }
      } else {
        tgtOffEl.classList.add('hidden');
        this._tgtPortShape = null;
        this._tgtPortColor = null;
      }
    } else if(tgtOffEl) {
      tgtOffEl.classList.add('hidden');
    }

    if(target&&!target.dead){
      if(e['target-panel']) e['target-panel'].classList.remove('hidden');
      if(e['tgt-name']){
        const tShip = target.name || G.SHIPS[target.shapeId]?.name || 'SHIP';
        const tFac  = (target.faction||'?').toUpperCase();
        e['tgt-name'].textContent = tFac + ' · ' + tShip.toUpperCase();
      }
      if(e['tgt-hull-bar']) e['tgt-hull-bar'].style.width=G.pct(target.hp||target.hull,target.maxHp||target.maxHull)+'%';
      if(e['tgt-shld-bar']) e['tgt-shld-bar'].style.width=G.pct(target.shields,Math.max(target.maxShields,1))+'%';
      const td=Math.sqrt((target.x-player.x)**2+(target.y-player.y)**2)|0;
      if(e['tgt-dist']) e['tgt-dist'].textContent=td+' units'+(target.disabled?' [DISABLED]':'');
    } else {
      if(e['target-panel']) e['target-panel'].classList.add('hidden');
    }
  }

  // ── Spaceport ────────────────────────────────────────────
  showSpaceport(name, sysId) {
    this._currentSysId=sysId;
    this._spTab='trade';
    if(this.els['sp-name']) this.els['sp-name'].textContent=name.toUpperCase();
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
      case 'log':       body.innerHTML=this._buildMissionLogHTML(); this._bindLogTab(); break;
      case 'outfitter': body.innerHTML=this._buildOutfitterHTML(); this._bindOutfitter(); setTimeout(()=>this._drawOutfitterShip(),30); break;
      case 'shipyard':  body.innerHTML=this._buildShipyardHTML();  this._bindShipyard();  setTimeout(()=>this._drawShipPreviews(),50); break;
      case 'crew':      body.innerHTML=this._buildCrewHTML();      this._bindCrew();      break;
      case 'repair':    body.innerHTML=this._buildRepairHTML();    this._bindRepair();    break;
      case 'craft':     body.innerHTML=this._buildCraftHTML();     this._bindCraft();     break;
    }
    this._updateSpStatusBar();
  }

  // ── Trade ────────────────────────────────────────────────
  _buildTradeHTML(){
    const market=G.game.economy.getMarket(this._currentSysId);
    const p=G.game.player;
    let html=`<div class="panel-title">MARKETPLACE</div>
    <div style="font-size:6px;color:#556677;margin-bottom:6px;display:flex;align-items:center;gap:12px">
      <span>▲ above avg &nbsp; ▼ below avg &nbsp; Sell = 82% of buy price</span>
      <button class="btn btn-sell" onclick="G.ui.tradeSellAll()" style="font-size:6px;padding:3px 8px">SELL ALL CARGO</button>
    </div>
    <table class="trade-table">
    <tr><th>ITEM</th><th>RARITY</th><th>BUY</th><th>TREND</th><th>SELL</th><th>AVAIL</th><th>OWN</th><th style="min-width:160px">BUY</th><th style="min-width:60px">SELL</th></tr>`;
    for(const item of market){
      const owned    = p.cargo[item.id]||0;
      const sell     = Math.floor(item.price * 0.82);
      const baseItem = G.ITEMS[item.id];
      const base     = baseItem?.base || item.price;
      const ratio    = item.price / base;
      let trend='', trendCol='#888';
      if(ratio > 1.06)      { trend='▲ HIGH';  trendCol='#ff6644'; }
      else if(ratio < 0.95) { trend='▼ LOW';   trendCol='#44dd66'; }
      else                  { trend='— AVG';   trendCol='#888888'; }

      const avBg = item.available === 0 ? 'color:#ff4444' : '';
      html+=`<tr>
        <td title="${baseItem?.desc||''}">${item.name}</td>
        <td class="rarity-${item.rarity}">${G.RARITY[item.rarity]?.label||item.rarity}</td>
        <td class="price-good">$ ${item.price}</td>
        <td style="font-size:6px;color:${trendCol}">${trend}</td>
        <td class="price-bad">$ ${sell}</td>
        <td style="${avBg}">${item.available}</td>
        <td>${owned}</td>
        <td><button class="btn btn-buy" ${item.available>0?'':'disabled style="opacity:0.3"'} onclick="G.ui.tradeBuy('${item.id}',${item.price},1)">BUY</button></td>
        <td><button class="btn btn-sell" style="${owned>0?'':'visibility:hidden'}" onclick="G.ui.tradeSell('${item.id}',${sell},1)">SELL</button></td>
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
    if(G.game.player.cargoFreeSpace()<(item.mass||1)*qty){this.addMsg('Cargo full!','#ff4444');return;}
    G.game.credits-=price*qty;
    G.game.player.addCargo(itemId,qty);
    mItem.available=Math.max(0,mItem.available-qty);
    this.addMsg('Bought '+qty+'x '+item.name,'#44ff44');
    this.renderSpaceportTab('trade');
  }

  tradeSell(itemId,price,qty){
    if(!G.game.player.removeCargo(itemId,qty)){this.addMsg('Not enough cargo!','#ff4444');return;}
    G.game.credits+=price*qty;
    this.addMsg('Sold '+qty+'x '+(G.ITEMS[itemId]?.name||itemId)+' +'+G.fmtCredits(price*qty),'#ffcc00');
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

  _drawMiniGalaxy(canvasEl, destSysId) {
    if(!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    const w = canvasEl.width, h = canvasEl.height;
    ctx.fillStyle = '#000810'; ctx.fillRect(0,0,w,h);

    const minX=Math.min(...G.SYSTEMS.map(s=>s.pos[0]));
    const maxX=Math.max(...G.SYSTEMS.map(s=>s.pos[0]));
    const minY=Math.min(...G.SYSTEMS.map(s=>s.pos[1]));
    const maxY=Math.max(...G.SYSTEMS.map(s=>s.pos[1]));
    const pad=12;
    const scale=Math.min((w-pad*2)/(maxX-minX),(h-pad*2)/(maxY-minY));
    const ox=pad+(w-pad*2-(maxX-minX)*scale)/2;
    const oy=pad+(h-pad*2-(maxY-minY)*scale)/2;
    const gx=s=>ox+(s.pos[0]-minX)*scale;
    const gy=s=>oy+(s.pos[1]-minY)*scale;

    // Routes
    const drawn=new Set();
    for(const [sysId,conns] of Object.entries(G.game.galaxy.routes)){
      const a=G.SYSTEMS.find(s=>s.id===sysId); if(!a) continue;
      for(const cid of conns){
        const key=[sysId,cid].sort().join('_');
        if(drawn.has(key)) continue; drawn.add(key);
        const b=G.SYSTEMS.find(s=>s.id===cid); if(!b) continue;
        ctx.beginPath(); ctx.moveTo(gx(a),gy(a)); ctx.lineTo(gx(b),gy(b));
        ctx.strokeStyle='rgba(30,50,70,0.5)'; ctx.lineWidth=0.5; ctx.stroke();
      }
    }

    // Systems
    for(const sys of G.SYSTEMS){
      const fac=G.FACTIONS[sys.faction];
      ctx.beginPath(); ctx.arc(gx(sys),gy(sys),1.5,0,Math.PI*2);
      ctx.fillStyle=fac?.color||'#445566'; ctx.fill();
    }

    // Route highlight
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
    if(destSysId){
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
        listHtml+=`<div class="mission-card" data-destid="${destId||''}" data-hover="mission">
          <div class="mission-info"><div class="mission-title">${m.title}</div><div class="mission-desc">${m.desc}</div></div>
          <div class="mission-reward">$ ${G.fmt(m.reward)}</div>
        </div>`;
      }
    }
    listHtml+=`<div class="section-title">AVAILABLE</div>`;
    for(const m of missions){
      const already=G.game.activeMissions.find(am=>am.id===m.id);
      const destId=this._getMissionDestId(m);
      listHtml+=`<div class="mission-card" data-destid="${destId||''}" data-hover="mission">
        <div class="mission-info"><div class="mission-title">${m.title}</div><div class="mission-desc">${m.desc}</div></div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          <div class="mission-reward">$ ${G.fmt(m.reward)}</div>
          ${already?'<span style="color:#44ff44;font-size:6px">ACCEPTED</span>':`<button class="btn btn-buy" data-missionid="${m.id}">ACCEPT</button>`}
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
    G.game.setRel(m.repFaction||m.faction, G.game.getRel(m.repFaction||m.faction)-5);
    this.addMsg('Mission abandoned: '+m.title,'#ff8844');
    this._refreshMissionLog();
    // Invalidate galaxy mission targets
    G.game.galaxy.draw(G.game.currentSysId);
  }

  _bindLogTab(){
    document.querySelectorAll('[data-abandonid]').forEach(btn=>{
      btn.addEventListener('click',()=>this.abandonMission(btn.dataset.abandonid));
    });
  }

  // ── Outfitter (new: ship diagram + drag-drop) ─────────────
  _buildOutfitterHTML(){
    const p=G.game.player;
    const tpl=G.SHIPS[p.templateId];
    const mods=G.game.economy.getOutfitter(this._currentSysId);

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

    // Build slot diagram
    let slotDiagram=`<div class="outfit-ship-wrap">
      <canvas id="outfit-canvas" width="300" height="260"></canvas>
      <div id="outfit-slots-overlay">`;

    // Place one slot button per installed/empty slot at ring positions
    for(const [slotType, arr] of Object.entries(p.slots)){
      if(!arr || arr.length===0) continue;
      const ring=G.SLOT_RING[slotType]||{angle:0,r:0.4,color:'#aaa'};
      arr.forEach((instId, idx)=>{
        const inst=instId?p.modules[instId]:null;
        const mod=inst?(G.MODULES[inst.moduleId]||G.WEAPONS[inst.moduleId]):null;
        const broken=inst?.broken;
        // Spread multiple slots of same type
        const spreadDeg = arr.length>1 ? (idx-(arr.length-1)/2)*22 : 0;
        const angleDeg  = ring.angle + spreadDeg;
        const angleRad  = angleDeg * Math.PI/180;
        const cx=50, cy=50; // % center
        const rx=42, ry=38;
        const left=(cx + Math.cos(angleRad)*rx*ring.r/0.4).toFixed(1);
        const top =(cy + Math.sin(angleRad)*ry*ring.r/0.4).toFixed(1);

        slotDiagram+=`<div class="outfit-slot ${instId?'filled':''} ${broken?'broken':''}"
          style="left:${left}%;top:${top}%;border-color:${ring.color}"
          data-slot="${slotType}" data-idx="${idx}" data-instid="${instId||''}"
          ondragover="event.preventDefault()"
          ondrop="G.ui.onDropModule(event,'${slotType}',${idx})">
          <div class="outfit-slot-type" style="color:${ring.color}">${slotType.toUpperCase().slice(0,4)}</div>
          <div class="outfit-slot-mod">${mod?(broken?'⚠ '+mod.name.slice(0,10):mod.name.slice(0,10)):'—empty—'}</div>
          ${instId?`<div class="outfit-slot-remove" title="Sell (40% refund)" onclick="G.ui.removeModuleFromSlot('${instId}')">$✕</div>`:''}
        </div>`;
      });
    }
    slotDiagram+=`</div></div>`;

    // Modules for sale — grouped by slot type
    const slotTypes=[...new Set(mods.map(m=>m.slot))].sort();
    let filterBtns='<div class="outfit-filter-row" id="outfit-filter">';
    filterBtns+='<button class="btn outfit-filter-btn active" data-filter="all" onclick="G.ui.filterOutfitter(\'all\')">ALL</button>';
    for(const st of slotTypes){
      filterBtns+=`<button class="btn outfit-filter-btn" data-filter="${st}" onclick="G.ui.filterOutfitter('${st}')">${st.toUpperCase()}</button>`;
    }
    filterBtns+='</div>';

    let saleList='<div id="outfit-sale-list" class="outfit-sale-grid">';
    for(const mod of mods){
      const canFit=p.slots[mod.slot]&&p.slots[mod.slot].includes(null);
      const canAfford=G.game.credits>=mod.price;
      saleList+=`<div class="item-card outfit-sale-item" draggable="true"
        data-modid="${mod.id}" data-slot="${mod.slot}"
        ondragstart="G.ui.onDragModule(event,'${mod.id}')"
        style="opacity:${canAfford?1:0.5}">
        <div class="item-name rarity-${mod.rarity||'c'}">${mod.name}</div>
        <div style="font-size:5px;color:${G.SLOT_RING[mod.slot]?.color||'#aaa'};margin-bottom:3px">${mod.slot.toUpperCase()}</div>
        <div class="item-stats">${mod.stats||''}<br>⚡${mod.energyDraw||0}/s</div>
        <div style="font-size:6px;color:#667;margin:2px 0">${mod.desc}</div>
        <div class="item-price" style="margin-top:4px">$ ${G.fmt(mod.price)}</div>
        <button class="btn btn-buy" style="margin-top:4px;font-size:5px"
          onclick="G.ui.buyAndInstall('${mod.id}')"
          ${canFit&&canAfford?'':'disabled style="opacity:0.35"'}>INSTALL</button>
      </div>`;
    }
    saleList+='</div>';

    // Slot expansion section
    const slotCosts = { weapon:3000, shield:2500, cargo:1500, engine:4000, special:2000, fuel:1000, sensor:1800, armor:2500, crew:1200, turret:3500, power:3000, jump:5000 };
    const expLimit = tpl?.expansionLimit || 3;
    const boughtSlots = this._countBoughtSlots(p);
    const expRemaining = expLimit - boughtSlots;
    const expColor = expRemaining <= 0 ? '#ff4444' : expRemaining === 1 ? '#ff8844' : '#cc44ff';
    let slotExpHtml = `<div style="margin-top:12px;border-top:1px solid #1a4a6a;padding-top:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-size:7px;color:#aaa">EXPAND MODULE SLOTS</div>
        <div style="font-size:6px;color:${expColor}">${expRemaining > 0 ? expRemaining+' slots remaining' : 'EXPANSION FULL'} (${boughtSlots}/${expLimit})</div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">`;
    for(const [slotType,cost] of Object.entries(slotCosts)){
      const count = (p.slots[slotType]||[]).length;
      const canAfford = G.game.credits >= cost;
      const canExpand = expRemaining > 0;
      const disabled = !canAfford || !canExpand;
      slotExpHtml += `<button class="btn" style="font-size:5px;padding:3px 5px;${disabled?'opacity:0.4':''}"
        ${disabled?'disabled':''} onclick="G.ui.buySlot('${slotType}',${cost})">
        +${slotType.slice(0,4).toUpperCase()}(${count}) $${G.fmt(cost)}</button>`;
    }
    slotExpHtml += `</div></div>`;

    return `<div class="panel-title">OUTFITTER — ${p.name.toUpperCase()}</div>
    <div class="outfit-main">
      <div class="outfit-left">
        ${slotDiagram}
        ${statHtml}
        ${slotExpHtml}
      </div>
      <div class="outfit-right">
        ${filterBtns}
        ${saleList}
      </div>
    </div>`;
  }

  _drawOutfitterShip(){
    const canvas=document.getElementById('outfit-canvas');
    if(!canvas) return;
    const ctx=canvas.getContext('2d');
    const p=G.game.player;
    const tpl=G.SHIPS[p.templateId];
    ctx.clearRect(0,0,300,260);

    // Dark background with grid
    ctx.fillStyle='#020e1a';
    ctx.fillRect(0,0,300,260);
    ctx.strokeStyle='#0a2035'; ctx.lineWidth=1;
    for(let x=0;x<300;x+=20){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,260);ctx.stroke();}
    for(let y=0;y<260;y+=20){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(300,y);ctx.stroke();}

    // Draw pixel-art sprite centered at 5× scale
    const shapeId = tpl?.shape || 'shuttle';
    const color   = tpl?.color || '#8899bb';
    const sprite  = G.Sprites.get(shapeId, color);
    const SZ = G.Sprites.SZ; // 32
    const scale = 5;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, 150-(SZ*scale/2)|0, 130-(SZ*scale/2)|0, SZ*scale, SZ*scale);

    // Draw connection lines from center to slot positions
    const slots=document.querySelectorAll('#outfit-slots-overlay .outfit-slot');
    ctx.strokeStyle='rgba(40,80,120,0.4)';
    ctx.lineWidth=0.5;
    ctx.setLineDash([3,3]);
    slots.forEach(slot=>{
      const l=parseFloat(slot.style.left)/100*300;
      const t=parseFloat(slot.style.top)/100*260;
      ctx.beginPath(); ctx.moveTo(150,130); ctx.lineTo(l+26,t+14);
      ctx.stroke();
    });
    ctx.setLineDash([]);
  }

  filterOutfitter(slotType){
    document.querySelectorAll('.outfit-filter-btn').forEach(b=>b.classList.toggle('active',b.dataset.filter===slotType));
    document.querySelectorAll('.outfit-sale-item').forEach(item=>{
      item.style.display=(slotType==='all'||item.dataset.slot===slotType)?'':'none';
    });
  }

  onDragModule(ev, modId){
    ev.dataTransfer.setData('modId', modId);
  }

  onDropModule(ev, slotType, slotIdx){
    ev.preventDefault();
    const modId=ev.dataTransfer.getData('modId');
    if(!modId) return;
    const mod=G.MODULES[modId]||G.WEAPONS[modId];
    if(!mod||mod.slot!==slotType){ this.addMsg('Wrong slot type!','#ff4444'); return; }
    if(G.game.credits<mod.price){ this.addMsg('Not enough credits!','#ff4444'); return; }
    // Check if target slot is empty
    const p=G.game.player;
    if(p.slots[slotType][slotIdx]!==null){ this.addMsg('Slot already filled — remove first','#ff4444'); return; }
    const ok=p.installModule(modId, slotType);
    if(ok){ G.game.credits-=mod.price; this.addMsg('Installed '+mod.name,'#44ff44'); this.renderSpaceportTab('outfitter'); }
    else   { this.addMsg('Cannot install!','#ff4444'); }
  }

  buyAndInstall(modId){
    const mod=G.MODULES[modId]||G.WEAPONS[modId];
    if(!mod) return;
    if(G.game.credits<mod.price){ this.addMsg('Not enough credits!','#ff4444'); return; }
    const p=G.game.player;
    if(!p.slots[mod.slot]||!p.slots[mod.slot].includes(null)){ this.addMsg('No free '+mod.slot+' slot!','#ff4444'); return; }
    const ok=p.installModule(modId);
    if(ok){ G.game.credits-=mod.price; this.addMsg('Installed '+mod.name,'#44ff44'); this.renderSpaceportTab('outfitter'); }
  }

  _countBoughtSlots(player) {
    const tpl = G.SHIPS[player.templateId];
    if(!tpl) return 0;
    let bought = 0;
    for(const [slotType, arr] of Object.entries(player.slots)) {
      const templateCount = tpl.slots[slotType] || 0;
      bought += Math.max(0, arr.length - templateCount);
    }
    return bought;
  }

  buySlot(slotType, cost) {
    if(G.game.credits < cost) { this.addMsg('Not enough credits!','#ff4444'); return; }
    const p = G.game.player;
    const tpl = G.SHIPS[p.templateId];
    const expLimit = tpl?.expansionLimit || 3;
    const bought = this._countBoughtSlots(p);
    if(bought >= expLimit) {
      this.addMsg('Expansion limit reached — this ship can only support +'+expLimit+' slots','#ff8844');
      return;
    }
    if(!p.slots[slotType]) p.slots[slotType] = [];
    p.slots[slotType].push(null);
    G.game.credits -= cost;
    this.addMsg('Added '+slotType+' slot! ('+(bought+1)+'/'+expLimit+' expansions)','#cc44ff');
    this.renderSpaceportTab('outfitter');
  }

  removeModuleFromSlot(instId){
    const inst=G.game.player.modules[instId];
    if(!inst) return;
    const mod=G.MODULES[inst.moduleId]||G.WEAPONS[inst.moduleId];
    G.game.player.removeModule(instId);
    const refund=Math.floor((mod?.price||0)*0.4);
    G.game.credits+=refund;
    this.addMsg('Removed '+mod?.name+(refund?' (+'+G.fmtCredits(refund)+')':''),'#ffcc00');
    this.renderSpaceportTab('outfitter');
  }

  _bindOutfitter(){
    // Drag-and-drop fully handled via inline ondragstart/ondragover/ondrop
    // Nothing extra needed
  }

  // ── Shipyard ─────────────────────────────────────────────
  _buildShipyardHTML(){
    const ships=G.game.economy.getShipyard(this._currentSysId);
    const p=G.game.player;
    const oldShipDef=G.SHIPS[p.templateId];
    let modRefund=0;
    for(const inst of Object.values(p.modules)){
      const mod=G.MODULES[inst.moduleId]||G.WEAPONS[inst.moduleId];
      modRefund+=Math.floor((mod?.price||0)*0.4);
    }
    const hullRefund=Math.floor((oldShipDef?.price||0)*0.4);
    const totalRefund=modRefund+hullRefund;
    const modCount=Object.keys(p.modules).length;

    let html=`<div class="panel-title">SHIPYARD</div>
    <div class="section-title">CURRENT: ${p.name.toUpperCase()} — Hull ${Math.ceil(p.hull)}/${p.maxHull} Cargo ${p.cargoSpace}</div>
    <div style="font-size:6px;color:#556677;margin-bottom:10px">
      Trade-in: <span style="color:#ffcc00">${G.fmtCredits(hullRefund)}</span> hull
      ${modCount?`+ <span style="color:#ffcc00">${G.fmtCredits(modRefund)}</span> modules (${modCount} stripped)`:''}
      &nbsp;=&nbsp;<span style="color:#00ffee">${G.fmtCredits(totalRefund)} total credit</span>
    </div>
    <div class="three-col">`;
    for(const ship of ships){
      const netCost=ship.price-totalRefund;
      const ok=G.game.credits>=netCost;
      const netLabel=netCost<=0
        ?`<span style="color:#44ff44">+${G.fmtCredits(-netCost)} back</span>`
        :`<span style="color:#ffcc00">Net: ${G.fmtCredits(netCost)}</span>`;
      const expLimit = ship.expansionLimit || 3;
      html+=`<div class="item-card">
        <div class="item-name">${ship.name}</div>
        <div style="width:100%;height:90px;background:#000a18;margin:6px 0;display:flex;align-items:center;justify-content:center">
          <canvas width="120" height="88" class="ship-preview" data-shape="${ship.shape}" data-color="${ship.color}"></canvas>
        </div>
        <div class="item-stats">${ship.stats}</div>
        <div style="font-size:6px;color:#cc44ff;margin:2px 0">Expansion: +${expLimit} slots max</div>
        <div style="font-size:6px;color:#667;margin:3px 0">${ship.desc}</div>
        <div class="item-price">$ ${G.fmt(ship.price)}</div>
        <div style="font-size:6px;margin-top:2px">${netLabel}</div>
        <button class="btn btn-buy" style="margin-top:4px" data-buyship="${ship.id}" ${ok?'':'disabled style="opacity:0.3"'}>BUY</button>
      </div>`;
    }
    return html+'</div>';
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
      <button class="btn btn-buy" id="rep-hull" ${p.hull<p.maxHull&&G.game.credits>=hCost?'':'disabled style="opacity:0.3"'}>REPAIR HULL</button>
    </div>
    <div class="item-card"><div class="item-name">Refuel</div>
      <div class="item-stats">Need: ${Math.ceil(p.maxFuel-p.fuel)} — Cost: ${G.fmtCredits(fCost)}</div>
      <button class="btn btn-buy" id="rep-fuel" ${p.fuel<p.maxFuel&&G.game.credits>=fCost?'':'disabled style="opacity:0.3"'}>REFUEL</button>
    </div>
    ${p.maxShields>0?`<div class="item-card"><div class="item-name">Shield Recharge</div>
      <div class="item-stats">Depleted: ${Math.ceil(p.maxShields-p.shields)} — Cost: ${G.fmtCredits(sCost)}</div>
      <button class="btn btn-buy" id="rep-shld" ${p.shields<p.maxShields&&G.game.credits>=sCost?'':'disabled style="opacity:0.3"'}>RECHARGE</button>
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
    // Save game button
    html+=`<div style="margin-top:16px;border-top:1px solid #1a4a6a;padding-top:12px">
      <button class="btn" id="save-game-btn" style="border-color:#00ffee;color:#00ffee">💾 SAVE GAME</button>
      <span style="font-size:6px;color:#556677;margin-left:12px">Save at this spaceport</span>
    </div>`;
    return html;
  }

  _bindRepair(){
    document.getElementById('rep-hull')?.addEventListener('click',()=>{
      const p=G.game.player, cost=Math.ceil((p.maxHull-p.hull)*5);
      if(G.game.credits>=cost){G.game.credits-=cost;p.hull=p.maxHull;this.addMsg('Hull repaired','#44ff44');this.renderSpaceportTab('repair');}
    });
    document.getElementById('rep-fuel')?.addEventListener('click',()=>{
      const p=G.game.player, cost=Math.ceil((p.maxFuel-p.fuel)*2);
      if(G.game.credits>=cost){G.game.credits-=cost;p.fuel=p.maxFuel;this.addMsg('Refueled','#44ff44');this.renderSpaceportTab('repair');}
    });
    document.getElementById('rep-shld')?.addEventListener('click',()=>{
      const p=G.game.player, cost=Math.ceil((p.maxShields-p.shields)*3);
      if(G.game.credits>=cost){G.game.credits-=cost;p.shields=p.maxShields;this.addMsg('Shields recharged','#44ff44');this.renderSpaceportTab('repair');}
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
    document.getElementById('save-game-btn')?.addEventListener('click',()=>G.game.saveGame());
  }

  // ── Crafting ─────────────────────────────────────────────
  _buildCraftHTML(){
    const p=G.game.player;
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
        const hasFreeSlot = mod && p.slots[mod.slot] && p.slots[mod.slot].includes(null);
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
          if(!p.slots[mod.slot]||!p.slots[mod.slot].includes(null)){this.addMsg('No free '+mod.slot+' slot!','#ff4444');return;}
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
    let html='<div class="inv-grid">';
    const entries=Object.entries(p.cargo);
    if(!entries.length) html+='<div style="color:#556677;font-size:7px">Cargo hold is empty</div>';
    for(const[id,qty]of entries){
      const item=G.ITEMS[id]; if(!item) continue;
      html+=`<div class="inv-item rarity-${item.rarity||'c'}">
        <div class="inv-qty">${qty}</div>
        <div class="inv-name">${item.name}</div>
        <div style="font-size:5px;color:#556677;margin-top:2px">${G.RARITY[item.rarity||'c']?.label||item.rarity}</div>
      </div>`;
    }
    html+=`</div><div style="margin-top:10px;font-size:7px;color:#556677">Free space: ${Math.ceil(p.cargoFreeSpace())} units</div>`;
    body.innerHTML=html;
    this.els['inventory-overlay']?.classList.remove('hidden');
  }

  hideInventory(){ this.els['inventory-overlay']?.classList.add('hidden'); }

  // ── Messages / notifications ─────────────────────────────
  addMsg(text, color='#88ccee'){
    const el=document.createElement('div');
    el.className='msg-line'; el.style.borderLeftColor=color; el.style.color=color;
    el.textContent=text;
    const msgs=this.els['msgs'];
    if(msgs){ msgs.appendChild(el); setTimeout(()=>{try{msgs.removeChild(el);}catch(e){}},4000); }
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
  openComms(npc, forceAction) {
    this._commsNPC = npc;
    const fac = G.FACTIONS[npc.faction]||G.FACTIONS.independent;
    const fuel = G.game.player.fuel / G.game.player.maxFuel;

    if(this.els['comms-faction-tag']) {
      this.els['comms-faction-tag'].textContent = fac.name.toUpperCase();
      this.els['comms-faction-tag'].style.color  = fac.color;
    }
    if(this.els['comms-ship-name']) this.els['comms-ship-name'].textContent = npc.name;
    if(this.els['comms-response-text']) this.els['comms-response-text'].textContent = '';

    const opts = npc.getCommsOptions(fuel);
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

  _handleCommsAction(action) {
    const npc = this._commsNPC;
    if(!npc) return;
    const res  = npc.getCommsResponse(action);
    const resp = this.els['comms-response-text'];
    if(resp) resp.textContent = '"'+res.text+'"';

    if(action==='fuel' && res.fuelAmt>0) {
      if(G.game.credits >= res.fuelCost) {
        G.game.credits   -= res.fuelCost;
        G.game.player.fuel = Math.min(G.game.player.maxFuel, G.game.player.fuel + res.fuelAmt);
        this.addMsg('Fuel transfer: +'+res.fuelAmt+' fuel for '+G.fmtCredits(res.fuelCost),'#ff8844');
      } else {
        if(resp) resp.textContent = '"Sorry — you don\'t have enough credits."';
      }
    }

    if(action==='trade' && res.tradeItems.length>0) {
      // Show quick trade listing
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
      npc.hostile = true;
      npc.combatTarget = null;
      this.addMsg(npc.name+' has turned hostile!','#ff4444');
      if(npc.faction!=='independent') G.game.setRel(npc.faction, G.game.getRel(npc.faction)-5);
      this.closeComms();
    }
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
    this.els['comms-overlay']?.classList.add('hidden');
    this._commsNPC = null;
  }
};
