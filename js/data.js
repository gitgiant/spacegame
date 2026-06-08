'use strict';
// ── Global namespace ──────────────────────────────────────
window.G = {};

// ── Factions ──────────────────────────────────────────────
G.FACTIONS = {
  earth:     { id:'earth',     name:'Earth Government', color:'#4488ff', bgCol:'#001133', rel:  50 },
  rebellion: { id:'rebellion', name:'The Rebellion',    color:'#ff6600', bgCol:'#220800', rel:   0 },
  pirate:    { id:'pirate',    name:'Pirate Clans',     color:'#ff1111', bgCol:'#1a0000', rel: -50 },
  alien:     { id:'alien',     name:'The Shard',        color:'#00ff88', bgCol:'#001a10', rel:-100 },
  contested: { id:'contested', name:'Contested',        color:'#aaaaaa', bgCol:'#111111', rel:   0 },
  neutral:   { id:'neutral',   name:'Independent',      color:'#888888', bgCol:'#0a0a0a', rel:   0 },
};

G.FACTIONS.independent = { id:'independent', name:'Independent', color:'#aaaaaa', bgCol:'#0a0a0a', rel:0 };

// ── Faction music tracks ─────────────────────────────────────────────────────
// Procedural songs for the adaptive engine (sound.js). Each track keeps the
// vertical-layer intensity system but supplies its own chord progressions per
// mode (explore/combat/boss), tempo, and timbre tint — so faction space sounds
// distinct while still rising into combat. Chord = [rootSemitoneOffsetFromA,
// quality]; `tint` overrides oscillator types + a per-track tone (lowpass Hz).
G.MUSIC_TRACKS = [
  { id:'independent', name:'Drifters’ Expanse', faction:'independent', tempo:90,
    tint:{ pad:'triangle', lead:'triangle', bass:'sine', arp:'triangle', tone:14000, detune:0.003 },
    progs:{ explore:[[0,'min'],[-4,'maj'],[3,'maj'],[-2,'maj']],
            combat:[[0,'min'],[-2,'maj'],[-4,'maj'],[-5,'maj']],
            boss:[[0,'min'],[1,'maj'],[5,'min'],[-5,'maj']] } },
  { id:'earth', name:'Sol Authority', faction:'earth', tempo:96,
    tint:{ pad:'triangle', lead:'square', bass:'sawtooth', arp:'triangle', tone:13000, detune:0.004 },
    progs:{ explore:[[0,'maj'],[-5,'maj'],[-7,'maj'],[-2,'maj']],
            combat:[[0,'maj'],[-2,'maj'],[-5,'maj'],[-7,'maj']],
            boss:[[0,'maj'],[3,'min'],[-2,'maj'],[-5,'maj']] } },
  { id:'rebellion', name:'Ashes & Iron', faction:'rebellion', tempo:104,
    tint:{ pad:'sawtooth', lead:'sawtooth', bass:'sawtooth', arp:'square', tone:11000, detune:0.006 },
    progs:{ explore:[[0,'min'],[-2,'maj'],[3,'min'],[-4,'maj']],
            combat:[[0,'min'],[-5,'maj'],[-7,'maj'],[-2,'maj']],
            boss:[[0,'min'],[-7,'maj'],[3,'min'],[-5,'maj']] } },
  { id:'pirate', name:'Black Flag Run', faction:'pirate', tempo:88,
    tint:{ pad:'sawtooth', lead:'square', bass:'sawtooth', arp:'sawtooth', tone:9000, detune:0.007 },
    progs:{ explore:[[0,'min'],[1,'maj'],[-4,'maj'],[-2,'maj']],
            combat:[[0,'min'],[1,'maj'],[5,'min'],[-5,'maj']],
            boss:[[0,'min'],[1,'maj'],[6,'dim'],[-5,'maj']] } },
  { id:'alien', name:'Shard Resonance', faction:'alien', tempo:76,
    tint:{ pad:'sine', lead:'sine', bass:'triangle', arp:'sine', tone:6500, detune:0.010 },
    progs:{ explore:[[0,'dim'],[2,'dim'],[6,'dim'],[4,'dim']],
            combat:[[0,'dim'],[6,'dim'],[2,'maj'],[8,'dim']],
            boss:[[0,'dim'],[6,'dim'],[1,'dim'],[7,'dim']] } },
  { id:'contested', name:'No Man’s Sky', faction:'contested', tempo:100,
    tint:{ pad:'triangle', lead:'sawtooth', bass:'sawtooth', arp:'square', tone:10000, detune:0.005 },
    progs:{ explore:[[0,'min'],[-3,'min'],[-5,'maj'],[2,'dim']],
            combat:[[0,'min'],[1,'maj'],[-4,'maj'],[-5,'maj']],
            boss:[[0,'min'],[-2,'maj'],[1,'maj'],[6,'dim']] } },
];
// faction id -> track id (several factions map onto a shared track).
G.MUSIC_FACTION_MAP = { earth:'earth', rebellion:'rebellion', pirate:'pirate',
  alien:'alien', contested:'contested', neutral:'independent', independent:'independent' };

// ── Character Classes ──────────────────────────────────────
G.CLASSES = {
  hacker:       { id:'hacker',       name:'HACKER',       color:'#00ff88', icon:'⌨', desc:'Electronic warfare & infiltration',  startAbility:'chaff' },
  tech_priest:  { id:'tech_priest',  name:'TECH PRIEST',  color:'#bb88ff', icon:'⚙', desc:'Machine devotee. Keeps ships running', startAbility:'repair_drone' },
  space_marine: { id:'space_marine', name:'SPACE MARINE', color:'#4488ff', icon:'⚔', desc:'Elite zero-g combat soldier',         startAbility:'stim' },
  monk:         { id:'monk',         name:'MONK',         color:'#ffdd44', icon:'☯', desc:'Disciplined warrior. Calm under fire', startAbility:'frost_nova' },
  medic:        { id:'medic',        name:'MEDIC',        color:'#44ffaa', icon:'✚', desc:'Field surgeon. Keeps crew alive',      startAbility:'healing_nova' },
  sniper:       { id:'sniper',       name:'SNIPER',       color:'#ff8844', icon:'◎', desc:'Long-range precision. One shot.',      startAbility:'mark_target' },
  tank:         { id:'tank',         name:'TANK',         color:'#aaaaaa', icon:'🛡', desc:'Heavily armored. Absorbs punishment',  startAbility:'quantum_brake' },
  berserker:    { id:'berserker',    name:'BERSERKER',    color:'#ff2222', icon:'🔥', desc:'Rage fuels combat power. No retreat.', startAbility:'superboost' },
  knight:       { id:'knight',       name:'KNIGHT',       color:'#ffcc00', icon:'♞', desc:'Noble warrior. Code of honor',         startAbility:'invulnerability' },
};
G.CLASS_IDS = Object.keys(G.CLASSES);

// Faction hostility table [attacker][target] = hostile?
G.HOSTILE = {
  earth:       { pirate:true,  alien:true },
  rebellion:   { earth:true,   alien:true },
  pirate:      { earth:true,   rebellion:true },
  alien:       { earth:true,   rebellion:true, pirate:true, independent:true, contested:true },
};

// ── Loot Rarity ───────────────────────────────────────────
G.RARITY = {
  c: { label:'Common',    color:'#cccccc', cls:'rarity-c rc' },
  u: { label:'Uncommon',  color:'#4488ff', cls:'rarity-u ru' },
  r: { label:'Rare',      color:'#aa44ff', cls:'rarity-r rr' },
  e: { label:'Epic',      color:'#ffaa00', cls:'rarity-e re' },
  l: { label:'Legendary', color:'#ff4444', cls:'rarity-l rl' },
};

// ── Trade Items ───────────────────────────────────────────
G.ITEMS = {
  // Raw materials
  ore:          { id:'ore',          name:'Metal Ore',        cat:'raw',     base:40,   mass:2, rarity:'c', desc:'Common metallic ore.' },
  crystals:     { id:'crystals',     name:'Crystals',         cat:'raw',     base:120,  mass:1, rarity:'u', desc:'Rare mineral crystals.' },
  rare_earth:   { id:'rare_earth',   name:'Rare Earth',       cat:'raw',     base:200,  mass:1, rarity:'r', desc:'Exotic rare-earth elements.' },
  alien_metal:  { id:'alien_metal',  name:'Alien Metal',      cat:'raw',     base:500,  mass:2, rarity:'e', desc:'Strange alloy from alien ships.' },
  dark_matter:  { id:'dark_matter',  name:'Dark Matter',      cat:'raw',     base:2000, mass:1, rarity:'l', desc:'Near-mythical exotic matter.' },
  // Asteroid raw materials (mined from hex-tile clusters; increasing rarity)
  rock:         { id:'rock',         name:'Rock',             cat:'raw',     base:15,   mass:2, rarity:'c', desc:'Plain silicate rock.' },
  ice:          { id:'ice',          name:'Ice',              cat:'raw',     base:30,   mass:2, rarity:'c', desc:'Frozen volatiles.' },
  iron:         { id:'iron',         name:'Iron',             cat:'raw',     base:55,   mass:3, rarity:'c', desc:'Raw iron.' },
  nickel:       { id:'nickel',       name:'Nickel',           cat:'raw',     base:95,   mass:3, rarity:'u', desc:'Nickel ore.' },
  copper:       { id:'copper',       name:'Copper',           cat:'raw',     base:130,  mass:2, rarity:'u', desc:'Copper ore.' },
  tin:          { id:'tin',          name:'Tin',              cat:'raw',     base:180,  mass:2, rarity:'u', desc:'Tin ore.' },
  gold:         { id:'gold',         name:'Gold',             cat:'raw',     base:380,  mass:3, rarity:'r', desc:'Native gold.' },
  carbon:       { id:'carbon',       name:'Carbon',           cat:'raw',     base:560,  mass:1, rarity:'r', desc:'Crystalline carbon.' },
  titanium:     { id:'titanium',     name:'Titanium',         cat:'raw',     base:900,  mass:2, rarity:'e', desc:'Titanium ore.' },
  platinum:     { id:'platinum',     name:'Platinum',         cat:'raw',     base:1600, mass:3, rarity:'l', desc:'Native platinum.' },
  // Refined
  metals:       { id:'metals',       name:'Processed Metals', cat:'refined', base:80,   mass:2, rarity:'c', desc:'Refined metal stock.' },
  polymers:     { id:'polymers',     name:'Polymers',         cat:'refined', base:60,   mass:1, rarity:'c', desc:'Industrial polymers.' },
  alloys:       { id:'alloys',       name:'Alloys',           cat:'refined', base:150,  mass:2, rarity:'u', desc:'High-grade alloys.' },
  fuel_cells:   { id:'fuel_cells',   name:'Fuel Cells',       cat:'refined', base:100,  mass:1, rarity:'c', desc:'Refined fuel for ships.' },
  nano_comp:    { id:'nano_comp',    name:'Nano-Components',  cat:'refined', base:300,  mass:1, rarity:'r', desc:'Microscale machine parts.' },
  // Goods
  food:         { id:'food',         name:'Food Supplies',    cat:'goods',   base:30,   mass:2, rarity:'c', desc:'Basic rations.' },
  medicine:     { id:'medicine',     name:'Medicine',         cat:'goods',   base:150,  mass:1, rarity:'u', desc:'Medical supplies.' },
  electronics:  { id:'electronics',  name:'Electronics',      cat:'goods',   base:200,  mass:1, rarity:'u', desc:'Consumer electronics.' },
  weapons_cache:{ id:'weapons_cache',name:'Weapons Cache',    cat:'goods',   base:400,  mass:3, rarity:'r', desc:'Military-grade weapons. Handle with care.' },
  data_cores:   { id:'data_cores',   name:'Data Cores',       cat:'goods',   base:600,  mass:1, rarity:'r', desc:'Encrypted data storage.' },
  // Luxury
  alien_art:    { id:'alien_art',    name:'Alien Artifacts',  cat:'luxury',  base:1000, mass:1, rarity:'e', desc:'Priceless alien art pieces.' },
  gems:         { id:'gems',         name:'Precious Gems',    cat:'luxury',  base:500,  mass:1, rarity:'r', desc:'Cut gemstones.' },
  fine_spirits: { id:'fine_spirits', name:'Fine Spirits',     cat:'luxury',  base:300,  mass:1, rarity:'u', desc:'Aged luxury spirits.' },
  // Crafting components
  circuit_boards:{ id:'circuit_boards',name:'Circuit Boards', cat:'craft',   base:180,  mass:1, rarity:'u', desc:'Electronic circuit boards.' },
  shield_emitters:{ id:'shield_emitters',name:'Shield Emitters',cat:'craft', base:350,  mass:1, rarity:'r', desc:'Shield projection emitters.' },
  engine_parts: { id:'engine_parts', name:'Engine Parts',     cat:'craft',   base:250,  mass:2, rarity:'u', desc:'Precision engine components.' },
  hull_plating: { id:'hull_plating', name:'Hull Plating',     cat:'craft',   base:200,  mass:3, rarity:'u', desc:'Reinforced hull panels.' },
  // Ammunition (massless cargo; converts to player.ammo on purchase/pickup)
  kinetic_rounds:{ id:'kinetic_rounds', name:'Kinetic Rounds', cat:'ammo', base:60,  mass:0, rarity:'c', ammoRounds:100, desc:'100 rounds for autocannons, railguns, and artillery.' },
  shotgun_shells:{ id:'shotgun_shells', name:'Shotgun Shells',  cat:'ammo', base:90,  mass:0, rarity:'c', ammoRounds:30,  desc:'30 shells for the scatter cannon.' },
  // Mission items (can't trade normally)
  mission_pkg:  { id:'mission_pkg',  name:'Cargo Package',    cat:'mission', base:0,    mass:2, rarity:'c', desc:'A sealed cargo package.' },
  mission_data: { id:'mission_data', name:'Data Chip',        cat:'mission', base:0,    mass:0, rarity:'u', desc:'Important data chip.' },
};

// ── Crafting Recipes ──────────────────────────────────────
G.RECIPES = [
  { id:'r1', name:'Processed Metals',  inputs:{ore:3},                                     output:{item:'metals',qty:1},        time:5,  reqModule:null },
  { id:'r2', name:'Alloys',            inputs:{metals:2, crystals:1},                      output:{item:'alloys',qty:1},        time:8,  reqModule:null },
  { id:'r3', name:'Fuel Cells',        inputs:{ore:1, polymers:2},                         output:{item:'fuel_cells',qty:2},    time:4,  reqModule:null },
  { id:'r4', name:'Hull Plating',      inputs:{alloys:2},                                  output:{item:'hull_plating',qty:1},  time:10, reqModule:'workshop' },
  { id:'r5', name:'Circuit Boards',    inputs:{metals:1, nano_comp:1},                     output:{item:'circuit_boards',qty:2},time:8,  reqModule:'workshop' },
  { id:'r6', name:'Shield Emitters',   inputs:{crystals:2, circuit_boards:1},              output:{item:'shield_emitters',qty:1},time:12,reqModule:'workshop' },
  { id:'r7', name:'Engine Parts',      inputs:{alloys:1, metals:1},                        output:{item:'engine_parts',qty:1},  time:10, reqModule:'workshop' },
  { id:'r8', name:'Nano-Components',   inputs:{rare_earth:1, circuit_boards:2},            output:{item:'nano_comp',qty:1},     time:15, reqModule:'lab' },
  { id:'r9', name:'Fuel Boost',        inputs:{fuel_cells:2, crystals:1},                  output:{item:'fuel_cells',qty:4},    time:6,  reqModule:'lab' },
  { id:'r10',name:'Med Kit',           inputs:{food:1, polymers:1},                         output:{item:'medicine',qty:1},      time:4,  reqModule:null },
  // Module crafting (requires workshop; produces equippable modules)
  { id:'rm1', name:'Craft: Light Shield',   inputs:{shield_emitters:1, circuit_boards:1},               outputModule:'light_shield',   time:0,  reqModule:'workshop' },
  { id:'rm2', name:'Craft: Fuel Tank',      inputs:{metals:2, polymers:1},                             outputModule:'fuel_tank',      time:0,  reqModule:null },
  { id:'rm3', name:'Craft: Sensor Array',   inputs:{circuit_boards:2, nano_comp:1},                    outputModule:'basic_sensors',  time:0,  reqModule:'workshop' },
  { id:'rm4', name:'Craft: Repair Bay',     inputs:{metals:2, engine_parts:1, circuit_boards:1},       outputModule:'repair_bay',     time:0,  reqModule:'workshop' },
  { id:'rm5', name:'Craft: Mining Laser',   inputs:{metals:1, engine_parts:1},                         outputModule:'mining_laser_wpn', time:0,reqModule:null },
  { id:'rm6', name:'Craft: Hull Plating',   inputs:{hull_plating:3, alloys:1},                         outputModule:'hull_armor',     time:0,  reqModule:'workshop' },
  { id:'rm7', name:'Craft: Laser Cannon',   inputs:{metals:2, circuit_boards:1},                       outputModule:'laser_cannon',   time:0,  reqModule:null },
  { id:'rm8', name:'Craft: Autocannon',     inputs:{metals:3, engine_parts:1},                         outputModule:'autocannon',     time:0,  reqModule:null },
  { id:'rm9', name:'Craft: Missile Turret', inputs:{engine_parts:2, circuit_boards:2, alloys:1},       outputModule:'missile_turret', time:0,  reqModule:'workshop' },
  // Ammo crafting
  { id:'ra1', name:'Kinetic Rounds',        inputs:{metals:1, polymers:1},                             output:{item:'kinetic_rounds',qty:2},  time:3,  reqModule:null },
  { id:'ra2', name:'Shotgun Shells',        inputs:{metals:1, fuel_cells:1},                           output:{item:'shotgun_shells',qty:2},  time:4,  reqModule:null },
];

