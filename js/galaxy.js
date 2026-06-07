'use strict';
// ── Galaxy map ────────────────────────────────────────────
G.Galaxy = class {
  constructor() {
    this.routes     = G.buildHyperspaceRoutes();
    this.visited    = new Set(['sol']);
    this.known      = new Set(['sol']); // visited + their neighbors
    this.selected   = null;
    this.hoveredSys = null;
    this.jumpRoute  = [];
    this._infoSys   = null;      // persistently selected system (click)
    this._landableCache = {};
    this._canvas    = null;
    this._ctx       = null;
    // Zoom/pan state
    this._zoom = 1.0;
    this._panX = 0;
    this._panY = 0;
  }

  init() {
    this._canvas = document.getElementById('galaxy-canvas');
    this._ctx    = this._canvas.getContext('2d');
    this._canvas.width  = 950;
    this._canvas.height = 700;
    this._canvas.style.width  = '950px';
    this._canvas.style.height = '700px';

    this._canvas.addEventListener('mousemove', e => {
      const rect = this._canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (950 / rect.width);
      const my = (e.clientY - rect.top)  * (700 / rect.height);
      this.hoveredSys = this._sysAt(mx, my);
    });

    this._canvas.addEventListener('click', e => {
      const currentId = G.game?.currentSysId;
      if(!this.hoveredSys) {
        // Click on empty space — clear selection and route
        this._infoSys  = null;
        this.jumpRoute = [];
        this.selected  = null;
        return;
      }
      const targetId = this.hoveredSys.id;
      this._infoSys  = this.hoveredSys;  // always pin info on click
      if(targetId === currentId) {
        // Clicking current system just shows info, no routing
        G.sound?.mapNodeSelect();
        return;
      }
      const route = this._findRoute(currentId, targetId);
      if(route && route.length > 0) {
        this.jumpRoute = route;
        this.selected  = G.SYSTEMS.find(s => s.id === route[0]);
        G.sound?.mapNodeSelect();
      } else {
        G.ui?.addMsg('No route found to that system.', '#ff4444');
      }
    });

    this._canvas.addEventListener('dblclick', e => {
      if(!this.hoveredSys) return;
      const space = G.game?.space;
      if(!space) return;
      const hailable = [...(space.npcs||[]), ...(space.fleetShips||[])]
        .filter(n => !n.dead && !n._deathDone && !n.hostile);
      if(hailable.length > 0) {
        G.ui?.openComms(hailable[0]);
      }
    });

    // Mouse-wheel zoom centered on cursor position
    this._canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = this._canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (950 / rect.width);
      const my = (e.clientY - rect.top)  * (700 / rect.height);
      const f  = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newZoom = Math.max(0.45, Math.min(4.5, this._zoom * f));
      const scale   = newZoom / this._zoom;
      this._panX  = mx - (mx - this._panX) * scale;
      this._panY  = my - (my - this._panY) * scale;
      this._zoom  = newZoom;
    }, { passive: false });

    document.getElementById('close-galaxy-btn')
      .addEventListener('click', () => G.game.closeGalaxy());

    const jb = document.getElementById('jump-btn');
    if(jb) jb.classList.add('hidden');
  }

  // ── Coordinate helpers ───────────────────────────────────
  _toWorld(cx, cy) {
    return [(cx - this._panX) / this._zoom, (cy - this._panY) / this._zoom];
  }
  _toCanvas(wx, wy) {
    return [wx * this._zoom + this._panX, wy * this._zoom + this._panY];
  }

  // ── Route finding ────────────────────────────────────────
  _findRoute(fromId, toId) {
    if(fromId === toId) return [];
    const queue   = [[fromId]];
    const visited = new Set([fromId]);
    while(queue.length) {
      const path = queue.shift();
      const cur  = path[path.length - 1];
      for(const next of (this.routes[cur] || [])) {
        if(visited.has(next)) continue;
        visited.add(next);
        const np = [...path, next];
        if(next === toId) return np.slice(1);
        queue.push(np);
      }
    }
    return null;
  }

  canJumpTo(sysId) {
    if(!G.game?.player?.canJump) return false;
    const cur = G.SYSTEMS.find(s => s.id === G.game.currentSysId);
    return cur ? (this.routes[cur.id] || []).includes(sysId) : false;
  }

  nextJumpableHop() {
    if(!this.jumpRoute.length) return null;
    const id = this.jumpRoute[0];
    return this.canJumpTo(id) ? G.SYSTEMS.find(s => s.id === id) : null;
  }

  clearRoute() { this.jumpRoute = []; this.selected = null; this._infoSys = null; }

  // Mark a system visited and reveal its neighbors on the map
  revealAround(sysId) {
    this.visited.add(sysId);
    this.known.add(sysId);
    for(const nb of (this.routes[sysId] || [])) this.known.add(nb);
  }

  _sysAt(mx, my) {
    // Only pick known systems
    const [wx, wy] = this._toWorld(mx, my);
    for(const sys of G.SYSTEMS) {
      if(!this.known.has(sys.id)) continue;
      if(Math.hypot(sys.pos[0] - wx, sys.pos[1] - wy) <= 10) return sys;
    }
    return null;
  }


  _missionTargets() {
    const t = {};
    if(!G.game) return t;
    for(const m of G.game.activeMissions) {
      if(m.completed || m.failed) continue;
      const dest = m.params.dest || m.params.target;
      if(dest) { (t[dest] = t[dest] || []).push(m.type); }
    }
    return t;
  }

  // ── Main draw ────────────────────────────────────────────
  draw(playerSysId) {
    const ctx = this._ctx;
    if(!ctx) return;

    // 1. Canvas-space background (stars stay fixed as you pan/zoom)
    ctx.clearRect(0, 0, 950, 700);
    this._drawStarsAndFill(ctx);

    // 2. Galaxy content in zoom-space
    ctx.save();
    ctx.setTransform(this._zoom, 0, 0, this._zoom, this._panX, this._panY);
    this._drawNebulaeAndCore(ctx);
    this._drawRouteLines(ctx, playerSysId);
    this._drawMissionPings(ctx);
    this._drawSystems(ctx, playerSysId);
    ctx.restore();

    // 3. Canvas-space UI overlays
    if(this.jumpRoute.length > 0) {
      this._drawRoutePanel(ctx, playerSysId);
    }
    if(this._infoSys) {
      this._drawInfoPanel(ctx, this._infoSys, playerSysId);
    } else if(this.hoveredSys) {
      const [csx, csy] = this._toCanvas(...this.hoveredSys.pos);
      this._drawHoverPanel(ctx, this.hoveredSys, playerSysId, csx, csy);
    }
    this._drawLegend(ctx);
    this._drawZoomHint(ctx);
  }

  // ── Stars (canvas-space, fixed) ──────────────────────────
  _drawStarsAndFill(ctx) {
    ctx.fillStyle = '#00010a';
    ctx.fillRect(0, 0, 950, 700);
    const rng = G.seededRng('galaxy_bg3');
    for(let i = 0; i < 900; i++) {
      const x = rng() * 950, y = rng() * 700;
      const d = Math.hypot(x - 475, y - 345);
      const density = Math.max(0.1, 1 - d / 460);
      if(rng() > density * 0.7 + 0.3) continue;
      const bright = 0.06 + rng() * 0.6 * density;
      const sz = rng() < 0.04 ? 1.5 : 0.8;
      ctx.fillStyle = `rgba(${200 + rng() * 55 | 0},${210 + rng() * 45 | 0},255,${bright})`;
      ctx.fillRect(x | 0, y | 0, sz, sz);
    }
  }

  // ── Galactic core (world-space, zooms with map) ──────────
  _drawNebulaeAndCore(ctx) {
    const CX = 475, CY = 345;

    // Outer diffuse haze over the whole map
    const haze = ctx.createRadialGradient(CX, CY, 140, CX, CY, 490);
    haze.addColorStop(0, 'rgba(18,22,65,0.22)');
    haze.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = haze; ctx.fillRect(0, 0, 950, 700);

    // Core outer corona — purple-blue
    const corona = ctx.createRadialGradient(CX, CY, 50, CX, CY, 185);
    corona.addColorStop(0,   'rgba(130,80,240,0.18)');
    corona.addColorStop(0.5, 'rgba(65,45,155,0.09)');
    corona.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = corona; ctx.fillRect(CX-185, CY-185, 370, 370);

    // Core mid warm bulge — yellow-orange
    const bulge = ctx.createRadialGradient(CX, CY, 8, CX, CY, 90);
    bulge.addColorStop(0,    'rgba(255,238,155,0.48)');
    bulge.addColorStop(0.45, 'rgba(220,168,85,0.22)');
    bulge.addColorStop(1,    'rgba(150,100,38,0)');
    ctx.fillStyle = bulge; ctx.fillRect(CX-90, CY-90, 180, 180);

    // Core hot bright center
    const hot = ctx.createRadialGradient(CX, CY, 0, CX, CY, 36);
    hot.addColorStop(0,   'rgba(255,252,228,0.80)');
    hot.addColorStop(0.3, 'rgba(255,228,130,0.48)');
    hot.addColorStop(0.7, 'rgba(240,175,70,0.16)');
    hot.addColorStop(1,   'rgba(200,140,55,0)');
    ctx.fillStyle = hot; ctx.fillRect(CX-36, CY-36, 72, 72);

    // Dense core star cluster
    const cRng = G.seededRng('core_stars_v3');
    ctx.save();
    for (let i = 0; i < 280; i++) {
      const a    = cRng() * Math.PI * 2;
      const r    = Math.sqrt(cRng()) * 88;
      const x    = CX + Math.cos(a) * r;
      const y    = CY + Math.sin(a) * r;
      const fade = 1 - r / 88;
      const bright = (0.28 + cRng() * 0.72) * (0.35 + fade * 0.65);
      if (cRng() < 0.22) {
        ctx.fillStyle = `rgba(165,198,255,${bright * 0.72})`;
      } else {
        const g = 188 + cRng() * 60 | 0;
        const b = 95  + cRng() * 85 | 0;
        ctx.fillStyle = `rgba(255,${g},${b},${bright})`;
      }
      const sz = (r < 16 && cRng() < 0.14) ? 2 : 1;
      ctx.fillRect((x - sz * 0.5) | 0, (y - sz * 0.5) | 0, sz, sz);
    }
    ctx.restore();

    // Subtle dust arcs curving around the bulge
    const dustRng = G.seededRng('core_dust_v1');
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const a0 = dustRng() * Math.PI * 2;
      const r  = 95 + dustRng() * 55;
      const span = 0.9 + dustRng() * 1.1;
      ctx.beginPath();
      ctx.arc(CX, CY, r, a0, a0 + span);
      ctx.strokeStyle = `rgba(0,0,0,${0.06 + dustRng() * 0.09})`;
      ctx.lineWidth = 20 + dustRng() * 28;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── Route lines ──────────────────────────────────────────
  _drawRouteLines(ctx, playerSysId) {
    const routeSet = new Set(this.jumpRoute);
    const lw = 1 / this._zoom;
    const drawn = new Set();

    for(const [sysId, conns] of Object.entries(this.routes)) {
      const a = G.SYSTEMS.find(s => s.id === sysId);
      if(!a) continue;
      for(const connId of conns) {
        const key = [sysId, connId].sort().join('|');
        if(drawn.has(key)) continue;
        drawn.add(key);
        const b = G.SYSTEMS.find(s => s.id === connId);
        if(!b) continue;

        // Hide routes where either endpoint is unknown
        if(!this.known.has(sysId) || !this.known.has(connId)) continue;
        const aVis = this.visited.has(sysId), bVis = this.visited.has(connId);
        // Don't draw lines between two unvisited-known nodes
        if(!aVis && !bVis) continue;

        const onRoute = (routeSet.has(sysId) && routeSet.has(connId))
          || (sysId === playerSysId && connId === this.jumpRoute[0])
          || (connId === playerSysId && sysId === this.jumpRoute[0]);

        ctx.beginPath();
        ctx.moveTo(a.pos[0], a.pos[1]);
        ctx.lineTo(b.pos[0], b.pos[1]);
        if(onRoute) {
          ctx.strokeStyle = 'rgba(0,200,255,0.65)'; ctx.lineWidth = 2 * lw;
        } else if(aVis && bVis) {
          ctx.strokeStyle = 'rgba(70,120,170,0.28)'; ctx.lineWidth = lw;
        } else {
          // One visited, one known-unvisited: dim dotted line
          ctx.strokeStyle = 'rgba(50,80,110,0.20)'; ctx.lineWidth = lw;
          ctx.setLineDash([3/this._zoom, 5/this._zoom]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Reachable-from-current highlight
    if(G.game?.player.canJump) {
      const cs = G.SYSTEMS.find(s => s.id === playerSysId);
      for(const rid of (this.routes[playerSysId] || [])) {
        const rs = G.SYSTEMS.find(s => s.id === rid);
        if(!rs || !cs) continue;
        ctx.beginPath();
        ctx.moveTo(cs.pos[0], cs.pos[1]);
        ctx.lineTo(rs.pos[0], rs.pos[1]);
        ctx.strokeStyle = 'rgba(0,200,255,0.20)';
        ctx.lineWidth = 1.5 * lw; ctx.stroke();
      }
    }
  }

  // ── Mission destination pings ────────────────────────────
  _drawMissionPings(ctx) {
    const pulse = 0.4 + 0.4 * Math.sin(Date.now() * 0.003);
    for(const [sysId] of Object.entries(this._missionTargets())) {
      const sys = G.SYSTEMS.find(s => s.id === sysId);
      if(!sys) continue;
      const [sx, sy] = sys.pos;
      ctx.beginPath(); ctx.arc(sx, sy, 12 + pulse * 3, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,200,0,${0.5 + pulse * 0.3})`;
      ctx.lineWidth = 1.5 / this._zoom; ctx.stroke();
    }
  }

  // ── System nodes ─────────────────────────────────────────
  _drawSystems(ctx, playerSysId) {
    const routeSet = new Set(this.jumpRoute);
    const lw = 1 / this._zoom;

    for(const sys of G.SYSTEMS) {
      const [sx, sy] = sys.pos;
      const visited = this.visited.has(sys.id);
      const isCur   = sys.id === playerSysId;

      // Skip completely unknown systems
      if(!this.known.has(sys.id) && !isCur) continue;

      const isHov   = sys === this.hoveredSys;
      const isRoute = routeSet.has(sys.id);
      const isNext  = this.jumpRoute.length > 0 && sys.id === this.jumpRoute[0];

      // Known-but-unvisited: empty white circle
      if(!visited && !isCur) {
        ctx.globalAlpha = isHov ? 0.9 : 0.5;
        ctx.beginPath(); ctx.arc(sx, sy, isHov ? 3.5 : 2.8, 0, Math.PI * 2);
        ctx.strokeStyle = isHov ? '#ffffff' : 'rgba(200,215,235,0.85)';
        ctx.lineWidth = 0.9 * lw;
        ctx.stroke();
        ctx.globalAlpha = 1.0;
        continue;
      }

      const fac     = G.FACTIONS[sys.faction];
      // Faction color — grey for contested/neutral/independent
      const isGreyFac = !fac || sys.faction === 'neutral'
                     || sys.faction === 'independent' || sys.faction === 'contested';
      const facCol = isGreyFac ? '#888888' : (fac?.color || '#888888');

      // Relation ring color (shown as border of the node dot)
      let relCol = null;
      if(G.game && !isCur) {
        const rel = G.game.getRel(sys.faction);
        relCol = rel >= 50  ? '#00ff66'
               : rel >= -20 ? '#777777'
               : rel >= -50 ? '#ffcc00'
               :              '#ff3333';
      }

      // Outer hover / route / next indicators
      if(isCur) {
        ctx.beginPath(); ctx.arc(sx, sy, 15, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,255,238,0.07)'; ctx.fill();
      }
      if(isNext) {
        ctx.beginPath(); ctx.arc(sx, sy, 10, 0, Math.PI * 2);
        ctx.strokeStyle = '#00ffee'; ctx.lineWidth = 2 * lw; ctx.stroke();
      } else if(isRoute) {
        ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,180,255,0.75)'; ctx.lineWidth = 1.5 * lw; ctx.stroke();
      } else if(isHov && !isCur) {
        ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,220,220,0.7)'; ctx.lineWidth = 1.5 * lw; ctx.stroke();
      }

      // Node dot — faction colored (including current system)
      const r = isCur ? 5.5 : (visited ? 4.5 : 3);
      const dotFill = isRoute && !isCur ? '#44aaff' : facCol;
      ctx.globalAlpha = (visited || isCur) ? 1.0 : 0.38;

      if(sys.noStar) {
        // Alien/void systems: diamond shape
        ctx.beginPath();
        ctx.moveTo(sx, sy - r * 1.4); ctx.lineTo(sx + r * 1.4, sy);
        ctx.lineTo(sx, sy + r * 1.4); ctx.lineTo(sx - r * 1.4, sy);
        ctx.closePath();
        ctx.strokeStyle = dotFill; ctx.lineWidth = 1.5 * lw; ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fillStyle = dotFill; ctx.fill();
        // Relation indicator as the node's stroke border
        if(relCol) {
          ctx.strokeStyle = relCol;
          ctx.lineWidth   = 1.8 * lw;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1.0;

      // Label — always show for current/next/hovered; visited only when zoom > 0.8
      const showLabel = isCur || isNext || isHov || (visited && this._zoom > 0.7);
      if(showLabel) {
        const labelCol = (isCur || isNext) ? '#00ffee' : facCol;
        ctx.fillStyle = labelCol;
        ctx.globalAlpha = (visited || isCur) ? 1.0 : 0.55;
        ctx.font = `${isCur ? 'bold ' : ''}8px "Press Start 2P",monospace`;
        const displayName = (visited || isCur) ? sys.name : 'UNDISCOVERED';
        ctx.fillText(displayName, sx + 6, sy - 5);
        ctx.globalAlpha = 1.0;
      }
    }

    // Current system pulse ring
    const cur = G.SYSTEMS.find(s => s.id === playerSysId);
    if(cur) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.003);
      ctx.beginPath(); ctx.arc(cur.pos[0], cur.pos[1], 7 + pulse * 3, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0,255,238,${0.4 + pulse * 0.4})`;
      ctx.lineWidth = 1.5 / this._zoom; ctx.stroke();
    }
  }

  // ── Route panel (canvas-space) ───────────────────────────
  _drawRoutePanel(ctx, playerSysId) {
    const dest  = G.SYSTEMS.find(s => s.id === this.jumpRoute[this.jumpRoute.length - 1]);
    const next  = G.SYSTEMS.find(s => s.id === this.jumpRoute[0]);
    const hops  = this.jumpRoute.length;
    const fuel  = G.game?.player.fuel || 0;
    const PW = 220, PH = 130, px = 950 - PW - 12, py = 12;

    ctx.save();
    ctx.fillStyle = 'rgba(0,8,20,0.94)'; ctx.strokeStyle = '#1a6a4a'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px+4,py); ctx.lineTo(px+PW-4,py); ctx.quadraticCurveTo(px+PW,py,px+PW,py+4);
    ctx.lineTo(px+PW,py+PH-4); ctx.quadraticCurveTo(px+PW,py+PH,px+PW-4,py+PH);
    ctx.lineTo(px+4,py+PH); ctx.quadraticCurveTo(px,py+PH,px,py+PH-4);
    ctx.lineTo(px,py+4); ctx.quadraticCurveTo(px,py,px+4,py); ctx.closePath();
    ctx.fill(); ctx.stroke();

    ctx.font = '8px "Press Start 2P",monospace'; ctx.fillStyle = '#00ffee';
    ctx.fillText('ROUTE PLANNED', px+8, py+16);
    ctx.font = '7px "Press Start 2P",monospace'; ctx.fillStyle = '#aaa';
    ctx.fillText('NEXT: ' + (next?.name || '?'), px+8, py+32);
    ctx.fillText('DEST: ' + (dest?.name || '?'), px+8, py+46);
    ctx.fillText('HOPS: ' + hops, px+8, py+60);
    ctx.fillStyle = fuel >= hops*10 ? '#44ff44' : '#ff4444';
    ctx.fillText('FUEL: ' + Math.ceil(fuel) + ' (' + Math.floor(fuel/10) + ' jumps)', px+8, py+74);
    if(G.game?.player.canJump) {
      ctx.fillStyle = '#00ffee';
      ctx.fillText('HOLD [J] TO JUMP', px+8, py+92);
    } else {
      ctx.fillStyle = '#ff4444';
      ctx.fillText('NO HYPERSPACE DRIVE', px+8, py+92);
    }
    ctx.fillStyle = '#556677'; ctx.font = '6px "Press Start 2P",monospace';
    ctx.fillText('click system to reroute', px+8, py+107);
    ctx.fillText('[M] close map', px+8, py+120);
    ctx.restore();
  }

  // ── Hover panel (canvas-space, positioned near node) ────
  _drawHoverPanel(ctx, sys, playerSysId, csx, csy) {
    const fac     = G.FACTIONS[sys.faction];
    const rel     = G.game ? G.game.getRel(sys.faction) : 0;
    const visited = this.visited.has(sys.id) || sys.id === playerSysId;
    const isCur   = sys.id === playerSysId;
    const route   = isCur ? null : this._findRoute(playerSysId, sys.id);
    const hops    = route ? route.length : null;
    const facCol  = (fac && sys.faction !== 'contested' && sys.faction !== 'neutral')
                  ? fac.color : '#aaaaaa';
    const displayName = visited ? sys.name : 'UNDISCOVERED';

    const PW = 200, PH = visited ? 155 : 110;
    const px = Math.min(csx + 18, 950 - PW - 8);
    const py = Math.max(8, Math.min(csy - 20, 700 - PH - 8));

    ctx.save();
    ctx.fillStyle = 'rgba(3,10,22,0.94)'; ctx.strokeStyle = isCur ? '#00ffee' : '#1a4a6a'; ctx.lineWidth = 1;
    const rr = 4;
    ctx.beginPath();
    ctx.moveTo(px+rr,py); ctx.lineTo(px+PW-rr,py); ctx.quadraticCurveTo(px+PW,py,px+PW,py+rr);
    ctx.lineTo(px+PW,py+PH-rr); ctx.quadraticCurveTo(px+PW,py+PH,px+PW-rr,py+PH);
    ctx.lineTo(px+rr,py+PH); ctx.quadraticCurveTo(px,py+PH,px,py+PH-rr);
    ctx.lineTo(px,py+rr); ctx.quadraticCurveTo(px,py,px+rr,py);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // Connector line from node to panel
    ctx.beginPath(); ctx.moveTo(csx, csy); ctx.lineTo(px, py + PH / 2);
    ctx.strokeStyle = 'rgba(0,200,200,0.22)'; ctx.lineWidth = 0.5; ctx.stroke();

    ctx.font = '9px "Press Start 2P",monospace';
    ctx.fillStyle = visited ? facCol : '#556677';
    ctx.fillText(displayName.slice(0, 18), px+8, py+16);

    if(isCur) {
      ctx.font = '6px "Press Start 2P",monospace'; ctx.fillStyle = '#00ffee';
      ctx.fillText('CURRENT SYSTEM', px+8, py+28);
    }

    if(visited) {
      ctx.font = '7px "Press Start 2P",monospace'; ctx.fillStyle = '#aaa';
      const stars = '★'.repeat(Math.min(sys.danger, 5)) + '☆'.repeat(Math.max(0, 5 - sys.danger));
      const facName = (fac?.name || sys.faction).slice(0, 14);
      const ports = this._getLandableCount(sys);
      const r0 = isCur ? 42 : 30;
      ctx.fillText('Faction: ' + facName, px+8, py+r0);
      ctx.fillStyle = '#ff8844';
      ctx.fillText('Danger:  ' + stars, px+8, py+r0+13);
      ctx.fillStyle = '#44aaff';
      ctx.fillText('Ports:   ' + ports, px+8, py+r0+26);
      ctx.fillStyle = rel > 0 ? '#44ff44' : rel < 0 ? '#ff4444' : '#aaa';
      ctx.fillText('Rep:     ' + rel, px+8, py+r0+39);
      if(!isCur && hops !== null) {
        ctx.fillStyle = '#00aaff';
        ctx.fillText(hops + ' hop' + (hops!==1?'s':'') + ' / ' + (hops*10) + ' fuel', px+8, py+r0+56);
        ctx.fillStyle = '#aaaaaa'; ctx.font = '6px "Press Start 2P",monospace';
        ctx.fillText('Click to set destination', px+8, py+r0+70);
      } else if(!isCur) {
        ctx.fillStyle = '#666'; ctx.font = '7px "Press Start 2P",monospace';
        ctx.fillText('Unreachable', px+8, py+r0+56);
      } else {
        ctx.fillStyle = '#556677'; ctx.font = '6px "Press Start 2P",monospace';
        ctx.fillText('Click for system info', px+8, py+PH-10);
      }
    } else {
      ctx.font = '6px "Press Start 2P",monospace'; ctx.fillStyle = '#445566';
      ctx.fillText('Scan required to identify', px+8, py+34);
      if(hops !== null) {
        ctx.fillStyle = '#334455';
        ctx.fillText(hops + ' hop' + (hops!==1?'s':'') + ' away', px+8, py+50);
      }
    }
    ctx.restore();
  }

  // ── Persistent info panel (after click) ──────────────────
  _drawInfoPanel(ctx, sys, playerSysId) {
    const fac     = G.FACTIONS[sys.faction];
    const rel     = G.game ? G.game.getRel(sys.faction) : 0;
    const visited = this.visited.has(sys.id) || sys.id === playerSysId;
    const isCur   = sys.id === playerSysId;
    const facCol  = (fac && sys.faction !== 'contested' && sys.faction !== 'neutral')
                  ? fac.color : '#aaaaaa';
    const displayName = visited ? sys.name : 'UNDISCOVERED';
    const ports   = visited ? this._getLandableCount(sys) : null;

    const PW = 220, PH = 185;
    const px = 12, py = 12;

    ctx.save();
    ctx.fillStyle = 'rgba(2,8,18,0.96)';
    ctx.strokeStyle = isCur ? '#00ffee' : facCol;
    ctx.lineWidth = 1.2;
    const rr = 5;
    ctx.beginPath();
    ctx.moveTo(px+rr,py); ctx.lineTo(px+PW-rr,py); ctx.quadraticCurveTo(px+PW,py,px+PW,py+rr);
    ctx.lineTo(px+PW,py+PH-rr); ctx.quadraticCurveTo(px+PW,py+PH,px+PW-rr,py+PH);
    ctx.lineTo(px+rr,py+PH); ctx.quadraticCurveTo(px,py+PH,px,py+PH-rr);
    ctx.lineTo(px,py+rr); ctx.quadraticCurveTo(px,py,px+rr,py);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // Title
    ctx.font = 'bold 9px "Press Start 2P",monospace';
    ctx.fillStyle = visited ? facCol : '#445566';
    ctx.fillText(displayName.slice(0, 20), px+10, py+18);

    if(isCur) {
      ctx.font = '6px "Press Start 2P",monospace';
      ctx.fillStyle = '#00ffee';
      ctx.fillText('★ CURRENT LOCATION', px+10, py+30);
    }

    let row = isCur ? py+46 : py+34;
    const line = (label, val, col) => {
      ctx.font = '7px "Press Start 2P",monospace';
      ctx.fillStyle = '#556677'; ctx.fillText(label, px+10, row);
      ctx.fillStyle = col||'#aabbcc'; ctx.fillText(val, px+90, row);
      row += 16;
    };

    if(visited) {
      const facName = (fac?.name || sys.faction) || 'Independent';
      const stars = '★'.repeat(Math.min(sys.danger,5))+'☆'.repeat(Math.max(0,5-sys.danger));
      const relCol = rel>=50?'#44ff88':rel>=-20?'#aabbcc':rel>=-50?'#ffcc00':'#ff4444';
      const relStr = (rel>0?'+':'')+rel;
      line('FACTION', facName.slice(0,14), facCol);
      line('DANGER', stars, '#ff8844');
      line('PORTS', ports+' landable', '#44aaff');
      line('REP', relStr, relCol);
      if(!isCur) {
        const route = this._findRoute(playerSysId, sys.id);
        if(route) {
          const hops = route.length;
          line('ROUTE', hops+' hop'+(hops!==1?'s':'')+' / '+(hops*10)+' fuel', '#00aaff');
        } else {
          line('ROUTE', 'unreachable', '#444');
        }
      }
    } else {
      ctx.font = '7px "Press Start 2P",monospace';
      ctx.fillStyle = '#334455';
      ctx.fillText('System not yet visited.', px+10, row);
      row += 16;
      ctx.fillText('Jump there to reveal info.', px+10, row);
    }

    ctx.font = '6px "Press Start 2P",monospace';
    ctx.fillStyle = '#334455';
    ctx.fillText('Click space to dismiss', px+10, py+PH-10);
    ctx.restore();
  }

  // ── Landable body count (cached) ─────────────────────────
  _getLandableCount(sys) {
    if(this._landableCache[sys.id] !== undefined) return this._landableCache[sys.id];
    const local = G.generateLocalSystem(sys);
    const count = local.bodies.filter(b => b.hasSpaceport).length;
    this._landableCache[sys.id] = count;
    return count;
  }

  // ── Legend (canvas-space, bottom) ───────────────────────
  _drawLegend(ctx) {
    const armItems = [
      { col: '#4488ff', txt: 'EARTH'       },
      { col: '#ff6600', txt: 'REBELLION'   },
      { col: '#cc2222', txt: 'PIRATES'     },
      { col: '#00ff88', txt: 'ALIEN'       },
      { col: '#aaaaaa', txt: 'INDEPENDENT' },
    ];
    const relItems = [
      { col: '#00ff66', txt: 'ALLIED'   },
      { col: '#777777', txt: 'NEUTRAL'  },
      { col: '#ffcc00', txt: 'CAUTION'  },
      { col: '#ff3333', txt: 'HOSTILE'  },
    ];
    ctx.save();
    ctx.font = '7px "Press Start 2P",monospace';

    let lx = 8, ly = 675;
    for(const { col, txt } of armItems) {
      ctx.fillStyle = col; ctx.fillRect(lx, ly - 7, 9, 9);
      ctx.fillStyle = '#778899'; ctx.fillText(txt, lx + 14, ly);
      lx += txt.length * 6 + 30;
    }

    // Relation ring legend (small circle with colored stroke)
    lx = 8; ly = 693;
    ctx.font = '6px "Press Start 2P",monospace';
    for(const { col, txt } of relItems) {
      ctx.beginPath(); ctx.arc(lx + 4, ly - 3, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#111'; ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.stroke();
      ctx.fillStyle = '#778899'; ctx.fillText(txt, lx + 14, ly);
      lx += txt.length * 6.5 + 28;
    }
    ctx.lineWidth = 0.5;
    ctx.restore();
  }

  _drawZoomHint(ctx) {
    ctx.save();
    ctx.font = '6px "Press Start 2P",monospace';
    ctx.fillStyle = 'rgba(80,100,120,0.7)';
    ctx.fillText('SCROLL to zoom · CLICK node to select · CLICK space to clear', 8, 14);
    ctx.restore();
  }
};
