'use strict';
// ── NPC autonomous ships ──────────────────────────────────

G.NPC_NAMES = {
  earth:       ['EGS Steadfast','EGS Aurora','ESS Liberty','USSS Endeavor','EGS Sentinel','ESS Protector'],
  rebellion:   ['RFS Defiant','Liberation Star','FRS Resolve','RFS Phoenix','Freedom Runner','RFS Vanguard'],
  pirate:      ['Crimson Blade','Dark Void','Shadow Wolf','Rogue Storm','Iron Fang','Void Reaper'],
  independent: ['MV Horizon','SS Pioneer','Free Trader','MV Venture','SS Nomad','Wanderer'],
  alien:       ["Shard Vessel","Crystal Runner","Kha'al Scout","Void Shard","Shard Blade"],
};

G.COMMS_LINES = {
  earth: {
    hail:      ["Earth Gov vessel here. Routine patrol. Stay out of trouble.",
                "EGS checking in. Clear skies, commander.",
                "All traffic is monitored in this sector."],
    trade:     ["We can spare some surplus cargo. Fair market rates.",
                "Authorized to conduct limited trade. What do you need?"],
    threat:    ["Stand down immediately. You are threatening an Earth Government vessel.",
                "That's a crime. Your transponder has been flagged."],
    fuel:      ["Emergency fuel transfer authorized for {cost} credits. Dock alongside.",
                "We can spare fuel. {cost} credits — standard emergency rate."],
    hostile:        ["Opening fire! Authority to engage hostile vessel!",
                     "You are declared a threat. Weapons free!"],
    neutral_resume: ["Standing down. Threat neutralized.", "Clear. Resuming patrol."],
    noresponse:["...", "Static.", "No signal."],
    forgive_accept: ["Stand down. Your fine of {cost} credits has been logged. Don't let it happen again.",
                     "Payment received. We're watching you."],
    forgive_deny:   ["Your credits are no good here. Weapons free.",
                     "This isn't a negotiation. Prepare to be boarded."],
  },
  rebellion: {
    hail:      ["Rebellion vessel. We don't want trouble unless you bring it.",
                "Down with Earth Gov tyranny. Fly free.",
                "The movement grows stronger every day."],
    trade:     ["We trade in things the corps don't want available. Interested?",
                "Sure, we deal. Fair exchange only."],
    threat:    ["We've faced cruisers. You don't scare us.",
                "Try it, and see what the rebellion sends after you."],
    fuel:      ["Fuel costs credits even in a revolution. {cost} — take it.",
                "We look after each other out here. {cost} credits."],
    hostile:        ["Open fire! For the rebellion!", "Enemy of the cause — engage!"],
    neutral_resume: ["Disengaging. Stay out of our way.", "Stand down — for now."],
    noresponse:["...", "Not interested.", "Save it."],
    forgive_accept: ["Fine. {cost} credits to the cause. Now get out of our space.",
                     "We'll take your credits. Don't push your luck."],
    forgive_deny:   ["You can't buy your way out of this.",
                     "The rebellion doesn't deal with traitors."],
  },
  pirate: {
    hail:      ["What do you want, spacer? Make it quick.",
                "I've got cargo to deliver. Beat it.",
                "We don't do idle chat."],
    trade:     ["Got merchandise. Don't ask provenance. Deal?",
                "Credits change hands, cargo changes ships. Simple."],
    threat:    ["Ha. You're threatening a pirate? Bold move.",
                "I've been shot at by warships. Try harder."],
    fuel:      ["Fuel's expensive this far out. {cost}. Final offer.",
                "{cost} credits. I'm not running a charity."],
    hostile:        ["Arrgh, fire everything!", "Hah! Fresh prey!"],
    neutral_resume: ["Whatever. Wasn't worth my ammo.", "You got lucky — this time."],
    noresponse:["...", "Busy.", ""],
    forgive_accept: ["Hah! {cost} credits? Sure, we're done here. Fly on.",
                     "Now that's the smart play. {cost} credits — get lost."],
    forgive_deny:   ["You think that's enough? We'll take it off your wreck.",
                     "Not nearly enough. Open fire!"],
  },
  independent: {
    hail:      ["Just a trader, friend. Peaceful transit.",
                "No trouble here. Trying to make a living.",
                "Merchant vessel. We're not armed for a fight."],
    trade:     ["Happy to trade. Honest prices — no gouging.",
                "We've got a few things. What are you looking for?"],
    threat:    ["Please! I have a family! I'm just a merchant!",
                "I have nothing worth fighting over, I swear!"],
    fuel:      ["We all look out for each other. {cost} credits, deal?",
                "Happy to help. {cost} for a fuel cell transfer."],
    hostile:        ["Mayday! Being attacked! All hands brace!", "They're firing on us — return fire!"],
    neutral_resume: ["Oh thank the stars — we're safe!", "Easing off. We don't want trouble."],
    noresponse:["...", "No response.", "Channel closed."],
    forgive_accept: ["Okay, okay! {cost} credits — just don't shoot! We're leaving!",
                     "Deal. {cost} credits. We want no trouble."],
    forgive_deny:   ["We can't afford that! Just leave us alone!",
                     "Please! We have nothing!"],
  },
  alien: {
    hail:          ["[UNINTELLIGIBLE]", "[STATIC BURST]", "[SIGNAL LOST]"],
    hostile:       ["[HOSTILE SIGNAL DETECTED]", "[WEAPONS HOT]"],
    neutral_resume:["[SIGNAL NOMINAL]", "[THREAT WITHDRAWN]"],
    noresponse:    ["[NO CARRIER]", "...", "[SIGNAL LOST]"],
    forgive_deny:  ["[UNINTELLIGIBLE]", "[HOSTILE SIGNAL]"],
  },
};

