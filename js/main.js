'use strict';
// ── Constants ─────────────────────────────────────────────
G.BASE_CANVAS_W = 1200;
G.BASE_CANVAS_H = 750;
G.CANVAS_W = 1200; // updated dynamically by _resize
G.CANVAS_H = 750;
G.SAVE_KEY  = 'nullpunkt_save_v2';

// ── Hex-map constants & utilities ─────────────────────────
G.HEX_PX    = 44;   // screen pixels per hex radius in hex-map view (fits ~rings 0-7)
G.HEX_WORLD = 1200; // world units per hex radius (ship-position / tile scaling)

// All axial {q,r} coords at cube-distance n from origin (ring n)
G.hexRing = function(n) {
  if(n === 0) return [{q:0, r:0}];
  const result = [];
  for(let q = -n; q <= n; q++) {
    const r1 = Math.max(-n, -q-n), r2 = Math.min(n, -q+n);
    for(let r = r1; r <= r2; r++) {
      if(Math.max(Math.abs(q), Math.abs(r), Math.abs(-q-r)) === n)
        result.push({q, r});
    }
  }
  return result;
};

// ── Crew Animation State ──────────────────────────────────
// Transient walk state kept separate from saved crew objects.
G.CrewAnim = {
  _s: new Map(),  // crewId -> { gx, gy, tx, ty, idleTimer, walkFrame, frameTimer }

  get(id, defCol, defRow) {
    if(!this._s.has(id)) {
      this._s.set(id, {
        gx: defCol, gy: defRow,
        tx: defCol, ty: defRow,
        idleTimer: Math.random() * 2,
        walkFrame: 0, frameTimer: 0.2
      });
    }
    return this._s.get(id);
  },

  prune(ids) {
    for(const k of this._s.keys()) if(!ids.has(k)) this._s.delete(k);
  }
};

// Returns the display color for a crew member: faction color if set, else role-based fallback.
G.crewColor = function(c) {
  if(c.faction && G.FACTIONS[c.faction]) return G.FACTIONS[c.faction].color;
  const rc = { pilot:'#ffdd44', engineer:'#ffaa22', gunner:'#ff5533', medic:'#44ffaa', navigator:'#44aaff', marine:'#aa88ff' };
  return rc[c.role] || '#aaaaaa';
};

