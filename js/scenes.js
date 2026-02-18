// SIGNAL 9: SCENES + A-FRAME COMPONENTS
// All mission scenes, custom components, interaction systems

// ============================================================
// CUSTOM A-FRAME COMPONENTS
// ============================================================

// Knob interaction - rotates on grab+move
AFRAME.registerComponent('knob-control', {
  schema: {
    min: {default: 200}, max: {default: 2000}, value: {default: 1000},
    step: {default: 50}, targetId: {default: ''}
  },
  init() {
    this.held = false;
    this.lastY = 0;
    this.el.addEventListener('gripdown', () => { this.held = true; });
    this.el.addEventListener('gripup', () => { this.held = false; });
    this.el.addEventListener('thumbstickmoved', (e) => {
      if (!this.held) return;
      const dy = e.detail.y;
      this.data.value = Math.max(this.data.min,
        Math.min(this.data.max, this.data.value - dy * this.data.step));
      this.update_display();
    });
  },
  update_display() {
    const t = document.getElementById(this.data.targetId);
    if (t) t.setAttribute('text', `value: ${Math.round(this.data.value)} Hz; color: #00ff00; align: center; width: 0.5`);
    if (SIGNAL9.Audio.ctx) SIGNAL9.Audio.playTestTone(this.data.value);
    // Rotate visually
    const rot = ((this.data.value - this.data.min) / (this.data.max - this.data.min)) * 270 - 135;
    this.el.setAttribute('rotation', `0 0 ${rot}`);
    // Horror trigger
    const v = Math.round(this.data.value);
    if (v !== 1000 && Math.abs(v - 1000) < 100) {
      SIGNAL9.Presence.adjust(-1);
    }
  }
});

// Button press interaction
AFRAME.registerComponent('pressable', {
  schema: { action: {default: ''}, label: {default: 'PRESS'} },
  init() {
    this.el.addEventListener('triggerdown', () => {
      this.el.setAttribute('scale', '0.9 0.9 0.9');
      setTimeout(() => this.el.setAttribute('scale', '1 1 1'), 150);
      if (this.data.action && SIGNAL9.Scenes.actions[this.data.action]) {
        SIGNAL9.Scenes.actions[this.data.action](this.el);
      }
    });
    this.el.classList.add('interactive');
  }
});

// Grabbable object
AFRAME.registerComponent('grabbable', {
  schema: { itemType: {default: 'generic'} },
  init() {
    this.held = false;
    this.controller = null;
    this.el.classList.add('interactive');
    this.el.addEventListener('gripdown', (e) => this.pickup(e));
    this.el.addEventListener('gripup', () => this.drop());
  },
  pickup(e) {
    if (this.held) return;
    this.held = true;
    this.controller = e.target;
    this.origParent = this.el.parentNode;
    this.origPos = this.el.getAttribute('position');
    this.origRot = this.el.getAttribute('rotation');
    // Reparent to controller
    const ctrlEl = document.querySelector('[hand-controls="hand: right"]') ||
                   document.querySelector('[oculus-touch-controls="hand: right"]');
    if (ctrlEl) ctrlEl.appendChild(this.el);
    this.el.setAttribute('position', '0 0 -0.1');
    // Store in inventory
    SIGNAL9.inventory[this.data.itemType] = this.el;
  },
  drop() {
    if (!this.held) return;
    this.held = false;
    // Return to world
    this.origParent.appendChild(this.el);
    this.el.setAttribute('position', this.origPos);
    this.controller = null;
  }
});

// VHS slot - accepts tape insertion
AFRAME.registerComponent('vhs-slot', {
  schema: { missionId: {default: 2} },
  init() {
    this.hastape = false;
    this.el.classList.add('interactive');
    this.el.addEventListener('triggerdown', () => {
      if (this.hastape) return;
      if (SIGNAL9.inventory.tape) {
        this.insertTape();
      }
    });
  },
  insertTape() {
    this.hastape = true;
    const tape = SIGNAL9.inventory.tape;
    if (tape) {
      tape.setAttribute('visible', 'false');
      SIGNAL9.inventory.tape = null;
    }
    SIGNAL9.Scenes.actions.tapeInserted && SIGNAL9.Scenes.actions.tapeInserted();
  }
});

// Dial/slider control
AFRAME.registerComponent('dial-control', {
  schema: { axis: {default: 'x'}, min: {default: 0}, max: {default: 100}, value: {default: 50}, targetId: {default: ''}, label: {default: ''} },
  init() {
    this.held = false;
    this.el.classList.add('interactive');
    this.el.addEventListener('gripdown', () => { this.held = true; });
    this.el.addEventListener('gripup', () => { this.held = false; });
    this.el.addEventListener('thumbstickmoved', (e) => {
      if (!this.held) return;
      const d = this.data.axis === 'x' ? e.detail.x : -e.detail.y;
      this.data.value = Math.max(this.data.min, Math.min(this.data.max, this.data.value + d * 2));
      this.updateDisplay();
      if (this.data.targetId) {
        const t = document.getElementById(this.data.targetId);
        if (t) {
          SIGNAL9.Scenes.onDialChange && SIGNAL9.Scenes.onDialChange(this.data.targetId, this.data.value);
        }
      }
    });
  },
  updateDisplay() {
    const norm = (this.data.value - this.data.min) / (this.data.max - this.data.min);
    const rot = norm * 270 - 135;
    this.el.setAttribute('rotation', `0 0 ${rot}`);
  }
});

// Crank component for dish
AFRAME.registerComponent('crank', {
  schema: { targetId: {default: ''} },
  init() {
    this.held = false;
    this.angle = 0;
    this.el.classList.add('interactive');
    this.el.addEventListener('gripdown', () => { this.held = true; });
    this.el.addEventListener('gripup', () => { this.held = false; });
    this.el.addEventListener('thumbstickmoved', (e) => {
      if (!this.held) return;
      this.angle += e.detail.x * 5;
      this.el.setAttribute('rotation', `0 ${this.angle} 0`);
      if (this.data.targetId) {
        SIGNAL9.Scenes.onCrank && SIGNAL9.Scenes.onCrank(this.angle);
      }
    });
  }
});

// Gaze detector - tracks what player is looking at
AFRAME.registerComponent('gaze-detector', {
  schema: { target: {default: ''}, radius: {default: 0.2} },
  init() {
    this.gazeTimer = 0;
    this.isGazed = false;
  },
  tick(time, delta) {
    const camera = document.querySelector('[camera]');
    if (!camera) return;
    const camDir = new THREE.Vector3();
    camera.object3D.getWorldDirection(camDir);
    const camPos = new THREE.Vector3();
    camera.object3D.getWorldPosition(camPos);
    const elPos = new THREE.Vector3();
    this.el.object3D.getWorldPosition(elPos);
    const toEl = elPos.clone().sub(camPos).normalize();
    const dot = camDir.dot(toEl);
    if (dot > 0.9) {
      if (!this.isGazed) {
        this.isGazed = true;
        this.el.emit('gazestart');
        SIGNAL9.Presence.adjust(2);
      }
    } else {
      if (this.isGazed) {
        this.isGazed = false;
        this.el.emit('gazeend');
      }
    }
  }
});

// Head tilt detector - for compliance events
AFRAME.registerComponent('head-tilt-monitor', {
  init() {
    this.lookingDown = false;
    this.lookingUp = false;
  },
  tick() {
    const camera = document.querySelector('[camera]');
    if (!camera) return;
    const dir = new THREE.Vector3();
    camera.object3D.getWorldDirection(dir);
    const prevDown = this.lookingDown;
    const prevUp = this.lookingUp;
    this.lookingDown = dir.y < -0.5;
    this.lookingUp = dir.y > 0.5;
    if (this.lookingDown !== prevDown) this.el.emit(this.lookingDown ? 'lookdown' : 'looklevel');
    if (this.lookingUp !== prevUp) this.el.emit(this.lookingUp ? 'lookup' : 'looklevel');
  }
});

// Wrist menu component
AFRAME.registerComponent('wrist-menu', {
  init() {
    this.visible = false;
    // Listen for A button via controller
    const rCtrl = document.querySelector('[oculus-touch-controls="hand: right"]') ||
                  document.querySelector('[hand-controls="hand: right"]');
    if (rCtrl) {
      rCtrl.addEventListener('abuttondown', () => this.toggle());
    }
  },
  toggle() {
    this.visible = !this.visible;
    this.el.setAttribute('visible', this.visible);
  }
});

// Compliance checklist (X button)
AFRAME.registerComponent('compliance-checklist', {
  init() {
    this.visible = false;
    const lCtrl = document.querySelector('[oculus-touch-controls="hand: left"]') ||
                  document.querySelector('[hand-controls="hand: left"]');
    if (lCtrl) {
      lCtrl.addEventListener('xbuttondown', () => this.toggle());
    }
  },
  toggle() {
    this.visible = !this.visible;
    this.el.setAttribute('visible', this.visible);
  }
});

// Smooth locomotion
AFRAME.registerComponent('smooth-locomotion', {
  schema: { speed: {default: 3}, vignetteStrength: {default: 0.5} },
  init() {
    this.velocity = new THREE.Vector3();
    this.rigEl = this.el;
  },
  tick(time, delta) {
    const dt = delta / 1000;
    const lCtrl = document.querySelector('[oculus-touch-controls="hand: left"]') ||
                  document.querySelector('[hand-controls="hand: left"]');
    if (!lCtrl) return;
    const axisData = lCtrl.components['oculus-touch-controls'] ||
                     lCtrl.components['hand-controls'];
    if (!axisData) return;
    const gamepad = lCtrl.components['oculus-touch-controls'] ?
      AFRAME.utils.device.getGamepad(0) : null;
    if (!gamepad) return;
    const axes = gamepad.axes;
    if (!axes) return;
    const x = axes[2] || axes[0] || 0;
    const y = axes[3] || axes[1] || 0;
    if (Math.abs(x) < 0.1 && Math.abs(y) < 0.1) return;
    const camera = document.querySelector('[camera]');
    const camDir = new THREE.Vector3();
    camera.object3D.getWorldDirection(camDir);
    camDir.y = 0; camDir.normalize();
    const right = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0,1,0));
    const move = new THREE.Vector3();
    move.addScaledVector(camDir, -y * this.data.speed * dt);
    move.addScaledVector(right, x * this.data.speed * dt);
    const pos = this.rigEl.object3D.position;
    pos.add(move);
  }
});