// ── Weapon Templates ──────────────────────────────────────
G.WEAPONS = {
  laser_cannon: {
    id:'laser_cannon', name:'Laser Cannon', type:'laser', slot:'weapon',
    damage:25, range:900, energyCost:18, fireRate:2.2, projSpeed:1100,
    color:'#ff4444', width:2, pierce:true, splash:0,
    price:800, mass:3, rarity:'c', desc:'Standard forward laser. Fast, energy hungry.',
    stats:'DMG:25  RNG:900  RATE:1.5/s',
  },
  heavy_laser: {
    id:'heavy_laser', name:'Heavy Laser', type:'laser', slot:'weapon',
    damage:60, range:1100, energyCost:35, fireRate:0.9, projSpeed:1200,
    color:'#ff2222', width:3, pierce:true, splash:0,
    price:2200, mass:6, rarity:'u', desc:'High-damage slow-firing laser.',
    stats:'DMG:60  RNG:1100  RATE:0.6/s',
  },
  railgun: {
    id:'railgun', name:'Railgun', type:'projectile', slot:'weapon',
    damage:80, range:1800, energyCost:0, fireRate:0.6, projSpeed:2400,
    color:'#88ccff', width:2, pierce:true, splash:0, ammo:'kinetic_rounds',
    price:3500, mass:8, rarity:'r', desc:'Hypersonic kinetic round. Long range, slow fire.',
    stats:'DMG:80  RNG:1800  RATE:0.4/s',
  },
  autocannon: {
    id:'autocannon', name:'Autocannon', type:'projectile', slot:'weapon',
    damage:12, range:600, energyCost:0, fireRate:7.5, projSpeed:900,
    color:'#ffcc44', width:2, pierce:false, splash:0, ammo:'kinetic_rounds',
    price:1200, mass:5, rarity:'c', desc:'Rapid-fire ballistic cannon.',
    stats:'DMG:12  RNG:600  RATE:5/s',
  },
  missile_launcher: {
    id:'missile_launcher', name:'Missile Launcher', type:'missile', slot:'weapon',
    damage:120, range:3000, energyCost:0, fireRate:0.45, projSpeed:480,
    color:'#ff8800', width:3, pierce:false, splash:120, tracking:true,
    price:4000, mass:10, rarity:'u', desc:'Long-range missile launcher. Fires dumb missiles; guided only with Optical Target Lock from a Targeting Pod.',
    stats:'DMG:120  RNG:3000  SPLASH:120',
  },
  flamethrower: {
    id:'flamethrower', name:'Flamethrower', type:'flame', slot:'weapon',
    damage:8, range:280, energyCost:12, fireRate:12, projSpeed:420,
    color:'#ff5500', width:5, pierce:false, splash:0,
    price:2200, mass:6, rarity:'u', desc:'Short-range incendiary spray. Rapid-fire, energy hungry.',
    stats:'DMG:8×12/s  RNG:280  SHORT',
  },
  scatter_cannon: {
    id:'scatter_cannon', name:'Scatter Cannon', type:'projectile', slot:'weapon',
    damage:14, range:480, energyCost:0, fireRate:1.4, projSpeed:820,
    color:'#ffaa44', width:2, pierce:false, splash:0, ammo:'shotgun_shells',
    pellets:7, spread:0.28,
    price:2500, mass:8, rarity:'u', desc:'Fires 7 pellets per shot. Devastating at close range.',
    stats:'DMG:14×7  RNG:480  SPREAD',
  },
  emp_cannon: {
    id:'emp_cannon', name:'EMP Cannon', type:'emp', slot:'weapon',
    damage:0, range:800, energyCost:60, fireRate:0.45, projSpeed:700,
    color:'#aa44ff', width:4, pierce:false, splash:100, empStrength:200,
    price:5000, mass:8, rarity:'r', desc:'Disables shields & engines. No hull damage.',
    stats:'EMP:200  RNG:800  RATE:0.3/s',
  },
  artillery: {
    id:'artillery', name:'Mass Driver', type:'projectile', slot:'weapon',
    damage:200, range:2800, energyCost:0, fireRate:0.22, projSpeed:3200,
    color:'#ffffff', width:3, pierce:true, splash:0, ammo:'kinetic_rounds',
    price:12000, mass:20, rarity:'e', desc:'Extreme range devastation. Ship must be near-stationary.',
    stats:'DMG:200  RNG:2800  RATE:0.15/s',
  },
  turret: {
    id:'turret', name:'Turret', type:'laser', slot:'turret',
    damage:4, range:600, energyCost:0, fireRate:6, projSpeed:1100,
    color:'#44ffff', width:2, pierce:false, splash:0, turret:true, accuracy:0.15,
    price:2500, mass:6, rarity:'u', desc:'360° laser turret. Fires on SPACE toward target with limited rotation speed.',
    stats:'DMG:4  RNG:600  360°LASER',
  },
  missile_turret: {
    id:'missile_turret', name:'Missile Turret', type:'missile', slot:'turret',
    damage:110, range:2600, energyCost:0, fireRate:0.38, projSpeed:470,
    color:'#ff8800', width:3, pierce:false, splash:110, tracking:true, turret:true,
    price:7000, mass:14, rarity:'r', desc:'360° missile turret. Fires dumb missiles; guided only with Optical Target Lock from a Targeting Pod.',
    stats:'DMG:110  RNG:2600  360°GUIDED',
  },
  plasma_cannon: {
    id:'plasma_cannon', name:'Plasma Cannon', type:'laser', slot:'weapon',
    damage:45, range:700, energyCost:30, fireRate:1.8, projSpeed:800,
    color:'#00ffcc', width:4, pierce:false, splash:30,
    price:3200, mass:6, rarity:'r', desc:'Short-range plasma glob. Melts shields.',
    stats:'DMG:45  SPLASH:30  SHIELD×2',
  },
  mining_laser_wpn: {
    id:'mining_laser_wpn', name:'Mining Laser', type:'mining', slot:'weapon',
    damage:0.45, range:140, energyCost:1, fireRate:20, projSpeed:1100,
    color:'#ffcc00', width:5, pierce:false, splash:0,
    price:1500, mass:5, rarity:'c', desc:'Continuous-beam mining laser. Highly effective against asteroids, decent against ships.',
    mineRate:90,
    stats:'MINE:5×DMG  RNG:140  BEAM',
  },
};

