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

// ── "Earthlike" planet generation rules ──────────────────────────────────
// Every planet is built from three independent layers, then biome-classified
// Whittaker-style (by elevation + temperature + moisture). Per-ptype params
// warp the same model so an ocean world, desert world or ice world all read as
// coherent places rather than noise mush:
//
//   1. CONTINENTS — a low-frequency noise field split at `sea` level into
//      land vs. ocean. `sea` therefore controls the land/water ratio
//      (Earth ≈ 0.5 → ~60% water). Big smooth landmasses, not speckle.
//   2. RELIEF — higher-frequency fractal noise adds coastline raggedness and
//      inland hills; a *ridged* noise term raises mountain spines on land
//      (scaled by `mountainHt`), so peaks form ranges, not random dots.
//   3. CLIMATE — temperature falls off from equator to poles via a latitude
//      band (`warmth`), drops with altitude (`lapse`), and is shifted by a
//      global `baseTemp` (cold worlds < 0, hot worlds > 0). Moisture is noise
//      with an equatorial wet bias. Cold → tundra/glacier, hot+dry → desert,
//      warm+wet → grassland, otherwise temperate dirt/valley.
//
// Rivers then run downhill from the mountains to the sea (see _traceRivers).
// On a torus the latitude band uses sin(π·r/H) so both poles are cold and the
// climate tiles seamlessly across the r-wrap.
G.PTYPE_TERRAIN = {
  // sea: water line · mountainHt: ridge uplift · mtn: mountain elev threshold
  // baseTemp: global warmth offset · warmth: equator→pole swing · lapse: cooling
  // with altitude · arid: desert moisture cutoff
  terran: { sea: 0.50, elevBias: 0.00, mountainHt: 0.60, mtn: 0.74, baseTemp: 0.16, warmth: 0.86, lapse: 1.10, arid: 0.30, liquid: 'water' },
  ocean:  { sea: 0.68, elevBias: -0.10, mountainHt: 0.44, mtn: 0.82, baseTemp: 0.22, warmth: 0.80, lapse: 1.00, arid: 0.22, liquid: 'water' },
  desert: { sea: 0.28, elevBias: 0.04, mountainHt: 0.68, mtn: 0.70, baseTemp: 0.46, warmth: 0.66, lapse: 0.90, arid: 0.60, liquid: 'water' },
  rocky:  { sea: 0.30, elevBias: 0.03, mountainHt: 0.80, mtn: 0.66, baseTemp: 0.22, warmth: 0.70, lapse: 1.05, arid: 0.50, liquid: 'water' },
  ice:    { sea: 0.46, elevBias: 0.00, mountainHt: 0.60, mtn: 0.72, baseTemp: -0.28, warmth: 0.55, lapse: 1.10, arid: 0.40, liquid: 'water' },
  lava:   { sea: 0.42, elevBias: 0.05, mountainHt: 0.72, mtn: 0.68, baseTemp: 0.80, warmth: 0.35, lapse: 0.80, arid: 0.72, liquid: 'lava'  },
  gas:    { sea: 1.10, elevBias: 0.00, mountainHt: 0.20, mtn: 0.90, baseTemp: 0.40, warmth: 0.40, lapse: 0.50, arid: 0.50, liquid: 'cloud' },
};

// Walkable-on-foot biomes (others block crew movement).
G.TERRAIN_IMPASSABLE = new Set(['deep_water','ocean','shallow_water','liquid']);

