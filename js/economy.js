'use strict';
// ── Economy: trading, missions, crafting ──────────────────
G.Economy = class {
  constructor() {
    this._missionCache = {}; // sysId -> [{...}]
    this._marketCache  = {}; // sysId -> [{...}]  persists per session so stock depletes
  }

  // Generate mission list for a spaceport
  getMissions(sysId, count=5) {
    // Faction missions bypass cache (refresh each visit)
    const cached = this._missionCache[sysId];
    if(cached) return cached;
    const sys = G.SYSTEMS.find(s=>s.id===sysId);
    if(!sys) return [];

    const missions = [];
    const types = G.MISSION_TYPES;
    const rng = G.seededRng(sysId+'_missions_'+Math.floor(Date.now()/300000));

    // Build weighted pool: normal missions + faction missions if spaceport matches
    const eligibleTypes = types.filter(t => {
      if(t.faction) return t.faction === sys.faction; // faction missions only at matching spaceports
      return true;
    });

    for(let i=0;i<count;i++) {
      const tpl = eligibleTypes[Math.floor(rng()*eligibleTypes.length)]||types[0];
      try {
        const params = tpl.genFn(sys, G.SYSTEMS);
        const destSys = G.SYSTEMS.find(s=>s.id===params.dest||s.id===params.target||s.id===params.via);
        const dist = destSys ? Math.sqrt((sys.pos[0]-destSys.pos[0])**2+(sys.pos[1]-destSys.pos[1])**2)/100 : 2;
        const reward = typeof tpl.reward==='function'
          ? tpl.reward(dist, params.qty||1)
          : tpl.reward;

        let desc = tpl.desc
          .replace('{qty}',  params.qty||'')
          .replace('{item}', params.item ? (G.ITEMS[params.item]?.name||params.item) : '')
          .replace('{dest}', destSys?.name||'Unknown')
          .replace('{target}', destSys?.name||'Unknown')
          .replace('{sys}',  destSys?.name||'Unknown');

        missions.push({
          id: 'm_'+sysId+'_'+i,
          type: tpl.type,
          title: tpl.name,
          desc,
          reward: Math.round(reward),
          repReward: tpl.repReward||5,
          repFaction: tpl.repFaction||sys.faction,
          params,
          faction: sys.faction,
          accepted: false,
          completed: false,
          failed: false,
          progress: 0,
        });
      } catch(e) {}
    }
    this._missionCache[sysId] = missions;
    return missions;
  }

  // Accept a mission
  acceptMission(mission, player) {
    if(mission.accepted) return false;
    mission.accepted = true;

    if(mission.type==='cargo_haul') {
      const item = mission.params.item;
      const qty  = mission.params.qty;
      if(player.cargoFreeSpace() < (G.ITEMS[item]?.mass||1)*qty) return false;
      player.addCargo(item, qty);
    }
    if(mission.type==='passenger') {
      const qty = mission.params.qty;
      if(player.cargoFreeSpace() < qty) return false;
      player.addCargo('mission_pkg', qty);
    }
    G.game.activeMissions.push(mission);
    return true;
  }

  // Check mission completion on landing
  checkMissions(sysId, player) {
    const completed = [];
    for(const m of G.game.activeMissions) {
      if(m.completed||m.failed) continue;

      if(m.type==='cargo_haul' && m.params.dest===sysId) {
        if(player.cargo[m.params.item] >= m.params.qty) {
          player.removeCargo(m.params.item, m.params.qty);
          m.completed = true;
          completed.push(m);
          G.game.credits += m.reward;
          G.game.setRel(m.faction, G.game.getRel(m.faction)+5);
        }
      }
      if(m.type==='passenger' && m.params.dest===sysId) {
        // Passengers are tracked as mission_pkg cargo
        const have = player.cargo['mission_pkg']||0;
        if(have >= m.params.qty) {
          player.removeCargo('mission_pkg', m.params.qty);
          m.completed=true; completed.push(m);
          G.game.credits+=m.reward;
          G.game.setRel(m.faction, G.game.getRel(m.faction)+8);
        }
      }
      if(m.type==='salvage' && m.params.dest===sysId) {
        m.progress = (m.progress||0)+1;
        if(m.progress>=1) {
          m.completed=true; completed.push(m);
          G.game.credits+=m.reward;
          G.game.setRel(m.faction, G.game.getRel(m.faction)+5);
        }
      }
      if(m.type==='bounty') { /* checked in checkBounty */ }
      // Faction prestige missions complete on visiting dest system
      if((m.type==='faction_earth'||m.type==='faction_rebellion'||m.type==='faction_pirate') && m.params.dest===sysId) {
        m.progress=(m.progress||0)+1;
        if(m.progress>=1) {
          m.completed=true; completed.push(m);
          G.game.credits+=m.reward;
          G.game.setRel(m.repFaction||m.faction, G.game.getRel(m.repFaction||m.faction)+(m.repReward||40));
        }
      }
    }
    return completed;
  }

  // Mark bounty done (called when enemy dies)
  checkBounty(enemyFaction, enemySystemId) {
    for(const m of G.game.activeMissions) {
      if(m.completed||m.failed||m.type!=='bounty') continue;
      const targetSys = G.SYSTEMS.find(s=>s.id===m.params.target);
      if(targetSys && targetSys.faction===enemyFaction) {
        m.progress = (m.progress||0)+1;
        if(m.progress>=1) {
          m.completed=true;
          G.game.credits+=m.reward;
          G.game.setRel(m.faction, G.game.getRel(m.faction)+8);
          G.ui.addMsg('Bounty complete! +'+G.fmtCredits(m.reward), '#ffcc00');
        }
      }
    }
  }

  // Get market items for a spaceport (cached — stock depletes when player buys)
  getMarket(sysId) {
    if(this._marketCache[sysId]) return this._marketCache[sysId];

    const sys = G.SYSTEMS.find(s=>s.id===sysId);
    if(!sys) return [];

    const rng = G.seededRng(sysId+'_market');
    const allItems = Object.values(G.ITEMS).filter(it=>it.cat!=='mission');

    const result = allItems.map(item => {
      const price = G.marketPrice(item.id, sysId);
      let available = Math.floor(rng()*18)+3;
      if(item.cat==='luxury'  && sys.danger<4)           available = Math.floor(rng()*4)+1;
      if(item.cat==='raw'     && sys.faction==='pirate')  available = Math.floor(rng()*15)+8;
      if(item.id==='alien_metal' && sys.faction!=='alien') available = Math.floor(rng()*2);
      if(item.cat==='craft'   && sys.danger>=5)           available = Math.floor(rng()*8)+2;
      if(item.cat==='ammo')                               available = Math.floor(rng()*10)+8;
      available = Math.max(0, available);
      return { id:item.id, name:item.name, cat:item.cat, rarity:item.rarity, price, available };
    });

    this._marketCache[sysId] = result;
    return result;
  }

  // Get ships for sale
  getShipyard(sysId) {
    const sys = G.SYSTEMS.find(s=>s.id===sysId);
    if(!sys) return [];
    const all = Object.values(G.SHIPS).filter(s => s.price >= 0 && s.class);
    return all.filter(s => {
      const sf = s.faction;
      if(!sf || sf === 'neutral' || sf === 'independent') return true;
      // Faction ships only available in matching or contested systems
      if(sf === sys.faction) return true;
      if(sys.faction === 'contested') return true;
      return false;
    });
  }

  // Get modules for sale
  getOutfitter(sysId) {
    const sys = G.SYSTEMS.find(s=>s.id===sysId);
    if(!sys) return [];
    const rng = G.seededRng(sysId+'_outfitter');
    return Object.values({...G.MODULES, ...G.WEAPONS}).filter(mod => {
      if(mod.rarity==='e'&&rng()<0.7) return false;
      if(mod.rarity==='l'&&rng()<0.9) return false;
      if(mod.rarity==='r'&&sys.danger<4&&rng()<0.5) return false;
      return true;
    });
  }

  // Get crew for hire
  getCrew(sysId) {
    const rng = G.seededRng(sysId+'_crew_'+Math.floor(Date.now()/600000));
    const roles = Object.values(G.CREW_ROLES);
    const count = 2+Math.floor(rng()*4);
    const crew = [];
    for(let i=0;i<count;i++) {
      const role = roles[Math.floor(rng()*roles.length)];
      const name = G.CREW_NAMES[Math.floor(rng()*G.CREW_NAMES.length)];
      const skill= 1+Math.floor(rng()*3);
      crew.push({
        id:'c'+(Math.random()*1e9|0),
        name, role:role.id, roleName:role.name,
        skill, hp:100, maxHp:100,
        wage: role.wage * skill,
        hireCost: role.wage * skill * 10,
        desc: role.desc,
      });
    }
    return crew;
  }

  // Craft an item
  craft(recipeId, player) {
    const recipe = G.RECIPES.find(r=>r.id===recipeId);
    if(!recipe) return {ok:false, msg:'Unknown recipe'};

    // Check module requirement
    if(recipe.reqModule && !player.canCraft) {
      return {ok:false, msg:'Requires workshop module'};
    }

    // Check ingredients
    for(const [itemId, qty] of Object.entries(recipe.inputs)) {
      if((player.cargo[itemId]||0) < qty) {
        return {ok:false, msg:'Not enough '+G.ITEMS[itemId]?.name};
      }
    }

    // Module recipes are handled by the UI directly
    if(recipe.outputModule) return {ok:false, msg:'Use craft tab for module crafting'};

    // Check cargo space for output
    const outItem = G.ITEMS[recipe.output.item];
    const outMass = (outItem?.mass||1) * recipe.output.qty;
    if(player.cargoFreeSpace() < outMass) {
      return {ok:false, msg:'Cargo full'};
    }

    // Consume inputs
    for(const [itemId, qty] of Object.entries(recipe.inputs)) {
      player.removeCargo(itemId, qty);
    }

    // Add output
    player.addCargo(recipe.output.item, recipe.output.qty);
    return {ok:true, msg:'Crafted '+recipe.output.qty+'x '+(outItem?.name||recipe.output.item)};
  }
};
