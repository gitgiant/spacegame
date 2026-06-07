'use strict';
// ── Pixel-art Sprite Engine ───────────────────────────────────────────────────
// All ships: 32×32 px canvases, cached per (shapeId+color).
// Modules:    8×8 px icon canvases, cached per visual type.
// Aesthetic: WW2 fighter-plane × Star Wars hybrid.
// Ships point UP: y=0 = nose, y=31 = engines.
// ─────────────────────────────────────────────────────────────────────────────
G.Sprites = {
  SZ:  32,  // ship sprite size
  MSZ: 16,  // module icon size (drawn inside hex tiles)
  HEXTILE: 48, // internal resolution of a composed hex module tile
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

  // Build a pointy-top hex path centred in an SZ×SZ canvas (radius = SZ/2 − inset).
  // Tip points vertically (vertex at −90° = top).
  _hexTilePath(ctx, SZ, inset = 0) {
    const cx = SZ / 2, cy = SZ / 2, R = SZ / 2 - inset;
    ctx.beginPath();
    for(let i = 0; i < 6; i++) {
      const a = Math.PI / 180 * (60 * i - 90);
      const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  },

  // Pre-rendered flat-top hex hull-panel sprite: solid colour + bevel, seam,
  // and rivets so adjacent panels read as one continuous plated casing.
  getHull(color, tileSize) {
    const SZ = tileSize | 0;
    const key = `__hull_${color}_${SZ}`;
    if(this._cache.has(key)) return this._cache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = SZ;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const hi = this._sh(color, 55), sh = this._sh(color, -60);
    const p = Math.max(1, (SZ / 14) | 0);

    this._hexTilePath(ctx, SZ, 0);
    ctx.fillStyle = color; ctx.fill();

    ctx.save();
    this._hexTilePath(ctx, SZ, 0); ctx.clip();
    // Top ambient light / bottom shadow bands
    ctx.globalAlpha = 0.5; ctx.fillStyle = hi; ctx.fillRect(0, 0, SZ, p);
    ctx.fillStyle = sh; ctx.fillRect(0, SZ - p, SZ, p);
    // Horizontal plating seam through the middle + rivets
    if(SZ >= 16) {
      ctx.globalAlpha = 0.35; ctx.fillStyle = sh;
      ctx.fillRect(SZ * 0.22, Math.round(SZ * 0.42), SZ * 0.56, Math.max(1, p * 0.6));
      ctx.globalAlpha = 0.6; ctx.fillStyle = hi;
      const rv = Math.max(1, (p * 0.8) | 0);
      ctx.fillRect(SZ * 0.26 | 0, SZ * 0.4 | 0, rv, rv);
      ctx.fillRect((SZ * 0.72) | 0, SZ * 0.4 | 0, rv, rv);
    }
    ctx.globalAlpha = 1; ctx.restore();

    // Crisp edge outline
    this._hexTilePath(ctx, SZ, Math.max(0.5, SZ / 48));
    ctx.lineWidth = Math.max(1, SZ / 28); ctx.strokeStyle = this._sh(color, -25); ctx.stroke();

    this._cache.set(key, c);
    return c;
  },

  // Composed hex tile for an inner module: slot-tinted hex backdrop + ring,
  // with the module glyph clipped inside. `color` = slot ring colour.
  getHexTile(visual, color, broken) {
    const SZ = this.HEXTILE;
    const key = `__hex_${visual}_${color}_${broken ? 1 : 0}`;
    if(this._cache.has(key)) return this._cache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = SZ;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    if(visual === 'hull') {
      const src = this.getHull(color, SZ);
      ctx.drawImage(src, 0, 0);
      this._cache.set(key, c);
      return c;
    }

    ctx.save();
    this._hexTilePath(ctx, SZ, 0);
    ctx.fillStyle = '#0c1a26'; ctx.fill();             // dark base
    ctx.fillStyle = color; ctx.globalAlpha = 0.22; ctx.fill(); // slot tint
    ctx.globalAlpha = 1;
    ctx.clip();
    const icon = this.getMod(visual);
    const isz = SZ * 0.62, off = (SZ - isz) / 2;
    if(broken) ctx.globalAlpha = 0.35;
    ctx.drawImage(icon, off | 0, (off + SZ * 0.02) | 0, isz | 0, isz | 0);
    ctx.globalAlpha = 1;
    ctx.restore();

    // Slot-coloured hex ring
    this._hexTilePath(ctx, SZ, Math.max(0.5, SZ / 48));
    ctx.lineWidth = Math.max(1, SZ / 26); ctx.strokeStyle = color; ctx.stroke();
    if(broken) {
      this._hexTilePath(ctx, SZ, SZ * 0.18);
      ctx.strokeStyle = '#ff4433'; ctx.lineWidth = Math.max(1, SZ / 24); ctx.stroke();
    }

    this._cache.set(key, c);
    return c;
  },

  CSZ: 8,  // crew character sprite size

  // Tiny overhead person: faction-colored body, walk animation.
  // isCaptain: gold head + rank stripe to distinguish from crew.
  getCrewSprite(color, walkFrame, isCaptain) {
    const f = (walkFrame || 0) & 1;
    const cap = isCaptain ? 1 : 0;
    const key = `__crew_${color}_${f}_${cap}`;
    if(this._cache.has(key)) return this._cache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = this.CSZ;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const r = (col, x, y, w, h) => this._rc(ctx, col, x, y, w, h);
    const head = isCaptain ? '#ffdd44' : '#f0d090';
    const hi   = this._sh(color,  55);
    const sh   = this._sh(color, -70);
    // head 2×2 centered; captain gets gold head
    r(head, 3, 0, 2, 2);
    r(this._sh(head, -30), 4, 1, 1, 1);
    // captain rank stripe: bright pixel on top of head
    if(isCaptain) r('#ffffff', 3, 0, 2, 1);
    // torso / shoulders
    r(color, 2, 2, 4, 3);
    r(hi,    2, 2, 1, 1);
    r(sh,    5, 2, 1, 3);
    // legs alternate
    if(f === 0) { r(sh, 2, 5, 1, 3); r(sh, 5, 5, 1, 3); }
    else        { r(sh, 3, 5, 1, 3); r(sh, 4, 5, 1, 3); }
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
      r(W,12,21,6,1);
      // exhaust glow (y=22..26)
      r(E,13,22,4,2); r(E,14,24,2,1);
      r('#ffcc44',14,25,2,1); r('#ffee88',14,26,2,1);
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
      r(W,10,21,4,2); r(W,18,21,4,2);
      r(E,10,23,4,3); r(E,18,23,4,3);
      r(E,11,26,2,1); r(E,19,26,2,1);
      r('#ffcc44',11,27,2,1); r('#ffcc44',19,27,2,1);
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
      r(W,10,22,4,2); r(W,18,22,4,2);
      r(E,10,24,4,3); r(E,18,24,4,3);
      r(E,10,27,4,1); r(E,18,27,4,1);
      r('#ffcc44',11,28,2,1); r('#ffcc44',19,28,2,1);
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
      r(W,7,17,4,2);  r(W,12,17,3,2); r(W,17,17,3,2); r(W,22,17,4,2);
      r(E,7,19,4,4);  r(E,12,19,3,4); r(E,17,19,3,4); r(E,22,19,4,4);
      r('#ffcc44',7,23,4,1); r('#ffcc44',12,23,3,1);
      r('#ffcc44',17,23,3,1); r('#ffcc44',22,23,4,1);
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
      r(D,7,4,5,20);  r(D,19,4,5,20);
      r(H,8,4,3,20);  r(H,20,4,3,20);
      r(M,7,4,1,20);  r(M,23,4,1,20);
      r(M,8,13,3,1);  r(M,20,13,3,1);  // Y-Wing ring bands
      r(M,8,17,3,1);  r(M,20,17,3,1);
      // wing root connecting nacelles (y=10..12)
      r(H,7,10,18,3); r(D,7,10,5,3); r(D,20,10,5,3);
      // central crew pod (y=13..20)
      r(H,12,13,8,8); r(M,12,13,1,8); r(M,19,13,1,8);
      r(W,13,16,6,2);  // weapon bay
      // nacelle exhausts (y=24..28)
      r(E,7,24,5,4);  r(E,19,24,5,4);
      r('#ffcc44',8,28,3,1); r('#ffcc44',20,28,3,1);
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
      r(W,7,24,5,2); r(W,13,24,5,2); r(W,19,24,5,2);
      r(E,7,26,5,3); r(E,13,26,5,3); r(E,19,26,5,3);
      r('#ffcc44',8,29,3,1); r('#ffcc44',14,29,3,1); r('#ffcc44',20,29,3,1);
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
      r(W,5,17,5,2);  r(W,11,17,4,2); r(W,16,17,4,2); r(W,21,17,5,2);
      r(E,5,19,5,4);  r(E,11,19,4,4); r(E,16,19,4,4); r(E,21,19,5,4);
      r('#ffcc44',6,23,3,1); r('#ffcc44',12,23,4,1); r('#ffcc44',22,23,3,1);
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
      r(E,6,24,5,4);  r(E,12,24,4,4); r(E,15,24,4,4); r(E,20,24,5,4);
      r('#ffcc44',7,28,3,1); r('#ffcc44',20,28,3,1);
      r('#ffee88',13,28,3,1); r('#ffee88',15,28,3,1);
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
      r(E,4,23,6,4);  r(E,11,23,5,4); r(E,15,23,5,4); r(E,21,23,6,4);
      r('#ffcc44',4,27,6,1); r('#ffcc44',21,27,6,1);
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
      r(E,3,25,6,5);  r(E,10,25,6,5); r(E,15,25,6,5); r(E,22,25,6,5);
      r('#ffcc44',3,30,6,1); r('#ffcc44',22,30,6,1);
      r('#ffee88',10,30,6,1); r('#ffee88',15,30,6,1);
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
      r(W,10,20,5,2); r(W,17,20,5,2);
      r(E,10,22,5,4); r(E,17,22,5,4);
      r(E,11,26,3,1); r(E,18,26,3,1);
      r('#ffcc44',11,27,3,1); r('#ffcc44',18,27,3,1);
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
      r(W,10,22,4,2); r(W,18,22,4,2);
      r(E,10,24,4,3); r(E,18,24,4,3);
      r(E,11,27,2,1); r(E,19,27,2,1);
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
      // twin engines (y=21..27)
      r(W,12,21,3,2); r(W,17,21,3,2);
      r(E,12,23,3,3); r(E,17,23,3,3);
      r('#cc6600',13,26,2,1); r('#cc6600',18,26,2,1);
      r(Ru,12,27,4,1); r(Ru,16,27,4,1); // exhaust discoloration
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
      r(W,7,20,6,2);  r(W,13,20,4,2); r(W,18,20,6,2);
      r(E,7,22,6,4);  r(E,13,22,4,4); r(E,18,22,6,4);
      r('#cc6600',8,26,4,1); r('#cc6600',13,26,4,1); r('#cc6600',19,26,4,1);
      r(Ru,7,27,6,1); r(Ru,18,27,6,1); // exhaust discoloration
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
      // single engine (y=17..24)
      r(W,13,17,5,2);
      r(E,13,19,5,3); r(E,14,22,3,2);
      r('#cc8811',14,24,3,1);  // dirty exhaust
      r(Ru,13,25,5,1);
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
      r(H,13,16,6,4); r(E,13,20,5,4); r(E2,14,24,3,2); r(E,13,26,5,1);
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
      r(E,8,23,6,4);  r(E,17,23,6,4);
      r(E,13,23,6,4);
      r(E2,10,27,4,2); r(E2,17,27,4,2);
    },
  },

  // ── Module icon functions (16×16 pixels) ────────────
  // Each glyph reads at a glance when scaled into hex tiles, outfitter cards,
  // and the ship-builder. Drawn on a dark backdrop; hull fills solid.
  _mods: {
    // Rocket nozzle firing a long flame downward — thrust/propulsion.
    engine(ctx) {
      const r=(c,x,y,w,h)=>G.Sprites._rc(ctx,c,x,y,w,h);
      r('#5a6a7a',6,0,4,2);             // mount neck
      r('#8a9aaa',4,2,8,2);             // bell shoulders
      r('#9fb0c2',2,4,12,2);            // bell rim (widest)
      r('#c2d0de',2,4,2,3);             // left edge highlight
      r('#566678',12,4,2,3);            // right edge shadow
      r('#3a4654',5,5,6,1);             // throat shadow
      r('#ff7a11',3,6,10,2);            // flame mouth
      r('#ff9c22',4,8,8,2);             // flame body
      r('#ffc844',5,10,6,2);           // hotter
      r('#ffec99',6,12,4,2);           // flame core
      r('#ffffff',7,14,2,2);           // white tip
    },
    // Heraldic energy crest tapering to a point — deflector shield.
    shield(ctx) {
      const r=(c,x,y,w,h)=>G.Sprites._rc(ctx,c,x,y,w,h);
      r('#2f6fd8',2,1,12,2);            // crest top
      r('#2f6fd8',2,3,12,5);            // upper body
      r('#2f6fd8',3,8,10,2);
      r('#2f6fd8',4,10,8,2);           // taper
      r('#2f6fd8',6,12,4,2);
      r('#5f9bff',4,2,6,6);            // lit face
      r('#bcd8ff',4,1,5,2);            // top sheen
      r('#9cc0ff',4,2,2,7);           // left edge light
      r('#1a4aa0',11,2,2,8);          // right shade
      r('#cfe2ff',6,4,2,2);          // central spark
    },
    // Tall shipping container, cross strapping and corner studs — cargo.
    cargo(ctx) {
      const r=(c,x,y,w,h)=>G.Sprites._rc(ctx,c,x,y,w,h);
      r('#9a7440',2,1,12,14);          // crate face
      r('#be945a',2,1,12,2);           // top-lit edge
      r('#6a4a22',2,13,12,2);          // base shadow
      r('#5a3a1a',6,1,3,14);           // vertical strap
      r('#5a3a1a',2,6,12,3);           // horizontal strap
      r('#7a5a2a',3,3,3,2);            // panel highlight
      r('#caa468',2,1,2,2); r('#caa468',12,1,2,2);  // corner studs
      r('#caa468',2,13,2,2); r('#caa468',12,13,2,2);
    },
    // Pressurised tank with a green fuel-level gauge — fuel.
    fuel(ctx) {
      const r=(c,x,y,w,h)=>G.Sprites._rc(ctx,c,x,y,w,h);
      r('#9aaaba',5,0,6,2);            // filler cap
      r('#808fa0',2,2,12,13);          // tank body
      r('#b2bece',2,2,2,13);           // left highlight
      r('#566678',12,2,2,13);          // right shadow
      r('#3a4654',2,4,12,2);           // top band
      r('#1f2a36',6,5,4,8);           // gauge well
      r('#33cc66',7,6,2,6);           // gauge fill
      r('#8fffb8',7,6,1,2);          // gauge shine
      r('#33cc66',6,11,4,2);         // droplet base
    },
    // Glowing hyperspace ring portal with a collapsing core — jump drive.
    jump(ctx) {
      const r=(c,x,y,w,h)=>G.Sprites._rc(ctx,c,x,y,w,h);
      r('#bb44ee',4,0,8,2); r('#bb44ee',4,14,8,2);  // ring top/bottom
      r('#bb44ee',0,4,2,8); r('#bb44ee',14,4,2,8);  // ring left/right
      r('#bb44ee',2,2,2,2); r('#bb44ee',12,2,2,2);  // rounded corners
      r('#bb44ee',2,12,2,2); r('#bb44ee',12,12,2,2);
      r('#7722bb',3,3,10,10);         // inner field
      r('#9933dd',5,5,6,6);
      r('#e6a6ff',6,6,4,4);           // glowing core
      r('#ffffff',7,7,2,2);
    },
    // Forked lightning bolt — energy/reactor output.
    power(ctx) {
      const r=(c,x,y,w,h)=>G.Sprites._rc(ctx,c,x,y,w,h);
      r('#ffe033',8,0,4,4);            // bolt head
      r('#ffe033',6,4,4,2);            // upper diagonal
      r('#ffe033',4,6,6,2);            // mid kink
      r('#ffe033',8,6,2,4);
      r('#ffe033',6,10,4,2);           // lower diagonal
      r('#ffe033',4,12,4,4);           // bolt tail
      r('#fff79a',8,0,2,4);           // spark highlight
      r('#fff79a',6,6,2,2);
      r('#c9a800',6,8,2,2);           // inner shadow
    },
    // Round head over broad shoulders — crew quarters/personnel.
    crew(ctx) {
      const r=(c,x,y,w,h)=>G.Sprites._rc(ctx,c,x,y,w,h);
      r('#d6dee6',6,1,4,4);            // head
      r('#eef3f8',6,1,2,2);           // head highlight
      r('#7d8d9d',4,6,8,8);           // torso
      r('#8d9dad',2,8,12,4);          // shoulders (wider)
      r('#9dadbd',5,6,3,3);           // chest light
      r('#5a6a7a',4,13,8,2);          // base shadow
      r('#46566a',7,9,2,5);          // torso seam
    },
    // Dish aimed up with rising signal pips — sensors/detection.
    sensor(ctx) {
      const r=(c,x,y,w,h)=>G.Sprites._rc(ctx,c,x,y,w,h);
      r('#44ddff',10,0,2,2);           // signal pips
      r('#44ddff',12,2,2,2);
      r('#44ddff',14,4,2,2);
      r('#c2d2e2',2,6,10,2);           // dish rim
      r('#a0b2c4',3,8,8,2);           // dish bowl
      r('#8898aa',4,10,5,2);
      r('#dce8f4',8,4,2,2);           // feed horn
      r('#6a7a8a',6,12,2,4);          // mast/base
      r('#46566a',5,15,4,1);         // base foot
    },
    // Toothed cog with hub bore — generic utility/special module.
    special(ctx) {
      const r=(c,x,y,w,h)=>G.Sprites._rc(ctx,c,x,y,w,h);
      r('#ffb733',6,0,4,2);            // top tooth
      r('#ffb733',6,14,4,2);           // bottom tooth
      r('#ffb733',0,6,2,4);            // left tooth
      r('#ffb733',14,6,2,4);           // right tooth
      r('#ffb733',2,2,2,2); r('#ffb733',12,2,2,2);  // diagonal teeth
      r('#ffb733',2,12,2,2); r('#ffb733',12,12,2,2);
      r('#ffd070',3,3,10,10);          // gear ring body
      r('#ffe0a0',3,3,4,2);           // top-left sheen
      r('rgba(0,0,0,0.85)',6,6,4,4);  // hub bore
    },
    // Heavy double-bevelled plate with a ridge and rivets — armour.
    armor(ctx) {
      const r=(c,x,y,w,h)=>G.Sprites._rc(ctx,c,x,y,w,h);
      r('#48586a',2,0,12,16);          // plate
      r('#6a7c90',2,0,12,2);           // top bevel light
      r('#6a7c90',2,0,2,16);           // left bevel light
      r('#28384a',12,0,2,16);          // right shadow
      r('#28384a',2,14,12,2);          // bottom shadow
      r('#5a6c80',2,7,12,2);           // mid ridge
      r('#34465a',2,9,12,1);           // ridge shadow
      r('#8a9cb0',4,2,2,2); r('#8a9cb0',10,2,2,2);  // rivets
      r('#8a9cb0',4,11,2,2); r('#8a9cb0',10,11,2,2);
    },
    // Ship outer hull — full-bleed plating (rarely used standalone; hex tiles
    // use getHull). Kept for module-card thumbnails.
    hull(ctx) {
      const r=(c,x,y,w,h)=>G.Sprites._rc(ctx,c,x,y,w,h);
      r('#7d8db0',0,0,16,16);          // full-bleed hull fill
      r('#94a4c6',0,0,16,2);           // top edge ambient light
      r('#5a6a8c',0,14,16,2);          // bottom edge shadow
      r('#8b9bbe',0,5,16,1);           // plating seam highlight
      r('#5a6a8c',0,6,16,1);           // plating seam shadow
      r('#6f7fa2',0,10,16,1);          // lower micro-seam
      r('#46567c',4,3,2,2); r('#46567c',10,11,2,2);  // sparse rivets
    },
    // Fixed forward gun — barrel up with hot muzzle, breech and mount below.
    weapon(ctx) {
      const r=(c,x,y,w,h)=>G.Sprites._rc(ctx,c,x,y,w,h);
      r('#8a9aaa',6,0,4,8);            // barrel
      r('#aab8c6',6,0,2,8);            // barrel highlight
      r('#cfd8e0',6,0,4,2);            // muzzle
      r('#ff5544',6,2,4,1);           // muzzle energy glow
      r('#46586a',4,8,8,5);           // breech body
      r('#637588',4,8,8,2);           // breech top edge
      r('#28384a',4,13,8,3);          // mount base
      r('#5a6c7e',5,10,2,2);         // breech detail
    },
    // Rotating turret — domed housing with twin barrels on a base.
    turret(ctx) {
      const r=(c,x,y,w,h)=>G.Sprites._rc(ctx,c,x,y,w,h);
      r('#3a4a5a',4,0,2,6); r('#3a4a5a',10,0,2,6);  // twin barrels
      r('#cfd8e0',4,0,2,2); r('#cfd8e0',10,0,2,2);  // barrel tips
      r('#5a6c7e',4,6,8,4);           // dome
      r('#8aa0b6',6,6,4,2);           // dome highlight
      r('#46586a',2,10,12,4);         // base
      r('#28384a',2,13,12,2);         // base shadow
      r('#637588',3,10,10,1);        // base top edge
    },
    // Cockpit windshield — blue tinted canopy with frame and instrument glow.
    cockpit(ctx) {
      const r=(c,x,y,w,h)=>G.Sprites._rc(ctx,c,x,y,w,h);
      r('#445a6a',2,0,12,2);            // top frame bar
      r('#445a6a',2,2,2,8); r('#445a6a',12,2,2,8); // side frames
      r('#5599bb',4,2,8,8);             // windshield glass
      r('#77bbdd',4,2,6,2);             // upper glass highlight
      r('#aadeff',4,2,2,2);             // corner shine
      r('#336688',10,6,2,4);            // right glass shadow
      r('#334455',2,10,12,2);           // console bar
      r('#ffcc44',6,12,4,2);            // instrument glow
      r('#1a2a3a',0,14,16,2);           // cockpit base
    },
    // Escape pod — red emergency capsule with rescue cross and ion thruster.
    escape_pod(ctx) {
      const r=(c,x,y,w,h)=>G.Sprites._rc(ctx,c,x,y,w,h);
      r('#bb2200',6,0,4,2);             // nose cap
      r('#dd3311',4,2,8,2);             // upper shoulder
      r('#ee4422',1,4,14,6);            // pod body
      r('#ff6644',1,4,2,6);             // left highlight
      r('#aa2200',13,4,2,6);            // right shadow
      r('#ffffff',7,5,2,4); r('#ffffff',5,6,6,2);  // rescue cross
      r('#dd3311',4,10,8,2);            // lower shoulder
      r('#888899',6,12,4,2);            // thruster housing
      r('#66ccff',6,14,4,2);           // ion thrust glow
    },
    // Targeting pod — armored optics with IR emitter and target brackets.
    targeting_pod(ctx) {
      const r=(c,x,y,w,h)=>G.Sprites._rc(ctx,c,x,y,w,h);
      r('#2a3444',0,2,16,8);            // pod body
      r('#3a4454',4,0,8,2);             // top mount
      r('#55cc22',6,4,4,4);             // optical lens housing
      r('#aaff44',8,4,2,2);             // lens highlight
      r('#1a3a0a',7,6,2,2);            // lens pupil
      r('#ffaa00',0,2,2,8);             // left targeting bracket
      r('#ffaa00',14,2,2,8);            // right targeting bracket
      r('#1e2c3a',0,10,16,2);           // lower body edge
      r('#334455',2,12,12,2);           // mount base
      r('#ff8800',6,14,4,2);            // IR emitter glow
    },
    // Missile turret — central barrel flanked by red-tipped missile pods.
    missile_turret(ctx) {
      const r=(c,x,y,w,h)=>G.Sprites._rc(ctx,c,x,y,w,h);
      r('#46586a',2,10,12,4);          // base plate
      r('#637588',2,8,12,2);           // base top edge
      r('#28384a',2,13,12,2);          // base shadow
      r('#5a6c7e',6,4,4,6);            // center barrel
      r('#8aa0b6',6,4,2,2);            // barrel highlight
      r('#cc5500',2,2,4,8); r('#cc5500',10,2,4,8);  // missile pods
      r('#ff8800',2,2,2,8); r('#ff8800',10,2,2,8);  // pod highlight
      r('#ff4444',2,2,4,2); r('#ff4444',10,2,4,2);  // red warheads
      r('#ffdddd',2,2,2,1); r('#ffdddd',10,2,2,1);  // warhead tips
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

// ── Asteroid hex-tile textures ────────────────────────────
// One cached pointy-top hex sprite per material (+ '__inner' generic interior).
// Drawn at exact world tile size inside the cluster's rotated space.
G.AsteroidTiles = {
  _cache: new Map(),
  _dims: null,
  _hexPath(ctx, cx, cy, R) {
    ctx.beginPath();
    for(let i=0;i<6;i++){
      const a = Math.PI/180*(60*i - 90);  // pointy-top: vertex up
      const x = cx + R*Math.cos(a), y = cy + R*Math.sin(a);
      i ? ctx.lineTo(x,y) : ctx.moveTo(x,y);
    }
    ctx.closePath();
  },
  dims() {
    if(!this._dims){
      const R = G.ASTEROID_TILE_R;
      this._dims = { W: Math.ceil(Math.sqrt(3)*R)+2, H: Math.ceil(2*R)+2 };
    }
    return this._dims;
  },
  get(matId) {
    if(this._cache.has(matId)) return this._cache.get(matId);
    const m = matId === '__inner' ? G.ASTEROID_INNER : (G.ASTEROID_MAT[matId] || G.ASTEROID_MAT.rock);
    const R = G.ASTEROID_TILE_R;
    const { W, H } = this.dims();
    const SS = 2;                          // supersample for crisper texels
    const c = document.createElement('canvas');
    c.width = W*SS; c.height = H*SS;
    const ctx = c.getContext('2d');
    ctx.scale(SS, SS);
    const cx = W/2, cy = H/2;
    this._hexPath(ctx, cx, cy, R-0.4);
    ctx.save(); ctx.clip();
    // base gradient: lit top → shadowed bottom
    const g = ctx.createLinearGradient(0, cy-R, 0, cy+R);
    g.addColorStop(0, m.spec); g.addColorStop(0.45, m.base); g.addColorStop(1, m.vein);
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
    // seeded speckle + flecks (stable per material)
    const rng = G.seededRng('asttex_'+matId);
    for(let i=0;i<30;i++){
      const x=rng()*W, y=rng()*H, s=0.5+rng()*1.7;
      ctx.fillStyle = rng()<0.5 ? m.vein : m.spec;
      ctx.globalAlpha = 0.2+rng()*0.45;
      ctx.fillRect(x, y, s, s);
    }
    // a couple of diagonal veins
    ctx.globalAlpha = 0.5; ctx.strokeStyle = m.vein; ctx.lineWidth = 0.7;
    for(let i=0;i<2;i++){
      ctx.beginPath();
      ctx.moveTo(rng()*W, rng()*H);
      ctx.lineTo(rng()*W, rng()*H);
      ctx.stroke();
    }
    // bright specular dot for shiny metals
    if(matId==='gold'||matId==='platinum'||matId==='nickel'){
      ctx.globalAlpha=0.7; ctx.fillStyle=m.spec;
      ctx.beginPath(); ctx.arc(cx-R*0.3, cy-R*0.35, 1.2, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.restore();
    // hex rim
    this._hexPath(ctx, cx, cy, R-0.4);
    ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.stroke();
    this._cache.set(matId, c);
    return c;
  },
};
