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
    if(this.active.length >= 600) return;
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

  shockwave(x, y) {
    this.active.push({ type:'ring', x, y, r:30, maxR:700,
      life:1.5, maxLife:1.5, color:'#aaddff', vx:0, vy:0, fade:true, expandRate:900 });
    this.active.push({ type:'ring', x, y, r:15, maxR:400,
      life:1.0, maxLife:1.0, color:'#ffffff', vx:0, vy:0, fade:true, expandRate:700 });
    for(let i=0;i<60;i++) {
      this.emit({ x, y,
        minSpd:200+Math.random()*600,
        maxSpd:400+Math.random()*600,
        life:0.4+Math.random()*0.8,
        r:1.5+Math.random()*2,
        color:i%3===0?'#ffffff':i%3===1?'#88ccff':'#4499ff',
        drag:0.91, fade:true,
      });
    }
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

  engine_trail(x, y, angle, vx, vy, scale=1, rainbow=false) {
    const exhaustDist = 14 * scale;
    const ex = x - Math.sin(angle) * exhaustDist;
    const ey = y + Math.cos(angle) * exhaustDist;
    const exhaustAngle = angle + Math.PI + G.rand(-0.25, 0.25);
    let color;
    if(rainbow) {
      const hue = (performance.now() * 0.18 + Math.random() * 30) % 360;
      color = Math.random() < 0.6
        ? `hsl(${hue|0},100%,65%)`
        : `hsl(${(hue+50)%360|0},100%,80%)`;
    } else {
      color = Math.random() < 0.6 ? '#ffaa22' : '#ff6622';
    }
    this.emit({
      x: ex, y: ey,
      vx: Math.sin(exhaustAngle) * G.rand(30,90) * scale,
      vy: -Math.cos(exhaustAngle) * G.rand(30,90) * scale,
      life: 0.12 + Math.random() * 0.1,
      r: (1.5 + Math.random() * 1.5) * scale,
      color,
      drag: 0.88,
      fade: true,
    });
  }

  boost_trail(x, y, angle, scale=1, superBoost=false) {
    const exhaustDist = 14 * scale;
    const ex = x - Math.sin(angle) * exhaustDist;
    const ey = y + Math.cos(angle) * exhaustDist;
    const exhaustAngle = angle + Math.PI + G.rand(-0.14, 0.14);
    const hue = (performance.now() * 0.18 + Math.random() * 30) % 360;
    const c1 = `hsl(${hue|0},100%,65%)`;
    const c2 = `hsl(${(hue+50)%360|0},100%,82%)`;
    this.emit({
      x: ex, y: ey,
      vx: Math.sin(exhaustAngle) * G.rand(60, 180) * scale,
      vy: -Math.cos(exhaustAngle) * G.rand(60, 180) * scale,
      life: 0.35 + Math.random() * 0.25,
      r: (2 + Math.random() * 2) * scale,
      color: Math.random() < 0.55 ? c1 : c2,
      drag: 0.91,
      fade: true,
      type: 'streak',
    });
    this.emit({
      x: ex, y: ey,
      vx: Math.sin(exhaustAngle) * G.rand(20, 60) * scale,
      vy: -Math.cos(exhaustAngle) * G.rand(20, 60) * scale,
      life: 0.18 + Math.random() * 0.12,
      r: (1 + Math.random()) * scale,
      color: '#ffffff',
      drag: 0.87,
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

  frost_nova(x, y, range) {
    const dur = 0.55;
    this.active.push({ type:'ring', x, y, r:20, maxR:range,
      life:dur, maxLife:dur, color:'#88ddff', vx:0, vy:0, fade:true, expandRate:range/dur });
    this.active.push({ type:'ring', x, y, r:10, maxR:range*0.6,
      life:0.38, maxLife:0.38, color:'#ccf0ff', vx:0, vy:0, fade:true, expandRate:range*0.6/0.35 });
    for(let i=0;i<48;i++) {
      const ang = (i/48)*Math.PI*2;
      this.emit({ x, y, angle:ang, spread:0.18,
        minSpd:60, maxSpd:range*0.7,
        life:0.5+Math.random()*0.35, r:1.5+Math.random()*2,
        color:Math.random()<0.5?'#88ddff':'#ccf0ff', drag:0.93, fade:true });
    }
  }

  healing_nova(x, y, range) {
    const dur = 0.65;
    this.active.push({ type:'ring', x, y, r:20, maxR:range,
      life:dur, maxLife:dur, color:'#44ff88', vx:0, vy:0, fade:true, expandRate:range/dur });
    for(let i=0;i<36;i++) {
      const ang = (i/36)*Math.PI*2;
      this.emit({ x, y, angle:ang, spread:0.15,
        minSpd:50, maxSpd:range*0.65,
        life:0.6+Math.random()*0.4, r:2+Math.random()*2,
        color:Math.random()<0.5?'#44ff88':'#88ffaa', drag:0.93, fade:true });
    }
  }

  chaff_burst(x, y, vx, vy) {
    for(let i=0;i<80;i++) {
      this.emit({ x, y, vx, vy,
        minSpd:30, maxSpd:200,
        life:1.2+Math.random()*1.5, r:1+Math.random()*2.5,
        color:Math.random()<0.5?'#ffcc44':'#aaaaaa', drag:0.97, fade:true });
    }
  }

  quantum_brake(x, y) {
    for(let i=0;i<50;i++) {
      this.emit({ x, y,
        minSpd:40, maxSpd:220,
        life:0.3+Math.random()*0.4, r:1.5+Math.random()*2.5,
        color:Math.random()<0.5?'#aa88ff':'#ffffff', drag:0.9, fade:true });
    }
    this.active.push({ type:'ring', x, y, r:8, maxR:90,
      life:0.3, maxLife:0.3, color:'#aa88ff', vx:0, vy:0, fade:true });
  }

  radar_pulse(x, y, range) {
    // Three concentric rings at slightly different speeds to simulate a propagating wavefront
    const dur = range / 700;
    this.active.push({ type:'ring', x, y, r:20, maxR:range,
      life:dur, maxLife:dur, color:'#33aaff', vx:0, vy:0, fade:true, expandRate:range/dur });
    this.active.push({ type:'ring', x, y, r:10, maxR:range*0.88,
      life:dur*0.88, maxLife:dur*0.88, color:'#66bbff', vx:0, vy:0, fade:true, expandRate:range*0.88/(dur*0.88) });
    this.active.push({ type:'ring', x, y, r:5, maxR:range*0.5,
      life:dur*0.5, maxLife:dur*0.5, color:'#aaddff', vx:0, vy:0, fade:true, expandRate:range*0.5/(dur*0.5) });
    for(let i=0;i<40;i++) {
      const ang = (i/40)*Math.PI*2;
      this.emit({ x, y, angle:ang, spread:0.1,
        minSpd:80, maxSpd:range*0.3,
        life:dur*0.5+Math.random()*dur*0.3, r:1+Math.random()*1.5,
        color:Math.random()<0.5?'#33aaff':'#88ccff', drag:0.97, fade:true });
    }
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
        if(p.expandRate) p.r = Math.min(p.maxR, p.r + p.expandRate * dt);
        else p.r = G.lerp(p.r, p.maxR, dt*6);
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
      if (p.type === 'streak') {
        // Elongated streak in velocity direction
        const spd = Math.sqrt(p.vx*p.vx + p.vy*p.vy) || 1;
        const len = Math.min(spd * 0.018, 14) + p.r * 2;
        const nx = p.vx / spd, ny = p.vy / spd;
        const grad = ctx.createLinearGradient(sx, sy, sx - nx*len, sy - ny*len);
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = p.r * 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - nx*len, sy - ny*len);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(sx, sy, p.r, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
};
