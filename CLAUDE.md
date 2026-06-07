# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start Commands

```bash
# Install dependencies
npm install

# Start dev mode with auto-rebuild and hot reload
npm run dev           # macOS/Linux
npm run dev:win       # Windows

# Build production installers
npm run build:win           # Windows NSIS installer
npm run build:win-portable  # Windows portable executable
npm run build:mac           # macOS DMG (Intel + ARM)
npm run build:linux         # Linux AppImage + .deb
npm run build:all           # All platforms

# Manual build step (normally automatic via prestart)
npm run build:src
```

The `npm start` command automatically runs `build:src` via the `prestart` script before launching Electron.

## Project Overview

**WaveScript** is a desktop application (Electron + vanilla JavaScript) that:
- **Transcribes** audio/video files locally using Whisper.cpp (21 languages, 7 output formats)
- **Translates** subtitle files using DeepL API (20 target languages)

Key features: Voice Activity Detection (VAD) to prevent hallucinations on long audio, dark/light themes, 4 UI languages (EN/BG/MK/SR), cross-platform support.

## Architecture

### The Build System Problem & Solution

**Problem:** Electron on Windows 11 has a blank-screen bug when loading external JavaScript files in the renderer. The app freezes on startup if `index.html` loads JS from separate files.

**Solution:** `build-sources.js` concatenates all source files into production files:
1. **Main process:** All `src/main/*.js` files → single `dist/main.js`
2. **Renderer:** `src/renderer/index.template.html` + all renderer JS → single `dist/index.html` with inline JavaScript
3. Static assets (CSS, icons, preload.js) copied to `dist/`

**Developer workflow:** Edit source files in `src/`, the build step handles concatenation automatically. The `dist/` folder is auto-generated and gitignored. In dev mode (`npm run dev:win`), the build watches for file changes and rebuilds on save.

### Main Process (`src/main/`)

The main process uses **IPC-first architecture**: all communication between main and renderer goes through Electron IPC. The renderer never accesses the filesystem directly.

**File organization by responsibility:**
- **constants.js** — App data paths, VAD model config, model URLs
- **settings.js** — Load/save user settings to JSON file
- **window.js** — BrowserWindow creation, titlebar overlay, keyboard shortcuts (F12, Ctrl+R)
- **ipc-setup.js** — IPC handlers for file dialogs, setup wizard, model management, status queries
- **ipc-utility.js** — IPC handlers for opening folders, reading files, DeepL usage check
- **transcribe.js** — IPC: transcription with whisper.cpp, FFmpeg auto-conversion
- **translate.js** — IPC: translation with DeepL API
- **downloader.js** — Generic file download with progress tracking
- **audio.js** — FFmpeg wrapper: detect FFmpeg, convert audio to WAV, get duration
- **vad.js** — Download & manage Silero VAD model for pre-segmentation
- **whisper-finder.js** — Detect whisper-cli binary location in PATH or bundled

**IPC Handler Pattern:**
All IPC handlers return data or throw errors. Errors are caught by the renderer and displayed as status messages.

### Renderer (`src/renderer/`)

**Single-page application with tab-based navigation.** All UI modules are concatenated into `dist/index.html`.

**File organization by UI feature:**
- **ui/init.js** — Bootstrap: load settings, status, models; define `$`, `$$`, global state
- **ui/theme.js** — Dark/light mode toggle, CSS variable switching
- **ui/app.js** — Tab navigation, sidebar buttons, model auto-selection logic
- **ui/startup.js** — MUST BE LAST: runs after all modules load; shows wizard or main app
- **ui/wizard.js** — 4-step setup wizard (language, Whisper download, model selection, DeepL key)
- **ui/transcribe.js** — Transcribe tab: file queue, options, progress, result display
- **ui/translate.js** — Translate tab: file queue, language/format selection, progress, result display
- **ui/models.js** — Models tab: installed models, available models, download/delete
- **ui/settings.js** — Settings tab: paths, API key, theme, language, wizard re-run
- **i18n/i18n.js** — Translation strings (EN, BG, MK, SR) + `t()` function + `applyI18n()`
- **ui/helpers.js** — Status message helpers (`showMsg`, `hideMsg`), result search bar

