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

// ── Cluster-based galaxy layout ───────────────────────────
// Runs here (utils.js) so G.seededRng is available; data.js loads before utils.js.
(function() {
  const rng = G.seededRng('galaxy_cluster_v1');

  function place(cx, cy, rx, ry, n) {
    const pts = [], minD = 22;
    for (let i = 0; i < n; i++) {
      let x, y, ok, tries = 0;
      do {
        const a = rng() * Math.PI * 2;
        const r = 0.12 + Math.sqrt(rng()) * 0.88;
        x = Math.round(cx + Math.cos(a) * r * rx);
        y = Math.round(cy + Math.sin(a) * r * ry);
        ok = x > 20 && x < 930 && y > 20 && y < 680;
        if (ok) for (const [px, py] of pts)
          if (Math.hypot(x - px, y - py) < minD) { ok = false; break; }
        tries++;
      } while (!ok && tries < 80);
      pts.push([x, y]);
    }
    return pts;
  }

  const layout = [
    { faction: 'earth',       cx: 228, cy: 262, rx: 180, ry: 150, count: 30 },
    { faction: 'rebellion',   cx: 722, cy: 262, rx: 180, ry: 150, count: 30 },
    { faction: 'independent', cx: 475, cy: 245, rx: 85,  ry: 72,  count: 10 },
    { faction: 'neutral',     cx: 475, cy: 548, rx: 122, ry: 80,  count: 10 },
    { faction: 'pirate',      cx: 194, cy: 530, rx: 155, ry: 96,  count: 10 },
    { faction: 'alien',       cx: 756, cy: 530, rx: 155, ry: 96,  count: 10 },
  ];

  const sorted = [...G.SYSTEMS].sort((a, b) =>
    a.id === 'sol' ? -1 : b.id === 'sol' ? 1 : a.danger - b.danger
  );

  let si = 0;
  for (const { faction, cx, cy, rx, ry, count } of layout) {
    const positions = place(cx, cy, rx, ry, count);
    for (let i = 0; i < count; i++, si++) {
      sorted[si].pos = positions[i];
      sorted[si].faction = faction;
    }
  }

  G.SYSTEMS.find(s => s.id === 'sol').pos = [228, 262];
})();

// Circle-circle collision
G.circleHit = (ax,ay,ar, bx,by,br) => (ax-bx)**2+(ay-by)**2 < (ar+br)**2;

// Wrap angle to [-π,π]
G.wrapAngle = (a) => { while(a>Math.PI)a-=Math.PI*2; while(a<-Math.PI)a+=Math.PI*2; return a; };

// Format credits
G.fmtCredits = (n) => '$ '+Math.round(n).toLocaleString();

// Rarity color helper
G.rarityColor = (r) => G.RARITY[r]?.color || '#cccccc';

