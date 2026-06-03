// ─── IPC: Transcribe (with auto-convert) ────────────────────────────────────
let whisperProc = null;
let ffmpegConvertProc = null;  // Track FFmpeg conversion for cancel support

let whisperCancelled = false;

ipcMain.handle("transcribe", async (_, opts) => {
  if (!fs.existsSync(opts.whisperPath)) throw new Error("Whisper CLI not found: " + opts.whisperPath);
  if (!fs.existsSync(opts.modelPath)) throw new Error("Model not found: " + opts.modelPath);
  if (!fs.existsSync(opts.inputFile)) throw new Error("Input file not found: " + opts.inputFile);

  whisperCancelled = false;

  // Auto-convert non-WAV files
  const ext = path.extname(opts.inputFile).toLowerCase();
  let audioFile = opts.inputFile;
  let tempWav = null;

  if (ext !== ".wav") {
    if (!pathToFfmpeg) {
      throw new Error("FFmpeg not found. Try reinstalling with 'npm install'.");
    }
    audioFile = await convertToWav(opts.inputFile);
    tempWav = audioFile;
  }

  // Ensure VAD model is available before transcribing. Downloads on first use
  // (~30 MB, ~10s on broadband). If download fails, vadPath is null and we
  // fall back to non-VAD transcription gracefully.
  const vadPath = await ensureVadModel();

  return new Promise((resolve, reject) => {
    const base = path.basename(opts.inputFile, path.extname(opts.inputFile));
    const outDir = opts.outputDir || path.dirname(opts.inputFile);
    const outBase = path.join(outDir, base);
    const fmt = opts.outputFormat || "srt";

    // Build args matching TT-Tool's approach (no --output-file flag)
    const args = ["--model", opts.modelPath, "--file", audioFile, "--language", opts.language || "auto"];
    
    // Output format
    if (fmt === "srt") args.push("--output-srt");
    else if (fmt === "vtt") args.push("--output-vtt");
    else if (fmt === "txt") args.push("--output-txt");
    else if (fmt === "lrc") args.push("--output-lrc");
    else if (fmt === "csv") args.push("--output-csv");
    else if (fmt === "json") args.push("--output-json");
    else if (fmt === "wts") args.push("--output-words");
    else args.push("--output-srt");

    // Always pass --max-len and --duration like TT-Tool does
    args.push("--max-len", (opts.maxLen && Number(opts.maxLen) > 0) ? String(opts.maxLen) : "0");
    args.push("--duration", (opts.duration && Number(opts.duration) > 0) ? String(opts.duration) : "0");

    // Prevent timestamp overflow on long audio files
    args.push("--max-context", "0");

    // Voice Activity Detection: pre-segment audio into speech-only regions
    // before passing to Whisper. This prevents Large V3 hallucination loops
    // on long audio (>20 min) that produced negative timestamps. The Welsh-
    // language hallucination at minute ~13 of long sermons was the canonical
    // failure case. VAD is the canonical fix used by faster-whisper, WhisperX,
    // and recommended by the whisper.cpp project itself (added in v1.7.6).
    if (vadPath) {
      args.push("--vad");
      args.push("--vad-model", vadPath);
    }

    // CPU control — processors always 1 (parallel chunks cause timestamp resets
    // with CPU binary's whisper_full_parallel). Threads from user selection.
    args.push("--processors", "1");
    if (opts.threads) args.push("--threads", String(opts.threads));

    whisperProc = spawn(opts.whisperPath, args, { cwd: path.dirname(opts.whisperPath) });
    let stderr = "";

    whisperProc.stdout.on("data", d => mainWindow && mainWindow.webContents.send("transcribe-progress", d.toString()));
    whisperProc.stderr.on("data", d => { stderr += d.toString(); mainWindow && mainWindow.webContents.send("transcribe-progress", d.toString()); });
    whisperProc.on("close", code => {
      whisperProc = null;
      if (whisperCancelled) {
        if (tempWav) { try { fs.unlinkSync(tempWav); } catch (e) {} }
        resolve({ success: false, cancelled: true });
      } else if (code === 0) {
        // Fix #17: Force progress to 100% on successful completion
        if (mainWindow) mainWindow.webContents.send("transcribe-progress", "[done]");

        const extMap = { srt:".srt", vtt:".vtt", txt:".txt", lrc:".lrc", csv:".csv", json:".json", wts:".wts" };
        const outExt = extMap[fmt] || ".srt";
        // Without --output-file, Whisper writes next to the input audio file
        // e.g. audio.wav → audio.wav.srt
        const whisperOut = audioFile + outExt;

        // Fix #18: Don't overwrite existing files — add (1), (2), etc.
        let desiredOut = outBase + outExt;
        if (fs.existsSync(desiredOut) && whisperOut !== desiredOut) {
          let counter = 1;
          while (fs.existsSync(path.join(outDir, base + " (" + counter + ")" + outExt))) { counter++; }
          desiredOut = path.join(outDir, base + " (" + counter + ")" + outExt);
        }

        // Move output to desired location if needed
        try {
          if (fs.existsSync(whisperOut) && whisperOut !== desiredOut) {
            fs.copyFileSync(whisperOut, desiredOut);
            fs.unlinkSync(whisperOut);
          }
        } catch (e) { console.error("Error moving output file:", e); }
        const finalOut = fs.existsSync(desiredOut) ? desiredOut : whisperOut;
        if (tempWav) { try { fs.unlinkSync(tempWav); } catch (e) {} }

        // Post-transcription validation: scan SRT for timestamp issues
        let warnings = [];
        try {
          const content = fs.readFileSync(finalOut, "utf-8");
          const tsRegex = /(\d+):(\d+):(\d+)[,.]\d+\s*-->\s*(\d+):(\d+):(\d+)/g;
          let match, prevEnd = 0, stuckCount = 0, prevTs = "";
          while ((match = tsRegex.exec(content)) !== null) {
            const startSec = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
            const endSec = Number(match[4]) * 3600 + Number(match[5]) * 60 + Number(match[6]);
            const tsKey = match[1] + ":" + match[2] + ":" + match[3];
            // Check for timestamp reset (going backwards by >30 seconds)
            if (prevEnd > 30 && startSec < prevEnd - 30) {
              const mins = Math.floor(prevEnd / 60);
              const secs = prevEnd % 60;
              warnings.push("timestamp_reset:" + mins + ":" + (secs < 10 ? "0" : "") + secs);
              break;  // One warning is enough
            }
            // Check for stuck timestamps (same start repeated 5+ times)
            if (tsKey === prevTs) { stuckCount++; } else { stuckCount = 0; }
            if (stuckCount >= 5 && warnings.indexOf("timestamp_stuck") === -1) {
              warnings.push("timestamp_stuck");
            }
            prevTs = tsKey;
            prevEnd = endSec;
          }
          // Check for negative timestamps
          if (content.match(/-\d+:-\d+:-\d+/)) {
            warnings.push("timestamp_negative");
          }
        } catch (e) { /* validation is best-effort, don't block on errors */ }

        resolve({ success: true, outputFile: finalOut, warnings: warnings });
      } else {
        if (tempWav) { try { fs.unlinkSync(tempWav); } catch (e) {} }
        reject(new Error("Transcription failed. Check the log output for details."));
      }
    });
    whisperProc.on("error", err => {
      whisperProc = null;
      if (tempWav) { try { fs.unlinkSync(tempWav); } catch (e) {} }
      if (whisperCancelled) {
        resolve({ success: false, cancelled: true });
      } else {
        reject(err);
      }
    });
  });
});

ipcMain.handle("cancel-transcribe", () => {
  whisperCancelled = true;

  // Kill FFmpeg conversion if it's running
  if (ffmpegConvertProc) {
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(ffmpegConvertProc.pid), "/f", "/t"]);
      } else {
        ffmpegConvertProc.kill("SIGKILL");
      }
    } catch (e) {}
    ffmpegConvertProc = null;
  }

  // Kill Whisper process if it's running
  if (whisperProc) {
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(whisperProc.pid), "/f", "/t"]);
      } else {
        whisperProc.kill("SIGKILL");
      }
    } catch (e) {}
    whisperProc = null;
    return true;
  }
  return false;
});
