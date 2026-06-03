'use strict';
// ── Particle system ───────────────────────────────────────
G.Particles = class {
  constructor() {
    this.pool = [];
    this.active = [];
  }

  _get() {
    return this.pool.pop() || {};
  }

  _release(p) {
    this.pool.push(p);
  }

  // Generic emitter
  emit(opts) {
    const p = this._get();
    p.x    = opts.x;
    p.y    = opts.y;
    const spd  = G.rand(opts.minSpd||0, opts.maxSpd||60);
    const ang  = opts.angle!=null ? opts.angle + G.rand(-opts.spread||0, opts.spread||0)
                                  : Math.random()*Math.PI*2;
    p.vx   = Math.sin(ang)*spd + (opts.vx||0);
    p.vy   = -Math.cos(ang)*spd + (opts.vy||0);
    p.life = opts.life || 1;
    p.maxLife = p.life;
    p.r    = opts.r || 2;
    p.color= opts.color || '#ffffff';
    p.fade = opts.fade!=null ? opts.fade : true;
    p.gravity = opts.gravity || 0;
    p.drag    = opts.drag || 0.98;
    p.type    = opts.type || 'dot';
    p.trail   = opts.trail || false;
    this.active.push(p);
  }

  burst(opts, count) {
    for(let i=0;i<count;i++) this.emit(opts);
  }

  explosion(x, y, vx, vy, scale=1) {
    const cnt = Math.floor(12*scale);
    for(let i=0;i<cnt;i++) {
      this.emit({ x,y,vx,vy,
        minSpd:30*scale, maxSpd:150*scale,
        life:0.4+Math.random()*0.5,
        r:2+Math.random()*3*scale,
        color:Math.random()<0.5?'#ffaa00':'#ff4400',
        drag:0.93, gravity:0,
      });
    }
    // Debris
    for(let i=0;i<Math.floor(6*scale);i++) {
      this.emit({ x,y,vx,vy,
        minSpd:20*scale, maxSpd:80*scale,
        life:0.8+Math.random()*0.8,
        r:1.5, color:'#888866',
        drag:0.97,
      });
    }
    // Flash ring (stored as a special entry)
    this.active.push({
      type:'ring', x, y,
      r:4, maxR:60*scale,
      life:0.25, maxLife:0.25,
      color:'#ffeecc',
      vx:0, vy:0, fade:true,
    });
  }

  shield_hit(x, y, r) {
    for(let i=0;i<8;i++) {
      this.emit({ x,y,
        minSpd:20, maxSpd:80,
        life:0.3+Math.random()*0.3,
        r:2, color:'#4488ff', drag:0.92,
      });
    }
    this.active.push({ type:'ring', x, y, r:r||20, maxR:r*1.5||40,
      life:0.2, maxLife:0.2, color:'#4488ff', vx:0, vy:0, fade:true });
  }

  emp_hit(x, y) {
    for(let i=0;i<16;i++) {
      this.emit({ x,y,
        minSpd:40, maxSpd:200,
        life:0.5+Math.random()*0.4,
        r:2, color:Math.random()<0.5?'#aa44ff':'#4400ff', drag:0.94,
      });
    }
    this.active.push({ type:'ring', x, y, r:10, maxR:120,
      life:0.4, maxLife:0.4, color:'#aa44ff', vx:0, vy:0, fade:true });
  }

  engine_trail(x, y, angle, vx, vy, scale=1) {
    // Emit at exhaust point behind the ship
    const exhaustDist = 14 * scale;
    const ex = x - Math.sin(angle) * exhaustDist;
    const ey = y + Math.cos(angle) * exhaustDist;
    // Particles move backward relative to ship direction (no ship velocity inheritance)
    const exhaustAngle = angle + Math.PI + G.rand(-0.25, 0.25);
    this.emit({
      x: ex, y: ey,
      vx: Math.sin(exhaustAngle) * G.rand(30,90) * scale,
      vy: -Math.cos(exhaustAngle) * G.rand(30,90) * scale,
      life: 0.12 + Math.random() * 0.1,
      r: (1.5 + Math.random() * 1.5) * scale,
      color: Math.random() < 0.6 ? '#ffaa22' : '#ff6622',
      drag: 0.88,
      fade: true,
    });
  }

  mine_spark(x, y) {
    this.burst({ x,y,
      minSpd:20, maxSpd:80,
      life:0.2+Math.random()*0.3,
      r:2, color:'#ffcc44', drag:0.9,
    }, 4);
  }

  warp_effect(x, y) {
    for(let i=0;i<30;i++) {
      const ang = (i/30)*Math.PI*2;
      this.emit({ x,y,
        angle:ang, spread:0.1,
        minSpd:100, maxSpd:300,
        life:0.4+Math.random()*0.3,
        r:2, color:'#00ccff', drag:0.95,
      });
    }
  }

  update(dt) {
    for(let i=this.active.length-1;i>=0;i--) {
      const p = this.active[i];
      p.life -= dt;
      if(p.life <= 0) {
        this.active.splice(i,1);
        this._release(p);
        continue;
      }
      if(p.type==='ring') {
        p.r = G.lerp(p.r, p.maxR, dt*6);
        continue;
      }
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.vy += p.gravity*dt;
      p.x  += p.vx*dt;
      p.y  += p.vy*dt;
    }
  }

  draw(ctx, camX, camY) {
    for(const p of this.active) {
      const sx = p.x - camX;
      const sy = p.y - camY;
      const alpha = p.fade ? Math.max(0, p.life/p.maxLife) : 1;

      if(p.type==='ring') {
        ctx.save();
        ctx.globalAlpha = alpha*0.8;
        ctx.beginPath();
        ctx.arc(sx, sy, p.r, 0, Math.PI*2);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
        continue;
      }

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sx, sy, p.r, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  }
};
