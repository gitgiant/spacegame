'use strict';
// ── Procedural Sound Engine (Web Audio API) ───────────────
G.SoundEngine = class {
  constructor() {
    this._ac = null;
    this._master = null;

    // Thrust noise nodes
    this._engGain   = null;
    this._engSrc    = null;
    this._engFilter = null;
    this._engReady  = false;

    // Jump charge oscillator (held until jump fires or cancelled)
    this._jumpOsc  = null;
    this._jumpGain = null;

    // Debounce timers (audio context time)
    this._alertAt   = -99;
    this._hullHitAt = -99;
    this._shldHitAt = -99;

    this.enabled = true;
    this.volume  = 0.45;

    // Resume AudioContext on any user interaction
    const tryResume = () => {
      if (this._ac?.state === 'suspended') this._ac.resume();
    };
    document.addEventListener('keydown',     tryResume);
    document.addEventListener('pointerdown', tryResume);
  }

  // ── Context bootstrap (lazy, requires user gesture) ─────
  _ctx() {
    if (!this._ac) {
      this._ac     = new (window.AudioContext || window.webkitAudioContext)();
      this._master = this._ac.createGain();
      this._master.gain.value = this.volume;
      this._master.connect(this._ac.destination);
      this._startEngine();
    }
    return this._ac;
  }

  // ── Thrust white noise ───────────────────────────────────
  _startEngine() {
    const ac  = this._ac;
    const now = ac.currentTime;

    // Looping white noise buffer (2s)
    const len = ac.sampleRate * 2;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this._engSrc = ac.createBufferSource();
    this._engSrc.buffer = buf;
    this._engSrc.loop = true;

    this._engFilter = ac.createBiquadFilter();
    this._engFilter.type = 'bandpass';
    this._engFilter.frequency.value = 400;
    this._engFilter.Q.value = 0.8;

    this._engGain = ac.createGain();
    this._engGain.gain.value = 0;

    this._engSrc.connect(this._engFilter);
    this._engFilter.connect(this._engGain);
    this._engGain.connect(this._master);
    this._engSrc.start(now);
    this._engReady = true;
  }

  // Called every frame — speed in world-units/s
  updateEngine(speed, thrusting) {
    if (!this.enabled || !this._ac || !this._engReady) return;
    const now = this._ac.currentTime;
    const targetGain = thrusting ? 0.28 : 0;
    this._engGain.gain.setTargetAtTime(targetGain, now, 0.08);
  }

  // ── Weapon fire ──────────────────────────────────────────
  weapon(type) {
    if (!this.enabled) return;
    const ac  = this._ctx();
    const now = ac.currentTime;
    const out = this._master;

    if (type === 'laser') {
      const osc = ac.createOscillator();
      osc.type  = 'sawtooth';
      osc.frequency.setValueAtTime(850, now);
      osc.frequency.exponentialRampToValueAtTime(210, now + 0.11);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.13, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.connect(g); g.connect(out);
      osc.start(now); osc.stop(now + 0.12);

    } else if (type === 'cannon' || type === 'plasma') {
      const src = ac.createBufferSource();
      src.buffer = this._noise(0.14);
      const flt = ac.createBiquadFilter();
      flt.type = 'bandpass'; flt.frequency.value = 280; flt.Q.value = 0.7;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.32, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      src.connect(flt); flt.connect(g); g.connect(out);
      src.start(now); src.stop(now + 0.15);

    } else if (type === 'missile') {
      const osc = ac.createOscillator();
      osc.type  = 'sawtooth';
      osc.frequency.setValueAtTime(90, now);
      osc.frequency.exponentialRampToValueAtTime(550, now + 0.28);
      const flt = ac.createBiquadFilter();
      flt.type = 'bandpass'; flt.frequency.value = 500;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.18, now);
      g.gain.setValueAtTime(0.18, now + 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(flt); flt.connect(g); g.connect(out);
      osc.start(now); osc.stop(now + 0.29);

    } else if (type === 'emp') {
      const osc1 = ac.createOscillator();
      osc1.type  = 'square';
      osc1.frequency.setValueAtTime(420, now);
      osc1.frequency.exponentialRampToValueAtTime(50, now + 0.45);
      const osc2 = ac.createOscillator();
      osc2.type  = 'sine';
      osc2.frequency.value = 60;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.18, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc1.connect(g); osc2.connect(g); g.connect(out);
      osc1.start(now); osc1.stop(now + 0.46);
      osc2.start(now); osc2.stop(now + 0.46);

    } else {
      // Generic fallback: short pop
      const osc = ac.createOscillator();
      osc.type  = 'square';
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.09);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.12, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(g); g.connect(out);
      osc.start(now); osc.stop(now + 0.10);
    }
  }

  // ── Landing / launch ─────────────────────────────────────
  land() {
    if (!this.enabled) return;
    const ac  = this._ctx();
    const now = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = this._noise(2.8);
    const flt = ac.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(4000, now);
    flt.frequency.exponentialRampToValueAtTime(80, now + 2.8);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.38, now);
    g.gain.setValueAtTime(0.38, now + 1.6);
    g.gain.exponentialRampToValueAtTime(0.001, now + 2.8);
    src.connect(flt); flt.connect(g); g.connect(this._master);
    src.start(now); src.stop(now + 2.81);
  }

  launch() {
    if (!this.enabled) return;
    const ac  = this._ctx();
    const now = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = this._noise(1.4);
    const flt = ac.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(80, now);
    flt.frequency.exponentialRampToValueAtTime(4000, now + 1.4);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.38, now + 0.1);
    g.gain.setValueAtTime(0.38, now + 0.9);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
    src.connect(flt); flt.connect(g); g.connect(this._master);
    src.start(now); src.stop(now + 1.41);
  }

  // ── Hyperspace / jump charge ─────────────────────────────
  // frac 0..1 — called each frame while charging
  jumpCharge(frac) {
    if (!this.enabled) return;
    const ac  = this._ctx();
    const now = ac.currentTime;
    if (!this._jumpOsc) {
      this._jumpOsc  = ac.createOscillator();
      this._jumpOsc.type = 'sine';
      this._jumpOsc.frequency.value = 100;
      this._jumpGain = ac.createGain();
      this._jumpGain.gain.value = 0;
      this._jumpOsc.connect(this._jumpGain);
      this._jumpGain.connect(this._master);
      this._jumpOsc.start(now);
    }
    this._jumpOsc.frequency.setTargetAtTime(100 + frac * 950, now, 0.08);
    this._jumpGain.gain.setTargetAtTime(0.04 + frac * 0.18,   now, 0.08);
  }

  stopJumpCharge() {
    if (!this._jumpOsc || !this._ac) return;
    const now = this._ac.currentTime;
    this._jumpGain.gain.setTargetAtTime(0, now, 0.08);
    const osc = this._jumpOsc;
    this._jumpOsc  = null;
    this._jumpGain = null;
    setTimeout(() => { try { osc.stop(); } catch (_) {} }, 250);
  }

  hyperspace() {
    if (!this.enabled) return;
    this.stopJumpCharge();
    const ac  = this._ctx();
    const now = ac.currentTime;

    // Frequency sweep down
    const osc = ac.createOscillator();
    osc.type  = 'sawtooth';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.75);

    // Noise flash
    const src = ac.createBufferSource();
    src.buffer = this._noise(0.75);
    const nflt = ac.createBiquadFilter();
    nflt.type = 'bandpass';
    nflt.frequency.setValueAtTime(2200, now);
    nflt.frequency.exponentialRampToValueAtTime(80,  now + 0.75);
    nflt.Q.value = 0.5;

    const g  = ac.createGain();
    const ng = ac.createGain();
    g.gain.setValueAtTime(0.35, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
    ng.gain.setValueAtTime(0.28, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

    osc.connect(g);            g.connect(this._master);
    src.connect(nflt); nflt.connect(ng); ng.connect(this._master);
    osc.start(now); osc.stop(now + 0.76);
    src.start(now); src.stop(now + 0.76);
  }

  hyperspaceArrival() {
    if (!this.enabled) return;
    const ac  = this._ctx();
    const now = ac.currentTime;

    // Initial broadband crash — full white noise, fast attack, slow tail
    const crash = ac.createBufferSource();
    crash.buffer = this._noise(1.8);
    const crashFlt = ac.createBiquadFilter();
    crashFlt.type = 'lowpass';
    crashFlt.frequency.setValueAtTime(8000, now);
    crashFlt.frequency.exponentialRampToValueAtTime(200, now + 1.8);
    const crashG = ac.createGain();
    crashG.gain.setValueAtTime(0.7,  now);
    crashG.gain.setValueAtTime(0.55, now + 0.04);
    crashG.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
    crash.connect(crashFlt); crashFlt.connect(crashG); crashG.connect(this._master);
    crash.start(now); crash.stop(now + 1.81);

    // High-freq impact crack on top (very short, sharp)
    const crack = ac.createBufferSource();
    crack.buffer = this._noise(0.06);
    const crackFlt = ac.createBiquadFilter();
    crackFlt.type = 'highpass';
    crackFlt.frequency.value = 4000;
    const crackG = ac.createGain();
    crackG.gain.setValueAtTime(0.5, now);
    crackG.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    crack.connect(crackFlt); crackFlt.connect(crackG); crackG.connect(this._master);
    crack.start(now); crack.stop(now + 0.07);
  }

  // ── Combat / damage ──────────────────────────────────────
  explosion() {
    if (!this.enabled) return;
    const ac  = this._ctx();
    const now = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = this._noise(1.4);
    const flt = ac.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(3200, now);
    flt.frequency.exponentialRampToValueAtTime(90, now + 1.4);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.55, now);
    g.gain.setValueAtTime(0.45, now + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
    src.connect(flt); flt.connect(g); g.connect(this._master);
    src.start(now); src.stop(now + 1.41);
  }

  hullHit() {
    if (!this.enabled || !this._ac) return;
    const now = this._ac.currentTime;
    if (now - this._hullHitAt < 0.18) return;
    this._hullHitAt = now;
    const ac  = this._ctx();
    const src = ac.createBufferSource();
    src.buffer = this._noise(0.12);
    const flt = ac.createBiquadFilter();
    flt.type = 'lowpass'; flt.frequency.value = 380;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    src.connect(flt); flt.connect(g); g.connect(this._master);
    src.start(now); src.stop(now + 0.13);
  }

  shieldHit() {
    if (!this.enabled || !this._ac) return;
    const now = this._ac.currentTime;
    if (now - this._shldHitAt < 0.12) return;
    this._shldHitAt = now;
    const ac  = this._ctx();
    const osc = ac.createOscillator();
    osc.type  = 'sine';
    osc.frequency.setValueAtTime(1500, now);
    osc.frequency.exponentialRampToValueAtTime(650, now + 0.14);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(g); g.connect(this._master);
    osc.start(now); osc.stop(now + 0.15);
  }

  // ── Target lock ──────────────────────────────────────────
  targetLock() {
    if (!this.enabled) return;
    const ac  = this._ctx();
    const now = ac.currentTime;
    // Two quick ascending sine pings
    [{ f: 880, t: 0 }, { f: 1320, t: 0.09 }].forEach(({ f, t }) => {
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.10, now + t);
      g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.12);
      osc.connect(g); g.connect(this._master);
      osc.start(now + t); osc.stop(now + t + 0.13);
    });
  }

  // ── Galaxy map ───────────────────────────────────────────
  mapOpen() {
    if (!this.enabled) return;
    const ac  = this._ctx();
    const now = ac.currentTime;
    // Low whomp: sine sweep down, with a mid shimmer on top
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.35);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(g); g.connect(this._master);
    osc.start(now); osc.stop(now + 0.36);
  }

  mapNodeSelect() {
    if (!this.enabled) return;
    const ac  = this._ctx();
    const now = ac.currentTime;
    // Soft click: very short sine transient
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1100, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.08);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.09, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(g); g.connect(this._master);
    osc.start(now); osc.stop(now + 0.09);
  }

  // ── Forgiveness ──────────────────────────────────────────
  forgiveness(success) {
    if (!this.enabled) return;
    const ac  = this._ctx();
    const now = ac.currentTime;
    if (success) {
      // Three rising tones — resolution chord
      [330, 415, 523].forEach((f, i) => {
        const osc = ac.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f;
        const g = ac.createGain();
        const t0 = now + i * 0.1;
        g.gain.setValueAtTime(0.12, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
        osc.connect(g); g.connect(this._master);
        osc.start(t0); osc.stop(t0 + 0.51);
      });
    } else {
      // Two descending buzzes — rejection
      [280, 220].forEach((f, i) => {
        const osc = ac.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(f, now + i * 0.18);
        osc.frequency.exponentialRampToValueAtTime(f * 0.6, now + i * 0.18 + 0.15);
        const g = ac.createGain();
        g.gain.setValueAtTime(0.14, now + i * 0.18);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.15);
        osc.connect(g); g.connect(this._master);
        osc.start(now + i * 0.18); osc.stop(now + i * 0.18 + 0.16);
      });
    }
  }

  // ── Alert / comms / UI ───────────────────────────────────
  hostileAlert() {
    if (!this.enabled) return;
    const ac  = this._ctx();
    const now = ac.currentTime;
    if (now - this._alertAt < 8.0) return; // max once per 8s
    this._alertAt = now;

    // Soft-clip waveshaper for klaxon distortion
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i * 2) / 255 - 1;
      curve[i] = (Math.PI + 80) * x / (Math.PI + 80 * Math.abs(x));
    }

    // Three "WHOOP" sweeps
    for (let rep = 0; rep < 3; rep++) {
      const t0 = now + rep * 0.55;

      // Sawtooth klaxon: sweeps 360Hz → 760Hz → 360Hz
      const osc = ac.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(360, t0);
      osc.frequency.linearRampToValueAtTime(760, t0 + 0.24);
      osc.frequency.linearRampToValueAtTime(360, t0 + 0.46);

      const shaper = ac.createWaveShaper();
      shaper.curve = curve;
      shaper.oversample = '2x';

      // Sub-bass punch underneath
      const sub = ac.createOscillator();
      sub.type = 'sine';
      sub.frequency.value = 58;
      const subG = ac.createGain();
      subG.gain.value = 0.28;

      // Bandpass to shape the klaxon timbre
      const flt = ac.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.value = 580;
      flt.Q.value = 1.4;

      const g = ac.createGain();
      g.gain.setValueAtTime(0,    t0);
      g.gain.linearRampToValueAtTime(0.40, t0 + 0.03);
      g.gain.setValueAtTime(0.40, t0 + 0.44);
      g.gain.linearRampToValueAtTime(0,    t0 + 0.50);

      osc.connect(shaper); shaper.connect(flt);
      sub.connect(subG);   subG.connect(flt);
      flt.connect(g);      g.connect(this._master);

      osc.start(t0); osc.stop(t0 + 0.51);
      sub.start(t0); sub.stop(t0 + 0.51);
    }
  }

  commsPing() {
    if (!this.enabled) return;
    const ac  = this._ctx();
    const now = ac.currentTime;
    [{ f: 880, t: 0 }, { f: 1100, t: 0.16 }].forEach(({ f, t }) => {
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.13, now + t);
      g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.22);
      osc.connect(g); g.connect(this._master);
      osc.start(now + t); osc.stop(now + t + 0.23);
    });
  }

  menuClick() {
    if (!this.enabled) return;
    const ac  = this._ctx();
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type  = 'sine';
    osc.frequency.value = 620;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.09, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(g); g.connect(this._master);
    osc.start(now); osc.stop(now + 0.08);
  }

  menuHover() {
    if (!this.enabled) return;
    const ac  = this._ctx();
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type  = 'sine';
    osc.frequency.value = 440;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.035, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(g); g.connect(this._master);
    osc.start(now); osc.stop(now + 0.05);
  }

  // ── Volume control ───────────────────────────────────────
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this._master) {
      this._master.gain.setTargetAtTime(this.volume, this._ac.currentTime, 0.05);
    }
  }

  // ── White noise buffer helper ────────────────────────────
  _noise(duration) {
    const ac  = this._ac;
    const len = Math.ceil(ac.sampleRate * duration);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
};
