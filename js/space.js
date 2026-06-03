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
    this.time       = 0;
    this._npcSpawnTimer = 0;
    this._genBgStars();
  }

  _genBgStars() {
    this.bgStars = [];
    for(let i=0;i<300;i++) {
      this.bgStars.push({
        x:Math.random()*5000-2500, y:Math.random()*5000-2500,
        r:Math.random()<0.05?2:1,
        brightness:0.2+Math.random()*0.8,
        layer:Math.floor(Math.random()*3),
      });
    }
  }

  loadSystem(sysId) {
    this.sysId = sysId;
    const sys  = G.SYSTEMS.find(s=>s.id===sysId);
    if(!sys) return;

    const local = G.generateLocalSystem(sys);
    this.bodies     = local.bodies;
    this.asteroids  = local.asteroids;
    this.derelicts  = local.derelicts;
    this.turrets    = local.turrets || [];
    this.enemies    = [];
    this.npcs       = [];
    this.projectiles= [];
    this.floatingLoot=[];
    this._npcSpawnTimer = 5;

    // Hostile enemy ships
    const nE = Math.floor(sys.danger * 1.3) + G.randInt(0, Math.max(0, sys.danger-2));
    const ed  = G.genEnemyShips(sys, Math.min(nE, 10));
    this.enemies = ed.map(d=>new G.EnemyAI(d));

    // Initial NPC ships (1–3)
    const npcCount = 1 + Math.floor(Math.random()*3);
    for(let i=0;i<npcCount;i++) this._spawnNPC(sys);
  }

  _spawnNPC(sysArg) {
    const sys  = sysArg || G.SYSTEMS.find(s=>s.id===this.sysId);
    if(!sys) return;

    // Pick faction: system faction + independents + sometimes rival factions
    const factionPool = [sys.faction, sys.faction, 'independent'];
    if(sys.faction==='earth' && Math.random()<0.3)      factionPool.push('rebellion');
    if(sys.faction==='rebellion' && Math.random()<0.3)  factionPool.push('earth');
    if(sys.danger>=4 && Math.random()<0.4)              factionPool.push('pirate');

    const faction = G.randEl(factionPool);
    const npc = new G.NPCShip(faction, this.bodies, this.sysId);
    this.npcs.push(npc);
  }

  update(dt, player, input, particles, now) {
    this.time += dt;

    // Orbit bodies
    for(const b of this.bodies) {
      if(b.orbitR) { b.orbitAngle+=(b.orbitSpeed||0); b.x=Math.cos(b.orbitAngle)*b.orbitR; b.y=Math.sin(b.orbitAngle)*b.orbitR; }
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
          this.projectiles.push({
            x:t.x, y:t.y,
            vx:Math.sin(ang)*680, vy:-Math.cos(ang)*680,
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
      if(e.dead){this.enemies.splice(i,1);continue;}
      e.update(dt,player,this.projectiles,particles,now);
      if(!e.disabled&&Math.random()<0.3&&particles)
        particles.engine_trail(e.x,e.y,e.angle,e.vx,e.vy,e.size||1);
    }

    // NPC ships
    for(let i=this.npcs.length-1;i>=0;i--) {
      const n=this.npcs[i];
      if(n.dead){this.npcs.splice(i,1);continue;}
      n.update(dt, this.bodies, this.npcs, this.enemies, this.projectiles, particles, now);
      if(n.aiState!=='docked'&&Math.random()<0.2&&particles)
        particles.engine_trail(n.x,n.y,n.angle,n.vx,n.vy,n.size||1);
    }

    // NPC respawn timer
    this._npcSpawnTimer -= dt;
    if(this._npcSpawnTimer <= 0 && this.npcs.length < 6) {
      this._npcSpawnTimer = 15 + Math.random()*20;
      this._spawnNPC();
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

    // Projectiles
    for(let i=this.projectiles.length-1;i>=0;i--) {
      const p=this.projectiles[i];
      p.ttl-=dt;
      if(p.ttl<=0){this.projectiles.splice(i,1);continue;}

      // Missile tracking
      if(p.tracking && p.sourceId==='player') {
        const tgt = G.game?.target;
        if(tgt && !tgt.dead) {
          const ta=Math.atan2(tgt.x-p.x,-(tgt.y-p.y));
          const da=G.wrapAngle(ta-Math.atan2(p.vx,-p.vy));
          const spd=Math.sqrt(p.vx*p.vx+p.vy*p.vy);
          const na=Math.atan2(p.vx,-p.vy)+G.clamp(da,-2*dt,2*dt);
          p.vx=Math.sin(na)*spd; p.vy=-Math.cos(na)*spd;
        }
      }

      p.x+=p.vx*dt; p.y+=p.vy*dt;

      if(p.type==='laser'&&particles&&Math.random()<0.3)
        particles.emit({x:p.x,y:p.y,minSpd:5,maxSpd:20,life:0.06,r:1.5,color:p.color});

      // Hit detection
      if(p.sourceId==='player') {
        // Mining laser vs asteroids
        if(p.type === 'mining') {
          let mined = false;
          for(let j=this.asteroids.length-1;j>=0;j--){
            const a=this.asteroids[j];
            if(G.circleHit(p.x,p.y,6,a.x,a.y,a.r)){
              // Directly mine with weapon's mineRate (bypasses canMine check)
              const wpnDef = G.WEAPONS[p.weaponId];
              const mineRate = wpnDef?.mineRate || 12;
              a.hp -= mineRate;
              if(particles) particles.mine_spark(a.x, a.y);
              if(a.hp <= 0) {
                const dropId = G.randEl(a.drops);
                const qty = G.randInt(1,3);
                this.floatingLoot.push({
                  x:a.x, y:a.y, vx:(Math.random()-0.5)*80, vy:(Math.random()-0.5)*80,
                  type:'item', itemId:dropId, qty, rarity:G.ITEMS[dropId]?.rarity||'c',
                  ttl:60, color:G.rarityColor(G.ITEMS[dropId]?.rarity||'c'),
                });
                this.asteroids.splice(j,1);
                if(particles) particles.explosion(a.x,a.y,0,0,0.6);
                G.ui?.addMsg('Asteroid mined!','#ffcc44');
              }
              this.projectiles.splice(i,1);
              mined=true; break;
            }
          }
          if(mined) continue;
        }

        // vs enemies
        for(let j=this.enemies.length-1;j>=0;j--) {
          const e=this.enemies[j];
          if(e.dead||e.boarded) continue;
          if(G.circleHit(p.x,p.y,4,e.x,e.y,(e.size||1)*16+4)) {
            this._onHitEnemy(e,p,particles); if(!p.pierce){this.projectiles.splice(i,1);break;}
          }
        }
        // vs NPCs
        if(this.projectiles[i]===p) {
          for(let j=this.npcs.length-1;j>=0;j--) {
            const n=this.npcs[j];
            if(n.dead||n.boarded) continue;
            if(G.circleHit(p.x,p.y,4,n.x,n.y,(n.size||1)*16+4)) {
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
                if(t.faction!=='independent') G.game.setRel(t.faction, G.game.getRel(t.faction)-8);
              }
              t.hp -= p.damage;
              if(particles) particles.burst({x:p.x,y:p.y,minSpd:20,maxSpd:80,life:0.15,r:2,color:'#ffaa00'},4);
              if(t.hp<=0){t._dead=true; if(particles) particles.explosion(t.x,t.y,0,0,0.4);}
              if(!p.pierce){this.projectiles.splice(i,1);break;}
            }
          }
        }
        // Splash damage
        if(this.projectiles[i]===p && p.splash>0) {
          this._splashDamage(p,[...this.enemies,...this.npcs],particles);
        }
      } else {
        // Enemy/NPC projectile hits player
        if(G.circleHit(p.x,p.y,4,player.x,player.y,18)) {
          this._onHitPlayer(player,p,particles);
          this.projectiles.splice(i,1);
        }
      }
    }

    // Floating loot pickup
    for(let i=this.floatingLoot.length-1;i>=0;i--) {
      const l=this.floatingLoot[i];
      l.ttl-=dt; if(l.ttl<=0){this.floatingLoot.splice(i,1);continue;}
      l.x+=l.vx*dt; l.y+=l.vy*dt; l.vx*=0.97; l.vy*=0.97;
      const d=G.v2.dist({x:l.x,y:l.y},{x:player.x,y:player.y});
      const cr=player.tractorRange>0?player.tractorRange+40:50;
      if(d<cr){this._collectLoot(l,player);this.floatingLoot.splice(i,1);}
    }
  }

  // ── Damage handlers ─────────────────────────────────────

  _playerHitsNPC(npc, proj, player, particles) {
    const wasHostile = npc.hostile;

    // Make NPC hostile and point it at the player
    if(!npc.hostile) {
      npc.hostile = true;
      npc.combatTarget = player;
      npc.dockTimer = 0; // break out of docked state immediately
    }

    // Rep loss with their faction (not for independents)
    if(npc.faction !== 'independent') {
      G.game.setRel(npc.faction, G.game.getRel(npc.faction) - 6);
      // Witnesses of same faction within range go hostile
      const sensorR = player.sensorRange || 700;
      for(const other of this.npcs) {
        if(other===npc||other.dead) continue;
        if(other.faction===npc.faction) {
          if(Math.hypot(other.x-npc.x,other.y-npc.y) < sensorR) {
            other.hostile = true;
            other.combatTarget = player;
            other.dockTimer = 0;
          }
        }
      }
    } else {
      // Independent: faction witnesses in law enforcement systems create rep loss
      const sys = G.SYSTEMS.find(s=>s.id===this.sysId);
      if(sys?.faction==='earth') {
        for(const w of this.npcs) {
          if(w.faction==='earth'&&Math.hypot(w.x-npc.x,w.y-npc.y)<600) {
            w.hostile=true; w.combatTarget=player; w.dockTimer=0;
            G.game.setRel('earth',G.game.getRel('earth')-4);
          }
        }
      }
    }

    npc.takeDamage(proj.damage, proj.type);
    const shieldsBefore = npc.shields;
    if(particles) {
      if(shieldsBefore>0) particles.shield_hit(proj.x,proj.y,(npc.size||1)*16);
      else particles.burst({x:proj.x,y:proj.y,minSpd:20,maxSpd:80,life:0.15,r:2,color:proj.color},4);
    }
    if(npc.dead && particles) {
      particles.explosion(npc.x,npc.y,npc.vx,npc.vy,npc.size||1);
      // More rep loss on destroy
      if(npc.faction!=='independent') G.game.setRel(npc.faction,G.game.getRel(npc.faction)-10);
      this._dropLoot(npc);
      // Increase rep with faction's enemies
      for(const [fac,hostile] of Object.entries(G.HOSTILE)) {
        if(hostile[npc.faction]) G.game.setRel(fac, Math.min(100, G.game.getRel(fac)+3));
      }
    }
  }

  _onHitEnemy(enemy, proj, particles) {
    const sb = enemy.shields;
    enemy.takeDamage(proj.damage, proj.type);
    if(particles) {
      if(sb>0&&enemy.shields<sb) particles.shield_hit(proj.x,proj.y,(enemy.size||1)*16);
      else if(proj.type==='emp') particles.emp_hit(proj.x,proj.y);
      else particles.burst({x:proj.x,y:proj.y,minSpd:20,maxSpd:80,life:0.15,r:2,color:proj.color},4);
    }
    if(enemy.dead&&particles) {
      particles.explosion(enemy.x,enemy.y,enemy.vx,enemy.vy,enemy.size||1);
      this._dropLoot(enemy);
    }
  }

  _onHitPlayer(player, proj, particles) {
    const res=player.takeDamage(proj.damage, proj.type);
    // Cancel jump charge if player takes hull damage while charging
    if(res.hullDmg > 0 && G.game?._jumpChargeT > 0) {
      G.game._jumpChargeT = 0;
      G.ui?.addMsg('Jump cancelled — hull hit!','#ff4444');
    }
    if(particles) {
      if(res.shieldDmg>0) particles.shield_hit(proj.x,proj.y,22);
      else if(proj.type==='emp') particles.emp_hit(player.x,player.y);
      else particles.burst({x:proj.x,y:proj.y,minSpd:30,maxSpd:100,life:0.2,r:2,color:'#ff8844'},6);
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
      if(d<proj.splash) { const f=1-d/proj.splash; t.takeDamage(proj.damage*f*0.5,proj.type); hit=true; }
    }
    if(hit&&particles) particles.explosion(proj.x,proj.y,0,0,0.5);
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

  _collectLoot(loot, player) {
    if(loot.type==='credits') {
      G.game.credits+=loot.amount;
      G.ui.addMsg('Collected '+G.fmtCredits(loot.amount),'#ffcc00');
    } else if(loot.type==='item') {
      const item=G.ITEMS[loot.itemId];
      if(item&&player.cargoFreeSpace()>=(item.mass||1)*loot.qty) {
        player.addCargo(loot.itemId,loot.qty);
        G.ui.addMsg('Picked up '+loot.qty+'x '+item.name,G.rarityColor(loot.rarity));
        G.ui.showLootNotif(item.name,loot.qty,loot.rarity);
      } else {
        G.ui.addMsg('Cargo full — item lost!','#ff4444');
      }
    } else if(loot.type==='module') {
      const mod=G.MODULES[loot.moduleId]||G.WEAPONS[loot.moduleId];
      if(mod && player.slots[mod.slot] && player.slots[mod.slot].includes(null)) {
        player.installModule(loot.moduleId);
        G.ui.addMsg('Module recovered: '+mod.name+' ['+mod.slot+']', G.rarityColor(loot.rarity));
        G.ui.showLootNotif(mod.name, 1, loot.rarity);
      } else if(mod) {
        // No free slot — add to cargo as item equivalent if it's a cargo-safe item
        G.ui.addMsg('Module found ('+mod.name+') — no free slot!','#ff8844');
      }
    }
  }

  // ── Public helpers ───────────────────────────────────────

  mineAsteroid(asteroid, player, particles) {
    if(!player.canMine) return false;
    asteroid.hp-=player.mineRate;
    if(particles) particles.mine_spark(asteroid.x,asteroid.y);
    if(asteroid.hp<=0) {
      const dropId=G.randEl(asteroid.drops);
      const qty=G.randInt(1,3);
      this.floatingLoot.push({x:asteroid.x,y:asteroid.y,
        vx:(Math.random()-0.5)*80,vy:(Math.random()-0.5)*80,
        type:'item',itemId:dropId,qty,rarity:G.ITEMS[dropId]?.rarity||'c',ttl:60,
        color:G.rarityColor(G.ITEMS[dropId]?.rarity||'c')});
      const idx=this.asteroids.indexOf(asteroid);
      if(idx>=0) this.asteroids.splice(idx,1);
      if(particles) particles.explosion(asteroid.x,asteroid.y,0,0,0.6);
      return true;
    }
    return false;
  }

  boardEnemy(enemy, player) {
    if(!enemy.disabled||enemy.boarded) return null;
    enemy.boarded=true;
    const sys=G.SYSTEMS.find(s=>s.id===this.sysId);
    const drops=G.genLoot(sys?.danger||1,enemy.credits);
    const collected=[];
    for(const d of drops) {
      const item=G.ITEMS[d.id];
      if(item&&player.cargoFreeSpace()>=(item.mass||1)*d.qty) {
        player.addCargo(d.id,d.qty); collected.push(d);
      }
    }
    G.game.credits+=enemy.credits; enemy.credits=0;
    G.game.setRel(enemy.faction,G.game.getRel(enemy.faction)-10);
    return {credits:enemy.credits||0,items:collected};
  }

  lootDerelict(derelict, player) {
    if(derelict.looted) return null;
    derelict.looted=true;
    const sys=G.SYSTEMS.find(s=>s.id===this.sysId);
    const drops=G.genLoot((sys?.danger||1)+2,200);
    const collected=[];
    for(const d of drops) {
      const item=G.ITEMS[d.id];
      if(item&&player.cargoFreeSpace()>=(item.mass||1)*d.qty) {
        player.addCargo(d.id,d.qty); collected.push(d);
      }
    }
    return collected;
  }

  nearestSpaceport(x,y,radius) {
    let nearest=null, nearestD=radius;
    for(const b of this.bodies) {
      if(!b.hasSpaceport) continue;
      const d=G.v2.dist({x,y},{x:b.x,y:b.y});
      if(d<nearestD){nearestD=d;nearest=b;}
    }
    return nearest;
  }

  nearestAsteroid(x,y,radius) {
    let nearest=null,nearestD=radius;
    for(const a of this.asteroids) {
      const d=G.v2.dist({x,y},{x:a.x,y:a.y});
      if(d<nearestD){nearestD=d;nearest=a;}
    }
    return nearest;
  }

  // All targetable ships (enemies + hostile NPCs + all NPCs)
  allTargets() {
    return [
      ...this.enemies.filter(e=>!e.dead&&!e.boarded),
      ...this.npcs.filter(n=>!n.dead&&!n.boarded),
    ];
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