// Earth's real continents, as lon/lat ellipse blobs (deg). `h` weights peak
// land height. Sampled equirectangularly so a "terran" world named Earth gets a
// recognisable layout; everything else is procedural.
G.EARTH_BLOBS = [
  { lon:-100, lat: 48, wl: 38, hl: 26, h: 0.9 },   // North America
  { lon:-115, lat: 42, wl: 10, hl: 22, h: 1.3 },   // Rocky Mountains
  { lon: -88, lat: 14, wl: 12, hl: 12, h: 0.7 },   // Central America
  { lon: -40, lat: 72, wl: 20, hl: 10, h: 0.8 },   // Greenland
  { lon: -60, lat:-22, wl: 18, hl: 34, h: 0.9 },   // South America
  { lon: -70, lat:-25, wl:  6, hl: 33, h: 1.4 },   // Andes
  { lon:  16, lat: 52, wl: 26, hl: 14, h: 0.8 },   // Europe
  { lon:  10, lat: 46, wl: 14, hl:  5, h: 1.1 },   // Alps
  { lon:  20, lat:  3, wl: 26, hl: 36, h: 0.9 },   // Africa
  { lon: 100, lat: 60, wl: 72, hl: 24, h: 0.85 },  // Siberia / N Asia
  { lon:  82, lat: 33, wl: 42, hl: 20, h: 0.9 },   // Central Asia
  { lon:  85, lat: 33, wl: 20, hl:  6, h: 1.5 },   // Himalaya
  { lon: 120, lat: 36, wl: 22, hl: 22, h: 0.85 },  // East Asia
  { lon:  78, lat: 20, wl: 12, hl: 15, h: 0.9 },   // India
  { lon: 116, lat:  2, wl: 24, hl: 12, h: 0.7 },   // SE Asia / Indonesia
  { lon: 134, lat:-25, wl: 20, hl: 14, h: 0.8 },   // Australia
];
// Continental land height at a lon/lat (0 = ocean … ~1.5 = high mountain).
G._earthElev = (lon, lat) => {
  let land = 0;
  for(const b of G.EARTH_BLOBS) {
    let dlon = Math.abs(lon - b.lon); if(dlon > 180) dlon = 360 - dlon;
    const e = 1 - ((dlon / b.wl) ** 2 + ((lat - b.lat) / b.hl) ** 2);
    if(e > 0) land = Math.max(land, Math.sqrt(e) * (b.h || 1));
  }
  if(lat < -72) land = Math.max(land, 1.0);   // Antarctica ice sheet
  return land;
};

// Biome from the three layers. elev/temp/moist are all ~0..1.
function _classifyBiome(elev, temp, moist, cfg) {
  const sea = cfg.sea;
  if(cfg.liquid === 'cloud') return elev > 0.66 ? 'ridge' : (elev > 0.5 ? 'rocks' : 'liquid'); // gas giant bands
  if(elev < sea - 0.16) return cfg.liquid === 'lava' ? 'liquid' : 'deep_water';
  if(elev < sea - 0.06) return cfg.liquid === 'lava' ? 'liquid' : 'ocean';
  if(elev < sea - 0.02) return cfg.liquid === 'lava' ? 'liquid' : 'shallow_water';
  if(elev < sea + 0.015) return 'coast';
  // ── land ──
  // Only the very highest peaks become impassable mountain; a wide walkable
  // 'ridge' highland band sits below, so mountains are far less common.
  if(elev > cfg.mtn + 0.22) return temp < 0.32 ? 'glacier' : 'mountain';   // snow-capped peaks
  if(elev > cfg.mtn - 0.04) return temp < 0.30 ? 'glacier' : 'ridge';
  if(cfg.liquid === 'lava') return moist < cfg.arid ? 'rocks' : 'dirt';
  if(temp < 0.22) return 'glacier';
  if(temp < 0.34) return 'tundra';
  if(moist < cfg.arid) return 'desert';
  if(elev < sea + 0.05) return 'valley';                       // low, well-watered basins
  if(temp > 0.58 && moist > 0.64) return 'jungle';             // hot & very wet
  if(moist > 0.54 && temp > 0.38) return 'forest';             // temperate & wet
  if(elev > sea + (cfg.mtn - sea) * 0.55) return 'hills';      // upper land = rolling hills
  if(moist > 0.42) return 'grassland';
  return 'dirt';
}

// Wrap an axial coord into the canonical [0,W)×[0,H) torus block.
G.wrapHex = (W, H, q, r) => ({ q: ((q % W) + W) % W, r: ((r % H) + H) % H });
G.wrapTile = (ter, q, r) => ter.tiles.get(G.hexKey(((q % ter.W) + ter.W) % ter.W, ((r % ter.H) + ter.H) % ter.H));

const _WATER_BIOMES = new Set(['deep_water', 'ocean', 'shallow_water', 'liquid']);

