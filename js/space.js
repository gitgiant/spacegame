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
    this.asteroids  = [...local.asteroids, ...(local.ringAsteroids||[])];
    this.derelicts  = local.derelicts;
    this.turrets    = local.turrets || [];
    this.nebula     = local.nebula || null;
    this._genBgStars(this.nebula);
    this.enemies    = [];
    this.npcs       = [];
    this.fleetShips = [];
    this.projectiles= [];
    this.floatingLoot=[];
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

  update(dt, player, input, particles, now) {
    this.time += dt;
    if(this._cargoFullTimer > 0) this._cargoFullTimer -= dt;

    // Orbit bodies
    for(const b of this.bodies) {
      if(b.orbitR) { b.orbitAngle+=(b.orbitSpeed||0); b.x=Math.cos(b.orbitAngle)*b.orbitR; b.y=Math.sin(b.orbitAngle)*b.orbitR; }
    }

    // Comet tail damage: ships inside the ice tail take minor damage
    for(const b of this.bodies) {
      if(b.type !== 'comet' || b.hp <= 0) continue;
      // Tail direction: away from star (origin)
      const tailAngle = Math.atan2(b.y, b.x);
      const tailLen   = b.tailLen || 100;
      // Check player
      const tx = b.x + Math.cos(tailAngle) * tailLen * 0.5;
      const ty = b.y + Math.sin(tailAngle) * tailLen * 0.5;
      const pd = Math.hypot(player.x - tx, player.y - ty);
      if(pd < tailLen * 0.55) {
        player.takeDamage(2 * dt, 'projectile');
        if(particles && Math.random() < 0.3) particles.emit({
          x:player.x, y:player.y, minSpd:20, maxSpd:50,
          life:0.25, r:2, color:'#88ccff', drag:0.9,
        });
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
      if(e._deathDone){this.enemies.splice(i,1);continue;}
      if(e.dead){this._updateDying(e,dt,particles,true);continue;}
      e.update(dt,player,this.projectiles,particles,now);
      if(e.arriving) e.arriving -= dt;
      if(!e.disabled&&particles) {
        const eRate = e._boosting ? 0.7 : 0.3;
        if(Math.random()<eRate) {
          if(e._boosting) particles.boost_trail(e.x,e.y,e.angle,e.size||1);
          else particles.engine_trail(e.x,e.y,e.angle,e.vx,e.vy,e.size||1);
        }
      }
    }

    // NPC ships
    for(let i=this.npcs.length-1;i>=0;i--) {
      const n=this.npcs[i];
      if(n._deathDone){this.npcs.splice(i,1);continue;}
      if(n.dead){this._updateDying(n,dt,particles,false);continue;}
      n.update(dt, this.bodies, this.npcs, this.enemies, this.projectiles, particles, now);
      if(n.arriving) n.arriving -= dt;
      if(n.aiState!=='docked'&&particles) {
        const nRate = n._boosting ? 0.6 : 0.2;
        if(Math.random()<nRate) {
          if(n._boosting) particles.boost_trail(n.x,n.y,n.angle,n.size||1);
          else particles.engine_trail(n.x,n.y,n.angle,n.vx,n.vy,n.size||1);
        }
      }
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

        // Regular weapons can chip at asteroids (much less efficient than mining laser)
        if(p.type !== 'mining') {
          for(let j=this.asteroids.length-1;j>=0;j--) {
            const a = this.asteroids[j];
            if(!G.circleHit(p.x,p.y,4,a.x,a.y,a.r)) continue;
            // ~12% of normal weapon damage as mining effectiveness
            const chipDmg = Math.max(0.5, p.damage * 0.12);
            a.hp -= chipDmg;
            if(particles) particles.mine_spark(a.x, a.y);
            if(a.hp <= 0) {
              const dropId = G.randEl(a.drops);
              const qty = G.randInt(1,2); // smaller yield than mining laser
              this.floatingLoot.push({
                x:a.x, y:a.y, vx:(Math.random()-0.5)*80, vy:(Math.random()-0.5)*80,
                type:'item', itemId:dropId, qty, rarity:G.ITEMS[dropId]?.rarity||'c',
                ttl:60, color:G.rarityColor(G.ITEMS[dropId]?.rarity||'c'),
              });
              this.asteroids.splice(j,1);
              if(particles) particles.explosion(a.x,a.y,0,0,0.5);
              G.ui?.addMsg('Asteroid cracked!','#aa8833');
            }
            if(!p.pierce) { this.projectiles.splice(i,1); break; }
          }
          if(!this.projectiles[i] || this.projectiles[i]!==p) continue;
        }

        // vs enemies
        for(let j=this.enemies.length-1;j>=0;j--) {
          const e=this.enemies[j];
          if(e.dead||e._deathDone||e.boarded) continue;
          if(G.circleHit(p.x,p.y,4,e.x,e.y,(e.size||1)*16+4)) {
            this._onHitEnemy(e,p,particles); if(!p.pierce){this.projectiles.splice(i,1);break;}
          }
        }
        // vs NPCs
        if(this.projectiles[i]===p) {
          for(let j=this.npcs.length-1;j>=0;j--) {
            const n=this.npcs[j];
            if(n.dead||n._deathDone||n.boarded) continue;
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
                if(t.faction!=='independent') G.game.setRel(t.faction, G.game.getRel(t.faction)-8, 'attacked turret');
              }
              t.hp -= p.damage;
              if(particles) particles.burst({x:p.x,y:p.y,minSpd:20,maxSpd:80,life:0.15,r:2,color:'#ffaa00'},4);
              if(t.hp<=0){
                t._dead=true;
                if(particles) particles.explosion(t.x,t.y,0,0,0.4);
                G.sound?.explosion();
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
        // vs comets
        if(this.projectiles[i]===p) {
          for(const b of this.bodies) {
            if(b.type !== 'comet' || b.hp <= 0) continue;
            if(G.circleHit(p.x,p.y,4,b.x,b.y,b.r*2)) {
              b.hp -= p.damage * (p.type === 'mining' ? 1.5 : 0.5);
              if(particles) particles.emit({x:p.x,y:p.y,minSpd:20,maxSpd:60,life:0.2,r:2,color:'#aaddff',drag:0.9});
              if(b.hp <= 0) {
                const dropCount = 3 + Math.floor(Math.random()*4);
                for(let di=0;di<dropCount;di++) {
                  const dropId = b.drops[Math.floor(Math.random()*b.drops.length)]||'ore';
                  const qty = 1 + Math.floor(Math.random()*2);
                  this.floatingLoot.push({
                    x:b.x+(Math.random()-0.5)*80, y:b.y+(Math.random()-0.5)*80,
                    vx:(Math.random()-0.5)*60, vy:(Math.random()-0.5)*60,
                    type:'item', itemId:dropId, qty,
                    rarity:G.ITEMS[dropId]?.rarity||'c', ttl:60,
                    color:G.rarityColor(G.ITEMS[dropId]?.rarity||'c'),
                  });
                }
                if(particles) particles.explosion(b.x,b.y,0,0,1.5);
                G.sound?.explosion(Math.hypot(b.x-player.x,b.y-player.y));
                G.ui?.addMsg('Comet destroyed! Ice resources scattered.','#aaddff');
                b.hp = 0; // mark done
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
            if(G.circleHit(p.x,p.y,4,e.x,e.y,(e.size||1)*16+4)){
              this._onHitEnemy(e,p,particles); if(!p.pierce){this.projectiles.splice(i,1);break;}
            }
          }
          if(this.projectiles[i]===p){
            for(let j=this.npcs.length-1;j>=0;j--){
              const n=this.npcs[j];
              if(!n.hostile||n.dead||n._deathDone) continue;
              if(G.circleHit(p.x,p.y,4,n.x,n.y,(n.size||1)*16+4)){
                n.takeDamage(p.damage,p.type);
                if(particles)particles.burst({x:p.x,y:p.y,minSpd:20,maxSpd:80,life:0.15,r:2,color:p.color},4);
                if(!p.pierce){this.projectiles.splice(i,1);break;}
              }
            }
          }
        } else {
          // Enemy/NPC/turret projectile: hits player and fleet ships
          if(G.circleHit(p.x,p.y,4,player.x,player.y,18)){
            this._onHitPlayer(player,p,particles);
            this.projectiles.splice(i,1);
          } else if(this.projectiles[i]===p) {
            for(const fs of this.fleetShips){
              if(fs.dead||fs._deathDone) continue;
              if(G.circleHit(p.x,p.y,4,fs.x,fs.y,(fs.size||1)*16+4)){
                fs.takeDamage(p.damage,p.type);
                if(particles)particles.burst({x:p.x,y:p.y,minSpd:20,maxSpd:80,life:0.15,r:2,color:p.color},4);
                if(!p.pierce){this.projectiles.splice(i,1);break;}
              }
            }
          }
        }
      }
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
        }
        fs._dyingTimer-=dt; fs._dyingNextBang-=dt;
        if(fs._dyingNextBang<=0&&particles){
          particles.explosion(fs.x+(Math.random()-0.5)*30,fs.y+(Math.random()-0.5)*30,0,0,0.3);
          G.sound?.explosion(Math.hypot(fs.x-player.x,fs.y-player.y));
          fs._dyingNextBang=0.25;
        }
        fs.x+=fs.vx*dt; fs.y+=fs.vy*dt;
        if(fs._dyingTimer<=0){
          if(particles)particles.explosion(fs.x,fs.y,fs.vx,fs.vy,(fs.size||1)*1.5);
          G.sound?.explosion(Math.hypot(fs.x-player.x,fs.y-player.y));
          fs._deathDone=true;
        }
        continue;
      }
      fs.update(dt, player, G.game?.target, this.projectiles, particles, now);
      if(particles&&Math.random()<0.25) particles.engine_trail(fs.x,fs.y,fs.angle,fs.vx,fs.vy,fs.size||1);
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
      const cr=player.tractorRange>0?player.tractorRange+40:50;
      if(d<cr && this._collectLoot(l,player)){this.floatingLoot.splice(i,1);}
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
      const bank = G.COMMS_LINES?.[npc.faction]||G.COMMS_LINES?.independent;
      const lines = bank?.hostile||['Opening fire!'];
      const dist = Math.hypot(npc.x-player.x, npc.y-player.y);
      if(dist < 1000) G.ui?.addMsg('['+npc.name+']: "'+lines[Math.floor(Math.random()*lines.length)]+'"', G.FACTIONS[npc.faction]?.color||'#ff4444');
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
    npc.takeDamage(proj.damage, proj.type);
    if(particles) {
      if(shieldsBefore>0) {
        particles.shield_hit(proj.x,proj.y,(npc.size||1)*16);
        G.sound?.shieldHit();
        if(npc.shields <= 0) G.sound?.shieldsLost();
      } else {
        particles.burst({x:proj.x,y:proj.y,minSpd:20,maxSpd:80,life:0.15,r:2,color:proj.color},4);
        G.sound?.weaponHit(proj.type);
      }
    }
    if(npc.disabled && !npc._disabledSoundPlayed) {
      npc._disabledSoundPlayed = true;
      const dist = G.game?.player ? Math.hypot(npc.x-G.game.player.x, npc.y-G.game.player.y) : 0;
      G.sound?.shipDisabled(dist);
      G.game?.addCombatLog((npc.name||npc.faction.toUpperCase()+' SHIP')+' DISABLED BY YOU', '#ff8844');
    }
  }

  _onHitEnemy(enemy, proj, particles) {
    const sb = enemy.shields;
    const wasDisabled = enemy.disabled;
    const wasDead = enemy.dead;
    enemy.takeDamage(proj.damage, proj.type);
    enemy._lastAttackerId = proj.sourceId;
    if(particles) {
      if(sb>0&&enemy.shields<sb) particles.shield_hit(proj.x,proj.y,(enemy.size||1)*16);
      else if(proj.type==='emp') particles.emp_hit(proj.x,proj.y);
      else particles.burst({x:proj.x,y:proj.y,minSpd:20,maxSpd:80,life:0.15,r:2,color:proj.color},4);
    }
    if(proj.sourceId==='player' || proj.sourceId==='turret') {
      if(sb>0&&enemy.shields<sb) {
        G.sound?.shieldHit();
        if(enemy.shields <= 0) G.sound?.shieldsLost();
      } else {
        G.sound?.weaponHit(proj.type);
      }
    }
    if(!wasDisabled && enemy.disabled) {
      const dist = G.game?.player ? Math.hypot(enemy.x-G.game.player.x, enemy.y-G.game.player.y) : 0;
      G.sound?.shipDisabled(dist);
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
    const res=player.takeDamage(proj.damage, proj.type);
    // Cancel jump charge if player takes hull damage while charging
    if(res.hullDmg > 0 && G.game?._jumpChargeT > 0) {
      G.game._jumpChargeT = 0;
      G.ui?.addMsg('Jump cancelled — hull hit!','#ff4444');
    }
    if(particles) {
      if(res.shieldDmg>0) {
        particles.shield_hit(proj.x,proj.y,22);
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
    // Ammo drops: ballistic ships drop kinetic rounds, others occasionally too
    const ammoDrops = [
      { id:'kinetic_rounds', chance: 0.45 },
      { id:'grenades',       chance: 0.10 },
      { id:'missiles',       chance: 0.08 },
    ];
    for(const ad of ammoDrops) {
      if(Math.random() < ad.chance) {
        this.floatingLoot.push({ x:ship.x+(Math.random()-0.5)*50, y:ship.y+(Math.random()-0.5)*50,
          vx:(Math.random()-0.5)*30, vy:(Math.random()-0.5)*30,
          type:'item', itemId:ad.id, qty:1, rarity:'c', ttl:45,
          color:'#ffcc44' });
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
        const atkName = atkId === 'player' ? 'YOU' : atkId ? atkId.toUpperCase() : 'UNKNOWN';
        G.game?.addCombatLog(typeName.toUpperCase()+' DESTROYED BY '+atkName, '#ff4444');
      }
      if(!isEnemy && ship.faction !== 'independent' && !ship.jumpingOut) {
        G.game.setRel(ship.faction, G.game.getRel(ship.faction)-10, ship.name+' destroyed');
        for(const [fac,hostile] of Object.entries(G.HOSTILE)) {
          if(hostile[ship.faction]) G.game.setRel(fac, Math.min(100, G.game.getRel(fac)+3), (G.FACTIONS[ship.faction]?.name||ship.faction)+' enemy eliminated');
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
      G.sound?.explosion(d2);
      const progress = 1 - Math.max(0, ship._dyingTimer) / ship._dyingInitialTimer;
      ship._dyingNextBang = Math.max(0.08, 0.45 - progress * 0.37);
    }
    if(ship._dyingTimer <= 0) {
      const sz = ship.size || 1;
      if(particles) particles.explosion(ship.x, ship.y, 0, 0, sz * 2.2);
      const plFin = G.game?.player;
      const dFin = plFin ? Math.hypot(ship.x-plFin.x, ship.y-plFin.y) : 0;
      G.sound?.explosion(dFin);
      // Shockwave: damage nearby ships
      const shockR = 140 + sz * 120;
      const shockDmg = 15 + sz * 30;
      for(const other of [...this.npcs, ...this.enemies]) {
        if(other===ship||other.dead||other.boarded) continue;
        const d = Math.hypot(other.x-ship.x, other.y-ship.y);
        if(d < shockR) other.takeDamage?.(shockDmg*(1-d/shockR), 'projectile');
      }
      const pl = G.game?.player;
      if(pl) {
        const dp = Math.hypot(pl.x-ship.x, pl.y-ship.y);
        if(dp < shockR) pl.takeDamage(shockDmg*0.35*(1-dp/shockR), 'projectile');
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
      if(item&&player.cargoFreeSpace()>=(item.mass||1)*loot.qty) {
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

  scuttleEnemy(enemy) {
    if(!enemy.disabled) return;
    this._dropLoot(enemy);
    if(G.game?.particles) G.game.particles.explosion(enemy.x, enemy.y, 0, 0, (enemy.size||1)*1.8);
    G.sound?.explosion(G.game?.player ? Math.hypot(enemy.x-G.game.player.x,enemy.y-G.game.player.y) : 0);
    enemy._deathDone = true;
    enemy.boarded = true;
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
      if(item&&player.cargoFreeSpace()>=(item.mass||1)*d.qty) {
        player.addCargo(d.id,d.qty); collected.push(d);
      }
    }
    return collected;
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

  nearestAsteroid(x,y,radius) {
    let nearest=null,nearestD=radius;
    for(const a of this.asteroids) {
      const d=G.v2.dist({x,y},{x:a.x,y:a.y});
      if(d<nearestD){nearestD=d;nearest=a;}
    }
    return nearest;
  }

  // All targetable ships/objects (enemies, NPCs, derelicts)
  allTargets() {
    return [
      ...this.enemies.filter(e=>!e.dead&&!e._deathDone&&!e.boarded),
      ...this.npcs.filter(n=>!n.dead&&!n._deathDone&&!n.boarded),
      ...this.derelicts.filter(d=>!d.looted),
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
