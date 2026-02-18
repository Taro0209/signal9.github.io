// SIGNAL 9: THE DEAD AIR ARCHIVE - CORE LOGIC

// --- WebAudio Setup for Procedural Horror Audio ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;
let ambientHum;

// Generates the oppressive room hum
function createHum() {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(55, audioCtx.currentTime); // Low AC hum
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    osc.connect(gain);
    gain.connect(audioCtx.destination); // In a full build, connect to an A-Frame spatial panner
    osc.start();
    return { osc, gain };
}

// Generates procedural white noise for the "dead air"
function playStaticBurst(duration = 1000) {
    if(!audioCtx) return;
    const bufferSize = audioCtx.sampleRate * (duration / 1000);
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) { data[i] = Math.random() * 2 - 1; }
    
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = buffer;
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
    
    noiseSource.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    noiseSource.start();
}

// --- Game State Management ---
const GameState = {
    mission: parseInt(localStorage.getItem('signal9_mission')) || 1,
    signalPresence: 0,
    hasChecklistOpen: false,
    
    save() {
        localStorage.setItem('signal9_mission', this.mission);
        this.updateDebug();
    },
    
    updateDebug() {
        const debugEl = document.getElementById('debug-text');
        if(debugEl) debugEl.innerText = `Mission: ${this.mission} | Signal Presence: ${this.signalPresence}%`;
    }
};

// --- Initialization & Input ---
document.querySelector('a-scene').addEventListener('enter-vr', () => {
    // WebAudio requires user gesture to start
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    if (!ambientHum) {
        ambientHum = createHum();
    }
    document.getElementById('ui').style.display = 'none';
});

// Map Quest Controller Buttons once models load
const setupControllers = setInterval(() => {
    const leftHand = document.getElementById('left-hand');
    if (leftHand) {
        clearInterval(setupControllers);
        
        // X Button: Toggle Compliance Checklist
        leftHand.addEventListener('xbuttondown', () => {
            GameState.hasChecklistOpen = !GameState.hasChecklistOpen;
            document.getElementById('clipboard').setAttribute('visible', GameState.hasChecklistOpen);
        });

        // Y Button: Toggle Comfort Vignette
        leftHand.addEventListener('ybuttondown', () => {
            const vig = document.getElementById('vignette');
            const currentOp = vig.getAttribute('material').opacity;
            vig.setAttribute('material', `color: black; transparent: true; opacity: ${currentOp == 0 ? 0.8 : 0}`);
        });
    }
}, 500);

// --- Mission Logic Framework ---
function loadMission(missionNumber) {
    GameState.mission = missionNumber;
    GameState.save();
    console.log("Loading Mission:", missionNumber);
    
    // Reset Environment State
    document.getElementById('emergency-light').setAttribute('light', 'color: #ff0000');
    
    switch(missionNumber) {
        case 1: startToneTest(); break;
        case 2: startChildrensHour(); break;
        case 3: startBlueLightEvent(); break;
        default: console.log("Archive loop complete or pending.");
    }
}

// MISSION 1: TONE TEST
function startToneTest() {
    const knob = document.getElementById('tone-knob');
    const readout = document.getElementById('tone-readout');
    let currentHz = 800;
    readout.setAttribute('value', `${currentHz} Hz`);
    
    const knobListener = () => {
        currentHz += 50;
        if(currentHz > 1200) currentHz = 800;
        readout.setAttribute('value', `${currentHz} Hz`);
        
        if (currentHz === 1000) {
            // Objective met
            ambientHum.osc.frequency.rampToValueAtTime(60, audioCtx.currentTime + 1);
            knob.removeEventListener('click', knobListener);
            setTimeout(() => {
                playStaticBurst(500);
                loadMission(2);
            }, 3000);
        } else if (currentHz === 1150) {
            // Anomaly logic: Pitch bends down subtly
            ambientHum.osc.frequency.linearRampToValueAtTime(45, audioCtx.currentTime + 2);
            GameState.signalPresence += 10;
            GameState.updateDebug();
        }
    };
    
    knob.addEventListener('click', knobListener);
}

// MISSION 2: CHILDREN'S HOUR (Tape Digitization)
function startChildrensHour() {
    const tape = document.getElementById('mission-tape');
    const crtScreen = document.getElementById('main-crt-screen');
    
    crtScreen.setAttribute('material', 'color: #fff'); // Screen turns on to white static
    playStaticBurst(2000);

    tape.addEventListener('click', () => {
        // Simulate picking up and inserting tape
        tape.setAttribute('visible', 'false');
        crtScreen.setAttribute('material', 'color: #0000ff'); // VCR Blue Screen
        
        setTimeout(() => {
            loadMission(3);
        }, 4000);
    }, { once: true });
}

// MISSION 3: BLUE LIGHT COMPLIANCE EVENT
function startBlueLightEvent() {
    const light = document.getElementById('emergency-light');
    light.setAttribute('light', 'color: #0000ff'); // Turns Blue
    
    // Check player head pitch to see if they look down
    const camera = document.getElementById('camera');
    let eventActive = true;

    const checkInterval = setInterval(() => {
        if(!eventActive) return;
        
        const rotation = camera.getAttribute('rotation');
        if (rotation.x < -30) {
            // Looked down (Complied)
            clearInterval(checkInterval);
            eventActive = false;
            light.setAttribute('light', 'color: #ff0000');
            console.log("Compliance met.");
            // Proceed to next mission
        } else if (rotation.x > 30) {
            // Looked up (Failed/Anomaly)
            clearInterval(checkInterval);
            eventActive = false;
            GameState.signalPresence += 50;
            GameState.updateDebug();
            
            // Audio scare
            playStaticBurst(200);
            if(ambientHum) ambientHum.osc.frequency.setValueAtTime(40, audioCtx.currentTime);
            
            light.setAttribute('light', 'color: #ff0000');
            console.log("Compliance failed. Signal increased.");
        }
    }, 500);
}

// Init game on window load
window.onload = () => { 
    GameState.updateDebug();
    loadMission(GameState.mission); 
};