G.NPCShip = class {
  constructor(faction, bodies, sysId) {
    this.id       = 'npc'+(G.NPCShip._uid++);
    this.type     = 'npc';
    this.faction  = faction;
    this.sysId    = sysId;

    const names = G.NPC_NAMES[faction]||G.NPC_NAMES.independent;
    this.name = names[Math.floor(Math.random()*names.length)]
              + ' #'+(100+Math.floor(Math.random()*900));

    // Pick ship type appropriate to faction
    const shipPool = {
      earth:       ['earth_shuttle','earth_corvette','earth_patrol','earth_hauler','earth_shuttle'],
      rebellion:   ['rebel_runner','rebel_corvette','rebel_frigate','rebel_hauler','rebel_runner'],
      pirate:      ['pirate_skiff','pirate_corvette','pirate_raider','pirate_skiff'],
      independent: ['shuttle','miner_ship','container_ship','tanker_ship','corvette'],
      alien:       ['alien_scout','alien_warship','alien_scout'],
    };
    const pool   = shipPool[faction]||shipPool.independent;
    this.shipId  = pool[Math.floor(Math.random()*pool.length)];
    const tpl    = G.SHIPS[this.shipId]||G.SHIPS.shuttle;
    this.shapeId = tpl.shape||'shuttle';
    this.color   = G.FACTIONS[faction]?.color||'#888888';
    this.size    = tpl.size||1.0;

    // Stats derived from ship template so larger ships are tankier and slower
    const hullVar = 0.8 + Math.random() * 0.4;
    this.maxHp      = tpl.baseHull * hullVar;
    this.hp         = this.maxHp;
    // Shields: faction modifier × hull-relative base (larger ships get more)
    const shieldBase = tpl.baseHull * 0.35 * hullVar;
    this.maxShields = faction==='earth'      ? shieldBase
                    : faction==='rebellion'  ? shieldBase * 0.6
                    : faction==='independent'? shieldBase * 0.15
                    : 0;
    this.shields = this.maxShields;

    // Spawn at system edge, facing inward
    const spawnAngle = Math.random()*Math.PI*2;
    const spawnDist  = 2800+Math.random()*1500;
    this.x = Math.cos(spawnAngle)*spawnDist;
    this.y = Math.sin(spawnAngle)*spawnDist;
    this.vx = 0; this.vy = 0;
    this.angle = spawnAngle + Math.PI; // face center

    // Speed and agility scale inversely with ship mass
    const massRatio = 80 / (tpl.baseMass || 80);
    this.speed     = (tpl.baseThrust / (tpl.baseMass || 80) * 1.8 + 80) * (0.8 + Math.random() * 0.4);
    this.turnSpeed = tpl.baseTurn * (0.8 + Math.random() * 0.4);
    this.fireRate  = 0.5+Math.random()*0.7;
    this.damage    = 10+Math.random()*10;
    this.lastShot  = 0;

    // Primary weapon from ship template
    const weaponIds = tpl.startWeapons || ['laser_cannon'];
    this.weaponId = weaponIds[0];

    // Mining state
    const shipClass = tpl.class || 'shuttle';
    this.isMiner  = (shipClass === 'miner');
    this.cargoMax = tpl.baseCargoSpace || 20;
    this.cargoUsed = 0;
    this.mineTarget = null;
    this.mineTimer  = 0;

    // AI
    this.aiState       = 'entering';
    this.dockTimer     = 0;
    this.jumpChargeT   = 0;
    this.jumpCharging  = false;
    this.targetX  = 0;
    this.targetY  = 0;
    this.dockBody = null;
    this._setInitialDestination(bodies);

    // Combat
    this.hostile      = false;
    this.combatTarget = null;
    this.dead         = false;
    this.disabled     = false;
    this.boarded      = false;
    this.empTimer     = 0;
    this.jumpingOut   = false;
    this.jumpOutTimer = 0;
    this._boosting    = false;

    // Cargo / credits
    this.credits = 80+Math.floor(Math.random()*400);
    this.cargo   = {};
    const itemArr = Object.keys(G.ITEMS).filter(k=>G.ITEMS[k].cat!=='mission');
    if(Math.random()<0.7 && itemArr.length) {
      const item = itemArr[Math.floor(Math.random()*itemArr.length)];
      this.cargo[item] = 1+Math.floor(Math.random()*4);
    }
  }

  _setInitialDestination(bodies) {
    if(this.isMiner && Math.random() < 0.6) {
      this.aiState = 'seek_asteroid';
      return;
    }
    const ports = bodies.filter(b=>b.hasSpaceport);
    if(ports.length && Math.random()<0.65) {
      this.dockBody = ports[Math.floor(Math.random()*ports.length)];
      this.targetX  = this.dockBody.x;
      this.targetY  = this.dockBody.y;
      this.aiState  = 'transit_to_port';
    } else {
      this._setJumpTarget();
      this.aiState = 'transit_to_jump';
    }
  }

  update(dt, bodies, otherNPCs, enemies, projectiles, particles, now) {
    if(this.dead||this.boarded) return;

    this._boosting = false;

    // Hyperspace jump-out sequence
    if(this.jumpingOut) {
      this.jumpOutTimer -= dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if(particles && Math.random() < 0.7)
        particles.engine_trail(this.x, this.y, this.angle, this.vx, this.vy, this.size||1);
      if(this.jumpOutTimer <= 0) this.dead = true;
      return;
    }

    if(this.disabled) {
      const drag = Math.max(0, 1 - 1.2 * dt);
      this.vx *= drag; this.vy *= drag;
      this.x+=this.vx*dt; this.y+=this.vy*dt; return;
    }
    if(this.empTimer>0) { this.empTimer-=dt; this.x+=this.vx*dt; this.y+=this.vy*dt; return; }

    // Occasional radio chatter to the player
    this._chatTimer = (this._chatTimer||30+Math.random()*60) - dt;
    if(this._chatTimer <= 0 && G.game && !this.hostile) {
      this._chatTimer = 45 + Math.random()*90;
      const player = G.game.player;
      const d = Math.hypot(this.x - player.x, this.y - player.y);
      if(d < 800) {
        const bank = G.COMMS_LINES[this.faction]||G.COMMS_LINES.independent;
        const needHelp = this.hp < this.maxHp * 0.4 && enemies.length > 0;
        const lines = needHelp
          ? ["Mayday — taking heavy fire! Any friendly ships?",
             "Requesting assistance! Ship critically damaged!",
             "This is "+this.name+" — we need backup!"]
          : bank.hail;
        const msg = lines[Math.floor(Math.random()*lines.length)];
        const facCol = G.FACTIONS[this.faction]?.color || '#88ccee';
        G.ui?.addMsg('['+this.name+']: "'+msg+'"', facCol);
      }
    }

    // Update dock body position if it's orbiting
    if(this.dockBody) {
      this.targetX = this.dockBody.x;
      this.targetY = this.dockBody.y;
    }

    // Combat mode
    if(this.hostile && this.combatTarget) {
      const ct = this.combatTarget;
      if(ct.dead||ct.boarded) {
        this.hostile=false; this.combatTarget=null;
        this.aiState='transit_to_jump'; this._setJumpTarget();
        const bank = G.COMMS_LINES[this.faction]||G.COMMS_LINES.independent;
        const lines = bank.neutral_resume||bank.hail||['Standing down.'];
        const dist = G.game?.player ? Math.hypot(this.x-G.game.player.x,this.y-G.game.player.y) : 9999;
        if(dist < 900) G.ui?.addMsg('['+this.name+']: "'+lines[Math.floor(Math.random()*lines.length)]+'"', G.FACTIONS[this.faction]?.color||'#88ccee');
      } else {
        this._updateCombat(dt, projectiles, particles, now);
        this.x+=this.vx*dt; this.y+=this.vy*dt; return;
      }
    }

    // Autonomous behavior
    this._updateAutonomous(dt, particles);
    this._applyDrag(dt);
    this.x+=this.vx*dt; this.y+=this.vy*dt;

    // Scan for hostile faction ships to engage
    if(!this.hostile) {
      const scan = [...enemies, ...otherNPCs];
      for(const s of scan) {
        if(s===this||s.dead||s.boarded||s.disabled) continue;
        if(G.HOSTILE[this.faction]?.[s.faction]) {
          if(Math.hypot(this.x-s.x, this.y-s.y) < 700) {
            this.hostile=true; this.combatTarget=s; break;
          }
        }
      }
    }
  }

  _updateAutonomous(dt, particles) {
    switch(this.aiState) {
      case 'transit_to_port': {
        const dx2=this.targetX-this.x, dy2=this.targetY-this.y;
        const dist2=Math.hypot(dx2,dy2);
        this._steerTo(this.targetX, this.targetY, dt);
        // Decelerate when close: slow to a stop over ~150 units
        if(dist2 > 200) {
          this._thrust(dt);
        } else {
          // Gently brake to dock
          const brakeFactor = dist2 / 200;
          this.vx += Math.sin(this.angle)*this.speed*dt*0.4*brakeFactor;
          this.vy -= Math.cos(this.angle)*this.speed*dt*0.4*brakeFactor;
          const spd = Math.hypot(this.vx,this.vy);
          if(spd > this.speed*brakeFactor) { this.vx*=(this.speed*brakeFactor)/spd; this.vy*=(this.speed*brakeFactor)/spd; }
          // Apply braking drag
          const drag = Math.pow(0.85, dt * 60);
          this.vx *= drag; this.vy *= drag;
        }
        if(dist2 < 200) {
          // Compute a parking spot at the planet's edge in the current approach direction
          const pAngle = Math.atan2(this.y - this.targetY, this.x - this.targetX);
          const parkDist = (this.dockBody?.r || 50) + (this.size||1) * 14 + 20;
          this.parkOffsetX = Math.cos(pAngle) * parkDist;
          this.parkOffsetY = Math.sin(pAngle) * parkDist;
          this.aiState = 'parking'; this.vx = 0; this.vy = 0;
        }
        break;
      }
      case 'parking': {
        const parkX = this.targetX + this.parkOffsetX;
        const parkY = this.targetY + this.parkOffsetY;
        const pdx = parkX - this.x, pdy = parkY - this.y;
        const pd = Math.hypot(pdx, pdy);
        if(pd > 6) {
          this._steerTo(parkX, parkY, dt);
          this._thrust(dt);
          const drag = Math.pow(0.90, dt * 60);
          this.vx *= drag; this.vy *= drag;
          const spd = Math.hypot(this.vx, this.vy);
          const maxSpd = Math.min(this.speed, pd * 1.5);
          if(spd > maxSpd) { this.vx *= maxSpd/spd; this.vy *= maxSpd/spd; }
        } else {
          this.x = parkX; this.y = parkY;
          this.vx = 0; this.vy = 0;
          this.aiState = 'docked'; this.dockTimer = 8 + Math.random() * 22;
        }
        break;
      }
      case 'docked':
        this.x = this.targetX + this.parkOffsetX;
        this.y = this.targetY + this.parkOffsetY;
        this.vx = 0; this.vy = 0;
        this.dockTimer -= dt;
        if(this.dockTimer <= 0) {
          this._setDepartTarget();
          if(this.isMiner) {
            this.cargo = {}; this.cargoUsed = 0;
            if(G.game?.space?.asteroids?.length) {
              this._afterDepart = 'seek_asteroid';
              this.aiState = 'departing'; break;
            }
          }
          this._afterDepart = null;
          this.aiState = 'departing';
        }
        break;
      case 'departing': {
        const ddx = this._departTargetX - this.x, ddy = this._departTargetY - this.y;
        this._steerTo(this._departTargetX, this._departTargetY, dt);
        this._thrust(dt);
        if(Math.hypot(ddx, ddy) < 100) {
          if(this._afterDepart) { this.aiState = this._afterDepart; this._afterDepart = null; }
          else { this.aiState = 'transit_to_jump'; this._setJumpTarget(); }
        }
        break;
      }
      case 'seek_asteroid': {
        const sAst = G.game?.space?.asteroids;
        if(!sAst || !sAst.length) { this.aiState='transit_to_jump'; this._setJumpTarget(); break; }
        let nearA=null, nearD=Infinity;
        for(const a of sAst) { const d=Math.hypot(a.x-this.x,a.y-this.y); if(d<nearD){nearD=d;nearA=a;} }
        if(!nearA) { this.aiState='transit_to_jump'; this._setJumpTarget(); break; }
        this.mineTarget = nearA;
        this.aiState = 'transit_to_asteroid';
        break;
      }
      case 'transit_to_asteroid': {
        if(!this.mineTarget) { this.aiState='seek_asteroid'; break; }
        const sAst2 = G.game?.space?.asteroids;
        if(sAst2 && !sAst2.includes(this.mineTarget)) { this.mineTarget=null; this.aiState='seek_asteroid'; break; }
        this.targetX = this.mineTarget.x; this.targetY = this.mineTarget.y;
        const mdist = Math.hypot(this.targetX-this.x, this.targetY-this.y);
        this._steerTo(this.targetX, this.targetY, dt);
        if(mdist > 85) this._thrust(dt);
        if(mdist < 85) this.aiState = 'mining_asteroid';
        break;
      }
      case 'mining_asteroid': {
        if(!this.mineTarget) { this.aiState='seek_asteroid'; break; }
        const spc = G.game?.space;
        if(spc && !spc.asteroids.includes(this.mineTarget)) {
          this.mineTarget = null;
          if(this.cargoUsed >= this.cargoMax) this._returnToPort();
          else if(spc.asteroids.length) this.aiState = 'seek_asteroid';
          else { this.aiState='transit_to_jump'; this._setJumpTarget(); }
          break;
        }
        this.targetX = this.mineTarget.x; this.targetY = this.mineTarget.y;
        if(Math.hypot(this.targetX-this.x, this.targetY-this.y) > 100) {
          this._steerTo(this.targetX, this.targetY, dt); this._thrust(dt);
        }
        this.mineTimer -= dt;
        if(this.mineTimer <= 0) {
          this.mineTimer = 0.5;
          this.mineTarget.hp -= 12;
          if(particles) particles.mine_spark(this.mineTarget.x, this.mineTarget.y);
          if(this.mineTarget.hp <= 0) {
            const dropId = G.randEl(this.mineTarget.drops);
            if(dropId) { const qty=1+Math.floor(Math.random()*2); this.cargo[dropId]=(this.cargo[dropId]||0)+qty; this.cargoUsed+=qty; }
            if(particles) particles.explosion(this.mineTarget.x, this.mineTarget.y, 0, 0, 0.6);
            const idx = spc.asteroids.indexOf(this.mineTarget);
            if(idx>=0) spc.asteroids.splice(idx,1);
            this.mineTarget = null;
            if(this.cargoUsed >= this.cargoMax) this._returnToPort();
            else if(spc.asteroids.length) this.aiState = 'seek_asteroid';
            else { this.aiState='transit_to_jump'; this._setJumpTarget(); }
          }
        }
        break;
      }
      case 'fuel_rendezvous': {
        const player = G.game?.player;
        if(!player) { this.aiState='transit_to_jump'; this._setJumpTarget(); break; }
        const fdx = player.x - this.x, fdy = player.y - this.y;
        const fdist = Math.hypot(fdx, fdy);
        if(fdist > 140) {
          this._steerTo(player.x, player.y, dt);
          this._thrust(dt);
        } else {
          // Matched-velocity braking alongside the player
          this.vx += (player.vx - this.vx) * Math.min(1, dt * 4);
          this.vy += (player.vy - this.vy) * Math.min(1, dt * 4);
          if(!this._fuelTransferDone) {
            this._fuelTransferDone = true;
            const fuelNeeded = Math.max(0, player.maxFuel - player.fuel);
            if(fuelNeeded < 1) {
              G.ui?.addMsg(this.name+': Your tanks are full — no transfer needed.', '#aaaaaa');
            } else {
              const cost = Math.round(fuelNeeded * (this.fuelRendezvousPrice || 8));
              if(G.game.credits >= cost) {
                G.game.credits -= cost;
                player.fuel = player.maxFuel;
                G.sound?.menuClick?.();
                G.ui?.addMsg('Fuel transfer complete: +'+Math.round(fuelNeeded)+' fuel for '+G.fmtCredits(cost), '#ff8844');
              } else {
                G.ui?.addMsg(this.name+': You can\'t cover the cost — transfer aborted.', '#ff4444');
              }
            }
            this._fuelDepartTimer = 3;
          }
          this._fuelDepartTimer -= dt;
          if(this._fuelDepartTimer <= 0) {
            this.fuelRendezvous = false;
            this.aiState = 'transit_to_jump';
            this._setJumpTarget();
          }
        }
        break;
      }
      case 'transit_to_jump':
        this._boosting = true;
        this._steerTo(this.targetX, this.targetY, dt);
        this._thrust(dt);
        if(Math.hypot(this.x-this.targetX,this.y-this.targetY) < 130) {
          // Reached jump point — start warmup charge
          this.aiState = 'charging_jump';
          this.jumpChargeT = 0;
          this.vx = 0; this.vy = 0;
        }
        break;
      case 'charging_jump': {
        const chargeTime = 2.5;
        this.jumpChargeT += dt;
        if(this.jumpChargeT >= chargeTime) {
          // Hyperspace jump-out
          this.jumpingOut = true;
          this.jumpOutTimer = 0.45;
          this.vx = Math.sin(this.angle)*6000;
          this.vy = -Math.cos(this.angle)*6000;
          if(particles) particles.warp_effect(this.x, this.y);
        }
        break;
      }
    }
  }

  _updateCombat(dt, projectiles, particles, now) {
    const t=this.combatTarget;
    const dx=t.x-this.x, dy=t.y-this.y;
    const dist=Math.hypot(dx,dy);
    this._steerTo(t.x, t.y, dt);
    if(dist>220) this._thrust(dt);
    const angleToT=Math.atan2(dx,-dy);
    const diff=Math.abs(G.wrapAngle(this.angle-angleToT));
    const wpn = G.WEAPONS[this.weaponId] || {};
    const range = wpn.range || 600;
    const rate  = wpn.fireRate || this.fireRate;
    const spd   = wpn.projSpeed || 800;
    if(dist < range * 0.85 && diff < 0.5 && now - this.lastShot > 1/rate) {
      this.lastShot = now;
      projectiles.push({
        x: this.x+Math.sin(this.angle)*16, y: this.y-Math.cos(this.angle)*16,
        vx: Math.sin(angleToT)*spd + this.vx*0.2,
        vy: -Math.cos(angleToT)*spd + this.vy*0.2,
        damage: wpn.damage || this.damage,
        type:   wpn.type   || 'laser',
        color:  wpn.color  || this.color,
        width:  wpn.width  || 2,
        splash: wpn.splash || 0,
        pierce: wpn.pierce ?? false,
        ttl:    (wpn.range || 600) / (wpn.projSpeed || 800),
        tracking: false,
        sourceId: this.id,
      });
      const playerDist = G.game?.player ? Math.hypot(this.x - G.game.player.x, this.y - G.game.player.y) : 0;
      G.sound?.weaponFire(playerDist);
    }
  }

  _setJumpTarget() {
    const a=Math.random()*Math.PI*2;
    this.targetX=Math.cos(a)*3800; this.targetY=Math.sin(a)*3800;
  }

  _setDepartTarget() {
    const angle = Math.atan2(this.parkOffsetY || 0, this.parkOffsetX || 1);
    this._departTargetX = this.x + Math.cos(angle) * 600;
    this._departTargetY = this.y + Math.sin(angle) * 600;
  }

  _returnToPort() {
    const ports = (G.game?.space?.bodies || []).filter(b => b.hasSpaceport);
    if(ports.length) {
      this.dockBody = ports[Math.floor(Math.random() * ports.length)];
      this.targetX = this.dockBody.x; this.targetY = this.dockBody.y;
      this.aiState = 'transit_to_port';
    } else {
      this.aiState = 'transit_to_jump'; this._setJumpTarget();
    }
  }

  _steerTo(tx,ty,dt) {
    const dx=tx-this.x, dy=ty-this.y;
    if(Math.hypot(dx,dy)<5) return;
    const a=Math.atan2(dx,-dy);
    this.angle+=G.clamp(G.wrapAngle(a-this.angle)*5,-this.turnSpeed,this.turnSpeed)*dt;
  }

  _thrust(dt) {
    const fwdX=Math.sin(this.angle), fwdY=-Math.cos(this.angle);
    const latX=Math.cos(this.angle), latY= Math.sin(this.angle);
    const accel=this.speed*0.4;

    this.vx+=fwdX*accel*dt;
    this.vy+=fwdY*accel*dt;

    // Grip: cancel sideways velocity while thrusting forward
    const vLat=this.vx*latX+this.vy*latY;
    const dvl=Math.sign(vLat)*Math.min(Math.abs(vLat), accel*1.0*dt);
    this.vx-=latX*dvl; this.vy-=latY*dvl;

    const s=Math.hypot(this.vx,this.vy);
    if(s>this.speed){this.vx*=this.speed/s;this.vy*=this.speed/s;}
  }

  _applyDrag(dt) {
    const fwdX=Math.sin(this.angle), fwdY=-Math.cos(this.angle);
    const latX=Math.cos(this.angle), latY= Math.sin(this.angle);
    let vFwd=this.vx*fwdX+this.vy*fwdY;
    let vLat=this.vx*latX+this.vy*latY;
    vFwd*=Math.max(0, 1-0.08*dt);   // slight forward drag
    vLat*=Math.max(0, 1-2.5*dt);    // strong lateral drag
    this.vx=fwdX*vFwd+latX*vLat;
    this.vy=fwdY*vFwd+latY*vLat;
  }

  takeDamage(amount, type) {
    if(type==='emp'){this.empTimer=4;this.shields=0;return;}
    if(this.disabled){this.hp-=amount;if(this.hp<=0)this.dead=true;return;}
    if(this.shields>0){const sd=Math.min(this.shields,amount);this.shields-=sd;amount=(amount-sd)*0.2;}
    this.hp-=amount;
    if(this.hp<=0){this.disabled=true;}
  }

  // Returns array of comms options
  getCommsOptions(playerFuelPct) {
    const fuelNeeded  = G.game?.player ? Math.max(0, G.game.player.maxFuel - G.game.player.fuel) : 0;
    const fuelCostEst = Math.round(fuelNeeded * 8);
    const opts = [
      { key:'hail',    label:'Hail',           color:'#00ffee' },
      { key:'trade',   label:'Propose Trade',  color:'#ffcc00' },
      { key:'fuel',    label:`Request Fuel — ${G.fmtCredits(fuelCostEst)} (rendezvous)`, color:'#ff8844',
        disabled: this.hostile || playerFuelPct > 0.9 },
      { key:'threaten',label:'Threaten',       color:'#ff4444' },
    ];
    const playerRep = G.game?.getRel(this.faction) ?? 0;
    if(this.hostile && playerRep > -75) {
      const cost   = G.npcForgivenessCost(this.faction);
      const chance = Math.round(G.npcForgivenessChance(this.faction) * 100);
      opts.push({ key:'forgive', label:`Beg Forgiveness — ${G.fmtCredits(cost)} (${chance}% success)`, color:'#ffaa00' });
    }
    return opts;
  }

  getCommsResponse(action) {
    const bank = G.COMMS_LINES[this.faction]||G.COMMS_LINES.independent;
    const arr  = bank[action]||bank.hail;
    const base = arr[Math.floor(Math.random()*arr.length)];
    const res  = { text:base, hostile:false, fuelAmt:0, fuelCost:0, tradeItems:[], forgiveResult:null };

    if(action==='fuel') {
      const player   = G.game?.player;
      const fuelNeeded = player ? Math.max(0, player.maxFuel - player.fuel) : 0;
      const fuelCost   = Math.round(fuelNeeded * 8);
      res.text = `Roger that. En route for fuel transfer — ${G.fmtCredits(fuelCost)} when we dock.`;
      res.fuelRendezvous = true;
      res.fuelAmt  = fuelNeeded;
      res.fuelCost = fuelCost;
      // Activate rendezvous AI on the NPC
      this.fuelRendezvous      = true;
      this.fuelRendezvousPrice = 8;
      this._fuelTransferDone   = false;
      this._fuelDepartTimer    = 0;
      this.aiState = 'fuel_rendezvous';
    }
    if(action==='trade') {
      res.tradeItems = Object.entries(this.cargo).map(([id,qty])=>({id,qty,price:Math.round((G.ITEMS[id]?.base||100)*0.9)}));
    }
    if(action==='threaten') {
      const baseChance = this.faction==='pirate'?0.25:this.faction==='independent'?0.55:0.45;
      res.hostile = Math.random()<baseChance;
    }
    if(action==='forgive') {
      const cost    = G.npcForgivenessCost(this.faction);
      const success = Math.random() < G.npcForgivenessChance(this.faction);
      const lines   = bank[success ? 'forgive_accept' : 'forgive_deny'] || bank.hail;
      res.text = lines[Math.floor(Math.random()*lines.length)].replace('{cost}', G.fmtCredits(cost));
      res.forgiveResult = { success, cost };
    }
    return res;
  }
};
G.NPCShip._uid = 0;

