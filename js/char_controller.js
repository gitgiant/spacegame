'use strict';
// G.CharController — scene-agnostic ARPG character movement + combat.
// Used by both the planet-surface scene and the ship-interior boarding scene.
//
// CharScene interface (all methods called by CharController):
//   gravity          number   gravity accel (16 planet, 0 ship)
//   shots            []       mutable Shot array
//   npcs             []       enemy unit wrappers { ref, q, r, px, py, ... }
//   crew             []       allied unit wrappers
//   loot             []       mutable Loot array
//   canMoveTo(px,py,char,airborne) → {q,r}|null
//   tileSpeedMul(char)             → number  (terrain speed bonus)
//   delta(ax,ay,bx,by)             → {dx,dy,dist}
//   pathfind(from,to)              → [{q,r}]|null
//   resolveHex(q,r)                → {q,r}   (torus-wrap or identity)
//   worldToLocal(screenX,screenY)  → {x,y}   screen→scene hex-pixel
//   addShot(shot)
//   applyDamage(unit,dmg,src)
//   deactivateShield(unit)
//   checkLOS(a,b)                  → bool
//   npcStance(n)                   → 'hostile'|'flee'|'idle'
//   onTileEnter(char,newHex,oldQ,oldR) optional — planet elevation adjust
//   onSwordSweep(char,hexes,dmg)   optional — planet ore damage
//   onProjectileMissUnit(shot)     optional — planet ore hit; return true if hit
//   onGrenadeExplode(shot)         optional — planet ore + visual
//   onNova(char,sk)                optional — nova visual fx
//   onLootPickup(lt,char)          optional — add item to cargo/gear

G.CharController = {};

