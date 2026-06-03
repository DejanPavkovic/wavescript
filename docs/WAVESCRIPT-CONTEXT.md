# WaveScript – Project Context

**Status:** Active desktop application in development  
**Platform:** Electron (Windows 11, macOS, Linux)  
**Language:** JavaScript (vanilla) with TypeScript migration planned (post-Vulkan phase)  
**Primary Dependency:** whisper.cpp via whisper-cli (local execution)  
**Audio Processing:** Silero VAD v5.1.2 (voice activity detection)  
**Translation Service:** DeepL API (optional, 20 target languages)

## Overview

WaveScript is a desktop transcription and subtitle translation application built with Electron. It uses whisper.cpp for local, offline speech-to-text conversion with support for 21 source languages, auto-detection, and 7 output formats (SRT, VTT, TXT, LRC, CSV, JSON, WTS). Optional DeepL API integration enables subtitle translation to 20 languages. The application includes voice activity detection for reliable long-audio transcription, a setup wizard for one-click installation, and dark/light theme support.

## Architecture

### Technology Stack

- **Framework:** Electron
- **UI Framework:** Vanilla HTML/CSS/JavaScript
- **Audio Processing:** FFmpeg (format conversion, duration detection), whisper.cpp via whisper-cli (inference), Silero VAD v5.1.2 (voice detection)
- **Build System:** `build-sources.js` – concatenates source files into dist/ (Windows 11 blank-screen bug workaround)
- **Translation:** DeepL API (optional, user-provided API key)
- **Theme System:** Dark/light mode with CSS variables
- **Localization:** 4 languages – English, Bulgarian, Macedonian, Serbian

### Project Structure

```
wavescript/
├── src/
│   ├── main/                       # Electron main process (Node.js)
│   │   ├── constants.js            # App paths, VAD config, model defaults
│   │   ├── settings.js             # Load/save user settings (JSON)
│   │   ├── whisper-finder.js       # Detect whisper-cli binary location
│   │   ├── window.js               # BrowserWindow creation & management
│   │   ├── ipc-setup.js            # IPC: settings, setup wizard, status, models
│   │   ├── downloader.js           # File download utility (models, VAD)
│   │   ├── audio.js                # FFmpeg: detection, format conversion, duration
│   │   ├── vad.js                  # VAD model auto-download & config
│   │   ├── transcribe.js           # IPC: transcription process with whisper.cpp
│   │   ├── translate.js            # IPC: subtitle translation via DeepL API
│   │   └── ipc-utility.js          # IPC: open folder, read file, etc.
│   │
│   └── renderer/                   # Electron renderer (browser)
│       ├── index.template.html     # HTML structure (all JS inlined on build)
│       ├── i18n/
│       │   └── i18n.js             # Translation strings + i18n system
│       │                           # Languages: EN, BG, MK, SR
│       ├── ui/
│       │   ├── init.js             # Bootstrap & initial data load
│       │   ├── theme.js            # Dark/light theme toggle
│       │   ├── app.js              # Tab navigation & model selection
│       │   ├── wizard.js           # Setup wizard (4-step installation)
│       │   ├── transcribe.js       # Transcribe tab UI & interactions
│       │   ├── translate.js        # Translate tab UI & interactions
│       │   ├── models.js           # Models tab UI & management
│       │   ├── settings.js         # Settings tab UI & user config
│       │   └── helpers.js          # Status message & UI helper functions
│       │
│       └── styles/
│           └── styles.css          # All CSS (dark & light theme vars)
│
├── assets/
│   ├── icon.png                    # App icon (512x512)
│   ├── icon.ico                    # Windows icon (7 sizes)
│   └── icon-small.png              # Header/tab logo
│
├── preload.js                      # IPC bridge (contextBridge)
├── build-sources.js                # Build script: src/ → dist/
├── package.json
├── .gitignore
└── README.md
```

### Build Process

**File:** `build-sources.js`

The script solves the Windows 11 blank-screen bug with external JS files in Electron:

1. **Concatenate main process files:** `src/main/*.js` → `dist/main.js`
2. **Inline renderer:** `src/renderer/index.template.html` + all `src/renderer/ui/*.js` → `dist/index.html` (single file, all JS inlined)
3. **Copy static assets:** `preload.js`, `styles.css`, icons → `dist/`

**Trigger:** Runs automatically via `prestart` npm script before `npm start`

**Result:** Single `dist/` folder with zero external JS files – prevents blank-screen issues

## Key Features & Implementation

