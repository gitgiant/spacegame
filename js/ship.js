'use strict';
// ── Ship class ────────────────────────────────────────────
G.Ship = class extends G.ShipEntity {
  constructor(templateId) {
    super();
    const tpl = G.SHIPS[templateId];
    if(!tpl) throw new Error('Unknown ship: '+templateId);

    this.templateId = templateId;
    this._shipClass = tpl.class || null;
    this.name = tpl.name;
    this.faction = tpl.faction;
    this.shapeId = tpl.shape;
    // Module-layout silhouette strategy (distinct from shapeId). Template may
    // override; otherwise determined by faction. Used by _generateHexLayout.
    this.layoutShape = tpl.layoutShape || G.FACTION_LAYOUT_SHAPE[tpl.faction] || 'random';

    // Base physics
    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.angle = 0;    // radians, 0=pointing up
    this.angVel = 0;
    this._reverseHeldTime = 0;
    this._strafeCooldown = 0;

    // Base stats — hull stats (mass, hull, energy, fuel, cargo, turn) now live in
    // the class core module. Templates store 0; _recompute accumulates from modules.
    this._baseMass        = 0;
    this._baseThrust      = tpl.baseThrust;
    this._baseTurn        = 0;  // provided by core module stats.turnBase
    this._baseHull        = 0;
    this._baseEnergy      = 0;
    this._baseFuel        = 0;
    this._baseCargoSpace  = 0;

    // Current stats (recomputed from modules)
    this.maxHull   = 0;
    this.hull      = 0;
    this.maxShields= 0;
    this.shields   = 0;
    this.shieldRegen= 0;
    this.maxEnergy = 0;
    this.energy    = 0;
    this.energyRegen= 0;
    this.maxFuel   = 0;
    this.fuel      = 0;
    this.fuelBurnRate = 0.5;
    this.cargoSpace = 0;
    this.maxCrew   = 1;  // pilot always present
    this.escapePods= 0;
    this.armor     = 0;
    this.autoRepair= 0;
    this.canCraft  = false;
    this.tractorRange= 0;
    this.sensorRange = 600;
    this.canJump   = false;
    this.jumpRange = 0;
    this.mass      = 0;
    this.thrustPower = 0;
    this.turnSpeed = 0;

    // Power distribution (0-1 for each, sum should be ≈1)
    this.powerWeapons = 0.33;
    this.powerShields = 0.33;
    this.powerEngines = 0.34;

    this._boostWasActive = false;

    // Module slots: flat array of instId|null, length = ship's slot count
    this.slots = new Array(tpl.slots).fill(null);

    // Installed module instances: { instanceId: { moduleId, slotIdx, hp, broken } }
    this.modules = {};
    this._nextModId = 1;

    // Weapons
    this.weaponSlots = []; // array of {moduleId, cooldown}
    this.activeWeapon = 0;

    // Cargo hold
    this.cargo = {}; // itemId -> qty
    // Loose ARPG gear instances (rolled, unique). Equipped pieces live on a
    // character's equip map; these are the unequipped ones held aboard.
    this.gear = []; // [ {uid,base,rarity,ilvl,dmg,mods,affixes,name} ]

    // Ammunition (rounds, not cargo units)
    this.ammo = {}; // ammoId -> count

    // Crew
    this.crew = []; // array of crew objects

    // Module inventory: modules picked up with no free slot
    this.moduleInventory = [];

    // Abilities (array of ability IDs, indexed 0-9 for keys 1-0)
    this.abilities = [];
    this.abilityCooldowns = {};

    // Combat state
    this.disabled    = false;
    this.disabledHp  = 50;
    this.empTimer    = 0;
    this.crewEfficiency = 1.0;

    // Cockpit required to fly; class core module required for hull stats
    this.installModule('cockpit');
    // Install starter modules from template (entries can be string id or {id, rot})
    (tpl.startModules || []).forEach(entry => {
      if(typeof entry === 'string') this.installModule(entry);
      else this.installModule(entry.id, entry.rot || 0);
    });
    (tpl.startWeapons  || []).forEach(wid => this.installModule(wid));

    // Fighter-class hulls ship with a sensor array as standard kit, granting
    // the Scan ability out of the box. Installed before the hex layout runs so
    // it gets a cell and the plating wraps it cleanly.
    if(tpl.class === 'fighter' && !this.canScan) this.installModule('basic_sensors');

    this._generateHexLayout(tpl);

    this._recompute();
    this.hull    = this.maxHull;
    this.shields = this.maxShields;
    this.energy  = this.maxEnergy;
    this.fuel    = this.maxFuel;

    this._initStartingCrew();
    this._assignCrewCells();
  }

  _initStartingCrew() {
    const fac = this.faction || 'neutral';
    const roleOrder = ['pilot','engineer','gunner','navigator','medic','marine'];
    const names = G.CREW_NAMES;
    let ni = 0;
    for(let i = 0; i < this.maxCrew; i++) {
      const roleId = roleOrder[Math.min(i, roleOrder.length - 1)];
      const role = G.CREW_ROLES[roleId];
      const cr = {
        id: 'c' + (Math.random() * 1e9 | 0),
        name: names[ni++ % names.length],
        role: roleId, roleName: role.name,
        faction: fac,
        skill: 2,
        wage: role.wage * 2,
        hireCost: role.wage * 20,
        desc: role.desc,
      };
      G.ensureCharFields(cr);   // hp/mana/energy pools + equip paper-doll
      this.crew.push(cr);
    }
  }

  // Migrate any crew (e.g. from an old save) into the unified character shape.
  ensureCrewChars() {
    if(!Array.isArray(this.gear)) this.gear = [];
    for(const cr of (this.crew || [])) { G.ensureCharFields(cr); G.charRecompute(cr); }
  }

  // Total mass of carried gear: loose pool + every crew member's worn pieces.
  gearMass() {
    let m = 0;
    for(const g of (this.gear || [])) m += G.gearMass(g);
    for(const cr of (this.crew || [])) for(const s of G.EQUIP_SLOTS) { const v = cr.equip?.[s]; if(v) m += G.gearMass(v); }
    return m;
  }

  // ── Crew positions / stations (crew-view mode) ───────────────────────────
  // Crew live on the module hex grid. A crew member "mans" the module under it;
  // sitting on a cockpit makes the ship pilotable, weapon/power/thruster cells
  // grant station bonuses. CREW_SPEED is local px/sec along the interior.
  CREW_SPEED() { return G.HEX_R * 2 * 3; }

  // All non-broken module cells (interior the crew can stand on).
  _interiorCells() {
    const out = [];
    for(const [id, inst] of Object.entries(this.modules)) {
      if(inst.q == null || inst.broken) continue;
      const m = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
      out.push({ q: inst.q, r: inst.r, instId: id, slot: m?.slot || 'special' });
    }
    return out;
  }
  // instId of the live module at cell (q,r), or null.
  _moduleAt(q, r) {
    for(const [id, inst] of Object.entries(this.modules))
      if(inst.q === q && inst.r === r && !inst.broken) return id;
    return null;
  }
  _slotAt(q, r) {
    const id = this._moduleAt(q, r);
    if(!id) return null;
    const m = G.MODULES[this.modules[id].moduleId] || G.WEAPONS[this.modules[id].moduleId];
    return m?.slot || 'special';
  }

  // Assign a starting cell to any crew that lacks a valid one. Pilots prefer the
  // cockpit, gunners weapons, engineers reactors; the rest fill interior cells.
  _assignCrewCells() {
    const cells = this._interiorCells();
    const used = new Set();
    for(const cr of this.crew) {
      if(cr.eva) continue;
      if(cr.q != null && this._moduleAt(cr.q, cr.r) && !used.has(G.hexKey(cr.q, cr.r))) {
        used.add(G.hexKey(cr.q, cr.r)); continue;          // keep valid saved cell
      }
      const claim = (pred) => cells.find(c => !used.has(G.hexKey(c.q, c.r)) && pred(c));
      let cell = null;
      if(cr.role === 'pilot')        cell = claim(c => c.slot === 'cockpit');
      else if(cr.role === 'gunner')  cell = claim(c => c.slot === 'weapon' || c.slot === 'turret');
      else if(cr.role === 'engineer')cell = claim(c => c.slot === 'power');
      cell = cell || claim(c => c.slot !== 'hull') || claim(() => true);
      if(cell) { cr.q = cell.q; cr.r = cell.r; used.add(G.hexKey(cell.q, cell.r)); }
      else { cr.q = 0; cr.r = 0; }
      cr.px = null; cr.py = null; cr.path = null; cr.order = null;
    }
  }

  // True if a non-EVA crew member occupies a live cockpit cell.
  hasPilot() {
    for(const cr of this.crew) {
      if(cr.eva) continue;
      if(this._slotAt(cr.q, cr.r) === 'cockpit') return true;
    }
    return false;
  }

  // BFS over connected non-broken cells. Returns array of {q,r} incl. start+goal,
  // or null if unreachable (e.g. goal across a hull breach).
  _crewPath(fq, fr, tq, tr) {
    const occ = new Set();
    for(const inst of Object.values(this.modules))
      if(inst.q != null && !inst.broken) occ.add(G.hexKey(inst.q, inst.r));
    const sK = G.hexKey(fq, fr), gK = G.hexKey(tq, tr);
    if(!occ.has(gK)) return null;
    if(sK === gK) return [{ q: fq, r: fr }];
    const prev = new Map([[sK, null]]); const queue = [sK];
    while(queue.length) {
      const ck = queue.shift();
      if(ck === gK) break;
      const { q, r } = G.hexFromKey(ck);
      for(const nb of G.hexNeighbors(q, r)) {
        const nk = G.hexKey(nb.q, nb.r);
        if(occ.has(nk) && !prev.has(nk)) { prev.set(nk, ck); queue.push(nk); }
      }
    }
    if(!prev.has(gK)) return null;
    const path = []; let k = gK;
    while(k) { const { q, r } = G.hexFromKey(k); path.unshift({ q, r }); k = prev.get(k); }
    return path;
  }

  // Issue an order to a crew member. type: 'move' | 'repair' | 'station' (walk to
  // a cell), 'disembark' (EVA out near world wx,wy), 'board' (EVA returns).
  orderCrew(cr, order) {
    if(!cr) return false;
    if(order.type === 'disembark') {
      // Walk to the nearest live hull-edge cell, then float out toward (wx,wy).
      const edge = this._nearestHullEdgeCell(cr.q, cr.r) || { q: cr.q, r: cr.r };
      cr.order = { type: 'disembark', q: edge.q, r: edge.r, wx: order.wx, wy: order.wy };
      cr.path = cr.eva ? null : this._crewPath(cr.q, cr.r, edge.q, edge.r);
      return true;
    }
    if(order.type === 'board') { cr.order = { type: 'board' }; return true; }
    if(order.type === 'repair') {
      // Can't stand on a broken cell — path onto the module if intact, else to a
      // reachable neighbour and repair from there.
      let path = this._crewPath(cr.q, cr.r, order.q, order.r);
      if(!path) {
        const adj = this._nearestReachableNeighbor(cr.q, cr.r, order.q, order.r);
        path = adj ? this._crewPath(cr.q, cr.r, adj.q, adj.r) : null;
      }
      if(!path) return false;
      cr.order = order; cr.path = path; return true;
    }
    // walk-to-cell orders (move / station)
    const path = cr.eva ? null : this._crewPath(cr.q, cr.r, order.q, order.r);
    if(!path && !cr.eva) return false;
    cr.order = order; cr.path = path;
    return true;
  }

  // Nearest live cell adjacent to (tq,tr) that is reachable from (fq,fr).
  _nearestReachableNeighbor(fq, fr, tq, tr) {
    const occ = new Set();
    for(const inst of Object.values(this.modules))
      if(inst.q != null && !inst.broken) occ.add(G.hexKey(inst.q, inst.r));
    const cand = G.hexNeighbors(tq, tr)
      .filter(nb => occ.has(G.hexKey(nb.q, nb.r)))
      .sort((a, b) => G.hexDist(fq, fr, a.q, a.r) - G.hexDist(fq, fr, b.q, b.r));
    for(const c of cand) if(this._crewPath(fq, fr, c.q, c.r)) return c;
    return null;
  }

  _nearestHullEdgeCell(q, r) {
    // A live cell that borders empty space (an outer cell) nearest to (q,r).
    const occ = new Set();
    for(const inst of Object.values(this.modules))
      if(inst.q != null && !inst.broken) occ.add(G.hexKey(inst.q, inst.r));
    let best = null, bestD = Infinity;
    for(const k of occ) {
      const { q: cq, r: cr2 } = G.hexFromKey(k);
      const edge = G.hexNeighbors(cq, cr2).some(nb => !occ.has(G.hexKey(nb.q, nb.r)));
      if(!edge) continue;
      const d = G.hexDist(q, r, cq, cr2);
      if(d < bestD) { bestD = d; best = { q: cq, r: cr2 }; }
    }
    return best;
  }

  // Cell-centre in ship-local pixels (scale 1 — player ship).
  _cellLocal(q, r) { return G.hexToPixel(q, r, G.HEX_R); }

  // Advance crew movement / orders. Called each frame from the player update.
  updateCrew(dt) {
    if(!this.crew?.length) return;
    const spd = this.CREW_SPEED();
    for(const cr of this.crew) {
      if(cr.eva) { this._updateEvaCrew(cr, dt); continue; }
      // Initialise pixel position at current cell.
      if(cr.px == null) { const p = this._cellLocal(cr.q, cr.r); cr.px = p.x; cr.py = p.y; }
      // Walk along path.
      if(cr.path && cr.path.length) {
        const next = cr.path[0];
        const tp = this._cellLocal(next.q, next.r);
        const dx = tp.x - cr.px, dy = tp.y - cr.py, d = Math.hypot(dx, dy);
        const step = spd * dt;
        if(d <= step) {
          cr.px = tp.x; cr.py = tp.y; cr.q = next.q; cr.r = next.r; cr.path.shift();
        } else { cr.px += dx / d * step; cr.py += dy / d * step; }
      } else {
        // Arrived — resolve order.
        const o = cr.order;
        if(o && o.type === 'repair') {
          const inst = this.modules[o.instId];
          const m = inst && (G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId]);
          if(inst && m && (inst.broken || inst.hp < (m.hp || 50))) {
            inst.hp = Math.min(m.hp || 50, inst.hp + 30 * (1 + (cr.skill || 1) * 0.3) * dt);
            if(inst.broken && inst.hp > 0) { inst.broken = false; this._recompute(); }
          } else { cr.order = null; }   // repaired (or module gone)
        } else if(o && o.type === 'disembark') {
          // At the hull edge — launch into space.
          const w = this._crewWorld(cr);
          cr.eva = true; cr.px = null; cr.py = null;
          cr.ex = w.x; cr.ey = w.y;
          const ang = Math.atan2(w.y - this.y, w.x - this.x);
          cr.evx = this.vx + Math.cos(ang) * 40; cr.evy = this.vy + Math.sin(ang) * 40;
          cr.order = { type: 'evaMove', wx: o.wx, wy: o.wy };
        }
      }
    }
  }

  _updateEvaCrew(cr, dt) {
    const o = cr.order || {};
    let tx, ty, reboard = false;
    if(o.type === 'board') {
      const edge = this._nearestHullEdgeCell(0, 0);
      const c = edge ? this._cellLocal(edge.q, edge.r) : { x: 0, y: 0 };
      const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
      tx = this.x + c.x * ca - c.y * sa; ty = this.y + c.x * sa + c.y * ca;
      reboard = true; cr._boardCell = edge;
    } else { tx = o.wx ?? cr.ex; ty = o.wy ?? cr.ey; }
    const dx = tx - cr.ex, dy = ty - cr.ey, d = Math.hypot(dx, dy);
    const spd = 220;
    if(d <= spd * dt) {
      cr.ex = tx; cr.ey = ty;
      if(reboard) { cr.eva = false; cr.q = cr._boardCell?.q ?? 0; cr.r = cr._boardCell?.r ?? 0; cr.px = null; cr.py = null; cr.order = null; }
    } else { cr.ex += dx / d * spd * dt; cr.ey += dy / d * spd * dt; }
    cr.evx = (cr.evx || 0) * 0.96; cr.evy = (cr.evy || 0) * 0.96;
  }

  // World position of an aboard crew member (ship-local px,py -> world).
  _crewWorld(cr) {
    if(cr.px == null) { const p = this._cellLocal(cr.q, cr.r); cr.px = p.x; cr.py = p.y; }
    const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
    return { x: this.x + cr.px * ca - cr.py * sa, y: this.y + cr.px * sa + cr.py * ca };
  }

  // Station-bonus multipliers from crew currently seated on station modules.
  // Each seated crew adds skill-scaled bonus; capped per channel.
  crewStationMults() {
    const m = { thrust: 1, turn: 1, regen: 1, fire: 1 };
    for(const cr of this.crew) {
      if(cr.eva || (cr.path && cr.path.length)) continue;   // must be seated, not walking
      const slot = this._slotAt(cr.q, cr.r);
      const b = 0.15 + (cr.skill || 1) * 0.08;
      if(slot === 'thruster')               m.thrust += b;
      else if(slot === 'power')             m.regen  += b;
      else if(slot === 'weapon' || slot === 'turret') m.fire += b;
      else if(slot === 'cockpit')           m.turn   += b * 0.5;
    }
    for(const k in m) m[k] = Math.min(m[k], 2.2);
    return m;
  }

  // ── Module management ────────────────────────────────
  installModule(moduleId, rot = 0) {
    const mod = G.MODULES[moduleId] || G.WEAPONS[moduleId];
    if(!mod) return false;

    let idx = this.slots.indexOf(null);
    if(idx === -1) { this.slots.push(null); idx = this.slots.length - 1; }

    const instId = 'm'+(this._nextModId++);
    this.modules[instId] = { moduleId, slotIdx:idx, hp:mod.hp||50, broken:false, rot, q:null, r:null };
    this.slots[idx] = instId;

    this._recompute();
    return instId;
  }

  // Pick a free hex orthogonally adjacent to an existing module — used to
  // auto-place a module that wasn't given an explicit cell (e.g. builder drops).
  _freeBuilderCell() {
    const used = new Set();
    for(const inst of Object.values(this.modules)) if(inst.q != null) used.add(G.hexKey(inst.q, inst.r));
    if(!used.size) return { q:0, r:0 };
    for(const k of used) {
      const { q, r } = G.hexFromKey(k);
      for(const nb of G.hexNeighbors(q, r))
        if(!used.has(G.hexKey(nb.q, nb.r))) return nb;
    }
    return { q:0, r:0 };
  }

  // Install into a specific slot index (used by the ship builder drag-and-drop)
  installModuleAt(moduleId, idx, rot = 0) {
    const mod = G.MODULES[moduleId] || G.WEAPONS[moduleId];
    if(!mod) return false;
    if(idx < 0 || idx >= this.slots.length || this.slots[idx] !== null) return false;
    const instId = 'm'+(this._nextModId++);
    this.modules[instId] = { moduleId, slotIdx:idx, hp:mod.hp||50, broken:false, rot, q:null, r:null };
    this.slots[idx] = instId;
    this._recompute();
    return instId;
  }

  // Rotate an installed module 90° (dir: -1 = left, +1 = right). Affects weapon facing.
  rotateModule(instId, dir) {
    const inst = this.modules[instId];
    if(!inst) return;
    inst.rot = ((((inst.rot||0) + dir) % 4) + 4) % 4;
    this._recompute();
  }

  // Faction ships use faction color; neutral/independent use template color.
  _hullColor(tpl) {
    tpl = tpl || G.SHIPS[this.templateId] || {};
    const _fac = tpl.faction || this.faction;
    return (_fac && _fac !== 'neutral' && _fac !== 'independent' && G.FACTIONS?.[_fac]?.color)
      || tpl.color || '#444444';
  }

  // Generate the full hex layout: assign (q,r) to every inner module on a
  // pointy-top hex grid (core at origin, weapons fore, thrusters aft, rest
  // compact), then wrap the whole assembly in a hull-panel perimeter.
  _generateHexLayout(tpl) {
    // Drop any existing hull panels and clear all positions — we rebuild from scratch.
    for(const [id, inst] of Object.entries(this.modules)) {
      const m = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
      if(m && m.slot === 'hull') { this.slots[inst.slotIdx] = null; delete this.modules[id]; }
      else { inst.q = null; inst.r = null; }
    }

    const used = new Set();
    const assign = (id, q, r) => { this.modules[id].q = q; this.modules[id].r = r; used.add(G.hexKey(q, r)); };

    // Core anchors the origin.
    const inner = Object.entries(this.modules).map(([id, inst]) => {
      const m = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
      return { id, inst, slot: m ? m.slot : 'special' };
    });
    const core = inner.find(e => e.slot === 'core');
    if(core) assign(core.id, 0, 0); else used.add('0,0'); // reserve origin regardless

    const bodyMods   = inner.filter(e => e.slot !== 'core' && e.slot !== 'thruster' && e.slot !== 'weapon' && e.slot !== 'turret');
    const weaponMods = inner.filter(e => e.slot === 'weapon' || e.slot === 'turret');
    const thrusters  = inner.filter(e => e.slot === 'thruster');
    const Ninner     = 1 + bodyMods.length + weaponMods.length;   // core + body + weapons

    // Grow the inner assembly into the faction silhouette (seeded per template so
    // a given ship always looks the same).
    const shapeRng = G.seededRng((this.templateId || 'ship') + '_shape');
    const grown    = new Set(['0,0']);
    const cells    = [{ q: 0, r: 0 }];
    const frontierCells = () => {
      const fr = new Map();
      for(const c of cells) for(const nb of G.hexNeighbors(c.q, c.r)) {
        const k = G.hexKey(nb.q, nb.r);
        if(!grown.has(k) && !fr.has(k)) fr.set(k, nb);
      }
      return [...fr.values()];
    };
    const addCell = (q, r) => { const k = G.hexKey(q, r); if(grown.has(k)) return; grown.add(k); cells.push({ q, r }); };

    if(this.layoutShape === 'symmetric') {
      // Left-right symmetric: grow in mirror pairs about the vertical (x=0) axis.
      // Pointy-top mirror of (q,r) across x=0 is (-q-r, r); axis cells satisfy q=-q-r.
      const mirror = (q, r) => ({ q: -q - r, r });
      const isAxis = (q, r) => (-q - r) === q;
      const dist   = c => G.hexDist(0, 0, c.q, c.r);
      const pickNearest = (pool) => {
        const minD = Math.min(...pool.map(dist));
        const ring = pool.filter(c => dist(c) === minD);
        return ring[Math.floor(shapeRng() * ring.length)];
      };
      while(cells.length < Ninner) {
        const fr = frontierCells();
        if(!fr.length) break;
        const slots = Ninner - cells.length;
        const pairs = fr.filter(c => !isAxis(c.q, c.r));
        if(slots >= 2 && pairs.length) {
          const c = pickNearest(pairs);
          addCell(c.q, c.r);
          const m = mirror(c.q, c.r); addCell(m.q, m.r);
        } else {
          // 1 slot left (or only axis cells available): add a single axis cell
          // to keep the silhouette mirror-symmetric.
          const axis = fr.filter(c => isAxis(c.q, c.r));
          const c = pickNearest(axis.length ? axis : fr);
          addCell(c.q, c.r);
        }
      }
    } else {
      // Faction shape: greedily add the frontier cell with the lowest shape score.
      // 'random' → uniform score → organic blob.
      const score = G.shapeScore(this.layoutShape || 'random', Ninner);
      while(cells.length < Ninner) {
        const fr = frontierCells();
        if(!fr.length) break;
        let best = [], bs = Infinity;
        for(const cnd of fr) {
          const u = G.hexToPixel(cnd.q, cnd.r, 1);
          const s = score(u.x, u.y);
          if(s < bs - 1e-6) { bs = s; best = [cnd]; }
          else if(s < bs + 1e-6) best.push(cnd);
        }
        const pick = best[Math.floor(shapeRng() * best.length)];
        addCell(pick.q, pick.r);
      }
    }

    // Assign modules to the grown cells: weapons to the most-forward cells
    // (pointy-top: smallest r = nose), body fills the rest.
    const rest = cells.slice(1).sort((a, b) => (a.r - b.r) || (a.q - b.q));
    let ci = 0;
    for(const e of weaponMods) { if(ci >= rest.length) break; assign(e.id, rest[ci].q, rest[ci].r); ci++; }
    for(const e of bodyMods)   { if(ci >= rest.length) break; assign(e.id, rest[ci].q, rest[ci].r); ci++; }

    // Wrap the hull first, then place thrusters on the outer frontier (outside hull panels).
    this._wrapHull(tpl);
    const outerPerim = (() => {
      const occ = new Set();
      for(const inst of Object.values(this.modules)) if(inst.q != null) occ.add(G.hexKey(inst.q, inst.r));
      const map = new Map();
      for(const inst of Object.values(this.modules)) {
        if(inst.q == null) continue;
        if(G.MODULES[inst.moduleId]?.slot !== 'hull') continue;
        for(const nb of G.hexNeighbors(inst.q, inst.r)) {
          const nk = G.hexKey(nb.q, nb.r);
          if(!occ.has(nk)) map.set(nk, nb);
        }
      }
      return [...map.values()];
    })();
    // Thrusters go aft (pointy-top: largest r = rear), balanced left-right.
    // Group by r-value, then within each group pick alternating left/right.
    const byR = new Map();
    for(const cell of outerPerim) {
      if(!byR.has(cell.r)) byR.set(cell.r, []);
      byR.get(cell.r).push(cell);
    }
    for(const row of byR.values()) {
      row.sort((a, b) => a.q - b.q);
    }
    const thrusterCells = [];
    for(const r of [...byR.keys()].sort((a, b) => b - a)) {
      const row = byR.get(r);
      // For each row, alternate picking from right and left edges
      const mid = row.length / 2;
      let li = 0, ri = row.length - 1;
      for(let i = 0; i < row.length && thrusterCells.length < thrusters.length; i++) {
        if(i % 2 === 0) {
          thrusterCells.push(row[ri]);
          ri--;
        } else {
          thrusterCells.push(row[li]);
          li++;
        }
      }
      if(thrusterCells.length >= thrusters.length) break;
    }
    for(let pi = 0; pi < thrusters.length && pi < thrusterCells.length; pi++) {
      this.modules[thrusters[pi].id].q = thrusterCells[pi].q;
      this.modules[thrusters[pi].id].r = thrusterCells[pi].r;
    }
  }

  // Wrap every inner module's open hex neighbours with hull-panel hexes.
  // Hexes tile perfectly, so the result is a gapless, overlap-free perimeter.
  _wrapHull(tpl) {
    const hullColor = this._hullColor(tpl);
    const occupied = new Set();
    for(const inst of Object.values(this.modules)) if(inst.q != null) occupied.add(G.hexKey(inst.q, inst.r));

    const hullCells = new Set();
    for(const inst of Object.values(this.modules)) {
      if(inst.q == null) continue;
      const m = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
      if(m && (m.slot === 'hull' || m.slot === 'thruster')) continue;
      for(const nb of G.hexNeighbors(inst.q, inst.r)) {
        const k = G.hexKey(nb.q, nb.r);
        if(!occupied.has(k)) hullCells.add(k);
      }
    }
    for(const k of hullCells) {
      const { q, r } = G.hexFromKey(k);
      const id = this.installModule('hull_panel');
      if(id) { this.modules[id].q = q; this.modules[id].r = r; this.modules[id].color = hullColor; occupied.add(k); }
    }
    // installModule recomputes with the panel's q/r still null; recompute once
    // more now that every panel is positioned so `flyable`/enclosure are correct.
    this._recompute();
  }

  // True if every inner module has all 6 hex neighbours occupied (fully plated).
  _hullEnclosed() {
    const cells = new Set();
    for(const inst of Object.values(this.modules)) if(inst.q != null) cells.add(G.hexKey(inst.q, inst.r));
    for(const inst of Object.values(this.modules)) {
      if(inst.q == null) continue;
      const mod = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
      if(mod?.slot === 'hull' || mod?.slot === 'thruster') continue;
      for(const nb of G.hexNeighbors(inst.q, inst.r))
        if(!cells.has(G.hexKey(nb.q, nb.r))) return false;
    }
    return true;
  }

  // Guarantee a cockpit is installed (for fresh ships and migrated saves)
  ensureCockpit() {
    const has = Object.values(this.modules).some(inst => {
      const m = G.MODULES[inst.moduleId];
      return m && m.slot === 'cockpit';
    });
    if(has) return;
    if(this.slots.indexOf(null) === -1) this.slots.push(null); // cockpit is mandatory — make room
    this.installModule('cockpit');
  }

  // Ensure hull panels wrap the inner modules. With the hex grid the whole
  // layout is regenerated deterministically (also serves as save migration for
  // square-grid saves, which had no q/r).
  ensureHullPanels() {
    const occupied = new Set();
    const byKey = {};
    for(const inst of Object.values(this.modules)) {
      if(inst.q != null) { const k = G.hexKey(inst.q, inst.r); occupied.add(k); byKey[k] = inst; }
    }
    // Thruster fully surrounded → old inner-thruster save.
    const thrusterInner = Object.values(this.modules).some(inst => {
      const m = G.MODULES[inst.moduleId];
      if(m?.slot !== 'thruster' || inst.q == null) return false;
      return G.hexNeighbors(inst.q, inst.r).every(nb => occupied.has(G.hexKey(nb.q, nb.r)));
    });
    // Thruster with no hull-panel neighbour → old hull-edge layout (thruster should be outside hull ring).
    const thrusterAtEdge = !thrusterInner && Object.values(this.modules).some(inst => {
      const m = G.MODULES[inst.moduleId];
      if(m?.slot !== 'thruster' || inst.q == null) return false;
      return !G.hexNeighbors(inst.q, inst.r).some(nb => G.MODULES[byKey[G.hexKey(nb.q, nb.r)]?.moduleId]?.slot === 'hull');
    });
    const needs = thrusterInner || thrusterAtEdge
      || Object.values(this.modules).some(inst => inst.q == null && G.MODULES[inst.moduleId]?.slot !== 'hull')
      || !Object.values(this.modules).some(inst => G.MODULES[inst.moduleId]?.slot === 'hull');
    if(needs) this._generateHexLayout();
    else this._wrapHull();
  }

  // Install missing class core module (save migration)
  ensureCoreModule() {
    const has = Object.values(this.modules).some(inst => {
      const m = G.MODULES[inst.moduleId];
      return m && m.slot === 'core';
    });
    if(has) return;
    const coreId = 'core_' + this.templateId;
    if(!G.MODULES[coreId]) return;
    if(this.slots.indexOf(null) === -1) this.slots.push(null);
    this.installModule(coreId);
  }

  // Returns false if removing instId would violate minimum ship requirements
  canRemoveModule(instId) {
    const inst = this.modules[instId];
    if(!inst) return false;
    const mod = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
    if(!mod) return true;
    if(mod.slot === 'core') return false;
    return true;
  }

  removeModule(instId) {
    const inst = this.modules[instId];
    if(!inst) return null;
    const mod = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
    this.slots[inst.slotIdx] = null;
    delete this.modules[instId];
    this._recompute();
    return mod;
  }

  // Recompute all stats from base + installed modules
  _recompute() {
    this.maxHull    = this._baseHull;
    this.maxShields = 0;
    this.shieldRegen= 0;
    this.maxEnergy  = this._baseEnergy;
    this.energyRegen= 0;
    this.maxFuel    = this._baseFuel;
    this.cargoSpace = this._baseCargoSpace;
    this.maxCrew    = 1;
    this.escapePods = 0;
    this.armor      = 0;
    this.autoRepair = 0;
    this.canCraft   = false;
    this.tractorRange=0;
    this.sensorRange   = 600;
    this.canScan        = false;
    this.canRadarScan   = false;
    this.canOpticalLock = false;
    this.canJump        = false;
    this.jumpRange      = 0;
    this.jumpChargeTime = 99; // set from module
    this.jumpCooldown   = 99;
    this.jumpFuelCost   = 99;
    this.mass           = this._baseMass;
    this.thrustForward  = 0;  // rot=0 thrusters — pushes ship forward, drives turning
    this.thrustRetro    = 0;  // rot=2 thrusters — extra brake/reverse force (optional)
    this.thrustStrafeL  = 0;  // rot=3 thrusters — pushes ship left
    this.thrustStrafeR  = 0;  // rot=1 thrusters — pushes ship right
    this.thrustPower    = 0;  // alias for thrustForward (compat)
    this.turnSpeed      = 0;  // computed from rear thruster count after loop
    this._rearThrusterCount = 0;
    this.flyable        = false; // true once cockpit + class core module installed
    let _hasCockpit     = false;
    let _hasCoreModule  = false;
    let _livePower      = 0;    // live energy-generator modules (reactor / energyRegen)
    let _turnBase       = 0;    // set by core module stats.turnBase

    this.weaponSlots = [];

    let totalEnergyDraw = 0;

    for(const inst of Object.values(this.modules)) {
      if(inst.broken) continue;
      const mod = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
      if(!mod) continue;

      if(mod.slot === 'cockpit') _hasCockpit = true;
      if(mod.slot === 'core' && (!this._shipClass || mod.class === this._shipClass)) _hasCoreModule = true;
      if(mod.slot === 'power' || (mod.stats?.energyRegen > 0)) _livePower++;

      // Weapons get added to weapon list
      if(mod.slot === 'weapon' || mod.slot === 'turret') {
        if(!this.weaponSlots.find(w=>w.instId===inst.moduleId+'_'+inst.slotIdx)) {
          this.weaponSlots.push({ weaponId:mod.id, instId:inst.moduleId, cooldown:0, turret:!!mod.turret, rot:inst.rot||0, _turretAngle:null });
        }
        totalEnergyDraw += (mod.energyCost||0)*0.1; // idle draw
        this.mass += (mod.mass||0);
        continue;
      }

      const s = mod.stats || {};

      // Thrusters: direction from inst.rot (0=fwd, 1=right, 2=retro, 3=left)
      if(mod.slot === 'thruster') {
        const force = s.thrustForce || 0;
        this.mass += (s.mass || 0);
        totalEnergyDraw += (mod.energyDraw || 0);
        const r = (inst.rot || 0) % 4;
        if     (r === 0) { this.thrustForward += force; this._rearThrusterCount++; }
        else if(r === 1)   this.thrustStrafeR += force;
        else if(r === 2)   this.thrustRetro   += force;
        else if(r === 3)   this.thrustStrafeL += force;
        continue;
      }

      if(s.mass)            this.mass        += s.mass;
      if(s.maxHull)         this.maxHull     += s.maxHull;
      if(s.maxShields)      this.maxShields  += s.maxShields;
      if(s.shieldRegen)     this.shieldRegen += s.shieldRegen;
      if(s.maxEnergy)       this.maxEnergy   += s.maxEnergy;
      if(s.energyRegen)     this.energyRegen += s.energyRegen;
      if(s.maxFuel)         this.maxFuel     += s.maxFuel;
      if(s.cargoSpace)      this.cargoSpace  += s.cargoSpace;
      if(s.maxCrew)         this.maxCrew     += s.maxCrew;
      if(s.escapePods)      this.escapePods  += s.escapePods;
      if(s.armor)           this.armor       += s.armor;
      if(s.autoRepair)      this.autoRepair  += s.autoRepair;
      if(s.canCraft)        this.canCraft     = true;
      if(s.tractorRange)    this.tractorRange+= s.tractorRange;
      if(s.sensorRange)     this.sensorRange  += s.sensorRange;
      if(s.canScan)         this.canScan        = true;
      if(s.canRadarScan)    this.canRadarScan   = true;
      if(s.canOpticalLock)  this.canOpticalLock = true;
      if(s.canJump)         this.canJump      = true;
      if(s.jumpRange)       this.jumpRange   += s.jumpRange;
      if(s.jumpChargeTime !== undefined) this.jumpChargeTime = Math.min(this.jumpChargeTime, s.jumpChargeTime);
      if(s.jumpCooldown   !== undefined) this.jumpCooldown   = Math.min(this.jumpCooldown,   s.jumpCooldown);
      if(s.jumpFuelCost   !== undefined) this.jumpFuelCost   = Math.min(this.jumpFuelCost,   s.jumpFuelCost);
      if(s.crewEfficiency)  this.crewEfficiency = 1+s.crewEfficiency;
      if(s.turnBase)        _turnBase = s.turnBase;

      totalEnergyDraw += (mod.energyDraw||0);
    }

    this.flyable = _hasCockpit && _hasCoreModule && this._hullEnclosed();

    // ── Module-driven vitals (no hull pool) ──────────────────────────────
    // Count power modules that EVER existed (incl. broken) so a ship that was
    // built with reactors becomes "powerless" only after they're all gone; a
    // reactor-less hull (runs off its core) is never power-disabled.
    let _totalPower = 0;
    for(const inst of Object.values(this.modules)) {
      const m = G.MODULES[inst.moduleId];
      if(m && (m.slot === 'power' || (m.stats?.energyRegen > 0))) _totalPower++;
    }
    this._hasCore    = _hasCoreModule;
    this._hasCockpit = _hasCockpit;
    this._hasPower   = _livePower > 0;
    this._hasThrusters = this._rearThrusterCount > 0 || this.thrustForward > 0;
    this._coreDestroyed = !_hasCoreModule;
    // Disabled (mission-kill: floats, lootable) = no cockpit, or all power
    // generators destroyed. Engines/thrusters do NOT disable — a ship with its
    // engines shot off is immobilized but still fights (handled in update()).
    // The player is never hard-disabled: it stays controllable-but-crippled as
    // its stats (turn/thrust/regen) emerge from surviving modules.
    if(!this._isPlayer) {
      this.disabled = !_hasCockpit || (_totalPower > 0 && _livePower === 0);
    }

    // Turn: differential modulation of 2 rear thrusters; 0 thrusters = no turn
    const _turnFactor = this._rearThrusterCount < 2
      ? (this._rearThrusterCount > 0 ? 0.4 : 0.0)
      : Math.min(1.5, 1.0 + (this.thrustForward - 24000) / 80000);
    this.turnSpeed = _turnBase * _turnFactor;

    // Crew stat bonuses
    let pilotBonus=0, gunnerDmgBonus=0, engineerBonus=0;
    for(const c of this.crew) {
      const role = G.CREW_ROLES[c.role];
      if(!role) continue;
      const s = role.stats;
      if(s.turnBonus)   this.turnSpeed += s.turnBonus;
      if(s.thrustBonus) {
        const m = 1 + s.thrustBonus;
        this.thrustForward *= m;
        this.thrustRetro   *= m;
        this.thrustStrafeL *= m;
        this.thrustStrafeR *= m;
      }
      if(s.repairRate)    this.autoRepair  += s.repairRate;
      if(s.energyBonus)   this.energyRegen *= (1+s.energyBonus);
      if(s.jumpRangeBonus)this.jumpRange   += s.jumpRangeBonus;
      if(s.sensorBonus)   this.sensorRange += s.sensorBonus;
    }
    this.thrustPower = this.thrustForward; // alias for UI compat

    // Cap stats
    this.hull    = Math.min(this.hull,    this.maxHull);
    this.shields = Math.min(this.shields, this.maxShields);
    this.energy  = Math.min(this.energy,  this.maxEnergy);
    this.fuel    = Math.min(this.fuel,    this.maxFuel);

    this._totalEnergyDraw = totalEnergyDraw;

    // Migrate old missile_lock ability ID from saves
    this.abilities = (this.abilities || []).filter(a => a !== 'missile_lock');

    // Module-granted abilities stay in the bar as long as the granting module is
    // INSTALLED (even if destroyed); they're greyed out (blocked) when no LIVE
    // module grants them. `_abilityBlocked[id] = label` drives the greyed button
    // + "<label> destroyed" hover warning. Fully uninstalling the module removes
    // the ability entirely.
    this._abilityBlocked = {};
    const _grants = (pred) => {
      let any = false, live = false;
      for(const inst of Object.values(this.modules)) {
        const m = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
        if(!m || !pred(m)) continue;
        any = true; if(!inst.broken) live = true;
      }
      return { any, live };
    };
    const _syncAbility = (abilId, pred, label) => {
      const { any, live } = _grants(pred);
      const has = this.abilities.includes(abilId);
      if(any && !has)      this.abilities = [...this.abilities, abilId];
      else if(!any && has) this.abilities = this.abilities.filter(a => a !== abilId);
      if(any && !live)     this._abilityBlocked[abilId] = label;   // installed but destroyed
    };
    _syncAbility('scan',                m => m.stats?.canScan,        'Sensor');
    _syncAbility('radar_scan',          m => m.stats?.canRadarScan,   'Radar Array');
    _syncAbility('optical_target_lock', m => m.stats?.canOpticalLock, 'Targeting Pod');
    _syncAbility('missile_launch',      m => G.WEAPONS[m.id]?.type === 'missile', 'Missile Launcher');
  }

  // ── Physics update ───────────────────────────────────
  update(dt, inp) {
    if(this.disabled || this.empTimer > 0) {
      if(this.empTimer > 0) this.empTimer -= dt;
      this.x += this.vx*dt;
      this.y += this.vy*dt;
      this.angle += 0.4 * dt; // spin slowly while disabled
      this._regenPassive(dt*0.3);
      this.updateCrew(dt);   // crew still move (e.g. back to the cockpit)
      return;
    }

    // Tick stim
    if((this._stimTimer||0) > 0) this._stimTimer = Math.max(0, this._stimTimer - dt);
    // Tick invulnerability
    if((this._invulTimer||0) > 0) this._invulTimer = Math.max(0, this._invulTimer - dt);
    const stimMult = (this._stimTimer||0) > 0 ? 1.25 : 1.0;

    // Crew: advance movement/orders, compute station bonuses + pilot gate. The
    // ship is only pilotable (thrust/turn/strafe/reverse) with a crew member at
    // the cockpit; main.js shows the "NO PILOT IN COCKPIT" warning off _noPilotWarn.
    this.updateCrew(dt);
    const _sm = this.crewStationMults();
    this._crewRegenMult = _sm.regen;
    this._crewFireMult  = _sm.fire;
    const _piloted = this.hasPilot();
    this._noPilotWarn = !_piloted && (inp.turnL || inp.turnR || inp.thrust || inp.reverse || inp.strafeL || inp.strafeR);

    // Power distribution affects effective stats
    const thrustEff = 0.5 + this.powerEngines;
    const shieldEff = this.powerShields;

    // Turn (needs a pilot at the cockpit; cockpit crew adds a small turn bonus)
    if(_piloted) {
      if(inp.turnL) this.angle -= this.turnSpeed * _sm.turn * dt;
      if(inp.turnR) this.angle += this.turnSpeed * _sm.turn * dt;
    }

    // Boost: active as long as key held and energy available (no timer cutoff)
    const superBoostActive = (this._superboostTimer || 0) > 0;
    const boostWanted = inp.boost && (this.energy > 5 || superBoostActive);
    const boostActive = boostWanted;
    if(boostActive && !this._boostKeyWasDown) {
      G.sound?.boost();
    }
    this._boostKeyWasDown = inp.boost;
    G.sound?.updateBoost(boostActive);

    // Heading basis: forward = nose direction, lateral = starboard (perpendicular)
    const fwdX = Math.sin(this.angle),  fwdY = -Math.cos(this.angle);
    const latX = Math.cos(this.angle),  latY =  Math.sin(this.angle);

    // Cargo adds weight, reducing acceleration
    let cargoMass = 0;
    for(const [id, qty] of Object.entries(this.cargo)) cargoMass += (G.ITEMS[id]?.mass||1) * qty;
    cargoMass += this.gearMass();
    const effectiveMass = this.mass + cargoMass;

    // Thrust — requires rear thrusters
    const boostMult = boostActive ? 5.0 : 1.0;
    if(_piloted && inp.thrust && this.thrustForward > 0) {
      const thrust = this.thrustForward * thrustEff * boostMult * stimMult * _sm.thrust / effectiveMass;
      this.vx += fwdX * thrust * dt;
      this.vy += fwdY * thrust * dt;
      if(boostActive && !superBoostActive) this.energy = Math.max(0, this.energy - 112.5 * dt);
      this.fuel = Math.max(0, this.fuel - this.fuelBurnRate * 0.05 * dt);

      // Grip: cancel sideways drift when side thrusters can oppose the drift direction
      const totalStrafe = this.thrustStrafeL + this.thrustStrafeR;
      if(totalStrafe > 0) {
        const vLat = this.vx*latX + this.vy*latY;
        // only apply grip force in the direction we have a thruster for
        const availGrip = vLat > 0 ? this.thrustStrafeL : this.thrustStrafeR;
        if(availGrip > 0) {
          const gripMag = availGrip * thrustEff * boostMult * 1.2 / effectiveMass;
          const dvl = Math.sign(vLat) * Math.min(Math.abs(vLat), gripMag * dt);
          this.vx -= latX * dvl;
          this.vy -= latY * dvl;
        }
      }
    }
    // Q = strafe left, E = strafe right — powered by main rear thrusters (no side thruster required)
    this._strafeCooldown = Math.max(0, (this._strafeCooldown || 0) - dt);
    if(_piloted && this._strafeCooldown <= 0 && this.thrustForward > 0) {
      const dodgeAccel = this.thrustForward * 0.8 / effectiveMass;
      if(inp.strafeL) {
        this.vx -= latX * dodgeAccel * dt;
        this.vy -= latY * dodgeAccel * dt;
        this._strafeCooldown = 0.5;
        if(boostActive && !superBoostActive) this.energy = Math.max(0, this.energy - 15);
      } else if(inp.strafeR) {
        this.vx += latX * dodgeAccel * dt;
        this.vy += latY * dodgeAccel * dt;
        this._strafeCooldown = 0.5;
        if(boostActive && !superBoostActive) this.energy = Math.max(0, this.energy - 15);
      }
    }
    // S = braking, then reverse flight. Any thruster can reverse — no dedicated
    // backward thruster required. The 1s hold gate is the pause-when-stopped.
    const spd = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
    if(_piloted && inp.reverse) {
      this._reverseHeldTime += dt;
      const reverseAvail = this.thrustForward + this.thrustRetro;
      if(spd > 1 && this._reverseHeldTime < 1.0 && reverseAvail > 0) {
        // Braking: thrust against the velocity vector until stopped or 1s elapses
        const brakeMag = reverseAvail * 2.0 * thrustEff * boostMult / effectiveMass;
        const bx = -(this.vx/spd) * brakeMag * dt;
        const by = -(this.vy/spd) * brakeMag * dt;
        this.vx = Math.abs(this.vx + bx) < Math.abs(bx) ? 0 : this.vx + bx;
        this.vy = Math.abs(this.vy + by) < Math.abs(by) ? 0 : this.vy + by;
      } else if(this._reverseHeldTime >= 1.0 && reverseAvail > 0) {
        // Reverse flight: any thruster fires to push the ship backward
        const thrustMag = reverseAvail * thrustEff * boostMult * 0.8 / effectiveMass;
        this.vx -= fwdX * thrustMag * dt;
        this.vy -= fwdY * thrustMag * dt;
        this.fuel = Math.max(0, this.fuel - this.fuelBurnRate * 0.04 * dt);
      }
    } else {
      this._reverseHeldTime = 0;
    }

    // Asymmetric "boat hull" drag: forward drifts cleanly, lateral slides snap out fast
    let vFwd = this.vx*fwdX + this.vy*fwdY;
    let vLat = this.vx*latX + this.vy*latY;
    vFwd *= Math.max(0, 1 - 0.06 * dt);
    const _strafeActive = (inp.strafeL || inp.strafeR) && this.thrustForward > 0;
    const _latDrag = _strafeActive ? 0.25 : 2.5;
    vLat *= Math.max(0, 1 - _latDrag * dt);
    this.vx = fwdX*vFwd + latX*vLat;
    this.vy = fwdY*vFwd + latY*vLat;

    // No speed cap - ships can accelerate indefinitely

    // Engines shot off: no thrust source — bleed velocity to a stop. Ship is NOT
    // disabled (it can still turn if cockpit alive, and still fire).
    if(!this._hasThrusters) {
      const d = Math.max(0, 1 - 3 * dt);
      this.vx *= d; this.vy *= d;
    }

    // Integrate position
    this.x += this.vx*dt;
    this.y += this.vy*dt;

    // Passive regen
    this._regenPassive(dt, shieldEff);

    // Auto repair restores module hp (and can revive broken modules)
    if(this.autoRepair > 0) this.repair(this.autoRepair * dt);

    // Update weapon cooldowns (stim reduces cooldown time)
    for(const w of this.weaponSlots) {
      if(w.cooldown > 0) w.cooldown -= dt * stimMult;
    }
  }

  _regenPassive(dt, shieldEff=0.33) {
    // Energy regen (engineer at a reactor station boosts it via _crewRegenMult)
    const energyDraw = this._totalEnergyDraw || 0;
    const regenMult = this._crewRegenMult || 1;
    this.energy = G.clamp(this.energy + (this.energyRegen * regenMult - energyDraw*0.5)*dt, 0, this.maxEnergy);
    // Shield regen (requires energy, scaled by power setting)
    const sRegenEff = this.shieldRegen * shieldEff * 2;
    if(this.energy > 5 && sRegenEff > 0) {
      const regen = Math.min(sRegenEff*dt, this.energy*0.1);
      this.shields = Math.min(this.maxShields, this.shields + regen);
      this.energy  = Math.max(0, this.energy - regen*0.2);
    }
  }

  // ── Damage ───────────────────────────────────────────
  // EMP also drains energy and stuns proportionally (player-specific).
  _takeEmp(amount) {
    this.shields = Math.max(0, this.shields - amount*0.5);
    this.energy  = Math.max(0, this.energy  - amount);
    this.empTimer = 3 + amount*0.01;
    return { shieldDmg: amount*0.5, hullDmg: 0 };
  }

  // Restore module hp (and revive broken modules), filling the most-damaged
  // first. Ship state is module-driven, so this is the only "healing" there is.
  repair(amount) {
    if(amount <= 0) return;
    const damaged = [];
    for(const inst of Object.values(this.modules)) {
      const mod = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
      if(!mod) continue;
      const max = mod.hp || 50;
      if(inst.broken || inst.hp < max) damaged.push({ inst, max });
    }
    if(!damaged.length) return;
    damaged.sort((a, b) => a.inst.hp - b.inst.hp);
    let pool = amount, revived = false;
    for(const { inst, max } of damaged) {
      if(pool <= 0) break;
      const give = Math.min(max - inst.hp, pool);
      inst.hp += give; pool -= give;
      if(inst.broken && inst.hp > 0) { inst.broken = false; revived = true; }
    }
    if(revived) this._recompute();   // revived modules change stats/vitals
  }

  // Core module hp fraction (0 = destroyed -> explosion). The one "life" readout
  // in a module-driven ship; drives the HUD core bar.
  coreIntegrity() {
    for(const inst of Object.values(this.modules)) {
      const m = G.MODULES[inst.moduleId];
      if(m?.slot === 'core') return G.clamp(inst.hp / (m.hp || 1), 0, 1);
    }
    return 0;
  }

  // Total missing module hp across the ship (for spaceport repair pricing).
  moduleDamage() {
    let d = 0;
    for(const inst of Object.values(this.modules)) {
      const m = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
      if(m) d += Math.max(0, (m.hp || 50) - inst.hp);
    }
    return d;
  }

  // Full repair (spaceport): every module to max hp, un-break all.
  repairFull() {
    for(const inst of Object.values(this.modules)) {
      const mod = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
      inst.hp = (mod?.hp) || 50;
      inst.broken = false;
    }
    this._recompute();
  }

  // Bounding radius computed from installed module hex cells
  getCollisionRadius() {
    let max = 20;
    for(const inst of Object.values(this.modules)) {
      if(inst.q == null) continue;
      const p = G.hexToPixel(inst.q, inst.r, G.HEX_R);
      const d = Math.hypot(p.x, p.y) + G.HEX_R;
      if(d > max) max = d;
    }
    return max;
  }

  // Damage module closest to world point (wx, wy); returns { name, slot } if one breaks
  _damageModuleAtPoint(wx, wy, dmg) {
    const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
    const R = G.HEX_R * (this.size || 1);   // AI hulls render/collide scaled by size
    let bestId = null, bestDist = Infinity;
    for(const [id, inst] of Object.entries(this.modules)) {
      if(inst.q == null || inst.broken) continue;
      const p = G.hexToPixel(inst.q, inst.r, R);
      const lx = p.x, ly = p.y;
      const ex = this.x + lx * ca - ly * sa;
      const ey = this.y + lx * sa + ly * ca;
      const d = Math.hypot(wx - ex, wy - ey);
      if(d < bestDist) { bestDist = d; bestId = id; }
    }
    if(bestId) {
      const inst = this.modules[bestId];
      const mod = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
      inst.hp -= dmg;
      if(inst.hp <= 0) {
        inst.broken = true;
        this._recompute();   // recomputes vitals: disabled / _coreDestroyed
        return { name: mod?.name || inst.moduleId, slot: mod?.slot || '' };
      }
    }
    return null;
  }

  // ── Weapon firing ────────────────────────────────────
  fireWeapon(idx, targetX, targetY) {
    if(this.disabled || this.empTimer > 0) return null;
    const slot = this.weaponSlots[idx];
    if(!slot || slot.cooldown > 0) return null;
    const wpn = G.WEAPONS[slot.weaponId];
    if(!wpn) return null;

    // Ammo check (ballistic/missile/explosive weapons)
    if(wpn.ammo) {
      if((this.ammo[wpn.ammo] || 0) < 1) return null;
      this.ammo[wpn.ammo]--;
    }

    // Energy check (energy weapons)
    const eCost = wpn.energyCost || 0;
    if(this.energy < eCost) return null;

    // Weapon power boost
    const wpnPower = 0.5 + this.powerWeapons;
    const damage = wpn.damage * wpnPower;

    this.energy -= eCost;
    slot.cooldown = 1 / (wpn.fireRate * (this._crewFireMult || 1));   // gunner station bonus

    // Aim direction — weapon's mounted facing = ship heading + its tile rotation
    const facing = this.angle + (slot.rot || 0) * (Math.PI / 2);
    let aimAngle = facing;
    if(targetX != null) {
      const toTarget = Math.atan2(targetX-this.x, -(targetY-this.y));
      if(slot.turret) {
        aimAngle = toTarget; // turrets ignore mount facing and track the target
        slot._turretAngle = toTarget;
      } else {
        const diff = Math.abs(G.wrapAngle(toTarget - facing));
        if(diff < Math.PI / 6) aimAngle = toTarget; // snap to target within 30° of facing
      }
    }

    // Fire from weapon module's hex cell in world space
    const weapInst = Object.values(this.modules||{}).find(m =>
      (m.moduleId + '_' + m.slotIdx) === slot.instId
    );
    let ox, oy;
    if(weapInst?.q != null) {
      const p = G.hexToPixel(weapInst.q, weapInst.r, G.HEX_R);
      const dx = p.x, dy = p.y;
      const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
      ox = this.x + dx * ca - dy * sa;
      oy = this.y + dx * sa + dy * ca;
    } else {
      ox = this.x + Math.sin(facing) * 15;
      oy = this.y - Math.cos(facing) * 15;
    }

    const baseProj = {
      x: ox, y: oy,
      angle: aimAngle,
      weaponId: wpn.id,
      damage, type:wpn.type,
      range:wpn.range, traveled:0,
      color:wpn.color, width:wpn.width||2,
      splash:wpn.splash||0, empStrength:wpn.empStrength||0,
      tracking:wpn.tracking||false,
      pierce:wpn.pierce||false,
      ttl:wpn.range / wpn.projSpeed,
      sourceId: this === G.game?.player ? 'player' : this.id,
      ...(wpn.type === 'mining' ? { originX: ox, originY: oy } : {}),
    };

    // Multi-pellet spread (shotgun-style)
    if(wpn.pellets && wpn.pellets > 1) {
      const spread = wpn.spread || 0.2;
      return Array.from({ length: wpn.pellets }, (_, i) => {
        const offset = (i / (wpn.pellets - 1) - 0.5) * spread;
        const a = aimAngle + offset;
        return { ...baseProj,
          vx: Math.sin(a)*wpn.projSpeed + this.vx*0.3,
          vy: -Math.cos(a)*wpn.projSpeed + this.vy*0.3,
        };
      });
    }

    return { ...baseProj,
      vx: Math.sin(aimAngle)*wpn.projSpeed + this.vx*0.3,
      vy: -Math.cos(aimAngle)*wpn.projSpeed + this.vy*0.3,
    };
  }

  // ── Cargo management ─────────────────────────────────
  cargoUsed() {
    let used = 0;
    for(const [id,qty] of Object.entries(this.cargo)) {
      used += qty * (G.ITEMS[id]?.mass || 1);
    }
    return used;
  }

  cargoCount() {
    return Object.values(this.cargo).reduce((s,q)=>s+q, 0);
  }

  addCargo(itemId, qty) {
    if(!G.ITEMS[itemId]) return false;
    this.cargo[itemId] = (this.cargo[itemId]||0) + qty;
    return true;
  }

  removeCargo(itemId, qty) {
    if(!this.cargo[itemId] || this.cargo[itemId] < qty) return false;
    this.cargo[itemId] -= qty;
    if(this.cargo[itemId]<=0) delete this.cargo[itemId];
    return true;
  }

  cargoFreeSpace() {
    let used = 0;
    for(const [id,qty] of Object.entries(this.cargo)) {
      const item = G.ITEMS[id];
      used += qty * (item ? item.mass||1 : 1);
    }
    used += this.gearMass();
    return this.cargoSpace - used;
  }

  // ── Serialize for save ───────────────────────────────
  getSaveData() {
    return {
      templateId: this.templateId,
      hull: this.hull, shields: this.shields,
      energy: this.energy, fuel: this.fuel,
      x: this.x, y: this.y, vx: this.vx, vy: this.vy, angle: this.angle,
      modules: JSON.parse(JSON.stringify(this.modules)),
      slots:   JSON.parse(JSON.stringify(this.slots)),
      cargo:           JSON.parse(JSON.stringify(this.cargo)),
      ammo:            JSON.parse(JSON.stringify(this.ammo)),
      crew:            JSON.parse(JSON.stringify(this.crew)),
      gear:            JSON.parse(JSON.stringify(this.gear || [])),
      moduleInventory: [...(this.moduleInventory||[])],
      powerWeapons: this.powerWeapons,
      powerShields: this.powerShields,
      powerEngines: this.powerEngines,
      abilities: [...(this.abilities||[])],
    };
  }
};

