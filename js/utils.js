'use strict';
// ── Math / Vector utilities ───────────────────────────────

G.v2 = {
  add:  (a,b)   => ({x:a.x+b.x, y:a.y+b.y}),
  sub:  (a,b)   => ({x:a.x-b.x, y:a.y-b.y}),
  scale:(v,s)   => ({x:v.x*s,   y:v.y*s}),
  len:  (v)     => Math.sqrt(v.x*v.x+v.y*v.y),
  dist: (a,b)   => Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2),
  norm: (v)     => { const l=G.v2.len(v)||1; return {x:v.x/l,y:v.y/l}; },
  dot:  (a,b)   => a.x*b.x+a.y*b.y,
  angle:(v)     => Math.atan2(v.x, -v.y),
  fromAngle:(a) => ({x:Math.sin(a), y:-Math.cos(a)}),
};

G.lerp = (a,b,t) => a + (b-a)*t;
G.clamp = (v,mn,mx) => Math.max(mn,Math.min(mx,v));
G.rand = (a,b) => a + Math.random()*(b-a);
G.randInt = (a,b) => a + Math.floor(Math.random()*(b-a+1));
G.randEl = (arr) => arr[Math.floor(Math.random()*arr.length)];
G.fmt = (n) => Math.round(n).toLocaleString();
G.pct = (v,mx) => G.clamp(v/mx*100,0,100);

// Seeded random — always returns [0, 1) without sign issues
G.seededRng = function(seed) {
  let s = typeof seed === 'string'
    ? seed.split('').reduce((a,c)=>((a<<5)-a)+c.charCodeAt(0)|0, 0)
    : seed|0;
  // Keep s positive with double-mod trick
  return () => { s = ((s*9301+49297)%233280+233280)%233280; return s/233280; };
};

// Circle-circle collision
G.circleHit = (ax,ay,ar, bx,by,br) => (ax-bx)**2+(ay-by)**2 < (ar+br)**2;

// Wrap angle to [-π,π]
G.wrapAngle = (a) => { while(a>Math.PI)a-=Math.PI*2; while(a<-Math.PI)a+=Math.PI*2; return a; };

// Format credits
G.fmtCredits = (n) => '$ '+Math.round(n).toLocaleString();

// Rarity color helper
G.rarityColor = (r) => G.RARITY[r]?.color || '#cccccc';
G.rClass = (r) => G.RARITY[r]?.cls || 'rarity-c';

