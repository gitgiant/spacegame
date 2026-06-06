'use strict';
// ── Enemy AI ──────────────────────────────────────────────
G.EnemyAI = class {
  constructor(data) {
    Object.assign(this, data);
    this.type     = 'enemy';
    this.id       = 'e'+(++G.EnemyAI._uid);
    this.lastShot = 0;
    this.aiTimer  = 0;
    this.aiState  = data.aiState || 'patrol';
    this.patrolAngle = data.patrolAngle || 0;
    this.fleeTimer= 0;
    this.engageRange  = 700;
    this.fleeHpPct    = 0.18;
    this._fleeMade    = false;
    this._berserker   = false;
    this.projColor= data.color || '#ff4444';
    this.weaponType   = data.weaponType || 'laser';
    this.empStrength  = data.empStrength || 0;
    this.size     = data.size || 1.0;
    this.angle    = data.angle || 0;
    this._boosting = false;
    if (!this.captain) this.captain = { sex: Math.random() < 0.5 ? 'male' : 'female', faceIdx: Math.floor(Math.random() * 5) };
    this._lockT = 0;
    this._locked = false;
    this._lockBeepT = 0;
    this._lockedAlert = false;
  }

  update(dt, player, projectiles, particles, now) {
    if(this.disabled) {
      const drag = Math.max(0, 1 - 1.2 * dt);
      this.vx *= drag; this.vy *= drag;
      this.x += this.vx*dt;
      this.y += this.vy*dt;
      this.angle += 0.4 * dt;
      return;
    }
    if(this.boarded) return;

    // Frozen by Frost Nova — stop in place
    if(this._frozenTimer > 0) {
      this._frozenTimer -= dt;
      this.vx *= 0.85; this.vy *= 0.85;
      this.x += this.vx * dt; this.y += this.vy * dt;
      return;
    }

    // Fleet escort: keep patrol center on flagship
    if(this.fleetFlagshipId) {
      const flagship = G.game?.space?.enemies?.find(e=>e._fleetId===this.fleetFlagshipId);
      if(flagship && !flagship.dead && !flagship._deathDone) {
        this.patrolCenter = { x: flagship.x, y: flagship.y };
        if((flagship.aiState==='engage'||flagship._lastAttackerId) && this.aiState==='patrol') {
          this.aiState = 'engage';
        }
        if(flagship.disabled || flagship.dead) this.fleetFlagshipId = null;
      } else {
        this.fleetFlagshipId = null;
      }
    }

    this._boosting = (this.aiState === 'flee');
    this.aiTimer += dt;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distToPlayer = Math.sqrt(dx*dx+dy*dy);
    const angleToPlayer = Math.atan2(dx, -dy);

    // --- State machine ---
    if(this.aiState === 'patrol') {
      this.patrolAngle += dt * 0.3;
      const tx = this.patrolCenter.x + Math.cos(this.patrolAngle)*this.patrolDist;
      const ty = this.patrolCenter.y + Math.sin(this.patrolAngle)*this.patrolDist;
      this._steerTo(tx, ty, dt);
      this._thrust(dt);

      if(distToPlayer < this.engageRange) {
        this.aiState = 'engage';
      }
    } else if(this.aiState === 'engage') {
      // One-time flee-or-fight decision at low HP
      if(!this._fleeMade && this.hp / this.maxHp < this.fleeHpPct) {
        this._fleeMade = true;
        const cowardice = { pirate:0.30, earth:0.60, rebellion:0.45, alien:0.15 }[this.faction] ?? 0.50;
        if(Math.random() < cowardice) {
          this.aiState = 'flee';
          this.fleeTimer = 5 + Math.random() * 4;
          const fleeMsgs = {
            pirate:    ['Every man for himself!', "You got lucky — I'm out!", 'Not worth dying over!'],
            earth:     ['Tactical retreat! Reinforcements en route!', 'Falling back — abort mission!'],
            rebellion: ["Fall back! We'll meet again!", 'Retreat — regroup at the rally point!'],
            alien:     ['[DISTRESS SIGNAL]', '[RETREAT PATTERN DETECTED]'],
          };
          const lines = fleeMsgs[this.faction] || ['Retreating!'];
          const fleeMsg = lines[Math.floor(Math.random() * lines.length)];
          const distToPlayer = G.game?.player ? Math.hypot(this.x - G.game.player.x, this.y - G.game.player.y) : 9999;
          if (distToPlayer < 1500) {
            G.ui?.addMsg((this.name || (this.faction||'enemy').toUpperCase()+' SHIP')+': '+fleeMsg, '#ff8844');
          }
          return;
        }
        // Fight on — go berserker: close range, faster firing
        this._berserker = true;
        this.fireRate *= 1.6;
        if(this.weapons) { for(const wpn of this.weapons) wpn.fireRate *= 1.6; }
        this.fleeHpPct = 0;  // no more flee checks
      }

      // Movement: close in aggressively; orbit rather than back away
      const preferDist = this._berserker ? 140 : 260 + this.size * 30;
      if(distToPlayer > preferDist + 60) {
        this._steerTo(player.x, player.y, dt);
        this._thrust(dt);
      } else {
        // Orbit: strafe to a perpendicular point (never reverse)
        const side = Math.sin(this.aiTimer * 0.5) > 0 ? 1 : -1;
        const perpX = (-dy / distToPlayer) * preferDist;
        const perpY = ( dx / distToPlayer) * preferDist;
        this._steerTo(player.x + perpX * side, player.y + perpY * side, dt);
        this._thrust(dt);
      }

      // Missile lock-on: only if has missile weapon
      const hasMissileWeapon = this.weapons?.some(w=>w.type==='missile') || this.weaponType==='missile';
      if(hasMissileWeapon) {
        this._lockT ??= 0;
        this._locked ??= false;
        this._lockBeepT ??= 0;
        this._lockAlertT ??= 0;
        this._lockT = Math.min(this._lockT + dt, 3.0);
        if(this._lockT >= 3.0 && !this._locked) {
          this._locked = true;
        }
        if(this._locked) {
          this._lockAlertT -= dt;
          if(this._lockAlertT <= 0) {
            this._lockAlertT = 0.3;
            G.sound?.playerLockAlert?.();
          }
        } else {
          this._lockBeepT -= dt;
          if(this._lockBeepT <= 0) {
            const progress = this._lockT / 3.0;
            this._lockBeepT = 0.8 - progress * 0.65;
            G.sound?.playerLockBeep?.(progress);
          }
        }
      } else {
        this._lockT = 0;
        this._locked = false;
        this._lockBeepT = 0;
        this._lockAlertT = 0;
      }

      // Aim and fire
      const aimErr = this._berserker ? 0 : Math.sin(this.aiTimer*3)*0.22;
      const shootAngle = angleToPlayer + aimErr;
      const angleDiff = Math.abs(G.wrapAngle(this.angle - shootAngle));

      if(this.weapons && this.weapons.length > 0) {
        // Multi-weapon fire: each weapon fires on its own cooldown
        for(const wpn of this.weapons) {
          const isMissileWpn = wpn.type === 'missile';
          const inRange = distToPlayer < (wpn.range || this.engageRange);
          const offCooldown = now - (wpn.lastShot || 0) > 1 / wpn.fireRate;
          if(angleDiff < 0.6 && inRange && offCooldown && (!isMissileWpn || this._locked)) {
            wpn.lastShot = now;
            const spd = wpn.projSpeed || (wpn.type === 'laser' ? 850 : 600);
            projectiles.push({
              x: this.x+Math.sin(this.angle)*18,
              y: this.y-Math.cos(this.angle)*18,
              vx: Math.sin(shootAngle)*spd + this.vx*0.2,
              vy: -Math.cos(shootAngle)*spd + this.vy*0.2,
              damage: wpn.damage,
              type: wpn.type,
              splash: wpn.splash || 0,
              empStrength: wpn.empStrength || 0,
              range: wpn.range || 700, traveled: 0,
              ttl: (wpn.range || 700) / spd,
              color: wpn.color, width: wpn.width || 2,
              sourceId: this.id,
              tracking: isMissileWpn,
              trackTarget: isMissileWpn ? {x: player.x, y: player.y} : null,
            });
            if(particles) particles.emit({
              x: this.x+Math.sin(this.angle)*18, y: this.y-Math.cos(this.angle)*18,
              minSpd:20, maxSpd:60, life:0.15, r:2, color: wpn.color,
            });
            G.sound?.enemyWeapon(wpn.type, distToPlayer, G.clamp((this.x-player.x)/900,-1,1));
          }
        }
      } else {
        // Legacy single-weapon fire
        const canFire = angleDiff < 0.6 && distToPlayer < this.engageRange && now - this.lastShot > 1/this.fireRate;
        const isMissile = this.weaponType === 'missile';
        if(canFire && (!isMissile || this._locked)) {
          this.lastShot = now;
          const spd = this.weaponType==='laser' ? 850 : 600;
          projectiles.push({
            x: this.x+Math.sin(this.angle)*18,
            y: this.y-Math.cos(this.angle)*18,
            vx: Math.sin(shootAngle)*spd + this.vx*0.2,
            vy: -Math.cos(shootAngle)*spd + this.vy*0.2,
            damage:this.damage,
            type:this.weaponType,
            splash:this.weaponType==='explosion'?60:0,
            empStrength:this.empStrength,
            range:700, traveled:0,
            ttl:0.9,
            color:this.projColor, width:2,
            sourceId:this.id,
            tracking:this.weaponType==='missile',
            trackTarget:this.weaponType==='missile'?{x:player.x,y:player.y}:null,
          });
          if(particles) particles.emit({
            x:this.x+Math.sin(this.angle)*18, y:this.y-Math.cos(this.angle)*18,
            minSpd:20, maxSpd:60, life:0.15, r:2, color:this.projColor,
          });
          G.sound?.enemyWeapon(this.weaponType, distToPlayer, G.clamp((this.x-player.x)/900,-1,1));
        }
      }

    } else {
      // Reset lock when leaving engage state
      this._lockT = 0;
      this._locked = false;
      this._lockBeepT = 0;
      this._lockAlertT = 0;
    }

    // NPC ability usage — frost_nova when player is close and in engage state
    if(this.abilities?.length && this.aiState === 'engage' && particles) {
      this.abilityCooldowns = this.abilityCooldowns || {};
      for(const abilId of this.abilities) {
        const def = G.ABILITIES[abilId];
        if(!def?.npcUsable) continue;
        if((this.abilityCooldowns[abilId] || 0) > 0) { this.abilityCooldowns[abilId] -= dt; continue; }
        if(abilId === 'frost_nova' && distToPlayer < def.range * 1.1) {
          this.abilityCooldowns[abilId] = def.cooldown + Math.random() * 8;
          particles.frost_nova(this.x, this.y, def.range);
          G.sound?.abilityFrost?.();
          // Freeze player
          if(distToPlayer <= def.range) {
            player._frozen = true;
            player._frozenTimer = 2.0;
          }
        }
      }
    }
    if(this.abilities?.length) {
      this.abilityCooldowns = this.abilityCooldowns || {};
      for(const k in this.abilityCooldowns) if(this.abilityCooldowns[k] > 0) this.abilityCooldowns[k] -= dt;
    }

    if(this.aiState === 'flee') {
      this.fleeTimer -= dt;
      this._steerTo(this.x - dx*2, this.y - dy*2, dt);
      this._thrust(dt, true);

      if(this.fleeTimer <= 0 && this.hp > 0) {
        this._hyperEscape(particles);
      }
    }

    // Apply velocity to position
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  _hyperEscape(particles) {
    if(particles) {
      // Flash and streak effect
      for(let i = 0; i < 20; i++) {
        particles.emit({
          x: this.x, y: this.y,
          vx: Math.sin(this.angle)*300 + (Math.random()-0.5)*80,
          vy: -Math.cos(this.angle)*300 + (Math.random()-0.5)*80,
          life: 0.4, r: 1.5, color: '#aaddff', drag: 0.7, fade: true,
        });
      }
    }
    this._deathDone = true; // skip dying sequence — ship escaped
  }

  _steerTo(tx, ty, dt) {
    const dx = tx-this.x, dy = ty-this.y;
    if(Math.abs(dx)+Math.abs(dy) < 5) return;
    const target = Math.atan2(dx,-dy);
    const diff = G.wrapAngle(target-this.angle);
    const turn = G.clamp(diff*5, -this.turnSpeed, this.turnSpeed);
    this.angle += turn*dt;
  }

  _thrust(dt, boost=false) {
    const mult = boost ? 1.4 : 1.0;
    this.vx += Math.sin(this.angle)*this.speed*mult*dt*0.5;
    this.vy -= Math.cos(this.angle)*this.speed*mult*dt*0.5;
    const spd = Math.sqrt(this.vx*this.vx+this.vy*this.vy);
    if(spd > this.speed*mult) {
      this.vx *= (this.speed*mult)/spd;
      this.vy *= (this.speed*mult)/spd;
    }
  }

  takeDamage(amount, type) {
    if(type==='emp') {
      this.shields = Math.max(0, this.shields - amount*0.5);
      this.empTimer = 5;
      return;
    }
    if(this.disabled) {
      // Post-disable damage tracked separately; hull stays at 0
      this._postDisableDmg = (this._postDisableDmg || 0) + amount;
      if(this._postDisableDmg >= this.maxHp * 0.4) this.dead = true;
      return;
    }
    if(this.shields > 0) {
      const sd = Math.min(this.shields, amount);
      this.shields -= sd;
      amount -= sd;
      amount *= 0.2;
    }
    this.hp -= amount;
    if(this.hp <= 0) {
      this.hp = 0;
      this.disabled = true;
      this.aiState = 'disabled';
    }
  }
};
G.EnemyAI._uid = 0;
