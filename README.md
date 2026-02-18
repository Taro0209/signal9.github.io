# SIGNAL 9: The Dead Air Archive

A WebXR psychological horror game for Meta Quest 3 built with **A‑Frame**.  Explore the basement of a regional TV station in 1998 and follow increasingly unsettling compliance procedures.  This repository contains the complete, self‑contained source code and assets required to run the game in your browser.

## Folder Structure

```
signal9/
├── index.html         # Entry point with A‑Frame and asset registration
├── css/
│   └── style.css      # Global styles for UI panels and buttons
├── js/
│   ├── game.js        # Core runtime: settings, audio, locomotion, save system
│   └── scenes.js      # Mission definitions, menus, UI helpers
├── assets/
│   └── textures/
│       ├── static.png # CRT static texture
│       └── metal.png  # Scratched metal texture for floors and walls
└── README.md          # This file
```

No external build tools are required: all scripts are loaded via CDN and the game logic lives in plain JavaScript files.  Audio is generated procedurally using the Web Audio API.

## Running Locally

WebXR content must be served over HTTP or HTTPS due to browser security restrictions.  To test the game locally:

1. Install Python 3 if it is not already available on your system.
2. Open a terminal and navigate to the `signal9` directory of this repository.
3. Start a simple HTTP server (use port 8000 or any free port).  For example:

   ```bash
   cd signal9
   python3 -m http.server 8000
   ```

4. In your browser (on your PC or Quest 3), navigate to `http://localhost:8000`.  The title page should appear.
5. Put on your Quest 3 headset and open the same address via the Oculus Browser.  Click the VR button in the bottom right to enter immersive mode.

The server will continue running until you stop it (press **Ctrl+C** in the terminal).  If you prefer another port, replace `8000` above with your chosen value.

### Running on Windows

Windows users can use the built‑in Python as above, or use `PowerShell`:

```powershell
cd signal9
python -m http.server 8000
```

Alternatively, you may install a lightweight HTTP server such as [http‑server](https://www.npmjs.com/package/http-server) from npm and run `npx http-server -p 8000`.

## Deployment to GitHub Pages

GitHub Pages allows you to host the game for free over HTTPS.  To deploy:

1. Push the `signal9` directory into a GitHub repository (e.g. `username/signal9`).
2. In the repository settings, scroll to **Pages**, choose the `main` branch and `/signal9` folder as the source.  Save.
3. GitHub will build and serve the site.  After a few minutes your game will be accessible at `https://username.github.io/signal9/`.

Alternatively, move the contents of `signal9` to the repository root and select the root as the Pages source.  The game will then be available at the root of your GitHub Pages domain.

## Deployment to itch.io or Netlify

These platforms allow drag‑and‑drop deployments:

### itch.io

1. Create a new **HTML5** project on itch.io.
2. Zip the contents of the `signal9` folder (see *Packaging* below).
3. Upload the ZIP file as the **HTML5** build.  itch.io will unpack it and host it over HTTPS.
4. Enable **Support WebXR** in the itch.io project settings so that the VR button appears.

### Netlify

1. Sign in to [Netlify](https://www.netlify.com/) and create a new site.
2. Drag the `signal9` folder into the deployment area or connect a Git repository containing the folder.
3. Netlify will automatically serve the files over HTTPS.  Visit your assigned Netlify URL to play.

## Packaging

To create a ZIP for distribution, you can use the built‑in `zip` utility.  Run the following from the root of this repository:

```bash
cd signal9
zip -r ../signal9.zip .
```

This will produce `signal9.zip` in the parent directory containing all files.  Upload this ZIP to itch.io or any static web host.

## Quest 3 Testing Instructions

1. Ensure your Meta Quest 3 is connected to Wi‑Fi and updated to the latest system version.
2. Open the **Oculus Browser** on the headset.
3. Navigate to the URL where the game is hosted (e.g. `http://your-pc-ip:8000` when testing locally or your GitHub Pages/itch.io/Netlify URL).
4. Once the page loads, you should see the title screen.  Point at the **Enter VR** button (bottom right of the player view) and pull the trigger to enter immersive mode.
5. The game supports the following controls:
   - **Left thumbstick**: move forward/back/strafe or teleport (toggle in settings).
   - **Right thumbstick**: snap turn or smooth turn (toggle in settings).
   - **Trigger (either hand)**: interact/grab/confirm.
   - **Grip**: grab/hold objects.
   - **A button (right controller)**: open/close the wrist menu (objective and settings).
   - **B button (right controller)**: back/cancel.
   - **X button (left controller)**: show/hide the compliance checklist.
   - **Y button (left controller)**: toggle comfort vignette.

6. If using teleport locomotion, push the left thumbstick forward to preview the destination (blue circle) and release to teleport.  Snap/smooth turning angle and teleport mode can be changed in the settings menu.

7. To save and quit, return to the main menu or simply close the browser.  Mission progress and settings are stored in `localStorage` and will be loaded the next time you play on the same device.

Enjoy the slow‑burn horror of **SIGNAL 9** and don’t forget to follow the rules of compliance.
