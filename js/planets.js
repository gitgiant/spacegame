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
