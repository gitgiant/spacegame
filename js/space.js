'use strict';
// ── Space scene ───────────────────────────────────────────
G.Space = class {
  constructor() {
    this.sysId      = 'sol';
    this.bodies     = [];
    this.asteroids  = [];
    this.derelicts  = [];
    this.enemies    = [];
    this.npcs       = [];
    this.turrets    = [];
    this.projectiles= [];
    this.floatingLoot=[];
    this.bgStars    = [];
    this.nebula     = null;
    this.fleetShips = [];
    this.escapePodEntities=[];
    this._cargoFullTimer = 0;
    this.time       = 0;
    this._npcSpawnTimer = 0;
    this._genBgStars(null);
  }

  _genBgStars(nebula) {
    this.bgStars = [];
    const starCount = nebula ? 180 : 300;
    for(let i=0;i<starCount;i++) {
      const bright = nebula ? 0.1+Math.random()*0.45 : 0.2+Math.random()*0.8;
      this.bgStars.push({
        x:Math.random()*5000-2500, y:Math.random()*5000-2500,
        r:Math.random()<0.05?2:1,
        brightness:bright,
        layer:Math.floor(Math.random()*3),
      });
    }

    this.bgDeepObjects = [];
    if(nebula) {
      // Nebula system: many large clouds of the system nebula type + dust
      for(let i=0;i<22;i++) {
        this.bgDeepObjects.push({
          x:Math.random()*12000-6000, y:Math.random()*12000-6000,
          type:nebula.type,
          size:100+Math.random()*220,
          rotation:Math.random()*Math.PI*2,
          alpha:0.18+Math.random()*0.32,
          parallax:0.007+Math.random()*0.018,
          idx:i,
        });
      }
      for(let i=0;i<8;i++) {
        this.bgDeepObjects.push({
          x:Math.random()*8000-4000, y:Math.random()*8000-4000,
          type:'dust',
          size:80+Math.random()*120,
          rotation:Math.random()*Math.PI*2,
          alpha:0.12+Math.random()*0.18,
          parallax:0.012+Math.random()*0.022,
          idx:22+i,
        });
      }
    } else {
      // Normal system: distant galaxies, light nebulae, dust
      const deepTypes = ['galaxy','galaxy','nebula_blue','nebula_purple','nebula_red','nebula_teal','dust','dust'];
      for(let i=0;i<16;i++) {
        this.bgDeepObjects.push({
          x:Math.random()*8000-4000, y:Math.random()*8000-4000,
          type:deepTypes[i % deepTypes.length],
          size:70+Math.random()*150,
          rotation:Math.random()*Math.PI*2,
          alpha:0.05+Math.random()*0.10,
          parallax:0.010+Math.random()*0.025,
          idx:i,
        });
      }
    }
  }

  loadSystem(sysId) {
    this.sysId = sysId;
    const sys  = G.SYSTEMS.find(s=>s.id===sysId);
    if(!sys) return;

    const local = G.generateLocalSystem(sys);
    this.bodies     = local.bodies;
    this.asteroids  = local.asteroids;
    this.hexTiles   = local.hexTiles || new Map();
    this._hazardTiles = this._buildHazardTiles();
    this.derelicts  = local.derelicts;
    this.turrets    = local.turrets || [];
    this.nebula     = local.nebula || null;
    this._genBgStars(this.nebula);
    this.enemies    = [];
    this.npcs       = [];
    this.fleetShips = [];
    this.projectiles= [];
    this.floatingLoot=[];
    this.escapePodEntities=[];
    this._npcSpawnTimer = 5;

    // Hostile enemy ships
    const nE = Math.floor(sys.danger * 1.3) + G.randInt(0, Math.max(0, sys.danger-2));
    const ed  = G.genEnemyShips(sys, Math.min(nE, 10));
    this.enemies = ed.map(d=>{const e=new G.EnemyAI(d); e.arriving=2.0; return e;});

    // Initial NPC ships (1–3)
    const npcCount = 1 + Math.floor(Math.random()*3);
    for(let i=0;i<npcCount;i++) {
      const npc = this._spawnNPC(sys);
      if(npc) npc.arriving = 2.0; // Show arrival effect for 2 seconds
    }

    // World events: small chance one is already underway on arrival
    this._eventTimer = 50 + Math.random()*70;
    if(Math.random() < 0.12) this._triggerEvent(true);
  }

  _spawnNPC(sysArg) {
    const sys  = sysArg || G.SYSTEMS.find(s=>s.id===this.sysId);
    if(!sys) return;

    // ~70% independent ships, ~30% faction ships in any system
    let faction = 'independent';
    if(sys.faction === 'earth' || sys.faction === 'rebellion') {
      if(Math.random() < 0.3) faction = sys.faction;
    } else if((sys.faction === 'pirate' || sys.faction === 'contested') && sys.danger >= 3) {
      if(Math.random() < 0.2) faction = 'pirate';
    }
    // High-danger systems get occasional pirate independents too
    if(faction === 'independent' && sys.danger >= 5 && Math.random() < 0.1) {
      faction = 'pirate';
    }

    const npc = new G.NPCShip(faction, this.bodies, this.sysId);

    // Rep-based hostility: unfriendly faction ships start hostile
    if(faction !== 'independent' && faction !== 'neutral' && G.game) {
      const rel = G.game.getRel(faction);
      let spawnHostile = false;
      if(rel <= -75) {
        spawnHostile = true;                                  // always hostile
      } else if(rel < -30) {
        const chance = (-30 - rel) / 45 * 0.65;              // 0 at -30, ~0.65 at -75
        spawnHostile = Math.random() < chance;
      }
      if(spawnHostile) {
        npc.hostile = true;
        npc.combatTarget = G.game.player;
        const bank = G.COMMS_LINES?.[faction]||G.COMMS_LINES?.independent;
        const lines = bank?.hostile||['Opening fire!'];
        G.ui?.addMsg('['+npc.name+']: "'+lines[Math.floor(Math.random()*lines.length)]+'"', G.FACTIONS[faction]?.color||'#ff4444');
      }
    }

    this.npcs.push(npc);
    return npc;
  }

  // ── World events ─────────────────────────────────────────
  _fleetSize(tier) {
    const r = { small:[2,3], medium:[4,6], large:[7,10] }[tier] || [2,3];
    return G.randInt(r[0], r[1]);
  }

  _eventSpawnPoint(minD=1800, maxD=2800) {
    const p = G.game?.player;
    const ox = p ? p.x : 0, oy = p ? p.y : 0;
    const a = Math.random()*Math.PI*2;
    const d = minD + Math.random()*(maxD-minD);
    return { x: ox + Math.cos(a)*d, y: oy + Math.sin(a)*d };
  }

  // Hostile fleets warp into an empty hex beyond the outermost system body
  _hostileHexSpawnPoint() {
    const maxOrbit = this.bodies.reduce((m, b) => Math.max(m, b.orbitR || 0), 0);
    const minD = Math.max(maxOrbit + 1200, 4000);
    const d = minD + Math.random() * 2500;
    const a = Math.random() * Math.PI * 2;
    return { x: Math.cos(a)*d, y: Math.sin(a)*d };
  }

  // Spawn `size` NPC ships of `faction` clustered around (opts.x, opts.y).
  _spawnEventFleet(faction, size, opts={}) {
    const cx = opts.x ?? 0, cy = opts.y ?? 0;
    const ships = [];
    for(let i=0;i<size;i++) {
      const n = new G.NPCShip(faction, this.bodies, this.sysId);
      n.x = cx + (Math.random()-0.5)*500;
      n.y = cy + (Math.random()-0.5)*500;
      n.angle = Math.random()*Math.PI*2;
      n.arriving = 2.0;
      n.jumpingIn = true; n.jumpInTimer = 0.5;
      if(opts.hostileTarget) { n.hostile = true; n.combatTarget = opts.hostileTarget; }
      this.npcs.push(n);
      ships.push(n);
    }
    return ships;
  }

  // Roll and spawn a random world event. Logs a line to the message feed.
  _triggerEvent(onArrival, particles) {
    const sys = G.SYSTEMS.find(s=>s.id===this.sysId);
    if(!sys) return;
    if(this.npcs.length > 24) return; // don't flood the system
    const log = (msg, col) => G.ui?.addMsg('◆ EVENT: ' + msg, col || '#ffcc66');
    const tier = ['small','small','medium','medium','large'][Math.floor(Math.random()*5)];
    const TIER = tier.toUpperCase();
    const facName = f => (G.FACTIONS[f]?.name || f);
    const facCol  = f => (G.FACTIONS[f]?.color || '#ffcc66');
    const roll = Math.random();

    if(roll < 0.25) {
      // Faction patrol / military fleet — warps in from outer hex
      const pt = this._hostileHexSpawnPoint();
      const fac = sys.faction==='rebellion' ? 'rebellion'
                : (sys.faction==='pirate' || sys.faction==='alien') ? sys.faction
                : 'earth';
      const n = this._fleetSize(tier);
      this._spawnEventFleet(fac, n, { x:pt.x, y:pt.y, particles });
      log(`A ${TIER} ${facName(fac)} fleet (${n} ships) has jumped in.`, facCol(fac));

    } else if(roll < 0.45) {
      // Pirate raiding party — warps in from outer hex
      const pt = this._hostileHexSpawnPoint();
      const n = this._fleetSize(tier);
      this._spawnEventFleet('pirate', n, { x:pt.x, y:pt.y, particles });
      log(`A ${TIER} pirate raiding party (${n} ships) has arrived!`, '#ff5544');

    } else if(roll < 0.70) {
      // Two opposing fleets — each warps in from separate outer hexes
      const pairs = [['earth','pirate'],['earth','alien'],['rebellion','alien']];
      const [fA, fB] = pairs[Math.floor(Math.random()*pairs.length)];
      const nA = this._fleetSize(tier);
      const nB = this._fleetSize(['small','medium','large'][Math.floor(Math.random()*3)]);
      const ptA = this._hostileHexSpawnPoint();
      const ptB = this._hostileHexSpawnPoint();
      this._spawnEventFleet(fA, nA, { x:ptA.x, y:ptA.y, particles });
      this._spawnEventFleet(fB, nB, { x:ptB.x, y:ptB.y, particles });
      log(`Combat detected — ${facName(fA)} (${nA}) engaging ${facName(fB)} (${nB})!`, '#ffaa33');

    } else if(roll < 0.88) {
      // Merchant convoy — arrives via normal space lanes
      const pt = this._eventSpawnPoint();
      const n = this._fleetSize(tier==='large' ? 'medium' : tier);
      this._spawnEventFleet('independent', n, { x:pt.x, y:pt.y, particles });
      log(`A merchant convoy (${n} ships) is passing through the system.`, '#66ccff');

    } else {
      // Merchant convoy pursued by pirates — pirates from outer hex
      const pt = this._eventSpawnPoint();
      const nm = this._fleetSize('small');
      const merchants = this._spawnEventFleet('independent', nm, { x:pt.x, y:pt.y, particles });
      const np = this._fleetSize(Math.random()<0.5 ? 'small' : 'medium');
      const ptP = this._hostileHexSpawnPoint();
      const pirates = this._spawnEventFleet('pirate', np, { x:ptP.x, y:ptP.y, particles });
      for(const pir of pirates) {
        pir.hostile = true;
        pir.combatTarget = merchants[Math.floor(Math.random()*merchants.length)];
      }
      log(`Distress call — a merchant convoy (${nm}) is being pursued by pirates (${np})!`, '#ff8844');
    }
  }

  update(dt, player, input, particles, now) {
    this.time += dt;
    if(this._cargoFullTimer > 0) this._cargoFullTimer -= dt;

    // Orbit bodies (parent bodies must appear before children in the array)
    for(const b of this.bodies) {
      if(b.orbitR) {
        b.orbitAngle += (b.orbitSpeed || 0);
        const cx = b.orbitParent ? b.orbitParent.x : 0;
        const cy = b.orbitParent ? b.orbitParent.y : 0;
        b.x = cx + Math.cos(b.orbitAngle) * b.orbitR;
        b.y = cy + Math.sin(b.orbitAngle) * b.orbitR;
      }
    }

    // Turrets
    for(const t of this.turrets) {
      if(t._dead) continue;
      // Orbit parent body
      if(t.orbitParent) {
        t.orbitAngle += t.orbitSpeed;
        t.x = t.orbitParent.x + Math.cos(t.orbitAngle) * t.orbitR;
        t.y = t.orbitParent.y + Math.sin(t.orbitAngle) * t.orbitR;
      }
      // Become hostile if rep is very low with this faction
      const rel = G.game?.getRel(t.faction) || 0;
      if(rel < -40 && !t.hostile) t.hostile = true;

      // Fire at player if hostile and in range
      t.weaponCooldown -= dt;
      if(t.hostile && t.weaponCooldown <= 0) {
        const d = Math.hypot(player.x - t.x, player.y - t.y);
        if(d < t.range) {
          const ang = Math.atan2(player.x - t.x, -(player.y - t.y));
          const accuracy = t.accuracy || 0;
          const angleVariation = (Math.random() - 0.5) * accuracy;
          const finalAng = ang + angleVariation;
          this.projectiles.push({
            x:t.x, y:t.y,
            vx:Math.sin(finalAng)*680, vy:-Math.cos(finalAng)*680,
            damage:t.damage, type:'laser',
            color:'#ffaa00', width:2,
            ttl:t.range/680, pierce:false, splash:0, sourceId:'turret',
          });
          t.weaponCooldown = 1 / t.fireRate;
        }
      }
    }

    // Asteroids
    for(const a of this.asteroids) { a.x+=a.vx*dt; a.y+=a.vy*dt; a.angle+=a.rotSpeed*dt; }

    // Derelicts
    for(const d of this.derelicts) { if(!d.angle)d.angle=0; d.angle+=0.1*dt; }

    // Enemies
    for(let i=this.enemies.length-1;i>=0;i--) {
      const e=this.enemies[i];
      if(e._deathDone){this.enemies.splice(i,1);continue;}
      if(e.dead){this._updateDying(e,dt,particles,true);continue;}
      e.update(dt,player,this.projectiles,particles,now);
      if(e.arriving) e.arriving -= dt;
      if(e._boosting && !e._prevBoosting) {
        const bd = Math.hypot(e.x - player.x, e.y - player.y);
        if(bd < 1400) G.sound?.boost(G.clamp((e.x-player.x)/900,-1,1));
      }
      e._prevBoosting = e._boosting;
      if(e._boosting&&!e.disabled&&particles&&Math.random()<0.7)
        particles.boost_trail(e.x,e.y,e.angle,e.size||1);
    }

    // NPC ships
    for(let i=this.npcs.length-1;i>=0;i--) {
      const n=this.npcs[i];
      if(n._deathDone){this.npcs.splice(i,1);continue;}
      if(n.dead){this._updateDying(n,dt,particles,false);continue;}
      n.update(dt, this.bodies, this.npcs, this.enemies, this.projectiles, particles, now);
      if(n.arriving) n.arriving -= dt;
      if(n._boosting && !n._prevBoosting) {
        const bd = Math.hypot(n.x - player.x, n.y - player.y);
        if(bd < 1400) G.sound?.boost(G.clamp((n.x-player.x)/900,-1,1));
      }
      n._prevBoosting = n._boosting;
      if(n._boosting&&n.aiState!=='docked'&&!n.disabled&&particles&&Math.random()<0.6)
        particles.boost_trail(n.x,n.y,n.angle,n.size||1);
    }

    // Ship and asteroid collision resolution
    this._resolveShipCollisions(player, dt, particles);

    // NPC respawn timer
    this._npcSpawnTimer -= dt;
    if(this._npcSpawnTimer <= 0 && this.npcs.length < 6) {
      this._npcSpawnTimer = 15 + Math.random()*20;
      this._spawnNPC();
    }

    // World events: periodic small chance to spawn one during the stay
    if(this._eventTimer == null) this._eventTimer = 60;
    this._eventTimer -= dt;
    if(this._eventTimer <= 0) {
      this._eventTimer = 70 + Math.random()*90;
      if(Math.random() < 0.45) this._triggerEvent(false, particles);
    }

    // Respawn hostile enemies
    const sys = G.SYSTEMS.find(s=>s.id===this.sysId);
    if(sys && this.enemies.length < Math.max(1, sys.danger-2) && Math.random()<dt*0.04) {
      const newD = G.genEnemyShips(sys, 1);
      if(newD.length) {
        const e = new G.EnemyAI(newD[0]);
        const a = Math.random()*Math.PI*2;
        e.x = player.x+Math.cos(a)*2200; e.y = player.y+Math.sin(a)*2200;
        this.enemies.push(e);
      }
    }

    // Chaff balls: travel, then explode into clouds after 1s
    if(this.chaffBalls?.length) {
      for(let bi=this.chaffBalls.length-1;bi>=0;bi--) {
        const ball = this.chaffBalls[bi];
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        ball.vx *= 0.94; ball.vy *= 0.94;
        ball.timer -= dt;
        if(ball.timer <= 0) {
          this.chaffClouds = this.chaffClouds || [];
          this.chaffClouds.push({ x:ball.x, y:ball.y, r:ball.r, timer:3.5 });
          if(particles) particles.chaff_burst(ball.x, ball.y, ball.vx, ball.vy);
          G.sound?.abilityChaff?.();
          this.chaffBalls.splice(bi,1);
        }
      }
    }

    // Escape pod entities
    for(let _epi=this.escapePodEntities.length-1;_epi>=0;_epi--) {
      const _ep=this.escapePodEntities[_epi];
      _ep.x+=_ep.vx*dt; _ep.y+=_ep.vy*dt;
      _ep.vx*=0.997; _ep.vy*=0.997;
      _ep.angle+=_ep.rotSpeed*dt;
      _ep.timer-=dt;
      if(_ep.timer<=0) {
        if(G.game?._escapePodFollowing === _ep) {
          G.game._podLanded(_ep);
        }
        this.escapePodEntities.splice(_epi,1);
      }
    }

    // Chaff clouds: tick timer and detonate missiles that fly through them
    if(this.chaffClouds?.length) {
      for(let ci=this.chaffClouds.length-1;ci>=0;ci--) {
        const cloud = this.chaffClouds[ci];
        cloud.timer -= dt;
        if(cloud.timer <= 0) { this.chaffClouds.splice(ci,1); continue; }
      }
    }

    // Projectiles
    for(let i=this.projectiles.length-1;i>=0;i--) {
      const p=this.projectiles[i];
      p.ttl-=dt;
      if(p.ttl<=0){this.projectiles.splice(i,1);continue;}

      // Chaff balls: enemy missiles near a ball detonate the ball early
      if(p.type === 'missile' && p.sourceId !== 'player' && this.chaffBalls?.length) {
        let ballHit = false;
        for(let bi=this.chaffBalls.length-1;bi>=0;bi--) {
          const ball = this.chaffBalls[bi];
          if(Math.hypot(p.x - ball.x, p.y - ball.y) < 40) {
            this.chaffClouds = this.chaffClouds || [];
            this.chaffClouds.push({ x:ball.x, y:ball.y, r:ball.r, timer:3.5 });
            if(particles) { particles.chaff_burst(ball.x, ball.y, ball.vx, ball.vy); particles.explosion(p.x, p.y, 0, 0, 0.5); }
            G.sound?.abilityChaff?.(); G.sound?.explosion?.(Math.hypot(p.x-player.x,p.y-player.y), G.clamp((p.x-player.x)/900,-1,1));
            this.chaffBalls.splice(bi,1);
            this.projectiles.splice(i,1);
            ballHit = true; break;
          }
        }
        if(ballHit) continue;
      }
      // Chaff clouds: enemy missiles that enter a chaff cloud explode immediately
      if(p.type === 'missile' && p.sourceId !== 'player' && this.chaffClouds?.length) {
        let chaffHit = false;
        for(const cloud of this.chaffClouds) {
          if(Math.hypot(p.x - cloud.x, p.y - cloud.y) < cloud.r) {
            if(particles) particles.explosion(p.x, p.y, 0, 0, 0.5);
            G.sound?.explosion?.(Math.hypot(p.x-player.x,p.y-player.y), G.clamp((p.x-player.x)/900,-1,1));
            p.tracking = false;
            this.projectiles.splice(i,1);
            chaffHit = true; break;
          }
        }
        if(chaffHit) continue;
      }

      // Missile dormant phase: coast for 2s before engine ignites
      if(p.type === 'missile' && p.dormant) {
        p.dormantT -= dt;
        if(p.dormantT <= 0) {
          p.dormant = false;
          const spd2 = Math.sqrt(p.vx*p.vx+p.vy*p.vy)||1;
          const targetSpd = G.WEAPONS[p.weaponId]?.projSpeed || 480;
          p.vx = (p.vx/spd2)*targetSpd;
          p.vy = (p.vy/spd2)*targetSpd;
        }
      }
      // Missile tracking (only when engine active)
      if(p.tracking && !p.dormant) {
        let tgt = null;
        if(p.sourceId==='player') {
          tgt = G.game?.target;
        } else if(p.trackTarget) {
          tgt = p.trackTarget;
        }
        if(tgt && (p.sourceId==='player' ? !tgt.dead : true)) {
          const ta=Math.atan2(tgt.x-p.x,-(tgt.y-p.y));
          const da=G.wrapAngle(ta-Math.atan2(p.vx,-p.vy));
          const spd=Math.sqrt(p.vx*p.vx+p.vy*p.vy);
          const na=Math.atan2(p.vx,-p.vy)+G.clamp(da,-3.5*dt,3.5*dt);
          p.vx=Math.sin(na)*spd; p.vy=-Math.cos(na)*spd;
        }
      }
      // Missile engine trail particles (only when engine active)
      if(p.type==='missile' && !p.dormant && particles && Math.random()<0.8)
        particles.emit({x:p.x,y:p.y,minSpd:15,maxSpd:50,life:0.25,r:2,color:'rgba(120,190,255,0.8)'});

      p.x+=p.vx*dt; p.y+=p.vy*dt;

      if(p.type==='laser'&&particles&&Math.random()<0.3)
        particles.emit({x:p.x,y:p.y,minSpd:5,maxSpd:20,life:0.06,r:1.5,color:p.color});

      // Hit detection
      if(p.sourceId==='player') {
        // Mining laser vs asteroids
        if(p.type === 'mining') {
          let mined = false;
          for(let j=this.asteroids.length-1;j>=0;j--){
            const cl=this.asteroids[j];
            if((p.x-cl.x)**2+(p.y-cl.y)**2 > (cl.r+8)**2) continue;
            const t = G.astHitTile(cl, p.x, p.y, 6);
            if(!t) continue;
            const wpnDef = G.WEAPONS[p.weaponId];
            const mineRate = wpnDef?.mineRate || 12;
            this._mineTile(cl, j, t, mineRate, particles, { qty:G.randInt(1,3) });
            this.projectiles.splice(i,1);
            mined=true; break;
          }
          if(mined) continue;
        }

        // Regular weapons can chip at asteroid tiles (much less efficient than the mining laser)
        if(p.type !== 'mining') {
          let hitC=false;
          for(let j=this.asteroids.length-1;j>=0;j--){
            const cl=this.asteroids[j];
            if((p.x-cl.x)**2+(p.y-cl.y)**2 > (cl.r+6)**2) continue;
            const t = G.astHitTile(cl, p.x, p.y, 4);
            if(!t) continue;
            // ~2% of normal weapon damage as mining effectiveness
            const chipDmg = Math.max(0.05, p.damage * 0.02);
            this._mineTile(cl, j, t, chipDmg, particles, { qty:1 });
            hitC=true;
            if(!p.pierce) this.projectiles.splice(i,1);
            break;
          }
          if(hitC && !p.pierce) continue;
        }

        // vs enemies
        for(let j=this.enemies.length-1;j>=0;j--) {
          const e=this.enemies[j];
          if(e.dead||e._deathDone||e.boarded) continue;
          if(G.shipHexHit(e,p.x,p.y)) {
            this._onHitEnemy(e,p,particles); if(!p.pierce){this.projectiles.splice(i,1);break;}
          }
        }
        // vs NPCs
        if(this.projectiles[i]===p) {
          for(let j=this.npcs.length-1;j>=0;j--) {
            const n=this.npcs[j];
            if(n.dead||n._deathDone||n.boarded) continue;
            if(G.shipHexHit(n,p.x,p.y)) {
              this._playerHitsNPC(n,p,player,particles);
              if(!p.pierce){this.projectiles.splice(i,1);break;}
            }
          }
        }
        // vs turrets
        if(this.projectiles[i]===p) {
          for(const t of this.turrets) {
            if(t._dead) continue;
            if(G.circleHit(p.x,p.y,4,t.x,t.y,14)){
              if(!t.hostile) {
                t.hostile=true; t._attackedByPlayer=true;
                if(t.faction!=='independent') G.game.setRel(t.faction, G.game.getRel(t.faction)-8, 'attacked turret');
              }
              t.hp -= p.damage;
              if(particles) particles.burst({x:p.x,y:p.y,minSpd:20,maxSpd:80,life:0.15,r:2,color:'#ffaa00'},4);
              if(t.hp<=0){
                t._dead=true;
                if(particles) particles.explosion(t.x,t.y,0,0,0.4);
                G.sound?.explosion(Math.hypot(t.x-player.x,t.y-player.y), G.clamp((t.x-player.x)/900,-1,1));
              } else {
                G.sound?.weaponHit(p.type, G.clamp((t.x-player.x)/900,-1,1));
              }
              if(t.hp<=0) {
                // Small loot drop
                const _td=['kinetic_rounds','metal_ore','electronics'];
                const _ti=_td[Math.floor(Math.random()*_td.length)];
                this.floatingLoot.push({x:t.x+(Math.random()-0.5)*30,y:t.y+(Math.random()-0.5)*30,
                  vx:(Math.random()-0.5)*50,vy:(Math.random()-0.5)*50,
                  type:'item',itemId:_ti,qty:1+Math.floor(Math.random()*2),
                  rarity:G.ITEMS[_ti]?.rarity||'c',ttl:40,
                  color:G.rarityColor(G.ITEMS[_ti]?.rarity||'c')});
                if(Math.random()<0.15) this.floatingLoot.push({
                  x:t.x,y:t.y,vx:(Math.random()-0.5)*40,vy:(Math.random()-0.5)*40,
                  type:'credits',amount:50+Math.floor(Math.random()*80),ttl:30,color:'#ffcc00'});
              }
              if(!p.pierce){this.projectiles.splice(i,1);break;}
            }
          }
        }
        // vs derelicts
        if(this.projectiles[i]===p) {
          for(let j=this.derelicts.length-1;j>=0;j--) {
            const d=this.derelicts[j];
            if(d.looted||d.dead) continue;
            if(G.circleHit(p.x,p.y,4,d.x,d.y,20)) {
              d.hp -= p.damage;
              if(particles) particles.burst({x:p.x,y:p.y,minSpd:20,maxSpd:80,life:0.15,r:2,color:'#ddaa44'},4);
              if(d.hp <= 0) {
                d.looted = true; d.dead = true;
                if(particles) particles.explosion(d.x,d.y,0,0,0.6);
                const sys=G.SYSTEMS.find(s=>s.id===this.sysId);
                const drops=G.genLoot((sys?.danger||1)+1,150);
                for(let k=0;k<Math.ceil(drops.length*0.5);k++) {
                  if(k>=drops.length) break;
                  const dr=drops[k];
                  this.floatingLoot.push({
                    x:d.x+(Math.random()-0.5)*30, y:d.y+(Math.random()-0.5)*30,
                    vx:(Math.random()-0.5)*150, vy:(Math.random()-0.5)*150,
                    type:'item', itemId:dr.id, qty:dr.qty, rarity:G.ITEMS[dr.id]?.rarity||'c',
                    ttl:60, color:G.rarityColor(G.ITEMS[dr.id]?.rarity||'c'),
                  });
                }
                G.ui?.addMsg('Derelict destroyed!','#ff8844');
              }
              if(!p.pierce){this.projectiles.splice(i,1);break;}
            }
          }
        }
        // Splash damage
        if(this.projectiles[i]===p && p.splash>0) {
          this._splashDamage(p,[...this.enemies,...this.npcs],particles);
        }
      } else {
        // Fleet ship projectile: hits enemies and hostile NPCs
        const isFleetShot = this.fleetShips.some(fs=>fs.id===p.sourceId);
        if(isFleetShot) {
          for(let j=this.enemies.length-1;j>=0;j--){
            const e=this.enemies[j];
            if(e.dead||e._deathDone||e.boarded) continue;
            if(G.shipHexHit(e,p.x,p.y)){
              this._onHitEnemy(e,p,particles);
              if(p.type==='missile' && particles) this._missileExplosion(p,particles);
              if(!p.pierce){this.projectiles.splice(i,1);break;}
            }
          }
          if(this.projectiles[i]===p){
            for(let j=this.npcs.length-1;j>=0;j--){
              const n=this.npcs[j];
              if(!n.hostile||n.dead||n._deathDone) continue;
              if(G.shipHexHit(n,p.x,p.y)){
                this._applyHit(n,p.damage,p.type,p.x,p.y);
                if(particles)particles.burst({x:p.x,y:p.y,minSpd:20,maxSpd:80,life:0.15,r:2,color:p.color},4);
                if(p.type==='missile' && particles) this._missileExplosion(p,particles);
                if(!p.pierce){this.projectiles.splice(i,1);break;}
              }
            }
          }
        } else {
          // Enemy/NPC/turret projectile: hits player and fleet ships
          if(G.shipHexHit(player,p.x,p.y)){
            this._onHitPlayer(player,p,particles);
            if(p.type==='missile' && particles) this._missileExplosion(p,particles);
            this.projectiles.splice(i,1);
          } else if(this.projectiles[i]===p) {
            for(const fs of this.fleetShips){
              if(fs.dead||fs._deathDone) continue;
              if(G.shipHexHit(fs,p.x,p.y)){
                this._applyHit(fs,p.damage,p.type,p.x,p.y);
                if(particles)particles.burst({x:p.x,y:p.y,minSpd:20,maxSpd:80,life:0.15,r:2,color:p.color},4);
                if(p.type==='missile' && particles) this._missileExplosion(p,particles);
                if(!p.pierce){this.projectiles.splice(i,1);break;}
              }
            }
          }
          // Cross-faction: NPC/enemy shots also hit ships from hostile factions
          if(this.projectiles[i]===p && p.sourceId!=='turret') {
            const shooter=[...this.npcs,...this.enemies].find(s=>s.id===p.sourceId);
            if(shooter) {
              const hostile=G.HOSTILE[shooter.faction]||{};
              for(let j=this.enemies.length-1;j>=0;j--){
                const e=this.enemies[j];
                if(e.dead||e._deathDone||e.boarded||e.id===shooter.id) continue;
                if(!hostile[e.faction]) continue;
                if(G.shipHexHit(e,p.x,p.y)){
                  this._onHitEnemy(e,p,particles);
                  if(p.type==='missile'&&particles) this._missileExplosion(p,particles);
                  if(!p.pierce){this.projectiles.splice(i,1);break;}
                }
              }
              if(this.projectiles[i]===p) {
                for(let j=this.npcs.length-1;j>=0;j--){
                  const n=this.npcs[j];
                  if(n.dead||n._deathDone||n.id===shooter.id) continue;
                  if(!hostile[n.faction]) continue;
                  if(G.shipHexHit(n,p.x,p.y)){
                    this._applyHit(n,p.damage,p.type,p.x,p.y);
                    if(particles)particles.burst({x:p.x,y:p.y,minSpd:20,maxSpd:80,life:0.15,r:2,color:p.color},4);
                    if(p.type==='missile'&&particles) this._missileExplosion(p,particles);
                    if(!p.pierce){this.projectiles.splice(i,1);break;}
                  }
                }
              }
            }
          }
        }
      }
    }

    // Player/fleet shots can intercept enemy missiles
    {
      const exploded = new Set(), usedShots = new Set();
      for(let i = 0; i < this.projectiles.length; i++) {
        const m = this.projectiles[i];
        if(m.type !== 'missile' || m.sourceId === 'player' || exploded.has(m)) continue;
        if(this.fleetShips.some(fs => fs.id === m.sourceId)) continue;
        for(let j = 0; j < this.projectiles.length; j++) {
          if(j === i || usedShots.has(this.projectiles[j])) continue;
          const shot = this.projectiles[j];
          if(shot.type === 'missile') continue;
          const isFriendly = shot.sourceId === 'player' || this.fleetShips.some(fs => fs.id === shot.sourceId);
          if(!isFriendly) continue;
          if(G.circleHit(shot.x, shot.y, 4, m.x, m.y, 10)) {
            exploded.add(m);
            m.dead = true;
            this._missileExplosion(m, particles);
            if(!shot.pierce) usedShots.add(shot);
            G.ui?.addMsg('Missile intercepted!', '#44ffff');
            break;
          }
        }
      }
      if(exploded.size || usedShots.size)
        this.projectiles = this.projectiles.filter(p => !exploded.has(p) && !usedShots.has(p));
    }

    // Fleet ships (player escorts)
    for(let i=this.fleetShips.length-1;i>=0;i--) {
      const fs=this.fleetShips[i];
      if(fs._deathDone){this.fleetShips.splice(i,1);continue;}
      if(fs.dead){
        if(!fs._dyingInitialized){
          fs._dyingInitialized=true; fs._dyingTimer=1.5; fs._dyingNextBang=0.15;
          G.game?.removeFleetShip(fs.fleetDataId);
          G.ui?.addMsg(fs.name+' DESTROYED','#ff6644');
          this._dropLoot(fs);
        }
        fs._dyingTimer-=dt; fs._dyingNextBang-=dt;
        if(fs._dyingNextBang<=0&&particles){
          particles.explosion(fs.x+(Math.random()-0.5)*30,fs.y+(Math.random()-0.5)*30,0,0,0.3);
          G.sound?.explosion(Math.hypot(fs.x-player.x,fs.y-player.y), G.clamp((fs.x-player.x)/900,-1,1));
          fs._dyingNextBang=0.25;
        }
        fs.x+=fs.vx*dt; fs.y+=fs.vy*dt;
        if(fs._dyingTimer<=0){
          if(particles)particles.explosion(fs.x,fs.y,fs.vx,fs.vy,(fs.size||1)*1.5);
          G.sound?.explosion(Math.hypot(fs.x-player.x,fs.y-player.y), G.clamp((fs.x-player.x)/900,-1,1));
          fs._deathDone=true;
        }
        continue;
      }
      // Drop loot the first time a fleet ship becomes disabled
      if(fs.disabled && !fs._disabledLootDropped) {
        fs._disabledLootDropped = true;
        this._dropLoot(fs);
        G.ui?.addMsg(fs.name+' DISABLED — cargo ejected','#ff8844');
      }
      fs.update(dt, player, G.game?.target, this.projectiles, particles, now);
    }

    // Floating loot pickup + magnet attraction
    const MAGNET_RANGE = 220;
    const MAGNET_ACCEL = 480;
    for(let i=this.floatingLoot.length-1;i>=0;i--) {
      const l=this.floatingLoot[i];
      l.ttl-=dt; if(l.ttl<=0){this.floatingLoot.splice(i,1);continue;}
      // Attract toward player when nearby
      const dx=player.x-l.x, dy=player.y-l.y;
      const d=Math.hypot(dx,dy)||1;
      if(d < MAGNET_RANGE) {
        const strength = MAGNET_ACCEL * (1 - d/MAGNET_RANGE);
        l.vx += (dx/d)*strength*dt;
        l.vy += (dy/d)*strength*dt;
      }
      l.x+=l.vx*dt; l.y+=l.vy*dt; l.vx*=0.96; l.vy*=0.96;
      if(l.pickupDelay > 0) { l.pickupDelay -= dt; continue; }
      const cr=player.tractorRange>0?player.tractorRange+40:50;
      if(d<cr) {
        const collected = this._collectLoot(l,player);
        if(collected) {
          this.floatingLoot.splice(i,1);
        } else if(l.type==='item' && l.ttl < 45) {
          l.ttl = 45;
        }
      }
    }

    this._applyHexEffects(dt, player, particles);
  }

  // Hex tile type at a world position ('empty' if untyped/out of range).
  tileTypeAt(x, y) {
    if(!this.hexTiles) return 'empty';
    const h = G.worldToHex(x, y);
    return this.hexTiles.get(h.q + ',' + h.r)?.type || 'empty';
  }

  // Hex tile types that damage ships (NPC AI steers around these).
  static DAMAGING_TILES = { sun:1, near_sun:1 };
  _isDamagingTile(type) { return !!G.Space.DAMAGING_TILES[type]; }

  // World centres of every damaging hex tile in the current system (cached on load).
  _buildHazardTiles() {
    const out = [];
    if(!this.hexTiles) return out;
    for(const t of this.hexTiles.values()) {
      if(this._isDamagingTile(t.type)) {
        const w = G.hexToWorld(t.q, t.r);
        out.push({ x:w.x, y:w.y, type:t.type });
      }
    }
    return out;
  }

  // Per-frame typed-hex effects: sun/near-sun damage-over-time on every ship,
  // dust obscuring flags, and AI avoidance of the sun hex.
  _applyHexEffects(dt, player, particles) {
    const SUN_DPS = 30, NEAR_SUN_DPS = 0.8;
    const ships = [player, ...this.enemies, ...this.npcs, ...this.fleetShips];
    for(const s of ships) {
      if(!s || s.dead || s._deathDone) continue;
      const type = this.tileTypeAt(s.x, s.y);
      s._inDust = (type === 'dust');
      // Sun/near-sun damage removed
      if(false && (type === 'sun' || type === 'near_sun')) {
        // Damage removed
      }
      // AI avoidance logic removed
    }
    this._playerInDust = !!player && !player.dead && this.tileTypeAt(player.x, player.y) === 'dust';

    // Sun glow effect based on distance to sun center
    if(player && !player.dead && G.game) {
      const sunR = G.HEX_WORLD * 1.6;
      const d = Math.hypot(player.x, player.y);
      const targetAlpha = Math.max(0, 1 - (d / sunR)) * 0.8;
      G.game._sunGlowAlpha += (targetAlpha - G.game._sunGlowAlpha) * Math.min(dt * 3, 1);
    }
  }

  // ── Damage handlers ─────────────────────────────────────

  // Unified hit pipeline for ALL ships. Shields absorb first (takeDamage), then
  // the FULL penetrating remainder damages the nearest live module at (hx,hy) —
  // there is no hull/hp pool. The player holds modules directly; AI ships carry a
  // backing G.Ship in `.ship`. Breaking a module updates vitals: power/cockpit
  // loss disables (AI), core loss kills (explosion). Player core loss = game over.
  _applyHit(target, amount, type, hx, hy, factor = 1.0) {
    const res = target.takeDamage(amount, type);
    if(res.hullDmg > 0) {
      const hull = (target instanceof G.Ship) ? target : target.ship;
      if(hull && hull._damageModuleAtPoint) {
        if(target !== hull) G.aiSyncHull(target);   // align backing-hull transform
        const bm = hull._damageModuleAtPoint(hx, hy, res.hullDmg * factor);
        if(bm && target !== hull) G.aiOnModuleBroken(target, bm);
        if(bm && target === G.game?.player) {
          G.ui?.addMsg(bm.slot === 'core'
            ? '⚠ CORE MODULE DESTROYED — CATASTROPHIC FAILURE!'
            : '⚠ MODULE DESTROYED: ' + bm.name, bm.slot === 'core' ? '#ff1111' : '#ff6622');
        }
        // Player ship is the hull itself: core gone -> trigger death sequence.
        if(target === G.game?.player && hull._coreDestroyed) G.game?._playerDied?.();
      }
    }
    return res;
  }

  _playerHitsNPC(npc, proj, player, particles) {
    const wasHostile = npc.hostile;

    // Make NPC hostile and point it at the player
    if(!npc.hostile) {
      npc.hostile = true;
      npc.combatTarget = player;
      npc.dockTimer = 0; // break out of docked state immediately
      const bank = G.COMMS_LINES?.[npc.faction]||G.COMMS_LINES?.independent;
      const lines = bank?.hostile||['Opening fire!'];
      G.ui?.openCommsHostile(npc, lines[Math.floor(Math.random()*lines.length)]);
    }

    // Rep loss with their faction (not for independents)
    if(npc.faction !== 'independent') {
      G.game.setRel(npc.faction, G.game.getRel(npc.faction) - 6, 'attacked '+npc.name);
      // Witnesses of same faction within range go hostile
      const sensorR = player.sensorRange || 700;
      for(const other of this.npcs) {
        if(other===npc||other.dead) continue;
        if(other.faction===npc.faction) {
          if(Math.hypot(other.x-npc.x,other.y-npc.y) < sensorR) {
            if(!other.hostile) {
              other.hostile = true;
              other.combatTarget = player;
              other.dockTimer = 0;
              const bank2 = G.COMMS_LINES?.[other.faction]||G.COMMS_LINES?.independent;
              const lines2 = bank2?.hostile||['Opening fire!'];
              const dist2 = Math.hypot(other.x-player.x, other.y-player.y);
              if(dist2 < 900) G.ui?.addMsg('['+other.name+']: "'+lines2[Math.floor(Math.random()*lines2.length)]+'"', G.FACTIONS[other.faction]?.color||'#ff4444');
            } else {
              other.combatTarget = player;
              other.dockTimer = 0;
            }
          }
        }
      }
    } else {
      // Independent: small rep loss with the owning faction for attacking in their space
      const sys = G.SYSTEMS.find(s=>s.id===this.sysId);
      const ownerFac = sys?.faction;
      if(ownerFac && ownerFac !== 'independent' && ownerFac !== 'contested' && ownerFac !== 'neutral') {
        G.game.setRel(ownerFac, G.game.getRel(ownerFac) - 2, 'attacked civilian in '+G.FACTIONS[ownerFac]?.name+' space');
        // Law-enforcement witnesses escalate and aggressively react
        for(const w of this.npcs) {
          if(w.faction===ownerFac && Math.hypot(w.x-npc.x,w.y-npc.y)<700) {
            w.hostile=true; w.combatTarget=player; w.dockTimer=0;
            G.game.setRel(ownerFac, G.game.getRel(ownerFac) - 3, 'witnessed by patrol');
          }
        }
      }
    }

    const shieldsBefore = npc.shields;
    const _npcMarkMult = (npc._marked && npc._markedTimer > 0) ? 1.5 : 1.0;
    this._applyHit(npc, proj.damage * _npcMarkMult, proj.type, proj.x, proj.y);
    if(particles) {
      const _nPan = G.clamp((npc.x-(G.game?.player?.x||0))/900,-1,1);
      if(shieldsBefore>0) {
        G.recordShieldHit(npc, proj.x, proj.y);
        G.sound?.shieldHit(_nPan);
        if(npc.shields <= 0) G.sound?.shieldsLost(_nPan);
      } else {
        particles.burst({x:proj.x,y:proj.y,minSpd:20,maxSpd:80,life:0.15,r:2,color:proj.color},4);
        G.sound?.weaponHit(proj.type, _nPan);
      }
    }
    if(npc.disabled && !npc._disabledSoundPlayed) {
      npc._disabledSoundPlayed = true;
      const dist = G.game?.player ? Math.hypot(npc.x-G.game.player.x, npc.y-G.game.player.y) : 0;
      G.sound?.shipDisabled(dist, G.clamp((npc.x-(G.game?.player?.x||0))/900,-1,1));
      G.game?.addCombatLog((npc.name||npc.faction.toUpperCase()+' SHIP')+' DISABLED BY YOU', '#ff8844');
    }
  }

  _onHitEnemy(enemy, proj, particles) {
    const sb = enemy.shields;
    const wasDisabled = enemy.disabled;
    const wasDead = enemy.dead;
    const _markMult = (enemy._marked && enemy._markedTimer > 0) ? 1.5 : 1.0;
    this._applyHit(enemy, proj.damage * _markMult, proj.type, proj.x, proj.y);
    enemy._lastAttackerId = proj.sourceId;
    if(sb>0&&enemy.shields<sb) G.recordShieldHit(enemy, proj.x, proj.y);
    if(particles) {
      if(sb>0&&enemy.shields<sb) {/* shield hex flash handled by recordShieldHit */}
      else if(proj.type==='emp') particles.emp_hit(proj.x,proj.y);
      else particles.burst({x:proj.x,y:proj.y,minSpd:20,maxSpd:80,life:0.15,r:2,color:proj.color},4);
    }
    if(proj.sourceId==='player' || proj.sourceId==='turret') {
      const _ePan = G.clamp((enemy.x-(G.game?.player?.x||0))/900,-1,1);
      if(sb>0&&enemy.shields<sb) {
        G.sound?.shieldHit(_ePan);
        if(enemy.shields <= 0) G.sound?.shieldsLost(_ePan);
      } else {
        G.sound?.weaponHit(proj.type, _ePan);
      }
    }
    if(!wasDisabled && enemy.disabled) {
      const dist = G.game?.player ? Math.hypot(enemy.x-G.game.player.x, enemy.y-G.game.player.y) : 0;
      G.sound?.shipDisabled(dist, G.clamp((enemy.x-(G.game?.player?.x||0))/900,-1,1));
      if(!enemy._disabledSoundPlayed) enemy._disabledSoundPlayed = true;
      const attacker = proj.sourceId === 'player' ? 'YOU' : (proj.sourceId||'').toUpperCase();
      G.game?.addCombatLog((enemy.faction||'ENEMY').toUpperCase()+' SHIP DISABLED BY '+attacker, '#ff8844');
    }
    if(!wasDead && enemy.dead) {
      const attacker = proj.sourceId === 'player' ? 'YOU' : (proj.sourceId||'').toUpperCase();
      G.game?.addCombatLog((enemy.faction||'ENEMY').toUpperCase()+' SHIP DESTROYED BY '+attacker, '#ff6644');
    }
  }

  _onHitPlayer(player, proj, particles) {
    const shieldsBefore = player.shields;
    const res=this._applyHit(player, proj.damage, proj.type, proj.x, proj.y, 0.3);
    // Cancel jump charge if player takes hull damage while charging
    if(res.hullDmg > 0 && G.game?._jumpChargeT > 0) {
      G.game._jumpChargeT = 0;
      G.ui?.addMsg('Jump cancelled — hull hit!','#ff4444');
    }
    if(res.shieldDmg>0) G.recordShieldHit(player, proj.x, proj.y);
    if(particles) {
      if(res.shieldDmg>0) {
        G.sound?.shieldHit();
        if(shieldsBefore > 0 && player.shields <= 0) G.sound?.shieldsLost();
      } else if(proj.type==='emp') {
        particles.emp_hit(player.x,player.y);
        G.sound?.weaponHit('emp');
      } else {
        particles.burst({x:proj.x,y:proj.y,minSpd:30,maxSpd:100,life:0.2,r:2,color:'#ff8844'},6);
        G.sound?.weaponHit(proj.type);
      }
    }
    if(player.disabled && !player._disabledSoundPlayed) {
      player._disabledSoundPlayed = true;
      G.sound?.shipDisabled();
      const attacker = [...this.enemies, ...this.npcs].find(s=>s.id===proj.sourceId);
      const atkName = attacker ? (attacker.name || (attacker.faction||'').toUpperCase()+' SHIP') : 'UNKNOWN';
      G.game?.addCombatLog('YOUR SHIP DISABLED BY '+atkName.toUpperCase(), '#ff8844');
    }

    // Allied defense: NPCs from allied factions (rep >= 50) engage the attacker
    if(G.game) {
      const attacker=[...this.npcs,...this.enemies].find(s=>s.id===proj.sourceId&&!s.dead);
      if(attacker) {
        const defenders=[];
        for(const npc of this.npcs) {
          if(npc.dead||npc.hostile||npc===attacker) continue;
          if(G.game.getRel(npc.faction)>=50 && Math.hypot(npc.x-player.x,npc.y-player.y)<2500) {
            npc.hostile=true; npc.combatTarget=attacker;
            defenders.push(npc);
          }
        }
        if(defenders.length>0) {
          const first=defenders[0];
          const facCol=G.FACTIONS[first.faction]?.color||'#88ccee';
          G.ui?.addMsg('['+first.name+']: "All units, defend allied vessel!"',facCol);
        }
      }
    }
  }

  _splashDamage(proj, targets, particles) {
    let hit=false;
    for(const t of targets) {
      if(!t||t.dead||t.boarded) continue;
      const d=G.v2.dist({x:proj.x,y:proj.y},{x:t.x,y:t.y});
      if(d<proj.splash) {
        const f=1-d/proj.splash;
        this._applyHit(t, proj.damage*f*0.5, proj.type, proj.x, proj.y, 0.3);
        const knock = 600 * f;
        const ang = Math.atan2(t.y-proj.y, t.x-proj.x);
        t.vx += Math.cos(ang) * knock * 0.016;
        t.vy += Math.sin(ang) * knock * 0.016;
        hit=true;
      }
    }
    if(hit&&particles) particles.explosion(proj.x,proj.y,0,0,0.5);
  }

  _missileExplosion(proj, particles) {
    if(particles) particles.explosion(proj.x, proj.y, 0, 0, 1.2);
    const pl = G.game?.player;
    const dist = pl ? Math.hypot(proj.x - pl.x, proj.y - pl.y) : 9999;
    G.sound?.explosion(dist, pl ? G.clamp((proj.x - pl.x)/900,-1,1) : 0);
  }

  // ── Ship / asteroid collision resolution ─────────────────
  _resolveShipCollisions(player, dt, particles) {
    if(!G.game?.collisionsEnabled) return;
    const ships = [player, ...this.enemies, ...this.npcs];

    // Ship vs ship
    for(let i = 0; i < ships.length; i++) {
      const a = ships[i];
      if(a.dead || a._deathDone || a.boarded || (a.arriving||0) > 0) continue;
      for(let j = i+1; j < ships.length; j++) {
        const b = ships[j];
        if(b.dead || b._deathDone || b.boarded || (b.arriving||0) > 0) continue;

        const rA = G.shipCollisionRadius(a);
        const rB = G.shipCollisionRadius(b);
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        const minD = rA + rB;
        if(d >= minD || d < 0.1) continue;

        const nx = dx/d, ny = dy/d;
        // Separate
        const push = (minD - d) * 0.5;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;

        const avx = (a.vx||0), avy = (a.vy||0);
        const bvx = (b.vx||0), bvy = (b.vy||0);
        const relV = (bvx - avx)*nx + (bvy - avy)*ny;
        if(relV >= 0) continue; // already separating

        const impactSpeed = -relV;
        const restitution = 0.3;
        const impulse = (1 + restitution) * relV * 0.5;
        a.vx = avx + impulse * nx; a.vy = avy + impulse * ny;
        b.vx = bvx - impulse * nx; b.vy = bvy - impulse * ny;

        const THRESHOLD = 35;
        if(impactSpeed < THRESHOLD) continue;

        const dmg = (impactSpeed - THRESHOLD) * 0.10;
        const ix = a.x + nx * rA, iy = a.y + ny * rA;

        this._applyHit(a, dmg, 'projectile', ix, iy, 0.5);
        this._applyHit(b, dmg, 'projectile', ix, iy, 0.5);

        if(particles) particles.burst({x:ix,y:iy,minSpd:40,maxSpd:130,life:0.25,r:2.5,color:'#ff9955'},8);
        const _colDist = Math.hypot(ix-(player.x||0), iy-(player.y||0));
        G.sound?.weaponHit?.('projectile', G.clamp((ix-player.x)/900,-1,1));
      }
    }

    // Ship vs asteroid (knockback + damage, no planet/body collision)
    for(const ship of ships) {
      if(ship.dead || ship._deathDone || ship.boarded || (ship.arriving||0) > 0) continue;
      const sr = G.shipCollisionRadius(ship);

      for(let ai = this.asteroids.length-1; ai >= 0; ai--) {
        const cl = this.asteroids[ai];
        // Broad phase against cluster bounding circle
        if((ship.x-cl.x)**2 + (ship.y-cl.y)**2 > (sr+cl.r)**2) continue;
        // Narrow phase: nearest exposed tile
        let t=null, td=Infinity, tw=null;
        for(const tt of cl.tiles.values()){
          if(!tt.exposed) continue;
          const w = G.astTileWorld(cl, tt);
          const dd = (ship.x-w.x)**2 + (ship.y-w.y)**2;
          if(dd<td){ td=dd; t=tt; tw=w; }
        }
        if(!t) continue;

        const TR = G.ASTEROID_TILE_R;
        const dx = ship.x - tw.x, dy = ship.y - tw.y;
        const minD = sr + TR;
        const d = Math.sqrt(dx*dx + dy*dy);
        if(d >= minD || d < 0.1) continue;

        const nx = dx/d, ny = dy/d;
        // Separate ship from tile (cluster is heavy — only ship moves)
        const overlap = minD - d;
        ship.x += nx * overlap; ship.y += ny * overlap;

        const relV = (ship.vx||0)*nx + (ship.vy||0)*ny;
        if(relV >= 0) continue;

        const impactSpeed = -relV;
        const restitution = 0.4;
        ship.vx += nx * impactSpeed * (1 + restitution);
        ship.vy += ny * impactSpeed * (1 + restitution);

        const THRESHOLD = 25;
        if(impactSpeed > THRESHOLD) {
          const dmg = (impactSpeed - THRESHOLD) * 0.12;
          this._applyHit(ship, dmg, 'projectile', tw.x + nx*TR, tw.y + ny*TR, 0.5);
          if(particles) particles.burst({x:tw.x,y:tw.y,minSpd:30,maxSpd:100,life:0.2,r:2,color:'#cc8844'},5);
          if(ship === player) G.sound?.weaponHit?.('projectile', G.clamp((cl.x-player.x)/900,-1,1));
          // Tile takes scratch damage from hard collisions
          this._mineTile(cl, ai, t, dmg * 0.15, particles, { qty:1, msg:false });
        }
      }
    }
  }

  // Damage one exposed tile of cluster `cl`; drop its material on destroy,
  // remove the cluster when its last tile is gone.
  _mineTile(cl, idx, t, dmg, particles, opts) {
    opts = opts || {};
    const wt = G.astTileWorld(cl, t);
    t.hp -= dmg;
    cl._dirty = true;   // hp changed → re-bake sprite (damage tint)
    if(particles) particles.mine_spark(wt.x, wt.y);
    if(t.hp > 0) return false;
    const mat = G.ASTEROID_MAT[t.mat] || G.ASTEROID_MAT.rock;
    const dropId = mat.drop;
    const qty = opts.qty || G.randInt(1,2);
    this.floatingLoot.push({
      x:wt.x, y:wt.y, vx:(Math.random()-0.5)*80, vy:(Math.random()-0.5)*80,
      type:'item', itemId:dropId, qty, rarity:G.ITEMS[dropId]?.rarity||'c',
      ttl:60, color:G.rarityColor(G.ITEMS[dropId]?.rarity||'c'),
    });
    G.astRemoveTile(cl, t);
    if(particles) particles.explosion(wt.x, wt.y, 0, 0, 0.4);
    G.game?._addXP?.(2);
    if(cl.tileCount <= 0) {
      this.asteroids.splice(idx, 1);
      if(opts.msg !== false) G.ui?.addMsg('Asteroid depleted!','#ffcc44');
    }
    return true;
  }

  _dropLoot(ship) {
    const sys=G.SYSTEMS.find(s=>s.id===this.sysId);
    const danger=sys?.danger||1;
    if((ship.credits||0)>0) {
      this.floatingLoot.push({x:ship.x+(Math.random()-0.5)*40,y:ship.y+(Math.random()-0.5)*40,
        vx:(Math.random()-0.5)*60,vy:(Math.random()-0.5)*60,
        type:'credits',amount:ship.credits,ttl:30,color:'#ffcc00'});
    }
    const drops=G.genLoot(danger,ship.credits||0);
    for(const d of drops) {
      this.floatingLoot.push({x:ship.x+(Math.random()-0.5)*60,y:ship.y+(Math.random()-0.5)*60,
        vx:(Math.random()-0.5)*40,vy:(Math.random()-0.5)*40,
        type:'item',itemId:d.id,qty:d.qty,rarity:d.rarity,ttl:45,
        color:G.rarityColor(d.rarity)});
    }
    // Occasional module drop
    if(Math.random() < 0.08 + danger*0.015) {
      const modKeys = Object.keys(G.MODULES);
      const modId   = G.randEl(modKeys);
      const mod     = G.MODULES[modId];
      // Only drop lower-rarity modules at low danger
      if(mod && (danger >= 6 || (mod.rarity==='c'||mod.rarity==='u'))) {
        this.floatingLoot.push({
          x:ship.x+(Math.random()-0.5)*50, y:ship.y+(Math.random()-0.5)*50,
          vx:(Math.random()-0.5)*30, vy:(Math.random()-0.5)*30,
          type:'module', moduleId:modId, rarity:mod.rarity||'u', ttl:60,
          color:G.rarityColor(mod.rarity||'u'),
        });
      }
    }
    // Ammo drops: based on weapons equipped (finite chance per ammo type used)
    const ammoTypesToDrop = new Set();
    if(ship.weapons && ship.weapons.length > 0) {
      for(const wpn of ship.weapons) {
        const def = G.WEAPONS[wpn.weaponId];
        if(def?.ammo) ammoTypesToDrop.add(def.ammo);
      }
    } else {
      // Fallback for ships without weapons array
      if(Math.random() < 0.45) ammoTypesToDrop.add('kinetic_rounds');
    }
    for(const ammoId of ammoTypesToDrop) {
      if(Math.random() < 0.40 && G.ITEMS[ammoId]) {
        const item = G.ITEMS[ammoId];
        this.floatingLoot.push({ x:ship.x+(Math.random()-0.5)*50, y:ship.y+(Math.random()-0.5)*50,
          vx:(Math.random()-0.5)*30, vy:(Math.random()-0.5)*30,
          type:'item', itemId:ammoId, qty:item.ammoRounds || 1,
          rarity:item.rarity||'c', ttl:45, color:'#ffcc44' });
      }
    }

    // NPC cargo drops
    if(ship.cargo) {
      for(const[id,qty] of Object.entries(ship.cargo)) {
        this.floatingLoot.push({x:ship.x+(Math.random()-0.5)*50,y:ship.y+(Math.random()-0.5)*50,
          vx:(Math.random()-0.5)*30,vy:(Math.random()-0.5)*30,
          type:'item',itemId:id,qty,rarity:G.ITEMS[id]?.rarity||'c',ttl:50,
          color:G.rarityColor(G.ITEMS[id]?.rarity||'c')});
      }
    }
  }

  _updateDying(ship, dt, particles, isEnemy) { try {
    if(ship.jumpingOut) { ship._deathDone = true; return; }
    if(!ship._dyingInitialized) {
      ship._dyingInitialized = true;
      const sz = ship.size || 1;
      ship._dyingInitialTimer = ship._dyingTimer = 2 + Math.random() * 2 * Math.min(sz, 2.5);
      ship._dyingNextBang = 0.2;
      this._dropLoot(ship);
      // Log destruction with attacker info
      if(!isEnemy) {
        const typeName = ship.name || (ship.faction||'').toUpperCase()+' SHIP';
        const atkId = ship._lastAttackerId;
        let atkName = 'UNKNOWN';
        if(atkId === 'player') atkName = 'YOU';
        else if(atkId === 'turret') atkName = 'TURRET';
        else if(atkId) {
          const enemy = this.enemies.find(e => e.id === atkId);
          const npc = this.npcs.find(n => n.id === atkId);
          const fleetShip = this.fleetShips.find(f => f.id === atkId);
          if(enemy) atkName = enemy.name || (enemy.faction||'ENEMY').toUpperCase()+' SHIP';
          else if(npc) atkName = npc.name || (npc.faction||'NPC').toUpperCase()+' SHIP';
          else if(fleetShip) atkName = fleetShip.name || 'ESCORT SHIP';
        }
        G.game?.addCombatLog(typeName.toUpperCase()+' DESTROYED BY '+atkName, '#ff4444');
      }
      if(!isEnemy && ship.faction !== 'independent' && !ship.jumpingOut) {
        G.game.setRel(ship.faction, G.game.getRel(ship.faction)-10, ship.name+' destroyed');
        for(const [fac,hostile] of Object.entries(G.HOSTILE)) {
          if(hostile[ship.faction]) G.game.setRel(fac, Math.min(100, G.game.getRel(fac)+3), (G.FACTIONS[ship.faction]?.name||ship.faction)+' enemy eliminated');
        }
      }
      // Launch escape pods from their module positions
      if((ship.escapePods || 0) > 0) {
        const podMods = Object.values(ship.modules || {}).filter(m => m.moduleId === 'escape_pod' && !m.broken);
        const count = Math.min(ship.escapePods, podMods.length || 1);
        for(let _pi = 0; _pi < count; _pi++) {
          const inst = podMods[_pi];
          let px = ship.x, py = ship.y;
          if(inst?.q != null) {
            const hp = G.hexToPixel(inst.q, inst.r, G.HEX_R);
            const ca = Math.cos(ship.angle), sa = Math.sin(ship.angle);
            px = ship.x + hp.x * ca - hp.y * sa;
            py = ship.y + hp.x * sa + hp.y * ca;
          }
          const ejectAngle = Math.atan2(py - ship.y, px - ship.x) + (Math.random()-0.5)*1.2;
          const speed = 180 + Math.random() * 120;
          this.escapePodEntities.push({
            x: px, y: py,
            vx: ship.vx + Math.cos(ejectAngle) * speed,
            vy: ship.vy + Math.sin(ejectAngle) * speed,
            angle: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random()-0.5) * 3,
            timer: 10 + Math.random() * 5,
          });
        }
      }
    }
    // Drift and decelerate
    ship.x += ship.vx * dt; ship.y += ship.vy * dt;
    ship.vx *= 0.98; ship.vy *= 0.98;
    ship._dyingTimer -= dt;
    ship._dyingNextBang -= dt;
    if(ship._dyingNextBang <= 0) {
      const sz = ship.size || 1;
      const ox = (Math.random()-0.5)*sz*35, oy = (Math.random()-0.5)*sz*35;
      if(particles) particles.explosion(ship.x+ox, ship.y+oy, 0, 0, 0.2+sz*0.15);
      const pl2 = G.game?.player;
      const d2 = pl2 ? Math.hypot(ship.x-pl2.x, ship.y-pl2.y) : 0;
      G.sound?.explosion(d2, pl2 ? G.clamp((ship.x-pl2.x)/900,-1,1) : 0);
      const progress = 1 - Math.max(0, ship._dyingTimer) / ship._dyingInitialTimer;
      ship._dyingNextBang = Math.max(0.08, 0.45 - progress * 0.37);
    }
    if(ship._dyingTimer <= 0) {
      const sz = ship.size || 1;
      if(particles) particles.explosion(ship.x, ship.y, 0, 0, sz * 2.2);
      const plFin = G.game?.player;
      const dFin = plFin ? Math.hypot(ship.x-plFin.x, ship.y-plFin.y) : 0;
      G.sound?.explosion(dFin, plFin ? G.clamp((ship.x-plFin.x)/900,-1,1) : 0);
      // Shockwave: damage nearby ships
      const shockR = 140 + sz * 120;
      const shockDmg = 800 + sz * 1600;
      for(const other of [...this.npcs, ...this.enemies, ...(this.fleetShips||[])]) {
        if(other===ship||other.dead||other.boarded) continue;
        const d = Math.hypot(other.x-ship.x, other.y-ship.y);
        if(d < shockR) {
          const dmg = shockDmg*(1-d/shockR);
          // Hit a random spot on the victim (not dead-centre) so the blast
          // chews modules without always one-shotting the core.
          const r = G.shipCollisionRadius?.(other) || 20;
          this._applyHit(other, dmg, 'projectile', other.x+(Math.random()-0.5)*r, other.y+(Math.random()-0.5)*r, 0.5);
          const knock = 8000 * (1-d/shockR);
          const ang = Math.atan2(other.y-ship.y, other.x-ship.x);
          other.vx += Math.cos(ang) * knock * 0.016;
          other.vy += Math.sin(ang) * knock * 0.016;
        }
      }
      const pl = G.game?.player;
      if(pl) {
        const dp = Math.hypot(pl.x-ship.x, pl.y-ship.y);
        if(dp < shockR) {
          const dmg = shockDmg*0.35*(1-dp/shockR);
          const pr = G.shipCollisionRadius?.(pl) || 20;
          this._applyHit(pl, dmg, 'projectile', pl.x+(Math.random()-0.5)*pr, pl.y+(Math.random()-0.5)*pr, 0.5);
          const knock = 6000 * (1-dp/shockR);
          const ang = Math.atan2(pl.y-ship.y, pl.x-ship.x);
          pl.vx += Math.cos(ang) * knock * 0.016;
          pl.vy += Math.sin(ang) * knock * 0.016;
        }
      }
      ship._deathDone = true;
    }
  } catch(err) { console.error('_updateDying error:', err); ship._deathDone = true; } }

  _collectLoot(loot, player) {
    if(loot.type==='credits') {
      G.game.credits+=loot.amount;
      G.ui.addMsg('Collected '+G.fmtCredits(loot.amount),'#ffcc00');
      G.sound?.lootPickup();
      return true;
    } else if(loot.type==='item') {
      const item=G.ITEMS[loot.itemId];
      // Ammo items go to player.ammo, not cargo
      if(item?.cat==='ammo') {
        const rounds=(item.ammoRounds||1)*loot.qty;
        player.ammo[loot.itemId]=(player.ammo[loot.itemId]||0)+rounds;
        G.ui.addMsg('Picked up '+rounds+' '+item.name,G.rarityColor(loot.rarity));
        G.ui.showLootNotif(item.name, rounds, loot.rarity);
        G.sound?.lootPickup();
        return true;
      }
      if(item&&G.game.fleetCargoFreeSpace()>=(item.mass||1)*loot.qty) {
        player.addCargo(loot.itemId,loot.qty);
        G.ui.addMsg('Picked up '+loot.qty+'x '+item.name,G.rarityColor(loot.rarity));
        G.ui.showLootNotif(item.name,loot.qty,loot.rarity);
        G.sound?.lootPickup();
        return true;
      } else {
        if(this._cargoFullTimer <= 0) {
          G.ui.addMsg('Cargo full — jettison cargo to pick up','#ff8844');
          G.sound?.cargoFull();
          this._cargoFullTimer = 6;
        }
        return false;
      }
    } else if(loot.type==='module') {
      const mod=G.MODULES[loot.moduleId]||G.WEAPONS[loot.moduleId];
      if(mod && player.slots.includes(null)) {
        player.installModule(loot.moduleId);
        G.ui.addMsg('Module recovered: '+mod.name+' ['+mod.slot+']', G.rarityColor(loot.rarity));
        G.ui.showLootNotif(mod.name, 1, loot.rarity);
        G.sound?.lootPickup();
        return true;
      } else if(mod) {
        player.moduleInventory.push(loot.moduleId);
        G.ui.addMsg('Module stored in inventory: '+mod.name+' (no free slot)', G.rarityColor(loot.rarity));
        G.ui.showLootNotif(mod.name, 1, loot.rarity);
        G.sound?.lootPickup();
        return true;
      }
      return true;
    }
    return true;
  }

  // ── Public helpers ───────────────────────────────────────

  scuttleEnemy(enemy) {
    if(!enemy.disabled) return;
    this._dropLoot(enemy);
    if(G.game?.particles) G.game.particles.explosion(enemy.x, enemy.y, 0, 0, (enemy.size||1)*1.8);
    G.sound?.explosion(G.game?.player ? Math.hypot(enemy.x-G.game.player.x,enemy.y-G.game.player.y) : 0);
    enemy._deathDone = true;
    enemy.boarded = true;
  }

  boardEnemy(enemy, player) {
    if(enemy.disabled||enemy.boarded) return null;
    enemy.boarded=true;
    const sys=G.SYSTEMS.find(s=>s.id===this.sysId);
    const drops=G.genLoot(sys?.danger||1,enemy.credits);
    const collected=[];
    for(const d of drops) {
      const item=G.ITEMS[d.id];
      if(item&&G.game.fleetCargoFreeSpace()>=(item.mass||1)*d.qty) {
        player.addCargo(d.id,d.qty); collected.push(d);
      }
    }
    G.game.credits+=enemy.credits; enemy.credits=0;
    G.game.setRel(enemy.faction,G.game.getRel(enemy.faction)-10,'boarded enemy ship');
    return {credits:enemy.credits||0,items:collected};
  }

  lootDerelict(derelict, player) {
    if(derelict.looted) return null;
    derelict.looted = true;
    derelict.dead   = true; // triggers target-clear in main loop
    const sys=G.SYSTEMS.find(s=>s.id===this.sysId);
    const drops=G.genLoot((sys?.danger||1)+2,200);
    const collected=[];
    for(const d of drops) {
      const item=G.ITEMS[d.id];
      if(item&&G.game.fleetCargoFreeSpace()>=(item.mass||1)*d.qty) {
        player.addCargo(d.id,d.qty); collected.push(d);
      }
    }
    return collected;
  }

  scuttleDerelict(derelict) {
    derelict.looted = true;
    derelict.dead   = true;
    if(G.game?.particles) G.game.particles.explosion(derelict.x, derelict.y, 0, 0, 1.2);
    G.sound?.explosion(G.game?.player ? Math.hypot(derelict.x-G.game.player.x, derelict.y-G.game.player.y) : 0);
    const sys  = G.SYSTEMS.find(s=>s.id===this.sysId);
    const drops = G.genLoot((sys?.danger||1)+1, 100);
    for(const d of drops) {
      const item = G.ITEMS[d.id];
      if(item && G.game.fleetCargoFreeSpace() >= (item.mass||1)*d.qty) {
        G.game.player.addCargo(d.id, d.qty);
      }
    }
  }

  nearestSpaceport(x,y,dockPad) {
    let nearest=null, nearestD=Infinity;
    for(const b of this.bodies) {
      if(!b.hasSpaceport) continue;
      const d=G.v2.dist({x,y},{x:b.x,y:b.y});
      if(d < b.r + dockPad && d < nearestD){nearestD=d;nearest=b;}
    }
    return nearest;
  }

  // All targetable ships/objects (enemies, NPCs, derelicts, turrets)
  allTargets() {
    const out = [];
    for(const e of this.enemies)    if(!e.dead&&!e._deathDone&&!e.boarded) out.push(e);
    for(const n of this.npcs)        if(!n.dead&&!n._deathDone&&!n.boarded) out.push(n);
    for(const f of this.fleetShips)  if(!f.dead&&!f._deathDone) out.push(f);
    for(const d of this.derelicts)   if(!d.looted) out.push(d);
    for(const t of this.turrets)     if(!t._dead) out.push(t);
    return out;
  }

  nearestTarget(x, y) {
    const all = this.allTargets();
    let nearest=null, nearestD=Infinity;
    for(const s of all) {
      const d=Math.hypot(s.x-x,s.y-y);
      if(d<nearestD){nearestD=d;nearest=s;}
    }
    return nearest;
  }

  nearestFriendlyNPC(x, y, radius) {
    let nearest=null, nearestD=radius;
    for(const n of this.npcs) {
      if(n.dead||n.hostile) continue;
      const playerRel = G.game?.getRel(n.faction)||0;
      if(playerRel < -30) continue; // hostile faction
      const d=Math.hypot(n.x-x, n.y-y);
      if(d<nearestD){nearestD=d;nearest=n;}
    }
    return nearest;
  }
};