// Migrate older saves: drop deprecated side/retro thrusters — only rear-facing
// (rot:0) thrusters remain. Re-orients any stray thruster to rear.
G.stripBackThrusters = (modules) => {
  if(!modules) return;
  for(const inst of Object.values(modules)) {
    const m = G.MODULES[inst.moduleId];
    if(m?.slot === 'thruster' && (inst.rot||0) !== 0) inst.rot = 0;
  }
};

// ── Shared hex layout for non-player ships (enemies/NPCs/fleet) ────────────
// Builds a template's deterministic hex assembly once and caches the tile
// entries {q,r,visual,slot,rot,color,broken}. Player ships read live modules.
// Resolve a ship id to a G.SHIPS key: accept a direct key, or an old shape id
// (some enemies/NPCs store the SHAPES key in `shapeId`) by matching ship.shape.
G.resolveShipKey = function(id) {
  if(!id) return null;
  return G.SHIPS[id] ? id : (Object.keys(G.SHIPS).find(k => G.SHIPS[k].shape === id) || null);
};

G._hexLayoutCache = {};
G.hexLayoutForTemplate = function(tplId) {
  if(!tplId) return [];
  const key = G.resolveShipKey(tplId);
  if(!key) return [];
  if(G._hexLayoutCache[key]) return G._hexLayoutCache[key];
  let entries = [];
  try {
    const s = new G.Ship(key);
    for(const inst of Object.values(s.modules)) {
      if(inst.q == null) continue;
      const m = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId] || {};
      entries.push({
        q: inst.q, r: inst.r,
        visual: m.visual || (G.WEAPONS[inst.moduleId] ? 'weapon' : 'special'),
        slot: m.slot || 'special',
        rot: inst.rot || 0,
        color: inst.color || null,
        broken: false,
      });
    }
  } catch(e) { entries = []; }
  G._hexLayoutCache[key] = entries;
  return entries;
};

