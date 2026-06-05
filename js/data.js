'use strict';
// ── Global namespace ──────────────────────────────────────
window.G = {};

// ── Factions ──────────────────────────────────────────────
G.FACTIONS = {
  earth:     { id:'earth',     name:'Earth Government', color:'#4488ff', bgCol:'#001133', rel:  50 },
  rebellion: { id:'rebellion', name:'The Rebellion',    color:'#ff6600', bgCol:'#220800', rel:   0 },
  pirate:    { id:'pirate',    name:'Pirate Clans',     color:'#cc2222', bgCol:'#1a0000', rel: -50 },
  alien:     { id:'alien',     name:'The Shard',        color:'#00ff88', bgCol:'#001a10', rel:-100 },
  contested: { id:'contested', name:'Contested',        color:'#aaaaaa', bgCol:'#111111', rel:   0 },
  neutral:   { id:'neutral',   name:'Independent',      color:'#888888', bgCol:'#0a0a0a', rel:   0 },
};

G.FACTIONS.independent = { id:'independent', name:'Independent', color:'#aaaaaa', bgCol:'#0a0a0a', rel:0 };

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
  missiles:      { id:'missiles',       name:'Missiles',       cat:'ammo', base:350, mass:0, rarity:'u', ammoRounds:5,   desc:'5 guided missiles for missile launchers.' },
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
  { id:'rm5', name:'Craft: Mining Laser',   inputs:{metals:1, engine_parts:1},                         outputModule:'mining_laser',   time:0,  reqModule:null },
  { id:'rm6', name:'Craft: Hull Plating',   inputs:{hull_plating:3, alloys:1},                         outputModule:'hull_armor',     time:0,  reqModule:'workshop' },
  { id:'rm7', name:'Craft: Laser Cannon',   inputs:{metals:2, circuit_boards:1},                       outputModule:'laser_cannon',   time:0,  reqModule:null },
  { id:'rm8', name:'Craft: Autocannon',     inputs:{metals:3, engine_parts:1},                         outputModule:'autocannon',     time:0,  reqModule:null },
  // Ammo crafting
  { id:'ra1', name:'Kinetic Rounds',        inputs:{metals:1, polymers:1},                             output:{item:'kinetic_rounds',qty:2},  time:3,  reqModule:null },
  { id:'ra2', name:'Grenades',              inputs:{metals:1, fuel_cells:1},                           output:{item:'grenades',qty:1},        time:4,  reqModule:null },
  { id:'ra3', name:'Missiles',              inputs:{engine_parts:1, fuel_cells:2, circuit_boards:1},  output:{item:'missiles',qty:1},        time:8,  reqModule:'workshop' },
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
    damage:120, range:1400, energyCost:0, fireRate:0.45, projSpeed:420,
    color:'#ff8800', width:3, pierce:false, splash:60, tracking:true, ammo:'missiles', ammoPerShot:1,
    price:4000, mass:10, rarity:'u', desc:'Seeking missile. Tracks targets, big splash.',
    stats:'DMG:120  RNG:1400  SPLASH:60',
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
  auto_turret: {
    id:'auto_turret', name:'Auto-Turret', type:'projectile', slot:'turret',
    damage:15, range:600, energyCost:0, fireRate:6, projSpeed:850,
    color:'#ffff44', width:2, pierce:false, splash:0, turret:true, ammo:'kinetic_rounds',
    price:2500, mass:6, rarity:'u', desc:'360° auto-tracking turret.',
    stats:'DMG:15  RNG:600  360°AUTO',
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
    damage:6, range:200, energyCost:22, fireRate:5.2, projSpeed:550,
    color:'#ffcc00', width:5, pierce:false, splash:0,
    price:1500, mass:5, rarity:'c', desc:'Harvests asteroid ore on hit. Low combat damage.',
    mineRate:12,
    stats:'MINE:12/s  RNG:200  DMG:6',
  },
};