// ── Module Templates ──────────────────────────────────────
G.MODULES = {
  // Cockpit — required on every ship to be flyable
  cockpit: {
    id:'cockpit', name:'Cockpit', slot:'cockpit',
    stats:{ mass:+10 },
    energyDraw:2, hp:80, price:600, rarity:'c',
    desc:'Command cockpit. Required to fly the ship.',
    visual:'cockpit',
  },
  // Thrusters — single module type; direction set by rotation (rot 0=fwd 1=right 2=retro 3=left)
  // 2 rot:0 required to fly and turn; any thruster can reverse (no dedicated rot:2 needed); rot:1 + rot:3 pair for strafing
  thruster: {
    id:'thruster', name:'Thruster', slot:'thruster',
    stats:{ thrustForce:+12000, mass:+22 },
    energyDraw:4, hp:60, price:500, rarity:'c',
    desc:'Maneuvering thruster. Rotate to set direction. Two rear-facing required to fly.',
    visual:'engine',
  },
  thruster_imp: {
    id:'thruster_imp', name:'Improved Thruster', slot:'thruster',
    stats:{ thrustForce:+25000, mass:+38 },
    energyDraw:9, hp:80, price:1800, rarity:'u',
    desc:'High-output thruster. Rotate to set direction.',
    visual:'engine',
  },
  thruster_mil: {
    id:'thruster_mil', name:'Military Thruster', slot:'thruster',
    stats:{ thrustForce:+40000, mass:+52 },
    energyDraw:15, hp:100, price:5000, rarity:'r',
    desc:'Military-grade thruster. Rotate to set direction.',
    visual:'engine',
  },
  // Shields
  light_shield: {
    id:'light_shield', name:'Light Shield', slot:'shield',
    stats:{ maxShields:+80, shieldRegen:+4 },
    energyDraw:12, hp:50, price:1200, rarity:'c',
    desc:'Basic shield projector.',
    visual:'shield',
  },
  medium_shield: {
    id:'medium_shield', name:'Medium Shield', slot:'shield',
    stats:{ maxShields:+200, shieldRegen:+8 },
    energyDraw:22, hp:70, price:3500, rarity:'u',
    desc:'Enhanced shield array.',
    visual:'shield',
  },
  heavy_shield: {
    id:'heavy_shield', name:'Heavy Shield', slot:'shield',
    stats:{ maxShields:+400, shieldRegen:+12 },
    energyDraw:40, hp:90, price:8000, rarity:'r',
    desc:'Military-grade barrier.',
    visual:'shield',
  },
  // Cargo
  small_cargo: {
    id:'small_cargo', name:'Small Cargo Pod', slot:'cargo',
    stats:{ cargoSpace:+1, mass:+20 },
    energyDraw:0, hp:40, price:400, rarity:'c',
    desc:'1 unit extra cargo space.',
    visual:'cargo',
  },
  medium_cargo: {
    id:'medium_cargo', name:'Cargo Hold', slot:'cargo',
    stats:{ cargoSpace:+3, mass:+40 },
    energyDraw:0, hp:60, price:1000, rarity:'c',
    desc:'3 units extra cargo space.',
    visual:'cargo',
  },
  large_cargo: {
    id:'large_cargo', name:'Large Cargo Bay', slot:'cargo',
    stats:{ cargoSpace:+5, mass:+80 },
    energyDraw:0, hp:80, price:2200, rarity:'u',
    desc:'5 units extra cargo space.',
    visual:'cargo',
  },
  // Fuel
  fuel_tank: {
    id:'fuel_tank', name:'Fuel Tank', slot:'fuel',
    stats:{ maxFuel:+40, mass:+15 },
    energyDraw:0, hp:30, price:300, rarity:'c',
    desc:'Extra fuel storage.',
    visual:'fuel',
  },
  ext_fuel_tank: {
    id:'ext_fuel_tank', name:'Extended Fuel Tank', slot:'fuel',
    stats:{ maxFuel:+100, mass:+35 },
    energyDraw:0, hp:50, price:800, rarity:'u',
    desc:'Large extra fuel storage.',
    visual:'fuel',
  },
  // Hyperspace
  jump_drive: {
    id:'jump_drive', name:'Hyperspace Drive', slot:'jump',
    stats:{ canJump:true, jumpRange:+3, mass:+40, jumpChargeTime:5.0, jumpCooldown:10, jumpFuelCost:10 },
    energyDraw:5, hp:60, price:2000, rarity:'c',
    desc:'Allows travel between star systems.',
    visual:'jump',
  },
  military_jump: {
    id:'military_jump', name:'Military Jump Drive', slot:'jump',
    stats:{ canJump:true, jumpRange:+6, mass:+50, jumpChargeTime:3.0, jumpCooldown:6, jumpFuelCost:7 },
    energyDraw:8, hp:80, price:6000, rarity:'r',
    desc:'Extended range jump drive. Faster charge, shorter cooldown.',
    visual:'jump',
  },
  // Power
  reactor: {
    id:'reactor', name:'Reactor', slot:'power',
    stats:{ maxEnergy:+80, energyRegen:+45, mass:+40 },
    energyDraw:0, hp:70, price:1500, rarity:'c',
    desc:'Fusion reactor. More power.',
    visual:'power',
  },
  military_reactor: {
    id:'military_reactor', name:'Military Reactor', slot:'power',
    stats:{ maxEnergy:+200, energyRegen:+120, mass:+60 },
    energyDraw:0, hp:90, price:5500, rarity:'r',
    desc:'High-output military reactor.',
    visual:'power',
  },
  // Crew quarters
  crew_quarters: {
    id:'crew_quarters', name:'Crew Quarters', slot:'crew',
    stats:{ maxCrew:+2, mass:+20 },
    energyDraw:2, hp:40, price:600, rarity:'c',
    desc:'Adds 2 crew bunk capacity.',
    visual:'crew',
  },
  officer_block: {
    id:'officer_block', name:'Officer Block', slot:'crew',
    stats:{ maxCrew:+4, mass:+35, crewEfficiency:+0.1 },
    energyDraw:4, hp:60, price:2000, rarity:'u',
    desc:'Adds 4 crew. Boosts efficiency.',
    visual:'crew',
  },
  // Sensors
  basic_sensors: {
    id:'basic_sensors', name:'Sensor Array', slot:'sensor',
    stats:{ sensorRange:+800, canScan:true, mass:+10 },
    energyDraw:5, hp:30, price:700, rarity:'c',
    desc:'Extends radar range. Unlocks the Scan ability to read targeted ships.',
    visual:'sensor',
  },
  military_sensors: {
    id:'military_sensors', name:'Military Sensors', slot:'sensor',
    stats:{ sensorRange:+1800, detectCloaked:true, canScan:true, mass:+15 },
    energyDraw:12, hp:50, price:3000, rarity:'r',
    desc:'Detects cloaked ships. Unlocks the Scan ability to read targeted ships.',
    visual:'sensor',
  },
  radar_module: {
    id:'radar_module', name:'Radar Array', slot:'sensor',
    stats:{ sensorRange:+600, canRadarScan:true, mass:+20 },
    energyDraw:20, hp:45, price:12000, rarity:'r',
    desc:'Active phased-array radar. High power draw. Unlocks Radar Scan — emits a pulse that reveals all ships in a 6-hex radius for 30 seconds.',
    visual:'sensor',
  },
  targeting_pod: {
    id:'targeting_pod', name:'Targeting Pod', slot:'sensor',
    stats:{ canOpticalLock:true, mass:+8 },
    energyDraw:5, hp:35, price:3500, rarity:'u',
    desc:'Advanced optical targeting system. Unlocks Optical Target Lock — 3-second lock-on sequence that enables guided missile tracking.',
    visual:'targeting_pod',
  },
  // Special
  escape_pod: {
    id:'escape_pod', name:'Escape Pod', slot:'special',
    stats:{ escapePods:+1, mass:+10 },
    energyDraw:1, hp:20, price:500, rarity:'c',
    desc:'Saves one crew on destruction.',
    visual:'escape_pod',
  },
  repair_bay: {
    id:'repair_bay', name:'Repair Bay', slot:'special',
    stats:{ autoRepair:+2, mass:+20 },
    energyDraw:8, hp:50, price:2500, rarity:'u',
    desc:'Slowly auto-repairs hull.',
    visual:'special',
  },
  workshop: {
    id:'workshop', name:'Workshop', slot:'special',
    stats:{ canCraft:true, mass:+25 },
    energyDraw:10, hp:40, price:3000, rarity:'u',
    desc:'Advanced in-flight crafting.',
    visual:'special',
  },
  tractor_beam: {
    id:'tractor_beam', name:'Tractor Beam', slot:'special',
    stats:{ tractorRange:+300, mass:+20 },
    energyDraw:15, hp:40, price:2000, rarity:'u',
    desc:'Pull cargo from wreckage at range.',
    visual:'special',
  },
  // Armor
  hull_armor: {
    id:'hull_armor', name:'Hull Plating', slot:'armor',
    stats:{ maxHull:+60, armor:+5, mass:+50 },
    energyDraw:0, hp:100, price:1200, rarity:'c',
    desc:'Reinforced hull panels.',
    visual:'armor',
  },
  heavy_armor: {
    id:'heavy_armor', name:'Heavy Armor', slot:'armor',
    stats:{ maxHull:+150, armor:+15, mass:+120 },
    energyDraw:0, hp:200, price:4500, rarity:'u',
    desc:'Military-grade armor plating.',
    visual:'armor',
  },

  // Hull panels — outer structural casing around inner modules, required for flight.
  // On the flat-top hex grid every panel is a full hex; the only instance
  // property is `color` (hex string). Auto-placed to wrap the perimeter.
  hull_panel: {
    id:'hull_panel', name:'Hull Panel', slot:'hull',
    stats:{ maxHull:+12, armor:+1, mass:+15 },
    energyDraw:0, hp:80, price:0, rarity:'c',
    desc:'Outer structural hull plating. Required to enclose inner modules for flight.',
    visual:'hull',
  },

  // ── Class Core Modules ────────────────────────────────────
  // One per ship template. Encodes hull stats (maxHull, energy, fuel, cargo, mass, turnBase).
  // Required to fly. Cannot be removed. Not sold in outfitter.
  // shuttle class
  core_shuttle:          { id:'core_shuttle',          name:'Shuttle Core',           slot:'core', class:'shuttle',     stats:{ maxHull:100,  maxEnergy:120, maxFuel:80,  mass:80,  turnBase:2.0  }, energyDraw:0, hp:999, price:0, rarity:'c', desc:'Shuttle-class hull frame. Required to fly.',      visual:'special' },
  core_earth_shuttle:    { id:'core_earth_shuttle',    name:'Courier Core',           slot:'core', class:'shuttle',     stats:{ maxHull:190,  maxEnergy:120, maxFuel:90,  mass:90,  turnBase:2.0  }, energyDraw:0, hp:999, price:0, rarity:'c', desc:'Earth Courier hull frame.',                      visual:'special' },
  core_rebel_runner:     { id:'core_rebel_runner',     name:'Runner Core',            slot:'core', class:'shuttle',     stats:{ maxHull:140,  maxEnergy:130, maxFuel:90,    mass:75,  turnBase:2.4  }, energyDraw:0, hp:999, price:0, rarity:'c', desc:'Rebel Runner hull frame.',                        visual:'special' },
  core_pirate_skiff:     { id:'core_pirate_skiff',     name:'Skiff Core',             slot:'core', class:'shuttle',     stats:{ maxHull:120,  maxEnergy:120, maxFuel:70,    mass:65,  turnBase:2.6  }, energyDraw:0, hp:999, price:0, rarity:'c', desc:'Pirate Skiff hull frame.',                        visual:'special' },
  core_alien_pod:        { id:'core_alien_pod',        name:'Shard Pod Core',         slot:'core', class:'shuttle',     stats:{ maxHull:160,  maxEnergy:200, maxFuel:100,  mass:60,  turnBase:3.0  }, energyDraw:0, hp:999, price:0, rarity:'r', desc:'Alien pod hull frame.',                           visual:'special' },
  // miner class
  core_miner_ship:       { id:'core_miner_ship',       name:'Prospector Core',        slot:'core', class:'miner',       stats:{ maxHull:280,  maxEnergy:130, maxFuel:80,   mass:170, turnBase:1.0  }, energyDraw:0, hp:999, price:0, rarity:'c', desc:'Prospector hull frame.',                          visual:'special' },
  core_earth_miner:      { id:'core_earth_miner',      name:'Surveyor Core',          slot:'core', class:'miner',       stats:{ maxHull:280,  maxEnergy:140, maxFuel:88,   mass:175, turnBase:1.2  }, energyDraw:0, hp:999, price:0, rarity:'c', desc:'Earth Surveyor hull frame.',                      visual:'special' },
  core_rebel_miner:      { id:'core_rebel_miner',      name:'Extractor Core',         slot:'core', class:'miner',       stats:{ maxHull:260,  maxEnergy:135, maxFuel:84,   mass:165, turnBase:1.3  }, energyDraw:0, hp:999, price:0, rarity:'c', desc:'Rebel Extractor hull frame.',                     visual:'special' },
  // container class
  core_container_ship:   { id:'core_container_ship',   name:'Bulk Hauler Core',       slot:'core', class:'container',   stats:{ maxHull:300,  maxEnergy:130, maxFuel:130, mass:320, turnBase:0.7  }, energyDraw:0, hp:999, price:0, rarity:'c', desc:'Bulk Hauler hull frame.',                         visual:'special' },
  core_earth_hauler:     { id:'core_earth_hauler',     name:'Freighter Core',         slot:'core', class:'container',   stats:{ maxHull:380,  maxEnergy:140, maxFuel:138, mass:345, turnBase:0.7  }, energyDraw:0, hp:999, price:0, rarity:'c', desc:'Earth Freighter hull frame.',                     visual:'special' },
  core_rebel_hauler:     { id:'core_rebel_hauler',     name:'Rebel Hauler Core',      slot:'core', class:'container',   stats:{ maxHull:280,  maxEnergy:140, maxFuel:110, mass:200, turnBase:1.3  }, energyDraw:0, hp:999, price:0, rarity:'c', desc:'Rebel Hauler hull frame.',                        visual:'special' },
  // tanker class
  core_tanker_ship:      { id:'core_tanker_ship',      name:'Tanker Core',            slot:'core', class:'tanker',      stats:{ maxHull:260,  maxEnergy:130, maxFuel:400, mass:300, turnBase:0.7  }, energyDraw:0, hp:999, price:0, rarity:'c', desc:'Fuel Tanker hull frame.',                         visual:'special' },
  core_earth_tanker:     { id:'core_earth_tanker',     name:'Earth Tanker Core',      slot:'core', class:'tanker',      stats:{ maxHull:320,  maxEnergy:140, maxFuel:500, mass:320, turnBase:0.7  }, energyDraw:0, hp:999, price:0, rarity:'c', desc:'Earth Tanker hull frame.',                        visual:'special' },
  // fighter class
  core_fighter:          { id:'core_fighter',          name:'Fighter Core',           slot:'core', class:'fighter',     stats:{ maxHull:100,  maxEnergy:150, maxFuel:85,    mass:90,  turnBase:2.6  }, energyDraw:0, hp:999, price:0, rarity:'c', desc:'Fighter hull frame.',                             visual:'special' },
  core_earth_fighter:    { id:'core_earth_fighter',    name:'Interceptor Core',       slot:'core', class:'fighter',     stats:{ maxHull:280,  maxEnergy:170, maxFuel:90,    mass:130, turnBase:2.1  }, energyDraw:0, hp:999, price:0, rarity:'u', desc:'Earth Interceptor hull frame.',                   visual:'special' },
  core_rebel_fighter:    { id:'core_rebel_fighter',    name:'Strike Fighter Core',    slot:'core', class:'fighter',     stats:{ maxHull:220,  maxEnergy:155, maxFuel:88,    mass:110, turnBase:2.6  }, energyDraw:0, hp:999, price:0, rarity:'u', desc:'Rebel Strike Fighter hull frame.',                visual:'special' },
  core_pirate_fighter:   { id:'core_pirate_fighter',   name:'Attack Fighter Core',    slot:'core', class:'fighter',     stats:{ maxHull:200,  maxEnergy:145, maxFuel:80,    mass:100, turnBase:2.7  }, energyDraw:0, hp:999, price:0, rarity:'c', desc:'Pirate Attack Fighter hull frame.',               visual:'special' },
  core_alien_fighter:    { id:'core_alien_fighter',    name:'Shard Strike Core',      slot:'core', class:'fighter',     stats:{ maxHull:260,  maxEnergy:280, maxFuel:110,  mass:90,  turnBase:3.2  }, energyDraw:0, hp:999, price:0, rarity:'e', desc:'Alien Shard Strike hull frame.',                  visual:'special' },
  // cruise_ship class
  core_cruise_liner:     { id:'core_cruise_liner',     name:'Cruise Liner Core',      slot:'core', class:'cruise_ship', stats:{ maxHull:500,  maxEnergy:200, maxFuel:200, mass:450, turnBase:0.5  }, energyDraw:0, hp:999, price:0, rarity:'u', desc:'Cruise Liner hull frame.',                        visual:'special' },
  core_earth_liner:      { id:'core_earth_liner',      name:'Star Liner Core',        slot:'core', class:'cruise_ship', stats:{ maxHull:600,  maxEnergy:220, maxFuel:220, mass:500, turnBase:0.5  }, energyDraw:0, hp:999, price:0, rarity:'u', desc:'Earth Star Liner hull frame.',                    visual:'special' },
  // corvette class
  core_corvette:         { id:'core_corvette',         name:'Corvette Core',          slot:'core', class:'corvette',    stats:{ maxHull:360,  maxEnergy:170, maxFuel:90,   mass:175, turnBase:2.0  }, energyDraw:0, hp:999, price:0, rarity:'u', desc:'Corvette hull frame.',                            visual:'special' },
  core_earth_corvette:   { id:'core_earth_corvette',   name:'Earth Corvette Core',    slot:'core', class:'corvette',    stats:{ maxHull:360,  maxEnergy:185, maxFuel:90,    mass:165, turnBase:2.2  }, energyDraw:0, hp:999, price:0, rarity:'u', desc:'Earth Corvette hull frame.',                      visual:'special' },
  core_rebel_corvette:   { id:'core_rebel_corvette',   name:'Rebel Interceptor Core', slot:'core', class:'corvette',    stats:{ maxHull:320,  maxEnergy:165, maxFuel:85,    mass:155, turnBase:2.5  }, energyDraw:0, hp:999, price:0, rarity:'u', desc:'Rebel Interceptor hull frame.',                   visual:'special' },
  core_pirate_corvette:  { id:'core_pirate_corvette',  name:'Pirate Cutter Core',     slot:'core', class:'corvette',    stats:{ maxHull:280,  maxEnergy:160, maxFuel:80,    mass:145, turnBase:2.7  }, energyDraw:0, hp:999, price:0, rarity:'u', desc:'Pirate Cutter hull frame.',                       visual:'special' },
  // frigate class
  core_frigate:          { id:'core_frigate',          name:'Frigate Core',           slot:'core', class:'frigate',     stats:{ maxHull:500,  maxEnergy:180, maxFuel:100, mass:220, turnBase:1.7  }, energyDraw:0, hp:999, price:0, rarity:'u', desc:'Frigate hull frame.',                             visual:'special' },
  core_earth_patrol:     { id:'core_earth_patrol',     name:'Earth Frigate Core',     slot:'core', class:'frigate',     stats:{ maxHull:520,  maxEnergy:200, maxFuel:100,  mass:195, turnBase:2.0  }, energyDraw:0, hp:999, price:0, rarity:'u', desc:'Earth Frigate hull frame.',                       visual:'special' },
  core_rebel_frigate:    { id:'core_rebel_frigate',    name:'Rebel Frigate Core',     slot:'core', class:'frigate',     stats:{ maxHull:480,  maxEnergy:185, maxFuel:95,    mass:210, turnBase:1.8  }, energyDraw:0, hp:999, price:0, rarity:'u', desc:'Rebel Frigate hull frame.',                       visual:'special' },
  core_pirate_raider:    { id:'core_pirate_raider',    name:'Pirate Raider Core',     slot:'core', class:'frigate',     stats:{ maxHull:420,  maxEnergy:178, maxFuel:88,   mass:195, turnBase:1.9  }, energyDraw:0, hp:999, price:0, rarity:'u', desc:'Pirate Raider hull frame.',                       visual:'special' },
  core_alien_scout:      { id:'core_alien_scout',      name:'Shard Scout Core',       slot:'core', class:'frigate',     stats:{ maxHull:460,  maxEnergy:260, maxFuel:120,  mass:175, turnBase:2.8  }, energyDraw:0, hp:999, price:0, rarity:'r', desc:'Alien Shard Scout hull frame.',                   visual:'special' },
  // bomber class
  core_bomber:           { id:'core_bomber',           name:'Gunship Core',           slot:'core', class:'bomber',      stats:{ maxHull:560,  maxEnergy:190, maxFuel:100,  mass:240, turnBase:1.4  }, energyDraw:0, hp:999, price:0, rarity:'u', desc:'Gunship hull frame.',                             visual:'special' },
  core_earth_bomber:     { id:'core_earth_bomber',     name:'Strike Craft Core',      slot:'core', class:'bomber',      stats:{ maxHull:600,  maxEnergy:200, maxFuel:100,  mass:245, turnBase:1.4  }, energyDraw:0, hp:999, price:0, rarity:'r', desc:'Earth Strike Craft hull frame.',                  visual:'special' },
  core_rebel_bomber:     { id:'core_rebel_bomber',     name:'Rebel Gunship Core',     slot:'core', class:'bomber',      stats:{ maxHull:540,  maxEnergy:195, maxFuel:95,    mass:232, turnBase:1.5  }, energyDraw:0, hp:999, price:0, rarity:'u', desc:'Rebel Gunship hull frame.',                       visual:'special' },
  core_pirate_marauder:  { id:'core_pirate_marauder',  name:'Marauder Core',          slot:'core', class:'bomber',      stats:{ maxHull:500,  maxEnergy:183, maxFuel:90,   mass:228, turnBase:1.5  }, energyDraw:0, hp:999, price:0, rarity:'u', desc:'Pirate Marauder hull frame.',                     visual:'special' },
  // destroyer class
  core_destroyer:        { id:'core_destroyer',        name:'Destroyer Core',         slot:'core', class:'destroyer',   stats:{ maxHull:700,  maxEnergy:210, maxFuel:110, mass:280, turnBase:1.5  }, energyDraw:0, hp:999, price:0, rarity:'r', desc:'Destroyer hull frame.',                           visual:'special' },
  core_earth_destroyer:  { id:'core_earth_destroyer',  name:'Earth Destroyer Core',   slot:'core', class:'destroyer',   stats:{ maxHull:720,  maxEnergy:225, maxFuel:115,  mass:272, turnBase:1.6  }, energyDraw:0, hp:999, price:0, rarity:'r', desc:'Earth Destroyer hull frame.',                     visual:'special' },
  core_rebel_destroyer:  { id:'core_rebel_destroyer',  name:'Rebel Destroyer Core',   slot:'core', class:'destroyer',   stats:{ maxHull:680,  maxEnergy:215, maxFuel:108, mass:268, turnBase:1.6  }, energyDraw:0, hp:999, price:0, rarity:'r', desc:'Rebel Destroyer hull frame.',                     visual:'special' },
  core_pirate_destroyer: { id:'core_pirate_destroyer', name:'Pirate Warship Core',    slot:'core', class:'destroyer',   stats:{ maxHull:650,  maxEnergy:200, maxFuel:105, mass:285, turnBase:1.4  }, energyDraw:0, hp:999, price:0, rarity:'r', desc:'Pirate Warship hull frame.',                      visual:'special' },
  // cruiser class
  core_cruiser:          { id:'core_cruiser',          name:'Cruiser Core',           slot:'core', class:'cruiser',     stats:{ maxHull:1600, maxEnergy:240, maxFuel:120, mass:550, turnBase:0.85 }, energyDraw:0, hp:999, price:0, rarity:'r', desc:'Cruiser hull frame.',                             visual:'special' },
  core_earth_cruiser:    { id:'core_earth_cruiser',    name:'Battlecruiser Core',     slot:'core', class:'cruiser',     stats:{ maxHull:1900, maxEnergy:260, maxFuel:130, mass:595, turnBase:0.85 }, energyDraw:0, hp:999, price:0, rarity:'e', desc:'Earth Battlecruiser hull frame.',                 visual:'special' },
  core_rebel_cruiser:    { id:'core_rebel_cruiser',    name:'Rebel Battleship Core',  slot:'core', class:'cruiser',     stats:{ maxHull:1750, maxEnergy:245, maxFuel:120, mass:565, turnBase:0.8  }, energyDraw:0, hp:999, price:0, rarity:'e', desc:'Rebel Battleship hull frame.',                    visual:'special' },
  core_pirate_battleship:{ id:'core_pirate_battleship',name:'Dreadnaught Core',       slot:'core', class:'cruiser',     stats:{ maxHull:1600, maxEnergy:230, maxFuel:115, mass:575, turnBase:0.75 }, energyDraw:0, hp:999, price:0, rarity:'e', desc:'Pirate Dreadnaught hull frame.',                  visual:'special' },
  core_alien_warship:    { id:'core_alien_warship',    name:'Shard Warship Core',     slot:'core', class:'cruiser',     stats:{ maxHull:2200, maxEnergy:400, maxFuel:150, mass:498, turnBase:1.0  }, energyDraw:0, hp:999, price:0, rarity:'l', desc:'Alien Shard Warship hull frame.',                 visual:'special' },
  // carrier class
  core_carrier:          { id:'core_carrier',          name:'Carrier Core',           slot:'core', class:'carrier',     stats:{ maxHull:2400, maxEnergy:300, maxFuel:200, mass:800, turnBase:0.45 }, energyDraw:0, hp:999, price:0, rarity:'e', desc:'Carrier hull frame.',                             visual:'special' },
  core_earth_carrier:    { id:'core_earth_carrier',    name:'Supercarrier Core',      slot:'core', class:'carrier',     stats:{ maxHull:2800, maxEnergy:340, maxFuel:220, mass:845, turnBase:0.45 }, energyDraw:0, hp:999, price:0, rarity:'e', desc:'Earth Supercarrier hull frame.',                  visual:'special' },
  core_rebel_carrier:    { id:'core_rebel_carrier',    name:'Dreadnought Core',       slot:'core', class:'carrier',     stats:{ maxHull:2600, maxEnergy:310, maxFuel:200, mass:818, turnBase:0.45 }, energyDraw:0, hp:999, price:0, rarity:'e', desc:'Rebel Dreadnought hull frame.',                   visual:'special' },
};

// ── Ship Templates ────────────────────────────────────────
// Ship classes and their rep requirements for faction variants
G.SHIP_CLASSES = {
  shuttle:    { label:'SHUTTLE',          repRequired:  0 },
  miner:      { label:'MINING VESSEL',    repRequired: 10 },
  container:  { label:'CONTAINER SHIP',   repRequired: 10 },
  tanker:     { label:'FUEL TANKER',      repRequired: 10 },
  fighter:    { label:'FIGHTER',          repRequired: 15 },
  cruise_ship:{ label:'CRUISE LINER',     repRequired: 20 },
  corvette:   { label:'CORVETTE',         repRequired: 25 },
  frigate:    { label:'FRIGATE',          repRequired: 35 },
  bomber:     { label:'GUNSHIP / BOMBER', repRequired: 40 },
  destroyer:  { label:'DESTROYER',        repRequired: 50 },
  cruiser:    { label:'CRUISER',          repRequired: 60 },
  carrier:    { label:'CARRIER',          repRequired: 70 },
};