// ── Player movement ───────────────────────────────────────────────────────────
// char wrapper: { ref, q, r, px, py, path, _z, _vz, _dodgeT, _dodgeCd,
//                 _faceX, _faceY, _jetActive, _jumpCount, _charMoving, ... }
G.CharController.updateMovement = function(dt, c, input, scene) {
  const ch = c.ref;
  c._dodgeT = Math.max(0, (c._dodgeT || 0) - dt);
  c._dodgeCd = Math.max(0, (c._dodgeCd || 0) - dt);

  let dx = 0, dy = 0;
  if(input.is('KeyA') || input.is('ArrowLeft'))  dx -= 1;
  if(input.is('KeyD') || input.is('ArrowRight')) dx += 1;
  if(input.is('KeyW') || input.is('ArrowUp'))    dy -= 1;
  if(input.is('KeyS') || input.is('ArrowDown'))  dy += 1;

  // Double-tap Shift → dodge burst in move/facing direction
  if(input.pressed('ShiftLeft') || input.pressed('ShiftRight')) {
    const now = performance.now() / 1000;
    if(c._lastShift != null && now - c._lastShift < 0.3 && c._dodgeCd <= 0) {
      let fx = dx, fy = dy;
      if(!(fx || fy)) { fx = c._faceX || 0; fy = c._faceY || 1; }
      const l = Math.hypot(fx, fy) || 1;
      c._dodgeX = fx / l; c._dodgeY = fy / l; c._dodgeT = 0.22; c._dodgeCd = 0.7;
      if(ch) ch.energy = Math.max(0, ch.energy - 25);
      c._lastShift = null;
      G.sound?.uiClick?.();
    } else {
      c._lastShift = performance.now() / 1000;
    }
  }

  // Gravity + jump + jetpack
  c._z = c._z || 0; c._vz = c._vz || 0;
  const grounded = c._z <= 0.001;
  const jetDef = ch ? G.charGearOfKind(ch, 'jetpack') : null;
  c._jetActive = false;
  c._jumpCount = c._jumpCount || 0;
  const grav = scene.gravity ?? 16;
  if(grav > 0) {
    if(input.pressed('Space') && grounded) {
      c._vz = 6.5; c._jumpCount = 0; G.sound?.planetJump?.();
    } else if(input.pressed('Space') && jetDef && c._jumpCount === 0 && !grounded && c._vz < 0) {
      c._vz = 6.5; c._jumpCount = 1; G.sound?.planetJump?.();
    }
    if(jetDef && input.is('Space') && ch && ch.energy > 0 && (!grounded || c._vz > 0)) {
      c._vz = Math.min(jetDef.lift || 5.5, c._vz + (jetDef.thrust || 9) * dt);
      ch.energy = Math.max(0, ch.energy - (jetDef.drain || 18) * dt);
      c._jetActive = true;
    }
    c._vz -= grav * dt;
    c._z = Math.max(0, c._z + c._vz * dt);
    if(c._z <= 0 && c._vz < 0) c._vz = 0;
  }
  const airborne = c._z > 0.05;

  if(ch && !c._jetActive) ch.energy = Math.min(ch.maxEnergy || 100, ch.energy + 14 * dt);

  let vx = 0, vy = 0;
  const roadMul = scene.tileSpeedMul ? scene.tileSpeedMul(c) : 1.0;
  const base = 3.2 * roadMul;
  if(c._dodgeT > 0) {
    vx = c._dodgeX * 11; vy = c._dodgeY * 11;
  } else if(dx || dy) {
    const l = Math.hypot(dx, dy);
    const isSprinting = !c._jetActive && (input.is('ShiftLeft') || input.is('ShiftRight'));
    const sprint = c._jetActive ? 2.1 : isSprinting ? 1.9 : 1;
    vx = dx / l * base * sprint; vy = dy / l * base * sprint;
    if(isSprinting && ch && ch.energy > 0) ch.energy = Math.max(0, ch.energy - 12 * dt);
    if(dx) c._faceX = dx / l;
    c._faceY = dy / l;
    c.path = null;
  } else if(!airborne) {
    c._charMoving = false;
    return;
  }

  // Collision: full move, then axis-slide fallback
  const can = (px, py) => scene.canMoveTo(px, py, c, airborne);
  const nx = c.px + vx * dt, ny = c.py + vy * dt;
  const oldQ = c.q, oldR = c.r;
  let w = can(nx, ny);
  if(w) { c.px = nx; c.py = ny; }
  else {
    const wx = can(nx, c.py); if(wx) { c.px = nx; w = wx; }
    const wy = can(c.px, ny); if(wy) { c.py = ny; if(!w) w = wy; }
  }
  if(w) {
    c.q = w.q; c.r = w.r;
    c._charMoving = !!(vx || vy);
    if(scene.onTileEnter && (w.q !== oldQ || w.r !== oldR)) scene.onTileEnter(c, w, oldQ, oldR);
  } else {
    c._charMoving = false;
  }
};

