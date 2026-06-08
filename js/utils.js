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

// ── Hex grid (flat-top, axial q,r) ───────────────────────
// Module ships live on a flat-top hex grid. Core at (0,0). Forward (nose) = -y.
// `size` is the hex radius (centre→vertex). Pointy-top: tip points vertically,
// height = 2·size, row spacing = 1.5·size; width = √3·size, column spacing = √3·size.
G.HEX_R = 9;              // base module-hex radius in sprite pixels
G.HEX_SQRT3 = Math.sqrt(3);

// 6 axial neighbour directions (pointy-top): E, NE, NW, W, SW, SE in screen terms
G.HEX_DIRS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];

G.hexToPixel = (q, r, size) => ({
  x: size * G.HEX_SQRT3 * (q + r / 2),
  y: size * 1.5 * r,
});

// Inverse + cube-rounding to nearest hex (for pointer hit-testing). Pointy-top.
G.pixelToHex = (x, y, size) => {
  const qf = (G.HEX_SQRT3 / 3 * x - 1 / 3 * y) / size;
  const rf = (2 / 3 * y) / size;
  // cube round
  let xc = qf, zc = rf, yc = -xc - zc;
  let rx = Math.round(xc), ry = Math.round(yc), rz = Math.round(zc);
  const dx = Math.abs(rx - xc), dy = Math.abs(ry - yc), dz = Math.abs(rz - zc);
  if(dx > dy && dx > dz) rx = -ry - rz;
  else if(dy > dz)       ry = -rx - rz;
  else                   rz = -rx - ry;
  return { q: rx, r: rz };
};

G.hexKey = (q, r) => q + ',' + r;
G.hexFromKey = k => { const [q, r] = k.split(',').map(Number); return { q, r }; };
G.hexNeighbors = (q, r) => G.HEX_DIRS.map(([dq, dr]) => ({ q: q + dq, r: r + dr }));
G.hexDist = (aq, ar, bq, br) =>
  (Math.abs(aq - bq) + Math.abs(aq + ar - bq - br) + Math.abs(ar - br)) / 2;

// All axial coords with cube-distance ≤ n, ordered ring-by-ring from centre.
G.hexSpiral = (n) => {
  const out = [{ q: 0, r: 0 }];
  for(let k = 1; k <= n; k++) out.push(...(G.hexRing ? G.hexRing(k) : []));
  return out;
};

// ── World hex grid (pointy-top, size = G.HEX_WORLD) ───────
// The tactical hex map IS a world-space grid: each cell maps to a region of
// flight space. Pointy-top to match renderHexMap's hexXY layout. Distinct from
// the flat-top *module* hexes (G.hexToPixel).
G.hexToWorld = (q, r) => ({
  x: G.HEX_WORLD * (G.HEX_SQRT3 * q + G.HEX_SQRT3 / 2 * r),
  y: G.HEX_WORLD * 1.5 * r,
});
G.worldToHex = (x, y) => {
  const qf = (G.HEX_SQRT3 / 3 * x - 1 / 3 * y) / G.HEX_WORLD;
  const rf = (2 / 3 * y) / G.HEX_WORLD;
  // cube round
  let xc = qf, zc = rf, yc = -xc - zc;
  let rx = Math.round(xc), ry = Math.round(yc), rz = Math.round(zc);
  const dx = Math.abs(rx - xc), dy = Math.abs(ry - yc), dz = Math.abs(rz - zc);
  if(dx > dy && dx > dz) rx = -ry - rz;
  else if(dy > dz)       ry = -rx - rz;
  else                   rz = -rx - ry;
  return { q: rx, r: rz };
};

