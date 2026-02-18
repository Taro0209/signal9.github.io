// SIGNAL 9: THE DEAD AIR ARCHIVE
// Core Game Engine

window.SIGNAL9 = window.SIGNAL9 || {};

// ============================================================
// SAVE SYSTEM
// ============================================================
SIGNAL9.Save = {
  KEY: 'signal9_save',
  defaults: {
    currentMission: 0,
    signalPresence: 50,
    complianceScore: 0,
    namedIt: false,
    settings: {
      locomotion: 'smooth',    // smooth | teleport
      snapAngle: 30,
      vignetteStrength: 0.5,
      subtitles: true,
      audioIntensity: 0.8,
      smoothTurn: false
    }
  },
  load() {
    try {
      const d = localStorage.getItem(this.KEY);
      return d ? Object.assign({}, this.defaults, JSON.parse(d)) : Object.assign({}, this.defaults);
    } catch(e) { return Object.assign({}, this.defaults); }
  },
  save(data) {
    try { localStorage.setItem(this.KEY, JSON.stringify(data)); } catch(e) {}
  },
  clear() { localStorage.removeItem(this.KEY); }
};

// ============================================================
// AUDIO ENGINE (WebAudio procedural)
// ============================================================
SIGNAL9.Audio = {
  ctx: null,
  masterGain: null,
  sources: {},
  listener: null,

  init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = SIGNAL9.gameData.settings.audioIntensity;
    this.masterGain.connect(this.ctx.destination);
    this.listener = this.ctx.listener;
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  // Create filtered noise
  createNoise(color = 'white') {
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      if (color === 'pink') {
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0+b1+b2+b3+b4+b5+b6 + white*0.5362) * 0.11;
        b6 = white * 0.115926;
      } else {
        data[i] = white;
      }
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    return src;
  },

  // Machine hum - continuous low drone
  startMachineHum(volume = 0.3) {
    if (this.sources.machineHum) return;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const osc3 = this.ctx.createOscillator();
    osc1.type = 'sawtooth'; osc1.frequency.value = 60;
    osc2.type = 'sine';     osc2.frequency.value = 120;
    osc3.type = 'sine';     osc3.frequency.value = 180;
    const gainNode = this.ctx.createGain();
    gainNode.gain.value = volume * 0.15;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 300;
    osc1.connect(filter); osc2.connect(filter); osc3.connect(filter);
    filter.connect(gainNode); gainNode.connect(this.masterGain);
    osc1.start(); osc2.start(); osc3.start();
    this.sources.machineHum = { oscs: [osc1, osc2, osc3], gain: gainNode };
  },

  setHumPitch(mult) {
    if (!this.sources.machineHum) return;
    const oscs = this.sources.machineHum.oscs;
    oscs[0].frequency.setTargetAtTime(60 * mult, this.ctx.currentTime, 0.5);
    oscs[1].frequency.setTargetAtTime(120 * mult, this.ctx.currentTime, 0.5);
    oscs[2].frequency.setTargetAtTime(180 * mult, this.ctx.currentTime, 0.5);
  },

  // Ventilation drone
  startVentilation() {
    if (this.sources.vent) return;
    const noise = this.createNoise('pink');
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 400; filter.Q.value = 0.5;
    const gainNode = this.ctx.createGain();
    gainNode.gain.value = 0.08;
    // Positional
    const panner = this.ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.setPosition(0, 3, -5);
    noise.connect(filter); filter.connect(panner); panner.connect(gainNode);
    gainNode.connect(this.masterGain);
    noise.start();
    this.sources.vent = { node: noise, gain: gainNode, panner };
  },

  // Tape deck whirr
  startTapeDeck(x=0, y=0, z=0) {
    const osc = this.ctx.createOscillator();
    osc.type = 'sine'; osc.frequency.value = 3200;
    const modOsc = this.ctx.createOscillator();
    modOsc.type = 'sine'; modOsc.frequency.value = 1.5;
    const modGain = this.ctx.createGain(); modGain.gain.value = 50;
    modOsc.connect(modGain); modGain.connect(osc.frequency);
    const gainNode = this.ctx.createGain(); gainNode.gain.value = 0.02;
    const panner = this.ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.setPosition(x, y, z);
    osc.connect(gainNode); gainNode.connect(panner); panner.connect(this.masterGain);
    osc.start(); modOsc.start();
    return { stop: () => { osc.stop(); modOsc.stop(); } };
  },

  // Whisper near ear - eerie
  playWhisper(text = '') {
    // Synthesize using filtered noise + formant-like shaping
    const duration = 3.0;
    const noise = this.createNoise('white');
    const envelope = this.ctx.createGain();
    envelope.gain.setValueAtTime(0, this.ctx.currentTime);
    envelope.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + 0.2);
    envelope.gain.linearRampToValueAtTime(0.1, this.ctx.currentTime + duration - 0.3);
    envelope.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 3000; filter.Q.value = 3;
    // Hard-pan to right ear
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = 0.95;
    noise.connect(filter); filter.connect(envelope); envelope.connect(panner);
    panner.connect(this.masterGain);
    noise.start(this.ctx.currentTime);
    noise.stop(this.ctx.currentTime + duration);

    // Show subtitle
    if (SIGNAL9.gameData.settings.subtitles && text) {
      SIGNAL9.UI.showSubtitle(text, duration * 1000);
    }
  },

  // Dead air silence - gradually reduce world
  startDeadAir() {
    if (!this.masterGain) return;
    this.masterGain.gain.setTargetAtTime(0.05, this.ctx.currentTime, 2.0);
  },

  endDeadAir() {
    if (!this.masterGain) return;
    const vol = SIGNAL9.gameData.settings.audioIntensity;
    this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 1.0);
  },

  // Test tone
  playTestTone(freq = 1000) {
    if (this.sources.testTone) {
      this.sources.testTone.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.1);
      return;
    }
    const osc = this.ctx.createOscillator();
    osc.type = 'sine'; osc.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = 0.1;
    osc.connect(g); g.connect(this.masterGain);
    osc.start();
    this.sources.testTone = osc;
  },

  stopTestTone() {
    if (this.sources.testTone) {
      try { this.sources.testTone.stop(); } catch(e) {}
      delete this.sources.testTone;
    }
  },

  // Breath/pressure sound
  playBreathing() {
    if (this.sources.breathing) return;
    const noise = this.createNoise('pink');
    const env = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 600; filter.Q.value = 1;
    env.gain.value = 0.12;
    noise.connect(filter); filter.connect(env); env.connect(this.masterGain);
    noise.start();
    // Rhythmic breathing via LFO
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.25;
    const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 0.1;
    lfo.connect(lfoGain); lfoGain.connect(env.gain);
    lfo.start();
    this.sources.breathing = { noise, lfo, env };
  },

  stopBreathing() {
    if (this.sources.breathing) {
      try { this.sources.breathing.noise.stop(); this.sources.breathing.lfo.stop(); } catch(e) {}
      delete this.sources.breathing;
    }
  },

  // Update listener position (call each frame)
  updateListener(px, py, pz, fx, fy, fz, ux, uy, uz) {
    if (!this.listener) return;
    if (this.listener.positionX) {
      this.listener.positionX.value = px;
      this.listener.positionY.value = py;
      this.listener.positionZ.value = pz;
      this.listener.forwardX.value = fx;
      this.listener.forwardY.value = fy;
      this.listener.forwardZ.value = fz;
      this.listener.upX.value = ux;
      this.listener.upY.value = uy;
      this.listener.upZ.value = uz;
    } else {
      this.listener.setPosition(px, py, pz);
      this.listener.setOrientation(fx, fy, fz, ux, uy, uz);
    }
  }
};