// Generate a local system (planets, asteroids, stations) from system data
G.generateLocalSystem = function(sys) {
  const rng = G.seededRng(sys.id + '_local');
  const bodies = [];
  const dangerF = sys.danger;

  const planetColors = { rocky:'#887766',ice:'#aaccff',lava:'#ff4422',ocean:'#2266ff',
    gas:'#ffaa66',terran:'#44aa44',desert:'#ccaa66' };

  if(sys.noStar) {
    // Starless system: asteroid bases and deep-space stations only
    const noStarStTypes = ['Asteroid Base','Deep Space Station','Rogue Outpost','Salvage Depot','Dark Station'];
    const nStations = 1 + Math.floor(rng()*3);
    for(let i=0;i<nStations;i++){
      const dist = 600+rng()*2500;
      const angle = rng()*Math.PI*2;
      const stype = noStarStTypes[Math.floor(rng()*noStarStTypes.length)];
      bodies.push({
        type:'station',
        x:Math.cos(angle)*dist, y:Math.sin(angle)*dist,
        r:18, orbitR:dist, orbitAngle:angle, orbitSpeed:(rng()*0.0001)*(rng()<0.5?1:-1),
        stype, color:'#888899',
        name: sys.name+' '+stype,
        hasSpaceport: true,
        faction: sys.faction,
      });
    }
  } else {
    // Star at center
    bodies.push({ type:'star', x:0, y:0, r:40+rng()*20, color:sys.starColor, name:sys.name+' Star' });

    // Sol system gets real planet names and types
    if(sys.id === 'sol') {
      const solPlanets = [
        { name:'Mercury', ptype:'rocky',  r:6,  dist:420,  hasPort:false, color:'#aaa088' },
        { name:'Venus',   ptype:'lava',   r:14, dist:720,  hasPort:false, color:'#ddaa44' },
        { name:'Earth',   ptype:'terran', r:18, dist:1050, hasPort:true,  color:'#2266ff' },
        { name:'Mars',    ptype:'desert', r:10, dist:1500, hasPort:true,  color:'#cc5533' },
        { name:'Jupiter', ptype:'gas',    r:52, dist:2800, hasPort:false, color:'#ddaa88' },
        { name:'Saturn',  ptype:'gas',    r:44, dist:3800, hasPort:false, color:'#ccbb88' },
        { name:'Uranus',  ptype:'ice',    r:28, dist:4700, hasPort:false, color:'#88ccdd' },
        { name:'Neptune', ptype:'ocean',  r:26, dist:5600, hasPort:false, color:'#2244aa' },
      ];
      for(let i=0;i<solPlanets.length;i++){
        const sp = solPlanets[i];
        const angle = rng()*Math.PI*2;
        const orbitSpeed = (0.0001 + (solPlanets.length-i)*0.00004)*(rng()<0.5?1:-1);
        bodies.push({
          type:'planet', x:Math.cos(angle)*sp.dist, y:Math.sin(angle)*sp.dist,
          r:sp.r, orbitR:sp.dist, orbitAngle:angle, orbitSpeed,
          ptype:sp.ptype, color:sp.color, name:sp.name,
          hasSpaceport:sp.hasPort, spaceportName:sp.hasPort?(sp.name+' Station'):null,
          faction:'earth',
        });
      }
    } else {
      // Planets
      const nPlanets = Math.floor(rng()*5)+1;
      const planetTypes = ['rocky','ice','lava','ocean','gas','terran','desert'];
      for(let i=0;i<nPlanets;i++){
        const dist = 1200 + i*1800 + rng()*600;
        const angle = rng()*Math.PI*2;
        const ptype = planetTypes[Math.floor(rng()*planetTypes.length)];
        const sizeClass = rng();
        const r = sizeClass>0.97 ? 55+rng()*30
                : sizeClass>0.85 ? 35+rng()*20
                : sizeClass>0.55 ? 20+rng()*12
                : 8+rng()*10;
        const hasPort = rng() < (ptype==='terran'?0.9:ptype==='ocean'?0.6:r>30?0.4:0.15);
        bodies.push({
          type:'planet',
          x: Math.cos(angle)*dist,
          y: Math.sin(angle)*dist,
          r, orbitR:dist, orbitAngle:angle, orbitSpeed:(rng()*0.00025+0.00006)*(rng()<0.5?1:-1),
          ptype, color:planetColors[ptype],
          name: sys.name+' '+(['I','II','III','IV','V'][i]||'VI'),
          hasSpaceport: hasPort,
          spaceportName: hasPort ? (sys.name+' Spaceport') : null,
          faction: sys.faction,
        });
      }
    }

    // Space stations
    const nStations = rng() < 0.6 ? 1 : (rng() < 0.3 ? 2 : 0);
    const stTypes = ['Trading Post','Military Base','Research Station','Refueling Depot','Rebel Outpost','Pirate Haven'];
    for(let i=0;i<nStations;i++){
      const dist = 800+rng()*2000;
      const angle = rng()*Math.PI*2;
      const stype = stTypes[Math.floor(rng()*stTypes.length)];
      bodies.push({
        type:'station',
        x:Math.cos(angle)*dist, y:Math.sin(angle)*dist,
        r:18, orbitR:dist, orbitAngle:angle, orbitSpeed:(rng()*0.0001)*(rng()<0.5?1:-1),
        stype, color:'#aaaacc',
        name: sys.name+' '+stype,
        hasSpaceport: true,
        faction: sys.faction,
      });
    }

    // Comets — occasional wide-orbit bodies around the star
    const nComets = rng() < 0.55 ? Math.floor(rng()*2)+1 : 0;
    for(let i=0;i<nComets;i++){
      const orbitR = 6000 + rng()*8000;
      const angle  = rng()*Math.PI*2;
      const speed  = (0.00003 + rng()*0.00004) * (rng()<0.5?1:-1);
      bodies.push({
        type:'comet',
        x: Math.cos(angle)*orbitR, y: Math.sin(angle)*orbitR,
        r: 4 + rng()*4,
        orbitR, orbitAngle:angle, orbitSpeed:speed,
        color:'#aaddff',
      });
    }
  }

  // Asteroid fields (multiple chunks)
  const nFields = Math.floor(rng()*3)+1;
  const aField = [];
  for(let f=0;f<nFields;f++){
    const fieldAngle = rng()*Math.PI*2;
    const fieldDist  = 1500 + rng()*3000;
    const nAsteroids = 8 + Math.floor(rng()*16);
    const atype = rng()<0.3?'metallic':rng()<0.3?'icy':rng()<0.1&&dangerF>7?'alien':'rocky';
    for(let a=0;a<nAsteroids;a++){
      const ox = Math.cos(fieldAngle)*fieldDist + (rng()-0.5)*600;
      const oy = Math.sin(fieldAngle)*fieldDist + (rng()-0.5)*600;
      aField.push({
        type:'asteroid', x:ox, y:oy,
        vx:(rng()-0.5)*15, vy:(rng()-0.5)*15,
        r:16+rng()*20, atype,
        angle:rng()*Math.PI*2, rotSpeed:(rng()-0.5)*0.5,
        maxHp:30+Math.floor(rng()*40), hp:0, // set to maxHp after push
        drops: G.ASTEROID_DROPS[atype] || G.ASTEROID_DROPS.rocky,
        color: atype==='metallic'?'#998877':atype==='icy'?'#aaccdd':atype==='alien'?'#44cc88':'#776655',
      });
      aField[aField.length-1].hp = aField[aField.length-1].maxHp;
    }
  }

  // Derelict ships (random chance, more in dangerous systems)
  const nDerelicts = rng() < (0.1*dangerF/5) ? Math.floor(rng()*2)+1 : 0;
  const derelicts = [];
  const shipIds = Object.keys(G.SHIPS);
  for(let i=0;i<nDerelicts;i++){
    const angle = rng()*Math.PI*2;
    const dist  = 1000+rng()*4000;
    const shipId = shipIds[Math.floor(rng()*shipIds.length)];
    derelicts.push({
      type:'derelict', x:Math.cos(angle)*dist, y:Math.sin(angle)*dist,
      shipId, looted:false,
      lootQty: 2+Math.floor(rng()*5),
      rng: rng(),
    });
  }

  // Defensive turrets near some planets/stations
  const turrets = [];
  const turretParents = bodies.filter(b => b.type === 'planet' || b.type === 'station');
  for(const parent of turretParents) {
    const chance = parent.type === 'station' ? 0.5 : 0.25;
    if(rng() < chance) {
      const count = 1 + Math.floor(rng() * 2);
      for(let t = 0; t < count; t++) {
        const orbitR = (parent.r || 20) * 2.5 + 50 + t * 70;
        const orbitAngle = rng() * Math.PI * 2;
        turrets.push({
          type:'turret',
          x: parent.x + Math.cos(orbitAngle) * orbitR,
          y: parent.y + Math.sin(orbitAngle) * orbitR,
          orbitR, orbitAngle,
          orbitSpeed: (rng() * 0.0003 + 0.00005) * (rng() < 0.5 ? 1 : -1),
          orbitParent: parent,
          hp: 100, maxHp: 100,
          faction: sys.faction,
          weaponCooldown: rng() * 2,
          range: 380,
          damage: 15 + Math.floor(rng() * 20),
          fireRate: 0.5 + rng() * 0.6,
          hostile: false,
          _dead: false,
          _attackedByPlayer: false,
        });
      }
    }
  }

  return { bodies, asteroids:aField, derelicts, turrets };
};

