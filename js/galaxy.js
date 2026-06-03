'use strict';
// ── Galaxy map ────────────────────────────────────────────
G.Galaxy = class {
  constructor() {
    this.routes     = G.buildHyperspaceRoutes();
    this.visited    = new Set(['sol']);
    this.selected   = null;
    this.hoveredSys = null;
    this.jumpRoute  = []; // planned multi-hop route (array of sysIds, not including current)
    this._canvas    = null;
    this._ctx       = null;
  }

  init() {
    this._canvas = document.getElementById('galaxy-canvas');
    this._ctx    = this._canvas.getContext('2d');
    this._canvas.width  = 950;
    this._canvas.height = 700;
    this._canvas.style.width  = '950px';
    this._canvas.style.height = '700px';

    this._canvas.addEventListener('mousemove', e => {
      const r  = this._canvas.getBoundingClientRect();
      const mx = (e.clientX-r.left)*(950/r.width);
      const my = (e.clientY-r.top)*(700/r.height);
      this.hoveredSys = this._sysAt(mx,my);
    });

    this._canvas.addEventListener('click', e => {
      if(!this.hoveredSys) return;
      const targetId = this.hoveredSys.id;
      const currentId = G.game?.currentSysId;
      if(targetId === currentId) return;

      // Build route from current system to clicked system
      const route = this._findRoute(currentId, targetId);
      if(route && route.length > 0) {
        this.jumpRoute = route;
        this.selected  = G.SYSTEMS.find(s => s.id === route[0]);
      } else {
        G.ui?.addMsg('No route found to that system.', '#ff4444');
      }
    });

    document.getElementById('close-galaxy-btn').addEventListener('click', () => {
      G.game.closeGalaxy();
    });

    const jb = document.getElementById('jump-btn');
    if(jb) jb.classList.add('hidden');
  }

  // BFS pathfinding from fromId to toId, returns array of sysIds (not including from)
  _findRoute(fromId, toId) {
    if(fromId === toId) return [];
    const queue = [[fromId]];
    const visited = new Set([fromId]);
    while(queue.length > 0) {
      const path = queue.shift();
      const cur  = path[path.length - 1];
      for(const next of (this.routes[cur] || [])) {
        if(visited.has(next)) continue;
        visited.add(next);
        const newPath = [...path, next];
        if(next === toId) return newPath.slice(1);
        queue.push(newPath);
      }
    }
    return null;
  }

  canJumpTo(sysId) {
    const player = G.game?.player;
    if(!player?.canJump) return false;
    const current = G.SYSTEMS.find(s=>s.id===G.game.currentSysId);
    if(!current) return false;
    return (this.routes[current.id]||[]).includes(sysId);
  }

  // Returns the next hop system that can be jumped to right now
  nextJumpableHop() {
    if(!this.jumpRoute.length) return null;
    const nextId = this.jumpRoute[0];
    if(this.canJumpTo(nextId)) return G.SYSTEMS.find(s=>s.id===nextId);
    return null;
  }

  clearRoute() {
    this.jumpRoute = [];
    this.selected  = null;
  }

  _sysAt(mx,my) {
    for(const sys of G.SYSTEMS) {
      const d = Math.sqrt((sys.pos[0]-mx)**2+(sys.pos[1]-my)**2);
      if(d<=10) return sys;
    }
    return null;
  }

  _missionTargets() {
    const targets = {};
    if(!G.game) return targets;
    for(const m of G.game.activeMissions) {
      if(m.completed||m.failed) continue;
      const dest = m.params.dest || m.params.target;
      if(dest) {
        if(!targets[dest]) targets[dest] = [];
        targets[dest].push(m.type);
      }
    }
    return targets;
  }

  draw(playerSysId) {
    const ctx = this._ctx;
    if(!ctx) return;
    ctx.clearRect(0,0,950,700);
    this._drawBackground(ctx);

    const missionTargets = this._missionTargets();
    const routeSet = new Set(this.jumpRoute);

    // ── Hyperspace routes ────────────────────────────────
    const drawn = new Set();
    for(const [sysId, conns] of Object.entries(this.routes)) {
      const a = G.SYSTEMS.find(s=>s.id===sysId);
      if(!a) continue;
      for(const connId of conns) {
        const key = [sysId,connId].sort().join('_');
        if(drawn.has(key)) continue;
        drawn.add(key);
        const b = G.SYSTEMS.find(s=>s.id===connId);
        if(!b) continue;
        const aVis = this.visited.has(sysId), bVis = this.visited.has(connId);

        // Highlight route connections
        const onRoute = routeSet.has(sysId) && routeSet.has(connId)
          || (sysId===playerSysId && routeSet.has(connId) && connId===this.jumpRoute[0])
          || (connId===playerSysId && routeSet.has(sysId) && sysId===this.jumpRoute[0]);

        ctx.beginPath();
        ctx.moveTo(a.pos[0],a.pos[1]);
        ctx.lineTo(b.pos[0],b.pos[1]);
        if(onRoute) {
          ctx.strokeStyle='rgba(0,200,255,0.55)';
          ctx.lineWidth=2;
        } else {
          ctx.strokeStyle = (aVis||bVis) ? 'rgba(80,130,180,0.3)' : 'rgba(40,60,80,0.15)';
          ctx.lineWidth=0.5;
        }
        ctx.stroke();
        ctx.lineWidth=0.5;
      }
    }

    // ── Reachable routes highlight (from current position) ───
    if(G.game && G.game.player.canJump) {
      const reachable = this.routes[playerSysId]||[];
      const cs = G.SYSTEMS.find(s=>s.id===playerSysId);
      for(const rid of reachable) {
        const rs = G.SYSTEMS.find(s=>s.id===rid);
        if(!rs||!cs) continue;
        ctx.beginPath();
        ctx.moveTo(cs.pos[0],cs.pos[1]);
        ctx.lineTo(rs.pos[0],rs.pos[1]);
        ctx.strokeStyle='rgba(0,200,255,0.18)';
        ctx.lineWidth=1.5; ctx.stroke(); ctx.lineWidth=0.5;
      }
    }

    // ── Mission destination highlights ──────────────────
    for(const [sysId, types] of Object.entries(missionTargets)) {
      const sys = G.SYSTEMS.find(s=>s.id===sysId);
      if(!sys) continue;
      const [sx,sy] = sys.pos;
      const pulse = 0.4 + 0.4*Math.sin(Date.now()*0.003);
      ctx.beginPath(); ctx.arc(sx,sy,12+pulse*3,0,Math.PI*2);
      ctx.strokeStyle=`rgba(255,200,0,${0.5+pulse*0.3})`;
      ctx.lineWidth=1.5; ctx.stroke(); ctx.lineWidth=0.5;
    }

    // ── Systems ──────────────────────────────────────────
    for(const sys of G.SYSTEMS) {
      const [sx,sy] = sys.pos;
      const fac     = G.FACTIONS[sys.faction];
      const visited = this.visited.has(sys.id);
      const isCur   = sys.id===playerSysId;
      const isHov   = sys===this.hoveredSys;
      const isRoute = routeSet.has(sys.id);
      const isNext  = this.jumpRoute.length > 0 && sys.id === this.jumpRoute[0];

      // Relation ring (drawn first so other indicators sit on top)
      if(G.game && !isCur) {
        const rel = G.game.getRel(sys.faction);
        let relCol;
        if(rel >= 50)       relCol = 'rgba(0,255,102,0.55)';
        else if(rel >= -20) relCol = 'rgba(130,130,130,0.35)';
        else if(rel >= -50) relCol = 'rgba(255,200,0,0.6)';
        else                relCol = 'rgba(255,55,55,0.65)';
        ctx.beginPath(); ctx.arc(sx,sy,7,0,Math.PI*2);
        ctx.strokeStyle=relCol; ctx.lineWidth=2; ctx.stroke(); ctx.lineWidth=0.5;
      }

      if(isCur) {
        ctx.beginPath(); ctx.arc(sx,sy,13,0,Math.PI*2);
        ctx.fillStyle='rgba(0,255,238,0.1)'; ctx.fill();
      }
      if(isNext) {
        ctx.beginPath(); ctx.arc(sx,sy,10,0,Math.PI*2);
        ctx.strokeStyle='#00ffee'; ctx.lineWidth=2; ctx.stroke(); ctx.lineWidth=0.5;
      } else if(isRoute) {
        ctx.beginPath(); ctx.arc(sx,sy,8,0,Math.PI*2);
        ctx.strokeStyle='rgba(0,180,255,0.7)'; ctx.lineWidth=1.5; ctx.stroke(); ctx.lineWidth=0.5;
      } else if(isHov && !isCur) {
        ctx.beginPath(); ctx.arc(sx,sy,8,0,Math.PI*2);
        ctx.strokeStyle='rgba(0,200,200,0.6)'; ctx.lineWidth=1.5; ctx.stroke(); ctx.lineWidth=0.5;
      }

      const r   = visited ? 4 : 2.5;
      const col = visited ? (fac?.color||'#aaa') : '#334455';
      const dotCol = isCur ? '#00ffee' : (isRoute?'#44aaff':col);
      if(sys.noStar) {
        ctx.strokeStyle=dotCol; ctx.lineWidth=1.2;
        ctx.beginPath(); ctx.moveTo(sx,sy-r*1.3); ctx.lineTo(sx+r*1.3,sy);
        ctx.lineTo(sx,sy+r*1.3); ctx.lineTo(sx-r*1.3,sy); ctx.closePath();
        ctx.stroke(); ctx.lineWidth=0.5;
      } else {
        ctx.beginPath(); ctx.arc(sx,sy,r,0,Math.PI*2);
        ctx.fillStyle=dotCol; ctx.fill();
      }

      if(visited||isHov||isNext||isCur) {
        ctx.fillStyle = isCur ? '#00ffee' : isNext ? '#00ffee' : (fac?.color||'#aaaaaa');
        ctx.font = isCur ? 'bold 8px "Press Start 2P",monospace' : '7px "Press Start 2P",monospace';
        ctx.fillText(sys.name, sx+7, sy-5);
      }
    }

    // ── Current system pulse ─────────────────────────────
    const curSys = G.SYSTEMS.find(s=>s.id===playerSysId);
    if(curSys) {
      const pulse = 0.5+0.5*Math.sin(Date.now()*0.003);
      ctx.beginPath(); ctx.arc(curSys.pos[0],curSys.pos[1],6+pulse*3,0,Math.PI*2);
      ctx.strokeStyle=`rgba(0,255,238,${0.4+pulse*0.4})`; ctx.lineWidth=1.5; ctx.stroke();
    }

    // ── Route info panel ─────────────────────────────────
    if(this.jumpRoute.length > 0) this._drawRoutePanel(ctx, playerSysId);
    // ── Hover panel ──────────────────────────────────────
    else if(this.hoveredSys && this.hoveredSys.id !== playerSysId) {
      this._drawHoverPanel(ctx, this.hoveredSys, playerSysId);
    }

    this._drawLegend(ctx);
  }

  _drawRoutePanel(ctx, playerSysId) {
    const dest   = G.SYSTEMS.find(s=>s.id===this.jumpRoute[this.jumpRoute.length-1]);
    const next   = G.SYSTEMS.find(s=>s.id===this.jumpRoute[0]);
    const hops   = this.jumpRoute.length;
    const fuelNeed = hops * 10;
    const fuelHave = G.game?.player.fuel || 0;
    const fuelJumps = Math.floor(fuelHave / 10);

    const PW=220, PH=130, px=950-PW-12, py=12;
    ctx.save();
    ctx.fillStyle='rgba(0,8,20,0.94)'; ctx.strokeStyle='#1a6a4a'; ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(px+4,py); ctx.lineTo(px+PW-4,py); ctx.quadraticCurveTo(px+PW,py,px+PW,py+4);
    ctx.lineTo(px+PW,py+PH-4); ctx.quadraticCurveTo(px+PW,py+PH,px+PW-4,py+PH);
    ctx.lineTo(px+4,py+PH); ctx.quadraticCurveTo(px,py+PH,px,py+PH-4);
    ctx.lineTo(px,py+4); ctx.quadraticCurveTo(px,py,px+4,py); ctx.closePath();
    ctx.fill(); ctx.stroke();

    ctx.font='7px "Press Start 2P",monospace'; ctx.fillStyle='#00ffee';
    ctx.fillText('ROUTE PLANNED', px+8, py+15);
    ctx.font='6px "Press Start 2P",monospace'; ctx.fillStyle='#aaa';
    ctx.fillText('NEXT: '+(next?.name||'?'), px+8, py+30);
    ctx.fillText('DEST: '+(dest?.name||'?'), px+8, py+43);
    ctx.fillText('HOPS: '+hops, px+8, py+56);
    ctx.fillStyle = fuelHave >= fuelNeed ? '#44ff44' : '#ff4444';
    ctx.fillText('FUEL: '+Math.ceil(fuelHave)+' ('+fuelJumps+' jumps)', px+8, py+70);
    ctx.fillStyle='#00ffee';
    ctx.fillText('HOLD [J] TO JUMP', px+8, py+88);
    ctx.fillStyle='#556677'; ctx.font='5px "Press Start 2P",monospace';
    ctx.fillText('click system to reroute', px+8, py+102);
    ctx.fillText('[M] close map', px+8, py+115);
    ctx.restore();
  }

  _drawHoverPanel(ctx, sys, playerSysId) {
    const [sx,sy]= sys.pos;
    const fac    = G.FACTIONS[sys.faction];
    const facRel = G.game ? G.game.getRel(sys.faction) : 0;
    const visited= this.visited.has(sys.id);
    const route  = this._findRoute(playerSysId, sys.id);
    const hops   = route ? route.length : null;

    const PW=200, PH=140;
    let px = Math.min(sx+15, 950-PW-8);
    let py = Math.max(8, Math.min(sy-20, 700-PH-8));

    ctx.save();
    ctx.fillStyle='rgba(3,10,22,0.94)'; ctx.strokeStyle='#1a4a6a'; ctx.lineWidth=1;
    const r=4;
    ctx.beginPath();
    ctx.moveTo(px+r,py); ctx.lineTo(px+PW-r,py); ctx.quadraticCurveTo(px+PW,py,px+PW,py+r);
    ctx.lineTo(px+PW,py+PH-r); ctx.quadraticCurveTo(px+PW,py+PH,px+PW-r,py+PH);
    ctx.lineTo(px+r,py+PH); ctx.quadraticCurveTo(px,py+PH,px,py+PH-r);
    ctx.lineTo(px,py+r); ctx.quadraticCurveTo(px,py,px+r,py);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(px,py+PH/2);
    ctx.strokeStyle='rgba(0,200,200,0.25)'; ctx.lineWidth=0.5; ctx.stroke();

    ctx.font='8px "Press Start 2P",monospace';
    ctx.fillStyle = fac?.color||'#00ffee';
    ctx.fillText(sys.name.slice(0,18), px+8, py+16);
    ctx.font='6px "Press Start 2P",monospace'; ctx.fillStyle='#aaa';
    const stars='★'.repeat(Math.min(sys.danger,5))+'☆'.repeat(Math.max(0,5-sys.danger));
    ctx.fillText('Faction: '+(fac?.name||sys.faction).slice(0,14), px+8, py+30);
    ctx.fillStyle='#ff8844';
    ctx.fillText('Danger: '+stars, px+8, py+42);
    ctx.fillStyle=visited?'#44ff44':'#888';
    ctx.fillText(visited?'Visited':'Unexplored', px+8, py+54);
    ctx.fillStyle=facRel>0?'#44ff44':facRel<0?'#ff4444':'#aaa';
    ctx.fillText('Rep: '+facRel, px+8, py+66);
    if(hops !== null) {
      ctx.fillStyle='#00aaff';
      ctx.fillText('Route: '+hops+' hop'+(hops!==1?'s':'')+' / '+(hops*10)+' fuel', px+8, py+80);
      ctx.fillStyle='#aaaaaa';
      ctx.fillText('Click to set destination', px+8, py+96);
    } else {
      ctx.fillStyle='#666'; ctx.fillText('Unreachable', px+8, py+80);
    }
    ctx.restore();
  }

  _drawLegend(ctx) {
    const facItems=[
      {col:'#4488ff',txt:'EARTH GOV'},
      {col:'#ff6600',txt:'REBELLION'},
      {col:'#cc2222',txt:'PIRATES'},
      {col:'#00ff88',txt:'ALIENS'},
      {col:'#aaaaaa',txt:'CONTESTED'},
    ];
    const relItems=[
      {col:'rgba(0,255,102,0.9)',  txt:'ALLIED'},
      {col:'rgba(130,130,130,0.9)',txt:'NEUTRAL'},
      {col:'rgba(255,200,0,0.9)',  txt:'DANGER'},
      {col:'rgba(255,55,55,0.9)', txt:'HOSTILE'},
    ];
    ctx.save();
    ctx.font='6px "Press Start 2P",monospace';

    // Faction row
    let lx=8, ly=678;
    for(const {col,txt} of facItems) {
      ctx.fillStyle=col; ctx.fillRect(lx,ly-6,8,8);
      ctx.fillStyle='#778899'; ctx.fillText(txt,lx+12,ly);
      lx+=txt.length*5+26;
    }

    // Relation row
    lx=8; ly=693;
    for(const {col,txt} of relItems) {
      ctx.beginPath(); ctx.arc(lx+4,ly-3,4,0,Math.PI*2);
      ctx.strokeStyle=col; ctx.lineWidth=1.5; ctx.stroke(); ctx.lineWidth=0.5;
      ctx.fillStyle='#778899'; ctx.fillText(txt,lx+12,ly);
      lx+=txt.length*5+26;
    }
    ctx.restore();
  }

  _drawBackground(ctx) {
    // Deep space base
    ctx.fillStyle='#00010a';
    ctx.fillRect(0,0,950,700);

    // Background star field - denser near galactic core
    const rng = G.seededRng('galaxy_bg2');
    for(let i=0;i<800;i++){
      const x = rng()*950;
      const y = rng()*700;
      const dx = x-475, dy = y-345;
      const dist = Math.sqrt(dx*dx+dy*dy);
      const densityFactor = Math.max(0.1, 1 - dist/500);
      if(rng() > densityFactor * 0.8 + 0.2) continue;
      const bright = 0.1 + rng()*0.7 * densityFactor;
      const size   = rng() < 0.04 ? 1.5 : 0.8;
      const r2 = Math.floor(200+rng()*55), g2 = Math.floor(210+rng()*45);
      ctx.fillStyle = `rgba(${r2},${g2},255,${bright})`;
      ctx.fillRect(x|0, y|0, size, size);
    }

    // Galactic core glow - layered radial gradients
    const coreGrads = [
      { r:80,  col0:'rgba(240,200,120,0.22)', col1:'rgba(200,160,80,0)' },
      { r:200, col0:'rgba(140,100,200,0.12)', col1:'rgba(80,60,150,0)' },
      { r:400, col0:'rgba(40,60,160,0.07)',   col1:'rgba(0,0,0,0)' },
    ];
    for(const g of coreGrads){
      const grad = ctx.createRadialGradient(475,345,0,475,345,g.r);
      grad.addColorStop(0, g.col0); grad.addColorStop(1, g.col1);
      ctx.fillStyle=grad; ctx.fillRect(0,0,950,700);
    }

    // Spiral arm nebula hints
    ctx.save();
    ctx.globalAlpha = 0.04;

    // Symmetric spiral arms radiating from cluster center (475,345)
    const arms = [
      { end:[800,100], ctrl:[680,200], col:'#4488ff' },
      { end:[800,590], ctrl:[680,470], col:'#ff6600' },
      { end:[150,590], ctrl:[280,470], col:'#4466ff' },
      { end:[150,100], ctrl:[280,200], col:'#ff4400' },
    ];
    for(const arm of arms){
      const g = ctx.createLinearGradient(475,345, arm.end[0],arm.end[1]);
      g.addColorStop(0, arm.col); g.addColorStop(1,'transparent');
      ctx.strokeStyle=g; ctx.lineWidth=120;
      ctx.beginPath(); ctx.moveTo(475,345);
      ctx.quadraticCurveTo(arm.ctrl[0],arm.ctrl[1],arm.end[0],arm.end[1]);
      ctx.stroke();
    }

    ctx.restore();

    // Faction zone tints (very subtle) — concentric rings matching the new cluster layout
    const zoneTints = [
      { cx:475, cy:345, r:160, col:'rgba(20,50,180,0.05)' },  // earth core (blue)
      { cx:475, cy:345, r:270, col:'rgba(60,30,120,0.03)' },  // mid ring
      { cx:475, cy:345, r:360, col:'rgba(80,20,60,0.03)' },   // outer ring
    ];
    for(const z of zoneTints){
      const g = ctx.createRadialGradient(z.cx,z.cy,0,z.cx,z.cy,z.r);
      g.addColorStop(0,z.col); g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g; ctx.fillRect(0,0,950,700);
    }
  }
};
