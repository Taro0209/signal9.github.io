/*
 * game.js
 *
 * Core runtime for SIGNAL 9: The Dead Air Archive.  This file defines
 * the global Game object, manages save/load state, sets up input
 * controls, registers custom A‑Frame components, and orchestrates
 * mission flow.  All mission-specific geometry and logic live in
 * scenes.js.  The code here is intentionally verbose with
 * descriptive names to aid readability and maintainability.
 */

// Global namespace for the game.  All persistent state lives on the
// Game object.  Scenes and UI helpers are attached in scenes.js.
const Game = {
  /**
   * Persistent settings saved in localStorage.  See README for a
   * description of each property.  Values are updated via the
   * settings UI in the main menu or the wrist menu.
   */
  settings: {
    locomotion: 'smooth',      // 'smooth' or 'teleport'
    smoothTurn: false,         // true for smooth turning, false for snap turn
    snapTurnAngle: 30,         // degrees per snap
    vignette: false,           // comfort vignette overlay
    subtitles: true,           // display subtitle captions
    audioIntensity: 1.0        // master audio gain [0–1]
  },

  /**
   * Current mission index.  0 denotes the main menu.  A value of 1–6
   * corresponds to the numbered missions.  Negative indices can be
   * used for special scenes (e.g., credits).
   */
  missionIndex: 0,

  /**
   * Player inventory.  The player may carry at most one tape and one
   * tool at any given time.  Null indicates an empty slot.  The
   * tape slot holds an identifier string (e.g. 'childrenTape'), and
   * the tool slot holds the id of the tool entity being carried.
   */
  inventory: {
    tape: null,
    tool: null
  },

  /**
   * A measure of how much the player has stabilised or acknowledged
   * anomalous signals.  Higher values cause the environment to warp
   * and hum intensity to increase.  The meter is presented in the
   * debug settings only; the player perceives the effect through
   * subtle audio and geometry drift.  Range is [0, 100].
   */
  signalPresence: 0,

  /**
   * Underlying Web Audio context and a registry of audio sources.  All
   * mission scripts should request and stop sounds through these
   * helpers to ensure consistent handling of positional audio and
   * master gain.
   */
  audioCtx: null,
  masterGain: null,
  sources: {},

  /**
   * Flags used by the thumbstick‑controls component.  These values
   * are updated by event handlers on the controllers and consumed
   * each frame by the locomotion system.  They are declared here
   * so that both game.js and scenes.js can observe them.
   */
  moveX: 0,
  moveY: 0,
  turnX: 0,
  teleportActive: false,
  teleportTarget: null,
  running: false,

  /**
   * Initialise the game.  Called once after DOMContentLoaded.  This
   * method attaches global event listeners, boots the audio system,
   * loads saved data, and launches the first mission or menu.
   */
  init() {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // Master gain controls global volume based on user intensity setting.
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.value = this.settings.audioIntensity;
    this.masterGain.connect(this.audioCtx.destination);

    // Load settings and mission progress from localStorage.
    this.loadSave();

    // Set up controller input listeners.  See setupInput() below.
    this.setupInput();

    // Register custom A‑Frame components (e.g., locomotion).
    this.registerComponents();

    // When A‑Frame finishes initialising the scene, start the first mission.
    // We defer mission loading until the scene and its elements are ready.
    const scene = document.querySelector('a-scene');
    if (scene.hasLoaded) {
      this.start();
    } else {
      scene.addEventListener('loaded', () => this.start());
    }
  },

  /**
   * Begin game execution.  This method loads the appropriate scene
   * based on missionIndex.  It is safe to call this multiple times;
   * the previous scene will be torn down when Scenes.loadMission() is
   * called.
   */
  start() {
    this.running = true;
    // Show the vignette overlay based on settings.
    document.getElementById('vignette').setAttribute('visible', this.settings.vignette);
    // Load the requested mission or menu.
    Scenes.loadMission(this.missionIndex);
  },

  /**
   * Register A‑Frame components used throughout the game.  These
   * components encapsulate locomotion, vignette behaviour, delayed
   * shadows, and any other cross‑scene behaviours.
   */
  registerComponents() {
    // Locomotion component controlling translation and rotation via thumbsticks.
    AFRAME.registerComponent('thumbstick-controls', {
      schema: {
        moveSpeed: { type: 'number', default: 1.5 },
        turnSpeed: { type: 'number', default: 90 },     // degrees per second for smooth turn
        snapTurnAngle: { type: 'number', default: 30 }  // degrees per snap
      },
      init: function () {
        this.game = Game;
        this.rig = this.el.object3D;
        this.cameraEl = this.el.querySelector('#camera');
        this.snapCooldown = 0;
        this.teleportIndicator = null;
      },
      tick: function (time, dt) {
        if (!this.game.running) return;
        const delta = dt / 1000;
        // Determine locomotion mode.
        const locomotion = this.game.settings.locomotion;
        // TELEPORT MODE
        if (locomotion === 'teleport') {
          // When the player pushes forward on the left thumbstick, cast a ray
          // forward to show where they will land.  When they release the
          // stick (return to dead zone), teleport to the target if present.
          const lx = this.game.moveX;
          const ly = this.game.moveY;
          if (Math.abs(ly) > 0.7 && !this.game.teleportActive) {
            // Engage teleport preview.  Compute a target point 3m in the
            // direction the camera is facing, clamped to the floor.
            const cam = this.cameraEl.object3D;
            const dir = new THREE.Vector3();
            cam.getWorldDirection(dir);
            dir.y = 0;
            dir.normalize();
            const start = this.rig.position.clone();
            const end = start.clone().add(dir.multiplyScalar(3));
            end.y = 0; // Floor height
            this.game.teleportTarget = end;
            this.game.teleportActive = true;
            // Create or update a marker at the target location.
            if (!this.teleportIndicator) {
              this.teleportIndicator = document.createElement('a-entity');
              this.teleportIndicator.setAttribute('geometry', { primitive: 'ring', radiusInner: 0.1, radiusOuter: 0.15 });
              this.teleportIndicator.setAttribute('material', { color: '#00aaff', opacity: 0.6 });
              this.teleportIndicator.setAttribute('rotation', '-90 0 0');
              document.getElementById('gameRoot').appendChild(this.teleportIndicator);
            }
            this.teleportIndicator.object3D.position.copy(end);
          }
          // If the stick returns to near zero and a teleport target exists, move the rig.
          if (this.game.teleportActive && Math.abs(lx) < 0.3 && Math.abs(ly) < 0.3) {
            if (this.game.teleportTarget) {
              this.rig.position.set(this.game.teleportTarget.x, this.game.teleportTarget.y + 1.6, this.game.teleportTarget.z);
              // Clean up teleport indicator.
              if (this.teleportIndicator) {
                this.teleportIndicator.parentNode.removeChild(this.teleportIndicator);
                this.teleportIndicator = null;
              }
            }
            this.game.teleportTarget = null;
            this.game.teleportActive = false;
          }
        } else {
          // SMOOTH LOCOMOTION MODE
          const lx = this.game.moveX;
          const ly = this.game.moveY;
          // Dead zone to prevent drift.
          const threshold = 0.05;
          let moveX = Math.abs(lx) > threshold ? lx : 0;
          let moveY = Math.abs(ly) > threshold ? ly : 0;
          if (moveX !== 0 || moveY !== 0) {
            // Movement vector in world space relative to camera yaw.
            const cam = this.cameraEl.object3D;
            const dir = new THREE.Vector3();
            cam.getWorldDirection(dir);
            const yaw = Math.atan2(dir.x, dir.z);
            // Convert stick axes to forward/backwards and strafe.
            const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
            const right = new THREE.Vector3(forward.z, 0, -forward.x);
            const displacement = new THREE.Vector3();
            displacement.addScaledVector(forward, moveY * this.data.moveSpeed * delta);
            displacement.addScaledVector(right, moveX * this.data.moveSpeed * delta);
            this.rig.position.add(displacement);
          }
        }
        // TURNING
        const rx = this.game.turnX;
        if (this.game.settings.smoothTurn) {
          const angle = -rx * this.data.turnSpeed * delta * (Math.PI / 180);
          if (Math.abs(rx) > 0.05) {
            this.rig.rotation.y += angle;
          }
        } else {
          // Snap turn when axis crosses threshold and cooldown expired.
          if (Math.abs(rx) > 0.8 && this.snapCooldown <= 0) {
            const direction = rx > 0 ? -1 : 1;
            this.rig.rotation.y += direction * this.data.snapTurnAngle * (Math.PI / 180);
            this.snapCooldown = 300; // ms
          }
          if (this.snapCooldown > 0) this.snapCooldown -= dt;
        }
        // Update vignette visibility based on setting.
        const vignetteEl = document.getElementById('vignette');
        if (vignetteEl && vignetteEl.getAttribute('visible') !== this.game.settings.vignette) {
          vignetteEl.setAttribute('visible', this.game.settings.vignette);
        }
      }
    });
  },

  /**
   * Establish input listeners for controller buttons and thumbsticks.  We
   * bind to events fired by the hand-controls component (abuttondown,
   * bbuttondown, xbuttondown, ybuttondown, thumbstickmoved, trigger
   * events, etc.) to drive gameplay interactions.  The mapping is
   * aligned with the control requirements in the design brief.
   */
  setupInput() {
    const left = document.getElementById('leftHand');
    const right = document.getElementById('rightHand');
    // Reset axis values when entering VR.  Without this, stale values
    // could carry over from a previous session.
    const resetAxes = () => {
      this.moveX = 0;
      this.moveY = 0;
      this.turnX = 0;
      this.teleportActive = false;
      this.teleportTarget = null;
    };
    document.querySelector('a-scene').addEventListener('enter-vr', resetAxes);
    // Left thumbstick controls movement or teleport preview.
    left.addEventListener('thumbstickmoved', (evt) => {
      this.moveX = evt.detail.x;
      // Invert Y so pushing forward results in positive movement along Z.
      this.moveY = -evt.detail.y;
    });
    // Right thumbstick controls rotation.
    right.addEventListener('thumbstickmoved', (evt) => {
      this.turnX = evt.detail.x;
    });
    // Grip events can be used for grabbing/holding objects.  Scenes
    // register their own handlers to respond to these events.  Here
    // we simply forward them to the currently active mission if
    // available.
    const forwardGripEvent = (hand, eventName) => {
      return (evt) => {
        if (Scenes && typeof Scenes.onGripEvent === 'function') {
          Scenes.onGripEvent(hand, eventName, evt);
        }
      };
    };
    left.addEventListener('gripdown', forwardGripEvent('left', 'gripdown'));
    left.addEventListener('gripup', forwardGripEvent('left', 'gripup'));
    right.addEventListener('gripdown', forwardGripEvent('right', 'gripdown'));
    right.addEventListener('gripup', forwardGripEvent('right', 'gripup'));
    // Trigger events used for interacting with UI and objects.
    const forwardTriggerEvent = (hand, eventName) => {
      return (evt) => {
        if (Scenes && typeof Scenes.onTriggerEvent === 'function') {
          Scenes.onTriggerEvent(hand, eventName, evt);
        }
      };
    };
    left.addEventListener('triggerdown', forwardTriggerEvent('left', 'triggerdown'));
    left.addEventListener('triggerup', forwardTriggerEvent('left', 'triggerup'));
    right.addEventListener('triggerdown', forwardTriggerEvent('right', 'triggerdown'));
    right.addEventListener('triggerup', forwardTriggerEvent('right', 'triggerup'));
    // ABXY buttons.  Y toggles vignette, X toggles checklist, A opens
    // wrist menu, B cancels/back.  Scenes.js registers additional
    // handlers for mission‑specific interactions triggered by these
    // buttons if needed.
    left.addEventListener('xbuttondown', () => {
      Game.toggleChecklist();
    });
    left.addEventListener('ybuttondown', () => {
      Game.toggleVignette();
    });
    right.addEventListener('abuttondown', () => {
      Game.toggleWristMenu();
    });
    right.addEventListener('bbuttondown', () => {
      Scenes.onBackButton && Scenes.onBackButton();
    });
  },

  /**
   * Show or hide the comfort vignette overlay.  Called when the Y
   * button on the left controller is pressed or via the settings UI.
   */
  toggleVignette() {
    this.settings.vignette = !this.settings.vignette;
    const vignetteEl = document.getElementById('vignette');
    vignetteEl.setAttribute('visible', this.settings.vignette);
    this.save();
  },

  /**
   * Toggle the on‑wrist menu.  The menu displays the current
   * objective and provides access to settings.  Scenes can override
   * `Scenes.buildWristMenu()` to supply mission‑specific content.
   */
  toggleWristMenu() {
    if (Scenes && typeof Scenes.toggleWristMenu === 'function') {
      Scenes.toggleWristMenu();
    }
  },

  /**
   * Toggle the compliance checklist.  The checklist is a panel
   * anchored in world space that lists rules for the current
   * mission.  Scenes provide the checklist content.
   */
  toggleChecklist() {
    if (Scenes && typeof Scenes.toggleChecklist === 'function') {
      Scenes.toggleChecklist();
    }
  },

  /**
   * Save the current settings and mission progress to localStorage.  To
   * minimise risk of corrupting the save, we catch errors and log
   * them to the console.
   */
  save() {
    try {
      const data = {
        settings: this.settings,
        missionIndex: this.missionIndex,
        signalPresence: this.signalPresence
      };
      localStorage.setItem('signal9_save', JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save game state:', e);
    }
  },

  /**
   * Load settings and mission progress from localStorage.  If no
   * previous save exists, defaults remain unchanged.
   */
  loadSave() {
    try {
      const json = localStorage.getItem('signal9_save');
      if (json) {
        const data = JSON.parse(json);
        if (data.settings) Object.assign(this.settings, data.settings);
        if (typeof data.missionIndex === 'number') this.missionIndex = data.missionIndex;
        if (typeof data.signalPresence === 'number') this.signalPresence = data.signalPresence;
      }
    } catch (e) {
      console.warn('Failed to load game state:', e);
    }
  },

  /**
   * Create a basic oscillator hum for ambient machine noise.  The
   * returned object contains nodes for the oscillator, gain and
   * panner.  The caller should set the panner position in world
   * coordinates and adjust gain as required.  Call `stop()` on the
   * returned source to dispose of it.
   */
  createHum({ frequency = 50, volume = 0.02, position = { x: 0, y: 1, z: 0 } } = {}) {
    const osc = this.audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = frequency;
    const gain = this.audioCtx.createGain();
    gain.gain.value = volume;
    const panner = this.audioCtx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.setPosition(position.x, position.y, position.z);
    // Connect chain: osc -> gain -> panner -> masterGain -> destination
    osc.connect(gain);
    gain.connect(panner);
    panner.connect(this.masterGain);
    osc.start();
    return {
      osc: osc,
      gain: gain,
      panner: panner,
      stop: () => { osc.stop(); osc.disconnect(); gain.disconnect(); panner.disconnect(); }
    };
  },

  /**
   * Create a constant noise source using a buffer of random values.
   * This can be used for whispers or static.  The returned object
   * contains a gain node and a panner.  Call `stop()` to halt the
   * playback.
   */
  createNoise({ volume = 0.01, position = { x: 0, y: 1, z: 0 } } = {}) {
    // Generate white noise buffer
    const sampleRate = this.audioCtx.sampleRate;
    const buffer = this.audioCtx.createBuffer(1, sampleRate * 2, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = this.audioCtx.createGain();
    gain.gain.value = volume;
    const panner = this.audioCtx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.setPosition(position.x, position.y, position.z);
    source.connect(gain);
    gain.connect(panner);
    panner.connect(this.masterGain);
    source.start();
    return {
      source: source,
      gain: gain,
      panner: panner,
      stop: () => { source.stop(); source.disconnect(); gain.disconnect(); panner.disconnect(); }
    };
  },

  /**
   * Create a sine wave tone at the specified frequency.  Used in
   * mission 1 during the tone calibration test.  The returned object
   * contains the oscillator and gain nodes.  Use the `gain` node to
   * fade the sound in/out.
   */
  createTone({ frequency = 1000, volume = 0.02, position = { x: 0, y: 1, z: 0 } } = {}) {
    const osc = this.audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    const gain = this.audioCtx.createGain();
    gain.gain.value = volume;
    const panner = this.audioCtx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.setPosition(position.x, position.y, position.z);
    osc.connect(gain);
    gain.connect(panner);
    panner.connect(this.masterGain);
    osc.start();
    return {
      osc: osc,
      gain: gain,
      panner: panner,
      stop: () => { osc.stop(); osc.disconnect(); gain.disconnect(); panner.disconnect(); }
    };
  }
};

// Kick off initialisation when the page content is ready.
window.addEventListener('DOMContentLoaded', () => {
  Game.init();
});