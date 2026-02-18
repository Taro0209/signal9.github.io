// SIGNAL 9: SCENES + A-FRAME COMPONENTS v3
// Maze world, Shrek AI roaming, working analog stick locomotion

// ============================================================
// MAZE DEFINITION
// 1 = wall, 0 = floor/open  —  17x17 grid, each cell = 2 units
// ============================================================
SIGNAL9.MAZE = {
  CELL: 2,
  WALL_H: 3,
  WALL_COLOR: '#ccaa00',
  FLOOR_COLOR: '#1a1a0a',
  CEIL_COLOR:  '#111100',

  grid: [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1],
    [1,0,1,0,1,0,1,1,1,0,1,0,1,1,1,0,1],
    [1,0,1,0,0,0,0,0,1,0,0,0,1,0,0,0,1],
    [1,0,1,1,1,1,1,0,1,1,1,0,1,0,1,1,1],
    [1,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,1],
    [1,1,1,0,1,0,1,1,1,0,1,1,1,0,1,0,1],
    [1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,1,1,1,0,1,1,1,1,1,0,1,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,0,1,0,1,0,1],
    [1,1,1,0,1,0,1,1,1,0,1,0,1,0,1,0,1],
    [1,0,0,0,1,0,0,0,1,0,1,0,0,0,1,0,1],
    [1,0,1,1,1,0,1,0,1,0,1,1,1,1,1,0,1],
    [1,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,0,1,1,1,1,1,0,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ],

  toWorld(row, col) {
    const ox = -(this.grid[0].length * this.CELL) / 2 + this.CELL / 2;
    const oz = -(this.grid.length    * this.CELL) / 2 + this.CELL / 2;
    return { x: ox + col * this.CELL, z: oz + row * this.CELL };
  },

  openCells() {
    const cells = [];
    for (let r = 0; r < this.grid.length; r++)
      for (let c = 0; c < this.grid[r].length; c++)
        if (this.grid[r][c] === 0) cells.push({r, c});
    return cells;
  },

  isWall(wx, wz) {
    const ox = -(this.grid[0].length * this.CELL) / 2;
    const oz = -(this.grid.length    * this.CELL) / 2;
    const col = Math.floor((wx - ox) / this.CELL);
    const row = Math.floor((wz - oz) / this.CELL);
    if (row < 0 || row >= this.grid.length || col < 0 || col >= this.grid[0].length) return true;
    return this.grid[row][col] === 1;
  }
};

// ============================================================
// MAZE BUILDER
// ============================================================
SIGNAL9.MazeBuilder = {
  build(parent) {
    const M  = SIGNAL9.MAZE;
    const rows = M.grid.length, cols = M.grid[0].length;
    const C = M.CELL, H = M.WALL_H;
    const fw = cols * C, fd = rows * C;

    // Floor
    const floor = document.createElement('a-box');
    floor.setAttribute('width', fw); floor.setAttribute('height', 0.1); floor.setAttribute('depth', fd);
    floor.setAttribute('position', '0 0 0');
    floor.setAttribute('material', `color:${M.FLOOR_COLOR};roughness:0.95`);
    parent.appendChild(floor);

    // Ceiling
    const ceil = document.createElement('a-box');
    ceil.setAttribute('width', fw); ceil.setAttribute('height', 0.1); ceil.setAttribute('depth', fd);
    ceil.setAttribute('position', `0 ${H} 0`);
    ceil.setAttribute('material', `color:${M.CEIL_COLOR};roughness:0.9`);
    parent.appendChild(ceil);

    // Ambient light
    const amb = document.createElement('a-entity');
    amb.setAttribute('light', 'type:ambient;color:#332200;intensity:0.35');
    parent.appendChild(amb);

    // Scatter ceiling lights through open cells
    M.openCells().filter((_,i) => i % 14 === 0).forEach(cell => {
      const wp = M.toWorld(cell.r, cell.c);
      const le = document.createElement('a-entity');
      le.setAttribute('position', `${wp.x} ${H-0.2} ${wp.z}`);
      le.setAttribute('light', 'type:point;color:#ffcc44;intensity:0.55;distance:7;decay:2');
      const bulb = document.createElement('a-sphere');
      bulb.setAttribute('radius', '0.07');
      bulb.setAttribute('material', 'color:#ffee88;emissive:#ffcc44;emissiveIntensity:1');
      le.appendChild(bulb);
      parent.appendChild(le);
    });

    // Wall boxes
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (M.grid[r][c] !== 1) continue;
        const wp = M.toWorld(r, c);
        const wall = document.createElement('a-box');
        wall.setAttribute('width', C); wall.setAttribute('height', H); wall.setAttribute('depth', C);
        wall.setAttribute('position', `${wp.x} ${H/2} ${wp.z}`);
        wall.setAttribute('material', `color:${M.WALL_COLOR};roughness:0.5;metalness:0.1;emissive:#221a00;emissiveIntensity:0.2`);
        wall.classList.add('maze-wall');
        parent.appendChild(wall);
      }
    }

    // Scatter props through open cells
    this._scatterProps(parent, M.openCells());
  },

  _scatterProps(parent, openCells) {
    const M  = SIGNAL9.MAZE;
    const S  = SIGNAL9.Scenes;
    const shuffled = [...openCells].sort(() => Math.random() - 0.5).slice(0, 20);
    shuffled.forEach((cell, i) => {
      const wp = M.toWorld(cell.r, cell.c);
      const x  = wp.x + (Math.random() - 0.5) * 0.5;
      const z  = wp.z + (Math.random() - 0.5) * 0.5;
      if      (i % 4 === 0) { // CRT on crate
        const crate = document.createElement('a-box');
        crate.setAttribute('position', `${x} 0.4 ${z}`);
        crate.setAttribute('width', '0.5'); crate.setAttribute('height', '0.8'); crate.setAttribute('depth', '0.5');
        crate.setAttribute('material', 'color:#2a2a00;roughness:0.9');
        parent.appendChild(crate);
        S.buildCRT(parent, `${x} 1.25 ${z}`, null, {crtDisplay:true, crtState:'static'});
      } else if (i % 4 === 1) { // Shelf
        const shelf = document.createElement('a-entity');
        shelf.setAttribute('position', `${x} 1.2 ${z}`);
        shelf.setAttribute('rotation', `0 ${Math.floor(Math.random()*4)*90} 0`);
        parent.appendChild(shelf);
        S.buildShelf(shelf, '0 0 0');
      } else if (i % 4 === 2) { // Barrel
        const barrel = document.createElement('a-cylinder');
        barrel.setAttribute('position', `${x} 0.5 ${z}`);
        barrel.setAttribute('radius', '0.2'); barrel.setAttribute('height', '1');
        barrel.setAttribute('material', 'color:#334400;roughness:0.7;metalness:0.4');
        parent.appendChild(barrel);
      } else { // VHS deck
        S.buildVHSDeck(parent, `${x} 0.2 ${z}`, null);
      }
    });
  }
};