// ── AI module-hull helpers ────────────────────────────────────────────────
// Enemies (G.EnemyAI) and NPCs (G.NPCShip) carry a real backing G.Ship in
// `w.ship`, so they take the SAME positional module damage as the player:
// projectiles destroy individual weapon/engine/core modules. Stats are derived
// from that module loadout (pure module stats — no scalar danger formulas).

// Build the backing hull from a template id (key or shape) onto wrapper `w`.
// opts.hullMult / shieldMult / sizeMult scale the loadout (fleet flagships).
G.aiInitHull = function(w, tplId, opts = {}) {
  const key = G.resolveShipKey(tplId);
  let ship = null;
  try { if(key) ship = new G.Ship(key); } catch(e) { ship = null; }
  w.ship = ship;
  if(!ship) {                         // fallback: minimal scalar stats
    w.maxShields = w.maxShields || 0; w.shields = w.shields || 0;
    w.turnSpeed = w.turnSpeed || 2.0; w.speed = w.speed || 300;
    return null;
  }
  if(opts.shieldMult) { ship.maxShields *= opts.shieldMult; ship.shields = ship.maxShields; }
  // No hull pool — "tankier" flagships get beefier module hp instead.
  if(opts.hullMult) for(const inst of Object.values(ship.modules)) inst.hp *= opts.hullMult;
  w.size = (w.size || 1) * (opts.sizeMult || 1);
  ship.size = w.size;
  // Weapon metadata for loot/ammo drops (consumed by _dropLoot).
  w.weapons = G.aiWeaponMods(ship).map(m => ({ weaponId: m.moduleId }));
  G.aiDeriveStats(w, true);
  return ship;
};

