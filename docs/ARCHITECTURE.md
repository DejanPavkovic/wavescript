# WaveScript – Architecture Deep Dive

Reference this for understanding system design decisions and technical details.

## System Architecture

```
┌─────────────────────────────────────────┐
│      Electron Main Process              │
│  (Node.js, system access, IPC hub)      │
├─────────────────────────────────────────┤
│                                         │
│ IPC Handlers:                           │
│ ├─ Settings (get/save)                  │
│ ├─ Transcription (spawn whisper-cli)    │
│ ├─ Translation (call DeepL API)         │
│ ├─ Models (download/list/select)        │
│ ├─ Audio (FFmpeg wrapper)               │
│ ├─ VAD (Silero model management)        │
│ ├─ File dialogs (open/save)             │
│ └─ Download (progress tracking)         │
│                                         │
└─────────────────────────────────────────┘
            ↕ IPC Messages
┌─────────────────────────────────────────┐
│    Electron Renderer (Browser)          │
│  (HTML/CSS/JS UI, user interaction)     │
├─────────────────────────────────────────┤
│                                         │
│ UI Modules:                             │
│ ├─ Transcribe Tab (audio → text)        │
│ ├─ Translate Tab (subs → subs)          │
│ ├─ Models Tab (manage models)           │
│ ├─ Settings Tab (user config)           │
│ ├─ Setup Wizard (first-run init)        │
│ ├─ Theme System (dark/light)            │
│ └─ i18n System (4 languages)            │
│                                         │
└─────────────────────────────────────────┘
```

---

## Main Process Design

### Constants (`constants.js`)

Centralized configuration:

```javascript
const APP_CONFIG = {
  appName: 'WaveScript',
  appVersion: '1.0.0',
  
  // Paths
  appDataDir: path.join(os.homedir(), '.wavescript'),
  settingsFile: path.join(appDataDir, 'settings.json'),
  modelsDir: path.join(appDataDir, 'models'),
  vadModelPath: path.join(appDataDir, 'vad_model'),
  
  // VAD Configuration
  vad: {
    modelUrl: 'https://...',
    confidence: 0.5,
    enabled: true
  },
  
  // Whisper.cpp
  whisper: {
    defaultModel: 'base',
    supportedFormats: ['srt', 'vtt', 'txt', 'lrc', 'csv', 'json', 'wts'],
    languages: [/* 21 languages */]
  },
  
  // DeepL
  deepl: {
    apiUrl: 'https://api.deepl.com/v2/translate',
    targetLanguages: [/* 20 languages */]
  }
};
```

**Why centralized?**
- Single source of truth for config
- Easy to adjust paths, URLs, defaults
- Constants don't require IPC (main process only)

---

### Settings System (`settings.js`)

**File Location:** `~/.wavescript/settings.json` (platform-independent via `os.homedir()`)

**Structure:**
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

**Load on App Start:**
```javascript
const settings = loadSettings();  // Returns default + user overrides
```

**Save on User Change:**
```javascript
saveSettings(newSettings);  // Write to JSON file
```

**Why JSON?** Simple, human-readable, no database dependency, easy to backup/restore

---

### IPC Architecture

**Pattern: Request → Handle → Respond**

```javascript
// Main process (ipc-setup.js, ipc-utility.js, etc.)
ipcMain.handle('my-action', async (event, args) => {
  try {
    const result = await doWork(args);
    return { status: 'ok', result };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
});

// Renderer process (ui/*.js)
const response = await window.electronAPI.myAction(args);
if (response.status === 'error') {
  showError(response.message);
} else {
  useResult(response.result);
}
```