// Rivers spring from the highest peaks and run downhill to the sea via steepest
// descent, escaping local pits by carving to the lowest unvisited neighbour so
// they actually reach open water. River banks turn fertile (arid → grassland).
function _traceRivers(tiles, W, H, rng) {
  const at = (q, r) => { const w = G.wrapHex(W, H, q, r); return tiles.get(G.hexKey(w.q, w.r)); };
  const land = [...tiles.values()].filter(t => !_WATER_BIOMES.has(t.biome) && t.biome !== 'coast');
  if(!land.length) return;
  // Candidate springs: the highest ground (peaks/ridges), highest first.
  const peaks = land.slice().sort((a, b) => b.elev - a.elev);
  const nRivers = G.clamp(3 + ((W * H) / 600 | 0), 4, 26);
  const minSpring = Math.max(5, (W / 12) | 0);   // spread sources apart
  const tdist = (a, b) => { let best = Infinity; for(let kq = -1; kq <= 1; kq++) for(let kr = -1; kr <= 1; kr++) { const d = G.hexDist(a.q, a.r, b.q + kq*W, b.r + kr*H); if(d < best) best = d; } return best; };
  const springs = [];
  let made = 0;
  for(let i = 0; i < peaks.length && made < nRivers; i++) {
    const src = peaks[i];
    if(springs.some(s => tdist(s, src) < minSpring)) continue;
    // Walk downhill to the sea.
    const path = []; const seen = new Set(); let cur = src, reachedSea = false, steps = 0;
    while(cur && steps++ < (W + H) * 2) {
      const k = G.hexKey(cur.q, cur.r);
      if(_WATER_BIOMES.has(cur.biome)) { reachedSea = true; break; }
      if(seen.has(k)) break;
      seen.add(k); path.push(cur);
      let best = null, bestE = Infinity;
      for(const nb of G.hexNeighbors(cur.q, cur.r)) {
        const t = at(nb.q, nb.r); if(!t || seen.has(G.hexKey(t.q, t.r))) continue;
        if(t.elev < bestE) { bestE = t.elev; best = t; }
      }
      if(!best) break;
      cur = best;
    }
    if(path.length < 4 || (!reachedSea && path.length < 8)) continue;
    springs.push(src); made++;
    for(const t of path) {
      if(t.biome === 'mountain' || t.biome === 'glacier') continue;   // river skirts peaks
      t.biome = 'river'; t.walkable = true; t._river = true;
      for(const nb of G.hexNeighbors(t.q, t.r)) {                     // fertile banks
        const b = at(nb.q, nb.r);
        if(b && !_WATER_BIOMES.has(b.biome) && !['river', 'mountain', 'glacier', 'spaceport'].includes(b.biome)
           && ['desert', 'dirt', 'rocks', 'tundra'].includes(b.biome)) { b.biome = 'grassland'; b.walkable = true; }
      }
    }
  }
}

// Scatter villages where people actually live: river banks, river mouths, and
// coasts. Small clusters, spaced out, kept clear of the spaceport.
function _placeSettlements(tiles, W, H, rng, port) {
  const at = (q, r) => { const w = G.wrapHex(W, H, q, r); return tiles.get(G.hexKey(w.q, w.r)); };
  const near = (t, pred) => G.hexNeighbors(t.q, t.r).some(nb => { const x = at(nb.q, nb.r); return x && pred(x); });
  const tdist = (a, b) => { let best = Infinity; for(let kq = -1; kq <= 1; kq++) for(let kr = -1; kr <= 1; kr++) { const d = G.hexDist(a.q, a.r, b.q + kq*W, b.r + kr*H); if(d < best) best = d; } return best; };
  // Water-adjacent walkable land (coast tiles, or land touching river/sea).
  const cand = [...tiles.values()].filter(t => t.walkable
    && !['spaceport', 'settlement', 'river'].includes(t.biome)
    && (t.biome === 'coast' || near(t, x => x.biome === 'river') || near(t, x => x.biome === 'shallow_water' || x.biome === 'ocean')));
  if(!cand.length) return;
  for(let i = cand.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [cand[i], cand[j]] = [cand[j], cand[i]]; }
  const target = G.clamp(3 + ((W * H) / 800 | 0) + (port ? 2 : 0), 3, 18);
  const minD = Math.max(4, (W / 14) | 0);
  const placed = [];
  for(const t of cand) {
    if(placed.length >= target) break;
    if(port && tdist(t, { q: port.q, r: port.r }) < minD) continue;
    if(placed.some(p => tdist(t, p) < minD)) continue;
    t.biome = 'settlement'; t.walkable = true; placed.push(t);
    // Grow a 1–2 tile hamlet on adjacent dry land.
    const nbs = G.hexNeighbors(t.q, t.r).map(nb => at(nb.q, nb.r))
      .filter(x => x && x.walkable && !_WATER_BIOMES.has(x.biome) && !['river', 'spaceport', 'settlement'].includes(x.biome));
    const extra = 1 + (rng() * 2 | 0);
    for(let k = 0; k < extra && nbs.length; k++) { const x = nbs.splice((rng() * nbs.length) | 0, 1)[0]; if(x) { x.biome = 'settlement'; x.walkable = true; } }
  }
}

