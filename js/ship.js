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
  }

  _initStartingCrew() {
    const fac = this.faction || 'neutral';
    const roleOrder = ['pilot','engineer','gunner','navigator','medic','marine'];
    const names = G.CREW_NAMES;
    let ni = 0;
    for(let i = 0; i < this.maxCrew; i++) {
      const roleId = roleOrder[Math.min(i, roleOrder.length - 1)];
      const role = G.CREW_ROLES[roleId];
      this.crew.push({
        id: 'c' + (Math.random() * 1e9 | 0),
        name: names[ni++ % names.length],
        role: roleId, roleName: role.name,
        faction: fac,
        skill: 2, hp: 100, maxHp: 100,
        wage: role.wage * 2,
        hireCost: role.wage * 20,
        desc: role.desc,
      });
    }
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
    let _turnBase       = 0;    // set by core module stats.turnBase

    this.weaponSlots = [];

    let totalEnergyDraw = 0;

    for(const inst of Object.values(this.modules)) {
      if(inst.broken) continue;
      const mod = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
      if(!mod) continue;

      if(mod.slot === 'cockpit') _hasCockpit = true;
      if(mod.slot === 'core' && (!this._shipClass || mod.class === this._shipClass)) _hasCoreModule = true;

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

    // A sensor module grants the Scan ability; keep the ability list in sync
    // so it appears/disappears with the module (self-heals on load too).
    this.abilities = this.abilities || [];
    const _hasScan = this.abilities.includes('scan');
    // Non-mutating so a shared template ability array is never corrupted.
    if(this.canScan && !_hasScan)       this.abilities = [...this.abilities, 'scan'];
    else if(!this.canScan && _hasScan)  this.abilities = this.abilities.filter(a => a !== 'scan');

    const _hasRadarScan = this.abilities.includes('radar_scan');
    if(this.canRadarScan && !_hasRadarScan)       this.abilities = [...this.abilities, 'radar_scan'];
    else if(!this.canRadarScan && _hasRadarScan)  this.abilities = this.abilities.filter(a => a !== 'radar_scan');

    // Migrate old missile_lock ability ID from saves
    this.abilities = this.abilities.filter(a => a !== 'missile_lock');

    // Targeting pod grants optical_target_lock (independent ability)
    const _hasOptLock = this.abilities.includes('optical_target_lock');
    if(this.canOpticalLock && !_hasOptLock) {
      this.abilities = [...this.abilities, 'optical_target_lock'];
    } else if(!this.canOpticalLock && _hasOptLock) {
      this.abilities = this.abilities.filter(a => a !== 'optical_target_lock');
    }

    // Missile launcher weapon grants missile_launch ability (independent of optical lock)
    const _hasMissileWpn = this.weaponSlots.some(w => G.WEAPONS[w.weaponId]?.type === 'missile');
    const _hasMLaunch = this.abilities.includes('missile_launch');
    if(_hasMissileWpn && !_hasMLaunch) {
      this.abilities = [...this.abilities, 'missile_launch'];
    } else if(!_hasMissileWpn && _hasMLaunch) {
      this.abilities = this.abilities.filter(a => a !== 'missile_launch');
    }
  }

  // ── Physics update ───────────────────────────────────
  update(dt, inp) {
    if(this.disabled || this.empTimer > 0) {
      if(this.empTimer > 0) this.empTimer -= dt;
      this.x += this.vx*dt;
      this.y += this.vy*dt;
      this.angle += 0.4 * dt; // spin slowly while disabled
      this._regenPassive(dt*0.3);
      return;
    }

    // Tick stim
    if((this._stimTimer||0) > 0) this._stimTimer = Math.max(0, this._stimTimer - dt);
    // Tick invulnerability
    if((this._invulTimer||0) > 0) this._invulTimer = Math.max(0, this._invulTimer - dt);
    const stimMult = (this._stimTimer||0) > 0 ? 1.25 : 1.0;

    // Power distribution affects effective stats
    const thrustEff = 0.5 + this.powerEngines;
    const shieldEff = this.powerShields;

    // Turn
    if(inp.turnL) this.angle -= this.turnSpeed * dt;
    if(inp.turnR) this.angle += this.turnSpeed * dt;

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
    const effectiveMass = this.mass + cargoMass;

    // Thrust — requires rear thrusters
    const boostMult = boostActive ? 5.0 : 1.0;
    if(inp.thrust && this.thrustForward > 0) {
      const thrust = this.thrustForward * thrustEff * boostMult * stimMult / effectiveMass;
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
    if(this._strafeCooldown <= 0 && this.thrustForward > 0) {
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
    if(inp.reverse) {
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

    // Integrate position
    this.x += this.vx*dt;
    this.y += this.vy*dt;

    // Passive regen
    this._regenPassive(dt, shieldEff);

    // Auto repair
    if(this.autoRepair > 0) {
      this.hull = Math.min(this.maxHull, this.hull + this.autoRepair*dt);
    }

    // Update weapon cooldowns (stim reduces cooldown time)
    for(const w of this.weaponSlots) {
      if(w.cooldown > 0) w.cooldown -= dt * stimMult;
    }
  }

  _regenPassive(dt, shieldEff=0.33) {
    // Energy regen
    const energyDraw = this._totalEnergyDraw || 0;
    this.energy = G.clamp(this.energy + (this.energyRegen - energyDraw*0.5)*dt, 0, this.maxEnergy);
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
  _applyHullDamage(amount) {
    this.hull -= amount;
    if(this.hull <= 0) { this.hull = 0; this._postDisableDmg = 0; this.disabled = true; }
  }

  // Randomly damage a module; returns { name, slot } if one breaks, else null
  _damageModule(dmg) {
    const instIds = Object.keys(this.modules).filter(id=>!this.modules[id].broken);
    if(instIds.length === 0) return null;
    if(Math.random() > 0.3) return null; // 30% chance to hit a module
    const id = G.randEl(instIds);
    const inst = this.modules[id];
    const mod = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
    inst.hp -= dmg * 0.5;
    if(inst.hp <= 0) {
      inst.broken = true;
      this._recompute();
      if(mod?.slot === 'core') { this.hull = 0; this.disabled = true; }
      return { name: mod?.name || inst.moduleId, slot: mod?.slot || '' };
    }
    return null;
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
    let bestId = null, bestDist = Infinity;
    for(const [id, inst] of Object.entries(this.modules)) {
      if(inst.q == null || inst.broken) continue;
      const p = G.hexToPixel(inst.q, inst.r, G.HEX_R);
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
        this._recompute();
        if(mod?.slot === 'core') { this.hull = 0; this.disabled = true; }
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
    slot.cooldown = 1 / wpn.fireRate;

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
G._hexLayoutCache = {};
G.hexLayoutForTemplate = function(tplId) {
  if(!tplId) return [];
  // Resolve a ship id: accept a direct G.SHIPS key, or an old shape id (some
  // enemies store the SHAPES key in `shapeId`) by matching ship.shape.
  let key = G.SHIPS[tplId] ? tplId
    : Object.keys(G.SHIPS).find(k => G.SHIPS[k].shape === tplId);
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