**Why this pattern?**
- Consistent error handling (errors don't throw, return status)
- Responses always structured
- Easy to add logging/debugging
- Renderer never crashes main process

---

### Transcription Pipeline (`transcribe.js`)

**Flow:**

```
1. Renderer sends: { audioPath, format, language, model }
   ↓
2. Main validates: file exists, format supported, model available
   ↓
3. VAD check: if enabled, detect voice segments (optional pre-filter)
   ↓
4. Spawn whisper-cli: spawn('whisper-cli', [args...])
   ↓
5. Stream output: whisper-cli writes to stdout
   ↓
6. Parse output: extract segments with timestamps
   ↓
7. Format output: convert to SRT/VTT/TXT/etc.
   ↓
8. Write file: save to user-selected path
   ↓
9. Report completion: send final result to renderer
```

**Why stream instead of batch?**
- Large audio files (2+ hours) would hang if we waited for completion
- Real-time progress updates to UI
- User sees live preview during transcription

**Output Handling:**

```javascript
child.stdout.on('data', (chunk) => {
  // Parse partial output
  const segments = parseOutput(chunk);
  
  // Send to renderer in real-time
  mainWindow.webContents.send('transcribe-update', {
    status: 'processing',
    progress: calculateProgress(processedTime, totalTime),
    segments: segments
  });
});
```

---

### Translation Pipeline (`translate.js`)

**Flow:**

```
1. Renderer sends: { subtitlePath, targetLanguage, apiKey }
   ↓
2. Main reads subtitle file (SRT, VTT, or plain text)
   ↓
3. Extract text segments (preserve timestamps if SRT/VTT)
   ↓
4. Batch to DeepL: send all texts in single API call
   ↓
5. DeepL responds: translated texts in same order
   ↓
6. Reconstruct: rebuild SRT/VTT with original timestamps + translated text
   ↓
7. Write file: save to user-selected path
   ↓
8. Report completion: send result to renderer
```

**Why batch API calls?**
- Single API call = lower cost (one request, not N requests)
- Faster (parallel processing by DeepL)
- Batching handled automatically by DeepL SDK

---

### Audio Processing (`audio.js`)

**FFmpeg Integration:**

```javascript
// Detect FFmpeg availability
const ffmpegPath = findFFmpeg();

// Get audio duration
const duration = getAudioDuration(audioPath);  // Returns seconds

// Convert to WAV (16-bit PCM)
convertToWav(inputPath, outputPath);  // Uses FFmpeg
```

**Why WAV 16-bit PCM?**
- whisper.cpp expects this format
- Standard across audio processing tools
- Lossless conversion preserves quality for transcription

**Command executed:**
```bash
ffmpeg -i input.mp3 -acodec pcm_s16le -ar 16000 output.wav
```

---

### VAD Integration (`vad.js`)

**Silero VAD v5.1.2 Workflow:**

```
1. Download model (if not cached)
   ├─ Check ~/. wavescript/vad_model/
   └─ Download if missing (from Silero repo)

2. Load model into memory
   ├─ Model is ONNX format (cross-platform)
   └─ Lightweight (<100MB)

3. Pre-process audio
   ├─ Feed audio chunks to VAD
   └─ VAD outputs voice/silence classification

4. Detect voice segments
   ├─ Mark time ranges with voice activity
   └─ Return array: [{ start, end }, ...]

5. Filter whisper.cpp input
   ├─ Only process detected voice segments
   └─ Skip silence → eliminates hallucinations
```

**Why Silero VAD?**
- Pre-trained, no fine-tuning needed
- Lightweight (runs on CPU)
- No cloud dependency
- Dramatically reduces false positives

---

## Renderer Process Design

### HTML Template (`index.template.html`)

**Built as single file:**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    /* All CSS inlined here on build */
  </style>
</head>
<body>
  <!-- All HTML here -->
  
  <script>
    /* All renderer JS inlined here on build */
  </script>
</body>
</html>
```

**Why inline everything?**
- Solves Windows 11 blank-screen bug (no external file loading)
- Single file to distribute
- Faster startup (no disk I/O for CSS/JS)

---

### i18n System (`i18n/i18n.js`)

**String Storage:**

```javascript
const strings = {
  en: {
    'tab-transcribe': 'Transcribe',
    'button-start': 'Start Transcription',
    'status-transcribing': 'Transcribing...',
    'error-file-not-found': 'Audio file not found'
  },
  bg: {
    'tab-transcribe': 'Транскрипция',
    // ...
  },
  mk: { /* ... */ },
  sr: { /* ... */ }
};
```

**Translation Helper:**

```javascript
function t(key, defaultText = '') {
  const currentLang = getCurrentLanguage();
  return strings[currentLang][key] || defaultText;
}

// Usage in HTML/JS:
document.getElementById('tabTranscribe').textContent = t('tab-transcribe');
```

**Why this approach?**
- Simple, no external i18n library needed
- Easy to add/modify strings
- Fast lookup (object key access)
- Supports 4 languages with minimal overhead

---

### Theme System (`theme.js`)

**CSS Variables Approach:**

```css
/* Light theme (default) */
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --color-text: #000000;
  --color-accent: #2563eb;
}

/* Dark theme */
[data-theme="dark"] {
  --bg-primary: #1e1e1e;
  --bg-secondary: #2d2d2d;
  --color-text: #ffffff;
  --color-accent: #60a5fa;
}
```

**Theme Toggle:**

```javascript
function setTheme(themeName) {
  document.documentElement.setAttribute('data-theme', themeName);
  settings.theme = themeName;
  window.electronAPI.saveSettings(settings);
}
```

**Why CSS variables?**
- No JavaScript reprocessing needed
- Instant theme switch (just change CSS variables)
- Easy to maintain (change in one place, applies everywhere)
- Supported in all modern browsers

---

### Tab Navigation (`app.js`)

**Tab Switching Pattern:**

```javascript
const tabs = {
  transcribe: { element: '#tab-transcribe', content: '#content-transcribe' },
  translate: { element: '#tab-translate', content: '#content-translate' },
  models: { element: '#tab-models', content: '#content-models' },
  settings: { element: '#tab-settings', content: '#content-settings' }
};

function showTab(tabName) {
  // Hide all
  Object.values(tabs).forEach(tab => {
    tab.element.classList.remove('active');
    tab.content.style.display = 'none';
  });
  
  // Show selected
  tabs[tabName].element.classList.add('active');
  tabs[tabName].content.style.display = 'block';
}
```

**Why separate content divs?**
- Clean CSS (no complex selectors)
- Easy to add tabs without refactoring
- Tab state independent

---

### Setup Wizard (`wizard.js`)

**4-Step Flow:**

```
Step 1: Welcome
├─ Display intro
└─ Check whisper-cli availability

