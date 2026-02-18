/*
 * scenes.js
 *
 * Defines the mission scenes, menus, and UI panels for SIGNAL 9.
 * Each mission constructs its own environment within the #gameRoot
 * container and registers callbacks for controller events via the
 * Game.setupInput() hooks in game.js.  At any given time only one
 * scene (mission or menu) is active; switching scenes tears down
 * the previous environment to free resources.
 */

const Scenes = {
  /**
   * Internal reference to the currently loaded mission index.  Used
   * when responding to back button presses and for saving
   * progress.  0 is the main menu; negative indices represent
   * special scenes such as settings or credits.
   */
  current: 0,

  /**
   * Tear down any existing scene and build the requested mission or
   * menu.  Index 0 displays the main menu.  Positive values load
   * missions.  A value of -1 shows the settings menu and -2 shows
   * credits.
   */
  loadMission(index) {
    // Save progress when leaving a mission.
    Game.save();
    // Clean up any existing scene.
    this.unloadCurrent();
    this.current = index;
    if (index === 0) {
      this.buildMainMenu();
    } else if (index === -1) {
      this.buildSettingsMenu();
    } else if (index === -2) {
      this.buildCredits();
    } else if (index === 1) {
      this.buildMission1();
    } else if (index === 2) {
      this.buildMission2();
    } else if (index === 3) {
      this.buildMission3();
    } else if (index === 4) {
      this.buildMission4();
    } else if (index === 5) {
      this.buildMission5();
    } else if (index === 6) {
      this.buildMission6();
    } else if (index === 99) {
      this.buildEnding();
    } else {
      // Fallback: unknown index returns to menu.
      this.buildMainMenu();
    }
  },

  /**
   * Remove all children from the #gameRoot entity and stop any
   * mission‑specific audio.  Called whenever transitioning between
   * missions or menus.
   */
  unloadCurrent() {
    const root = document.getElementById('gameRoot');
    while (root.firstChild) {
      root.removeChild(root.firstChild);
    }
    // Remove mission-specific callbacks.
    this.onGripEvent = null;
    this.onTriggerEvent = null;
    this.onBackButton = null;
    this.toggleChecklist = null;
    this.toggleWristMenu = null;
    this.buildWristMenu = null;
    // Stop all playing audio sources created by a mission.
    if (this._missionSounds) {
      this._missionSounds.forEach(src => src.stop && src.stop());
    }
    this._missionSounds = [];
    // Hide compliance panel if active.
    const existing = document.getElementById('compliancePanel');
    if (existing) existing.parentNode.removeChild(existing);
    // Hide wrist menu if visible.
    const wrist = document.getElementById('wristMenu');
    if (wrist) wrist.parentNode.removeChild(wrist);
  },

  /**
   * Utility to spawn a text panel at a given position with optional
   * width and height.  Returns the created entity so callers may
   * attach event listeners or assign IDs.  All panels created via
   * this helper include a slightly transparent background for
   * readability.
   */
  createPanel({ id = '', width = 1.5, height = 0.7, position = '0 1.5 -2', rotation = '0 0 0' } = {}) {
    const panel = document.createElement('a-plane');
    if (id) panel.setAttribute('id', id);
    panel.setAttribute('width', width);
    panel.setAttribute('height', height);
    panel.setAttribute('position', position);
    panel.setAttribute('rotation', rotation);
    panel.setAttribute('material', { color: '#151820', opacity: 0.88, side: 'double' });
    panel.setAttribute('radius', 0.02);
    return panel;
  },

  /**
   * Create a button entity with hover and click reactions.  The
   * returned entity is an a-plane with text child.  The callback is
   * invoked on click.  Buttons emit the `click` event via
   * super‑hands.
   */
  createButton(text, onClick, { width = 0.6, height = 0.18, position = '0 0 0' } = {}) {
    const btn = document.createElement('a-plane');
    btn.setAttribute('width', width);
    btn.setAttribute('height', height);
    btn.setAttribute('position', position);
    btn.setAttribute('class', 'interactable');
    btn.setAttribute('color', '#283040');
    btn.setAttribute('hoverable', '');
    btn.setAttribute('clickable', '');
    // Slightly raised for tactile feel
    btn.setAttribute('geometry', { primitive: 'plane', width: width, height: height });
    // Text child
    const label = document.createElement('a-text');
    label.setAttribute('value', text);
    label.setAttribute('align', 'center');
    label.setAttribute('color', '#d0d4dc');
    label.setAttribute('position', '0 0 0.001');
    label.setAttribute('width', width * 1.8);
    btn.appendChild(label);
    // Click handler
    btn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      if (onClick) onClick();
    });
    // Hover feedback: lighten on hover
    btn.addEventListener('hover-start', () => {
      btn.setAttribute('color', '#3c445a');
    });
    btn.addEventListener('hover-end', () => {
      btn.setAttribute('color', '#283040');
    });
    return btn;
  },

  /**
   * Build the main menu scene.  This scene contains the game title
   * and buttons to start a new game, continue, open settings and
   * view credits.  It also establishes a simple background room to
   * prevent the VR display from being entirely empty.
   */
  buildMainMenu() {
    const root = document.getElementById('gameRoot');
    // Basic room (floor + walls).  The menu room is small to focus
    // attention on the title panel.
    const room = document.createElement('a-entity');
    // Floor
    const floor = document.createElement('a-plane');
    floor.setAttribute('width', 6);
    floor.setAttribute('height', 6);
    floor.setAttribute('rotation', '-90 0 0');
    floor.setAttribute('material', { color: '#22262e', roughness: 1.0, metalness: 0.1 });
    room.appendChild(floor);
    // Walls (four boxes)
    const wallColor = '#1a1e26';
    const walls = [
      { pos: '0 1 -3', rot: '0 0 0' },
      { pos: '-3 1 0', rot: '0 90 0' },
      { pos: '3 1 0', rot: '0 -90 0' },
      { pos: '0 1 3', rot: '0 180 0' }
    ];
    walls.forEach(({ pos, rot }) => {
      const wall = document.createElement('a-box');
      wall.setAttribute('width', 6);
      wall.setAttribute('height', 2.5);
      wall.setAttribute('depth', 0.05);
      wall.setAttribute('position', pos);
      wall.setAttribute('rotation', rot);
      wall.setAttribute('material', { color: wallColor, side: 'double' });
      room.appendChild(wall);
    });
    // Ceiling
    const ceiling = document.createElement('a-plane');
    ceiling.setAttribute('width', 6);
    ceiling.setAttribute('height', 6);
    ceiling.setAttribute('rotation', '90 0 0');
    ceiling.setAttribute('position', '0 2.5 0');
    ceiling.setAttribute('material', { color: '#151920' });
    room.appendChild(ceiling);
    // Ambient light
    const amb = document.createElement('a-entity');
    amb.setAttribute('light', { type: 'ambient', color: '#404050', intensity: 0.6 });
    room.appendChild(amb);
    // Directional light for subtle shading
    const dir = document.createElement('a-entity');
    dir.setAttribute('light', { type: 'directional', color: '#3e4a5c', intensity: 0.4 });
    dir.setAttribute('position', '1 2 1');
    room.appendChild(dir);
    root.appendChild(room);

    // Title and buttons panel
    const panel = this.createPanel({ width: 2.0, height: 1.4, position: '0 1.6 -2.2' });
    // Title text
    const title = document.createElement('a-text');
    title.setAttribute('value', 'SIGNAL 9');
    title.setAttribute('color', '#e6e6e6');
    title.setAttribute('align', 'center');
    title.setAttribute('width', 2.0);
    title.setAttribute('position', '0 0.55 0.01');
    title.setAttribute('shader', 'msdf');
    panel.appendChild(title);
    const subtitle = document.createElement('a-text');
    subtitle.setAttribute('value', 'The Dead Air Archive');
    subtitle.setAttribute('color', '#9fa5b4');
    subtitle.setAttribute('align', 'center');
    subtitle.setAttribute('width', 2.0);
    subtitle.setAttribute('position', '0 0.35 0.01');
    subtitle.setAttribute('shader', 'msdf');
    panel.appendChild(subtitle);
    // Buttons
    const startBtn = this.createButton('Start', () => {
      Game.missionIndex = 1;
      this.loadMission(1);
    }, { position: '0 0.05 0' });
    const continueBtn = this.createButton('Continue', () => {
      // If saved mission is 0 or invalid, start mission 1.
      const idx = Game.missionIndex > 0 ? Game.missionIndex : 1;
      this.loadMission(idx);
    }, { position: '0 -0.22 0' });
    const settingsBtn = this.createButton('Settings', () => {
      this.loadMission(-1);
    }, { position: '0 -0.49 0' });
    const creditsBtn = this.createButton('Credits', () => {
      this.loadMission(-2);
    }, { position: '0 -0.76 0' });
    panel.appendChild(startBtn);
    panel.appendChild(continueBtn);
    panel.appendChild(settingsBtn);
    panel.appendChild(creditsBtn);
    root.appendChild(panel);

    // Back button support: B returns to previous menu (no effect in main menu)
    this.onBackButton = () => {
      /* no‑op in main menu */
    };
  },

  /**
   * Build the settings menu.  Provides toggles for locomotion mode,
   * turning style, vignette, subtitles, and an audio intensity slider.
   */
  buildSettingsMenu() {
    const root = document.getElementById('gameRoot');
    // Panel container
    const panel = this.createPanel({ width: 2.0, height: 1.4, position: '0 1.6 -2.2' });
    // Header
    const header = document.createElement('a-text');
    header.setAttribute('value', 'Settings');
    header.setAttribute('color', '#e6e6e6');
    header.setAttribute('align', 'center');
    header.setAttribute('width', 1.8);
    header.setAttribute('position', '0 0.55 0.01');
    panel.appendChild(header);
    // Locomotion toggle
    const locoLabel = document.createElement('a-text');
    locoLabel.setAttribute('value', 'Locomotion:');
    locoLabel.setAttribute('color', '#c0c4cc');
    locoLabel.setAttribute('align', 'right');
    locoLabel.setAttribute('width', 1.0);
    locoLabel.setAttribute('position', '-0.55 0.25 0.01');
    panel.appendChild(locoLabel);
    const locoBtn = this.createButton(() => {
      // Display current value on button via update function
      return Game.settings.locomotion === 'smooth' ? 'Smooth' : 'Teleport';
    }, () => {
      Game.settings.locomotion = Game.settings.locomotion === 'smooth' ? 'teleport' : 'smooth';
      Game.save();
      // Update button label
      locoBtn.querySelector('a-text').setAttribute('value', Game.settings.locomotion === 'smooth' ? 'Smooth' : 'Teleport');
    }, { width: 0.7, height: 0.18, position: '0.35 0.25 0' });
    // Initialise label text
    locoBtn.querySelector('a-text').setAttribute('value', Game.settings.locomotion === 'smooth' ? 'Smooth' : 'Teleport');
    panel.appendChild(locoBtn);
    // Turning mode toggle
    const turnLabel = document.createElement('a-text');
    turnLabel.setAttribute('value', 'Turning:');
    turnLabel.setAttribute('color', '#c0c4cc');
    turnLabel.setAttribute('align', 'right');
    turnLabel.setAttribute('width', 1.0);
    turnLabel.setAttribute('position', '-0.55 0.05 0.01');
    panel.appendChild(turnLabel);
    const turnBtn = this.createButton(() => {
      return Game.settings.smoothTurn ? 'Smooth' : 'Snap';
    }, () => {
      Game.settings.smoothTurn = !Game.settings.smoothTurn;
      Game.save();
      turnBtn.querySelector('a-text').setAttribute('value', Game.settings.smoothTurn ? 'Smooth' : 'Snap');
    }, { width: 0.7, height: 0.18, position: '0.35 0.05 0' });
    turnBtn.querySelector('a-text').setAttribute('value', Game.settings.smoothTurn ? 'Smooth' : 'Snap');
    panel.appendChild(turnBtn);
    // Vignette toggle
    const vigLabel = document.createElement('a-text');
    vigLabel.setAttribute('value', 'Vignette:');
    vigLabel.setAttribute('color', '#c0c4cc');
    vigLabel.setAttribute('align', 'right');
    vigLabel.setAttribute('width', 1.0);
    vigLabel.setAttribute('position', '-0.55 -0.15 0.01');
    panel.appendChild(vigLabel);
    const vigBtn = this.createButton(() => {
      return Game.settings.vignette ? 'On' : 'Off';
    }, () => {
      Game.settings.vignette = !Game.settings.vignette;
      Game.save();
      vigBtn.querySelector('a-text').setAttribute('value', Game.settings.vignette ? 'On' : 'Off');
      document.getElementById('vignette').setAttribute('visible', Game.settings.vignette);
    }, { width: 0.7, height: 0.18, position: '0.35 -0.15 0' });
    vigBtn.querySelector('a-text').setAttribute('value', Game.settings.vignette ? 'On' : 'Off');
    panel.appendChild(vigBtn);
    // Subtitles toggle
    const subLabel = document.createElement('a-text');
    subLabel.setAttribute('value', 'Subtitles:');
    subLabel.setAttribute('color', '#c0c4cc');
    subLabel.setAttribute('align', 'right');
    subLabel.setAttribute('width', 1.0);
    subLabel.setAttribute('position', '-0.55 -0.35 0.01');
    panel.appendChild(subLabel);
    const subBtn = this.createButton(() => {
      return Game.settings.subtitles ? 'On' : 'Off';
    }, () => {
      Game.settings.subtitles = !Game.settings.subtitles;
      Game.save();
      subBtn.querySelector('a-text').setAttribute('value', Game.settings.subtitles ? 'On' : 'Off');
    }, { width: 0.7, height: 0.18, position: '0.35 -0.35 0' });
    subBtn.querySelector('a-text').setAttribute('value', Game.settings.subtitles ? 'On' : 'Off');
    panel.appendChild(subBtn);
    // Audio intensity slider (increase/decrease).  We'll use two
    // buttons to adjust the numeric value.
    const audioLabel = document.createElement('a-text');
    audioLabel.setAttribute('value', 'Audio:');
    audioLabel.setAttribute('color', '#c0c4cc');
    audioLabel.setAttribute('align', 'right');
    audioLabel.setAttribute('width', 1.0);
    audioLabel.setAttribute('position', '-0.55 -0.55 0.01');
    panel.appendChild(audioLabel);
    const decreaseBtn = this.createButton('-', () => {
      Game.settings.audioIntensity = Math.max(0, Game.settings.audioIntensity - 0.1);
      Game.masterGain.gain.value = Game.settings.audioIntensity;
      Game.save();
      valueDisplay.setAttribute('value', Game.settings.audioIntensity.toFixed(1));
    }, { width: 0.2, height: 0.18, position: '0.15 -0.55 0' });
    const valueDisplay = document.createElement('a-text');
    valueDisplay.setAttribute('value', Game.settings.audioIntensity.toFixed(1));
    valueDisplay.setAttribute('color', '#e6e6e6');
    valueDisplay.setAttribute('align', 'center');
    valueDisplay.setAttribute('width', 0.4);
    valueDisplay.setAttribute('position', '0.35 -0.55 0.01');
    const increaseBtn = this.createButton('+', () => {
      Game.settings.audioIntensity = Math.min(1, Game.settings.audioIntensity + 0.1);
      Game.masterGain.gain.value = Game.settings.audioIntensity;
      Game.save();
      valueDisplay.setAttribute('value', Game.settings.audioIntensity.toFixed(1));
    }, { width: 0.2, height: 0.18, position: '0.55 -0.55 0' });
    panel.appendChild(decreaseBtn);
    panel.appendChild(valueDisplay);
    panel.appendChild(increaseBtn);
    // Back button
    const backBtn = this.createButton('Back', () => {
      this.loadMission(0);
    }, { width: 0.8, height: 0.18, position: '0 -0.85 0' });
    panel.appendChild(backBtn);
    root.appendChild(panel);
    // B button returns to main menu
    this.onBackButton = () => {
      this.loadMission(0);
    };
  },

  /**
   * Build the credits scene.  A simple panel listing contributors
   * and reference assets.  Pressing B returns to the main menu.
   */
  buildCredits() {
    const root = document.getElementById('gameRoot');
    const panel = this.createPanel({ width: 2.0, height: 1.4, position: '0 1.6 -2.2' });
    const header = document.createElement('a-text');
    header.setAttribute('value', 'Credits');
    header.setAttribute('color', '#e6e6e6');
    header.setAttribute('align', 'center');
    header.setAttribute('width', 1.8);
    header.setAttribute('position', '0 0.55 0.01');
    panel.appendChild(header);
    const body = document.createElement('a-text');
    body.setAttribute('value', 'Developed for WebXR by the SIGNAL 9 team.\n\nArt direction, design and code: ChatGPT (2026)\nTextures generated procedurally and via image synthesis.\nSound generated via WebAudio.\n\nSpecial thanks to the A‑Frame community and SuperHands authors.');
    body.setAttribute('color', '#9fa5b4');
    body.setAttribute('align', 'center');
    body.setAttribute('wrap-count', 36);
    body.setAttribute('width', 1.8);
    body.setAttribute('position', '0 0.1 0.01');
    panel.appendChild(body);
    const backBtn = this.createButton('Back', () => {
      this.loadMission(0);
    }, { width: 0.8, height: 0.18, position: '0 -0.6 0' });
    panel.appendChild(backBtn);
    root.appendChild(panel);
    this.onBackButton = () => {
      this.loadMission(0);
    };
  },

  /**
   * Build Mission 1: Tone Test.  The player must calibrate a test
   * oscillator to 1000 Hz by turning a knob.  The compliance
   * checklist is displayed on the wall.  Subtle audio and lighting
   * variations occur as the player interacts.
   */
  buildMission1() {
    const root = document.getElementById('gameRoot');
    this._missionSounds = [];
    // Environment geometry: small control room
    const env = document.createElement('a-entity');
    // Floor
    const floor = document.createElement('a-plane');
    floor.setAttribute('width', 8);
    floor.setAttribute('height', 8);
    floor.setAttribute('rotation', '-90 0 0');
    floor.setAttribute('material', { src: '#tex-metal', repeat: '8 8' });
    env.appendChild(floor);
    // Walls
    const wallPositions = [
      { pos: '0 1.25 -4', rot: '0 0 0' },
      { pos: '-4 1.25 0', rot: '0 90 0' },
      { pos: '4 1.25 0', rot: '0 -90 0' },
      { pos: '0 1.25 4', rot: '0 180 0' }
    ];
    wallPositions.forEach(({ pos, rot }) => {
      const wall = document.createElement('a-box');
      wall.setAttribute('width', 8);
      wall.setAttribute('height', 2.5);
      wall.setAttribute('depth', 0.1);
      wall.setAttribute('position', pos);
      wall.setAttribute('rotation', rot);
      wall.setAttribute('material', { src: '#tex-metal', repeat: '8 2' });
      env.appendChild(wall);
    });
    // Ceiling
    const ceiling = document.createElement('a-plane');
    ceiling.setAttribute('width', 8);
    ceiling.setAttribute('height', 8);
    ceiling.setAttribute('rotation', '90 0 0');
    ceiling.setAttribute('position', '0 2.5 0');
    ceiling.setAttribute('material', { color: '#11161f' });
    env.appendChild(ceiling);
    // Lighting
    const ambient = document.createElement('a-entity');
    ambient.setAttribute('light', { type: 'ambient', color: '#303040', intensity: 0.6 });
    env.appendChild(ambient);
    // Emergency indicator light (starts red)
    const emergency = document.createElement('a-entity');
    emergency.setAttribute('id', 'emergencyLight');
    emergency.setAttribute('light', { type: 'point', color: '#880000', intensity: 1.2, distance: 5 });
    emergency.setAttribute('position', '0 2.3 -2');
    env.appendChild(emergency);
    // Desk
    const desk = document.createElement('a-box');
    desk.setAttribute('width', 3);
    desk.setAttribute('height', 0.7);
    desk.setAttribute('depth', 1.5);
    desk.setAttribute('position', '0 0.35 -2');
    desk.setAttribute('material', { color: '#2d3342', metalness: 0.3, roughness: 0.8 });
    env.appendChild(desk);
    // CRT monitors (6) arranged on the desk
    for (let i = 0; i < 6; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const monitor = document.createElement('a-box');
      monitor.setAttribute('width', 0.6);
      monitor.setAttribute('height', 0.45);
      monitor.setAttribute('depth', 0.5);
      const xOff = (col - 1) * 0.7;
      const yOff = row * 0.5 + 0.5;
      monitor.setAttribute('position', `${xOff} ${yOff} -2.25`);
      monitor.setAttribute('material', { color: '#101417', roughness: 0.7 });
      // Static screen as front face
      const screen = document.createElement('a-plane');
      screen.setAttribute('width', 0.52);
      screen.setAttribute('height', 0.35);
      screen.setAttribute('position', '0 0 0.26');
      screen.setAttribute('material', { src: '#tex-static', color: '#ffffff', opacity: 0.8 });
      monitor.appendChild(screen);
      env.appendChild(monitor);
    }
    // Patch bay wall (simple plane with metal texture)
    const patch = document.createElement('a-plane');
    patch.setAttribute('width', 4);
    patch.setAttribute('height', 1.5);
    patch.setAttribute('position', '3.8 1 -1');
    patch.setAttribute('rotation', '0 -90 0');
    patch.setAttribute('material', { src: '#tex-metal', repeat: '4 2', metalness: 0.5, roughness: 0.8 });
    env.appendChild(patch);
    // Signal 9 rack (stack of boxes)
    for (let i = 0; i < 5; i++) {
      const rack = document.createElement('a-box');
      rack.setAttribute('width', 0.6);
      rack.setAttribute('height', 0.3);
      rack.setAttribute('depth', 0.8);
      rack.setAttribute('position', `-3.5 ${0.35 + i * 0.32} -1.5`);
      rack.setAttribute('material', { color: '#1a1f28', metalness: 0.4, roughness: 0.6 });
      env.appendChild(rack);
    }
    root.appendChild(env);
    // Start ambient machine hum in background
    const hum = Game.createHum({ frequency: 60, volume: 0.04, position: { x: 0, y: 1.5, z: -2 } });
    this._missionSounds.push(hum);
    // Tone oscillator used when knob is turned
    const tone = Game.createTone({ frequency: 1000, volume: 0.0, position: { x: 0, y: 1.5, z: -1.5 } });
    this._missionSounds.push(tone);
    // Checklist content
    const checklistText = `• If the tone is not 1000 Hz, do not acknowledge it.\n• If you hear your name, respond with “STATION ID ONLY.”\n• If the Emergency Light turns blue, look at the floor until it returns red.`;
    // Create compliance panel but keep hidden until toggled
    const checklistPanel = this.createPanel({ id: 'compliancePanel', width: 1.2, height: 0.8, position: '-1.5 1.5 -1.5', rotation: '0 20 0' });
    const checklistHeader = document.createElement('a-text');
    checklistHeader.setAttribute('value', 'Compliance Checklist');
    checklistHeader.setAttribute('color', '#f2e3a9');
    checklistHeader.setAttribute('align', 'center');
    checklistHeader.setAttribute('width', 1.1);
    checklistHeader.setAttribute('position', '0 0.35 0.01');
    checklistPanel.appendChild(checklistHeader);
    const checklistBody = document.createElement('a-text');
    checklistBody.setAttribute('value', checklistText);
    checklistBody.setAttribute('color', '#d0d4dc');
    checklistBody.setAttribute('align', 'left');
    checklistBody.setAttribute('wrap-count', 30);
    checklistBody.setAttribute('width', 1.1);
    checklistBody.setAttribute('position', '-0.55 0 0.01');
    checklistPanel.appendChild(checklistBody);
    checklistPanel.setAttribute('visible', false);
    root.appendChild(checklistPanel);
    // Toggle compliance checklist on X button
    this.toggleChecklist = () => {
      const vis = checklistPanel.getAttribute('visible');
      checklistPanel.setAttribute('visible', !vis);
    };
    // Objective/wrist menu setup
    this.buildWristMenu = () => {
      // Create a small panel attached to the right hand to display the current objective
      let menu = document.getElementById('wristMenu');
      if (menu) menu.parentNode.removeChild(menu);
      menu = document.createElement('a-entity');
      menu.setAttribute('id', 'wristMenu');
      menu.setAttribute('position', '0 0 0');
      menu.setAttribute('rotation', '0 0 0');
      // Panel background
      const bg = document.createElement('a-plane');
      bg.setAttribute('width', 0.6);
      bg.setAttribute('height', 0.4);
      bg.setAttribute('material', { color: '#151820', opacity: 0.9 });
      bg.setAttribute('position', '0 0 0');
      menu.appendChild(bg);
      const title = document.createElement('a-text');
      title.setAttribute('value', 'Objective');
      title.setAttribute('color', '#e6e6e6');
      title.setAttribute('align', 'center');
      title.setAttribute('width', 0.6);
      title.setAttribute('position', '0 0.13 0.01');
      menu.appendChild(title);
      const body = document.createElement('a-text');
      body.setAttribute('value', 'Dial the tone to 1000 Hz');
      body.setAttribute('color', '#c0c4cc');
      body.setAttribute('align', 'center');
      body.setAttribute('wrap-count', 24);
      body.setAttribute('width', 0.55);
      body.setAttribute('position', '0 -0.03 0.01');
      menu.appendChild(body);
      document.getElementById('rightHand').appendChild(menu);
    };
    // Wrist menu toggle function
    let wristVisible = false;
    this.toggleWristMenu = () => {
      wristVisible = !wristVisible;
      const menu = document.getElementById('wristMenu');
      if (menu) {
        menu.setAttribute('visible', wristVisible);
      }
      if (wristVisible && !menu) {
        this.buildWristMenu();
      }
    };
    // Build initially hidden wrist menu so it exists for toggling
    this.buildWristMenu();
    // Hide initially
    const menuEl = document.getElementById('wristMenu');
    if (menuEl) menuEl.setAttribute('visible', false);

    // Create knob object for frequency adjustment
    const knob = document.createElement('a-cylinder');
    knob.setAttribute('id', 'toneKnob');
    knob.setAttribute('class', 'interactable');
    knob.setAttribute('radius', 0.06);
    knob.setAttribute('height', 0.02);
    knob.setAttribute('rotation', '90 0 0');
    knob.setAttribute('position', '0 0.9 -1.5');
    knob.setAttribute('material', { color: '#4a596e', metalness: 0.6, roughness: 0.4 });
    // Reaction components
    knob.setAttribute('hoverable', '');
    knob.setAttribute('grabbable', '');
    knob.setAttribute('draggable', '');
    root.appendChild(knob);
    // Value display
    const toneDisplay = document.createElement('a-text');
    toneDisplay.setAttribute('id', 'toneDisplay');
    toneDisplay.setAttribute('value', 'Frequency: 1000 Hz');
    toneDisplay.setAttribute('color', '#e6e6e6');
    toneDisplay.setAttribute('width', 1.5);
    toneDisplay.setAttribute('align', 'center');
    toneDisplay.setAttribute('position', '0 1.1 -1.5');
    root.appendChild(toneDisplay);
    // Knob rotation state
    let grabbing = false;
    let startHandPos = null;
    let startRot = 0;
    let currentFreq = 1000;
    let reached = false;
    // Grab start: record starting positions
    knob.addEventListener('grab-start', (evt) => {
      grabbing = true;
      const hand = evt.detail.hand.object3D;
      startHandPos = hand.position.clone();
      const rot = knob.getAttribute('rotation');
      startRot = rot.y || 0;
    });
    knob.addEventListener('grab-end', () => {
      grabbing = false;
    });
    knob.addEventListener('drag-move', (evt) => {
      // Use drag-move for smoother continuous movement
      if (!grabbing) return;
      const hand = evt.detail.hand.object3D;
      const diff = hand.position.x - startHandPos.x;
      // Sensitivity factor determines how much rotation per metre of hand movement
      const sensitivity = 180; // degrees per metre
      let newRot = startRot + diff * sensitivity;
      // Clamp rotation between -90 and 90
      newRot = Math.max(-90, Math.min(90, newRot));
      knob.setAttribute('rotation', `90 ${newRot} 0`);
      // Map rotation to frequency [800, 1200]
      const normalized = (newRot + 90) / 180; // 0..1
      const freq = 800 + normalized * 400;
      currentFreq = Math.round(freq);
      toneDisplay.setAttribute('value', `Frequency: ${currentFreq} Hz`);
      tone.osc.frequency.value = freq;
      // Increase tone volume while dragging
      tone.gain.gain.value = 0.02;
      // If moved quickly outside allowable range, dim emergency light
      const diffRot = Math.abs(newRot - startRot);
      if (diffRot > 60) {
        const lightEl = emergency;
        const lightComp = lightEl.getAttribute('light');
        lightComp.intensity = 0.5;
        lightEl.setAttribute('light', lightComp);
      }
      // Reset intensity slowly
      setTimeout(() => {
        const comp = emergency.getAttribute('light');
        comp.intensity = 1.2;
        emergency.setAttribute('light', comp);
      }, 500);
    });
    // Grab end: fade tone out
    knob.addEventListener('grab-end', () => {
      tone.gain.gain.value = 0.0;
    });
    // Check periodically if frequency is correct
    let elapsed = 0;
    const checkInterval = setInterval(() => {
      if (!Game.running || Scenes.current !== 1) {
        clearInterval(checkInterval);
        return;
      }
      if (Math.abs(currentFreq - 1000) <= 5) {
        if (!reached) {
          reached = true;
          // Show success message briefly then proceed to next mission
          toneDisplay.setAttribute('value', 'Calibrated!');
          // Slight pause for effect
          setTimeout(() => {
            clearInterval(checkInterval);
            this.completeMission(1);
          }, 2000);
        }
      }
    }, 500);
    // Mission event handlers
    this.onBackButton = () => {
      // Return to main menu if B pressed during mission 1
      this.loadMission(0);
    };
    // Scenes.onTriggerEvent not needed here; knob uses grab
  },

  /**
   * Complete the given mission index, increase signal presence,
   * update save, and load the next mission.  For mission 6 this
   * triggers the ending sequence.
   */
  completeMission(idx) {
    // Increase signal presence gradually across missions
    Game.signalPresence = Math.min(100, Game.signalPresence + 10);
    Game.missionIndex = idx + 1;
    Game.save();
    // Delay to allow audio or visual transitions to finish
    setTimeout(() => {
      if (idx === 6) {
        // After mission 6 we handle ending in mission 6 itself
        return;
      }
      this.loadMission(Game.missionIndex);
    }, 500);
  },

  /**
   * Build Mission 2: Children’s Hour.  The player digitises a VHS
   * tape by inserting it into the deck three times.  Leaning too
   * close to the CRT produces a warning.  A puppet show is
   * represented using simple animated shapes.
   */
  buildMission2() {
    const root = document.getElementById('gameRoot');
    this._missionSounds = [];
    // Environment: digitisation room
    const env = document.createElement('a-entity');
    // Floor
    const floor = document.createElement('a-plane');
    floor.setAttribute('width', 8);
    floor.setAttribute('height', 8);
    floor.setAttribute('rotation', '-90 0 0');
    floor.setAttribute('material', { src: '#tex-metal', repeat: '8 8' });
    env.appendChild(floor);
    // Walls
    const walls = [
      { pos: '0 1.25 -4', rot: '0 0 0' },
      { pos: '-4 1.25 0', rot: '0 90 0' },
      { pos: '4 1.25 0', rot: '0 -90 0' },
      { pos: '0 1.25 4', rot: '0 180 0' }
    ];
    walls.forEach(({ pos, rot }) => {
      const wall = document.createElement('a-box');
      wall.setAttribute('width', 8);
      wall.setAttribute('height', 2.5);
      wall.setAttribute('depth', 0.1);
      wall.setAttribute('position', pos);
      wall.setAttribute('rotation', rot);
      wall.setAttribute('material', { src: '#tex-metal', repeat: '8 2' });
      env.appendChild(wall);
    });
    // Ceiling
    const ceil = document.createElement('a-plane');
    ceil.setAttribute('width', 8);
    ceil.setAttribute('height', 8);
    ceil.setAttribute('rotation', '90 0 0');
    ceil.setAttribute('position', '0 2.5 0');
    ceil.setAttribute('material', { color: '#11161f' });
    env.appendChild(ceil);
    // Lighting
    const amb = document.createElement('a-entity');
    amb.setAttribute('light', { type: 'ambient', color: '#303040', intensity: 0.6 });
    env.appendChild(amb);
    const point = document.createElement('a-entity');
    point.setAttribute('light', { type: 'point', color: '#884444', intensity: 1.0, distance: 8 });
    point.setAttribute('position', '0 2.3 0');
    env.appendChild(point);
    // Tape shelves (three rows)
    for (let i = 0; i < 3; i++) {
      const shelf = document.createElement('a-box');
      shelf.setAttribute('width', 3.5);
      shelf.setAttribute('height', 0.3);
      shelf.setAttribute('depth', 0.4);
      shelf.setAttribute('position', `3 ${0.6 + i * 0.8} 1.5`);
      shelf.setAttribute('rotation', '0 -90 0');
      shelf.setAttribute('material', { color: '#2d3342', metalness: 0.3, roughness: 0.8 });
      env.appendChild(shelf);
      // Add tapes on shelf
      for (let j = 0; j < 3; j++) {
        const tape = document.createElement('a-box');
        tape.setAttribute('class', 'interactable');
        tape.setAttribute('width', 0.25);
        tape.setAttribute('height', 0.07);
        tape.setAttribute('depth', 0.15);
        tape.setAttribute('position', `0 ${0.05} ${-1 + j * 0.2}`);
        tape.setAttribute('material', { color: '#4a596e', metalness: 0.1, roughness: 0.9 });
        tape.setAttribute('grabbable', '');
        tape.setAttribute('hoverable', '');
        // Give each tape a unique id for inventory tracking
        tape.setAttribute('id', `tape-${i}-${j}`);
        shelf.appendChild(tape);
      }
    }
    // VHS deck
    const deck = document.createElement('a-box');
    deck.setAttribute('id', 'vhsDeck');
    deck.setAttribute('class', 'interactable');
    deck.setAttribute('width', 0.8);
    deck.setAttribute('height', 0.2);
    deck.setAttribute('depth', 0.6);
    deck.setAttribute('position', '-2 0.3 -1.5');
    deck.setAttribute('material', { color: '#2d3342', metalness: 0.4, roughness: 0.7 });
    env.appendChild(deck);
    // Slot indicator (visual cue where to insert tape)
    const slot = document.createElement('a-box');
    slot.setAttribute('width', 0.6);
    slot.setAttribute('height', 0.05);
    slot.setAttribute('depth', 0.1);
    slot.setAttribute('position', '-2 0.35 -1.25');
    slot.setAttribute('material', { color: '#202633' });
    env.appendChild(slot);
    // CRT display for puppet show
    const crt = document.createElement('a-box');
    crt.setAttribute('width', 1.0);
    crt.setAttribute('height', 0.7);
    crt.setAttribute('depth', 0.5);
    crt.setAttribute('position', '0 1.1 -2.5');
    crt.setAttribute('material', { color: '#1a1f28' });
    // Screen plane
    const crtScreen = document.createElement('a-plane');
    crtScreen.setAttribute('width', 0.9);
    crtScreen.setAttribute('height', 0.6);
    crtScreen.setAttribute('position', '0 0 0.26');
    crtScreen.setAttribute('material', { color: '#000', shader: 'flat' });
    crt.appendChild(crtScreen);
    env.appendChild(crt);
    root.appendChild(env);
    // Ambient sound: ventilation
    const vent = Game.createHum({ frequency: 90, volume: 0.03, position: { x: 0, y: 2.0, z: -2 } });
    this._missionSounds.push(vent);
    // Objective panel for wrist
    this.buildWristMenu = () => {
      let menu = document.getElementById('wristMenu');
      if (menu) menu.parentNode.removeChild(menu);
      menu = document.createElement('a-entity');
      menu.setAttribute('id', 'wristMenu');
      const bg = document.createElement('a-plane');
      bg.setAttribute('width', 0.6);
      bg.setAttribute('height', 0.4);
      bg.setAttribute('material', { color: '#151820', opacity: 0.9 });
      bg.setAttribute('position', '0 0 0');
      menu.appendChild(bg);
      const title = document.createElement('a-text');
      title.setAttribute('value', 'Objective');
      title.setAttribute('color', '#e6e6e6');
      title.setAttribute('align', 'center');
      title.setAttribute('width', 0.6);
      title.setAttribute('position', '0 0.13 0.01');
      menu.appendChild(title);
      const body = document.createElement('a-text');
      body.setAttribute('value', 'Insert a tape and capture three segments.');
      body.setAttribute('color', '#c0c4cc');
      body.setAttribute('align', 'center');
      body.setAttribute('wrap-count', 28);
      body.setAttribute('width', 0.55);
      body.setAttribute('position', '0 -0.03 0.01');
      menu.appendChild(body);
      document.getElementById('rightHand').appendChild(menu);
    };
    // Build and hide wrist menu
    this.buildWristMenu();
    const wristMenu = document.getElementById('wristMenu');
    if (wristMenu) wristMenu.setAttribute('visible', false);
    this.toggleWristMenu = () => {
      const menu = document.getElementById('wristMenu');
      if (menu) menu.setAttribute('visible', !menu.getAttribute('visible'));
    };
    // Compliance checklist for mission 2
    const checklistText = `• Insert the tape gently into the deck.\n• Do not look away from the CRT while capturing.\n• If the screen warns you, heed it.`;
    const checklistPanel = this.createPanel({ id: 'compliancePanel', width: 1.2, height: 0.8, position: '-1.5 1.5 -1.5', rotation: '0 20 0' });
    const header = document.createElement('a-text');
    header.setAttribute('value', 'Compliance Checklist');
    header.setAttribute('color', '#f2e3a9');
    header.setAttribute('align', 'center');
    header.setAttribute('width', 1.1);
    header.setAttribute('position', '0 0.35 0.01');
    checklistPanel.appendChild(header);
    const bodyText = document.createElement('a-text');
    bodyText.setAttribute('value', checklistText);
    bodyText.setAttribute('color', '#d0d4dc');
    bodyText.setAttribute('align', 'left');
    bodyText.setAttribute('wrap-count', 30);
    bodyText.setAttribute('width', 1.1);
    bodyText.setAttribute('position', '-0.55 0 0.01');
    checklistPanel.appendChild(bodyText);
    checklistPanel.setAttribute('visible', false);
    root.appendChild(checklistPanel);
    this.toggleChecklist = () => {
      const vis = checklistPanel.getAttribute('visible');
      checklistPanel.setAttribute('visible', !vis);
    };
    // Tape capture logic
    let captured = 0;
    const needed = 3;
    const capturedDisplay = document.createElement('a-text');
    capturedDisplay.setAttribute('value', `Captured: ${captured}/${needed}`);
    capturedDisplay.setAttribute('color', '#e6e6e6');
    capturedDisplay.setAttribute('width', 1.0);
    capturedDisplay.setAttribute('align', 'center');
    capturedDisplay.setAttribute('position', '0 0.8 -1.5');
    root.appendChild(capturedDisplay);
    // Puppet show animation on CRT
    let playing = false;
    const puppetContainer = document.createElement('a-entity');
    crt.appendChild(puppetContainer);
    function startPuppetShow() {
      playing = true;
      puppetContainer.innerHTML = '';
      // Create simple shapes that move left and right
      for (let i = 0; i < 3; i++) {
        const shape = document.createElement('a-box');
        shape.setAttribute('width', 0.15);
        shape.setAttribute('height', 0.15);
        shape.setAttribute('depth', 0.02);
        shape.setAttribute('color', i % 2 === 0 ? '#885577' : '#558877');
        shape.setAttribute('position', `${-0.4 + i * 0.4} ${-0.1 + i * 0.15} 0.02`);
        shape.setAttribute('animation', `property: position; to: ${0.4 - i * 0.4} ${-0.1 + i * 0.15} 0.02; dir: alternate; loop: true; dur: ${2000 + i * 500}`);
        puppetContainer.appendChild(shape);
      }
      // Play whirr sound
      const whirr = Game.createHum({ frequency: 300, volume: 0.03, position: { x: 0, y: 1.5, z: -2.5 } });
      Scenes._missionSounds.push(whirr);
    }
    function stopPuppetShow() {
      playing = false;
      puppetContainer.innerHTML = '';
    }
    // Monitor player's distance to CRT to adjust screen clarity
    let lastWarning = 0;
    const distanceCheck = setInterval(() => {
      if (!Game.running || Scenes.current !== 2) {
        clearInterval(distanceCheck);
        return;
      }
      const camera = document.getElementById('camera').object3D;
      const pos = new THREE.Vector3();
      camera.getWorldPosition(pos);
      const screenPos = crtScreen.object3D.getWorldPosition(new THREE.Vector3());
      const dist = pos.distanceTo(screenPos);
      // Adjust opacity of static overlay based on distance (closer -> clear)
      const opacity = Math.min(1, Math.max(0, (dist - 0.4) / 1.0));
      crtScreen.setAttribute('material', { color: '#000', opacity: 0.8 * opacity });
      if (dist < 0.5 && Date.now() - lastWarning > 8000) {
        lastWarning = Date.now();
        // Display warning on screen
        const warn = document.createElement('a-text');
        warn.setAttribute('value', 'YOU ARE TOO CLOSE TO THE SCREEN.');
        warn.setAttribute('color', '#ff6666');
        warn.setAttribute('align', 'center');
        warn.setAttribute('width', 0.8);
        warn.setAttribute('position', '0 0 0.03');
        puppetContainer.appendChild(warn);
        setTimeout(() => {
          if (warn.parentNode) warn.parentNode.removeChild(warn);
        }, 3000);
      }
    }, 500);
    // Event when a tape is dropped on the deck
    deck.addEventListener('drag-drop', (evt) => {
      const tape = evt.detail.dropped;
      // Remove tape entity from the scene (simulate insertion)
      if (tape && tape.parentNode) {
        tape.parentNode.removeChild(tape);
      }
      // Start puppet show if not playing
      if (!playing) {
        startPuppetShow();
        setTimeout(() => {
          stopPuppetShow();
          captured++;
          capturedDisplay.setAttribute('value', `Captured: ${captured}/${needed}`);
          if (captured >= needed) {
            // Finish mission after slight delay
            setTimeout(() => {
              this.completeMission(2);
            }, 2000);
          }
        }, 5000);
      }
    });
    // Back button returns to menu
    this.onBackButton = () => {
      this.loadMission(0);
    };
  },

  /**
   * Build Mission 3: Blue Light Compliance Event.  A rack hallway
   * with a red emergency light will suddenly turn blue.  The
   * player must look down to survive the event or else hear a
   * whisper near their ear.  After the event some props are
   * subtly rearranged.
   */
  buildMission3() {
    const root = document.getElementById('gameRoot');
    this._missionSounds = [];
    // Environment: long hallway with racks and a red light
    const hallway = document.createElement('a-entity');
    // Floor
    const floor = document.createElement('a-plane');
    floor.setAttribute('width', 4);
    floor.setAttribute('height', 12);
    floor.setAttribute('rotation', '-90 0 0');
    floor.setAttribute('material', { src: '#tex-metal', repeat: '4 12' });
    hallway.appendChild(floor);
    // Walls
    const leftWall = document.createElement('a-box');
    leftWall.setAttribute('width', 0.1);
    leftWall.setAttribute('height', 2.5);
    leftWall.setAttribute('depth', 12);
    leftWall.setAttribute('position', '-2 1.25 0');
    leftWall.setAttribute('material', { src: '#tex-metal', repeat: '1 12' });
    hallway.appendChild(leftWall);
    const rightWall = document.createElement('a-box');
    rightWall.setAttribute('width', 0.1);
    rightWall.setAttribute('height', 2.5);
    rightWall.setAttribute('depth', 12);
    rightWall.setAttribute('position', '2 1.25 0');
    rightWall.setAttribute('material', { src: '#tex-metal', repeat: '1 12' });
    hallway.appendChild(rightWall);
    // Racks along the left wall
    for (let i = 0; i < 5; i++) {
      const rack = document.createElement('a-box');
      rack.setAttribute('width', 0.6);
      rack.setAttribute('height', 1.2);
      rack.setAttribute('depth', 0.8);
      rack.setAttribute('position', `-1.4 0.6 ${-5 + i * 2.5}`);
      rack.setAttribute('material', { color: '#1a1f28', metalness: 0.4, roughness: 0.6 });
      hallway.appendChild(rack);
    }
    // Emergency light
    const light = document.createElement('a-entity');
    light.setAttribute('id', 'blueEventLight');
    light.setAttribute('light', { type: 'point', color: '#880000', intensity: 1.5, distance: 8 });
    light.setAttribute('position', '0 2.2 -4');
    hallway.appendChild(light);
    // Ambient hum
    const hum = Game.createHum({ frequency: 70, volume: 0.04, position: { x: 0, y: 1, z: -4 } });
    this._missionSounds.push(hum);
    // Distant ventilation noise
    const vent = Game.createHum({ frequency: 120, volume: 0.02, position: { x: 0, y: 2, z: 2 } });
    this._missionSounds.push(vent);
    root.appendChild(hallway);
    // Checklist panel
    const checklistText = `• When the light turns blue, look down immediately.\n• Do not verify ceiling unless instructed.\n• Proceed calmly to the next area when complete.`;
    const checkPanel = this.createPanel({ id: 'compliancePanel', width: 1.3, height: 0.8, position: '-1.5 1.5 -2', rotation: '0 20 0' });
    const ch = document.createElement('a-text');
    ch.setAttribute('value', 'Compliance Checklist');
    ch.setAttribute('color', '#f2e3a9');
    ch.setAttribute('align', 'center');
    ch.setAttribute('width', 1.2);
    ch.setAttribute('position', '0 0.35 0.01');
    checkPanel.appendChild(ch);
    const cb = document.createElement('a-text');
    cb.setAttribute('value', checklistText);
    cb.setAttribute('color', '#d0d4dc');
    cb.setAttribute('align', 'left');
    cb.setAttribute('wrap-count', 32);
    cb.setAttribute('width', 1.25);
    cb.setAttribute('position', '-0.6 0 0.01');
    checkPanel.appendChild(cb);
    checkPanel.setAttribute('visible', false);
    root.appendChild(checkPanel);
    this.toggleChecklist = () => {
      const vis = checkPanel.getAttribute('visible');
      checkPanel.setAttribute('visible', !vis);
    };
    // Objective / wrist menu
    this.buildWristMenu = () => {
      let menu = document.getElementById('wristMenu');
      if (menu) menu.parentNode.removeChild(menu);
      menu = document.createElement('a-entity');
      menu.setAttribute('id', 'wristMenu');
      const bg = document.createElement('a-plane');
      bg.setAttribute('width', 0.6);
      bg.setAttribute('height', 0.4);
      bg.setAttribute('material', { color: '#151820', opacity: 0.9 });
      menu.appendChild(bg);
      const title = document.createElement('a-text');
      title.setAttribute('value', 'Objective');
      title.setAttribute('color', '#e6e6e6');
      title.setAttribute('align', 'center');
      title.setAttribute('width', 0.6);
      title.setAttribute('position', '0 0.13 0.01');
      menu.appendChild(title);
      const body = document.createElement('a-text');
      body.setAttribute('value', 'Observe compliance during the blue light event.');
      body.setAttribute('color', '#c0c4cc');
      body.setAttribute('align', 'center');
      body.setAttribute('wrap-count', 28);
      body.setAttribute('width', 0.55);
      body.setAttribute('position', '0 -0.03 0.01');
      menu.appendChild(body);
      document.getElementById('rightHand').appendChild(menu);
    };
    this.buildWristMenu();
    const w = document.getElementById('wristMenu');
    if (w) w.setAttribute('visible', false);
    this.toggleWristMenu = () => {
      const el = document.getElementById('wristMenu');
      if (el) el.setAttribute('visible', !el.getAttribute('visible'));
    };
    // Blue light event logic
    let eventTriggered = false;
    let eventResolved = false;
    // After a delay, switch light to blue and monitor head orientation
    setTimeout(() => {
      if (!Game.running || Scenes.current !== 3) return;
      eventTriggered = true;
      // Change light colour to blue
      const lc = light.getAttribute('light');
      lc.color = '#0044bb';
      light.setAttribute('light', lc);
      // Lower world audio during event
      Scenes._missionSounds.forEach(src => {
        if (src.gain) src.gain.gain.value *= 0.3;
      });
    }, 4000);
    // Poll camera pitch to detect compliance
    const checkPitch = setInterval(() => {
      if (!Game.running || Scenes.current !== 3) {
        clearInterval(checkPitch);
        return;
      }
      if (!eventTriggered || eventResolved) return;
      // Compute camera pitch (rotation around X axis)
      const cam = document.getElementById('camera').object3D;
      const pitch = cam.rotation.x; // negative when looking down
      if (pitch > 0.3) {
        // Player looked down; event resolved
        eventResolved = true;
        // Play crawling sound above
        const crawl = Game.createNoise({ volume: 0.05, position: { x: 0, y: 2.0, z: -4 } });
        Scenes._missionSounds.push(crawl);
        setTimeout(() => { crawl.stop(); }, 3000);
        // Dust particles (simple small spheres falling)
        for (let i = 0; i < 10; i++) {
          const dust = document.createElement('a-sphere');
          dust.setAttribute('radius', 0.02);
          dust.setAttribute('position', `${(Math.random()-0.5)*1} 2.4 ${-4 + (Math.random()-0.5)*1}`);
          dust.setAttribute('material', { color: '#888888', opacity: 0.5 });
          root.appendChild(dust);
          // Animate fall
          dust.setAttribute('animation', {
            property: 'position',
            to: `${dust.getAttribute('position').split(' ')[0]} 1.0 ${dust.getAttribute('position').split(' ')[2]}`,
            dur: 3000,
            easing: 'easeOutQuad'
          });
          // Remove after
          setTimeout(() => { if (dust.parentNode) dust.parentNode.removeChild(dust); }, 3500);
        }
        // Restore audio levels
        Scenes._missionSounds.forEach(src => {
          if (src.gain) src.gain.gain.value *= 3.333; // approximate inverse
        });
        // Return light to red after short delay
        setTimeout(() => {
          const c = light.getAttribute('light');
          c.color = '#880000';
          light.setAttribute('light', c);
          // Rearrange some props subtly (swap rack positions)
          if (hallway.children.length > 5) {
            const rack1 = hallway.children[3];
            const rack2 = hallway.children[4];
            const p1 = rack1.getAttribute('position');
            const p2 = rack2.getAttribute('position');
            rack1.setAttribute('position', { x: p1.x, y: p1.y, z: p2.z });
            rack2.setAttribute('position', { x: p2.x, y: p2.y, z: p1.z });
          }
          // Proceed to next mission after pause
          setTimeout(() => {
            this.completeMission(3);
          }, 2000);
        }, 2000);
      }
      // If player looks up (pitch negative) triggers whisper
      if (pitch < -0.1 && !eventResolved) {
        // Whisper near right ear
        const whisper = Game.createNoise({ volume: 0.02, position: { x: 0.15, y: 0, z: -0.1 } });
        Scenes._missionSounds.push(whisper);
        setTimeout(() => { whisper.stop(); }, 3000);
        eventResolved = true;
        // Return light to red after delay
        setTimeout(() => {
          const c = light.getAttribute('light');
          c.color = '#880000';
          light.setAttribute('light', c);
          Scenes._missionSounds.forEach(src => {
            if (src.gain) src.gain.gain.value *= 3.333;
          });
          setTimeout(() => { this.completeMission(3); }, 2000);
        }, 2000);
      }
    }, 200);
    // Back button returns to menu
    this.onBackButton = () => {
      this.loadMission(0);
    };
  },

  /**
   * Build Mission 4: Rooftop Alignment.  The player rotates a dish
   * using a crank to align with an invisible signal.  When the
   * alignment meter hits 100% the wind stops, a voice plays and a
   * delayed shadow (ghost hands) appears behind the player.
   */
  buildMission4() {
    const root = document.getElementById('gameRoot');
    this._missionSounds = [];
    // Environment: rooftop
    const env = document.createElement('a-entity');
    // Ground
    const ground = document.createElement('a-plane');
    ground.setAttribute('width', 10);
    ground.setAttribute('height', 10);
    ground.setAttribute('rotation', '-90 0 0');
    ground.setAttribute('material', { src: '#tex-metal', repeat: '10 10' });
    env.appendChild(ground);
    // Low walls around roof
    for (let i = 0; i < 4; i++) {
      const wall = document.createElement('a-box');
      wall.setAttribute('width', i % 2 === 0 ? 10 : 0.1);
      wall.setAttribute('height', 0.7);
      wall.setAttribute('depth', i % 2 === 0 ? 0.1 : 10);
      wall.setAttribute('position', `${i === 1 ? -4.95 : i === 3 ? 4.95 : 0} 0.35 ${i === 0 ? -4.95 : i === 2 ? 4.95 : 0}`);
      wall.setAttribute('material', { color: '#2d3342', roughness: 0.8 });
      env.appendChild(wall);
    }
    // Dish base
    const base = document.createElement('a-cylinder');
    base.setAttribute('height', 0.5);
    base.setAttribute('radius', 0.2);
    base.setAttribute('position', '0 0.25 -2');
    base.setAttribute('material', { color: '#454d5a', metalness: 0.4, roughness: 0.5 });
    env.appendChild(base);
    // Dish
    const dish = document.createElement('a-cone');
    dish.setAttribute('id', 'signalDish');
    dish.setAttribute('radius-bottom', 1.0);
    dish.setAttribute('radius-top', 0.05);
    dish.setAttribute('height', 0.6);
    dish.setAttribute('position', '0 0.8 -2');
    dish.setAttribute('rotation', '0 0 0');
    dish.setAttribute('material', { color: '#6a7a90', metalness: 0.3, roughness: 0.7 });
    env.appendChild(dish);
    // Crank handle
    const crank = document.createElement('a-cylinder');
    crank.setAttribute('id', 'dishCrank');
    crank.setAttribute('class', 'interactable');
    crank.setAttribute('radius', 0.05);
    crank.setAttribute('height', 0.3);
    crank.setAttribute('position', '0 1.2 -1.7');
    crank.setAttribute('rotation', '0 0 0');
    crank.setAttribute('material', { color: '#4a596e', metalness: 0.6, roughness: 0.4 });
    crank.setAttribute('hoverable', '');
    crank.setAttribute('grabbable', '');
    crank.setAttribute('draggable', '');
    env.appendChild(crank);
    // Alignment meter display
    const meterBg = document.createElement('a-plane');
    meterBg.setAttribute('width', 0.6);
    meterBg.setAttribute('height', 0.3);
    meterBg.setAttribute('position', '0 1.8 -1.5');
    meterBg.setAttribute('material', { color: '#151820', opacity: 0.9 });
    env.appendChild(meterBg);
    const meterText = document.createElement('a-text');
    meterText.setAttribute('value', 'Signal: 0%');
    meterText.setAttribute('color', '#e6e6e6');
    meterText.setAttribute('align', 'center');
    meterText.setAttribute('width', 0.5);
    meterText.setAttribute('position', '0 0 0.01');
    meterBg.appendChild(meterText);
    root.appendChild(env);
    // Ambient wind noise
    const wind = Game.createNoise({ volume: 0.04, position: { x: 0, y: 1.5, z: -2 } });
    this._missionSounds.push(wind);
    // Delayed ghost hands state
    const leftGhost = document.getElementById('leftGhost');
    const rightGhost = document.getElementById('rightGhost');
    let ghostActive = false;
    // Crank rotation state
    let dishRot = 0;
    let alignment = 0;
    crank.addEventListener('grab-start', (evt) => {
      // Start tracking drag movement
      dishRot = dish.getAttribute('rotation').y || 0;
    });
    crank.addEventListener('drag-move', (evt) => {
      const hand = evt.detail.hand.object3D;
      // Use X movement to rotate dish
      const diff = hand.position.x;
      const sensitivity = 90;
      let newRot = dishRot + diff * sensitivity;
      newRot = ((newRot % 360) + 360) % 360;
      dish.setAttribute('rotation', `0 ${newRot} 0`);
      // Compute alignment progress: assume 45° target at 90° rotation
      const target = 90;
      alignment = Math.min(100, Math.max(0, 100 - Math.abs(target - newRot)));
      meterText.setAttribute('value', `Signal: ${Math.round(alignment)}%`);
      // When full alignment reached and not yet triggered, trigger effect
      if (alignment >= 100 && !ghostActive) {
        ghostActive = true;
        // Cut wind to silence
        wind.gain.gain.value = 0.0;
        setTimeout(() => {
          // Voice message
          const voice = Game.createTone({ frequency: 440, volume: 0.02, position: { x: 0, y: 1.6, z: -2 } });
          Scenes._missionSounds.push(voice);
          // Show ghost hands (delayed shadow).  Copy positions of hands but lag 0.5s.
          leftGhost.setAttribute('visible', true);
          rightGhost.setAttribute('visible', true);
          const ghostBuffer = [];
          const track = setInterval(() => {
            if (!Game.running || Scenes.current !== 4) {
              clearInterval(track);
              return;
            }
            const lh = document.getElementById('leftHand').object3D;
            const rh = document.getElementById('rightHand').object3D;
            // Push current positions into buffer
            ghostBuffer.push({ t: Date.now(), lp: lh.position.clone(), rp: rh.position.clone(), lr: lh.rotation.clone(), rr: rh.rotation.clone() });
            // Remove items older than 500ms
            while (ghostBuffer.length && Date.now() - ghostBuffer[0].t > 500) {
              ghostBuffer.shift();
            }
            if (ghostBuffer.length) {
              const delayed = ghostBuffer[0];
              leftGhost.object3D.position.copy(delayed.lp);
              leftGhost.object3D.rotation.copy(delayed.lr);
              rightGhost.object3D.position.copy(delayed.rp);
              rightGhost.object3D.rotation.copy(delayed.rr);
            }
          }, 50);
          // End mission after some delay
          setTimeout(() => {
            clearInterval(track);
            // Hide ghost hands
            leftGhost.setAttribute('visible', false);
            rightGhost.setAttribute('visible', false);
            this.completeMission(4);
          }, 6000);
        }, 2000);
      }
    });
    // Wrist menu and checklist for mission 4
    const checklistText = `• Rotate the crank to align the dish with the signal.\n• When aligned, remain calm.`;
    const checkPanel = this.createPanel({ id: 'compliancePanel', width: 1.3, height: 0.6, position: '-1.5 1.5 -1', rotation: '0 20 0' });
    const ch = document.createElement('a-text');
    ch.setAttribute('value', 'Compliance Checklist');
    ch.setAttribute('color', '#f2e3a9');
    ch.setAttribute('align', 'center');
    ch.setAttribute('width', 1.2);
    ch.setAttribute('position', '0 0.25 0.01');
    checkPanel.appendChild(ch);
    const cb = document.createElement('a-text');
    cb.setAttribute('value', checklistText);
    cb.setAttribute('color', '#d0d4dc');
    cb.setAttribute('align', 'left');
    cb.setAttribute('wrap-count', 30);
    cb.setAttribute('width', 1.2);
    cb.setAttribute('position', '-0.6 0.0 0.01');
    checkPanel.appendChild(cb);
    checkPanel.setAttribute('visible', false);
    root.appendChild(checkPanel);
    this.toggleChecklist = () => {
      const vis = checkPanel.getAttribute('visible');
      checkPanel.setAttribute('visible', !vis);
    };
    this.buildWristMenu = () => {
      let menu = document.getElementById('wristMenu');
      if (menu) menu.parentNode.removeChild(menu);
      menu = document.createElement('a-entity');
      menu.setAttribute('id', 'wristMenu');
      const bg = document.createElement('a-plane');
      bg.setAttribute('width', 0.6);
      bg.setAttribute('height', 0.4);
      bg.setAttribute('material', { color: '#151820', opacity: 0.9 });
      menu.appendChild(bg);
      const title = document.createElement('a-text');
      title.setAttribute('value', 'Objective');
      title.setAttribute('color', '#e6e6e6');
      title.setAttribute('align', 'center');
      title.setAttribute('width', 0.6);
      title.setAttribute('position', '0 0.13 0.01');
      menu.appendChild(title);
      const body = document.createElement('a-text');
      body.setAttribute('value', 'Align the dish to lock onto the signal.');
      body.setAttribute('color', '#c0c4cc');
      body.setAttribute('align', 'center');
      body.setAttribute('wrap-count', 28);
      body.setAttribute('width', 0.55);
      body.setAttribute('position', '0 -0.03 0.01');
      menu.appendChild(body);
      document.getElementById('rightHand').appendChild(menu);
    };
    this.buildWristMenu();
    const wm = document.getElementById('wristMenu');
    if (wm) wm.setAttribute('visible', false);
    this.toggleWristMenu = () => {
      const el = document.getElementById('wristMenu');
      if (el) el.setAttribute('visible', !el.getAttribute('visible'));
    };
    // Back button
    this.onBackButton = () => {
      this.loadMission(0);
    };
  },

  /**
   * Build Mission 5: Station ID Booth.  The player records a
   * station identification and chooses whether to comply or name
   * the station.  The choice influences the ending.
   */
  buildMission5() {
    const root = document.getElementById('gameRoot');
    this._missionSounds = [];
    // Environment: foam booth
    const env = document.createElement('a-entity');
    const floor = document.createElement('a-plane');
    floor.setAttribute('width', 4);
    floor.setAttribute('height', 4);
    floor.setAttribute('rotation', '-90 0 0');
    floor.setAttribute('material', { src: '#tex-metal', repeat: '4 4' });
    env.appendChild(floor);
    // Foam walls (soft material)
    for (let i = 0; i < 4; i++) {
      const wall = document.createElement('a-box');
      wall.setAttribute('width', i % 2 === 0 ? 4 : 0.1);
      wall.setAttribute('height', 2.5);
      wall.setAttribute('depth', i % 2 === 0 ? 0.1 : 4);
      wall.setAttribute('position', `${i === 1 ? -1.95 : i === 3 ? 1.95 : 0} 1.25 ${i === 0 ? -1.95 : i === 2 ? 1.95 : 0}`);
      wall.setAttribute('material', { color: '#2e3648', roughness: 0.6 });
      env.appendChild(wall);
    }
    // Microphone stand
    const micStand = document.createElement('a-cylinder');
    micStand.setAttribute('height', 1.2);
    micStand.setAttribute('radius', 0.05);
    micStand.setAttribute('position', '0 0.6 -1');
    micStand.setAttribute('material', { color: '#4a596e', metalness: 0.6, roughness: 0.3 });
    env.appendChild(micStand);
    const mic = document.createElement('a-sphere');
    mic.setAttribute('radius', 0.08);
    mic.setAttribute('position', '0 1.25 -1');
    mic.setAttribute('material', { color: '#606c7d', metalness: 0.2, roughness: 0.4 });
    env.appendChild(mic);
    // Script panel
    const scriptPanel = document.createElement('a-plane');
    scriptPanel.setAttribute('width', 1.2);
    scriptPanel.setAttribute('height', 0.6);
    scriptPanel.setAttribute('position', '0 1.5 -0.5');
    scriptPanel.setAttribute('rotation', '0 0 0');
    scriptPanel.setAttribute('material', { color: '#151820', opacity: 0.9 });
    env.appendChild(scriptPanel);
    const scriptText = document.createElement('a-text');
    scriptText.setAttribute('value', 'THIS STATION IS ____.');
    scriptText.setAttribute('color', '#e6e6e6');
    scriptText.setAttribute('align', 'center');
    scriptText.setAttribute('wrap-count', 24);
    scriptText.setAttribute('width', 1.1);
    scriptText.setAttribute('position', '0 0 0.01');
    scriptPanel.appendChild(scriptText);
    // Buttons for compliance / identification
    const complyBtn = this.createButton('COMPLY', () => {
      Game.endingChoice = 'compliance';
      scriptText.setAttribute('value', 'Thank you for your cooperation.');
      setTimeout(() => {
        this.completeMission(5);
      }, 2000);
    }, { width: 0.5, height: 0.2, position: '-0.35 -0.4 -0.5' });
    const nameBtn = this.createButton('NAME IT', () => {
      Game.endingChoice = 'identification';
      // Heavy breathing when hovering over NAME IT is handled via hover events
      scriptText.setAttribute('value', 'THIS STATION IS SIGNAL 9.');
      setTimeout(() => {
        this.completeMission(5);
      }, 2000);
    }, { width: 0.5, height: 0.2, position: '0.35 -0.4 -0.5' });
    env.appendChild(complyBtn);
    env.appendChild(nameBtn);
    // Add heavy breathing audio when hovering over Name It button
    nameBtn.addEventListener('hover-start', () => {
      const breath = Game.createNoise({ volume: 0.05, position: { x: 0, y: 1.6, z: -1 } });
      Scenes._missionSounds.push(breath);
      nameBtn.addEventListener('hover-end', () => {
        breath.stop();
      }, { once: true });
    });
    root.appendChild(env);
    // Checklist and wrist menu
    const checklistText = `• Press record and speak the station ID script.\n• Do not elaborate unless authorised.\n• You may comply or name it.`;
    const checkPanel = this.createPanel({ id: 'compliancePanel', width: 1.3, height: 0.6, position: '-1.5 1.5 -0.8', rotation: '0 20 0' });
    const ch = document.createElement('a-text');
    ch.setAttribute('value', 'Compliance Checklist');
    ch.setAttribute('color', '#f2e3a9');
    ch.setAttribute('align', 'center');
    ch.setAttribute('width', 1.2);
    ch.setAttribute('position', '0 0.25 0.01');
    checkPanel.appendChild(ch);
    const cb = document.createElement('a-text');
    cb.setAttribute('value', checklistText);
    cb.setAttribute('color', '#d0d4dc');
    cb.setAttribute('align', 'left');
    cb.setAttribute('wrap-count', 32);
    cb.setAttribute('width', 1.2);
    cb.setAttribute('position', '-0.6 0 0.01');
    checkPanel.appendChild(cb);
    checkPanel.setAttribute('visible', false);
    root.appendChild(checkPanel);
    this.toggleChecklist = () => {
      const vis = checkPanel.getAttribute('visible');
      checkPanel.setAttribute('visible', !vis);
    };
    this.buildWristMenu = () => {
      let menu = document.getElementById('wristMenu');
      if (menu) menu.parentNode.removeChild(menu);
      menu = document.createElement('a-entity');
      menu.setAttribute('id', 'wristMenu');
      const bg = document.createElement('a-plane');
      bg.setAttribute('width', 0.6);
      bg.setAttribute('height', 0.4);
      bg.setAttribute('material', { color: '#151820', opacity: 0.9 });
      menu.appendChild(bg);
      const title = document.createElement('a-text');
      title.setAttribute('value', 'Objective');
      title.setAttribute('color', '#e6e6e6');
      title.setAttribute('align', 'center');
      title.setAttribute('width', 0.6);
      title.setAttribute('position', '0 0.13 0.01');
      menu.appendChild(title);
      const body = document.createElement('a-text');
      body.setAttribute('value', 'Record the station ID and choose your route.');
      body.setAttribute('color', '#c0c4cc');
      body.setAttribute('align', 'center');
      body.setAttribute('wrap-count', 28);
      body.setAttribute('width', 0.55);
      body.setAttribute('position', '0 -0.03 0.01');
      menu.appendChild(body);
      document.getElementById('rightHand').appendChild(menu);
    };
    this.buildWristMenu();
    const wm = document.getElementById('wristMenu');
    if (wm) wm.setAttribute('visible', false);
    this.toggleWristMenu = () => {
      const el = document.getElementById('wristMenu');
      if (el) el.setAttribute('visible', !el.getAttribute('visible'));
    };
    // Back button
    this.onBackButton = () => {
      this.loadMission(0);
    };
  },

  /**
   * Build Mission 6: Dead Air Final.  The player must keep three
   * sliders within a green zone for 90 seconds while the signal
   * attempts to complete its identification.  The player may also
   * choose to speak and accelerate the instability.  The ending
   * depends on previous choices.
   */
  buildMission6() {
    const root = document.getElementById('gameRoot');
    this._missionSounds = [];
    // Environment: final control room
    const env = document.createElement('a-entity');
    // Floor
    const floor = document.createElement('a-plane');
    floor.setAttribute('width', 8);
    floor.setAttribute('height', 8);
    floor.setAttribute('rotation', '-90 0 0');
    floor.setAttribute('material', { src: '#tex-metal', repeat: '8 8' });
    env.appendChild(floor);
    // Walls
    const walls = [
      { pos: '0 1.25 -4', rot: '0 0 0' },
      { pos: '-4 1.25 0', rot: '0 90 0' },
      { pos: '4 1.25 0', rot: '0 -90 0' },
      { pos: '0 1.25 4', rot: '0 180 0' }
    ];
    walls.forEach(({ pos, rot }) => {
      const wall = document.createElement('a-box');
      wall.setAttribute('width', 8);
      wall.setAttribute('height', 2.5);
      wall.setAttribute('depth', 0.1);
      wall.setAttribute('position', pos);
      wall.setAttribute('rotation', rot);
      wall.setAttribute('material', { src: '#tex-metal', repeat: '8 2' });
      env.appendChild(wall);
    });
    // Ceiling
    const ceil = document.createElement('a-plane');
    ceil.setAttribute('width', 8);
    ceil.setAttribute('height', 8);
    ceil.setAttribute('rotation', '90 0 0');
    ceil.setAttribute('position', '0 2.5 0');
    ceil.setAttribute('material', { color: '#11161f' });
    env.appendChild(ceil);
    // Ambient lighting
    const amb = document.createElement('a-entity');
    amb.setAttribute('light', { type: 'ambient', color: '#303040', intensity: 0.6 });
    env.appendChild(amb);
    root.appendChild(env);
    // Sliders panel
    const panel = this.createPanel({ width: 2.5, height: 1.5, position: '0 1.6 -2.5' });
    const title = document.createElement('a-text');
    title.setAttribute('value', 'Broadcast Controls');
    title.setAttribute('color', '#e6e6e6');
    title.setAttribute('align', 'center');
    title.setAttribute('width', 2.4);
    title.setAttribute('position', '0 0.6 0.01');
    panel.appendChild(title);
    // Create three sliders (gain, sync, phase)
    const sliderNames = ['Gain', 'Sync', 'Phase'];
    const sliderValues = [0.5, 0.5, 0.5];
    const sliderTargets = [0.5, 0.5, 0.5];
    const sliders = [];
    sliderNames.forEach((name, idx) => {
      // Track
      const track = document.createElement('a-box');
      track.setAttribute('width', 0.05);
      track.setAttribute('height', 0.8);
      track.setAttribute('depth', 0.05);
      track.setAttribute('material', { color: '#2d3342' });
      track.setAttribute('position', `${-0.8 + idx * 0.8} 0 0.01`);
      panel.appendChild(track);
      // Handle
      const handle = document.createElement('a-box');
      handle.setAttribute('class', 'interactable');
      handle.setAttribute('width', 0.12);
      handle.setAttribute('height', 0.08);
      handle.setAttribute('depth', 0.12);
      handle.setAttribute('material', { color: '#4a596e' });
      handle.setAttribute('position', `${-0.8 + idx * 0.8} ${(sliderValues[idx] - 0.5) * 0.8} 0.06`);
      handle.setAttribute('hoverable', '');
      handle.setAttribute('draggable', '');
      panel.appendChild(handle);
      sliders.push({ handle: handle, value: sliderValues[idx], target: sliderTargets[idx] });
      // Label
      const label = document.createElement('a-text');
      label.setAttribute('value', name);
      label.setAttribute('color', '#c0c4cc');
      label.setAttribute('align', 'center');
      label.setAttribute('width', 0.6);
      label.setAttribute('position', `${-0.8 + idx * 0.8} -0.5 0.01`);
      panel.appendChild(label);
    });
    // Hidden face pattern overlay on CRT
    const crt = document.createElement('a-box');
    crt.setAttribute('width', 1.5);
    crt.setAttribute('height', 1.0);
    crt.setAttribute('depth', 0.6);
    crt.setAttribute('position', '2.5 1.3 -2.3');
    crt.setAttribute('material', { color: '#1a1f28' });
    const screen = document.createElement('a-plane');
    screen.setAttribute('width', 1.3);
    screen.setAttribute('height', 0.8);
    screen.setAttribute('position', '0 0 0.31');
    screen.setAttribute('material', { color: '#000', opacity: 0.8 });
    crt.appendChild(screen);
    root.appendChild(crt);
    // Add panel and objective to root
    root.appendChild(panel);
    // Ventilation and hum noise
    const hum1 = Game.createHum({ frequency: 80, volume: 0.03, position: { x: 0, y: 1.5, z: -2 } });
    const hum2 = Game.createHum({ frequency: 120, volume: 0.02, position: { x: 0, y: 2.0, z: -3 } });
    this._missionSounds.push(hum1, hum2);
    // Objective wrist menu
    this.buildWristMenu = () => {
      let menu = document.getElementById('wristMenu');
      if (menu) menu.parentNode.removeChild(menu);
      menu = document.createElement('a-entity');
      menu.setAttribute('id', 'wristMenu');
      const bg = document.createElement('a-plane');
      bg.setAttribute('width', 0.6);
      bg.setAttribute('height', 0.45);
      bg.setAttribute('material', { color: '#151820', opacity: 0.9 });
      menu.appendChild(bg);
      const title = document.createElement('a-text');
      title.setAttribute('value', 'Objective');
      title.setAttribute('color', '#e6e6e6');
      title.setAttribute('align', 'center');
      title.setAttribute('width', 0.6);
      title.setAttribute('position', '0 0.15 0.01');
      menu.appendChild(title);
      const body = document.createElement('a-text');
      body.setAttribute('value', 'Keep Gain, Sync and Phase in the green zone for 90 seconds.');
      body.setAttribute('color', '#c0c4cc');
      body.setAttribute('align', 'center');
      body.setAttribute('wrap-count', 28);
      body.setAttribute('width', 0.55);
      body.setAttribute('position', '0 -0.05 0.01');
      menu.appendChild(body);
      document.getElementById('rightHand').appendChild(menu);
    };
    this.buildWristMenu();
    const wm = document.getElementById('wristMenu');
    if (wm) wm.setAttribute('visible', false);
    this.toggleWristMenu = () => {
      const el = document.getElementById('wristMenu');
      if (el) el.setAttribute('visible', !el.getAttribute('visible'));
    };
    // Checklist
    const checklistText = `• Maintain Gain, Sync and Phase within green levels for 90 seconds.\n• If you speak or describe, the signal may destabilise.\n• Avoid destroying the rack unless you intend to pull the plug.`;
    const checkPanel = this.createPanel({ id: 'compliancePanel', width: 1.5, height: 0.7, position: '-1.8 1.5 -2', rotation: '0 20 0' });
    const ch = document.createElement('a-text');
    ch.setAttribute('value', 'Compliance Checklist');
    ch.setAttribute('color', '#f2e3a9');
    ch.setAttribute('align', 'center');
    ch.setAttribute('width', 1.4);
    ch.setAttribute('position', '0 0.28 0.01');
    checkPanel.appendChild(ch);
    const cb = document.createElement('a-text');
    cb.setAttribute('value', checklistText);
    cb.setAttribute('color', '#d0d4dc');
    cb.setAttribute('align', 'left');
    cb.setAttribute('wrap-count', 36);
    cb.setAttribute('width', 1.4);
    cb.setAttribute('position', '-0.7 0 0.01');
    checkPanel.appendChild(cb);
    checkPanel.setAttribute('visible', false);
    root.appendChild(checkPanel);
    this.toggleChecklist = () => {
      const vis = checkPanel.getAttribute('visible');
      checkPanel.setAttribute('visible', !vis);
    };
    // Slider interaction: adjust values when grabbed and moved vertically
    sliders.forEach((sl, idx) => {
      let grabbing = false;
      let startY = 0;
      let startVal = sl.value;
      sl.handle.addEventListener('grab-start', (evt) => {
        grabbing = true;
        startY = evt.detail.hand.object3D.position.y;
        startVal = sl.value;
      });
      sl.handle.addEventListener('grab-end', () => {
        grabbing = false;
      });
      sl.handle.addEventListener('drag-move', (evt) => {
        if (!grabbing) return;
        const handY = evt.detail.hand.object3D.position.y;
        const dy = handY - startY;
        // Sensitivity: 1m vertical -> full range
        sl.value = Math.max(0, Math.min(1, startVal + dy * 1.5));
        // Update handle position
        const yPos = (sl.value - 0.5) * 0.8;
        sl.handle.setAttribute('position', `${-0.8 + idx * 0.8} ${yPos} 0.06`);
      });
    });
    // Hidden 'Describe It' button to increase instability and show clues
    const describeBtn = this.createButton('Describe It', () => {
      // Increase drift speed of sliders and reveal faint face on CRT
      instabilityFactor *= 2;
      const face = document.createElement('a-ring');
      face.setAttribute('radius-inner', 0.1);
      face.setAttribute('radius-outer', 0.3);
      face.setAttribute('position', '0 0 0.32');
      face.setAttribute('rotation', '0 0 0');
      face.setAttribute('material', { color: '#444466', opacity: 0.5 });
      screen.appendChild(face);
      setTimeout(() => { if (face.parentNode) face.parentNode.removeChild(face); }, 5000);
    }, { width: 0.6, height: 0.2, position: '0 -0.6 0.01' });
    panel.appendChild(describeBtn);
    // Pull the plug: A lever on the rack
    const plug = document.createElement('a-box');
    plug.setAttribute('class', 'interactable');
    plug.setAttribute('width', 0.15);
    plug.setAttribute('height', 0.05);
    plug.setAttribute('depth', 0.05);
    plug.setAttribute('position', '-2.5 0.4 -2.3');
    plug.setAttribute('material', { color: '#805050' });
    plug.setAttribute('hoverable', '');
    plug.setAttribute('grabbable', '');
    root.appendChild(plug);
    let missionFinished = false;
    // Handle pulling the plug
    plug.addEventListener('grab-start', () => {
      if (missionFinished) return;
      Game.endingChoice = 'pull';
      missionFinished = true;
      // Emergency battery kicks in: jitter vision by shaking the rig
      const rig = document.getElementById('playerRig');
      const originalPos = rig.object3D.position.clone();
      const jitter = setInterval(() => {
        rig.object3D.position.x = originalPos.x + (Math.random() - 0.5) * 0.05;
        rig.object3D.position.y = originalPos.y + (Math.random() - 0.5) * 0.05;
        rig.object3D.position.z = originalPos.z + (Math.random() - 0.5) * 0.05;
      }, 30);
      setTimeout(() => {
        clearInterval(jitter);
        rig.object3D.position.copy(originalPos);
        this.completeMission(6);
      }, 4000);
    });
    // Drifting sliders and mission timer
    let instabilityFactor = 1;
    let timeLeft = 90;
    const timerText = document.createElement('a-text');
    timerText.setAttribute('value', '90s');
    timerText.setAttribute('color', '#e6e6e6');
    timerText.setAttribute('align', 'center');
    timerText.setAttribute('width', 0.5);
    timerText.setAttribute('position', '0 0.4 0.01');
    panel.appendChild(timerText);
    const driftInterval = setInterval(() => {
      if (!Game.running || Scenes.current !== 6) {
        clearInterval(driftInterval);
        return;
      }
      if (missionFinished) {
        clearInterval(driftInterval);
        return;
      }
      // Randomly drift slider targets
      sliders.forEach(sl => {
        sl.target += (Math.random() - 0.5) * 0.02 * instabilityFactor;
        sl.target = Math.min(1, Math.max(0, sl.target));
        // Move handle slightly towards target if player doesn’t correct
        sl.value += (sl.target - sl.value) * 0.02 * instabilityFactor;
        sl.value = Math.min(1, Math.max(0, sl.value));
        const idx = sliders.indexOf(sl);
        const yPos = (sl.value - 0.5) * 0.8;
        sl.handle.setAttribute('position', `${-0.8 + idx * 0.8} ${yPos} 0.06`);
      });
      // Decrease timer and update display
      timeLeft -= 0.1;
      timerText.setAttribute('value', `${Math.ceil(timeLeft)}s`);
      if (timeLeft <= 0) {
        missionFinished = true;
        this.completeMission(6);
        clearInterval(driftInterval);
      }
    }, 100);
    // End-of-mission handling occurs in completeMission; we inspect Game.endingChoice to pick ending.
    this.onBackButton = () => {
      this.loadMission(0);
    };
  },

  /**
   * Build the ending based on the player’s choices during mission 5
   * and mission 6.  There are three endings: compliance, identification,
   * and pull.  Display different visuals and messages for each.
   */
  buildEnding() {
    const root = document.getElementById('gameRoot');
    // Clear environment
    // Display a full‑screen panel with ending text
    const panel = this.createPanel({ width: 3.0, height: 1.8, position: '0 1.6 -2' });
    let text = '';
    if (Game.endingChoice === 'pull') {
      text = 'You pulled the plug.\n\nEmergency power kept broadcasting, but your vision forever jitters.';
    } else if (Game.endingChoice === 'identification') {
      text = 'You named it.\n\nThe world shimmers with scanlines; you’ve helped it transmit.';
    } else {
      text = 'You complied.\n\nDawn arrives.  A poster on the wall now bears your face dated 1987.';
    }
    const body = document.createElement('a-text');
    body.setAttribute('value', text);
    body.setAttribute('color', '#e6e6e6');
    body.setAttribute('align', 'center');
    body.setAttribute('wrap-count', 40);
    body.setAttribute('width', 2.8);
    body.setAttribute('position', '0 0 0.01');
    panel.appendChild(body);
    root.appendChild(panel);
    // Back button leads to main menu and resets progress
    this.onBackButton = () => {
      Game.missionIndex = 1;
      Game.signalPresence = 0;
      Game.endingChoice = null;
      Game.save();
      this.loadMission(0);
    };
  }
};

// Make Scenes globally accessible
window.Scenes = Scenes;