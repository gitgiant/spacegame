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
    this.fleeHpPct    = 0.15;
    this.projColor= data.color || '#ff4444';
    this.weaponType   = data.weaponType || 'laser';
    this.empStrength  = data.empStrength || 0;
    this.size     = data.size || 1.0;
    this.angle    = data.angle || 0;
  }

  update(dt, player, projectiles, particles, now) {
    if(this.disabled) {
      // Drift
      this.x += this.vx*dt;
      this.y += this.vy*dt;
      return;
    }
    if(this.boarded) return;

    this.aiTimer += dt;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distToPlayer = Math.sqrt(dx*dx+dy*dy);
    const angleToPlayer = Math.atan2(dx, -dy);

    // --- State machine ---
    if(this.aiState === 'patrol') {
      // Orbit patrol center
      this.patrolAngle += dt * 0.3;
      const tx = this.patrolCenter.x + Math.cos(this.patrolAngle)*this.patrolDist;
      const ty = this.patrolCenter.y + Math.sin(this.patrolAngle)*this.patrolDist;
      this._steerTo(tx, ty, dt);

      if(distToPlayer < this.engageRange) {
        this.aiState = 'engage';
      }
    } else if(this.aiState === 'engage') {
      // Flee if low HP
      if(this.hp/this.maxHp < this.fleeHpPct) {
        this.aiState = 'flee';
        this.fleeTimer = 8;
        return;
      }

      const preferDist = 300 + this.size*50;
      if(distToPlayer > preferDist+100) {
        // Approach
        this._steerTo(player.x, player.y, dt);
        this._thrust(dt);
      } else if(distToPlayer < preferDist-100) {
        // Back off
        this._steerTo(this.x - dx, this.y - dy, dt);
        this._thrust(dt);
      } else {
        // Strafe / circle
        const perpX = -dy/distToPlayer * 200;
        const perpY =  dx/distToPlayer * 200;
        const side = Math.sin(this.aiTimer*0.7) > 0 ? 1 : -1;
        this._steerTo(player.x + perpX*side, player.y + perpY*side, dt);
        this._thrust(dt);
      }

      // Aim and fire
      const aimErr = Math.sin(this.aiTimer*3)*0.3; // imprecision
      const shootAngle = angleToPlayer + aimErr;
      const angleDiff = Math.abs(G.wrapAngle(this.angle - shootAngle));

      if(angleDiff < 0.6 && distToPlayer < this.engageRange && now - this.lastShot > 1/this.fireRate) {
        this.lastShot = now;
        const spd = this.weaponType==='laser' ? 850 : 600;
        const projVx = Math.sin(shootAngle)*spd + this.vx*0.2;
        const projVy = -Math.cos(shootAngle)*spd + this.vy*0.2;
        projectiles.push({
          x: this.x+Math.sin(this.angle)*18,
          y: this.y-Math.cos(this.angle)*18,
          vx:projVx, vy:projVy,
          damage:this.damage,
          type:this.weaponType,
          splash:this.weaponType==='explosion'?60:0,
          empStrength:this.empStrength,
          range:600, traveled:0,
          ttl:0.8,
          color:this.projColor, width:2,
          sourceId:this.id,
          tracking:this.weaponType==='missile',
          trackTarget:this.weaponType==='missile'?{x:player.x,y:player.y}:null,
        });
        if(particles) particles.emit({
          x:this.x+Math.sin(this.angle)*18, y:this.y-Math.cos(this.angle)*18,
          minSpd:20, maxSpd:60, life:0.15, r:2, color:this.projColor,
        });
      }

      // Break off if player gets far
      if(distToPlayer > this.engageRange*1.8) {
        this.aiState = 'patrol';
      }
    } else if(this.aiState === 'flee') {
      this.fleeTimer -= dt;
      // Run away
      this._steerTo(this.x - dx*2, this.y - dy*2, dt);
      this._thrust(dt, true);
      if(this.fleeTimer <= 0 || distToPlayer > this.engageRange*2) {
        this.aiState = 'patrol';
      }
    }
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
      this.shields = Math.max(0, this.shields-amount*0.5);
      this.empTimer= 5;
      this.disabled= true;
      setTimeout(()=>{ if(!this.dead) this.disabled=false; }, 5000);
      return;
    }
    if(this.shields > 0) {
      const sd = Math.min(this.shields, amount);
      this.shields -= sd;
      amount -= sd;
      amount *= 0.2;
    }
    this.hp -= amount;
    if(this.hp <= 10 && !this.disabled) {
      this.disabled = true;
      this.hp = 10;
    }
    if(this.hp <= 0) this.dead = true;
  }
};
G.EnemyAI._uid = 0;