G.SHIPS = {
  // ── SHUTTLE ───────────────────────────────────────────────
  shuttle: {
    id:'shuttle', name:'Shuttle', class:'shuttle', faction:'neutral',
    desc:'Reliable transport with shields. Low hull but shields absorb punishment. Medium cargo capacity.',
    price:0,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:14000, baseTurn:0, baseCargoSpace:0,
    slots:11,
    startModules:['core_shuttle',{id:'thruster',rot:0},{id:'thruster',rot:0},'reactor','jump_drive','small_cargo','light_shield','escape_pod'],
    startWeapons:['turret'],
    shape:'shuttle', color:'#8899bb', size:1.0,
    stats:'HULL:100  SHIELDS:80  CARGO:8',
  },
  earth_shuttle: {
    id:'earth_shuttle', name:'Earth Courier', class:'shuttle', faction:'earth', repRequired:0,
    desc:'Official Earth Government light transport. Reliable and authoritative.',
    price:4000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:14000, baseTurn:0, baseCargoSpace:0,
    slots:12,
    startModules:['core_earth_shuttle',{id:'thruster',rot:0},{id:'thruster',rot:0},'reactor','jump_drive','small_cargo','small_cargo','basic_sensors','escape_pod'],
    startWeapons:['turret'],
    shape:'earth_shuttle', color:'#4488ff', size:1.1,
    stats:'HULL:190  CARGO:10  GOV',
  },
  rebel_runner: {
    id:'rebel_runner', name:'Rebel Runner', class:'shuttle', faction:'rebellion', repRequired:0,
    desc:'Fast rebel supply runner. Modded for speed and evasion.',
    price:3500,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:17000, baseTurn:0, baseCargoSpace:0,
    slots:11,
    startModules:['core_rebel_runner',{id:'thruster_imp',rot:0},{id:'thruster_imp',rot:0},'reactor','jump_drive','small_cargo','fuel_tank','escape_pod'],
    startWeapons:['turret'],
    shape:'rebel_fighter', color:'#ff6600', size:0.85,
    stats:'HULL:140  CARGO:8  FAST',
  },
  pirate_skiff: {
    id:'pirate_skiff', name:'Pirate Skiff', class:'shuttle', faction:'pirate', repRequired:0,
    desc:'Stripped-down scout. Cheap, expendable, surprisingly dangerous.',
    price:3000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:18000, baseTurn:0, baseCargoSpace:0,
    slots:10,
    startModules:['core_pirate_skiff',{id:'thruster_imp',rot:0},{id:'thruster_imp',rot:0},'reactor','jump_drive','small_cargo','escape_pod'],
    startWeapons:['turret'],
    shape:'pirate_fighter', color:'#cc3322', size:0.85,
    stats:'HULL:120  FAST  SCRAPPY',
  },
  alien_pod: {
    id:'alien_pod', name:'Shard Pod', class:'shuttle', faction:'alien', repRequired:50,
    desc:'Small alien shuttle. Alien tech gives it uncanny speed.',
    price:18000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:22000, baseTurn:0, baseCargoSpace:0,
    slots:11,
    startModules:['core_alien_pod',{id:'thruster_imp',rot:0},{id:'thruster_imp',rot:0},'reactor','jump_drive','small_cargo','escape_pod'],
    startWeapons:['turret'],
    shape:'alien_fighter', color:'#00ff88', size:0.85,
    stats:'HULL:160  ALIEN TECH  FAST',
  },

  // ── MINING VESSEL ─────────────────────────────────────────
  miner_ship: {
    id:'miner_ship', name:'Prospector', class:'miner', faction:'neutral',
    desc:'Toughest hull of the starter ships with massive cargo. Built for mining, not fighting. Very slow.',
    price:7000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:8000, baseTurn:0, baseCargoSpace:0,
    slots:14,
    startModules:['core_miner_ship',{id:'thruster',rot:0},{id:'thruster',rot:0},'reactor','jump_drive','basic_sensors','medium_cargo','medium_cargo','escape_pod'],
    startWeapons:['mining_laser_wpn','turret','turret'],
    shape:'miner', color:'#aa9966', size:1.4,
    stats:'HULL:280  CARGO:20  MINER',
  },
  earth_miner: {
    id:'earth_miner', name:'Earth Surveyor', class:'miner', faction:'earth', repRequired:10,
    desc:'Earth Gov certified mining ship. Enhanced sensors and armored hull.',
    price:12000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:9500, baseTurn:0, baseCargoSpace:0,
    slots:15,
    startModules:['core_earth_miner',{id:'thruster',rot:0},{id:'thruster',rot:0},'reactor','jump_drive','medium_cargo','medium_cargo','basic_sensors','escape_pod'],
    startWeapons:['laser_cannon','mining_laser_wpn','turret','turret','turret','turret'],
    shape:'earth_shuttle', color:'#4477cc', size:1.3,
    stats:'HULL:280  CARGO:24  SURVEY',
  },
  rebel_miner: {
    id:'rebel_miner', name:'Rebel Extractor', class:'miner', faction:'rebellion', repRequired:10,
    desc:'Rebel-converted miner. Armed for hostile territory operations.',
    price:11000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:10000, baseTurn:0, baseCargoSpace:0,
    slots:14,
    startModules:['core_rebel_miner',{id:'thruster',rot:0},{id:'thruster',rot:0},'reactor','jump_drive','medium_cargo','medium_cargo','escape_pod'],
    startWeapons:['autocannon','mining_laser_wpn','turret','turret','turret','turret'],
    shape:'rebel_hauler', color:'#cc5500', size:1.3,
    stats:'HULL:260  CARGO:22  ARMED',
  },

  // ── CONTAINER SHIP ────────────────────────────────────────
  container_ship: {
    id:'container_ship', name:'Bulk Hauler', class:'container', faction:'neutral',
    desc:'Maximum cargo at minimum cost. Civilian bulk container.',
    price:20000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:6500, baseTurn:0, baseCargoSpace:0,
    slots:16,
    startModules:['core_container_ship',{id:'thruster',rot:0},{id:'thruster',rot:0},'reactor','jump_drive','large_cargo','large_cargo','large_cargo','escape_pod'],
    startWeapons:['autocannon','turret','turret','turret','turret'],
    shape:'freighter', color:'#778855', size:2.5,
    stats:'HULL:300  CARGO:50  SLOW',
  },
  earth_hauler: {
    id:'earth_hauler', name:'Earth Freighter', class:'container', faction:'earth', repRequired:10,
    desc:'Earth Gov certified heavy hauler with armored cargo bays.',
    price:28000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:7000, baseTurn:0, baseCargoSpace:0,
    slots:18,
    startModules:['core_earth_hauler',{id:'thruster',rot:0},{id:'thruster',rot:0},'reactor','jump_drive','large_cargo','large_cargo','large_cargo','hull_armor','escape_pod'],
    startWeapons:['autocannon','turret','turret','turret','turret'],
    shape:'freighter', color:'#3366aa', size:2.6,
    stats:'HULL:380  CARGO:55  ARMORED',
  },
  rebel_hauler: {
    id:'rebel_hauler', name:'Rebel Hauler', class:'container', faction:'rebellion', repRequired:10,
    desc:'Armed rebel supply ship. Runs supplies and fighters for the cause.',
    price:22000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:11000, baseTurn:0, baseCargoSpace:0,
    slots:17,
    startModules:['core_rebel_hauler',{id:'thruster',rot:0},{id:'thruster',rot:0},'reactor','jump_drive','medium_cargo','medium_cargo','medium_cargo','fuel_tank','escape_pod'],
    startWeapons:['laser_cannon','autocannon','turret','turret','turret','turret'],
    shape:'rebel_hauler', color:'#ff6600', size:1.6,
    stats:'HULL:280  CARGO:28  ARMED',
  },

  // ── FUEL TANKER ───────────────────────────────────────────
  tanker_ship: {
    id:'tanker_ship', name:'Fuel Tanker', class:'tanker', faction:'neutral',
    desc:'Dedicated fuel carrier. Enormous fuel capacity for long hauls.',
    price:18000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:6000, baseTurn:0, baseCargoSpace:0,
    slots:15,
    startModules:['core_tanker_ship',{id:'thruster',rot:0},{id:'thruster',rot:0},'reactor','jump_drive','fuel_tank','fuel_tank','large_cargo','escape_pod'],
    startWeapons:['autocannon','turret','turret','turret','turret'],
    shape:'tanker', color:'#886644', size:2.4,
    stats:'HULL:260  FUEL:400  HAULER',
  },
  earth_tanker: {
    id:'earth_tanker', name:'Earth Tanker', class:'tanker', faction:'earth', repRequired:10,
    desc:'Military-grade fuel logistics ship. Reinforced tanks and armored hull.',
    price:26000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:6500, baseTurn:0, baseCargoSpace:0,
    slots:16,
    startModules:['core_earth_tanker',{id:'thruster',rot:0},{id:'thruster',rot:0},'reactor','jump_drive','fuel_tank','fuel_tank','fuel_tank','hull_armor','escape_pod'],
    startWeapons:['autocannon','turret','turret','turret','turret'],
    shape:'tanker', color:'#335599', size:2.5,
    stats:'HULL:320  FUEL:500  GOV',
  },

  // ── FIGHTER ───────────────────────────────────────────────
  fighter: {
    id:'fighter', name:'Fighter', class:'fighter', faction:'neutral',
    desc:'Glass cannon interceptor. Fastest ship with missiles, but no shields and minimal cargo. Every hit hurts.',
    price:14000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:22000, baseTurn:0, baseCargoSpace:0,
    slots:14,
    startModules:['core_fighter',{id:'thruster_imp',rot:0},{id:'thruster_imp',rot:0},'reactor','targeting_pod'],
    startWeapons:['missile_launcher','autocannon'],

    shape:'fighter', color:'#8899cc', size:1.0,
    stats:'HULL:100  CARGO:2  MISSILES  FAST',
  },
  earth_fighter: {
    id:'earth_fighter', name:'Earth Interceptor', class:'fighter', faction:'earth', repRequired:15,
    desc:'Earth Gov interceptor. Heavy lasers and reinforced shields.',
    price:20000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:21000, baseTurn:0, baseCargoSpace:0,
    slots:15,
    startModules:['core_earth_fighter',{id:'thruster_imp',rot:0},{id:'thruster_imp',rot:0},'reactor','light_shield'],
    startWeapons:['heavy_laser','laser_cannon'],
    shape:'fighter', color:'#4488ff', size:1.0,
    stats:'HULL:280  SHIELDS  GUNS:2',
  },
  rebel_fighter: {
    id:'rebel_fighter', name:'Rebel Strike Fighter', class:'fighter', faction:'rebellion', repRequired:15,
    desc:'Rebellion strike fighter. Brutally fast, loaded with kinetics.',
    price:17000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:23000, baseTurn:0, baseCargoSpace:0,
    slots:13,
    startModules:['core_rebel_fighter',{id:'thruster_imp',rot:0},{id:'thruster_imp',rot:0},'reactor'],
    startWeapons:['laser_cannon','autocannon','autocannon'],
    shape:'fighter', color:'#ff6600', size:0.95,
    stats:'HULL:220  FASTEST  GUNS:3',
  },
  pirate_fighter: {
    id:'pirate_fighter', name:'Pirate Attack Fighter', class:'fighter', faction:'pirate', repRequired:15,
    desc:'Stripped-down attack fighter. Maximizes firepower at any cost.',
    price:13000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:22000, baseTurn:0, baseCargoSpace:0,
    slots:13,
    startModules:['core_pirate_fighter',{id:'thruster_imp',rot:0},{id:'thruster_imp',rot:0},'reactor'],
    startWeapons:['autocannon','autocannon','autocannon'],
    shape:'fighter', color:'#cc3322', size:0.9,
    stats:'HULL:200  GUNS:3  SCRAPPY',
  },
  alien_fighter: {
    id:'alien_fighter', name:'Shard Strike', class:'fighter', faction:'alien', repRequired:60,
    desc:'Alien shard strike craft. Exotic energy weapons and impossible agility.',
    price:55000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:28000, baseTurn:0, baseCargoSpace:0,
    slots:13,
    startModules:['core_alien_fighter',{id:'thruster_imp',rot:0},{id:'thruster_imp',rot:0},'reactor','light_shield'],
    startWeapons:['laser_cannon','laser_cannon'],
    shape:'fighter', color:'#00ff88', size:0.9,
    stats:'HULL:260  ALIEN  FASTEST',
  },

  // ── CRUISE LINER ──────────────────────────────────────────
  cruise_liner: {
    id:'cruise_liner', name:'Cruise Liner', class:'cruise_ship', faction:'neutral',
    desc:'Luxury passenger liner. Palatial quarters, not built for war.',
    price:45000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:5500, baseTurn:0, baseCargoSpace:0,
    slots:22,
    startModules:['core_cruise_liner',{id:'thruster',rot:0},{id:'thruster',rot:0},'reactor','jump_drive','large_cargo','officer_block','officer_block','escape_pod'],
    startWeapons:['autocannon','turret','turret','turret','turret'],
    shape:'carrier', color:'#ccbbaa', size:3.2,
    stats:'HULL:500  CREW  LUXURY',
  },
  earth_liner: {
    id:'earth_liner', name:'Earth Star Liner', class:'cruise_ship', faction:'earth', repRequired:20,
    desc:'Elite Earth Gov passenger vessel. Shielded against piracy.',
    price:65000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:6000, baseTurn:0, baseCargoSpace:0,
    slots:24,
    startModules:['core_earth_liner',{id:'thruster',rot:0},{id:'thruster',rot:0},'reactor','jump_drive','large_cargo','officer_block','officer_block','medium_shield','escape_pod'],
    startWeapons:['autocannon','turret','turret','turret','turret'],
    shape:'carrier', color:'#4488ff', size:3.4,
    stats:'HULL:600  CREW  SHIELDED',
  },

  // ── CORVETTE ──────────────────────────────────────────────
  corvette: {
    id:'corvette', name:'Corvette', class:'corvette', faction:'neutral',
    desc:'Well-balanced light warship. Fast and versatile.',
    price:18000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:19000, baseTurn:0, baseCargoSpace:0,
    slots:18,
    startModules:['core_corvette',{id:'thruster_imp',rot:0},{id:'thruster_imp',rot:0},'reactor','light_shield','jump_drive','medium_cargo','escape_pod','targeting_pod'],
    startWeapons:['laser_cannon','autocannon','missile_launcher','turret','turret','turret','turret'],
    shape:'corvette', color:'#7799cc', size:1.8,
    stats:'HULL:360  GUNS:2  BALANCED',
  },
  earth_corvette: {
    id:'earth_corvette', name:'Earth Corvette', class:'corvette', faction:'earth', repRequired:25,
    desc:'Standard Earth patrol corvette. Upgraded shields and twin laser mounts.',
    price:24000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:22000, baseTurn:0, baseCargoSpace:0,
    slots:19,
    startModules:['core_earth_corvette',{id:'thruster_imp',rot:0},{id:'thruster_imp',rot:0},'reactor','light_shield','jump_drive','escape_pod','targeting_pod'],
    startWeapons:['laser_cannon','laser_cannon','autocannon','missile_launcher','turret','turret','turret','turret'],
    shape:'earth_patrol', color:'#4488ff', size:1.0,
    stats:'HULL:360  SHIELDS  PATROL',
  },
  rebel_corvette: {
    id:'rebel_corvette', name:'Rebel Interceptor', class:'corvette', faction:'rebellion', repRequired:25,
    desc:'Hit-and-run rebel interceptor. Fast with hard-hitting kinetics.',
    price:20000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:23000, baseTurn:0, baseCargoSpace:0,
    slots:18,
    startModules:['core_rebel_corvette',{id:'thruster_imp',rot:0},{id:'thruster_imp',rot:0},'reactor','light_shield','jump_drive','escape_pod','targeting_pod'],
    startWeapons:['laser_cannon','autocannon','autocannon','missile_launcher','turret','turret','turret','turret'],
    shape:'rebel_fighter', color:'#ff6600', size:0.9,
    stats:'HULL:320  FAST  GUNS',
  },
  pirate_corvette: {
    id:'pirate_corvette', name:'Pirate Cutter', class:'corvette', faction:'pirate', repRequired:25,
    desc:'Converted racing hull. Terrifying speed, minimal armor.',
    price:16000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:25000, baseTurn:0, baseCargoSpace:0,
    slots:16,
    startModules:['core_pirate_corvette',{id:'thruster_imp',rot:0},{id:'thruster_imp',rot:0},'reactor','jump_drive','escape_pod','targeting_pod'],
    startWeapons:['laser_cannon','autocannon','autocannon','missile_launcher','turret','turret','turret','turret'],
    shape:'pirate_fighter', color:'#cc3322', size:0.95,
    stats:'HULL:280  FASTEST  GUNS',
  },

  // ── FRIGATE ───────────────────────────────────────────────
  frigate: {
    id:'frigate', name:'Frigate', class:'frigate', faction:'neutral',
    desc:'Medium warship with solid firepower and good armor.',
    price:32000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:16000, baseTurn:0, baseCargoSpace:0,
    slots:20,
    startModules:['core_frigate',{id:'thruster_imp',rot:0},{id:'thruster_imp',rot:0},'reactor','medium_shield','jump_drive','medium_cargo','escape_pod','targeting_pod','crew_quarters'],
    startWeapons:['heavy_laser','autocannon','autocannon','missile_launcher','turret','turret','turret','turret','turret'],
    shape:'frigate', color:'#8899cc', size:1.0,
    stats:'HULL:500  SHIELDS  GUNS',
  },
  earth_patrol: {
    id:'earth_patrol', name:'Earth Frigate', class:'frigate', faction:'earth', repRequired:35,
    desc:'Fast Earth Gov patrol frigate. Clean delta wings, lethal at range.',
    price:42000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:20000, baseTurn:0, baseCargoSpace:0,
    slots:21,
    startModules:['core_earth_patrol',{id:'thruster_imp',rot:0},{id:'thruster_imp',rot:0},'reactor','medium_shield','jump_drive','escape_pod','targeting_pod','crew_quarters'],
    startWeapons:['heavy_laser','laser_cannon','autocannon','missile_launcher','turret','turret','turret','turret','turret'],
    shape:'frigate', color:'#4488ff', size:1.0,
    stats:'HULL:520  SHIELDS  FAST',
  },
  rebel_frigate: {
    id:'rebel_frigate', name:'Rebel Frigate', class:'frigate', faction:'rebellion', repRequired:35,
    desc:'Rebellion frontline frigate. Bristling with weaponry.',
    price:38000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:17000, baseTurn:0, baseCargoSpace:0,
    slots:20,
    startModules:['core_rebel_frigate',{id:'thruster_imp',rot:0},{id:'thruster_imp',rot:0},'reactor','medium_shield','jump_drive','escape_pod','targeting_pod','crew_quarters'],
    startWeapons:['heavy_laser','autocannon','autocannon','missile_launcher','turret','turret','turret','turret','turret'],
    shape:'frigate', color:'#ff6600', size:1.0,
    stats:'HULL:480  GUNS  REBEL',
  },
  pirate_raider: {
    id:'pirate_raider', name:'Pirate Raider', class:'frigate', faction:'pirate', repRequired:35,
    desc:'Heavy raider. Sacrifices defense for maximum offensive punch.',
    price:30000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:18000, baseTurn:0, baseCargoSpace:0,
    slots:19,
    startModules:['core_pirate_raider',{id:'thruster_imp',rot:0},{id:'thruster_imp',rot:0},'reactor','light_shield','jump_drive','medium_cargo','escape_pod','targeting_pod','crew_quarters'],
    startWeapons:['autocannon','autocannon','autocannon','missile_launcher','turret','turret','turret','turret','turret'],
    shape:'frigate', color:'#cc2200', size:1.0,
    stats:'HULL:420  CARGO:12  GUNS',
  },
  alien_scout: {
    id:'alien_scout', name:'Shard Scout', class:'frigate', faction:'alien', repRequired:55,
    desc:'Alien shard-class recon vessel. Physics-bending speed.',
    price:65000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:26000, baseTurn:0, baseCargoSpace:0,
    slots:19,
    startModules:['core_alien_scout',{id:'thruster_imp',rot:0},{id:'thruster_imp',rot:0},'reactor','light_shield','jump_drive','escape_pod','targeting_pod','crew_quarters'],
    startWeapons:['laser_cannon','laser_cannon','missile_launcher','turret','turret','turret','turret','turret'],
    shape:'frigate', color:'#00ff88', size:1.0,
    stats:'HULL:460  ALIEN  FAST',
  },

  // ── GUNSHIP / BOMBER ─────────────────────────────────────
  bomber: {
    id:'bomber', name:'Gunship', class:'bomber', faction:'neutral',
    desc:'Heavy weapons platform. Trades mobility for firepower.',
    price:40000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:14000, baseTurn:0, baseCargoSpace:0,
    slots:21,
    startModules:['core_bomber',{id:'thruster',rot:0},{id:'thruster',rot:0},'reactor','medium_shield','jump_drive','crew_quarters','hull_armor','escape_pod','targeting_pod'],
    startWeapons:['heavy_laser','autocannon','autocannon','autocannon','missile_launcher','turret','turret','turret','turret','turret','turret'],
    shape:'gunboat', color:'#8877aa', size:1.8,
    stats:'HULL:560  GUNS:4  SLOW',
  },
  earth_bomber: {
    id:'earth_bomber', name:'Earth Strike Craft', class:'bomber', faction:'earth', repRequired:40,
    desc:'Earth military strike craft. Hardened shields and long-range cannons.',
    price:52000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:14500, baseTurn:0, baseCargoSpace:0,
    slots:22,
    startModules:['core_earth_bomber',{id:'thruster',rot:0},{id:'thruster',rot:0},'reactor','medium_shield','jump_drive','heavy_armor','escape_pod','targeting_pod','crew_quarters'],
    startWeapons:['heavy_laser','heavy_laser','autocannon','missile_launcher','turret','turret','turret','turret','turret','turret'],
    shape:'gunboat', color:'#336699', size:1.8,
    stats:'HULL:600  ARMOR  STRIKE',
  },
  rebel_bomber: {
    id:'rebel_bomber', name:'Rebel Gunship', class:'bomber', faction:'rebellion', repRequired:40,
    desc:'Rebellion siege vessel. Overloaded with weapons, minimal defenses.',
    price:46000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:13500, baseTurn:0, baseCargoSpace:0,
    slots:21,
    startModules:['core_rebel_bomber',{id:'thruster',rot:0},{id:'thruster',rot:0},'reactor','medium_shield','jump_drive','escape_pod','targeting_pod','crew_quarters'],
    startWeapons:['heavy_laser','autocannon','autocannon','missile_launcher','turret','turret','turret','turret','turret','turret'],
    shape:'gunboat', color:'#ff6600', size:1.7,
    stats:'HULL:540  MISSILES  GUNS',
  },
  pirate_marauder: {
    id:'pirate_marauder', name:'Pirate Marauder', class:'bomber', faction:'pirate', repRequired:40,
    desc:'Pirate heavy raider. Boarding equipment and overwhelming close-range firepower.',
    price:38000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:13000, baseTurn:0, baseCargoSpace:0,
    slots:20,
    startModules:['core_pirate_marauder',{id:'thruster',rot:0},{id:'thruster',rot:0},'reactor','light_shield','jump_drive','medium_cargo','escape_pod','targeting_pod','crew_quarters'],
    startWeapons:['autocannon','autocannon','autocannon','autocannon','missile_launcher','turret','turret','turret','turret','turret','turret'],
    shape:'gunboat', color:'#bb2200', size:1.8,
    stats:'HULL:500  CARGO:14  GUNS',
  },

  // ── DESTROYER ─────────────────────────────────────────────
  destroyer: {
    id:'destroyer', name:'Destroyer', class:'destroyer', faction:'neutral',
    desc:'Fleet escort destroyer. Balanced weapons and strong shields.',
    price:55000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:15000, baseTurn:0, baseCargoSpace:0,
    slots:23,
    startModules:['core_destroyer',{id:'thruster_imp',rot:0},{id:'thruster_imp',rot:0},'reactor','medium_shield','medium_shield','jump_drive','hull_armor','escape_pod','targeting_pod','crew_quarters','crew_quarters'],
    startWeapons:['heavy_laser','heavy_laser','autocannon','missile_launcher','turret','turret','turret','turret','turret','turret'],
    shape:'corvette', color:'#6688aa', size:2.0,
    stats:'HULL:700  SHIELDS  ESCORT',
  },
  earth_destroyer: {
    id:'earth_destroyer', name:'Earth Destroyer', class:'destroyer', faction:'earth', repRequired:50,
    desc:'Earth Navy destroyer. Cutting-edge shields and precision targeting.',
    price:68000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:16000, baseTurn:0, baseCargoSpace:0,
    slots:24,
    startModules:['core_earth_destroyer',{id:'thruster_imp',rot:0},{id:'thruster_imp',rot:0},'reactor','medium_shield','medium_shield','jump_drive','military_sensors','escape_pod','targeting_pod','crew_quarters','crew_quarters'],
    startWeapons:['heavy_laser','heavy_laser','autocannon','missile_launcher','turret','turret','turret','turret','turret','turret'],
    shape:'corvette', color:'#4488ff', size:2.0,
    stats:'HULL:720  SHIELDS  NAVY',
  },
  rebel_destroyer: {
    id:'rebel_destroyer', name:'Rebel Destroyer', class:'destroyer', faction:'rebellion', repRequired:50,
    desc:'Rebellion warship. Raw destructive power over refinement.',
    price:60000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:15500, baseTurn:0, baseCargoSpace:0,
    slots:23,
    startModules:['core_rebel_destroyer',{id:'thruster_imp',rot:0},{id:'thruster_imp',rot:0},'reactor','medium_shield','medium_shield','jump_drive','escape_pod','targeting_pod','crew_quarters','crew_quarters'],
    startWeapons:['heavy_laser','heavy_laser','railgun','autocannon','missile_launcher','turret','turret','turret','turret','turret','turret'],
    shape:'corvette', color:'#ff6600', size:2.0,
    stats:'HULL:680  RAILGUN  REBEL',
  },
  pirate_destroyer: {
    id:'pirate_destroyer', name:'Pirate Warship', class:'destroyer', faction:'pirate', repRequired:50,
    desc:'Stripped captured warship. No niceties, full of guns.',
    price:52000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:14000, baseTurn:0, baseCargoSpace:0,
    slots:22,
    startModules:['core_pirate_destroyer',{id:'thruster_imp',rot:0},{id:'thruster_imp',rot:0},'reactor','medium_shield','jump_drive','medium_cargo','escape_pod','targeting_pod','crew_quarters','crew_quarters'],
    startWeapons:['heavy_laser','autocannon','autocannon','missile_launcher','turret','turret','turret','turret','turret','turret'],
    shape:'gunboat', color:'#993311', size:2.0,
    stats:'HULL:650  CARGO:12  GUNS',
  },

  // ── CRUISER ───────────────────────────────────────────────
  cruiser: {
    id:'cruiser', name:'Cruiser', class:'cruiser', faction:'neutral',
    desc:'Armored warship with overwhelming firepower.',
    price:80000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:9000, baseTurn:0, baseCargoSpace:0,
    slots:27,
    startModules:['core_cruiser',{id:'thruster_mil',rot:0},{id:'thruster_mil',rot:0},'military_reactor','heavy_shield','jump_drive','heavy_armor','escape_pod','targeting_pod','officer_block'],
    startWeapons:['heavy_laser','heavy_laser','railgun','missile_launcher','turret','turret','turret','turret','turret','turret','turret','turret'],
    shape:'battlecruiser', color:'#5577aa', size:3.3,
    stats:'HULL:1600  FORTRESS  GUNS',
  },
  earth_cruiser: {
    id:'earth_cruiser', name:'Earth Battlecruiser', class:'cruiser', faction:'earth', repRequired:60,
    desc:'Earth Navy capital ship. Near-indestructible, bristling with weapons.',
    price:100000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:9500, baseTurn:0, baseCargoSpace:0,
    slots:29,
    startModules:['core_earth_cruiser',{id:'thruster_mil',rot:0},{id:'thruster_mil',rot:0},'military_reactor','heavy_shield','heavy_shield','jump_drive','heavy_armor','escape_pod','targeting_pod','officer_block'],
    startWeapons:['heavy_laser','heavy_laser','railgun','missile_launcher','turret','turret','turret','turret','turret','turret','turret','turret'],
    shape:'battlecruiser', color:'#336699', size:3.5,
    stats:'HULL:1900  SHIELDS  NAVY',
  },
  rebel_cruiser: {
    id:'rebel_cruiser', name:'Rebel Battleship', class:'cruiser', faction:'rebellion', repRequired:60,
    desc:'Rebellion siege vessel. Lacks elegance; makes up for it in devastation.',
    price:90000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:8500, baseTurn:0, baseCargoSpace:0,
    slots:28,
    startModules:['core_rebel_cruiser',{id:'thruster_mil',rot:0},{id:'thruster_mil',rot:0},'military_reactor','heavy_shield','jump_drive','heavy_armor','escape_pod','targeting_pod','officer_block'],
    startWeapons:['heavy_laser','railgun','railgun','missile_launcher','turret','turret','turret','turret','turret','turret','turret','turret'],
    shape:'battlecruiser', color:'#ff6600', size:3.4,
    stats:'HULL:1750  RAILGUNS  REBEL',
  },
  pirate_battleship: {
    id:'pirate_battleship', name:'Pirate Dreadnaught', class:'cruiser', faction:'pirate', repRequired:60,
    desc:'Assembled from salvaged hulls. Hideous but terrifying.',
    price:78000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:8000, baseTurn:0, baseCargoSpace:0,
    slots:26,
    startModules:['core_pirate_battleship',{id:'thruster_mil',rot:0},{id:'thruster_mil',rot:0},'reactor','heavy_shield','jump_drive','heavy_armor','escape_pod','targeting_pod','officer_block'],
    startWeapons:['heavy_laser','autocannon','autocannon','missile_launcher','turret','turret','turret','turret','turret','turret','turret','turret'],
    shape:'battlecruiser', color:'#882200', size:3.4,
    stats:'HULL:1600  CARGO:18  SAVAGE',
  },
  alien_warship: {
    id:'alien_warship', name:'Shard Warship', class:'cruiser', faction:'alien', repRequired:75,
    desc:'Alien capital vessel. Physics-bending technology makes it lethal.',
    price:180000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:12000, baseTurn:0, baseCargoSpace:0,
    slots:29,
    startModules:['core_alien_warship',{id:'thruster_mil',rot:0},{id:'thruster_mil',rot:0},'military_reactor','heavy_shield','heavy_shield','jump_drive','escape_pod','targeting_pod','officer_block'],
    startWeapons:['heavy_laser','heavy_laser','laser_cannon','missile_launcher','turret','turret','turret','turret','turret','turret','turret','turret'],
    shape:'alien_cruiser', color:'#00ff88', size:3.5,
    stats:'HULL:2200  ALIEN TECH  FAST',
  },

  // ── CARRIER ───────────────────────────────────────────────
  carrier: {
    id:'carrier', name:'Carrier', class:'carrier', faction:'neutral',
    desc:'Massive fleet carrier. Near-immobile fortress of guns and crew.',
    price:100000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:6000, baseTurn:0, baseCargoSpace:0,
    slots:31,
    startModules:['core_carrier',{id:'thruster_mil',rot:0},{id:'thruster_mil',rot:0},'military_reactor','heavy_shield','jump_drive','officer_block','officer_block','heavy_armor','heavy_armor','escape_pod','targeting_pod'],
    startWeapons:['railgun','missile_launcher','turret','turret','turret','turret','turret','turret','turret','turret','turret','turret'],
    shape:'carrier', color:'#996633', size:4.2,
    stats:'HULL:2400  DRONES  FORTRESS',
  },
  earth_carrier: {
    id:'earth_carrier', name:'Earth Supercarrier', class:'carrier', faction:'earth', repRequired:70,
    desc:'Earth Navy supercarrier. The most feared ship in the known galaxy.',
    price:130000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:6200, baseTurn:0, baseCargoSpace:0,
    slots:33,
    startModules:['core_earth_carrier',{id:'thruster_mil',rot:0},{id:'thruster_mil',rot:0},'military_reactor','heavy_shield','heavy_shield','jump_drive','officer_block','officer_block','military_sensors','heavy_armor','heavy_armor','escape_pod','targeting_pod'],
    startWeapons:['railgun','railgun','missile_launcher','turret','turret','turret','turret','turret','turret','turret','turret','turret','turret'],
    shape:'carrier', color:'#4488ff', size:4.5,
    stats:'HULL:2800  DRONES  NAVY',
  },
  rebel_carrier: {
    id:'rebel_carrier', name:'Rebel Dreadnought', class:'carrier', faction:'rebellion', repRequired:70,
    desc:'The Rebellion\'s ultimate warship. Scarred from a hundred battles.',
    price:115000,
    baseMass:0, baseHull:0, baseEnergy:0, baseFuel:0,
    baseThrust:6000, baseTurn:0, baseCargoSpace:0,
    slots:32,
    startModules:['core_rebel_carrier',{id:'thruster_mil',rot:0},{id:'thruster_mil',rot:0},'military_reactor','heavy_shield','jump_drive','officer_block','officer_block','heavy_armor','escape_pod','targeting_pod'],
    startWeapons:['railgun','railgun','missile_launcher','turret','turret','turret','turret','turret','turret','turret','turret','turret','turret'],
    shape:'dreadnought', color:'#ff6600', size:4.5,
    stats:'HULL:2600  DRONES  REBEL',
  },
};

