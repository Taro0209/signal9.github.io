# SIGNAL 9: THE DEAD AIR ARCHIVE
### A WebXR Psychological Horror Experience

> *"WDRK-TV Signal 9 – 1997 – Authorized Personnel Only"*

---

## QUICK START (Local Testing)

### 1. Start a local server

**Python (recommended):**
```bash
cd signal9
python3 -m http.server 8000
```

Then open: `http://localhost:8000`

**Node.js alternative:**
```bash
npx serve .
```

### 2. Desktop Testing
- Open `http://localhost:8000` in Chrome/Firefox
- Click **◈ ENTER ARCHIVE**
- Use `WASD` + mouse look to move
- Press keys `1–6` to jump to missions
- Press `C` to toggle Compliance Checklist
- Press `M` to toggle Wrist Menu
- Click on interactive objects

### 3. Meta Quest 3 VR Testing

**Method A – Local Network:**
1. Connect Quest 3 and PC to same Wi-Fi
2. Find your PC's local IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
3. In Quest 3 browser, navigate to: `http://YOUR_PC_IP:8000`
4. Tap the **⬜ VR button** in the browser to enter VR

**Method B – USB/ADB Tunnel:**
```bash
adb reverse tcp:8000 tcp:8000
```
Then open `http://localhost:8000` in Quest 3 browser.

**Method C – ngrok (easiest, HTTPS required for WebXR):**
```bash
ngrok http 8000
```
Copy the HTTPS URL → open on Quest 3.

---

## DEPLOYMENT

### GitHub Pages
1. Push this folder to a GitHub repo
2. Settings → Pages → Deploy from branch `main` / `root`
3. Access at: `https://yourusername.github.io/signal9`

### Netlify (drag-and-drop)
1. Go to [netlify.com](https://netlify.com)
2. Drag the `signal9` folder onto the deploy zone
3. Get an instant HTTPS URL

### itch.io
1. ZIP the folder contents (not the folder itself)
2. Upload to itch.io as an HTML game
3. Set "Viewport dimensions" to 1920×1080
4. Enable "SharedArrayBuffer" if prompted

---

## CONTROLS REFERENCE

| Control | Action |
|---------|--------|
| Left thumbstick | Smooth locomotion |
| Right thumbstick | Snap turn (30°) |
| Right trigger | Interact / press buttons |
| Right grip | Grab objects |
| A button (right) | Open/close wrist menu |
| B button (right) | Back / close panels |
| X button (left) | Toggle Compliance Checklist |
| Y button (left) | Toggle comfort vignette |

---

## GAME STRUCTURE

```
MAIN MENU
│
├── MISSION 1: TONE Test
│     Calibrate frequency to 1000 Hz
│     Horror: wrong frequencies dim the room
│
├── MISSION 2: Children's Hour
│     Digitize VHS tape segments
│     Horror: looking away worsens the signal
│
├── MISSION 3: Blue Light Compliance
│     Survive a compliance event
│     Horror: spatial whispers based on head position
│
├── MISSION 4: Rooftop Alignment
│     Crank dish to 100% signal lock
│     Horror: ghostly delayed hand shadow
│
├── MISSION 5: Station ID Booth
│     Record station identification
│     Choice: COMPLY or NAME IT
│
└── MISSION 6: Dead Air Final
      Keep signal stable for 90 seconds
      Three dials: GAIN, SYNC, PHASE
      Option to PULL THE PLUG
      │
      ├── ENDING A: COMPLIANCE
      │     Never named it → dawn → face in 1987 poster
      │
      ├── ENDING B: IDENTIFICATION
      │     Named it → scanline world → "You've helped it transmit"
      │
      └── ENDING C: PULL THE PLUG
            Destroyed rack → permanent tracking jitter
```

---

## SIGNAL PRESENCE METER

The **Signal Presence** value (0–100) affects:
- Room lighting intensity
- Machine hum pitch
- Object stability / drift

**Increases** when you correctly observe anomalies.  
**Decreases** when you violate compliance, name the entity, or ignore procedures.

Visible on the small HUD element on camera, and in the Wrist Menu.

---

## TECHNICAL NOTES

- **No build tools required** – pure HTML/CSS/JS with CDN A-Frame
- **Audio**: 100% procedural WebAudio (oscillators + filtered noise). No audio files needed.
- **Textures**: `static.png` and `metal.png` are pre-generated. Run `python3 generate_textures.py` to regenerate them.
- **Save system**: Uses `localStorage` key `signal9_save`
- **Performance**: Targets Quest 3 (optimized low-poly, minimal physics)

---

## FILE STRUCTURE

```
signal9/
├── index.html              Main entry point
├── css/
│   └── style.css           Loading screen + base styles
├── js/
│   ├── game.js             Audio engine, save system, core
│   └── scenes.js           A-Frame components + all 6 missions
├── assets/
│   ├── textures/
│   │   ├── static.png      CRT noise texture
│   │   └── metal.png       Scratched metal texture
│   ├── audio/              (empty – all audio is procedural)
│   └── models/             (empty – all geometry is procedural)
├── generate_textures.py    Texture generation script
└── README.md               This file
```

---

## PACKAGING AS ZIP

```bash
# From parent directory:
zip -r signal9.zip signal9/ -x "*.DS_Store" -x "__pycache__/*"
```

---

## ATMOSPHERE NOTES

Signal 9 is **slow-burn psychological horror**. The horror comes from:

- **Procedure compliance** – rules that seem arbitrary but feel dangerous to break
- **Spatial audio paranoia** – whispers positioned near your ear in 3D space
- **Reality editing** – subtle prop rearrangements between visits
- **Observation mechanics** – looking at anomalies stabilizes them; ignoring them doesn't
- **Silence as horror** – dead air gaps, audio dropouts, the moment before something speaks

There are **no jump scares**. The station feels alive because it subtly *is*.

---

*"If the tone is not 1000 Hz, do not acknowledge it."*
*– WDRK-TV Compliance Manual, Appendix C*