// ============================================================
// SHREK AI ROAMER
// Random-walk through maze, detects player for footsteps + jumpscare
// ============================================================
SIGNAL9.ShrekAI = {
  active: false,
  pos: { x: 0, z: 0 },
  targetPos: null,
  speed: 1.8,
  detectionRadius: 4.0,
  jumpscareRadius: 1.5,
  _jumpscareTriggered: false,
  _footstepsCooldown: false,
  _ticker: null,
  _wpTimer: null,

  start() {
    if (this.active) return;
    this.active = true;
    this._jumpscareTriggered = false;
    this._footstepsCooldown  = false;

    // Spawn far from player start (top-right area of maze)
    const open   = SIGNAL9.MAZE.openCells().filter(c => c.r > 8 && c.c > 8);
    const spawn  = open[Math.floor(Math.random() * open.length)];
    const wp     = SIGNAL9.MAZE.toWorld(spawn.r, spawn.c);
    this.pos     = { x: wp.x, z: wp.z };

    const shrek  = document.getElementById('shrek-entity');
    if (shrek) {
      shrek.setAttribute('position', `${this.pos.x} 0 ${this.pos.z}`);
      shrek.setAttribute('scale', '1 1 1');
      shrek.setAttribute('visible', 'true');
    }

    this._pickWaypoint();
    this._ticker = setInterval(() => this._tick(), 50);
  },

  stop() {
    this.active = false;
    if (this._ticker) { clearInterval(this._ticker);  this._ticker = null; }
    if (this._wpTimer) { clearTimeout(this._wpTimer); this._wpTimer = null; }
    const shrek = document.getElementById('shrek-entity');
    if (shrek) shrek.setAttribute('visible', 'false');
  },

  _pickWaypoint() {
    if (!this.active) return;
    const M    = SIGNAL9.MAZE;
    const rig  = document.getElementById('rig');
    const open = M.openCells();
    let cell;

    if (rig && Math.random() < 0.5) {
      // Drift toward player
      const rp = rig.getAttribute('position') || {x:0,z:0};
      let best = open[0], bestScore = Infinity;
      open.forEach(c => {
        const wp = M.toWorld(c.r, c.c);
        const d  = Math.hypot(wp.x - rp.x, wp.z - rp.z);
        const score = Math.abs(d - 5); // target ~5 units away
        if (score < bestScore) { bestScore = score; best = c; }
      });
      cell = best;
    } else {
      cell = open[Math.floor(Math.random() * open.length)];
    }

    const dest = M.toWorld(cell.r, cell.c);
    this.targetPos = { x: dest.x, z: dest.z };
    this._wpTimer  = setTimeout(() => this._pickWaypoint(), 3000 + Math.random() * 6000);
  },

  _tick() {
    if (!this.active || !this.targetPos) return;
    const shrek = document.getElementById('shrek-entity');
    if (!shrek) return;

    const dt  = 0.05;
    const dx  = this.targetPos.x - this.pos.x;
    const dz  = this.targetPos.z - this.pos.z;
    const d   = Math.hypot(dx, dz);

    if (d > 0.15) {
      const step = this.speed * dt;
      const nx   = this.pos.x + (dx / d) * step;
      const nz   = this.pos.z + (dz / d) * step;
      if (!SIGNAL9.MAZE.isWall(nx, nz)) {
        this.pos.x = nx; this.pos.z = nz;
      } else {
        this._pickWaypoint();
      }
      const angle = Math.atan2(dx, dz) * (180 / Math.PI);
      shrek.setAttribute('position', `${this.pos.x} 0 ${this.pos.z}`);
      shrek.setAttribute('rotation', `0 ${angle} 0`);
    }

    // Player proximity
    const rig = document.getElementById('rig');
    if (!rig) return;
    const rp = rig.getAttribute('position') || {x:0,y:0,z:0};
    const pd = Math.hypot(rp.x - this.pos.x, rp.z - this.pos.z);

    // Footsteps
    if (pd < this.detectionRadius && !this._footstepsCooldown) {
      this._footstepsCooldown = true;
      SIGNAL9.GameAudio.playFootsteps(this.pos);
      setTimeout(() => { this._footstepsCooldown = false; }, 5000);
    }

    // Jumpscare
    if (pd < this.jumpscareRadius && !this._jumpscareTriggered) {
      this._jumpscareTriggered = true;
      this.stop();
      if (SIGNAL9.Entity) {
        SIGNAL9.Entity.triggerJumpscare(() => {
          setTimeout(() => {
            if (SIGNAL9.currentMission >= 1 && SIGNAL9.currentMission <= 6) {
              this._jumpscareTriggered = false;
              this.start();
            }
          }, 4000);
        });
      }
    }
  }
};

// ============================================================
// A-FRAME COMPONENTS
// ============================================================

// Knob
AFRAME.registerComponent('knob-control', {
  schema: { min:{default:200}, max:{default:2000}, value:{default:1000}, step:{default:25}, targetId:{default:''} },
  init() {
    this.held = false;
    this.el.classList.add('interactive');
    this.el.addEventListener('gripdown', () => { this.held = true; });
    this.el.addEventListener('gripup',   () => { this.held = false; });
    this.el.addEventListener('thumbstickmoved', e => {
      if (!this.held) return;
      this.data.value = Math.max(this.data.min, Math.min(this.data.max, this.data.value - e.detail.y * this.data.step));
      const t = document.getElementById(this.data.targetId);
      if (t) t.setAttribute('text', `value:${Math.round(this.data.value)} Hz;color:#00ff00;align:center;width:0.5`);
      if (SIGNAL9.Audio.ctx) SIGNAL9.Audio.playTestTone(this.data.value);
      this.el.setAttribute('rotation', `0 0 ${((this.data.value-this.data.min)/(this.data.max-this.data.min))*270-135}`);
    });
  }
});

// Pressable button
AFRAME.registerComponent('pressable', {
  schema: { action:{default:''} },
  init() {
    this.el.classList.add('interactive');
    this.el.addEventListener('triggerdown', () => {
      this.el.setAttribute('scale','0.9 0.9 0.9');
      setTimeout(() => this.el.setAttribute('scale','1 1 1'), 150);
      const fn = SIGNAL9.Scenes.actions[this.data.action];
      if (fn) fn(this.el);
    });
  }
});

// Grabbable
AFRAME.registerComponent('grabbable', {
  schema: { itemType:{default:'generic'} },
  init() {
    this.held = false;
    this.el.classList.add('interactive');
    this.el.addEventListener('gripdown', () => {
      if (this.held) return;
      this.held     = true;
      this._origPar = this.el.parentNode;
      this._origPos = {...(this.el.getAttribute('position') || {x:0,y:0,z:0})};
      const ctrl = document.querySelector('[hand-controls="hand: right"]') ||
                   document.querySelector('[oculus-touch-controls="hand: right"]');
      if (ctrl) ctrl.appendChild(this.el);
      this.el.setAttribute('position','0 0 -0.1');
      SIGNAL9.inventory[this.data.itemType] = this.el;
    });
    this.el.addEventListener('gripup', () => {
      if (!this.held) return;
      this.held = false;
      if (this._origPar) this._origPar.appendChild(this.el);
      this.el.setAttribute('position', this._origPos);
      SIGNAL9.inventory[this.data.itemType] = null;
    });
  }
});

// VHS slot
AFRAME.registerComponent('vhs-slot', {
  init() {
    this.hasTape = false;
    this.el.classList.add('interactive');
    this.el.addEventListener('triggerdown', () => {
      if (this.hasTape || !SIGNAL9.inventory.tape) return;
      this.hasTape = true;
      if (SIGNAL9.inventory.tape) SIGNAL9.inventory.tape.setAttribute('visible','false');
      SIGNAL9.inventory.tape = null;
      const fn = SIGNAL9.Scenes.actions.tapeInserted;
      if (fn) fn();
    });
  }
});

// Dial
AFRAME.registerComponent('dial-control', {
  schema: { min:{default:0}, max:{default:100}, value:{default:50}, targetId:{default:''} },
  init() {
    this.held = false;
    this.el.classList.add('interactive');
    this.el.addEventListener('gripdown', () => { this.held = true; });
    this.el.addEventListener('gripup',   () => { this.held = false; });
    this.el.addEventListener('thumbstickmoved', e => {
      if (!this.held) return;
      this.data.value = Math.max(this.data.min, Math.min(this.data.max, this.data.value + e.detail.x * 2));
      const norm = (this.data.value - this.data.min) / (this.data.max - this.data.min);
      this.el.setAttribute('rotation', `0 0 ${norm*270-135}`);
      if (SIGNAL9.Scenes.onDialChange) SIGNAL9.Scenes.onDialChange(this.data.targetId, this.data.value);
    });
  }
});