// Normalize ship propulsion: strip any side/retro thrusters and give every
// ship 2–8 rear-facing (rot:0) thrusters scaled by hull size. Preserves each
// ship's original thruster module type. Runs once at load (MODULES already defined).
(function(){
  const countFor = (size) => Math.max(2, Math.min(8, Math.round(2 + ((size||1) - 0.85) * 1.64)));
  for(const id in G.SHIPS){
    const s = G.SHIPS[id];
    if(!Array.isArray(s.startModules)) continue;
    let thrId = 'thruster';
    const rest = [];
    for(const m of s.startModules){
      const mid = typeof m === 'string' ? m : m.id;
      if(G.MODULES[mid]?.slot === 'thruster'){ thrId = mid; continue; }
      rest.push(m);
    }
    const thrusters = [];
    for(let i=0, n=countFor(s.size); i<n; i++) thrusters.push({ id: thrId, rot: 0 });
    // core stays first, thrusters next, remaining modules after
    s.startModules = rest.length ? [rest[0], ...thrusters, ...rest.slice(1)] : thrusters;
  }
})();

// Every ship that ships with a missile weapon also needs an optical Targeting
// Pod, so its missiles can lock on (player: enables the Optical Target Lock
// ability via canOpticalLock; AI: lock-on logic). Runs once at load.
(function(){
  const modId = (m) => typeof m === 'string' ? m : m.id;
  const hasMissile = (arr) => (arr || []).some(w => G.WEAPONS[modId(w)]?.type === 'missile');
  const hasPod     = (arr) => (arr || []).some(m => modId(m) === 'targeting_pod');
  for(const id in G.SHIPS){
    const s = G.SHIPS[id];
    if(hasMissile(s.startWeapons) && !hasPod(s.startModules)){
      (s.startModules || (s.startModules = [])).push('targeting_pod');
    }
  }
})();

// Ship state is module-driven (no hull pool): a ship explodes only when its
// CORE module is destroyed. Cores were effectively invincible (hp 999); lower
// them so a sustained hull breach can reach and detonate the core. Still the
// tankiest module, so it dies last — after weapons/reactor/cockpit are stripped.
G.CORE_HP = 200;
for(const id in G.MODULES){
  if(G.MODULES[id].slot === 'core') G.MODULES[id].hp = G.CORE_HP;
}