// Build hyperspace connections between systems
G.buildHyperspaceRoutes = function() {
  const sys = G.SYSTEMS;
  const routes = {};
  sys.forEach(s => routes[s.id] = []);

  sys.forEach((a,i) => {
    // Find all systems within jumpR of a
    sys.forEach((b,j) => {
      if(i===j) return;
      const dx = a.pos[0]-b.pos[0];
      const dy = a.pos[1]-b.pos[1];
      const d = Math.sqrt(dx*dx+dy*dy);
      const maxR = Math.max(a.jumpR||80, b.jumpR||80);
      if(d <= maxR) {
        if(!routes[a.id].includes(b.id)) routes[a.id].push(b.id);
        if(!routes[b.id].includes(a.id)) routes[b.id].push(a.id);
      }
    });
    // Ensure every system has at least 1 connection (find nearest)
    if(routes[a.id].length === 0) {
      let nearIdx=0, nearD=Infinity;
      sys.forEach((b,j) => {
        if(i===j)return;
        const d=Math.sqrt((a.pos[0]-b.pos[0])**2+(a.pos[1]-b.pos[1])**2);
        if(d<nearD){nearD=d;nearIdx=j;}
      });
      routes[a.id].push(sys[nearIdx].id);
      routes[sys[nearIdx].id].push(a.id);
    }
  });
  return routes;
};