// ============================================================
// SIGNAL PRESENCE METER
// ============================================================
SIGNAL9.Presence = {
  value: 50,
  MAX: 100,
  MIN: 0,

  adjust(delta) {
    this.value = Math.max(this.MIN, Math.min(this.MAX, this.value + delta));
    this.applyEffects();
    SIGNAL9.UI.updatePresenceMeter();
  },

  applyEffects() {
    const scene = document.querySelector('a-scene');
    if (!scene) return;
    const v = this.value;
    // Dim lights at low presence
    const lights = scene.querySelectorAll('[data-presence-light]');
    lights.forEach(l => {
      const intensity = 0.1 + (v / 100) * 0.9;
      l.setAttribute('light', `intensity: ${intensity}`);
    });
    // Hum pitch drifts with presence
    if (SIGNAL9.Audio.ctx) {
      SIGNAL9.Audio.setHumPitch(0.8 + (v / 100) * 0.4);
    }
  }
};

// ============================================================
// UI SYSTEM
// ============================================================
SIGNAL9.UI = {
  subtitleTimeout: null,

  showSubtitle(text, duration = 3000) {
    let el = document.getElementById('subtitle-display');
    if (!el) return;
    el.textContent = text;
    el.style.opacity = '1';
    clearTimeout(this.subtitleTimeout);
    this.subtitleTimeout = setTimeout(() => { el.style.opacity = '0'; }, duration);
  },

  updatePresenceMeter() {
    // Updates the in-world CRT meter via A-Frame component
    const meter = document.getElementById('presence-meter-display');
    if (meter) {
      const v = SIGNAL9.Presence.value;
      meter.setAttribute('text', `value: SIGNAL ${v}%; align: center; color: ${v > 60 ? '#00ff00' : v > 30 ? '#ffaa00' : '#ff0000'}; width: 0.4`);
    }
  }
};