// Max velocity cap from thrust/mass. Returns 0 when all thrusters are destroyed
// (ship is immobilized — see aiHaltIfNoEngines). Speed scales with surviving
// thrust, so each thruster lost slows the ship.
G.aiMaxSpeed = function(ship) {
  if(!ship.thrustForward || ship.thrustForward <= 0) return 0;
  const accel = ship.thrustForward / Math.max(1, ship.mass || 1);
  return G.clamp(60 + accel * 1.5, 80, 680);
};

// Re-derive wrapper combat stats from the backing hull (shields buffer + mobility).
// There is no hp/hull pool — ship life/death is driven by modules (vitals).
G.aiDeriveStats = function(w, refill = false) {
  const s = w.ship; if(!s) return;
  w.maxShields = s.maxShields;
  w.turnSpeed  = s.turnSpeed || w.turnSpeed || 2.0;
  w.speed      = G.aiMaxSpeed(s);
  if(refill) w.shields = w.maxShields; else if(w.shields > w.maxShields) w.shields = w.maxShields;
};

// Bleed an immobilized ship's velocity to a stop (all thrusters destroyed). The
// ship is NOT disabled — it can still turn (if cockpit alive) and fire.
G.aiHaltIfNoEngines = function(w, dt) {
  if(w.ship && !w.ship._hasThrusters) { const d = Math.max(0, 1 - 3 * dt); w.vx *= d; w.vy *= d; }
};