// ── Module Templates ──────────────────────────────────────
G.MODULES = {
  // Engines
  basic_engine: {
    id:'basic_engine', name:'Basic Engine', slot:'engine',
    stats:{ thrust:+12000, turnSpeed:+0.8, mass:+30 },
    energyDraw:10, hp:60, price:500, rarity:'c',
    desc:'Standard thrusters. Gets you from A to B.',
    visual:'engine',
  },
  improved_engine: {
    id:'improved_engine', name:'Improved Engine', slot:'engine',
    stats:{ thrust:+25000, turnSpeed:+1.4, mass:+50 },
    energyDraw:20, hp:80, price:1800, rarity:'u',
    desc:'High-performance thruster package.',
    visual:'engine',
  },
  military_engine: {
    id:'military_engine', name:'Military Engine', slot:'engine',
    stats:{ thrust:+40000, turnSpeed:+2.2, mass:+60 },
    energyDraw:35, hp:100, price:5000, rarity:'r',
    desc:'Military-spec afterburning engines.',
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
    stats:{ cargoSpace:+10, mass:+20 },
    energyDraw:0, hp:40, price:400, rarity:'c',
    desc:'10 units extra cargo space.',
    visual:'cargo',
  },
  medium_cargo: {
    id:'medium_cargo', name:'Cargo Hold', slot:'cargo',
    stats:{ cargoSpace:+25, mass:+40 },
    energyDraw:0, hp:60, price:1000, rarity:'c',
    desc:'25 units extra cargo space.',
    visual:'cargo',
  },
  large_cargo: {
    id:'large_cargo', name:'Large Cargo Bay', slot:'cargo',
    stats:{ cargoSpace:+50, mass:+80 },
    energyDraw:0, hp:80, price:2200, rarity:'u',
    desc:'50 units extra cargo space.',
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
    stats:{ maxEnergy:+80, energyRegen:+15, mass:+40 },
    energyDraw:0, hp:70, price:1500, rarity:'c',
    desc:'Fusion reactor. More power.',
    visual:'power',
  },
  military_reactor: {
    id:'military_reactor', name:'Military Reactor', slot:'power',
    stats:{ maxEnergy:+200, energyRegen:+40, mass:+60 },
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
    stats:{ sensorRange:+800, mass:+10 },
    energyDraw:5, hp:30, price:700, rarity:'c',
    desc:'Extends radar range.',
    visual:'sensor',
  },
  military_sensors: {
    id:'military_sensors', name:'Military Sensors', slot:'sensor',
    stats:{ sensorRange:+1800, detectCloaked:true, mass:+15 },
    energyDraw:12, hp:50, price:3000, rarity:'r',
    desc:'Detects cloaked ships.',
    visual:'sensor',
  },
  // Special
  escape_pod: {
    id:'escape_pod', name:'Escape Pod', slot:'special',
    stats:{ escapePods:+1, mass:+10 },
    energyDraw:1, hp:20, price:500, rarity:'c',
    desc:'Saves one crew on destruction.',
    visual:'special',
  },
  mining_laser: {
    id:'mining_laser', name:'Mining Laser', slot:'special',
    stats:{ canMine:true, mineRate:+10, mass:+15 },
    energyDraw:20, hp:40, price:1200, rarity:'c',
    desc:'Allows asteroid mining.',
    visual:'special',
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
};

// ── Ship Templates ────────────────────────────────────────
// Ship classes and their rep requirements for faction variants
G.SHIP_CLASSES = {
  shuttle:    { label:'SHUTTLE',          repRequired:  0 },
  miner:      { label:'MINING VESSEL',    repRequired: 10 },
  container:  { label:'CONTAINER SHIP',   repRequired: 10 },
  tanker:     { label:'FUEL TANKER',      repRequired: 10 },
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
    desc:'Small general-purpose shuttle. Cheap and versatile.',
    price:0,
    baseMass:80, baseHull:160, baseEnergy:120, baseFuel:80,
    baseThrust:15000, baseTurn:2.0, baseCargoSpace:8,
    slots:9,
    startModules:['basic_engine','jump_drive','small_cargo','escape_pod','crew_quarters','basic_sensors','reactor'],
    startWeapons:['autocannon'],
    shape:'shuttle', color:'#8899bb', size:1.0,
    expansionLimit:3,
    stats:'HULL:80  CARGO:8',
  },
  earth_shuttle: {
    id:'earth_shuttle', name:'Earth Courier', class:'shuttle', faction:'earth', repRequired:0,
    desc:'Official Earth Government light transport. Reliable and authoritative.',
    price:4000,
    baseMass:90, baseHull:190, baseEnergy:120, baseFuel:90,
    baseThrust:14000, baseTurn:2.0, baseCargoSpace:10,
    slots:10,
    startModules:['basic_engine','jump_drive','small_cargo','small_cargo','basic_sensors'],
    startWeapons:['laser_cannon'],
    shape:'earth_shuttle', color:'#4488ff', size:1.1,
    expansionLimit:3,
    stats:'HULL:95  CARGO:10  GOV',
  },
  rebel_runner: {
    id:'rebel_runner', name:'Rebel Runner', class:'shuttle', faction:'rebellion', repRequired:0,
    desc:'Fast rebel supply runner. Modded for speed and evasion.',
    price:3500,
    baseMass:75, baseHull:140, baseEnergy:130, baseFuel:90,
    baseThrust:17000, baseTurn:2.4, baseCargoSpace:8,
    slots:9,
    startModules:['improved_engine','jump_drive','small_cargo','fuel_tank'],
    startWeapons:['laser_cannon'],
    shape:'rebel_fighter', color:'#ff6600', size:0.85,
    expansionLimit:3,
    stats:'HULL:70  CARGO:8  FAST',
  },
  pirate_skiff: {
    id:'pirate_skiff', name:'Pirate Skiff', class:'shuttle', faction:'pirate', repRequired:0,
    desc:'Stripped-down scout. Cheap, expendable, surprisingly dangerous.',
    price:3000,
    baseMass:65, baseHull:120, baseEnergy:120, baseFuel:70,
    baseThrust:18000, baseTurn:2.6, baseCargoSpace:6,
    slots:8,
    startModules:['improved_engine','jump_drive','small_cargo'],
    startWeapons:['laser_cannon'],
    shape:'pirate_fighter', color:'#cc3322', size:0.85,
    expansionLimit:2,
    stats:'HULL:60  FAST  SCRAPPY',
  },
  alien_pod: {
    id:'alien_pod', name:'Shard Pod', class:'shuttle', faction:'alien', repRequired:50,
    desc:'Small alien shuttle. Alien tech gives it uncanny speed.',
    price:18000,
    baseMass:60, baseHull:160, baseEnergy:200, baseFuel:100,
    baseThrust:22000, baseTurn:3.0, baseCargoSpace:6,
    slots:9,
    startModules:['improved_engine','jump_drive','small_cargo'],
    startWeapons:['laser_cannon'],
    shape:'alien_fighter', color:'#00ff88', size:0.85,
    expansionLimit:2,
    stats:'HULL:80  ALIEN TECH  FAST',
  },

  // ── MINING VESSEL ─────────────────────────────────────────
  miner_ship: {
    id:'miner_ship', name:'Prospector', class:'miner', faction:'neutral',
    desc:'Purpose-built mining vessel with ore processing bays.',
    price:7000,
    baseMass:160, baseHull:220, baseEnergy:130, baseFuel:80,
    baseThrust:9000, baseTurn:1.2, baseCargoSpace:22,
    slots:12,
    startModules:['basic_engine','jump_drive','medium_cargo','medium_cargo','mining_laser'],
    startWeapons:['laser_cannon'],
    shape:'merchant', color:'#aa9966', size:1.4,
    expansionLimit:4,
    stats:'HULL:110  CARGO:22  MINER',
  },
  earth_miner: {
    id:'earth_miner', name:'Earth Surveyor', class:'miner', faction:'earth', repRequired:10,
    desc:'Earth Gov certified mining ship. Enhanced sensors and armored hull.',
    price:12000,
    baseMass:175, baseHull:280, baseEnergy:140, baseFuel:88,
    baseThrust:9500, baseTurn:1.2, baseCargoSpace:24,
    slots:13,
    startModules:['basic_engine','jump_drive','medium_cargo','medium_cargo','mining_laser','basic_sensors'],
    startWeapons:['laser_cannon'],
    shape:'earth_shuttle', color:'#4477cc', size:1.3,
    expansionLimit:4,
    stats:'HULL:140  CARGO:24  SURVEY',
  },
  rebel_miner: {
    id:'rebel_miner', name:'Rebel Extractor', class:'miner', faction:'rebellion', repRequired:10,
    desc:'Rebel-converted miner. Armed for hostile territory operations.',
    price:11000,
    baseMass:165, baseHull:260, baseEnergy:135, baseFuel:84,
    baseThrust:10000, baseTurn:1.3, baseCargoSpace:22,
    slots:12,
    startModules:['basic_engine','jump_drive','medium_cargo','medium_cargo','mining_laser'],
    startWeapons:['laser_cannon','autocannon'],
    shape:'rebel_hauler', color:'#cc5500', size:1.3,
    expansionLimit:4,
    stats:'HULL:130  CARGO:22  ARMED',
  },

  // ── CONTAINER SHIP ────────────────────────────────────────
  container_ship: {
    id:'container_ship', name:'Bulk Hauler', class:'container', faction:'neutral',
    desc:'Maximum cargo at minimum cost. Civilian bulk container.',
    price:20000,
    baseMass:320, baseHull:300, baseEnergy:130, baseFuel:130,
    baseThrust:6500, baseTurn:0.7, baseCargoSpace:50,
    slots:14,
    startModules:['basic_engine','jump_drive','large_cargo','large_cargo','large_cargo'],
    startWeapons:['autocannon'],
    shape:'freighter', color:'#778855', size:2.5,
    expansionLimit:6,
    stats:'HULL:150  CARGO:50  SLOW',
  },
  earth_hauler: {
    id:'earth_hauler', name:'Earth Freighter', class:'container', faction:'earth', repRequired:10,
    desc:'Earth Gov certified heavy hauler with armored cargo bays.',
    price:28000,
    baseMass:345, baseHull:380, baseEnergy:140, baseFuel:138,
    baseThrust:7000, baseTurn:0.7, baseCargoSpace:55,
    slots:16,
    startModules:['basic_engine','jump_drive','large_cargo','large_cargo','large_cargo','hull_armor'],
    startWeapons:['autocannon'],
    shape:'freighter', color:'#3366aa', size:2.6,
    expansionLimit:6,
    stats:'HULL:190  CARGO:55  ARMORED',
  },
  rebel_hauler: {
    id:'rebel_hauler', name:'Rebel Hauler', class:'container', faction:'rebellion', repRequired:10,
    desc:'Armed rebel supply ship. Runs supplies and fighters for the cause.',
    price:22000,
    baseMass:200, baseHull:280, baseEnergy:140, baseFuel:110,
    baseThrust:11000, baseTurn:1.3, baseCargoSpace:28,
    slots:15,
    startModules:['basic_engine','jump_drive','medium_cargo','medium_cargo','medium_cargo','fuel_tank'],
    startWeapons:['laser_cannon','autocannon'],
    shape:'rebel_hauler', color:'#ff6600', size:1.6,
    expansionLimit:5,
    stats:'HULL:140  CARGO:28  ARMED',
  },

  // ── FUEL TANKER ───────────────────────────────────────────
  tanker_ship: {
    id:'tanker_ship', name:'Fuel Tanker', class:'tanker', faction:'neutral',
    desc:'Dedicated fuel carrier. Enormous fuel capacity for long hauls.',
    price:18000,
    baseMass:300, baseHull:260, baseEnergy:130, baseFuel:400,
    baseThrust:6000, baseTurn:0.7, baseCargoSpace:20,
    slots:13,
    startModules:['basic_engine','jump_drive','fuel_tank','fuel_tank','large_cargo'],
    startWeapons:['autocannon'],
    shape:'freighter', color:'#886644', size:2.4,
    expansionLimit:5,
    stats:'HULL:130  FUEL:400  HAULER',
  },
  earth_tanker: {
    id:'earth_tanker', name:'Earth Tanker', class:'tanker', faction:'earth', repRequired:10,
    desc:'Military-grade fuel logistics ship. Reinforced tanks and armored hull.',
    price:26000,
    baseMass:320, baseHull:320, baseEnergy:140, baseFuel:500,
    baseThrust:6500, baseTurn:0.7, baseCargoSpace:22,
    slots:14,
    startModules:['basic_engine','jump_drive','fuel_tank','fuel_tank','fuel_tank','hull_armor'],
    startWeapons:['autocannon'],
    shape:'freighter', color:'#335599', size:2.5,
    expansionLimit:5,
    stats:'HULL:160  FUEL:500  GOV',
  },

  // ── CRUISE LINER ──────────────────────────────────────────
  cruise_liner: {
    id:'cruise_liner', name:'Cruise Liner', class:'cruise_ship', faction:'neutral',
    desc:'Luxury passenger liner. Palatial quarters, not built for war.',
    price:45000,
    baseMass:450, baseHull:500, baseEnergy:200, baseFuel:200,
    baseThrust:5500, baseTurn:0.5, baseCargoSpace:30,
    slots:20,
    startModules:['basic_engine','jump_drive','large_cargo','officer_block','officer_block','reactor'],
    startWeapons:['autocannon'],
    shape:'carrier', color:'#ccbbaa', size:3.2,
    expansionLimit:5,
    stats:'HULL:250  CREW  LUXURY',
  },
  earth_liner: {
    id:'earth_liner', name:'Earth Star Liner', class:'cruise_ship', faction:'earth', repRequired:20,
    desc:'Elite Earth Gov passenger vessel. Shielded against piracy.',
    price:65000,
    baseMass:500, baseHull:600, baseEnergy:220, baseFuel:220,
    baseThrust:6000, baseTurn:0.5, baseCargoSpace:32,
    slots:22,
    startModules:['basic_engine','jump_drive','large_cargo','officer_block','officer_block','medium_shield','reactor'],
    startWeapons:['autocannon','auto_turret'],
    shape:'carrier', color:'#4488ff', size:3.4,
    expansionLimit:5,
    stats:'HULL:300  CREW  SHIELDED',
  },

  // ── CORVETTE ──────────────────────────────────────────────
  corvette: {
    id:'corvette', name:'Corvette', class:'corvette', faction:'neutral',
    desc:'Well-balanced light warship. Fast and versatile.',
    price:18000,
    baseMass:175, baseHull:360, baseEnergy:170, baseFuel:90,
    baseThrust:19000, baseTurn:2.0, baseCargoSpace:10,
    slots:15,
    startModules:['improved_engine','light_shield','jump_drive','medium_cargo'],
    startWeapons:['laser_cannon','autocannon'],
    shape:'corvette', color:'#7799cc', size:1.8,
    expansionLimit:4,
    stats:'HULL:180  GUNS:2  BALANCED',
  },
  earth_corvette: {
    id:'earth_corvette', name:'Earth Corvette', class:'corvette', faction:'earth', repRequired:25,
    desc:'Standard Earth patrol corvette. Upgraded shields and twin laser mounts.',
    price:24000,
    baseMass:165, baseHull:360, baseEnergy:185, baseFuel:90,
    baseThrust:22000, baseTurn:2.2, baseCargoSpace:8,
    slots:16,
    startModules:['improved_engine','light_shield','jump_drive'],
    startWeapons:['laser_cannon','laser_cannon','autocannon'],
    shape:'earth_patrol', color:'#4488ff', size:1.0,
    expansionLimit:4,
    stats:'HULL:180  SHIELDS  PATROL',
  },
  rebel_corvette: {
    id:'rebel_corvette', name:'Rebel Interceptor', class:'corvette', faction:'rebellion', repRequired:25,
    desc:'Hit-and-run rebel interceptor. Fast with hard-hitting kinetics.',
    price:20000,
    baseMass:155, baseHull:320, baseEnergy:165, baseFuel:85,
    baseThrust:23000, baseTurn:2.5, baseCargoSpace:7,
    slots:15,
    startModules:['improved_engine','light_shield','jump_drive'],
    startWeapons:['laser_cannon','autocannon','autocannon'],
    shape:'rebel_fighter', color:'#ff6600', size:0.9,
    expansionLimit:4,
    stats:'HULL:160  FAST  GUNS',
  },
  pirate_corvette: {
    id:'pirate_corvette', name:'Pirate Cutter', class:'corvette', faction:'pirate', repRequired:25,
    desc:'Converted racing hull. Terrifying speed, minimal armor.',
    price:16000,
    baseMass:145, baseHull:280, baseEnergy:160, baseFuel:80,
    baseThrust:25000, baseTurn:2.7, baseCargoSpace:6,
    slots:13,
    startModules:['improved_engine','jump_drive'],
    startWeapons:['laser_cannon','autocannon','autocannon'],
    shape:'pirate_fighter', color:'#cc3322', size:0.95,
    expansionLimit:3,
    stats:'HULL:140  FASTEST  GUNS',
  },

  // ── FRIGATE ───────────────────────────────────────────────
  frigate: {
    id:'frigate', name:'Frigate', class:'frigate', faction:'neutral',
    desc:'Medium warship with solid firepower and good armor.',
    price:32000,
    baseMass:220, baseHull:500, baseEnergy:180, baseFuel:100,
    baseThrust:16000, baseTurn:1.7, baseCargoSpace:10,
    slots:17,
    startModules:['improved_engine','medium_shield','jump_drive','medium_cargo'],
    startWeapons:['heavy_laser','autocannon','autocannon'],
    shape:'fighter', color:'#8899cc', size:1.0,
    expansionLimit:5,
    stats:'HULL:250  SHIELDS  GUNS',
  },
  earth_patrol: {
    id:'earth_patrol', name:'Earth Frigate', class:'frigate', faction:'earth', repRequired:35,
    desc:'Fast Earth Gov patrol frigate. Clean delta wings, lethal at range.',
    price:42000,
    baseMass:195, baseHull:520, baseEnergy:200, baseFuel:100,
    baseThrust:20000, baseTurn:2.0, baseCargoSpace:8,
    slots:18,
    startModules:['improved_engine','medium_shield','jump_drive'],
    startWeapons:['heavy_laser','laser_cannon','autocannon'],
    shape:'earth_patrol', color:'#4488ff', size:1.0,
    expansionLimit:5,
    stats:'HULL:260  SHIELDS  FAST',
  },
  rebel_frigate: {
    id:'rebel_frigate', name:'Rebel Frigate', class:'frigate', faction:'rebellion', repRequired:35,
    desc:'Rebellion frontline frigate. Bristling with weaponry.',
    price:38000,
    baseMass:210, baseHull:480, baseEnergy:185, baseFuel:95,
    baseThrust:17000, baseTurn:1.8, baseCargoSpace:8,
    slots:17,
    startModules:['improved_engine','medium_shield','jump_drive'],
    startWeapons:['heavy_laser','autocannon','autocannon'],
    shape:'fighter', color:'#ff6600', size:1.0,
    expansionLimit:5,
    stats:'HULL:240  GUNS  REBEL',
  },
  pirate_raider: {
    id:'pirate_raider', name:'Pirate Raider', class:'frigate', faction:'pirate', repRequired:35,
    desc:'Heavy raider. Sacrifices defense for maximum offensive punch.',
    price:30000,
    baseMass:195, baseHull:420, baseEnergy:178, baseFuel:88,
    baseThrust:18000, baseTurn:1.9, baseCargoSpace:12,
    slots:16,
    startModules:['improved_engine','light_shield','jump_drive','medium_cargo'],
    startWeapons:['autocannon','autocannon','autocannon'],
    shape:'rebel_fighter', color:'#cc2200', size:1.0,
    expansionLimit:5,
    stats:'HULL:210  CARGO:12  GUNS',
  },
  alien_scout: {
    id:'alien_scout', name:'Shard Scout', class:'frigate', faction:'alien', repRequired:55,
    desc:'Alien shard-class recon vessel. Physics-bending speed.',
    price:65000,
    baseMass:175, baseHull:460, baseEnergy:260, baseFuel:120,
    baseThrust:26000, baseTurn:2.8, baseCargoSpace:6,
    slots:16,
    startModules:['improved_engine','light_shield','jump_drive'],
    startWeapons:['laser_cannon','laser_cannon'],
    shape:'alien_fighter', color:'#00ff88', size:1.0,
    expansionLimit:4,
    stats:'HULL:230  ALIEN  FAST',
  },

  // ── GUNSHIP / BOMBER ─────────────────────────────────────
  bomber: {
    id:'bomber', name:'Gunship', class:'bomber', faction:'neutral',
    desc:'Heavy weapons platform. Trades mobility for firepower.',
    price:40000,
    baseMass:240, baseHull:560, baseEnergy:190, baseFuel:100,
    baseThrust:14000, baseTurn:1.4, baseCargoSpace:8,
    slots:18,
    startModules:['basic_engine','medium_shield','jump_drive','crew_quarters'],
    startWeapons:['heavy_laser','autocannon','autocannon','autocannon'],
    shape:'gunboat', color:'#8877aa', size:1.8,
    expansionLimit:5,
    stats:'HULL:280  GUNS:4  SLOW',
  },
  earth_bomber: {
    id:'earth_bomber', name:'Earth Strike Craft', class:'bomber', faction:'earth', repRequired:40,
    desc:'Earth military strike craft. Hardened shields and long-range cannons.',
    price:52000,
    baseMass:245, baseHull:600, baseEnergy:200, baseFuel:100,
    baseThrust:14500, baseTurn:1.4, baseCargoSpace:6,
    slots:19,
    startModules:['basic_engine','medium_shield','jump_drive','heavy_armor'],
    startWeapons:['heavy_laser','heavy_laser','autocannon'],
    shape:'gunboat', color:'#336699', size:1.8,
    expansionLimit:5,
    stats:'HULL:300  ARMOR  STRIKE',
  },
  rebel_bomber: {
    id:'rebel_bomber', name:'Rebel Gunship', class:'bomber', faction:'rebellion', repRequired:40,
    desc:'Rebellion siege vessel. Overloaded with weapons, minimal defenses.',
    price:46000,
    baseMass:232, baseHull:540, baseEnergy:195, baseFuel:95,
    baseThrust:13500, baseTurn:1.5, baseCargoSpace:8,
    slots:18,
    startModules:['basic_engine','medium_shield','jump_drive'],
    startWeapons:['heavy_laser','autocannon','autocannon','missile_launcher'],
    shape:'gunboat', color:'#ff6600', size:1.7,
    expansionLimit:5,
    stats:'HULL:270  MISSILES  GUNS',
  },
  pirate_marauder: {
    id:'pirate_marauder', name:'Pirate Marauder', class:'bomber', faction:'pirate', repRequired:40,
    desc:'Pirate heavy raider. Boarding equipment and overwhelming close-range firepower.',
    price:38000,
    baseMass:228, baseHull:500, baseEnergy:183, baseFuel:90,
    baseThrust:13000, baseTurn:1.5, baseCargoSpace:14,
    slots:17,
    startModules:['basic_engine','light_shield','jump_drive','medium_cargo'],
    startWeapons:['autocannon','autocannon','autocannon','autocannon'],
    shape:'gunboat', color:'#bb2200', size:1.8,
    expansionLimit:5,
    stats:'HULL:250  CARGO:14  GUNS',
  },

  // ── DESTROYER ─────────────────────────────────────────────
  destroyer: {
    id:'destroyer', name:'Destroyer', class:'destroyer', faction:'neutral',
    desc:'Fleet escort destroyer. Balanced weapons and strong shields.',
    price:55000,
    baseMass:280, baseHull:700, baseEnergy:210, baseFuel:110,
    baseThrust:15000, baseTurn:1.5, baseCargoSpace:10,
    slots:20,
    startModules:['improved_engine','medium_shield','medium_shield','jump_drive'],
    startWeapons:['heavy_laser','heavy_laser','autocannon','auto_turret'],
    shape:'corvette', color:'#6688aa', size:2.0,
    expansionLimit:5,
    stats:'HULL:350  SHIELDS  ESCORT',
  },
  earth_destroyer: {
    id:'earth_destroyer', name:'Earth Destroyer', class:'destroyer', faction:'earth', repRequired:50,
    desc:'Earth Navy destroyer. Cutting-edge shields and precision targeting.',
    price:68000,
    baseMass:272, baseHull:720, baseEnergy:225, baseFuel:115,
    baseThrust:16000, baseTurn:1.6, baseCargoSpace:9,
    slots:21,
    startModules:['improved_engine','medium_shield','medium_shield','jump_drive','military_sensors'],
    startWeapons:['heavy_laser','heavy_laser','autocannon','auto_turret'],
    shape:'corvette', color:'#4488ff', size:2.0,
    expansionLimit:5,
    stats:'HULL:360  SHIELDS  NAVY',
  },
  rebel_destroyer: {
    id:'rebel_destroyer', name:'Rebel Destroyer', class:'destroyer', faction:'rebellion', repRequired:50,
    desc:'Rebellion warship. Raw destructive power over refinement.',
    price:60000,
    baseMass:268, baseHull:680, baseEnergy:215, baseFuel:108,
    baseThrust:15500, baseTurn:1.6, baseCargoSpace:10,
    slots:20,
    startModules:['improved_engine','medium_shield','medium_shield','jump_drive'],
    startWeapons:['heavy_laser','heavy_laser','railgun','autocannon'],
    shape:'corvette', color:'#ff6600', size:2.0,
    expansionLimit:5,
    stats:'HULL:340  RAILGUN  REBEL',
  },
  pirate_destroyer: {
    id:'pirate_destroyer', name:'Pirate Warship', class:'destroyer', faction:'pirate', repRequired:50,
    desc:'Stripped captured warship. No niceties, full of guns.',
    price:52000,
    baseMass:285, baseHull:650, baseEnergy:200, baseFuel:105,
    baseThrust:14000, baseTurn:1.4, baseCargoSpace:12,
    slots:19,
    startModules:['basic_engine','medium_shield','jump_drive','medium_cargo'],
    startWeapons:['heavy_laser','autocannon','autocannon','auto_turret'],
    shape:'gunboat', color:'#993311', size:2.0,
    expansionLimit:5,
    stats:'HULL:325  CARGO:12  GUNS',
  },

  // ── CRUISER ───────────────────────────────────────────────
  cruiser: {
    id:'cruiser', name:'Cruiser', class:'cruiser', faction:'neutral',
    desc:'Armored warship with overwhelming firepower.',
    price:80000,
    baseMass:550, baseHull:1600, baseEnergy:240, baseFuel:120,
    baseThrust:9000, baseTurn:0.85, baseCargoSpace:15,
    slots:24,
    startModules:['military_engine','heavy_shield','jump_drive','heavy_armor','military_reactor'],
    startWeapons:['heavy_laser','heavy_laser','railgun','auto_turret'],
    shape:'battlecruiser', color:'#5577aa', size:3.3,
    expansionLimit:6,
    stats:'HULL:800  FORTRESS  GUNS',
  },
  earth_cruiser: {
    id:'earth_cruiser', name:'Earth Battlecruiser', class:'cruiser', faction:'earth', repRequired:60,
    desc:'Earth Navy capital ship. Near-indestructible, bristling with weapons.',
    price:100000,
    baseMass:595, baseHull:1900, baseEnergy:260, baseFuel:130,
    baseThrust:9500, baseTurn:0.85, baseCargoSpace:15,
    slots:26,
    startModules:['military_engine','heavy_shield','heavy_shield','jump_drive','heavy_armor','military_reactor'],
    startWeapons:['heavy_laser','heavy_laser','railgun','auto_turret','auto_turret'],
    shape:'battlecruiser', color:'#336699', size:3.5,
    expansionLimit:6,
    stats:'HULL:950  SHIELDS  NAVY',
  },
  rebel_cruiser: {
    id:'rebel_cruiser', name:'Rebel Battleship', class:'cruiser', faction:'rebellion', repRequired:60,
    desc:'Rebellion siege vessel. Lacks elegance; makes up for it in devastation.',
    price:90000,
    baseMass:565, baseHull:1750, baseEnergy:245, baseFuel:120,
    baseThrust:8500, baseTurn:0.8, baseCargoSpace:15,
    slots:25,
    startModules:['military_engine','heavy_shield','jump_drive','heavy_armor','military_reactor'],
    startWeapons:['heavy_laser','railgun','railgun','auto_turret'],
    shape:'battlecruiser', color:'#ff6600', size:3.4,
    expansionLimit:6,
    stats:'HULL:875  RAILGUNS  REBEL',
  },
  pirate_battleship: {
    id:'pirate_battleship', name:'Pirate Dreadnaught', class:'cruiser', faction:'pirate', repRequired:60,
    desc:'Assembled from salvaged hulls. Hideous but terrifying.',
    price:78000,
    baseMass:575, baseHull:1600, baseEnergy:230, baseFuel:115,
    baseThrust:8000, baseTurn:0.75, baseCargoSpace:18,
    slots:23,
    startModules:['military_engine','heavy_shield','jump_drive','heavy_armor','reactor'],
    startWeapons:['heavy_laser','autocannon','autocannon','auto_turret'],
    shape:'battlecruiser', color:'#882200', size:3.4,
    expansionLimit:6,
    stats:'HULL:800  CARGO:18  SAVAGE',
  },
  alien_warship: {
    id:'alien_warship', name:'Shard Warship', class:'cruiser', faction:'alien', repRequired:75,
    desc:'Alien capital vessel. Physics-bending technology makes it lethal.',
    price:180000,
    baseMass:498, baseHull:2200, baseEnergy:400, baseFuel:150,
    baseThrust:12000, baseTurn:1.0, baseCargoSpace:12,
    slots:26,
    startModules:['military_engine','heavy_shield','heavy_shield','jump_drive','military_reactor'],
    startWeapons:['heavy_laser','heavy_laser','laser_cannon','auto_turret'],
    shape:'alien_cruiser', color:'#00ff88', size:3.5,
    expansionLimit:6,
    stats:'HULL:1100  ALIEN TECH  FAST',
  },

  // ── CARRIER ───────────────────────────────────────────────
  carrier: {
    id:'carrier', name:'Carrier', class:'carrier', faction:'neutral',
    desc:'Massive fleet carrier. Near-immobile fortress of guns and crew.',
    price:100000,
    baseMass:800, baseHull:2400, baseEnergy:300, baseFuel:200,
    baseThrust:6000, baseTurn:0.45, baseCargoSpace:20,
    slots:28,
    startModules:['military_engine','heavy_shield','jump_drive','officer_block','officer_block','military_reactor'],
    startWeapons:['railgun','auto_turret','auto_turret'],
    shape:'carrier', color:'#996633', size:4.2,
    expansionLimit:7,
    stats:'HULL:1200  DRONES  FORTRESS',
  },
  earth_carrier: {
    id:'earth_carrier', name:'Earth Supercarrier', class:'carrier', faction:'earth', repRequired:70,
    desc:'Earth Navy supercarrier. The most feared ship in the known galaxy.',
    price:130000,
    baseMass:845, baseHull:2800, baseEnergy:340, baseFuel:220,
    baseThrust:6200, baseTurn:0.45, baseCargoSpace:22,
    slots:30,
    startModules:['military_engine','heavy_shield','heavy_shield','jump_drive','officer_block','officer_block','military_reactor','military_sensors'],
    startWeapons:['railgun','railgun','auto_turret','auto_turret'],
    shape:'carrier', color:'#4488ff', size:4.5,
    expansionLimit:7,
    stats:'HULL:1400  DRONES  NAVY',
  },
  rebel_carrier: {
    id:'rebel_carrier', name:'Rebel Dreadnought', class:'carrier', faction:'rebellion', repRequired:70,
    desc:'The Rebellion\'s ultimate warship. Scarred from a hundred battles.',
    price:115000,
    baseMass:818, baseHull:2600, baseEnergy:310, baseFuel:200,
    baseThrust:6000, baseTurn:0.45, baseCargoSpace:20,
    slots:29,
    startModules:['military_engine','heavy_shield','jump_drive','officer_block','officer_block','military_reactor'],
    startWeapons:['railgun','railgun','auto_turret','auto_turret'],
    shape:'dreadnought', color:'#ff6600', size:4.5,
    expansionLimit:7,
    stats:'HULL:1300  DRONES  REBEL',
  },
};

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

// ── Asteroid types ───────────────────────────────────────
G.ASTEROID_DROPS = {
  rocky:   ['ore','ore','ore','metals','crystals'],
  icy:     ['fuel_cells','fuel_cells','polymers','crystals'],
  metallic:['ore','ore','alloys','rare_earth'],
  alien:   ['alien_metal','crystals','rare_earth','dark_matter'],
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
  scout: {
    body:  [[0,-12],[5,8],[0,5],[-5,8]],
    color: '#88ccee', enginePts: [[0,6]], engineW: 4,
  },
  fighter: {
    body:  [[0,-14],[4,4],[10,14],[4,9],[-4,9],[-10,14],[-4,4]],
    color: '#4488ff', enginePts: [[-5,11],[5,11]], engineW: 4,
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
  // Legacy alias kept for safety
  asteroid: {
    body:  [[0,-12],[8,-6],[12,2],[8,10],[2,13],[-6,12],[-12,4],[-10,-6],[-4,-12]],
    color: '#665544', enginePts: [], engineW: 0,
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