// ── Star Systems (100 systems) ────────────────────────────
// pos: [x,y] on galaxy map (950x700 canvas, center ~475,345)
// Layout: concentric rings — Earth r=0-120, Contested r=170, Rebellion r=240, Pirate r=300, Alien r=320
G.SYSTEMS = [
  // ── Earth Government Core — shifted into the upper-left galactic arm ──
  // (Sol is NOT at the galaxy's mathematical center; the galactic core sits in contested space)
  { id:'sol',        name:'Sol',           pos:[415,305], faction:'earth',     danger:1, starColor:'#ffff88', jumpR:153, hasCantina:true },
  { id:'alpha_cen',  name:'Alpha Centauri',pos:[455,305], faction:'earth',     danger:1, starColor:'#ffcc88', jumpR:145 },
  { id:'barnards',   name:"Barnard's Star",pos:[375,305], faction:'earth',     danger:1, starColor:'#ff8866', jumpR:136 },
  { id:'wolf359',    name:'Wolf 359',      pos:[480,332], faction:'earth',     danger:2, starColor:'#ff6644', jumpR:136 },
  { id:'lalande',    name:'Lalande 21185', pos:[442,370], faction:'earth',     danger:2, starColor:'#ff8844', jumpR:136 },
  { id:'sirius',     name:'Sirius',        pos:[388,370], faction:'earth',     danger:2, starColor:'#cceeff', jumpR:136, hasCantina:true },
  { id:'luyten726',  name:'Luyten 726-8',  pos:[350,332], faction:'earth',     danger:2, starColor:'#ff6633', jumpR:136 },
  { id:'ross154',    name:'Ross 154',      pos:[350,278], faction:'earth',     danger:2, starColor:'#ff5533', jumpR:136 },
  { id:'procyon',    name:'Procyon',       pos:[388,240], faction:'earth',     danger:2, starColor:'#ffffcc', jumpR:136 },
  { id:'eps_eri',    name:'Eps. Eridani',  pos:[442,240], faction:'earth',     danger:2, starColor:'#ffaa66', jumpR:145, hasCantina:true },
  { id:'lacaille93', name:'Lacaille 9352', pos:[480,278], faction:'earth',     danger:2, starColor:'#ff7744', jumpR:136 },
  { id:'ross128',    name:'Ross 128',      pos:[595,345], faction:'earth',     danger:3, starColor:'#ff6633', jumpR:136 },
  { id:'cygni61',    name:'61 Cygni',      pos:[567,422], faction:'earth',     danger:3, starColor:'#ffaa88', jumpR:136 },
  { id:'groombr34',  name:'Groombridge 34',pos:[496,463], faction:'earth',     danger:3, starColor:'#ff8866', jumpR:136 },
  { id:'eps_ind',    name:'Eps. Indi',     pos:[415,449], faction:'earth',     danger:3, starColor:'#ffbb88', jumpR:136 },
  { id:'tau_ceti',   name:'Tau Ceti',      pos:[362,386], faction:'earth',     danger:3, starColor:'#ffcc88', jumpR:145, hasCantina:true },
  { id:'luyten',     name:"Luyten's Star", pos:[362,304], faction:'earth',     danger:3, starColor:'#ff7755', jumpR:136 },
  { id:'kapteyn',    name:"Kapteyn's Star",pos:[415,241], faction:'earth',     danger:3, starColor:'#ffaa88', jumpR:136 },
  { id:'lacaille87', name:'Lacaille 8760', pos:[496,227], faction:'earth',     danger:3, starColor:'#ff6644', jumpR:136 },
  { id:'delta_pav',  name:'Delta Pavonis', pos:[567,268], faction:'earth',     danger:3, starColor:'#ffdd88', jumpR:136, hasCantina:true },

  // ── Contested Middle Ring ──
  { id:'kruger60',   name:'Kruger 60',     pos:[645,345], faction:'contested', danger:4, starColor:'#ff6633', jumpR:145 },
  { id:'gl674',      name:'Gliese 674',    pos:[637,398], faction:'contested', danger:4, starColor:'#ff5533', jumpR:136 },
  { id:'gl687',      name:'Gliese 687',    pos:[613,445], faction:'contested', danger:4, starColor:'#ff6644', jumpR:136 },
  { id:'gl412',      name:'Gliese 412',    pos:[575,483], faction:'contested', danger:4, starColor:'#ff7755', jumpR:136 },
  { id:'eri40',      name:'40 Eridani',    pos:[528,507], faction:'contested', danger:4, starColor:'#ffbb88', jumpR:136 },
  { id:'ev_lac',     name:'EV Lacertae',   pos:[475,515], faction:'contested', danger:4, starColor:'#ff4422', jumpR:136 },
  { id:'oph70',      name:'70 Ophiuchi',   pos:[422,507], faction:'contested', danger:4, starColor:'#ffcc88', jumpR:145 },
  { id:'eta_cas',    name:'Eta Cassiopeiae',pos:[375,483],faction:'contested', danger:4, starColor:'#ffdd99', jumpR:136 },
  { id:'sigma_dra',  name:'Sigma Draconis',pos:[337,445], faction:'contested', danger:4, starColor:'#ffcc88', jumpR:136 },
  { id:'eri82',      name:'82 Eridani',    pos:[313,398], faction:'contested', danger:4, starColor:'#ffcc88', jumpR:136 },
  { id:'gl667',      name:'Gliese 667',    pos:[305,345], faction:'contested', danger:4, starColor:'#ff6633', jumpR:136 },
  { id:'gl570',      name:'Gliese 570',    pos:[313,292], faction:'contested', danger:4, starColor:'#ff7744', jumpR:136, hasCantina:true },
  { id:'vir61',      name:'61 Virginis',   pos:[337,245], faction:'contested', danger:4, starColor:'#ffdd88', jumpR:136 },
  { id:'cancri55',   name:'55 Cancri',     pos:[375,207], faction:'contested', danger:4, starColor:'#ffcc88', jumpR:136 },
  { id:'mu_cas',     name:'Mu Cassiopeiae',pos:[422,183], faction:'contested', danger:4, starColor:'#eeeeff', jumpR:136 },
  { id:'beta_vir',   name:'Beta Virginis', pos:[475,175], faction:'contested', danger:4, starColor:'#eeeeff', jumpR:136 },
  { id:'hd40307',    name:'HD 40307',      pos:[528,183], faction:'contested', danger:5, starColor:'#ff8855', jumpR:136 },
  { id:'fomalhaut',  name:'Fomalhaut',     pos:[575,207], faction:'contested', danger:5, starColor:'#cceeff', jumpR:136 },
  { id:'altair',     name:'Altair',        pos:[613,245], faction:'contested', danger:5, starColor:'#eeffff', jumpR:145 },
  { id:'vega',       name:'Vega',          pos:[637,292], faction:'contested', danger:5, starColor:'#eeeeff', jumpR:145, hasCantina:true },

  // ── Rebellion Outer Ring ──
  { id:'arcturus',   name:'Arcturus',      pos:[712,382], faction:'rebellion', danger:5, starColor:'#ffbb88', jumpR:153, hasCantina:true },
  { id:'pollux',     name:'Pollux',        pos:[689,454], faction:'rebellion', danger:5, starColor:'#ffcc88', jumpR:145 },
  { id:'capella',    name:'Capella',       pos:[645,515], faction:'rebellion', danger:5, starColor:'#ffffcc', jumpR:145 },
  { id:'aldebaran',  name:'Aldebaran',     pos:[584,559], faction:'rebellion', danger:5, starColor:'#ffaa66', jumpR:145 },
  { id:'regulus',    name:'Regulus',       pos:[512,582], faction:'rebellion', danger:5, starColor:'#eeeeff', jumpR:136, hasCantina:true },
  { id:'castor',     name:'Castor',        pos:[438,582], faction:'rebellion', danger:5, starColor:'#eeeeff', jumpR:136 },
  { id:'deneb',      name:'Deneb',         pos:[366,559], faction:'rebellion', danger:6, starColor:'#eeeeff', jumpR:145, hasCantina:true },
  { id:'bellatrix',  name:'Bellatrix',     pos:[305,515], faction:'rebellion', danger:6, starColor:'#ccddff', jumpR:136 },
  { id:'spica',      name:'Spica',         pos:[261,454], faction:'rebellion', danger:6, starColor:'#cceeff', jumpR:145 },
  { id:'antares',    name:'Antares',       pos:[238,382], faction:'rebellion', danger:6, starColor:'#ff8844', jumpR:145 },
  { id:'canopus',    name:'Canopus',       pos:[238,308], faction:'rebellion', danger:5, starColor:'#eeeeff', jumpR:136 },
  { id:'achernar',   name:'Achernar',      pos:[261,236], faction:'rebellion', danger:5, starColor:'#cceeff', jumpR:136 },
  { id:'mirfak',     name:'Mirfak',        pos:[305,175], faction:'rebellion', danger:6, starColor:'#eeeeff', jumpR:136 },
  { id:'adhara',     name:'Adhara',        pos:[366,131], faction:'rebellion', danger:6, starColor:'#cceeff', jumpR:136 },
  { id:'wezen',      name:'Wezen',         pos:[438,108], faction:'rebellion', danger:6, starColor:'#ffffcc', jumpR:136 },
  { id:'furud',      name:'Furud',         pos:[512,108], faction:'rebellion', danger:6, starColor:'#aaddff', jumpR:136 },
  { id:'mirzam',     name:'Mirzam',        pos:[584,131], faction:'rebellion', danger:6, starColor:'#cceeff', jumpR:136 },
  { id:'alnilam',    name:'Alnilam',       pos:[645,175], faction:'rebellion', danger:6, starColor:'#cceeff', jumpR:136 },
  { id:'rigel',      name:'Rigel',         pos:[689,236], faction:'rebellion', danger:6, starColor:'#ccddff', jumpR:145 },
  { id:'betelgeuse', name:'Betelgeuse',    pos:[712,308], faction:'rebellion', danger:6, starColor:'#ff8866', jumpR:145 },

  // ── Pirate Badlands ──
  { id:'saiph',      name:'Saiph',         pos:[775,345], faction:'pirate',    danger:6, starColor:'#cceeff', jumpR:136, hasCantina:true },
  { id:'aludra',     name:'Aludra',        pos:[760,438], faction:'pirate',    danger:6, starColor:'#eeeeff', jumpR:136 },
  { id:'zeta_pup',   name:'Zeta Puppis',   pos:[718,522], faction:'pirate',    danger:7, starColor:'#88ccff', jumpR:136 },
  { id:'naos',       name:'Naos',          pos:[652,588], faction:'pirate',    danger:7, starColor:'#88aaff', jumpR:136 },
  { id:'algol',      name:'Algol',         pos:[568,630], faction:'pirate',    danger:7, starColor:'#ccddff', jumpR:145, noStar:true, hasCantina:true },
  { id:'mira',       name:'Mira',          pos:[475,645], faction:'pirate',    danger:7, starColor:'#ff8866', jumpR:136 },
  { id:'dubhe',      name:'Dubhe',         pos:[382,630], faction:'pirate',    danger:7, starColor:'#ffcc88', jumpR:136 },
  { id:'merak',      name:'Merak',         pos:[298,588], faction:'pirate',    danger:7, starColor:'#ffffcc', jumpR:136 },
  { id:'phecda',     name:'Phecda',        pos:[232,522], faction:'pirate',    danger:7, starColor:'#eeeeff', jumpR:136 },
  { id:'megrez',     name:'Megrez',        pos:[190,438], faction:'pirate',    danger:7, starColor:'#eeeeff', jumpR:136 },
  { id:'alioth',     name:'Alioth',        pos:[175,345], faction:'pirate',    danger:7, starColor:'#eeeeff', jumpR:136 },
  { id:'mizar',      name:'Mizar',         pos:[190,252], faction:'pirate',    danger:7, starColor:'#eeeeff', jumpR:136 },
  { id:'alkaid',     name:'Alkaid',        pos:[232,168], faction:'pirate',    danger:8, starColor:'#cceeff', jumpR:136 },
  { id:'thuban',     name:'Thuban',        pos:[298,102], faction:'pirate',    danger:8, starColor:'#ffcc88', jumpR:136 },
  { id:'eltanin',    name:'Eltanin',       pos:[382, 60], faction:'pirate',    danger:8, starColor:'#ffaa88', jumpR:136 },
  { id:'rastaban',   name:'Rastaban',      pos:[475, 45], faction:'pirate',    danger:8, starColor:'#ff9966', jumpR:136 },
  { id:'eta_car',    name:'Eta Carinae',   pos:[568, 60], faction:'pirate',    danger:8, starColor:'#ffcc44', jumpR:136, noStar:true },
  { id:'gam_vel',    name:'Gamma Velorum', pos:[652,102], faction:'pirate',    danger:8, starColor:'#88ccff', jumpR:136 },
  { id:'eps_car',    name:'Eps. Carinae',  pos:[718,168], faction:'pirate',    danger:8, starColor:'#aaddff', jumpR:136 },
  { id:'del_vel',    name:'Delta Velorum', pos:[760,252], faction:'pirate',    danger:8, starColor:'#cceeff', jumpR:136 },

  // ── Alien Frontier ──
  { id:'kochab',     name:'Kochab',        pos:[791,395], faction:'alien',     danger:8, starColor:'#ffaa66', jumpR:145 },
  { id:'pherkad',    name:'Pherkad',       pos:[760,490], faction:'alien',     danger:8, starColor:'#ffcc88', jumpR:145 },
  { id:'alphecca',   name:'Alphecca',      pos:[701,571], faction:'alien',     danger:9, starColor:'#eeeeff', jumpR:145 },
  { id:'unukalhai',  name:'Unukalhai',     pos:[620,630], faction:'alien',     danger:9, starColor:'#ff9966', jumpR:145 },
  { id:'graffias',   name:'Graffias',      pos:[525,661], faction:'alien',     danger:9, starColor:'#aaddff', jumpR:136 },
  { id:'dschubba',   name:'Dschubba',      pos:[425,661], faction:'alien',     danger:9, starColor:'#88ccff', jumpR:136 },
  { id:'zuben_el',   name:'Zubenelgenubi', pos:[330,630], faction:'alien',     danger:9, starColor:'#88bbff', jumpR:136 },
  { id:'zuben_es',   name:'Zubeneschamali',pos:[249,571], faction:'alien',     danger:9, starColor:'#aaeeff', jumpR:136 },
  { id:'syrma',      name:'Syrma',         pos:[190,490], faction:'alien',     danger:9, starColor:'#88aaff', jumpR:136 },
  { id:'porrima',    name:'Porrima',       pos:[159,395], faction:'alien',     danger:9, starColor:'#aaddff', jumpR:136 },
  { id:'vindem',     name:'Vindemiatrix',  pos:[159,295], faction:'alien',     danger:9, starColor:'#cceeff', jumpR:136 },
  { id:'minelauva',  name:'Minelauva',     pos:[190,200], faction:'alien',     danger:9, starColor:'#aaddff', jumpR:136 },
  { id:'zaniah',     name:'Zaniah',        pos:[249,119], faction:'alien',     danger:10,starColor:'#88aaff', jumpR:136 },
  { id:'heze',       name:'Heze',          pos:[330, 60], faction:'alien',     danger:10,starColor:'#88ccff', jumpR:136 },
  { id:'yed_prior',  name:'Yed Prior',     pos:[425, 29], faction:'alien',     danger:10,starColor:'#66aaff', jumpR:136 },
  { id:'phecda2',    name:'Phecda II',     pos:[525, 29], faction:'alien',     danger:10,starColor:'#88bbff', jumpR:136 },
  { id:'theta_car',  name:'Theta Carinae', pos:[620, 60], faction:'alien',     danger:10,starColor:'#aaddff', jumpR:136 },
  { id:'theia',      name:'Theia Prime',   pos:[701,119], faction:'alien',     danger:10,starColor:'#00ff88', jumpR:145 },
  { id:'khaal',      name:"Kha'al System", pos:[760,200], faction:'alien',     danger:10,starColor:'#00ffaa', jumpR:145, noStar:true },
  { id:'void',       name:'The Void',      pos:[791,295], faction:'alien',     danger:10,starColor:'#4400ff', jumpR:136, noStar:true },
];

// ── Crew Roles ────────────────────────────────────────────
G.CREW_ROLES = {
  pilot:     { id:'pilot',     name:'Pilot',      stats:{ turnBonus:0.2, thrustBonus:0.1 }, wage:50,  desc:'Improves maneuverability.' },
  gunner:    { id:'gunner',    name:'Gunner',     stats:{ damageBonus:0.15, fireRateBonus:0.1 }, wage:60, desc:'Improves weapon performance.' },
  engineer:  { id:'engineer',  name:'Engineer',   stats:{ repairRate:3, energyBonus:0.1 }, wage:55, desc:'Repairs hull and boosts energy.' },
  medic:     { id:'medic',     name:'Medic',      stats:{ crewHealRate:2 }, wage:45, desc:'Heals crew injuries.' },
  navigator: { id:'navigator', name:'Navigator',  stats:{ jumpRangeBonus:1, sensorBonus:200 }, wage:50, desc:'Extends jump range and sensors.' },
  marine:    { id:'marine',    name:'Marine',     stats:{ boardingBonus:0.3 }, wage:65, desc:'Expert at boarding operations.' },
};

G.CREW_NAMES = ['Alex','Sam','Jordan','Casey','Morgan','Riley','Drew','Jamie','Quinn','Blake',
  'Avery','Cameron','Skyler','Harley','Reagan','Taylor','Finley','Rowan','Parker','Logan'];

// ── Characters: unified person model (ship crew, planet units, boarders) ──────
// A character is a plain serializable object built by G.makeCharacter (utils.js).
// Base pools every character starts from before gear/level mods are applied.
G.CHAR_BASE = { hp:100, mana:50, energy:100 };
// Diablo-style primary attributes (start value before level points / gear).
G.CHAR_ATTRS = { str:10, dex:10, int:10, vit:10 };

// ── ARPG active skills (planet hotbar 1-4) ───────────────────────────────────
// Cast at the cursor; cost mana + go on cooldown. type drives the effect in
// _castSkill (main.js). dmgMul scales the character's main-hand weapon damage.
G.CHAR_SKILLS = {
  cleave:    { id:'cleave',    name:'Cleave',     icon:'🪓', color:'#ff8844', mana:8,  cooldown:0.4, type:'melee',  dmgMul:1.6, radius:1.8, desc:'Wide melee strike — all foes in front.' },
  multishot: { id:'multishot', name:'Multishot',  icon:'🏹', color:'#ffcc44', mana:12, cooldown:0.7, type:'spread', dmgMul:0.7, count:5, spread:0.45, desc:'Fan of ranged bolts.' },
  dash:      { id:'dash',      name:'Dash',       icon:'💨', color:'#66ddff', mana:10, cooldown:2.5, type:'dash',   range:5,    desc:'Blink toward the cursor (over cliffs).' },
  nova:      { id:'nova',      name:'Frost Nova', icon:'❄',  color:'#88ccff', mana:18, cooldown:4,   type:'nova',   dmgMul:1.2, radius:3, slow:2.5, desc:'Frost burst around you — damage + slow.' },
  quake:     { id:'quake',     name:'Quake',      icon:'💥', color:'#ffaa33', mana:25, cooldown:6,   type:'nova',   dmgMul:2.2, radius:4, desc:'Ground slam — heavy AoE around you.' },
  mend:      { id:'mend',      name:'Mend',       icon:'✚',  color:'#44ff99', mana:22, cooldown:5,   type:'heal',   healMul:0.45, desc:'Convert mana into a burst of health.' },
};
G.CHAR_SKILL_IDS = Object.keys(G.CHAR_SKILLS);
// Each class starts with one planet skill already unlocked + slotted.
G.CLASS_PLANET_SKILL = {
  space_marine:'cleave', berserker:'cleave', knight:'cleave', tank:'quake',
  sniper:'multishot', hacker:'dash', monk:'nova', medic:'mend', tech_priest:'mend',
};
// Cooldown flasks (Diablo 3 style — infinite uses, gated by cooldown).
G.FLASK = { healCd:8, manaCd:8, healFrac:0.5, manaFrac:0.5 };