### 1. Setup Wizard
**Status:** ✅ Implemented

- 4-step installation wizard
- Auto-detect whisper-cli or download whisper.cpp
- Download VAD model (Silero v5.1.2)
- Configurable model directory
- One-click setup for first-time users

**Technical Implementation:**
- IPC: `setup-wizard-status`, `download-whisper`, `download-vad`, `download-model`
- Main process: `ipc-setup.js` coordinates downloads
- Renderer: `wizard.js` manages UI flow

### 2. Transcription Engine
**Status:** ✅ Implemented

- Spawns whisper-cli process with user's audio file
- Supports 21 input languages + auto-detect
- 7 output formats: SRT, VTT, TXT, LRC, CSV, JSON, WTS
- Real-time streaming of output to UI
- Configurable model (tiny, base, small, medium, large)

**Technical Implementation:**
- IPC: `transcribe` (main → renderer updates)
- Main process: `transcribe.js` spawns whisper-cli, parses output
- Renderer: `transcribe.js` displays progress and results

### 3. Voice Activity Detection (VAD)
**Status:** ✅ Implemented

- Silero VAD v5.1.2 integrated into transcription pipeline
- Pre-filters audio before whisper.cpp processing
- Reduces hallucinations and false positives
- Optional: can be disabled in settings
- Auto-downloaded on first run

**Technical Implementation:**
- Main process: `vad.js` manages model download and config
- Integrated into `transcribe.js` pipeline
- Config in `constants.js`

### 4. Subtitle Translation
**Status:** ✅ Implemented

- DeepL API integration (requires user API key)
- Translate subtitles to 20 target languages
- Batch translation of multiple files
- Output to SRT/VTT format

**Technical Implementation:**
- IPC: `translate` (main → renderer updates)
- Main process: `translate.js` calls DeepL API
- Renderer: `translate.js` displays progress and results
- Settings: `api-key` stored securely

### 5. Models Management
**Status:** ✅ Implemented

- View available whisper.cpp models
- Download new models
- Select active model for transcription
- Model size and language support info
- Custom model directory path

**Technical Implementation:**
- IPC: `get-models`, `download-model`, `select-model`
- Main process: `ipc-setup.js` and `ipc-utility.js`
- Renderer: `models.js` displays model list and controls

### 6. Audio Format Support
**Status:** ✅ Implemented

- Supports: MP3, WAV, M4A, FLAC, OGG, and more
- FFmpeg auto-detection and conversion
- Automatic format detection
- Duration calculation for progress indication

**Technical Implementation:**
- Main process: `audio.js` wraps FFmpeg commands
- Auto-detect FFmpeg in system PATH
- Convert to 16-bit PCM WAV for whisper.cpp

### 7. Dark/Light Theme
**Status:** ✅ Implemented

- Toggle dark/light theme
- CSS variable-based theme system
- Theme preference persisted in settings
- Real-time theme switching without reload

**Technical Implementation:**
- Renderer: `theme.js` manages toggle and persistence
- Styles: `styles.css` defines `--color-*` and `--bg-*` variables
- Main process: settings.js saves preference

### 8. Multi-Language UI
**Status:** ✅ Implemented

- Full localization: English, Bulgarian, Macedonian, Serbian
- Dynamic language switching
- All buttons, labels, and messages translated
- Language preference saved in settings

**Technical Implementation:**
- Renderer: `i18n/i18n.js` provides translation strings and helpers
- String access: `t('key')` function
- Renderer: `ui/app.js` manages language switch
- Main process: settings.js saves language preference

### 9. Settings Management
**Status:** ✅ Implemented

- Language selection
- Theme selection (dark/light)
- Default model choice
- DeepL API key configuration
- VAD enable/disable toggle
- Model directory path

**Technical Implementation:**
- IPC: `get-settings`, `save-settings`
- Main process: `settings.js` loads/saves JSON config file
- Renderer: `ui/settings.js` provides UI form

### 10. File Operations
**Status:** ✅ Implemented

- Open file picker (audio or subtitle)
- Save file dialogs (output format)
- Open output folder in file explorer
- Read subtitle files for translation input

**Technical Implementation:**
- IPC: `open-file-dialog`, `save-file-dialog`, `open-folder`
- Main process: `ipc-utility.js` wraps Electron dialog APIs
- Renderer: calls via IPC bridge

## IPC Communication Map

**Settings & Config:**
- `get-settings` → `{ language, theme, model, apiKey, vadEnabled, modelDir }`
- `save-settings` → void
- `setup-wizard-status` → `{ step, message, isComplete }`

