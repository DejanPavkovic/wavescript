# WaveScript – Development Guide

Reference this when working on WaveScript development tasks.

## Quick Reference

### Development Environment

**Primary Setup:**
- **OS:** Windows 11 (or macOS/Linux)
- **IDE:** IntelliJ IDEA / WebStorm
- **Node.js:** Latest LTS (v18+)
- **Editor Config:** JavaScript, vanilla (no TypeScript yet)

**Start Development:**
```bash
cd wavescript
npm install
npm start
```

The `prestart` script automatically runs `build-sources.js`.

---

## Codebase Overview

### Main Process (`src/main/`)

**Each file handles a specific responsibility:**

| File | Purpose |
|------|---------|
| `constants.js` | App paths, model dirs, VAD config, defaults |
| `settings.js` | Load/save settings JSON, user config |
| `window.js` | Electron BrowserWindow, lifecycle |
| `whisper-finder.js` | Detect whisper-cli in system PATH |
| `ipc-setup.js` | IPC: settings, wizard, models, status |
| `ipc-utility.js` | IPC: file dialogs, folder open, file read |
| `downloader.js` | Download files (models, VAD) with progress |
| `audio.js` | FFmpeg wrapper: detect, convert, duration |
| `vad.js` | Silero VAD: download model, manage config |
| `transcribe.js` | Spawn whisper-cli, parse output, stream to UI |
| `translate.js` | Call DeepL API, handle translation response |

**IPC Pattern:** Each handler uses `ipcMain.handle()` and responds with `{ status, message, progress?, result? }`

**Error Pattern:** Errors are returned as `{ status: 'error', message: 'Human-readable error' }` — never thrown

### Renderer Process (`src/renderer/`)

**Structure:**
- `index.template.html` – Single HTML file (JS inlined on build)
- `i18n/i18n.js` – Translation system and strings
- `ui/*.js` – One file per feature/tab
- `styles/styles.css` – All CSS (light + dark themes via variables)

**UI File Responsibilities:**

| File | Manages |
|------|----------|
| `init.js` | Bootstrap, load initial settings, set up listeners |
| `theme.js` | Dark/light toggle, persist to settings |
| `app.js` | Tab navigation, model selection UI |
| `wizard.js` | 4-step setup wizard flow |
| `transcribe.js` | Transcribe tab: file pick, transcribe IPC, display results |
| `translate.js` | Translate tab: file pick, translate IPC, display results |
| `models.js` | Models tab: list, download, select |
| `settings.js` | Settings tab: form, save to main process |
| `helpers.js` | Status message helpers, formatting functions |

**IPC Pattern:** `window.electronAPI.someHandler()` — calls main process, returns Promise

---

## Common Development Tasks

### Adding a New Setting

1. **Add to settings schema** → `src/main/settings.js` (default value)
2. **Add HTML input** → `src/renderer/index.template.html` (form element)
3. **Add UI handler** → `src/renderer/ui/settings.js` (save on change)
4. **Add IPC handler** → `src/main/ipc-setup.js` (handle save/load)

**Example: Adding `"maxConcurrent"` setting**

```javascript
// src/main/settings.js
const DEFAULT_SETTINGS = {
  language: 'en',
  theme: 'dark',
  maxConcurrent: 1,  // NEW
  // ...
};
```

```html
<!-- src/renderer/index.template.html -->
<label>Max Concurrent Transcriptions:
  <input type="number" id="maxConcurrentInput" min="1" max="4" value="1">
</label>
```

```javascript
// src/renderer/ui/settings.js
document.getElementById('maxConcurrentInput').addEventListener('change', async (e) => {
  settings.maxConcurrent = parseInt(e.target.value);
  await window.electronAPI.saveSettings(settings);
});
```

```javascript
// src/main/ipc-setup.js
ipcMain.handle('save-settings', async (event, newSettings) => {
  // Validate
  if (newSettings.maxConcurrent < 1 || newSettings.maxConcurrent > 4) {
    return { status: 'error', message: 'Max concurrent must be 1-4' };
  }
  // Save
  settings.save(newSettings);
  return { status: 'ok' };
});
```

