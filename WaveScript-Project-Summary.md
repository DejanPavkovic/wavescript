# WaveScript — Complete Project Summary

**Status:** Refactored and modularized (v1.1.0, June 2026)
**Repository:** https://github.com/DejanPavkovic/wavescript

## What It Is

Desktop application (Electron, vanilla JavaScript) for:

1. **Local audio/video transcription** via whisper.cpp (21 languages, 7 output formats)
2. **Subtitle translation** via DeepL API (20 target languages)

Inspired by [milkotodorov/tt-tool](https://github.com/milkotodorov/tt-tool) but rebuilt from scratch as a modern, modular Electron application with multi-platform support and improved UX.

---

## Current Architecture (Refactored)

### Project Structure

```
wavescript/
├── src/
│   ├── main/                       # Electron main process (Node.js)
│   │   ├── constants.js            # App paths, VAD config, model defaults
│   │   ├── settings.js             # Load/save user settings (JSON)
│   │   ├── whisper-finder.js       # Detect whisper-cli binary location
│   │   ├── window.js               # BrowserWindow creation & titlebar
│   │   ├── ipc-setup.js            # IPC: settings, wizard, models, status
│   │   ├── ipc-utility.js          # IPC: file dialogs, folder open, file read
│   │   ├── downloader.js           # File download utility (models, VAD)
│   │   ├── audio.js                # FFmpeg: detection, format conversion, duration
│   │   ├── vad.js                  # VAD model auto-download & config
│   │   ├── transcribe.js           # IPC: transcription with whisper.cpp
│   │   └── translate.js            # IPC: translation via DeepL API
│   │
│   └── renderer/                   # Electron renderer (browser)
│       ├── index.template.html     # HTML structure (JS inlined on build)
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
├── package-lock.json
├── .gitignore
└── README.md
```

### Key Architecture Decisions

1. **Modular Main Process** — Each responsibility in its own file
   - `constants.js` — Configuration
   - `settings.js` — User config persistence
   - `transcribe.js` — Transcription logic
   - `translate.js` — Translation logic
   - `ipc-*.js` — IPC handlers grouped by feature
   - `audio.js`, `vad.js`, `downloader.js` — Utilities

2. **Modular Renderer** — One file per UI feature
   - `ui/transcribe.js`, `ui/translate.js`, `ui/models.js`, `ui/settings.js` — Tab logic
   - `wizard.js` — Setup wizard
   - `theme.js`, `init.js`, `app.js` — Core renderer features
   - `helpers.js` — Shared utilities

3. **Build System** — `build-sources.js` concatenates source files to `dist/`
   - Solves Windows 11 blank-screen bug with external JS files
   - Result: Single `dist/index.html` with all JS inlined, single `dist/main.js`
   - Developer edits `src/`, build step handles concatenation
   - Triggered automatically via `prestart` npm script

4. **Settings Persistence** — JSON file in user app data
   - Stores: language, theme, model, API key, VAD enabled, model directory

5. **IPC-First Architecture** — All main ↔ renderer communication via IPC
   - Renderer never accesses file system directly
   - Main process handles all OS operations
   - Errors returned as `{ status, message }` objects (never thrown)

6. **CSS Theme System** — Dark/light mode via CSS variables
   - `[data-theme="dark"]` selector for dark mode
   - All colors defined as CSS custom properties
   - Instant switching without reload

---

## Complete Feature List (All Working)

### Setup Wizard (4 Steps)

- **Step 1:** Language selection (EN, BG, MK, SR) with English pre-selected
- **Step 2:** Detect or download whisper-cli (v1.8.4 from GitHub)
- **Step 3:** Download model (Tiny, Base, Base.en, Small, Small.en, Medium, Medium.en, Large V3)
- **Step 4:** Optional DeepL API key configuration
- SVG wave logo on all steps
- Skip Setup button available when re-running wizard
- Cancel buttons on downloads

### Transcribe Tab

- Audio/video file browser
- 21 source languages + auto-detect
- 7 output formats: SRT, VTT, TXT, LRC, CSV, JSON, WTS
- **Auto model selection:** English → Medium.en, other languages → Large V3 (with override)
- CPU/thread control (auto-detected from hardware, capped to physical cores)
- **Test mode:** Duration slider (10–300 seconds) for testing
- **Segment length:** Auto / Standard 42 / Long 60 / Very Long 80 / Short 20 / Custom
- Processing card with wave animation + timer (h:mm:ss) + progress bar
- **Live preview:** SRT-style (row number + timestamp + text) updating in real-time
- Copy + Open Folder + "Translate this file" button
- Auto-translate checkbox
- Cancel transcription button

### Translate Tab

- SRT/VTT/TXT file browser
- 20 target languages
- Output format selection
- DeepL quota check before starting (prevents failed API calls)
- Processing card with wave animation + timer + progress
- Result card with Copy + Open Folder

### Models Tab

- List all downloaded models with file sizes
- Download new models with progress bar + cancel
- Delete button per model
- Model size and description

### Settings Tab

- UI Language dropdown (EN, BG, MK, SR)
- Whisper CLI path + browse button
- DeepL API key input
- DeepL Usage card (live API quota query)
- Save Settings button
- Re-run Setup Wizard button

### Global Features

- **Dark/Light Theme Toggle** — Real-time switching with titlebar overlay update
- **Right-Click Context Menu** — Undo/Redo/Cut/Copy/Paste/Select All
- **Status Messages** — Dismissible notifications with X button
- **Localization** — Full UI translation in 4 languages (70+ strings each)
- **Voice Activity Detection (VAD)** — Silero VAD v5.1.2, auto-downloads on first transcription
- **Cross-Platform Build** — Windows (NSIS + portable), macOS (DMG, Intel + ARM), Linux (AppImage + .deb)

---

## Critical Bug Fixes (History)

### ✅ Negative Timestamp / Hallucination Bug (FIXED via VAD)

**Problem:**

- Large V3 model produces hallucinated text (wrong language) and negative/backwards timestamps on long audio (13–27+ minutes)
- Pattern: normal transcription → suddenly hallucination in wrong language → negative timestamps → countdown to zero → restart
- Root cause: Hallucination loop in Large V3 decoder when encountering difficult patches (pause, noise, low signal)

**Solution:**

- Implemented **VAD (Voice Activity Detection)** — Silero v5.1.2
- VAD pre-processes audio, strips silence/noise, feeds only voice segments to Whisper
- Combined with `--max-context 0` flag
- Result: Zero hallucinations, zero negative timestamps on 54-minute sermon (684 clean subtitles)

**Why VAD Works:**

- Canonical fix used by faster-whisper, WhisperX, whisper.cpp, and OpenAI community
- VAD removes exactly the non-speech moments that trigger Large V3 hallucination loops
- More robust than post-processing timestamp formulas

### ✅ Windows 11 Blank Screen on Electron Startup (FIXED)

**Problem:**

- Application window appeared blank on Windows 11 when loading external JS files in renderer

**Solution:**

- Custom build script (`build-sources.js`) concatenates all source files
- Produces single `dist/index.html` with all JS inlined
- Zero external file references = no blank screen

### ✅ FFmpeg ENOENT in Packaged App (FIXED)

**Problem:**

- `require("ffmpeg-static")` returns path inside `app.asar` which can't be spawned

**Solution:**

- Check `process.resourcesPath` first
- Construct unpacked path: `app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg.exe`
- Configured in `package.json` build → `asarUnpack`

### ✅ Whisper Binary Naming (FIXED)

**Problem:**

- v1.8.4 has both `main.exe` and `whisper-cli.exe`, unclear which to use

**Solution:**

- `findWhisperCliRecursive()` scans all files, returns highest priority:
  - `whisper-cli.exe` > `whisper-cli` > `main.exe` > `whisper.exe`

### ✅ Light Mode Titlebar (FIXED)

**Problem:**

- Titlebar overlay colors didn't update with theme switch

**Solution:**

- IPC handler `set-titlebar-theme` updates `titleBarOverlay` dynamically

### ✅ Timer Format for Long Transcriptions (FIXED)

**Problem:**

- Timer showed "154:29" instead of "2:34:29" for transcriptions over 1 hour

**Solution:**

- Updated `formatTime()` to support h:mm:ss format

---

## IPC Methods (Main ↔ Renderer Communication)

```
Settings & Config:
  - get-settings → { language, theme, model, apiKey, vadEnabled, modelDir }
  - save-settings → { status, message }
  - setup-wizard-status → { step, message, isComplete }

Whisper.cpp & Models:
  - get-models → [ { name, size, lang, path }, ... ]
  - download-model → streaming updates + completion
  - select-model → { status, message }
  - detect-whisper-cli → { path, version }

Transcription:
  - transcribe → streaming updates: { status, progress, segments }
  - cancel-transcribe → { status }

Translation:
  - translate → streaming updates: { status, progress, result }

Audio:
  - get-audio-duration → { duration }

File Operations:
  - open-file-dialog → { filePath }
  - save-file-dialog → { filePath }
  - open-folder → { status }
  - read-file → { content }

VAD & Download:
  - download-vad → streaming updates
  - download-file → streaming updates

Theming:
  - set-titlebar-theme → { status }
```

---

## i18n System

- `data-i18n` attributes on elements for automatic translation
- `data-i18n-placeholder` for input placeholders
- `t(key)` function with English fallback
- Languages: English, Български, Македонски, Српски

**String storage:** `src/renderer/i18n/i18n.js` with 70+ keys per language

---

## Performance Notes

- **Large V3 (3.1GB)** on CPU (i7, 4 cores/8 threads): ~4× slower than realtime
  - 54-minute audio = ~217 minutes processing time with VAD
- **Medium.en (1.5GB)** on CPU: ~3× faster than Large V3 for English content
- **VAD overhead:** ~5% initial overhead, but can speed up total by skipping silence
- **Recommendation:** Use Medium.en for English, Large V3 only for non-English or maximum accuracy

### Future Speed Improvements (Not Yet Implemented)

1. **Large V3 Turbo** — 6× faster than Large V3, only 1–2% accuracy loss
2. **GPU acceleration (Vulkan)** — whisper.cpp v1.8.3+ supports iGPU, provides 5–12× speedup
3. **Model quantization** — Q5_0 quantized models ~40% smaller and faster

---

## Known Issues & Workarounds

### VAD Pre-Processing Adds Time

- VAD adds ~5% overhead for speech detection pass
- Trade-off: eliminates hallucinations (worth it)
- Mitigation: Run overnight or in background

### Model Download Size

- Large models (3GB+) require significant disk space
- Consider using Medium.en for English content
- Future: Offer quantized models for reduced size

### FFmpeg Dependency

- User system must have FFmpeg in PATH or bundled version
- Handled via `ffmpeg-static` npm package (bundled in packaged app via `asarUnpack`)

---

## Build & Deployment

### Development

```bash
npm install
npm start
```

Automatically runs `build-sources.js` via prestart script.

### Production Builds

```bash
npm run build:win           # Windows NSIS installer
npm run build:win-portable  # Windows portable .exe
npm run build:mac           # macOS DMG (Intel + ARM)
npm run build:linux         # Linux AppImage + .deb
npm run build:all           # All platforms
```

Uses electron-builder configuration from `package.json`. Output goes to `installer/` folder.

---

## Configuration Files

### settings.json

Located in user app data directory.

```json
{
  "language": "en",
  "theme": "dark",
  "model": "base",
  "apiKey": "",
  "vadEnabled": true,
  "modelDir": "~/.wavescript/models"
}
```

### Environment Variables (Optional)

- `WAVESCRIPT_MODELS_DIR` — Override model directory
- `WAVESCRIPT_VAD_ENABLED` — Force VAD on/off
- `WHISPER_CPP_PATH` — Explicit path to whisper-cli

---

## Dependencies

### Runtime (from package.json)

- `deepl-node` (^1.14.0) — DeepL API client
- `ffmpeg-static` (^5.2.0) — Audio processing (bundled, unpacked from asar)

### Dev Dependencies

- `electron` (^33.0.0) — Desktop application framework
- `electron-builder` (^25.0.0) — Build & packaging

### External Binaries (User Downloads)

- `whisper-cli` — whisper.cpp command-line tool (v1.8.4+)

### Auto-Downloaded Models

- Silero VAD v5.1.2 — Auto-downloaded on first transcription
- whisper.cpp models — User-downloaded via setup wizard or Models tab

---

## Development Notes

### Code Organization

- **Minimal architecture** — No over-engineering, single-responsibility modules
- **Vanilla JavaScript** — No transpilation, no TypeScript (yet)
- **CSS Variables** — Dark/light themes via custom properties
- **IPC Pattern** — Consistent error handling, streaming for long operations

### Testing Checklist

- [ ] Main process starts without errors
- [ ] Renderer UI displays correctly
- [ ] All tabs navigate smoothly
- [ ] Theme toggle works instantly
- [ ] Language switch updates all text
- [ ] Settings persist across restart
- [ ] Transcription with VAD produces clean output
- [ ] Translation with DeepL works correctly
- [ ] All file dialogs open/close properly
- [ ] Setup wizard completes successfully
- [ ] No orphaned processes after completion/cancellation
- [ ] Build script generates valid dist/ folder
- [ ] Windows/macOS/Linux builds complete successfully

### Debugging

- Enable DevTools: Add `mainWindow.webContents.openDevTools()` in `window.js`
- Console logs from main process: Check stdout/stderr
- IPC communication: Log in `ipcMain.handle()` and renderer's await calls
- Performance: Monitor CPU during transcription with VAD vs without

---

## Future Enhancements (Not Yet Implemented)

- [ ] GPU-accelerated Whisper binary (Vulkan) download option
- [ ] Large V3 Turbo model (6× faster, minimal accuracy loss)
- [ ] Quantized models (Q5_0) for reduced disk space
- [ ] Batch queue UI (drag-and-drop queue management)
- [ ] Advanced subtitle editor (in-app refinement)
- [ ] Keyboard shortcuts system
- [ ] Auto-update mechanism
- [ ] TypeScript migration (post-stability)
- [ ] GitHub Actions CI/CD for multi-platform builds

---

## Architecture Evolution

**Original Version (Monolithic):**

- Single `main.js` (~596 lines)
- All JS inline in `index.html` (~816 lines)
- Simple IPC but hard to maintain

**Current Version (Refactored):**

- Modular `src/main/` (11 files, clean separation)
- Modular `src/renderer/` (organized by feature)
- Build system that maintains single-file output while keeping source organized
- Same features, dramatically better code organization

---

## References

- Whisper.cpp: https://github.com/ggml-org/whisper.cpp
- DeepL API: https://www.deepl.com/docs-en/
- Electron: https://www.electronjs.org/
- Silero VAD: https://github.com/snakers4/silero-vad
- Original inspiration (TT-Tool): https://github.com/milkotodorov/tt-tool

---

**Version:** 1.1.0 (Refactored, Stable)
**Last Updated:** June 2026
**Development Status:** Core features complete and tested across Windows, macOS, Linux
