'use strict';
// ── Ship class ────────────────────────────────────────────
G.Ship = class {
  constructor(templateId) {
    const tpl = G.SHIPS[templateId];
    if(!tpl) throw new Error('Unknown ship: '+templateId);

    this.templateId = templateId;
    this._shipClass = tpl.class || null;
    this.name = tpl.name;
    this.faction = tpl.faction;
    this.shapeId = tpl.shape;

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
    this.energyRegen= 45;
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

    if(tpl.startCells) {
      const sorted = Object.entries(this.modules).sort((a,b) => +a[0].slice(1) - +b[0].slice(1));
      sorted.forEach(([,inst], i) => { if(tpl.startCells[i] != null) inst.cell = tpl.startCells[i]; });
    }

    this._addHullPanels(tpl);

    this._recompute();
    this.hull    = this.maxHull;
    this.shields = this.maxShields;
    this.energy  = this.maxEnergy;
    this.fuel    = this.maxFuel;
  }

  // ── Module management ────────────────────────────────
  installModule(moduleId, rot = 0) {
    const mod = G.MODULES[moduleId] || G.WEAPONS[moduleId];
    if(!mod) return false;

    let idx = this.slots.indexOf(null);
    if(idx === -1) { this.slots.push(null); idx = this.slots.length - 1; }

    const instId = 'm'+(this._nextModId++);
    this.modules[instId] = { moduleId, slotIdx:idx, hp:mod.hp||50, broken:false, rot, cell:null };
    this.slots[idx] = instId;

    this._recompute();
    return instId;
  }

  // Install into a specific slot index (used by the ship builder drag-and-drop)
  installModuleAt(moduleId, idx, rot = 0) {
    const mod = G.MODULES[moduleId] || G.WEAPONS[moduleId];
    if(!mod) return false;
    if(idx < 0 || idx >= this.slots.length || this.slots[idx] !== null) return false;
    const instId = 'm'+(this._nextModId++);
    this.modules[instId] = { moduleId, slotIdx:idx, hp:mod.hp||50, broken:false, rot, cell:null };
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

  // Auto-generate hull panels around all installed inner modules
  _addHullPanels(tpl) {
    const DIRS = [[-1,0],[ 0,1],[1,0],[0,-1]]; // N(0) E(1) S(2) W(3)
    // Faction ships use faction color; neutral/independent use template color
    const _fac = tpl.faction;
    const hullColor = (_fac && _fac !== 'neutral' && _fac !== 'independent' && G.FACTIONS?.[_fac]?.color)
      || tpl.color || '#667799';

    // Build set of inner (non-hull) cells
    const inner = new Set();
    for(const inst of Object.values(this.modules)) {
      if(inst.cell == null) continue;
      const m = G.MODULES[inst.moduleId];
      if(!m || m.slot !== 'hull') inner.add(inst.cell);
    }

    // Already-occupied cells (for collision avoidance)
    const occupied = new Set();
    for(const inst of Object.values(this.modules)) if(inst.cell != null) occupied.add(inst.cell);

    // Candidate hull cells: empty cells orthogonally adjacent to inner cells
    const candidates = new Map(); // cell -> innerDirs[]
    for(const cell of inner) {
      const r = (cell / 9) | 0, c = cell % 9;
      for(let d = 0; d < 4; d++) {
        const nr = r + DIRS[d][0], nc = c + DIRS[d][1];
        if(nr < 0 || nr >= 9 || nc < 0 || nc >= 9) continue;
        const ncell = nr * 9 + nc;
        if(!occupied.has(ncell)) {
          if(!candidates.has(ncell)) candidates.set(ncell, []);
          candidates.get(ncell).push(d);
        }
      }
    }

    for(const [hcell, innerDirs] of candidates) {
      // Determine shape and facing from adjacency
      let shape, facing;
      if(innerDirs.length >= 3) {
        shape = 'concave'; facing = 0;
      } else if(innerDirs.length === 2) {
        shape = 'quarterround';
        const has = {};
        for(const d of innerDirs) has[d] = true;
        // facing 4-7 = corner: 4=NW outer, 5=NE outer, 6=SE outer, 7=SW outer
        if(has[2] && has[1])      facing = 4; // S+E inner → NW outer
        else if(has[2] && has[3]) facing = 5; // S+W inner → NE outer
        else if(has[0] && has[3]) facing = 6; // N+W inner → SE outer
        else if(has[0] && has[1]) facing = 7; // N+E inner → SW outer
        else                      facing = 4;
      } else {
        shape = 'square';
        facing = (innerDirs[0] + 2) % 4; // outer face = opposite of inner neighbor
      }

      const instId = this.installModule('hull_panel');
      if(instId) {
        this.modules[instId].cell   = hcell;
        this.modules[instId].color  = hullColor;
        this.modules[instId].shape  = shape;
        this.modules[instId].facing = facing;
        occupied.add(hcell);
      }
    }
  }

  // Returns true if every non-hull module has all in-grid orthogonal neighbors occupied
  _hullEnclosed() {
    const cellMap = new Map();
    for(const inst of Object.values(this.modules))
      if(inst.cell != null) cellMap.set(inst.cell, inst.moduleId);

    for(const inst of Object.values(this.modules)) {
      if(inst.cell == null) continue;
      const mod = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
      if(mod?.slot === 'hull') continue;
      const r = (inst.cell / 9) | 0, c = inst.cell % 9;
      for(const [dr, dc] of [[-1,0],[0,1],[1,0],[0,-1]]) {
        const nr = r + dr, nc = c + dc;
        if(nr < 0 || nr >= 9 || nc < 0 || nc >= 9) continue; // grid edge = OK
        if(!cellMap.has(nr * 9 + nc)) return false;
      }
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

  // Ensure hull panels exist (save migration for saves predating hull system)
  ensureHullPanels() {
    const hasHull = Object.values(this.modules).some(inst => G.MODULES[inst.moduleId]?.slot === 'hull');
    if(!hasHull) {
      const tpl = G.SHIPS[this.templateId];
      if(tpl) this._addHullPanels(tpl);
    }
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
    if(mod.slot === 'cockpit') return false;
    if(mod.slot === 'core') return false;
    if(mod.slot === 'hull') {
      // Cannot remove if any orthogonal neighbor is a non-hull module (would expose it)
      if(inst.cell == null) return true;
      const cellMap = new Map();
      for(const [id2, i2] of Object.entries(this.modules))
        if(id2 !== instId && i2.cell != null) cellMap.set(i2.cell, i2.moduleId);
      const r = (inst.cell / 9) | 0, c = inst.cell % 9;
      for(const [dr, dc] of [[-1,0],[0,1],[1,0],[0,-1]]) {
        const nr = r + dr, nc = c + dc;
        if(nr < 0 || nr >= 9 || nc < 0 || nc >= 9) continue;
        const adjMod = G.MODULES[cellMap.get(nr * 9 + nc)];
        if(adjMod && adjMod.slot !== 'hull') return false;
      }
      return true;
    }
    if(mod.slot === 'thruster') {
      const rot = (inst.rot || 0) % 4;
      const otherThrusters = id => {
        const i = this.modules[id];
        const m = G.MODULES[i?.moduleId];
        return id !== instId && m?.slot === 'thruster' && (i.rot||0)%4 === rot;
      };
      if(rot === 0 && Object.keys(this.modules).filter(otherThrusters).length < 2) return false;
      if(rot === 2 && Object.keys(this.modules).filter(otherThrusters).length < 1) return false;
    }
    if(mod.slot === 'power') {
      const otherPower = Object.values(this.modules).filter(i => i !== inst && (G.MODULES[i.moduleId]?.slot === 'power'));
      if(otherPower.length < 1) return false;
    }
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
    this.energyRegen= 45;
    this.maxFuel    = this._baseFuel;
    this.cargoSpace = this._baseCargoSpace;
    this.maxCrew    = 1;
    this.escapePods = 0;
    this.armor      = 0;
    this.autoRepair = 0;
    this.canCraft   = false;
    this.tractorRange=0;
    this.sensorRange= 600;
    this.canJump        = false;
    this.jumpRange      = 0;
    this.jumpChargeTime = 99; // set from module
    this.jumpCooldown   = 99;
    this.jumpFuelCost   = 99;
    this.mass           = this._baseMass;
    this.thrustForward  = 0;  // rot=0 thrusters — pushes ship forward, drives turning
    this.thrustRetro    = 0;  // rot=2 thrusters — required for reverse flight
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
      if(s.sensorRange)     this.sensorRange += s.sensorRange;
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
      const thrust = this.thrustForward * thrustEff * boostMult / effectiveMass;
      this.vx += fwdX * thrust * dt;
      this.vy += fwdY * thrust * dt;
      if(boostActive && !superBoostActive) this.energy = Math.max(0, this.energy - 450 * dt);
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
    // Q = strafe left (requires rot:3 thruster); E = strafe right (requires rot:1 thruster)
    this._strafeCooldown = Math.max(0, (this._strafeCooldown || 0) - dt);
    if(this._strafeCooldown <= 0) {
      if(inp.strafeL && this.thrustStrafeL > 0) {
        const dodgeAccel = this.thrustStrafeL * 0.8 / effectiveMass;
        this.vx -= latX * dodgeAccel * dt;
        this.vy -= latY * dodgeAccel * dt;
        this._strafeCooldown = 0.5;
        if(boostActive && !superBoostActive) this.energy = Math.max(0, this.energy - 60);
      } else if(inp.strafeR && this.thrustStrafeR > 0) {
        const dodgeAccel = this.thrustStrafeR * 0.8 / effectiveMass;
        this.vx += latX * dodgeAccel * dt;
        this.vy += latY * dodgeAccel * dt;
        this._strafeCooldown = 0.5;
        if(boostActive && !superBoostActive) this.energy = Math.max(0, this.energy - 60);
      }
    }
    // S = braking (any thrust) / reverse flight (requires front thruster)
    const spd = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
    if(inp.reverse) {
      this._reverseHeldTime += dt;
      const brakeAvail = this.thrustForward + this.thrustRetro;
      if(spd > 1 && this._reverseHeldTime < 1.0 && brakeAvail > 0) {
        // Braking: combined forward + retro thrust against velocity vector
        const brakeMag = brakeAvail * 2.0 * thrustEff * boostMult / effectiveMass;
        const bx = -(this.vx/spd) * brakeMag * dt;
        const by = -(this.vy/spd) * brakeMag * dt;
        this.vx = Math.abs(this.vx + bx) < Math.abs(bx) ? 0 : this.vx + bx;
        this.vy = Math.abs(this.vy + by) < Math.abs(by) ? 0 : this.vy + by;
      } else if(this._reverseHeldTime >= 1.0 && this.thrustRetro > 0) {
        // Reverse flight: front thruster required
        const thrustMag = this.thrustRetro * thrustEff * boostMult * 0.8 / effectiveMass;
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
    const _strafeActive = (inp.strafeL && this.thrustStrafeL > 0) || (inp.strafeR && this.thrustStrafeR > 0);
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

    // Update weapon cooldowns
    for(const w of this.weaponSlots) {
      if(w.cooldown > 0) w.cooldown -= dt;
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
  takeDamage(amount, type) {
    // Armor reduces physical damage
    if(type !== 'emp' && type !== 'laser') {
      amount = Math.max(1, amount - this.armor);
    }

    if(type === 'emp') {
      this.shields = Math.max(0, this.shields - amount*0.5);
      this.energy  = Math.max(0, this.energy  - amount);
      this.empTimer = 3 + amount*0.01;
      return { shieldDmg:amount*0.5, hullDmg:0 };
    }

    // Disabled ships have no power — bypass shields, track damage separately (hull stays at 0)
    if(this.disabled) {
      this._postDisableDmg = (this._postDisableDmg || 0) + amount;
      return { shieldDmg:0, hullDmg:amount };
    }

    let shieldDmg = 0, hullDmg = 0;
    if(this.shields > 0) {
      shieldDmg = Math.min(this.shields, amount);
      this.shields -= shieldDmg;
      amount -= shieldDmg;
      // Bleed-through
      amount *= 0.2;
    }
    if(amount > 0) {
      hullDmg = amount;
      this.hull -= hullDmg;
      if(this.hull <= 0) {
        this.hull = 0;
        this._postDisableDmg = 0;
        this.disabled = true;
      }
    }
    return { shieldDmg, hullDmg };
  }

  _damageModule(dmg) {
    // Randomly damage an installed module
    const instIds = Object.keys(this.modules).filter(id=>!this.modules[id].broken);
    if(instIds.length === 0) return;
    const roll = Math.random();
    if(roll > 0.3) return; // 30% chance to hit a module
    const id = G.randEl(instIds);
    const inst = this.modules[id];
    inst.hp -= dmg * 0.5;
    if(inst.hp <= 0) {
      inst.broken = true;
      this._recompute();
    }
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

    // Fire from weapon module's grid cell in world space
    const weapInst = Object.values(this.modules||{}).find(m =>
      (m.moduleId + '_' + m.slotIdx) === slot.instId
    );
    let ox, oy;
    if(weapInst?.cell != null) {
      const STEP = 12, tCC = 4, tCR = 4;
      const col = weapInst.cell % 9, row = (weapInst.cell / 9) | 0;
      const dx = (col - tCC) * STEP, dy = (row - tCR) * STEP;
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