Step 2: whisper-cli Setup
├─ Auto-detect whisper-cli
├─ If not found, offer download
└─ Validate installation

Step 3: VAD Model Download
├─ Download Silero VAD v5.1.2
└─ Validate model integrity

Step 4: Completion
├─ Set default model
├─ Confirm ready to use
└─ Close wizard, enable app
```

**State Machine:**

```javascript
const wizard = {
  currentStep: 1,
  status: {},  // { step1: true, step2: false, ... }
  
  async nextStep() {
    if (!await validateCurrentStep()) return;
    this.currentStep++;
    renderStep(this.currentStep);
  }
};
```

---

## Data Flow Examples

### Example 1: Transcribe Audio File

**User Action:**
```
1. Click "Select Audio" → file dialog → user picks /home/user/lecture.mp3
2. Select format "SRT"
3. Click "Start Transcription"
```

**IPC Flow:**
```javascript
// Renderer
const result = await window.electronAPI.transcribe({
  audioPath: '/home/user/lecture.mp3',
  format: 'srt',
  language: 'auto',
  model: 'base'
});

// Main (transcribe.js)
ipcMain.handle('transcribe', async (event, args) => {
  const child = spawn('whisper-cli', [
    args.audioPath,
    '--output_format', args.format,
    '--language', args.language,
    '--model', args.model
  ]);
  
  // Stream updates to renderer
  child.stdout.on('data', (chunk) => {
    mainWindow.webContents.send('transcribe-progress', {
      progress: 45,  // percent
      currentSegment: 'The history of science...'
    });
  });
  
  // Return final result
  return { status: 'ok', result: { outputPath: '...' } };
});
```

### Example 2: Translate Subtitles

**User Action:**
```
1. Click "Select Subtitle File" → file dialog → user picks /home/user/video.srt
2. Enter DeepL API key (or use saved)
3. Select target language "German"
4. Click "Translate"
```

**IPC Flow:**
```javascript
// Renderer
const result = await window.electronAPI.translate({
  subtitlePath: '/home/user/video.srt',
  targetLanguage: 'DE',
  apiKey: settings.apiKey
});

// Main (translate.js)
ipcMain.handle('translate', async (event, args) => {
  // Parse SRT
  const subs = parseSRT(fs.readFileSync(args.subtitlePath, 'utf-8'));
  
  // Extract text (keep timestamps)
  const texts = subs.map(sub => sub.text);
  
  // Call DeepL
  const translated = await callDeepL(texts, args.targetLanguage, args.apiKey);
  
  // Rebuild SRT with translated text
  const translatedSubs = subs.map((sub, i) => ({
    ...sub,
    text: translated[i]
  }));
  
  // Save
  const outputPath = await getOutputPath('video_de.srt');
  saveSRT(outputPath, translatedSubs);
  
  return { status: 'ok', result: { outputPath } };
});
```

---

## Error Handling Strategy

**Three Error Levels:**

1. **User-Friendly Errors** (shown in UI)
   - "Audio file not found"
   - "API key invalid"
   - "Insufficient disk space"

2. **Warning Errors** (logged, continue if possible)
   - "Model download slower than expected"
   - "FFmpeg not in PATH, using fallback"

3. **Critical Errors** (stop execution)
   - "whisper-cli not available"
   - "Corrupted audio file"

**Pattern:**
```javascript
try {
  // Do work
} catch (err) {
  // Log for debugging
  console.error('[transcribe]', err);
  
  // Return user-friendly message
  return {
    status: 'error',
    message: 'Failed to transcribe. Check audio file format.',
    code: err.code  // For detailed debugging
  };
}
```

---

## Performance Considerations

### Memory

- **Renderer:** ~150MB (HTML, CSS, small JS modules)
- **Main:** ~100MB base + ~500MB-3GB per model loaded
- **Total:** Depends on model size

**Optimization:** Models loaded on-demand, not on startup

### CPU

- **VAD:** < 1 second for 1-hour audio (lightweight)
- **Transcription:** Variable (depends on model size and CPU)
- **Theme switch:** Instant (CSS variable change)
- **Language switch:** Instant (already in memory)

**Optimization:** Single-processor whisper.cpp for stability

### Disk

- **App:** ~50MB
- **VAD model:** ~100MB
- **whisper.cpp models:** 75MB (tiny) to 3GB (large)
- **Output:** ~10-20KB per hour of audio (SRT format)

**Optimization:** Models cached locally, one download per model

---

## Security Considerations

- **No data collection** – All processing local
- **API keys** – Stored in plain JSON (user responsible for file permissions)
- **Audio files** – Never sent anywhere (local processing only)
- **Settings file** – Contains only user config, no passwords

**Future improvement:** Encrypt settings file for API keys

---

*Last Updated: June 2026*