**Build Order Dependency:** Files in the build list are concatenated in order. Files that call functions defined in later files must defer execution to event handlers. Only `startup.js` (the last file) runs top-level code.

### Key IPC Channels

**File Operations:**
- `load-settings` / `save-settings` — User config (language, API key, paths)
- `select-file` / `select-files` / `select-directory` — File dialogs
- `scan-folder` — Find audio files in directory
- `open-folder` — Open folder in Explorer/Finder
- `read-file` — Read file contents
- `get-audio-duration` — FFmpeg duration query

**Transcription:**
- `transcribe` → spawns whisper-cli process, auto-converts to WAV if needed
- `cancel-transcribe` — Kill whisper process
- `transcribe-progress` — Whisper stdout/stderr streamed to renderer (progress bar updates)

**Translation:**
- `translate` → DeepL API call, parses SRT/VTT/TXT, writes output file
- `translate-progress` — Progress event with `{ done, total, percent }`

**Model Management:**
- `download-model` → Download from HuggingFace, extract, store in models dir
- `cancel-download` — Kill download
- `download-progress` → Progress event with `{ percent, text }`
- `delete-model` — Delete model file
- `get-available-models` — Return array of models with URLs, sizes, tiers

**Setup:**
- `get-setup-status` — Return `{ whisperReady, modelReady, deeplReady, downloadedModels }`
- `download-whisper` → Download whisper.cpp release, extract, find binary

## Critical Implementation Details

### Voice Activity Detection (VAD)

Large V3 model hallucinates on long audio (>20 min), producing negative timestamps and stuck times. VAD solves this by pre-segmenting audio into speech-only regions before Whisper sees it.

**Implementation:**
- Download Silero v5.1.2 model (~30 MB) on first use from HuggingFace
- Store in `userDataPath/vad/`
- Pass `--vad --vad-model <path>` to whisper.cpp when available
- Graceful fallback if download fails

See `src/main/vad.js` and `src/main/transcribe.js`.

### Whisper.cpp Integration

**No Parallel Processing:** Whisper is spawned with `--processors 1` always. Parallel chunks cause timestamp resets with the CPU binary. Use `--threads` for CPU control instead.

**Output Formats:** 7 supported: SRT, VTT, TXT, LRC, CSV, JSON, WTS (word timestamps)

**FFmpeg Auto-Conversion:** Non-WAV files are auto-converted to WAV before transcription. FFmpeg is bundled via `ffmpeg-static` npm package.

**In Packaged App:** FFmpeg binary is unpacked from `app.asar.unpacked` at runtime. See `src/main/audio.js`.

### Whisper.cpp Download & Setup Wizard

**Wizard Steps:**
1. Language selection
2. Download whisper.cpp binary (or browse to manual install)
3. Select/download a model
4. Set DeepL API key (optional)

**Binary Discovery:**
- First, check user settings
- Then, search PATH with `where whisper-cli` (Windows) or `which whisper-cpp`
- If found, store path in settings for next launch

See `src/main/whisper-finder.js` and `src/renderer/ui/wizard.js`.

### Settings Persistence

Settings are stored in JSON at `userDataPath/wavescript-settings.json`:
```json
{
  "language": "en",
  "theme": "dark",
  "whisperPath": "/path/to/whisper-cli",
  "modelPath": "/path/to/ggml-model.bin",
  "deeplApiKey": "xxx",
  "vadEnabled": true
}
```

Settings are loaded on app startup and when the Settings tab is accessed.

### Theming