**Whisper.cpp & Models:**
- `get-models` → `[ { name, size, lang, path }, ... ]`
- `download-model` → progress updates
- `select-model` → void
- `detect-whisper-cli` → `{ path, version }`

**Transcription:**
- `transcribe` → streaming updates: `{ status, message, progress, result }`

**Translation:**
- `translate` → streaming updates: `{ status, message, progress, result }`

**Audio:**
- `get-audio-duration` → `{ duration }`

**File Operations:**
- `open-file-dialog` → `{ filePath }`
- `save-file-dialog` → `{ filePath }`
- `open-folder` → void
- `read-file` → `{ content }`

**VAD & Download:**
- `download-vad` → progress updates
- `download-file` → progress updates

## Known Issues & Resolutions

### Windows 11 Blank Screen Bug

**Issue:** External JS/CSS files loaded from disk in Electron renderer cause blank screen on startup

**Resolution:** Build script (`build-sources.js`) concatenates all source files and inlines JS/CSS into single `dist/index.html`. Zero external file references in renderer process.

### whisper.cpp Timestamp Reset Bug

**Issue:** Multi-processor inference produces invalid/reset timestamps

**Resolution:** Users can configure `--processors 1` via whisper-cli command in transcribe.js. Default is single-processor for reliability.

### Hallucination & False Positives

**Issue:** whisper.cpp generates spurious text, especially in silent passages

**Resolution:** Silero VAD v5.1.2 pre-filters audio. Only voice-detected segments transcribed. Dramatically reduces false positives.

## Configuration & Environment

### Settings File Structure

Located at: `~/.wavescript/settings.json` (or platform equivalent)

```json
{
  "language": "en",
  "theme": "dark",
  "model": "base",
  "apiKey": "sk-...",
  "vadEnabled": true,
  "modelDir": "/path/to/models"
}
```

### Environment Variables (Optional)

- `WAVESCRIPT_MODELS_DIR` – Override default model directory
- `WAVESCRIPT_VAD_ENABLED` – Force VAD on/off
- `WHISPER_CPP_PATH` – Explicit path to whisper-cli

### Supported Platforms

- **Windows 11+** (NSIS installer, portable)
- **macOS 10.13+** (Intel & ARM, DMG)
- **Linux** (AppImage, .deb)

## Build & Distribution

### Development Build

```bash
npm install
npm start
```

Automatically runs `build-sources.js` via prestart script.

### Production Build

```bash
npm run build:win           # Windows NSIS installer
npm run build:win-portable  # Windows portable .exe
npm run build:mac           # macOS DMG (Intel + ARM)
npm run build:linux         # Linux AppImage + .deb
npm run build:all           # All platforms
```

Uses electron-builder configuration from `package.json`.

## Development Notes

- **JavaScript Only** (no TypeScript currently) – vanilla JS with clean module separation
- **CSS Variables** – Dark/light themes via CSS custom properties
- **IPC-First Architecture** – All main ↔ renderer communication through typed IPC calls
- **Build Step Required** – Always edit `src/`, never `dist/`
- **External Dependencies Minimal** – Electron, FFmpeg, whisper-cli (system binary)
- **No Telemetry** – Local-only, user controls all data

## Testing

- Manual testing on Windows 11, macOS, Linux
- Transcription accuracy with various audio formats
- Model download and switching
- VAD effectiveness on long audio
- Translation accuracy with DeepL API
- Dark/light theme switching
- Language switching across all UI
- Setup wizard flow
- File picker and save dialogs

## Future Phases (Not Yet Implemented)

- **Vulkan GPU Acceleration:** Phase after core stability
- **TypeScript Migration:** Post-Vulkan, full type safety refactor
- **Batch Queue UI:** Drag-and-drop queue management (previous iteration, removed)
- **Advanced Subtitle Editor:** In-app subtitle editing and refinement

## Dependencies

### Critical Runtime

- `electron` – Application framework
- `electron-builder` – Build & packaging
- `whisper-cli` – whisper.cpp binary (user downloads via setup wizard or pre-installed)
- `ffmpeg` – Audio format conversion (user system binary)

### Bundled Models

- Silero VAD v5.1.2 (auto-downloaded)
- whisper.cpp models (user-downloaded via app)

---

*Last Updated: June 2026*  
*Latest Stable Build: Transcribe + Translate, Setup Wizard, Dark/Light Theme, Multi-Language UI*