// True if the backing hull has any broken or damaged module (drives AI "I'm hurt"
// behaviours — call for help, self-heal — now that there's no hp threshold).
G.aiDamaged = function(w) {
  const s = w.ship; if(!s) return false;
  for(const inst of Object.values(s.modules)) {
    const d = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
    if(d && (inst.broken || inst.hp < (d.hp || 50))) return true;
  }
  return false;
};

// Copy the wrapper's live transform onto the backing hull so module world
// positions (firing origins, hit tests) line up. Call before damage/firing.
G.aiSyncHull = function(w) {
  const s = w.ship; if(!s) return;
  s.x = w.x; s.y = w.y; s.angle = w.angle; s.size = w.size || 1;
};

// Live (unbroken) weapon module instances on a hull, nose-first (smallest r).
G.aiWeaponMods = function(ship) {
  if(!ship?.modules) return [];
  const out = [];
  for(const inst of Object.values(ship.modules)) {
    if(inst.broken || inst.q == null) continue;
    if(G.WEAPONS[inst.moduleId]) out.push(inst);
  }
  out.sort((a, b) => (a.r - b.r) || (a.q - b.q));
  return out;
};

// React to a positional module break: re-derive stats and read the backing
// hull's vitals. Core gone -> dead (explosion). Power/cockpit gone -> disabled
// (mission-kill: floats, lootable). Losing any internal module flags a flee
// reconsideration. Bumps a render-cache version so the broken tile shows.
G.aiOnModuleBroken = function(w, bm) {
  const s = w.ship; if(!s) return;
  w._damageVer = (w._damageVer || 0) + 1;
  G.aiDeriveStats(w, false);
  if(s._coreDestroyed) {
    w.dead = true; w.disabled = true;
    if('aiState' in w) w.aiState = 'disabled';
  } else if(s.disabled && !w.disabled) {
    w.disabled = true;
    if('aiState' in w) w.aiState = 'disabled';
  }
  // Internal (non-hull) module lost while still alive -> consider fleeing.
  if(bm && bm.slot !== 'hull' && !w.dead && !w.disabled) w._wantFleeCheck = true;
};