**Dark/Light Mode:**
- CSS variables defined in `src/renderer/styles/styles.css` with `[data-theme="dark"]` and `[data-theme="light"]` selectors
- Theme state stored in settings
- Renderer applies theme on startup via `applyTheme()`
- Titlebar overlay color updates dynamically via IPC `set-titlebar-theme`

**i18n:**
- Strings in `src/renderer/i18n/i18n.js` organized by language: `i18n.en`, `i18n.bg`, `i18n.mk`, `i18n.sr`
- `t(key)` function looks up key in current language object
- HTML elements with `data-i18n="key"` attributes auto-translated on page load via `applyI18n()`
- Language change updates entire UI via `applyI18n()`

### Result Search & Navigation

Transcription and translation results have a built-in search bar (activated by search button).

**Features:**
- Regex-based highlighting of matches
- Navigation between matches (up/down buttons, Enter key)
- Escape key or close button to dismiss

See `src/renderer/ui/helpers.js` (setupResultSearch function).

## Common Development Tasks

### Adding a New Transcription Option

1. Add the option to the HTML in `src/renderer/index.template.html` (find `tr-options` section)
2. Add i18n string to `src/renderer/i18n/i18n.js` for all 4 languages
3. Add event listener in `src/renderer/ui/transcribe.js` to read the option value
4. Pass the option value to the `transcribe` IPC handler
5. Update `src/main/transcribe.js` to use the option when building whisper.cpp arguments

### Adding a New UI Language

1. Add language strings to `src/renderer/i18n/i18n.js` (copy English, translate all keys)
2. Add `<option>` to language select in HTML template
3. Test with `npm run dev:win` and switch language via wizard or Settings

### Debugging Transcription Issues

1. Enable F12 DevTools (`npm run dev:win`, then press F12 in app)
2. Check main process logs via `mainWindow.webContents.on("console-message", ...)`
3. Check renderer console for IPC errors
4. Whisper output is streamed to `transcribe-progress` channel—log it in renderer console

### Testing Model Download Flow

1. Delete any downloaded model from `~/AppData/Roaming/WaveScript/whisper-models/`
2. Go to Models tab, select a model, click Download
3. Watch progress bar and check `transcribe-progress` events in DevTools

## File Paths & Environment

**User Data Directory:**
- Windows: `C:\Users\<user>\AppData\Roaming\WaveScript\`
- macOS: `~/Library/Application Support/WaveScript/`
- Linux: `~/.config/WaveScript/`

**Subdirectories:**
- `whisper-models/` — Downloaded Whisper models
- `whisper-bin/` — Extracted whisper.cpp binary
- `vad/` — Silero VAD model
- `wavescript-settings.json` — User settings

**In Development:**
- `dist/` — Auto-generated, ignored by git
- `node_modules/` — Ignored by git
- `installer/` — Build output (ignored by git)

## External Dependencies

**Runtime:**
- `electron` (v33) — Desktop app framework
- `ffmpeg-static` (v5.2) — Bundled FFmpeg binary
- `deepl-node` (v1.14) — DeepL translation API

**Dev:**
- `electron-builder` (v25) — Create installers for all platforms

**External Binaries (Not npm packages):**
- `whisper.cpp` — Downloaded from GitHub releases, user chooses version
- `Silero VAD` — Downloaded from HuggingFace on first use

No build tools (webpack, babel, TypeScript) needed—vanilla JavaScript concatenation via build-sources.js.

## Notes for Future Development

1. **Always test on Windows 11** — The blank-screen bug is Windows-specific; Linux/macOS don't have this issue but should still be tested for regressions.
2. **IPC Error Handling** — Always assume IPC calls can fail; return error status from main process and handle in renderer.
3. **Build Order Matters** — If you add new renderer modules, place them in the correct order in `build-sources.js`. Modules can only call functions defined in earlier modules at the top level.
4. **Backward Compatibility** — Settings are loaded from a user's previous version. Check for missing keys when reading settings.
5. **Cross-Platform Paths** — Always use `path.join()` for filesystem operations, never hardcode `/` or `\`.