// Generate enemy ships for a system
G.genEnemyShips = function(sys, count) {
  const danger  = sys.danger;
  const faction = sys.faction;
  const enemies = [];
  const rng     = Math.random;

  // Earth gov safe zones: no hostile enemy spawns at danger 1-2
  if(faction==='earth' && danger <= 2) return [];

  const pirateShips = ['pirate_fighter','pirate_fighter','gunboat','corvette'];
  const alienShips  = ['alien_fighter','alien_fighter','alien_cruiser'];
  const rebelShips  = ['fighter','gunboat','corvette'];

  for(let i=0;i<count;i++){
    let shapeId, col, shipFaction;
    if(faction==='pirate'||faction==='contested'){
      shapeId = pirateShips[Math.floor(rng()*pirateShips.length)];
      col='#cc3322'; shipFaction='pirate';
    } else if(faction==='alien'){
      shapeId = alienShips[Math.floor(rng()*alienShips.length)];
      col='#00ff88'; shipFaction='alien';
    } else if(faction==='rebellion'){
      shapeId = rebelShips[Math.floor(rng()*rebelShips.length)];
      col='#ff6600'; shipFaction='rebellion';
    } else {
      // Earth territory danger 3+: rare pirate raider only
      if(rng() > 0.35) continue;
      shapeId='pirate_fighter'; col='#cc2222'; shipFaction='pirate';
    }

    const angle = rng()*Math.PI*2;
    const dist  = 1500+rng()*3000;
    const hp = 60+danger*15 + rng()*40;
    const shields = danger>3 ? (danger-3)*20+rng()*30 : 0;
    const speed   = 280 + danger*40 + rng()*180;
    const damage  = 10+danger*4+rng()*10;
    const credits = Math.floor(50+danger*30+rng()*100);
    const cargoDrops = Math.floor(rng()*3);

    enemies.push({
      type:'enemy',
      x:Math.cos(angle)*dist, y:Math.sin(angle)*dist,
      vx:0, vy:0, angle:0,
      hp, maxHp:hp, shields, maxShields:shields,
      energy:100, maxEnergy:100,
      speed, turnSpeed:1.5+rng()*1.5,
      damage, fireRate:0.8+rng()*0.8, lastShot:0,
      credits, cargoDrops,
      shapeId, color:col,
      faction:shipFaction,
      aiState:'patrol',
      patrolAngle:rng()*Math.PI*2,
      patrolDist:600+rng()*800,
      patrolCenter:{x:Math.cos(angle)*dist*0.5, y:Math.sin(angle)*dist*0.5},
      disabled:false, boarded:false,
    });
  }
  return enemies;
};