G.genPlanetTerrain = function(body) {
  if(body._terrain) return body._terrain;
  const ptype = body.ptype || 'rocky';
  const cfg = G.PTYPE_TERRAIN[ptype] || G.PTYPE_TERRAIN.rocky;
  const seed = (body.name || 'planet') + '|' + ptype + '|v3';   // bump to regenerate all worlds
  // Wrapping rectangular hex field (torus) — no map edge. Very large surface
  // (~10x the previous tile count) so there's lots of room to roam; only the
  // visible tiles are drawn each frame, so size is cheap at render time.
  const W = G.clamp(Math.round((body.r || 100) / 0.57), 190, 420);
  const H = W;
  const elevN = _makeNoise(seed + '|e'), moistN = _makeNoise(seed + '|m');
  const rng = G.seededRng(seed + '|r');
  const freq = 0.34;
  // A "terran" world literally named Earth gets Earth's real continent layout.
  const isEarth = ptype === 'terran' && /^earth$/i.test(body.name || '');
  const tiles = new Map();
  for(let r = 0; r < H; r++) {
    // Latitude band: warm at the equator (mid-r), cold at both poles (r→0,H).
    // sin keeps it seamless across the r-wrap. Earth uses its true latitude.
    const tband = Math.sin(Math.PI * (r / H));
    for(let q = 0; q < W; q++) {
      // pointy-top pixel coords (size 1) for smooth, isotropic noise sampling
      const px = G.hexToPixel(q, r, 1);
      const nx = px.x * freq, ny = px.y * freq;
      // ── Layer 1: continents (+ Earth override) ──
      let elev, warm;
      if(isEarth) {
        const lon = (q / W) * 360 - 180, lat = 90 - (r / H) * 180;
        const land = G._earthElev(lon, lat);
        elev = (cfg.sea - 0.18) + land * 0.5 + (elevN(nx * 1.7 + 3, ny * 1.7 + 3, 3) - 0.5) * 0.10;
        warm = G.clamp(Math.cos(lat * Math.PI / 180), 0, 1);   // true-latitude climate
      } else {
        const cont = elevN(nx * 0.5 + 5, ny * 0.5 + 5, 2);     // big landmasses
        const detail = elevN(nx * 1.8 - 3, ny * 1.8 - 3, 3);   // coastline + hills
        elev = cont * 0.72 + detail * 0.28 + cfg.elevBias;
        warm = tband;
      }
      // ── Layer 2: ridged mountain spines on land ──
      const ridge = 1 - Math.abs(elevN(nx * 1.1 + 20, ny * 1.1 + 20, 3) * 2 - 1);
      if(elev > cfg.sea + 0.04) elev += ridge * ridge * cfg.mountainHt;
      // ── Layer 3: climate ──
      const above = Math.max(0, elev - cfg.sea);
      const temp = G.clamp(cfg.baseTemp + warm * cfg.warmth - above * cfg.lapse + (moistN(nx + 13, ny + 7) - 0.5) * 0.12, 0, 1);
      let moist = moistN(nx - 9, ny - 9);
      moist = G.clamp(moist * 0.9 + tband * 0.12, 0, 1);       // mild equatorial wet bias
      const biome = _classifyBiome(elev, temp, moist, cfg);
      // Discrete elevation tier -5..+5, anchored at sea level (water = negative).
      const level = G.clamp(Math.round((elev - cfg.sea) * 10), -5, 5);
      tiles.set(G.hexKey(q, r), { q, r, elev, level, moist, temp, biome, walkable: !G.TERRAIN_IMPASSABLE.has(biome) && level < 5 });
    }
  }
  for(const t of tiles.values()) t.walkable = !G.TERRAIN_IMPASSABLE.has(t.biome) && t.level < 5;
  _traceRivers(tiles, W, H, rng);
  // Spaceport worlds get a built-up site: a landing pad surrounded by a small
  // settlement, stamped onto a flat dry-land patch near the block centre.
  const port = body.hasSpaceport ? _placeSpaceport(tiles, W, H, rng) : null;
  _placeSettlements(tiles, W, H, rng, port);   // riverside + coastal villages
  _seedDeposits(tiles, W, H, rng);
  body._terrain = { W, H, tiles, ptype, seed, name: body.name, hasSpaceport: !!body.hasSpaceport, port };
  return body._terrain;
};