// Crank
AFRAME.registerComponent('crank', {
  init() {
    this.held = false; this.angle = 0;
    this.el.classList.add('interactive');
    this.el.addEventListener('gripdown', () => { this.held = true; });
    this.el.addEventListener('gripup',   () => { this.held = false; });
    this.el.addEventListener('thumbstickmoved', e => {
      if (!this.held) return;
      this.angle += e.detail.x * 5;
      this.el.setAttribute('rotation', `0 ${this.angle} 0`);
      if (SIGNAL9.Scenes.onCrank) SIGNAL9.Scenes.onCrank(this.angle);
    });
  }
});

// Head tilt
AFRAME.registerComponent('head-tilt-monitor', {
  init() { this.ld = false; this.lu = false; },
  tick() {
    const cam = document.querySelector('[camera]'); if (!cam) return;
    const dir = new THREE.Vector3(); cam.object3D.getWorldDirection(dir);
    const pd = this.ld, pu = this.lu;
    this.ld = dir.y < -0.5; this.lu = dir.y > 0.5;
    if (this.ld !== pd) this.el.emit(this.ld ? 'lookdown' : 'looklevel');
    if (this.lu !== pu) this.el.emit(this.lu ? 'lookup'   : 'looklevel');
  }
});

// Gaze detector
AFRAME.registerComponent('gaze-detector', {
  init() { this.gazed = false; },
  tick() {
    const cam = document.querySelector('[camera]'); if (!cam) return;
    const cd  = new THREE.Vector3(); cam.object3D.getWorldDirection(cd);
    const cp  = new THREE.Vector3(); cam.object3D.getWorldPosition(cp);
    const ep  = new THREE.Vector3(); this.el.object3D.getWorldPosition(ep);
    const dot = cd.dot(ep.clone().sub(cp).normalize());
    if (dot > 0.9 && !this.gazed) { this.gazed = true;  this.el.emit('gazestart'); SIGNAL9.Presence.adjust(2); }
    else if (dot <= 0.9 && this.gazed) { this.gazed = false; this.el.emit('gazeend'); }
  }
});

// Comfort vignette toggle (Y button)
AFRAME.registerComponent('comfort-vignette', {
  init() {
    const lc = document.querySelector('[oculus-touch-controls="hand: left"]') ||
               document.querySelector('[hand-controls="hand: left"]');
    if (lc) lc.addEventListener('ybuttondown', () => {
      const v = document.getElementById('vignette-overlay');
      if (v) v.setAttribute('visible', v.getAttribute('visible') === 'true' ? 'false' : 'true');
    });
  }
});

// CRT canvas display
AFRAME.registerComponent('crt-display', {
  schema: { state:{default:'off'} },
  init() {
    this.frame = 0;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 256; this.canvas.height = 192;
    this.tex = new THREE.CanvasTexture(this.canvas);
    const mesh = this.el.getObject3D('mesh');
    if (mesh) { mesh.material.map = this.tex; mesh.material.needsUpdate = true; }
  },
  tick() {
    if (++this.frame % 3 !== 0) return;
    const ctx = this.canvas.getContext('2d'), w = 256, h = 192, s = this.data.state;
    if (s === 'static') {
      const id = ctx.createImageData(w,h);
      for (let i=0;i<id.data.length;i+=4){const v=Math.random()*200;id.data[i]=v;id.data[i+1]=v;id.data[i+2]=v;id.data[i+3]=255;}
      ctx.putImageData(id,0,0);
      ctx.fillStyle='rgba(0,0,0,0.3)';for(let y=0;y<h;y+=2)ctx.fillRect(0,y,w,1);
    } else if (s === 'playing') {
      const t=Date.now()/1000;ctx.fillStyle='#1a0a00';ctx.fillRect(0,0,w,h);
      ctx.fillStyle='#6a0000';ctx.fillRect(0,0,50,h);ctx.fillRect(w-50,0,50,h);
      const p1=h/2+Math.sin(t*1.2)*10;ctx.fillStyle='#e8c090';ctx.beginPath();ctx.arc(70,p1,20,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#333';ctx.beginPath();ctx.arc(63,p1-5,4,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(77,p1-5,4,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(0,0,0,0.3)';for(let y=0;y<h;y+=2)ctx.fillRect(0,y,w,1);
    } else if (s === 'text') {
      ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);ctx.fillStyle='#0f0';ctx.font='bold 14px Courier New';ctx.textAlign='center';
      ctx.fillText('YOU ARE TOO CLOSE',w/2,h/2-10);ctx.fillText('TO THE SCREEN.',w/2,h/2+10);
    } else if (s === 'face') {
      const t=Date.now()/1000;const id=ctx.createImageData(w,h);const cx=w/2,cy=h/2;
      for(let y=0;y<h;y++){for(let x=0;x<w;x++){let v=Math.random()*80;
        const eL=Math.hypot(x-cx+30,y-cy+20),eR=Math.hypot(x-cx-30,y-cy+20);
        const mth=Math.abs(y-(cy+30))<10&&Math.abs(x-cx)<40;
        if(eL<15||eR<15)v+=80+Math.sin(t*3)*20;if(mth)v+=60;v=Math.min(255,v);
        const i=(y*w+x)*4;id.data[i]=v;id.data[i+1]=v*0.8;id.data[i+2]=v*0.6;id.data[i+3]=255;}}
      ctx.putImageData(id,0,0);
    } else if (s === 'logo') {
      ctx.fillStyle='#0a0a0a';ctx.fillRect(0,0,w,h);ctx.fillStyle='#333';ctx.font='bold 24px Courier New';ctx.textAlign='center';
      ctx.fillText('SIGNAL 9',w/2,h/2-5);ctx.font='10px Courier New';ctx.fillText('WDRK-TV',w/2,h/2+15);
      ctx.fillStyle='rgba(0,0,0,0.4)';for(let y=0;y<h;y+=2)ctx.fillRect(0,y,w,1);
    } else { ctx.fillStyle='#000';ctx.fillRect(0,0,w,h); }
    this.tex.needsUpdate = true;
  }
});