// Loot generation from enemy
G.genLoot = function(danger, credits) {
  const drops = [];
  const items = Object.values(G.ITEMS).filter(it=>it.cat!=='mission');
  const nDrops = Math.floor(Math.random()*3) + (danger>5?2:1);

  for(let i=0;i<nDrops;i++){
    const rn = Math.random();
    let rarity;
    if(rn < 0.5)       rarity='c';
    else if(rn < 0.75) rarity='u';
    else if(rn < 0.9)  rarity='r';
    else if(rn < 0.98) rarity='e';
    else               rarity='l';

    // Weighted by system danger
    if(danger<3 && rarity==='r') rarity='u';
    if(danger<5 && rarity==='e') rarity='r';
    if(danger<8 && rarity==='l') rarity='e';

    const candidates = items.filter(it=>it.rarity===rarity);
    if(candidates.length===0) continue;
    const item = G.randEl(candidates);
    drops.push({ id:item.id, qty:1+Math.floor(Math.random()*3), rarity });
  }
  return drops;
};

// Price variation per market (±12% from base — close enough that accidental
// buy-high/sell-low trades are small losses rather than financial ruin).
// Faction and danger modifiers create intentional trade routes without huge swings.
G.marketPrice = function(itemId, sysId) {
  const item = G.ITEMS[itemId];
  if(!item) return 0;
  const rng = G.seededRng(itemId+'_'+sysId);

  // Small deterministic noise: ±12%
  const noise = 0.88 + rng()*0.24;

  // Faction modifier: gives a reason to trade between regions, but capped
  const sys = G.SYSTEMS.find(s=>s.id===sysId);
  let factionMod = 1.0;
  if(sys) {
    if(item.cat==='raw'    && sys.faction==='pirate')      factionMod = 0.88; // pirates sell raw cheap
    if(item.cat==='goods'  && sys.faction==='earth')       factionMod = 0.90; // earth gov goods cheap
    if(item.cat==='luxury' && sys.faction==='alien')       factionMod = 0.80; // alien art cheap at source
    if(item.cat==='raw'    && sys.faction==='earth')       factionMod = 1.12; // earth pays more for raw
    if(item.cat==='goods'  && sys.faction==='pirate')      factionMod = 1.15; // pirates pay for goods
    if(item.id==='alien_metal' && sys.faction!=='alien')   factionMod = 1.40; // alien metal rare elsewhere
    if(item.id==='weapons_cache' && sys.faction==='rebellion') factionMod = 0.85;
  }

  return Math.max(1, Math.round(item.base * noise * factionMod));
};

// ── Comms forgiveness helpers ─────────────────────────────
G.npcForgivenessCost = function(faction) {
  const rel = G.game?.getRel(faction) || 0;
  const base = { pirate:400, independent:300, rebellion:600, earth:700, alien:9999 };
  return Math.max(200, (base[faction]||500) + Math.floor(Math.max(0,-rel)*8));
};

G.npcForgivenessChance = function(faction) {
  return { pirate:0.55, independent:0.65, rebellion:0.30, earth:0.25, alien:0 }[faction] ?? 0.35;
};

// No-response probability when player hails a target
G.commsNoResponseChance = function(target) {
  if(target.type === 'enemy') {
    return target.faction === 'alien' ? 0.95 : 0.65;
  }
  if(target.type === 'npc' && target.hostile) return 0.30;
  return 0;
};
