'use strict';
// Correctness tests for the DOM-free game logic: math utils, data integrity,
// particle lifecycle, and targeting.
const { group, test, ok, eq, approx, inRange } = require('./tlib');

module.exports = function runUnit(G) {
  // ── Math / vector utils ─────────────────────────────────
  group('utils — math');

  test('clamp bounds', () => {
    eq(G.clamp(5, 0, 10), 5);
    eq(G.clamp(-3, 0, 10), 0);
    eq(G.clamp(99, 0, 10), 10);
  });

  test('lerp endpoints + midpoint', () => {
    eq(G.lerp(0, 10, 0), 0);
    eq(G.lerp(0, 10, 1), 10);
    eq(G.lerp(0, 10, 0.5), 5);
  });

  test('wrapAngle stays in [-π, π]', () => {
    for (const a of [0, 3, -3, 7, -7, 100, -100, Math.PI * 5]) {
      inRange(G.wrapAngle(a), -Math.PI - 1e-9, Math.PI + 1e-9, `wrap(${a})`);
    }
    approx(G.wrapAngle(0), 0);
    approx(G.wrapAngle(Math.PI * 2), 0, 1e-9);
  });

  test('circleHit overlap / miss / boundary', () => {
    ok(G.circleHit(0, 0, 5, 3, 0, 5), 'overlapping circles hit');
    ok(!G.circleHit(0, 0, 5, 100, 0, 5), 'distant circles miss');
    ok(!G.circleHit(0, 0, 5, 10, 0, 5), 'exact touch is not a hit (strict <)');
    ok(G.circleHit(0, 0, 5, 9.9, 0, 5), 'just inside touches');
    eq(G.circleHit(0, 0, 5, 3, 0, 5), G.circleHit(3, 0, 5, 0, 0, 5), 'symmetric');
  });

  test('v2 vector ops', () => {
    eq(G.v2.len({ x: 3, y: 4 }), 5);
    eq(G.v2.dist({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
    const n = G.v2.norm({ x: 0, y: 10 });
    approx(n.x, 0); approx(n.y, 1);
    eq(G.v2.dot({ x: 1, y: 2 }, { x: 3, y: 4 }), 11);
  });

  test('pct clamps to 0..100', () => {
    eq(G.pct(5, 10), 50);
    eq(G.pct(-1, 10), 0);
    eq(G.pct(20, 10), 100);
  });

  test('seededRng is deterministic + in [0,1)', () => {
    const a = G.seededRng('hello'), b = G.seededRng('hello'), c = G.seededRng('world');
    const seqA = [], seqB = [], seqC = [];
    for (let i = 0; i < 50; i++) { seqA.push(a()); seqB.push(b()); seqC.push(c()); }
    eq(JSON.stringify(seqA), JSON.stringify(seqB), 'same seed → same sequence');
    ok(JSON.stringify(seqA) !== JSON.stringify(seqC), 'different seed → different sequence');
    for (const v of seqA) inRange(v, 0, 0.999999999, 'rng value');
  });

  test('randInt inclusive range', () => {
    for (let i = 0; i < 2000; i++) {
      const v = G.randInt(2, 5);
      ok(Number.isInteger(v), 'integer');
      inRange(v, 2, 5);
    }
  });

  test('rarityColor lookup + fallback', () => {
    eq(G.rarityColor('r'), G.RARITY.r.color);
    eq(G.rarityColor('__nope__'), '#cccccc');
  });

  test('fmtCredits formatting', () => {
    ok(/^\$ /.test(G.fmtCredits(1234)), 'has "$ " prefix');
    ok(/1.?234/.test(G.fmtCredits(1234)), 'contains the number');
    eq(G.fmtCredits(0), '$ 0');
  });

  // ── Static data integrity ───────────────────────────────
  group('data — integrity');

  test('every SHIPS.shape exists in SHAPES', () => {
    for (const [id, s] of Object.entries(G.SHIPS)) {
      ok(s.shape, `${id} has a shape`);
      ok(G.SHAPES[s.shape], `${id} → shape "${s.shape}" missing from SHAPES`);
    }
  });

  test('WEAPONS have valid rarity + positive numbers', () => {
    for (const [id, w] of Object.entries(G.WEAPONS)) {
      ok(G.RARITY[w.rarity], `${id} rarity "${w.rarity}" invalid`);
      ok(typeof w.type === 'string' && w.type, `${id} missing type`);
      inRange(w.damage, 0, 1e6, `${id} damage`);
      inRange(w.range, 1, 1e6, `${id} range`);
      ok(w.fireRate > 0, `${id} fireRate must be > 0`);
    }
  });

  test('ITEMS have valid rarity + numeric base/mass', () => {
    for (const [id, it] of Object.entries(G.ITEMS)) {
      ok(G.RARITY[it.rarity], `${id} rarity "${it.rarity}" invalid`);
      ok(typeof it.base === 'number', `${id} base numeric`);
      ok(typeof it.mass === 'number', `${id} mass numeric`);
    }
  });

  test('MODULES have a slot + valid rarity', () => {
    for (const [id, m] of Object.entries(G.MODULES)) {
      ok(typeof m.slot === 'string' && m.slot, `${id} missing slot`);
      if (m.rarity != null) ok(G.RARITY[m.rarity], `${id} rarity "${m.rarity}" invalid`);
    }
  });

  test('RECIPES reference real items/modules', () => {
    const isInstallable = (k) => !!(G.MODULES[k] || G.WEAPONS[k]);
    for (const r of G.RECIPES) {
      for (const inId of Object.keys(r.inputs || {})) {
        ok(G.ITEMS[inId], `recipe ${r.id} input "${inId}" not an item`);
      }
      if (r.output) ok(G.ITEMS[r.output.item], `recipe ${r.id} output "${r.output.item}" not an item`);
      if (r.outputModule) ok(isInstallable(r.outputModule), `recipe ${r.id} outputModule "${r.outputModule}" not installable`);
      ok(r.output || r.outputModule, `recipe ${r.id} produces nothing`);
    }
  });

  test('RARITY entries complete', () => {
    for (const [k, v] of Object.entries(G.RARITY)) {
      ok(v.color, `${k} missing color`);
      ok(v.cls, `${k} missing cls`);
      ok(v.label, `${k} missing label`);
    }
  });

  test('HOSTILE references known factions (independent = neutral alias)', () => {
    const known = new Set([...Object.keys(G.FACTIONS), 'independent']);
    for (const [src, targets] of Object.entries(G.HOSTILE)) {
      ok(G.FACTIONS[src], `HOSTILE source "${src}" not a faction`);
      for (const t of Object.keys(targets)) ok(known.has(t), `HOSTILE target "${t}" unknown`);
    }
  });

  // ── Particle system lifecycle ───────────────────────────
  group('particles — lifecycle');

  test('emit adds an active particle', () => {
    const P = new G.Particles();
    eq(P.active.length, 0);
    P.emit({ x: 1, y: 2, life: 1 });
    eq(P.active.length, 1);
    eq(P.active[0].x, 1);
  });

  test('update expires particles + recycles to pool', () => {
    const P = new G.Particles();
    P.emit({ x: 0, y: 0, life: 0.5 });
    P.update(1.0); // life 0.5 - 1.0 <= 0
    eq(P.active.length, 0, 'expired removed');
    ok(P.pool.length >= 1, 'particle returned to pool');
    // next emit reuses the pooled object
    const before = P.pool.length;
    P.emit({ x: 5, y: 5, life: 1 });
    eq(P.pool.length, before - 1, 'pool drained on reuse');
  });

  test('burst emits count particles', () => {
    const P = new G.Particles();
    P.burst({ x: 0, y: 0, life: 1 }, 7);
    eq(P.active.length, 7);
  });

  test('ring expands toward maxR and is alpha-faded', () => {
    const P = new G.Particles();
    P.shield_hit(0, 0, 20);
    const ring = P.active.find(p => p.type === 'ring');
    ok(ring, 'shield_hit creates a ring');
    const r0 = ring.r;
    P.update(0.05);
    ok(ring.r >= r0, 'ring grows');
    ok(ring.r <= ring.maxR + 1e-6, 'ring never exceeds maxR');
  });

  // ── Targeting ───────────────────────────────────────────
  group('space — targeting');

  const fakeSpace = () => ({
    enemies: [
      { x: 0, y: 0, dead: false },
      { x: 0, y: 0, dead: true },            // excluded
      { x: 0, y: 0, _deathDone: true },      // excluded
      { x: 0, y: 0, boarded: true },         // excluded
    ],
    npcs: [{ x: 0, y: 0 }, { x: 0, y: 0, dead: true }],
    fleetShips: [{ x: 0, y: 0 }, { x: 0, y: 0, _deathDone: true }],
    derelicts: [{ x: 0, y: 0 }, { x: 0, y: 0, looted: true }],
    turrets: [{ x: 0, y: 0 }, { x: 0, y: 0, _dead: true }],
  });

  test('allTargets filters dead/boarded/looted', () => {
    const all = G.Space.prototype.allTargets.call(fakeSpace());
    // 1 enemy + 1 npc + 1 fleet + 1 derelict + 1 turret
    eq(all.length, 5);
  });

  test('allTargets ordering: enemies→npcs→fleet→derelicts→turrets', () => {
    const sp = {
      enemies: [{ x: 1, y: 0, tag: 'e' }],
      npcs: [{ x: 2, y: 0, tag: 'n' }],
      fleetShips: [{ x: 3, y: 0, tag: 'f' }],
      derelicts: [{ x: 4, y: 0, tag: 'd' }],
      turrets: [{ x: 5, y: 0, tag: 't' }],
    };
    const tags = G.Space.prototype.allTargets.call(sp).map(o => o.tag);
    eq(tags.join(''), 'enfdt');
  });

  test('nearestTarget returns closest live entity', () => {
    const sp = {
      enemies: [{ x: 1000, y: 0 }, { x: 30, y: 0 }],
      npcs: [], fleetShips: [], derelicts: [], turrets: [],
      allTargets: G.Space.prototype.allTargets, // nearestTarget calls this.allTargets()
    };
    const near = G.Space.prototype.nearestTarget.call(sp, 0, 0);
    eq(near.x, 30);
  });

  // ── Ship: cockpit / flyability / slot install ───────────
  group('ship — cockpit & builder');

  const cockpitInstId = (s) => Object.keys(s.modules).find(id => {
    const m = G.MODULES[s.modules[id].moduleId]; return m && m.slot === 'cockpit';
  });

  test('cockpit module exists and is required gear', () => {
    ok(G.MODULES.cockpit, 'cockpit module defined');
    eq(G.MODULES.cockpit.slot, 'cockpit');
  });

  test('new ship has a cockpit and is flyable', () => {
    const s = new G.Ship('shuttle');
    ok(s.flyable, 'flyable after construction');
    ok(cockpitInstId(s), 'a cockpit instance is installed');
  });

  test('removing the cockpit makes the ship unflyable; ensureCockpit restores', () => {
    const s = new G.Ship('shuttle');
    s.removeModule(cockpitInstId(s));
    ok(!s.flyable, 'not flyable without cockpit');
    s.ensureCockpit();
    ok(s.flyable, 'flyable again after ensureCockpit');
  });

  test('installModuleAt respects slot bounds and occupancy', () => {
    const s = new G.Ship('shuttle');
    const free = s.slots.indexOf(null);
    ok(free !== -1, 'has a free slot');
    ok(s.installModuleAt('basic_engine', free), 'installs into free slot');
    eq(s.installModuleAt('basic_engine', free), false, 'rejects occupied slot');
    eq(s.installModuleAt('basic_engine', 999), false, 'rejects out-of-range slot');
  });

  test('rotateModule cycles 0..3 and propagates to weapon facing', () => {
    const s = new G.Ship('shuttle');
    const wInst = Object.keys(s.modules).find(id => {
      const m = G.WEAPONS[s.modules[id].moduleId]; return m && (m.slot === 'weapon' || m.slot === 'turret');
    });
    ok(wInst, 'shuttle starts with a weapon');
    eq(s.modules[wInst].rot || 0, 0, 'starts facing forward');
    s.rotateModule(wInst, 1); eq(s.modules[wInst].rot, 1);
    s.rotateModule(wInst, 1); s.rotateModule(wInst, 1); s.rotateModule(wInst, 1);
    eq(s.modules[wInst].rot, 0, 'wraps back to 0 after 4 turns');
    s.rotateModule(wInst, -1); eq(s.modules[wInst].rot, 3, 'left rotation wraps to 3');
    const wslot = s.weaponSlots.find(w => w.weaponId === s.modules[wInst].moduleId);
    eq(wslot.rot, 3, 'weaponSlot reflects rotation after recompute');
  });

  test('ensureCockpit expands slots if the ship is full', () => {
    const s = new G.Ship('shuttle');
    s.removeModule(cockpitInstId(s));
    for(let i=0;i<s.slots.length;i++) if(s.slots[i]===null) s.installModuleAt('basic_engine', i);
    ok(s.slots.indexOf(null) === -1, 'ship is full');
    const before = s.slots.length;
    s.ensureCockpit();
    ok(s.flyable, 'cockpit force-installed when full');
    ok(s.slots.length === before + 1, 'slot count expanded by one');
  });
};