// ── Weapon attack ─────────────────────────────────────────────────────────────
G.CharController.attack = function(c, hand, input, scene, useFacing) {
  const cdKey = hand === 'lefthand' ? '_atkCdL' : '_atkCdR';
  if((c[cdKey] || 0) > 0) return;
  const ch = c.ref;
  const wpn = G.gearResolve(ch.equip?.[hand]);
  if(!wpn || (wpn.kind !== 'pistol' && wpn.kind !== 'sword' && wpn.kind !== 'grenade')) return;
  c[cdKey] = 1 / (wpn.rof || 1.5);

  const mul = (wpn.kind === 'pistol' || wpn.kind === 'grenade') ? (ch.rangedMul || 1) : (ch.meleeMul || 1);
  const crit = Math.random() < (ch.critChance || 0.05);
  const dmg = Math.max(1, Math.round((wpn.dmg || 12) * mul * (crit ? 2 : 1)));

  // Aim toward cursor (scene-local space); fallback to last facing
  let aimx = c._faceX || 0, aimy = c._faceY || 1;
  if(!useFacing && scene.worldToLocal && input.mouseX != null) {
    const loc = scene.worldToLocal(input.mouseX, input.mouseY);
    const d = scene.delta(c.px, c.py, loc.x, loc.y);
    if(d.dist > 0.01) { aimx = d.dx / d.dist; aimy = d.dy / d.dist; }
  }
  c._faceX = aimx; c._faceY = aimy;

  if(wpn.kind === 'pistol') {
    G.CharController._spawnShot(scene, c, aimx, aimy, dmg, wpn.color || '#ffcc44', 'player');
    if(ch) ch.energy = Math.max(0, ch.energy - 2);
    G.sound?.weapon?.('laser');
  } else if(wpn.kind === 'grenade') {
    const tgtx = c.px + aimx * (wpn.range || 5) * G.HEX_WORLD * 0.5;
    const tgty = c.py + aimy * (wpn.range || 5) * G.HEX_WORLD * 0.5;
    scene.addShot({ x: c.px, y: c.py, vx: aimx * 8, vy: aimy * 8, dmg,
                    team: 'player', color: wpn.color || '#dd5544', life: 2.5, src: c,
                    isGrenade: true, tgtx, tgty, rng: wpn.range || 5 });
    if(ch) ch.energy = Math.max(0, ch.energy - 4);
    G.sound?.explosion?.();
  } else {
    // Sword: arc sweep through 3 forward hexes
    c._swingBaseAngle = Math.atan2(aimy, aimx);
    let bestDir = 0, bestDot = -Infinity;
    for(let i = 0; i < 6; i++) {
      const [dq, dr] = G.HEX_DIRS[i];
      const dp = G.hexToPixel(dq, dr, 1);
      const dot = dp.x * aimx + dp.y * aimy;
      if(dot > bestDot) { bestDot = dot; bestDir = i; }
    }
    const [fdq, fdr] = G.HEX_DIRS[bestDir];
    const [ldq, ldr] = G.HEX_DIRS[(bestDir + 5) % 6];
    const [rdq, rdr] = G.HEX_DIRS[(bestDir + 1) % 6];
    const rh = scene.resolveHex || ((q, r) => ({ q, r }));
    const targets = [
      rh(c.q + fdq, c.r + fdr),
      rh(c.q + ldq, c.r + ldr),
      rh(c.q + rdq, c.r + rdr),
    ];
    for(const n of scene.npcs) {
      if(n.ref.hp <= 0) continue;
      if(targets.some(t => t.q === n.q && t.r === n.r)) scene.applyDamage(n, dmg, c);
    }
    c._swingT = 0.18;
    c._sweptHexes = targets;
    if(scene.onSwordSweep) scene.onSwordSweep(c, targets, dmg);
    G.sound?.weapon?.('cannon');
  }
};

// ── Shield hold ───────────────────────────────────────────────────────────────
G.CharController.holdShield = function(c, hand, dt, scene) {
  const ch = c.ref;
  const wpn = G.gearResolve(ch.equip?.[hand]);
  if(!wpn || wpn.kind !== 'shield' || ch.energy <= 0) { scene.deactivateShield(c); return; }
  c._shieldActive = true;
  c._shieldR = 1.15;
  ch.energy = Math.max(0, ch.energy - 6 * dt);
  if(ch.energy <= 0) scene.deactivateShield(c);
};

