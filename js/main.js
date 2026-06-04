'use strict';
// ── Constants ─────────────────────────────────────────────
G.BASE_CANVAS_W = 1200;
G.BASE_CANVAS_H = 750;
G.CANVAS_W = 1200; // updated dynamically by _resize
G.CANVAS_H = 750;
G.SAVE_KEY  = 'starfarer_save_v2';

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

  drawBg(bgStars, camX, camY, speedMult=1, stretchMult=0) {
    const ctx = this.ctx;
    ctx.save();
    const parallaxBase = [0.08,0.25,0.55];
    for(const s of bgStars) {
      const px = parallaxBase[s.layer] * speedMult;
      const sx = ((s.x - camX*px) % (G.CANVAS_W*2) + G.CANVAS_W*3) % (G.CANVAS_W*2);
      const sy = ((s.y - camY*px) % (G.CANVAS_H*2) + G.CANVAS_H*3) % (G.CANVAS_H*2);
      const alpha = s.brightness * Math.min(1, speedMult * 0.7 + 0.3);
      ctx.fillStyle = `rgba(${180+s.brightness*75},${200+s.brightness*55},255,${alpha*0.8})`;

      if(stretchMult > 0.1) {
        // Stretch stars toward vanishing point (center of screen)
        const dx = sx - G.CANVAS_W/2;
        const dy = sy - G.CANVAS_H/2;
        const len = Math.max(1, stretchMult * s.layer * 30);
        const nx  = dx/Math.sqrt(dx*dx+dy*dy+0.001);
        const ny  = dy/Math.sqrt(dx*dx+dy*dy+0.001);
        ctx.beginPath();
        ctx.moveTo(sx|0, sy|0);
        ctx.lineTo((sx + nx*len)|0, (sy + ny*len)|0);
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = s.r;
        ctx.stroke();
      } else {
        ctx.fillRect(sx|0, sy|0, s.r, s.r);
      }
    }
    ctx.restore();
  }

  drawShip(x, y, angle, shapeId, color, scale=1, thrusting=false, boosting=false) {
    const shape = G.SHAPES[shapeId] || G.SHAPES.shuttle;
    const ctx = this.ctx;
    const SZ = G.Sprites.SZ;
    ctx.save();
    ctx.translate(x|0, y|0);
    ctx.rotate(angle);
    ctx.scale(scale, scale);

    // Draw pixel-art sprite centred at origin
    const sprite = G.Sprites.get(shapeId, color || shape.color);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, -(SZ>>1), -(SZ>>1), SZ, SZ);

    // Engine thrust flame overlay (on top of sprite)
    if(thrusting && shape.enginePts) {
      const ew = shape.engineW || 5;
      for(const [ex,ey] of shape.enginePts) {
        const len = boosting ? ew*2.8 : ew*1.4;
        const grad = ctx.createLinearGradient(ex,ey, ex,ey+len);
        grad.addColorStop(0, boosting?'#44aaff':'#ffaa22');
        grad.addColorStop(0.5, boosting?'rgba(0,100,255,0.5)':'rgba(255,80,0,0.5)');
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
    ctx.restore();
  }

  // Draw module icon overlays for the player's installed modules
  drawModuleOverlay(player, shapeId, scale) {
    if(!player || !player.modules) return;
    const ctx = this.ctx;
    const MSZ = G.Sprites.MSZ;
    const half = MSZ >> 1;
    const offsets = G.Sprites.slotOffsets[shapeId] || G.Sprites.slotOffsets.shuttle;
    const slotCount = {};
    ctx.save();
    ctx.translate(player.x|0, player.y|0);
    ctx.rotate(player.angle);
    ctx.scale(scale, scale);
    ctx.imageSmoothingEnabled = false;

    for(const inst of Object.values(player.modules)) {
      const mod = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
      if(!mod) continue;
      const visual = mod.visual || (G.WEAPONS[inst.moduleId] ? 'weapon' : 'special');
      const slotType = inst.slotType;
      const positions = offsets[slotType];
      if(!positions || positions.length === 0) continue;
      const idx = (slotCount[slotType] = (slotCount[slotType]||0));
      slotCount[slotType]++;
      const [sx, sy] = positions[idx % positions.length];
      const icon = G.Sprites.getMod(visual);
      if(inst.broken) {
        ctx.globalAlpha = 0.4;
        ctx.drawImage(icon, sx-half, sy-half, MSZ, MSZ);
        ctx.globalAlpha = 1;
        // Draw red X over broken module
        ctx.fillStyle = '#ff2222';
        ctx.fillRect(sx-half,   sy-half,   2, 2);
        ctx.fillRect(sx+half-2, sy-half,   2, 2);
        ctx.fillRect(sx-half,   sy+half-2, 2, 2);
        ctx.fillRect(sx+half-2, sy+half-2, 2, 2);
      } else {
        ctx.drawImage(icon, sx-half, sy-half, MSZ, MSZ);
      }
    }
    ctx.restore();
  }

  drawPlanet(x, y, r, color, type) {
    const ctx = this.ctx;
    const sx=x|0, sy=y|0;
    ctx.save();
    const grad = ctx.createRadialGradient(sx-r*0.3,sy-r*0.3,r*0.1, sx,sy,r);
    grad.addColorStop(0, this._lighten(color,40));
    grad.addColorStop(0.6, color);
    grad.addColorStop(1, this._darken(color,60));
    ctx.beginPath(); ctx.arc(sx,sy,r,0,Math.PI*2);
    ctx.fillStyle=grad; ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=1; ctx.stroke();
    if(type==='gas') {
      ctx.beginPath(); ctx.ellipse(sx,sy,r*1.7,r*0.4,0.3,0,Math.PI*2);
      ctx.strokeStyle=`${color}66`; ctx.lineWidth=3; ctx.stroke();
    }
    ctx.restore();
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

  drawComet(x, y, r, col) {
    const ctx = this.ctx;
    ctx.save();
    // Tail points away from star (star is always at origin)
    const tailAngle = Math.atan2(y, x);
    const tailLen = 50 + r * 7;
    // Tail gradient
    const tx = x + Math.cos(tailAngle)*tailLen;
    const ty = y + Math.sin(tailAngle)*tailLen;
    const tg = ctx.createLinearGradient(x,y,tx,ty);
    tg.addColorStop(0,'rgba(160,210,255,0.55)');
    tg.addColorStop(1,'rgba(0,80,180,0)');
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(tx,ty);
    ctx.strokeStyle=tg; ctx.lineWidth=r*1.8; ctx.lineCap='round'; ctx.stroke();
    // Coma glow
    const cg = ctx.createRadialGradient(x,y,0,x,y,r*3);
    cg.addColorStop(0,'rgba(200,230,255,0.35)');
    cg.addColorStop(1,'rgba(0,60,160,0)');
    ctx.beginPath(); ctx.arc(x,y,r*3,0,Math.PI*2);
    ctx.fillStyle=cg; ctx.fill();
    // Nucleus
    ctx.beginPath(); ctx.arc(x|0,y|0,r,0,Math.PI*2);
    ctx.fillStyle='#e8f4ff'; ctx.fill();
    ctx.restore();
  }

  drawAsteroid(x, y, r, angle, color) {
    const ctx = this.ctx;
    const shape = G.SHAPES.asteroid;
    ctx.save(); ctx.translate(x|0,y|0); ctx.rotate(angle); ctx.scale(r/12,r/12);
    ctx.beginPath();
    ctx.moveTo(shape.body[0][0],shape.body[0][1]);
    shape.body.slice(1).forEach(([px,py])=>ctx.lineTo(px,py));
    ctx.closePath();
    ctx.fillStyle=color||'#776655'; ctx.strokeStyle='#aaaaaa';
    ctx.lineWidth=0.8*(12/r); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  drawDerelict(x, y, angle, shapeId) {
    const ctx=this.ctx;
    ctx.save(); ctx.globalAlpha=0.55;
    this.drawShip(x,y,angle,shapeId,'#445566',1,false,false);
    ctx.restore();
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
      ctx.translate(p.x|0,p.y|0); ctx.rotate(Math.atan2(p.vx,p.vy));
      ctx.fillStyle=p.color;
      ctx.beginPath(); ctx.moveTo(0,-6); ctx.lineTo(2,5); ctx.lineTo(-2,5);
      ctx.closePath(); ctx.fill();
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

  drawEnemyBars(enemy) {
    const ctx=this.ctx;
    const bw=40, bh=4, bx=enemy.x-bw/2, by=enemy.y-(enemy.size||1)*24;
    ctx.fillStyle='#1a2233'; ctx.fillRect(bx|0,by|0,bw,bh);
    ctx.fillStyle='#44ff44'; ctx.fillRect(bx|0,by|0,(bw*(enemy.hp/enemy.maxHp))|0,bh);
    if(enemy.maxShields>0) {
      ctx.fillStyle='#111a2a'; ctx.fillRect(bx|0,(by+bh+1)|0,bw,bh);
      ctx.fillStyle='#4488ff'; ctx.fillRect(bx|0,(by+bh+1)|0,(bw*(enemy.shields/Math.max(enemy.maxShields,1)))|0,bh);
    }
    if(enemy.disabled) {
      ctx.fillStyle='rgba(255,200,0,0.85)'; ctx.font='6px "Press Start 2P",monospace';
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
      if(n.dead||n.aiState==='docked') continue;
      const nx=tx(n)|0,ny=ty(n)|0;
      if(!inBounds(nx,ny)) continue;
      const nRel=game.getRel(n.faction);
      const nCol=n.hostile?'#ff3333':nRel>=50?'#00ee66':nRel>=-20?'#88aacc':nRel>=-50?'#ffcc00':'#ff8800';
      drawShipTriangle(nx,ny,n.angle,nCol);
    }

    // Enemy ships — triangles, hostile or negative faction → red/yellow
    for(const e of space.enemies){
      if(e.dead||e.boarded) continue;
      const ex=tx(e)|0,ey=ty(e)|0;
      if(!inBounds(ex,ey)) continue;
      const rel=game.getRel(e.faction)||0;
      if(rel<-20||e.aiState==='engage'){
        drawShipTriangle(ex,ey,e.angle,rel<-50?'#ff3333':'#ff8800');
      }
      // Blinking yellow box for mission target enemies
      if(combatMissionHere&&blink) {
        ctx.strokeStyle='#ffcc00'; ctx.lineWidth=1.5;
        ctx.strokeRect(ex-6,ey-6,12,12);
        ctx.lineWidth=0.5;
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

  drawDeepBg(deepObjects, camX, camY) {
    if (!deepObjects || !deepObjects.length) return;
    const ctx = this.ctx;
    const tileW = G.CANVAS_W * 2;
    const tileH = G.CANVAS_H * 2;
    ctx.save();
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

    this.drawBg(game.space.bgStars, game.camX, game.camY, speedMult, stretchMult);

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

  renderSpace(game) {
    const { player, space, particles, camX, camY } = game;
    if(!player || !space) { this.clear(); return; }
    const ctx = this.ctx;

    this.clear();
    this.drawDeepBg(space.bgDeepObjects, camX, camY);
    this.drawBg(space.bgStars, camX, camY, 1, 0);

    ctx.save();
    ctx.translate(-camX, -camY);

    // Landing radius hints
    for(const b of space.bodies) {
      if(b.hasSpaceport) {
        ctx.beginPath(); ctx.arc(b.x,b.y,140,0,Math.PI*2);
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
        const planetCol=b.hasSpaceport?'#4488ff':'#667788';
        this.drawPlanet(b.x,b.y,b.r,planetCol,b.ptype);
        if(b.hasSpaceport) { ctx.fillStyle='rgba(0,255,200,0.8)'; ctx.font='9px sans-serif'; ctx.fillText('⬡',(b.x-5)|0,(b.y-b.r-6)|0); }
        ctx.fillStyle='rgba(200,200,200,0.75)'; ctx.font='7px "Press Start 2P",monospace';
        ctx.fillText(b.name,(b.x+b.r+4)|0,(b.y+3)|0);
      } else if(b.type==='station') {
        this.drawStation(b.x,b.y,space.time*0.2);
        ctx.fillStyle='rgba(200,200,220,0.8)'; ctx.font='7px "Press Start 2P",monospace';
        ctx.fillText(b.name,(b.x+24)|0,(b.y+3)|0);
      } else if(b.type==='comet') {
        this.drawComet(b.x,b.y,b.r,b.color||'#aaddff');
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
      this.drawAsteroid(a.x,a.y,a.r,a.angle,a.color);
      if(a.hp<a.maxHp) {
        const bw=a.r*1.5, by=a.y-a.r-6;
        ctx.fillStyle='#1a1a1a'; ctx.fillRect((a.x-bw/2)|0,by|0,bw|0,3);
        ctx.fillStyle='#ff8844'; ctx.fillRect((a.x-bw/2)|0,by|0,(bw*(a.hp/a.maxHp))|0,3);
      }
    }

    for(const d of space.derelicts) {
      if(!d.looted) {
        this.drawDerelict(d.x,d.y,d.angle||0,G.SHIPS[d.shipId]?.shape||'shuttle');
        ctx.fillStyle='rgba(200,150,50,0.8)'; ctx.font='7px "Press Start 2P",monospace';
        ctx.fillText('DERELICT',(d.x+20)|0,(d.y-22)|0);
      }
    }

    for(const l of space.floatingLoot) this.drawLoot(l,space.time);

    for(const e of space.enemies) {
      if(e.dead||e.boarded) continue;
      this.drawShip(e.x,e.y,e.angle,e.shapeId||'pirate_fighter',e.color,e.size||1,
        e.aiState==='engage'&&!e.disabled,false);
      this.drawEnemyBars(e);
    }

    // NPC ships
    for(const n of space.npcs) {
      if(n.dead||n.boarded) continue;
      const moving = n.aiState!=='docked';
      this.drawShip(n.x,n.y,n.angle,n.shapeId||'shuttle',n.color,n.size||1,moving,false);
      // Show bars only when hostile
      if(n.hostile) this.drawEnemyBars(n);
      // Name label for targeted or hovered
      if(game.target===n) {
        ctx.save(); ctx.font='6px "Press Start 2P",monospace';
        ctx.fillStyle=n.color; ctx.textAlign='center';
        ctx.fillText(n.name, n.x, n.y-(n.size||1)*24-8);
        ctx.textAlign='left'; ctx.restore();
      }
    }

    for(const p of space.projectiles) this.drawProjectile(p);

    // Particles stored in world-space; ctx is already translated so offset = 0
    particles.draw(ctx, 0, 0);

    const thrusting = game.input.thrust;
    const boosting  = game.input.boost && player.energy > 5 && player.boostCharge > 0;
    const shipColor = G.SHIPS[player.templateId]?.color || '#8899bb';
    const shapeId   = G.SHIPS[player.templateId]?.shape || 'shuttle';
    this.drawShip(player.x,player.y,player.angle,shapeId,shipColor,1,thrusting,boosting);
    this.drawModuleOverlay(player, shapeId, 1);

    if(player.shields>0) {
      const alpha=0.12+0.28*(player.shields/player.maxShields);
      ctx.beginPath(); ctx.arc(player.x,player.y,22,0,Math.PI*2);
      ctx.strokeStyle=`rgba(80,140,255,${alpha})`; ctx.lineWidth=3; ctx.stroke();
    }
    if(player.empTimer>0) {
      ctx.beginPath(); ctx.arc(player.x,player.y,24+Math.sin(space.time*20)*3,0,Math.PI*2);
      ctx.strokeStyle='rgba(160,80,255,0.5)'; ctx.lineWidth=2; ctx.stroke();
    }
    if(game.target&&!game.target.dead) {
      const t=game.target, tr=20+(t.size||1)*8;
      ctx.beginPath(); ctx.arc(t.x,t.y,tr,0,Math.PI*2);
      ctx.strokeStyle='rgba(255,100,100,0.6)'; ctx.lineWidth=1;
      ctx.setLineDash([4,4]); ctx.stroke(); ctx.setLineDash([]);
    }

    ctx.restore();

    const mmCanvas=document.getElementById('minimap');
    if(mmCanvas) this.drawMinimap(mmCanvas,player,space,game);
  }

  _lighten(hex,a){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return `rgb(${Math.min(255,r+a)},${Math.min(255,g+a)},${Math.min(255,b+a)})`;}
  _darken(hex,a){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return `rgb(${Math.max(0,r-a)},${Math.max(0,g-a)},${Math.max(0,b-a)})`;}
};

// ── Main Game Class ───────────────────────────────────────
G.Game = class {
  constructor() {
    this.state     = 'menu';
    this.credits   = 1000;
    this.kills     = 0;
    this.startTime = 0;
    this.relations = { earth:50, rebellion:0, pirate:-50, alien:-100, contested:0, neutral:0 };
    this.activeMissions  = [];
    this.completedMissions=[];

    this.player    = null;
    this.currentSysId='sol';
    this.target    = null;
    this.camX=0; this.camY=0;
    this._camLeadX=0; this._camLeadY=0;

    // Hyperspace state
    this.hyperspaceT      = 0;
    this.hyperspaceTarget = null;
    this._jumpChargeT     = 0;
    this._jumpChargeBar   = null;
    this._jumpCooldown    = 0; // cooldown after arriving in a system

    this.canvas    = document.getElementById('gameCanvas');
    this.renderer  = new G.Renderer(this.canvas);
    this.input     = new G.Input();
    this.particles = new G.Particles();
    this.space     = new G.Space();
    this.galaxy    = new G.Galaxy();
    this.economy   = new G.Economy();
    this.ui        = new G.UI();

    G.game = this;
    G.ui   = this.ui;

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

  saveGame() {
    const save = {
      version:      2,
      timestamp:    Date.now(),
      credits:      this.credits,
      kills:        this.kills,
      currentSysId: this.currentSysId,
      relations:    {...this.relations},
      activeMissions:    JSON.parse(JSON.stringify(this.activeMissions)),
      completedMissions: JSON.parse(JSON.stringify(this.completedMissions)),
      galaxyVisited: [...this.galaxy.visited],
      player:       this.player.getSaveData(),
      playerPos:    { x:this.player.x, y:this.player.y },
    };
    localStorage.setItem(G.SAVE_KEY, JSON.stringify(save));
    this.ui.addMsg('Game saved.', '#00ffee');
    this.ui.showSaveConfirm();
    this._updateContinueBtn();
  }

  loadGame(saveData) {
    const d = typeof saveData === 'string' ? JSON.parse(saveData) : saveData;
    this.credits   = d.credits   || 0;
    this.kills     = d.kills     || 0;
    this.relations = d.relations || { earth:50, rebellion:0, pirate:-50, alien:-100 };
    this.activeMissions    = d.activeMissions    || [];
    this.completedMissions = d.completedMissions || [];
    this.currentSysId      = d.currentSysId || 'sol';

    // Restore galaxy visited
    this.galaxy.visited = new Set(d.galaxyVisited || ['sol']);

    // Rebuild player ship from save
    const sd = d.player;
    this.player = new G.Ship(sd.templateId || 'shuttle');
    // Overwrite module state directly
    this.player.modules = sd.modules || {};
    this.player.slots   = sd.slots   || this.player.slots;
    this.player.cargo   = sd.cargo   || {};
    this.player.crew    = sd.crew    || [];
    this.player.powerWeapons = sd.powerWeapons || 0.33;
    this.player.powerShields = sd.powerShields || 0.33;
    this.player.powerEngines = sd.powerEngines || 0.34;
    this.player._recompute();
    this.player.hull    = sd.hull    || this.player.maxHull;
    this.player.shields = sd.shields || 0;
    this.player.energy  = sd.energy  || this.player.maxEnergy;
    this.player.fuel    = sd.fuel    || this.player.maxFuel;
    this.player.x = d.playerPos?.x || 600;
    this.player.y = d.playerPos?.y || 400;

    // Load space scene
    this.economy._marketCache = {};
    this.space = new G.Space();
    this.space.loadSystem(this.currentSysId);
    this.camX = this.player.x - G.CANVAS_W/2;
    this.camY = this.player.y - G.CANVAS_H/2;
    this._camLeadX=0; this._camLeadY=0;
    this.target = null;
    this.state = 'space';

    const sys = G.SYSTEMS.find(s=>s.id===this.currentSysId);
    if(this.ui.els['system-label']) this.ui.els['system-label'].textContent = sys?.name||this.currentSysId;
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('gameover-overlay').classList.add('hidden');
    this._showHUD();
    this.ui.addMsg('Welcome back, Commander.', '#00ffee');
  }

  start() {
    this.state    = 'space';
    this.credits  = 1000;
    this.kills    = 0;
    this.startTime= Date.now();
    this.activeMissions=[]; this.completedMissions=[];
    this.relations={ earth:50, rebellion:0, pirate:-50, alien:-100, contested:0, neutral:0 };
    this.currentSysId='sol';
    this.target=null;
    this.hyperspaceT=0; this.hyperspaceTarget=null; this._jumpChargeT=0; this._jumpCooldown=0;

    this.economy._marketCache = {};
    this.player = new G.Ship('shuttle');
    this.player.x=800; this.player.y=300;
    this.space = new G.Space();
    this.space.loadSystem('sol');
    this.galaxy.visited=new Set(['sol']);
    this.galaxy.clearRoute();
    this.camX=this.player.x-G.CANVAS_W/2;
    this.camY=this.player.y-G.CANVAS_H/2;
    this._camLeadX=0; this._camLeadY=0;

    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('gameover-overlay').classList.add('hidden');
    this._showHUD();
    const sys=G.SYSTEMS.find(s=>s.id==='sol');
    if(this.ui.els['system-label']) this.ui.els['system-label'].textContent=sys?.name||'Sol';
    this.ui.addMsg('Welcome, Commander. Earn your way to the stars.','#00ffee');
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

  // Hyperspace departure: ship accelerates off-screen, then system switches
  _updateJumpDeparture(dt) {
    this._jumpDepartTimer -= dt;
    // Apply huge velocity — camera lags so ship flies off-screen
    this.player.x += this.player.vx * dt;
    this.player.y += this.player.vy * dt;
    // Slow camera lerp so ship visually streaks away
    this.camX = G.lerp(this.camX, this.player.x - G.CANVAS_W/2, dt * 1.2);
    this.camY = G.lerp(this.camY, this.player.y - G.CANVAS_H/2, dt * 1.2);

    if(this._jumpDepartTimer <= 0) {
      this._jumpDeparting = false;
      this._flashFrames   = 6; // brief white flash
      this._doSystemTransition();
    }
  }

  _doSystemTransition() {
    const sysId = this.hyperspaceTarget;
    const spd = Math.hypot(this.player.vx, this.player.vy)||1;
    const nx   = this.player.vx/spd;
    const ny   = this.player.vy/spd;

    this.currentSysId = sysId;
    this.galaxy.visited.add(sysId);
    this.space.loadSystem(sysId);

    // Arrive from edge, ship enters with moderate velocity
    this.player.x  = nx * -2200 + G.CANVAS_W/2;
    this.player.y  = ny * -2200 + G.CANVAS_H/2;
    this.player.vx = nx * 500;
    this.player.vy = ny * 500;
    this.camX = this.player.x - G.CANVAS_W/2;
    this.camY = this.player.y - G.CANVAS_H/2;
    this.target = null;
    this.state = 'space';

    // Jump cooldown — player must wait before jumping again
    this._jumpCooldown = 6;

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

    // Weapon select 1-9
    for(let i=1;i<=9;i++) {
      if(this.input.pressed('Digit'+i) && p.weaponSlots[i-1]) p.activeWeapon=i-1;
    }

    // M: toggle galaxy map
    if(this.input.pressed('KeyM')) {
      if(this.state==='space') this.openGalaxy();
      else if(this.state==='galaxy') this.closeGalaxy();
    }

    // Jump departure update (ship streaking off screen)
    if(this._jumpDeparting) { this._updateJumpDeparture(dt); return; }

    // Jump cooldown countdown
    if(this._jumpCooldown > 0) this._jumpCooldown -= dt;

    // J: hold to jump to next system in route (when in space)
    if(p.canJump && this.galaxy.jumpRoute.length > 0) {
      const nextSysId = this.galaxy.jumpRoute[0];
      if(this.galaxy.canJumpTo(nextSysId)) {
        if(this.input.is('KeyJ')) {
          // Steer ship toward the jump destination while charging
          const curSys  = G.SYSTEMS.find(s=>s.id===this.currentSysId);
          const nextSys = G.SYSTEMS.find(s=>s.id===nextSysId);
          if(curSys && nextSys) {
            const dx = nextSys.pos[0]-curSys.pos[0], dy = nextSys.pos[1]-curSys.pos[1];
            const jumpAngle = Math.atan2(dx, -dy);
            const diff = G.wrapAngle(jumpAngle - p.angle);
            p.angle += G.clamp(diff, -p.turnSpeed*dt, p.turnSpeed*dt);
          }
          this._updateJumpChargeTo(nextSysId, dt);
        } else {
          this._jumpChargeT = Math.max(0, this._jumpChargeT - dt*2);
        }
      } else {
        // First hop no longer reachable — clear route
        this.galaxy.clearRoute();
        this.ui.addMsg('Jump route invalidated.','#ff4444');
      }
    } else if(this._jumpChargeT > 0) {
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

    // T: next target  Y: prev target  R: nearest target
    if(this.input.pressed('KeyT')) this._cycleTarget(1);
    if(this.input.pressed('KeyY')) this._cycleTarget(-1);
    if(this.input.pressed('KeyR')) this._targetNearest();

    // X: hold to auto-aim intercept vector toward target
    if(this.input.is('KeyX') && this.target && !this.target.dead) {
      this._autoAimIntercept(dt);
    }

    // C: comms with targeted NPC
    if(this.input.pressed('KeyC')) {
      if(this.target?.type==='npc') this.ui.openComms(this.target);
    }

    // F: request fuel from nearby friendly ship
    if(this.input.pressed('KeyF') && this.player.fuel < this.player.maxFuel*0.4) {
      const nearby = this.space.nearestFriendlyNPC(this.player.x, this.player.y, 350);
      if(nearby) this.ui.openComms(nearby, 'fuel');
      else this.ui.addMsg('No friendly ship nearby for fuel transfer.','#ff8844');
    }

    p.update(dt, this.input);

    // Engine trail at correct exhaust point (behind ship)
    if(this.input.thrust && Math.random()<0.5) {
      this.particles.engine_trail(p.x,p.y,p.angle,p.vx,p.vy,1);
    }
    // Extra boost trail
    if(this.input.thrust && this.input.boost && p.energy>5 && p.boostCharge>0 && Math.random()<0.6) {
      this.particles.engine_trail(p.x,p.y,p.angle,p.vx,p.vy,1.4);
    }
    // Retrograde braking exhaust — particles shoot forward/sideways (RCS effect)
    if(this.input.reverse && Math.random()<0.5) {
      const spd = Math.sqrt(p.vx*p.vx+p.vy*p.vy);
      if(spd > 10) {
        // Emit 2 small puffs from nose corners of the ship
        for(const side of [-1,1]) {
          const ex = p.x + Math.sin(p.angle)*12 + Math.cos(p.angle)*side*6;
          const ey = p.y - Math.cos(p.angle)*12 + Math.sin(p.angle)*side*6;
          this.particles.emit({
            x:ex, y:ey,
            vx: (p.vx/spd)*30 + Math.cos(p.angle)*side*20,
            vy: (p.vy/spd)*30 - Math.sin(p.angle)*side*20,
            life:0.12, r:1.4, color:'#88aaff', drag:0.85, fade:true,
          });
        }
      }
    }

    // Auto turrets
    for(let i=0;i<p.weaponSlots.length;i++){
      const w=p.weaponSlots[i];
      const wDef=G.WEAPONS[w.weaponId];
      if(!wDef?.turret) continue;
      const nearest=this.space.nearestTarget(p.x,p.y);
      if(nearest&&G.v2.dist(p,nearest)<(wDef.range||280)){
        const proj=p.fireWeapon(i,nearest.x,nearest.y);
        if(proj) this.space.projectiles.push(proj);
      }
    }

    // Space: fire primary (active) weapon
    if(this.input.fire) {
      const wIdx=p.activeWeapon;
      const wDef=p.weaponSlots[wIdx]?G.WEAPONS[p.weaponSlots[wIdx].weaponId]:null;
      if(wDef&&!wDef.turret){
        const proj=p.fireWeapon(wIdx, this.target?.x, this.target?.y);
        if(proj) this.space.projectiles.push(proj);
      }
    }
    // Tab: fire secondary weapon (next non-active, non-turret weapon slot)
    if(this.input.pressed('Tab')) {
      const secondIdx = p.weaponSlots.findIndex((w,i)=>i!==p.activeWeapon&&!G.WEAPONS[w.weaponId]?.turret);
      if(secondIdx >= 0) {
        const proj = p.fireWeapon(secondIdx, this.target?.x, this.target?.y);
        if(proj) this.space.projectiles.push(proj);
      }
    }

    this.space.update(dt,p,this.input,this.particles,now);

    // Count kills + bounty check
    for(const e of this.space.enemies) {
      if(e.dead&&!e._killCounted) {
        e._killCounted=true; this.kills++;
        this.economy.checkBounty(e.faction, this.currentSysId);
        this.setRel(e.faction, this.getRel(e.faction)+3);
      }
    }

    // Camera follow with speed-based lead-ahead
    const _spd = Math.sqrt(p.vx*p.vx + p.vy*p.vy);
    const _leadFrac = G.clamp((_spd - 100) / 400, 0, 1);
    const _tLeadX = _leadFrac * 180 * (_spd > 0 ? p.vx / _spd : 0);
    const _tLeadY = _leadFrac * 180 * (_spd > 0 ? p.vy / _spd : 0);
    this._camLeadX = G.lerp(this._camLeadX, _tLeadX, Math.min(dt * 2.5, 1));
    this._camLeadY = G.lerp(this._camLeadY, _tLeadY, Math.min(dt * 2.5, 1));
    this.camX=G.lerp(this.camX, p.x-G.CANVAS_W/2+this._camLeadX, Math.min(dt*6,1));
    this.camY=G.lerp(this.camY, p.y-G.CANVAS_H/2+this._camLeadY, Math.min(dt*6,1));

    // Interact prompts
    const nearPort=this.space.nearestSpaceport(p.x,p.y,140);
    if(nearPort) {
      this.ui.setInteractPrompt('[L] Land at '+nearPort.name);
      if(this.input.pressed('KeyL')) { this.land(nearPort); return; }
    } else {
      const nearDis=this.space.enemies.find(e=>e.disabled&&!e.boarded&&G.v2.dist(p,e)<80);
      if(nearDis) {
        this.ui.setInteractPrompt('[L] Board disabled ship');
        if(this.input.pressed('KeyL')) {
          const res=this.space.boardEnemy(nearDis,p);
          if(res) this.ui.addMsg('Boarded! +'+G.fmtCredits(res.credits)+(res.items.length?' + cargo':''),'#ffcc00');
        }
      } else {
        const nearDer=this.space.derelicts.find(d=>!d.looted&&G.v2.dist(p,d)<80);
        if(nearDer) {
          this.ui.setInteractPrompt('[L] Loot derelict');
          if(this.input.pressed('KeyL')) {
            const items=this.space.lootDerelict(nearDer,p);
            this.ui.addMsg('Looted: '+(items?.map(i=>i.qty+'x '+(G.ITEMS[i.id]?.name||i.id)).join(', ')||'nothing'),'#ffaa00');
          }
        } else {
          this.ui.setInteractPrompt(null);
        }
      }
    }

    // Mining (hold M near asteroid — only when NOT on map)
    if(this.input.is('KeyM') && this.state==='space' && p.canMine) {
      const nearA=this.space.nearestAsteroid(p.x,p.y,120);
      if(nearA&&Math.random()<dt*4) {
        const done=this.space.mineAsteroid(nearA,p,this.particles);
        if(done) this.ui.addMsg('Asteroid mined!','#ffcc44');
      }
    }

    if(p.hull<=0) this._playerDied();
    if(this.target&&(this.target.dead||this.target.boarded)) this.target=null;
  }

  _updateJumpChargeTo(sysId, dt) {
    if(this._jumpCooldown > 0) {
      const remaining = Math.ceil(this._jumpCooldown);
      if(this.input.pressed('KeyJ')) this.ui.addMsg('Jump cooling down: '+remaining+'s','#556677');
      this._jumpChargeT = 0;
      return;
    }
    if(!this.player.canJump) { this.ui.addMsg('No jump drive!','#ff4444'); return; }
    if(this.player.fuel < 10) { this.ui.addMsg('Not enough fuel!','#ff4444'); return; }

    this._jumpChargeT += dt;
    if(this._jumpChargeT >= 5.0) {
      this._jumpChargeT = 0;
      this.doHyperspace(sysId);
    }
  }

  doHyperspace(targetSysId) {
    this.player.fuel = Math.max(0, this.player.fuel-10);
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
    this._jumpDeparting   = true;
    this._jumpDepartTimer = 0.45;
    this._flashFrames     = 0;
    this._jumpChargeT     = 0;
    this.ui.els['galaxy-overlay']?.classList.add('hidden');
    this.ui.setInteractPrompt(null);
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

    // Rotate toward intercept at double turn speed
    const rotRate = p.turnSpeed * 2.5;
    p.angle += G.clamp(angleDiff, -rotRate*dt, rotRate*dt);
  }

  _cycleTarget(dir=1) {
    const all = this.space.allTargets();
    if(!all.length){ this.target=null; return; }
    if(!this.target){ this.target = dir>0?all[0]:all[all.length-1]; return; }
    const idx = all.indexOf(this.target);
    this.target = all[((idx+dir)+all.length)%all.length];
  }

  _targetNearest() {
    this.target = this.space.nearestTarget(this.player.x, this.player.y);
  }

  land(spaceport) {
    this.state='landed';
    for(const c of this.player.crew) this.credits=Math.max(0,this.credits-c.wage);
    const completed=this.economy.checkMissions(this.currentSysId,this.player);
    for(const m of completed) this.ui.addMsg('Mission complete: '+m.title+' +'+G.fmtCredits(m.reward),'#ffcc00');
    this.ui.showSpaceport(spaceport.name, this.currentSysId);
  }

  launch() {
    this.state='space';
    this.ui.hideSpaceport();
    this.ui.addMsg('Launching...','#00ffee');
    this._showHUD();
  }

  openGalaxy() {
    if(!this.player.canJump){ this.ui.addMsg('No hyperspace drive installed!','#ff4444'); return; }
    this.state='galaxy';
    this.ui.els['galaxy-overlay']?.classList.remove('hidden');
    this.galaxy.selected=null; this._jumpChargeT=0;
    this.galaxy.draw(this.currentSysId);
  }

  closeGalaxy() {
    this.state='space';
    this._jumpChargeT=0;
    this.ui.els['galaxy-overlay']?.classList.add('hidden');
  }

  _playerDied() {
    this.state='dead';
    const elapsed=Math.floor((Date.now()-this.startTime)/1000);
    this.particles.explosion(this.player.x,this.player.y,this.player.vx,this.player.vy,2);
    if(this.player.escapePods>0) this.ui.addMsg(Math.min(this.player.escapePods,this.player.crew.length)+' crew escaped.','#ffaa00');
    this.ui.showGameOver({ credits:this.credits, visited:this.galaxy.visited.size, kills:this.kills, time:elapsed });
    this._hideHUD();
  }

  getRel(faction){return this.relations[faction]||0;}
  setRel(faction,val){this.relations[faction]=G.clamp(val,-100,100);}

  quitToMenu() {
    ['spaceport-overlay','galaxy-overlay','inventory-overlay','mission-log-overlay',
     'comms-overlay','gameover-overlay','options-overlay'].forEach(id=>{
      document.getElementById(id)?.classList.add('hidden');
    });
    this.ui.els['galaxy-overlay']?.classList.add('hidden');
    this._hideHUD();
    this.state = 'menu';
    document.getElementById('main-menu')?.classList.remove('hidden');
    this._updateContinueBtn();
  }

  _showHUD() {
    ['hud','hud-top'].forEach(id=>{
      (this.ui.els[id]||document.getElementById(id))?.classList.remove('hidden');
    });
    document.getElementById('minimap-wrap')?.classList.remove('hidden');
  }
  _hideHUD() {
    ['hud','hud-top'].forEach(id=>{
      (this.ui.els[id]||document.getElementById(id))?.classList.add('hidden');
    });
    document.getElementById('minimap-wrap')?.classList.add('hidden');
    document.getElementById('jump-route-hud')?.classList.add('hidden');
    document.getElementById('jump-charge-hud')?.classList.add('hidden');
  }
};

G.Game.prototype._loop = function(ts) {
  requestAnimationFrame(this._loop);
  const dt=Math.min((ts-this._last)/1000, 0.05);
  this._last=ts;

  if(this.state==='space' || this.state==='dead') {
    if(this.state==='space') this._updateSpace(dt, ts/1000);
    this.particles.update(dt);
    this.renderer.renderSpace(this);
    this._drawJumpCharge();
    if(this._flashFrames > 0) {
      this._flashFrames--;
      const ctx = this.renderer.ctx;
      ctx.save(); ctx.globalAlpha = this._flashFrames/6;
      ctx.fillStyle='#aaddff'; ctx.fillRect(0,0,G.CANVAS_W,G.CANVAS_H);
      ctx.restore();
    }
  } else if(this.state==='galaxy') {
    if(this.input.pressed('KeyM')) this.closeGalaxy();
    this.particles.update(dt);
    this.renderer.renderSpace(this);
    this.galaxy.draw(this.currentSysId);
  } else if(this.state==='landed') {
    this.renderer.renderSpace(this);
  } else {
    this.renderer.clear();
  }

  // Escape: close galaxy map or toggle options menu
  if(this.input.pressed('Escape')) {
    if(this.state==='galaxy') {
      this.closeGalaxy();
    } else if(this.state==='space' || this.state==='dead') {
      const opts=document.getElementById('options-overlay');
      if(opts) {
        if(opts.classList.contains('hidden')) opts.classList.remove('hidden');
        else opts.classList.add('hidden');
      }
    }
  }

  if(this.player && this.state!=='menu') {
    this.ui.updateHUD(this.player, this.space, this.target);
    this.ui.updateJumpRouteHUD(this.player, this.galaxy, this._jumpCooldown);
  }
  this.input.flush();
};

// ── Bootstrap ─────────────────────────────────────────────
window.addEventListener('load', () => {
  document.fonts.ready.then(()=>{
    const g = new G.Game();
    // Rebind _loop now that the override is in place
    g._loop = g._loop.bind(g);
    requestAnimationFrame(g._loop);
  }).catch(()=>{
    const g = new G.Game();
    g._loop = g._loop.bind(g);
    requestAnimationFrame(g._loop);
  });
});