// ============================================================
// LOCOMOTION — reads left analog stick every frame
// Works on Quest 3, desktop keyboard, and generic gamepads
// ============================================================
AFRAME.registerComponent('maze-locomotion', {
  schema: { speed:{default:3.5} },
  init() {
    this.fwd   = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.move  = new THREE.Vector3();
    this.up    = new THREE.Vector3(0,1,0);
  },
  tick(time, delta) {
    const dt = Math.min(delta, 100) / 1000;
    let ax = 0, ay = 0;

    // --- Gamepad: scan all connected pads, prefer the one labelled "left" ---
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < pads.length; i++) {
      const gp = pads[i]; if (!gp || !gp.connected) continue;
      const id = (gp.id || '').toLowerCase();
      if (id.includes('left')) {
        // Oculus/Quest left controller: axes 0 = thumbstick X, 1 = thumbstick Y
        ax = gp.axes[0] || 0;
        ay = gp.axes[1] || 0;
        break;
      }
    }
    // Fallback: first gamepad axes 0,1 (covers single-gamepad desktop controllers)
    if (Math.abs(ax) < 0.08 && Math.abs(ay) < 0.08) {
      const gp = pads[0];
      if (gp && gp.connected && gp.axes.length >= 2) {
        ax = gp.axes[0] || 0;
        ay = gp.axes[1] || 0;
      }
    }

    // --- Keyboard fallback (WASD / arrows) ---
    const kb = SIGNAL9._keys || {};
    if (kb['KeyW'] || kb['ArrowUp'])    ay = -1;
    if (kb['KeyS'] || kb['ArrowDown'])  ay =  1;
    if (kb['KeyA'] || kb['ArrowLeft'])  ax = -1;
    if (kb['KeyD'] || kb['ArrowRight']) ax =  1;

    // Dead zone
    if (Math.abs(ax) < 0.12) ax = 0;
    if (Math.abs(ay) < 0.12) ay = 0;
    if (ax === 0 && ay === 0) return;

    // Camera-relative movement
    const cam = document.querySelector('[camera]'); if (!cam) return;
    cam.object3D.getWorldDirection(this.fwd);
    this.fwd.y = 0; this.fwd.normalize();
    this.right.crossVectors(this.fwd, this.up).normalize();

    this.move.set(0,0,0);
    this.move.addScaledVector(this.fwd,  -ay * this.data.speed * dt);
    this.move.addScaledVector(this.right, ax * this.data.speed * dt);

    // Collision with maze walls — try full move, then axis-separated
    const pos    = this.el.object3D.position;
    const margin = 0.45;
    const nx = pos.x + this.move.x;
    const nz = pos.z + this.move.z;
    const M  = SIGNAL9.MAZE;

    if (!M.isWall(nx, pos.z) && !M.isWall(nx+margin,pos.z) && !M.isWall(nx-margin,pos.z))
      pos.x = nx;
    if (!M.isWall(pos.x, nz) && !M.isWall(pos.x,nz+margin) && !M.isWall(pos.x,nz-margin))
      pos.z = nz;
  }
});

// Snap turn — reads right stick from gamepad every tick
AFRAME.registerComponent('snap-turn', {
  schema: { angle:{default:30} },
  init() { this.cooldown = false; },
  tick() {
    if (this.cooldown) return;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let rx = 0;
    for (let i = 0; i < pads.length; i++) {
      const gp = pads[i]; if (!gp || !gp.connected) continue;
      const id = (gp.id || '').toLowerCase();
      if (id.includes('right')) { rx = gp.axes[0] || 0; break; }
    }
    // Fallback: second gamepad or axes 2,3 of first
    if (Math.abs(rx) < 0.08) {
      const gp1 = pads[1]; if (gp1 && gp1.connected) rx = gp1.axes[0] || 0;
    }
    if (Math.abs(rx) < 0.08) {
      const gp0 = pads[0]; if (gp0 && gp0.connected && gp0.axes.length >= 3) rx = gp0.axes[2] || 0;
    }
    if (Math.abs(rx) > 0.7) {
      const rig = document.getElementById('rig');
      if (rig) {
        const r = rig.getAttribute('rotation') || {x:0,y:0,z:0};
        rig.setAttribute('rotation', {x:r.x, y:r.y+(rx>0?-this.data.angle:this.data.angle), z:r.z});
      }
      this.cooldown = true;
      setTimeout(() => { this.cooldown = false; }, 350);
    }
  }
});

// Ghost hand (delayed shadow on rooftop mission)
AFRAME.registerComponent('ghost-hand', {
  schema:{delay:{default:500}},
  init(){
    this.positions=[]; this.frames=Math.floor(this.data.delay/50); this.last=0;
    this.ghost=document.createElement('a-entity');
    this.ghost.setAttribute('geometry','primitive:box;width:0.08;height:0.15;depth:0.04');
    this.ghost.setAttribute('material','color:#aaa;opacity:0.15;transparent:true');
    this.el.parentNode.appendChild(this.ghost);
  },
  tick(t){
    if(t-this.last<50)return; this.last=t;
    const p=new THREE.Vector3(); this.el.object3D.getWorldPosition(p);
    this.positions.push({x:p.x,y:p.y,z:p.z});
    if(this.positions.length>this.frames){
      const old=this.positions.shift();
      this.ghost.object3D.position.set(old.x,old.y,old.z);
    }
  }
});

