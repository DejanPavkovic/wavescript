// ─── Find Whisper CLI ───────────────────────────────────────────────────────
function findWhisperCli() {
  const dirs = [
    whisperBinDir,
    path.join(process.resourcesPath || __dirname, "whisper-bin"),
    path.join(__dirname, "whisper-bin"),
  ];
  for (const dir of dirs) {
    try {
      if (!fs.existsSync(dir)) continue;
      const found = findWhisperCliRecursive(dir);
      if (found) return found;
    } catch (e) {}
  }
  return null;
}

function findWhisperCliRecursive(dir, depth) {
  if (!depth) depth = 3;
  if (depth <= 0) return null;
  const priority = ["whisper-cli.exe", "whisper-cli", "main.exe", "whisper.exe"];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    // Check current directory — scan all files, return highest priority match
    let bestMatch = null;
    let bestPriority = priority.length;
    for (const e of entries) {
      if (e.isFile()) {
        const idx = priority.indexOf(e.name.toLowerCase());
        if (idx !== -1 && idx < bestPriority) {
          bestMatch = path.join(dir, e.name);
          bestPriority = idx;
        }
      }
    }
    if (bestMatch) return bestMatch;
    // Recurse into subdirectories
    for (const e of entries) {
      if (e.isDirectory()) {
        const found = findWhisperCliRecursive(path.join(dir, e.name), depth - 1);
        if (found) return found;
      }
    }
  } catch (e) {}
  return null;
}
