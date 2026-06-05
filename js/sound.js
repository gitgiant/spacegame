'use strict';
// ── Procedural Sound Engine (Web Audio API) ───────────────
G.SoundEngine = class {
  // Declare external sound files here: { name: 'sounds/file.wav' }
  static SOUND_FILES = {
    red_alert: 'sounds/red_alert.wav',
    explosion:  'sounds/explosion.wav',
    laser:      'sounds/laser.wav',
    airhorn:    'sounds/airhorn.wav',
  };

  constructor() {
    this._ac = null;
    this._master = null;
    this._buffers = {}; // decoded AudioBuffers keyed by name

    // Thrust noise nodes
    this._engGain   = null;
    this._engSrc    = null;
    this._engFilter = null;
    this._engReady  = false;

    // Boost hiss nodes
    this._boostHissGain  = null;
    this._boostHissReady = false;

    // Jump charge oscillator (held until jump fires or cancelled)
    this._jumpOsc  = null;
    this._jumpGain = null;

    // Debounce timers (audio context time)
    this._alertAt   = -99;
    this._hullHitAt = -99;
    this._shldHitAt = -99;
    this._wpnHitAt  = -99;

    this.enabled = true;
    this.volume  = 0.45;

    // ── Adaptive music engine ──────────────────────────────
    // Vertical layering (per-stem gains crossfaded by intensity) +
    // horizontal rescoring (distinct chord/pattern sets per mode,
    // committed only on measure boundaries).
    this.musicEnabled = true;
    this.musicVolume  = 0.30;
    this._musicGain   = null;   // final volume (options-controlled)
    this._musicFilter = null;   // lowpass for "next door" muffle
    this._musicMuffle = null;   // gentle gain duck while muffled
    this._musicBus    = null;   // sums all layers
    this._mLayers     = {};     // name -> GainNode (vertical mix)
    this._mTimer      = null;   // lookahead scheduler handle

    // Musical grid
    this._mTempo      = 90;     // BPM (constant — keeps layers phase-locked)
    this._mBeatDur    = 60 / this._mTempo;
    this._mBeatsBar   = 4;
    this._mBarsPhrase = 4;
    this._mNextBeatT  = 0;      // ac time of next beat to schedule
    this._mBeat       = 0;      // running beat index within phrase

    // Intensity / mode state
    this._mIntensity       = 0; // smoothed 0..1
    this._mIntensityTarget = 0;
    this._mMode            = 'explore';
    this._mMuffled         = false;
    this._mLastTick        = 0;

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
      this._zoomNode = this._ac.createGain();
      this._zoomNode.gain.value = 1.0;
      this._zoomNode.connect(this._ac.destination);
      this._uiOut = this._ac.createGain();
      this._uiOut.gain.value = this.volume;
      this._uiOut.connect(this._ac.destination);
      this._buildSfxReverbGraph();
      this._buildMusicGraph();
      this._startEngine();
      if (this.musicEnabled) this._musicStart();
      this._loadSoundFiles();
    }
    return this._ac;
  }

  async _loadSoundFiles() {
    const files = G.SoundEngine.SOUND_FILES;
    for (const [name, url] of Object.entries(files)) {
      try {
        const resp = await fetch(url);
        const arrayBuf = await resp.arrayBuffer();
        this._buffers[name] = await this._ac.decodeAudioData(arrayBuf);
      } catch(e) {
        console.warn(`SoundEngine: failed to load "${name}" from ${url}`, e);
      }
    }
  }

  _buildSfxReverbGraph() {
    const ac = this._ac;
    // Low-pass filter — sweeps down when disabled
    this._sfxFilter = ac.createBiquadFilter();
    this._sfxFilter.type = 'lowpass';
    this._sfxFilter.frequency.value = 20000;
    this._sfxFilter.Q.value = 0.5;

    // Convolver for reverb wet signal
    const revSr  = ac.sampleRate;
    const revLen = revSr * 2.8;
    const revBuf = ac.createBuffer(2, revLen, revSr);
    for (let ch = 0; ch < 2; ch++) {
      const d = revBuf.getChannelData(ch);
      for (let i = 0; i < revLen; i++)
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / revLen, 1.6);
    }
    this._sfxConv = ac.createConvolver();
    this._sfxConv.buffer = revBuf;

    this._sfxWetGain = ac.createGain();
    this._sfxWetGain.gain.value = 0;

    // master → filter → zoomNode (dry path)
    this._master.connect(this._sfxFilter);
    this._sfxFilter.connect(this._zoomNode);
    // master → filter → conv → wetGain → zoomNode (wet reverb path)
    this._sfxFilter.connect(this._sfxConv);
    this._sfxConv.connect(this._sfxWetGain);
    this._sfxWetGain.connect(this._zoomNode);
  }

  // Called each frame from main.js game loop
  updatePlayerState(hpFrac, disabled) {
    if (!this._sfxFilter || !this._sfxWetGain || !this._ac) return;
    const now = this._ac.currentTime;
    if (disabled) {
      this._sfxWetGain.gain.setTargetAtTime(0.9, now, 0.4);
      this._sfxFilter.frequency.setTargetAtTime(480, now, 0.8);
    } else if (hpFrac < 0.3) {
      const wet = (0.3 - hpFrac) / 0.3 * 0.45; // 0 → 0.45 as hp drops 30%→0
      this._sfxWetGain.gain.setTargetAtTime(wet, now, 0.3);
      this._sfxFilter.frequency.setTargetAtTime(20000, now, 0.2);
    } else {
      this._sfxWetGain.gain.setTargetAtTime(0, now, 0.5);
      this._sfxFilter.frequency.setTargetAtTime(20000, now, 0.3);
    }
  }

  // Called every frame with the current camZoom value
  setZoomFactor(zoom) {
    if (!this._zoomNode) return;
    // At zoom 1.0 = full volume; zoom out → quieter, zoom in → slightly louder
    const factor = G.clamp(Math.pow(zoom, 1.5), 0.08, 1.2);
    this._zoomNode.gain.setTargetAtTime(factor, this._ac.currentTime, 0.12);
  }

  // ── Music signal graph ───────────────────────────────────
  // layers -> bus -> lowpass(muffle) -> muffleGain -> volume -> out
  _buildMusicGraph() {
    const ac = this._ac;
    this._musicGain = ac.createGain();
    this._musicGain.gain.value = this.musicEnabled ? this.musicVolume : 0;
    this._musicGain.connect(ac.destination);

    this._musicMuffle = ac.createGain();
    this._musicMuffle.gain.value = 1;
    this._musicMuffle.connect(this._musicGain);

    this._musicFilter = ac.createBiquadFilter();
    this._musicFilter.type = 'lowpass';
    this._musicFilter.frequency.value = 18000;
    this._musicFilter.Q.value = 0.4;
    this._musicFilter.connect(this._musicMuffle);

    this._musicBus = ac.createGain();
    this._musicBus.gain.value = 1;
    this._musicBus.connect(this._musicFilter);

    // Per-stem vertical-mix gains, all start silent
    this._mLayers = {};
    for (const name of ['pad', 'sub', 'arp', 'drums', 'lead']) {
      const g = ac.createGain();
      g.gain.value = name === 'pad' ? 0.0001 : 0;
      g.connect(this._musicBus);
      this._mLayers[name] = g;
    }
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

    // Boost hiss: looping high-pass noise, silent until boost is active
    const hissLen = ac.sampleRate * 2;
    const hissBuf = ac.createBuffer(1, hissLen, ac.sampleRate);
    const hd = hissBuf.getChannelData(0);
    for (let i = 0; i < hissLen; i++) hd[i] = Math.random() * 2 - 1;
    const hissSrc = ac.createBufferSource();
    hissSrc.buffer = hissBuf;
    hissSrc.loop = true;
    const hissFlt = ac.createBiquadFilter();
    hissFlt.type = 'highpass';
    hissFlt.frequency.value = 3400;
    hissFlt.Q.value = 0.4;
    this._boostHissGain = ac.createGain();
    this._boostHissGain.gain.value = 0;
    hissSrc.connect(hissFlt);
    hissFlt.connect(this._boostHissGain);
    this._boostHissGain.connect(this._master);
    hissSrc.start(now);
    this._boostHissReady = true;
  }

  // Called every frame — speed in world-units/s
  updateEngine(speed, thrusting) {
    if (!this.enabled || !this._ac || !this._engReady) return;
    const now = this._ac.currentTime;
    const targetGain = thrusting ? 0.22 : 0;
    this._engGain.gain.setTargetAtTime(targetGain, now, 0.08);
  }

  // Called every frame — fades hiss in/out while boost is active
  updateBoost(isActive) {
    if (!this.enabled || !this._ac || !this._boostHissReady) return;
    const now = this._ac.currentTime;
    this._boostHissGain.gain.setTargetAtTime(isActive ? 0.07 : 0, now, 0.05);
  }

  // ── Spatial attenuation helper ───────────────────────────
  // Returns an output node attenuated by distance. Returns null when too far.
  _spatialOut(dist, maxDist = 1800) {
    const ac = this._ac;
    if (!dist || dist <= 0) return this._master;
    const falloff = 1 - Math.min(1, dist / maxDist);
    if (falloff < 0.01) return null;
    const gain = ac.createGain();
    gain.gain.value = falloff * falloff * 0.9;
    gain.connect(this._master);
    if (dist > 250) {
      const lpf = ac.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = 500 + (1 - dist / maxDist) * 17000;
      lpf.connect(gain);
      return lpf;
    }
    return gain;
  }

  // ── Weapon fire ──────────────────────────────────────────
  weapon(type) {
    if (!this.enabled) return;
    const ac  = this._ctx();
    const now = ac.currentTime;
    const out = this._master;

    if (type === 'laser') {
      if (this._buffers.laser) {
        const src = ac.createBufferSource(); src.buffer = this._buffers.laser;
        const g = ac.createGain(); g.gain.value = 0.5;
        src.connect(g); g.connect(out); src.start(now);
      } else {
        const osc = ac.createOscillator();
        osc.type  = 'sawtooth';
        osc.frequency.setValueAtTime(850, now);
        osc.frequency.exponentialRampToValueAtTime(210, now + 0.11);
        const g = ac.createGain();
        g.gain.setValueAtTime(0.13, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        osc.connect(g); g.connect(out);
        osc.start(now); osc.stop(now + 0.12);
      }

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
      // Launch: white noise highpass swoop
      const src = ac.createBufferSource();
      src.buffer = this._noise(0.32);
      const flt = ac.createBiquadFilter();
      flt.type = 'highpass';
      flt.frequency.setValueAtTime(5000, now);
      flt.frequency.exponentialRampToValueAtTime(600, now + 0.32);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.28, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      src.connect(flt); flt.connect(g); g.connect(out);
      src.start(now); src.stop(now + 0.33);
      // Engine: sustained buzz for missile flight
      const eng = ac.createOscillator();
      eng.type = 'sawtooth';
      eng.frequency.setValueAtTime(115, now + 0.06);
      eng.frequency.linearRampToValueAtTime(130, now + 1.8);
      const engFlt = ac.createBiquadFilter();
      engFlt.type = 'bandpass'; engFlt.frequency.value = 280; engFlt.Q.value = 0.6;
      const engG = ac.createGain();
      engG.gain.setValueAtTime(0, now);
      engG.gain.linearRampToValueAtTime(0.09, now + 0.18);
      engG.gain.setValueAtTime(0.09, now + 1.4);
      engG.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
      eng.connect(engFlt); engFlt.connect(engG); engG.connect(out);
      eng.start(now + 0.06); eng.stop(now + 2.1);

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

  // ── Missile lock-on audio ─────────────────────────────────
  missileBeep() {
    if (!this.enabled) return;
    const ac = this._ctx(), now = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1250;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.10, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(g); g.connect(this._master);
    osc.start(now); osc.stop(now + 0.08);
  }

  missileLockOn() {
    if (!this.enabled) return;
    this.missileLockOff();
    const ac = this._ctx();
    this._lockOsc = ac.createOscillator();
    this._lockOsc.type = 'sine';
    this._lockOsc.frequency.value = 1600;
    this._lockGain = ac.createGain();
    this._lockGain.gain.value = 0.07;
    this._lockOsc.connect(this._lockGain);
    this._lockGain.connect(this._master);
    this._lockOsc.start();
  }

  missileLockOff() {
    try { this._lockOsc?.stop(); } catch(_) {}
    this._lockOsc = null;
    this._lockGain = null;
  }

  // ── Enemy weapon (distance-attenuated) ───────────────────
  enemyWeapon(type, dist) {
    if (!this.enabled) return;
    const MAX = 1300;
    if (dist > MAX) return;
    const ac  = this._ctx();
    const now = ac.currentTime;
    const vol = 0.07 * (1 - dist / MAX);
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, now);
    g.connect(this._master);
    if (type === 'laser') {
      if (this._buffers.laser) {
        const src = ac.createBufferSource(); src.buffer = this._buffers.laser;
        src.connect(g); src.start(now);
      } else {
        const osc = ac.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.09);
        const g2 = ac.createGain();
        g2.gain.setValueAtTime(1, now);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc.connect(g2); g2.connect(g);
        osc.start(now); osc.stop(now + 0.10);
      }
    } else {
      const src = ac.createBufferSource();
      src.buffer = this._noise(0.10);
      const flt = ac.createBiquadFilter();
      flt.type = 'bandpass'; flt.frequency.value = 200; flt.Q.value = 0.6;
      src.connect(flt); flt.connect(g);
      src.start(now); src.stop(now + 0.12);
    }
  }

  // ── Landing / launch ─────────────────────────────────────
  // Land is the mirror of launch: filter sweeps high→low, gain fades out
  land() {
    if (!this.enabled) return;
    const ac  = this._ctx();
    const now = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = this._noise(1.4);
    const flt = ac.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(4000, now);
    flt.frequency.exponentialRampToValueAtTime(80, now + 1.4);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.30, now);
    g.gain.setValueAtTime(0.30, now + 0.5);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
    src.connect(flt); flt.connect(g); g.connect(this._master);
    src.start(now); src.stop(now + 1.41);
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
    g.gain.linearRampToValueAtTime(0.30, now + 0.1);
    g.gain.setValueAtTime(0.30, now + 0.9);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
    src.connect(flt); flt.connect(g); g.connect(this._master);
    src.start(now); src.stop(now + 1.41);
  }

  // ── Hyperspace / jump charge ─────────────────────────────
  // frac 0..1 — called each frame while charging
  jumpCharge(frac, dist = 0) {
    if (!this.enabled) return;
    const ac  = this._ctx();
    const now = ac.currentTime;
    if (!this._jumpNoiseSrc) {
      // White noise source (looped for duration of charge)
      const buf = ac.createBuffer(1, ac.sampleRate * 8, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this._jumpNoiseSrc = ac.createBufferSource();
      this._jumpNoiseSrc.buffer = buf;
      this._jumpNoiseSrc.loop = true;

      // Low-pass filter — sweeps from dark to bright
      this._jumpNoiseFilter = ac.createBiquadFilter();
      this._jumpNoiseFilter.type = 'lowpass';
      this._jumpNoiseFilter.frequency.value = 180;
      this._jumpNoiseFilter.Q.value = 0.8;

      // Pitch tone rising above the noise
      this._jumpOsc = ac.createOscillator();
      this._jumpOsc.type = 'sine';
      this._jumpOsc.frequency.value = 60;

      this._jumpGain = ac.createGain();
      this._jumpGain.gain.value = 0;
      this._jumpOscGain = ac.createGain();
      this._jumpOscGain.gain.value = 0;

      this._jumpNoiseSrc.connect(this._jumpNoiseFilter);
      this._jumpNoiseFilter.connect(this._jumpGain);
      this._jumpOsc.connect(this._jumpOscGain);
      this._jumpOscGain.connect(this._jumpGain);
      this._jumpGain.connect(this._master);

      this._jumpNoiseSrc.start(now);
      this._jumpOsc.start(now);
    }
    // Low-pass opens up: 180 Hz → 14 kHz as charge builds
    this._jumpNoiseFilter.frequency.setTargetAtTime(180 + frac * frac * 13820, now, 0.06);
    // Attenuate by distance (dist=0 → full volume for player; NPC fades out past 2000 units)
    const distScale = dist <= 0 ? 1.0 : Math.max(0, 1 - dist / 2000);
    // Noise volume swells
    this._jumpGain.gain.setTargetAtTime((0.05 + frac * 0.22) * distScale, now, 0.06);
    // Pitch tone: 60 Hz → 1100 Hz
    this._jumpOsc.frequency.setTargetAtTime(60 + frac * 1040, now, 0.06);
    this._jumpOscGain.gain.setTargetAtTime(frac * frac * 0.12 * distScale, now, 0.06);
  }

  stopJumpCharge() {
    if (!this._jumpGain || !this._ac) return;
    const now = this._ac.currentTime;
    this._jumpGain.gain.setTargetAtTime(0, now, 0.08);
    const noise = this._jumpNoiseSrc;
    const osc   = this._jumpOsc;
    this._jumpNoiseSrc = null; this._jumpNoiseFilter = null;
    this._jumpOsc = null; this._jumpGain = null; this._jumpOscGain = null;
    setTimeout(() => {
      try { noise?.stop(); } catch (_) {}
      try { osc?.stop();   } catch (_) {}
    }, 250);
  }

  hyperspace(dist = 0) {
    if (!this.enabled) return;
    this.stopJumpCharge();
    const ac  = this._ctx();
    const now = ac.currentTime;
    const out = this._spatialOut(dist, 3000) ?? this._master;

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

    osc.connect(g);            g.connect(out);
    src.connect(nflt); nflt.connect(ng); ng.connect(out);
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
  explosion(dist) {
    if (!this.enabled) return;
    const ac  = this._ctx();
    const now = ac.currentTime;
    const out = this._spatialOut(dist);
    if (!out) return;
    if (this._buffers.explosion) {
      const src = ac.createBufferSource(); src.buffer = this._buffers.explosion;
      const g = ac.createGain(); g.gain.value = 0.9;
      src.connect(g); g.connect(out); src.start(now);
      return;
    }
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
    src.connect(flt); flt.connect(g); g.connect(out);
    src.start(now); src.stop(now + 1.41);
  }

  playerDeathExplosion() {
    if (!this.enabled) return;
    const ac  = this._ctx();
    const now = ac.currentTime;

    if (this._buffers.explosion) {
      const src = ac.createBufferSource(); src.buffer = this._buffers.explosion;
      const g = ac.createGain(); g.gain.value = 1.2;
      src.connect(g); g.connect(this._master); src.start(now);
      return;
    }

    // Synthetic reverb impulse: decaying stereo noise
    const revLen = ac.sampleRate * 4.5;
    const revBuf = ac.createBuffer(2, revLen, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = revBuf.getChannelData(ch);
      for (let i = 0; i < revLen; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / revLen, 1.6);
      }
    }
    const conv = ac.createConvolver();
    conv.buffer = revBuf;
    const convG = ac.createGain();
    convG.gain.value = 0.7;
    conv.connect(convG); convG.connect(this._master);

    // Main noise burst — long, fat, filtered
    const src = ac.createBufferSource();
    src.buffer = this._noise(2.8);
    const flt = ac.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(5000, now);
    flt.frequency.exponentialRampToValueAtTime(60, now + 2.8);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.9, now);
    g.gain.setValueAtTime(0.7, now + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, now + 2.8);
    src.connect(flt); flt.connect(g);
    g.connect(this._master); // dry
    g.connect(conv);         // wet reverb

    // Sub bass thud
    const sub = ac.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(55, now);
    sub.frequency.exponentialRampToValueAtTime(12, now + 2.0);
    const subG = ac.createGain();
    subG.gain.setValueAtTime(0.6, now);
    subG.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
    sub.connect(subG);
    subG.connect(this._master);
    subG.connect(conv);

    src.start(now); src.stop(now + 2.9);
    sub.start(now); sub.stop(now + 2.1);
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

  shieldsLost() {
    if (!this.enabled) return;
    const ac  = this._ctx();
    const now = ac.currentTime;
    // Descending tone sweep indicating shield failure
    const osc = ac.createOscillator();
    osc.type  = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.35);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.15, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(g); g.connect(this._master);
    osc.start(now); osc.stop(now + 0.36);
  }

  shipDisabled(dist) {
    if (!this.enabled) return;
    const ac  = this._ctx();
    const now = ac.currentTime;
    const out = this._spatialOut(dist);
    if (!out) return;
    [800, 500].forEach((freq, i) => {
      const osc = ac.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;
      const g = ac.createGain();
      const t = now + i * 0.15;
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(g); g.connect(out);
      osc.start(t); osc.stop(t + 0.13);
    });
  }

  // ── Per-weapon hull impacts ──────────────────────────────
  // Dispatches to a distinct synth per weapon type (G.WEAPONS[].type)
  weaponHit(type) {
    if (!this.enabled || !this._ac) return;
    const now = this._ac.currentTime;
    if (now - this._wpnHitAt < 0.05) return;   // global debounce vs rapid fire
    this._wpnHitAt = now;
    switch (type) {
      case 'laser':     return this._hitLaser();
      case 'missile':   return this._hitMissile();
      case 'explosion': return this._hitExplosion();
      case 'emp':       return this._hitEmp();
      case 'mining':    return this._hitMining();
      case 'projectile':
      default:          return this._hitKinetic();
    }
  }

  // Laser — bright electric sizzle with a quick descending zap
  _hitLaser() {
    const ac = this._ctx(), now = ac.currentTime;
    if (this._buffers.laser) {
      const src = ac.createBufferSource(); src.buffer = this._buffers.laser;
      const g = ac.createGain(); g.gain.value = 0.4;
      src.connect(g); g.connect(this._master); src.start(now);
      return;
    }
    const src = ac.createBufferSource(); src.buffer = this._noise(0.08);
    const flt = ac.createBiquadFilter(); flt.type = 'highpass'; flt.frequency.value = 2200;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.16, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    src.connect(flt); flt.connect(g); g.connect(this._master);
    src.start(now); src.stop(now + 0.09);
    const osc = ac.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(500, now + 0.07);
    const g2 = ac.createGain();
    g2.gain.setValueAtTime(0.08, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(g2); g2.connect(this._master);
    osc.start(now); osc.stop(now + 0.08);
  }

  // Kinetic (railgun/autocannon/mass driver) — hard metallic clang
  _hitKinetic() {
    const ac = this._ctx(), now = ac.currentTime;
    const src = ac.createBufferSource(); src.buffer = this._noise(0.1);
    const flt = ac.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 600;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.3, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    src.connect(flt); flt.connect(g); g.connect(this._master);
    src.start(now); src.stop(now + 0.11);
    const osc = ac.createOscillator(); osc.type = 'square';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.09);
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = 6;
    const g2 = ac.createGain();
    g2.gain.setValueAtTime(0.1, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(bp); bp.connect(g2); g2.connect(this._master);
    osc.start(now); osc.stop(now + 0.13);
  }

  // Missile — punchy boom with a low sine thump
  _hitMissile() {
    const ac = this._ctx(), now = ac.currentTime;
    const src = ac.createBufferSource(); src.buffer = this._noise(0.35);
    const flt = ac.createBiquadFilter(); flt.type = 'lowpass';
    flt.frequency.setValueAtTime(1400, now);
    flt.frequency.exponentialRampToValueAtTime(120, now + 0.35);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.4, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    src.connect(flt); flt.connect(g); g.connect(this._master);
    src.start(now); src.stop(now + 0.36);
    const osc = ac.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
    const g2 = ac.createGain();
    g2.gain.setValueAtTime(0.3, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(g2); g2.connect(this._master);
    osc.start(now); osc.stop(now + 0.31);
  }

  // Explosion (grenade) — bigger, deeper detonation
  _hitExplosion() {
    const ac = this._ctx(), now = ac.currentTime;
    const src = ac.createBufferSource(); src.buffer = this._noise(0.5);
    const flt = ac.createBiquadFilter(); flt.type = 'lowpass';
    flt.frequency.setValueAtTime(1800, now);
    flt.frequency.exponentialRampToValueAtTime(90, now + 0.5);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.45, now);
    g.gain.setValueAtTime(0.4, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    src.connect(flt); flt.connect(g); g.connect(this._master);
    src.start(now); src.stop(now + 0.51);
    const osc = ac.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.45);
    const g2 = ac.createGain();
    g2.gain.setValueAtTime(0.32, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(g2); g2.connect(this._master);
    osc.start(now); osc.stop(now + 0.46);
  }

  // EMP — buzzy electric crackle (square tone gated by a fast LFO)
  _hitEmp() {
    const ac = this._ctx(), now = ac.currentTime;
    const osc = ac.createOscillator(); osc.type = 'square';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.22);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    const lfo = ac.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 60;
    const lfoG = ac.createGain(); lfoG.gain.value = 0.06;
    lfo.connect(lfoG); lfoG.connect(g.gain);
    osc.connect(g); g.connect(this._master);
    osc.start(now); osc.stop(now + 0.23);
    lfo.start(now); lfo.stop(now + 0.23);
  }

  // Mining laser — gritty rocky crunch
  _hitMining() {
    const ac = this._ctx(), now = ac.currentTime;
    const src = ac.createBufferSource(); src.buffer = this._noise(0.15);
    const flt = ac.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = 900; flt.Q.value = 1.2;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.26, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    src.connect(flt); flt.connect(g); g.connect(this._master);
    src.start(now); src.stop(now + 0.16);
  }

  lootPickup() {
    if (!this.enabled) return;
    const ac  = this._ctx();
    const now = ac.currentTime;
    // Quick ascending chime for picking up loot
    [{ f: 660, t: 0 }, { f: 990, t: 0.08 }, { f: 1320, t: 0.16 }].forEach(({ f, t }) => {
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.12, now + t);
      g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.15);
      osc.connect(g); g.connect(this._uiOut);
      osc.start(now + t); osc.stop(now + t + 0.16);
    });
  }

  boost() {
    if (!this.enabled) return;
    const ac  = this._ctx();
    const now = ac.currentTime;
    // Sweeping high-pass filter white noise for boost
    const src = ac.createBufferSource();
    src.buffer = this._noise(0.35);
    const flt = ac.createBiquadFilter();
    flt.type = 'highpass';
    flt.frequency.setValueAtTime(800, now);
    flt.frequency.exponentialRampToValueAtTime(3500, now + 0.25);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.16, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    // Short reverb tail
    const revLen = Math.floor(ac.sampleRate * 0.55);
    const revBuf = ac.createBuffer(2, revLen, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = revBuf.getChannelData(ch);
      for (let i = 0; i < revLen; i++) d[i] = (Math.random()*2-1) * Math.pow(1 - i/revLen, 2.0);
    }
    const conv = ac.createConvolver(); conv.buffer = revBuf;
    const convG = ac.createGain(); convG.gain.value = 0.4;
    conv.connect(convG); convG.connect(this._master);
    src.connect(flt); flt.connect(g);
    g.connect(this._master); // dry
    g.connect(conv);          // wet reverb tail
    src.start(now); src.stop(now + 0.36);
  }

  voiceChannelOpen(duration) {
    if (!this.enabled || !this._ac) return;
    const ac  = this._ctx();
    const now = ac.currentTime;
    const dur = Math.max(0.5, duration || 2.0);
    // Reverb IR
    const revLen = Math.floor(ac.sampleRate * 1.4);
    const revBuf = ac.createBuffer(2, revLen, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = revBuf.getChannelData(ch);
      for (let i = 0; i < revLen; i++) d[i] = (Math.random()*2-1) * Math.pow(1 - i/revLen, 1.7);
    }
    const conv = ac.createConvolver(); conv.buffer = revBuf;
    const convG = ac.createGain(); convG.gain.value = 0.55;
    conv.connect(convG); convG.connect(this._master);
    // Bandpass-filtered noise — subtle radio channel static
    const src = ac.createBufferSource();
    src.buffer = this._noise(dur + 0.6);
    const bpf = ac.createBiquadFilter();
    bpf.type = 'bandpass'; bpf.frequency.value = 1800; bpf.Q.value = 0.9;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0, now);
    g.gain.linearRampToValueAtTime(0.016, now + 0.06);
    g.gain.setValueAtTime(0.016, now + Math.max(0, dur - 0.12));
    g.gain.linearRampToValueAtTime(0.0, now + dur);
    src.connect(bpf); bpf.connect(g); g.connect(conv);
    src.start(now); src.stop(now + dur + 0.1);
  }

  outOfEnergy() {
    if(!this.enabled) return;
    const ac = this._ctx();
    const now = ac.currentTime;
    [220, 165].forEach((freq, i) => {
      const osc = ac.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;
      const g = ac.createGain();
      const t = now + i * 0.14;
      g.gain.setValueAtTime(0.13, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(g); g.connect(this._uiOut);
      osc.start(t); osc.stop(t + 0.2);
    });
  }

  cargoFull() {
    if (!this.enabled) return;
    const ac  = this._ctx();
    const now = ac.currentTime;
    // Double buzz indicating cargo is full
    [900, 700].forEach((freq, i) => {
      const osc = ac.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;
      const g = ac.createGain();
      const t = now + i * 0.12;
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
      osc.connect(g); g.connect(this._uiOut);
      osc.start(t); osc.stop(t + 0.11);
    });
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
      osc.connect(g); g.connect(this._uiOut);
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
    osc.connect(g); g.connect(this._uiOut);
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
    osc.connect(g); g.connect(this._uiOut);
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
        osc.connect(g); g.connect(this._uiOut);
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
        osc.connect(g); g.connect(this._uiOut);
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

    if (this._buffers.red_alert) {
      const src = ac.createBufferSource();
      src.buffer = this._buffers.red_alert;
      const g = ac.createGain();
      g.gain.value = this.volume;
      src.connect(g); g.connect(this._uiOut);
      src.start(now);
      return;
    }

    // Fallback: procedural two-tone klaxon
    const oscA = ac.createOscillator();
    oscA.type = 'square';
    oscA.frequency.setValueAtTime(1050, now);
    oscA.frequency.linearRampToValueAtTime(850, now + 0.18);
    const gA = ac.createGain();
    gA.gain.setValueAtTime(0,    now);
    gA.gain.linearRampToValueAtTime(0.22, now + 0.02);
    gA.gain.setValueAtTime(0.22, now + 0.16);
    gA.gain.linearRampToValueAtTime(0,    now + 0.22);

    const oscB = ac.createOscillator();
    oscB.type = 'square';
    oscB.frequency.setValueAtTime(580, now + 0.24);
    oscB.frequency.linearRampToValueAtTime(450, now + 0.44);
    const gB = ac.createGain();
    gB.gain.setValueAtTime(0,    now + 0.24);
    gB.gain.linearRampToValueAtTime(0.28, now + 0.26);
    gB.gain.setValueAtTime(0.28, now + 0.42);
    gB.gain.linearRampToValueAtTime(0,    now + 0.50);

    const flt = ac.createBiquadFilter();
    flt.type = 'bandpass'; flt.frequency.value = 750; flt.Q.value = 1.2;

    oscA.connect(gA); gA.connect(flt);
    oscB.connect(gB); gB.connect(flt);
    flt.connect(this._uiOut);

    oscA.start(now); oscA.stop(now + 0.55);
    oscB.start(now + 0.24); oscB.stop(now + 0.55);
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
      osc.connect(g); g.connect(this._uiOut);
      osc.start(now + t); osc.stop(now + t + 0.23);
    });
  }

  missionComplete() {
    if (!this.enabled) return;
    const ac  = this._ctx();
    const now = ac.currentTime;
    if (this._buffers.airhorn) {
      const src = ac.createBufferSource(); src.buffer = this._buffers.airhorn;
      const g = ac.createGain(); g.gain.value = this.volume;
      src.connect(g); g.connect(this._uiOut); src.start(now);
      return;
    }
    // Fallback: quick ascending fanfare
    [{ f: 523, t: 0 }, { f: 659, t: 0.12 }, { f: 784, t: 0.24 }, { f: 1047, t: 0.36 }].forEach(({ f, t }) => {
      const osc = ac.createOscillator(); osc.type = 'square'; osc.frequency.value = f;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.15, now + t);
      g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.18);
      osc.connect(g); g.connect(this._uiOut);
      osc.start(now + t); osc.stop(now + t + 0.19);
    });
  }

  playerLockBeep(progress) {
    if (!this.enabled) return;
    const ac  = this._ctx();
    const now = ac.currentTime;
    const freq = 800 + progress * 400;
    const dur = 0.15 - progress * 0.08;
    const osc = ac.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.15, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(g); g.connect(this._uiOut);
    osc.start(now); osc.stop(now + dur);
  }

  playerLockAlert() {
    if (!this.enabled) return;
    const ac  = this._ctx();
    const now = ac.currentTime;
    [750, 950].forEach((f, i) => {
      const osc = ac.createOscillator(); osc.type = 'sine'; osc.frequency.value = f;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.12, now + i * 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.16);
      osc.connect(g); g.connect(this._uiOut);
      osc.start(now + i * 0.08); osc.stop(now + i * 0.08 + 0.17);
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
    osc.connect(g); g.connect(this._uiOut);
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
    osc.connect(g); g.connect(this._uiOut);
    osc.start(now); osc.stop(now + 0.05);
  }

  // ── Volume control ───────────────────────────────────────
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this._master) {
      this._master.gain.setTargetAtTime(this.volume, this._ac.currentTime, 0.05);
    }
    if (this._uiOut) {
      this._uiOut.gain.setTargetAtTime(this.volume, this._ac.currentTime, 0.05);
    }
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on && this._master) {
      this._master.gain.setTargetAtTime(0, this._ac.currentTime, 0.05);
    } else if (on && this._master) {
      this._master.gain.setTargetAtTime(this.volume, this._ac.currentTime, 0.05);
    }
    if (!on && this._uiOut) {
      this._uiOut.gain.setTargetAtTime(0, this._ac.currentTime, 0.05);
    } else if (on && this._uiOut) {
      this._uiOut.gain.setTargetAtTime(this.volume, this._ac.currentTime, 0.05);
    }
  }

  // ── Adaptive music engine ────────────────────────────────
  setMusicEnabled(on) {
    this.musicEnabled = on;
    if (!this._ac) return;
    const now = this._ac.currentTime;
    if (on) {
      this._musicGain.gain.setTargetAtTime(this.musicVolume, now, 0.8);
      this._musicStart();
    } else {
      this._musicGain.gain.setTargetAtTime(0, now, 0.8);
      this._musicStop();
    }
  }

  setMusicVolume(v) {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this._musicGain && this.musicEnabled) {
      this._musicGain.gain.setTargetAtTime(this.musicVolume, this._ac.currentTime, 0.05);
    }
  }

  // Game drives these every frame; they are cheap (just store/ramp targets).
  musicIntensity(target) {
    this._mIntensityTarget = Math.max(0, Math.min(1, target || 0));
  }

  // "Coming from next door" — gently muffle while in menus / docked.
  musicMuffle(on) {
    if (this._mMuffled === !!on) return;
    this._mMuffled = !!on;
    if (!this._ac) return;
    const now = this._ac.currentTime;
    // Gentle, slow ramp so the transition feels like a door closing.
    this._musicFilter.frequency.setTargetAtTime(on ? 480 : 18000, now, 0.4);
    this._musicMuffle.gain.setTargetAtTime(on ? 0.55 : 1.0, now, 0.4);
  }

  backgroundMuffle(hidden) {
    if (!this._ac) return;
    const now = this._ac.currentTime;
    // Heavy muffle when tab is hidden: drop master SFX volume + deep filter music
    this._master.gain.setTargetAtTime(hidden ? 0.05 : this.volume, now, 0.15);
    if (this._musicFilter) {
      this._musicFilter.frequency.setTargetAtTime(hidden ? 220 : (this._mMuffled ? 480 : 18000), now, 0.15);
      this._musicMuffle.gain.setTargetAtTime(hidden ? 0.2 : (this._mMuffled ? 0.55 : 1.0), now, 0.15);
    }
  }

  _musicStart() {
    if (!this._ac || this._mTimer) return;
    this._mNextBeatT = this._ac.currentTime + 0.12;
    this._mBeat      = 0;
    this._mLastTick  = this._ac.currentTime;
    this._musicScheduler();
  }

  _musicStop() {
    if (this._mTimer) { clearTimeout(this._mTimer); this._mTimer = null; }
  }

  // Equal-temperament frequency, semitones from A2 (110 Hz).
  _mHz(semi) { return 110 * Math.pow(2, semi / 12); }

  // Smoothstep for vertical-layer crossfades.
  _mFade(a, b, x) {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  // Chord progressions per mode (root semitone offset from A, chord quality).
  // Horizontal rescoring swaps the active set on measure boundaries.
  get _mProgs() {
    return {
      // i – VI – III – VII : spacious, calm
      explore: [[0, 'min'], [-4, 'maj'], [3, 'maj'], [-2, 'maj']],
      // i – VII – VI – V(maj) : driving harmonic-minor tension
      combat:  [[0, 'min'], [-2, 'maj'], [-4, 'maj'], [-5, 'maj']],
      // i – ♭II – iv – V : dark, Neapolitan menace
      boss:    [[0, 'min'], [1, 'maj'], [5, 'min'], [-5, 'maj']],
    };
  }
  _mChordTones(type) {
    return type === 'min' ? [0, 3, 7]
         : type === 'maj' ? [0, 4, 7]
         : type === 'dim' ? [0, 3, 6]
         : [0, 7, 12];
  }

  // Lookahead scheduler: smooths intensity, commits mode at bar lines,
  // and schedules each beat's events ~0.1s ahead of the clock.
  _musicScheduler() {
    if (!this.musicEnabled || !this._ac) { this._mTimer = null; return; }
    const ac = this._ac;
    const now = ac.currentTime;

    // Smooth intensity (asymmetric: rise fast, fall slow).
    const dt = Math.max(0, Math.min(0.2, now - this._mLastTick));
    this._mLastTick = now;
    const rate = this._mIntensityTarget > this._mIntensity ? 1.1 : 0.35;
    this._mIntensity += (this._mIntensityTarget - this._mIntensity) * (1 - Math.exp(-rate * dt));

    // Apply vertical-layer mix (continuous crossfades).
    this._applyLayerMix(now);

    const lookahead = 0.12;
    while (this._mNextBeatT < now + lookahead) {
      this._scheduleBeat(this._mBeat, this._mNextBeatT);
      this._mNextBeatT += this._mBeatDur;
      this._mBeat = (this._mBeat + 1) % (this._mBeatsBar * this._mBarsPhrase);
    }

    this._mTimer = setTimeout(() => this._musicScheduler(), 25);
  }

  _applyLayerMix(now) {
    const i = this._mIntensity;
    const L = this._mLayers;
    // Pad ever-present; ducks a touch at peak to make room for drums/lead.
    const g = {
      pad:   0.85 * (1 - 0.30 * i),
      sub:   0.80 * this._mFade(0.10, 0.40, i),
      arp:   0.45 * this._mFade(0.26, 0.55, i),
      drums: 0.85 * this._mFade(0.40, 0.62, i),
      lead:  0.55 * this._mFade(0.68, 0.92, i),
    };
    for (const k in g) {
      L[k].gain.setTargetAtTime(Math.max(0.0001, g[k]), now, 0.5);
    }
    this._mLayerTarget = g;   // deterministic gate for scheduling
  }

  _scheduleBeat(beat, t) {
    const bar       = Math.floor(beat / this._mBeatsBar);
    const beatInBar = beat % this._mBeatsBar;

    // Horizontal rescoring: commit the desired mode only at a measure line.
    if (beatInBar === 0) {
      const i = this._mIntensity;
      // Hysteresis built into the band edges so it doesn't flap.
      let desired = this._mMode;
      if (i < 0.26)      desired = 'explore';
      else if (i < 0.70) desired = 'combat';
      else               desired = 'boss';
      this._mMode = desired;
    }

    const prog  = this._mProgs[this._mMode];
    const chord = prog[bar % prog.length];
    const root  = chord[0];
    const tones = this._mChordTones(chord[1]);
    const beatDur = this._mBeatDur;

    // ── PAD ── sustained chord, refreshed each bar (slow harmonic bed)
    if (beatInBar === 0 && this._layerOn('pad')) {
      const barDur = beatDur * this._mBeatsBar;
      // Explore breathes slower: hold pad two bars.
      const hold = this._mMode === 'explore' ? barDur * 2 : barDur;
      if (this._mMode !== 'explore' || bar % 2 === 0) {
        for (const tn of tones) {
          this._padVoice(this._mHz(root + tn - 12), t, hold);
          if (tn === 0) this._padVoice(this._mHz(root - 24), t, hold); // low octave root
        }
      }
    }

    // ── SUB / BASS ──
    if (this._layerOn('sub')) {
      if (this._mMode === 'explore') {
        if (beatInBar === 0) this._bassVoice(this._mHz(root - 24), t, beatDur * 3.5, 'soft');
      } else if (this._mMode === 'combat') {
        // Eighth-note root pulse with a fifth lift mid-bar.
        for (const sub of [0, 0.5]) {
          const semi = (beatInBar === 2 && sub === 0.5) ? root - 17 : root - 24;
          this._bassVoice(this._mHz(semi), t + sub * beatDur, beatDur * 0.45, 'pluck');
        }
      } else { // boss — relentless eighths, octave hops
        for (const sub of [0, 0.5]) {
          const oct = (beatInBar % 2 === 1 && sub === 0.5) ? -12 : -24;
          this._bassVoice(this._mHz(root + oct), t + sub * beatDur, beatDur * 0.42, 'pluck');
        }
      }
    }

    // ── ARP ── eighth-note arpeggio over chord tones
    if (this._layerOn('arp') && this._mMode !== 'explore') {
      const seq = [tones[0], tones[1], tones[2], tones[1]];
      for (const sub of [0, 0.5]) {
        const idx = (beatInBar * 2 + (sub === 0.5 ? 1 : 0)) % seq.length;
        this._arpVoice(this._mHz(root + seq[idx] + 12), t + sub * beatDur, beatDur * 0.4);
      }
    }

    // ── DRUMS ──
    if (this._layerOn('drums')) {
      const boss = this._mMode === 'boss';
      // Kick: beats 1 & 3 (+ pickup before downbeat for boss)
      if (beatInBar === 0 || beatInBar === 2) this._drumKick(t);
      if (boss && beatInBar === 3) this._drumKick(t + beatDur * 0.5);
      // Snare: backbeat 2 & 4
      if (beatInBar === 1 || beatInBar === 3) this._drumSnare(t);
      // Hats: eighths (combat) / sixteenths (boss)
      const div = boss ? 4 : 2;
      for (let s = 0; s < div; s++) {
        this._drumHat(t + (s / div) * beatDur, s === 0 ? 0.9 : 0.5);
      }
    }

    // ── LEAD ── sparse high motif at peak intensity
    if (this._layerOn('lead') && (beatInBar === 0 || beatInBar === 2)) {
      const pick = tones[(bar + (beatInBar === 2 ? 1 : 0)) % tones.length];
      this._leadVoice(this._mHz(root + pick + 24), t, beatDur * 1.4);
    }
  }

  _layerOn(name) {
    // Schedule a stem only once its target mix is audible (saves voices when
    // faded out). Pad is always present as the exploration bed.
    if (name === 'pad') return true;
    const t = this._mLayerTarget;
    return !!t && t[name] > 0.02;
  }

  // ── Music voices ─────────────────────────────────────────
  _padVoice(freq, t, dur) {
    const ac = this._ac;
    const osc = ac.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    // Slow detuned partial for warmth
    const osc2 = ac.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 1.003;
    const vib = ac.createOscillator();
    vib.frequency.value = 0.25 + Math.random() * 0.3;
    const vibG = ac.createGain(); vibG.gain.value = freq * 0.004;
    vib.connect(vibG); vibG.connect(osc.frequency);
    const g = ac.createGain();
    const atk = Math.min(0.6, dur * 0.3), rel = Math.min(1.2, dur * 0.45);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.10, t + atk);
    g.gain.setValueAtTime(0.10, t + dur - rel);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); osc2.connect(g); g.connect(this._mLayers.pad);
    vib.start(t); osc.start(t); osc2.start(t);
    vib.stop(t + dur + 0.05); osc.stop(t + dur + 0.05); osc2.stop(t + dur + 0.05);
  }

  _bassVoice(freq, t, dur, style) {
    const ac = this._ac;
    const osc = ac.createOscillator();
    osc.type = style === 'soft' ? 'sine' : 'sawtooth';
    osc.frequency.value = freq;
    const flt = ac.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = style === 'soft' ? 220 : 480;
    const g = ac.createGain();
    const peak = style === 'soft' ? 0.16 : 0.22;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(flt); flt.connect(g); g.connect(this._mLayers.sub);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  _arpVoice(freq, t, dur) {
    const ac = this._ac;
    const osc = ac.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(this._mLayers.arp);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  _leadVoice(freq, t, dur) {
    const ac = this._ac;
    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);
    const flt = ac.createBiquadFilter();
    flt.type = 'lowpass'; flt.frequency.value = 2400; flt.Q.value = 2;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(flt); flt.connect(g); g.connect(this._mLayers.lead);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  _drumKick(t) {
    const ac = this._ac;
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.55, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(g); g.connect(this._mLayers.drums);
    osc.start(t); osc.stop(t + 0.17);
  }

  _drumSnare(t) {
    const ac = this._ac;
    const src = ac.createBufferSource(); src.buffer = this._noise(0.18);
    const flt = ac.createBiquadFilter();
    flt.type = 'bandpass'; flt.frequency.value = 1800; flt.Q.value = 0.7;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    src.connect(flt); flt.connect(g); g.connect(this._mLayers.drums);
    src.start(t); src.stop(t + 0.19);
    // Body tone
    const osc = ac.createOscillator();
    osc.type = 'triangle'; osc.frequency.setValueAtTime(330, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.1);
    const g2 = ac.createGain();
    g2.gain.setValueAtTime(0.12, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    osc.connect(g2); g2.connect(this._mLayers.drums);
    osc.start(t); osc.stop(t + 0.11);
  }

  _drumHat(t, vel) {
    const ac = this._ac;
    const src = ac.createBufferSource(); src.buffer = this._noise(0.05);
    const flt = ac.createBiquadFilter();
    flt.type = 'highpass'; flt.frequency.value = 7000;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.10 * vel, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    src.connect(flt); flt.connect(g); g.connect(this._mLayers.drums);
    src.start(t); src.stop(t + 0.05);
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
