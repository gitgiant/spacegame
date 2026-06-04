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
    hostile:   ["Opening fire! Authority to engage hostile vessel!"],
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
    hostile:   ["Open fire! For the rebellion!"],
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
    hostile:   ["Arrgh, fire everything!"],
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
    hostile:   ["Mayday! Being attacked! All hands brace!"],
    noresponse:["...", "No response.", "Channel closed."],
    forgive_accept: ["Okay, okay! {cost} credits — just don't shoot! We're leaving!",
                     "Deal. {cost} credits. We want no trouble."],
    forgive_deny:   ["We can't afford that! Just leave us alone!",
                     "Please! We have nothing!"],
  },
  alien: {
    hail:      ["[UNINTELLIGIBLE]", "[STATIC BURST]", "[SIGNAL LOST]"],
    noresponse:["[NO CARRIER]", "...", "[SIGNAL LOST]"],
    forgive_deny: ["[UNINTELLIGIBLE]", "[HOSTILE SIGNAL]"],
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
    this.landingScale = 1;

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

    if(this.disabled) { this.x+=this.vx*dt; this.y+=this.vy*dt; return; }
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
      } else {
        this._updateCombat(dt, projectiles, particles, now);
        this.x+=this.vx*dt; this.y+=this.vy*dt; return;
      }
    }

    // Autonomous behavior
    this._updateAutonomous(dt);
    this._applyDrag(dt);
    this.x+=this.vx*dt; this.y+=this.vy*dt;

    // Scan for hostile faction ships to engage
    if(!this.hostile) {
      const scan = [...enemies, ...otherNPCs];
      for(const s of scan) {
        if(s===this||s.dead||s.boarded) continue;
        if(G.HOSTILE[this.faction]?.[s.faction]) {
          if(Math.hypot(this.x-s.x, this.y-s.y) < 700) {
            this.hostile=true; this.combatTarget=s; break;
          }
        }
      }
    }
  }

  _updateAutonomous(dt) {
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
          this.aiState='landing'; this.landingScale=1; this.vx=0; this.vy=0;
        }
        break;
      }
      case 'landing': {
        // Zoom into the planet center, shrink to zero
        const ldx=this.targetX-this.x, ldy=this.targetY-this.y;
        const ld=Math.hypot(ldx,ldy)||1;
        this.vx += (ldx/ld)*this.speed*dt*3;
        this.vy += (ldy/ld)*this.speed*dt*3;
        this.landingScale = Math.max(0, this.landingScale - dt*2.8);
        if(this.landingScale <= 0) {
          this.aiState='docked'; this.dockTimer=8+Math.random()*22;
          this.vx=0; this.vy=0;
        }
        break;
      }
      case 'docked':
        this.dockTimer-=dt;
        if(this.dockTimer<=0) {
          this.aiState='transit_to_jump'; this._setJumpTarget();
          this.landingScale=1; // reappear at full size
        }
        break;
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
    if(dist<600&&diff<0.5&&now-this.lastShot>1/this.fireRate) {
      this.lastShot=now;
      projectiles.push({
        x:this.x+Math.sin(this.angle)*16, y:this.y-Math.cos(this.angle)*16,
        vx:Math.sin(angleToT)*800+this.vx*0.2,
        vy:-Math.cos(angleToT)*800+this.vy*0.2,
        damage:this.damage, type:'laser',
        color:this.color, width:2, splash:0,
        pierce:false, ttl:0.85, tracking:false,
        sourceId:this.id,
      });
    }
  }

  _setJumpTarget() {
    const a=Math.random()*Math.PI*2;
    this.targetX=Math.cos(a)*3800; this.targetY=Math.sin(a)*3800;
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
    if(this.hp<=0){this.hp=Math.round((this.maxHp||this.hp)*0.2)||10;this.disabled=true;}
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
    if(this.hostile) {
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
