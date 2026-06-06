'use strict';
// ── Pixel-art Sprite Engine ───────────────────────────────────────────────────
// All ships: 32×32 px canvases, cached per (shapeId+color).
// Modules:    8×8 px icon canvases, cached per visual type.
// Aesthetic: WW2 fighter-plane × Star Wars hybrid.
// Ships point UP: y=0 = nose, y=31 = engines.
// ─────────────────────────────────────────────────────────────────────────────
G.Sprites = {
  SZ:  32,  // ship sprite size
  MSZ:  8,  // module icon size
  _cache: new Map(),

  // ── Public API ─────────────────────────────────────────
  get(shapeId, color) {
    const key = shapeId + (color || '#8899bb');
    if(this._cache.has(key)) return this._cache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = this.SZ;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const fn = this._ships[shapeId] || this._ships.shuttle;
    fn(ctx, color || '#8899bb');
    this._cache.set(key, c);
    return c;
  },

  getMod(visual) {
    const key = '__mod_' + visual;
    if(this._cache.has(key)) return this._cache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = this.MSZ;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    (this._mods[visual] || this._mods.special)(ctx);
    this._cache.set(key, c);
    return c;
  },

  TSZ: 10, // turret sprite size

  // Pre-rendered hull panel sprite for given shape/facing/color/size.
  // `curve` (right_triangle only): hypotenuse curvature, -1 concave … +1 convex.
  getHull(shape, facing, color, tileSize, curve = 0) {
    curve = Math.max(-1, Math.min(1, curve || 0));
    const key = `__hull_${shape}_${facing}_${color}_${tileSize | 0}_${curve.toFixed(2)}`;
    if(this._cache.has(key)) return this._cache.get(key);
    const SZ = tileSize | 0;
    const c = document.createElement('canvas');
    c.width = c.height = SZ;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const h = SZ / 2;
    const isCorner = facing >= 4;
    const rot = (isCorner ? facing - 4 : (facing || 0)) * Math.PI / 2;
    ctx.save();
    ctx.translate(h, h);
    if(rot) ctx.rotate(rot);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    if(isCorner) {
      if(shape === 'right_triangle') {
        ctx.moveTo(-h, h); ctx.lineTo(h, h);
        if(curve) ctx.quadraticCurveTo(curve * h, -curve * h, -h, -h);  // bowed hypotenuse
        else ctx.lineTo(-h, -h);
      } else if(shape === 'triangle') {
        ctx.moveTo(-h, 0); ctx.lineTo(0, -h);
        ctx.lineTo(h, -h); ctx.lineTo(h, h); ctx.lineTo(-h, h);
      } else if(shape === 'concave') {
        ctx.moveTo(-h, h); ctx.lineTo(h, h);
        ctx.bezierCurveTo(h * 0.5, -h * 0.3, -h * 0.5, -h * 0.3, -h, -h);
        ctx.lineTo(-h, h);
      } else if(shape === 'quarterround') {
        ctx.moveTo(-h, h); ctx.lineTo(h, h);
        ctx.bezierCurveTo(h * 0.5, h * 0.3, -h * 0.5, h * 0.3, -h, -h);
      } else {
        ctx.moveTo(-h, 0);
        ctx.arc(-h, -h, h, Math.PI / 2, 0, true);
        ctx.lineTo(h, -h); ctx.lineTo(h, h); ctx.lineTo(-h, h);
      }
    } else {
      if(shape === 'right_triangle') {
        ctx.moveTo(-h, h); ctx.lineTo(h, h);
        if(curve) ctx.quadraticCurveTo(curve * h, -curve * h, -h, -h);  // bowed hypotenuse
        else ctx.lineTo(-h, -h);
      } else if(shape === 'triangle') {
        ctx.moveTo(-h, h); ctx.lineTo(h, h); ctx.lineTo(0, -h);
      } else if(shape === 'quarterround') {
        ctx.moveTo(-h, h); ctx.lineTo(h, h);
        ctx.bezierCurveTo(h * 0.5, h * 0.3, -h * 0.5, h * 0.3, -h, -h);
      } else if(shape === 'concave') {
        ctx.moveTo(-h, h); ctx.lineTo(h, h);
        ctx.bezierCurveTo(h * 0.5, -h * 0.3, -h * 0.5, -h * 0.3, -h, -h);
      } else {
        ctx.rect(-h, -h, SZ, SZ);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // ── Panel surface detail ────────────────────────────────
    if(SZ >= 12) {
      ctx.save();
      ctx.clip(); // clip to the filled shape
      const p  = Math.max(1, (SZ / 16) | 0);
      const hi = this._sh(color, 60);
      const sh = this._sh(color, -60);

      // Raised bevel: bright top-left edge, dark bottom-right edge
      ctx.lineCap     = 'butt';
      ctx.lineWidth   = p;
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = hi;
      ctx.beginPath();
      ctx.moveTo(-h + p, h - p * 2); ctx.lineTo(-h + p, -h + p); ctx.lineTo(h - p * 2, -h + p);
      ctx.stroke();
      ctx.strokeStyle = sh;
      ctx.beginPath();
      ctx.moveTo(h - p, -h + p * 2); ctx.lineTo(h - p, h - p); ctx.lineTo(-h + p * 2, h - p);
      ctx.stroke();

      // Horizontal panel seam + rivets on flat square tiles only
      const isFlat = !isCorner && shape !== 'right_triangle' && shape !== 'triangle'
                  && shape !== 'quarterround'  && shape !== 'concave';
      if(isFlat && SZ >= 16) {
        const ly = Math.round(-h * 0.28);
        ctx.strokeStyle = sh;
        ctx.lineWidth   = Math.max(0.5, p * 0.75);
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.moveTo(-h + p * 3, ly); ctx.lineTo(h - p * 3, ly);
        ctx.stroke();
        if(SZ >= 20) {
          ctx.globalAlpha = 0.6;
          ctx.fillStyle = hi;
          const rv = p;
          ctx.fillRect(-h + p * 3,           ly - rv, rv * 2, rv * 2);
          ctx.fillRect( h - p * 3 - rv * 2,  ly - rv, rv * 2, rv * 2);
        }
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    ctx.restore();
    this._cache.set(key, c);
    return c;
  },

  getTurret() {
    const key = '__turret';
    if(this._cache.has(key)) return this._cache.get(key);
    const TSZ = this.TSZ;
    const c = document.createElement('canvas');
    c.width = c.height = TSZ;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const cx = TSZ / 2, cy = TSZ / 2;
    // Mounting ring base
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath(); ctx.arc(cx, cy + 1, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#484848';
    ctx.beginPath(); ctx.arc(cx, cy + 1, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a5a5a';
    ctx.beginPath(); ctx.arc(cx, cy + 1, 1.5, 0, Math.PI * 2); ctx.fill();
    // Barrel (points up = toward y=0, which is ship-forward)
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(cx - 1, 0, 2, cy);
    ctx.fillStyle = '#606060';
    ctx.fillRect(cx - 1, 0, 1, cy - 1); // left highlight
    // Barrel tip
    ctx.fillStyle = '#888888';
    ctx.fillRect(cx - 1, 0, 2, 2);
    this._cache.set(key, c);
    return c;
  },

  // ── Colour helpers ──────────────────────────────────────
  _sh(hex, d) {
    const cl = v => v < 0 ? 0 : v > 255 ? 255 : v|0;
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return `rgb(${cl(r+d)},${cl(g+d)},${cl(b+d)})`;
  },

  _rc(ctx, col, x, y, w, h) {
    if(!col) return;
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w === undefined ? 1 : w, h === undefined ? 1 : h);
  },

  // ── Module overlay slot positions ───────────────────────
  // (x, y) offsets from sprite centre (16,16) in sprite-space pixels.
  // Listed in the order modules will be assigned to positions.
  slotOffsets: {
    shuttle: {
      weapon:  [[0,-8]],
      engine:  [[0,9]],
      shield:  [[-6,0],[6,0]],
      cargo:   [[-3,3],[3,3]],
      fuel:    [[0,5]],
      jump:    [[0,0]],
      sensor:  [[0,-6]],
      power:   [[0,1]],
      crew:    [[0,2]],
      special: [[-4,4],[4,4]],
      armor:   [[-5,-1],[5,-1]],
      turret:  [[0,-5]],
    },
    scout: {
      weapon:  [[0,-9]],
      engine:  [[-4,10],[4,10]],
      shield:  [[0,-3]],
      cargo:   [[0,4]],
      fuel:    [[0,6]],
      jump:    [[0,1]],
      sensor:  [[0,-7]],
      power:   [[0,2]],
      crew:    [[0,3]],
      special: [[0,5]],
      armor:   [[-3,0],[3,0]],
      turret:  [[0,-5]],
    },
    fighter: {
      weapon:  [[-6,6],[6,6],[0,-8]],
      engine:  [[-4,10],[4,10]],
      shield:  [[0,0]],
      cargo:   [[0,4]],
      fuel:    [[0,5]],
      jump:    [[0,1]],
      sensor:  [[0,-6]],
      power:   [[0,2]],
      crew:    [[0,3]],
      special: [[-4,4],[4,4]],
      armor:   [[-5,1],[5,1]],
      turret:  [[0,-4]],
    },
    merchant: {
      weapon:  [[0,-8]],
      engine:  [[-7,9],[-3,9],[3,9],[7,9]],
      shield:  [[0,-2]],
      cargo:   [[-6,2],[0,2],[6,2]],
      fuel:    [[-5,5],[5,5]],
      jump:    [[0,4]],
      sensor:  [[0,-6]],
      power:   [[0,0]],
      crew:    [[0,1]],
      special: [[-3,5],[3,5]],
      armor:   [[-5,-1],[5,-1]],
      turret:  [[0,-5]],
    },
    gunboat: {
      weapon:  [[0,-9],[-6,-4],[6,-4]],
      engine:  [[-6,9],[6,9]],
      shield:  [[0,-1]],
      cargo:   [[0,3]],
      fuel:    [[-5,4],[5,4]],
      jump:    [[0,0]],
      sensor:  [[0,-7]],
      power:   [[0,2]],
      crew:    [[0,3]],
      special: [[-4,3],[4,3]],
      armor:   [[-6,0],[6,0]],
      turret:  [[0,-5],[0,0]],
    },
    corvette: {
      weapon:  [[-4,-9],[4,-9],[0,-6]],
      engine:  [[-6,10],[0,10],[6,10]],
      shield:  [[-5,0],[5,0]],
      cargo:   [[-3,3],[3,3]],
      fuel:    [[-4,5],[4,5]],
      jump:    [[0,2]],
      sensor:  [[0,-8]],
      power:   [[-5,1],[5,1]],
      crew:    [[0,4]],
      special: [[-3,2],[3,2]],
      armor:   [[-6,-1],[6,-1],[0,0]],
      turret:  [[0,-4],[0,4]],
    },
    freighter: {
      weapon:  [[-6,-8],[6,-8]],
      engine:  [[-7,10],[-3,10],[3,10],[7,10]],
      shield:  [[0,-2]],
      cargo:   [[-7,2],[-2,2],[2,2],[7,2],[0,5]],
      fuel:    [[-6,6],[6,6]],
      jump:    [[0,0]],
      sensor:  [[0,-7]],
      power:   [[-4,0],[4,0]],
      crew:    [[-4,3],[4,3]],
      special: [[-4,5],[4,5]],
      armor:   [[-6,0],[0,0],[6,0]],
      turret:  [[-4,-5],[4,-5]],
    },
    battlecruiser: {
      weapon:  [[-7,-9],[0,-9],[7,-9],[-5,-4],[5,-4],[0,0]],
      engine:  [[-7,10],[-3,10],[3,10],[7,10]],
      shield:  [[-5,0],[0,0],[5,0]],
      cargo:   [[-4,4],[4,4]],
      fuel:    [[-5,5],[5,5]],
      jump:    [[0,2]],
      sensor:  [[0,-8]],
      power:   [[-5,1],[0,1],[5,1]],
      crew:    [[-3,4],[3,4]],
      special: [[-3,3],[3,3]],
      armor:   [[-6,-2],[0,-2],[6,-2]],
      turret:  [[-5,-5],[0,-5],[5,-5],[0,5]],
    },
    carrier: {
      weapon:  [[-8,-8],[-3,-8],[3,-8],[8,-8]],
      engine:  [[-7,10],[-3,10],[3,10],[7,10]],
      shield:  [[-6,-2],[0,-2],[6,-2]],
      cargo:   [[-5,4],[5,4]],
      fuel:    [[-5,6],[5,6]],
      jump:    [[0,2]],
      sensor:  [[0,-9]],
      power:   [[-6,0],[0,0],[6,0]],
      crew:    [[-3,4],[0,4],[3,4]],
      special: [[-3,3],[0,3],[3,3]],
      armor:   [[-7,0],[0,0],[7,0]],
      turret:  [[-5,-5],[0,-5],[5,-5],[0,0],[0,5]],
    },
    dreadnought: {
      weapon:  [[-8,-9],[-4,-9],[0,-9],[4,-9],[8,-9],[-6,-3],[6,-3]],
      engine:  [[-7,11],[-3,11],[3,11],[7,11]],
      shield:  [[-6,-2],[0,-2],[6,-2],[0,0]],
      cargo:   [[-5,4],[5,4]],
      fuel:    [[-6,6],[6,6]],
      jump:    [[0,3]],
      sensor:  [[-4,-8],[4,-8]],
      power:   [[-5,1],[0,1],[5,1]],
      crew:    [[-3,4],[0,4],[3,4]],
      special: [[-3,3],[0,3],[3,3]],
      armor:   [[-7,-1],[0,-1],[7,-1],[0,1]],
      turret:  [[-5,-5],[-2,-5],[2,-5],[5,-5],[0,0]],
    },
    pirate_fighter: {
      weapon:  [[0,-8]],
      engine:  [[0,9]],
      shield:  [[0,0]],
      cargo:   [[0,4]],
      fuel:    [[0,5]],
      jump:    [[0,2]],
      sensor:  [[0,-6]],
      power:   [[0,1]],
      special: [[0,5]],
      armor:   [[0,-1]],
      turret:  [[0,-5]],
    },
    alien_fighter: {
      weapon:  [[0,-8]],
      engine:  [[0,9]],
      shield:  [[0,0]],
      cargo:   [[0,3]],
      fuel:    [[0,5]],
      jump:    [[0,1]],
      sensor:  [[0,-6]],
      power:   [[0,2]],
      special: [[0,4]],
      armor:   [[0,-1]],
      turret:  [[0,-5]],
    },
    alien_cruiser: {
      weapon:  [[-5,-9],[5,-9]],
      engine:  [[-5,9],[5,9]],
      shield:  [[0,-2],[0,2]],
      cargo:   [[0,3]],
      fuel:    [[-4,5],[4,5]],
      jump:    [[0,0]],
      sensor:  [[0,-7]],
      power:   [[-4,1],[4,1]],
      crew:    [[0,4]],
      special: [[-3,4],[3,4]],
      armor:   [[-6,0],[6,0]],
      turret:  [[0,-5]],
    },
    earth_shuttle: {
      weapon:  [[0,-8]],
      engine:  [[-4,12],[4,12]],
      shield:  [[0,-1]],
      cargo:   [[-4,2],[4,2],[-4,7],[4,7]],
      fuel:    [[-5,8],[5,8]],
      jump:    [[0,5]],
      sensor:  [[0,-6]],
      power:   [[0,1]],
      crew:    [[0,3]],
      special: [[-4,9],[4,9]],
      armor:   [[-5,0],[5,0]],
      turret:  [[0,-5]],
    },
    earth_patrol: {
      weapon:  [[-5,10],[5,10],[0,-8]],
      engine:  [[-4,12],[4,12]],
      shield:  [[0,-1]],
      cargo:   [[0,4]],
      fuel:    [[0,6]],
      jump:    [[0,1]],
      sensor:  [[0,-7]],
      power:   [[0,2]],
      crew:    [[0,3]],
      special: [[0,5]],
      armor:   [[-5,0],[5,0]],
      turret:  [[0,-4]],
    },
    rebel_fighter: {
      weapon:  [[-4,6],[4,6],[0,-8]],
      engine:  [[-3,11],[3,11]],
      shield:  [[0,0]],
      cargo:   [[0,4]],
      fuel:    [[0,5]],
      jump:    [[0,1]],
      sensor:  [[0,-6]],
      power:   [[0,2]],
      crew:    [[0,3]],
      special: [[0,5]],
      armor:   [[-5,1],[5,1]],
      turret:  [[0,-4]],
    },
    rebel_hauler: {
      weapon:  [[-7,2],[7,2]],
      engine:  [[-6,15],[0,14],[6,15]],
      shield:  [[0,-2]],
      cargo:   [[-5,5],[5,5],[-5,10],[5,10]],
      fuel:    [[-6,12],[6,12]],
      jump:    [[0,5]],
      sensor:  [[0,-6]],
      power:   [[-4,0],[4,0]],
      crew:    [[0,3]],
      special: [[-3,8],[3,8]],
      armor:   [[-6,0],[0,0],[6,0]],
      turret:  [[-4,-4],[4,-4]],
    },
  },

  // ── Ship drawing functions (32×32, pointing up) ─────────
  _ships: {
    // ── SHUTTLE: WW2 trainer + Star Wars Lambda shuttle ──
    shuttle(ctx, col) {
      const S = G.Sprites, H=col, D=S._sh(col,-55), L=S._sh(col,70);
      const C='#091420', Gx='#1a4488', E='#ff9922', M='#556677', W='#1a2a30';
      const r=(c,x,y,w,h)=>S._rc(ctx,c,x,y,w,h);
      // nose tip
      r(H,15,0,2,1); r(H,14,1,4,1); r(H,13,2,6,1);
      // cockpit bubble (y=3..5)
      r(H,13,3,1,3); r(H,18,3,1,3);
      r(C,14,3,4,3);
      r(Gx,14,3,2,1); r(Gx,14,4,1,1);
      r(L,13,3,1,1);
      // upper fuselage (y=6..9)
      r(M,12,6,1,1); r(H,13,6,6,1); r(M,19,6,1,1);
      r(M,12,7,1,3); r(H,13,7,6,3); r(M,19,7,1,3);
      r(L,13,7,1,1);
      r(H,11,9,10,1);
      // oval WW2-style wings (y=10..12)
      r(D,5,10,6,1);  r(H,11,10,10,1); r(D,21,10,6,1);
      r(D,4,11,7,1);  r(H,11,11,10,1); r(D,21,11,7,1);
      r(D,6,12,5,1);  r(H,11,12,10,1); r(D,21,12,5,1);
      r(L,5,10,1,1);  r(L,26,10,1,1);
      r(W,5,11,1,1);  r(W,26,11,1,1);  // wing gun nubs
      // lower body (y=13..20)
      r(H,11,13,10,2);
      r(H,12,15,8,1); r(M,12,15,1,1); r(M,19,15,1,1);
      r(H,12,16,8,3); r(M,12,16,1,3); r(M,19,16,1,3);
      r(M,13,18,6,1);
      r(H,13,19,6,1); r(H,13,20,6,1);
      // engine mount (y=21)
      r(W,13,21,6,1);
      // exhaust glow (y=22..26)
      r(E,14,22,4,2); r(E,15,24,2,1);
      r('#ffcc44',15,25,2,1); r('#ffee88',15,26,2,1);
    },

    // ── SCOUT: Mitsubishi A6M Zero + A-Wing hybrid ────────
    scout(ctx, col) {
      const S = G.Sprites, H=col, D=S._sh(col,-55), L=S._sh(col,70);
      const C='#091420', Gx='#1a4488', E='#ff9922', M='#556677', W='#1a2a30';
      const r=(c,x,y,w,h)=>S._rc(ctx,c,x,y,w,h);
      // slim pointed nose (y=0..4)
      r(H,15,0,2,1); r(H,15,1,2,1); r(H,14,2,4,1); r(H,14,3,4,1);
      r(L,15,0,1,1);
      // small cockpit (y=4..6)
      r(C,14,4,4,1); r(C,14,5,4,1);
      r(Gx,14,4,2,1);
      r(H,13,6,6,1); r(M,13,6,1,1); r(M,18,6,1,1);
      // upper body (y=7..9)
      r(H,13,7,6,3); r(M,13,7,1,3); r(M,18,7,1,3); r(L,13,7,1,1);
      // Crescent swept wings (Zero-style elliptical) — y=8..14
      r(D,9,8,4,1);   r(D,7,9,5,2);   r(D,5,11,4,2);  r(D,4,13,2,1);
      r(D,19,8,4,1);  r(D,20,9,5,2);  r(D,23,11,4,2); r(D,26,13,2,1);
      r(L,9,8,1,1);   r(L,22,8,1,1);   // leading edge
      r(W,4,13,2,1);  r(W,26,13,2,1);  // wingtip cannons
      // body through wings
      r(H,13,8,6,7); r(M,13,8,1,7); r(M,18,8,1,7);
      // lower body narrowing (y=15..20)
      r(H,14,15,4,1); r(H,14,16,4,5);
      r(M,14,16,1,5); r(M,17,16,1,5);
      r(M,15,19,2,1);
      // twin engine pods (y=21..27)
      r(W,12,21,4,2); r(W,16,21,4,2);
      r(E,12,23,4,3); r(E,16,23,4,3);
      r(E,13,26,2,1); r(E,17,26,2,1);
      r('#ffcc44',13,27,2,1); r('#ffcc44',17,27,2,1);
    },

    // ── FIGHTER: Focke-Wulf Fw 190 + X-Wing ───────────────
    fighter(ctx, col) {
      const S = G.Sprites, H=col, D=S._sh(col,-55), L=S._sh(col,70);
      const C='#091420', Gx='#1a4488', E='#ff9922', M='#556677', W='#1a2a30';
      const r=(c,x,y,w,h)=>S._rc(ctx,c,x,y,w,h);
      // radial-engine nose (y=0..2)
      r(H,15,0,2,2); r(H,14,2,4,1); r(L,15,0,1,1);
      // bubble canopy Fw190 style (y=3..6)
      r(H,13,3,6,1);
      r(H,13,4,1,3); r(H,18,4,1,3);
      r(C,14,4,4,3); r(Gx,14,4,2,2); r(L,14,4,2,1);
      // upper body (y=7..9)
      r(H,13,7,6,3); r(M,13,7,1,3); r(M,18,7,1,3); r(L,13,7,1,1);
      // X-Wing upper wing pair (y=9..11)
      r(D,5,9,8,1); r(D,19,9,8,1);
      r(D,4,10,9,2); r(D,19,10,9,2);
      r(L,5,9,2,1);  r(L,25,9,2,1);
      r(W,4,10,1,2); r(W,27,10,1,2);   // upper wingtip cannons
      // X-Wing lower wing pair (y=13..15), wider
      r(D,4,13,9,2); r(D,19,13,9,2);
      r(D,5,15,7,1); r(D,20,15,7,1);
      r(W,4,13,1,2); r(W,27,13,1,2);   // lower wingtip cannons
      // body through wings
      r(H,13,9,6,8); r(M,13,9,1,8); r(M,18,9,1,8);
      r(M,14,12,4,1);                   // horizontal panel
      // lower fuselage (y=17..21)
      r(H,13,17,6,5); r(M,13,17,1,5); r(M,18,17,1,5);
      r(M,14,20,4,1);
      // twin engines (y=22..27)
      r(W,12,22,4,2); r(W,16,22,4,2);
      r(E,12,24,4,3); r(E,16,24,4,3);
      r(E,12,27,8,1);
      r('#ffcc44',13,28,3,1); r('#ffcc44',17,28,3,1);
    },

    // ── MERCHANT: YT-1300 (Millennium Falcon) + B-17 ──────
    merchant(ctx, col) {
      const S = G.Sprites, H=col, D=S._sh(col,-55), L=S._sh(col,70);
      const C='#091420', Gx='#1a4488', E='#ff9922', M='#556677', W='#1a2a30';
      const r=(c,x,y,w,h)=>S._rc(ctx,c,x,y,w,h);
      // forward bumper
      r(H,9,0,5,1); r(H,8,1,6,1);
      // offset port-side cockpit (Falcon style)
      r(C,9,1,3,1); r(Gx,9,1,2,1);
      // disc body (y=2..13)
      r(H,7,2,18,1); r(M,7,2,1,1); r(M,24,2,1,1);
      r(H,6,3,20,1); r(M,6,3,1,1); r(M,25,3,1,1);
      for(let y=4;y<=13;y++) { r(H,6,y,20,1); }
      r(M,6,4,1,10); r(M,25,4,1,10); r(L,6,4,1,1);
      // cargo sections (darker insets)
      r(D,8,5,5,5); r(D,14,5,5,5); r(D,20,5,3,5);
      r(M,8,5,1,5);  r(M,12,5,1,5);
      r(M,14,5,1,5); r(M,18,5,1,5);
      r(M,8,9,4,1);  r(M,14,9,4,1);
      // aft narrowing (y=14..16)
      r(H,9,14,14,1); r(H,10,15,12,1); r(H,11,16,10,1);
      // 4 engine pods B-17 style (y=17..21)
      r(W,8,17,4,2);  r(W,13,17,3,2); r(W,16,17,3,2); r(W,20,17,4,2);
      r(E,8,19,4,4);  r(E,13,19,3,4); r(E,16,19,3,4); r(E,20,19,4,4);
      r('#ffcc44',8,23,4,1); r('#ffcc44',13,23,3,1);
      r('#ffcc44',16,23,3,1); r('#ffcc44',20,23,4,1);
    },

    // ── GUNBOAT: BTL Y-Wing + P-47 Thunderbolt ────────────
    gunboat(ctx, col) {
      const S = G.Sprites, H=col, D=S._sh(col,-55), L=S._sh(col,70);
      const C='#091420', Gx='#1a4488', E='#ff9922', M='#556677', W='#1a2a30';
      const r=(c,x,y,w,h)=>S._rc(ctx,c,x,y,w,h);
      // forward gun barrel (Y-Wing style)
      r(W,15,0,2,3); r(H,14,2,4,1);
      // P-47-style bubble canopy (y=3..6)
      r(H,12,3,8,1);
      r(H,12,4,1,3); r(H,19,4,1,3);
      r(C,13,4,6,3); r(Gx,13,4,3,2); r(M,16,4,3,2);
      r(L,12,3,1,1);
      // upper body (y=7..9)
      r(H,12,7,8,3); r(M,12,7,1,3); r(M,19,7,1,3); r(L,12,7,1,1);
      // twin nacelles (Y-Wing rings, y=4..22)
      r(D,7,4,5,20);  r(D,20,4,5,20);
      r(H,8,4,3,20);  r(H,21,4,3,20);
      r(M,7,4,1,20);  r(M,24,4,1,20);
      r(M,8,13,3,1);  r(M,21,13,3,1);  // Y-Wing ring bands
      r(M,8,17,3,1);  r(M,21,17,3,1);
      // wing root connecting nacelles (y=10..12)
      r(H,7,10,18,3); r(D,7,10,5,3); r(D,20,10,5,3);
      // central crew pod (y=13..20)
      r(H,12,13,8,8); r(M,12,13,1,8); r(M,19,13,1,8);
      r(W,13,16,6,2);  // weapon bay
      // nacelle exhausts (y=24..28)
      r(E,7,24,5,4);  r(E,20,24,5,4);
      r('#ffcc44',8,28,3,1); r('#ffcc44',21,28,3,1);
    },

    // ── CORVETTE: Corellian Corvette + Avro Lancaster ─────
    corvette(ctx, col) {
      const S = G.Sprites, H=col, D=S._sh(col,-55), L=S._sh(col,70);
      const C='#091420', Gx='#1a4488', E='#ff9922', M='#556677', W='#1a2a30';
      const r=(c,x,y,w,h)=>S._rc(ctx,c,x,y,w,h);
      // long pointed nose (y=0..4)
      r(H,15,0,2,1); r(H,14,1,4,1); r(H,13,2,6,1); r(H,13,3,6,1); r(L,15,0,1,1);
      // bridge (y=4..6)
      r(H,11,4,10,1);
      r(C,12,5,8,1); r(Gx,12,5,4,1);
      r(H,11,6,10,1);
      // upper hull (y=7..10)
      r(H,10,7,12,4); r(M,10,7,1,4); r(M,21,7,1,4); r(L,10,7,3,1);
      // body (y=11..20)
      r(H,10,11,12,10); r(M,10,11,1,10); r(M,21,11,1,10);
      r(M,11,15,10,1);    // panel line
      r(W,12,17,8,2);     // weapon bay
      // side wing nacelles (y=12..22)
      r(D,4,12,6,12); r(D,22,12,6,12);
      r(H,5,12,4,12); r(H,23,12,4,12);
      r(M,4,12,1,12); r(M,27,12,1,12);
      r(M,5,17,4,1);  r(M,23,17,4,1); // nacelle bands
      // pylon connection
      r(D,4,11,6,1); r(D,22,11,6,1);
      // aft hull (y=21..23)
      r(H,10,21,12,3); r(M,10,21,1,3); r(M,21,21,1,3);
      // triple engines (y=24..29)
      r(W,9,24,5,2); r(W,14,24,4,2); r(W,18,24,5,2);
      r(E,9,26,5,3); r(E,14,26,4,3); r(E,18,26,5,3);
      r('#ffcc44',10,29,3,1); r('#ffcc44',15,29,2,1); r('#ffcc44',19,29,3,1);
    },

    // ── FREIGHTER: Corellian bulk + B-24 Liberator ────────
    freighter(ctx, col) {
      const S = G.Sprites, H=col, D=S._sh(col,-55), L=S._sh(col,70);
      const C='#091420', Gx='#1a4488', E='#ff9922', M='#556677', W='#1a2a30';
      const r=(c,x,y,w,h)=>S._rc(ctx,c,x,y,w,h);
      // forward section
      r(H,10,0,12,1); r(H,9,1,14,1);
      r(C,10,1,4,1); r(Gx,10,1,2,1); // cockpit blister
      // massive flat hull (very wide, y=2..14)
      r(H,5,2,22,1); r(M,5,2,1,1); r(M,26,2,1,1);
      r(H,4,3,24,1); r(M,4,3,1,1); r(M,27,3,1,1);
      for(let y=4;y<=14;y++) { r(H,4,y,24,1); }
      r(M,4,4,1,11); r(M,27,4,1,11); r(L,4,4,1,1);
      // three cargo bay sections
      r(D,5,4,6,9);  r(D,12,4,8,9);  r(D,21,4,6,9);
      r(M,5,4,1,9);  r(M,10,4,1,9);  r(M,12,4,1,9);
      r(M,19,4,1,9); r(M,21,4,1,9);  r(M,26,4,1,9);
      r(M,5,12,6,1); r(M,12,12,8,1); r(M,21,12,6,1);
      r(L,4,3,1,1);
      // wing (y=15..16)
      r(H,4,15,24,2); r(M,4,15,1,2); r(M,27,15,1,2);
      // 4 engine pods (y=17..22)
      r(W,5,17,5,2);  r(W,11,17,4,2); r(W,16,17,4,2); r(W,22,17,5,2);
      r(E,5,19,5,4);  r(E,11,19,4,4); r(E,16,19,4,4); r(E,22,19,5,4);
      r('#ffcc44',6,23,3,1); r('#ffcc44',11,23,4,1); r('#ffcc44',23,23,3,1);
    },

    // ── BATTLECRUISER: Star Destroyer + Yamato battleship ─
    battlecruiser(ctx, col) {
      const S = G.Sprites, H=col, D=S._sh(col,-55), L=S._sh(col,70);
      const C='#091420', Gx='#1a4488', E='#ff9922', M='#556677', W='#1a2a30';
      const r=(c,x,y,w,h)=>S._rc(ctx,c,x,y,w,h);
      // pointed bow wedge
      r(H,15,0,2,1); r(H,14,1,4,1); r(H,13,2,6,1);
      r(H,12,3,8,2); r(L,15,0,1,1); r(L,14,1,2,1);
      // bridge tower
      r(H,14,5,4,4); r(C,14,5,4,2); r(Gx,14,5,2,1); r(D,14,7,4,2);
      // widening wedge hull (y=5..21)
      for(let y=5;y<=21;y++) {
        const hw = Math.min(Math.floor(2+(y-5)*0.75), 13);
        r(H, 16-hw, y, hw*2, 1);
        if(y>8) { r(M, 16-hw, y, 1, 1); r(M, 16+hw-1, y, 1, 1); }
      }
      // hull panel lines
      r(M,12,9,8,1); r(M,10,13,12,1); r(M,7,17,18,1);
      // weapon turrets (W colored, 2px dots)
      r(W,11,9,2,2);  r(W,19,9,2,2);
      r(W,9,13,2,2);  r(W,21,13,2,2);
      r(W,6,17,2,2);  r(W,24,17,2,2);
      r(W,14,11,4,2); // center battery
      // engine bank (y=22..28)
      r(W,6,22,20,2);
      r(E,6,24,5,4);  r(E,12,24,4,4); r(E,16,24,4,4); r(E,21,24,5,4);
      r('#ffcc44',7,28,3,1); r('#ffcc44',21,28,3,1);
      r('#ffee88',13,28,3,1); r('#ffee88',17,28,3,1);
    },

    // ── CARRIER: Venator-class + Midway-class fleet carrier ─
    carrier(ctx, col) {
      const S = G.Sprites, H=col, D=S._sh(col,-55), L=S._sh(col,70);
      const C='#091420', Gx='#1a4488', E='#ff9922', M='#556677', W='#1a2a30';
      const r=(c,x,y,w,h)=>S._rc(ctx,c,x,y,w,h);
      // forward hull wedge
      r(H,13,0,6,1); r(H,11,1,10,1); r(H,9,2,14,1); r(H,7,3,18,2);
      r(L,15,0,2,1); r(L,13,1,4,1);
      // island (starboard side bridge)
      r(H,21,3,5,5); r(C,21,3,5,2); r(Gx,21,3,3,1); r(D,22,5,4,3);
      // wide flight deck (y=5..16)
      for(let y=5;y<=16;y++) r(H,4,y,24,1);
      r(M,4,5,1,12); r(M,27,5,1,12); r(L,4,5,1,1);
      // flight deck markings
      r(M,5,8,22,1); r(M,5,13,22,1); r(M,15,5,1,12);
      // hangar bays (apertures on sides)
      r(C,4,7,4,5); r(C,24,7,4,5);
      r(W,4,7,1,5); r(W,27,7,1,5);
      // aft section
      r(H,6,17,20,1); r(H,8,18,16,1); r(H,10,19,12,1); r(H,11,20,10,1);
      // engine bank (y=21..27)
      r(W,4,21,24,2);
      r(E,4,23,6,4);  r(E,11,23,5,4); r(E,16,23,5,4); r(E,22,23,6,4);
      r('#ffcc44',4,27,6,1); r('#ffcc44',22,27,6,1);
      r('#ffee88',11,27,10,1);
    },

    // ── DREADNOUGHT: Executor-class + Bismarck scale ──────
    dreadnought(ctx, col) {
      const S = G.Sprites, H=col, D=S._sh(col,-55), L=S._sh(col,70);
      const C='#091420', Gx='#1a4488', E='#ff9922', M='#556677', W='#1a2a30';
      const r=(c,x,y,w,h)=>S._rc(ctx,c,x,y,w,h);
      // super-pointed bow
      r(H,15,0,2,1); r(H,14,1,4,1); r(H,13,2,6,1);
      r(H,12,3,8,1); r(H,11,4,10,1); r(H,10,5,12,1);
      r(L,15,0,1,1); r(L,14,1,2,1); r(L,13,2,2,1);
      // command superstructure
      r(H,14,5,4,5); r(C,14,5,4,2); r(Gx,14,5,2,1); r(D,14,7,4,3);
      // super-massive widening hull (y=6..22)
      for(let y=6;y<=22;y++) {
        const hw = Math.min(Math.floor(3+(y-6)*0.88), 13);
        r(H, 16-hw, y, hw*2, 1);
        if(y>9) { r(M, 16-hw, y, 1, 1); r(M, 16+hw-1, y, 1, 1); }
      }
      // extensive panel lines
      r(M,13,9,6,1);  r(M,11,12,10,1); r(M,8,15,16,1); r(M,5,18,22,1); r(M,4,21,24,1);
      // many weapon batteries
      r(W,13,9,2,2);  r(W,17,9,2,2);
      r(W,11,12,2,2); r(W,19,12,2,2);
      r(W,8,15,2,2);  r(W,22,15,2,2);
      r(W,5,18,2,2);  r(W,25,18,2,2);
      r(W,15,12,2,2); // center battery
      r(W,13,16,6,2); // super battery
      // four enormous engine pods (y=23..30)
      r(W,3,23,26,2);
      r(E,3,25,6,5);  r(E,10,25,6,5); r(E,16,25,6,5); r(E,23,25,6,5);
      r('#ffcc44',3,30,6,1); r('#ffcc44',23,30,6,1);
      r('#ffee88',10,30,6,1); r('#ffee88',16,30,6,1);
    },

    // ── EARTH_SHUTTLE: Government boxy transport ──────────
    earth_shuttle(ctx, col) {
      const S = G.Sprites, H=col, D=S._sh(col,-55), L=S._sh(col,70);
      const C='#091420', Gx='#1a4488', E='#ff9922', M='#556677', W='#1a2a30';
      const Wh='#ccd8ee'; // clean white highlight
      const r=(c,x,y,w,h)=>S._rc(ctx,c,x,y,w,h);
      // flat blunt prow (y=0..2)
      r(H,12,0,8,1); r(L,13,0,6,1);
      r(H,11,1,10,2);
      // panoramic cockpit windshield (y=3..5)
      r(H,10,3,12,1);
      r(C,11,4,10,1); r(Gx,11,4,5,1); r(Wh,11,4,2,1);
      r(H,10,5,12,1);
      // Earth Gov blue stripe (y=6)
      r(L,10,6,12,1); r(Wh,11,6,4,1);
      // main boxy hull (y=7..16)
      r(H,10,7,12,10); r(M,10,7,1,10); r(M,21,7,1,10); r(L,10,7,1,1);
      // front cargo/passenger compartment
      r(D,11,8,10,3); r(M,11,8,1,3); r(M,20,8,1,3); r(M,11,10,10,1);
      // rear section panels
      r(D,11,12,10,4); r(M,11,12,1,4); r(M,20,12,1,4); r(M,11,15,10,1);
      // docking port (starboard side, y=10..12)
      r(W,21,10,3,3); r(M,22,11,1,1);
      // gov side stripe
      r(L,10,9,1,2);
      // aft transition (y=17..19)
      r(H,11,17,10,3); r(M,11,17,1,3); r(M,20,17,1,3);
      // twin engine nozzles (y=20..27)
      r(W,11,20,5,2); r(W,16,20,5,2);
      r(E,11,22,5,4); r(E,16,22,5,4);
      r(E,12,26,3,1); r(E,17,26,3,1);
      r('#ffcc44',12,27,3,1); r('#ffcc44',17,27,3,1);
    },

    // ── EARTH_PATROL: Clean delta-wing patrol fighter ──────
    earth_patrol(ctx, col) {
      const S = G.Sprites, H=col, D=S._sh(col,-55), L=S._sh(col,70);
      const C='#091420', Gx='#1a4488', E='#ff9922', M='#556677', W='#1a2a30';
      const Wh='#ccd8ee'; // white trim
      const r=(c,x,y,w,h)=>S._rc(ctx,c,x,y,w,h);
      // sharp pointed nose (y=0..3)
      r(H,15,0,2,1); r(L,15,0,1,1);
      r(H,14,1,4,1); r(H,14,2,4,2);
      // narrow canopy (y=4..6)
      r(H,14,4,4,1);
      r(C,15,5,2,2); r(Gx,15,5,1,1); r(Wh,15,5,1,1);
      r(H,14,7,4,1);
      // slim upper body (y=8..10)
      r(H,14,8,4,3); r(M,14,8,1,3); r(M,17,8,1,3);
      // swept delta wings (y=8..16)
      r(D,12,8,2,1);  r(D,19,8,1,1);
      r(D,10,9,4,1);  r(D,18,9,4,1);
      r(D,8,10,6,1);  r(D,18,10,6,1);
      r(D,6,11,8,1);  r(D,18,11,8,1);
      r(D,5,12,9,2);  r(D,18,12,9,2);
      r(D,6,14,7,1);  r(D,19,14,7,1);
      r(D,8,15,5,1);  r(D,19,15,5,1);
      r(D,10,16,3,1); r(D,19,16,3,1);
      r(L,5,12,1,1);  r(L,26,12,1,1); // nav lights
      r(W,5,13,2,1);  r(W,25,13,2,1); // wingtip missiles
      // body through wings
      r(H,14,8,4,9); r(M,14,8,1,9); r(M,17,8,1,9);
      // Earth gov stripe
      r(L,14,11,4,1); r(Wh,15,11,2,1);
      // lower body (y=17..21)
      r(H,14,17,4,5); r(M,14,17,1,5); r(M,17,17,1,5);
      // twin engine pods (y=22..27)
      r(W,12,22,4,2); r(W,16,22,4,2);
      r(E,12,24,4,3); r(E,16,24,4,3);
      r(E,13,27,2,1); r(E,17,27,2,1);
    },

    // ── REBEL_FIGHTER: Scrappy modified fighter ────────────
    rebel_fighter(ctx, col) {
      const S = G.Sprites, H=col, D=S._sh(col,-55), L=S._sh(col,70);
      const C='#091420', Gx='#334488', E='#ff9922', M='#556677', W='#1a2a30';
      const Rb='#993300'; // rebellion dark orange
      const Ru='#5a3518'; // worn/rusted metal
      const r=(c,x,y,w,h)=>S._rc(ctx,c,x,y,w,h);
      // battered nose (y=0..3)
      r(H,15,0,2,1); r(L,15,0,1,1);
      r(H,14,1,4,1); r(H,13,2,6,1); r(H,14,3,4,1);
      // worn cockpit (y=4..6)
      r(H,13,4,6,1);
      r(C,14,5,4,2); r(Gx,14,5,2,1); r(Ru,16,6,1,1); // cracked glass
      r(H,13,7,6,1);
      // upper body (y=8..10)
      r(H,13,8,6,3); r(M,13,8,1,3); r(M,18,8,1,3);
      // scavenged swept wings (y=9..15)
      r(D,9,9,4,1);  r(D,19,9,4,1);
      r(D,7,10,6,1); r(D,19,10,6,1);
      r(D,5,11,8,2); r(D,19,11,8,2);
      r(D,6,13,7,1); r(D,19,13,7,1);
      r(D,8,14,5,1); r(D,19,14,5,1);
      r(D,10,15,3,1);r(D,19,15,3,1);
      r(Ru,6,11,2,1); r(Ru,24,11,2,1); // weld patches
      r(W,5,12,2,1);  r(W,25,12,2,1); // bolted-on gun pylons
      // body through wings
      r(H,13,9,6,7); r(M,13,9,1,7); r(M,18,9,1,7);
      // rebellion orange stripe
      r(Rb,14,12,4,1);
      // asymmetric gun pod (starboard, y=10..14)
      r(M,11,10,2,4); r(W,11,10,1,1);
      // lower body (y=16..20)
      r(H,13,16,6,5); r(M,13,16,1,5); r(M,18,16,1,5);
      r(Ru,14,18,2,1); // damage patch
      // mismatched twin engines (y=21..27)
      r(W,13,21,3,2); r(W,17,21,2,2);
      r(E,13,23,3,3); r(E,17,23,2,3);
      r('#cc6600',14,26,2,1); r('#cc6600',17,26,2,1);
      r(Ru,13,27,4,1); // exhaust discoloration
    },

    // ── REBEL_HAULER: Armed rebel supply ship ─────────────
    rebel_hauler(ctx, col) {
      const S = G.Sprites, H=col, D=S._sh(col,-55), L=S._sh(col,70);
      const C='#091420', Gx='#334488', E='#ff9922', M='#556677', W='#1a2a30';
      const Rb='#993300'; // rebellion orange-red
      const Ru='#5a3518'; // worn metal
      const r=(c,x,y,w,h)=>S._rc(ctx,c,x,y,w,h);
      // wide blunt prow (y=0..2)
      r(H,9,0,14,1); r(L,10,0,10,1);
      r(H,8,1,16,2);
      // offset port cockpit (y=3..5)
      r(C,9,3,4,1); r(Gx,9,3,2,1);
      r(H,8,4,16,2); r(C,9,4,4,1); r(Gx,9,4,2,1);
      // rebellion livery stripe across bow (y=6)
      r(Rb,8,6,16,1); r(L,9,6,6,1);
      // main wide hull (y=7..15)
      r(H,7,7,18,9); r(M,7,7,1,9); r(M,24,7,1,9); r(L,7,7,1,1);
      // two cargo bay sections
      r(D,8,8,7,6);  r(D,16,8,7,6);
      r(M,8,8,1,6);  r(M,14,8,1,6); r(M,16,8,1,6); r(M,22,8,1,6);
      r(M,8,13,7,1); r(M,16,13,7,1);
      // rebellion stripe across hull
      r(Rb,7,11,18,1);
      // side gun pods (y=4..9)
      r(W,5,4,2,6);  r(W,25,4,2,6);
      r(M,4,6,1,2);  r(M,27,6,1,2); // barrels
      r(Ru,5,5,2,2); r(Ru,25,5,2,2); // rough mounts
      // aft section (y=16..19)
      r(H,8,16,16,4); r(M,8,16,1,4); r(M,23,16,1,4);
      r(Rb,9,18,14,1); // aft stripe
      // triple engine block (y=20..27)
      r(W,7,20,6,2);  r(W,14,20,4,2); r(W,19,20,6,2);
      r(E,7,22,6,4);  r(E,14,22,4,4); r(E,19,22,6,4);
      r('#cc6600',8,26,4,1); r('#cc6600',14,26,4,1); r('#cc6600',20,26,4,1);
      r(Ru,7,27,6,1); // exhaust discoloration
    },

    // ── PIRATE_FIGHTER: Battered Bf 109 + salvaged TIE ───
    pirate_fighter(ctx, col) {
      const S = G.Sprites, H=col, D=S._sh(col,-55), L=S._sh(col,70);
      const C='#091420', Gx='#1a4488', E='#ff9922', M='#556677', W='#1a2a30';
      const Ru='#6a2a18'; // rust/damage
      const r=(c,x,y,w,h)=>S._rc(ctx,c,x,y,w,h);
      // asymmetric nose (battle-damaged)
      r(H,15,0,2,1); r(H,14,1,4,1); r(H,13,2,6,1);
      // small scratched cockpit
      r(H,13,3,6,1); r(H,13,4,1,3); r(H,18,4,1,3);
      r(C,14,4,4,3); r(Gx,14,4,2,1); r(Ru,16,4,1,1); // cracked glass
      // mismatched wings — left shorter (salvaged)
      r(D,6,8,7,2);   r(D,19,8,9,2);   // asymmetric!
      r(L,6,8,1,1);   r(L,26,8,1,1);
      r(W,6,9,1,1);   r(W,27,9,1,1);
      r(Ru,7,8,2,1);  r(Ru,20,8,2,1);  // rust patches
      // body (patchy, weld scars)
      r(H,13,7,6,10); r(M,13,7,1,10); r(M,18,7,1,10);
      r(Ru,14,10,2,1); r(D,15,13,2,1); // damage patches
      r(M,14,15,4,1);  // repair seam
      // rough single engine (y=17..24)
      r(W,14,17,4,2);
      r(E,14,19,4,3); r(E,15,22,2,2);
      r('#cc8811',15,24,2,1);  // dirty exhaust
      r(Ru,14,25,4,1);
    },

    // ── ALIEN_FIGHTER: Organic insectoid bio-fighter ──────
    alien_fighter(ctx, col) {
      const S = G.Sprites, H=col, D=S._sh(col,-55), L=S._sh(col,90);
      const E='#00ff88', E2='#006644', M='#002a1a', W='#001010';
      const r=(c,x,y,w,h)=>S._rc(ctx,c,x,y,w,h);
      // sensor cluster nose (no cockpit)
      r(E2,15,0,2,1); r(H,15,1,2,2); r(H,14,3,4,1);
      // bio-core (y=4..8)
      r(H,13,4,6,5); r(M,13,4,1,5); r(M,18,4,1,5);
      r(E,14,5,4,3); r(E2,15,5,2,1);
      // organic swept wings — insect limb style (y=6..16)
      r(D,9,6,4,1);  r(D,7,7,6,1);  r(D,5,8,6,2);  r(D,4,10,5,2); r(D,5,12,4,2); r(D,7,14,3,1);
      r(D,19,6,4,1); r(D,19,7,6,1); r(D,21,8,6,2);  r(D,23,10,5,2); r(D,23,12,4,2); r(D,22,14,3,1);
      r(E2,5,9,2,1); r(E2,25,9,2,1); // bio-light nodes on wings
      // body through wings
      r(H,13,6,6,10); r(M,13,6,1,10); r(M,18,6,1,10);
      // bio-engine (y=16..25)
      r(H,13,16,6,4); r(E,14,20,4,4); r(E2,15,24,2,2); r(E,14,26,4,1);
    },

    // ── ALIEN_CRUISER: Multi-lobe organic cruiser ─────────
    alien_cruiser(ctx, col) {
      const S = G.Sprites, H=col, D=S._sh(col,-55), L=S._sh(col,90);
      const E='#00ff88', E2='#006644', M='#002a1a', W='#001010';
      const r=(c,x,y,w,h)=>S._rc(ctx,c,x,y,w,h);
      // fore sensor array
      r(E2,14,0,4,1); r(H,13,1,6,2); r(E,14,2,4,1);
      // central bio-hull (y=3..9)
      r(H,11,3,10,1); r(H,10,4,12,6);
      r(M,10,4,1,6); r(M,21,4,1,6);
      r(E,12,5,8,4); r(E2,13,5,6,2);
      // secondary hull lobes (y=5..13)
      r(D,5,5,5,9);  r(D,22,5,5,9);
      r(H,6,5,3,9);  r(H,23,5,3,9);
      r(E2,6,9,2,2); r(E2,24,9,2,2); // bio-lights on lobes
      // connecting struts
      r(D,5,4,5,1); r(D,22,4,5,1);
      r(D,5,13,5,1); r(D,22,13,5,1);
      // central body (y=10..17)
      r(H,10,10,12,8); r(M,10,10,1,8); r(M,21,10,1,8);
      r(M,11,14,10,1);
      // tendrils (y=13..20)
      r(D,3,13,7,2); r(D,22,13,7,2);
      r(D,2,15,5,3); r(D,25,15,5,3);
      r(E2,3,14,2,1); r(E2,27,14,2,1);
      // bio-engine cluster (y=18..26)
      r(H,10,18,12,3); r(W,9,21,14,2);
      r(E,8,23,6,4);  r(E,18,23,6,4);
      r(E,13,23,6,4);
      r(E2,10,27,4,2); r(E2,18,27,4,2);
    },
  },

  // ── Module icon functions (8×8 pixels) ──────────────────
  // Each glyph is a recognizable silhouette on a dark bg so it reads at a
  // glance when scaled up into outfitter cards and ship-builder slots.
  // BG = standard dark backdrop; symbol icons share it, hull fills solid.
  _mods: {
    // Rocket nozzle firing a long downward flame — thrust/propulsion.
    engine(ctx) {
      const r=(c,x,y,w,h)=>G.Sprites._rc(ctx,c,x,y,w,h);
      r('rgba(0,0,0,0.7)',0,0,8,8);
      r('#6a7a8a',3,0,2,1);            // mount neck
      r('#8a9aaa',2,1,4,1);            // bell shoulders
      r('#9fb0c2',1,2,6,1);            // bell rim (widest)
      r('#c2d0de',1,1,1,2);            // left edge highlight
      r('#5a6a7a',6,2,1,1);            // right edge shadow
      r('#ff7a11',1,3,6,1);            // flame mouth (wide, hot orange)
      r('#ff9c22',2,4,4,1);            // flame body
      r('#ffc844',2,5,4,1);            // hotter
      r('#ffec99',3,6,2,1);           // flame core
      r('#ffffff',3,7,2,1);           // white tip
    },
    // Heraldic energy crest tapering to a point — deflector shield.
    shield(ctx) {
      const r=(c,x,y,w,h)=>G.Sprites._rc(ctx,c,x,y,w,h);
      r('rgba(0,0,0,0.7)',0,0,8,8);
      r('#2f6fd8',1,0,6,1);            // crest top
      r('#2f6fd8',1,1,6,3);            // upper body
      r('#2f6fd8',2,4,4,1);
      r('#2f6fd8',2,5,4,1);
      r('#2f6fd8',3,6,2,1);            // taper to point
      r('#5f9bff',2,1,3,3);            // lit face
      r('#bcd8ff',2,0,2,1);            // top sheen
      r('#9cc0ff',2,1,1,3);           // left edge light
      r('#1a4aa0',5,1,1,4);           // right shade
    },
    // Tall shipping container, cross strapping and corner studs — cargo.
    cargo(ctx) {
      const r=(c,x,y,w,h)=>G.Sprites._rc(ctx,c,x,y,w,h);
      r('rgba(0,0,0,0.7)',0,0,8,8);
      r('#9a7440',1,0,6,8);            // crate face (full height)
      r('#be945a',1,0,6,1);            // top-lit edge
      r('#6a4a22',1,7,6,1);            // base shadow
      r('#5a3a1a',3,0,2,8);            // vertical strap
      r('#5a3a1a',1,3,6,2);            // horizontal strap
      r('#caa468',1,0,1,1); r('#caa468',6,0,1,1);  // corner studs
      r('#caa468',1,7,1,1); r('#caa468',6,7,1,1);
    },
    // Pressurised tank with a green fuel-level droplet readout — fuel.
    fuel(ctx) {
      const r=(c,x,y,w,h)=>G.Sprites._rc(ctx,c,x,y,w,h);
      r('rgba(0,0,0,0.7)',0,0,8,8);
      r('#9aaaba',2,0,4,1);            // filler cap
      r('#808fa0',1,1,6,7);            // tank body
      r('#b2bece',1,1,1,7);            // left highlight
      r('#566678',6,1,1,7);            // right shadow
      r('#3a4654',1,2,6,1);            // top band
      r('#33cc66',3,3,2,1);            // droplet top
      r('#33cc66',2,4,4,2);            // droplet body
      r('#33cc66',3,6,2,1);            // droplet base
      r('#8fffb8',3,4,1,1);           // droplet shine
    },
    // Glowing hyperspace ring portal with a collapsing core — jump drive.
    jump(ctx) {
      const r=(c,x,y,w,h)=>G.Sprites._rc(ctx,c,x,y,w,h);
      r('rgba(0,0,0,0.7)',0,0,8,8);
      r('#bb44ee',2,0,4,1); r('#bb44ee',2,7,4,1);  // ring top/bottom
      r('#bb44ee',0,2,1,4); r('#bb44ee',7,2,1,4);  // ring left/right
      r('#bb44ee',1,1,1,1); r('#bb44ee',6,1,1,1);  // rounded corners
      r('#bb44ee',1,6,1,1); r('#bb44ee',6,6,1,1);
      r('#7722bb',2,1,4,6);            // inner field
      r('#7722bb',1,2,6,4);
      r('#e6a6ff',3,3,2,2);           // glowing core
      r('#ffffff',4,3,1,1);
    },
    // Forked lightning bolt — energy/reactor output.
    power(ctx) {
      const r=(c,x,y,w,h)=>G.Sprites._rc(ctx,c,x,y,w,h);
      r('rgba(0,0,0,0.7)',0,0,8,8);
      r('#ffe033',4,0,2,2);            // bolt head
      r('#ffe033',3,2,2,1);            // upper diagonal
      r('#ffe033',2,3,3,1);            // mid kink
      r('#ffe033',4,3,1,2);
      r('#ffe033',3,5,2,1);            // lower diagonal
      r('#ffe033',2,6,2,2);            // bolt tail
      r('#fff79a',4,0,1,2);           // spark highlight
      r('#c9a800',3,3,1,1);           // inner shadow
    },
    // Round head over broad shoulders — crew quarters/personnel.
    crew(ctx) {
      const r=(c,x,y,w,h)=>G.Sprites._rc(ctx,c,x,y,w,h);
      r('rgba(0,0,0,0.7)',0,0,8,8);
      r('#d6dee6',3,0,2,2);            // head
      r('#eef3f8',3,0,1,1);           // head highlight
      r('#7d8d9d',2,3,4,4);           // torso
      r('#8d9dad',1,4,6,2);           // shoulders (wider)
      r('#9dadbd',2,3,2,1);           // chest light
      r('#5a6a7a',1,7,6,1);           // base shadow
    },
    // Dish aimed up with rising signal pips — sensors/detection.
    sensor(ctx) {
      const r=(c,x,y,w,h)=>G.Sprites._rc(ctx,c,x,y,w,h);
      r('rgba(0,0,0,0.7)',0,0,8,8);
      r('#44ddff',5,0,1,1);            // signal pips
      r('#44ddff',6,1,1,1);
      r('#44ddff',7,2,1,1);
      r('#c2d2e2',1,3,5,1);            // dish rim
      r('#a0b2c4',1,4,5,1);           // dish bowl
      r('#8898aa',2,5,3,1);
      r('#dce8f4',4,2,1,1);           // feed horn
      r('#6a7a8a',3,6,1,2);           // mast/base
    },
    // Toothed cog with hub bore — generic utility/special module.
    special(ctx) {
      const r=(c,x,y,w,h)=>G.Sprites._rc(ctx,c,x,y,w,h);
      r('rgba(0,0,0,0.7)',0,0,8,8);
      r('#ffb733',3,0,2,1);            // top tooth
      r('#ffb733',3,7,2,1);            // bottom tooth
      r('#ffb733',0,3,1,2);            // left tooth
      r('#ffb733',7,3,1,2);            // right tooth
      r('#ffb733',1,1,1,1); r('#ffb733',6,1,1,1);  // diagonal teeth
      r('#ffb733',1,6,1,1); r('#ffb733',6,6,1,1);
      r('#ffd070',2,2,4,4);            // gear ring body
      r('#ffe0a0',2,2,2,1);           // top-left sheen
      r('rgba(0,0,0,0.85)',3,3,2,2);  // hub bore
    },
    // Heavy double-bevelled plate with a ridge and rivets — armour.
    armor(ctx) {
      const r=(c,x,y,w,h)=>G.Sprites._rc(ctx,c,x,y,w,h);
      r('rgba(0,0,0,0.7)',0,0,8,8);
      r('#48586a',1,0,6,8);            // plate (full height)
      r('#6a7c90',1,0,6,1);            // top bevel light
      r('#6a7c90',1,0,1,8);            // left bevel light
      r('#28384a',6,0,1,8);           // right shadow
      r('#28384a',1,7,6,1);           // bottom shadow
      r('#5a6c80',1,3,6,1);           // mid ridge
      r('#34465a',1,4,6,1);           // ridge shadow
      r('#8a9cb0',2,1,1,1); r('#8a9cb0',5,1,1,1);  // rivets
      r('#8a9cb0',2,5,1,1); r('#8a9cb0',5,5,1,1);
    },
    // Ship outer hull — full-bleed steel-blue plating whose seams run edge
    // to edge so panels read as one continuous casing when placed together.
    // No dark backdrop; matches the ship's structural hull tone.
    hull(ctx) {
      const r=(c,x,y,w,h)=>G.Sprites._rc(ctx,c,x,y,w,h);
      r('#7d8db0',0,0,8,8);            // full-bleed hull fill
      r('#94a4c6',0,0,8,1);            // top edge ambient light
      r('#5a6a8c',0,7,8,1);            // bottom edge shadow
      r('#8b9bbe',0,2,8,1);            // plating seam highlight (spans width)
      r('#5a6a8c',0,3,8,1);            // plating seam shadow
      r('#6f7fa2',0,5,8,1);            // lower micro-seam
      r('#46567c',2,1,1,1); r('#46567c',5,6,1,1);  // sparse offset rivets
    },
    // Fixed forward gun — barrel up with a hot muzzle, breech and mount below.
    weapon(ctx) {
      const r=(c,x,y,w,h)=>G.Sprites._rc(ctx,c,x,y,w,h);
      r('rgba(0,0,0,0.7)',0,0,8,8);
      r('#8a9aaa',3,0,2,4);            // barrel
      r('#aab8c6',3,0,1,4);            // barrel highlight
      r('#cfd8e0',3,0,2,1);            // muzzle
      r('#ff5544',3,1,2,1);           // muzzle energy glow
      r('#46586a',2,4,4,3);           // breech body
      r('#637588',2,4,4,1);           // breech top edge
      r('#28384a',2,6,4,2);           // mount base
    },
    // Rotating turret — domed housing with twin barrels on a base.
    turret(ctx) {
      const r=(c,x,y,w,h)=>G.Sprites._rc(ctx,c,x,y,w,h);
      r('rgba(0,0,0,0.7)',0,0,8,8);
      r('#3a4a5a',2,0,1,3); r('#3a4a5a',5,0,1,3);  // twin barrels
      r('#cfd8e0',2,0,1,1); r('#cfd8e0',5,0,1,1);  // barrel tips
      r('#5a6c7e',2,3,4,2);           // dome
      r('#8aa0b6',3,3,2,1);           // dome highlight
      r('#46586a',1,5,6,2);           // base
      r('#28384a',1,6,6,1);           // base shadow
    },
    // Missile turret — central barrel flanked by red-tipped missile pods.
    missile_turret(ctx) {
      const r=(c,x,y,w,h)=>G.Sprites._rc(ctx,c,x,y,w,h);
      r('rgba(0,0,0,0.7)',0,0,8,8);
      r('#46586a',1,5,6,2);           // base plate
      r('#637588',1,4,6,1);           // base top edge
      r('#28384a',1,6,6,1);           // base shadow
      r('#5a6c7e',3,2,2,3);           // center barrel
      r('#8aa0b6',3,2,1,1);           // barrel highlight
      r('#cc5500',1,1,2,4); r('#cc5500',5,1,2,4);  // missile pods
      r('#ff8800',1,1,1,4); r('#ff8800',5,1,1,4);  // pod highlight
      r('#ff4444',1,1,2,1); r('#ff4444',5,1,2,1);  // red warheads
    },
  },
};

// ── Ship Photo Images ────────────────────────────────────────────────────────
// Maps shapeId → path in ship_images/. Add entries here to enable photo sprites
// for any ship type. Images are center-cropped to square, resized to 128×128,
// and have near-black pixels made transparent (black-background removal).
// Falls back to pixel-art sprite when image is absent or still loading.
G.ShipImages = {
  // Map entries: string path → black-bg removal applied
  //              { path, preAlpha: true } → already transparent, skip bg removal
  _map: {
    shuttle: 'ship_images/shuttle.png',
    fighter: 'ship_images/fighter.jpg',
    frigate: 'ship_images/frigate.png',
    tanker:  'ship_images/fuel_tanker.png',
    miner:   { path: 'ship_images/mining_vessel.png', preAlpha: true },
  },
  _canvases: new Map(),

  init() {
    for (const [shapeId, entry] of Object.entries(this._map)) {
      const path     = typeof entry === 'string' ? entry : entry.path;
      const preAlpha = typeof entry === 'object' && !!entry.preAlpha;
      const img = new Image();
      img.onload = () => {
        const c = this._process(img, preAlpha);
        if (c) this._canvases.set(shapeId, c);
      };
      img.src = path;
    }
  },

  _process(img, preAlpha = false) {
    const TARGET = 128;
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) return null;
    // Contain-fit the entire image into the square (no cropping); aspect preserved,
    // unused space stays transparent.
    const scale = TARGET / Math.max(w, h);
    const dw = w * scale, dh = h * scale;
    const dx = ((TARGET - dw) / 2) | 0, dy = ((TARGET - dh) / 2) | 0;
    const c = document.createElement('canvas');
    c.width = c.height = TARGET;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h, dx, dy, dw, dh);
    if (!preAlpha) {
      const id = ctx.getImageData(0, 0, TARGET, TARGET);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const lum = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
        if      (lum < 30) { d[i+3] = 0; }
        else if (lum < 80) { d[i+3] = ((lum - 30) / 50 * 255) | 0; }
      }
      ctx.putImageData(id, 0, 0);
    }
    return c;
  },

  has(shapeId) { return this._canvases.has(shapeId); },
  get(shapeId) { return this._canvases.get(shapeId) || null; },
};

G.ShipImages.init();