---

### Adding a New Language

1. **Add strings to i18n** → `src/renderer/i18n/i18n.js`
2. **Add language option** → `src/renderer/index.template.html` (language select)
3. **Test all tabs** → Verify all text updates

**Example: Adding French (fr)**

```javascript
// src/renderer/i18n/i18n.js
const strings = {
  en: { /* ... */ },
  bg: { /* ... */ },
  mk: { /* ... */ },
  sr: { /* ... */ },
  fr: {
    'title': 'WaveScript',
    'transcribe': 'Transcrire',
    'translate': 'Traduire',
    // ... all keys
  }
};
```

```html
<!-- src/renderer/index.template.html -->
<select id="languageSelect">
  <option value="en">English</option>
  <option value="bg">Български</option>
  <option value="mk">Македонски</option>
  <option value="sr">Српски</option>
  <option value="fr">Français</option>
</select>
```

---

### Adding a New Output Format

1. **Define format logic** → `src/main/transcribe.js` (output generation)
2. **Add option to UI** → `src/renderer/index.template.html` (format select)
3. **Test output file** → Verify format is valid

**Example: Adding WEBVTT format**

```javascript
// src/main/transcribe.js
function generateWebVTT(segments) {
  let output = 'WEBVTT\n\n';
  segments.forEach(seg => {
    output += `${formatTimestamp(seg.start)} --> ${formatTimestamp(seg.end)}\n`;
    output += `${seg.text}\n\n`;
  });
  return output;
}

// In transcribe handler:
const format = args.format; // 'srt', 'vtt', 'txt', 'webvtt', etc.
let output;
switch (format) {
  case 'srt': output = generateSRT(segments); break;
  case 'vtt': output = generateVTT(segments); break;
  case 'webvtt': output = generateWebVTT(segments); break;
  // ...
}
```

---

### Debugging IPC Communication

**From Renderer (Browser DevTools):**
```javascript
// In console, test IPC call
window.electronAPI.getSettings().then(s => console.log('Settings:', s));
```

**From Main (Electron DevTools):**
```javascript
// In transcribe.js or any handler
console.log('Transcribe called with:', args);
```

**Enable DevTools in Development:**
```javascript
// src/main/window.js
mainWindow.webContents.openDevTools();
```

---

### Adding a New IPC Handler

**Pattern:**

```javascript
// src/main/ipc-setup.js (or relevant file)
ipcMain.handle('my-handler', async (event, args) => {
  try {
    // Validate
    if (!args.something) {
      return { status: 'error', message: 'Missing required field' };
    }
    
    // Do work
    const result = await doSomething(args);
    
    // Return success
    return { status: 'ok', result };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
});
```

```javascript
// src/renderer/ui/some-tab.js (or appropriate file)
const response = await window.electronAPI.myHandler({ something: 'value' });
if (response.status === 'error') {
  displayError(response.message);
} else {
  useResult(response.result);
}
```

---

## CSS Theming System

**Dark/Light theme via CSS variables**

```css
/* src/renderer/styles/styles.css */

:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --color-text: #000000;
  --color-accent: #2563eb;
  /* Light theme */
}

[data-theme="dark"] {
  --bg-primary: #1e1e1e;
  --bg-secondary: #2d2d2d;
  --color-text: #ffffff;
  --color-accent: #60a5fa;
  /* Dark theme */
}

body {
  background-color: var(--bg-primary);
  color: var(--color-text);
}

button {
  background-color: var(--color-accent);
}
```

**Add new color:**
1. Define in `:root` (light theme)
2. Define in `[data-theme="dark"]` (dark theme)
3. Use `var(--color-name)` in CSS

---

## File I/O Patterns

### Reading Settings

```javascript
// In main process
const settings = loadSettingsFromFile('~/.wavescript/settings.json');
```