// Scatter mineable raw-material deposits onto walkable land tiles — the planet
// analogue of asteroid ore. Material is biased by biome (ice in the cold, metals
// in rock/mountain country) but drawn from the same G.ASTEROID_MATS table, so a
// deposit drops the same goods (iron/copper/.../platinum) into ship cargo.
function _seedDeposits(tiles, W, H, rng) {
  const COLD = new Set(['glacier', 'tundra', 'coast', 'river']);
  const STONY = new Set(['rocks', 'ridge', 'hills', 'mountain', 'desert', 'dirt']);
  const SKIP = new Set(['deep_water', 'ocean', 'shallow_water', 'liquid', 'river', 'coast', 'spaceport', 'settlement']);
  const land = [...tiles.values()].filter(t => t.walkable && !SKIP.has(t.biome));
  if(!land.length) return;
  const target = G.clamp(Math.round((W * H) / 2200), 10, 120);
  for(let i = 0; i < target; i++) {
    const t = land[(rng() * land.length) | 0];
    if(t.ore) continue;
    let mat = G.astRandMat(rng);
    // Biome bias: cold → ice; stony/high → reroll ice away toward metals.
    if(COLD.has(t.biome) && rng() < 0.6) mat = 'ice';
    else if(STONY.has(t.biome) && mat === 'ice') mat = G.astRandMat(rng);
    const def = G.ASTEROID_MAT[mat] || G.ASTEROID_MAT.rock;
    t.ore = mat;
    t.oreHp = G.clamp(Math.round(6 + (def.weight || 1) * 0.4 + rng() * 4), 4, 26);   // units to mine out
  }
}

// Stamp a spaceport + settlement onto the terrain; returns the port cell {q,r}.
function _placeSpaceport(tiles, W, H, rng) {
  const cq = W >> 1, cr = H >> 1;
  const tdist = (aq, ar, bq, br) => {       // shortest hex dist on the torus
    let best = Infinity;
    for(let kq = -1; kq <= 1; kq++) for(let kr = -1; kr <= 1; kr++) {
      const d = G.hexDist(aq, ar, bq + kq*W, br + kr*H);
      if(d < best) best = d;
    }
    return best;
  };
  // Site: walkable dry land near centre, preferring flat low ground (not water/ice).
  let site = null, bestScore = Infinity;
  for(const t of tiles.values()) {
    if(!t.walkable || t.biome === 'river' || t.biome === 'tundra' || t.biome === 'glacier') continue;
    if(t.elev == null) continue;
    const score = tdist(cq, cr, t.q, t.r) + Math.abs(t.level) * 3;
    if(score < bestScore) { bestScore = score; site = t; }
  }
  if(!site) return null;
  const sl = site.level;
  // Flatten + build a radius-2 patch so there are no cliffs blocking the port.
  for(const t of tiles.values()) {
    const d = tdist(site.q, site.r, t.q, t.r);
    if(d > 2) continue;
    if(['deep_water','ocean','shallow_water','liquid','river'].includes(t.biome)) continue;
    t.level = sl;
    t.biome = (d === 0) ? 'spaceport' : (d === 1 || rng() < 0.55) ? 'settlement' : t.biome;
    t.walkable = true;
  }
  return { q: site.q, r: site.r };
}