// ── Active skill cast ─────────────────────────────────────────────────────────
// Returns true on success; false = on cooldown or out of mana (caller shows msg).
G.CharController.castSkill = function(c, sk, aimx, aimy, scene) {
  const ch = c.ref;
  if((ch.skillCd?.[sk.id] || 0) > 0) return false;
  if(ch.mana < sk.mana) return false;
  ch.mana -= sk.mana;
  (ch.skillCd || (ch.skillCd = {}))[sk.id] = sk.cooldown;

  const mainDmg = G.gearDmg(ch.equip?.righthand) || G.gearDmg(ch.equip?.lefthand) || 12;
  const crit = Math.random() < (ch.critChance || 0.05);
  const rankMul = 1 + (G.charSkillRank(ch, sk.id) - 1) * 0.25;
  const hit = (mul, ranged) => Math.max(1, Math.round(
    mainDmg * mul * rankMul * (ranged ? (ch.rangedMul || 1) : (ch.meleeMul || 1)) * (crit ? 2 : 1)));

  if(sk.type === 'melee') {
    for(const n of scene.npcs) {
      if(n.ref.hp <= 0) continue;
      const d = scene.delta(c.px, c.py, n.px, n.py);
      if(d.dist <= sk.radius + 0.4) {
        const l = d.dist || 1;
        if((d.dx / l) * aimx + (d.dy / l) * aimy > 0 || d.dist < 0.9)
          scene.applyDamage(n, hit(sk.dmgMul, false), c);
      }
    }
    c._swingT = 0.2;
  } else if(sk.type === 'spread') {
    const base = Math.atan2(aimy, aimx);
    for(let i = 0; i < sk.count; i++) {
      const a = base + (i - (sk.count - 1) / 2) * sk.spread;
      G.CharController._spawnShot(scene, c, Math.cos(a), Math.sin(a), hit(sk.dmgMul, true), sk.color || '#ffcc44', 'player');
    }
    if(ch) ch.energy = Math.max(0, ch.energy - 2);
  } else if(sk.type === 'dash') {
    for(let s = sk.range; s >= 1; s -= 0.5) {
      const px = c.px + aimx * s, py = c.py + aimy * s;
      const w = scene.canMoveTo(px, py, c, true);
      if(w) { c.px = px; c.py = py; c.q = w.q; c.r = w.r; c.path = null; c._dodgeT = 0.15; break; }
    }
  } else if(sk.type === 'nova') {
    for(const n of scene.npcs) {
      if(n.ref.hp <= 0) continue;
      const d = scene.delta(c.px, c.py, n.px, n.py);
      if(d.dist <= sk.radius) {
        scene.applyDamage(n, hit(sk.dmgMul, false), c);
        if(sk.slow) n._slowT = Math.max(n._slowT || 0, sk.slow);
      }
    }
    if(scene.onNova) scene.onNova(c, sk);
  } else if(sk.type === 'heal') {
    ch.hp = Math.min(ch.maxHp, ch.hp + Math.round(ch.maxHp * sk.healMul * rankMul));
    if(scene.onNova) scene.onNova(c, { radius: 1.6, color: sk.color, t: 0.45 });
  }
  G.sound?.uiClick?.();
  return true;
};

// ── Projectile physics ────────────────────────────────────────────────────────
G.CharController.updateProjectiles = function(dt, scene) {
  const shots = scene.shots;
  for(let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    let hit = false, explode = false;

    if(s.isGrenade) {
      const d = scene.delta(s.x, s.y, s.tgtx, s.tgty);
      if(d.dist < 0.6 || s.life <= 0) explode = true;
    }

    // Enemy shots: check shield bubble first
    if(!hit && !s.isGrenade && s.team === 'enemy') {
      for(const u of scene.crew) {
        if(!u._shieldActive || u.ref.hp <= 0 || u.ref.energy <= 0) continue;
        const d = scene.delta(s.x, s.y, u.px, u.py);
        if(d.dist < (u._shieldR || 1.15)) {
          u.ref.energy = Math.max(0, u.ref.energy - s.dmg * 0.5);
          u._shieldFlash = 0.2;
          if(u.ref.energy <= 0) scene.deactivateShield(u);
          hit = true; break;
        }
      }
    }

    // Unit hit
    if(!hit && !s.isGrenade) {
      const pool = s.team === 'player' ? scene.npcs : scene.crew;
      for(const u of pool) {
        if(u.ref.hp <= 0) continue;
        const d = scene.delta(s.x, s.y, u.px, u.py);
        if(d.dist < 0.55) { scene.applyDamage(u, s.dmg, s.src); hit = true; break; }
      }
    }

    // Scene-specific non-unit hit (e.g. ore tiles on planet)
    if(!hit && !s.isGrenade && scene.onProjectileMissUnit) {
      hit = scene.onProjectileMissUnit(s) || false;
    }

    if(explode) {
      const exR = s.rng || 3;
      const pool = s.team === 'player' ? scene.npcs : scene.crew;
      for(const u of pool) {
        if(u.ref.hp <= 0) continue;
        const d = scene.delta(s.x, s.y, u.px, u.py);
        if(d.dist <= exR) scene.applyDamage(u, s.dmg, s.src);
      }
      if(scene.onGrenadeExplode) scene.onGrenadeExplode(s);
      hit = true;
    }

    if(hit || s.life <= 0) shots.splice(i, 1);
  }
};