// ============================================================
// GAME STATE
// ============================================================
SIGNAL9.gameData = null;
SIGNAL9.currentMission = 0;
SIGNAL9.inventory = { tape: null, tool: null };

SIGNAL9.init = function() {
  this.gameData = this.Save.load();
  this.currentMission = this.gameData.currentMission || 0;
  Presence.value = this.gameData.signalPresence || 50;
};

// Shorthand
const SP = SIGNAL9.Presence;
const SA = SIGNAL9.Audio;
const SS = SIGNAL9.Save;

// ============================================================
// PROCEDURAL TEXTURE GENERATOR
// ============================================================
SIGNAL9.Textures = {
  paperChecklist: null,
  warningLabel: null,
  scanline: null,

  generate() {
    this.paperChecklist = this._genChecklist();
    this.warningLabel = this._genWarning();
    this.scanline = this._genScanline();
  },

  _genChecklist() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e8d8a0';
    ctx.fillRect(0, 0, 512, 512);
    // Paper grain
    for (let i = 0; i < 5000; i++) {
      const x = Math.random()*512, y = Math.random()*512;
      const v = Math.floor(Math.random()*30);
      ctx.fillStyle = `rgba(${v},${v},0,0.1)`;
      ctx.fillRect(x, y, 1, 1);
    }
    // Lines
    ctx.strokeStyle = '#8a7a50'; ctx.lineWidth = 1;
    for (let y = 60; y < 512; y += 28) {
      ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(492, y); ctx.stroke();
    }
    // Header
    ctx.fillStyle = '#c00';
    ctx.font = 'bold 22px Courier New';
    ctx.fillText('COMPLIANCE CHECKLIST', 30, 40);
    ctx.fillStyle = '#333';
    ctx.font = '14px Courier New';
    const rules = [
      'If tone ≠ 1000Hz, do not acknowledge.',
      'If you hear your name, respond:',
      '  STATION ID ONLY',
      'If Emergency Light turns BLUE,',
      '  look at floor until RED returns.',
      'Do not describe anomalies.',
      'Do not make eye contact with',
      '  the maintenance elevator.',
      'Complete all segments.',
      'SIGNAL 9 MUST REMAIN ON AIR.',
    ];
    rules.forEach((r, i) => { ctx.fillText(r, 30, 88 + i*28); });
    return c.toDataURL();
  },

  _genWarning() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const ctx = c.getContext('2d');
    // Yellow/black hazard
    const stripe = 20;
    for (let x = -128; x < 256; x += stripe*2) {
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(x, 0, stripe, 128);
      ctx.fillStyle = '#111';
      ctx.fillRect(x+stripe, 0, stripe, 128);
    }
    ctx.fillStyle = '#ff0000';
    ctx.font = 'bold 18px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('SIGNAL 9', 128, 55);
    ctx.fillText('AUTHORIZED ONLY', 128, 80);
    return c.toDataURL();
  },

  _genScanline() {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 4;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0,0,4,4);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0,0,4,1);
    return c.toDataURL();
  }
};

// ============================================================
// LOADING SCREEN
// ============================================================
SIGNAL9.showLoading = function() {
  const ls = document.getElementById('loading-screen');
  const fill = document.getElementById('loading-fill');
  const status = document.getElementById('loading-status');
  const btn = document.getElementById('enter-button');

  const steps = [
    [10, 'INITIALIZING ARCHIVE SYSTEMS...'],
    [25, 'LOADING BROADCAST PROCEDURES...'],
    [45, 'CALIBRATING SIGNAL MONITORS...'],
    [60, 'CHECKING COMPLIANCE PROTOCOLS...'],
    [75, 'PREPARING DEAD AIR CONTINGENCY...'],
    [90, 'VERIFYING STATION IDENTITY...'],
    [100, 'SIGNAL 9 IS READY.']
  ];

  let i = 0;
  const tick = () => {
    if (i >= steps.length) {
      btn.style.display = 'block';
      return;
    }
    const [pct, msg] = steps[i++];
    fill.style.width = pct + '%';
    status.textContent = msg;
    setTimeout(tick, 400 + Math.random()*300);
  };
  setTimeout(tick, 200);

  btn.addEventListener('click', () => {
    SIGNAL9.Audio.init();
    SIGNAL9.Audio.resume();
    ls.style.transition = 'opacity 1s';
    ls.style.opacity = '0';
    setTimeout(() => { ls.style.display = 'none'; }, 1000);
    SIGNAL9.Textures.generate();
    SIGNAL9.Scenes.load(SIGNAL9.currentMission);
  });
};

console.log('[SIGNAL9] game.js loaded');