// ── Terrain tile palette + motif icons ────────────────────────────────────
// Tiles are filled as exact, gap-free pointy-top hexes by the renderer; the
// gradient (light/dark) + per-tile elevation shading give relief, and a baked
// transparent motif icon sits on top for at-a-glance biome identity.
G.TERRAIN_COLORS = {
  deep_water:['#1d4e96','#143a72'], ocean:['#2a6fbd','#1c5391'], shallow_water:['#4fb4e6','#3690cc'],
  coast:['#ecdfa4','#d8c684'], river:['#4cb0ef','#2f8ad0'],
  dirt:['#946f44','#6f5230'], rocks:['#857f76','#5c574e'], grassland:['#6fc04a','#4a9333'],
  mountain:['#a39a8d','#6b6358'], desert:['#edcd7a','#d2ab57'], tundra:['#aebfb4','#85988c'],
  glacier:['#e9f4fa','#c4def0'], valley:['#74c150','#4f9a38'], ridge:['#b3a585','#897b62'],
  liquid:['#ff7331','#c63410'],
  hills:['#86a94e','#5e7d33'], forest:['#3f8f3e','#296627'], jungle:['#2f8a34','#185f22'],
  spaceport:['#aab4c4','#6f7a8d'], settlement:['#c0936a','#8a6442'],
};

// Shade a #rrggbb by a brightness factor.
G._shadeHex = function(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) * f)) | 0;
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) * f)) | 0;
  const b = Math.max(0, Math.min(255, (n & 255) * f)) | 0;
  return 'rgb(' + r + ',' + g + ',' + b + ')';
};
// Mean of two #rrggbb colors, shaded by factor f -> rgb() string.
G._mixShade = function(a, b, f) {
  const na = parseInt(a.slice(1), 16), nb = parseInt(b.slice(1), 16);
  const r = Math.max(0, Math.min(255, (((na>>16&255)+(nb>>16&255))/2) * f)) | 0;
  const g = Math.max(0, Math.min(255, (((na>>8&255)+(nb>>8&255))/2) * f)) | 0;
  const bl = Math.max(0, Math.min(255, (((na&255)+(nb&255))/2) * f)) | 0;
  return 'rgb(' + r + ',' + g + ',' + bl + ')';
};

