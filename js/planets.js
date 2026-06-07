'use strict';
// ── Planet Sprite System ──────────────────────────────────────────────────────
// Procedurally generated, seed-stable planet art. Cached per (ptype+r+seed).
// Canvas is sized to contain the planet + atmosphere + rings.
// Center of planet = canvas center.

G.PlanetSprites = {
  _cache: new Map(),

  // Returns a cached offscreen canvas for the planet.
  // Draw it centered at world position (x, y):
  //   ctx.drawImage(sprite, (x - sprite.width/2)|0, (y - sprite.height/2)|0)
  get(ptype, r, seed, hasRings) {
    const rr  = Math.max(4, (Math.round(r / 2) * 2) | 0);
    const key = `${ptype}_${rr}_${seed | 0}_${hasRings ? 1 : 0}`;
    if (this._cache.has(key)) return this._cache.get(key);

    // Canvas includes atmosphere padding; rings need much more horizontal room
    const pad = hasRings ? rr * 2.4 : rr * 0.4;
    const w   = hasRings ? (rr * 2 + pad * 2) | 0 : (rr * 2 + pad * 2) | 0;
    const h   = (rr * 2 + rr * 0.4 * 2) | 0; // height: planet + atmo only (no ring height)
    const c   = document.createElement('canvas');
    c.width   = w;
    c.height  = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    this._render(ctx, w >> 1, h >> 1, rr, ptype, seed, hasRings);
    this._cache.set(key, c);
    return c;
  },

  // Seeded LCG random
  _mkRng(seed) {
    let s = ((seed | 0) * 9301 + 49297) & 0x7fffffff;
    return function () {
      s = (s * 9301 + 49297) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  },

  _render(ctx, cx, cy, r, ptype, seed, hasRings) {
    const rng = this._mkRng(seed * 1337 + ptype.charCodeAt(0) * 17);

    // ── Rings behind planet (back half) ─────────────────────
    if (hasRings) this._ringBack(ctx, cx, cy, r, rng);

    // ── Planet surface (clipped to circle) ──────────────────
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    switch (ptype) {
      case 'terran':  this._terran (ctx, cx, cy, r, rng); break;
      case 'gas':     this._gas    (ctx, cx, cy, r, rng); break;
      case 'rocky':   this._rocky  (ctx, cx, cy, r, rng); break;
      case 'lava':    this._lava   (ctx, cx, cy, r, rng); break;
      case 'ice':     this._ice    (ctx, cx, cy, r, rng); break;
      case 'ocean':   this._ocean  (ctx, cx, cy, r, rng); break;
      case 'desert':  this._desert (ctx, cx, cy, r, rng); break;
      default:        this._rocky  (ctx, cx, cy, r, rng); break;
    }
    // Sphere shading (dark limb)
    const sl = ctx.createRadialGradient(cx - r * 0.28, cy - r * 0.28, r * 0.05, cx, cy, r * 1.05);
    sl.addColorStop(0,   'rgba(255,255,255,0.0)');
    sl.addColorStop(0.55,'rgba(0,0,0,0.0)');
    sl.addColorStop(1,   'rgba(0,0,0,0.62)');
    ctx.fillStyle = sl; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();

    // ── Atmosphere glow ──────────────────────────────────────
    this._atmo(ctx, cx, cy, r, ptype);

    // ── Planet edge ──────────────────────────────────────────
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1; ctx.stroke();

    // ── Rings in front of planet (front half) ───────────────
    if (hasRings) this._ringFront(ctx, cx, cy, r, rng);
  },

  // ── Atmosphere ───────────────────────────────────────────────────────────────
  _atmo(ctx, cx, cy, r, ptype) {
    const cols = {
      terran: [80, 140, 255],
      lava:   [255, 100, 20],
      ice:    [160, 220, 255],
      ocean:  [40,  100, 220],
      desert: [200, 140, 60],
      gas:    [200, 160, 80],
      rocky:  [120, 100, 80],
    };
    const [R, Gv, B] = cols[ptype] || [180, 180, 180];
    const ag = ctx.createRadialGradient(cx, cy, r * 0.88, cx, cy, r * 1.3);
    ag.addColorStop(0,   `rgba(${R},${Gv},${B},0.28)`);
    ag.addColorStop(0.5, `rgba(${R},${Gv},${B},0.08)`);
    ag.addColorStop(1,   `rgba(${R},${Gv},${B},0)`);
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.3, 0, Math.PI * 2);
    ctx.fillStyle = ag; ctx.fill();
  },

  // ── Terran (Earth-like) ─────────────────────────────────────────────────────
  _terran(ctx, cx, cy, r, rng) {
    // Deep ocean
    const og = ctx.createRadialGradient(cx + r * 0.15, cy - r * 0.1, 0, cx, cy, r);
    og.addColorStop(0,   '#2060b0');
    og.addColorStop(0.55,'#173a80');
    og.addColorStop(1,   '#0a1e4a');
    ctx.fillStyle = og; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // Shallow shelf lighter band near continents
    ctx.save(); ctx.globalAlpha = 0.3;
    for (let i = 0; i < 3; i++) {
      const bx = cx + (rng() - 0.5) * r, by = cy + (rng() - 0.5) * r;
      ctx.fillStyle = '#3a80cc';
      ctx.beginPath(); ctx.arc(bx, by, r * (0.3 + rng() * 0.4), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // Continents
    const nC = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < nC; i++) {
      const bx = cx + (rng() - 0.5) * r * 1.4;
      const by = cy + (rng() - 0.5) * r * 1.4;
      const cr = r * (0.2 + rng() * 0.38);
      const pts = 7 + Math.floor(rng() * 5);
      // Land mass
      ctx.fillStyle = '#3a6e30';
      ctx.beginPath();
      for (let p = 0; p < pts; p++) {
        const a  = (p / pts) * Math.PI * 2;
        const pr = cr * (0.55 + rng() * 0.7);
        if (p === 0) ctx.moveTo(bx + Math.cos(a)*pr, by + Math.sin(a)*pr);
        else         ctx.lineTo(bx + Math.cos(a)*pr, by + Math.sin(a)*pr);
      }
      ctx.closePath(); ctx.fill();
      // Interior highlands
      ctx.fillStyle = '#2d5828';
      ctx.beginPath();
      for (let p = 0; p < pts; p++) {
        const a  = (p / pts) * Math.PI * 2;
        const pr = cr * (0.25 + rng() * 0.28);
        if (p === 0) ctx.moveTo(bx + Math.cos(a)*pr, by + Math.sin(a)*pr);
        else         ctx.lineTo(bx + Math.cos(a)*pr, by + Math.sin(a)*pr);
      }
      ctx.closePath(); ctx.fill();
      // Desert patches
      ctx.fillStyle = '#9a8448';
      for (let d = 0; d < 2; d++) {
        const dx = bx + (rng() - 0.5) * cr * 1.2, dy = by + (rng() - 0.5) * cr * 1.2;
        ctx.beginPath(); ctx.arc(dx, dy, cr * (0.08 + rng() * 0.14), 0, Math.PI * 2); ctx.fill();
      }
    }

    // Ice caps
    ctx.fillStyle = '#e8f4ff';
    ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.82, r * 0.46, r * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.85, r * 0.36, r * 0.16, 0, 0, Math.PI * 2); ctx.fill();

    // Clouds (semi-transparent)
    ctx.save(); ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#ddeeff';
    for (let i = 0; i < 5; i++) {
      const wx = cx + (rng() - 0.5) * r * 1.7, wy = cy + (rng() - 0.5) * r * 1.7;
      const wr = r * (0.12 + rng() * 0.22), wh = wr * (0.28 + rng() * 0.35);
      ctx.save(); ctx.translate(wx, wy); ctx.rotate(rng() * Math.PI);
      ctx.beginPath(); ctx.ellipse(0, 0, wr, wh, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  },

  // ── Gas giant ────────────────────────────────────────────────────────────────
  _gas(ctx, cx, cy, r, rng) {
    // Base color choices per seed
    const palettes = [
      ['#c8956b','#e8c088','#a06840','#d4aa77'],  // Jupiter — oranges
      ['#ccbb88','#e0d4a0','#a8985c','#d4c890'],  // Saturn — pale tans
      ['#7a9aac','#a0c0cc','#5a7888','#90b0bc'],  // Uranus-like — muted blue-green
    ];
    const pal = palettes[Math.floor(rng() * palettes.length)];
    ctx.fillStyle = pal[0]; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // Banded gradient base
    const bg = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
    bg.addColorStop(0,   pal[3]);
    bg.addColorStop(0.5, pal[0]);
    bg.addColorStop(1,   pal[2]);
    ctx.fillStyle = bg; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // Atmospheric bands
    const nBands = 10 + Math.floor(rng() * 8);
    for (let i = 0; i < nBands; i++) {
      const by  = cy - r + (i / nBands) * r * 2;
      const bh  = (r * 2 / nBands) * (0.4 + rng() * 0.9);
      const col = rng() < 0.5
        ? `rgba(255,235,190,${0.12 + rng() * 0.22})`
        : `rgba(80,40,10,${0.1 + rng() * 0.18})`;
      ctx.fillStyle = col;
      ctx.fillRect(cx - r, by | 0, r * 2, Math.max(1, bh | 0));
    }

    // Storm oval
    const sx = cx + (rng() - 0.5) * r * 0.7;
    const sy = cy + (rng() - 0.5) * r * 0.35;
    const sw = r * (0.18 + rng() * 0.18), sh = sw * 0.5;
    ctx.save(); ctx.translate(sx, sy); ctx.scale(1, sh / sw);
    const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, sw);
    sg.addColorStop(0,   'rgba(160,50,10,0.8)');
    sg.addColorStop(0.55,'rgba(140,40,5,0.45)');
    sg.addColorStop(1,   'rgba(100,30,0,0)');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(0, 0, sw, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Subtle polar darkening
    for (const [yOff, size] of [[-r * 0.85, r * 0.5], [r * 0.85, r * 0.5]]) {
      const pg = ctx.createRadialGradient(cx, cy + yOff, 0, cx, cy + yOff, size);
      pg.addColorStop(0,   'rgba(30,15,5,0.45)');
      pg.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(cx, cy + yOff, size, 0, Math.PI * 2); ctx.fill();
    }
  },

  // ── Rocky ────────────────────────────────────────────────────────────────────
  _rocky(ctx, cx, cy, r, rng) {
    const mg = ctx.createRadialGradient(cx + r * 0.1, cy - r * 0.2, 0, cx, cy, r);
    mg.addColorStop(0,   '#7a6a58');
    mg.addColorStop(0.65,'#564840');
    mg.addColorStop(1,   '#30201a');
    ctx.fillStyle = mg; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // Mottled highlands
    ctx.save(); ctx.globalAlpha = 0.25;
    for (let i = 0; i < 6; i++) {
      const bx = cx + (rng() - 0.5) * r * 1.6, by = cy + (rng() - 0.5) * r * 1.6;
      const br = r * (0.08 + rng() * 0.22);
      ctx.fillStyle = rng() < 0.5 ? '#998877' : '#4a3828';
      ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // Impact craters
    const nCr = 4 + Math.floor(rng() * 7);
    for (let i = 0; i < nCr; i++) {
      const dist = rng() * r * 0.88;
      const ang  = rng() * Math.PI * 2;
      const crx  = cx + Math.cos(ang) * dist, cry = cy + Math.sin(ang) * dist;
      const crr  = r * (0.05 + rng() * 0.18);
      // rim (bright)
      ctx.beginPath(); ctx.arc(crx, cry, crr, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(190,170,140,${0.4 + rng() * 0.4})`;
      ctx.lineWidth = Math.max(0.5, crr * 0.28); ctx.stroke();
      // interior (dark)
      ctx.beginPath(); ctx.arc(crx, cry, crr * 0.65, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(15,8,4,${0.5 + rng() * 0.3})`; ctx.fill();
    }

    // Thin dusty equatorial band variation
    ctx.save(); ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#a09080';
    ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  },

  // ── Lava ─────────────────────────────────────────────────────────────────────
  _lava(ctx, cx, cy, r, rng) {
    ctx.fillStyle = '#150805'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // Hot mantle glow
    const lg = ctx.createRadialGradient(cx, cy + r * 0.2, 0, cx, cy, r);
    lg.addColorStop(0,   'rgba(220,70,0,0.55)');
    lg.addColorStop(0.6, 'rgba(110,25,0,0.25)');
    lg.addColorStop(1,   'rgba(50,5,0,0)');
    ctx.fillStyle = lg; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // Crustal plates — dark polygons
    ctx.save(); ctx.globalAlpha = 0.7;
    for (let i = 0; i < 5; i++) {
      const px = cx + (rng() - 0.5) * r * 1.6, py = cy + (rng() - 0.5) * r * 1.6;
      const pr = r * (0.18 + rng() * 0.3);
      const pts2 = 5 + Math.floor(rng() * 4);
      ctx.fillStyle = `rgba(${20 + rng() * 15 | 0},${8 + rng() * 8 | 0},3,0.75)`;
      ctx.beginPath();
      for (let p = 0; p < pts2; p++) {
        const a = (p / pts2) * Math.PI * 2, pr2 = pr * (0.6 + rng() * 0.6);
        if (p === 0) ctx.moveTo(px + Math.cos(a)*pr2, py + Math.sin(a)*pr2);
        else         ctx.lineTo(px + Math.cos(a)*pr2, py + Math.sin(a)*pr2);
      }
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // Lava veins
    ctx.save();
    const nVeins = 7 + Math.floor(rng() * 6);
    for (let i = 0; i < nVeins; i++) {
      const sx2 = cx + (rng() - 0.5) * r * 1.8, sy2 = cy + (rng() - 0.5) * r * 1.8;
      const ex  = sx2 + (rng() - 0.5) * r * 0.9, ey = sy2 + (rng() - 0.5) * r * 0.9;
      const glow = `rgba(${220 + rng() * 35 | 0},${60 + rng() * 80 | 0},0,${0.55 + rng() * 0.45})`;
      ctx.strokeStyle = glow;
      ctx.lineWidth = Math.max(0.5, r * 0.04 + rng() * r * 0.03);
      ctx.globalAlpha = 0.7 + rng() * 0.3;
      ctx.beginPath();
      ctx.moveTo(sx2, sy2);
      ctx.quadraticCurveTo(cx + (rng() - 0.5) * r, cy + (rng() - 0.5) * r, ex, ey);
      ctx.stroke();
    }
    ctx.restore();

    // Lava pools
    for (let i = 0; i < 6; i++) {
      const px = cx + (rng() - 0.5) * r * 1.5, py = cy + (rng() - 0.5) * r * 1.5;
      const pr = r * (0.04 + rng() * 0.1);
      const pg = ctx.createRadialGradient(px, py, 0, px, py, pr);
      pg.addColorStop(0,   `rgba(255,${160 + rng() * 60 | 0},0,0.95)`);
      pg.addColorStop(0.5, 'rgba(255,60,0,0.65)');
      pg.addColorStop(1,   'rgba(180,15,0,0)');
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
    }
  },

  // ── Ice ──────────────────────────────────────────────────────────────────────
  _ice(ctx, cx, cy, r, rng) {
    const ig = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.3, 0, cx, cy, r);
    ig.addColorStop(0,   '#e0eeff');
    ig.addColorStop(0.55,'#b0ccdd');
    ig.addColorStop(1,   '#5888a0');
    ctx.fillStyle = ig; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // Sub-surface blue patches
    ctx.save(); ctx.globalAlpha = 0.3;
    for (let i = 0; i < 4; i++) {
      const bx = cx + (rng() - 0.5) * r * 1.3, by = cy + (rng() - 0.5) * r * 1.3;
      ctx.fillStyle = '#6aaccc';
      ctx.beginPath(); ctx.arc(bx, by, r * (0.12 + rng() * 0.2), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // Ice crack network
    ctx.save();
    ctx.strokeStyle = 'rgba(160,210,240,0.65)';
    ctx.lineWidth = Math.max(0.5, r * 0.035);
    for (let i = 0; i < 9; i++) {
      const ang = (i / 9) * Math.PI * 2 + rng() * 0.4;
      let px = cx, py = cy;
      ctx.beginPath(); ctx.moveTo(px, py);
      for (let seg = 0; seg < 3; seg++) {
        const len = r * (0.25 + rng() * 0.4);
        const da  = (rng() - 0.5) * 0.7;
        px += Math.cos(ang + da) * len; py += Math.sin(ang + da) * len;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Polar caps
    ctx.fillStyle = '#f4faff';
    ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.8,  r * 0.52, r * 0.24, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.82, r * 0.42, r * 0.18, 0, 0, Math.PI * 2); ctx.fill();
  },

  // ── Ocean ────────────────────────────────────────────────────────────────────
  _ocean(ctx, cx, cy, r, rng) {
    const og = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    og.addColorStop(0,   '#1a3a6a');
    og.addColorStop(0.65,'#0c1e44');
    og.addColorStop(1,   '#050c22');
    ctx.fillStyle = og; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // Wave bands
    ctx.save(); ctx.globalAlpha = 0.18;
    for (let i = 0; i < 6; i++) {
      const wy = cy + (rng() - 0.5) * r * 1.5;
      ctx.strokeStyle = '#3a70aa';
      ctx.lineWidth = Math.max(1, r * (0.05 + rng() * 0.06));
      ctx.beginPath();
      ctx.ellipse(cx, wy, r * (0.7 + rng() * 0.35), r * (0.06 + rng() * 0.1), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Hurricane system
    const hx = cx + (rng() - 0.5) * r * 0.5, hy = cy + (rng() - 0.5) * r * 0.5;
    const hr = r * (0.18 + rng() * 0.22);
    ctx.save(); ctx.globalAlpha = 0.45;
    for (let i = 0; i < 3; i++) {
      const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr * (1.2 + i * 0.6));
      hg.addColorStop(0, 'rgba(30,80,180,0)');
      hg.addColorStop(0.65, 'rgba(55,110,200,0.3)');
      hg.addColorStop(1,   'rgba(10,30,90,0)');
      ctx.beginPath(); ctx.arc(hx, hy, hr * (1.2 + i * 0.6), 0, Math.PI * 2);
      ctx.fillStyle = hg; ctx.fill();
    }
    ctx.restore();

    // Cloud wisps
    ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = '#7aaccc';
    for (let i = 0; i < 5; i++) {
      const wx = cx + (rng() - 0.5) * r * 1.7, wy = cy + (rng() - 0.5) * r * 1.7;
      const wr = r * (0.08 + rng() * 0.16), wh = wr * (0.25 + rng() * 0.35);
      ctx.save(); ctx.translate(wx, wy); ctx.rotate(rng() * Math.PI);
      ctx.beginPath(); ctx.ellipse(0, 0, wr, wh, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // Small ice caps
    ctx.fillStyle = '#cce0ff';
    ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.84, r * 0.38, r * 0.15, 0, 0, Math.PI * 2); ctx.fill();
  },

  // ── Desert ───────────────────────────────────────────────────────────────────
  _desert(ctx, cx, cy, r, rng) {
    const dg = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.3, 0, cx, cy, r);
    dg.addColorStop(0,   '#d4a050');
    dg.addColorStop(0.6, '#b07530');
    dg.addColorStop(1,   '#783a14');
    ctx.fillStyle = dg; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // Dune striping
    ctx.save(); ctx.globalAlpha = 0.22;
    for (let i = 0; i < 10; i++) {
      const dy = cy - r + ((i + rng() * 0.5) / 10) * r * 2;
      ctx.strokeStyle = rng() < 0.5 ? '#e8c07a' : '#8a4210';
      ctx.lineWidth = Math.max(0.5, r * (0.04 + rng() * 0.05));
      ctx.beginPath();
      ctx.moveTo(cx - r, dy);
      for (let px = cx - r; px <= cx + r; px += r / 6) {
        ctx.lineTo(px, dy + Math.sin(px * 0.06) * r * 0.04);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Rock formations
    ctx.save(); ctx.globalAlpha = 0.65;
    for (let i = 0; i < 6; i++) {
      const rx = cx + (rng() - 0.5) * r * 1.5, ry = cy + (rng() - 0.5) * r * 1.5;
      ctx.fillStyle = `rgba(${80 + rng() * 30 | 0},${35 + rng() * 20 | 0},10,0.8)`;
      ctx.beginPath(); ctx.arc(rx, ry, r * (0.04 + rng() * 0.1), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // Sparse polar frost
    if (rng() < 0.5) {
      ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = '#f0e4c8';
      ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.85, r * 0.3, r * 0.12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  },

  // ── Saturn-style ring system ─────────────────────────────────────────────────
  _ringBack(ctx, cx, cy, r) {
    ctx.save();
    ctx.translate(cx, cy);
    // Clip: only top half (back rings, behind planet)
    ctx.beginPath(); ctx.rect(-r * 2.8, -r * 0.85, r * 5.6, r * 0.85); ctx.clip();
    this._ringBands(ctx, r);
    ctx.restore();
  },

  _ringFront(ctx, cx, cy, r) {
    ctx.save();
    ctx.translate(cx, cy);
    // Clip: bottom half (front rings, in front of planet)
    ctx.beginPath(); ctx.rect(-r * 2.8, 0, r * 5.6, r * 0.85); ctx.clip();
    this._ringBands(ctx, r);
    ctx.restore();
  },

  _ringBands(ctx, r) {
    const bands = [
      { ri: 1.32, ro: 1.50, col: 'rgba(200,182,138,0.72)' },
      { ri: 1.53, ro: 1.68, col: 'rgba(165,148,105,0.42)' },
      { ri: 1.71, ro: 1.92, col: 'rgba(218,202,155,0.62)' },
      { ri: 1.95, ro: 2.08, col: 'rgba(178,162,118,0.35)' },
      { ri: 2.12, ro: 2.25, col: 'rgba(195,180,135,0.28)' },
    ];
    const tilt = 0.28; // vertical compression = perspective tilt
    for (const { ri, ro, col } of bands) {
      ctx.beginPath();
      ctx.ellipse(0, 0, ro * r, ro * r * tilt, 0, 0, Math.PI * 2);
      ctx.ellipse(0, 0, ri * r, ri * r * tilt, 0, Math.PI * 2, 0, true);
      ctx.fillStyle = col; ctx.fill();
    }
  },
};

// ── Planet surface terrain (hex tiles) ────────────────────────────────────
// Procedural, seed-stable per planet. Elevation + moisture value-noise -> biomes,
// biased by planet ptype; rivers traced downhill. Used by the landed planet scene.

// Seeded fractal value-noise sampler over a continuous (x,y) domain.
function _makeNoise(seedStr) {
  const rng = G.seededRng(seedStr);
  const perm = []; for(let i = 0; i < 256; i++) perm[i] = i;
  for(let i = 255; i > 0; i--) { const j = (rng() * (i + 1)) | 0; const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
  const p = i => perm[((i % 256) + 256) % 256];
  const vh = (xi, yi) => p(xi + p(yi)) / 255;
  const sm = t => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  const samp = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), tx = sm(x - xi), ty = sm(y - yi);
    return lerp(lerp(vh(xi, yi), vh(xi + 1, yi), tx), lerp(vh(xi, yi + 1), vh(xi + 1, yi + 1), tx), ty);
  };
  return (x, y, oct = 4) => {
    let f = 1, a = 1, sum = 0, norm = 0;
    for(let o = 0; o < oct; o++) { sum += samp(x * f, y * f) * a; norm += a; f *= 2; a *= 0.5; }
    return sum / norm;
  };
}

// Per-ptype terrain tuning: sea level, elevation bias, liquid type, palette flags.
G.PTYPE_TERRAIN = {
  terran: { sea: 0.46, elevBias: 0.00, liquid: 'water', cold: 0.78, arid: 0.28 },
  ocean:  { sea: 0.64, elevBias: -0.10, liquid: 'water', cold: 0.82, arid: 0.20 },
  desert: { sea: 0.30, elevBias: 0.06, liquid: 'water', cold: 0.92, arid: 0.62 },
  rocky:  { sea: 0.28, elevBias: 0.04, liquid: 'water', cold: 0.85, arid: 0.50 },
  ice:    { sea: 0.42, elevBias: 0.00, liquid: 'water', cold: 0.30, arid: 0.40 },
  lava:   { sea: 0.40, elevBias: 0.05, liquid: 'lava',  cold: 0.99, arid: 0.70 },
  gas:    { sea: 1.10, elevBias: 0.00, liquid: 'cloud', cold: 0.50, arid: 0.50 },
};

// Walkable-on-foot biomes (others block crew movement).
G.TERRAIN_IMPASSABLE = new Set(['deep_water','ocean','shallow_water','mountain','glacier','liquid']);

function _classifyBiome(elev, moist, lat, cfg) {
  const sea = cfg.sea;
  if(cfg.liquid === 'cloud') return elev > 0.66 ? 'ridge' : (elev > 0.5 ? 'rocks' : 'liquid'); // gas giant cloud bands
  if(elev < sea - 0.14) return cfg.liquid === 'lava' ? 'liquid' : 'deep_water';
  if(elev < sea - 0.06) return cfg.liquid === 'lava' ? 'liquid' : 'ocean';
  if(elev < sea - 0.015) return cfg.liquid === 'lava' ? 'liquid' : 'shallow_water';
  if(elev < sea + 0.02) return 'coast';
  // land
  if(lat > cfg.cold + 0.12) return 'glacier';
  if(lat > cfg.cold) return 'tundra';
  if(elev > 0.86) return 'mountain';
  if(elev > 0.74) return 'ridge';
  if(elev < sea + 0.10) return 'valley';
  if(moist < cfg.arid) return (cfg.liquid === 'lava') ? 'rocks' : 'desert';
  if(moist > 0.60) return 'grassland';
  return (cfg.liquid === 'lava') ? 'rocks' : 'dirt';
}

function _traceRivers(tiles, R, elevN, rng) {
  const land = [...tiles.values()].filter(t => !['deep_water','ocean','shallow_water','liquid','coast'].includes(t.biome));
  if(!land.length) return;
  const sources = land.filter(t => t.elev > 0.72);
  const nRivers = Math.min(sources.length, 1 + (R / 5 | 0));
  for(let i = 0; i < nRivers; i++) {
    let cur = sources[(rng() * sources.length) | 0];
    let steps = 0;
    while(cur && steps++ < R * 3) {
      if(['deep_water','ocean','shallow_water','liquid'].includes(cur.biome)) break;
      if(cur.biome !== 'mountain' && cur.biome !== 'glacier') cur.biome = 'river', cur.walkable = true;
      // step to lowest neighbour
      let best = null, bestE = cur.elev;
      for(const nb of G.hexNeighbors(cur.q, cur.r)) {
        const t = tiles.get(G.hexKey(nb.q, nb.r));
        if(t && t.elev < bestE) { bestE = t.elev; best = t; }
      }
      if(!best) break;
      cur = best;
    }
  }
}

G.genPlanetTerrain = function(body) {
  if(body._terrain) return body._terrain;
  const ptype = body.ptype || 'rocky';
  const cfg = G.PTYPE_TERRAIN[ptype] || G.PTYPE_TERRAIN.rocky;
  const seed = (body.name || 'planet') + '|' + ptype;
  const R = G.clamp(Math.round((body.r || 100) / 12), 6, 20);
  const elevN = _makeNoise(seed + '|e'), moistN = _makeNoise(seed + '|m');
  const rng = G.seededRng(seed + '|r');
  const freq = 0.34;
  const tiles = new Map();
  for(let q = -R; q <= R; q++) {
    for(let r = -R; r <= R; r++) {
      if(Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r)) > R) continue;
      // pointy-top pixel coords (size 1) for smooth, isotropic noise sampling
      const px = G.hexToPixel(q, r, 1);
      const nx = px.x * freq, ny = px.y * freq;
      const ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r)) / R;
      let elev = elevN(nx + 5, ny + 5) * (1 - 0.30 * ring * ring) + cfg.elevBias;
      const moist = moistN(nx - 9, ny - 9);
      const lat = G.clamp(Math.abs(px.y) / (1.5 * R), 0, 1);   // poles at top/bottom
      const biome = _classifyBiome(elev, moist, lat, cfg);
      tiles.set(G.hexKey(q, r), { q, r, elev, moist, lat, biome, walkable: !G.TERRAIN_IMPASSABLE.has(biome) });
    }
  }
  _traceRivers(tiles, R, elevN, rng);
  for(const t of tiles.values()) t.walkable = !G.TERRAIN_IMPASSABLE.has(t.biome);
  body._terrain = { R, tiles, ptype, seed, name: body.name, hasSpaceport: !!body.hasSpaceport };
  return body._terrain;
};

// ── Terrain tile sprites (pointy-top hex icons) ───────────────────────────
G.TERRAIN_COLORS = {
  deep_water:   ['#0a2a55','#0d3469'], ocean: ['#114a86','#0f3f74'], shallow_water:['#2f7fb8','#2670a6'],
  coast:        ['#d9c98f','#cdbb7c'], river: ['#3b8fd0','#317fbe'],
  dirt:         ['#7a5b3a','#6b4f33'], rocks: ['#6f6a63','#5d5851'], grassland:['#4e8c3a','#447d33'],
  mountain:     ['#8a8278','#6c655d'], desert:['#d7b56a','#caa658'], tundra:['#8fa39a','#7e9389'],
  glacier:      ['#cfe6f0','#b9d6e6'], valley:['#5f9a4a','#538a40'], ridge:['#9a8d72','#857a63'],
  liquid:       ['#d8451f','#b8350f'],
};
G.TerrainTiles = {
  _cache: new Map(),
  SZ: 48,
  get(biome) {
    if(this._cache.has(biome)) return this._cache.get(biome);
    const SZ = this.SZ, R = SZ / 2;
    const cvs = document.createElement('canvas'); cvs.width = SZ; cvs.height = SZ;
    const c = cvs.getContext('2d');
    const pal = G.TERRAIN_COLORS[biome] || ['#555','#444'];
    // pointy-top hex fill
    c.beginPath();
    for(let i = 0; i < 6; i++) { const a = Math.PI/6 + i*Math.PI/3; const x = R + (R-0.5)*Math.cos(a), y = R + (R-0.5)*Math.sin(a); i ? c.lineTo(x,y) : c.moveTo(x,y); }
    c.closePath();
    const g = c.createLinearGradient(0,0,0,SZ); g.addColorStop(0,pal[0]); g.addColorStop(1,pal[1]);
    c.fillStyle = g; c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1; c.stroke();
    c.save(); c.clip();
    this._motif(c, biome, SZ, R, pal);
    c.restore();
    this._cache.set(biome, cvs); return cvs;
  },
  _motif(c, biome, SZ, R, pal) {
    const dark = 'rgba(0,0,0,0.30)', light = 'rgba(255,255,255,0.35)';
    const dot = (x,y,r,col)=>{ c.fillStyle=col; c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill(); };
    switch(biome) {
      case 'deep_water': case 'ocean': case 'shallow_water': case 'river': case 'liquid': {
        c.strokeStyle = light; c.lineWidth = 1;
        for(let i=0;i<3;i++){ const yy=SZ*0.32+i*SZ*0.18; c.beginPath(); c.moveTo(SZ*0.18,yy); c.quadraticCurveTo(SZ*0.5,yy-3,SZ*0.82,yy); c.stroke(); }
        break;
      }
      case 'mountain': case 'ridge': {
        c.fillStyle = dark; c.beginPath(); c.moveTo(SZ*0.2,SZ*0.72); c.lineTo(SZ*0.42,SZ*0.34); c.lineTo(SZ*0.6,SZ*0.72); c.closePath(); c.fill();
        c.fillStyle = light; c.beginPath(); c.moveTo(SZ*0.42,SZ*0.34); c.lineTo(SZ*0.5,SZ*0.5); c.lineTo(SZ*0.34,SZ*0.5); c.closePath(); c.fill();
        c.fillStyle = dark; c.beginPath(); c.moveTo(SZ*0.5,SZ*0.74); c.lineTo(SZ*0.66,SZ*0.46); c.lineTo(SZ*0.82,SZ*0.74); c.closePath(); c.fill();
        break;
      }
      case 'grassland': case 'valley': {
        c.strokeStyle = light; c.lineWidth = 1.2;
        for(let i=0;i<5;i++){ const x=SZ*0.2+i*SZ*0.15; c.beginPath(); c.moveTo(x,SZ*0.66); c.lineTo(x,SZ*0.5); c.stroke(); }
        break;
      }
      case 'rocks': { dot(SZ*0.35,SZ*0.42,3,dark); dot(SZ*0.6,SZ*0.58,4,dark); dot(SZ*0.5,SZ*0.3,2,dark); break; }
      case 'dirt': { dot(SZ*0.3,SZ*0.4,1.5,dark); dot(SZ*0.62,SZ*0.5,1.5,dark); dot(SZ*0.45,SZ*0.62,1.5,dark); break; }
      case 'desert': { c.strokeStyle = dark; c.lineWidth=1; for(let i=0;i<2;i++){const yy=SZ*0.45+i*SZ*0.18; c.beginPath(); c.moveTo(SZ*0.2,yy); c.quadraticCurveTo(SZ*0.5,yy+4,SZ*0.8,yy); c.stroke();} break; }
      case 'glacier': { c.strokeStyle = light; c.lineWidth=1; c.beginPath(); c.moveTo(SZ*0.3,SZ*0.3); c.lineTo(SZ*0.6,SZ*0.6); c.moveTo(SZ*0.62,SZ*0.32); c.lineTo(SZ*0.4,SZ*0.62); c.stroke(); break; }
      case 'tundra': { dot(SZ*0.4,SZ*0.5,2,light); dot(SZ*0.6,SZ*0.45,1.5,dark); break; }
      case 'coast': { c.strokeStyle='rgba(40,120,180,0.5)'; c.lineWidth=1.5; c.beginPath(); c.moveTo(SZ*0.2,SZ*0.6); c.quadraticCurveTo(SZ*0.5,SZ*0.5,SZ*0.8,SZ*0.62); c.stroke(); break; }
    }
  },
};
G.TERRAIN_LABEL = {
  deep_water:'Deep Water', ocean:'Ocean', shallow_water:'Shallow Water', coast:'Coastline', river:'River',
  dirt:'Dirt', rocks:'Rocks', grassland:'Grassland', mountain:'Mountains', desert:'Desert',
  tundra:'Tundra', glacier:'Glacier', valley:'Valley', ridge:'Ridge', liquid:'Liquid',
};