// Generate a local system (planets, asteroids, stations) from system data
G.generateLocalSystem = function(sys) {
  const rng = G.seededRng(sys.id + '_local');
  const bodies = [];
  const dangerF = sys.danger;

  // ── Environment: nebula, asteroid ring, extra dust ───────
  const envRng = G.seededRng(sys.id + '_env');

  const nebulaPalette = [
    { type:'nebula_blue',   fog:'#0d1f6e', starTint:[100,140,255] },
    { type:'nebula_purple', fog:'#3d0860', starTint:[190,100,255] },
    { type:'nebula_red',    fog:'#5a0f0f', starTint:[255,120,100] },
    { type:'nebula_teal',   fog:'#044a4a', starTint:[ 60,200,210] },
  ];
  const hasNebula   = envRng() < 0.30;
  const nebulaDef   = nebulaPalette[Math.floor(envRng() * nebulaPalette.length)];
  const nebulaIntensity = 0.30 + envRng() * 0.45;
  const nebula = hasNebula ? { ...nebulaDef, intensity: nebulaIntensity } : null;

  // Asteroid ring ~24% of systems — tight belt around center
  const hasRing  = envRng() < 0.24;
  const ringR    = 3500 + envRng() * 4000;
  const ringW    = 350  + envRng() * 500;
  const ringAsteroids = [];
  if(hasRing) {
    const rCount = 60 + Math.floor(envRng() * 80);
    const atype  = envRng() < 0.28 ? 'metallic' : envRng() < 0.38 ? 'icy' : 'rocky';
    for(let i = 0; i < rCount; i++) {
      const ang = (i / rCount) * Math.PI * 2 + (envRng()-0.5)*0.18;
      const r   = ringR + (envRng()-0.5) * ringW;
      const sz  = 7 + envRng() * 16;
      const ra  = {
        type:'asteroid', x:Math.cos(ang)*r, y:Math.sin(ang)*r,
        vx:(envRng()-0.5)*5, vy:(envRng()-0.5)*5,
        r:sz, atype,
        angle:envRng()*Math.PI*2, rotSpeed:(envRng()-0.5)*0.25,
        maxHp:30+Math.floor(envRng()*50), hp:0,
        drops:G.ASTEROID_DROPS[atype]||G.ASTEROID_DROPS.rocky,
        color:atype==='metallic'?'#998877':atype==='icy'?'#aaccdd':atype==='alien'?'#44cc88':'#776655',
      };
      ra.hp = ra.maxHp;
      ringAsteroids.push(ra);
    }
  }

  // Extra dust fields — 35% of systems have 1-2 additional dense asteroid clusters
  const hasDust = envRng() < 0.35;
  const extraFields = hasDust ? 1 + Math.floor(envRng()*2) : 0;

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
        r:18, orbitR:dist, orbitAngle:angle, orbitSpeed:(rng()*0.000005)*(rng()<0.5?1:-1),
        stype, color:'#888899',
        name: sys.name+' '+stype,
        hasSpaceport: true,
        faction: sys.faction,
      });
    }
  } else {
    // Star at center
    bodies.push({ type:'star', x:0, y:0, r:160+rng()*80, color:sys.starColor, name:sys.name+' Star' });

    // Sol system — scaled to real relative sizes, compressed-but-proportional orbits
    if(sys.id === 'sol') {
      // Planet sizes scaled relative to Earth=18 using power-0.42 law for drama
      // Orbital distances: inner planets accurate, gas giants compressed for gameplay
      const solPlanets = [
        { name:'Mercury', ptype:'rocky',  r:28,  dist:380,  hasPort:false, hasRings:false },
        { name:'Venus',   ptype:'lava',   r:56,  dist:640,  hasPort:false, hasRings:false },
        { name:'Earth',   ptype:'terran', r:72,  dist:980,  hasPort:true,  hasRings:false, hasMoon:true },
        { name:'Mars',    ptype:'rocky',  r:40,  dist:1520, hasPort:true,  hasRings:false },
        { name:'Jupiter', ptype:'gas',    r:208, dist:3400, hasPort:false, hasRings:false },
        { name:'Saturn',  ptype:'gas',    r:176, dist:4600, hasPort:false, hasRings:true  },
        { name:'Uranus',  ptype:'ice',    r:120, dist:5700, hasPort:false, hasRings:false },
        { name:'Neptune', ptype:'ocean',  r:112, dist:6800, hasPort:false, hasRings:false },
      ];
      for(let i=0;i<solPlanets.length;i++){
        const sp = solPlanets[i];
        const angle = rng()*Math.PI*2;
        const orbitSpeed = (0.000004 + (solPlanets.length-i)*0.00000175)*(rng()<0.5?1:-1);
        const seed = sp.name.split('').reduce((a,c)=>a*31+c.charCodeAt(0),0) % 50000;
        const bodyObj = {
          type:'planet', x:Math.cos(angle)*sp.dist, y:Math.sin(angle)*sp.dist,
          r:sp.r, orbitR:sp.dist, orbitAngle:angle, orbitSpeed,
          ptype:sp.ptype, color:'#888888', name:sp.name,
          hasSpaceport:sp.hasPort, spaceportName:sp.hasPort?(sp.name+' Station'):null,
          hasRings:sp.hasRings, seed,
          faction:'earth',
        };
        bodies.push(bodyObj);
        if(sp.hasMoon) {
          const moonAngle = rng()*Math.PI*2;
          const moonDist  = sp.r * 3.2;
          bodies.push({
            type:'planet', ptype:'rocky', color:'#999999', name:'Moon',
            x: bodyObj.x + Math.cos(moonAngle)*moonDist,
            y: bodyObj.y + Math.sin(moonAngle)*moonDist,
            r: 20, orbitR: moonDist, orbitAngle: moonAngle,
            orbitSpeed: 0.00028 * (rng()<0.5?1:-1),
            orbitParent: bodyObj,
            hasSpaceport: false, hasRings: false,
            seed: 7777, faction:'earth',
          });
        }
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
        const r = sizeClass>0.97 ? 220+rng()*120
                : sizeClass>0.85 ? 140+rng()*80
                : sizeClass>0.55 ? 80+rng()*48
                : 32+rng()*40;
        const hasPort  = rng() < (ptype==='terran'?0.9:ptype==='ocean'?0.6:r>30?0.4:0.15);
        const hasRings = ptype==='gas' && rng() < 0.35;
        const pname    = sys.name+' '+(['I','II','III','IV','V'][i]||'VI');
        const seed     = pname.split('').reduce((a,c)=>a*31+c.charCodeAt(0),0) % 50000;
        bodies.push({
          type:'planet',
          x: Math.cos(angle)*dist,
          y: Math.sin(angle)*dist,
          r, orbitR:dist, orbitAngle:angle, orbitSpeed:(rng()*0.0000125+0.000003)*(rng()<0.5?1:-1),
          ptype, color: planetColors[ptype],
          name: pname,
          hasSpaceport: hasPort,
          spaceportName: hasPort ? (sys.name+' Spaceport') : null,
          hasRings, seed,
          faction: sys.faction,
        });
      }
    }

    // Space stations
    const nStations = rng() < 0.6 ? 1 : (rng() < 0.3 ? 2 : 0);
    const stTypes = ['Trading Post','Military Base','Research Station','Refueling Depot','Rebel Outpost','Pirate Haven']
      .filter(t => !(sys.faction==='earth' && t==='Rebel Outpost'));
    for(let i=0;i<nStations;i++){
      const dist = 800+rng()*2000;
      const angle = rng()*Math.PI*2;
      const stype = stTypes[Math.floor(rng()*stTypes.length)];
      bodies.push({
        type:'station',
        x:Math.cos(angle)*dist, y:Math.sin(angle)*dist,
        r:18, orbitR:dist, orbitAngle:angle, orbitSpeed:(rng()*0.000005)*(rng()<0.5?1:-1),
        stype, color:'#aaaacc',
        name: sys.name+' '+stype,
        hasSpaceport: true,
        faction: sys.faction,
      });
    }

  }

  // Asteroid fields (multiple chunks + optional extra dust fields)
  const nFields = Math.floor(rng()*3)+1 + extraFields;
  const aField = [];
  for(let f=0;f<nFields;f++){
    const isExtra  = f >= nFields - extraFields;
    const fieldAngle = rng()*Math.PI*2;
    const fieldDist  = isExtra ? 800+rng()*2000 : 1500+rng()*3000;
    const nAsteroids = isExtra ? 14+Math.floor(rng()*22) : 8+Math.floor(rng()*16);
    const atype = isExtra ? (rng()<0.5?'rocky':'metallic')
                          : rng()<0.3?'metallic':rng()<0.3?'icy':rng()<0.1&&dangerF>7?'alien':'rocky';
    const scatter = isExtra ? 400 : 600;
    for(let a=0;a<nAsteroids;a++){
      const ox = Math.cos(fieldAngle)*fieldDist + (rng()-0.5)*scatter;
      const oy = Math.sin(fieldAngle)*fieldDist + (rng()-0.5)*scatter;
      const sz = isExtra ? 8+rng()*14 : 16+rng()*20;
      aField.push({
        type:'asteroid', x:ox, y:oy,
        vx:(rng()-0.5)*15, vy:(rng()-0.5)*15,
        r:sz, atype,
        angle:rng()*Math.PI*2, rotSpeed:(rng()-0.5)*0.5,
        maxHp:30+Math.floor(rng()*40), hp:0,
        drops: G.ASTEROID_DROPS[atype] || G.ASTEROID_DROPS.rocky,
        color: atype==='metallic'?'#998877':atype==='icy'?'#aaccdd':atype==='alien'?'#44cc88':'#776655',
      });
      aField[aField.length-1].hp = aField[aField.length-1].maxHp;
    }
  }

  // Derelict ships — always 1–2, more in dangerous systems
  const nDerelicts = (rng() < G.clamp(0.08 + dangerF * 0.03, 0, 0.35) ? 1 : 0) + (dangerF >= 7 && rng() < 0.12 ? 1 : 0);
  const derelicts = [];
  const shipIds = Object.keys(G.SHIPS);
  for(let i=0;i<nDerelicts;i++){
    const angle = rng()*Math.PI*2;
    const dist  = 1000+rng()*4000;
    const shipId = shipIds[Math.floor(rng()*shipIds.length)];
    const dTpl = G.SHIPS[shipId];
    derelicts.push({
      type:'derelict', x:Math.cos(angle)*dist, y:Math.sin(angle)*dist,
      shipId, looted:false, dead:false,
      lootQty: 2+Math.floor(rng()*5),
      rng: rng(),
      name:    'Derelict ' + (dTpl?.name || shipId),
      shapeId: dTpl?.shape || 'shuttle',
      color:   '#445566',
      hp: 60, maxHp: 60,
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

  return { bodies, asteroids:aField, derelicts, turrets, nebula, ringAsteroids };
};

// Build hyperspace connections between systems
G.buildHyperspaceRoutes = function() {
  const sys = G.SYSTEMS;
  const routes = {};
  sys.forEach(s => routes[s.id] = []);

  // Collect all valid edges within jumpR, sort shortest first
  const edges = [];
  for(let i = 0; i < sys.length; i++) {
    for(let j = i+1; j < sys.length; j++) {
      const a = sys[i], b = sys[j];
      const dx = a.pos[0]-b.pos[0], dy = a.pos[1]-b.pos[1];
      const d  = Math.sqrt(dx*dx+dy*dy);
      const maxR = Math.max(a.jumpR||80, b.jumpR||80);
      if(d <= maxR) edges.push({ a:a.id, b:b.id, d });
    }
  }
  edges.sort((x,y) => x.d - y.d);

  // Add edges shortest-first; cap each system at 5 connections
  const MAX = 5;
  for(const { a, b } of edges) {
    if(routes[a].includes(b)) continue;
    if(routes[a].length >= MAX || routes[b].length >= MAX) continue;
    routes[a].push(b); routes[b].push(a);
  }

  // Guarantee every system has at least one connection
  sys.forEach(a => {
    if(routes[a.id].length > 0) return;
    let nearIdx = 0, nearD = Infinity;
    sys.forEach((b, j) => {
      if(a.id === b.id) return;
      const d = Math.sqrt((a.pos[0]-b.pos[0])**2+(a.pos[1]-b.pos[1])**2);
      if(d < nearD) { nearD=d; nearIdx=j; }
    });
    const nb = sys[nearIdx];
    routes[a.id].push(nb.id);
    if(!routes[nb.id].includes(a.id)) routes[nb.id].push(a.id);
  });

  return routes;
};

// Generate enemy ships for a system
const _SHAPE_META = {
  pirate_fighter: { name:'Pirate Fighter',  class:'Fighter'  },
  gunboat:        { name:'Gunboat',          class:'Gunboat'  },
  corvette:       { name:'Corvette',         class:'Corvette' },
  alien_fighter:  { name:'Shard Fighter',    class:'Fighter'  },
  alien_cruiser:  { name:'Shard Cruiser',    class:'Cruiser'  },
  fighter:        { name:'Fighter',          class:'Fighter'  },
  rebel_fighter:  { name:'Rebel Fighter',    class:'Fighter'  },
};

function _genEnemyWeapons(faction, danger, rng) {
  const rarityMinDanger = { c:0, u:2, r:4, e:6, l:8 };
  const pool = Object.keys(G.WEAPONS).filter(id => {
    const def = G.WEAPONS[id];
    return (rarityMinDanger[def.rarity] || 0) <= danger;
  });
  if(!pool.length) pool.push('laser_cannon');
  const maxWeapons = danger >= 5 ? 3 : danger >= 3 ? 2 : 1;
  const picked = [];
  while(picked.length < maxWeapons && pool.length > 0) {
    const idx = Math.floor(rng() * pool.length);
    picked.push(...pool.splice(idx, 1));
    if(picked.length > 1 && rng() > 0.55) break; // random chance to stop adding
  }
  return picked.map(id => {
    const def = G.WEAPONS[id];
    if(!def) return null;
    return {
      weaponId: id,
      damage: (def.damage || 15) * (0.8 + rng()*0.45),
      fireRate: (def.fireRate || 1.2) * (0.7 + rng()*0.5),
      projSpeed: def.projSpeed || 800,
      range: def.range || 700,
      color: def.color || '#ff4444',
      type: def.type || 'laser',
      splash: def.splash || 0,
      empStrength: def.empStrength || 0,
      tracking: def.tracking || false,
      width: def.width || 2,
      lastShot: 0,
    };
  }).filter(Boolean);
}

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
      // Earth territory danger 3+: very rare pirate raider only
      if(rng() > 0.08) continue;
      shapeId='pirate_fighter'; col='#cc2222'; shipFaction='pirate';
    }

    const shapeMeta = _SHAPE_META[shapeId] || { name:'Unknown Ship', class:'Fighter' };
    const angle = rng()*Math.PI*2;
    const dist  = 1500+rng()*3000;
    const hp = 120+danger*30 + rng()*80;
    const shields = danger>3 ? (danger-3)*40+rng()*60 : 0;
    const speed   = 280 + danger*40 + rng()*180;
    const damage  = 10+danger*4+rng()*10;
    const credits = Math.floor(50+danger*30+rng()*100);
    const cargoDrops = Math.floor(rng()*3);

    const shipTpl = G.SHIPS[shapeId] || Object.values(G.SHIPS).find(s=>s.shape===shapeId);
    const startWpnIds = shipTpl?.startWeapons || ['laser_cannon'];
    const weapons = startWpnIds.map(id => {
      const def = G.WEAPONS[id];
      if(!def) return null;
      const scale = 0.85 + rng()*0.35;
      return { weaponId:id, damage:(def.damage||15)*scale, fireRate:def.fireRate||1.2, projSpeed:def.projSpeed||800,
        range:def.range||700, color:def.color||col, type:def.type||'laser',
        splash:def.splash||0, empStrength:def.empStrength||0, tracking:def.tracking||false,
        width:def.width||2, turret:def.turret||false, lastShot:0 };
    }).filter(Boolean);
    const primaryWpn = weapons.find(w=>!w.turret) || weapons[0];
    enemies.push({
      type:'enemy',
      x:Math.cos(angle)*dist, y:Math.sin(angle)*dist,
      vx:0, vy:0, angle:0,
      hp, maxHp:hp, shields, maxShields:shields,
      energy:100, maxEnergy:100,
      speed, turnSpeed:1.5+rng()*1.5,
      damage: primaryWpn?.damage ?? damage,
      fireRate: primaryWpn?.fireRate ?? (1.2+rng()*1.2),
      lastShot:0,
      weapons,
      weaponType: primaryWpn?.type ?? 'laser',
      projColor: primaryWpn?.color ?? col,
      credits, cargoDrops,
      shapeId, color:col,
      name:shapeMeta.name, class:shapeMeta.class,
      faction:shipFaction,
      aiState:'patrol',
      patrolAngle:rng()*Math.PI*2,
      patrolDist:600+rng()*800,
      patrolCenter:{x:Math.cos(angle)*dist*0.5, y:Math.sin(angle)*dist*0.5},
      disabled:false, boarded:false,
      // ~20% of enemies in higher-danger systems get frost_nova
      abilities: (danger >= 3 && rng() < 0.2) ? ['frost_nova'] : [],
      abilityCooldowns: {},
    });
  }

  // Enemy fleet: randomly group into flagship + escorts (danger >= 4)
  if(enemies.length >= 2 && danger >= 4 && rng() < 0.38) {
    const flagIdx = Math.floor(rng() * enemies.length);
    const flagship = enemies[flagIdx];
    const fleetId = 'fl'+(Math.floor(rng()*99999));
    flagship._fleetId = fleetId;
    flagship.isFleetFlagship = true;
    flagship.hp = flagship.maxHp = (flagship.maxHp || flagship.hp) * 1.9;
    flagship.size = (flagship.size || 1.0) * 1.5;
    flagship.speed = (flagship.speed || 300) * 0.72;
    flagship.damage = (flagship.damage || 15) * 1.4;
    flagship.engageRange = 900;
    let assigned = 0;
    for(let i = 0; i < enemies.length && assigned < 2; i++) {
      if(i === flagIdx) continue;
      const escort = enemies[i];
      escort.fleetFlagshipId = fleetId;
      const ea = rng()*Math.PI*2;
      escort.x = flagship.x + Math.cos(ea)*220;
      escort.y = flagship.y + Math.sin(ea)*220;
      escort.patrolCenter = { x: flagship.x, y: flagship.y };
      escort.patrolDist = 160 + rng()*120;
      assigned++;
    }
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