// Fire every live weapon module along `aimAngle`, from each module's world cell.
// Per-module cooldown persists on inst._aiShot; broken weapons are skipped, so a
// destroyed weapon module stops firing. opts.fireArc gates by heading alignment;
// opts.requireLock holds missiles until `w._locked`.
G.aiFireWeapons = function(w, aimAngle, target, now, projectiles, particles, opts = {}) {
  const ship = w.ship; if(!ship) return;
  const mods = G.aiWeaponMods(ship);
  if(!mods.length) return;
  const arc = opts.fireArc ?? 0.6;
  if(Math.abs(G.wrapAngle(w.angle - aimAngle)) > arc) return;
  const R = G.HEX_R * (w.size || 1);
  const ca = Math.cos(w.angle), sa = Math.sin(w.angle);
  const rateMult = w._fireRateMult || 1;
  const tdist = target ? Math.hypot(target.x - w.x, target.y - w.y) : 0;
  const pl = G.game?.player;
  const playerDist = pl ? Math.hypot(w.x - pl.x, w.y - pl.y) : 0;
  const pan = G.clamp((w.x - (pl?.x || 0)) / 900, -1, 1);
  const fallbackCol = w.projColor || w.weaponColor || w.color || '#ff4444';
  for(const inst of mods) {
    const def = G.WEAPONS[inst.moduleId]; if(!def) continue;
    const range = def.range || 700;
    const rate  = (def.fireRate || 1) * rateMult;
    const spd   = def.projSpeed || (def.type === 'laser' ? 850 : 600);
    const isMissile = def.type === 'missile';
    if(opts.requireLock && isMissile && !w._locked) continue;
    if(tdist > range || (now - (inst._aiShot || 0)) < 1 / rate) continue;
    inst._aiShot = now;
    const p = G.hexToPixel(inst.q, inst.r, R);
    const ox = w.x + p.x * ca - p.y * sa;
    const oy = w.y + p.x * sa + p.y * ca;
    projectiles.push({
      x: ox, y: oy,
      vx: Math.sin(aimAngle) * spd + (w.vx || 0) * 0.2,
      vy: -Math.cos(aimAngle) * spd + (w.vy || 0) * 0.2,
      damage: def.damage || 10, type: def.type || 'laser',
      splash: def.splash || 0, empStrength: def.empStrength || 0,
      range, traveled: 0, ttl: range / spd,
      color: def.color || fallbackCol, width: def.width || 2,
      sourceId: w.id, pierce: def.pierce || false,
      tracking: isMissile,
      trackTarget: (isMissile && target) ? target : null,
    });
    if(particles) particles.emit({ x: ox, y: oy, minSpd:20, maxSpd:60, life:0.15, r:2, color: def.color || fallbackCol });
    G.sound?.enemyWeapon(def.type || 'laser', playerDist, pan);
  }
};

