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
    hail: [
      "Earth Gov vessel here. Routine patrol. Stay out of trouble.",
      "EGS checking in. Clear skies, commander.",
      "All traffic is monitored in this sector.",
      "This is {name}. Identify yourself and state your heading.",
      "{name} to unidentified vessel — you are being tracked. State your business.",
      "Earth Government patrol, copy. What's your sitrep?",
      "Lima Charlie on this channel. Proceed with your transmission.",
      "Sector Foxtrot-Seven patrol checking in. You have our attention.",
      "EGS vessel {name}, authentication Bravo-Niner. Go ahead.",
      "All vessels in this corridor are subject to inspection. Stand by.",
      "This is Earth Gov. We've been tracking your transponder for three sectors.",
      "Roger your hail. {name} here — keep it short, we're on patrol.",
      "Earth Navy vessel. Weapons cold but we're watching. Proceed.",
      "{name} — you're on a monitored channel. Choose your words carefully.",
      "Grid reference Delta-Four. {name} on patrol. Go ahead.",
      "Copy. {name} standing by — state your purpose, spacer.",
    ],
    trade: [
      "We can spare some surplus cargo. Fair market rates.",
      "Authorized to conduct limited trade. What do you need?",
      "Earth Gov surplus available. Clean goods, clean ledger.",
      "Checking manifest — units available. Standard rates apply.",
      "{name} authorizing field trade. One time only.",
      "Field trade authorization active. Make it quick — we have a patrol to run.",
      "Cargo exchange acknowledged. Comply with Earth Gov transfer protocols.",
    ],
    fuel: [
      "Emergency fuel transfer authorized for {cost} credits. Dock alongside.",
      "We can spare fuel. {cost} credits — standard emergency rate.",
      "{name} en route for fuel transfer. Rate is {cost}, non-negotiable.",
      "Fuel request approved. {cost} credits. {name} Oscar Mike to your position.",
      "Roger, en route. {cost} credits. Emergency field transfer protocol active.",
    ],
    tribute_accept: [
      "This violation will be on record. Take it and leave our sector.",
      "You'll regret this. Transferring under protest.",
      "...Fine. Under protest. {name} logging this incident for command review.",
      "Transferring under duress. Your transponder is flagged — enjoy your credits.",
      "This sector command will hear about this. Credits transferred.",
      "You've made an enemy today. Take the credits and go.",
      "{name} complying under coercion. Command notified. You will be found.",
    ],
    tribute_refuse: [
      "Stand down immediately. You are threatening an Earth Government vessel.",
      "That's a crime. Your transponder has been flagged. Weapons free.",
      "{name} declaring Code Alpha. Tango acquired. Engaging.",
      "Negative. Weapons free. Command notified — all units, Code Tango.",
      "You picked the wrong ship. {name} weapons hot. Engaging hostile.",
      "By order of Earth Government, you are under arrest. Comply or be destroyed.",
      "Code Tango! Code Tango! {name} engaging hostile — all units respond.",
      "{name} — weapons free. Robbing Earth Navy? Bold. Lethal. Stupid.",
    ],
    hostile: [
      "Opening fire! Authority to engage hostile vessel!",
      "You are declared a threat. Weapons free!",
      "{name} to command — engaging Tango. Neutralization in progress.",
      "Code Alpha — weapons hot. You had your chance.",
      "Earth Gov vessel {name} is weapons hot. This ends now.",
      "All units: Tango in sector. {name} engaging — request backup.",
      "Earth Navy protocol Foxtrot-Seven active. Lethal force authorized.",
      "Target designated. {name} — fire for effect.",
    ],
    neutral_resume: [
      "Standing down. Threat neutralized.",
      "Clear. Resuming patrol.",
      "{name} standing down. Returning to patrol. Don't make us come back.",
      "Situation nominal. {name} resuming sector sweep.",
      "Code Green. Tango has withdrawn. {name} resuming Oscar Mike.",
      "Weapons cold. You're clear — for now. Don't test us again.",
    ],
    noresponse: [
      "...",
      "Static.",
      "No signal.",
      "{name} — channel closed. No response.",
      "Not responding. Signal interference in sector.",
      "[NO CARRIER]",
      "Channel November — no response.",
    ],
    forgive_accept: [
      "Stand down. Your fine of {cost} credits has been logged. Don't let it happen again.",
      "Payment received. We're watching you.",
      "Fine of {cost} accepted. {name} logging resolution. Stay out of restricted space.",
      "Credits received. You're on probation. One more incident and there's no deal.",
      "Clearance granted on payment of {cost}. Bravo Zulu — smart choice.",
      "{cost} received by {name}. Flagged but not pursued. Don't waste this.",
    ],
    forgive_deny: [
      "Your credits are no good here. Weapons free.",
      "This isn't a negotiation. Prepare to be boarded.",
      "Negative on the offer. {name} weapons free. Your account is closed.",
      "We don't take bribes. Code Tango active. {name} engaging.",
      "Earth Gov doesn't negotiate with criminals. Weapons free.",
    ],
  },

  rebellion: {
    hail: [
      "Rebellion vessel. We don't want trouble unless you bring it.",
      "Down with Earth Gov tyranny. Fly free.",
      "The movement grows stronger every day.",
      "This is {name}. You're in rebel space — state your allegiance.",
      "{name} here. Friend or foe? Choose carefully.",
      "Rebel comms active. We've got eyes on you. What's your business?",
      "The cause lives. {name} checking in — what do you need?",
      "We don't broadcast our position for nothing. Talk.",
      "Rebellion vessel {name}. You've got thirty seconds.",
      "Every ship that hails us is a resource or a risk. Which are you?",
      "The old order is dying. {name} — are you with us or against us?",
      "Running dark out here. {name} — signal received. Go ahead.",
      "Freedom isn't free. Neither is our time. What do you want?",
      "{name} on comms. We fight for the people — state your purpose.",
      "Earth Gov can't hear us out here. {name} — speak freely.",
    ],
    trade: [
      "We trade in things the corps don't want available. Interested?",
      "Sure, we deal. Fair exchange only.",
      "{name} authorizing trade window. No questions about origin. Deal?",
      "We've got surplus from the last Earth Gov convoy we liberated. Interested?",
      "Trade approved. The rebellion needs credits too. What are you offering?",
      "Fair barter or fair credits. {name} — honest deal for the right person.",
    ],
    fuel: [
      "Fuel costs credits even in a revolution. {cost} — take it.",
      "We look after each other out here. {cost} credits.",
      "{name} en route. The cause needs funded — {cost} for the tank.",
      "Solidarity only goes so far. {cost} credits, then we're even.",
      "Roger, en route. {cost} credits. Tax on surviving out here.",
    ],
    tribute_accept: [
      "Fine. You win this one. Don't think it means we're friends.",
      "Take it. The rebellion remembers every slight.",
      "Credits transferred. {name} logging this. Earth Gov can't protect everyone.",
      "You're bold. Fine — take it. The cause will outlast you either way.",
      "Fine. You fight dirty — respect. Credits incoming from {name}.",
      "Take what you want. The movement bends — it doesn't break.",
    ],
    tribute_refuse: [
      "We've faced cruisers. You don't scare us. Open fire!",
      "Try it. The rebellion will send ten ships for every one you shoot down.",
      "{name} weapons hot. You picked a fight with the wrong side of history.",
      "We've bled for freedom — we won't pay tribute to anyone. {name} engaging.",
      "The cause doesn't bow to pirates or tyrants. {name} opening fire.",
      "Rebels don't kneel. {name} — weapons free!",
    ],
    hostile: [
      "Open fire! For the rebellion!",
      "Enemy of the cause — engage!",
      "{name} engaging. The cause demands it.",
      "Weapons free. The rebellion doesn't forgive traitors.",
      "You made this choice. {name} — fire everything.",
      "For every rebel who died — this is for them. {name} engaging.",
      "Tango acquired. {name} weapons free — for the movement!",
    ],
    neutral_resume: [
      "Disengaging. Stay out of our way.",
      "Stand down — for now.",
      "{name} standing down. Consider this a warning from the movement.",
      "Weapons cold. Don't push us again.",
      "You got lucky. The rebellion will remember.",
      "{name} breaking off. The cause is patient. We will meet again.",
    ],
    noresponse: [
      "...",
      "Not interested.",
      "Save it.",
      "{name} — channel dead.",
      "Running silent.",
      "Signal rejected.",
    ],
    forgive_accept: [
      "Fine. {cost} credits to the cause. Now get out of our space.",
      "We'll take your credits. Don't push your luck.",
      "{cost} credits received by {name}. Debt paid — barely.",
      "Credits to the cause. Wise. {name} will not pursue — this time.",
      "Accepted. {cost} to the fund. Now fly before we reconsider.",
      "{name} — fine accepted. {cost} credits. Don't make us meet again.",
    ],
    forgive_deny: [
      "You can't buy your way out of this.",
      "The rebellion doesn't deal with traitors.",
      "{name} — offer declined. We have principles. Weapons free.",
      "Keep your credits. We'll take them off the wreck.",
      "No deal. The movement doesn't negotiate with enemies. {name} engaging.",
    ],
  },

  pirate: {
    hail: [
      "What do you want, spacer? Make it quick.",
      "I've got cargo to deliver. Beat it.",
      "We don't do idle chat.",
      "This is {name}. You've got ten seconds before we decide you're cargo.",
      "{name} here. What do you want? And it better be good.",
      "Unidentified vessel — you're in our hunting ground. State your business.",
      "Hailing back. {name} — now talk before I get bored.",
      "You're on pirate frequencies. Takes guts or stupidity. Which is it?",
      "Signal received. {name} is listening — and so is our weapons array.",
      "We run dark out here for a reason. What do you want?",
      "You've got my attention. That's not always a good thing. Talk.",
      "{name} on comms. Cut to it — we're not the chatty type.",
      "Come in. {name} on the line. Make it worth our time.",
      "Fancy hailing a pirate. Bold move, stranger. {name} — go ahead.",
    ],
    trade: [
      "Got merchandise. Don't ask provenance. Deal?",
      "Credits change hands, cargo changes ships. Simple.",
      "{name} authorizing a trade. No receipts, no questions. Credits only.",
      "We liberate cargo from supply chains. Want some at discount?",
      "We deal in hard-to-find goods. {name} — fair price for the right buyer.",
      "Goods available. Origin unspecified. Price negotiable. You in?",
    ],
    fuel: [
      "Fuel's expensive this far out. {cost}. Final offer.",
      "{cost} credits. I'm not running a charity.",
      "{name} en route. {cost} and we call it even. Argue and the price doubles.",
      "Fuel for {cost}. Take it or float. {name} isn't making special trips.",
      "Alright, we'll sell you fuel. {cost}. Don't make a habit of it.",
    ],
    tribute_accept: [
      "Hah! Bold. Alright, here's your cut. Now disappear.",
      "Smart move. Take it before I change my mind.",
      "Credits transferred. {name} respects someone who takes what they want.",
      "Hah! You've got stones. Credits incoming from {name}.",
      "Take it. {name} likes audacity. Don't push it further.",
      "Ha! You robbed a pirate. Genius or a death wish. Credits sent.",
    ],
    tribute_refuse: [
      "Ha! You're demanding tribute from a pirate? Priceless. Die.",
      "I've been shot at by warships. You're nothing. Open fire!",
      "{name} — you're robbing a pirate? Hilarious. Weapons free.",
      "Bold move. Dumbest thing I've seen this sector. {name} engaging.",
      "You're shaking down {name}? Last thing you'll find funny. Weapons hot.",
      "Nobody taxes the taxmen. Weapons hot. {name} engaging.",
    ],
    hostile: [
      "Arrgh, fire everything!",
      "Hah! Fresh prey!",
      "{name} weapons free! Strip the hull clean!",
      "Target acquired. {name} — let's see what you're made of.",
      "Hostile contact! {name} going weapons hot!",
      "Ha! You walked right into us. {name} — fire at will!",
      "Shoot first, salvage after. {name} moving to engage.",
      "{name} weapons hot. Nothing personal — just business.",
    ],
    neutral_resume: [
      "Whatever. Wasn't worth my ammo.",
      "You got lucky — this time.",
      "{name} standing down. You've got a guardian angel somewhere.",
      "Fine. Not worth the fuel. {name} breaking off.",
      "We'll let you go. Don't make it a habit.",
    ],
    noresponse: [
      "...",
      "Busy.",
      "",
      "{name} — not interested.",
      "Channel dead. Move on.",
      "No.",
    ],
    forgive_accept: [
      "Hah! {cost} credits? Sure, we're done here. Fly on.",
      "Now that's the smart play. {cost} credits — get lost.",
      "{cost} transferred to {name}. You bought yourself a tomorrow. Use it.",
      "Hah! Smart spacer. {cost} credits — {name} accepts. Good doing business.",
      "We'll take it. {cost} from {name}. Come back sometime — maybe we'll trade.",
    ],
    forgive_deny: [
      "You think that's enough? We'll take it off your wreck.",
      "Not nearly enough. Open fire!",
      "{name} — not interested. We'll earn more off your cargo. Engaging.",
      "Keep it. {name} prefers the hard way. Weapons hot.",
      "Credits? We want your ship. {name} — weapons free.",
    ],
  },

  independent: {
    hail: [
      "Just a trader, friend. Peaceful transit.",
      "No trouble here. Trying to make a living.",
      "Merchant vessel. We're not armed for a fight.",
      "This is {name}. Just hauling freight — no trouble wanted.",
      "{name} on comms. Peaceful merchant. Please don't shoot.",
      "Registered trader {name}. Clean manifest, clean record. Passing through.",
      "The fuck you want {name} — independent freighter, no weapons worth mentioning.",
      "Hail received. {name} — just trying to get to the next port.",
      "Merchant vessel {name} acknowledges. We come in peace, genuinely.",
      "This is {name}. Got cargo and a mortgage to pay. No trouble wanted.",
      "Lima Charlie — loud and clear. {name}, independent hauler. What do you need?",
      "Just a free trader out here. {name} on comms. What can we do for you?",
      "Signal received. {name} — civilian merchant. We're unarmed. Please.",
      "{name} — just trying to make a living. What can we do for you?",
      "Peaceful contact. {name} — no contraband, no trouble, just cargo runs.",
    ],
    trade: [
      "Happy to trade. Honest prices — no gouging.",
      "We've got a few things. What are you looking for?",
      "{name} opening trade bay. Fair prices, clean goods, no trouble.",
      "Trade? Sure. {name} always looking to turn a profit the honest way.",
      "We've got surplus cargo. {name} — fair exchange, no tricks.",
      "Trading is how we survive. {name} — what are you after?",
    ],
    fuel: [
      "We all look out for each other. {cost} credits, deal?",
      "Happy to help. {cost} for a fuel cell transfer.",
      "{name} en route. {cost} credits — we help where we can.",
      "Of course. {cost} credits. {name} — we remember when someone helped us.",
      "En route to your position. {cost} credits is all we ask. Stay safe.",
    ],
    tribute_accept: [
      "Please! Just take it and go! We don't want any trouble!",
      "Here — everything in our lockbox. Just don't hurt anyone!",
      "Credits transferred from {name}. We just want to go home. Please.",
      "Here. Take it. {name} has a crew to think about. Just let us go.",
      "Fine. {name} paying up. We can't fight this. Just let us pass.",
      "Take whatever you want. {name} — we have families. Please.",
    ],
    tribute_refuse: [
      "We won't be intimidated! You'll regret this — open fire!",
      "No! We're not giving you anything! Fight us then!",
      "{name} is done being pushed around! Combat stations!",
      "Enough! {name} to all stations — we fight back!",
      "We may be traders but we're not cowards! {name} engaging!",
    ],
    hostile: [
      "Mayday! Being attacked! All hands brace!",
      "They're firing on us — return fire!",
      "{name} declaring emergency — under attack! Mayday!",
      "All hands to battle stations! {name} is under fire!",
      "We're taking hits! {name} — returning fire! Someone help us!",
      "This is {name} — mayday, mayday! We're being attacked!",
    ],
    neutral_resume: [
      "Oh thank the stars — we're safe!",
      "Easing off. We don't want trouble.",
      "{name} standing down. Stars above — we thought we were done for.",
      "Weapons cold. {name} — deeply relieved. We'll remember your mercy.",
      "Thank you. {name} — standing down. Safe travels to you.",
    ],
    noresponse: [
      "...",
      "No response.",
      "Channel closed.",
      "{name} — no signal. Channel dead.",
      "Dead air.",
      "Trying again... nothing.",
    ],
    forgive_accept: [
      "Okay, okay! {cost} credits — just don't shoot! We're leaving!",
      "Deal. {cost} credits. We want no trouble.",
      "{cost} transferred from {name}. Just let us go, please.",
      "Credits sent. {name} — please, we have a family at port. Let us go.",
      "Deal accepted. {cost} from {name}. We'll forget this happened.",
      "{name} — sending {cost} now. We have crew depending on us.",
    ],
    forgive_deny: [
      "We can't afford that! Just leave us alone!",
      "Please! We have nothing!",
      "{name} — we can't cover that. Please, we're just traders.",
      "That's everything we have and more. {name} begging you — stand down.",
      "We don't have that kind of credits! {name} — please.",
    ],
  },

  alien: {
    hail: [
      "[UNINTELLIGIBLE]",
      "[STATIC BURST]",
      "[SIGNAL LOST]",
      "[CARRIER WAVE DETECTED — NO TRANSLATION]",
      "[HARMONIC FREQUENCY: WARNING]",
      "[QUANTUM SIGNAL — DECODE FAILED]",
      "[TRANSMISSION CORRUPT — ORIGIN: {name}]",
      "[HOSTILE INTENT DETECTED — TRANSLATING...]",
      "[ANOMALOUS BROADCAST — BIOLOGICAL ENTITY SCANNED]",
      "[SIGNAL: ORGANIC VESSEL IDENTIFIED — THREAT ASSESSMENT RUNNING]",
      "[NULL RESPONSE EXPECTED — ENGAGING CONTACT PROTOCOL]",
    ],
    hostile: [
      "[HOSTILE SIGNAL DETECTED]",
      "[WEAPONS HOT]",
      "[EXTERMINATE — THREAT VECTOR ACQUIRED]",
      "[TARGET LOCKED — FIRING SEQUENCE INITIATED]",
      "[ORGANIC VESSEL — TERMINATE]",
      "[{name}: COMBAT PROTOCOL ACTIVE]",
    ],
    neutral_resume: [
      "[SIGNAL NOMINAL]",
      "[THREAT WITHDRAWN]",
      "[DISENGAGING — TEMPORARILY]",
      "[SECTOR SCAN COMPLETE — WITHDRAWING]",
    ],
    noresponse: [
      "[NO CARRIER]",
      "...",
      "[SIGNAL LOST]",
      "[CHANNEL VOID]",
      "[NULL RESPONSE]",
    ],
    forgive_deny: [
      "[UNINTELLIGIBLE]",
      "[HOSTILE SIGNAL]",
      "[TRANSACTION REJECTED — EXTERMINATION CONTINUING]",
      "[ORGANIC CURRENCY: IRRELEVANT]",
    ],
  },
};