G.TerrainTiles = {
  _motifCache: new Map(),
  _swatchCache: new Map(),
  MZ: 64,
  // Transparent icon (no hex fill) centred in an MZ box — drawn over the tile.
  motif(biome) {
    if(this._motifCache.has(biome)) return this._motifCache.get(biome);
    const Z = this.MZ, cv = document.createElement('canvas'); cv.width = Z; cv.height = Z;
    const c = cv.getContext('2d');
    this._drawMotif(c, biome, Z);
    this._motifCache.set(biome, cv); return cv;
  },
  // Small filled hex swatch for the legend.
  swatch(biome, S = 14) {
    const key = biome + '|' + S;
    if(this._swatchCache.has(key)) return this._swatchCache.get(key);
    const cv = document.createElement('canvas'); cv.width = S * 2; cv.height = S * 2;
    const c = cv.getContext('2d'); const R = S, cx = S, cy = S;
    c.beginPath();
    for(let i = 0; i < 6; i++) { const a = Math.PI/6 + i*Math.PI/3; const x = cx + R*Math.cos(a), y = cy + R*Math.sin(a); i ? c.lineTo(x,y) : c.moveTo(x,y); }
    c.closePath();
    const pal = G.TERRAIN_COLORS[biome] || ['#888','#555'];
    const g = c.createLinearGradient(0,0,0,S*2); g.addColorStop(0,pal[0]); g.addColorStop(1,pal[1]);
    c.fillStyle = g; c.fill();
    c.drawImage(this.motif(biome), cx - S, cy - S, S*2, S*2);
    this._swatchCache.set(key, cv); return cv;
  },
  // Pixel-art motif on a 16×16 grid, transparent, drawn over the tile fill.
  _drawMotif(c, biome, Z) {
    const N = 16, u = Z / N;
    const P = (gx, gy, col, gw = 1, gh = 1) => { c.fillStyle = col; c.fillRect((gx*u)|0, (gy*u)|0, Math.ceil(gw*u), Math.ceil(gh*u)); };
    const water = (lo, hi) => {            // staggered wave bars
      P(3,6,lo,4,1); P(9,6,lo,3,1);
      P(2,9,hi,3,1); P(7,9,hi,4,1); P(12,9,hi,2,1);
      P(4,12,lo,4,1); P(10,12,lo,3,1);
    };
    const pine = (x, top) => {             // conifer: stacked canopy + trunk
      const g='rgba(46,128,56,0.95)', gd='rgba(24,78,32,0.96)', tr='rgba(84,54,26,0.97)';
      P(x,top,gd,2,1); P(x-1,top+1,g,4,1); P(x-1,top+2,gd,4,1);
      P(x-2,top+3,g,6,1); P(x-2,top+4,gd,6,1); P(x,top+5,tr,2,2);
    };
    const bush = (x, y, r, col, hi) => {   // round dense canopy (jungle)
      P(x-r,y,col,r*2,2); P(x-r+1,y-1,col,r*2-2,1); P(x-r+1,y+2,col,r*2-2,1);
      P(x-r+1,y-1,hi,2,1);
    };
    const hump = (x, y, w, col, sh) => {   // rolling hill
      P(x+1,y,col,w-2,1); P(x,y+1,col,w,1); P(x-1,y+2,col,w+2,1); P(x-1,y+3,sh,w+2,1);
    };
    const mtn = (cx, apexY, h, snow) => {  // pixel peak with optional snow cap
      const rock='rgba(120,112,100,0.95)', shad='rgba(74,68,58,0.95)', sn='rgba(244,250,255,0.97)';
      for(let i=0;i<h;i++){ const y=apexY+i; P(cx-i,y,rock,2*i+1,1); if(i>0) P(cx+1,y,shad,i,1); }
      if(snow){ P(cx,apexY,sn,1,1); P(cx-1,apexY+1,sn,3,1); }
    };
    switch(biome) {
      case 'deep_water':    water('rgba(120,180,240,0.4)','rgba(160,210,255,0.5)'); break;
      case 'ocean':         water('rgba(150,200,250,0.45)','rgba(190,225,255,0.55)'); break;
      case 'shallow_water': water('rgba(200,235,255,0.55)','rgba(225,248,255,0.7)'); break;
      case 'river':         { const w='rgba(220,245,255,0.8)'; P(6,2,w,3,2); P(7,5,w,3,2); P(6,8,w,3,2); P(8,11,w,3,2); break; }
      case 'liquid':        water('rgba(255,210,110,0.7)','rgba(255,240,170,0.85)'); P(7,7,'rgba(255,250,200,0.9)',2,2); break;
      case 'coast':
        P(0,9,'rgba(245,236,180,0.5)',16,7);
        P(2,5,'rgba(190,225,255,0.6)',5,1); P(9,6,'rgba(190,225,255,0.6)',4,1);
        P(5,11,'rgba(150,120,70,0.6)',1,1); P(10,12,'rgba(150,120,70,0.6)',1,1); break;
      case 'mountain':      mtn(6,3,6,true); mtn(11,6,4,true); break;
      case 'ridge':         mtn(5,7,3,false); mtn(10,8,3,false); break;
      case 'hills':         hump(3,7,5,'rgba(120,164,74,0.9)','rgba(82,118,48,0.92)'); hump(8,9,6,'rgba(106,150,64,0.9)','rgba(72,104,42,0.92)'); break;
      case 'grassland':     { const g='rgba(34,100,26,0.7)'; for(const x of [4,6,8,10,12]) P(x,7+(x%2),g,1,5); P(3,11,g,1,2); P(13,10,g,1,3); break; }
      case 'forest':        pine(5,3); pine(11,5); pine(8,7); break;
      case 'jungle':        bush(6,6,3,'rgba(30,108,42,0.95)','rgba(64,156,70,0.95)'); bush(10,8,3,'rgba(20,86,32,0.96)','rgba(52,138,60,0.95)'); bush(7,10,2,'rgba(26,98,38,0.95)','rgba(58,144,62,0.95)'); break;
      case 'valley':        { const g='rgba(34,100,26,0.6)'; for(const x of [4,7,10,12]) P(x,6,g,1,4); const w='rgba(185,222,255,0.55)'; P(2,11,w,3,1); P(5,12,w,3,1); P(8,11,w,3,1); P(11,12,w,3,1); break; }
      case 'rocks':         { const r='rgba(58,54,48,0.6)', rl='rgba(150,146,138,0.55)'; P(4,7,r,4,3); P(5,6,r,2,1); P(4,7,rl,1,1); P(9,8,r,4,3); P(10,7,r,2,1); P(9,8,rl,1,1); break; }
      case 'dirt':          { const p='rgba(66,48,28,0.6)', l='rgba(152,122,82,0.5)'; for(const [x,y] of [[4,6],[9,5],[6,9],[11,10],[8,12]]){ P(x,y,p,1,1); P(x+1,y,l,1,1);} break; }
      case 'desert':        { const d='rgba(150,110,40,0.45)'; P(2,8,d,5,1); P(6,9,d,5,1); P(2,11,d,6,1); P(9,11,d,5,1); const ca='rgba(60,120,50,0.85)'; P(12,5,ca,1,5); P(11,6,ca,1,1); P(13,7,ca,1,1); break; }
      case 'tundra':        { P(3,7,'rgba(240,248,255,0.7)',3,2); P(10,9,'rgba(240,248,255,0.7)',3,2); const s='rgba(70,96,82,0.6)'; P(7,6,s,1,3); P(8,11,s,1,3); break; }
      case 'glacier':       { const cr='rgba(120,170,210,0.65)'; for(let i=0;i<6;i++) P(4+i,4+i,cr,1,1); for(let i=0;i<5;i++) P(11-i,5+i,cr,1,1); P(7,9,cr,2,1); break; }
      case 'spaceport':     {
        const pad='rgba(64,72,86,0.8)', line='rgba(224,232,244,0.9)', lt='rgba(255,210,80,0.97)';
        P(3,3,pad,10,10);
        P(5,4,line,6,1); P(5,11,line,6,1); P(4,5,line,1,6); P(11,5,line,1,6);   // pad ring
        P(6,6,line,1,4); P(9,6,line,1,4); P(6,8,line,4,1);                       // 'H' marking
        P(3,3,lt,1,1); P(12,3,lt,1,1); P(3,12,lt,1,1); P(12,12,lt,1,1);          // corner lights
        break;
      }
      case 'settlement':    {
        const wall='rgba(186,156,116,0.92)', roof='rgba(154,72,56,0.94)', door='rgba(78,52,32,0.92)', win='rgba(150,200,232,0.85)';
        const house = (x, y, w, h) => { P(x-1,y,roof,w+2,1); P(x,y-1,roof,w,1); P(x,y+1,wall,w,h); P(x+1,y+2,door,1,h-1); P(x+w-2,y+2,win,1,1); };
        house(3,6,4,4); house(9,8,3,3); break;
      }
    }
  },
};
G.TERRAIN_LABEL = {
  deep_water:'Deep Water', ocean:'Ocean', shallow_water:'Shallow Water', coast:'Coastline', river:'River',
  dirt:'Dirt', rocks:'Rocks', grassland:'Grassland', mountain:'Mountains', desert:'Desert',
  tundra:'Tundra', glacier:'Glacier', valley:'Valley', ridge:'Ridge', liquid:'Liquid',
  hills:'Hills', forest:'Forest', jungle:'Jungle', spaceport:'Spaceport', settlement:'Settlement',
};