// ── Renderer ──────────────────────────────────────────────
G.Renderer = class {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this._deepBgCache = new Map();
    this._resize();
    window.addEventListener('resize', ()=>this._resize());
  }

  _resize() {
    // Scale to fill height; on ultrawide expand canvas width to fill screen (no black bars)
    const ratio = Math.min(window.innerWidth / G.BASE_CANVAS_W, window.innerHeight / G.BASE_CANVAS_H);
    const logW  = Math.round(window.innerWidth  / ratio);
    const logH  = Math.round(window.innerHeight / ratio);

    G.CANVAS_W = logW;
    G.CANVAS_H = logH;

    this.canvas.width  = logW;
    this.canvas.height = logH;
    this.canvas.style.width  = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.left   = '0';
    this.canvas.style.top    = '0';

    const gc = document.getElementById('game-container');
    if (gc) {
      gc.style.width           = logW + 'px';
      gc.style.height          = logH + 'px';
      gc.style.left            = '0';
      gc.style.top             = '0';
      gc.style.transform       = `scale(${ratio})`;
      gc.style.transformOrigin = 'top left';
      gc.style.setProperty('--canvas-w', logW + 'px');
      gc.style.setProperty('--canvas-h', logH + 'px');
    }
  }

  clear() {
    this.ctx.fillStyle = '#000810';
    this.ctx.fillRect(0,0,G.CANVAS_W,G.CANVAS_H);
  }

  drawBg(bgStars, camX, camY, zoom=1, speedMult=1, stretchMult=0) {
    const ctx = this.ctx;
    ctx.save();
    // Scale background from screen center to match camera zoom
    ctx.translate(G.CANVAS_W/2, G.CANVAS_H/2);
    ctx.scale(zoom, zoom);
    ctx.translate(-G.CANVAS_W/2, -G.CANVAS_H/2);
    const parallaxBase = [0.08,0.25,0.55];
    const tileW = G.CANVAS_W * 2;
    const tileH = G.CANVAS_H * 2;
    // Extra tile passes needed to fill screen when zoomed out
    const extra = Math.max(0, Math.ceil(1/(2*Math.max(zoom,0.1))));
    for(const s of bgStars) {
      const px = parallaxBase[s.layer] * speedMult;
      const bsx = ((s.x - camX*px) % tileW + tileW*2) % tileW;
      const bsy = ((s.y - camY*px) % tileH + tileH*2) % tileH;
      const alpha = s.brightness * Math.min(1, speedMult * 0.7 + 0.3);
      ctx.fillStyle = `rgba(${180+s.brightness*75},${200+s.brightness*55},255,${alpha*0.8})`;
      for(let tx = -extra; tx <= extra; tx++) {
        for(let ty = -extra; ty <= extra; ty++) {
          const sx = bsx + tx * tileW;
          const sy = bsy + ty * tileH;
          if(stretchMult > 0.1) {
            const dx = sx - G.CANVAS_W/2;
            const dy = sy - G.CANVAS_H/2;
            const len = Math.max(1, stretchMult * s.layer * 30);
            const norm = Math.sqrt(dx*dx+dy*dy+0.001);
            ctx.beginPath();
            ctx.moveTo(sx|0, sy|0);
            ctx.lineTo((sx + dx/norm*len)|0, (sy + dy/norm*len)|0);
            ctx.strokeStyle = ctx.fillStyle;
            ctx.lineWidth = s.r;
            ctx.stroke();
          } else {
            ctx.fillRect(sx|0, sy|0, s.r, s.r);
          }
        }
      }
    }
    ctx.restore();
  }

  drawShip(x, y, angle, shapeId, color, scale=1, thrusting=false, boosting=false, jumpStretch=1, strafeDir=0, superBoost=false, skipSprite=false) {
    if(isNaN(x)||isNaN(y)||!isFinite(x)||!isFinite(y)) return;
    const shape = G.SHAPES[shapeId] || G.SHAPES.shuttle;
    const ctx = this.ctx;
    const SZ = G.Sprites.SZ;
    ctx.save();
    ctx.translate(x|0, y|0);
    ctx.rotate(angle);
    ctx.scale(scale, scale * jumpStretch);

    // Draw ship sprite — photo image if available, else pixel-art
    if(!skipSprite) {
      const imgCanvas = G.ShipImages?.get(shapeId);
      if (imgCanvas) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(imgCanvas, -(SZ>>1), -(SZ>>1), SZ, SZ);
      } else {
        const sprite = G.Sprites.get(shapeId, color || shape.color);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sprite, -(SZ>>1), -(SZ>>1), SZ, SZ);
      }
    }

    // Engine thrust flame overlay (on top of sprite)
    if(thrusting && shape.enginePts) {
      const ew = shape.engineW || 5;
      for(const [ex,ey] of shape.enginePts) {
        const flick = 0.85 + Math.random()*0.3;
        const len = (boosting ? ew*2.8 : ew*1.4) * flick;

        // Exhaust plume — soft, elongated glow trailing behind the flame
        const plumeLen = len * 2.4;
        const plumeW = ew * (boosting ? 1.4 : 1.0);
        const pgrad = ctx.createLinearGradient(ex,ey, ex,ey+plumeLen);
        pgrad.addColorStop(0, superBoost?'rgba(40,255,140,0.65)':boosting?'rgba(120,180,255,0.55)':'rgba(255,170,40,0.55)');
        pgrad.addColorStop(0.4, superBoost?'rgba(0,200,80,0.32)':boosting?'rgba(40,110,255,0.28)':'rgba(255,90,0,0.28)');
        pgrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.moveTo(ex-plumeW, ey);
        ctx.quadraticCurveTo(ex-plumeW*0.5, ey+plumeLen*0.6, ex, ey+plumeLen);
        ctx.quadraticCurveTo(ex+plumeW*0.5, ey+plumeLen*0.6, ex+plumeW, ey);
        ctx.closePath();
        ctx.fillStyle = pgrad;
        ctx.fill();

        // Sharp inner flame triangle
        const grad = ctx.createLinearGradient(ex,ey, ex,ey+len);
        grad.addColorStop(0, superBoost?'#00ff88':boosting?'#44aaff':'#ffaa22');
        grad.addColorStop(0.5, superBoost?'rgba(0,220,100,0.5)':boosting?'rgba(0,100,255,0.5)':'rgba(255,80,0,0.5)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.moveTo(ex-ew*0.35, ey);
        ctx.lineTo(ex+ew*0.35, ey);
        ctx.lineTo(ex, ey+len);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }
    }

    // Side thruster flame when strafing
    // strafeDir > 0 = strafing right → left side thruster fires (flame points left)
    // strafeDir < 0 = strafing left  → right side thruster fires (flame points right)
    if(strafeDir !== 0) {
      const sx = strafeDir > 0 ? -10 : 10;
      const fx = strafeDir > 0 ? -18 : 18;
      const grad = ctx.createLinearGradient(sx, 0, fx, 0);
      grad.addColorStop(0, boosting ? '#44aaff' : '#ffaa22');
      grad.addColorStop(0.4, boosting ? 'rgba(0,100,255,0.5)' : 'rgba(255,100,0,0.5)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.moveTo(sx, -2.5); ctx.lineTo(sx, 2.5); ctx.lineTo(fx, 0);
      ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();
    }

    ctx.restore();
  }

  // Draw a ship as a flat-top hex module assembly centred at (x,y) in world
  // space. entries: [{ q, r, visual, slot, broken, color }] — `color` is the
  // hull-panel tint for hull entries. Hull tiles draw first (perimeter), inner
  // modules on top. `bbox` (optional) is a precomputed {ox,oy,maxy} centring.
  drawShipTileDisplay(x, y, scale, entries, angle = 0, _unused = null, overrideCtx = null, turnDir = 0) {
    if(!entries || entries.length === 0) return;
    const ctx = overrideCtx || this.ctx;
    const sc = scale || 1;
    const R = G.HEX_R * sc, T = R * 2;
    // Centre the assembly on its hex bounding-box centre.
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    for(const e of entries) {
      const p = G.hexToPixel(e.q, e.r, R);
      if(p.x < minx) minx = p.x; if(p.x > maxx) maxx = p.x;
      if(p.y < miny) miny = p.y; if(p.y > maxy) maxy = p.y;
    }
    const ox = (minx + maxx) / 2, oy = (miny + maxy) / 2;
    ctx.save();
    ctx.translate(x | 0, y | 0);
    if(angle) ctx.rotate(angle);
    ctx.imageSmoothingEnabled = false;
    // Hull panels first (background perimeter layer)
    for(const e of entries) {
      if(e.slot !== 'hull') continue;
      const p = G.hexToPixel(e.q, e.r, R);
      const tile = G.Sprites.getHexTile('hull', e.color || e.hullColor || '#667799', false);
      ctx.drawImage(tile, (p.x - ox - R) | 0, (p.y - oy - R) | 0, T, T);
    }
    // Inner modules on top
    for(const e of entries) {
      if(e.slot === 'hull') continue;
      const p = G.hexToPixel(e.q, e.r, R);
      const slotCol = G.SLOT_RING[e.slot]?.color || '#334455';
      const tile = G.Sprites.getHexTile(e.visual || 'special', slotCol, e.broken);
      ctx.drawImage(tile, (p.x - ox - R) | 0, (p.y - oy - R) | 0, T, T);
    }
    // Rear thruster flame flicker when turning
    if(turnDir !== 0) {
      const thrustX = (turnDir > 0 ? -1 : 1) * R * 0.7;
      const baseY = maxy - oy;
      const flameLen = (12 + Math.random() * 6) * sc, flameW = 3 * sc;
      const grad = ctx.createLinearGradient(thrustX, baseY, thrustX, baseY + flameLen);
      grad.addColorStop(0, '#ffaa22');
      grad.addColorStop(0.5, 'rgba(255,140,20,0.5)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(thrustX - flameW, baseY);
      ctx.lineTo(thrustX + flameW, baseY);
      ctx.lineTo(thrustX + flameW * 0.3, baseY + flameLen);
      ctx.lineTo(thrustX - flameW * 0.3, baseY + flameLen);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Build hex tile entries for a player ship from their live module layout.
  _playerTileEntries(player) {
    G.ui?._ensureBuilderCells?.(player);
    const entries = [];
    for(const [, inst] of Object.entries(player.modules || {})) {
      if(inst.q == null) continue;
      const mod = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
      if(!mod) continue;
      const entry = {
        q: inst.q, r: inst.r,
        visual: mod.visual || (G.WEAPONS[inst.moduleId] ? 'weapon' : 'special'),
        slot: mod.slot || 'special', broken: inst.broken || false,
      };
      if(mod.slot === 'hull') entry.color = inst.color || '#667799';
      entries.push(entry);
    }
    return entries;
  }

  // Hex tile entries for a non-player ship (NPC/enemy/fleet). Uses the shared,
  // cached template layout (G.hexLayoutForTemplate) recoloured to the ship's
  // faction hull tint.
  _npcTileEntries(ship, hullColor) {
    const tplId = ship.shipId || ship.shapeId || ship.templateId;
    const base = G.hexLayoutForTemplate(tplId);
    if(!base.length) return [];
    return base.map(e => e.slot === 'hull'
      ? { ...e, color: hullColor || e.color || '#667799' }
      : e);
  }

  // Draw rotating turret barrels on top of the player's turret module hexes,
  // aimed per slot's tracked angle. playerTurretSlots: weaponSlots with turret.
  drawTurretOverlay(player, scale, playerTurretSlots) {
    if(!player?.modules) return;
    const R = G.HEX_R * scale;
    // bbox centre over all positioned modules (matches drawShipTileDisplay)
    let minx=Infinity,maxx=-Infinity,miny=Infinity,maxy=-Infinity;
    const turrets = [];
    for(const inst of Object.values(player.modules)) {
      if(inst.q == null) continue;
      const p = G.hexToPixel(inst.q, inst.r, R);
      if(p.x<minx)minx=p.x; if(p.x>maxx)maxx=p.x; if(p.y<miny)miny=p.y; if(p.y>maxy)maxy=p.y;
      const m = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
      if(!inst.broken && m && (m.slot === 'turret' || m.turret)) turrets.push(p);
    }
    if(!turrets.length) return;
    const ox=(minx+maxx)/2, oy=(miny+maxy)/2;
    const ctx = this.ctx;
    const sprite = G.Sprites.getTurret();
    const TSZ = G.Sprites.TSZ * scale, half = TSZ / 2;
    const ca = Math.cos(player.angle), sa = Math.sin(player.angle);
    ctx.save();
    ctx.translate(player.x|0, player.y|0);
    ctx.imageSmoothingEnabled = false;
    for(let i=0; i<turrets.length; i++) {
      const lx = turrets[i].x - ox, ly = turrets[i].y - oy;
      const wx = lx*ca - ly*sa, wy = lx*sa + ly*ca;
      const aim = playerTurretSlots?.[i]?._turretAngle;
      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(aim != null ? aim : player.angle);
      ctx.drawImage(sprite, -half, -half, TSZ, TSZ);
      ctx.restore();
    }
    ctx.restore();
  }

  drawShipGridHUD(player) {
    if(!player?.modules) return;
    const ctx = this.ctx;
    G.ui?._ensureBuilderCells?.(player);
    const HR = 8, TH = HR * 2;        // HUD hex radius / tile size
    // Unit-pixel bounding box of the assembly.
    let umnx=Infinity,umxx=-Infinity,umny=Infinity,umxy=-Infinity;
    const mods = [];
    for(const [, inst] of Object.entries(player.modules)) {
      if(inst.q == null) continue;
      const u = G.hexToPixel(inst.q, inst.r, 1);
      if(u.x<umnx)umnx=u.x; if(u.x>umxx)umxx=u.x; if(u.y<umny)umny=u.y; if(u.y>umxy)umxy=u.y;
      mods.push({ inst, u });
    }
    if(!mods.length) return;
    const GW = (umxx - umnx) * HR + TH, GH = (umxy - umny) * HR + TH;
    const px = 8, py = (G.CANVAS_H - GH - 72) | 0;
    // Maps a unit-pixel coord to the HUD tile centre.
    const cX = ux => px + HR + (ux - umnx) * HR;
    const cY = uy => py + HR + (uy - umny) * HR;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = '#010a14';
    ctx.fillRect(px - 4, py - 4, GW + 8, GH + 8);
    ctx.strokeStyle = '#1a3a5a'; ctx.lineWidth = 1;
    ctx.strokeRect(px - 4, py - 4, GW + 8, GH + 8);
    ctx.globalAlpha = 1;
    // Hull tiles first, then inner modules
    for(const pass of [0, 1]) {
      for(const { inst, u } of mods) {
        const mod = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
        const isHull = mod?.slot === 'hull';
        if((pass === 0) !== isHull) continue;
        const tx = (cX(u.x) - HR) | 0, ty = (cY(u.y) - HR) | 0;
        let tile;
        if(isHull) tile = G.Sprites.getHexTile('hull', inst.color || '#667799', false);
        else {
          const slotCol = G.SLOT_RING[mod?.slot]?.color || '#334455';
          const visual = mod?.visual || (G.WEAPONS[inst.moduleId] ? 'weapon' : 'special');
          tile = G.Sprites.getHexTile(visual, slotCol, inst.broken);
        }
        ctx.drawImage(tile, tx, ty, TH, TH);
      }
    }

    // Crew character sprites on top (positions are unit hex-pixels)
    const _crew = player.crew;
    if(Array.isArray(_crew) && _crew.length) {
      for(const c of _crew) {
        const st = G.CrewAnim._s.get(c.id);
        if(!st) continue;
        const sx = (cX(st.gx) - 4) | 0;
        const sy = (cY(st.gy) - 4) | 0;
        ctx.drawImage(G.Sprites.getCrewSprite(G.crewColor(c), st.walkFrame, c.role === 'pilot'), sx, sy, 8, 8);
      }
    }

    ctx.restore();
  }

  drawPlanet(x, y, r, color, ptype, seed, hasRings) {
    const sprite = G.PlanetSprites.get(ptype || 'rocky', r, seed || 0, !!hasRings);
    this.ctx.drawImage(sprite, ((x - sprite.width  * 0.5) | 0),
                               ((y - sprite.height * 0.5) | 0));
  }

  drawStation(x, y, angle) {
    const ctx = this.ctx;
    ctx.save(); ctx.translate(x|0,y|0); ctx.rotate(angle);
    ctx.strokeStyle='#aaaacc'; ctx.fillStyle='#1a2233'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(0,0,16,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-20,0); ctx.lineTo(20,0);
    ctx.moveTo(0,-20); ctx.lineTo(0,20); ctx.stroke();
    ctx.beginPath(); ctx.arc(0,0,20,0,Math.PI*2); ctx.stroke();
    [[20,0],[-20,0],[0,20],[0,-20]].forEach(([px,py])=>{
      ctx.beginPath(); ctx.arc(px,py,2,0,Math.PI*2);
      ctx.fillStyle='#00ffcc'; ctx.fill();
    });
    ctx.restore();
  }

  drawComet(x, y, r, col, tailLen) {
    const ctx = this.ctx;
    ctx.save();
    // Tail points away from star (star is always at origin)
    const tailAngle = Math.atan2(y, x);
    tailLen = (tailLen || (50 + r * 7)) * 4;
    // Tail gradient
    const tx = x + Math.cos(tailAngle)*tailLen;
    const ty = y + Math.sin(tailAngle)*tailLen;
    const tg = ctx.createLinearGradient(x,y,tx,ty);
    tg.addColorStop(0,'rgba(160,210,255,0.55)');
    tg.addColorStop(1,'rgba(0,80,180,0)');
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(tx,ty);
    ctx.strokeStyle=tg; ctx.lineWidth=r*7.2; ctx.lineCap='round'; ctx.stroke();
    // Coma glow
    const cg = ctx.createRadialGradient(x,y,0,x,y,r*12);
    cg.addColorStop(0,'rgba(200,230,255,0.35)');
    cg.addColorStop(1,'rgba(0,60,160,0)');
    ctx.beginPath(); ctx.arc(x,y,r*12,0,Math.PI*2);
    ctx.fillStyle=cg; ctx.fill();
    // Nucleus
    ctx.beginPath(); ctx.arc(x|0,y|0,r,0,Math.PI*2);
    ctx.fillStyle='#e8f4ff'; ctx.fill();
    ctx.restore();
  }

  drawAsteroid(x, y, r, angle, color, atype) {
    const ctx = this.ctx;
    const shapeKey = 'asteroid_'+(atype||'rocky');
    const shape = G.SHAPES[shapeKey] || G.SHAPES.asteroid_rocky;
    ctx.save(); ctx.translate(x|0,y|0); ctx.rotate(angle); ctx.scale(r/12,r/12);
    ctx.beginPath();
    ctx.moveTo(shape.body[0][0],shape.body[0][1]);
    shape.body.slice(1).forEach(([px,py])=>ctx.lineTo(px,py));
    ctx.closePath();
    ctx.fillStyle = color || '#776655';
    // Type-specific stroke and effects
    if(atype==='metallic') {
      ctx.strokeStyle='#ddccaa'; ctx.lineWidth=1.2*(12/r); ctx.fill(); ctx.stroke();
      // metallic glint streak
      ctx.save(); ctx.clip();
      ctx.fillStyle='rgba(255,240,180,0.22)';
      ctx.fillRect(-3,-14,3,28);
      ctx.restore();
    } else if(atype==='icy') {
      ctx.strokeStyle='#88ccee'; ctx.lineWidth=0.8*(12/r); ctx.fill(); ctx.stroke();
      // icy inner glow
      ctx.save(); ctx.clip();
      const g=ctx.createRadialGradient(0,0,0,0,0,10);
      g.addColorStop(0,'rgba(180,230,255,0.3)');
      g.addColorStop(1,'rgba(100,180,220,0)');
      ctx.fillStyle=g; ctx.fillRect(-12,-14,24,28); ctx.restore();
    } else if(atype==='alien') {
      ctx.strokeStyle='#44ff88'; ctx.lineWidth=1*(12/r); ctx.fill(); ctx.stroke();
      // alien bio-glow
      ctx.save(); ctx.clip();
      const g=ctx.createRadialGradient(0,0,0,0,0,10);
      g.addColorStop(0,'rgba(60,255,120,0.28)');
      g.addColorStop(1,'rgba(0,180,80,0)');
      ctx.fillStyle=g; ctx.fillRect(-14,-14,28,28); ctx.restore();
    } else {
      ctx.strokeStyle='#998877'; ctx.lineWidth=0.8*(12/r); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  drawDerelict(x, y, angle, shapeId) {
    const ctx=this.ctx;
    ctx.save(); ctx.globalAlpha=0.5; ctx.fillStyle='#ff6600';
    ctx.beginPath();
    ctx.arc((x+Math.cos(Date.now()*0.003)*4)|0,(y+Math.sin(Date.now()*0.003)*4)|0,2,0,Math.PI*2);
    ctx.fill(); ctx.restore();
  }

  drawProjectile(p) {
    const ctx=this.ctx;
    ctx.save();
    if(p.type==='laser') {
      const spd=Math.sqrt(p.vx*p.vx+p.vy*p.vy)||1;
      const len=Math.min(spd*0.04,30);
      const nx=p.vx/spd, ny=p.vy/spd;
      const grad=ctx.createLinearGradient(p.x,p.y,p.x-nx*len,p.y-ny*len);
      grad.addColorStop(0,p.color); grad.addColorStop(1,'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.moveTo(p.x|0,p.y|0);
      ctx.lineTo((p.x-nx*len)|0,(p.y-ny*len)|0);
      ctx.strokeStyle=grad; ctx.lineWidth=p.width||2; ctx.stroke();
    } else if(p.type==='emp') {
      ctx.beginPath(); ctx.arc(p.x|0,p.y|0,5,0,Math.PI*2);
      ctx.fillStyle=p.color; ctx.fill();
      ctx.strokeStyle='rgba(180,100,255,0.5)'; ctx.lineWidth=3; ctx.stroke();
    } else if(p.type==='missile') {
      ctx.translate(p.x|0, p.y|0);
      ctx.rotate(Math.atan2(p.vx, -p.vy));
      // Body
      ctx.fillStyle = '#ccccdd';
      ctx.beginPath();
      ctx.moveTo(0, -10); ctx.lineTo(2.5, -3); ctx.lineTo(2.5, 5);
      ctx.lineTo(-2.5, 5); ctx.lineTo(-2.5, -3); ctx.closePath(); ctx.fill();
      // Warhead band
      ctx.fillStyle = p.color || '#ff8800';
      ctx.fillRect(-2.5, -3, 5, 3.5);
      // Fins
      ctx.fillStyle = '#9999bb';
      ctx.beginPath(); ctx.moveTo(2.5, 1); ctx.lineTo(6.5, 7); ctx.lineTo(2.5, 5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-2.5, 1); ctx.lineTo(-6.5, 7); ctx.lineTo(-2.5, 5); ctx.closePath(); ctx.fill();
      // Engine plume (hidden during dormant drift phase)
      if(!p.dormant) {
        const flickLen = 9 + Math.random() * 7;
        const plumeGrad = ctx.createLinearGradient(0, 5, 0, 5 + flickLen);
        plumeGrad.addColorStop(0, 'rgba(160,220,255,1)');
        plumeGrad.addColorStop(0.35, 'rgba(80,140,255,0.7)');
        plumeGrad.addColorStop(1, 'rgba(0,40,200,0)');
        ctx.beginPath();
        ctx.moveTo(-2, 5); ctx.lineTo(2, 5);
        ctx.lineTo(0.5, 5 + flickLen); ctx.lineTo(-0.5, 5 + flickLen);
        ctx.closePath();
        ctx.fillStyle = plumeGrad; ctx.fill();
      }
    } else if(p.type==='mining') {
      // Draw beam from shooter (stored on projectile) to current position
      const ox = p.originX ?? p.x, oy = p.originY ?? p.y;
      const grad = ctx.createLinearGradient(ox, oy, p.x, p.y);
      // Animated rainbow: hue flows along the beam over time
      const t = performance.now() * 0.001;
      const segs = 6;
      for(let i=0;i<=segs;i++){
        const hue = (((i/segs)*360) + t*300) % 360;
        const alpha = i===0 ? 0 : 0.85;
        grad.addColorStop(i/segs, `hsla(${hue|0},100%,60%,${alpha})`);
      }
      ctx.beginPath();
      ctx.moveTo(ox|0, oy|0);
      ctx.lineTo(p.x|0, p.y|0);
      ctx.strokeStyle = grad;
      ctx.lineWidth = p.width || 5;
      ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(p.x|0,p.y|0,p.width||2,0,Math.PI*2);
      ctx.fillStyle=p.color; ctx.fill();
    }
    ctx.restore();
  }

  drawLoot(loot, time) {
    const ctx=this.ctx;
    ctx.save();
    const pulse=0.7+0.3*Math.sin(time*3+loot.x*0.01);
    ctx.globalAlpha=pulse;
    ctx.fillStyle=loot.color||'#ffcc00';
    if(loot.type==='module') {
      // Modules: glowing diamond
      ctx.beginPath(); ctx.moveTo(loot.x|0,(loot.y-7)|0); ctx.lineTo((loot.x+7)|0,loot.y|0);
      ctx.lineTo(loot.x|0,(loot.y+7)|0); ctx.lineTo((loot.x-7)|0,loot.y|0); ctx.closePath();
      ctx.fill(); ctx.strokeStyle='#ffffff'; ctx.lineWidth=1; ctx.stroke();
      ctx.fillStyle='#ffffff'; ctx.font='5px "Press Start 2P",monospace'; ctx.textAlign='center';
      ctx.fillText('MOD', loot.x|0, (loot.y+2)|0); ctx.textAlign='left';
    } else {
      ctx.beginPath(); ctx.arc(loot.x|0,loot.y|0,5,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=0.5; ctx.stroke();
    }
    ctx.restore();
  }

  // Pulsating shield glow — traces the outer edges of the hex assembly.
  drawShieldOutline(x, y, angle, scale, shieldRatio, time, entries, gridCenter=null) {
    if(shieldRatio <= 0 || !entries || entries.length === 0) return;
    const ctx = this.ctx;
    const sc = scale || 1;
    const R = G.HEX_R * sc;
    const pulse = 0.5 + 0.5 * Math.sin(time * 6);
    const alpha = 0.25 + 0.65 * shieldRatio * (0.6 + 0.4 * pulse);
    // Bounding-box centre (must match drawShipTileDisplay)
    let minx=Infinity,maxx=-Infinity,miny=Infinity,maxy=-Infinity;
    for(const e of entries) {
      const p = G.hexToPixel(e.q, e.r, R);
      if(p.x<minx)minx=p.x; if(p.x>maxx)maxx=p.x; if(p.y<miny)miny=p.y; if(p.y>maxy)maxy=p.y;
    }
    const ox=(minx+maxx)/2, oy=(miny+maxy)/2;
    const occ = new Set(entries.map(e => G.hexKey(e.q, e.r)));
    // neighbour dir index → shared edge (vertex pair) for a flat-top hex
    const edgeForDir = [[0,1],[5,0],[4,5],[3,4],[2,3],[1,2]];
    const vx = k => Math.cos(Math.PI/180*60*k), vy = k => Math.sin(Math.PI/180*60*k);
    ctx.save();
    ctx.translate(x|0, y|0);
    ctx.rotate(angle);
    ctx.beginPath();
    for(const e of entries) {
      const p = G.hexToPixel(e.q, e.r, R);
      const cx = p.x - ox, cy = p.y - oy;
      for(let d=0; d<6; d++) {
        const nb = G.HEX_DIRS[d];
        if(occ.has(G.hexKey(e.q+nb[0], e.r+nb[1]))) continue;
        const [a,b] = edgeForDir[d];
        ctx.moveTo(cx + R*vx(a), cy + R*vy(a));
        ctx.lineTo(cx + R*vx(b), cy + R*vy(b));
      }
    }
    ctx.strokeStyle = `rgba(80,160,255,${Math.min(1,alpha)})`;
    ctx.lineWidth = (1.5 + 2 * pulse) * sc;
    ctx.shadowColor = `rgba(80,160,255,${Math.min(1,alpha*0.8)})`;
    ctx.shadowBlur = (6 + 8 * pulse) * sc;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  drawEnemyBars(enemy) {
    const ctx=this.ctx;
    const bw=40, bh=4, bx=enemy.x-bw/2, by=enemy.y-(enemy.size||1)*24;
    const hpFrac = Math.max(0, (enemy.hp||0) / (enemy.maxHp||1));
    ctx.fillStyle='#1a2233'; ctx.fillRect(bx|0,by|0,bw,bh);
    ctx.fillStyle = enemy.disabled ? '#667788' : '#44ff44';
    ctx.fillRect(bx|0,by|0,(bw*hpFrac)|0,bh);
    if(enemy.maxShields>0) {
      ctx.fillStyle='#111a2a'; ctx.fillRect(bx|0,(by+bh+1)|0,bw,bh);
      ctx.fillStyle='#4488ff'; ctx.fillRect(bx|0,(by+bh+1)|0,(bw*(enemy.shields/Math.max(enemy.maxShields,1)))|0,bh);
    }
    if(enemy.disabled) {
      ctx.fillStyle='rgba(180,180,200,0.85)'; ctx.font='6px "Press Start 2P",monospace';
      ctx.fillText('DISABLED',(enemy.x-22)|0,(by-4)|0);
    }
  }

  drawMinimap(canvas, player, space, game) {
    const ctx=canvas.getContext('2d');
    const w=canvas.width, h=canvas.height;
    ctx.fillStyle='rgba(0,8,20,0.9)'; ctx.fillRect(0,0,w,h);
    const RANGE=8000;
    const cx=w/2, cy=h/2, scale=w/(RANGE*2);
    const tx=obj=>cx+(obj.x-player.x)*scale;
    const ty=obj=>cy+(obj.y-player.y)*scale;
    const inBounds=(x,y)=>x>=0&&x<=w&&y>=0&&y<=h;

    // Mission objective systems in current system
    const missionDestIds=new Set((game.activeMissions||[])
      .filter(m=>!m.completed&&!m.failed)
      .map(m=>m.params?.dest||m.params?.target||m.params?.via)
      .filter(Boolean));
    const isMissionSystem=missionDestIds.has(game.currentSysId);
    const blink=Math.sin(Date.now()*0.007)>0;

    // Combat missions (bounty/faction) whose target system is the current one
    const combatMissionHere=(game.activeMissions||[]).some(m=>
      !m.completed&&!m.failed&&
      (m.type==='bounty'||m.type==='faction_earth'||m.type==='faction_rebellion'||m.type==='faction_pirate')&&
      (m.params?.target===game.currentSysId||m.params?.dest===game.currentSysId)
    );

    // Bodies
    for(const b of space.bodies) {
      const bx=tx(b)|0, by=ty(b)|0;
      if(b.type==='star'){
        ctx.fillStyle=b.color||'#ffff88';
        ctx.beginPath();ctx.arc(bx,by,4,0,Math.PI*2);ctx.fill();
      } else if(b.type==='planet'){
        // Blink yellow if this planet has a spaceport and it's a mission destination
        const isMissPlanet=isMissionSystem&&b.hasSpaceport;
        const pCol=isMissPlanet&&blink?'#ffcc00':(b.hasSpaceport?'#4488ff':'#667788');
        ctx.fillStyle=pCol;
        ctx.beginPath();ctx.arc(bx,by,2,0,Math.PI*2);ctx.fill();
        if(isMissPlanet&&blink){
          ctx.strokeStyle='#ffcc00'; ctx.lineWidth=1;
          ctx.beginPath();ctx.arc(bx,by,5,0,Math.PI*2);ctx.stroke();
        }
      } else if(b.type==='station'){
        const isMissStation=isMissionSystem&&b.hasSpaceport;
        ctx.fillStyle=isMissStation&&blink?'#ffcc00':'#aaaacc';
        ctx.fillRect(bx-2,by-2,4,4);
        if(isMissStation&&blink){
          ctx.strokeStyle='#ffcc00';ctx.lineWidth=1;
          ctx.strokeRect(bx-4,by-4,8,8);
        }
      }
    }

    // Asteroids (faint)
    ctx.fillStyle='#443322';
    for(const a of space.asteroids){
      const ax=tx(a)|0,ay=ty(a)|0;
      if(inBounds(ax,ay)) ctx.fillRect(ax,ay,1,1);
    }

    // helper: draw an oriented triangle on the minimap
    const drawShipTriangle=(x,y,angle,col,sz=4)=>{
      ctx.save(); ctx.translate(x,y); ctx.rotate(angle);
      ctx.fillStyle=col;
      ctx.beginPath(); ctx.moveTo(0,-sz); ctx.lineTo(sz*0.8,sz); ctx.lineTo(-sz*0.8,sz); ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    // NPC ships — colored by faction relation, drawn as triangles
    for(const n of space.npcs){
      if(n.dead||n.boarded) continue;
      const nx=tx(n)|0,ny=ty(n)|0;
      if(!inBounds(nx,ny)) continue;
      if(n.jumpingOut) {
        if(Math.sin(Date.now()*0.04)>0) {
          ctx.fillStyle='#ffffff';
          ctx.beginPath(); ctx.arc(nx,ny,3,0,Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(nx,ny,6,0,Math.PI*2);
          ctx.strokeStyle='rgba(200,220,255,0.5)'; ctx.lineWidth=1; ctx.stroke();
        }
        continue;
      }
      if(n.arriving && n.arriving > 0) {
        const pulse = Math.sin(Date.now()*0.008)*0.5+0.5;
        ctx.fillStyle=`rgba(100,200,255,${pulse*0.8})`;
        ctx.beginPath(); ctx.arc(nx,ny,4,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='rgba(100,200,255,0.6)'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.arc(nx,ny,7,0,Math.PI*2); ctx.stroke();
      }
      const nRel=game.getRel(n.faction);
      const nFacCol = G.FACTIONS[n.faction]?.color;
      // Hostile factions (pirates, aliens etc.) always show their faction color; others use relation gradient
      const nHostileFaction = nRel < -30;
      const nCol = n.hostile ? (nFacCol||'#ff3333') : nRel>=50 ? '#00ee66' : nRel>=-20 ? '#88aacc' : nHostileFaction ? (nFacCol||'#ff8800') : '#ffcc00';
      drawShipTriangle(nx,ny,n.angle,nCol);
      // Hostile NPC: blinking red outline ring
      if(n.hostile && blink) {
        ctx.beginPath(); ctx.arc(nx,ny,6,0,Math.PI*2);
        ctx.strokeStyle='#ff2222'; ctx.lineWidth=1.5; ctx.stroke();
      }
    }

    // Enemy ships — triangles, hostile or negative faction → red/yellow
    for(const e of space.enemies){
      if(e._deathDone||e.boarded) continue;
      const ex=tx(e)|0,ey=ty(e)|0;
      if(!inBounds(ex,ey)) continue;
      if(e.arriving && e.arriving > 0) {
        const pulse = Math.sin(Date.now()*0.008)*0.5+0.5;
        ctx.fillStyle=`rgba(255,100,100,${pulse*0.8})`;
        ctx.beginPath(); ctx.arc(ex,ey,4,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='rgba(255,100,100,0.6)'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.arc(ex,ey,7,0,Math.PI*2); ctx.stroke();
      }
      const rel=game.getRel(e.faction)||0;
      const isHostile=rel<-20||e.aiState==='engage';
      const eFacCol = G.FACTIONS[e.faction]?.color;
      drawShipTriangle(ex,ey,e.angle,eFacCol||(rel<-50?'#ff3333':'#ff8800'));
      // Hostile enemy: blinking red outline ring (brighter for very hostile)
      if(isHostile && blink) {
        ctx.beginPath(); ctx.arc(ex,ey,6,0,Math.PI*2);
        ctx.strokeStyle=rel<-50?'#ff0000':'#ff4422'; ctx.lineWidth=1.5; ctx.stroke();
      }
      // Mission target: blinking yellow box on top
      if(combatMissionHere&&blink) {
        ctx.strokeStyle='#ffcc00'; ctx.lineWidth=1.5;
        ctx.strokeRect(ex-6,ey-6,12,12);
        ctx.lineWidth=0.5;
      }
    }

    // Derelicts — gray wrecks on minimap
    for(const d of space.derelicts) {
      if(d.looted) continue;
      const dx=tx(d)|0,dy=ty(d)|0;
      if(!inBounds(dx,dy)) continue;
      drawShipTriangle(dx,dy,d.angle||0,'#888888',3);
    }

    // Turrets — red squares when hostile, dim yellow when neutral
    for(const t of space.turrets||[]) {
      if(t._dead) continue;
      const ttx=tx(t)|0, tty=ty(t)|0;
      if(!inBounds(ttx,tty)) continue;
      ctx.fillStyle = t.hostile ? '#ff2222' : '#443322';
      ctx.fillRect(ttx-2,tty-2,4,4);
      if(t.hostile && blink) {
        ctx.beginPath(); ctx.arc(ttx,tty,6,0,Math.PI*2);
        ctx.strokeStyle='#ff0000'; ctx.lineWidth=1.5; ctx.stroke();
      }
    }

    // Fleet ships — green friendly triangles
    for(const fs of space.fleetShips||[]) {
      if(fs.dead||fs._deathDone) continue;
      const fx=tx(fs)|0, fy=ty(fs)|0;
      if(!inBounds(fx,fy)) continue;
      drawShipTriangle(fx,fy,fs.angle,'#00ff88',4);
    }

    // Radar-revealed contacts — pulsing cyan rings on minimap
    const _radarPulse = Math.sin(Date.now() * 0.008) * 0.5 + 0.5;
    for(const _rr of [...space.enemies, ...space.npcs, ...(space.fleetShips||[])]) {
      if(!(_rr._radarRevealedTimer > 0) || _rr.dead || _rr._deathDone) continue;
      const rrx = tx(_rr)|0, rry = ty(_rr)|0;
      if(!inBounds(rrx, rry)) continue;
      ctx.beginPath(); ctx.arc(rrx, rry, 5 + _radarPulse * 3, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(51,170,255,${0.4 + _radarPulse * 0.5})`; ctx.lineWidth = 1.2; ctx.stroke();
    }

    // Missiles — small diamonds, orange for enemy, cyan for player
    for(const proj of space.projectiles) {
      if(proj.type !== 'missile' || proj.dormant) continue;
      const mx = tx(proj)|0, my = ty(proj)|0;
      if(!inBounds(mx, my)) continue;
      const isEnemy = proj.sourceId !== 'player';
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(proj.angle || Math.atan2(proj.vx || 0, -(proj.vy || 0)));
      ctx.fillStyle = isEnemy ? '#ff4400' : '#44ffff';
      ctx.beginPath(); ctx.moveTo(0,-3); ctx.lineTo(2,0); ctx.lineTo(0,3); ctx.lineTo(-2,0); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // Repair drones — purple diamonds
    for(const _rd of space.repairDrones||[]) {
      const rdx = tx(_rd)|0, rdy = ty(_rd)|0;
      if(!inBounds(rdx, rdy)) continue;
      const _rdPulse = Math.sin(Date.now()*0.01)*0.5+0.5;
      ctx.save(); ctx.translate(rdx, rdy); ctx.rotate(Date.now()*0.003);
      ctx.fillStyle = `rgba(187,136,255,${0.6+_rdPulse*0.4})`;
      ctx.beginPath(); ctx.moveTo(0,-4); ctx.lineTo(3,0); ctx.lineTo(0,4); ctx.lineTo(-3,0); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // Marked targets — blinking orange downward triangles
    for(const _mk of [...space.enemies, ...space.npcs]) {
      if(!_mk._marked || !(_mk._markedTimer > 0) || _mk.dead || _mk._deathDone) continue;
      const mmx = tx(_mk)|0, mmy = ty(_mk)|0;
      if(!inBounds(mmx, mmy)) continue;
      if(blink) {
        ctx.save(); ctx.translate(mmx, mmy+6);
        ctx.fillStyle='#ff8844'; ctx.strokeStyle='#ffffff'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(0,4); ctx.lineTo(4,-3); ctx.lineTo(-4,-3); ctx.closePath();
        ctx.fill(); ctx.stroke(); ctx.restore();
      }
    }

    // Player — slightly larger triangle
    drawShipTriangle(cx,cy,player.angle,'#00ffee',5);

    // Target: ring when in range, arrow when out of range
    const tgt=game.target;
    if(tgt&&!tgt.dead){
      const tdx=tgt.x-player.x, tdy=tgt.y-player.y;
      if(Math.hypot(tdx,tdy)>RANGE*0.85){
        const ang=Math.atan2(tdx,-tdy);
        const arrowR=Math.min(w,h)*0.43;
        const ax=cx+Math.sin(ang)*arrowR, ay=cy-Math.cos(ang)*arrowR;
        ctx.save();ctx.translate(ax|0,ay|0);ctx.rotate(ang);
        ctx.strokeStyle='#ff3333';ctx.fillStyle='rgba(255,60,60,0.75)';ctx.lineWidth=1.5;
        ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(4,2);ctx.lineTo(0,0);ctx.lineTo(-4,2);ctx.closePath();
        ctx.fill();ctx.stroke();
        ctx.restore();
      } else {
        const tmx=tx(tgt)|0, tmy=ty(tgt)|0;
        if(inBounds(tmx,tmy)){
          ctx.beginPath(); ctx.arc(tmx,tmy,7,0,Math.PI*2);
          ctx.strokeStyle='#ffffff'; ctx.lineWidth=1.5; ctx.stroke(); ctx.lineWidth=0.5;
        }
      }
    }
  }

  // ── Deep background sprite builder ───────────────────────
  _makeDeepSprite(type, sz) {
    const S = ((sz * 2 + 4) | 0);
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');
    const cx = S / 2, cy = S / 2;

    if (type === 'galaxy') {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, 0.52);
      // Core glow
      const core = ctx.createRadialGradient(0, 0, 0, 0, 0, sz * 0.28);
      core.addColorStop(0,   'rgba(255,248,215,1)');
      core.addColorStop(0.12,'rgba(255,220,160,0.72)');
      core.addColorStop(0.4, 'rgba(180,160,255,0.22)');
      core.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = core;
      ctx.beginPath(); ctx.arc(0, 0, sz * 0.65, 0, Math.PI * 2); ctx.fill();
      // Two spiral arms
      for (let arm = 0; arm < 2; arm++) {
        const base = arm * Math.PI;
        for (let i = 0; i < 70; i++) {
          const t = i / 70;
          const a = base + t * Math.PI * 3.2;
          const r = (0.04 + t * 0.88) * sz;
          const sp = r * 0.22;
          const dx = Math.cos(a) * r + (Math.random() - 0.5) * sp;
          const dy = Math.sin(a) * r + (Math.random() - 0.5) * sp;
          const al = (1 - t) * (0.45 + Math.random() * 0.5);
          const bv = Math.floor(200 + t * 55);
          const ds = Math.random() < 0.09 ? 2 : 1;
          ctx.fillStyle = `rgba(${bv},${bv - 28},255,${al.toFixed(2)})`;
          ctx.fillRect(dx | 0, dy | 0, ds, ds);
        }
      }
      // Halo star dust
      for (let i = 0; i < 45; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * sz * 0.82;
        const al = (0.12 + Math.random() * 0.4) * (1 - r / sz);
        ctx.fillStyle = `rgba(255,255,255,${al.toFixed(2)})`;
        ctx.fillRect((Math.cos(a) * r) | 0, (Math.sin(a) * r) | 0, 1, 1);
      }
      ctx.restore();

    } else if (type.startsWith('nebula')) {
      const pals = {
        nebula_blue:   [[30,80,255],[0,130,255],[80,160,255]],
        nebula_purple: [[140,40,255],[190,90,255],[90,30,180]],
        nebula_red:    [[255,70,30],[255,130,50],[190,30,10]],
        nebula_teal:   [[0,190,170],[40,240,190],[0,130,110]],
      };
      const pal = pals[type] || pals.nebula_blue;
      const n = 3 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.9;
        const dist = sz * (0.08 + Math.random() * 0.24);
        const lx = cx + Math.cos(a) * dist;
        const ly = cy + Math.sin(a) * dist;
        const lr = sz * (0.28 + Math.random() * 0.34);
        const col = pal[i % pal.length];
        const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
        g.addColorStop(0,   `rgba(${col[0]},${col[1]},${col[2]},0.48)`);
        g.addColorStop(0.4, `rgba(${col[0]},${col[1]},${col[2]},0.16)`);
        g.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI * 2); ctx.fill();
      }
      // Embedded star pixels
      for (let i = 0; i < 35; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * sz * 0.52;
        const al = 0.28 + Math.random() * 0.6;
        ctx.fillStyle = `rgba(255,255,255,${al.toFixed(2)})`;
        ctx.fillRect((cx + Math.cos(a) * r) | 0, (cy + Math.sin(a) * r) | 0, 1, 1);
      }

    } else { // dust cloud
      const cols = [[160,140,100],[130,115,85],[170,150,105]];
      for (let i = 0; i < 5; i++) {
        const dx = (Math.random() - 0.5) * sz * 0.7;
        const dy = (Math.random() - 0.5) * sz * 0.55;
        const lr = sz * (0.2 + Math.random() * 0.26);
        const col = cols[i % cols.length];
        const g = ctx.createRadialGradient(cx+dx, cy+dy, 0, cx+dx, cy+dy, lr);
        g.addColorStop(0,    `rgba(${col[0]},${col[1]},${col[2]},0.18)`);
        g.addColorStop(0.55, `rgba(${col[0]},${col[1]},${col[2]},0.06)`);
        g.addColorStop(1,    'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx+dx, cy+dy, lr, 0, Math.PI * 2); ctx.fill();
      }
    }
    return c;
  }

  drawDeepBg(deepObjects, camX, camY, zoom=1) {
    if (!deepObjects || !deepObjects.length) return;
    const ctx = this.ctx;
    const tileW = G.CANVAS_W * 2;
    const tileH = G.CANVAS_H * 2;
    ctx.save();
    ctx.translate(G.CANVAS_W/2, G.CANVAS_H/2);
    ctx.scale(zoom, zoom);
    ctx.translate(-G.CANVAS_W/2, -G.CANVAS_H/2);
    for (const obj of deepObjects) {
      const key = obj.type + '_' + (obj.size | 0) + '_' + obj.idx;
      if (!this._deepBgCache.has(key)) {
        this._deepBgCache.set(key, this._makeDeepSprite(obj.type, obj.size));
      }
      const sprite = this._deepBgCache.get(key);
      const px = obj.parallax;
      const sx = ((obj.x - camX * px) % tileW + tileW * 1.5) % tileW;
      const sy = ((obj.y - camY * px) % tileH + tileH * 1.5) % tileH;
      ctx.save();
      ctx.globalAlpha = obj.alpha;
      ctx.translate(sx | 0, sy | 0);
      ctx.rotate(obj.rotation);
      ctx.drawImage(sprite, -(obj.size) | 0, -(obj.size) | 0);
      ctx.restore();
    }
    ctx.restore();
  }

  // ── Hyperspace animation render ──────────────────────────
  renderHyperspace(game) {
    const ctx = this.ctx;
    const t   = game.hyperspaceT; // 0→1 accel, 1→2 decel
    const phase = t < 1 ? 'accel' : 'decel';
    const localT = phase==='accel' ? t : (2-t); // 0→1 both phases

    // Speed multiplier: ramps up in accel, down in decel
    const speedMult = phase==='accel'
      ? 1 + localT * 30
      : 1 + localT * 30;

    const stretchMult = phase==='accel' ? localT : localT;

    ctx.fillStyle = '#000010';
    ctx.fillRect(0,0,G.CANVAS_W,G.CANVAS_H);

    this.drawBg(game.space.bgStars, game.camX, game.camY, 1, speedMult, stretchMult);

    // Blue flash at peak (t near 1)
    const flashT = 1 - Math.abs(t - 1);
    if(flashT > 0) {
      ctx.save();
      ctx.globalAlpha = flashT * 0.85;
      const grad = ctx.createRadialGradient(G.CANVAS_W/2,G.CANVAS_H/2,0,G.CANVAS_W/2,G.CANVAS_H/2,G.CANVAS_W*0.7);
      grad.addColorStop(0,'rgba(200,220,255,1)');
      grad.addColorStop(0.4,'rgba(50,100,255,0.6)');
      grad.addColorStop(1,'rgba(0,0,30,0)');
      ctx.fillStyle=grad;
      ctx.fillRect(0,0,G.CANVAS_W,G.CANVAS_H);
      ctx.restore();
    }

    // Charging bar (before jump) or progress text
    if(phase==='accel') {
      const msg = t < 0.2 ? 'JUMP DRIVE CHARGING...' : 'ENTERING HYPERSPACE';
      ctx.save();
      ctx.globalAlpha = 1 - flashT;
      ctx.font='12px "Press Start 2P",monospace';
      ctx.fillStyle='#00ffee';
      ctx.textAlign='center';
      ctx.fillText(msg, G.CANVAS_W/2, G.CANVAS_H*0.8);
      ctx.restore();
    }

    // Arrival text
    if(phase==='decel' && localT > 0.4) {
      const sys = G.SYSTEMS.find(s=>s.id===game.hyperspaceTarget);
      ctx.save();
      ctx.globalAlpha = (localT-0.4)/0.6;
      ctx.font='12px "Press Start 2P",monospace';
      ctx.fillStyle='#00ffee'; ctx.textAlign='center';
      ctx.fillText('ARRIVING: '+(sys?.name||'UNKNOWN'), G.CANVAS_W/2, G.CANVAS_H*0.8);
      ctx.restore();
    }
  }

  _drawNebulaFog(nebula) {
    const ctx = this.ctx;
    const cx  = G.CANVAS_W / 2, cy = G.CANVAS_H / 2;
    ctx.save();

    // Fullscreen color tint
    ctx.globalAlpha = nebula.intensity * 0.16;
    ctx.fillStyle   = nebula.fog;
    ctx.fillRect(0, 0, G.CANVAS_W, G.CANVAS_H);

    // A few large radial gradient blobs for cloud-like depth
    const blobSeeds = [0.13, 0.47, 0.72, 0.31];
    for(let i = 0; i < 4; i++) {
      const bx = cx + (blobSeeds[i] - 0.5) * G.CANVAS_W * 1.6;
      const by = cy + (blobSeeds[(i+2)%4] - 0.5) * G.CANVAS_H * 1.4;
      const br = 180 + blobSeeds[(i+1)%4] * 260;
      const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      grad.addColorStop(0, nebula.fog + Math.round(nebula.intensity * 0.45 * 255).toString(16).padStart(2,'0'));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = nebula.intensity * 0.22;
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, G.CANVAS_W, G.CANVAS_H);
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  renderSpace(game) {
    const { player, space, particles, camX, camY } = game;
    if(!player || !space) { this.clear(); return; }
    const ctx = this.ctx;

    const _zoom = game.camZoom || 1;
    this.clear();
    if(game._bgEnabled) {
      if(space.nebula) this._drawNebulaFog(space.nebula);
      this.drawDeepBg(space.bgDeepObjects, camX, camY, _zoom);
    }
    this.drawBg(space.bgStars, camX, camY, _zoom, 1, 0);

    ctx.save();
    ctx.translate(G.CANVAS_W/2, G.CANVAS_H/2);
    ctx.scale(_zoom, _zoom);
    ctx.translate(-(camX + G.CANVAS_W/2), -(camY + G.CANVAS_H/2));

    // Landing radius hints
    for(const b of space.bodies) {
      if(b.hasSpaceport) {
        ctx.beginPath(); ctx.arc(b.x,b.y,b.r+80,0,Math.PI*2);
        ctx.strokeStyle='rgba(0,200,150,0.12)'; ctx.lineWidth=1; ctx.stroke();
      }
    }

    for(const b of space.bodies) {
      if(b.type==='star') {
        const col = b.color||'#ffff88';
        const r   = parseInt(col.slice(1,3),16), g2=parseInt(col.slice(3,5),16);
        const grad=ctx.createRadialGradient(b.x,b.y,b.r*0.5,b.x,b.y,b.r*3);
        grad.addColorStop(0,col); grad.addColorStop(0.3,`rgba(${r},${g2},50,0.15)`); grad.addColorStop(1,'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.arc(b.x,b.y,b.r*3,0,Math.PI*2); ctx.fillStyle=grad; ctx.fill();
        ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fillStyle=col; ctx.fill();
      } else if(b.type==='planet') {
        this.drawPlanet(b.x,b.y,b.r,b.color,b.ptype,b.seed,b.hasRings);
        ctx.fillStyle='rgba(200,200,200,0.75)'; ctx.font=(7/_zoom)+'px "Press Start 2P",monospace';
        ctx.fillText(b.name,(b.x+b.r+4)|0,(b.y+3)|0);
      } else if(b.type==='station') {
        this.drawStation(b.x,b.y,space.time*0.2);
        ctx.fillStyle='rgba(200,200,220,0.8)'; ctx.font=(7/_zoom)+'px "Press Start 2P",monospace';
        ctx.fillText(b.name,(b.x+24)|0,(b.y+3)|0);
      }
    }

    // Turrets
    if(space.turrets) {
      for(const t of space.turrets) {
        if(t._dead) continue;
        ctx.save(); ctx.translate(t.x|0, t.y|0);
        const rel = G.game?.getRel(t.faction)||0;
        const col = t.hostile ? '#ff4444' : rel < -20 ? '#ff8800' : '#aaaaaa';
        ctx.strokeStyle=col; ctx.fillStyle='rgba(10,15,25,0.9)'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.moveTo(0,-9); ctx.lineTo(9,0); ctx.lineTo(0,9); ctx.lineTo(-9,0); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle=col; ctx.beginPath(); ctx.arc(0,0,2.5,0,Math.PI*2); ctx.fill();
        if(t.hp < t.maxHp) {
          const bw=18;
          ctx.fillStyle='#222'; ctx.fillRect(-bw/2,-14,bw,3);
          ctx.fillStyle='#ff4444'; ctx.fillRect(-bw/2,-14,bw*(t.hp/t.maxHp),3);
        }
        ctx.restore();
      }
    }

    for(const a of space.asteroids) {
      this.drawAsteroid(a.x,a.y,a.r,a.angle,a.color,a.atype);
      if(a.hp<a.maxHp) {
        const bw=a.r*1.5, by=a.y-a.r-6;
        ctx.fillStyle='#1a1a1a'; ctx.fillRect((a.x-bw/2)|0,by|0,bw|0,3);
        ctx.fillStyle='#ff8844'; ctx.fillRect((a.x-bw/2)|0,by|0,(bw*(a.hp/a.maxHp))|0,3);
      }
    }

    for(const d of space.derelicts) {
      if(!d.looted) {
        this.drawDerelict(d.x,d.y,d.angle||0,G.SHIPS[d.shipId]?.shape||'shuttle');
        ctx.fillStyle='rgba(200,150,50,0.8)'; ctx.font=(7/_zoom)+'px "Press Start 2P",monospace';
        ctx.fillText('DERELICT',(d.x+20)|0,(d.y-22)|0);
      }
    }

    for(const l of space.floatingLoot) this.drawLoot(l,space.time);

    // Escape pod entities
    if(space.escapePodEntities?.length) {
      ctx.save();
      for(const _ep of space.escapePodEntities) {
        ctx.save();
        ctx.translate(_ep.x|0,_ep.y|0);
        ctx.rotate(_ep.angle);
        const _fade=Math.min(1,_ep.timer/3);
        ctx.globalAlpha=_fade;
        // Pod body
        ctx.fillStyle='#ccddee';
        ctx.fillRect(-6,-3,12,6);
        // Viewport window
        ctx.fillStyle='#88ccff';
        ctx.fillRect(-2,-2,4,4);
        // Engine thruster glow
        ctx.fillStyle='#ff8844';
        ctx.fillRect(5,-2,4,4);
        ctx.restore();
      }
      ctx.restore();
    }

    for(const e of space.enemies) {
      if(e._deathDone||e.boarded||e._inDust) continue;
      const eHullCol = G.FACTIONS[e.faction]?.color || e.color || '#667799';
      const eEntries = this._npcTileEntries(e, eHullCol);
      this.drawShipTileDisplay(e.x, e.y, e.size||1, eEntries, e.angle);
      if((e._frozenTimer||0) > 0) {
        ctx.save(); ctx.globalAlpha=0.45;
        ctx.beginPath(); ctx.arc(e.x,e.y,(e.size||1)*18,0,Math.PI*2);
        ctx.fillStyle='#88ddff'; ctx.fill(); ctx.restore();
      }
      if(e.isFleetFlagship && !e.disabled) {
        ctx.save();
        ctx.beginPath(); ctx.arc(e.x,e.y,(e.size||1)*22,0,Math.PI*2);
        ctx.strokeStyle='rgba(255,180,0,0.45)'; ctx.lineWidth=1.5; ctx.setLineDash([5,3]); ctx.stroke(); ctx.setLineDash([]);
        ctx.font=(5/_zoom)+'px "Press Start 2P",monospace'; ctx.fillStyle='rgba(255,180,50,0.85)'; ctx.textAlign='center';
        ctx.fillText('FLAGSHIP',e.x|0,(e.y-(e.size||1)*28)|0); ctx.textAlign='left';
        ctx.restore();
      }
      if(e.shields > 0) {
        this.drawShieldOutline(e.x, e.y, e.angle, e.size||1,
          e.shields/Math.max(e.maxShields,1), space.time, eEntries);
      }
      this.drawEnemyBars(e);
      if(e._marked && e._markedTimer > 0 && Math.sin(Date.now() * 0.012) > 0) {
        ctx.save(); ctx.translate(e.x|0, (e.y - (e.size||1)*30)|0);
        ctx.fillStyle='#ff8844'; ctx.strokeStyle='#ffffff'; ctx.lineWidth=1/_zoom;
        ctx.beginPath(); ctx.moveTo(0,10); ctx.lineTo(7,-4); ctx.lineTo(-7,-4); ctx.closePath();
        ctx.fill(); ctx.stroke(); ctx.restore();
      }
    }

    // NPC ships
    for(const n of space.npcs) {
      if(n._deathDone||n.boarded||n._inDust) continue;
      const moving = n.aiState!=='docked';
      const nHullCol = G.FACTIONS[n.faction]?.color || n.color || '#667799';
      const nEntries = this._npcTileEntries(n, nHullCol);
      if(n.jumpingOut) {
        const t = Math.max(0, n.jumpOutTimer / 0.45);
        ctx.save(); ctx.globalAlpha = t;
        this.drawShipTileDisplay(n.x, n.y, n.size||1, nEntries, n.angle);
        ctx.restore();
      } else if(n.jumpingIn) {
        const t = Math.max(0, n.jumpInTimer / 0.5);
        ctx.save(); ctx.globalAlpha = 1 - t * 0.8;
        this.drawShipTileDisplay(n.x, n.y, n.size||1, nEntries, n.angle);
        ctx.restore();
      } else {
        const nScale = n.size||1;
        this.drawShipTileDisplay(n.x, n.y, nScale, nEntries, n.angle);
        if((n._frozenTimer||0) > 0) {
          ctx.save(); ctx.globalAlpha=0.45;
          ctx.beginPath(); ctx.arc(n.x,n.y,nScale*18,0,Math.PI*2);
          ctx.fillStyle='#88ddff'; ctx.fill(); ctx.restore();
        }
        if(n.shields > 0) {
          this.drawShieldOutline(n.x, n.y, n.angle, nScale,
            n.shields/Math.max(n.maxShields,1), space.time, nEntries);
        }
        if(n.hostile) this.drawEnemyBars(n);
        if(game.target===n) {
          ctx.save(); ctx.font=(6/_zoom)+'px "Press Start 2P",monospace';
          ctx.fillStyle=n.color; ctx.textAlign='center';
          ctx.fillText(n.name, n.x, n.y-nScale*24-8);
          ctx.textAlign='left'; ctx.restore();
        }
        if(n._marked && n._markedTimer > 0 && Math.sin(Date.now() * 0.012) > 0) {
          ctx.save(); ctx.translate(n.x|0, (n.y - nScale*30)|0);
          ctx.fillStyle='#ff8844'; ctx.strokeStyle='#ffffff'; ctx.lineWidth=1/_zoom;
          ctx.beginPath(); ctx.moveTo(0,10); ctx.lineTo(7,-4); ctx.lineTo(-7,-4); ctx.closePath();
          ctx.fill(); ctx.stroke(); ctx.restore();
        }
      }
    }

    // Fleet ships (friendly escorts)
    for(const fs of space.fleetShips||[]) {
      if(fs._deathDone||fs._inDust) continue;
      const fsHullCol = G.FACTIONS[fs.faction]?.color || fs.color || '#8899bb';
      const fsEntries = this._npcTileEntries(fs, fsHullCol);
      this.drawShipTileDisplay(fs.x, fs.y, fs.size||1, fsEntries, fs.angle);
      if(fs.shields>0)
        this.drawShieldOutline(fs.x,fs.y,fs.angle,fs.size||1,fs.shields/Math.max(fs.maxShields,1),space.time, fsEntries);
      // Health bar
      const bw=36, bh=3, bx=fs.x-18, by=fs.y-(fs.size||1)*24-12;
      ctx.fillStyle='#0a1a0a'; ctx.fillRect(bx|0,by|0,bw,bh);
      const hpF=Math.max(0,fs.hull/fs.maxHull);
      ctx.fillStyle=hpF>0.5?'#44ff88':hpF>0.25?'#ffcc44':'#ff4444';
      ctx.fillRect(bx|0,by|0,(bw*hpF)|0,bh);
      // Name + ring
      ctx.save();
      ctx.font=(5/_zoom)+'px "Press Start 2P",monospace';
      ctx.fillStyle='rgba(0,255,100,0.8)'; ctx.textAlign='center';
      ctx.fillText(fs.name||'ESCORT',(fs.x)|0,(fs.y-(fs.size||1)*28-16)|0);
      ctx.textAlign='left';
      ctx.beginPath(); ctx.arc(fs.x,fs.y,(fs.size||1)*20,0,Math.PI*2);
      ctx.strokeStyle='rgba(0,255,100,0.22)'; ctx.lineWidth=1; ctx.setLineDash([3,4]); ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
    }

    for(const p of space.projectiles) this.drawProjectile(p);

    // Chaff balls — glowing yellow orbs that burst after 1s
    if(space.chaffBalls?.length) {
      for(const ball of space.chaffBalls) {
        const pulse = 0.6 + 0.4 * Math.sin(ball.timer * 20);
        ctx.save();
        ctx.globalAlpha = pulse;
        const g = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, 7);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.3, '#ffee44');
        g.addColorStop(1, 'rgba(255,180,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(ball.x, ball.y, 7, 0, Math.PI*2); ctx.fill();
        ctx.restore();
      }
    }

    // Repair drones — spinning hexagons with purple glow
    if(space.repairDrones?.length) {
      for(const _rd of space.repairDrones) {
        ctx.save();
        ctx.translate(_rd.x, _rd.y);
        ctx.rotate(_rd.spinAngle);
        const _rdAlpha = 0.6 + 0.4 * Math.sin(_rd.spinAngle * 2);
        ctx.globalAlpha = _rdAlpha;
        const _rdGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 12);
        _rdGrad.addColorStop(0, '#ffffff');
        _rdGrad.addColorStop(0.3, '#cc99ff');
        _rdGrad.addColorStop(1, 'rgba(180,100,255,0)');
        ctx.fillStyle = _rdGrad;
        ctx.beginPath();
        for(let _hi = 0; _hi < 6; _hi++) {
          const _ha = (_hi / 6) * Math.PI * 2;
          _hi === 0 ? ctx.moveTo(Math.cos(_ha)*8, Math.sin(_ha)*8) : ctx.lineTo(Math.cos(_ha)*8, Math.sin(_ha)*8);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#bb88ff';
        ctx.lineWidth = 1 / _zoom;
        ctx.globalAlpha = _rdAlpha * 0.9;
        ctx.stroke();
        // Pulse ring showing heal range
        ctx.globalAlpha = 0.12;
        ctx.beginPath(); ctx.arc(0, 0, _rd.range, 0, Math.PI * 2);
        ctx.strokeStyle = '#bb88ff'; ctx.lineWidth = 1 / _zoom;
        ctx.stroke();
        ctx.restore();
      }
    }

    // Particles stored in world-space; ctx is already translated so offset = 0
    particles.draw(ctx, 0, 0);

    const superBoost = (player._superboostTimer || 0) > 0;
    const thrusting = !player.disabled && game.input.thrust;
    const boosting  = !player.disabled && game.input.boost && (superBoost || (player.energy > 5 && player.boostCharge > 0));
    const strafeDir = player.disabled ? 0 : game.input.strafeR ? 1 : game.input.strafeL ? -1 : 0;
    const turnDir = player.disabled ? 0 : game.input.turnR ? 1 : game.input.turnL ? -1 : 0;
    const shipColor = G.SHIPS[player.templateId]?.color || '#8899bb';
    const shapeId   = G.SHIPS[player.templateId]?.shape || 'shuttle';
    this.drawShipTileDisplay(player.x, player.y, 1, this._playerTileEntries(player), player.angle, null, null, turnDir);
    const playerTurretSlots = player.weaponSlots.filter(s => s.turret);
    if(playerTurretSlots.length) this.drawTurretOverlay(player, 1, playerTurretSlots);
    if((player._frozenTimer||0) > 0) {
      ctx.save(); ctx.globalAlpha=0.45;
      ctx.beginPath(); ctx.arc(player.x,player.y,18,0,Math.PI*2);
      ctx.fillStyle='#88ddff'; ctx.fill(); ctx.restore();
    }
    if((player._healBuffTimer||0) > 0) {
      const hAlpha = 0.25 + 0.15*Math.sin(space.time*6);
      ctx.save(); ctx.globalAlpha=hAlpha;
      ctx.beginPath(); ctx.arc(player.x,player.y,22,0,Math.PI*2);
      ctx.fillStyle='#44ff88'; ctx.fill(); ctx.restore();
    }
    if((player._invulTimer||0) > 0) {
      const _ivA = 0.5 + 0.5*Math.sin(space.time*12);
      ctx.save(); ctx.globalAlpha=_ivA;
      ctx.beginPath(); ctx.arc(player.x,player.y,24,0,Math.PI*2);
      ctx.strokeStyle='#ffffff'; ctx.lineWidth=2/_zoom; ctx.stroke();
      ctx.globalAlpha=_ivA*0.2; ctx.fillStyle='#ffffff'; ctx.fill();
      ctx.restore();
    }

    if(player.shields > 0)
      this.drawShieldOutline(player.x, player.y, player.angle, 1,
        player.shields / Math.max(player.maxShields, 1), space.time,
        this._playerTileEntries(player), [4, 4]);

    // Target direction arrow orbiting player ship — colored by faction relation
    if(game.target && !game.target.dead) {
      const tdx = game.target.x - player.x, tdy = game.target.y - player.y;
      const tAng = Math.atan2(tdx, -tdy);
      const arR = 58;
      const arX = player.x + Math.sin(tAng)*arR, arY = player.y - Math.cos(tAng)*arR;
      const tgtRel = game.getRel(game.target.faction||'neutral');
      const tgtHostile = game.target.type==='enemy' || game.target.hostile || tgtRel < -30;
      const tgtFriendly = !tgtHostile && tgtRel >= 50;
      const arFC = tgtHostile ? 'rgba(255,55,55,0.9)' : tgtFriendly ? 'rgba(55,220,100,0.9)' : 'rgba(160,160,180,0.9)';
      const arSC = tgtHostile ? '#ff2222' : tgtFriendly ? '#22cc44' : '#aaaacc';
      ctx.save();
      ctx.translate(arX|0, arY|0); ctx.rotate(tAng);
      ctx.fillStyle=arFC; ctx.strokeStyle=arSC; ctx.lineWidth=0.8;
      ctx.beginPath(); ctx.moveTo(0,-7); ctx.lineTo(4,2); ctx.lineTo(0,0); ctx.lineTo(-4,2); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    if(player.empTimer>0) {
      ctx.beginPath(); ctx.arc(player.x,player.y,24+Math.sin(space.time*20)*3,0,Math.PI*2);
      ctx.strokeStyle='rgba(160,80,255,0.5)'; ctx.lineWidth=2; ctx.stroke();
    }
    if(game.target&&!game.target.dead) {
      const t=game.target, tr=t.r ? t.r+10 : 20+(t.size||1)*8;
      ctx.beginPath(); ctx.arc(t.x,t.y,tr,0,Math.PI*2);
      ctx.strokeStyle='rgba(255,100,100,0.6)'; ctx.lineWidth=1;
      ctx.setLineDash([4,4]); ctx.stroke(); ctx.setLineDash([]);
      // Show name above targeted planet/station
      if(t.type==='planet'||t.type==='station') {
        const facCol = G.FACTIONS[t.faction]?.color || '#aaaacc';
        ctx.save(); ctx.font=(6/_zoom)+'px "Press Start 2P",monospace';
        ctx.fillStyle=facCol; ctx.textAlign='center';
        ctx.fillText(t.spaceportName||t.name||'UNKNOWN', t.x, t.y-tr-6);
        ctx.textAlign='left'; ctx.restore();
      }
    }

    // Missile lock diamond — shrinks toward target as lock progresses
    if(game._lockTarget && !game._lockTarget.dead) {
      const lt = game._lockTarget;
      const progress = Math.min((game._lockT||0) / 3.0, 1.0);
      const baseR = (lt.r ? lt.r + 10 : 20 + (lt.size||1)*8);
      const diamondR = game._locked ? baseR + 16 : baseR + 16 + (1 - progress) * 55;
      const pulse = game._locked ? 0.7 + 0.3 * Math.sin(space.time * 12) : 1;
      ctx.save();
      ctx.globalAlpha = (game._locked ? 0.9 : 0.45 + progress * 0.45) * pulse;
      ctx.strokeStyle = game._locked ? '#ff3333' : `rgb(255,${Math.round(210 - progress*160)},0)`;
      ctx.lineWidth = 1.5 / _zoom;
      if(!game._locked) ctx.setLineDash([4/_zoom, 3/_zoom]);
      ctx.beginPath();
      ctx.moveTo(lt.x, lt.y - diamondR);
      ctx.lineTo(lt.x + diamondR, lt.y);
      ctx.lineTo(lt.x, lt.y + diamondR);
      ctx.lineTo(lt.x - diamondR, lt.y);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Radar-revealed ship brackets — corner brackets mark all revealed contacts
    const _rrShips = [...space.enemies, ...space.npcs, ...(space.fleetShips||[])];
    for(const rs of _rrShips) {
      if(!(rs._radarRevealedTimer > 0) || rs.dead || rs._deathDone) continue;
      const fade = Math.min(1, rs._radarRevealedTimer / 5);
      const pulse = 0.55 + 0.45 * Math.sin(space.time * 3 + rs.x * 0.005);
      const sz = (rs.size||1) * 20 + 10;
      const bLen = Math.max(5, sz * 0.35);
      ctx.save();
      ctx.globalAlpha = fade * pulse;
      ctx.strokeStyle = '#33aaff';
      ctx.lineWidth = 1.2 / _zoom;
      ctx.beginPath();
      // top-left corner
      ctx.moveTo(rs.x - sz + bLen, rs.y - sz); ctx.lineTo(rs.x - sz, rs.y - sz); ctx.lineTo(rs.x - sz, rs.y - sz + bLen);
      // top-right corner
      ctx.moveTo(rs.x + sz - bLen, rs.y - sz); ctx.lineTo(rs.x + sz, rs.y - sz); ctx.lineTo(rs.x + sz, rs.y - sz + bLen);
      // bottom-left corner
      ctx.moveTo(rs.x - sz + bLen, rs.y + sz); ctx.lineTo(rs.x - sz, rs.y + sz); ctx.lineTo(rs.x - sz, rs.y + sz - bLen);
      // bottom-right corner
      ctx.moveTo(rs.x + sz - bLen, rs.y + sz); ctx.lineTo(rs.x + sz, rs.y + sz); ctx.lineTo(rs.x + sz, rs.y + sz - bLen);
      ctx.stroke();
      // Label with ship type and remaining reveal time
      ctx.globalAlpha = fade * 0.75;
      ctx.fillStyle = '#33aaff';
      ctx.font = (5 / _zoom) + 'px "Press Start 2P",monospace';
      ctx.textAlign = 'center';
      const rsName = rs.name || G.SHIPS[rs.templateId||rs.shapeId]?.name || 'CONTACT';
      ctx.fillText(rsName.toUpperCase(), rs.x, rs.y - sz - (4 / _zoom));
      ctx.textAlign = 'left';
      ctx.restore();
    }

    // Interact prompt floating text
    if(game._interactPromptText && game._interactPromptTarget) {
      const tgt = game._interactPromptTarget;
      const ty = tgt.y - (tgt.r ? tgt.r + 12 : 28);
      ctx.save();
      ctx.font=(7/_zoom)+'px "Press Start 2P",monospace';
      ctx.fillStyle='rgba(100,255,200,0.9)'; ctx.textAlign='center';
      ctx.fillText(game._interactPromptText, tgt.x, ty);
      ctx.textAlign='left'; ctx.restore();
    }

    ctx.restore();

    // Dust field: collapse the player's vision to a small ring + grey haze.
    if(space._playerInDust) {
      const sx = (player.x - (camX + G.CANVAS_W/2)) * _zoom + G.CANVAS_W/2;
      const sy = (player.y - (camY + G.CANVAS_H/2)) * _zoom + G.CANVAS_H/2;
      const hole = 190, fade = 130;
      const g = ctx.createRadialGradient(sx, sy, hole*0.5, sx, sy, hole + fade);
      g.addColorStop(0, 'rgba(18,19,26,0)');
      g.addColorStop(0.62, 'rgba(15,16,22,0.55)');
      g.addColorStop(1, 'rgba(9,10,14,0.97)');
      ctx.save();
      ctx.fillStyle = g; ctx.fillRect(0,0,G.CANVAS_W,G.CANVAS_H);
      ctx.fillStyle = 'rgba(150,150,172,0.06)'; ctx.fillRect(0,0,G.CANVAS_W,G.CANVAS_H);
      ctx.restore();
    }

    // Sun glow: yellow pulsing overlay when near sun
    if(game._sunGlowAlpha > 0.01) {
      const pulse = 0.5 + 0.5 * Math.sin(space.time * 4);
      const alpha = game._sunGlowAlpha * pulse;
      ctx.save();
      ctx.fillStyle = `rgba(255,220,100,${alpha * 0.6})`;
      ctx.fillRect(0, 0, G.CANVAS_W, G.CANVAS_H);
      ctx.restore();
    }

    this.drawShipGridHUD(player);

    // Hint text when zoomed near the hex-map threshold
    if(_zoom < 0.65) {
      ctx.save();
      ctx.globalAlpha = G.clamp((0.65 - _zoom) / 0.075, 0, 1);
      ctx.font = '6px "Press Start 2P",monospace';
      ctx.fillStyle = '#334455';
      ctx.textAlign = 'center';
      ctx.fillText('SCROLL OUT → sector map', G.CANVAS_W/2, G.CANVAS_H - 12);
      ctx.textAlign = 'left';
      ctx.restore();
    }

    const mmCanvas=document.getElementById('minimap');
    if(mmCanvas) this.drawMinimap(mmCanvas,player,space,game);
  }

  _lighten(hex,a){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return `rgb(${Math.min(255,r+a)},${Math.min(255,g+a)},${Math.min(255,b+a)})`;}
  _darken(hex,a){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return `rgb(${Math.max(0,r-a)},${Math.max(0,g-a)},${Math.max(0,b-a)})`;}

  renderMenuBg(dt) {
    const ctx = this.ctx;
    const cx = G.CANVAS_W / 2, cy = G.CANVAS_H / 2;
    const maxR = Math.hypot(cx, cy) + 20;

    if (!this._menuStars) {
      this._menuT = 0;
      this._menuStars = [];
      for (let i = 0; i < 350; i++) {
        this._menuStars.push({
          angle:    Math.random() * Math.PI * 2,
          r:        10 + Math.random() * maxR,
          speed:    60 + Math.random() * 220,
          size:     1.0 + Math.random() * 2.0,
          bright:   0.7 + Math.random() * 0.3,
          hue:      Math.random() * 360,
          hueSpeed: 40 + Math.random() * 80,
        });
      }
    }

    if(!this._menuFrozen) this._menuT += dt;
    const warpT = Math.min(this._menuT / 4, 1);
    const speedMult = warpT * warpT * warpT * 8 + 0.02;

    ctx.fillStyle = '#000010';
    ctx.fillRect(0, 0, G.CANVAS_W, G.CANVAS_H);

    for (const s of this._menuStars) {
      if(!this._menuFrozen) {
        s.r   += s.speed * speedMult * dt;
        s.hue  = (s.hue + s.hueSpeed * dt) % 360;
        if (s.r > maxR) {
          s.r    = 2 + Math.random() * 15;
          s.angle = Math.random() * Math.PI * 2;
          continue;
        }
      }

      const trailLen = Math.max(2, s.speed * speedMult * 0.08);
      const r0 = Math.max(0.5, s.r - trailLen);
      const x1 = cx + Math.cos(s.angle) * r0;
      const y1 = cy + Math.sin(s.angle) * r0;
      const x2 = cx + Math.cos(s.angle) * s.r;
      const y2 = cy + Math.sin(s.angle) * s.r;

      const hTail = (s.hue - 30 + 360) % 360;
      const hHead = (s.hue + 30) % 360;
      const lTail = 55, lHead = 92;
      const aTail = Math.min(1, speedMult * 0.4) * s.bright;
      const aHead = s.bright;

      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, `hsla(${hTail},100%,${lTail}%,${aTail})`);
      grad.addColorStop(1, `hsla(${hHead},100%,${lHead}%,${aHead})`);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = grad;
      ctx.lineWidth = s.size * (0.5 + speedMult * 0.08);
      ctx.stroke();
    }
  }

  // Assign system bodies to hex grid slots by orbital distance + world angle
  _buildBodyHexMap(bodies) {
    const result = new Map();
    const used = new Set();
    const SQ3 = Math.sqrt(3);

    const star = bodies.find(b => b.type === 'star');
    if(star) { result.set(star, {q:0, r:0}); used.add('0,0'); }

    // Ring tier by orbital radius
    const ringFor = orb => orb < 1200 ? 1 : orb < 3500 ? 2 : orb < 6500 ? 3 : 4;

    // Screen-space angle of hex center (q, r) from canvas center
    const hexAngle = (q, r) => Math.atan2(1.5*r, SQ3*q + SQ3/2*r);

    const others = bodies
      .filter(b => b !== star)
      .sort((a, b) => (a.orbitR||0) - (b.orbitR||0));

    for(const b of others) {
      const ring0 = ringFor(b.orbitR || 0);
      const ba = Math.atan2(b.y || 0, b.x || 0);
      let assigned = false;
      for(let ring = ring0; ring <= ring0 + 2 && !assigned; ring++) {
        const cands = G.hexRing(ring).filter(h => !used.has(`${h.q},${h.r}`));
        if(!cands.length) continue;
        let best = cands[0], bestDiff = Infinity;
        for(const h of cands) {
          const diff = Math.abs(G.wrapAngle(ba - hexAngle(h.q, h.r)));
          if(diff < bestDiff) { bestDiff = diff; best = h; }
        }
        result.set(b, {q: best.q, r: best.r});
        used.add(`${best.q},${best.r}`);
        assigned = true;
      }
    }
    return result;
  }

  // Full hex-map view: tactical sector overlay between space flight and galaxy map
  renderHexMap(game) {
    const ctx = this.ctx;
    const CX = G.CANVAS_W/2, CY = G.CANVAS_H/2;
    const S = G.HEX_PX, SQ3 = Math.sqrt(3);
    const space = game.space, player = game.player;
    if(!space || !player) return;

    // Background
    ctx.fillStyle = '#000810';
    ctx.fillRect(0, 0, G.CANVAS_W, G.CANVAS_H);

    // Hex (q,r) → screen (x,y)
    const hexXY = (q, r) => ({
      x: CX + S * (SQ3*q + SQ3/2*r),
      y: CY + S * 1.5*r,
    });

    // Stroke a hex outline
    const hexPath = (q, r, inset=0) => {
      const {x, y} = hexXY(q, r);
      ctx.beginPath();
      for(let i=0; i<6; i++) {
        const a = Math.PI/6 + i*Math.PI/3;
        const hx = x + (S-inset)*Math.cos(a), hy = y + (S-inset)*Math.sin(a);
        i===0 ? ctx.moveTo(hx,hy) : ctx.lineTo(hx,hy);
      }
      ctx.closePath();
    };

    // Draw grid
    ctx.strokeStyle = 'rgba(0,70,120,0.20)';
    ctx.lineWidth = 0.5;
    for(let q=-7; q<=7; q++) {
      for(let r=-7; r<=7; r++) {
        if(Math.max(Math.abs(q),Math.abs(r),Math.abs(-q-r)) > 7) continue;
        const {x,y} = hexXY(q, r);
        if(x < -S || x > G.CANVAS_W+S || y < -S || y > G.CANVAS_H+S) continue;
        hexPath(q, r);
        ctx.stroke();
      }
    }

    // Typed tile fills (sun / near-sun / asteroid / dust / planet / station)
    const tiles = space.hexTiles ? [...space.hexTiles.values()] : [];
    for(const t of tiles) {
      const fc = t.type==='sun'?'rgba(255,200,60,0.08)'
        : t.type==='near_sun'?'rgba(255,80,30,0.14)'
        : t.type==='asteroid'?(t.density==='dense'?'rgba(130,95,55,0.18)':'rgba(120,90,50,0.10)')
        : t.type==='dust'?'rgba(150,150,175,0.10)'
        : t.type==='planet'?'rgba(40,90,200,0.07)'
        : t.type==='station'?'rgba(120,120,170,0.08)' : null;
      if(!fc) continue;
      hexPath(t.q, t.r, 2);
      ctx.fillStyle = fc; ctx.fill();
      ctx.strokeStyle = t.type==='near_sun'?'rgba(255,90,40,0.40)'
        : t.type==='asteroid'?'rgba(150,110,60,0.35)'
        : t.type==='dust'?'rgba(175,175,205,0.32)'
        : t.type==='sun'?'rgba(200,160,40,0.30)':'rgba(40,100,200,0.22)';
      ctx.lineWidth = 0.9; ctx.stroke();
      if(t.type==='dust') {
        const {x,y} = hexXY(t.q,t.r);
        const g = ctx.createRadialGradient(x,y,2,x,y,S*0.92);
        g.addColorStop(0,'rgba(185,185,205,0.22)'); g.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,S*0.92,0,Math.PI*2); ctx.fill();
      }
    }

    // Body icons keyed by their placed hex coords
    const bodyMap = new Map();
    for(const b of space.bodies) if(b.hexQ != null) bodyMap.set(b, {q:b.hexQ, r:b.hexR});

    // Asteroid speckle at world positions
    ctx.fillStyle = '#5a4633';
    for(const a of space.asteroids) {
      const sx = CX + a.x*S/G.HEX_WORLD, sy = CY + a.y*S/G.HEX_WORLD;
      if(sx < 0 || sx > G.CANVAS_W || sy < 0 || sy > G.CANVAS_H) continue;
      ctx.fillRect(sx|0, sy|0, 2, 2);
    }

    // Body icons at assigned hex centers
    const blink = Math.sin(Date.now()*0.007) > 0;
    const isMissHere = (game.activeMissions||[]).some(m =>
      !m.completed && !m.failed &&
      (m.params?.dest===game.currentSysId || m.params?.target===game.currentSysId)
    );

    for(const [b, h] of bodyMap) {
      const {x, y} = hexXY(h.q, h.r);
      ctx.save();
      if(b.type === 'star') {
        const col = b.color || '#ffff88';
        const g = ctx.createRadialGradient(x,y,5,x,y,26);
        g.addColorStop(0, col+'dd'); g.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,26,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=col; ctx.beginPath(); ctx.arc(x,y,10,0,Math.PI*2); ctx.fill();
      } else if(b.type === 'planet') {
        const isMiss = isMissHere && b.hasSpaceport;
        const col = isMiss&&blink ? '#ffcc00' : b.hasSpaceport ? '#4488ff' : '#556677';
        ctx.fillStyle=col; ctx.beginPath(); ctx.arc(x,y,6,0,Math.PI*2); ctx.fill();
        if(b.hasSpaceport) {
          ctx.strokeStyle = isMiss&&blink ? '#ffcc00' : '#2255cc';
          ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(x,y,10,0,Math.PI*2); ctx.stroke();
        }
        if(isMiss&&blink) {
          ctx.strokeStyle='#ffcc00'; ctx.lineWidth=1;
          ctx.beginPath(); ctx.arc(x,y,14,0,Math.PI*2); ctx.stroke();
        }
      } else if(b.type === 'station') {
        ctx.fillStyle='#aaaacc'; ctx.fillRect(x-6,y-6,12,12);
        ctx.strokeStyle='#6666aa'; ctx.lineWidth=1; ctx.strokeRect(x-9,y-9,18,18);
      }
      if(b.name) {
        ctx.font = '5px "Press Start 2P",monospace';
        ctx.fillStyle = b.type==='star' ? '#aaaa55' : '#445566';
        ctx.textAlign = 'center';
        ctx.fillText(b.spaceportName||b.name, x, y + (b.type==='star'?24:19));
      }
      ctx.restore();
    }

    // World-position → screen helper
    const wts = (wx, wy) => ({
      x: CX + wx*S/G.HEX_WORLD,
      y: CY + wy*S/G.HEX_WORLD,
    });

    // Ship triangle helper
    const drawTri = (x, y, angle, col, sz=5) => {
      ctx.save(); ctx.translate(x,y); ctx.rotate(angle);
      ctx.fillStyle=col;
      ctx.beginPath(); ctx.moveTo(0,-sz); ctx.lineTo(sz*0.8,sz); ctx.lineTo(-sz*0.8,sz); ctx.closePath();
      ctx.fill(); ctx.restore();
    };

    // Derelicts
    for(const d of space.derelicts) {
      if(d.looted) continue;
      const {x,y}=wts(d.x,d.y);
      drawTri(x,y,d.angle||0,'#555566',4);
    }

    // Turrets
    for(const t of space.turrets||[]) {
      if(t._dead) continue;
      const {x,y}=wts(t.x,t.y);
      ctx.fillStyle=t.hostile?'#ff2222':'#334433';
      ctx.fillRect(x-2,y-2,5,5);
    }

    // Fleet ships (friendly)
    for(const fs of space.fleetShips||[]) {
      if(fs.dead||fs._deathDone||fs._inDust) continue;
      const {x,y}=wts(fs.x,fs.y);
      drawTri(x,y,fs.angle,'#00ff88',5);
    }

    // NPC ships
    for(const n of space.npcs) {
      if(n.dead||n.boarded||n._inDust) continue;
      const {x,y}=wts(n.x,n.y);
      const nRel=game.getRel(n.faction);
      const nFacCol=G.FACTIONS[n.faction]?.color;
      const col=n.hostile?(nFacCol||'#ff3333'):nRel>=50?'#00ee66':nRel>=-20?'#88aacc':nRel<-30?(nFacCol||'#ff8800'):'#ffcc00';
      drawTri(x,y,n.angle,col,5);
      if(n.hostile&&blink) {
        ctx.beginPath(); ctx.arc(x,y,8,0,Math.PI*2);
        ctx.strokeStyle='#ff2222'; ctx.lineWidth=1.2; ctx.stroke();
      }
    }

    // Enemy ships
    for(const e of space.enemies) {
      if(e._deathDone||e.boarded||e._inDust) continue;
      const {x,y}=wts(e.x,e.y);
      const rel=game.getRel(e.faction)||0;
      const col=G.FACTIONS[e.faction]?.color||(rel<-50?'#ff3333':'#ff8800');
      drawTri(x,y,e.angle,col,6);
      if((rel<-20||e.aiState==='engage')&&blink) {
        ctx.beginPath(); ctx.arc(x,y,10,0,Math.PI*2);
        ctx.strokeStyle='#ff2222'; ctx.lineWidth=1.5; ctx.stroke();
      }
    }

    // Player ship
    {
      const {x,y}=wts(player.x,player.y);
      const pg=ctx.createRadialGradient(x,y,3,x,y,14);
      pg.addColorStop(0,'rgba(0,255,238,0.35)'); pg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=pg; ctx.beginPath(); ctx.arc(x,y,14,0,Math.PI*2); ctx.fill();
      drawTri(x,y,player.angle,'#ffffff',7);
      ctx.beginPath(); ctx.arc(x,y,11,0,Math.PI*2);
      ctx.strokeStyle='rgba(0,255,238,0.65)'; ctx.lineWidth=1.5; ctx.stroke();
    }

    // Current target marker (ships at world pos, bodies on their hex cell)
    if(game.target && !game.target.dead) {
      let tp = null;
      for(const [b, h] of bodyMap) if(b === game.target) { tp = hexXY(h.q, h.r); break; }
      if(!tp && game.target.x != null) tp = wts(game.target.x, game.target.y);
      if(tp) {
        const tr = 9 + 2*Math.sin(Date.now()*0.012);
        ctx.strokeStyle = '#ffcc33'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(tp.x, tp.y, tr, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(tp.x-tr-3, tp.y); ctx.lineTo(tp.x-tr+2, tp.y);
        ctx.moveTo(tp.x+tr-2, tp.y); ctx.lineTo(tp.x+tr+3, tp.y);
        ctx.moveTo(tp.x, tp.y-tr-3); ctx.lineTo(tp.x, tp.y-tr+2);
        ctx.moveTo(tp.x, tp.y+tr-2); ctx.lineTo(tp.x, tp.y+tr+3);
        ctx.stroke();
      }
    }

    // Pulsing ring on center hex (system core)
    const pulse = 0.45+0.25*Math.sin(Date.now()*0.0022);
    hexPath(0, 0, 2);
    ctx.strokeStyle=`rgba(0,180,255,${pulse})`; ctx.lineWidth=1.2; ctx.stroke();

    // UI text overlay
    const sys = G.SYSTEMS?.find(s=>s.id===game.currentSysId);
    ctx.save();
    ctx.font = '8px "Press Start 2P",monospace';
    ctx.fillStyle = '#00ffee'; ctx.textAlign = 'left';
    ctx.fillText('SECTOR — '+(sys?.name||game.currentSysId).toUpperCase(), 10, 22);
    ctx.font = '5px "Press Start 2P",monospace';
    ctx.fillStyle = '#334455';
    ctx.fillText('[SCROLL IN] return to flight   [M] galaxy map', 10, 36);
    ctx.restore();
  }
};

// ── Main Game Class ───────────────────────────────────────
G.Game = class {
  constructor() {
    this.state     = 'menu';
    this.paused    = false;
    this.credits   = 1000;
    this.kills     = 0;
    this.playerXP    = 0;
    this.playerLevel = 1;
    this.startTime = 0;
    this.relations = { earth:50, rebellion:0, pirate:-50, alien:-100, contested:0, neutral:0 };
    this.activeMissions  = [];
    this.completedMissions=[];

    this.player    = null;
    this.currentSysId='sol';
    this.target    = null;
    this.camX=0; this.camY=0;
    this._camLeadX=0; this._camLeadY=0;
    this.camZoom=1.0;
    this._landFade=0;
    this._landPending=null;
    this._autopilot=false;
    this._bgEnabled=true;
    this._interactPromptText = null;
    this._interactPromptTarget = null;
    this._sunGlowAlpha = 0;
    this._escapePodFollowing = null;

    // Control scheme selector. 'auto' resolves each frame to:
    //   gamepad (if a controller is connected) > touch (mobile device) > keyboard.
    // The player can pin a specific scheme from the Options menu. A legacy
    // mobile-controls flag migrates to a 'touch' pin.
    let _scheme = localStorage.getItem('nullpunkt_control_scheme');
    if(!_scheme){
      const _legacy = localStorage.getItem('nullpunkt_mobile_controls');
      _scheme = _legacy === '1' ? 'touch' : (_legacy === '0' ? 'keyboard' : 'auto');
    }
    this._controlScheme = _scheme;     // 'auto' | 'keyboard' | 'touch' | 'gamepad'
    this._mobileControls = false;      // derived: effective scheme === 'touch'
    this._lastEffScheme  = null;       // for detecting auto-swaps
    const _steerSaved = localStorage.getItem('nullpunkt_steer_mode');
    this._joystickMode = _steerSaved === 'joystick';

    // FPS counter
    this._fpsEl = document.getElementById('fps-counter');
    this._fpsHistory = [];
    this._fpsGraphCanvas = document.getElementById('fps-graph');

    // Hyperspace state
    this.hyperspaceT      = 0;
    this.hyperspaceTarget = null;
    this._jumpChargeT     = 0;
    this._jumpChargeBar   = null;
    this._jumpCooldown    = 0; // cooldown after arriving in a system
    this.priceMultipliers = {}; // Track price multipliers per system per item for dynamic pricing

    this.canvas    = document.getElementById('gameCanvas');
    this.renderer  = new G.Renderer(this.canvas);
    this.input     = new G.Input();
    this.particles = new G.Particles();
    this.space     = new G.Space();
    this.galaxy    = new G.Galaxy();
    this.economy   = new G.Economy();
    this.ui        = new G.UI();

    G.game  = this;
    G.ui    = this.ui;
    G.sound = new G.SoundEngine();

    // Reflect the saved control scheme into the Options selector now that
    // G.game exists (UI was constructed before this assignment).
    this.ui.refreshControlScheme?.();
    // Reflect saved steer mode into STEER buttons
    const _joyMode = this._joystickMode;
    const _dpadBtn = document.getElementById('opt-steer-dpad');
    const _joyBtn  = document.getElementById('opt-steer-joy');
    if(_dpadBtn){ _dpadBtn.style.color = _joyMode ? '' : '#44ffcc'; _dpadBtn.style.borderColor = _joyMode ? '' : '#44ffcc'; }
    if(_joyBtn) { _joyBtn.style.color  = _joyMode ? '#44ffcc' : ''; _joyBtn.style.borderColor  = _joyMode ? '#44ffcc' : ''; }
    this._updateMobileControls();

    this._prevHostileCount = 0;
    this.combatLog = [];
    this.fleet = [];

    // Click on game canvas → target the ship under the cursor
    this.canvas.addEventListener('click', e => {
      if(this.state === 'menu') { this.start(); return; }
      // Hex map: pick the nearest object in screen space (ships use the scaled
      // world transform, bodies sit on their schematic hex cells).
      if(this.state === 'hexmap') {
        const rect = this.canvas.getBoundingClientRect();
        const ratio = G.CANVAS_W / rect.width;
        const cx = (e.clientX - rect.left) * ratio;
        const cy = (e.clientY - rect.top)  * ratio;
        const CX = G.CANVAS_W/2, CY = G.CANVAS_H/2, S = G.HEX_PX, SQ3 = Math.sqrt(3);
        const wts = (wx, wy) => ({ x: CX + wx*S/G.HEX_WORLD, y: CY + wy*S/G.HEX_WORLD });
        let best = null, bestD = 16; // screen-pixel pick radius
        for(const ship of this.space.allTargets().filter(s=>!s._inDust)) {
          const s = wts(ship.x, ship.y);
          const d = Math.hypot(s.x - cx, s.y - cy);
          if(d < bestD) { bestD = d; best = ship; }
        }
        const bodyMap = this.renderer._buildBodyHexMap(this.space.bodies);
        for(const [b, h] of bodyMap) {
          const x = CX + S*(SQ3*h.q + SQ3/2*h.r), y = CY + S*1.5*h.r;
          const d = Math.hypot(x - cx, y - cy);
          if(d < Math.max(14, bestD)) { bestD = d; best = b; }
        }
        // Only an object changes the target; empty space keeps the current one.
        if(best) { this.target = best; G.sound?.targetLock(); }
        return;
      }
      if(this.state !== 'space') return;
      const rect = this.canvas.getBoundingClientRect();
      const ratio = G.CANVAS_W / rect.width;
      const cx = (e.clientX - rect.left) * ratio;
      const cy = (e.clientY - rect.top)  * ratio;
      // Invert the camera transform: canvas → world
      const zoom = this.camZoom || 1;
      const wx = (cx - G.CANVAS_W / 2) / zoom + this.camX + G.CANVAS_W / 2;
      const wy = (cy - G.CANVAS_H / 2) / zoom + this.camY + G.CANVAS_H / 2;
      // Find nearest targetable ship within a generous click radius
      const CLICK_RADIUS = 48 / zoom; // world-space radius scales with zoom
      let best = null, bestD = CLICK_RADIUS;
      for(const ship of this.space.allTargets().filter(s=>!s._inDust)) {
        const d = Math.hypot(ship.x - wx, ship.y - wy);
        if(d < bestD) { bestD = d; best = ship; }
      }
      if(!best) {
        for(const b of this.space.bodies) {
          if(b.type !== 'planet' && b.type !== 'station') continue;
          const d = Math.hypot(b.x - wx, b.y - wy);
          if(d < Math.max(b.r + 8/zoom, CLICK_RADIUS)) { best = b; break; }
        }
      }
      if(!best) {
        for(const proj of this.space.projectiles) {
          if(proj.type !== 'missile' || proj.dead) continue;
          const d = Math.hypot(proj.x - wx, proj.y - wy);
          if(d < CLICK_RADIUS) { best = proj; break; }
        }
      }
      if(best) {
        this.target = best;
        G.sound?.targetLock();
      } else {
        this.target = null; // click empty space to untarget
      }
    });

    // Double-click a ship or planet → open its comms channel
    this.canvas.addEventListener('dblclick', e => {
      if(this.state !== 'space') return;
      const rect = this.canvas.getBoundingClientRect();
      const ratio = G.CANVAS_W / rect.width;
      const cx = (e.clientX - rect.left) * ratio;
      const cy = (e.clientY - rect.top)  * ratio;
      const zoom = this.camZoom || 1;
      const wx = (cx - G.CANVAS_W / 2) / zoom + this.camX + G.CANVAS_W / 2;
      const wy = (cy - G.CANVAS_H / 2) / zoom + this.camY + G.CANVAS_H / 2;
      const CLICK_RADIUS = 48 / zoom;
      // Prefer a hailable ship, then a planet/station, under the cursor.
      let best = null, bestD = CLICK_RADIUS;
      for(const ship of this.space.allTargets().filter(s=>!s._inDust)) {
        if(ship.type === 'derelict' || ship.type === 'turret') continue;
        const d = Math.hypot(ship.x - wx, ship.y - wy);
        if(d < bestD) { bestD = d; best = ship; }
      }
      if(!best) {
        for(const b of this.space.bodies) {
          if(b.type !== 'planet' && b.type !== 'station') continue;
          const d = Math.hypot(b.x - wx, b.y - wy);
          if(d < Math.max(b.r + 8/zoom, CLICK_RADIUS)) { best = b; break; }
        }
      }
      if(best) {
        this.target = best;
        this.ui.openComms(best);
      }
    });

    // Mouse-wheel zoom while flying; zoom past minimum → enter hex map
    this._zoomManual = 0;
    this.canvas.addEventListener('wheel', e => {
      if(this.state === 'hexmap') {
        e.preventDefault();
        if(e.deltaY < 0) {
          this.state = 'space';
          this._zoomManual = -0.42;
          document.getElementById('minimap-wrap')?.classList.remove('hidden');
        }
        return;
      }
      if(this.state !== 'space') return;
      e.preventDefault();
      const nz = (this._zoomManual || 0) - e.deltaY * 0.0008;
      // Allow zooming out 2× further (camZoom floor ~0.2875) before the hex map.
      if(nz < -0.7125) {
        this.state = 'hexmap';
        this._zoomManual = -0.7125;
        document.getElementById('minimap-wrap')?.classList.add('hidden');
      } else {
        this._zoomManual = G.clamp(nz, -0.7125, 3.04);
      }
    }, { passive: false });

    // Minimap click → target ship
    document.addEventListener('click', e => {
      if(this.state !== 'space') return;
      const mmCanvas = document.getElementById('minimap');
      if(!mmCanvas) return;
      if(!mmCanvas.contains(e.target)) return;

      const rect = mmCanvas.getBoundingClientRect();
      const mmX = e.clientX - rect.left;
      const mmY = e.clientY - rect.top;
      const RANGE = 8000;
      const cx = mmCanvas.width / 2;
      const cy = mmCanvas.height / 2;
      const scale = mmCanvas.width / (RANGE * 2);
      const wx = this.player.x + (mmX - cx) / scale;
      const wy = this.player.y + (mmY - cy) / scale;
      // Find nearest targetable ship within click radius
      const CLICK_RADIUS = 150; // world-space radius
      let best = null, bestD = CLICK_RADIUS;
      for(const ship of this.space.allTargets().filter(s=>!s._inDust)) {
        const d = Math.hypot(ship.x - wx, ship.y - wy);
        if(d < bestD) { bestD = d; best = ship; }
      }
      if(!best) {
        for(const b of this.space.bodies) {
          if(b.type !== 'planet' && b.type !== 'station') continue;
          const d = Math.hypot(b.x - wx, b.y - wy);
          if(d < Math.max(b.r + 80, CLICK_RADIUS)) { best = b; break; }
        }
      }
      if(!best) {
        for(const proj of this.space.projectiles) {
          if(proj.type !== 'missile' || proj.dead) continue;
          const d = Math.hypot(proj.x - wx, proj.y - wy);
          if(d < CLICK_RADIUS) { best = proj; break; }
        }
      }
      if(best) {
        this.target = best;
        G.sound?.targetLock();
      } else {
        this.target = null;
      }
    }, true);

    this.galaxy.init();
    this._last = 0;
    this._updateContinueBtn();
    // Loop started from bootstrap after override is applied
  }

  _updateContinueBtn() {
    const btn = document.getElementById('continue-btn');
    if(!btn) return;
    const save = localStorage.getItem(G.SAVE_KEY);
    if(save) {
      btn.classList.remove('hidden');
      try {
        const d = JSON.parse(save);
        const dt = new Date(d.timestamp);
        document.getElementById('save-info').textContent =
          d.currentSysId ? d.currentSysId.toUpperCase()+' · '+G.fmtCredits(d.credits||0)+' · '+dt.toLocaleDateString() : '';
      } catch(e){}
    } else {
      btn.classList.add('hidden');
    }
  }

  _xpForNextLevel(level) { return level * 100; }

  _addXP(amount) {
    if(!amount || amount <= 0 || this.playerLevel >= 100) return;
    this.playerXP += amount;
    let leveled = false;
    while(this.playerLevel < 100 && this.playerXP >= this._xpForNextLevel(this.playerLevel)) {
      this.playerXP -= this._xpForNextLevel(this.playerLevel);
      this.playerLevel++;
      leveled = true;
    }
    if(leveled) {
      this.ui?.addMsg(`LEVEL UP — Now Level ${this.playerLevel}!`, '#ffcc00');
      this.addCombatLog(`LEVEL UP — LEVEL ${this.playerLevel}`, '#ffcc00');
    }
  }

  saveGame() {
    const save = {
      version:      2,
      timestamp:    Date.now(),
      playerName:      this.playerName      || 'Commander',
      playerSex:       this.playerSex       || 'male',
      playerFaceIdx:   this.playerFaceIdx   || 0,
      playerFactionId: this.playerFactionId || 'neutral',
      playerClassId:   this.playerClassId   || 'space_marine',
      playerXP:        this.playerXP        || 0,
      playerLevel:     this.playerLevel     || 1,
      credits:      this.credits,
      kills:        this.kills,
      currentSysId: this.currentSysId,
      relations:    {...this.relations},
      activeMissions:    JSON.parse(JSON.stringify(this.activeMissions)),
      completedMissions: JSON.parse(JSON.stringify(this.completedMissions)),
      galaxyVisited: [...this.galaxy.visited],
      player:       this.player.getSaveData(),
      playerPos:    { x:this.player.x, y:this.player.y },
      playerAbilities: [...(this.player.abilities||[])],
      fleet: this.fleet.map(e => ({
        id: e.id, fleetName: e.fleetName,
        combatSpeed: e.combatSpeed, combatTurnSpeed: e.combatTurnSpeed,
        combatDamage: e.combatDamage, combatFireRate: e.combatFireRate,
        combatWeaponType: e.combatWeaponType, combatWeaponColor: e.combatWeaponColor,
        ship: e.ship.getSaveData(),
      })),
      options: {
        bgEnabled: this._bgEnabled,
      },
    };
    localStorage.setItem(G.SAVE_KEY, JSON.stringify(save));
    this.ui.addMsg('Game saved.', '#00ffee');
    this.ui.showSaveConfirm();
    this._updateContinueBtn();
  }

  loadGame(saveData) {
    G.sound?._ctx();
    const d = typeof saveData === 'string' ? JSON.parse(saveData) : saveData;
    this.playerName      = d.playerName      || 'Commander';
    this.playerSex       = d.playerSex       || 'male';
    this.playerFaceIdx   = d.playerFaceIdx   || 0;
    this.playerFactionId = d.playerFactionId || 'neutral';
    this.playerClassId   = d.playerClassId   || 'space_marine';
    this.playerXP        = d.playerXP        || 0;
    this.playerLevel     = d.playerLevel     || 1;
    this.credits   = d.credits   || 0;
    this.kills     = d.kills     || 0;
    this.relations = d.relations || { earth:50, rebellion:0, pirate:-50, alien:-100 };
    this.activeMissions    = d.activeMissions    || [];
    this.completedMissions = d.completedMissions || [];
    this.currentSysId      = d.currentSysId || 'sol';
    this._bgEnabled = (d.options?.bgEnabled ?? true);
    const bgCheckbox = document.getElementById('opt-bg-enabled');
    if(bgCheckbox) bgCheckbox.checked = this._bgEnabled;

    // Restore galaxy visited and rebuild known (visited + their neighbors)
    this.galaxy.visited = new Set(d.galaxyVisited || ['sol']);
    this.galaxy.known   = new Set();
    for (const sid of this.galaxy.visited) {
      this.galaxy.known.add(sid);
      for (const nb of (this.galaxy.routes[sid] || [])) this.galaxy.known.add(nb);
    }

    // Rebuild player ship from save
    const sd = d.player;
    this.player = new G.Ship(sd.templateId || 'shuttle');
    // Overwrite module state directly
    this.player.modules = sd.modules || {};
    this.player.slots   = Array.isArray(sd.slots) ? sd.slots : this.player.slots;
    this.player.cargo   = sd.cargo   || {};
    this.player.ammo    = sd.ammo    || {};
    this.player.crew    = sd.crew    || [];
    this.player.moduleInventory = sd.moduleInventory || [];
    this.player.powerWeapons = sd.powerWeapons || 0.33;
    this.player.powerShields = sd.powerShields || 0.33;
    this.player.powerEngines = sd.powerEngines || 0.34;
    this.player.abilities = d.playerAbilities || sd.abilities || [];
    if(this.player.abilities.length === 0) this.player.abilities = Object.keys(G.ABILITIES);
    this.player.abilityCooldowns = {};
    // Rename auto_turret → turret in saved modules
    for(const inst of Object.values(this.player.modules)) {
      if(inst.moduleId === 'auto_turret') inst.moduleId = 'turret';
    }
    this.player.ensureCockpit();     // migrate older saves that predate the cockpit
    this.player.ensureCoreModule();  // migrate older saves that predate class core modules
    this.player.ensureHullPanels();  // migrate older saves that predate hull enclosure system
    this.player._recompute();
    this.player.hull    = sd.hull    || this.player.maxHull;
    this.player.shields = sd.shields || 0;
    this.player.energy  = sd.energy  || this.player.maxEnergy;
    this.player.fuel    = sd.fuel    || this.player.maxFuel;
    this.player.x = d.playerPos?.x || 600;
    this.player.y = d.playerPos?.y || 400;

    this.fleet = (d.fleet || []).map(fd => {
      const ship = new G.Ship(fd.ship?.templateId || 'pirate_skiff');
      if(fd.ship) {
        ship.modules = fd.ship.modules || {};
        ship.slots = Array.isArray(fd.ship.slots) ? fd.ship.slots : ship.slots;
        ship.cargo = fd.ship.cargo || {};
        ship.crew = fd.ship.crew || [];
        ship.ensureCoreModule();
        ship._recompute();
        ship.hull = fd.ship.hull || ship.maxHull;
        ship.shields = fd.ship.shields || 0;
      }
      return {
        id: fd.id || 'fleet_'+Date.now(),
        fleetName: fd.fleetName || 'Fleet Ship',
        ship,
        combatSpeed: fd.combatSpeed || 280,
        combatTurnSpeed: fd.combatTurnSpeed || 2.0,
        combatDamage: fd.combatDamage || 15,
        combatFireRate: fd.combatFireRate || 1.0,
        combatWeaponType: fd.combatWeaponType || 'laser',
        combatWeaponColor: fd.combatWeaponColor || '#ff8844',
      };
    });

    // Load space scene
    this.economy._marketCache = {};
    this.space = new G.Space();
    this.space.loadSystem(this.currentSysId);
    this.camX = this.player.x - G.CANVAS_W/2;
    this.camY = this.player.y - G.CANVAS_H/2;
    this._camLeadX=0; this._camLeadY=0;
    this.camZoom=1.0; this._landFade=0; this._landPending=null;
    this.target = null;
    this.state = 'space';
    this._spawnFleetShips();

    const sys = G.SYSTEMS.find(s=>s.id===this.currentSysId);
    if(this.ui.els['system-label']) this.ui.els['system-label'].textContent = (sys?.name||this.currentSysId) + (this.space?.nebula?' ✦ NEBULA':'');
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('gameover-overlay').classList.add('hidden');
    this._showHUD();
    this.ui.addMsg(`Welcome back, ${this.playerName}.`, '#00ffee');
  }

  start() {
    G.sound?._ctx();
    document.getElementById('gameover-overlay').classList.add('hidden');
    this.ui.showCharCreate(charData => this._doStart(charData));
  }

  _doStart(charData) {
    this.playerName      = charData.name;
    this.playerSex       = charData.sex;
    this.playerFaceIdx   = charData.faceIdx;
    this.playerFactionId = charData.factionId;
    this.playerClassId   = charData.classId || 'space_marine';

    this.state    = 'space';
    this.credits  = 1000;
    this.kills    = 0;
    this.playerXP    = 0;
    this.playerLevel = 1;
    this.startTime= Date.now();
    this.activeMissions=[]; this.completedMissions=[];
    this.relations={ earth:50, rebellion:0, pirate:-50, alien:-100, contested:0, neutral:0 };
    this.fleet=[];
    this.currentSysId='sol';
    this.target=null;
    this.hyperspaceT=0; this.hyperspaceTarget=null; this._jumpChargeT=0; this._jumpCooldown=0;

    this.economy._marketCache = {};
    this.player = new G.Ship(charData.shipId || 'shuttle');
    const startAbility = G.CLASSES[charData.classId]?.startAbility;
    this.player.abilities = startAbility ? [startAbility] : [];
    this.space = new G.Space();
    this.space.loadSystem('sol');
    const earth = this.space.bodies.find(b => b.name === 'Earth');
    if (earth) {
      this.player.x = earth.x + 200;
      this.player.y = earth.y;
    } else {
      this.player.x = 800; this.player.y = 300;
    }
    this._spawnFleetShips();
    this.galaxy.visited = new Set();
    this.galaxy.known   = new Set();
    this.galaxy.revealAround('sol');
    this.galaxy.clearRoute();
    this.player.ammo.kinetic_rounds = 200;
    const sa = G.SHIPS[charData.shipId]?.startAmmo;
    if (sa) for (const [id, qty] of Object.entries(sa)) this.player.ammo[id] = (this.player.ammo[id]||0) + qty;

    this.camX=this.player.x-G.CANVAS_W/2;
    this.camY=this.player.y-G.CANVAS_H/2;
    this._camLeadX=0; this._camLeadY=0;
    this.camZoom=1.0; this._landFade=0; this._landPending=null;
    this._autopilot=false;
    this._zoomManual=0;
    this._playerDyingStarted=false; this._playerDyingTimer=0;
    this._arrivalBraking=false;

    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('gameover-overlay').classList.add('hidden');
    this._showHUD();
    const sys=G.SYSTEMS.find(s=>s.id==='sol');
    if(this.ui.els['system-label']) this.ui.els['system-label'].textContent=sys?.name||'Sol';
    this.ui.addMsg(`Welcome, ${charData.name}. Earn your way to the stars.`,'#00ffee');
    this.ui.addMsg('WASD:fly  SHIFT:boost(energy)  SPACE:fire  M:map  M+hold J:jump','#556677');
  }

  restart() { this.start(); }

  _drawJumpCharge() {
    const el  = document.getElementById('jump-charge-hud');
    const lbl = document.getElementById('jump-charge-label');
    const fill= document.getElementById('jump-charge-fill');
    if(!el) return;
    if(this._jumpChargeT <= 0) { el.classList.add('hidden'); return; }
    const frac = this._jumpChargeT / 5.0;
    el.classList.remove('hidden');
    if(lbl)  lbl.textContent = 'CHARGING JUMP... ' + Math.floor(frac*100) + '%';
    if(fill) fill.style.width = (frac*100) + '%';
  }

  // Hyperspace departure: camera stays, ship flies off screen
  _updateJumpDeparture(dt) {
    this._jumpDepartTimer -= dt;
    this.player.x += this.player.vx * dt;
    this.player.y += this.player.vy * dt;
    if(this._jumpDepartTimer <= 0) {
      this._jumpDeparting = false;
      this._flashFrames   = 6;
      this._doSystemTransition();
    }
  }

  _doSystemTransition() {
    const sysId = this.hyperspaceTarget;
    const spd = Math.hypot(this.player.vx, this.player.vy)||1;
    const nx   = this.player.vx/spd;
    const ny   = this.player.vy/spd;

    this.currentSysId = sysId;
    this.galaxy.revealAround(sysId);
    this.space.loadSystem(sysId);
    this._spawnFleetShips();

    // Arrive from edge: ship screams in at high speed then hard-brakes
    this.player.x  = nx * -3200 + G.CANVAS_W/2;
    this.player.y  = ny * -3200 + G.CANVAS_H/2;
    this.player.vx = nx * 8000;
    this.player.vy = ny * 8000;
    this.camX = this.player.x - G.CANVAS_W/2;
    this.camY = this.player.y - G.CANVAS_H/2;
    this.camZoom = 1.26;       // starts zoomed in, lerps back to normal
    this._arrivalZoomT = 1.0;  // extra boost decays over ~1s
    this._arrivalBraking = true;
    this.target = null;
    this.state = 'space';
    G.sound.hyperspaceArrival();

    // Jump cooldown — player must wait before jumping again (from module stats)
    this._jumpCooldown = this.player.jumpCooldown < 99 ? this.player.jumpCooldown : 6;

    // Advance route: remove the system we just jumped to
    if(this.galaxy.jumpRoute.length > 0 && this.galaxy.jumpRoute[0] === sysId) {
      this.galaxy.jumpRoute.shift();
      // Update selected to next hop
      this.galaxy.selected = this.galaxy.jumpRoute.length > 0
        ? G.SYSTEMS.find(s=>s.id===this.galaxy.jumpRoute[0])
        : null;
    }

    const sys = G.SYSTEMS.find(s=>s.id===sysId);
    if(this.ui.els['system-label']) this.ui.els['system-label'].textContent = sys?.name||sysId;
    const fac = G.FACTIONS[sys?.faction]||G.FACTIONS.neutral;
    const rel  = this.getRel(sys?.faction||'neutral');
    const routeLeft = this.galaxy.jumpRoute.length;
    this.ui.addMsg('Arrived: '+(sys?.name||sysId)+(rel<-30?' — HOSTILE':'')+' [Danger:'+sys?.danger+']'+(routeLeft>0?' ['+routeLeft+' hops left]':''), fac.color||'#00ffee');
    this._showHUD();
  }

  _updateSpace(dt, now) {
    const p=this.player;
    if(!p) return;

    // Weapon cycle: [ and ] keys
    if(this.input.pressed('BracketLeft') && p.weaponSlots.length > 1)
      p.activeWeapon = (p.activeWeapon - 1 + p.weaponSlots.length) % p.weaponSlots.length;
    if(this.input.pressed('BracketRight') && p.weaponSlots.length > 1)
      p.activeWeapon = (p.activeWeapon + 1) % p.weaponSlots.length;

    // Ability keys 1-0 (slots 0-9)
    if(!p.disabled) {
      const _aKeys = ['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0'];
      for(let i=0;i<10;i++) {
        if(this.input.pressed(_aKeys[i])) {
          const _aid = (p.abilities||[])[i];
          if(_aid) this._useAbility(_aid, p);
        }
      }
    }

    // Tick ability cooldowns
    const _acd = p.abilityCooldowns || (p.abilityCooldowns = {});
    for(const k in _acd) { if(_acd[k] > 0) _acd[k] = Math.max(0, _acd[k] - dt); }

    // Tick heal buff on player
    if((p._healBuffTimer||0) > 0) {
      p._healBuffTimer -= dt;
      p.hull = Math.min(p.maxHull, p.hull + (p._healBuff||5) * dt);
      if(p._healBuffTimer <= 0) { p._healBuff = 0; p._healBuffTimer = 0; }
    }

    // Tick player frozen (from enemy frost nova)
    if((p._frozenTimer||0) > 0) p._frozenTimer -= dt;

    // Tick superboost
    if((p._superboostTimer||0) > 0) p._superboostTimer = Math.max(0, p._superboostTimer - dt);

    // Tick radar reveal timers on all ships
    for(const _rs of [...(this.space?.enemies||[]), ...(this.space?.npcs||[]), ...(this.space?.fleetShips||[])]) {
      if((_rs._radarRevealedTimer||0) > 0) _rs._radarRevealedTimer = Math.max(0, _rs._radarRevealedTimer - dt);
    }

    // Tick mark timers on enemies and NPCs
    for(const _mk of [...(this.space?.enemies||[]), ...(this.space?.npcs||[])]) {
      if((_mk._markedTimer||0) > 0) { _mk._markedTimer = Math.max(0, _mk._markedTimer - dt); if(_mk._markedTimer <= 0) _mk._marked = false; }
    }

    // Update repair drones
    if(this.space?.repairDrones?.length) {
      const _friendlies = [p, ...(this.space.fleetShips||[]),
        ...(this.space.npcs||[]).filter(n=>!n.hostile&&!n.dead&&!n._deathDone)];
      for(let _di = this.space.repairDrones.length - 1; _di >= 0; _di--) {
        const _dr = this.space.repairDrones[_di];
        _dr.timer -= dt;
        _dr.spinAngle = (_dr.spinAngle || 0) + dt * 2.5;
        if(_dr.timer <= 0) { this.space.repairDrones.splice(_di, 1); continue; }
        // Follow owner ship
        const _dTarget = _dr.followShip;
        const _ddx = _dTarget.x - _dr.x, _ddy = _dTarget.y - _dr.y;
        const _ddist = Math.hypot(_ddx, _ddy);
        const _dOffset = 40;
        if(_ddist > _dOffset + 5) {
          const _dSpd = Math.min(_ddist - _dOffset, 180) * dt;
          _dr.x += (_ddx / _ddist) * _dSpd;
          _dr.y += (_ddy / _ddist) * _dSpd;
        }
        // Heal tick every 0.4s
        _dr.healTimer -= dt;
        if(_dr.healTimer <= 0) {
          _dr.healTimer = 0.4;
          for(const _fr of _friendlies) {
            if(_fr.dead || _fr._deathDone) continue;
            if(Math.hypot(_fr.x - _dr.x, _fr.y - _dr.y) <= _dr.range) {
              _fr.hull = Math.min(_fr.maxHull, _fr.hull + 3);
            }
          }
        }
      }
    }

    // M: toggle galaxy map
    if(this.input.pressed('KeyM')) {
      if(this.state==='space') this.openGalaxy();
      else if(this.state==='galaxy') this.closeGalaxy();
    }

    // Jump departure update (ship streaking off screen)
    if(this._jumpDeparting) { this._updateJumpDeparture(dt); return; }

    // Hyperspace arrival: hard-brake from very high speed then shockwave
    if(this._arrivalBraking) {
      const spd = Math.hypot(p.vx, p.vy);
      if(spd < 60) {
        p.vx = 0; p.vy = 0;
        this._arrivalBraking = false;
        this.particles.shockwave(p.x, p.y);
      } else {
        const decel = spd * 6 * dt;
        p.vx -= (p.vx / spd) * decel;
        p.vy -= (p.vy / spd) * decel;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        this.camX = G.lerp(this.camX, p.x - G.CANVAS_W/2, Math.min(dt*8,1));
        this.camY = G.lerp(this.camY, p.y - G.CANVAS_H/2, Math.min(dt*8,1));
      }
      return;
    }

    // Jump cooldown countdown
    if(this._jumpCooldown > 0) this._jumpCooldown -= dt;

    // J: hold to jump to next system in route (when in space)
    if(!p.disabled && p.canJump && this.galaxy.jumpRoute.length > 0) {
      const nextSysId = this.galaxy.jumpRoute[0];
      if(this.galaxy.canJumpTo(nextSysId)) {
        if(this.input.is('KeyJ')) {
          // Steer ship toward the jump destination while charging
          const curSys  = G.SYSTEMS.find(s=>s.id===this.currentSysId);
          const nextSys = G.SYSTEMS.find(s=>s.id===nextSysId);
          let jumpAngle = 0;
          if(curSys && nextSys) {
            const dx = nextSys.pos[0]-curSys.pos[0], dy = nextSys.pos[1]-curSys.pos[1];
            jumpAngle = Math.atan2(dx, -dy);
            const diff = G.wrapAngle(jumpAngle - p.angle);
            p.angle += G.clamp(diff, -p.turnSpeed*dt, p.turnSpeed*dt);
          }
          // Fleet ships also charge for jump — steer toward jump direction
          for(const fs of this.space.fleetShips||[]) {
            if(fs.dead || fs.disabled || fs._released) continue;
            const fsDiff = G.wrapAngle(jumpAngle - fs.angle);
            fs.angle += G.clamp(fsDiff * 5, -fs.turnSpeed, fs.turnSpeed) * dt;
            fs._chargingJump = true;
          }
          this._updateJumpChargeTo(nextSysId, dt);
        } else {
          if(this._jumpChargeT > 0) G.sound.stopJumpCharge();
          this._jumpChargeT = Math.max(0, this._jumpChargeT - dt*2);
        }
      } else {
        // First hop no longer reachable — clear route
        this.galaxy.clearRoute();
        this.ui.addMsg('Jump route invalidated.','#ff4444');
      }
    } else if(this._jumpChargeT > 0) {
      G.sound.stopJumpCharge();
      this._jumpChargeT = Math.max(0, this._jumpChargeT - dt*2);
    }

    // I: inventory
    if(this.input.pressed('KeyI')) {
      const inv=document.getElementById('inventory-overlay');
      if(inv.classList.contains('hidden')) this.ui.showInventory();
      else this.ui.hideInventory();
    }

    // N: mission log
    if(this.input.pressed('KeyN')) {
      const log=document.getElementById('mission-log-overlay');
      if(log?.classList.contains('hidden')) this.ui.showMissionLog();
      else this.ui.hideMissionLog();
    }

    // C: character screen (or close skill tree if open)
    if(this.input.pressed('KeyC')) {
      const st=document.getElementById('skill-tree-overlay');
      if(st && !st.classList.contains('hidden')) { this.ui.hideSkillTree(); }
      else {
        const cs=document.getElementById('char-screen-overlay');
        if(cs?.classList.contains('hidden')) this.ui.showCharScreen();
        else this.ui.hideCharScreen();
      }
    }

    // T: next target  Y: prev target  R: nearest target
    if(this.input.pressed('KeyT')) this._cycleTarget(1);
    if(this.input.pressed('KeyY')) this._cycleTarget(-1);
    if(this.input.pressed('KeyR')) this._targetNearest();

    // P: toggle autopilot (auto-aim toward target)
    if(this.input.pressed('KeyP')) {
      this._autopilot = !this._autopilot;
      this.ui.addMsg(this._autopilot ? 'Autopilot ON — pointing toward target.' : 'Autopilot OFF.', '#00ffee');
    }
    if(this._autopilot && !p.disabled && this.target && !this.target.dead) {
      this._autoAimIntercept(dt);
    } else if(this._autopilot && !this.target) {
      this._autopilot = false;
    }

    // Auto-clear targeted missiles that have left the projectile list
    if(this.target?.type === 'missile' && !this.space.projectiles.includes(this.target)) {
      this.target = null;
    }

    // V: comms with any targeted entity (ships or planets)
    if(this.input.pressed('KeyV')) {
      if(this.target && (!this.target.dead || this.target.type==='planet' || this.target.type==='station')) {
        this.ui.openComms(this.target);
      }
    }

    // Optical target lock-on — only active after optical_target_lock ability is used
    this._lockT ??= 0; this._locked ??= false; this._lockBeepT ??= 0;
    if(this._missileLocking) {
      if(!this._lockTarget || this._lockTarget.dead) {
        // Target lost while locking
        this._missileLocking = false;
        this._lockTarget = null;
        this._lockT = 0;
        this._lockBeepT = 0;
        this.ui.addMsg('Optical lock lost — target gone', '#ff8800');
      } else {
        this._lockT = Math.min(this._lockT + dt, 3.0);
        if(this._lockT >= 3.0) {
          this._locked = true;
          this._missileLocking = false;
          G.sound?.missileLockOn?.();
          this.ui.updateAbilityBar(p);
        }
        this._lockBeepT -= dt;
        if(this._lockBeepT <= 0) {
          const progress = this._lockT / 3.0;
          this._lockBeepT = 0.8 - progress * 0.65;
          G.sound?.missileBeep?.();
        }
      }
    }
    // If locked but target gone → cancel lock (abilities stay, they're permanent)
    if(this._locked && (!this._lockTarget || this._lockTarget.dead)) {
      G.sound?.missileLockOff?.();
      this._locked = false; this._lockTarget = null; this._lockT = 0;
    }

    // Frozen player: suppress controls, decelerate
    if((p._frozenTimer||0) > 0) {
      p.vx *= 0.85; p.vy *= 0.85;
      p.x += p.vx*dt; p.y += p.vy*dt;
    } else {
      p.update(dt, this.input);
    }

    // Per-thruster engine trails — one plume per active thruster module
    if(!p.disabled) {
      G.ui?._ensureBuilderCells?.(p);
      const tCa=Math.cos(p.angle), tSa=Math.sin(p.angle);
      const _sb = (p._superboostTimer||0) > 0;
      const _rainbow = this.input.boost && (_sb || (p.energy>5 && p.boostCharge>0));
      for(const inst of Object.values(p.modules||{})) {
        if(inst.q==null) continue;
        const mod=G.MODULES[inst.moduleId];
        if(!mod||mod.slot!=='thruster') continue;
        const rot=(inst.rot||0)%4;
        const active=(rot===0&&this.input.thrust)||(rot===1&&this.input.strafeR)||
                     (rot===2&&this.input.reverse)||(rot===3&&this.input.strafeL)||_rainbow;
        if(!active||Math.random()>=0.5) continue;
        const _hp=G.hexToPixel(inst.q,inst.r,G.HEX_R);
        const dx=_hp.x, dy=_hp.y;
        const wx=p.x + dx*tCa - dy*tSa;
        const wy=p.y + dx*tSa + dy*tCa;
        this.particles.engine_trail(wx,wy,p.angle+rot*Math.PI/2,p.vx,p.vy,1,_rainbow);
      }
      if(!p.disabled && _rainbow) {
        if(Math.random()<0.7) this.particles.boost_trail(p.x,p.y,p.angle,1.2,_sb);
      }
    }

    // Turrets: rotate toward intercept point each frame; fire on SPACE
    if(!p.disabled) {
      const tgt = this.target;
      const MAX_ROT = 1.5 * Math.PI * dt; // 270°/sec rotation speed
      for(let i = 0; i < p.weaponSlots.length; i++) {
        const w = p.weaponSlots[i];
        const wDef = G.WEAPONS[w.weaponId];
        if(!wDef?.turret) continue;
        if(w._turretAngle == null) w._turretAngle = p.angle;
        // Rotate toward intercept point, or ship heading when no target
        {
          const desired = tgt
            ? (() => { const ip = this._interceptPoint(tgt, p, wDef.projSpeed || 800); return Math.atan2(ip.x - p.x, -(ip.y - p.y)); })()
            : p.angle;
          const diff = G.wrapAngle(desired - w._turretAngle);
          w._turretAngle = Math.abs(diff) <= MAX_ROT
            ? desired
            : G.wrapAngle(w._turretAngle + Math.sign(diff) * MAX_ROT);
        }
        // Fire on SPACE toward current turret facing
        if(this.input.fire) {
          const tx = p.x + Math.sin(w._turretAngle) * (wDef.range || 600);
          const ty = p.y - Math.cos(w._turretAngle) * (wDef.range || 600);
          const projs = p.fireWeapon(i, tx, ty);
          if(projs) {
            const arr = Array.isArray(projs) ? projs : [projs];
            arr.forEach(pr => {
              if(wDef.type === 'missile') {
                const _hasLock = this._locked && this._lockTarget && !this._lockTarget.dead && tgt === this._lockTarget;
                pr.tracking = _hasLock; pr.trackTarget = _hasLock ? tgt : null;
                pr.dormant = true; pr.dormantT = 0.35; pr.ttl += 0.35;
              }
              this.space.projectiles.push(pr);
            });
            G.sound?.weapon?.(wDef.type === 'missile' ? 'missile' : 'laser');
          }
        }
      }
    }

    // Space: fire all non-turret, non-missile weapons
    if(this.input.fire && !p.disabled) {
      const aim = this.target ? this._interceptPoint(this.target, p) : null;
      const tx = aim?.x ?? this.target?.x, ty = aim?.y ?? this.target?.y;
      for(let wIdx = 0; wIdx < p.weaponSlots.length; wIdx++) {
        const wDef = p.weaponSlots[wIdx] ? G.WEAPONS[p.weaponSlots[wIdx].weaponId] : null;
        if(!wDef || wDef.turret || wDef.type === 'missile') continue;
        const projs = p.fireWeapon(wIdx, tx, ty);
        if(projs) {
          const arr = Array.isArray(projs) ? projs : [projs];
          arr.forEach(pr => this.space.projectiles.push(pr));
          G.sound.weapon(wDef.type);
        }
      }
    }

    this.space.update(dt,p,this.input,this.particles,now);

    // Hostile alert sound — fire once when hostiles appear
    const hostileCount =
      this.space.enemies.filter(e=>!e.dead&&!e._deathDone&&!e.boarded&&!e.disabled).length +
      this.space.npcs.filter(n=>!n.dead&&!n._deathDone&&n.hostile&&!n.disabled).length;
    if(hostileCount > 0 && this._prevHostileCount === 0) G.sound.hostileAlert();
    this._prevHostileCount = hostileCount;

    // Out-of-energy warning — fires once per depletion event
    if(p.energy <= 2 && !this._outOfEnergyFired) {
      G.sound.outOfEnergy?.();
      this._outOfEnergyFired = true;
    }
    if(p.energy > 10) this._outOfEnergyFired = false;

    // Count kills + bounty check
    for(const e of this.space.enemies) {
      if(e.dead&&!e._killCounted) {
        e._killCounted=true; this.kills++;
        this._addXP(20);
        this.economy.checkBounty(e.faction, this.currentSysId);
        this.setRel(e.faction, this.getRel(e.faction)+3, 'enemy ship destroyed');
      }
    }

    // Camera follow with lead-ahead
    const _spd = Math.sqrt(p.vx*p.vx + p.vy*p.vy);
    const _leadFrac = G.clamp((_spd - 100) / 400, 0, 1);
    const _tLeadX = _leadFrac * 180 * (_spd > 0 ? p.vx / _spd : 0);
    const _tLeadY = _leadFrac * 180 * (_spd > 0 ? p.vy / _spd : 0);
    this._camLeadX = G.lerp(this._camLeadX, _tLeadX, Math.min(dt * 2.5, 1));
    this._camLeadY = G.lerp(this._camLeadY, _tLeadY, Math.min(dt * 2.5, 1));

    // Follow escape pod if ejected
    const _followTarget = this._escapePodFollowing || p;
    this.camX=G.lerp(this.camX, _followTarget.x-G.CANVAS_W/2+this._camLeadX, Math.min(dt*6,1));
    this.camY=G.lerp(this.camY, _followTarget.y-G.CANVAS_H/2+this._camLeadY, Math.min(dt*6,1));
    // Mouse-wheel manual zoom offset
    const _zoomTarget = G.clamp(1.0 + (this._zoomManual || 0), 0.2875, 4.04);
    // Arrival zoom: briefly over-zoomed so camera zooms in after a jump
    const _arrivalBoost = (this._arrivalZoomT || 0) * 0.9;
    this._arrivalZoomT = Math.max(0, (this._arrivalZoomT || 0) - dt * 0.9);
    this.camZoom = G.lerp(this.camZoom, _zoomTarget + _arrivalBoost, Math.min(dt * 3.2, 1));
    G.sound?.setZoomFactor(this.camZoom);

    // Interact prompts
    const nearPort=this.space.nearestSpaceport(p.x,p.y,80);
    if(nearPort) {
      const _pFac = nearPort.faction;
      const _landHostile = _pFac && _pFac !== 'neutral' && _pFac !== 'contested' && this.getRel(_pFac) < -30;
      if(_landHostile) {
        const _facName = G.FACTIONS[_pFac]?.name || _pFac;
        this._interactPromptText = 'HOSTILE TO '+_facName.toUpperCase()+' — LANDING DENIED';
        this._interactPromptTarget = nearPort;
        this.ui.setInteractPrompt(this._interactPromptText);
      } else {
        this._interactPromptText = '[L] Land at '+nearPort.name;
        this._interactPromptTarget = nearPort;
        this.ui.setInteractPrompt(this._interactPromptText);
        if(this.input.pressed('KeyL')) { G.sound.land(); this.land(nearPort); return; }
      }
    } else {
      const nearDis=this.space.enemies.find(e=>e.disabled&&!e.boarded&&G.v2.dist(p,e)<80);
      if(nearDis) {
        this._interactPromptText = '[L] Board disabled ship';
        this._interactPromptTarget = nearDis;
        this.ui.setInteractPrompt(this._interactPromptText);
        if(this.input.pressed('KeyL')) {
          this.ui.showBoardingPopup(nearDis);
          this.paused = true;
        }
      } else {
        const nearDer=this.space.derelicts.find(d=>!d.looted&&G.v2.dist(p,d)<80);
        if(nearDer) {
          this._interactPromptText = '[L] Board derelict';
          this._interactPromptTarget = nearDer;
          this.ui.setInteractPrompt(this._interactPromptText);
          if(this.input.pressed('KeyL')) {
            this.ui.showBoardingPopup(nearDer);
            this.paused = true;
          }
        } else {
          this._interactPromptText = null;
          this._interactPromptTarget = null;
          this.ui.setInteractPrompt(null);
        }
      }
    }

    if(p.disabled && !this._playerDisabledMsgShown) {
      this._playerDisabledMsgShown = true;
      this.ui.addMsg('Ship disabled! Hull integrity lost.', '#ff6644');
      this.ui.showDisabledShipPopup();
    }
    if(!p.disabled) { this._playerDisabledMsgShown = false; p._disabledSoundPlayed = false; p._postDisableDmg = 0; }
    if(p.disabled && (p._postDisableDmg||0) >= p.disabledHp) this._playerDied();
    if(this.target&&(this.target.dead||this.target.boarded)) this.target=null;

    this._updateCrewPositions(dt, p);
  }

  _updateCrewPositions(dt, ship) {
    if(!ship?.crew?.length) return;
    // Crew walk between inner-module hexes, in unit hex-pixel space (size 1).
    const occupied = [], broken = [];
    let core = null;
    for(const [, inst] of Object.entries(ship.modules)) {
      if(inst.q == null) continue;
      const mod = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
      if(mod?.slot === 'hull') continue;
      const u = G.hexToPixel(inst.q, inst.r, 1);
      occupied.push([u.x, u.y]);
      if(mod?.slot === 'core' || mod?.slot === 'cockpit') core = [u.x, u.y];
      if(inst.broken) broken.push([u.x, u.y]);
    }
    if(!occupied.length) return;
    if(!core) core = occupied[0];
    const flying = this.state === 'space';
    for(const c of ship.crew) {
      const st = G.CrewAnim.get(c.id, core[0], core[1]);
      const dx = st.tx - st.gx, dy = st.ty - st.gy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if(dist > 0.05) {
        const mv = Math.min(1.6 * dt, dist);
        st.gx += (dx / dist) * mv;
        st.gy += (dy / dist) * mv;
        st.frameTimer -= dt;
        if(st.frameTimer <= 0) { st.frameTimer = 0.2; st.walkFrame ^= 1; }
      } else {
        st.gx = st.tx; st.gy = st.ty;
        st.idleTimer -= dt;
        if(st.idleTimer <= 0) {
          let tgt;
          if(c.role === 'pilot' && flying) {
            tgt = core; st.idleTimer = 6 + Math.random() * 6;
          } else if(c.role === 'engineer' && broken.length) {
            tgt = broken[(Math.random() * broken.length) | 0]; st.idleTimer = 2 + Math.random() * 4;
          } else {
            tgt = occupied[(Math.random() * occupied.length) | 0]; st.idleTimer = 1.5 + Math.random() * 3;
          }
          [st.tx, st.ty] = tgt;
        }
      }
    }
    G.CrewAnim.prune(new Set(ship.crew.map(c => c.id)));
  }

  _updateJumpChargeTo(sysId, dt) {
    if(this._jumpCooldown > 0) {
      const remaining = Math.ceil(this._jumpCooldown);
      if(this.input.pressed('KeyJ')) this.ui.addMsg('Jump cooling down: '+remaining+'s','#556677');
      this._jumpChargeT = 0;
      return;
    }
    if(!this.player.canJump) { this.ui.addMsg('No jump drive!','#ff4444'); return; }
    const fuelCost = this.player.jumpFuelCost < 99 ? this.player.jumpFuelCost : 10;
    if(this.player.fuel < fuelCost) { this.ui.addMsg('Not enough fuel!','#ff4444'); return; }

    const chargeTime = this.player.jumpChargeTime < 99 ? this.player.jumpChargeTime : 5.0;
    this._jumpChargeT += dt;
    G.sound.jumpCharge(this._jumpChargeT / chargeTime);
    if(this._jumpChargeT >= chargeTime) {
      this._jumpChargeT = 0;
      this.doHyperspace(sysId, fuelCost);
    }
  }

  doHyperspace(targetSysId, fuelCost) {
    const cost = fuelCost ?? (this.player.jumpFuelCost < 99 ? this.player.jumpFuelCost : 10);
    this.player.fuel = Math.max(0, this.player.fuel - cost);
    this.hyperspaceTarget = targetSysId;
    this.state = 'space'; // always ensure we're in space state after jump

    const cur = G.SYSTEMS.find(s=>s.id===this.currentSysId);
    const tgt = G.SYSTEMS.find(s=>s.id===targetSysId);
    if(cur&&tgt) {
      const dx=tgt.pos[0]-cur.pos[0], dy=tgt.pos[1]-cur.pos[1];
      const d=Math.sqrt(dx*dx+dy*dy)||1;
      this.player.vx = dx/d * 9000;
      this.player.vy = dy/d * 9000;
    }
    this.particles.warp_effect(this.player.x, this.player.y);
    G.sound.hyperspace();
    // Fleet ships jump out in formation
    for(const fs of this.space.fleetShips||[]) {
      if(fs.dead || fs.disabled || fs._released) continue;
      fs._chargingJump = false;
      fs.jumpingOut = true;
      fs.jumpOutTimer = 0.55 + Math.random()*0.2;
      fs.vx = Math.sin(fs.angle)*6000;
      fs.vy = -Math.cos(fs.angle)*6000;
      this.particles.warp_effect(fs.x, fs.y);
    }
    this._jumpDeparting   = true;
    this._jumpDepartTimer = 0.7;
    this._flashFrames     = 0;
    this._jumpChargeT     = 0;
    this.ui.els['galaxy-overlay']?.classList.add('hidden');
    this.ui.setInteractPrompt(null);
  }

  // Compute the intercept position to pass as a fire target, accounting for target velocity
  _interceptPoint(target, shooter, projSpdOverride) {
    const wpn = shooter.weaponSlots[shooter.activeWeapon];
    const projSpd = projSpdOverride ?? (wpn ? (G.WEAPONS[wpn.weaponId]?.projSpeed || 800) : 800);
    const dx = target.x - shooter.x, dy = target.y - shooter.y;
    const tvx = target.vx || 0, tvy = target.vy || 0;
    const a = tvx*tvx + tvy*tvy - projSpd*projSpd;
    const b = 2*(dx*tvx + dy*tvy);
    const c = dx*dx + dy*dy;
    let t = 0;
    if(Math.abs(a) < 1) {
      t = b !== 0 ? -c/b : 0;
    } else {
      const disc = b*b - 4*a*c;
      if(disc >= 0) {
        const t1 = (-b - Math.sqrt(disc))/(2*a);
        const t2 = (-b + Math.sqrt(disc))/(2*a);
        t = t1 > 0 ? t1 : (t2 > 0 ? t2 : 0);
      }
    }
    t = Math.max(0, Math.min(t, 3));
    return { x: target.x + tvx*t, y: target.y + tvy*t };
  }

  _autoAimIntercept(dt) {
    const p = this.player, t = this.target;
    if(!p || !t) return;

    // Compute intercept point: where to aim to hit a moving target
    const wpn = p.weaponSlots[p.activeWeapon];
    const projSpd = wpn ? (G.WEAPONS[wpn.weaponId]?.projSpeed || 800) : 800;

    const dx = t.x - p.x, dy = t.y - p.y;
    const tvx = t.vx || 0, tvy = t.vy || 0;

    // Solve quadratic: |dx + tvx*t|^2 = (projSpd*t)^2
    const a = tvx*tvx + tvy*tvy - projSpd*projSpd;
    const b = 2*(dx*tvx + dy*tvy);
    const c = dx*dx + dy*dy;
    let interceptT = 0;
    if(Math.abs(a) < 1) {
      interceptT = -c/b;
    } else {
      const disc = b*b - 4*a*c;
      if(disc >= 0) {
        const t1 = (-b - Math.sqrt(disc))/(2*a);
        const t2 = (-b + Math.sqrt(disc))/(2*a);
        interceptT = t1 > 0 ? t1 : (t2 > 0 ? t2 : 0);
      }
    }
    interceptT = Math.max(0, Math.min(interceptT, 3));

    const ix = dx + tvx * interceptT;
    const iy = dy + tvy * interceptT;
    const targetAngle = Math.atan2(ix, -iy);
    const angleDiff   = G.wrapAngle(targetAngle - p.angle);

    p.angle += G.clamp(angleDiff, -p.turnSpeed*dt, p.turnSpeed*dt);
  }

  _cycleTarget(dir=1) {
    const all = this.space.allTargets().filter(t => {
      if(t._inDust) return false;
      if(this.space.turrets.includes(t)) return t.hostile;
      return true;
    });
    if(!all.length){ this.target=null; return; }
    if(!this.target){ this.target = dir>0?all[0]:all[all.length-1]; G.sound.targetLock(); return; }
    const idx = all.indexOf(this.target);
    const next = all[((idx+dir)+all.length)%all.length];
    if(next !== this.target) { this.target = next; G.sound.targetLock(); }
  }

  _targetNearest() {
    const prev = this.target;
    this.target = this.space.nearestTarget(this.player.x, this.player.y);
    if(this.target && this.target !== prev) G.sound.targetLock();
  }

  land(spaceport) {
    if(this.state==='landing') return;
    this.state='landing';
    this._landFade=0;
    this._landPending=spaceport;
    this._hideHUD();
    this.ui.setInteractPrompt('');
  }

  launch() {
    if(this.player && !this.player.flyable){
      const _hc = Object.values(this.player.modules).some(i => { const m = G.MODULES[i.moduleId]; return m?.slot==='cockpit'; });
      const _hm = Object.values(this.player.modules).some(i => { const m = G.MODULES[i.moduleId]; return m?.slot==='core'; });
      const reason = !_hc ? 'Missing cockpit' : !_hm ? 'Missing class core module' : 'Hull not enclosed — add hull panels around all modules';
      this.ui.addMsg(reason+' — check Ship Builder.','#ff4444');
      return;
    }
    this.state='launching';
    this._landFade=1;
    this.camZoom=1.35;
    G.sound.launch();
    this.ui.hideSpaceport();
    this.ui.addMsg('Launching...','#00ffee');
    this._showHUD();
  }

  openGalaxy() {
    if(!this.player.canJump){ this.ui.addMsg('No hyperspace drive installed!','#ff4444'); return; }
    this.state='galaxy';
    G.sound.mapOpen();
    this.ui.els['galaxy-overlay']?.classList.remove('hidden');
    this.galaxy.selected=null; this._jumpChargeT=0;
    this.galaxy.draw(this.currentSysId);
    this.ui.updateFactionPanel();
  }

  closeGalaxy() {
    this.state='space';
    this._jumpChargeT=0;
    this.ui.els['galaxy-overlay']?.classList.add('hidden');
    document.getElementById('minimap-wrap')?.classList.remove('hidden');
  }

  ejectEscapePods() {
    const _pp = this.player;
    if(!_pp || (_pp.escapePods||0) <= 0 || !this.space) return;
    const _podMods = Object.values(_pp.modules||{}).filter(m=>m.moduleId==='escape_pod'&&!m.broken);
    const _podCount = Math.min(_pp.escapePods, _podMods.length||1);
    let _firstPod = null;
    for(let _pi=0;_pi<_podCount;_pi++) {
      const _inst = _podMods[_pi];
      let _px=_pp.x, _py=_pp.y;
      if(_inst?.q!=null) {
        const _hp=G.hexToPixel(_inst.q,_inst.r,G.HEX_R);
        const ca=Math.cos(_pp.angle),sa=Math.sin(_pp.angle);
        _px=_pp.x+_hp.x*ca-_hp.y*sa; _py=_pp.y+_hp.x*sa+_hp.y*ca;
      }
      const _ejectAngle=Math.atan2(_py-_pp.y,_px-_pp.x)+(Math.random()-0.5)*1.2;
      const _speed=180+Math.random()*120;
      const _pod = {
        x:_px,y:_py,
        vx:_pp.vx+Math.cos(_ejectAngle)*_speed,
        vy:_pp.vy+Math.sin(_ejectAngle)*_speed,
        angle:Math.random()*Math.PI*2,
        rotSpeed:(Math.random()-0.5)*3,
        timer:10+Math.random()*5,
      };
      this.space.escapePodEntities.push(_pod);
      if(_pi === 0) _firstPod = _pod;
    }
    _pp.escapePods = 0;
    this._escapePodFollowing = _firstPod;
    this.ui.addMsg('All pods ejected! Following first pod...', '#ff6644');
    setTimeout(() => {
      this._triggerShipExplosion();
    }, 800);
  }

  _triggerShipExplosion() {
    const _pp = this.player;
    if(!_pp || _pp.dead) return;
    _pp.dead = true;
    _pp._deathDone = true;
    this._playerDied();
  }

  _podLanded(_pod) {
    const p = this.player;
    if(!p || !_pod || !this.space) return;
    let _nearPort = null, _nearDist = Infinity;
    for(const b of this.space.bodies) {
      if(!b.hasSpaceport) continue;
      const _d = Math.hypot(b.x - _pod.x, b.y - _pod.y);
      if(_d < _nearDist) { _nearDist = _d; _nearPort = b; }
    }
    if(_nearPort) {
      p.x = _nearPort.x; p.y = _nearPort.y; p.vx = 0; p.vy = 0;
      p.hull = Math.max(1, Math.floor((p.maxHull||100) * 0.15));
      p.shields = 0; p.disabled = false;
      p._dyingTimer = null; p._dyingInitialized = false; p._deathDone = false;
      this._playerDyingStarted = false;
      this._escapePodFollowing = null;
      this._showHUD();
      this.state = 'space';
      this.ui.addMsg('Emergency systems restored. Escape pod recovered at ' + _nearPort.name, '#44ff88');
      this.land(_nearPort);
    } else {
      this.ui.showGameOver({credits: this.credits, visited: this.galaxy.visited.size, kills: this.kills, time: Math.floor((Date.now()-this.startTime)/1000)});
    }
  }

  _playerDied() {
    if(this._playerDyingStarted) return;
    this._playerDyingStarted = true;
    G.sound?.missileLockOff?.();
    this._locked = false; this._lockTarget = null; this._lockT = 0; this._missileLocking = false;
    this.state = 'dead';
    this.addCombatLog('YOUR SHIP DESTROYED', '#ff4444');
    this._playerDyingTimer     = 2.5;
    this._playerDyingInitTimer = 2.5;
    this._playerDyingNextBang  = 0.15;
    this._hideHUD();
    this.ejectEscapePods();
  }

  // Can this object be read by the Scan ability?
  _isScannable(t) {
    return t && !t.dead && !t._deathDone &&
      (t.type==='enemy' || t.type==='npc' || t.type==='derelict' || t.isFleetShip);
  }
  _useAbility(abilityId, ship) {
    const def = G.ABILITIES?.[abilityId];
    if(!def) return;
    // Scan needs a locked ship — check before spending energy/cooldown.
    if(abilityId === 'scan' && !(ship === this.player && this._isScannable(this.target))) {
      this.ui.addMsg('Scan: lock onto a ship first', '#ffaa44');
      return;
    }
    ship.abilityCooldowns = ship.abilityCooldowns || {};
    if((ship.abilityCooldowns[abilityId]||0) > 0) {
      const rem = Math.ceil(ship.abilityCooldowns[abilityId]);
      this.ui.addMsg(def.name+' — '+rem+'s cooldown', '#556677');
      return;
    }
    if(ship.energy < (def.energyCost||0)) {
      this.ui.addMsg('Not enough energy for '+def.name+'!', '#ff4444');
      return;
    }
    ship.energy -= (def.energyCost||0);
    ship.abilityCooldowns[abilityId] = def.cooldown;

    const px = ship.x, py = ship.y;
    const range = def.range || 300;

    if(abilityId === 'frost_nova') {
      this.particles.frost_nova(px, py, range);
      G.sound?.abilityFrost?.();
      for(const e of this.space.enemies) {
        if(e.dead || e._deathDone || e.disabled) continue;
        if(Math.hypot(e.x-px, e.y-py) <= range) { e._frozen=true; e._frozenTimer=2.0; }
      }
      for(const n of this.space.npcs) {
        if(n.dead || n._deathDone || n.disabled || !n.hostile) continue;
        if(Math.hypot(n.x-px, n.y-py) <= range) { n._frozen=true; n._frozenTimer=2.0; }
      }
      this.addCombatLog('Frost Nova!', '#88ddff');

    } else if(abilityId === 'healing_nova') {
      this.particles.healing_nova(px, py, range);
      G.sound?.abilityHeal?.();
      ship._healBuff = 6; ship._healBuffTimer = 5.0;
      if(ship === this.player) this._addXP(10);
      for(const n of this.space.npcs) {
        if(n.dead || n._deathDone || n.hostile || n.disabled) continue;
        if(Math.hypot(n.x-px, n.y-py) <= range) { n._healBuff=6; n._healBuffTimer=5.0; }
      }
      this.addCombatLog('Healing Nova!', '#44ff88');

    } else if(abilityId === 'chaff') {
      this.space.chaffBalls = this.space.chaffBalls || [];
      for(let _bi=0; _bi<10; _bi++) {
        setTimeout(() => {
          if(!this.player || this.player.dead) return;
          const angle = Math.random() * Math.PI * 2;
          const spd = 100 + Math.random() * 150;
          this.space.chaffBalls.push({
            x: this.player.x, y: this.player.y,
            vx: this.player.vx + Math.cos(angle) * spd,
            vy: this.player.vy + Math.sin(angle) * spd,
            timer: 1.0, r: range,
          });
        }, _bi * 100);
      }
      if(this._locked || this._missileLocking) {
        G.sound?.missileLockOff?.();
        this._locked = false; this._missileLocking = false; this._lockT = 0; this._lockTarget = null;
      }
      this.addCombatLog('Chaff launched ×10!', '#ffcc44');

    } else if(abilityId === 'quantum_brake') {
      this.particles.quantum_brake(px, py);
      G.sound?.abilityBrake?.();
      ship.vx=0; ship.vy=0;
      this.addCombatLog('Quantum Brake!', '#aa88ff');

    } else if(abilityId === 'superboost') {
      ship._superboostTimer = 5.0;
      G.sound?.boost?.();
      this.addCombatLog('Superboost!', '#00ff88');

    } else if(abilityId === 'scan') {
      const tgt = this.target;
      tgt._scanned = true;
      G.sound?.targetLock?.();
      const nm = tgt.name || G.SHIPS[tgt.templateId||tgt.shapeId]?.name || 'target';
      this.ui.addMsg('Scan complete — '+nm, '#44ddff');
      this.addCombatLog('Scanned '+nm, '#44ddff');

    } else if(abilityId === 'radar_scan') {
      this.particles.radar_pulse(px, py, range);
      G.sound?.targetLock?.();
      let revealed = 0;
      const _rsTargets = [...this.space.enemies, ...this.space.npcs, ...(this.space.fleetShips||[])];
      for(const s of _rsTargets) {
        if(s.dead || s._deathDone) continue;
        if(Math.hypot(s.x - px, s.y - py) <= range) {
          s._radarRevealedTimer = 30;
          revealed++;
        }
      }
      this.addCombatLog(`Radar Scan — ${revealed} contact${revealed !== 1 ? 's' : ''} detected`, '#33aaff');

    } else if(abilityId === 'optical_target_lock') {
      if(this._missileLocking || this._locked) {
        G.sound?.missileLockOff?.();
        this._locked = false; this._missileLocking = false; this._lockT = 0; this._lockTarget = null;
        ship.abilityCooldowns['optical_target_lock'] = 0;
        this.addCombatLog('Optical lock cancelled', '#ff8800');
        return;
      }
      if(!this.target || this.target.dead) {
        this.ui.addMsg('Optical Target Lock: no target selected', '#ff8800');
        ship.abilityCooldowns['optical_target_lock'] = 0;
        return;
      }
      this._missileLocking = true;
      this._lockT = 0;
      this._locked = false;
      this._lockTarget = this.target;
      this._lockBeepT = 0;
      this.addCombatLog('Optical lock initiated...', '#ff8800');

    } else if(abilityId === 'invulnerability') {
      ship._invulTimer = 3.0;
      this.addCombatLog('Invulnerable — 3s!', '#ffcc00');

    } else if(abilityId === 'repair_drone') {
      this.space.repairDrones = this.space.repairDrones || [];
      this.space.repairDrones.push({ x: px, y: py, followShip: ship, timer: 10, healTimer: 0, range: def.range, spinAngle: 0 });
      if(ship === this.player) this._addXP(10);
      this.addCombatLog('Repair Drone deployed!', '#bb88ff');

    } else if(abilityId === 'stim') {
      ship._stimTimer = 10.0;
      this.addCombatLog('Stim active — 10s!', '#4488ff');

    } else if(abilityId === 'mark_target') {
      const _mt = this.target;
      if(!_mt || _mt.dead) {
        this.ui.addMsg('Mark Target: no target selected', '#ff8844');
        ship.abilityCooldowns['mark_target'] = 0;
        return;
      }
      _mt._marked = true; _mt._markedTimer = 10;
      this.addCombatLog('Target marked — 10s!', '#ff8844');

    } else if(abilityId === 'missile_launch') {
      const _tgt = this.target;
      if(!_tgt || _tgt.dead) {
        this.ui.addMsg('Missile Launch: no target selected', '#ff4400');
        ship.abilityCooldowns['missile_launch'] = 0;
        return;
      }
      const _isGuided = this._locked && this._lockTarget && !this._lockTarget.dead && this._lockTarget === _tgt;
      const aim = this._interceptPoint(_tgt, ship);
      const tx = aim?.x ?? _tgt.x, ty = aim?.y ?? _tgt.y;
      let launchCd = 0;
      let fired = false;
      for(let wIdx = 0; wIdx < ship.weaponSlots.length; wIdx++) {
        const wDef = ship.weaponSlots[wIdx] ? G.WEAPONS[ship.weaponSlots[wIdx].weaponId] : null;
        if(!wDef || wDef.type !== 'missile') continue;
        const projs = ship.fireWeapon(wIdx, tx, ty);
        if(projs) {
          const arr = Array.isArray(projs) ? projs : [projs];
          arr.forEach(pr => {
            pr.dormant = true; pr.dormantT = 2.0; pr.ttl += 2.0;
            pr.tracking = _isGuided; pr.trackTarget = _isGuided ? _tgt : null;
            pr.angle = ship.angle; pr.vx = ship.vx; pr.vy = ship.vy;
            this.space.projectiles.push(pr);
          });
          G.sound.weapon(wDef.type);
          fired = true;
          launchCd = Math.max(launchCd, 1.0 / (wDef.fireRate || 0.45));
        }
      }
      if(fired) {
        ship.abilityCooldowns['missile_launch'] = launchCd;
        this.addCombatLog(_isGuided ? 'Guided missile launched!' : 'Dumb-fire missile!', '#ff4400');
      } else {
        this.ui.addMsg('No missile weapons ready', '#ff4400');
        ship.abilityCooldowns['missile_launch'] = 0;
      }
    }
    this.ui.updateAbilityBar(ship);
  }

  _updateDyingPlayer(dt) {
    const p = this.player;
    if(!p) return;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.98; p.vy *= 0.98;
    p.angle += 0.4 * dt;

    this._playerDyingTimer    -= dt;
    this._playerDyingNextBang -= dt;

    if(this._playerDyingNextBang <= 0) {
      const ox = (Math.random()-0.5)*40, oy = (Math.random()-0.5)*40;
      this.particles.explosion(p.x+ox, p.y+oy, 0, 0, 0.55);
      G.sound.explosion();
      const prog = 1 - Math.max(0, this._playerDyingTimer) / this._playerDyingInitTimer;
      this._playerDyingNextBang = Math.max(0.07, 0.38 - prog*0.30);
    }

    if(this._playerDyingTimer <= 0) {
      this.particles.explosion(p.x, p.y, p.vx, p.vy, 2.5);
      G.sound.playerDeathExplosion();
      this._playerDyingTimer = 0;

      if((p.escapePods||0) > 0) {
        // Find nearest body with spaceport for escape pod landing
        let _nearPort=null, _nearDist=Infinity;
        for(const b of this.space.bodies) {
          if(!b.hasSpaceport) continue;
          const _d=Math.hypot(b.x-p.x,b.y-p.y);
          if(_d<_nearDist){_nearDist=_d;_nearPort=b;}
        }
        // Fallback: any body
        if(!_nearPort) {
          for(const b of this.space.bodies) {
            const _d=Math.hypot(b.x-p.x,b.y-p.y);
            if(_d<_nearDist){_nearDist=_d;_nearPort=b;}
          }
        }
        if(_nearPort) {
          // Restore player from escape pod arrival
          p.x=_nearPort.x; p.y=_nearPort.y; p.vx=0; p.vy=0;
          p.hull=Math.max(1,Math.floor((p.maxHull||100)*0.1));
          p.shields=0; p.disabled=false;
          p._dyingTimer=null; p._dyingInitialized=false; p._deathDone=false;
          this._playerDyingStarted=false;
          this._showHUD();
          this.state='space';
          const _survived=Math.min(p.escapePods,Math.max(1,p.crew?.length||1));
          // Surfaced as an STC popup once the spaceport opens (addMsg would be
          // hidden behind the overlay).
          this._podLanding = { survived:_survived, port:_nearPort.name };
          this.land(_nearPort);
        } else {
          // No body found — game over anyway
          const elapsed=Math.floor((Date.now()-this.startTime)/1000);
          this.ui.showGameOver({credits:this.credits,visited:this.galaxy.visited.size,kills:this.kills,time:elapsed});
        }
      } else {
        // No escape pod — character dies, game over
        const elapsed=Math.floor((Date.now()-this.startTime)/1000);
        // _playerDyingStarted stays true to prevent re-triggering while state='dead'
        this.ui.showGameOver({credits:this.credits,visited:this.galaxy.visited.size,kills:this.kills,time:elapsed});
      }
    }
  }

  addCombatLog(msg, color='#aabbcc') {
    G.ui?.addMsg(msg, color);
  }

  _spawnFleetShips() {
    if(!this.fleet?.length || !this.space) return;
    for(const entry of this.fleet) {
      const fs = new G.FleetShip(entry);
      const a = Math.random()*Math.PI*2;
      const r = 150 + Math.random()*100;
      fs.x = this.player.x + Math.cos(a)*r;
      fs.y = this.player.y + Math.sin(a)*r;
      this.space.fleetShips.push(fs);
    }
  }

  commandeerShip(enemy) {
    const playerSize = G.SHIPS[this.player.templateId]?.size || 1.0;
    const enemyHpScale = (enemy.maxHp || 120) / 120;
    const enemySize = (enemy.size || 1.0) * enemyHpScale;
    // Disabled ships have weakened crew — much easier to commandeer
    const baseChance = enemy.disabled ? 0.90 : 0.65;
    const chance = G.clamp(baseChance * playerSize / enemySize, 0.10, 0.95);

    if(Math.random() < chance) {
      if(this.fleet.length >= 5) {
        return { success: false, reason: 'Fleet at capacity (max 5)', chance };
      }
      const templateId = Object.keys(G.SHIPS).find(k=>G.SHIPS[k].shape===enemy.shapeId) || 'pirate_skiff';
      const capturedShip = new G.Ship(templateId);
      capturedShip.hull = Math.max(10, enemy.hp || 10);
      capturedShip._recompute();
      const facName = (enemy.faction||'enemy').toUpperCase();
      const shipName = templateId.replace(/_/g,' ').toUpperCase();
      const entry = {
        id: 'fleet_'+Date.now(),
        fleetName: facName+' '+shipName,
        ship: capturedShip,
        combatSpeed: enemy.speed || 280,
        combatTurnSpeed: enemy.turnSpeed || 2.0,
        combatDamage: enemy.damage || 15,
        combatFireRate: enemy.fireRate || 1.0,
        combatWeaponType: enemy.weaponType || 'laser',
        combatWeaponColor: enemy.projColor || '#ff8844',
      };
      this.fleet.push(entry);
      const fs = new G.FleetShip(entry);
      fs.x = enemy.x; fs.y = enemy.y;
      this.space.fleetShips.push(fs);
      enemy.boarded = true;
      this.setRel(enemy.faction, this.getRel(enemy.faction)-5, 'captured ship');
      return { success: true, entry, chance };
    } else {
      // Failed attempt — ship stays intact (disabled or otherwise)
      return { success: false, reason: 'Crew resisted — boarding repelled', chance };
    }
  }

  commandeerDerelict(derelict) {
    if(this.fleet.length >= 5) return { success:false, reason:'Fleet at capacity (max 5)', chance:1.0 };
    const templateId = Object.keys(G.SHIPS).find(k=>G.SHIPS[k].shape===derelict.shapeId) || 'shuttle';
    const capturedShip = new G.Ship(templateId);
    capturedShip.hull = Math.max(10, derelict.hp || 10);
    capturedShip._recompute();
    const shipName = templateId.replace(/_/g,' ').toUpperCase();
    const entry = {
      id: 'fleet_'+Date.now(),
      fleetName: 'DERELICT '+shipName,
      ship: capturedShip,
      combatSpeed: 240, combatTurnSpeed: 2.0,
      combatDamage: 12, combatFireRate: 1.0,
      combatWeaponType: 'laser', combatWeaponColor: '#44aaff',
    };
    this.fleet.push(entry);
    const fs = new G.FleetShip(entry);
    fs.x = derelict.x; fs.y = derelict.y;
    this.space.fleetShips.push(fs);
    derelict.looted = true;
    derelict.dead   = true;
    return { success:true, entry, chance:1.0 };
  }

  removeFleetShip(id) {
    const idx = this.fleet.findIndex(e=>e.id===id);
    if(idx>=0) this.fleet.splice(idx,1);
  }

  // Total cargo capacity: player + all fleet ships
  fleetCargoSpace() {
    let total = this.player.cargoSpace;
    for(const e of (this.fleet||[])) total += (e.ship?.cargoSpace||0);
    return total;
  }

  // Free space across the whole fleet (cargo stored on player)
  fleetCargoFreeSpace() {
    let used = 0;
    for(const [id,qty] of Object.entries(this.player.cargo||{})) {
      const item = G.ITEMS[id];
      used += qty * (item ? item.mass||1 : 1);
    }
    return this.fleetCargoSpace() - used;
  }

  // Used cargo mass
  fleetCargoUsed() {
    let used = 0;
    for(const [id,qty] of Object.entries(this.player.cargo||{})) {
      const item = G.ITEMS[id];
      used += qty * (item ? item.mass||1 : 1);
    }
    return used;
  }

  releaseFleetShip(id) {
    const idx = this.fleet.findIndex(e=>e.id===id);
    if(idx>=0) this.fleet.splice(idx,1);
    // Mark the live fleet ship to fly away as a neutral
    const fs = this.space?.fleetShips?.find(f=>f.fleetDataId===id);
    if(fs) {
      fs.isFleetShip = false;
      fs._released = true;
      fs._releasedTimer = 0;
    }
  }

  getRel(faction){return this.relations[faction]||0;}
  setRel(faction, val, reason='') {
    const old = this.relations[faction] || 0;
    this.relations[faction] = G.clamp(val, -100, 100);
    const diff = Math.round(this.relations[faction] - old);
    if(diff !== 0 && reason && G.ui) {
      const col = diff > 0 ? '#44ff88' : '#ff6644';
      const facName = G.FACTIONS[faction]?.name || faction;
      G.ui.addMsg(`${facName} rep ${diff>0?'+':''}${diff}: ${reason}`, col);
    }
  }

  quitToMenu() {
    ['spaceport-overlay','galaxy-overlay','inventory-overlay','mission-log-overlay',
     'comms-overlay','gameover-overlay','options-overlay','char-screen-overlay','skill-tree-overlay'].forEach(id=>{
      document.getElementById(id)?.classList.add('hidden');
    });
    this.ui.els['galaxy-overlay']?.classList.add('hidden');
    G.sound?.missileLockOff?.();
    this._locked = false; this._lockTarget = null; this._lockT = 0; this._missileLocking = false;
    this._hideHUD();
    this.state = 'menu';
    this.renderer._menuStars = null;
    this.renderer._menuFrozen = false;
    document.getElementById('main-menu')?.classList.remove('hidden');
    this._updateContinueBtn();
  }

  _showHUD() {
    ['hud','hud-top'].forEach(id=>{
      (this.ui.els[id]||document.getElementById(id))?.classList.remove('hidden');
    });
    document.getElementById('minimap-wrap')?.classList.remove('hidden');
    this.ui.updateAbilityBar(this.player);
  }
  _hideHUD() {
    ['hud','hud-top'].forEach(id=>{
      (this.ui.els[id]||document.getElementById(id))?.classList.add('hidden');
    });
    document.getElementById('minimap-wrap')?.classList.add('hidden');
    document.getElementById('jump-route-hud')?.classList.add('hidden');
    document.getElementById('jump-charge-hud')?.classList.add('hidden');
  }
  // Resolve the active control scheme. 'auto' picks the best available input:
  // a connected controller wins, then a touch device, otherwise keyboard.
  _effectiveScheme() {
    const s = this._controlScheme || 'auto';
    if(s !== 'auto') return s;
    if(this.input && this.input.hasGamepad()) return 'gamepad';
    if(G.isMobileDevice()) return 'touch';
    return 'keyboard';
  }
  // Pin (or auto) the control scheme from the Options menu.
  setControlScheme(s) {
    this._controlScheme = s;
    try { localStorage.setItem('nullpunkt_control_scheme', s); } catch(e){}
    this.ui.refreshControlScheme?.();
    this._updateMobileControls();
  }
  _saveSteerPref(joystick) {
    this._joystickMode = !!joystick;
    try { localStorage.setItem('nullpunkt_steer_mode', joystick ? 'joystick' : 'dpad'); } catch(e){}
    this._updateMobileControls();
  }
  // Show the on-screen pad only when touch controls are active, while flying
  // or on the galaxy map, and never behind a full-screen menu overlay.
  _updateMobileControls() {
    const eff = this._effectiveScheme();
    this._mobileControls = (eff === 'touch');
    // Announce an automatic swap to the controller when one is plugged in.
    if(eff !== this._lastEffScheme){
      if(this._lastEffScheme != null && eff === 'gamepad' && this._controlScheme === 'auto')
        this.ui.addMsg?.('Controller connected — gamepad controls active', '#44ffcc');
      this._lastEffScheme = eff;
      this.ui.refreshControlScheme?.();
    }
    const el = document.getElementById('mobile-controls');
    if(!el) return;
    const show = this._mobileControls && !this.input._menuOpen()
              && (this.state==='space' || this.state==='galaxy');
    el.classList.toggle('hidden', !show);
    document.getElementById('mc-joystick')?.classList.toggle('hidden', !show || !this._joystickMode);
    document.querySelector('.mc-move')?.classList.toggle('hidden', !show || !!this._joystickMode);
  }
  toggleMinimap() {
    const wrap = document.getElementById('minimap-wrap');
    if(!wrap) return;
    const collapsed = wrap.classList.toggle('collapsed');
    const btn = document.getElementById('minimap-toggle-btn');
    if(btn) btn.textContent = collapsed ? 'MAP ▼' : 'MAP ▲';
  }
};

G.Game.prototype._loop = function(ts) {
  requestAnimationFrame(this._loop);
  const dt=Math.min((ts-this._last)/1000, 0.05);
  this._last=ts;

  // Poll the gamepad before any input is read this frame. Only apply it when
  // the controller is the active scheme so keyboard/touch players aren't
  // affected by a plugged-in pad.
  this.input.pollGamepad(this._effectiveScheme() === 'gamepad');

  // FPS counter
  if(this._fpsEl) {
    if(!this._fpsTime) { this._fpsTime=ts; this._fpsFrames=0; }
    this._fpsFrames++;
    if(ts-this._fpsTime >= 500) {
      const fps = Math.round(this._fpsFrames*1000/(ts-this._fpsTime));
      const lpwarn = fps <= 31 && G.isMobileDevice() ? ' (LOW PWR?)' : '';
      document.getElementById('fps-counter-text').textContent = fps + ' FPS' + lpwarn;
      this._fpsHistory.push(fps);
      if(this._fpsHistory.length > 80) this._fpsHistory.shift();
      if(this._fpsGraphCanvas) {
        const ctx = this._fpsGraphCanvas.getContext('2d');
        const W = this._fpsGraphCanvas.width, H = this._fpsGraphCanvas.height;
        ctx.clearRect(0, 0, W, H);
        ctx.strokeStyle = '#00ffee';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for(let i = 0; i < this._fpsHistory.length; i++) {
          const y = H - (this._fpsHistory[i] / 120) * H;
          const x = (i / Math.max(1, this._fpsHistory.length - 1)) * W;
          if(i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      this._fpsTime=ts; this._fpsFrames=0;
    }
  }

  const _inSpace = this.state==='space'||this.state==='dead'||this.state==='landing'||this.state==='launching';
  if(_inSpace) {
    if((this.state==='space'||this.state==='dead') && !this.paused) this._updateSpace(dt, ts/1000);
    if(this.state==='dead' && this._playerDyingTimer > 0) this._updateDyingPlayer(dt);
    if(!this.paused) this.particles.update(dt);
    this.renderer.renderSpace(this);
    if(this.player && !this.paused) {
      const spd = Math.hypot(this.player.vx, this.player.vy);
      const _anyThrust = !this.player.disabled && (this.input.thrust || this.input.strafeL || this.input.strafeR || this.input.reverse);
      G.sound.updateEngine(spd, _anyThrust);
      const _hpFrac = this.player.hull / Math.max(this.player.maxHull, 1);
      G.sound.updatePlayerState(_hpFrac, this.player.disabled);
    }
    this._drawJumpCharge();
    if(this._flashFrames > 0) {
      this._flashFrames--;
      const ctx = this.renderer.ctx;
      ctx.save(); ctx.globalAlpha = this._flashFrames/6;
      ctx.fillStyle='#aaddff'; ctx.fillRect(0,0,G.CANVAS_W,G.CANVAS_H);
      ctx.restore();
    }

    // Landing animation: zoom in + fade to black, then complete
    if(this.state==='landing') {
      this._landFade = Math.min(1, this._landFade + dt / 0.55);
      this.camZoom = 1.0 + this._landFade * 0.35;
      if(this._landFade >= 1) {
        const port = this._landPending; this._landPending = null;
        for(const c of this.player.crew) this.credits=Math.max(0,this.credits-c.wage);
        const completed=this.economy.checkMissions(this.currentSysId,this.player);
        for(const m of completed) this.ui.addMsg('Mission complete: '+m.title+' +'+G.fmtCredits(m.reward),'#ffcc00');
        if(completed.length > 0) G.sound?.missionComplete();
        this.ui.showSpaceport(port.name, this.currentSysId);
        this.state='landed'; this.camZoom=1.0; this._landFade=0;
        const _pod = this._podLanding; this._podLanding = null;
        setTimeout(()=>this.ui.showSTCWelcome(port.name, port.faction||'neutral', _pod), 350);
      }
    }

    // Launching animation: start zoomed+black, fade and zoom out to normal
    if(this.state==='launching') {
      this._landFade = Math.max(0, this._landFade - dt / 0.55);
      this.camZoom = 1.0 + this._landFade * 0.35;
      if(this._landFade <= 0) {
        this.state='space'; this.camZoom=1.0;
      }
    }

    // Fade overlay for landing/launching (not when landed)
    if(this._landFade > 0 && this.state !== 'landed') {
      const ctx = this.renderer.ctx;
      ctx.save(); ctx.globalAlpha = this._landFade;
      ctx.fillStyle = '#000008';
      ctx.fillRect(0, 0, G.CANVAS_W, G.CANVAS_H);
      ctx.restore();
    }
  } else if(this.state === 'hexmap') {
    // Full flight sim runs in the hex map: steering, boost, weapons, abilities.
    if(!this.paused) {
      this._updateSpace(dt, ts/1000);
      this.particles.update(dt);
    }
    if(this.state === 'hexmap') this.renderer.renderHexMap(this);
    if(this.input.pressed('KeyM')) this.openGalaxy();
  } else if(this.state==='galaxy') {
    if(this.input.pressed('KeyM')) this.closeGalaxy();
    // Hold J with a route selected: close map and begin jump charge immediately
    if(this.input.is('KeyJ') && this.galaxy.jumpRoute.length > 0) {
      this.closeGalaxy();
    }
    this.particles.update(dt);
    this.renderer.renderSpace(this);
    this.galaxy.draw(this.currentSysId);
  } else if(this.state==='landed') {
    if(this.input.pressed('KeyL')) this.launch();
    if(this.ui._spTab === 'builder') {
      if(this.input.pressed('KeyQ')) this.ui.builderRotate(-1);
      if(this.input.pressed('KeyE')) this.ui.builderRotate(1);
    }
    // Zoom out fully when viewing missions tab
    if(this.ui._spTab === 'missions') {
      this.camZoom = 0.22;
    } else {
      this.camZoom = 1.0;
    }
    this.renderer.renderSpace(this);
  } else if (this.state === 'menu') {
    this.renderer.renderMenuBg(dt);
    if(Object.keys(this.input.justPressed).length > 0) {
      this.start();
    }
  } else {
    this.renderer.clear();
  }

  // Escape: close galaxy map / hex map or toggle options menu
  if(this.input.pressed('Escape')) {
    if(this.state==='galaxy') {
      this.closeGalaxy();
    } else if(this.state==='hexmap') {
      this.state='space';
      this._zoomManual=-0.42;
      document.getElementById('minimap-wrap')?.classList.remove('hidden');
    } else if(this.state==='space' || this.state==='dead') {
      const opts=document.getElementById('options-overlay');
      if(opts) {
        if(opts.classList.contains('hidden')) { opts.classList.remove('hidden'); this.paused=true; }
        else { opts.classList.add('hidden'); this.paused=false; }
      }
    }
  }

  if(this.player && this.state!=='menu') {
    this.ui.updateHUD(this.player, this.space, this.target);
    this.ui.updateJumpRouteHUD(this.player, this.galaxy, this._jumpCooldown);
    this.ui.updateAbilityBar(this.player);
  }
  G.sound?.setDustMuffle?.(!!(this.space && this.space._playerInDust && (this.state==='space'||this.state==='hexmap')));
  this._updateMobileControls();

  this._updateMusic(dt);
  this.input.flush();
};

// Drive the adaptive music engine: intensity from on-screen threat,
// muffle ("next door") while in menus or docked at port.
G.Game.prototype._updateMusic = function(dt) {
  const snd = G.sound;
  if(!snd) return;

  // Muffle in menus / spaceport / death screen / options overlay / descent.
  const optsOpen = !document.getElementById('options-overlay')?.classList.contains('hidden');
  const muffle = this.state==='menu' || this.state==='landed' || this.state==='dead'
              || this.state==='landing' || optsOpen;
  snd.musicMuffle(muffle);

  // Intensity from live combat. Exploration = 0 → quiet atmospheric bed.
  let intensity = 0;
  if(this.state==='space' && this.space) {
    const enemies = this.space.enemies.filter(e=>!e.dead&&!e.boarded&&!e.disabled);
    const hostNpc = this.space.npcs.filter(n=>!n.dead&&n.hostile&&!n.disabled);
    const hostTur = (this.space.turrets||[]).filter(t=>!t._dead&&t.hostile);
    const n = enemies.length + hostNpc.length + hostTur.length;
    if(n > 0) {
      // Light combat baseline that climbs with the size of the fight.
      intensity = 0.42 + Math.min(0.26, (n-1)*0.09);
      // Actively engaging enemies push it harder (the fight is "hot").
      if(enemies.some(e=>e.aiState==='engage' && !e.disabled)) intensity += 0.08;
      // Boss-tier: a swarm or a large/elite hostile → top band (rescore to boss).
      const boss = n >= 4 || enemies.some(e=>(e.size||1) >= 1.6);
      if(boss) intensity = Math.max(intensity, 0.80 + Math.min(0.18, (n-4)*0.05));
    }
  }
  snd.musicIntensity(G.clamp(intensity, 0, 1));
};

// ── Bootstrap ─────────────────────────────────────────────
window.addEventListener('load', () => {
  document.fonts.ready.then(()=>{
    const g = new G.Game();
    g._loop = g._loop.bind(g);
    requestAnimationFrame(g._loop);
  }).catch(()=>{
    const g = new G.Game();
    g._loop = g._loop.bind(g);
    requestAnimationFrame(g._loop);
  });
});

document.addEventListener('visibilitychange', () => {
  G.sound?.backgroundMuffle(document.hidden);
});