// True if the backing hull has any live missile weapon (for lock-on logic).
G.aiHasMissile = function(w) {
  return G.aiWeaponMods(w.ship).some(m => (G.WEAPONS[m.moduleId]?.type === 'missile'));
};

// ── Hex-shaped collision / hitbox ─────────────────────────────────────────
// Footprint = occupied hex cells + bbox centre + max extent, all in unit hex
// space (size 1). World scale applied per call: R = G.HEX_R * scale.
function _buildFootprint(coords) {
  const cells = new Set();
  let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
  const us = [];
  for(const c of coords) {
    const k = G.hexKey(c.q, c.r);
    if(cells.has(k)) continue;
    cells.add(k);
    const u = G.hexToPixel(c.q, c.r, 1);
    us.push(u);
    if(u.x < mnx) mnx = u.x; if(u.x > mxx) mxx = u.x;
    if(u.y < mny) mny = u.y; if(u.y > mxy) mxy = u.y;
  }
  if(!cells.size) return null;
  const cux = (mnx + mxx) / 2, cuy = (mny + mxy) / 2;
  // maxU = bounding radius from ship origin (0,0), not bbox centre, so that
  // shipCollisionRadius (which is used relative to ship.x, ship.y) is correct
  // for asymmetric assemblies (weapons fore / thrusters aft).
  let maxU = 0;
  for(const u of us) { const d = Math.hypot(u.x, u.y) + 1; if(d > maxU) maxU = d; }
  return { cells, cux, cuy, maxU };
}