// ── Fleet Ship (player escort AI) ─────────────────────────
G.FleetShip = class {
  constructor(entry) {
    this.id = 'fs'+(++G.FleetShip._uid);
    this.type = 'fleet';
    this.isFleetShip = true;
    this.fleetDataId = entry.id;
    this.name = entry.fleetName || 'Fleet Ship';
    const tpl = G.SHIPS[entry.ship?.templateId];
    this.shapeId = tpl?.shape || 'shuttle';
    this.color = tpl?.color || '#8899bb';
    this.size = tpl?.size || 1.0;

    const s = entry.ship;
    this.hull = s?.hull ?? 100;
    this.maxHull = s?.maxHull ?? 160;
    this.shields = s?.shields ?? 0;
    this.maxShields = s?.maxShields ?? 0;

    this.speed = entry.combatSpeed || 280;
    this.turnSpeed = entry.combatTurnSpeed || 2.0;
    this.damage = entry.combatDamage || 15;
    this.fireRate = entry.combatFireRate || 1.0;
    this.weaponType = entry.combatWeaponType || 'laser';
    this.weaponColor = entry.combatWeaponColor || '#44aaff';

    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.angle = 0;
    this.lastShot = 0;

    this.dead = false;
    this.disabled = false;
    this._deathDone = false;
    this._orbitOffset = Math.random() * Math.PI * 2;
    this._aiTimer = 0;
  }

  update(dt, player, target, projectiles, particles, now) {
    if(this.disabled) {
      this.vx *= Math.max(0, 1 - 1.5*dt);
      this.vy *= Math.max(0, 1 - 1.5*dt);
      this.x += this.vx*dt; this.y += this.vy*dt;
      this.angle += 0.4*dt;
      return;
    }

    this._aiTimer += dt;
    const isTargetHostile = target && (target.type === 'enemy' || target.hostile || (target.faction && G.game?.getRel(target.faction) < -30));
    const attackTarget = target && !target.dead && !target.disabled && target !== player && isTargetHostile ? target : null;

    if(attackTarget) {
      const tdx = attackTarget.x - this.x;
      const tdy = attackTarget.y - this.y;
      const distToTarget = Math.hypot(tdx, tdy) || 1;
      const aimAngle = Math.atan2(tdx, -tdy);

      if(distToTarget > 380) {
        this._steerTo(attackTarget.x, attackTarget.y, dt);
        this._thrust(dt, distToTarget > 700);
      } else {
        const side = Math.sin(this._aiTimer*0.7) > 0 ? 1 : -1;
        const perpX = (-tdy/distToTarget)*280, perpY = (tdx/distToTarget)*280;
        this._steerTo(attackTarget.x+perpX*side, attackTarget.y+perpY*side, dt);
        this._thrust(dt);
      }

      const angleDiff = Math.abs(G.wrapAngle(this.angle - aimAngle));
      if(angleDiff < 0.5 && distToTarget < 680 && now - this.lastShot > 1/this.fireRate) {
        this.lastShot = now;
        const spd = this.weaponType==='laser' ? 780 : 560;
        projectiles.push({
          x: this.x+Math.sin(this.angle)*16, y: this.y-Math.cos(this.angle)*16,
          vx: Math.sin(aimAngle)*spd+this.vx*0.2, vy: -Math.cos(aimAngle)*spd+this.vy*0.2,
          damage: this.damage, type: this.weaponType,
          range: 700, traveled: 0,
          color: this.weaponColor, width: 2,
          ttl: 0.95, sourceId: this.id,
          splash: 0, empStrength: 0, tracking: false, pierce: false,
        });
        if(particles) particles.emit({
          x: this.x+Math.sin(this.angle)*16, y: this.y-Math.cos(this.angle)*16,
          minSpd:20, maxSpd:60, life:0.15, r:2, color:this.weaponColor,
        });
        const playerDist = Math.hypot(this.x - player.x, this.y - player.y);
        G.sound?.weaponFire(playerDist);
      }
    } else {
      const dx = player.x - this.x, dy = player.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      this._orbitOffset += dt * 0.28;
      if(dist > 420) {
        this._steerTo(player.x, player.y, dt);
        this._thrust(dt, dist > 700);
      } else {
        const ox = player.x + Math.cos(this._orbitOffset)*260;
        const oy = player.y + Math.sin(this._orbitOffset)*260;
        this._steerTo(ox, oy, dt);
        this._thrust(dt);
      }
    }

    this.x += this.vx*dt; this.y += this.vy*dt;
  }

  _steerTo(tx, ty, dt) {
    const dx=tx-this.x, dy=ty-this.y;
    if(Math.abs(dx)+Math.abs(dy)<5) return;
    const tgt=Math.atan2(dx,-dy);
    const diff=G.wrapAngle(tgt-this.angle);
    this.angle += G.clamp(diff*5, -this.turnSpeed, this.turnSpeed)*dt;
  }

  _thrust(dt, fast=false) {
    const spd = this.speed*(fast?1.45:1.0);
    this.vx += Math.sin(this.angle)*spd*dt*0.5;
    this.vy -= Math.cos(this.angle)*spd*dt*0.5;
    const s = Math.hypot(this.vx, this.vy);
    if(s > spd) { this.vx*=spd/s; this.vy*=spd/s; }
  }

  takeDamage(amount, type) {
    if(type==='emp') return;
    if(this.shields>0){ const sd=Math.min(this.shields,amount); this.shields-=sd; amount=(amount-sd)*0.2; }
    this.hull -= amount;
    const entry = G.game?.fleet?.find(e => e.id === this.fleetDataId);
    if(entry && entry.ship) entry.ship.hull = this.hull;
    if(this.hull<=0 && !this.disabled) this.disabled = true;
    if(this.hull<=-this.maxHull*0.4) this.dead = true;
  }
};
G.FleetShip._uid = 0;