// Snap turn
AFRAME.registerComponent('snap-turn', {
  schema: { angle: {default: 30} },
  init() {
    this.cooldown = false;
    const rCtrl = document.querySelector('[oculus-touch-controls="hand: right"]');
    if (rCtrl) {
      rCtrl.addEventListener('axismove', (e) => {
        if (this.cooldown) return;
        const x = e.detail.axis[2] || e.detail.axis[0] || 0;
        if (Math.abs(x) > 0.7) {
          const rig = document.getElementById('rig');
          if (rig) {
            const rot = rig.getAttribute('rotation');
            rig.setAttribute('rotation', {x: rot.x, y: rot.y + (x > 0 ? -this.data.angle : this.data.angle), z: rot.z});
          }
          this.cooldown = true;
          setTimeout(() => { this.cooldown = false; }, 300);
        }
      });
    }
  }
});

// Comfort vignette
AFRAME.registerComponent('comfort-vignette', {
  schema: { strength: {default: 0.5}, enabled: {default: true} },
  init() {
    // Toggle with Y button
    const lCtrl = document.querySelector('[oculus-touch-controls="hand: left"]') ||
                  document.querySelector('[hand-controls="hand: left"]');
    if (lCtrl) {
      lCtrl.addEventListener('ybuttondown', () => {
        this.data.enabled = !this.data.enabled;
        this.el.setAttribute('visible', this.data.enabled);
      });
    }
  }
});

