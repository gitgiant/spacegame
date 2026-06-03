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
];

// ── Weapon Templates ──────────────────────────────────────
G.WEAPONS = {
  laser_cannon: {
    id:'laser_cannon', name:'Laser Cannon', type:'laser', slot:'weapon',
    damage:25, range:900, energyCost:18, fireRate:1.5, projSpeed:1100,
    color:'#ff4444', width:2, pierce:true, splash:0,
    price:800, mass:3, rarity:'c', desc:'Standard forward laser. Fast, energy hungry.',
    stats:'DMG:25  RNG:900  RATE:1.5/s',
  },
  heavy_laser: {
    id:'heavy_laser', name:'Heavy Laser', type:'laser', slot:'weapon',
    damage:60, range:1100, energyCost:35, fireRate:0.6, projSpeed:1200,
    color:'#ff2222', width:3, pierce:true, splash:0,
    price:2200, mass:6, rarity:'u', desc:'High-damage slow-firing laser.',
    stats:'DMG:60  RNG:1100  RATE:0.6/s',
  },
  railgun: {
    id:'railgun', name:'Railgun', type:'projectile', slot:'weapon',
    damage:80, range:1800, energyCost:40, fireRate:0.4, projSpeed:2400,
    color:'#88ccff', width:2, pierce:true, splash:0,
    price:3500, mass:8, rarity:'r', desc:'Hypersonic kinetic round. Long range, slow fire.',
    stats:'DMG:80  RNG:1800  RATE:0.4/s',
  },
  autocannon: {
    id:'autocannon', name:'Autocannon', type:'projectile', slot:'weapon',
    damage:12, range:600, energyCost:5, fireRate:5, projSpeed:900,
    color:'#ffcc44', width:2, pierce:false, splash:0,
    price:1200, mass:5, rarity:'c', desc:'Rapid-fire ballistic cannon.',
    stats:'DMG:12  RNG:600  RATE:5/s',
  },
  missile_launcher: {
    id:'missile_launcher', name:'Missile Launcher', type:'missile', slot:'weapon',
    damage:120, range:1400, energyCost:0, fireRate:0.3, projSpeed:420,
    color:'#ff8800', width:3, pierce:false, splash:60, tracking:true, ammo:'missiles',
    price:4000, mass:10, rarity:'u', desc:'Seeking missile. Tracks targets, big splash.',
    stats:'DMG:120  RNG:1400  SPLASH:60',
  },
  grenade_launcher: {
    id:'grenade_launcher', name:'Grenade Launcher', type:'explosion', slot:'weapon',
    damage:70, range:700, energyCost:8, fireRate:0.8, projSpeed:550,
    color:'#ff6600', width:4, pierce:false, splash:80,
    price:2800, mass:7, rarity:'u', desc:'Lobbed explosive. High area damage.',
    stats:'DMG:70  SPLASH:80  RATE:0.8/s',
  },
  emp_cannon: {
    id:'emp_cannon', name:'EMP Cannon', type:'emp', slot:'weapon',
    damage:0, range:800, energyCost:60, fireRate:0.3, projSpeed:700,
    color:'#aa44ff', width:4, pierce:false, splash:100, empStrength:200,
    price:5000, mass:8, rarity:'r', desc:'Disables shields & engines. No hull damage.',
    stats:'EMP:200  RNG:800  RATE:0.3/s',
  },
  artillery: {
    id:'artillery', name:'Mass Driver', type:'projectile', slot:'weapon',
    damage:200, range:2800, energyCost:80, fireRate:0.15, projSpeed:3200,
    color:'#ffffff', width:3, pierce:true, splash:0,
    price:12000, mass:20, rarity:'e', desc:'Extreme range devastation. Ship must be near-stationary.',
    stats:'DMG:200  RNG:2800  RATE:0.15/s',
  },
  auto_turret: {
    id:'auto_turret', name:'Auto-Turret', type:'projectile', slot:'turret',
    damage:15, range:600, energyCost:10, fireRate:4, projSpeed:850,
    color:'#ffff44', width:2, pierce:false, splash:0, turret:true,
    price:2500, mass:6, rarity:'u', desc:'360° auto-tracking turret.',
    stats:'DMG:15  RNG:600  360°AUTO',
  },
  plasma_cannon: {
    id:'plasma_cannon', name:'Plasma Cannon', type:'laser', slot:'weapon',
    damage:45, range:700, energyCost:30, fireRate:1.2, projSpeed:800,
    color:'#00ffcc', width:4, pierce:false, splash:30,
    price:3200, mass:6, rarity:'r', desc:'Short-range plasma glob. Melts shields.',
    stats:'DMG:45  SPLASH:30  SHIELD×2',
  },
  mining_laser_wpn: {
    id:'mining_laser_wpn', name:'Mining Laser', type:'mining', slot:'weapon',
    damage:6, range:200, energyCost:22, fireRate:3.5, projSpeed:550,
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
    stats:{ canJump:true, jumpRange:+3, mass:+40 },
    energyDraw:5, hp:60, price:2000, rarity:'c',
    desc:'Allows travel between star systems.',
    visual:'jump',
  },
  military_jump: {
    id:'military_jump', name:'Military Jump Drive', slot:'jump',
    stats:{ canJump:true, jumpRange:+6, mass:+50 },
    energyDraw:8, hp:80, price:6000, rarity:'r',
    desc:'Extended range jump drive.',
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
G.SHIPS = {
  shuttle: {
    id:'shuttle', name:'Shuttle', faction:'earth',
    desc:'A small general-purpose shuttle. Cheap and versatile.',
    price:0, // starter ship
    baseMass:80, baseHull:80, baseEnergy:120, baseFuel:80,
    baseThrust:15000, baseTurn:2.0, baseCargoSpace:8,
    slots:{ engine:1, weapon:1, cargo:1, fuel:1, jump:1, special:1, shield:0, crew:1, turret:0, armor:0, sensor:1, power:1 },
    startModules:['basic_engine','jump_drive','small_cargo','escape_pod','crew_quarters','basic_sensors','reactor'],
    startWeapons:['laser_cannon'],
    shape:'shuttle', color:'#8899bb', size:1.0,
    stats:'HULL:80  CARGO:8  SLOTS:8',
  },
  merchant: {
    id:'merchant', name:'Merchant', faction:'earth',
    desc:'A reliable cargo hauler with many cargo slots.',
    price:8000,
    baseMass:160, baseHull:120, baseEnergy:120, baseFuel:80,
    baseThrust:10000, baseTurn:1.2, baseCargoSpace:20,
    slots:{ engine:1, weapon:1, cargo:3, fuel:2, jump:1, special:1, shield:1, crew:1, turret:0, armor:0, sensor:0, power:1 },
    startModules:['basic_engine','jump_drive','medium_cargo','medium_cargo','fuel_tank'],
    startWeapons:['autocannon'],
    shape:'merchant', color:'#aacc88', size:1.2,
    stats:'HULL:120  CARGO:20  SLOTS:11',
  },
  scout: {
    id:'scout', name:'Scout', faction:'earth',
    desc:'Fast and maneuverable with excellent sensors.',
    price:6000,
    baseMass:60, baseHull:60, baseEnergy:110, baseFuel:70,
    baseThrust:22000, baseTurn:2.8, baseCargoSpace:5,
    slots:{ engine:2, weapon:1, cargo:1, fuel:1, jump:1, special:1, shield:1, crew:0, turret:0, armor:0, sensor:2, power:1 },
    startModules:['improved_engine','jump_drive','basic_sensors','small_cargo'],
    startWeapons:['laser_cannon'],
    shape:'scout', color:'#88ccee', size:0.85,
    stats:'HULL:60  SPEED:FAST  SENSORS:GOOD',
  },
  fighter: {
    id:'fighter', name:'Fighter', faction:'earth',
    desc:'Fast attack ship. High maneuverability and firepower.',
    price:10000,
    baseMass:80, baseHull:90, baseEnergy:130, baseFuel:60,
    baseThrust:25000, baseTurn:3.0, baseCargoSpace:5,
    slots:{ engine:2, weapon:3, cargo:1, fuel:1, jump:1, special:1, shield:1, crew:0, turret:0, armor:1, sensor:1, power:1 },
    startModules:['improved_engine','light_shield','jump_drive','small_cargo'],
    startWeapons:['laser_cannon','autocannon'],
    shape:'fighter', color:'#4488ff', size:0.9,
    stats:'HULL:90  WEAPONS:3  SPEED:HIGH',
  },
  gunboat: {
    id:'gunboat', name:'Gunboat', faction:'rebellion',
    desc:'Medium warship built around a heavy weapons platform.',
    price:18000,
    baseMass:150, baseHull:160, baseEnergy:160, baseFuel:80,
    baseThrust:18000, baseTurn:1.8, baseCargoSpace:10,
    slots:{ engine:1, weapon:4, cargo:1, fuel:1, jump:1, special:1, shield:2, crew:1, turret:1, armor:1, sensor:1, power:1 },
    startModules:['basic_engine','medium_shield','jump_drive','crew_quarters'],
    startWeapons:['heavy_laser','autocannon','autocannon'],
    shape:'gunboat', color:'#ff8844', size:1.2,
    stats:'HULL:160  WEAPONS:4  SHIELDS:MED',
  },
  corvette: {
    id:'corvette', name:'Corvette', faction:'earth',
    desc:'A well-balanced warship. Good at everything.',
    price:25000,
    baseMass:180, baseHull:200, baseEnergy:180, baseFuel:100,
    baseThrust:20000, baseTurn:2.0, baseCargoSpace:12,
    slots:{ engine:2, weapon:3, cargo:2, fuel:1, jump:1, special:2, shield:2, crew:1, turret:1, armor:1, sensor:1, power:1 },
    startModules:['improved_engine','medium_shield','jump_drive','medium_cargo'],
    startWeapons:['heavy_laser','autocannon','auto_turret'],
    shape:'corvette', color:'#5599ff', size:1.3,
    stats:'HULL:200  WEAPONS:3  BALANCED',
  },
  freighter: {
    id:'freighter', name:'Freighter', faction:'neutral',
    desc:'Massive cargo ship. Slow but carries enormous loads.',
    price:35000,
    baseMass:320, baseHull:180, baseEnergy:150, baseFuel:150,
    baseThrust:7000, baseTurn:0.8, baseCargoSpace:50,
    slots:{ engine:1, weapon:2, cargo:5, fuel:2, jump:1, special:2, shield:1, crew:2, turret:1, armor:1, sensor:0, power:2 },
    startModules:['basic_engine','jump_drive','large_cargo','large_cargo','large_cargo','reactor'],
    startWeapons:['autocannon'],
    shape:'freighter', color:'#888866', size:1.6,
    stats:'HULL:180  CARGO:50  SPEED:SLOW',
  },
  battlecruiser: {
    id:'battlecruiser', name:'Battlecruiser', faction:'earth',
    desc:'Armored warship with overwhelming firepower.',
    price:80000,
    baseMass:400, baseHull:400, baseEnergy:250, baseFuel:120,
    baseThrust:14000, baseTurn:1.2, baseCargoSpace:15,
    slots:{ engine:2, weapon:5, cargo:2, fuel:1, jump:1, special:2, shield:3, crew:2, turret:2, armor:2, sensor:1, power:2 },
    startModules:['military_engine','heavy_shield','heavy_shield','jump_drive','heavy_armor','military_reactor'],
    startWeapons:['heavy_laser','heavy_laser','railgun','auto_turret'],
    shape:'battlecruiser', color:'#336699', size:1.8,
    stats:'HULL:400  WEAPONS:5  HEAVILY ARMORED',
  },
  carrier: {
    id:'carrier', name:'Carrier', faction:'rebellion',
    desc:'Fighter carrier. Slow, but can deploy drone fighters.',
    price:100000,
    baseMass:500, baseHull:350, baseEnergy:300, baseFuel:200,
    baseThrust:10000, baseTurn:0.9, baseCargoSpace:20,
    slots:{ engine:2, weapon:4, cargo:2, fuel:2, jump:1, special:3, shield:3, crew:3, turret:3, armor:2, sensor:2, power:2 },
    startModules:['military_engine','heavy_shield','jump_drive','officer_block','officer_block','military_reactor','military_sensors'],
    startWeapons:['railgun','auto_turret','auto_turret'],
    shape:'carrier', color:'#996633', size:2.0,
    stats:'HULL:350  DRONES  MASSIVE',
  },
  dreadnought: {
    id:'dreadnought', name:'Dreadnought', faction:'earth',
    desc:'The ultimate warship. Barely maneuvers, nothing can stop it.',
    price:200000,
    baseMass:800, baseHull:800, baseEnergy:400, baseFuel:200,
    baseThrust:8000, baseTurn:0.6, baseCargoSpace:25,
    slots:{ engine:2, weapon:6, cargo:2, fuel:2, jump:1, special:3, shield:4, crew:3, turret:4, armor:3, sensor:2, power:3 },
    startModules:['military_engine','heavy_shield','heavy_shield','jump_drive','heavy_armor','heavy_armor','military_reactor','military_reactor'],
    startWeapons:['artillery','artillery','heavy_laser','heavy_laser','auto_turret','auto_turret'],
    shape:'dreadnought', color:'#224466', size:2.4,
    stats:'HULL:800  WEAPONS:6  INVINCIBLE',
  },
};

// ── Star Systems (100 systems) ────────────────────────────
// pos: [x,y] on galaxy map (0-950 x 0-700)
// Positions scaled: x = (orig_x-500)*1.7+475, y unchanged, jumpR *= 1.7
G.SYSTEMS = [
  // ── Earth Government Core (1-20) ──
  { id:'sol',        name:'Sol',           pos:[475,400], faction:'earth',     danger:1, starColor:'#ffff88', jumpR:153 },
  { id:'alpha_cen',  name:'Alpha Centauri',pos:[526,382], faction:'earth',     danger:1, starColor:'#ffcc88', jumpR:145 },
  { id:'barnards',   name:"Barnard's Star",pos:[429,388], faction:'earth',     danger:1, starColor:'#ff8866', jumpR:136 },
  { id:'wolf359',    name:'Wolf 359',      pos:[557,415], faction:'earth',     danger:2, starColor:'#ff6644', jumpR:136 },
  { id:'lalande',    name:'Lalande 21185', pos:[407,415], faction:'earth',     danger:2, starColor:'#ff8844', jumpR:136 },
  { id:'sirius',     name:'Sirius',        pos:[569,432], faction:'earth',     danger:2, starColor:'#cceeff', jumpR:136 },
  { id:'luyten726',  name:'Luyten 726-8',  pos:[387,432], faction:'earth',     danger:2, starColor:'#ff6633', jumpR:136 },
  { id:'ross154',    name:'Ross 154',      pos:[543,448], faction:'earth',     danger:2, starColor:'#ff5533', jumpR:136 },
  { id:'procyon',    name:'Procyon',       pos:[404,448], faction:'earth',     danger:2, starColor:'#ffffcc', jumpR:136 },
  { id:'eps_eri',    name:'Eps. Eridani',  pos:[509,462], faction:'earth',     danger:2, starColor:'#ffaa66', jumpR:145 },
  { id:'lacaille93', name:'Lacaille 9352', pos:[441,462], faction:'earth',     danger:2, starColor:'#ff7744', jumpR:136 },
  { id:'ross128',    name:'Ross 128',      pos:[591,395], faction:'earth',     danger:3, starColor:'#ff6633', jumpR:136 },
  { id:'cygni61',    name:'61 Cygni',      pos:[365,395], faction:'earth',     danger:3, starColor:'#ffaa88', jumpR:136 },
  { id:'groombr34',  name:'Groombridge 34',pos:[594,450], faction:'earth',     danger:3, starColor:'#ff8866', jumpR:136 },
  { id:'eps_ind',    name:'Eps. Indi',     pos:[359,450], faction:'earth',     danger:3, starColor:'#ffbb88', jumpR:136 },
  { id:'tau_ceti',   name:'Tau Ceti',      pos:[492,475], faction:'earth',     danger:3, starColor:'#ffcc88', jumpR:145 },
  { id:'luyten',     name:"Luyten's Star", pos:[458,475], faction:'earth',     danger:3, starColor:'#ff7755', jumpR:136 },
  { id:'kapteyn',    name:"Kapteyn's Star",pos:[620,418], faction:'earth',     danger:3, starColor:'#ffaa88', jumpR:136 },
  { id:'lacaille87', name:'Lacaille 8760', pos:[336,418], faction:'earth',     danger:3, starColor:'#ff6644', jumpR:136 },
  { id:'delta_pav',  name:'Delta Pavonis', pos:[475,492], faction:'earth',     danger:3, starColor:'#ffdd88', jumpR:136 },

  // ── Contested Inner Ring (21-40) ──
  { id:'kruger60',   name:'Kruger 60',     pos:[645,380], faction:'contested', danger:4, starColor:'#ff6633', jumpR:145 },
  { id:'gl674',      name:'Gliese 674',    pos:[308,380], faction:'contested', danger:4, starColor:'#ff5533', jumpR:136 },
  { id:'gl687',      name:'Gliese 687',    pos:[645,460], faction:'contested', danger:4, starColor:'#ff6644', jumpR:136 },
  { id:'gl412',      name:'Gliese 412',    pos:[308,460], faction:'contested', danger:4, starColor:'#ff7755', jumpR:136 },
  { id:'eri40',      name:'40 Eridani',    pos:[339,480], faction:'contested', danger:4, starColor:'#ffbb88', jumpR:136 },
  { id:'ev_lac',     name:'EV Lacertae',   pos:[614,480], faction:'contested', danger:4, starColor:'#ff4422', jumpR:136 },
  { id:'oph70',      name:'70 Ophiuchi',   pos:[671,430], faction:'contested', danger:4, starColor:'#ffcc88', jumpR:145 },
  { id:'eta_cas',    name:'Eta Cassiopeiae',pos:[280,430],faction:'contested', danger:4, starColor:'#ffdd99', jumpR:136 },
  { id:'sigma_dra',  name:'Sigma Draconis',pos:[671,360], faction:'contested', danger:4, starColor:'#ffcc88', jumpR:136 },
  { id:'eri82',      name:'82 Eridani',    pos:[280,360], faction:'contested', danger:4, starColor:'#ffcc88', jumpR:136 },
  { id:'gl667',      name:'Gliese 667',    pos:[492,508], faction:'contested', danger:4, starColor:'#ff6633', jumpR:136 },
  { id:'gl570',      name:'Gliese 570',    pos:[458,508], faction:'contested', danger:4, starColor:'#ff7744', jumpR:136 },
  { id:'vir61',      name:'61 Virginis',   pos:[696,395], faction:'contested', danger:4, starColor:'#ffdd88', jumpR:136 },
  { id:'cancri55',   name:'55 Cancri',     pos:[257,395], faction:'contested', danger:4, starColor:'#ffcc88', jumpR:136 },
  { id:'mu_cas',     name:'Mu Cassiopeiae',pos:[257,465], faction:'contested', danger:4, starColor:'#eeeeff', jumpR:136 },
  { id:'beta_vir',   name:'Beta Virginis', pos:[696,465], faction:'contested', danger:4, starColor:'#eeeeff', jumpR:136 },
  { id:'hd40307',    name:'HD 40307',      pos:[722,430], faction:'contested', danger:5, starColor:'#ff8855', jumpR:136 },
  { id:'fomalhaut',  name:'Fomalhaut',     pos:[229,430], faction:'contested', danger:5, starColor:'#cceeff', jumpR:136 },
  { id:'altair',     name:'Altair',        pos:[722,360], faction:'contested', danger:5, starColor:'#eeffff', jumpR:145 },
  { id:'vega',       name:'Vega',          pos:[229,360], faction:'contested', danger:5, starColor:'#eeeeff', jumpR:145 },

  // ── Rebellion Sector (41-60) ──
  { id:'arcturus',   name:'Arcturus',      pos:[747,330], faction:'rebellion', danger:5, starColor:'#ffbb88', jumpR:153 },
  { id:'pollux',     name:'Pollux',        pos:[203,330], faction:'rebellion', danger:5, starColor:'#ffcc88', jumpR:145 },
  { id:'capella',    name:'Capella',       pos:[761,300], faction:'rebellion', danger:5, starColor:'#ffffcc', jumpR:145 },
  { id:'aldebaran',  name:'Aldebaran',     pos:[189,300], faction:'rebellion', danger:5, starColor:'#ffaa66', jumpR:145 },
  { id:'regulus',    name:'Regulus',       pos:[764,265], faction:'rebellion', danger:5, starColor:'#eeeeff', jumpR:136 },
  { id:'castor',     name:'Castor',        pos:[186,265], faction:'rebellion', danger:5, starColor:'#eeeeff', jumpR:136 },
  { id:'deneb',      name:'Deneb',         pos:[767,230], faction:'rebellion', danger:6, starColor:'#eeeeff', jumpR:145 },
  { id:'bellatrix',  name:'Bellatrix',     pos:[183,230], faction:'rebellion', danger:6, starColor:'#ccddff', jumpR:136 },
  { id:'spica',      name:'Spica',         pos:[501,530], faction:'rebellion', danger:6, starColor:'#cceeff', jumpR:145 },
  { id:'antares',    name:'Antares',       pos:[450,530], faction:'rebellion', danger:6, starColor:'#ff8844', jumpR:145 },
  { id:'canopus',    name:'Canopus',       pos:[523,548], faction:'rebellion', danger:5, starColor:'#eeeeff', jumpR:136 },
  { id:'achernar',   name:'Achernar',      pos:[427,548], faction:'rebellion', danger:5, starColor:'#cceeff', jumpR:136 },
  { id:'mirfak',     name:'Mirfak',        pos:[543,565], faction:'rebellion', danger:6, starColor:'#eeeeff', jumpR:136 },
  { id:'adhara',     name:'Adhara',        pos:[407,565], faction:'rebellion', danger:6, starColor:'#cceeff', jumpR:136 },
  { id:'wezen',      name:'Wezen',         pos:[563,580], faction:'rebellion', danger:6, starColor:'#ffffcc', jumpR:136 },
  { id:'furud',      name:'Furud',         pos:[387,580], faction:'rebellion', danger:6, starColor:'#aaddff', jumpR:136 },
  { id:'mirzam',     name:'Mirzam',        pos:[584,592], faction:'rebellion', danger:6, starColor:'#cceeff', jumpR:136 },
  { id:'alnilam',    name:'Alnilam',       pos:[366,592], faction:'rebellion', danger:6, starColor:'#cceeff', jumpR:136 },
  { id:'rigel',      name:'Rigel',         pos:[781,350], faction:'rebellion', danger:6, starColor:'#ccddff', jumpR:145 },
  { id:'betelgeuse', name:'Betelgeuse',    pos:[169,350], faction:'rebellion', danger:6, starColor:'#ff8866', jumpR:145 },

  // ── Pirate Badlands (61-80) ──
  { id:'saiph',      name:'Saiph',         pos:[604,605], faction:'pirate',    danger:6, starColor:'#cceeff', jumpR:136 },
  { id:'aludra',     name:'Aludra',        pos:[346,605], faction:'pirate',    danger:6, starColor:'#eeeeff', jumpR:136 },
  { id:'zeta_pup',   name:'Zeta Puppis',   pos:[628,616], faction:'pirate',    danger:7, starColor:'#88ccff', jumpR:136 },
  { id:'naos',       name:'Naos',          pos:[322,616], faction:'pirate',    danger:7, starColor:'#88aaff', jumpR:136 },
  { id:'algol',      name:'Algol',         pos:[798,290], faction:'pirate',    danger:7, starColor:'#ccddff', jumpR:145, noStar:true },
  { id:'mira',       name:'Mira',          pos:[152,290], faction:'pirate',    danger:7, starColor:'#ff8866', jumpR:136 },
  { id:'dubhe',      name:'Dubhe',         pos:[812,250], faction:'pirate',    danger:7, starColor:'#ffcc88', jumpR:136 },
  { id:'merak',      name:'Merak',         pos:[138,250], faction:'pirate',    danger:7, starColor:'#ffffcc', jumpR:136 },
  { id:'phecda',     name:'Phecda',        pos:[815,210], faction:'pirate',    danger:7, starColor:'#eeeeff', jumpR:136 },
  { id:'megrez',     name:'Megrez',        pos:[135,210], faction:'pirate',    danger:7, starColor:'#eeeeff', jumpR:136 },
  { id:'alioth',     name:'Alioth',        pos:[815,170], faction:'pirate',    danger:7, starColor:'#eeeeff', jumpR:136 },
  { id:'mizar',      name:'Mizar',         pos:[135,170], faction:'pirate',    danger:7, starColor:'#eeeeff', jumpR:136 },
  { id:'alkaid',     name:'Alkaid',        pos:[812,130], faction:'pirate',    danger:8, starColor:'#cceeff', jumpR:136 },
  { id:'thuban',     name:'Thuban',        pos:[138,130], faction:'pirate',    danger:8, starColor:'#ffcc88', jumpR:136 },
  { id:'eltanin',    name:'Eltanin',       pos:[807,92],  faction:'pirate',    danger:8, starColor:'#ffaa88', jumpR:136 },
  { id:'rastaban',   name:'Rastaban',      pos:[144,92],  faction:'pirate',    danger:8, starColor:'#ff9966', jumpR:136 },
  { id:'eta_car',    name:'Eta Carinae',   pos:[652,626], faction:'pirate',    danger:8, starColor:'#ffcc44', jumpR:136, noStar:true },
  { id:'gam_vel',    name:'Gamma Velorum', pos:[298,626], faction:'pirate',    danger:8, starColor:'#88ccff', jumpR:136 },
  { id:'eps_car',    name:'Eps. Carinae',  pos:[676,638], faction:'pirate',    danger:8, starColor:'#aaddff', jumpR:136 },
  { id:'del_vel',    name:'Delta Velorum', pos:[274,638], faction:'pirate',    danger:8, starColor:'#cceeff', jumpR:136 },

  // ── Alien Frontier (81-100) ──
  { id:'kochab',     name:'Kochab',        pos:[798,55],  faction:'alien',     danger:8, starColor:'#ffaa66', jumpR:145 },
  { id:'pherkad',    name:'Pherkad',       pos:[152,55],  faction:'alien',     danger:8, starColor:'#ffcc88', jumpR:145 },
  { id:'alphecca',   name:'Alphecca',      pos:[798,22],  faction:'alien',     danger:9, starColor:'#eeeeff', jumpR:145 },
  { id:'unukalhai',  name:'Unukalhai',     pos:[152,22],  faction:'alien',     danger:9, starColor:'#ff9966', jumpR:145 },
  { id:'graffias',   name:'Graffias',      pos:[699,650], faction:'alien',     danger:9, starColor:'#aaddff', jumpR:136 },
  { id:'dschubba',   name:'Dschubba',      pos:[251,650], faction:'alien',     danger:9, starColor:'#88ccff', jumpR:136 },
  { id:'zuben_el',   name:'Zubenelgenubi', pos:[722,660], faction:'alien',     danger:9, starColor:'#88bbff', jumpR:136 },
  { id:'zuben_es',   name:'Zubeneschamali',pos:[229,660], faction:'alien',     danger:9, starColor:'#aaeeff', jumpR:136 },
  { id:'syrma',      name:'Syrma',         pos:[744,668], faction:'alien',     danger:9, starColor:'#88aaff', jumpR:136 },
  { id:'porrima',    name:'Porrima',       pos:[206,668], faction:'alien',     danger:9, starColor:'#aaddff', jumpR:136 },
  { id:'vindem',     name:'Vindemiatrix',  pos:[764,675], faction:'alien',     danger:9, starColor:'#cceeff', jumpR:136 },
  { id:'minelauva',  name:'Minelauva',     pos:[186,675], faction:'alien',     danger:9, starColor:'#aaddff', jumpR:136 },
  { id:'zaniah',     name:'Zaniah',        pos:[781,682], faction:'alien',     danger:10,starColor:'#88aaff', jumpR:136 },
  { id:'heze',       name:'Heze',          pos:[169,682], faction:'alien',     danger:10,starColor:'#88ccff', jumpR:136 },
  { id:'yed_prior',  name:'Yed Prior',     pos:[798,688], faction:'alien',     danger:10,starColor:'#66aaff', jumpR:136 },
  { id:'phecda2',    name:'Phecda II',     pos:[67,55],   faction:'alien',     danger:10,starColor:'#88bbff', jumpR:136 },
  { id:'theta_car',  name:'Theta Carinae', pos:[883,55],  faction:'alien',     danger:10,starColor:'#aaddff', jumpR:136 },
  { id:'theia',      name:'Theia Prime',   pos:[900,380], faction:'alien',     danger:10,starColor:'#00ff88', jumpR:145 },
  { id:'khaal',      name:"Kha'al System", pos:[50,380],  faction:'alien',     danger:10,starColor:'#00ffaa', jumpR:145, noStar:true },
  { id:'void',       name:'The Void',      pos:[475,690], faction:'alien',     danger:10,starColor:'#4400ff', jumpR:136, noStar:true },
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
  asteroid: {
    body:  [[0,-12],[8,-6],[12,2],[8,10],[2,13],[-6,12],[-12,4],[-10,-6],[-4,-12]],
    color: '#665544', enginePts: [], engineW: 0,
  },
  planet_icon: {
    body:  [],
    color: '#4466ff', enginePts: [], engineW: 0,
  },
};