### Writing Settings

```javascript
// In main process
saveSettingsToFile('~/.wavescript/settings.json', settings);
```

### Reading Audio File

```javascript
// In main process
const buffer = fs.readFileSync('/path/to/audio.mp3');
```

### Writing Output

```javascript
// In main process
fs.writeFileSync('/path/to/output.srt', content, 'utf-8');
```

---

## Process Management

### Spawning whisper-cli

```javascript
// src/main/transcribe.js
const child = spawn('whisper-cli', [
  audioPath,
  '--model', modelName,
  '--output_format', format,
  '--language', language,
  '--output_dir', outputDir
]);

// Listen for output
child.stdout.on('data', (data) => {
  // Parse and send to renderer via IPC
});

// Handle completion
child.on('close', (code) => {
  if (code === 0) {
    // Success
  } else {
    // Error
  }
});
```

### Process Cleanup

```javascript
// Always clean up on error or cancellation
child.kill('SIGTERM');
```

---

## Testing Checklist

Before committing changes:

- [ ] **Main Process** – No console errors, proper IPC responses
- [ ] **Renderer** – UI updates correctly, no blank screen
- [ ] **Theme** – Dark/light toggle works, colors correct
- [ ] **Language** – All text updates on language switch
- [ ] **Settings** – Changes persist across app restart
- [ ] **File Operations** – Dialogs open/close smoothly
- [ ] **Error Handling** – Errors display user-friendly messages

---

## Build & Packaging

### Development Build

```bash
npm start  # Runs prestart script (build-sources.js) automatically
```

**What happens:**
1. `build-sources.js` runs
2. Concatenates `src/main/*.js` → `dist/main.js`
3. Inlines `src/renderer/` into `dist/index.html`
4. Copies `preload.js`, `styles.css`, assets to `dist/`
5. Electron loads `dist/`

### Production Build

```bash
npm run build:win           # Windows
npm run build:mac           # macOS
npm run build:linux         # Linux
npm run build:all           # All platforms
```

Uses electron-builder config in `package.json`.

---

## Performance Tips

1. **Avoid blocking the main process** – Use async/await for long operations
2. **Stream large files** – Don't load entire audio into memory
3. **Debounce UI updates** – Especially during progress events
4. **Cache settings** – Don't reload from disk on every access
5. **Lazy-load models** – Download on demand, not on startup

---

## Common Issues & Solutions

### "whisper-cli not found"
- Ensure whisper.cpp is installed or downloaded via wizard
- Check `whisper-finder.js` detects PATH correctly
- Set `WHISPER_CPP_PATH` environment variable if needed

### Blank screen on startup (Windows 11)
- This is the bug solved by `build-sources.js`
- If it reappears, ensure all external JS files are inlined
- Check that `dist/index.html` contains all renderer code

### Settings not persisting
- Check that `saveSettings()` is called in main process
- Verify settings file path is writable
- Check that `ipcMain.handle('save-settings', ...)` is registered

### Transcription hangs
- Ensure whisper-cli process has proper stdio/stderr setup
- Check that output is being parsed correctly
- Verify audio file is readable and not corrupted

### DeepL translation fails
- Check that API key is valid (test in browser)
- Verify API quota not exceeded
- Check network connectivity

---

## Code Style

- **Naming:** camelCase for variables/functions, kebab-case for file names
- **Spacing:** 2-space indentation
- **Comments:** Use for "why", not "what" (code should be readable)
- **Error Messages:** User-friendly, actionable, not technical
- **IPC Responses:** Always include `{ status, message }` at minimum
- **Async:** Use async/await, avoid callback hell

---

## Future Improvements (Not Yet Done)

- TypeScript migration (post-Vulkan GPU support)
- Vulkan GPU acceleration for transcription
- Batch queue UI (drag-and-drop queue management)
- Advanced subtitle editor (in-app refinement)
- Keyboard shortcuts
- Auto-update mechanism

---

*Last Updated: June 2026*
