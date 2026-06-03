// ─── IPC: Translate ─────────────────────────────────────────────────────────
ipcMain.handle("translate", async (_, opts) => {
  const deepl = require("deepl-node");
  const translator = new deepl.Translator(opts.deeplApiKey);
  const content = fs.readFileSync(opts.inputFile, "utf-8");
  const ext = path.extname(opts.inputFile);
  let translated = "";

  if (ext === ".srt") {
    const blocks = content.trim().split(/\n\n+/);
    const out = []; let done = 0;
    for (const block of blocks) {
      const lines = block.split("\n");
      if (lines.length >= 3) {
        try {
          const r = await translator.translateText(lines.slice(2).join("\n"), null, opts.targetLang);
          out.push(lines[0] + "\n" + lines[1] + "\n" + r.text);
        } catch(e) { out.push(block); }
      } else out.push(block);
      done++;
      mainWindow && mainWindow.webContents.send("translate-progress", { done, total: blocks.length, percent: Math.round(done/blocks.length*100) });
    }
    translated = out.join("\n\n") + "\n";
  } else if (ext === ".vtt") {
    const r = await translator.translateText(content, null, opts.targetLang);
    translated = r.text;
  } else {
    const r = await translator.translateText(content, null, opts.targetLang);
    translated = r.text;
  }

  const outFmt = opts.outputFormat || "srt";
  let finalExt = "." + outFmt;
  const inBase = path.basename(opts.inputFile, ext);
  const outDir = opts.outputDir || path.dirname(opts.inputFile);
  const outFile = path.join(outDir, inBase + "_" + opts.targetLang + finalExt);
  fs.writeFileSync(outFile, translated, "utf-8");
  return { success: true, outputFile: outFile };
});
