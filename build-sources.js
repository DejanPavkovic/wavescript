#!/usr/bin/env node
/**
 * build-sources.js — Concatenates modular source files into production files.
 *
 * WHY: Electron on Windows 11 has a blank-screen bug when loading external JS
 * files in the renderer. So index.html must contain inline JS. This script
 * lets us develop in clean, separate modules and combine them for production.
 *
 * USAGE:
 *   node build-sources.js           — one-time build
 *   node build-sources.js --watch   — rebuild on every file save (for dev)
 */

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");

// Ensure dist exists
fs.mkdirSync(DIST, { recursive: true });

// ── 1. Build main.js (main process) ──────────────────────────────────────────
// Order matters: constants first, then utilities, then IPC handlers
const mainFiles = [
  "src/main/constants.js",
  "src/main/settings.js",
  "src/main/whisper-finder.js",
  "src/main/window.js",
  "src/main/ipc-setup.js",
  "src/main/downloader.js",
  "src/main/audio.js",
  "src/main/vad.js",
  "src/main/transcribe.js",
  "src/main/translate.js",
  "src/main/ipc-utility.js",
];

let mainContent = "// ═══ AUTO-GENERATED — do not edit. Run 'node build-sources.js' ═══\n";
mainContent += "// Source files: " + mainFiles.join(", ") + "\n\n";
for (const file of mainFiles) {
  const content = fs.readFileSync(path.join(ROOT, file), "utf-8");
  mainContent += "// ── " + file + " ──\n" + content + "\n";
}
fs.writeFileSync(path.join(DIST, "main.js"), mainContent);
console.log("✓ dist/main.js (" + mainContent.split("\n").length + " lines)");

// ── 2. Build index.html (renderer — inline JS) ──────────────────────────────
// Order matters: files must load after the files that define functions they call.
// Only startup.js runs code at load time that depends on other files.
// All other cross-file calls happen inside event handlers (deferred execution).
const rendererFiles = [
  "src/renderer/ui/init.js",         // $, $$, settings, status, models — used by everything
  "src/renderer/i18n/i18n.js",       // t(), applyI18n — used by everything
  "src/renderer/ui/helpers.js",      // showMsg, hideMsg
  "src/renderer/ui/theme.js",        // applyTheme
  "src/renderer/ui/settings.js",     // fetchDeeplUsage
  "src/renderer/ui/models.js",       // refreshModelsTab
  "src/renderer/ui/app.js",          // showMain, showTab, refreshModelSelect, autoSelectModel
  "src/renderer/ui/transcribe.js",   // formatTime, transferAndTranslate
  "src/renderer/ui/translate.js",    // translate tab handlers
  "src/renderer/ui/wizard.js",       // showWizard, buildModelCards
  "src/renderer/ui/startup.js",      // MUST BE LAST — calls showMain/showWizard/applyI18n
];

const htmlTemplate = fs.readFileSync(
  path.join(ROOT, "src/renderer/index.template.html"),
  "utf-8"
);

let jsContent = "";
for (const file of rendererFiles) {
  const content = fs.readFileSync(path.join(ROOT, file), "utf-8");
  jsContent += "  // ── " + file + " ──\n" + content + "\n";
}

const fullHtml =
  htmlTemplate +
  "<script>\n(async function() {\n" +
  jsContent +
  "})();\n</script>\n</body>\n</html>\n";

fs.writeFileSync(path.join(DIST, "index.html"), fullHtml);
console.log("✓ dist/index.html (" + fullHtml.split("\n").length + " lines)");

// ── 3. Copy static files to dist ─────────────────────────────────────────────
// Copy preload.js and styles.css
const staticFiles = ["preload.js"];
for (const file of staticFiles) {
  if (fs.existsSync(path.join(ROOT, file))) {
    fs.copyFileSync(path.join(ROOT, file), path.join(DIST, file));
    console.log("✓ dist/" + file);
  }
}

// Copy styles from src
const stylesFile = path.join(ROOT, "src/renderer/styles/styles.css");
if (fs.existsSync(stylesFile)) {
  fs.copyFileSync(stylesFile, path.join(DIST, "styles.css"));
  console.log("✓ dist/styles.css");
}

// Copy assets
const assetFiles = ["icon.png", "icon.ico", "icon-small.png"];
for (const file of assetFiles) {
  const src = path.join(ROOT, "assets", file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(DIST, file));
    console.log("✓ dist/" + file);
  }
}

console.log("\nBuild complete.");

// ── 4. Watch mode (--watch flag) ─────────────────────────────────────────────
if (process.argv.includes("--watch")) {
  console.log("Watching src/ for changes... (press Ctrl+C to stop)");
  console.log("When you save a file, dist/ rebuilds automatically.");
  console.log("Press Ctrl+R in the app window to reload the UI.\n");

  let debounce = null;
  fs.watch(path.join(ROOT, "src"), { recursive: true }, (event, filename) => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => {
      console.log("[" + new Date().toLocaleTimeString() + "] Changed: " + filename + " — rebuilding...");
      try {
        // Re-run this script as a one-shot build (without --watch)
        require("child_process").execSync("node build-sources.js", {
          cwd: ROOT,
          stdio: "inherit",
        });
      } catch (e) {
        console.error("Build error:", e.message);
      }
    }, 300);  // 300ms debounce — avoids double-triggers from editors
  });

  // Also watch preload.js and root styles
  for (const file of ["preload.js"]) {
    const fp = path.join(ROOT, file);
    if (fs.existsSync(fp)) {
      fs.watch(fp, () => {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => {
          console.log("[" + new Date().toLocaleTimeString() + "] Changed: " + file + " — rebuilding...");
          try {
            require("child_process").execSync("node build-sources.js", {
              cwd: ROOT,
              stdio: "inherit",
            });
          } catch (e) {
            console.error("Build error:", e.message);
          }
        }, 300);
      });
    }
  }
}