// VHS CRT display
AFRAME.registerComponent('crt-display', {
  schema: { state: {default: 'off'} }, // off, static, playing, text
  init() {
    this.frameCount = 0;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 256; this.canvas.height = 192;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.el.getObject3D('mesh').material.map = this.texture;
    this.el.getObject3D('mesh').material.needsUpdate = true;
  },
  tick() {
    this.frameCount++;
    if (this.frameCount % 3 !== 0) return; // 20fps approx
    const ctx = this.canvas.getContext('2d');
    const w = 256, h = 192;

    if (this.data.state === 'static') {
      // Draw noise
      const imgData = ctx.createImageData(w, h);
      for (let i = 0; i < imgData.data.length; i += 4) {
        const v = Math.random() * 200;
        imgData.data[i] = v; imgData.data[i+1] = v; imgData.data[i+2] = v; imgData.data[i+3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
      // Scanlines
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      for (let y = 0; y < h; y += 2) ctx.fillRect(0, y, w, 1);
    } else if (this.data.state === 'playing') {
      this._drawPuppetShow(ctx, w, h);
    } else if (this.data.state === 'text') {
      ctx.fillStyle = '#000'; ctx.fillRect(0,0,w,h);
      ctx.fillStyle = '#00ff00';
      ctx.font = 'bold 14px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText('YOU ARE TOO CLOSE', w/2, h/2 - 10);
      ctx.fillText('TO THE SCREEN.', w/2, h/2 + 10);
    } else if (this.data.state === 'face') {
      this._drawFaceNoise(ctx, w, h);
    } else if (this.data.state === 'logo') {
      ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0,0,w,h);
      ctx.fillStyle = '#333';
      ctx.font = 'bold 24px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText('SIGNAL 9', w/2, h/2 - 5);
      ctx.font = '10px Courier New';
      ctx.fillText('WDRK-TV', w/2, h/2 + 15);
      // Scanlines
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      for (let y = 0; y < h; y += 2) ctx.fillRect(0, y, w, 1);
    } else {
      ctx.fillStyle = '#000'; ctx.fillRect(0,0,w,h);
    }
    this.texture.needsUpdate = true;
  },

  _drawPuppetShow(ctx, w, h) {
    // Simple animated puppet shapes
    const t = Date.now() / 1000;
    ctx.fillStyle = '#1a0a00'; ctx.fillRect(0,0,w,h);
    // Background - puppet stage curtains
    ctx.fillStyle = '#6a0000';
    ctx.fillRect(0,0,50,h); ctx.fillRect(w-50,0,50,h);
    // Puppet 1 - left
    const p1y = h/2 + Math.sin(t*1.2) * 10;
    ctx.fillStyle = '#e8c090';
    ctx.beginPath(); ctx.arc(70, p1y, 20, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(63, p1y-5, 4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(77, p1y-5, 4, 0, Math.PI*2); ctx.fill();
    // Puppet 2 - right
    const p2y = h/2 + Math.sin(t*1.2 + Math.PI) * 10;
    ctx.fillStyle = '#90c0e8';
    ctx.beginPath(); ctx.arc(w-70, p2y, 20, 0, Math.PI*2); ctx.fill();
    // Speaking indicator
    if (Math.floor(t*4) % 2) {
      ctx.fillStyle = '#fff';
      ctx.font = '8px monospace';
      ctx.fillText('...', 90, p1y+5);
    }
    // Scanlines
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let y = 0; y < h; y += 2) ctx.fillRect(0, y, w, 1);
  },

  _drawFaceNoise(ctx, w, h) {
    // Abstract face-like pattern in noise
    const t = Date.now() / 1000;
    const imgData = ctx.createImageData(w, h);
    const cx = w/2, cy = h/2;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let v = Math.random() * 80;
        const dx = x-cx, dy = y-cy;
        const r = Math.sqrt(dx*dx+dy*dy);
        // Face-like shape emergence
        const eyeL = Math.sqrt((x-cx+30)*(x-cx+30)+(y-cy+20)*(y-cy+20));
        const eyeR = Math.sqrt((x-cx-30)*(x-cx-30)+(y-cy+20)*(y-cy+20));
        const mouth = Math.abs(y-(cy+30)) < 10 && Math.abs(x-cx) < 40;
        if (eyeL < 15 || eyeR < 15) v += 80 + Math.sin(t*3)*20;
        if (mouth) v += 60;
        if (r < 70 && r > 60) v += 40;
        v = Math.min(255, v);
        const idx = (y*w+x)*4;
        imgData.data[idx] = v; imgData.data[idx+1] = v*0.8; imgData.data[idx+2] = v*0.6;
        imgData.data[idx+3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }
});

// Anomaly flicker - subtle environment changes
AFRAME.registerComponent('anomaly-flicker', {
  schema: { intensity: {default: 0.1} },
  init() {
    this.origPos = {...this.el.getAttribute('position')};
    this.timer = 0;
  },
  tick(time, delta) {
    this.timer += delta;
    if (this.timer < 3000 + Math.random()*5000) return;
    this.timer = 0;
    if (SIGNAL9.Presence.value < 40) {
      // Subtle drift
      const pos = {...this.origPos};
      pos.x += (Math.random()-0.5) * this.data.intensity;
      pos.z += (Math.random()-0.5) * this.data.intensity;
      this.el.setAttribute('position', pos);
    }
  }
});

// Delayed shadow / ghostly hand copy
AFRAME.registerComponent('ghost-hand', {
  schema: { delay: {default: 500} },
  init() {
    this.positions = [];
    this.rotations = [];
    this.interval = 50;
    this.frames = Math.floor(this.data.delay / this.interval);
    this.ghost = document.createElement('a-entity');
    this.ghost.setAttribute('geometry', 'primitive: box; width: 0.08; height: 0.15; depth: 0.04');
    this.ghost.setAttribute('material', 'color: #aaaaaa; opacity: 0.15; transparent: true');
    this.el.parentNode.appendChild(this.ghost);
    this.lastTime = 0;
  },
  tick(time, delta) {
    if (time - this.lastTime < this.interval) return;
    this.lastTime = time;
    const pos = new THREE.Vector3();
    const rot = new THREE.Euler();
    this.el.object3D.getWorldPosition(pos);
    rot.copy(this.el.object3D.rotation);
    this.positions.push({...pos});
    this.rotations.push({...rot});
    if (this.positions.length > this.frames) {
      const oldPos = this.positions.shift();
      this.rotations.shift();
      this.ghost.object3D.position.set(oldPos.x, oldPos.y, oldPos.z);
    }
  }
});

// Ray pointer for menu navigation
AFRAME.registerComponent('ray-pointer', {
  init() {
    this.el.setAttribute('raycaster', 'objects: .interactive; far: 5');
    this.el.addEventListener('raycaster-intersection', (e) => {
      e.detail.els.forEach(el => {
        el.setAttribute('scale', '1.05 1.05 1.05');
      });
    });
    this.el.addEventListener('raycaster-intersection-cleared', (e) => {
      e.detail.clearedEls.forEach(el => {
        el.setAttribute('scale', '1 1 1');
      });
    });
  }
});

// ============================================================
// SCENE BUILDER
// ============================================================
SIGNAL9.Scenes = {
  currentScene: null,
  actions: {},

  load(missionId) {
    const scene = document.querySelector('a-scene');
    if (!scene) return;
    // Clear previous scene content
    const prev = document.getElementById('scene-root');
    if (prev) prev.parentNode.removeChild(prev);
    const root = document.createElement('a-entity');
    root.id = 'scene-root';
    scene.appendChild(root);

    // ── AUDIO TRANSITIONS ─────────────────────────────────
    const GA = SIGNAL9.GameAudio;
    if (GA) {
      if (missionId === 0) {
        GA.stopAtmosphere();
        GA.playMainMenu();
      } else {
        GA.stopMainMenu();
        GA.startAtmosphere();
      }
    }

    // Hide Shrek on scene change
    if (SIGNAL9.Entity) SIGNAL9.Entity.hide();

    SIGNAL9.Audio.startMachineHum();
    SIGNAL9.Audio.startVentilation();

    switch(missionId) {
      case 0: this.buildMainMenu(root); break;
      case 1: this.buildMission1(root); break;
      case 2: this.buildMission2(root); break;
      case 3: this.buildMission3(root); break;
      case 3.5: this.buildJumpscare(root); break;
      case 4: this.buildMission4(root); break;
      case 5: this.buildMission5(root); break;
      case 6: this.buildMission6(root); break;
      case 7: this.buildEnding(root, SIGNAL9.gameData.endingType || 'compliance'); break;
    }
    this.currentScene = missionId;
  },

  // Helper to create entity with attrs
  e(tag, attrs, parent) {
    const el = document.createElement(tag || 'a-entity');
    if (attrs) Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k, v));
    if (parent) parent.appendChild(el);
    return el;
  },

  // Build base room shell (basement)
  buildBasementRoom(parent, opts = {}) {
    const w = opts.w || 8, d = opts.d || 10, h = opts.h || 3;
    // Floor
    this.e('a-box', {position:`0 0 0`, width:w, height:0.1, depth:d, material:'color:#2a2a2a;roughness:0.9;metalness:0'}, parent);
    // Ceiling
    this.e('a-box', {position:`0 ${h} 0`, width:w, height:0.1, depth:d, material:'color:#1a1a1a;roughness:0.8'}, parent);
    // Walls
    this.e('a-box', {position:`0 ${h/2} -${d/2}`, width:w, height:h, depth:0.1, material:'color:#333333;roughness:0.8'}, parent); // back
    this.e('a-box', {position:`0 ${h/2} ${d/2}`, width:w, height:h, depth:0.1, material:'color:#2a2a2a;roughness:0.8'}, parent); // front
    this.e('a-box', {position:`-${w/2} ${h/2} 0`, width:0.1, height:h, depth:d, material:'color:#2e2e2e;roughness:0.8'}, parent); // left
    this.e('a-box', {position:`${w/2} ${h/2} 0`, width:0.1, height:h, depth:d, material:'color:#2e2e2e;roughness:0.8'}, parent); // right
    // Ambient fill light
    this.e('a-entity', {'data-presence-light':'', light:'type:ambient;color:#332211;intensity:0.3'}, parent);
    // Main overhead light (fluorescent flicker)
    this.e('a-entity', {position:`0 ${h-0.1} 0`, 'data-presence-light':'', light:'type:point;color:#ffe8c0;intensity:0.8;distance:8'}, parent);
    // Floor cable detail
    for (let i = 0; i < 4; i++) {
      this.e('a-box', {position:`${(Math.random()-0.5)*6} 0.05 ${(Math.random()-0.5)*8}`, width:0.02, height:0.02, depth:2+Math.random()*3, rotation:`0 ${Math.random()*90} 0`, material:'color:#111'}, parent);
    }
    return parent;
  },

  // CRT monitor box
  buildCRT(parent, pos, id, opts={}) {
    const g = this.e('a-entity', {position:pos}, parent);
    if (id) g.id = id;
    // Body
    this.e('a-box', {width:0.5,height:0.4,depth:0.4,material:'color:#222222;roughness:0.6;metalness:0.3'}, g);
    // Screen face
    const screen = this.e('a-box', {position:'0 0 0.21', width:0.42,height:0.33,depth:0.01, material:'color:#001100;emissive:#001100;emissiveIntensity:0.3'}, g);
    if (opts.crtDisplay) { screen.setAttribute('crt-display', `state: ${opts.crtState||'static'}`); }
    // Screen glow
    this.e('a-entity', {position:'0 0 0.25', light:'type:point;color:#003300;intensity:0.3;distance:1'}, g);
    // Bezel details
    this.e('a-box', {position:'0 -0.22 0.15', width:0.5,height:0.04,depth:0.3, material:'color:#1a1a1a'}, g); // base
    // Power LED
    this.e('a-sphere', {position:'0.17 -0.18 0.21', radius:0.01, material:'color:#00ff00;emissive:#00ff00;emissiveIntensity:1'}, g);
    return g;
  },

  // VHS Deck
  buildVHSDeck(parent, pos, id) {
    const g = this.e('a-entity', {position:pos}, parent);
    if (id) g.id = id;
    this.e('a-box', {width:0.5,height:0.1,depth:0.3, material:'color:#1a1a1a;roughness:0.8;metalness:0.5'}, g);
    // Tape slot
    const slot = this.e('a-box', {position:'0 0.06 0', width:0.22,height:0.04,depth:0.22, material:'color:#111111'}, g);
    slot.setAttribute('vhs-slot','');
    slot.classList.add('interactive');
    // LEDs
    this.e('a-sphere', {position:'-0.15 0.06 0.16', radius:0.008, material:'color:#ff8800;emissive:#ff8800;emissiveIntensity:1'}, g);
    this.e('a-sphere', {position:'-0.10 0.06 0.16', radius:0.008, material:'color:#00ff00;emissive:#00ff00;emissiveIntensity:0.5'}, g);
    // Buttons
    for (let i=0; i<4; i++) {
      this.e('a-box', {position:`${0.05+i*0.07} 0.06 0.16`, width:0.04,height:0.02,depth:0.03, material:'color:#333'}, g);
    }
    return g;
  },

  // Tape cassette
  buildTape(parent, pos, id) {
    const tape = this.e('a-entity', {position:pos}, parent);
    if (id) tape.id = id;
    this.e('a-box', {width:0.18,height:0.03,depth:0.10, material:'color:#1a1a1a;roughness:0.6'}, tape);
    this.e('a-box', {position:'0 0.02 0', width:0.14,height:0.02,depth:0.08, material:'color:#333'}, tape);
    tape.setAttribute('grabbable', 'itemType: tape');
    tape.classList.add('interactive');
    // Label
    this.e('a-plane', {position:'0 0.016 0.05', width:0.1,height:0.05, rotation:'-90 0 0', material:'color:#e8d8a0'}, tape);
    return tape;
  },

  // Tape shelf
  buildShelf(parent, pos, rot='') {
    const g = this.e('a-entity', {position:pos, rotation:rot}, parent);
    // Shelf board
    this.e('a-box', {width:1.2,height:0.04,depth:0.25, material:'color:#443322;roughness:0.8;src:/assets/textures/metal.png'}, g);
    // Support brackets
    this.e('a-box', {position:'-0.55 -0.15 0', width:0.04,height:0.3,depth:0.25, material:'color:#555'}, g);
    this.e('a-box', {position:'0.55 -0.15 0', width:0.04,height:0.3,depth:0.25, material:'color:#555'}, g);
    // Tapes on shelf
    for (let i=0; i<6; i++) {
      this.e('a-box', {position:`${-0.45+i*0.18} 0.05 0`, width:0.16,height:0.12,depth:0.20, material:`color:${['#222','#1a1a2e','#2e1a1a','#1a2e1a','#2a2a1a','#1e1e1e'][i]};roughness:0.6`}, g);
    }
    return g;
  },

  // Patch bay
  buildPatchBay(parent, pos) {
    const g = this.e('a-entity', {position:pos}, parent);
    this.e('a-box', {width:1.5,height:1.2,depth:0.15, material:'src:/assets/textures/metal.png;roughness:0.7;metalness:0.6;color:#444'}, g);
    // Patch points grid
    for (let row=0; row<6; row++) {
      for (let col=0; col<8; col++) {
        const px = -0.65+col*0.18, py = 0.45-row*0.16;
        this.e('a-cylinder', {position:`${px} ${py} 0.09`, radius:0.015,height:0.04, material:'color:#222'}, g);
        // Some with cables
        if (Math.random()>0.6) {
          this.e('a-cylinder', {position:`${px} ${py+0.15+Math.random()*0.3} 0.08`, radius:0.008, height:0.3+Math.random()*0.3, rotation:`${(Math.random()-0.5)*30} 0 ${(Math.random()-0.5)*30}`, material:`color:${['#c00','#0c0','#00c','#cc0','#c0c'][Math.floor(Math.random()*5)]}`}, g);
        }
      }
    }
    return g;
  },

  // Signal rack
  buildSignalRack(parent, pos, id) {
    const g = this.e('a-entity', {position:pos}, parent);
    if (id) g.id = id;
    // Rack frame
    this.e('a-box', {width:0.5,height:2,depth:0.5, material:'src:/assets/textures/metal.png;color:#333;roughness:0.6;metalness:0.7'}, g);
    // Rack units
    for (let i=0; i<8; i++) {
      const unitH = 0.22;
      const uy = 0.8-i*unitH;
      this.e('a-box', {position:`0 ${uy} 0.25`, width:0.44,height:unitH-0.02,depth:0.02, material:`color:${i%3===0?'#1a2a1a':'#2a2a2a'}`}, g);
      // Knobs on rack
      this.e('a-cylinder', {position:`-0.15 ${uy} 0.27`, radius:0.025,height:0.03, material:'color:#444'}, g);
      this.e('a-cylinder', {position:`0 ${uy} 0.27`, radius:0.02,height:0.03, material:'color:#444'}, g);
      // LEDs
      this.e('a-sphere', {position:`0.15 ${uy} 0.27`, radius:0.01, material:`color:${i<3?'#00ff00':'#ff6600'};emissive:${i<3?'#00ff00':'#ff6600'};emissiveIntensity:1`}, g);
    }
    // Emergency indicator
    const emgLight = this.e('a-sphere', {id:'emergency-light', position:'0 1.1 0.26', radius:0.04, material:'color:#ff0000;emissive:#ff0000;emissiveIntensity:1'}, g);
    this.e('a-entity', {position:'0 1.1 0.3', light:'type:point;color:#ff0000;intensity:1;distance:2'}, g);
    return g;
  },

  // ============================================================
  // SCENE 0: MAIN MENU
  // ============================================================
  buildMainMenu(root) {
    this.e('a-sky', {color:'#050505'}, root);
    // Fog effect
    this.e('a-entity', {fog:'type:exponential;color:#050505;density:0.1'}, root);

    // Ambient light only
    this.e('a-entity', {light:'type:ambient;color:#110808;intensity:0.5'}, root);
    this.e('a-entity', {position:'0 2 -3', light:'type:point;color:#ff2200;intensity:0.8;distance:6'}, root);

    // Title panel
    const titleBg = this.e('a-box', {position:'0 1.6 -3', width:3, height:1.5, depth:0.05, material:'color:#080808;opacity:0.95'}, root);
    this.e('a-text', {position:'0 1.9 -2.97', value:'SIGNAL 9', align:'center', color:'#cc2200', width:6, font:'https://cdn.aframe.io/fonts/Roboto-msdf.json'}, root);
    this.e('a-text', {position:'0 1.6 -2.97', value:'THE DEAD AIR ARCHIVE', align:'center', color:'#886644', width:2.5}, root);
    this.e('a-text', {position:'0 1.35 -2.97', value:'WDRK-TV  ◈  1997', align:'center', color:'#444', width:1.8}, root);

    // CRT next to menu for atmosphere
    this.buildCRT(root, '-1.5 1.2 -3', null, {crtDisplay:true, crtState:'static'});
    this.buildCRT(root, '1.5 1.2 -3', null, {crtDisplay:true, crtState:'logo'});

    // Menu buttons
    const menuItems = [
      {label:'▶  NEW GAME', y:1.1, action:'menuNewGame'},
      {label:'◈  CONTINUE', y:0.85, action:'menuContinue'},
      {label:'⚙  SETTINGS', y:0.6, action:'menuSettings'},
      {label:'✦  CREDITS', y:0.35, action:'menuCredits'}
    ];
    menuItems.forEach(item => {
      const btn = this.e('a-entity', {position:`0 ${item.y} -2.95`}, root);
      this.e('a-box', {width:1.8,height:0.18,depth:0.05, material:'color:#1a0a0a;opacity:0.9'}, btn);
      this.e('a-text', {value:item.label, align:'center', color:'#cc8866', width:2.5, position:'0 0 0.03'}, btn);
      btn.classList.add('interactive');
      btn.setAttribute('pressable', `action:${item.action}`);
    });

    // Settings panel (hidden by default)
    const settingsPanel = this.e('a-entity', {id:'settings-panel', visible:'false', position:'0 1.2 -2.8'}, root);
    this.e('a-box', {width:2,height:1.8,depth:0.05, material:'color:#0a0a0a;opacity:0.97'}, settingsPanel);
    this.e('a-text', {value:'SETTINGS', align:'center', color:'#cc2200', width:2.5, position:'0 0.8 0.03'}, settingsPanel);
    const settingItems = ['LOCOMOTION: SMOOTH', 'SNAP TURN: 30°', 'VIGNETTE: ON', 'SUBTITLES: ON', 'AUDIO: 80%'];
    settingItems.forEach((s,i) => {
      this.e('a-text', {value:s, align:'center', color:'#888', width:2, position:`0 ${0.5-i*0.2} 0.03`}, settingsPanel);
    });
    const closeBtn = this.e('a-entity', {position:'0 -0.7 0.03'}, settingsPanel);
    this.e('a-box', {width:0.8,height:0.15,depth:0.02, material:'color:#333'}, closeBtn);
    this.e('a-text', {value:'CLOSE', align:'center', color:'#888', width:1.5, position:'0 0 0.02'}, closeBtn);
    closeBtn.classList.add('interactive');
    closeBtn.setAttribute('pressable','action:closeSettings');

    // Credits panel
    const creditsPanel = this.e('a-entity', {id:'credits-panel', visible:'false', position:'0 1.2 -2.8'}, root);
    this.e('a-box', {width:2,height:1.2,depth:0.05, material:'color:#0a0a0a;opacity:0.97'}, creditsPanel);
    this.e('a-text', {value:'SIGNAL 9\nTHE DEAD AIR ARCHIVE\n\nA WebXR Horror Experience\nBuilt with A-Frame\n\nPress B to close', align:'center', color:'#664422', width:1.8, position:'0 0 0.03'}, creditsPanel);

    // Register menu actions
    this.actions.menuNewGame = () => {
      SIGNAL9.Save.clear();
      SIGNAL9.gameData = SIGNAL9.Save.load();
      SIGNAL9.currentMission = 1;
      SIGNAL9.gameData.currentMission = 1;
      SIGNAL9.Save.save(SIGNAL9.gameData);
      this.load(1);
    };
    this.actions.menuContinue = () => {
      const saved = SIGNAL9.Save.load();
      const m = saved.currentMission || 1;
      SIGNAL9.currentMission = m;
      SIGNAL9.gameData = saved;
      this.load(m);
    };
    this.actions.menuSettings = () => {
      const p = document.getElementById('settings-panel');
      if (p) p.setAttribute('visible', p.getAttribute('visible') === 'true' ? 'false' : 'true');
    };
    this.actions.menuCredits = () => {
      const p = document.getElementById('credits-panel');
      if (p) p.setAttribute('visible', p.getAttribute('visible') === 'true' ? 'false' : 'true');
    };
    this.actions.closeSettings = () => {
      const p = document.getElementById('settings-panel');
      if (p) p.setAttribute('visible','false');
    };

    // Floor decoration - old carpet
    this.e('a-box', {position:'0 0.01 0', width:8, height:0.02, depth:10, material:'color:#1a1208;roughness:0.99'}, root);
  },

  // ============================================================
  // MISSION 1: TONE TEST
  // ============================================================
  buildMission1(root) {
    this.buildBasementRoom(root);
    SIGNAL9.Audio.playTestTone(500);

    // Control console
    const console1 = this.e('a-entity', {position:'0 0.8 -3.5'}, root);
    this.e('a-box', {width:2.5,height:0.1,depth:0.8, material:'src:/assets/textures/metal.png;color:#555;metalness:0.7;roughness:0.4'}, console1);
    // Back panel
    this.e('a-box', {position:'0 0.6 -0.3', width:2.5,height:1.2,depth:0.1, material:'color:#444;metalness:0.5'}, console1);

    // Frequency display
    const freqDisplay = this.e('a-entity', {id:'freq-display', position:'0 0.8 0.21'}, console1);
    this.e('a-box', {width:0.6,height:0.2,depth:0.05, material:'color:#000'}, freqDisplay);
    this.e('a-text', {id:'freq-text', value:'500 Hz', align:'center', color:'#00ff00', width:0.5, position:'0 0 0.03'}, freqDisplay);

    // Tuning knob (main)
    const knob = this.e('a-entity', {id:'freq-knob', position:'-0.4 0.12 0.3'}, console1);
    this.e('a-cylinder', {radius:0.06,height:0.04, material:'color:#333;metalness:0.8'}, knob);
    this.e('a-box', {position:'0 0.03 0.04', width:0.01,height:0.06,depth:0.01, material:'color:#fff'}, knob); // indicator
    knob.setAttribute('knob-control','min:200;max:2000;value:500;step:25;targetId:freq-text');
    knob.classList.add('interactive');

    // Label
    this.e('a-text', {position:'-0.4 -0.04 0.35', value:'FREQ', align:'center', color:'#888', width:0.5}, console1);

    // CRT monitors (6+)
    const crtPositions = [
      '-3 1.5 -4', '-2 1.5 -4', '-1 1.5 -4',
      '1 1.5 -4', '2 1.5 -4', '3 1.5 -4'
    ];
    crtPositions.forEach((p,i) => this.buildCRT(root, p, `crt-m1-${i}`, {crtDisplay:i<2, crtState:'static'}));

    // Compliance checklist on wall
    const checklist = this.e('a-entity', {id:'wall-checklist', position:'-3.5 1.5 -2'}, root);
    this.e('a-plane', {width:1.2,height:1.5, material:`src:${SIGNAL9.Textures.paperChecklist};transparent:false`, rotation:'0 90 0'}, checklist);

    // Shelves and equipment
    this.buildShelf(root, '-3 1.8 -4.5', '0 90 0');
    this.buildShelf(root, '3 1.2 -4.5', '0 -90 0');
    this.buildPatchBay(root, '3.9 1.5 -2');
    this.buildSignalRack(root, '-3.8 1 0', 'signal-rack');
    this.buildVHSDeck(root, '0.5 0.85 -3.5', null);

    // Objective display
    this.e('a-text', {id:'objective-display', position:'0 2.7 -4.9', value:'MISSION 1: TONE TEST\nAdjust frequency knob to 1000 Hz\nGrab knob and use thumbstick', align:'center', color:'#cc8866', width:2.5}, root);

    // Completion check interval
    let completed = false;
    const check = setInterval(() => {
      const knobEl = document.getElementById('freq-knob');
      if (!knobEl) { clearInterval(check); return; }
      const kc = knobEl.components['knob-control'];
      if (kc && Math.abs(kc.data.value - 1000) < 30) {
        if (!completed) {
          completed = true;
          clearInterval(check);
          this._completeMission1();
        }
      }
    }, 500);

    // Horror: if player hasn't done it in 30s, subtle dim + pitch shift
    setTimeout(() => {
      if (!completed) {
        SIGNAL9.Presence.adjust(-10);
        SIGNAL9.Audio.setHumPitch(0.85);
      }
    }, 30000);
  },

  _completeMission1() {
    SIGNAL9.Audio.stopTestTone();
    SIGNAL9.Presence.adjust(15);
    const obj = document.getElementById('objective-display');
    if (obj) obj.setAttribute('text', 'value:CALIBRATION COMPLETE. ✓;color:#00ff00;align:center;width:2');
    // Transition after delay
    setTimeout(() => {
      SIGNAL9.gameData.currentMission = 2;
      SIGNAL9.Save.save(SIGNAL9.gameData);
      this.load(2);
    }, 3000);
  },

  // ============================================================
  // MISSION 2: CHILDREN'S HOUR
  // ============================================================
  buildMission2(root) {
    this.buildBasementRoom(root, {w:8, d:10, h:3});

    this.e('a-text', {position:'0 2.7 -4.9', id:'objective-display', value:"MISSION 2: CHILDREN'S HOUR\nPick up VHS tape, insert into deck\nCapture 3 broadcast segments", align:'center', color:'#cc8866', width:2.5}, root);

    // Main CRT (large)
    const mainCRT = this.e('a-entity', {position:'0 1.4 -4.5'}, root);
    this.e('a-box', {width:1.0,height:0.8,depth:0.6, material:'color:#1a1a1a;metalness:0.3'}, mainCRT);
    const mainScreen = this.e('a-box', {position:'0 0 0.31', width:0.88,height:0.68,depth:0.01}, mainCRT);
    mainScreen.id = 'main-screen';
    mainScreen.setAttribute('crt-display','state:off');
    mainScreen.setAttribute('material','color:#000;emissive:#000');
    // Screen glow light
    this.e('a-entity', {id:'screen-glow', position:'0 0 0.4', light:'type:point;color:#003300;intensity:0;distance:2'}, mainCRT);
    // Gaze detector on screen
    mainScreen.setAttribute('gaze-detector','radius:1');
    mainScreen.addEventListener('gazestart', () => {
      // Stabilize image
      mainScreen.setAttribute('crt-display','state:playing');
    });
    mainScreen.addEventListener('gazeend', () => {
      // Worse tracking
      mainScreen.setAttribute('crt-display','state:static');
    });

    // VHS Decks
    const deck = this.buildVHSDeck(root, '-0.4 1.05 -4.5', 'vhs-deck-m2');

    // VHS tape to pick up
    const tape = this.buildTape(root, '1.5 1.1 -3', 'vhs-tape-m2');
    // Tape label
    this.e('a-text', {value:"PUPPET HOUR\n1997-10-14", position:'0 0.07 0.06', rotation:'-90 0 0', color:'#333', width:0.5, align:'center'}, tape);

    // Other CRTs
    this.buildCRT(root, '-3 1.5 -4', null, {crtDisplay:true, crtState:'static'});
    this.buildCRT(root, '3 1.5 -4', null, {crtDisplay:true, crtState:'static'});
    this.buildCRT(root, '-2.5 1.2 -1', null, {crtDisplay:true, crtState:'logo'});

    // Shelves
    this.buildShelf(root, '-3.5 1.8 -4', '0 90 0');
    this.buildShelf(root, '-3.5 1.0 -4', '0 90 0');
    this.buildShelf(root, '3.5 1.5 -3', '0 -90 0');
    this.buildPatchBay(root, '3.9 1.5 0');
    this.buildSignalRack(root, '-3.8 1 2', 'signal-rack-2');

    // Segment tracker
    let segments = 0;
    const maxSegments = 3;
    let tapeInserted = false;

    this.actions.tapeInserted = () => {
      if (tapeInserted) return;
      tapeInserted = true;
      const deck2 = document.getElementById('vhs-deck-m2');
      if (deck2) {
        // Deck whirr sound
        SIGNAL9.Audio.startTapeDeck(-0.4, 1.05, -4.5);
        // Delay before play
        setTimeout(() => {
          const screen = document.getElementById('main-screen');
          if (screen) screen.setAttribute('crt-display', 'state: static');
          const glow = document.getElementById('screen-glow');
          if (glow) glow.setAttribute('light','type:point;color:#003300;intensity:0.4;distance:2');
          // Segment counter HUD
          this.e('a-text', {id:'seg-counter', position:'0 2.5 -4.9', value:'CAPTURING SEGMENT 1/3...', align:'center', color:'#ffaa00', width:2}, root);
          // Auto-progress segments
          this._progressSegments(0, maxSegments);
        }, 2000);
      }
    };

    this._progressSegments = (current, max) => {
      if (current >= max) {
        const sc = document.getElementById('seg-counter');
        if (sc) sc.setAttribute('text','value:ALL SEGMENTS CAPTURED ✓;color:#00ff00;align:center;width:2');
        setTimeout(() => {
          SIGNAL9.gameData.currentMission = 3;
          SIGNAL9.Save.save(SIGNAL9.gameData);
          this.load(3);
        }, 3000);
        return;
      }
      // Each segment takes ~8s
      setTimeout(() => {
        // Horror moment on segment 2
        if (current === 1) {
          SIGNAL9.Audio.startDeadAir();
          const screen = document.getElementById('main-screen');
          if (screen) {
            screen.setAttribute('crt-display','state:text');
            setTimeout(() => {
              SIGNAL9.Audio.endDeadAir();
              if (screen) screen.setAttribute('crt-display','state:playing');
              SIGNAL9.Presence.adjust(-15);
            }, 4000);
          }
        }
        const sc = document.getElementById('seg-counter');
        if (sc) sc.setAttribute('text',`value:CAPTURING SEGMENT ${current+1}/${max}...;color:#ffaa00;align:center;width:2`);
        this._progressSegments(current + 1, max);
      }, current === 1 ? 12000 : 8000);
    };

    // Maintenance elevator door
    const elev = this.e('a-entity', {position:'3.9 1.5 2.5'}, root);
    this.e('a-box', {width:1.2,height:2.8,depth:0.1, material:'src:/assets/textures/metal.png;color:#555;metalness:0.7'}, elev);
    this.e('a-box', {position:'0 0 0.06', width:0.6,height:2.6,depth:0.02, material:'color:#444;metalness:0.8'}, elev);
    this.e('a-box', {position:'0 0 0.06', width:0.6,height:2.6,depth:0.02, material:'color:#444;metalness:0.8'}, elev);
    this.e('a-text', {value:'MAINTENANCE\nACCESS ONLY', align:'center', color:'#cc2200', width:0.8, position:'0 0.3 0.12'}, elev);
    const warningEl = this.e('a-plane', {position:'0 -0.5 0.12', width:0.5, height:0.25, material:`src:${SIGNAL9.Textures.warningLabel}`}, elev);
  },

  // ============================================================
  // MISSION 3: BLUE LIGHT COMPLIANCE
  // ============================================================
  buildMission3(root) {
    // Rack hallway
    this.e('a-box', {position:'0 0 0', width:3, height:0.1, depth:12, material:'color:#1a1a1a'}, root); // floor
    this.e('a-box', {position:'0 3 0', width:3, height:0.1, depth:12, material:'color:#111'}, root); // ceiling
    this.e('a-box', {position:'-1.5 1.5 0', width:0.1, height:3, depth:12, material:'color:#222'}, root); // left wall
    this.e('a-box', {position:'1.5 1.5 0', width:0.1, height:3, depth:12, material:'color:#222'}, root); // right wall

    this.e('a-entity', {light:'type:ambient;color:#110808;intensity:0.2'}, root);

    // Racks along walls
    for (let z=-4; z<=4; z+=2) {
      this.buildSignalRack(root, `-1.4 1 ${z}`, null);
      this.buildSignalRack(root, `1.4 1 ${z}`, null);
    }

    // Emergency light
    const emergencyLight = this.e('a-sphere', {id:'emergency-light-m3', position:'0 2.8 0', radius:0.08, material:'color:#ff0000;emissive:#ff0000;emissiveIntensity:2'}, root);
    const emergencyPointLight = this.e('a-entity', {id:'em-light-pt', position:'0 2.8 0', light:'type:point;color:#ff0000;intensity:2;distance:8'}, root);

    // Objective
    this.e('a-text', {position:'0 2.5 -5.9', id:'objective-display', value:'MISSION 3: BLUE LIGHT COMPLIANCE\nEmergency light will turn BLUE.\nFollow compliance procedure.', align:'center', color:'#cc8866', width:2.5}, root);

    // Compliance checklist on wall
    const checklist = this.e('a-entity', {position:'-1.4 1.8 2'}, root);
    this.e('a-plane', {width:0.8,height:1.0, material:`src:${SIGNAL9.Textures.paperChecklist};rotation:0 90 0`}, checklist);

    // Head tilt monitor on camera
    const camera = document.querySelector('[camera]') || document.getElementById('player-camera');
    if (camera) {
      camera.setAttribute('head-tilt-monitor','');
      camera.addEventListener('lookdown', () => {
        if (this._blueEventActive) {
          // Correct compliance
          this._correctCompliance();
        }
      });
      camera.addEventListener('lookup', () => {
        if (this._blueEventActive) {
          // Violation - whisper
          SIGNAL9.Audio.playWhisper('Thank you for confirming ceiling integrity.');
          SIGNAL9.Presence.adjust(-10);
        }
      });
    }

    // Particle effect for dust
    this._blueEventActive = false;
    this._correctCompliance = () => {
      // Dust particles
      for (let i=0; i<20; i++) {
        const dust = this.e('a-sphere', {
          position:`${(Math.random()-0.5)*2} 3 ${(Math.random()-0.5)*4}`,
          radius:0.01 + Math.random()*0.02,
          material:'color:#888;opacity:0.6;transparent:true'
        }, root);
        dust.setAttribute('animation','property:position.y;to:0;dur:3000;easing:linear');
        setTimeout(() => { if(dust.parentNode) dust.parentNode.removeChild(dust); }, 3100);
      }
      // Sound - crawling above
      const crawlOsc = SIGNAL9.Audio.ctx.createOscillator();
      crawlOsc.frequency.value = 80;
      const crawlGain = SIGNAL9.Audio.ctx.createGain();
      crawlGain.gain.value = 0.05;
      crawlOsc.connect(crawlGain); crawlGain.connect(SIGNAL9.Audio.masterGain);
      crawlOsc.start(); crawlOsc.stop(SIGNAL9.Audio.ctx.currentTime + 3);
      SIGNAL9.Presence.adjust(10);
    };

    // Trigger blue event after 5 seconds
    setTimeout(() => {
      this._blueEventActive = true;
      // Change light to blue
      emergencyLight.setAttribute('material','color:#0044ff;emissive:#0044ff;emissiveIntensity:2');
      emergencyPointLight.setAttribute('light','type:point;color:#0044ff;intensity:2;distance:8');
      SIGNAL9.UI.showSubtitle('COMPLIANCE EVENT ACTIVE. LOOK DOWN.', 4000);
      // Entity presence - Shrek glimpsed at end of hallway with footsteps
      if (SIGNAL9.Entity) {
        SIGNAL9.Entity.showNear(0, 0, -5.5);
        setTimeout(() => { if (SIGNAL9.Entity) SIGNAL9.Entity.hide(); }, 4000);
      }

      // End event after 15s
      setTimeout(() => {
        this._blueEventActive = false;
        emergencyLight.setAttribute('material','color:#ff0000;emissive:#ff0000;emissiveIntensity:1');
        emergencyPointLight.setAttribute('light','type:point;color:#ff0000;intensity:1;distance:8');
        // Subtle rearrangement (props shift)
        const racks = root.querySelectorAll('[id]');
        // Trigger jumpscare before mission 4
        setTimeout(() => {
          SIGNAL9.gameData.currentMission = 4;
          SIGNAL9.Save.save(SIGNAL9.gameData);
          this.load(3.5); // jumpscare interstitial
        }, 3000);
      }, 15000);
    }, 5000);
  },

  // ============================================================
  // MISSION 4: ROOFTOP ALIGNMENT
  // ============================================================
  buildMission4(root) {
    // Rooftop - open sky, brutalist concrete
    this.e('a-sky', {color:'#0a0814'}, root);
    this.e('a-entity', {light:'type:ambient;color:#0a0814;intensity:0.4'}, root);
    // Moon
    this.e('a-entity', {position:'-5 8 -15', light:'type:point;color:#6677aa;intensity:0.3;distance:30'}, root);
    this.e('a-sphere', {position:'-5 8 -15', radius:0.8, material:'color:#ccccaa;emissive:#ccccaa;emissiveIntensity:0.3'}, root);

    // Rooftop surface
    this.e('a-box', {position:'0 0 0', width:14, height:0.2, depth:14, material:'color:#2a2a2a;roughness:0.9'}, root);
    // Concrete walls
    this.e('a-box', {position:'0 0.5 -7', width:14, height:1, depth:0.3, material:'color:#2a2a2a;roughness:0.8'}, root);
    this.e('a-box', {position:'0 0.5 7', width:14, height:1, depth:0.3, material:'color:#2a2a2a'}, root);
    this.e('a-box', {position:'-7 0.5 0', width:0.3, height:1, depth:14, material:'color:#2a2a2a'}, root);
    this.e('a-box', {position:'7 0.5 0', width:0.3, height:1, depth:14, material:'color:#2a2a2a'}, root);

    // Rooftop equipment
    this.e('a-box', {position:'-3 0.4 -3', width:1.2,height:0.8,depth:0.8, material:'src:/assets/textures/metal.png;color:#444;metalness:0.7'}, root); // HVAC unit
    this.e('a-box', {position:'3 0.4 -3', width:0.8,height:0.6,depth:0.8, material:'color:#333'}, root);

    // Signal dish assembly
    const dishBase = this.e('a-entity', {position:'0 0.1 -3.5', id:'dish-base'}, root);
    this.e('a-cylinder', {radius:0.15,height:0.8, material:'src:/assets/textures/metal.png;color:#555;metalness:0.8'}, dishBase); // mast
    const dishMount = this.e('a-entity', {id:'dish-mount', position:'0 0.6 0'}, dishBase);
    // Dish shape (cylinder as approximate dish)
    this.e('a-cylinder', {radius:0.8,height:0.05,open-ended:'false', material:'color:#aaa;metalness:0.5;side:double', rotation:'-45 0 0'}, dishMount);
    // Dish arm
    this.e('a-cylinder', {radius:0.04,height:0.7, position:'0 0 -0.4', rotation:'45 0 0', material:'color:#888'}, dishMount);

    // Crank mechanism
    const crankBase = this.e('a-entity', {position:'1.5 0.8 -3.5'}, root);
    this.e('a-box', {width:0.3,height:0.5,depth:0.3, material:'src:/assets/textures/metal.png;color:#444;metalness:0.7'}, crankBase);
    const crank = this.e('a-entity', {id:'dish-crank', position:'0 0.35 0.15'}, crankBase);
    this.e('a-cylinder', {radius:0.04,height:0.3, rotation:'90 0 0', material:'color:#555'}, crank);
    this.e('a-sphere', {position:'0 0 0.15', radius:0.07, material:'color:#333'}, crank);
    crank.setAttribute('crank','targetId:signal-meter');
    crank.classList.add('interactive');

    // Signal meter display
    const meterPanel = this.e('a-entity', {position:'1.5 1.5 -3.5'}, root);
    this.e('a-box', {width:0.4,height:0.3,depth:0.05, material:'color:#000'}, meterPanel);
    this.e('a-text', {id:'signal-meter-pct', value:'SIGNAL: 0%', align:'center', color:'#00ff00', width:0.5, position:'0 0 0.03'}, meterPanel);

    // Wind audio
    let windActive = true;
    const windOsc = SIGNAL9.Audio.ctx.createOscillator();
    windOsc.type = 'sawtooth'; windOsc.frequency.value = 200;
    const windFilter = SIGNAL9.Audio.ctx.createBiquadFilter();
    windFilter.type = 'bandpass'; windFilter.frequency.value = 500; windFilter.Q.value = 0.5;
    const windGain = SIGNAL9.Audio.ctx.createGain(); windGain.gain.value = 0.06;
    windOsc.connect(windFilter); windFilter.connect(windGain); windGain.connect(SIGNAL9.Audio.masterGain);
    windOsc.start();

    // Ghost hands
    const rHand = document.querySelector('[hand-controls="hand: right"]') ||
                  document.querySelector('[oculus-touch-controls="hand: right"]');
    if (rHand) rHand.setAttribute('ghost-hand','delay:500');

    let signalPct = 0;
    this.onCrank = (angle) => {
      signalPct = Math.min(100, Math.abs(angle % 360) / 3.6);
      const meter = document.getElementById('signal-meter-pct');
      if (meter) meter.setAttribute('text',`value:SIGNAL: ${Math.round(signalPct)}%;align:center;color:${signalPct>80?'#00ff00':signalPct>40?'#ffaa00':'#ff4400'};width:0.5`);
      // Rotate dish
      const dish = document.getElementById('dish-mount');
      if (dish) dish.setAttribute('rotation',`0 ${angle} 0`);

      if (signalPct >= 100 && windActive) {
        windActive = false;
        // Hard cut wind
        windGain.gain.setValueAtTime(0, SIGNAL9.Audio.ctx.currentTime);
        windOsc.stop(SIGNAL9.Audio.ctx.currentTime + 0.05);
        // 2 second silence then voice
        setTimeout(() => {
          SIGNAL9.UI.showSubtitle('Receiver calibrated.', 4000);
          SIGNAL9.Audio.playWhisper('Receiver calibrated.');
          // Complete
          setTimeout(() => {
            SIGNAL9.gameData.currentMission = 5;
            SIGNAL9.Save.save(SIGNAL9.gameData);
            this.load(5);
          }, 5000);
        }, 2000);
      }
    };

    this.e('a-text', {position:'0 2.5 -5', value:'MISSION 4: ROOFTOP ALIGNMENT\nTurn crank until signal reaches 100%', align:'center', color:'#cc8866', width:2.5}, root);

    // Some cables and equipment
    for (let i=0; i<6; i++) {
      this.e('a-box', {position:`${(Math.random()-0.5)*8} 0.15 ${(Math.random()-0.5)*8}`, width:0.05,height:0.1,depth:3+Math.random()*2, rotation:`0 ${Math.random()*90} 0`, material:'color:#111'}, root);
    }
    // Ventilation blocks
    for (let i=0; i<4; i++) {
      this.e('a-box', {position:`${-3+i*2} 0.35 3`, width:0.5,height:0.7,depth:0.5, material:'color:#333'}, root);
    }
  },

  // ============================================================
  // MISSION 5: STATION ID BOOTH
  // ============================================================
  buildMission5(root) {
    // Small recording booth
    this.e('a-box', {position:'0 0 0', width:5, height:0.1, depth:5, material:'color:#2a2a2a'}, root); // floor
    this.e('a-box', {position:'0 3 0', width:5, height:0.1, depth:5, material:'color:#1a1a1a'}, root); // ceiling
    // Foam walls
    for (let i=0; i<4; i++) {
      const angle = i * 90;
      const wall = this.e('a-entity', {position:`${Math.sin(angle*Math.PI/180)*2.5} 1.5 ${-Math.cos(angle*Math.PI/180)*2.5}`, rotation:`0 ${angle} 0`}, root);
      this.e('a-box', {width:5, height:3, depth:0.1, material:'color:#2a1a10;roughness:0.99'}, wall);
      // Acoustic foam texture - egg crate pattern
      for (let fx=0; fx<10; fx++) {
        for (let fy=0; fy<6; fy++) {
          this.e('a-box', {position:`${-2.2+fx*0.44} ${0.25+fy*0.44} 0.05`, width:0.3,height:0.3,depth:0.1, material:'color:#2d1a0e;roughness:1'}, wall);
        }
      }
    }
    this.e('a-entity', {light:'type:ambient;color:#331100;intensity:0.4'}, root);
    this.e('a-entity', {position:'0 2.8 0', light:'type:point;color:#ff8844;intensity:0.6;distance:5'}, root);

    // Recording light
    this.e('a-sphere', {id:'rec-light', position:'0 2.9 -2.4', radius:0.06, material:'color:#330000;emissive:#330000;emissiveIntensity:0'}, root);

    // Microphone on stand
    const micStand = this.e('a-entity', {position:'0 0.1 -1'}, root);
    this.e('a-cylinder', {radius:0.03,height:1.5, material:'color:#555;metalness:0.8'}, micStand);
    this.e('a-sphere', {position:'0 0.85 0', radius:0.08, material:'color:#333;metalness:0.5'}, micStand);
    // Windscreen
    this.e('a-sphere', {position:'0 0.85 0', radius:0.1, material:'color:#444;roughness:0.99;opacity:0.7;transparent:true'}, micStand);

    // Script display
    const scriptDisplay = this.e('a-entity', {position:'0 1.6 -1.5'}, root);
    this.e('a-box', {width:1.2,height:0.8,depth:0.05, material:'color:#001100'}, scriptDisplay);
    this.e('a-text', {id:'script-text', value:'YOU ARE LISTENING TO\nWDRK-TV SIGNAL 9.\nTHIS STATION IS ____.\nPRESS RECORD TO BEGIN.', align:'center', color:'#00cc00', width:1.8, position:'0 0 0.03'}, scriptDisplay);

    // Control panel
    const ctrlPanel = this.e('a-entity', {position:'0 0.9 -1.8'}, root);
    this.e('a-box', {width:1.2,height:0.3,depth:0.4, material:'color:#222;metalness:0.5'}, ctrlPanel);

    // RECORD button
    const recBtn = this.e('a-entity', {position:'-0.3 0.2 0.2'}, ctrlPanel);
    this.e('a-cylinder', {radius:0.07,height:0.04, material:'color:#cc0000'}, recBtn);
    this.e('a-text', {value:'REC', align:'center', color:'#fff', width:0.5, position:'0 0.04 0'}, recBtn);
    recBtn.classList.add('interactive');
    recBtn.setAttribute('pressable','action:startRecord');

    // COMPLY button
    const complyBtn = this.e('a-entity', {position:'-0.1 0.2 0.2', id:'comply-btn', visible:'false'}, ctrlPanel);
    this.e('a-box', {width:0.3,height:0.08,depth:0.06, material:'color:#004400'}, complyBtn);
    this.e('a-text', {value:'COMPLY', align:'center', color:'#00ff00', width:0.6, position:'0 0.05 0'}, complyBtn);
    complyBtn.classList.add('interactive');
    complyBtn.setAttribute('pressable','action:comply');

    // NAME IT button
    const nameBtn = this.e('a-entity', {position:'0.2 0.2 0.2', id:'nameit-btn', visible:'false'}, ctrlPanel);
    this.e('a-box', {width:0.3,height:0.08,depth:0.06, material:'color:#440000'}, nameBtn);
    this.e('a-text', {value:'NAME IT', align:'center', color:'#ff4400', width:0.6, position:'0 0.05 0'}, nameBtn);
    nameBtn.classList.add('interactive');
    nameBtn.setAttribute('pressable','action:nameIt');

    // Hover effect for NAME IT
    nameBtn.addEventListener('mouseenter', () => {
      SIGNAL9.Audio.playBreathing();
    });
    nameBtn.addEventListener('mouseleave', () => {
      SIGNAL9.Audio.stopBreathing();
    });

    // Timer / VU meter style
    this.e('a-text', {position:'0 2.5 -2.4', id:'objective-display', value:'MISSION 5: STATION ID BOOTH\nPress REC, then make your choice.', align:'center', color:'#cc8866', width:2.5}, root);

    let recording = false;
    let scriptChanged = false;

    this.actions.startRecord = () => {
      if (recording) return;
      recording = true;
      const recLight = document.getElementById('rec-light');
      if (recLight) recLight.setAttribute('material','color:#ff0000;emissive:#ff0000;emissiveIntensity:2');

      const scriptText = document.getElementById('script-text');
      if (scriptText) {
        scriptText.setAttribute('text','value:YOU ARE LISTENING TO\nWDRK-TV SIGNAL 9.\nTHIS STATION IS ____.\n▶ RECORDING...');
      }
      // Show choice buttons
      const cb = document.getElementById('comply-btn');
      const nb = document.getElementById('nameit-btn');
      if (cb) cb.setAttribute('visible','true');
      if (nb) nb.setAttribute('visible','true');

      // Script changes mid-way
      setTimeout(() => {
        if (!scriptChanged && recording) {
          scriptChanged = true;
          if (scriptText) {
            // Glitch effect
            scriptText.setAttribute('text','value:YOU ARE LISTENING TO\nW̷D̶R̸K̵-̷T̴V̶ ̸S̸I̴G̴N̴A̴L̵ ̵9̸.\nTHIS STATION IS ____.\nWHAT IS IT CALLED?');
          }
          SIGNAL9.Presence.adjust(-5);
          SIGNAL9.Audio.playBreathing();
          setTimeout(() => SIGNAL9.Audio.stopBreathing(), 4000);
        }
      }, 8000);
    };

    this.actions.comply = () => {
      recording = false;
      SIGNAL9.gameData.complianceScore = (SIGNAL9.gameData.complianceScore || 0) + 10;
      const scriptText = document.getElementById('script-text');
      if (scriptText) scriptText.setAttribute('text','value:STATION ID RECORDED.\nCOMPLIANCE CONFIRMED.\nPROCEEDING...');
      const recLight = document.getElementById('rec-light');
      if (recLight) recLight.setAttribute('material','color:#330000;emissive:#330000;emissiveIntensity:0');
      SIGNAL9.Audio.stopBreathing();
      setTimeout(() => {
        SIGNAL9.gameData.currentMission = 6;
        SIGNAL9.Save.save(SIGNAL9.gameData);
        this.load(6);
      }, 3000);
    };

    this.actions.nameIt = () => {
      recording = false;
      SIGNAL9.gameData.namedIt = true;
      SIGNAL9.Presence.adjust(-20);
      const scriptText = document.getElementById('script-text');
      if (scriptText) scriptText.setAttribute('text','value:IDENTIFICATION LOGGED.\nYou have helped it transmit.\nPROCEEDING...');
      const recLight = document.getElementById('rec-light');
      if (recLight) recLight.setAttribute('material','color:#330000;emissive:#330000;emissiveIntensity:0');
      SIGNAL9.Audio.stopBreathing();
      // Shimmer effect
      const scene = document.querySelector('a-scene');
      if (scene) {
        scene.setAttribute('fog','type:exponential;color:#110000;density:0.05');
        setTimeout(() => scene.setAttribute('fog','type:none'), 2000);
      }
      setTimeout(() => {
        SIGNAL9.gameData.currentMission = 6;
        SIGNAL9.Save.save(SIGNAL9.gameData);
        this.load(6);
      }, 3000);
    };
  },

  // ============================================================
  // MISSION 6: DEAD AIR FINAL
  // ============================================================
  buildMission6(root) {
    this.buildBasementRoom(root, {w:6, d:8, h:3});

    this.e('a-text', {position:'0 2.6 -3.9', id:'objective-display', value:'MISSION 6: DEAD AIR\nKeep all dials in GREEN ZONE for 90 seconds.\nSIGNAL 9 MUST REMAIN ON AIR.', align:'center', color:'#cc8866', width:2.5}, root);

    // Main CRT (face-noise)
    const mainCRT = this.buildCRT(root, '0 1.5 -3.9', 'final-crt', {crtDisplay:true, crtState:'logo'});

    // Control panel with 3 dials
    const panel = this.e('a-entity', {position:'0 0.9 -2.5'}, root);
    this.e('a-box', {width:2,height:0.4,depth:0.5, material:'color:#222;metalness:0.5'}, panel);

    const dialLabels = ['GAIN', 'SYNC', 'PHASE'];
    const dialIds = ['dial-gain', 'dial-sync', 'dial-phase'];
    dialIds.forEach((id, i) => {
      const dPos = `${-0.6+i*0.6} 0.3 0.25`;
      const dial = this.e('a-entity', {id, position:dPos}, panel);
      this.e('a-cylinder', {radius:0.07,height:0.05, material:'color:#444;metalness:0.7'}, dial);
      this.e('a-box', {position:'0 0.04 0.05', width:0.01,height:0.05,depth:0.01, material:'color:#fff'}, dial);
      this.e('a-text', {value:dialLabels[i], align:'center', color:'#666', width:0.6, position:'0 -0.1 0'}, dial);
      dial.setAttribute('dial-control',`axis:x;min:0;max:100;value:50;targetId:${id}-indicator`);
      dial.classList.add('interactive');
      // Indicator LED
      this.e('a-sphere', {id:`${id}-indicator`, position:'0 0.1 0', radius:0.03, material:'color:#00ff00;emissive:#00ff00;emissiveIntensity:1'}, dial);
    });

    // Green zone indicators
    this.e('a-text', {position:'0 0.65 -2.25', value:'[════ GREEN ZONE ════]', align:'center', color:'#00ff00', width:2}, panel);

    // DESCRIBE IT button
    const descBtn = this.e('a-entity', {position:'0.7 1.2 -2.5'}, root);
    this.e('a-box', {width:0.4,height:0.15,depth:0.1, material:'color:#220000'}, descBtn);
    this.e('a-text', {value:'DESCRIBE IT', align:'center', color:'#aa4422', width:0.8, position:'0 0 0.06'}, descBtn);
    descBtn.classList.add('interactive');
    descBtn.setAttribute('pressable','action:describeIt');

    // Pull the plug (rack behind)
    this.buildSignalRack(root, '-2.8 1 -1', 'pull-rack');
    const plugHandle = this.e('a-entity', {position:'-2.8 1.5 -0.7', id:'plug-handle'}, root);
    this.e('a-box', {width:0.15,height:0.15,depth:0.3, material:'color:#cc4400'}, plugHandle);
    this.e('a-text', {value:'EMERGENCY\nPOWER', align:'center', color:'#fff', width:0.4, position:'0 0.15 0'}, plugHandle);
    plugHandle.classList.add('interactive');
    plugHandle.setAttribute('pressable','action:pullPlug');

    // Clue text panel (hidden)
    const cluePanel = this.e('a-entity', {id:'clue-panel', position:'-2.8 2.2 -1', visible:'false'}, root);
    this.e('a-box', {width:0.8,height:0.4,depth:0.05, material:'color:#000'}, cluePanel);
    this.e('a-text', {value:'IT ARRIVED ON CH.9\n1987-10-31\nSTAFF SAW NOTHING.', align:'center', color:'#00cc00', width:1, position:'0 0 0.03'}, cluePanel);

    // Instability tracking
    let instability = 0;
    let timeRemaining = 90;
    let timerActive = true;

    const timerDisplay = this.e('a-text', {id:'timer-display', position:'0 2.4 -3.9', value:'TIME: 90s', align:'center', color:'#00ff00', width:2}, root);

    const gameTimer = setInterval(() => {
      if (!timerActive) { clearInterval(gameTimer); return; }
      timeRemaining--;
      const td = document.getElementById('timer-display');
      if (td) td.setAttribute('text',`value:TIME: ${timeRemaining}s;align:center;color:${timeRemaining>30?'#00ff00':timeRemaining>10?'#ffaa00':'#ff4400'};width:2`);

      // Random instability
      instability += Math.random() * 3;
      if (instability > 20) {
        // Flicker crt
        const fcrt = document.getElementById('final-crt');
        if (fcrt) {
          const screen = fcrt.querySelector('[crt-display]');
          if (screen) {
            screen.setAttribute('crt-display','state:face');
            setTimeout(() => {
              if (screen) screen.setAttribute('crt-display','state:logo');
            }, 500);
          }
        }
        instability = 0;
        SIGNAL9.Presence.adjust(-3);
      }

      if (timeRemaining <= 0) {
        timerActive = false;
        clearInterval(gameTimer);
        // Determine ending
        const endingType = SIGNAL9.gameData.namedIt ? 'identification' : 'compliance';
        SIGNAL9.gameData.endingType = endingType;
        SIGNAL9.gameData.currentMission = 7;
        SIGNAL9.Save.save(SIGNAL9.gameData);
        this.load(7);
      }
    }, 1000);

    this.onDialChange = (id, val) => {
      const norm = Math.abs(val - 50) / 50;
      const inGreen = norm < 0.3;
      const ind = document.getElementById(`${id}-indicator`);
      if (ind) {
        const col = inGreen ? '#00ff00' : norm < 0.6 ? '#ffaa00' : '#ff4400';
        ind.setAttribute('material',`color:${col};emissive:${col};emissiveIntensity:1`);
      }
      if (!inGreen) instability += 2;
    };

    this.actions.describeIt = () => {
      instability += 15;
      SIGNAL9.Presence.adjust(-10);
      const clue = document.getElementById('clue-panel');
      if (clue) clue.setAttribute('visible','true');
      SIGNAL9.UI.showSubtitle('Describing increases instability. Hidden truth revealed.', 4000);
    };

    this.actions.pullPlug = () => {
      timerActive = false;
      clearInterval(gameTimer);
      SIGNAL9.gameData.endingType = 'pulltheplug';
      SIGNAL9.gameData.currentMission = 7;
      SIGNAL9.Save.save(SIGNAL9.gameData);
      this.load(7);
    };

    // Other atmosphere props
    this.buildCRT(root, '-2 1.5 -3.5', null, {crtDisplay:true, crtState:'static'});
    this.buildCRT(root, '2 1.5 -3.5', null, {crtDisplay:true, crtState:'static'});
    this.buildShelf(root, '2.9 1.5 -2', '0 -90 0');
  },


  // ============================================================
  // JUMPSCARE INTERSTITIAL
  // Shrek appears directly in front, shakes, screams.
  // Plays between mission 3 and 4.
  // ============================================================
  buildJumpscare(root) {
    // Dark void room
    this.e('a-sky', {color:'#000000'}, root);
    this.e('a-entity', {light:'type:ambient;color:#110000;intensity:0.2'}, root);
    this.e('a-entity', {position:'0 2 -1', light:'type:point;color:#ff1100;intensity:1;distance:5'}, root);
    this.e('a-box', {position:'0 0 0', width:6,height:0.1,depth:6, material:'color:#0a0000'}, root);

    // Warning text flash
    const warn = this.e('a-text', {
      position:'0 2.5 -3',
      value:'SIGNAL BREACH DETECTED',
      align:'center', color:'#ff0000', width:3
    }, root);

    // Trigger jumpscare after 1 second
    setTimeout(() => {
      if (SIGNAL9.Entity) {
        SIGNAL9.Entity.triggerJumpscare(() => {
          // After scare: show "proceeding" text, then go to mission 4
          if (warn) warn.setAttribute('text','value:SIGNAL RESTORED. PROCEEDING...;color:#00ff00;align:center;width:3');
          setTimeout(() => {
            this.load(4);
          }, 2000);
        });
      } else {
        // Fallback if Entity manager not ready
        setTimeout(() => this.load(4), 3000);
      }
    }, 1200);

    // Also show Shrek somewhere in the environment for atmosphere
    // (the triggerJumpscare call handles the actual in-face positioning)
  },

  // ============================================================
  // ENDINGS
  // ============================================================
  buildEnding(root, type) {
    SIGNAL9.Audio.startDeadAir();
    this.e('a-sky', {color:'#000000'}, root);
    this.e('a-entity', {light:'type:ambient;color:#111111;intensity:0.3'}, root);

    if (type === 'compliance') {
      // Dawn - soft orange light
      this.e('a-sky', {color:'#0a0503'}, root);
      this.e('a-entity', {position:'0 10 -20', light:'type:directional;color:#ff8844;intensity:0.5'}, root);
      this.e('a-box', {position:'0 0 0', width:10, height:0.1, depth:10, material:'color:#1a0f0a'}, root);
      this.e('a-entity', {position:'0 2 -4', light:'type:point;color:#ff8844;intensity:0.4;distance:8'}, root);

      // The poster
      const posterBoard = this.e('a-entity', {position:'0 1.8 -3'}, root);
      this.e('a-box', {width:1,height:1.4,depth:0.05, material:'color:#e8d8a0'}, posterBoard);
      this.e('a-text', {value:'WDRK-TV STAFF 1987\n\n[FACE DETECTED]\nEMPLOYEE OF THE MONTH\n\nCOMPLIANCE COMMENDED', align:'center', color:'#333', width:1.5, position:'0 0 0.04'}, posterBoard);
      this.e('a-plane', {position:'0 0.1 0.04', width:0.4,height:0.5, material:'color:#c09060;opacity:0.8'}, posterBoard);
      this.e('a-text', {value:'DATED: OCT 1987', align:'center', color:'#443322', width:0.8, position:'0 -0.55 0.04'}, posterBoard);

      this.e('a-text', {position:'0 3 -4', value:'ENDING A: COMPLIANCE\n\nYou never named it.\nThe station continued.\nYour face is dated 1987.\n\nThank you for your service.', align:'center', color:'#886633', width:2.5}, root);
      SIGNAL9.UI.showSubtitle('ENDING A: COMPLIANCE', 8000);

    } else if (type === 'identification') {
      // Scanline shimmer world
      this.e('a-sky', {color:'#000511'}, root);
      this.e('a-entity', {light:'type:ambient;color:#000511;intensity:0.4'}, root);
      this.e('a-entity', {position:'0 2 -4', light:'type:point;color:#0044ff;intensity:1;distance:8'}, root);
      this.e('a-box', {position:'0 0 0', width:10,height:0.1,depth:10, material:'color:#000211'}, root);

      // Transmission beam
      this.e('a-cylinder', {position:'0 5 -5', radius:0.3,height:10, material:'color:#0044ff;opacity:0.1;transparent:true'}, root);
      this.e('a-entity', {position:'0 5 -5', light:'type:point;color:#0044ff;intensity:2;distance:15'}, root);

      this.e('a-text', {position:'0 2.5 -4', value:'ENDING B: IDENTIFICATION\n\nYou named it.\nNow it can transmit.\nThe world has changed.\n\n"You\'ve helped it transmit."', align:'center', color:'#4466cc', width:2.5}, root);
      SIGNAL9.UI.showSubtitle('ENDING B: IDENTIFICATION — You have helped it transmit.', 8000);
      // Add scanline overlay to everything
      SIGNAL9.Presence.adjust(-100);

    } else if (type === 'pulltheplug') {
      // Jitter
      this.e('a-sky', {color:'#0a0000'}, root);
      this.e('a-entity', {light:'type:ambient;color:#220000;intensity:0.3'}, root);
      this.e('a-entity', {position:'0 2 -3', light:'type:point;color:#ff2200;intensity:0.6;distance:8'}, root);
      this.e('a-box', {position:'0 0 0', width:10,height:0.1,depth:10, material:'color:#1a0000'}, root);

      // Emergency battery rack
      this.buildSignalRack(root, '0 1 -3', null);
      this.e('a-sphere', {id:'em-bat-light', position:'0 1.1 -2.7', radius:0.06, material:'color:#ff4400;emissive:#ff4400;emissiveIntensity:2'}, root);

      // Jitter camera component
      const rig = document.getElementById('rig');
      if (rig) {
        const jitter = () => {
          if (!rig.parentNode) return;
          const rot = rig.getAttribute('rotation') || {x:0,y:0,z:0};
          rig.setAttribute('rotation', {
            x: rot.x + (Math.random()-0.5)*2,
            y: rot.y + (Math.random()-0.5)*2,
            z: rot.z + (Math.random()-0.5)*1
          });
          setTimeout(jitter, 100 + Math.random()*200);
        };
        jitter();
      }

      this.e('a-text', {position:'0 2.5 -3.5', value:"ENDING C: PULL THE PLUG\n\nEmergency battery activated.\nYou cannot stop it.\nTracking error: permanent.\n\nThe station remains on air.", align:'center', color:'#cc2200', width:2.5}, root);
      SIGNAL9.UI.showSubtitle('ENDING C: PULL THE PLUG — Tracking error: permanent.', 8000);
    }

    // Restart button
    const restartBtn = this.e('a-entity', {position:'0 0.5 -3'}, root);
    this.e('a-box', {width:1,height:0.18,depth:0.1, material:'color:#1a0a0a'}, restartBtn);
    this.e('a-text', {value:'↩  RETURN TO MENU', align:'center', color:'#886644', width:2, position:'0 0 0.06'}, restartBtn);
    restartBtn.classList.add('interactive');
    restartBtn.setAttribute('pressable','action:returnToMenu');
    this.actions.returnToMenu = () => {
      SIGNAL9.currentMission = 0;
      this.load(0);
    };
  }
};

console.log('[SIGNAL9] scenes.js loaded');
