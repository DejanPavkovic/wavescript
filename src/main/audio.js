// ─── FFmpeg via ffmpeg-static (bundled with npm install) ────────────────────
let pathToFfmpeg = null;

// In packaged app, ffmpeg-static returns path inside app.asar which can't be spawned
// Always construct the unpacked path directly
if (process.resourcesPath) {
  // We're in a packaged app
  const unpackedPath = path.join(process.resourcesPath, "app.asar.unpacked", "node_modules", "ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  if (fs.existsSync(unpackedPath)) {
    pathToFfmpeg = unpackedPath;
  }
}

// Fallback: use require (works in dev mode / npm start)
if (!pathToFfmpeg) {
  try {
    pathToFfmpeg = require("ffmpeg-static");
  } catch (e) {}
}

console.log("FFmpeg resolved to:", pathToFfmpeg);

// ─── Get audio/video duration in seconds using ffmpeg ───────────────────────
function getAudioDuration(inputFile) {
  return new Promise((resolve) => {
    if (!pathToFfmpeg) return resolve(0);
    const proc = spawn(pathToFfmpeg, [
      "-i", inputFile,
      "-f", "null", "-"
    ]);
    let stderr = "";
    proc.stderr.on("data", d => { stderr += d.toString(); });
    proc.on("close", () => {
      // Parse "Duration: 00:05:23.45" from ffmpeg stderr
      const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
      if (match) {
        const hours = parseInt(match[1], 10);
        const mins = parseInt(match[2], 10);
        const secs = parseInt(match[3], 10);
        const ms = parseInt(match[4], 10);
        resolve(hours * 3600 + mins * 60 + secs + ms / 100);
      } else {
        resolve(0);
      }
    });
    proc.on("error", () => resolve(0));
  });
}

ipcMain.handle("get-audio-duration", async (_, filePath) => {
  return getAudioDuration(filePath);
});

// ─── Convert to WAV if needed ───────────────────────────────────────────────
function convertToWav(inputFile) {
  return new Promise((resolve, reject) => {
    const ext = path.extname(inputFile).toLowerCase();
    if (ext === ".wav") return resolve(inputFile); // already WAV

    if (!pathToFfmpeg) {
      return reject(new Error("FFmpeg not found. Try reinstalling the app with 'npm install'."));
    }

    const wavFile = path.join(userDataPath, "temp_audio_" + Date.now() + ".wav");
    if (mainWindow) mainWindow.webContents.send("transcribe-progress", "[wavescript] Converting to WAV format...\n");

    const proc = spawn(pathToFfmpeg, [
      "-i", inputFile,
      "-y", "-v", "error",
      "-ar", "16000",
      "-ac", "1",
      "-c:a", "pcm_s16le",
      wavFile,
    ]);
    ffmpegConvertProc = proc;  // Store for cancel support

    let stderr = "";
    proc.stderr.on("data", d => { stderr += d.toString(); });
    proc.on("close", code => {
      ffmpegConvertProc = null;
      if (code === 0 && fs.existsSync(wavFile)) {
        if (mainWindow) mainWindow.webContents.send("transcribe-progress", "Conversion done.\n\n");
        resolve(wavFile);
      } else {
        reject(new Error("FFmpeg conversion failed (code " + code + "): " + stderr.slice(-500)));
      }
    });
    proc.on("error", err => reject(new Error("Failed to run ffmpeg: " + err.message)));
  });
}
