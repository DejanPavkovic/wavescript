# WaveScript — Transcribe & Translate

> Desktop transcription and translation app — local Whisper.cpp + DeepL.

Built with [Whisper.cpp](https://github.com/ggml-org/whisper.cpp) for local speech recognition and the [DeepL API](https://www.deepl.com/) for subtitle translation. Inspired by [TT-Tool](https://github.com/milkotodorov/tt-tool).

---

## Features

- **Local transcription** — Audio never leaves your machine
- **21 source languages** + auto-detect
- **7 output formats** — SRT, VTT, TXT, LRC, CSV, JSON, WTS
- **Subtitle translation** via DeepL API (20 target languages)
- **Setup wizard** — One-click install of Whisper.cpp + models
- **Voice Activity Detection (VAD)** — Reliable transcription on long audio (eliminates Whisper Large V3 hallucinations)
- **Dark/light theme** with dynamic titlebar overlay
- **4 UI languages** — English, Bulgarian, Macedonian, Serbian
- **Cross-platform** — Windows, macOS (Intel + ARM), Linux

---

## Quick Start

```bash
npm install
npm start
```

The first `npm start` runs `build-sources.js` automatically via the `prestart` script. On first launch, the setup wizard guides you through installing Whisper.cpp and downloading a model.

---

## Project Structure

```
wavescript/
├── src/
│   ├── main/                  # Electron main process (Node.js)
│   │   ├── constants.js       # App paths, VAD config
│   │   ├── settings.js        # Load/save user settings
│   │   ├── whisper-finder.js  # Find whisper-cli binary
│   │   ├── window.js          # BrowserWindow creation
│   │   ├── ipc-setup.js       # IPC: settings, setup status, models, dialogs
│   │   ├── downloader.js      # File download utility
│   │   ├── audio.js           # FFmpeg detection, audio conversion, duration
│   │   ├── vad.js             # VAD model auto-download
│   │   ├── transcribe.js      # IPC: transcription with Whisper.cpp
│   │   ├── translate.js       # IPC: translation with DeepL
│   │   └── ipc-utility.js     # IPC: open folder, read file, etc.
│   └── renderer/              # Electron renderer (browser)
│       ├── index.template.html  # HTML structure (no JS)
│       ├── i18n/
│       │   └── i18n.js        # Translation strings (EN/BG/MK/SR) + i18n system
│       ├── ui/
│       │   ├── init.js        # Bootstrap + initial data load
│       │   ├── theme.js       # Dark/light theme toggle
│       │   ├── app.js         # Tab navigation + model selection
│       │   ├── wizard.js      # Setup wizard (4 steps)
│       │   ├── transcribe.js  # Transcribe tab UI
│       │   ├── translate.js   # Translate tab UI
│       │   ├── models.js      # Models tab UI
│       │   ├── settings.js    # Settings tab UI
│       │   └── helpers.js     # Status message helpers
│       └── styles/
│           └── styles.css     # All CSS (dark/light themes)
├── assets/
│   ├── icon.png               # App icon (512x512)
│   ├── icon.ico               # Windows icon (7 sizes)
│   └── icon-small.png         # Header logo
├── preload.js                 # IPC bridge (contextBridge)
├── build-sources.js           # Build script: src/ → dist/
├── package.json
├── .gitignore
└── README.md
```

---

## How the Build Works

Electron on Windows 11 has a blank-screen bug with external JS files in the renderer. The `build-sources.js` script solves this by:

1. Concatenating `src/main/*.js` → `dist/main.js`
2. Combining `src/renderer/index.template.html` + all renderer JS → `dist/index.html` (inline JS)
3. Copying static files (`preload.js`, `styles.css`, icons) → `dist/`

You edit source files in `src/`. The `dist/` folder is auto-generated and gitignored. `npm start` runs the build automatically via the `prestart` script.

---

## Build Installer

```bash
npm run build:win           # Windows NSIS installer
npm run build:win-portable  # Windows portable
npm run build:mac           # macOS DMG (Intel + ARM)
npm run build:linux         # Linux AppImage + .deb
npm run build:all           # All platforms
```

Build output goes to the `installer/` folder.

---

## Development with IntelliJ IDEA / WebStorm

1. Open the project folder
2. Ensure the Node.js plugin is enabled
3. Run `npm install` in the terminal
4. Create a Run Configuration:
   - Type: **npm**
   - Command: **start**
5. For debugging — create a **Node.js** configuration with:
   - Node interpreter: your node path
   - JavaScript file: `node_modules/.bin/electron`
   - Application parameters: `.`

---

## Credits

- [Whisper.cpp](https://github.com/ggml-org/whisper.cpp) by @ggerganov
- [DeepL API](https://www.deepl.com/)
- Inspired by [TT-Tool](https://github.com/milkotodorov/tt-tool) by @milkotodorov
- [Silero VAD](https://github.com/snakers4/silero-vad) for voice activity detection

---

## License

MIT