G._tplFootprint = {};
G.shipFootprint = function(ship) {
  if(ship instanceof G.Ship) {
    const tok = ship._nextModId + ':' + Object.keys(ship.modules).length;
    if(ship._fpTok === tok && ship._fp !== undefined) return ship._fp;
    const coords = [];
    for(const m of Object.values(ship.modules)) if(m.q != null) coords.push(m);
    ship._fp = _buildFootprint(coords); ship._fpTok = tok;
    return ship._fp;
  }
  const id = ship.shipId || ship.shapeId || ship.templateId;
  if(!id) return null;
  if(id in G._tplFootprint) return G._tplFootprint[id];
  return (G._tplFootprint[id] = _buildFootprint(G.hexLayoutForTemplate(id)));
};

// World-space radius that bounds the ship's hex assembly (for broad collisions).
G.shipCollisionRadius = function(ship) {
  const scale = (ship instanceof G.Ship) ? 1 : (ship.size || 1);
  const fp = G.shipFootprint(ship);
  if(!fp) return scale * 16;
  return fp.maxU * G.HEX_R * scale;
};

// True if world point (wx,wy) lands inside the ship's hex assembly. Because
// pointy-top hexes tile the plane, the hex nearest a point is the hex containing
// it — so a hit is just "the containing cell is occupied".
G.shipHexHit = function(ship, wx, wy) {
  const fp = G.shipFootprint(ship);
  const scale = (ship instanceof G.Ship) ? 1 : (ship.size || 1);
  if(!fp) { const r = scale * 16; return Math.hypot(wx - ship.x, wy - ship.y) < r; }
  const R = G.HEX_R * scale;
  const a = ship.angle || 0, ca = Math.cos(a), sa = Math.sin(a);
  const dx = wx - ship.x, dy = wy - ship.y;
  const ux = (dx * ca + dy * sa) / R + fp.cux;
  const uy = (-dx * sa + dy * ca) / R + fp.cuy;
  const h = G.pixelToHex(ux, uy, 1);
  return fp.cells.has(G.hexKey(h.q, h.r));
};