// ── Planet hostile archetypes ────────────────────────────────────────────────
// Monsters spawned in packs on the surface. hp/dmg are level-1 base, scaled by
// monster level. weight biases spawn frequency; minDanger gates tougher types.
G.PLANET_ENEMIES = {
  grunt:   { id:'grunt',   name:'Raider',  kind:'melee',  weapon:'sword',  hp:55,  dmg:9,  speed:1.0,  size:1.0,  color:'#cc5544', xp:1, weight:50, minDanger:0 },
  shooter: { id:'shooter', name:'Gunner',  kind:'ranged', weapon:'pistol', hp:42,  dmg:8,  speed:0.95, size:0.95, color:'#dd9944', xp:1, weight:34, minDanger:0 },
  stalker: { id:'stalker', name:'Stalker', kind:'melee',  weapon:'sword',  hp:38,  dmg:12, speed:1.6,  size:0.85, color:'#9944cc', xp:2, weight:18, minDanger:3 },
  brute:   { id:'brute',   name:'Brute',   kind:'melee',  weapon:'sword',  hp:150, dmg:18, speed:0.8,  size:1.45, color:'#aa4466', xp:3, weight:12, minDanger:4 },
};
G.PLANET_ENEMY_IDS = Object.keys(G.PLANET_ENEMIES);

// Elite/champion modifiers. An elite pack leader carries 1-2 of these.
G.ELITE_AFFIXES = {
  fast:      { id:'fast',      name:'Fast',      color:'#66ddff', speed:1.5 },
  frenzied:  { id:'frenzied',  name:'Frenzied',  color:'#ff4444', dmgMul:1.8, speed:1.15 },
  shielded:  { id:'shielded',  name:'Shielded',  color:'#88aaff', hpMul:2.4, regen:5 },
  explosive: { id:'explosive', name:'Explosive', color:'#ff8833', deathR:2.6, deathDmg:24 },
  healer:    { id:'healer',    name:'Vampiric',  color:'#44ff88', healAura:8, auraR:4 },
  phasing:   { id:'phasing',   name:'Phasing',   color:'#bb88ff', blink:true },
};
G.ELITE_AFFIX_IDS = Object.keys(G.ELITE_AFFIXES);

// ── Spaceport town buildings ─────────────────────────────────────────────────
// Each service in the spaceport menu gets a physical building plot on the
// surface, arranged around the landing pad. `tab` opens that spaceport tab;
// `special` opens a bespoke overlay (vendor / stash).
G.SPACEPORT_BUILDINGS = [
  { service:'trade',     name:'Market',        icon:'🛒', color:'#44dd88', tab:'trade' },
  { service:'missions',  name:'Mission Board', icon:'📋', color:'#ffcc44', tab:'missions' },
  { service:'outfitter', name:'Outfitter',     icon:'🔧', color:'#44aaff', tab:'outfitter' },
  { service:'shipyard',  name:'Shipyard',      icon:'🚀', color:'#ff8844', tab:'shipyard' },
  { service:'builder',   name:'Drydock',       icon:'⬡', color:'#88aaff', tab:'builder' },
  { service:'crew',      name:'Cantina',       icon:'🍺', color:'#ffaa66', tab:'crew' },
  { service:'repair',    name:'Repair Bay',    icon:'🛠', color:'#66ccff', tab:'repair' },
  { service:'craft',     name:'Workshop',      icon:'⚙', color:'#bb88ff', tab:'craft' },
  { service:'vendor',    name:'Gear Vendor',   icon:'🗡', color:'#ff6688', special:'vendor' },
  { service:'stash',     name:'Stash',         icon:'📦', color:'#aaccee', special:'stash' },
];

// ── ARPG loot: rarity tiers + random affix pool (see G.rollItem in utils) ─────
// Each dropped piece of gear is a rolled INSTANCE: a base item from G.ITEMS plus
// rarity-scaled base mods and 0–6 random prefix/suffix affixes drawn by item level.
G.RARITIES = {
  common:    { id:'common',    name:'',          color:'#cfd6e0', affixes:[0,0], mult:1.00, weight:58 },
  magic:     { id:'magic',     name:'Magic',     color:'#6ea8ff', affixes:[1,2], mult:1.15, weight:28 },
  rare:      { id:'rare',      name:'Rare',      color:'#ffd34d', affixes:[3,4], mult:1.30, weight:11 },
  legendary: { id:'legendary', name:'Legendary', color:'#ff8a3d', affixes:[4,6], mult:1.55, weight:3  },
};
G.RARITY_ORDER = ['common', 'magic', 'rare', 'legendary'];

// Affix templates. kind prefix → `title` adjective; suffix → `word` ("of the …").
// `slot`: 'any' | 'weapon' (hand pistol/sword) | 'armor' (everything wearable).
// min/max are the level-1 range; G._rollAffixVal scales them up by item level.
G.AFFIXES = [
  // prefixes
  { id:'p_armor',  kind:'prefix', title:'Plated',    stat:'armor',  slot:'armor',  min:3,  max:8  },
  { id:'p_hp',     kind:'prefix', title:'Stalwart',  stat:'hp',     slot:'any',    min:8,  max:20 },
  { id:'p_dmg',    kind:'prefix', title:'Vicious',   stat:'dmg',    slot:'weapon', min:3,  max:8  },
  { id:'p_mana',   kind:'prefix', title:'Arcane',    stat:'mana',   slot:'any',    min:6,  max:16 },
  { id:'p_energy', kind:'prefix', title:'Charged',   stat:'energy', slot:'any',    min:6,  max:16 },
  { id:'p_crit',   kind:'prefix', title:'Keen',      stat:'crit',   slot:'weapon', min:2,  max:6  }, // % crit
  // suffixes
  { id:'s_str',    kind:'suffix', word:'of the Bear', stat:'str',       slot:'any',    min:2, max:6 },
  { id:'s_dex',    kind:'suffix', word:'of the Fox',  stat:'dex',       slot:'any',    min:2, max:6 },
  { id:'s_int',    kind:'suffix', word:'of the Owl',  stat:'int',       slot:'any',    min:2, max:6 },
  { id:'s_vit',    kind:'suffix', word:'of the Bull', stat:'vit',       slot:'any',    min:2, max:6 },
  { id:'s_res',    kind:'suffix', word:'of Warding',  stat:'resAll',    slot:'armor',  min:3, max:9 }, // % resist
  { id:'s_leech',  kind:'suffix', word:'of Leeching', stat:'lifeOnHit', slot:'weapon', min:1, max:4 },
  { id:'s_speed',  kind:'suffix', word:'of Swiftness',stat:'moveSpeed', slot:'armor',  min:3, max:8 }, // % move
];

// Equipment paper-doll slots. 'ring1'/'ring2' both accept equipSlot:'ring' gear;
// 'lefthand'/'righthand' both accept equipSlot:'hand' gear (pistol/sword/shield).
G.EQUIP_SLOTS = ['helm','necklace','shoulders','chest','bracers','belt',
  'leggings','boots','ring1','ring2','backpack','lefthand','righthand'];
// Pretty labels for the character screen paper-doll.
G.EQUIP_LABELS = {
  helm:'Helm', necklace:'Necklace', shoulders:'Shoulders', chest:'Chest',
  bracers:'Bracers', belt:'Belt', leggings:'Leggings', boots:'Boots',
  ring1:'Ring', ring2:'Ring', backpack:'Back', lefthand:'L.Hand', righthand:'R.Hand',
};
// Which item.equipSlot families may sit in a given paper-doll slot.
G.slotAccepts = function(paperSlot, equipSlot) {
  if(equipSlot === 'hand') return paperSlot === 'lefthand' || paperSlot === 'righthand';
  if(equipSlot === 'ring') return paperSlot === 'ring1' || paperSlot === 'ring2';
  return paperSlot === equipSlot;
};

// Disposition toward the player. Drives ring colour + planet behaviour.
G.DISPOSITIONS = {
  friendly: { id:'friendly', name:'Friendly', color:'#44ff88' },
  neutral:  { id:'neutral',  name:'Neutral',  color:'#aaaaaa' },
  cautious: { id:'cautious', name:'Cautious', color:'#ffcc44' },
  hostile:  { id:'hostile',  name:'Hostile',  color:'#ff3333' },
  faction:  { id:'faction',  name:'Faction',  color:'#4488ff' },
};

// ── Personal Gear (UNIFIED with cargo) ───────────────────────────────────────
// Gear lives in the SAME G.ITEMS registry as raw materials / goods, so it is
// carried in ship cargo (consumes mass / cargo space) and traded like anything
// else. `equipSlot` marks it wearable; equipping pulls 1 unit from cargo into a
// character paper-doll slot. `mods` add to character pools/armor; hand items also
// carry kind ('pistol'|'sword'|'shield'|'jetpack') + combat numbers.
Object.assign(G.ITEMS, {
  // Weapons / off-hand (equipSlot:'hand')
  pistol:  { id:'pistol',  name:'Laser Pistol', cat:'gear', equipSlot:'hand', kind:'pistol', icon:'🔫', color:'#ff8844', base:260,  mass:2, rarity:'c', dmg:12, range:9,  rof:2.5, desc:'Sidearm. Ranged energy bolts.' },
  sword:   { id:'sword',   name:'Vibro-Sword',  cat:'gear', equipSlot:'hand', kind:'sword',  icon:'🗡', color:'#ccddff', base:220,  mass:3, rarity:'c', dmg:20, range:1.3, rof:1.6, desc:'Close-quarters melee blade.' },
  shield:  { id:'shield',  name:'Combat Shield',cat:'gear', equipSlot:'hand', kind:'shield', icon:'🛡', color:'#88aaff', base:240,  mass:4, rarity:'c', mods:{armor:10}, block:0.4, desc:'Off-hand guard. Blocks incoming hits.' },
  grenade: { id:'grenade', name:'Frag Grenade', cat:'gear', equipSlot:'hand', kind:'grenade', icon:'💣', color:'#dd5544', base:150, mass:1, rarity:'c', dmg:30, range:5, rof:1.2, desc:'Explosive throwable. Area damage.' },
  // Backpack (equipSlot:'backpack') — jetpack OR storage
  jetpack: { id:'jetpack', name:'Jetpack',      cat:'gear', equipSlot:'backpack', kind:'jetpack', icon:'🚀', color:'#ffaa33', base:600,  mass:6, rarity:'u', thrust:9, lift:5.5, drain:18, desc:'Sustained flight on the surface. Drains energy.' },
  storage_pack:{ id:'storage_pack', name:'Storage Pack', cat:'gear', equipSlot:'backpack', kind:'pack', icon:'🎒', color:'#aa8855', base:150, mass:2, rarity:'c', mods:{carry:8}, desc:'Roomy pack. More cargo space when worn.' },
  // Armor
  combat_helm:{ id:'combat_helm', name:'Combat Helm', cat:'gear', equipSlot:'helm', icon:'⛑', color:'#99aabb', base:180, mass:2, rarity:'c', mods:{armor:4, hp:10}, desc:'Reinforced head protection.' },
  flak_vest: { id:'flak_vest', name:'Flak Vest', cat:'gear', equipSlot:'chest', icon:'🦺', color:'#bbaa66', base:300, mass:5, rarity:'c', mods:{armor:10, hp:20}, desc:'Torso plating.' },
  pauldrons: { id:'pauldrons', name:'Pauldrons', cat:'gear', equipSlot:'shoulders', icon:'🛡', color:'#99aabb', base:160, mass:3, rarity:'c', mods:{armor:4}, desc:'Shoulder guards.' },
  bracers:   { id:'bracers',   name:'Bracers',   cat:'gear', equipSlot:'bracers', icon:'🩹', color:'#99aabb', base:90, mass:1, rarity:'c', mods:{armor:2}, desc:'Forearm guards.' },
  utility_belt:{ id:'utility_belt', name:'Utility Belt', cat:'gear', equipSlot:'belt', icon:'➰', color:'#aa8855', base:120, mass:1, rarity:'c', mods:{energy:15}, desc:'Carries spare cells.' },
  greaves:   { id:'greaves',   name:'Greaves',   cat:'gear', equipSlot:'leggings', icon:'👖', color:'#99aabb', base:200, mass:3, rarity:'c', mods:{armor:6, hp:10}, desc:'Leg plating.' },
  combat_boots:{ id:'combat_boots', name:'Combat Boots', cat:'gear', equipSlot:'boots', icon:'🥾', color:'#aa8855', base:110, mass:1, rarity:'c', mods:{armor:2}, desc:'Sturdy footwear.' },
  power_ring:{ id:'power_ring', name:'Power Ring', cat:'gear', equipSlot:'ring', icon:'💍', color:'#bb88ff', base:280, mass:0, rarity:'u', mods:{mana:20}, desc:'Channels psionic energy.' },
  vital_amulet:{ id:'vital_amulet', name:'Vital Amulet', cat:'gear', equipSlot:'necklace', icon:'📿', color:'#ff6699', base:320, mass:0, rarity:'u', mods:{hp:25}, desc:'Bolsters constitution.' },
});

// ── Mission Templates ────────────────────────────────────
G.MISSION_TYPES = [
  {
    type:'cargo_haul', name:'Cargo Delivery',
    desc:'Deliver {qty} units of {item} to {dest}.',
    repReward: 5,
    reward: (dist, qty) => 200 + dist * 35 + qty * 25,
    genFn: (sys, allSys) => {
      const items = ['food','medicine','electronics','metals','polymers','fuel_cells'];
      const item = items[Math.floor(Math.random()*items.length)];
      const qty = 5 + Math.floor(Math.random()*12);
      // Pick a system in a different faction cluster if possible
      const candidates = allSys.filter(s=>s.id!==sys.id);
      const dest = candidates[Math.floor(Math.random()*candidates.length)];
      return { item, qty, dest: dest.id };
    }
  },
  {
    type:'passenger', name:'Passenger Transport',
    desc:'Transport {qty} passengers to {dest}. Handle with care.',
    repReward: 8,
    reward: (dist, qty) => 400 + dist * 60 + qty * 80,
    genFn: (sys, allSys) => {
      const qty = 1 + Math.floor(Math.random()*4);
      const candidates = allSys.filter(s=>s.id!==sys.id);
      const dest = candidates[Math.floor(Math.random()*candidates.length)];
      return { qty, dest: dest.id, item: 'mission_pkg' };
    }
  },
  {
    type:'bounty', name:'Bounty Hunt',
    desc:'Destroy pirate vessels operating near {target}.',
    repReward: 8,
    reward: (dist, qty) => 600 + dist * 40,
    genFn: (sys, allSys) => {
      const pirates = allSys.filter(s => s.faction==='pirate'||s.faction==='contested');
      const t = pirates.length ? pirates[Math.floor(Math.random()*pirates.length)] : allSys[0];
      return { target: t.id, dest: t.id };
    }
  },
  {
    type:'salvage', name:'Salvage Operation',
    desc:'Recover {qty} units of cargo from a derelict near {dest}.',
    repReward: 5,
    reward: (dist, qty) => 350 + dist * 30 + qty * 40,
    genFn: (sys, allSys) => {
      const qty = 3+Math.floor(Math.random()*6);
      const candidates = allSys.filter(s=>s.id!==sys.id);
      const dest = candidates[Math.floor(Math.random()*candidates.length)];
      return { qty, dest: dest.id };
    }
  },
  // ── Faction prestige missions (large rep rewards) ──
  {
    type:'faction_earth', name:'[EARTH] Priority Order',
    faction:'earth',
    desc:'Destroy pirate activity threatening Earth supply lines near {dest}.',
    reward: () => 4000 + Math.floor(Math.random()*2000),
    repReward: 40, repFaction:'earth',
    genFn: (sys, allSys) => {
      const candidates = allSys.filter(s=>s.faction==='pirate'||s.faction==='contested');
      const dest = candidates.length ? candidates[Math.floor(Math.random()*candidates.length)] : allSys[0];
      return { dest: dest.id };
    }
  },
  {
    type:'faction_rebellion', name:'[REBELLION] Strike Mission',
    faction:'rebellion',
    desc:'Sabotage Earth Government operations near {dest}.',
    reward: () => 4500 + Math.floor(Math.random()*2000),
    repReward: 40, repFaction:'rebellion',
    genFn: (sys, allSys) => {
      const candidates = allSys.filter(s=>s.faction==='earth'||s.faction==='contested');
      const dest = candidates.length ? candidates[Math.floor(Math.random()*candidates.length)] : allSys[0];
      return { dest: dest.id };
    }
  },
  {
    type:'faction_pirate', name:'[PIRATE] Raiding Contract',
    faction:'pirate',
    desc:'Raid the merchant convoy passing through {dest}.',
    reward: () => 3500 + Math.floor(Math.random()*2000),
    repReward: 40, repFaction:'pirate',
    genFn: (sys, allSys) => {
      const candidates = allSys.filter(s=>s.faction!=='pirate');
      const dest = candidates[Math.floor(Math.random()*candidates.length)];
      return { dest: dest.id };
    }
  },
];