// Phone/tablet detection — touch capable AND a mobile user-agent.
G.isMobileDevice = () => {
  const touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const ua = /Mobi|Android|iPhone|iPad|iPod|IEMobile|BlackBerry|Opera Mini/i.test(navigator.userAgent || '');
  return touch && ua;
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

// Record a shield-impact world point on an entity so the hit shield hex flashes
// white (see Renderer.drawShieldOutline). Capped + age-pruned at draw time.
G.recordShieldHit = (e, x, y) => {
  if(!e) return;
  (e._shieldHits || (e._shieldHits = [])).push({ x, y, t: Date.now() });
  if(e._shieldHits.length > 16) e._shieldHits.shift();
};

// ── Shared ship-entity base ───────────────────────────────
// Player (G.Ship), enemies (G.EnemyAI), NPCs (G.NPCShip) and fleet escorts
// (G.FleetShip) all extend this so damage runs through ONE pipeline. The shared
// skeleton is: invuln → armor → EMP → (disabled) → shield-bleed → hull. Per-class
// quirks (EMP behaviour, hp vs hull field, death thresholds) are small overrides.
G.ShipEntity = class {
  // Default EMP: drain half the value off shields, brief stun. Override per class.
  _takeEmp(amount) {
    this.shields = Math.max(0, this.shields - amount * 0.5);
    this.empTimer = 5;
    return { shieldDmg: amount * 0.5, hullDmg: 0 };
  }

  // Shields-only damage layer. There is NO hull/hp pool any more: ship state is
  // driven entirely by modules. takeDamage burns shields (with 20% bleed-through)
  // and RETURNS the penetrating amount as `hullDmg`; the caller (_applyHit)
  // applies that to the nearest live module via _damageModuleAtPoint. EMP is
  // handled separately. Disabled ships still take penetrating damage so a downed
  // ship can still have its core blown (explosion).
  takeDamage(amount, type) {
    if((this._invulTimer || 0) > 0) return { shieldDmg: 0, hullDmg: 0 };
    if(this === G.game?.player && G.game?._godMode) return { shieldDmg: 0, hullDmg: 0 };
    if(type !== 'emp' && type !== 'laser' && typeof this.armor === 'number') amount = Math.max(1, amount - this.armor);
    if(type === 'emp') return this._takeEmp(amount) || { shieldDmg: 0, hullDmg: 0 };
    let shieldDmg = 0;
    if(this.shields > 0) {
      shieldDmg = Math.min(this.shields, amount);
      this.shields -= shieldDmg;
      amount = (amount - shieldDmg) * 0.2;   // bleed-through
    }
    return { shieldDmg, hullDmg: amount > 0 ? amount : 0 };
  }

  // ── Shared steering / thrust (AI state machines call these) ──────────────
  // Turn toward a world point, clamped to this.turnSpeed.
  _steerTo(tx, ty, dt) {
    const dx = tx - this.x, dy = ty - this.y;
    if(Math.abs(dx) + Math.abs(dy) < 5) return;
    const target = Math.atan2(dx, -dy);
    const diff = G.wrapAngle(target - this.angle);
    this.angle += G.clamp(diff * 5, -this.turnSpeed, this.turnSpeed) * dt;
  }
  // Accelerate forward, capped at this.speed. `boost` gives a 1.4× burst.
  _thrust(dt, boost = false) {
    const mult = boost ? 1.4 : 1.0;
    this.vx += Math.sin(this.angle) * this.speed * mult * dt * 0.5;
    this.vy -= Math.cos(this.angle) * this.speed * mult * dt * 0.5;
    const spd = Math.hypot(this.vx, this.vy);
    if(spd > this.speed * mult) { this.vx *= (this.speed*mult)/spd; this.vy *= (this.speed*mult)/spd; }
  }
};

// ── Faction hull silhouettes (module-layout placement strategy) ───────────
// `layoutShape` is a NEW ship property (distinct from shapeId, which is the
// drawn sprite). It selects a placement strategy for _generateHexLayout: cells
// are grown greedily from the core, preferring the lowest shape score. Shapes
// are defined in pointy-top local pixel space (forward/nose = −y).
G.FACTION_LAYOUT_SHAPE = {
  earth: 'penis', rebellion: 'u', pirate: 'triangle', alien: 'donut',
  independent: 'symmetric', neutral: 'symmetric', contested: 'symmetric',
};
// score(x,y) → 0 = perfectly on-shape, larger = further off-shape (avoid).
G.shapeScore = (shape, n) => {
  const S = Math.max(2, Math.sqrt(n) * 1.05);   // characteristic radius (scales with size)
  switch(shape) {
    case 'penis': return (x, y) => {            // forward shaft+glans (−y), two base lobes (+y)
      const Ws = 0.30*S, top = -1.05*S, bot = 0.35*S;
      const dShaft = Math.max(0, Math.abs(x)-Ws) + Math.max(0, top - y) + Math.max(0, y - bot);
      const dGlans = Math.max(0, Math.hypot(x, y - top) - 0.40*S);
      const Wb = 0.46*S, yl = 0.95*S, Wl = 0.42*S;
      const dL = Math.max(0, Math.hypot(x + Wb, y - yl) - Wl);
      const dR = Math.max(0, Math.hypot(x - Wb, y - yl) - Wl);
      return Math.min(dShaft, dGlans, dL, dR);
    };
    case 'u': return (x, y) => {                // bottom aft (+y), two arms forward (−y), hollow front-centre
      const Wo = 0.85*S, Wi = 0.38*S, bottomY = -0.15*S;
      let pen = 0;
      if(y > S) pen += y - S; if(y < -S) pen += -S - y;
      const yy = Math.max(-S, Math.min(S, y)), ax = Math.abs(x);
      const lo = (yy >= bottomY) ? 0 : Wi, hi = Wo;
      if(ax < lo) pen += lo - ax; if(ax > hi) pen += ax - hi;
      return pen;
    };
    case 'triangle': return (x, y) => {         // apex forward (−y), base aft (+y)
      let pen = 0;
      if(y > S) pen += y - S; if(y < -S) pen += -S - y;
      const yy = Math.max(-S, Math.min(S, y));
      const hw = ((yy + S) / (2*S)) * 0.95*S;   // half-width: 0 at apex → wide at base
      const ax = Math.abs(x);
      if(ax > hw) pen += ax - hw;
      return pen;
    };
    case 'donut': return (x, y) => {            // annulus with hollow centre
      const d = Math.hypot(x, y), Rd = 0.78*S;
      let pen = Math.abs(d - Rd);
      if(d < Rd*0.55) pen += (Rd*0.55 - d) * 2.5;
      return pen;
    };
    default: return () => 0;                    // 'random': uniform → organic blob
  }
};

// ── Asteroid hex-tile cluster helpers ────────────────────
const _atk = (q,r) => q+','+r;
// Recompute every tile's `exposed` flag (outer ring) + cluster bounding radius.
G.astRefresh = (cl) => {
  let maxd = 0;
  for(const t of cl.tiles.values()){
    let exposed = false;
    for(const [dq,dr] of G.HEX_NEIGHBORS){ if(!cl.tiles.has(_atk(t.q+dq,t.r+dr))){ exposed=true; break; } }
    t.exposed = exposed;
    const p = G.astTileLocal(t.q,t.r);
    const d = Math.hypot(p.x,p.y);
    if(d>maxd) maxd=d;
  }
  cl.r = maxd + G.ASTEROID_TILE_R;
  cl.tileCount = cl.tiles.size;
};
// World-space centre of a tile (applies cluster rotation).
G.astTileWorld = (cl,t) => {
  const p = G.astTileLocal(t.q,t.r);
  const ca=Math.cos(cl.angle), sa=Math.sin(cl.angle);
  return { x: cl.x + p.x*ca - p.y*sa, y: cl.y + p.x*sa + p.y*ca };
};
// Nearest exposed tile within hit radius of world point, or null.
G.astHitTile = (cl, wx, wy, pad) => {
  let best=null, bd=Infinity;
  const rr = (G.ASTEROID_TILE_R+(pad||0))**2;
  for(const t of cl.tiles.values()){
    if(!t.exposed) continue;
    const w = G.astTileWorld(cl,t);
    const d=(w.x-wx)**2+(w.y-wy)**2;
    if(d<rr && d<bd){ bd=d; best=t; }
  }
  return best;
};
// Remove one tile; newly-uncovered neighbours become exposed.
G.astRemoveTile = (cl, t) => {
  cl.tiles.delete(_atk(t.q,t.r));
  for(const [dq,dr] of G.HEX_NEIGHBORS){
    const n=cl.tiles.get(_atk(t.q+dq,t.r+dr));
    if(n) n.exposed=true;
  }
  cl._dirty = true;   // sprite must be re-baked (see Renderer._bakeCluster)
  cl.tileCount = cl.tiles.size;
};
// Grow an irregular cluster of `size` hex tiles centred at world (cx,cy).
G.astMakeCluster = (cx,cy,size,rng) => {
  const fn = rng || Math.random;
  const tiles = new Map();
  const primary = G.astRandMat(fn);
  const addT = (q,r) => {
    const mat = fn()<0.7 ? primary : G.astRandMat(fn);
    const md = G.ASTEROID_MAT[mat];
    tiles.set(_atk(q,r), { q, r, mat, hp:md.hp, maxHp:md.hp });
  };
  addT(0,0);
  let guard=0;
  while(tiles.size < size && guard++ < size*40+50){
    const keys=[...tiles.keys()];
    const [bq,br]=keys[Math.floor(fn()*keys.length)].split(',').map(Number);
    const nb=G.HEX_NEIGHBORS[Math.floor(fn()*6)];
    const nq=bq+nb[0], nr=br+nb[1];
    if(!tiles.has(_atk(nq,nr))) addT(nq,nr);
  }
  const cl = {
    type:'asteroid', x:cx, y:cy,
    vx:(fn()-0.5)*10, vy:(fn()-0.5)*10,
    angle:fn()*Math.PI*2, rotSpeed:(fn()-0.5)*0.4/Math.max(1,Math.sqrt(size)),
    tiles,
  };
  G.astRefresh(cl);
  return cl;
};
// Cluster size roll: mostly tiny, capped at ~120 tiles (perf — clusters are
// baked to a sprite, but bake + per-tile collision still scale with tile count).
G.astRollSize = (rng, big) => {
  const fn = rng || Math.random; const r=fn();
  if(r<0.55)  return 1+Math.floor(fn()*4);
  if(r<0.85)  return 5+Math.floor(fn()*12);
  if(r<0.97)  return 18+Math.floor(fn()*30);
  return big ? 50+Math.floor(fn()*70) : 40+Math.floor(fn()*40);
};

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

  // Asteroid-tile layout mode (decided after hex tiles are built below): some
  // systems get a far asteroid ring, others scattered asteroid hexes.
  const asteroidRingMode = envRng() < 0.45;

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
        r:36, orbitR:dist, orbitAngle:angle, orbitSpeed:(rng()*0.000005)*(rng()<0.5?1:-1),
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
        { name:'Mercury', ptype:'rocky',  r:56,  dist:380,  hasPort:false, hasRings:false },
        { name:'Venus',   ptype:'lava',   r:112, dist:640,  hasPort:false, hasRings:false },
        { name:'Earth',   ptype:'terran', r:144, dist:980,  hasPort:true,  hasRings:false },
        { name:'Mars',    ptype:'rocky',  r:80,  dist:1520, hasPort:true,  hasRings:false },
        { name:'Jupiter', ptype:'gas',    r:416, dist:3400, hasPort:false, hasRings:false },
        { name:'Saturn',  ptype:'gas',    r:352, dist:4600, hasPort:false, hasRings:true  },
        { name:'Uranus',  ptype:'ice',    r:240, dist:5700, hasPort:false, hasRings:false },
        { name:'Neptune', ptype:'ocean',  r:224, dist:6800, hasPort:false, hasRings:false },
      ];
      for(let i=0;i<solPlanets.length;i++){
        const sp = solPlanets[i];
        const angle = rng()*Math.PI*2;
        const orbitSpeed = (0.000004 + (solPlanets.length-i)*0.00000175)*(rng()<0.5?1:-1);
        const seed = sp.name.split('').reduce((a,c)=>a*31+c.charCodeAt(0),0) % 50000;
        bodies.push({
          type:'planet', x:Math.cos(angle)*sp.dist, y:Math.sin(angle)*sp.dist,
          r:sp.r, orbitR:sp.dist, orbitAngle:angle, orbitSpeed,
          ptype:sp.ptype, color:'#888888', name:sp.name,
          hasSpaceport:sp.hasPort, spaceportName:sp.hasPort?(sp.name+' Station'):null,
          hasRings:sp.hasRings, seed,
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
        const r = sizeClass>0.97 ? 440+rng()*240
                : sizeClass>0.85 ? 280+rng()*160
                : sizeClass>0.55 ? 160+rng()*96
                : 64+rng()*80;
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
        r:36, orbitR:dist, orbitAngle:angle, orbitSpeed:(rng()*0.000005)*(rng()<0.5?1:-1),
        stype, color:'#aaaacc',
        name: sys.name+' '+stype,
        hasSpaceport: true,
        faction: sys.faction,
      });
    }

  }

  // ── Hex-tile layout ──────────────────────────────────────
  // The system is laid out on a world-space hex grid. Sun at centre, a damaging
  // near-sun ring, bodies snapped to outward hex cells, plus asteroid + dust
  // tiles. Asteroids spawn ONLY inside asteroid tiles.
  const hexTiles = new Map();
  const tkey = (q,r) => q + ',' + r;
  const setTile = (q,r,type) => hexTiles.set(tkey(q,r), { q, r, type });
  const used = new Set();
  const occupy = (q,r) => used.add(tkey(q,r));
  const SQ3 = Math.sqrt(3);
  const hexAngle = (q,r) => Math.atan2(1.5*r, SQ3*q + SQ3/2*r);

  if(!sys.noStar) {
    setTile(0,0,'sun'); occupy(0,0);
    for(const h of G.hexRing(1)) { setTile(h.q,h.r,'near_sun'); occupy(h.q,h.r); }
  }

  // Snap a body to a free hex on `ring` (or just outside), nearest its world
  // angle; writes world pos + hexQ/hexR and types the tile.
  const placeBody = (b, ring) => {
    const ba = Math.atan2(b.y||0, b.x||0);
    for(let rr = Math.max(2,ring); rr <= ring + 6; rr++) {
      const cands = G.hexRing(rr).filter(h => !used.has(tkey(h.q,h.r)));
      if(!cands.length) continue;
      let best = cands[0], bd = Infinity;
      for(const h of cands) { const d = Math.abs(G.wrapAngle(ba - hexAngle(h.q,h.r))); if(d < bd){ bd=d; best=h; } }
      occupy(best.q,best.r);
      const w = G.hexToWorld(best.q,best.r);
      b.x=w.x; b.y=w.y; b.hexQ=best.q; b.hexR=best.r; b.orbitR=0; // static at hex centre
      setTile(best.q,best.r, b.type);
      return best;
    }
    return null;
  };

  const asteroidTiles = [];
  // Asteroid tiles carry a density: 'dense' (packed field) or 'sparse' (scattered).
  const addAsteroidTile = (q,r,density) => {
    if(used.has(tkey(q,r))) return;
    hexTiles.set(tkey(q,r), { q, r, type:'asteroid', density });
    occupy(q,r); asteroidTiles.push({ q, r, density });
  };
  if(sys.id === 'sol') {
    // Explicit, real-order Sol layout (pointy-top axial cells).
    // Each planet on its own unique ring (2-5 inner, 7-10 outer); ring 6 = asteroid belt.
    const solCells = { Mercury:[2,0], Venus:[-1,-2], Earth:[4,0], Mars:[-2,-3],
                       Jupiter:[0,-7], Saturn:[-8,4], Uranus:[9,0], Neptune:[0,10] };
    for(const b of bodies) {
      if(b.type !== 'planet') continue;
      const c = solCells[b.name];
      if(!c) continue;
      occupy(c[0],c[1]);
      const w = G.hexToWorld(c[0],c[1]);
      b.x=w.x; b.y=w.y; b.hexQ=c[0]; b.hexR=c[1]; b.orbitR=0; // static at hex centre
      setTile(c[0],c[1],'planet');
    }
    // Asteroid belt (ring 6, dense) and Kuiper belt (ring 11, sparse)
    for(const h of G.hexRing(6)) addAsteroidTile(h.q,h.r,'dense');
    G.hexRing(11).forEach((h,i) => { if(i%2===0) addAsteroidTile(h.q,h.r,'sparse'); });
    // Place any Sol stations on free outer cells.
    for(const b of bodies) if(b.type==='station' && b.hexQ==null) placeBody(b, 3 + Math.floor(rng()*3));
    // One dust cloud out past Mars
    const dustCell = G.hexRing(3).find(h => !used.has(tkey(h.q,h.r)));
    if(dustCell) { setTile(dustCell.q,dustCell.r,'dust'); occupy(dustCell.q,dustCell.r); }
  } else {
    // Generic: each body on its own unique ring with 1-2 empty rings between them.
    const mains = bodies.filter(b => !b.orbitParent && (b.type==='planet'||b.type==='station'))
                        .sort((a,b)=>(a.orbitR||0)-(b.orbitR||0));
    const ringGap = 2 + Math.floor(envRng() * 2);
    mains.forEach((b, i) => placeBody(b, 2 + i * ringGap));
    // Asteroid tiles: a far ring (dense), or a few scattered cells (mixed).
    if(asteroidRingMode) {
      const rr = 4 + Math.floor(envRng()*3);
      for(const h of G.hexRing(rr)) addAsteroidTile(h.q,h.r,'dense');
    } else {
      const nA = 3 + Math.floor(envRng()*4);
      const pool = [...G.hexRing(3),...G.hexRing(4),...G.hexRing(5)].filter(h=>!used.has(tkey(h.q,h.r)));
      for(let i=0;i<nA && pool.length;i++){ const h=pool.splice(Math.floor(envRng()*pool.length),1)[0]; addAsteroidTile(h.q,h.r, envRng()<0.5?'dense':'sparse'); }
    }
    // 0-2 dust tiles
    const nDust = envRng()<0.5 ? (envRng()<0.5?2:1) : 0;
    const dpool = [...G.hexRing(2),...G.hexRing(3),...G.hexRing(4),...G.hexRing(5)].filter(h=>!used.has(tkey(h.q,h.r)));
    for(let i=0;i<nDust && dpool.length;i++){ const h=dpool.splice(Math.floor(envRng()*dpool.length),1)[0]; setTile(h.q,h.r,'dust'); occupy(h.q,h.r); }
  }

  // Spawn hex-tile asteroid clusters inside each asteroid tile (and nowhere else).
  const aField = [];
  for(const h of asteroidTiles) {
    const c = G.hexToWorld(h.q,h.r);
    const dense = h.density === 'dense';
    const n = dense ? 4 + Math.floor(rng()*4) : 2 + Math.floor(rng()*3);
    const spread = G.HEX_WORLD * (dense ? 0.7 : 0.6);
    for(let a=0;a<n;a++){
      const ang=rng()*Math.PI*2, rad=Math.sqrt(rng())*spread;
      const size = G.astRollSize(rng, dense);
      aField.push(G.astMakeCluster(c.x+Math.cos(ang)*rad, c.y+Math.sin(ang)*rad, size, rng));
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

  return { bodies, asteroids:aField, derelicts, turrets, nebula, hexTiles };
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
    const credits = Math.floor(50+danger*30+rng()*100);
    const cargoDrops = Math.floor(rng()*3);

    // Stats (hp/shields/speed/turn/weapons) are derived from the backing module
    // hull in EnemyAI via G.aiInitHull — pure module stats, no scalar formulas.
    enemies.push({
      type:'enemy',
      x:Math.cos(angle)*dist, y:Math.sin(angle)*dist,
      vx:0, vy:0, angle:0,
      energy:100, maxEnergy:100,
      credits, cargoDrops,
      shapeId, color:col,
      projColor: col,
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

  // Enemy fleet: randomly group into flagship + escorts (danger >= 4). Stat
  // buffs are passed as multipliers and applied to the module hull at build.
  if(enemies.length >= 2 && danger >= 4 && rng() < 0.38) {
    const flagIdx = Math.floor(rng() * enemies.length);
    const flagship = enemies[flagIdx];
    const fleetId = 'fl'+(Math.floor(rng()*99999));
    flagship._fleetId = fleetId;
    flagship.isFleetFlagship = true;
    flagship._hullMult = 1.9;
    flagship._sizeMult = 1.5;
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

// ── Unified character model ──────────────────────────────────────────────────
// One person shape for ship crew, planet units, and boarders. Plain serializable
// object (saves with ship.crew). hp/mana/energy pools + a paper-doll `equip` map
// (slot -> itemId, item resolved from the unified G.ITEMS registry).
G.makeCharacter = function(opts = {}) {
  const roleId = opts.role || 'marine';
  const role = G.CREW_ROLES[roleId] || {};
  const b = G.CHAR_BASE, A = G.CHAR_ATTRS;
  const c = {
    id: opts.id || ('c' + (Math.random() * 1e9 | 0)),
    name: opts.name || G.CREW_NAMES[(Math.random() * G.CREW_NAMES.length) | 0],
    role: roleId, roleName: role.name || roleId,
    classId: opts.classId || null,
    faction: opts.faction || 'neutral',
    disposition: opts.disposition || null,   // null = the player's own crew
    skill: opts.skill ?? 2,
    level: opts.level ?? 1, xp: 0,
    // Diablo primary attributes (allocated base; gear adds on top in recompute).
    baseStr: A.str, baseDex: A.dex, baseInt: A.int, baseVit: A.vit,
    attrPoints: 0, skillPoints: 0,
    maxHp: b.hp, hp: b.hp,
    maxMana: b.mana, mana: b.mana,
    maxEnergy: b.energy, energy: b.energy,
    armor: 0,
    equip: {},                  // paper-doll slot -> gear INSTANCE (or null)
    skills: [],                 // unlocked skill ids
    hotbar: [null, null, null, null],   // hotbar 1-4 -> skill id
    skillCd: {},                // skill id -> cooldown remaining
    isPlayer: !!opts.isPlayer,
  };
  for(const s of G.EQUIP_SLOTS) c.equip[s] = null;
  G.charRecompute(c);
  return c;
};

// Idempotently add any missing character fields to an existing crew object.
G.ensureCharFields = function(c) {
  if(!c) return c;
  const b = G.CHAR_BASE, A = G.CHAR_ATTRS;
  if(c.maxHp == null)     c.maxHp = (c.hp != null ? c.hp : b.hp);
  if(c.hp == null)        c.hp = c.maxHp;
  if(c.maxMana == null)   c.maxMana = b.mana;
  if(c.mana == null)      c.mana = c.maxMana;
  if(c.maxEnergy == null) c.maxEnergy = b.energy;
  if(c.energy == null)    c.energy = c.maxEnergy;
  if(c.armor == null)     c.armor = 0;
  if(c.level == null)     c.level = 1;
  if(c.xp == null)        c.xp = 0;
  if(c.baseStr == null)   c.baseStr = A.str;
  if(c.baseDex == null)   c.baseDex = A.dex;
  if(c.baseInt == null)   c.baseInt = A.int;
  if(c.baseVit == null)   c.baseVit = A.vit;
  if(c.attrPoints == null)  c.attrPoints = 0;
  if(c.skillPoints == null) c.skillPoints = 0;
  if(!Array.isArray(c.skills))  c.skills = [];
  if(!Array.isArray(c.hotbar))  c.hotbar = [null, null, null, null];
  if(!c.skillCd || typeof c.skillCd !== 'object') c.skillCd = {};
  if(!c.equip || typeof c.equip !== 'object') c.equip = {};
  for(const s of G.EQUIP_SLOTS) if(!(s in c.equip)) c.equip[s] = null;
  return c;
};

// Unlock a skill (costs 1 skill point) and slot it on the first empty hotbar
// slot. Returns true on success.
G.charUnlockSkill = function(c, skillId) {
  if(!G.CHAR_SKILLS?.[skillId] || c.skills.includes(skillId)) return false;
  if((c.skillPoints || 0) < 1) return false;
  c.skillPoints--;
  c.skills.push(skillId);
  const free = c.hotbar.indexOf(null);
  if(free >= 0) c.hotbar[free] = skillId;
  return true;
};

// ── Gear value resolvers ─────────────────────────────────────────────────────
// A slot/inventory entry is either a rolled INSTANCE ({base,rarity,ilvl,dmg,
// mods,affixes,name}) or a plain base-item id string (used by quick NPC equips).
// These resolve either form uniformly.
G.gearBase  = (v) => !v ? null : (typeof v === 'string' ? G.ITEMS[v] : G.ITEMS[v.base]) || null;
G.gearKind  = (v) => G.gearBase(v)?.kind || null;
G.gearMods  = (v) => !v ? null : (typeof v === 'string' ? G.ITEMS[v]?.mods : v.mods) || null;
G.gearDmg   = (v) => !v ? 0 : (typeof v === 'string' ? (G.ITEMS[v]?.dmg || 0) : (v.dmg ?? G.ITEMS[v.base]?.dmg ?? 0));
G.gearName  = (v) => !v ? '' : (typeof v === 'string' ? (G.ITEMS[v]?.name || v) : (v.name || G.gearBase(v)?.name || v.base));
G.gearIcon  = (v) => G.gearBase(v)?.icon || '▪';
G.gearMass  = (v) => G.gearBase(v)?.mass || 1;
G.gearEquipSlot = (v) => G.gearBase(v)?.equipSlot || null;
G.gearRarity = (v) => (typeof v === 'object' && v?.rarity) ? v.rarity : 'common';
G.gearColor = (v) => (G.RARITIES?.[G.gearRarity(v)]?.color) || G.gearBase(v)?.color || '#cfd6e0';
// Combat-facing def: base stats (range/rof/lift/...) merged with the rolled dmg.
G.gearResolve = (v) => { const base = G.gearBase(v); if(!base) return null; return (typeof v === 'string') ? base : Object.assign({}, base, { dmg: v.dmg ?? base.dmg, _inst: v }); };

G.charHasKind = function(c, kind) {
  if(!c?.equip) return false;
  for(const s of G.EQUIP_SLOTS) if(G.gearKind(c.equip[s]) === kind) return true;
  return false;
};
G.charGearOfKind = function(c, kind) {
  if(!c?.equip) return null;
  for(const s of G.EQUIP_SLOTS) if(G.gearKind(c.equip[s]) === kind) return G.gearResolve(c.equip[s]);
  return null;
};

// Recompute derived pools / attributes / combat stats from equipped gear + level.
G.charRecompute = function(c) {
  G.ensureCharFields(c);
  const b = G.CHAR_BASE;
  let hp = b.hp, mana = b.mana, energy = b.energy, armor = 0, carry = 0;
  let str = c.baseStr, dex = c.baseDex, intl = c.baseInt, vit = c.baseVit;
  let crit = 0, resAll = 0, lifeOnHit = 0, moveSpeed = 0;
  for(const s of G.EQUIP_SLOTS) {
    const m = G.gearMods(c.equip[s]); if(!m) continue;
    if(m.hp) hp += m.hp; if(m.mana) mana += m.mana; if(m.energy) energy += m.energy;
    if(m.armor) armor += m.armor; if(m.carry) carry += m.carry;
    if(m.str) str += m.str; if(m.dex) dex += m.dex; if(m.int) intl += m.int; if(m.vit) vit += m.vit;
    if(m.crit) crit += m.crit; if(m.resAll) resAll += m.resAll;
    if(m.lifeOnHit) lifeOnHit += m.lifeOnHit; if(m.moveSpeed) moveSpeed += m.moveSpeed;
  }
  c.str = str; c.dex = dex; c.int = intl; c.vit = vit;
  const lvlMul = 1 + (Math.max(1, c.level) - 1) * 0.05;
  c.maxHp     = Math.round((hp + vit * 4) * lvlMul);
  c.maxMana   = Math.round(mana + intl * 2);
  c.maxEnergy = Math.round(energy);
  c.armor     = armor;
  c.carryBonus  = carry;
  c.critChance  = 0.05 + crit / 100 + dex * 0.002;
  c.resAll      = resAll;
  c.lifeOnHit   = lifeOnHit;
  c.moveBonus   = moveSpeed / 100;
  c.meleeMul    = 1 + str * 0.01;
  c.rangedMul   = 1 + dex * 0.01;
  c.hp     = Math.min(c.hp, c.maxHp);
  c.mana   = Math.min(c.mana, c.maxMana);
  c.energy = Math.min(c.energy, c.maxEnergy);
  c.hasJetpack = G.charHasKind(c, 'jetpack');
  return c;
};

// Equip a gear instance into `slot`, pulling it from `gearList` (the ship's loose
// gear pool); any item already worn returns to the pool. Returns true on success.
G.charEquip = function(c, slot, inst, gearList) {
  const es = G.gearEquipSlot(inst);
  if(!es || !G.slotAccepts(slot, es)) return false;
  if(gearList) { const i = gearList.indexOf(inst); if(i < 0) return false; gearList.splice(i, 1); }
  const prev = c.equip[slot];
  c.equip[slot] = inst;
  if(prev && gearList) gearList.push(prev);
  G.charRecompute(c);
  return true;
};

// Unequip `slot` back into `gearList`. Returns true if something moved.
G.charUnequip = function(c, slot, gearList) {
  const v = c.equip[slot]; if(!v) return false;
  c.equip[slot] = null;
  if(gearList && typeof v === 'object') gearList.push(v);
  G.charRecompute(c);
  return true;
};

// ── ARPG loot: roll a gear instance ──────────────────────────────────────────
G._rollRarity = function(mf = 0) {
  const ord = G.RARITY_ORDER;
  const w = (r) => G.RARITIES[r].weight * (r === 'common' ? 1 : (1 + mf));
  let tot = 0; for(const r of ord) tot += w(r);
  let x = Math.random() * tot;
  for(const r of ord) { x -= w(r); if(x <= 0) return r; }
  return 'common';
};
G._affixPool = function(base) {
  const isWeapon = base.equipSlot === 'hand' && (base.kind === 'pistol' || base.kind === 'sword');
  return G.AFFIXES.filter(a => a.slot === 'any' || (a.slot === 'weapon' && isWeapon) || (a.slot === 'armor' && !isWeapon));
};
G._rollAffixVal = function(a, ilvl) {
  const f = 1 + (Math.max(1, ilvl) - 1) * 0.06;
  return Math.max(1, G.randInt(Math.round(a.min * f), Math.round(a.max * f)));
};
G._RARE_A = ['Gloom', 'Storm', 'Blood', 'Doom', 'Void', 'Wraith', 'Iron', 'Hex', 'Grim', 'Ember', 'Frost', 'Vile'];
G._RARE_B = ['bite', 'fang', 'ward', 'song', 'bane', 'reaver', 'shard', 'call', 'rend', 'veil', 'maw', 'grasp'];
G._itemName = function(base, rarity, affixes) {
  if(rarity === 'common') return base.name;
  if(rarity === 'magic') {
    const pre = affixes.find(a => a.kind === 'prefix'), suf = affixes.find(a => a.kind === 'suffix');
    return (pre ? pre.title + ' ' : '') + base.name + (suf ? ' ' + suf.word : '');
  }
  const a = G._RARE_A[(Math.random() * G._RARE_A.length) | 0], b = G._RARE_B[(Math.random() * G._RARE_B.length) | 0];
  return a + b + ' ' + base.name;
};
// Roll a gear instance from base item `baseId` at item level `ilvl`.
G.rollItem = function(baseId, ilvl = 1, opts = {}) {
  const base = G.ITEMS[baseId]; if(!base || !base.equipSlot) return null;
  ilvl = Math.max(1, ilvl | 0);
  const rarity = opts.rarity || G._rollRarity(opts.magicFind || 0);
  const rd = G.RARITIES[rarity];
  const mods = {};
  for(const k in (base.mods || {})) mods[k] = Math.round(base.mods[k] * rd.mult);
  let dmg = base.dmg != null ? Math.round(base.dmg * (1 + (ilvl - 1) * 0.04) * rd.mult) : null;
  const n = rd.affixes[1] ? G.randInt(rd.affixes[0], rd.affixes[1]) : 0;
  const pool = G._affixPool(base).slice(), chosen = [];
  for(let i = 0; i < n && pool.length; i++) {
    const a = pool.splice((Math.random() * pool.length) | 0, 1)[0];
    const val = G._rollAffixVal(a, ilvl);
    chosen.push({ id: a.id, kind: a.kind, title: a.title, word: a.word, stat: a.stat, value: val });
    if(a.stat === 'dmg') dmg = (dmg || 0) + val; else mods[a.stat] = (mods[a.stat] || 0) + val;
  }
  return { uid: 'g' + Date.now().toString(36) + ((Math.random() * 1e6) | 0).toString(36),
           base: baseId, rarity, ilvl, name: G._itemName(base, rarity, chosen), dmg, affixes: chosen, mods };
};

// Tooltip line list for a gear value (instance or base id).
G.gearTooltip = function(v) {
  const base = G.gearBase(v); if(!base) return [];
  const inst = (typeof v === 'object') ? v : null, rarity = G.gearRarity(v);
  const lines = [{ t: G.gearName(v), c: G.gearColor(v), head: true },
                 { t: (base.equipSlot || '').toUpperCase() + (inst ? '  ilvl ' + inst.ilvl : ''), c: '#8899aa' }];
  const dmg = G.gearDmg(v); if(dmg) lines.push({ t: 'Damage ' + dmg, c: '#ffbbaa' });
  const lbl = { armor:'Armor', hp:'Life', mana:'Mana', energy:'Energy', str:'Strength', dex:'Dexterity',
                int:'Intellect', vit:'Vitality', crit:'Crit %', resAll:'All Res %', lifeOnHit:'Life on Hit',
                moveSpeed:'Move Speed %', carry:'Cargo' };
  const m = G.gearMods(v) || {};
  for(const k in m) if(m[k]) lines.push({ t: '+' + m[k] + ' ' + (lbl[k] || k), c: '#88bbff' });
  return lines;
};

// Pick a planet character disposition from body stats. Higher danger → more
// hostiles; higher population/security → more friendly/faction folk.
G.rollDisposition = function(body, rng) {
  const r = rng ? rng() : Math.random();
  const danger = body?.danger ?? body?.threat ?? 0.3;          // 0..1
  const security = body?.security ?? (1 - danger);
  const pHostile  = G.clamp(0.10 + danger * 0.5, 0, 0.85);
  const pCautious = 0.20;
  const pFaction  = G.clamp(security * 0.25, 0, 0.4);
  const pFriendly = G.clamp(0.15 + security * 0.2, 0, 0.5);
  // normalize the four + neutral remainder
  let acc = 0;
  const bands = [['hostile', pHostile], ['cautious', pCautious], ['faction', pFaction], ['friendly', pFriendly]];
  const total = bands.reduce((s, b2) => s + b2[1], 0);
  const scale = total > 1 ? 1 / total : 1;
  for(const [name, p] of bands) { acc += p * scale; if(r < acc) return name; }
  return 'neutral';
};