// ============================================================
// SCENE MANAGER
// ============================================================
SIGNAL9.Scenes = {
  actions: {},
  onDialChange: null,
  onCrank: null,

  load(missionId) {
    const scene = document.querySelector('a-scene'); if (!scene) return;

    // Stop Shrek
    SIGNAL9.ShrekAI.stop();

    // Clear scene root
    const prev = document.getElementById('scene-root');
    if (prev) prev.parentNode.removeChild(prev);
    const root = document.createElement('a-entity');
    root.id = 'scene-root';
    scene.appendChild(root);

    // Audio transitions
    const GA = SIGNAL9.GameAudio;
    if (GA) {
      if (missionId === 0) { GA.stopAtmosphere(); GA.playMainMenu(); }
      else                  { GA.stopMainMenu();  GA.startAtmosphere(); }
    }
    if (SIGNAL9.Entity) SIGNAL9.Entity.hide();

    SIGNAL9.Audio.startMachineHum();
    SIGNAL9.Audio.startVentilation();
    SIGNAL9.currentMission = missionId;

    switch (missionId) {
      case 0:   this.buildMainMenu(root);        break;
      case 1:   this.buildMazeMission(root, 1);  break;
      case 2:   this.buildMazeMission(root, 2);  break;
      case 3:   this.buildMazeMission(root, 3);  break;
      case 3.5: this.buildJumpscare(root);        break;
      case 4:   this.buildMazeMission(root, 4);  break;
      case 5:   this.buildMazeMission(root, 5);  break;
      case 6:   this.buildMazeMission(root, 6);  break;
      case 7:   this.buildEnding(root, SIGNAL9.gameData.endingType || 'compliance'); break;
    }
  },

  e(tag, attrs, parent) {
    const el = document.createElement(tag || 'a-entity');
    if (attrs) Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k,v));
    if (parent) parent.appendChild(el);
    return el;
  },

  // ── Shared prop builders ──────────────────────────────────
  buildCRT(parent, pos, id, opts={}) {
    const g = this.e('a-entity', {position:pos}, parent); if (id) g.id = id;
    this.e('a-box',{width:0.5,height:0.4,depth:0.4,material:'color:#222;roughness:0.6;metalness:0.3'},g);
    const scr=this.e('a-box',{position:'0 0 0.21',width:0.42,height:0.33,depth:0.01,material:'color:#001100;emissive:#001100;emissiveIntensity:0.3'},g);
    if(opts.crtDisplay)scr.setAttribute('crt-display',`state:${opts.crtState||'static'}`);
    this.e('a-entity',{position:'0 0 0.25',light:'type:point;color:#003300;intensity:0.3;distance:1'},g);
    this.e('a-box',{position:'0 -0.22 0.15',width:0.5,height:0.04,depth:0.3,material:'color:#1a1a1a'},g);
    this.e('a-sphere',{position:'0.17 -0.18 0.21',radius:0.01,material:'color:#00ff00;emissive:#00ff00;emissiveIntensity:1'},g);
    return g;
  },

  buildVHSDeck(parent, pos, id) {
    const g=this.e('a-entity',{position:pos},parent); if(id)g.id=id;
    this.e('a-box',{width:0.5,height:0.1,depth:0.3,material:'color:#1a1a1a;roughness:0.8;metalness:0.5'},g);
    const slot=this.e('a-box',{position:'0 0.06 0',width:0.22,height:0.04,depth:0.22,material:'color:#111'},g);
    slot.setAttribute('vhs-slot',''); slot.classList.add('interactive');
    this.e('a-sphere',{position:'-0.15 0.06 0.16',radius:0.008,material:'color:#ff8800;emissive:#ff8800;emissiveIntensity:1'},g);
    return g;
  },

  buildShelf(parent, pos, rot='') {
    const g=this.e('a-entity',{position:pos,rotation:rot},parent);
    this.e('a-box',{width:1.2,height:0.04,depth:0.25,material:'color:#443322;roughness:0.8'},g);
    this.e('a-box',{position:'-0.55 -0.15 0',width:0.04,height:0.3,depth:0.25,material:'color:#555'},g);
    this.e('a-box',{position:'0.55 -0.15 0', width:0.04,height:0.3,depth:0.25,material:'color:#555'},g);
    ['#222','#1a1a2e','#2e1a1a','#1a2e1a','#2a2a1a','#1e1e1e'].forEach((c,i)=>
      this.e('a-box',{position:`${-0.45+i*0.18} 0.05 0`,width:0.16,height:0.12,depth:0.20,material:`color:${c};roughness:0.6`},g));
    return g;
  },

  buildSignalRack(parent, pos, id) {
    const g=this.e('a-entity',{position:pos},parent); if(id)g.id=id;
    this.e('a-box',{width:0.5,height:2,depth:0.5,material:'color:#333;roughness:0.6;metalness:0.7'},g);
    for(let i=0;i<8;i++){const y=0.8-i*0.22;
      this.e('a-box',{position:`0 ${y} 0.25`,width:0.44,height:0.20,depth:0.02,material:`color:${i%3===0?'#1a2a1a':'#2a2a2a'}`},g);
      this.e('a-sphere',{position:`0.15 ${y} 0.27`,radius:0.01,material:`color:${i<3?'#00ff00':'#ff6600'};emissive:${i<3?'#00ff00':'#ff6600'};emissiveIntensity:1`},g);}
    this.e('a-sphere',{position:'0 1.1 0.26',radius:0.04,material:'color:#ff0000;emissive:#ff0000;emissiveIntensity:1'},g);
    return g;
  },

  buildTape(parent, pos, id) {
    const t=this.e('a-entity',{position:pos},parent); if(id)t.id=id;
    this.e('a-box',{width:0.18,height:0.03,depth:0.10,material:'color:#1a1a1a;roughness:0.6'},t);
    t.setAttribute('grabbable','itemType:tape'); t.classList.add('interactive');
    return t;
  },

  // ============================================================
  // MAIN MENU
  // ============================================================
  buildMainMenu(root) {
    this.e('a-sky',{color:'#050505'},root);
    this.e('a-entity',{light:'type:ambient;color:#110808;intensity:0.5'},root);
    this.e('a-entity',{position:'0 2 -3',light:'type:point;color:#ff2200;intensity:0.8;distance:6'},root);
    this.e('a-box',{position:'0 0 0',width:12,height:0.1,depth:12,material:'color:#1a1208'},root);

    this.e('a-box',{position:'0 1.8 -3',width:3,height:1.4,depth:0.05,material:'color:#080808;opacity:0.95'},root);
    this.e('a-text',{position:'0 2.1 -2.97',value:'SIGNAL 9',align:'center',color:'#cc2200',width:6},root);
    this.e('a-text',{position:'0 1.8 -2.97',value:'THE DEAD AIR ARCHIVE',align:'center',color:'#886644',width:2.5},root);
    this.e('a-text',{position:'0 1.55 -2.97',value:'WDRK-TV  ◈  1997',align:'center',color:'#444',width:1.8},root);
    this.buildCRT(root,'-1.5 1.2 -3',null,{crtDisplay:true,crtState:'static'});
    this.buildCRT(root,'1.5 1.2 -3', null,{crtDisplay:true,crtState:'logo'});

    [
      {label:'▶  NEW GAME', y:1.1,  action:'menuNewGame'},
      {label:'◈  CONTINUE', y:0.85, action:'menuContinue'},
      {label:'⚙  SETTINGS', y:0.6,  action:'menuSettings'},
      {label:'✦  CREDITS',  y:0.35, action:'menuCredits'},
    ].forEach(b => {
      const btn=this.e('a-entity',{position:`0 ${b.y} -2.95`},root);
      this.e('a-box',{width:1.8,height:0.18,depth:0.05,material:'color:#1a0a0a;opacity:0.9'},btn);
      this.e('a-text',{value:b.label,align:'center',color:'#cc8866',width:2.5,position:'0 0 0.03'},btn);
      btn.classList.add('interactive'); btn.setAttribute('pressable',`action:${b.action}`);
    });

    const sp=this.e('a-entity',{id:'settings-panel',visible:'false',position:'0 1.2 -2.8'},root);
    this.e('a-box',{width:2,height:1.8,depth:0.05,material:'color:#0a0a0a;opacity:0.97'},sp);
    this.e('a-text',{value:'SETTINGS\n\nLOCOMOTION: LEFT STICK\nSNAP TURN: RIGHT STICK\nVIGNETTE: Y BUTTON\nCHECKLIST: X BUTTON\nWRIST MENU: A BUTTON\n\n[B] CLOSE',align:'center',color:'#888',width:1.8,position:'0 0.2 0.03'},sp);

    this.actions.menuNewGame = () => {
      SIGNAL9.Save.clear(); SIGNAL9.gameData = SIGNAL9.Save.load();
      SIGNAL9.gameData.currentMission=1; SIGNAL9.Save.save(SIGNAL9.gameData); this.load(1);
    };
    this.actions.menuContinue = () => {
      SIGNAL9.gameData = SIGNAL9.Save.load(); this.load(SIGNAL9.gameData.currentMission || 1);
    };
    this.actions.menuSettings = () => {
      const p=document.getElementById('settings-panel');
      if(p)p.setAttribute('visible',p.getAttribute('visible')==='true'?'false':'true');
    };
    this.actions.menuCredits = () => {
      SIGNAL9.UI.showSubtitle('SIGNAL 9 — A WebXR Horror Experience. Built with A-Frame.',5000);
    };
  },

  // ============================================================
  // MAZE MISSION WRAPPER
  // ============================================================
  buildMazeMission(root, missionId) {
    SIGNAL9.MazeBuilder.build(root);

    // Spawn player at cell (1,1)
    const start = SIGNAL9.MAZE.toWorld(1,1);
    const rig   = document.getElementById('rig');
    if (rig) rig.setAttribute('position', `${start.x} 0 ${start.z}`);

    // Objective sign at entrance
    const objText = {
      1:'MISSION 1: TONE TEST\nFind the console.\nTune to 1000 Hz.',
      2:"MISSION 2: CHILDREN'S HOUR\nFind the VHS tape.\nInsert it into the deck.",
      3:'MISSION 3: BLUE LIGHT\nNavigate the maze.\nFollow compliance rules.',
      4:'MISSION 4: ROOFTOP\nFind the crank.\nAlign dish to 100%.',
      5:'MISSION 5: STATION ID\nFind the recording booth.\nMake your choice.',
      6:'MISSION 6: DEAD AIR\nFind the control panel.\nKeep signal stable 90s.',
    }[missionId]||'';
    const signWp=SIGNAL9.MAZE.toWorld(1,2);
    const sign=this.e('a-entity',{position:`${signWp.x} 2.2 ${signWp.z}`},root);
    this.e('a-box',{width:1.8,height:0.7,depth:0.05,material:'color:#0a0a0a;opacity:0.95'},sign);
    this.e('a-text',{value:objText,align:'center',color:'#cc8866',width:2.2,position:'0 0 0.03'},sign);

    // Compliance checklist near entrance
    const clWp=SIGNAL9.MAZE.toWorld(2,1);
    const cl=this.e('a-entity',{position:`${clWp.x} 1.5 ${clWp.z}`},root);
    this.e('a-plane',{width:0.9,height:1.1,material:`src:${SIGNAL9.Textures.paperChecklist}`},cl);

    // Mission overlay
    switch (missionId) {
      case 1: this._m1(root); break;
      case 2: this._m2(root); break;
      case 3: this._m3(root); break;
      case 4: this._m4(root); break;
      case 5: this._m5(root); break;
      case 6: this._m6(root); break;
    }

    // Start Shrek roaming after 6s
    setTimeout(() => { if (SIGNAL9.currentMission === missionId) SIGNAL9.ShrekAI.start(); }, 6000);
  },

  // ── M1: Tone console ────────────────────────────────────
  _m1(root) {
    const cp=SIGNAL9.MAZE.toWorld(7,7);
    const cons=this.e('a-entity',{position:`${cp.x} 0.8 ${cp.z}`},root);
    this.e('a-box',{width:1.5,height:0.1,depth:0.6,material:'color:#555;metalness:0.7'},cons);
    this.e('a-box',{position:'0 0.5 -0.2',width:1.5,height:1.0,depth:0.1,material:'color:#444;metalness:0.5'},cons);
    this.e('a-box',{position:'0 0.7 0.21',width:0.6,height:0.2,depth:0.05,material:'color:#000'},cons);
    this.e('a-text',{id:'freq-text',value:'500 Hz',align:'center',color:'#00ff00',width:0.5,position:'0 0.7 0.24'},cons);
    const knob=this.e('a-entity',{position:'-0.3 0.12 0.3'},cons);
    this.e('a-cylinder',{radius:0.06,height:0.04,material:'color:#333;metalness:0.8'},knob);
    this.e('a-box',{position:'0 0.03 0.04',width:0.01,height:0.06,depth:0.01,material:'color:#fff'},knob);
    knob.setAttribute('knob-control','min:200;max:2000;value:500;step:25;targetId:freq-text');
    knob.classList.add('interactive');
    SIGNAL9.Audio.playTestTone(500);
    let done=false;
    const iv=setInterval(()=>{
      const k=knob.components['knob-control'];
      if(k&&Math.abs(k.data.value-1000)<30&&!done){
        done=true;clearInterval(iv);SIGNAL9.Audio.stopTestTone();
        SIGNAL9.UI.showSubtitle('CALIBRATION COMPLETE. Proceeding...',3000);
        setTimeout(()=>{SIGNAL9.gameData.currentMission=2;SIGNAL9.Save.save(SIGNAL9.gameData);this.load(2);},3500);
      }
    },500);
  },

  // ── M2: VHS digitization ────────────────────────────────
  _m2(root) {
    const tp=SIGNAL9.MAZE.toWorld(3,13), dp=SIGNAL9.MAZE.toWorld(13,3), cp=SIGNAL9.MAZE.toWorld(13,5);
    this.buildTape(root,`${tp.x} 0.8 ${tp.z}`,'vhs-tape-m2');
    this.buildVHSDeck(root,`${dp.x} 0.3 ${dp.z}`,'vhs-deck-m2');
    this.buildCRT(root,`${cp.x} 0.8 ${cp.z}`,'main-screen-m2',{crtDisplay:true,crtState:'off'});
    let inserted=false;
    this.actions.tapeInserted=()=>{
      if(inserted)return;inserted=true;
      SIGNAL9.Audio.startTapeDeck(dp.x,0.3,dp.z);
      const scr=document.getElementById('main-screen-m2');
      if(scr)setTimeout(()=>scr.setAttribute('crt-display','state:static'),1500);
      const run=(n)=>{
        if(n>=3){SIGNAL9.UI.showSubtitle('ALL SEGMENTS CAPTURED ✓',3000);
          setTimeout(()=>{SIGNAL9.gameData.currentMission=3;SIGNAL9.Save.save(SIGNAL9.gameData);this.load(3);},3500);return;}
        SIGNAL9.UI.showSubtitle(`Capturing segment ${n+1}/3...`,4000);
        if(n===1){SIGNAL9.Audio.startDeadAir();const s=document.getElementById('main-screen-m2');if(s)s.setAttribute('crt-display','state:text');setTimeout(()=>{SIGNAL9.Audio.endDeadAir();if(s)s.setAttribute('crt-display','state:playing');},4000);}
        setTimeout(()=>run(n+1),n===1?12000:7000);
      };
      setTimeout(()=>run(0),2000);
    };
  },

  // ── M3: Blue light compliance ────────────────────────────
  _m3(root) {
    const lp=SIGNAL9.MAZE.toWorld(8,8);
    const emL=this.e('a-sphere',{id:'em-light-m3',position:`${lp.x} 2.5 ${lp.z}`,radius:0.1,material:'color:#ff0000;emissive:#ff0000;emissiveIntensity:2'},root);
    const emP=this.e('a-entity',{id:'em-pt-m3',position:`${lp.x} 2.5 ${lp.z}`,light:'type:point;color:#ff0000;intensity:3;distance:12'},root);
    let active=false;
    const cam=document.querySelector('[camera]');
    if(cam){
      cam.setAttribute('head-tilt-monitor','');
      cam.addEventListener('lookdown',()=>{if(!active)return;SIGNAL9.Presence.adjust(10);
        for(let i=0;i<10;i++){const d=this.e('a-sphere',{position:`${lp.x+(Math.random()-.5)*4} 3 ${lp.z+(Math.random()-.5)*4}`,radius:0.015,material:'color:#888;opacity:0.6;transparent:true'},root);
          d.setAttribute('animation','property:position.y;to:0;dur:3000;easing:linear');setTimeout(()=>{if(d.parentNode)d.parentNode.removeChild(d);},3100);}});
      cam.addEventListener('lookup',()=>{if(!active)return;SIGNAL9.Audio.playWhisper('Thank you for confirming ceiling integrity.');SIGNAL9.Presence.adjust(-10);});
    }
    setTimeout(()=>{
      active=true;
      emL.setAttribute('material','color:#0044ff;emissive:#0044ff;emissiveIntensity:2');
      emP.setAttribute('light','type:point;color:#0044ff;intensity:3;distance:12');
      SIGNAL9.UI.showSubtitle('COMPLIANCE EVENT ACTIVE. LOOK DOWN.',4000);
      if(SIGNAL9.Entity){const far=SIGNAL9.MAZE.toWorld(15,15);SIGNAL9.Entity.showNear(far.x,0,far.z);setTimeout(()=>SIGNAL9.Entity.hide(),4000);}
      setTimeout(()=>{
        active=false;
        emL.setAttribute('material','color:#ff0000;emissive:#ff0000;emissiveIntensity:1');
        emP.setAttribute('light','type:point;color:#ff0000;intensity:1;distance:12');
        setTimeout(()=>{SIGNAL9.gameData.currentMission=3.5;SIGNAL9.Save.save(SIGNAL9.gameData);this.load(3.5);},3000);
      },15000);
    },8000);
  },

  // ── M4: Dish crank ──────────────────────────────────────
  _m4(root) {
    const cp=SIGNAL9.MAZE.toWorld(15,15);
    const base=this.e('a-entity',{position:`${cp.x} 0.1 ${cp.z}`},root);
    this.e('a-cylinder',{radius:0.15,height:0.8,material:'color:#555;metalness:0.8'},base);
    const mount=this.e('a-entity',{id:'dish-mount-m4',position:'0 0.6 0'},base);
    this.e('a-cylinder',{radius:0.8,height:0.05,material:'color:#aaa;metalness:0.5;side:double',rotation:'-45 0 0'},mount);
    const cb=this.e('a-entity',{position:`${cp.x+1.5} 0.8 ${cp.z}`},root);
    this.e('a-box',{width:0.3,height:0.5,depth:0.3,material:'color:#444;metalness:0.7'},cb);
    const crank=this.e('a-entity',{id:'dish-crank',position:'0 0.35 0.15'},cb);
    this.e('a-cylinder',{radius:0.04,height:0.3,rotation:'90 0 0',material:'color:#555'},crank);
    this.e('a-sphere',{position:'0 0 0.15',radius:0.07,material:'color:#333'},crank);
    crank.setAttribute('crank',''); crank.classList.add('interactive');
    const mp=this.e('a-entity',{position:`${cp.x+1.5} 1.5 ${cp.z}`},root);
    this.e('a-box',{width:0.4,height:0.3,depth:0.05,material:'color:#000'},mp);
    this.e('a-text',{id:'sig-pct',value:'SIGNAL: 0%',align:'center',color:'#00ff00',width:0.5,position:'0 0 0.03'},mp);
    const rh=document.querySelector('[hand-controls="hand: right"]')||document.querySelector('[oculus-touch-controls="hand: right"]');
    if(rh)rh.setAttribute('ghost-hand','delay:500');
    let done=false;
    this.onCrank=(angle)=>{
      const pct=Math.min(100,Math.abs(angle%360)/3.6);
      const el=document.getElementById('sig-pct');
      if(el)el.setAttribute('text',`value:SIGNAL: ${Math.round(pct)}%;align:center;color:${pct>80?'#00ff00':pct>40?'#ffaa00':'#ff4400'};width:0.5`);
      const dish=document.getElementById('dish-mount-m4');if(dish)dish.setAttribute('rotation',`0 ${angle} 0`);
      if(pct>=100&&!done){done=true;SIGNAL9.UI.showSubtitle('Receiver calibrated.',4000);SIGNAL9.Audio.playWhisper('Receiver calibrated.');
        setTimeout(()=>{SIGNAL9.gameData.currentMission=5;SIGNAL9.Save.save(SIGNAL9.gameData);this.load(5);},5000);}
    };
  },

  // ── M5: Station ID booth ─────────────────────────────────
  _m5(root) {
    const bp=SIGNAL9.MAZE.toWorld(9,9);
    const mic=this.e('a-entity',{position:`${bp.x} 0.1 ${bp.z-1}`},root);
    this.e('a-cylinder',{radius:0.03,height:1.5,material:'color:#555;metalness:0.8'},mic);
    this.e('a-sphere',{position:'0 0.85 0',radius:0.08,material:'color:#333'},mic);
    const sd=this.e('a-entity',{position:`${bp.x} 1.6 ${bp.z-1.5}`},root);
    this.e('a-box',{width:1.2,height:0.8,depth:0.05,material:'color:#001100'},sd);
    this.e('a-text',{id:'script-text',value:'WDRK-TV SIGNAL 9.\nTHIS STATION IS ____.\nPRESS RECORD.',align:'center',color:'#00cc00',width:1.8,position:'0 0 0.03'},sd);
    const rec=this.e('a-entity',{position:`${bp.x-0.3} 1.1 ${bp.z-1.6}`},root);
    this.e('a-cylinder',{radius:0.07,height:0.04,material:'color:#cc0000'},rec);
    this.e('a-text',{value:'REC',align:'center',color:'#fff',width:0.5,position:'0 0.04 0'},rec);
    rec.classList.add('interactive');rec.setAttribute('pressable','action:startRecord');
    const cb=this.e('a-entity',{id:'comply-btn',position:`${bp.x-0.1} 1.1 ${bp.z-1.6}`,visible:'false'},root);
    this.e('a-box',{width:0.3,height:0.08,depth:0.06,material:'color:#004400'},cb);
    this.e('a-text',{value:'COMPLY',align:'center',color:'#00ff00',width:0.6,position:'0 0.05 0'},cb);
    cb.classList.add('interactive');cb.setAttribute('pressable','action:comply');
    const nb=this.e('a-entity',{id:'nameit-btn',position:`${bp.x+0.2} 1.1 ${bp.z-1.6}`,visible:'false'},root);
    this.e('a-box',{width:0.3,height:0.08,depth:0.06,material:'color:#440000'},nb);
    this.e('a-text',{value:'NAME IT',align:'center',color:'#ff4400',width:0.6,position:'0 0.05 0'},nb);
    nb.classList.add('interactive');nb.setAttribute('pressable','action:nameIt');
    let recording=false,changed=false;
    this.actions.startRecord=()=>{if(recording)return;recording=true;
      const s=document.getElementById('script-text');
      if(s)s.setAttribute('text','value:WDRK-TV SIGNAL 9.\nTHIS STATION IS ____.\n▶ RECORDING...');
      document.getElementById('comply-btn')?.setAttribute('visible','true');
      document.getElementById('nameit-btn')?.setAttribute('visible','true');
      setTimeout(()=>{if(!changed&&recording){changed=true;const s=document.getElementById('script-text');
        if(s)s.setAttribute('text','value:W̷D̶R̸K̵ S̸I̴G̴N̴A̴L̵ 9̸.\nTHIS STATION IS ____.\nWHAT IS IT CALLED?');
        SIGNAL9.Audio.playBreathing();setTimeout(()=>SIGNAL9.Audio.stopBreathing(),4000);}},8000);
    };
    this.actions.comply=()=>{recording=false;SIGNAL9.Audio.stopBreathing();
      SIGNAL9.gameData.complianceScore=(SIGNAL9.gameData.complianceScore||0)+10;
      SIGNAL9.UI.showSubtitle('STATION ID RECORDED. COMPLIANCE CONFIRMED.',3000);
      setTimeout(()=>{SIGNAL9.gameData.currentMission=6;SIGNAL9.Save.save(SIGNAL9.gameData);this.load(6);},3500);
    };
    this.actions.nameIt=()=>{recording=false;SIGNAL9.Audio.stopBreathing();
      SIGNAL9.gameData.namedIt=true;SIGNAL9.Presence.adjust(-20);
      SIGNAL9.UI.showSubtitle("IDENTIFICATION LOGGED. You've helped it transmit.",3000);
      setTimeout(()=>{SIGNAL9.gameData.currentMission=6;SIGNAL9.Save.save(SIGNAL9.gameData);this.load(6);},3500);
    };
  },

  // ── M6: Dead Air final ──────────────────────────────────
  _m6(root) {
    const fp=SIGNAL9.MAZE.toWorld(8,8);
    this.buildCRT(root,`${fp.x} 1.5 ${fp.z-1}`,'final-crt-m6',{crtDisplay:true,crtState:'logo'});
    const panel=this.e('a-entity',{position:`${fp.x} 0.9 ${fp.z}`},root);
    this.e('a-box',{width:2,height:0.4,depth:0.5,material:'color:#222;metalness:0.5'},panel);
    ['GAIN','SYNC','PHASE'].forEach((lbl,i)=>{
      const id=`dial-${lbl.toLowerCase()}`;
      const dial=this.e('a-entity',{id,position:`${-0.6+i*0.6} 0.3 0.25`},panel);
      this.e('a-cylinder',{radius:0.07,height:0.05,material:'color:#444;metalness:0.7'},dial);
      this.e('a-text',{value:lbl,align:'center',color:'#666',width:0.6,position:'0 -0.1 0'},dial);
      dial.setAttribute('dial-control',`min:0;max:100;value:50;targetId:${id}-ind`);dial.classList.add('interactive');
      this.e('a-sphere',{id:`${id}-ind`,position:'0 0.1 0',radius:0.03,material:'color:#00ff00;emissive:#00ff00;emissiveIntensity:1'},dial);
    });
    const timerEl=this.e('a-text',{id:'timer-m6',position:`${fp.x} 2.5 ${fp.z-1}`,value:'TIME: 90s',align:'center',color:'#00ff00',width:2},root);
    const desc=this.e('a-entity',{position:`${fp.x+0.8} 1.2 ${fp.z}`},root);
    this.e('a-box',{width:0.4,height:0.15,depth:0.1,material:'color:#220000'},desc);
    this.e('a-text',{value:'DESCRIBE IT',align:'center',color:'#aa4422',width:0.8,position:'0 0 0.06'},desc);
    desc.classList.add('interactive');desc.setAttribute('pressable','action:describeIt');
    this.buildSignalRack(root,`${fp.x-2} 1 ${fp.z}`,'pull-rack-m6');
    const plug=this.e('a-entity',{position:`${fp.x-2} 1.5 ${fp.z-0.7}`},root);
    this.e('a-box',{width:0.15,height:0.15,depth:0.3,material:'color:#cc4400'},plug);
    this.e('a-text',{value:'PULL PLUG',align:'center',color:'#fff',width:0.4,position:'0 0.15 0'},plug);
    plug.classList.add('interactive');plug.setAttribute('pressable','action:pullPlug');
    let instability=0,time=90,active=true;
    const iv=setInterval(()=>{
      if(!active){clearInterval(iv);return;}time--;
      const td=document.getElementById('timer-m6');if(td)td.setAttribute('text',`value:TIME: ${time}s;align:center;color:${time>30?'#00ff00':time>10?'#ffaa00':'#ff4400'};width:2`);
      instability+=Math.random()*3;
      if(instability>20){const s=document.getElementById('final-crt-m6');if(s){const sc=s.querySelector('[crt-display]');if(sc){sc.setAttribute('crt-display','state:face');setTimeout(()=>sc.setAttribute('crt-display','state:logo'),500);}}instability=0;SIGNAL9.Presence.adjust(-3);}
      if(time<=0){active=false;clearInterval(iv);SIGNAL9.gameData.endingType=SIGNAL9.gameData.namedIt?'identification':'compliance';SIGNAL9.gameData.currentMission=7;SIGNAL9.Save.save(SIGNAL9.gameData);this.load(7);}
    },1000);
    this.onDialChange=(id,val)=>{const norm=Math.abs(val-50)/50;const inG=norm<0.3;const ind=document.getElementById(`${id}-ind`);if(ind)ind.setAttribute('material',`color:${inG?'#00ff00':norm<0.6?'#ffaa00':'#ff4400'};emissive:${inG?'#00ff00':norm<0.6?'#ffaa00':'#ff4400'};emissiveIntensity:1`);if(!inG)instability+=2;};
    this.actions.describeIt=()=>{instability+=15;SIGNAL9.Presence.adjust(-10);SIGNAL9.UI.showSubtitle('IT ARRIVED ON CH.9  1987-10-31  STAFF SAW NOTHING.',5000);};
    this.actions.pullPlug=()=>{active=false;clearInterval(iv);SIGNAL9.gameData.endingType='pulltheplug';SIGNAL9.gameData.currentMission=7;SIGNAL9.Save.save(SIGNAL9.gameData);this.load(7);};
  },

  // ============================================================
  // JUMPSCARE INTERSTITIAL
  // ============================================================
  buildJumpscare(root) {
    this.e('a-sky',{color:'#000000'},root);
    this.e('a-entity',{light:'type:ambient;color:#110000;intensity:0.2'},root);
    this.e('a-entity',{position:'0 2 -1',light:'type:point;color:#ff1100;intensity:1;distance:5'},root);
    this.e('a-box',{position:'0 0 0',width:6,height:0.1,depth:6,material:'color:#0a0000'},root);
    const warn=this.e('a-text',{position:'0 2.5 -3',value:'SIGNAL BREACH DETECTED',align:'center',color:'#ff0000',width:3},root);
    setTimeout(()=>{
      if(SIGNAL9.Entity){
        SIGNAL9.Entity.triggerJumpscare(()=>{
          if(warn)warn.setAttribute('text','value:SIGNAL RESTORED. PROCEEDING...;color:#00ff00;align:center;width:3');
          setTimeout(()=>this.load(4),2000);
        });
      } else { setTimeout(()=>this.load(4),3000); }
    },1200);
  },

  // ============================================================
  // ENDINGS
  // ============================================================
  buildEnding(root, type) {
    SIGNAL9.Audio.startDeadAir();
    this.e('a-sky',{color:'#000000'},root);
    this.e('a-entity',{light:'type:ambient;color:#111;intensity:0.3'},root);
    this.e('a-box',{position:'0 0 0',width:10,height:0.1,depth:10,material:'color:#0a0a0a'},root);

    if (type==='compliance') {
      this.e('a-sky',{color:'#0a0503'},root);
      this.e('a-entity',{position:'0 10 -20',light:'type:directional;color:#ff8844;intensity:0.5'},root);
      const poster=this.e('a-entity',{position:'0 1.8 -3'},root);
      this.e('a-box',{width:1,height:1.4,depth:0.05,material:'color:#e8d8a0'},poster);
      this.e('a-text',{value:'WDRK-TV STAFF 1987\n[FACE DETECTED]\nEMPLOYEE OF THE MONTH\nCOMPLIANCE COMMENDED\nDATED: OCT 1987',align:'center',color:'#333',width:1.5,position:'0 0 0.04'},poster);
      this.e('a-text',{position:'0 2.8 -4',value:'ENDING A: COMPLIANCE\nYou never named it.\nYour face is dated 1987.',align:'center',color:'#886633',width:2.5},root);
      SIGNAL9.UI.showSubtitle('ENDING A: COMPLIANCE',8000);
    } else if (type==='identification') {
      this.e('a-sky',{color:'#000511'},root);
      this.e('a-entity',{position:'0 2 -4',light:'type:point;color:#0044ff;intensity:1;distance:8'},root);
      this.e('a-cylinder',{position:'0 5 -5',radius:0.3,height:10,material:'color:#0044ff;opacity:0.1;transparent:true'},root);
      this.e('a-text',{position:'0 2.5 -4',value:"ENDING B: IDENTIFICATION\nYou named it.\nNow it can transmit.",align:'center',color:'#4466cc',width:2.5},root);
      SIGNAL9.UI.showSubtitle("ENDING B: IDENTIFICATION — You've helped it transmit.",8000);
    } else {
      this.e('a-sky',{color:'#0a0000'},root);
      this.e('a-entity',{position:'0 2 -3',light:'type:point;color:#ff2200;intensity:0.6;distance:8'},root);
      this.buildSignalRack(root,'0 1 -3');
      this.e('a-text',{position:'0 2.5 -3.5',value:"ENDING C: PULL THE PLUG\nEmergency battery activated.\nTracking error: permanent.",align:'center',color:'#cc2200',width:2.5},root);
      const rig=document.getElementById('rig');
      if(rig){const j=()=>{if(!rig.parentNode)return;const r=rig.getAttribute('rotation')||{x:0,y:0,z:0};rig.setAttribute('rotation',{x:r.x+(Math.random()-.5)*2,y:r.y+(Math.random()-.5)*2,z:r.z+(Math.random()-.5)*1});setTimeout(j,100+Math.random()*200);};j();}
      SIGNAL9.UI.showSubtitle('ENDING C: PULL THE PLUG — Tracking error: permanent.',8000);
    }

    const rb=this.e('a-entity',{position:'0 0.5 -3'},root);
    this.e('a-box',{width:1,height:0.18,depth:0.1,material:'color:#1a0a0a'},rb);
    this.e('a-text',{value:'↩  RETURN TO MENU',align:'center',color:'#886644',width:2,position:'0 0 0.06'},rb);
    rb.classList.add('interactive'); rb.setAttribute('pressable','action:returnToMenu');
    this.actions.returnToMenu=()=>{ SIGNAL9.currentMission=0; this.load(0); };
  }
};

// Keyboard state for desktop locomotion fallback
SIGNAL9._keys = {};
document.addEventListener('keydown', e => { SIGNAL9._keys[e.code] = true; });
document.addEventListener('keyup',   e => { SIGNAL9._keys[e.code] = false; });

console.log('[SIGNAL9] scenes.js v3 loaded — maze + Shrek AI + analog locomotion');