// ── Asteroid hex-tile materials (increasing rarity → decreasing spawn weight) ─
// Each tile of an asteroid cluster is one of these. `drop` = item id mined.
// `base`/`vein`/`spec` drive procedural texture art in sprites.
G.ASTEROID_TILE_R = 26;            // hex tile radius (centre→vertex, world px)
G.ASTEROID_MATS = [
  { id:'rock',     drop:'rock',     weight:46, hp:24, base:'#6e6258', vein:'#534a42', spec:'#8a7d70' },
  { id:'ice',      drop:'ice',      weight:20, hp:18, base:'#9fc4d6', vein:'#cfe8f2', spec:'#e8f6ff' },
  { id:'iron',     drop:'iron',     weight:16, hp:34, base:'#6b5a52', vein:'#8a4a38', spec:'#b08070' },
  { id:'nickel',   drop:'nickel',   weight:11, hp:36, base:'#8a8c86', vein:'#6a6c66', spec:'#c8cac4' },
  { id:'copper',   drop:'copper',   weight:8,  hp:32, base:'#9a5a3a', vein:'#3a7a5a', spec:'#d98a55' },
  { id:'tin',      drop:'tin',      weight:6,  hp:30, base:'#8f8f96', vein:'#6e6e76', spec:'#c4c4cc' },
  { id:'gold',     drop:'gold',     weight:3,  hp:40, base:'#9c7a2a', vein:'#7a5e1c', spec:'#ffe070' },
  { id:'carbon',   drop:'carbon',   weight:2.4,hp:44, base:'#2b2b30', vein:'#16161a', spec:'#5a5a64' },
  { id:'titanium', drop:'titanium', weight:1.2,hp:54, base:'#5c6a78', vein:'#3e4a56', spec:'#9ab0c4' },
  { id:'platinum', drop:'platinum', weight:0.5,hp:64, base:'#b8c0c4', vein:'#8e9498', spec:'#f0f8fc' },
];
G.ASTEROID_MAT = Object.fromEntries(G.ASTEROID_MATS.map(m => [m.id, m]));
G.ASTEROID_INNER = { base:'#4a423b', vein:'#3a332e', spec:'#5c534a' }; // generic interior texture
// Pointy-top axial neighbours used to grow & analyse tile clusters
G.HEX_NEIGHBORS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
// Local pixel offset of a tile (q,r) from cluster centre (pointy-top)
G.astTileLocal = (q,r) => {
  const R = G.ASTEROID_TILE_R, S = Math.sqrt(3);
  return { x: R*(S*q + S/2*r), y: R*1.5*r };
};
// Weighted random material id from the spawn table
G.astRandMat = (rng) => {
  const fn = rng || Math.random;
  let tot = 0; for(const m of G.ASTEROID_MATS) tot += m.weight;
  let x = fn()*tot;
  for(const m of G.ASTEROID_MATS){ x -= m.weight; if(x<=0) return m.id; }
  return 'rock';
};

// ── Ship shape vertex definitions ────────────────────────
G.SHAPES = {
  shuttle: {
    body:  [[0,-14],[9,10],[4,6],[-4,6],[-9,10]],
    color: '#8899bb', enginePts: [[0,8]], engineW: 6,
  },
  merchant: {
    body:  [[0,-16],[7,4],[12,14],[0,9],[-12,14],[-7,4]],
    color: '#aacc88', enginePts: [[-6,12],[6,12]], engineW: 5,
  },
  miner: {
    body:  [[0,-14],[4,2],[8,8],[14,16],[8,14],[4,18],[0,16],[-4,18],[-8,14],[-14,16],[-8,8],[-4,2]],
    color: '#aa9966', enginePts: [[-5,15],[5,15]], engineW: 6,
  },
  scout: {
    body:  [[0,-12],[5,8],[0,5],[-5,8]],
    color: '#88ccee', enginePts: [[0,6]], engineW: 4,
  },
  fighter: {
    body:  [[0,-14],[4,4],[10,14],[4,9],[-4,9],[-10,14],[-4,4]],
    color: '#4488ff', enginePts: [[-5,11],[5,11]], engineW: 4,
  },
  frigate: {
    body:  [[0,-20],[5,2],[9,8],[13,20],[4,16],[0,14],[-4,16],[-13,20],[-9,8],[-5,2]],
    color: '#8899cc', enginePts: [[-6,17],[0,16],[6,17]], engineW: 5,
  },
  gunboat: {
    body:  [[0,-18],[8,6],[12,18],[0,12],[-12,18],[-8,6]],
    color: '#ff8844', enginePts: [[-6,15],[0,14],[6,15]], engineW: 5,
  },
  corvette: {
    body:  [[0,-20],[6,4],[10,8],[12,20],[0,14],[-12,20],[-10,8],[-6,4]],
    color: '#5599ff', enginePts: [[-8,17],[0,16],[8,17]], engineW: 5,
  },
  freighter: {
    body:  [[0,-16],[4,0],[16,6],[16,22],[0,18],[-16,22],[-16,6],[-4,0]],
    color: '#888866', enginePts: [[-8,20],[0,20],[8,20]], engineW: 6,
  },
  tanker: {
    body:  [[0,-14],[3,0],[8,4],[16,8],[16,24],[0,20],[-16,24],[-16,8],[-8,4],[-3,0]],
    color: '#886644', enginePts: [[-6,22],[0,22],[6,22]], engineW: 7,
  },
  battlecruiser: {
    body:  [[0,-24],[8,4],[14,10],[14,24],[6,20],[0,18],[-6,20],[-14,24],[-14,10],[-8,4]],
    color: '#336699', enginePts: [[-10,22],[-4,22],[4,22],[10,22]], engineW: 6,
  },
  carrier: {
    body:  [[0,-22],[4,4],[20,8],[20,28],[0,22],[-20,28],[-20,8],[-4,4]],
    color: '#996633', enginePts: [[-14,26],[0,24],[14,26]], engineW: 7,
  },
  dreadnought: {
    body:  [[0,-28],[6,4],[12,8],[18,14],[18,32],[8,26],[0,24],[-8,26],[-18,32],[-18,14],[-12,8],[-6,4]],
    color: '#224466', enginePts: [[-12,30],[-4,30],[4,30],[12,30]], engineW: 8,
  },
  pirate_fighter: {
    body:  [[0,-12],[6,8],[2,5],[-2,5],[-6,8]],
    color: '#cc4422', enginePts: [[0,6]], engineW: 5,
  },
  alien_fighter: {
    body:  [[0,-12],[-8,4],[0,-2],[8,4],[4,10],[-4,10]],
    color: '#00ff88', enginePts: [[0,8]], engineW: 5,
  },
  alien_cruiser: {
    body:  [[0,-18],[-12,4],[0,-6],[12,4],[8,14],[-8,14],[0,18]],
    color: '#00ffaa', enginePts: [[-4,14],[4,14]], engineW: 7,
  },
  earth_shuttle: {
    body:  [[0,-15],[8,2],[10,18],[0,12],[-10,18],[-8,2]],
    color: '#4488ff', enginePts: [[-4,15],[4,15]], engineW: 5,
  },
  earth_patrol: {
    body:  [[0,-15],[4,2],[12,14],[4,12],[-4,12],[-12,14],[-4,2]],
    color: '#4488ff', enginePts: [[-4,11],[4,11]], engineW: 4,
  },
  rebel_fighter: {
    body:  [[0,-13],[5,5],[10,14],[4,10],[-4,10],[-10,14],[-5,5]],
    color: '#ff6600', enginePts: [[-3,11],[3,11]], engineW: 4,
  },
  rebel_hauler: {
    body:  [[0,-14],[4,0],[12,8],[14,20],[0,16],[-14,20],[-12,8],[-4,0]],
    color: '#ff6600', enginePts: [[-8,18],[0,17],[8,18]], engineW: 5,
  },
  // Per-type asteroid shapes
  asteroid_rocky: {
    body:  [[0,-12],[8,-6],[12,2],[8,10],[2,13],[-6,12],[-12,4],[-10,-6],[-4,-12]],
    color: '#776655', enginePts: [], engineW: 0,
  },
  asteroid_metallic: {
    // More angular/crystalline
    body:  [[0,-13],[5,-9],[12,-3],[13,5],[8,11],[0,13],[-8,11],[-13,5],[-12,-3],[-5,-9]],
    color: '#998877', enginePts: [], engineW: 0,
  },
  asteroid_icy: {
    // Rounder/smoother
    body:  [[0,-11],[7,-7],[11,0],[8,9],[0,12],[-8,9],[-11,0],[-7,-7]],
    color: '#aaccdd', enginePts: [], engineW: 0,
  },
  asteroid_alien: {
    // Asymmetric with spiky protrusions
    body:  [[0,-14],[4,-8],[12,-2],[10,6],[4,12],[-2,10],[-10,6],[-12,-2],[-6,-8]],
    color: '#44cc88', enginePts: [], engineW: 0,
  },
  planet_icon: {
    body:  [],
    color: '#4466ff', enginePts: [], engineW: 0,
  },
};

G.ABILITIES = {
  frost_nova: {
    id: 'frost_nova', name: 'Frost Nova',
    desc: 'Ring of frost freezes all nearby enemies for 2 seconds',
    cooldown: 15, energyCost: 30, range: 380,
    color: '#88ddff', icon: '❄', npcUsable: true,
  },
  healing_nova: {
    id: 'healing_nova', name: 'Healing Nova',
    desc: 'Heals nearby friendly ships over time',
    cooldown: 20, energyCost: 40, range: 350,
    color: '#44ff88', icon: '✚', npcUsable: true,
  },
  chaff: {
    id: 'chaff', name: 'Chaff',
    desc: 'Cloud breaks missile locks and detonates incoming missiles',
    cooldown: 12, energyCost: 15, range: 200,
    color: '#ffcc44', icon: '◈', npcUsable: false,
  },
  quantum_brake: {
    id: 'quantum_brake', name: 'Quantum Brake',
    desc: 'Instantly stops all ship velocity',
    cooldown: 1, energyCost: 20, range: 0,
    color: '#aa88ff', icon: '⊗', npcUsable: false,
  },
  superboost: {
    id: 'superboost', name: 'Superboost',
    desc: '5 seconds of unlimited boost — no energy drain, green exhaust',
    cooldown: 30, energyCost: 0, range: 0,
    color: '#00ff88', icon: '⚡', npcUsable: false,
  },
  scan: {
    id: 'scan', name: 'Scan',
    desc: 'Penetrating sensor sweep of a targeted ship — strips away its hull plating in your view to reveal the internal modules so you can target weapons, engines, or the core. Granted by a sensor module.',
    cooldown: 3, energyCost: 8, range: 0,
    color: '#44ddff', icon: '⌖', npcUsable: false,
  },
  radar_scan: {
    id: 'radar_scan', name: 'Radar Scan',
    desc: 'Emit a radar pulse that reveals all ships in a 6-hex radius for 30 seconds. Granted by a Radar Array.',
    cooldown: 45, energyCost: 80, range: 9000,
    color: '#33aaff', icon: '◉', npcUsable: false,
  },
  optical_target_lock: {
    id: 'optical_target_lock', name: 'Optical Target Lock',
    desc: 'Begin 3-second optical lock-on sequence. Requires a Targeting Pod. Locked missiles track their target.',
    cooldown: 0, energyCost: 0, range: 0,
    color: '#ff8800', icon: '◎', npcUsable: false,
  },
  missile_launch: {
    id: 'missile_launch', name: 'Missile Launch',
    desc: 'Launch guided missile at optically locked target. No ammo required — limited by cooldown.',
    cooldown: 3, energyCost: 0, range: 0,
    color: '#ff4400', icon: '▲', npcUsable: false,
  },
  repair_drone: {
    id: 'repair_drone', name: 'Repair Drone',
    desc: 'Deploy a repair drone that follows your ship and heals all nearby friendly ships for 10 seconds.',
    cooldown: 30, energyCost: 40, range: 250,
    color: '#bb88ff', icon: '⚙', npcUsable: false,
  },
  stim: {
    id: 'stim', name: 'Stim',
    desc: '10 seconds of 25% faster weapons and 25% faster movement speed.',
    cooldown: 30, energyCost: 25, range: 0,
    color: '#4488ff', icon: '⚔', npcUsable: false,
  },
  mark_target: {
    id: 'mark_target', name: 'Mark Target',
    desc: 'Mark the targeted ship for 10 seconds — revealed to all allies, takes 50% increased damage.',
    cooldown: 30, energyCost: 20, range: 0,
    color: '#ff8844', icon: '◎', npcUsable: false,
  },
  invulnerability: {
    id: 'invulnerability', name: 'Invulnerability',
    desc: 'Become invulnerable for 3 seconds. 30 second cooldown.',
    cooldown: 30, energyCost: 30, range: 0,
    color: '#ffcc00', icon: '♞', npcUsable: false,
  },
};

// ── Skill Trees ─────────────────────────────────────────────
// Each class has 5 nodes: index 0 = starting ability (bottom), 1-4 above (locked).
// isAbility:true → pull name/icon/color from G.ABILITIES[id].
G.SKILL_TREES = {
  hacker: [
    { id:'chaff',            isAbility:true },
    { name:'Signal Cloak',   icon:'◉', color:'#00ff88', desc:'Become untraceable by radar for 8 seconds.' },
    { name:'Virus Bomb',     icon:'⊘', color:'#00ff88', desc:'Upload a virus that disables enemy systems for 4 seconds.' },
    { name:'Neural Tap',     icon:'⬡', color:'#00ff88', desc:'Hack enemy weapons, causing them to misfire.' },
    { name:'Ghost Protocol', icon:'◌', color:'#00ff88', desc:'Full electronic silence — no ship can acquire a lock on you.' },
  ],
  tech_priest: [
    { id:'repair_drone',     isAbility:true },
    { name:'Overclock',      icon:'⚡', color:'#bb88ff', desc:'Temporarily boost engine and weapon power output.' },
    { name:'Swarm Drones',   icon:'◈', color:'#bb88ff', desc:'Deploy multiple small attack drones.' },
    { name:'Nanite Field',   icon:'⊕', color:'#bb88ff', desc:'Nanites repair hull damage continuously for 15 seconds.' },
    { name:'Machine God',    icon:'☩', color:'#bb88ff', desc:'All systems operate at peak efficiency for 20 seconds.' },
  ],
  space_marine: [
    { id:'stim',             isAbility:true },
    { name:'War Cry',        icon:'⚡', color:'#4488ff', desc:'Inspire nearby fleet ships, boosting their combat stats.' },
    { name:'Iron Skin',      icon:'▣', color:'#4488ff', desc:'Temporary armor plating absorbs next 3 hits.' },
    { name:'Frag Grenade',   icon:'◎', color:'#4488ff', desc:'Launch a proximity detonation device.' },
    { name:'Shock Trooper',  icon:'⚔', color:'#4488ff', desc:'Massive speed burst and ram damage on contact.' },
  ],
  monk: [
    { id:'frost_nova',       isAbility:true },
    { name:'Inner Fire',     icon:'◆', color:'#ffdd44', desc:'Meditate to rapidly regen shields and hull.' },
    { name:'Harmony Pulse',  icon:'☯', color:'#ffdd44', desc:'Emit a pulse that confuses nearby enemies briefly.' },
    { name:'Zen Guard',      icon:'◇', color:'#ffdd44', desc:'Enter a defensive stance, reducing all incoming damage.' },
    { name:'Void Step',      icon:'⊗', color:'#ffdd44', desc:'Short-range teleport — blink 200 units in facing direction.' },
  ],
  medic: [
    { id:'healing_nova',     isAbility:true },
    { name:'Trauma Kit',     icon:'✚', color:'#44ffaa', desc:'Instantly restore 30% hull on a targeted friendly ship.' },
    { name:'Revival',        icon:'◉', color:'#44ffaa', desc:'Restore a disabled friendly ship to minimal function.' },
    { name:'Biofield',       icon:'⊛', color:'#44ffaa', desc:'Persistent healing aura for the entire fleet for 20 seconds.' },
    { name:'Mass Mend',      icon:'❋', color:'#44ffaa', desc:'Fully restore hull on all friendly ships in range.' },
  ],
  sniper: [
    { id:'mark_target',      isAbility:true },
    { name:'Piercing Shot',  icon:'◎', color:'#ff8844', desc:'Next shot penetrates shields entirely.' },
    { name:'Dead Eye',       icon:'⊙', color:'#ff8844', desc:'Zoom optics — triple range on next weapon fire.' },
    { name:'Ghost Bullet',   icon:'◌', color:'#ff8844', desc:'Invisible projectile — no warning to target.' },
    { name:'Execution',      icon:'◈', color:'#ff8844', desc:'Instant-kill shot on any target below 15% hull.' },
  ],
  tank: [
    { id:'quantum_brake',    isAbility:true },
    { name:'Bulwark',        icon:'▣', color:'#aaaaaa', desc:'Hardened hull plating — immune to knockback for 10 seconds.' },
    { name:'Armor Spike',    icon:'⬟', color:'#aaaaaa', desc:'Reflect a portion of incoming damage back at the attacker.' },
    { name:'Taunt',          icon:'⚠', color:'#aaaaaa', desc:'Draw all nearby enemy fire onto yourself for 8 seconds.' },
    { name:'Fortress Stance',icon:'⬡', color:'#aaaaaa', desc:'Zero movement speed, but hull and shields regen rapidly.' },
  ],
  berserker: [
    { id:'superboost',       isAbility:true },
    { name:'Blood Fury',     icon:'⚔', color:'#ff2222', desc:'Each kill increases damage dealt by 10% (stacks 5×).' },
    { name:'Rampage',        icon:'◈', color:'#ff2222', desc:'Damage triples temporarily. Hull drains fast.' },
    { name:'War Drum',       icon:'◎', color:'#ff2222', desc:'Rally fleet ships into a berserker charge.' },
    { name:'Death Dance',    icon:'⊗', color:'#ff2222', desc:'Dodge every hit for 3 seconds. Invincible, cannot fire.' },
  ],
  knight: [
    { id:'invulnerability',  isAbility:true },
    { name:'Holy Lance',     icon:'♞', color:'#ffcc00', desc:'Charge forward dealing massive hull damage on contact.' },
    { name:'Guardian',       icon:'◇', color:'#ffcc00', desc:'Transfer incoming damage from a friendly ship to yourself.' },
    { name:'Valor',          icon:'◆', color:'#ffcc00', desc:'Killing blow restores 25% hull and shields instantly.' },
    { name:'Divine Shield',  icon:'◉', color:'#ffcc00', desc:'Extend invulnerability to all nearby friendly ships for 2 seconds.' },
  ],
};