// ── Loot pickup ───────────────────────────────────────────────────────────────
G.CharController.updateLoot = function(dt, scene) {
  const loot = scene.loot;
  const live = scene.crew.filter(c => c.ref.hp > 0);
  for(let i = loot.length - 1; i >= 0; i--) {
    const lt = loot[i];
    lt.life = (lt.life || 30) - dt;
    let taken = false;
    for(const c of live) {
      const d = scene.delta(lt.x, lt.y, c.px, c.py);
      if(d.dist >= 0.7) continue;
      if(scene.onLootPickup) scene.onLootPickup(lt, c);
      taken = true; break;
    }
    if(taken || lt.life <= 0) loot.splice(i, 1);
  }
};

// ── NPC AI (one unit per call) ────────────────────────────────────────────────
G.CharController.updateNpcAI = function(dt, n, crewTargets, scene) {
  n._atkCd   = Math.max(0, (n._atkCd   || 0) - dt);
  n._combatT = Math.max(0, (n._combatT || 0) - dt);
  const stance = scene.npcStance(n);
  if(stance === 'idle') return;

  const live = crewTargets.filter(c => c.ref.hp > 0);
  let tgt = null, td = Infinity, tdel = null;
  for(const c of live) {
    const d = scene.delta(n.px, n.py, c.px, c.py);
    if(d.dist < td) { td = d.dist; tgt = c; tdel = d; }
  }
  if(!tgt) return;

  if(stance === 'flee') {
    if(td < 5) {
      n._combatT = 1.5;
      n._fleeT = (n._fleeT || 0) - dt;
      if(n._fleeT <= 0) {
        n._fleeT = 1.3;
        const aw = G.CharController._fleeCell(n, tdel, scene);
        if(aw) { const p = scene.pathfind({ q: n.q, r: n.r }, aw); if(p?.length) n.path = p; }
      }
    }
    return;
  }

  const wpn = G.charGearOfKind(n.ref, 'pistol') || G.charGearOfKind(n.ref, 'sword');
  const range = wpn ? (wpn.range || (wpn.kind === 'pistol' ? 9 : 1.3)) : 1.2;
  if(td > 8) return; // outside aggro radius
  n._combatT = 1.5;

  const ranged = wpn?.kind === 'pistol';
  const hasLOS = !ranged || scene.checkLOS(n, tgt);

  if(td > range * 0.9 || (ranged && !hasLOS)) {
    // Phasing elite: blink toward target
    if(n.elite?.includes('phasing') && td > 3 && Math.random() < 0.02) {
      const l = tdel.dist || 1;
      const bx = tgt.px - (tdel.dx / l) * 2, by = tgt.py - (tdel.dy / l) * 2;
      const w = scene.canMoveTo(bx, by, n, false);
      if(w) { n.px = bx; n.py = by; n.q = w.q; n.r = w.r; n.path = null; }
    }
    n._chaseT = (n._chaseT || 0) - dt;
    if(n._chaseT <= 0 || !(n.path?.length)) {
      n._chaseT = 0.6;
      const p = scene.pathfind({ q: n.q, r: n.r }, { q: tgt.q, r: tgt.r });
      if(p?.length) n.path = p;
    }
  } else {
    n.path = null;
    if(n._atkCd <= 0) {
      const npcDmg = n._dmg || (wpn ? (wpn.dmg || 10) : 10);
      n._atkCd = wpn ? 1 / (wpn.rof || 1.2) : 1.2;
      const l = tdel.dist || 1;
      n._faceX = tdel.dx / l; n._faceY = tdel.dy / l;
      if(ranged) {
        scene.addShot({ x: n.px, y: n.py, vx: n._faceX * 14, vy: n._faceY * 14,
                        dmg: npcDmg, team: 'enemy', color: wpn?.color || '#ff5533', life: 1.2, src: n });
      } else {
        scene.applyDamage(tgt, npcDmg, n);
        n._swingT = 0.18;
      }
    }
  }
};

