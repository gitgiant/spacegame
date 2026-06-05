'use strict';
// ── Ship class ────────────────────────────────────────────
G.Ship = class {
  constructor(templateId) {
    const tpl = G.SHIPS[templateId];
    if(!tpl) throw new Error('Unknown ship: '+templateId);

    this.templateId = templateId;
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

    // Base stats (before modules)
    this._baseMass        = tpl.baseMass;
    this._baseThrust      = tpl.baseThrust;
    this._baseTurn        = tpl.baseTurn;
    this._baseHull        = tpl.baseHull;
    this._baseEnergy      = tpl.baseEnergy;
    this._baseFuel        = tpl.baseFuel;
    this._baseCargoSpace  = tpl.baseCargoSpace;

    // Current stats (recomputed from modules)
    this.maxHull   = tpl.baseHull;
    this.hull      = tpl.baseHull;
    this.maxShields= 0;
    this.shields   = 0;
    this.shieldRegen= 0;
    this.maxEnergy = tpl.baseEnergy;
    this.energy    = tpl.baseEnergy;
    this.energyRegen= 45;
    this.maxFuel   = tpl.baseFuel;
    this.fuel      = tpl.baseFuel;
    this.fuelBurnRate = 0.5;
    this.cargoSpace = tpl.baseCargoSpace;
    this.maxCrew   = 1;  // pilot always present
    this.escapePods= 0;
    this.armor     = 0;
    this.canMine   = false;
    this.mineRate  = 0;
    this.autoRepair= 0;
    this.canCraft  = false;
    this.tractorRange= 0;
    this.sensorRange = 600;
    this.canJump   = false;
    this.jumpRange = 0;
    this.mass      = tpl.baseMass;
    this.thrustPower = tpl.baseThrust;
    this.turnSpeed = tpl.baseTurn;

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

    // Combat state
    this.disabled    = false;
    this.disabledHp  = 50;
    this.empTimer    = 0;
    this.crewEfficiency = 1.0;

    // Install starter modules from template
    (tpl.startModules || []).forEach(mid => this.installModule(mid));
    (tpl.startWeapons  || []).forEach(wid => this.installModule(wid));

    this._recompute();
    this.hull    = this.maxHull;
    this.shields = this.maxShields;
    this.energy  = this.maxEnergy;
    this.fuel    = this.maxFuel;
  }

  // ── Module management ────────────────────────────────
  installModule(moduleId) {
    const mod = G.MODULES[moduleId] || G.WEAPONS[moduleId];
    if(!mod) return false;

    const idx = this.slots.indexOf(null);
    if(idx === -1) return false;

    const instId = 'm'+(this._nextModId++);
    this.modules[instId] = { moduleId, slotIdx:idx, hp:mod.hp||50, broken:false };
    this.slots[idx] = instId;

    this._recompute();
    return instId;
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
    this.canMine    = false;
    this.mineRate   = 0;
    this.autoRepair = 0;
    this.canCraft   = false;
    this.tractorRange=0;
    this.sensorRange= 600;
    this.canJump        = false;
    this.jumpRange      = 0;
    this.jumpChargeTime = 99; // set from module
    this.jumpCooldown   = 99;
    this.jumpFuelCost   = 99;
    this.mass       = this._baseMass;
    this.thrustPower= this._baseThrust;
    this.turnSpeed  = this._baseTurn;

    this.weaponSlots = [];

    let totalEnergyDraw = 0;

    for(const inst of Object.values(this.modules)) {
      if(inst.broken) continue;
      const mod = G.MODULES[inst.moduleId] || G.WEAPONS[inst.moduleId];
      if(!mod) continue;

      // Weapons get added to weapon list
      if(mod.slot === 'weapon' || mod.slot === 'turret') {
        if(!this.weaponSlots.find(w=>w.instId===inst.moduleId+'_'+inst.slotIdx)) {
          this.weaponSlots.push({ weaponId:mod.id, instId:inst.moduleId, cooldown:0, turret:!!mod.turret });
        }
        totalEnergyDraw += (mod.energyCost||0)*0.1; // idle draw
        this.mass += (mod.mass||0);
        continue;
      }

      const s = mod.stats || {};
      if(s.thrust)          this.thrustPower += s.thrust;
      if(s.turnSpeed)       this.turnSpeed   += s.turnSpeed;
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
      if(s.canMine)         this.canMine      = true;
      if(s.mineRate)        this.mineRate    += s.mineRate;
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

      totalEnergyDraw += (mod.energyDraw||0);
    }

    // Crew stat bonuses
    let pilotBonus=0, gunnerDmgBonus=0, engineerBonus=0;
    for(const c of this.crew) {
      const role = G.CREW_ROLES[c.role];
      if(!role) continue;
      const s = role.stats;
      if(s.turnBonus)     this.turnSpeed   += s.turnBonus;
      if(s.thrustBonus)   this.thrustPower *= (1+s.thrustBonus);
      if(s.repairRate)    this.autoRepair  += s.repairRate;
      if(s.energyBonus)   this.energyRegen *= (1+s.energyBonus);
      if(s.jumpRangeBonus)this.jumpRange   += s.jumpRangeBonus;
      if(s.sensorBonus)   this.sensorRange += s.sensorBonus;
    }

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
    const boostWanted = inp.boost && this.energy > 5;
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

    // Thrust
    // Boost: high acceleration for sharp maneuvering, but lower top speed
    const boostMult   = boostActive ? 5.0 : 1.0;
    if(inp.thrust) {
      const thrust = this.thrustPower * thrustEff * boostMult / effectiveMass;
      this.vx += fwdX * thrust * dt;
      this.vy += fwdY * thrust * dt;
      if(boostActive) this.energy = Math.max(0, this.energy - 450 * dt);
      this.fuel = Math.max(0, this.fuel - this.fuelBurnRate * 0.05 * dt);

      // Grip: while driving forward, fire lateral thrusters to cancel sideways drift
      const vLat = this.vx*latX + this.vy*latY;
      const gripMag = this.thrustPower * thrustEff * boostMult * 1.2 / effectiveMass;
      const dvl = Math.sign(vLat) * Math.min(Math.abs(vLat), gripMag * dt);
      this.vx -= latX * dvl;
      this.vy -= latY * dvl;
    }
    // Q/E = dodge left/right (instant acceleration perpendicular to direction)
    this._strafeCooldown = Math.max(0, (this._strafeCooldown || 0) - dt);
    if((inp.strafeL || inp.strafeR) && this._strafeCooldown <= 0) {
      const dir = inp.strafeL ? -1 : 1;
      const dodgeAccel = 8000 / effectiveMass;
      this.vx += latX * dir * dodgeAccel * dt;
      this.vy += latY * dir * dodgeAccel * dt;
      this._strafeCooldown = 0.5;
      if(boostActive) this.energy = Math.max(0, this.energy - 60);
    }
    // S = retrograde burn — retro thrusters brake ~1.75x harder than forward thrust
    const spd = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
    if(inp.reverse) {
      this._reverseHeldTime += dt;
      if(spd > 1 && this._reverseHeldTime < 1.0) {
        // Braking mode: apply retrograde braking
        const brakeMag = this.thrustPower * 2.0 * thrustEff * boostMult / effectiveMass;
        const bx = -(this.vx/spd) * brakeMag * dt;
        const by = -(this.vy/spd) * brakeMag * dt;
        this.vx = Math.abs(this.vx + bx) < Math.abs(bx) ? 0 : this.vx + bx;
        this.vy = Math.abs(this.vy + by) < Math.abs(by) ? 0 : this.vy + by;
      } else if(this._reverseHeldTime >= 1.0) {
        // Backwards vectoring mode: apply reverse thrust
        const thrustMag = this.thrustPower * thrustEff * boostMult * 0.8 / effectiveMass;
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
    const _latDrag = (inp.strafeL || inp.strafeR) ? 0.25 : 2.5;
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

    // Aim direction
    let aimAngle = this.angle;
    if(targetX != null) {
      const toTarget = Math.atan2(targetX-this.x, -(targetY-this.y));
      if(slot.turret) {
        aimAngle = toTarget;
      } else {
        const diff = Math.abs(G.wrapAngle(toTarget - this.angle));
        if(diff < Math.PI / 6) aimAngle = toTarget; // snap within 30°
      }
    }

    const baseProj = {
      x: this.x + Math.sin(this.angle)*15,
      y: this.y - Math.cos(this.angle)*15,
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
      ...(wpn.type === 'mining' ? { originX: this.x, originY: this.y } : {}),
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
    };
  }
};
