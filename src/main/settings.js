// ─── Settings ───────────────────────────────────────────────────────────────
function loadSettings() {
  try {
    if (fs.existsSync(settingsFile)) {
      return JSON.parse(fs.readFileSync(settingsFile, "utf-8"));
    }
  } catch (e) { console.error("loadSettings error:", e); }
  return {};
}

function saveSettings(data) {
  try {
    fs.writeFileSync(settingsFile, JSON.stringify(data, null, 2));
  } catch (e) { console.error("saveSettings error:", e); }
}
