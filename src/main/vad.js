// ─── VAD model: auto-download if missing ────────────────────────────────────
// Returns the path to the VAD model, downloading it (~30 MB) if not present.
// On any failure, returns null and lets the caller proceed without VAD.
async function ensureVadModel() {
  if (fs.existsSync(vadModelPath)) return vadModelPath;
  try { fs.mkdirSync(vadDir, { recursive: true }); } catch (e) {}
  try {
    if (mainWindow) mainWindow.webContents.send("transcribe-progress",
      "[wavescript] Preparing speech detection model (one-time, ~30 MB)...\n");
    const temp = vadModelPath + ".downloading";
    await downloadFile(VAD_MODEL_URL, temp, "vad-download-progress");
    fs.renameSync(temp, vadModelPath);
    if (mainWindow) mainWindow.webContents.send("transcribe-progress",
      "[wavescript] Speech detection model ready.\n");
    return vadModelPath;
  } catch (e) {
    if (mainWindow) mainWindow.webContents.send("transcribe-progress",
      "[wavescript] Could not download VAD model (" + e.message + "). Continuing without VAD.\n");
    try { fs.unlinkSync(vadModelPath + ".downloading"); } catch (e2) {}
    return null;
  }
}