// ── Timers + regen ────────────────────────────────────────────────────────────
// healTargets: optional sub-array for elite heal aura (e.g. npcs only, not crew).
// Defaults to all units when omitted.
G.CharController.updateTimers = function(dt, units, scene, healTargets) {
  const targets = healTargets || units;
  for(const c of units) {
    const ch = c.ref;
    c._noRegenT   = Math.max(0, (c._noRegenT   || 0) - dt);
    c._swingT     = Math.max(0, (c._swingT     || 0) - dt);
    c._shieldFlash = Math.max(0, (c._shieldFlash || 0) - dt);
    if(c._swingT <= 0) c._sweptHexes = null;
    c._hurtT      = Math.max(0, (c._hurtT      || 0) - dt);
    c._slowT      = Math.max(0, (c._slowT      || 0) - dt);
    if(ch.hp > 0 && ch.hp < ch.maxHp && c._noRegenT <= 0)
      ch.hp = Math.min(ch.maxHp, ch.hp + 4 * dt);
    if(ch.maxMana && ch.mana < ch.maxMana)
      ch.mana = Math.min(ch.maxMana, ch.mana + 5 * dt);
    if(c.elite?.length && ch.hp > 0) {
      for(const e of c.elite) {
        const ea = G.ELITE_AFFIXES[e];
        if(ea.regen && ch.hp < ch.maxHp)
          ch.hp = Math.min(ch.maxHp, ch.hp + ea.regen * dt);
        if(ea.healAura) for(const o of targets) {
          if(o === c || o.ref.hp <= 0 || o.ref.hp >= o.ref.maxHp) continue;
          const d = scene.delta(c.px, c.py, o.px, o.py);
          if(d.dist <= (ea.auraR || 4))
            o.ref.hp = Math.min(o.ref.maxHp, o.ref.hp + ea.healAura * dt);
        }
      }
    }
  }
};

// ── Path-following (non-torus; used by ship boarding NPCs) ───────────────────
// Planet uses its own updatePlanetCrew (torus-aware). This is for ship interior.
G.CharController.followPath = function(dt, c, spd) {
  if(!c.path?.length) return;
  const target = c.path[0];
  const tu = G.hexToPixel(target.q, target.r, 1);
  const dx = tu.x - c.px, dy = tu.y - c.py, d = Math.hypot(dx, dy);
  const step = (spd || 2.4) * (c._spdMul || 1) * (c._slowT > 0 ? 0.45 : 1) * dt;
  if(d > 0.001) { c._faceX = dx / d; c._faceY = dy / d; }
  if(d <= step || d < 0.001) {
    c.px = tu.x; c.py = tu.y; c.q = target.q; c.r = target.r; c.path.shift();
  } else {
    c.px += dx / d * step; c.py += dy / d * step;
  }
};

// ── Internal helpers ──────────────────────────────────────────────────────────
G.CharController._spawnShot = function(scene, from, ux, uy, dmg, color, team) {
  scene.addShot({ x: from.px, y: from.py, vx: ux * 14, vy: uy * 14,
                  dmg, team: team || 'player', color, life: 1.2, src: from });
};

G.CharController._fleeCell = function(n, tdel, scene) {
  const ax = -tdel.dx, ay = -tdel.dy, l = Math.hypot(ax, ay) || 1;
  const bx = n.px + ax / l * 3, by = n.py + ay / l * 3;
  const h = G.pixelToHex(bx, by, 1);
  const rh = scene.resolveHex ? scene.resolveHex(h.q, h.r) : h;
  return scene.canMoveTo(bx, by, n, false) ? rh : null;
};
