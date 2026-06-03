// ─── IPC: Utility ───────────────────────────────────────────────────────────
ipcMain.handle("open-folder", async (_, p) => shell.openPath(p));
ipcMain.handle("open-url", async (_, u) => shell.openExternal(u));
ipcMain.handle("read-file", async (_, filePath) => fs.readFileSync(filePath, "utf-8"));

ipcMain.handle("deepl-usage", async (_, apiKey) => {
  return new Promise((resolve, reject) => {
    const isFree = apiKey.endsWith(":fx");
    const hostname = isFree ? "api-free.deepl.com" : "api.deepl.com";
    const options = {
      hostname,
      path: "/v2/usage",
      method: "GET",
      headers: { "Authorization": "DeepL-Auth-Key " + apiKey },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (d) => data += d);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error("Invalid response from DeepL")); }
      });
    });
    req.on("error", (e) => reject(e));
    req.end();
  });
});
