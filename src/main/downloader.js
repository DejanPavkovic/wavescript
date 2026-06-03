// ─── IPC: Download (generic) ────────────────────────────────────────────────
let activeDownload = null;

function downloadFile(url, destPath, progressChannel) {
  return new Promise((resolve, reject) => {
    if (activeDownload) return reject(new Error("A download is already in progress"));
    const file = fs.createWriteStream(destPath);
    let received = 0;

    function doReq(u) {
      const client = u.startsWith("https") ? https : http;
      const req = client.get(u, (res) => {
        if ([301, 302, 307].includes(res.statusCode) && res.headers.location) {
          return doReq(res.headers.location);
        }
        if (res.statusCode !== 200) {
          file.close(); try { fs.unlinkSync(destPath); } catch(e){}
          activeDownload = null;
          return reject(new Error("Download failed: HTTP " + res.statusCode));
        }
        const total = parseInt(res.headers["content-length"], 10) || 0;
        activeDownload = { req, file };
        res.on("data", (chunk) => {
          received += chunk.length;
          const pct = total ? Math.round((received / total) * 100) : 0;
          if (mainWindow) mainWindow.webContents.send(progressChannel, {
            percent: pct,
            text: (received / 1e6).toFixed(1) + " MB / " + (total / 1e6).toFixed(0) + " MB (" + pct + "%)",
          });
        });
        res.pipe(file);
        file.on("finish", () => { file.close(() => { activeDownload = null; resolve(destPath); }); });
      });
      req.on("error", (err) => {
        file.close(); try { fs.unlinkSync(destPath); } catch(e){}
        activeDownload = null;
        reject(err);
      });
    }
    doReq(url);
  });
}

ipcMain.handle("cancel-download", () => {
  if (activeDownload) { activeDownload.req.destroy(); activeDownload.file.close(); activeDownload = null; return true; }
  return false;
});

// ─── IPC: Download Whisper ──────────────────────────────────────────────────
ipcMain.handle("download-whisper", async (_, opts) => {
  const zipPath = path.join(userDataPath, opts.filename);
  await downloadFile(opts.url, zipPath, "whisper-download-progress");
  // Extract
  if (mainWindow) mainWindow.webContents.send("whisper-download-progress", { percent: 100, text: "Extracting..." });
  try {
    execSync('powershell -Command "Expand-Archive -Path \'' + zipPath + '\' -DestinationPath \'' + whisperBinDir + '\' -Force"', { timeout: 120000 });
    try { fs.unlinkSync(zipPath); } catch(e){}
    const cli = findWhisperCliRecursive(whisperBinDir);
    if (cli) return { success: true, path: cli };
    throw new Error("Could not find whisper exe after extraction");
  } catch (e) {
    try { fs.unlinkSync(zipPath); } catch(e2){}
    throw e;
  }
});

// ─── IPC: Download Model ────────────────────────────────────────────────────
ipcMain.handle("download-model", async (_, modelInfo) => {
  const dest = path.join(modelsDir, modelInfo.file);
  const temp = dest + ".downloading";
  await downloadFile(modelInfo.url, temp, "download-progress");
  try { if (fs.existsSync(dest)) fs.unlinkSync(dest); } catch(e){}
  fs.renameSync(temp, dest);
  return { success: true, path: dest };
});

ipcMain.handle("delete-model", async (_, p) => {
  try { if (fs.existsSync(p)) { fs.unlinkSync(p); return true; } } catch(e){}
  return false;
});