G.NPCShip = class extends G.ShipEntity {
  constructor(faction, bodies, sysId) {
    super();
    this.id       = 'npc'+(G.NPCShip._uid++);
    this.type     = 'npc';
    this.faction  = faction;
    this.sysId    = sysId;

    const names = G.NPC_NAMES[faction]||G.NPC_NAMES.independent;
    this.name = names[Math.floor(Math.random()*names.length)]
              + ' #'+(100+Math.floor(Math.random()*900));

    // Pick ship type appropriate to faction
    const shipPool = {
      earth:       ['earth_shuttle','earth_fighter','earth_corvette','earth_patrol','earth_hauler','earth_bomber','earth_destroyer','earth_cruiser','earth_carrier'],
      rebellion:   ['rebel_runner','rebel_fighter','rebel_corvette','rebel_frigate','rebel_hauler','rebel_bomber','rebel_destroyer','rebel_cruiser','rebel_carrier'],
      pirate:      ['pirate_skiff','pirate_fighter','pirate_corvette','pirate_raider','pirate_hauler','pirate_marauder','pirate_destroyer','pirate_battleship'],
      independent: ['shuttle','fighter','miner_ship','container_ship','tanker_ship','corvette','frigate','bomber'],
      alien:       ['alien_scout','alien_fighter','alien_warship'],
    };
    const pool   = shipPool[faction]||shipPool.independent;
    this.shipId  = pool[Math.floor(Math.random()*pool.length)];
    const tpl    = G.SHIPS[this.shipId]||G.SHIPS.shuttle;
    this.shapeId = tpl.shape||'shuttle';
    this.color   = G.FACTIONS[faction]?.color||'#888888';
    this.size    = tpl.size||1.0;
    this.captain = { sex: Math.random() < 0.5 ? 'male' : 'female', faceIdx: Math.floor(Math.random() * 5) };
    this.classId = G.CLASS_IDS[Math.floor(Math.random()*G.CLASS_IDS.length)];
    this.level = G.randInt(1, 20);

    // Spawn at system edge, facing inward
    const spawnAngle = Math.random()*Math.PI*2;
    const spawnDist  = 2800+Math.random()*1500;
    this.x = Math.cos(spawnAngle)*spawnDist;
    this.y = Math.sin(spawnAngle)*spawnDist;
    this.vx = 0; this.vy = 0;
    this.angle = spawnAngle + Math.PI; // face center

    this._fireRateMult = 1;
    this.lastShot  = 0;
    // Backing module hull: positional damage + pure module stats. Sets ship,
    // maxHp/hp, maxShields/shields, speed, turnSpeed, size, weapons (drop meta).
    G.aiInitHull(this, this.shipId);

    // Mining state
    const shipClass = tpl.class || 'shuttle';
    this.isMiner  = (shipClass === 'miner');
    this.cargoMax = this.ship?.cargoSpace || 20;
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
    this._intentionMsgCooldown = 0;

    // Cargo / credits
    this.credits = 80+Math.floor(Math.random()*400);
    this.cargo   = {};
    const itemArr = Object.keys(G.ITEMS).filter(k=>G.ITEMS[k].cat!=='mission');
    if(Math.random()<0.7 && itemArr.length) {
      const item = itemArr[Math.floor(Math.random()*itemArr.length)];
      this.cargo[item] = 1+Math.floor(Math.random()*4);
    }

    // ~15% of friendly NPC ships carry healing_nova
    this.abilities = (faction !== 'pirate' && Math.random() < 0.15) ? ['healing_nova'] : [];
    this.abilityCooldowns = {};
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
    // Engines shot off -> coast to a halt (still alive, can still fire)
    G.aiHaltIfNoEngines(this, dt);

    // Hyperspace jump-in sequence (materialization)
    if(this.jumpingIn) {
      this.jumpInTimer -= dt;
      if(this.jumpInTimer <= 0) {
        this.jumpingIn = false;
        if(particles) particles.warp_effect(this.x, this.y);
      }
      return;
    }

    // Hyperspace jump-out sequence
    if(this.jumpingOut) {
      this.jumpOutTimer -= dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if(particles && Math.random() < 0.7) {
        const shape = G.SHAPES[this.shapeId];
        const enginePts = shape?.enginePts || [[0, 10]];
        const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
        for(const [ex, ey] of enginePts) {
          const wx = this.x + (ex * ca - ey * sa);
          const wy = this.y + (ex * sa + ey * ca);
          particles.engine_trail(wx, wy, this.angle, this.vx, this.vy, this.size||1);
        }
      }
      if(this.jumpOutTimer <= 0) this.dead = true;
      return;
    }

    if(this.disabled) {
      const drag = Math.max(0, 1 - 1.2 * dt);
      this.vx *= drag; this.vy *= drag;
      this.x+=this.vx*dt; this.y+=this.vy*dt; return;
    }
    if(this.empTimer>0) { this.empTimer-=dt; this.x+=this.vx*dt; this.y+=this.vy*dt; return; }

    // Frozen by Frost Nova
    if(this._frozenTimer > 0) {
      this._frozenTimer -= dt;
      this.vx *= 0.85; this.vy *= 0.85;
      this.x += this.vx * dt; this.y += this.vy * dt;
      return;
    }

    // Heal over time buff (from Healing Nova) — repairs modules now
    if(this._healBuffTimer > 0 && this._healBuff > 0) {
      this._healBuffTimer -= dt;
      this.ship?.repair(this._healBuff * dt);
      G.aiDeriveStats(this);
      if(this._healBuffTimer <= 0) { this._healBuff = 0; }
    }

    // NPC ability usage — healing_nova when hurt
    if(this.abilities?.length && particles) {
      this.abilityCooldowns = this.abilityCooldowns || {};
      for(const abilId of this.abilities) {
        const def = G.ABILITIES[abilId];
        if(!def?.npcUsable) continue;
        if((this.abilityCooldowns[abilId] || 0) > 0) { this.abilityCooldowns[abilId] -= dt; continue; }
        if(abilId === 'healing_nova' && G.aiDamaged(this)) {
          this.abilityCooldowns[abilId] = def.cooldown + Math.random() * 10;
          particles.healing_nova(this.x, this.y, def.range);
          G.sound?.abilityHeal?.();
          // Heal self
          this._healBuff = 5; this._healBuffTimer = 5.0;
          // Heal nearby friendly NPCs
          for(const n of (otherNPCs || [])) {
            if(n === this || n.hostile || n.dead) continue;
            if(Math.hypot(n.x - this.x, n.y - this.y) <= def.range) {
              n._healBuff = 5; n._healBuffTimer = 5.0;
            }
          }
        }
      }
    }

    // Occasional radio chatter to the player
    this._chatTimer = (this._chatTimer||30+Math.random()*60) - dt;
    if(this._chatTimer <= 0 && G.game && !this.hostile) {
      this._chatTimer = 45 + Math.random()*90;
      const player = G.game.player;
      const d = Math.hypot(this.x - player.x, this.y - player.y);
      if(d < 800) {
        const bank = G.COMMS_LINES[this.faction]||G.COMMS_LINES.independent;
        const needHelp = G.aiDamaged(this) && enemies.length > 0;
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
      if(this._scanState) this._endScanEncounter(false); // drop any in-progress inspection
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

    // Patrol inspection demands (only in faction-owned systems, when calm).
    this._maybeStartScanDemand(dt);
    if(this._scanState && this._tickScanEncounter(dt)) {
      this._applyDrag(dt);
      this.x += this.vx*dt; this.y += this.vy*dt;
      return;
    }

    // Autonomous behavior
    const _prevAiState = this.aiState;
    const _prevHostile = this.hostile;
    this._updateAutonomous(dt, particles);
    this._applyDrag(dt);
    if(particles && Math.random() < 0.5) {
      const shape = G.SHAPES[this.shapeId];
      const enginePts = shape?.enginePts || [[0, 10]];
      const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
      for(const [ex, ey] of enginePts) {
        const wx = this.x + (ex * ca - ey * sa);
        const wy = this.y + (ex * sa + ey * ca);
        particles.engine_trail(wx, wy, this.angle, this.vx, this.vy, this.size||1, this._boosting);
      }
    }
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

    // Declare intention change to nearby player
    if(this._intentionMsgCooldown > 0) this._intentionMsgCooldown -= dt;
    else if(this.aiState !== _prevAiState || (this.hostile && !_prevHostile)) {
      const player = G.game?.player;
      if(player && Math.random() < 0.45) {
        const dist = Math.hypot(this.x - player.x, this.y - player.y);
        if(dist < 900) {
          const msg = this._intentionDeclaration(_prevHostile);
          if(msg) {
            this._intentionMsgCooldown = 20;
            G.ui?.addMsg('['+this.name+']: "'+msg+'"', G.FACTIONS[this.faction]?.color||'#88ccee');
          }
        }
      }
    }
  }

  // ── Patrol scan demands ──────────────────────────────────
  // A faction patrol policing its own system may demand to scan ships,
  // including the player. Comply (hold position to be scanned) and you're
  // waved through; flee and the patrol turns hostile with a faction hit.
  _isPatrol() {
    const g = G.game;
    if(!g || this.hostile || this.dead || this.disabled || this.jumpingOut) return false;
    if(this.faction !== 'earth' && this.faction !== 'rebellion') return false; // governments police space
    // Only patrols that are actually out flying — not docked or jumping away.
    if(['docked','parking','transit_to_jump','charging_jump'].includes(this.aiState)) return false;
    const sys = G.SYSTEMS.find(s => s.id === this.sysId);
    if(!sys || sys.faction !== this.faction) return false;                     // only their own territory
    const rel = g.getRel(this.faction);
    return rel > -30 && rel < 60; // already-hostile or trusted-ally pilots aren't stopped
  }

  _maybeStartScanDemand(dt) {
    if(this._scanState) return;
    const g = G.game, player = g?.player;
    if(!player || player.dead) return;
    if((g._scanDemandReadyAt || 0) > performance.now()/1000) return; // global pacing
    const active = g._scanDemandActive;
    if(active && active._scanState && !active.dead && !active.hostile) return; // one demand at a time
    if(active) g._scanDemandActive = null;                                     // clear stale holder
    if(!this._isPatrol()) return;
    this._scanCheckTimer = (this._scanCheckTimer != null ? this._scanCheckTimer : 5 + Math.random()*8) - dt;
    if(this._scanCheckTimer > 0) return;
    this._scanCheckTimer = 8 + Math.random()*12;
    if(Math.hypot(this.x - player.x, this.y - player.y) > 1800) return;
    if(Math.random() < 0.05) this._startScanDemand();
  }

  _startScanDemand() {
    const g = G.game;
    this._scanState = 'demanding';
    this._scanTimer = 15;       // seconds of patience before it's treated as fleeing
    this._scanProgress = 0;
    g._scanDemandActive = this;
    const facCol = G.FACTIONS[this.faction]?.color || '#88ccee';
    const bank = G.COMMS_LINES[this.faction] || G.COMMS_LINES.independent;
    const facName = (G.FACTIONS[this.faction]?.name || this.faction);
    const lines = bank.scan_demand || [
      facName + ' patrol — cut your engines and hold for inspection.',
      'Routine scan of all vessels in this system. Hold position, pilot.',
      'This is a ' + facName + ' patrol. Power down and submit to a scan.',
    ];
    G.ui?.addMsg('['+this.name+']: "'+lines[Math.floor(Math.random()*lines.length)]+'"', facCol);
    G.ui?.addMsg('PATROL: Hold position to be scanned — fleeing is treated as hostile.', '#ffcc44');
    G.sound?.commsPing?.();
  }

  // Returns true while it is driving this ship's movement.
  _tickScanEncounter(dt) {
    const g = G.game, player = g?.player;
    if(!player || player.dead || this.dead) { this._endScanEncounter(false); return false; }
    if(this._scanState !== 'demanding') return false;

    this._scanTimer -= dt;
    const dist = Math.hypot(this.x - player.x, this.y - player.y);

    // Intercept: close on the player and hold just off their hull.
    this._steerTo(player.x, player.y, dt);
    if(dist > 340) this._thrust(dt);

    if(dist > 3000) { this._failScan('fled'); return true; }          // bolted out of range
    if(this._scanTimer <= 0) { this._failScan('refused'); return true; } // ran out the clock

    if(dist < 540) {
      const before = this._scanProgress;
      this._scanProgress += dt;
      if(before < 0.05) G.ui?.addMsg('['+this.name+']: "Scanning your vessel — hold still."', G.FACTIONS[this.faction]?.color||'#88ccee');
      if(this._scanProgress >= 3.0) { this._passScan(); return true; }
    } else {
      this._scanProgress = Math.max(0, this._scanProgress - dt * 0.5);
    }
    return true;
  }

  _passScan() {
    G.ui?.addMsg('['+this.name+']: "Scan complete — you\'re clean. Safe travels."', G.FACTIONS[this.faction]?.color||'#88ccee');
    G.sound?.commsPing?.();
    this._endScanEncounter(true);
  }

  _failScan(reason) {
    const g = G.game;
    const facCol = '#ff5544';
    const msg = reason === 'fled'
      ? 'Evading inspection?! You\'re flagged hostile.'
      : 'Non-compliance noted. Opening fire.';
    G.ui?.addMsg('['+this.name+']: "'+msg+'"', facCol);
    g?.setRel?.(this.faction, (g.getRel(this.faction)||0) - 12, '(evaded patrol scan)');
    // This patrol and nearby faction-mates turn hostile.
    this.hostile = true; this.combatTarget = g.player;
    for(const n of (g.space?.npcs || [])) {
      if(n === this || n.dead || n.faction !== this.faction) continue;
      if(Math.hypot(n.x - this.x, n.y - this.y) < 1200) { n.hostile = true; n.combatTarget = g.player; }
    }
    G.ui?.openCommsHostile?.(this, msg);
    this._endScanEncounter(false);
  }

  _endScanEncounter(/*success*/) {
    const g = G.game;
    if(g) {
      if(g._scanDemandActive === this) g._scanDemandActive = null;
      g._scanDemandReadyAt = performance.now()/1000 + 45 + Math.random()*60; // pace the next demand anywhere
    }
    this._scanState = null;
    this._scanProgress = 0;
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
          const cl = this.mineTarget;
          const idx = spc.asteroids.indexOf(cl);
          // Mine the exposed tile nearest the NPC
          let t=null, td=Infinity;
          for(const tt of cl.tiles.values()){
            if(!tt.exposed) continue;
            const w=G.astTileWorld(cl,tt);
            const dd=(this.x-w.x)**2+(this.y-w.y)**2;
            if(dd<td){ td=dd; t=tt; }
          }
          if(t){
            t.hp -= 12;
            if(particles) particles.mine_spark(this.x, this.y);
            if(t.hp <= 0){
              const dropId=(G.ASTEROID_MAT[t.mat]||G.ASTEROID_MAT.rock).drop;
              const qty=1+Math.floor(Math.random()*2);
              this.cargo[dropId]=(this.cargo[dropId]||0)+qty; this.cargoUsed+=qty;
              G.astRemoveTile(cl, t);
              if(particles) particles.explosion(this.x, this.y, 0, 0, 0.4);
            }
          }
          if(!t || cl.tileCount <= 0){
            if(cl.tileCount <= 0 && idx>=0) spc.asteroids.splice(idx,1);
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
        const pDist = G.game?.player ? Math.hypot(this.x - G.game.player.x, this.y - G.game.player.y) : 9999;
        if(pDist < 2000) G.sound?.jumpCharge(this.jumpChargeT / chargeTime, pDist);
        if(this.jumpChargeT >= chargeTime) {
          // Hyperspace jump-out
          this.jumpingOut = true;
          this.jumpOutTimer = 0.45;
          this.vx = Math.sin(this.angle)*6000;
          this.vy = -Math.cos(this.angle)*6000;
          if(particles) particles.warp_effect(this.x, this.y);
          if(pDist < 3000) G.sound?.hyperspace(pDist);
          else G.sound?.stopJumpCharge();
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
    const _approachSpd = dist>0 ? -(dx/dist*this.vx+dy/dist*this.vy) : 0;
    if(dist>280) { this._thrust(dt); }
    else if(_approachSpd>70) { this._brake(dt); }

    // Strafe dodge in combat
    this._strafeCd = (this._strafeCd||0) - dt;
    if((this._strafeDur||0) > 0) {
      this._strafeDur -= dt;
      this._doStrafe(this._strafeDir||1, dt);
    } else {
      this._strafeDir = 0;
      if(this._strafeCd <= 0 && dist < 500) {
        this._strafeDir = Math.random() < 0.5 ? 1 : -1;
        this._strafeDur = 0.5 + Math.random() * 0.6;
        this._strafeCd  = 1.0 + Math.random() * 1.2;
      }
    }

    const angleToT=Math.atan2(dx,-dy);
    // Fire every live weapon module from its own hex cell. Destroyed weapon
    // modules drop out automatically.
    G.aiSyncHull(this);
    G.aiFireWeapons(this, angleToT, this.combatTarget || G.game?.player, now, projectiles, particles, { fireArc: 0.5 });
  }

  _intentionDeclaration(wasHostile) {
    if(this.hostile && !wasHostile) {
      const bank = G.COMMS_LINES[this.faction]||G.COMMS_LINES.independent;
      const sightedLines = [
        'Enemies sighted. Going weapons hot.','Hostile contact. Engaging.',
        'Contact! Engaging hostile.','Threat detected. Weapons free.',
        'Got eyes on a bogey. Engaging.','Picking a fight. Don\'t interfere.',
      ];
      const allLines = [...(bank.hostile||[]), ...sightedLines];
      return allLines[Math.floor(Math.random()*allLines.length)];
    }
    const opts = {
      mining_asteroid:    ['Mining survey. Stand clear.','Starting extraction.','Locked on target asteroid.',
                           'Looting this rock. Back off.','Salvage rights claimed. Move along.',
                           'Found something good. Starting extraction.'],
      transit_to_port:    ['Inbound to port.','Switching to docking approach.','Heading to the port.',
                           'Need to eat. Making for port.','Tired. Heading in.',
                           'Low on supplies. Docking up.','Long shift. Time to rest.'],
      transit_to_jump:    ['Plotting jump coordinates.','Spooling up jump drive.','Calculating hyperspace route.',
                           'Escorting this lane. Nothing to see.','Guarding this sector. Move along.',
                           'Getting out of here.','This system is too hot. Jumping.'],
      charging_jump:      ['Jump drive charging. Stand clear.','Initiating hyperspace sequence.',
                           'Hiding from whoever that was.','Not getting paid enough for this.'],
      fuel_rendezvous:    ['En route for fuel transfer. Hold your position.'],
      seek_asteroid:      ['Scanning for survey targets.','Picking an asteroid.',
                           'Bored. Going to shoot some rocks.','Nothing to do. Mining it is.',
                           'Scouting for salvage.'],
      departing:          ['Departing. Clearing the pad.','Lifting off.',
                           'Finally. Getting out of this port.','Break\'s over. Back at it.',
                           'Finished eating. Moving out.'],
      docked:             ['Taking a break.','Grabbing food. Back soon.','Resting here a bit.',
                           'Taking a nap. Don\'t bother me.','Comfort stop. Give me five.',
                           'Off the clock. Leave me alone.','Eating. Comm me later.',
                           'Nature calls. Stand by.','Just need a minute. Personal business.',
                           'Docked and bored out of my mind.'],
      parking:            ['Lining up. Give me space.','Coming in slow.','Watch your wing — parking.'],
    }[this.aiState];
    if(!opts) return null;
    return opts[Math.floor(Math.random()*opts.length)];
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

  // _steerTo inherited from G.ShipEntity. _thrust overridden below (adds grip).
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

  _brake(dt) {
    const spd=Math.hypot(this.vx,this.vy);
    if(spd<20) return;
    const decel=this.speed*0.5*dt;
    this.vx-=(this.vx/spd)*decel;
    this.vy-=(this.vy/spd)*decel;
  }

  _doStrafe(dir, dt) {
    const latX = Math.cos(this.angle) * dir;
    const latY = Math.sin(this.angle) * dir;
    this.vx += latX * this.speed * 0.4 * dt;
    this.vy += latY * this.speed * 0.4 * dt;
    const s = Math.hypot(this.vx, this.vy);
    if(s > this.speed * 1.5) { this.vx *= this.speed * 1.5 / s; this.vy *= this.speed * 1.5 / s; }
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

  _takeEmp() { this.empTimer = 4; this.shields = 0; return { shieldDmg: 0, hullDmg: 0 }; }

  // Returns array of comms options
  getCommsOptions() {
    const opts = [
      { key:'hail',    label:'Hail',           color:'#00ffee' },
      { key:'trade',   label:'Propose Trade',  color:'#ffcc00' },
      { key:'tribute', label:'Demand Tribute',  color:'#ff4444' },
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
    if(action==='tribute') {
      const successChance = this.faction==='independent'?0.65:this.faction==='pirate'?0.12:this.faction==='earth'?0.22:0.35;
      const success = Math.random() < successChance;
      const bank2 = G.COMMS_LINES[this.faction]||G.COMMS_LINES.independent;
      if(success) {
        const cargoVal = Object.entries(this.cargo).reduce((sum,[id,qty])=>sum+(G.ITEMS[id]?.base||50)*qty,0);
        res.tributeAmount = Math.max(80, Math.round(cargoVal*0.35 + 100 + Math.random()*200));
        const lines = bank2.tribute_accept||["Fine. Take it and go."];
        res.text = lines[Math.floor(Math.random()*lines.length)];
      } else {
        res.hostile = true;
        const lines = bank2.tribute_refuse||["You dare threaten me?! Open fire!"];
        res.text = lines[Math.floor(Math.random()*lines.length)];
      }
    }
    if(action==='forgive') {
      const cost    = G.npcForgivenessCost(this.faction);
      const success = Math.random() < G.npcForgivenessChance(this.faction);
      const lines   = bank[success ? 'forgive_accept' : 'forgive_deny'] || bank.hail;
      res.text = lines[Math.floor(Math.random()*lines.length)].replace('{cost}', G.fmtCredits(cost));
      res.forgiveResult = { success, cost };
    }
    res.text = (res.text || '').replace(/{name}/g, this.name || 'vessel');
    return res;
  }
};
G.NPCShip._uid = 0;

// ── Fleet Ship (player escort AI) ─────────────────────────
G.FleetShip = class extends G.ShipEntity {
  constructor(entry) {
    super();
    this.id = 'fs'+(++G.FleetShip._uid);
    this.type = 'fleet';
    this.isFleetShip = true;
    this.fleetDataId = entry.id;
    this.name = entry.fleetName || 'Fleet Ship';
    const tpl = G.SHIPS[entry.ship?.templateId];
    this.shipId  = entry.ship?.templateId || null;
    this.shapeId = tpl?.shape || 'shuttle';
    this.color = tpl?.color || '#8899bb';
    this.faction = tpl?.faction || 'neutral';
    this.size = tpl?.size || 1.0;

    const s = entry.ship;
    this.ship = s; // Store reference to ship object for module access
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
    // All weapons from ship template
    const fsTpl = G.SHIPS[entry.ship?.templateId];
    this.weaponIds = (fsTpl?.startWeapons || [this.weaponType]).filter(id => !!G.WEAPONS[id]);
    if(!this.weaponIds.length) this.weaponIds = [this.weaponType];

    // Unified module hull: positional damage + module-derived stats (hull/shields/
    // speed/turn), same as the player and enemies/NPCs. `this.ship` already holds
    // the real module loadout; derive from it (overrides entry.combat* scalars).
    this._damageVer = 0;
    this._fireRateMult = 1;
    this.size = tpl?.size || this.size || 1.0;
    if(this.ship) { this.ship.size = this.size; G.aiDeriveStats(this, false); }

    this.classId = G.CLASS_IDS[Math.floor(Math.random()*G.CLASS_IDS.length)];
    this.level = G.randInt(1, 20);

    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.angle = 0;
    this.lastShot = 0;

    this.dead = false;
    this.disabled = false;
    this._deathDone = false;
    this.jumpingOut = false;
    this.jumpOutTimer = 0;
    this._chargingJump = false;
    this._orbitOffset = Math.random() * Math.PI * 2;
    this._aiTimer = 0;
  }

  update(dt, player, target, projectiles, particles, now) {
    G.aiHaltIfNoEngines(this, dt);   // engines shot off -> coast to a halt
    if(this.jumpingOut) {
      this.jumpOutTimer -= dt;
      this.x += this.vx*dt; this.y += this.vy*dt;
      if(particles && Math.random() < 0.7) {
        const shape = G.SHAPES[this.shapeId];
        const enginePts = shape?.enginePts || [[0, 10]];
        const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
        for(const [ex, ey] of enginePts) {
          const wx = this.x + (ex * ca - ey * sa);
          const wy = this.y + (ex * sa + ey * ca);
          particles.engine_trail(wx, wy, this.angle, this.vx, this.vy, this.size||1);
        }
      }
      if(this.jumpOutTimer <= 0) this._deathDone = true;
      return;
    }

    if(this._released) {
      this._releasedTimer = (this._releasedTimer||0) + dt;
      // Fly away from player
      const dx = this.x - player.x, dy = this.y - player.y;
      const dist = Math.hypot(dx, dy) || 1;
      const awayAngle = Math.atan2(dx, -dy);
      this.angle += G.clamp(G.wrapAngle(awayAngle - this.angle) * 5, -this.turnSpeed, this.turnSpeed) * dt;
      this.vx += Math.sin(this.angle)*this.speed*dt*0.5;
      this.vy -= Math.cos(this.angle)*this.speed*dt*0.5;
      const s = Math.hypot(this.vx, this.vy);
      if(s > this.speed) { this.vx *= this.speed/s; this.vy *= this.speed/s; }
      this.x += this.vx*dt; this.y += this.vy*dt;
      // Despawn after 12s or when far away
      if(this._releasedTimer > 12 || dist > 2000) this._deathDone = true;
      return;
    }

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

      // Fire every live weapon module from its own hex cell. Destroyed weapon
      // modules drop out automatically.
      G.aiSyncHull(this);
      G.aiFireWeapons(this, aimAngle, attackTarget, now, projectiles, particles, { fireArc: 0.5 });
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

    // Engine trail with rainbow on attack
    const isAttacking = attackTarget != null;
    if(particles && Math.random() < 0.5) {
      const shape = G.SHAPES[this.shapeId];
      const enginePts = shape?.enginePts || [[0, 10]];
      const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
      for(const [ex, ey] of enginePts) {
        const wx = this.x + (ex * ca - ey * sa);
        const wy = this.y + (ex * sa + ey * ca);
        particles.engine_trail(wx, wy, this.angle, this.vx, this.vy, this.size||1, isAttacking);
      }
    }
    this.x += this.vx*dt; this.y += this.vy*dt;
  }

  // _steerTo / _thrust inherited from G.ShipEntity.

  _takeEmp() { return { shieldDmg: 0, hullDmg: 0 }; }   // fleet ignores EMP
};
G.FleetShip._uid = 0;
