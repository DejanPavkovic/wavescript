  // ═══ TRANSLATE ═══
  var tlQueue = [];  // [{path, name, status, elapsed}]
  var tlQueueRunning = false;
  var lastTlOutputFile = null;

  // ── Queue UI (mirrors transcribe queue) ──
  function addTlFilesToQueue(paths) {
    for (var i = 0; i < paths.length; i++) {
      var p = paths[i];
      if (tlQueue.some(function(q) { return q.path === p; })) continue;
      var name = p.replace(/^.*[\\/]/, "");
      tlQueue.push({ path: p, name: name, status: "waiting", elapsed: 0 });
    }
    renderTlQueue();
  }

  function renderTlQueue() {
    var listEl = $("#tl-queue-list");
    var summaryEl = $("#tl-queue-summary");
    var dropzone = $("#tl-dropzone");
    var clearBtn = $("#tl-clear-all");
    if (tlQueue.length === 0) {
      listEl.style.display = "none"; summaryEl.style.display = "none";
      dropzone.style.display = "block"; clearBtn.style.display = "none";
      $("#tl-queue-title").textContent = t("input_files");
      return;
    }
    dropzone.style.display = "none"; listEl.style.display = "block";
    summaryEl.style.display = "block";
    clearBtn.style.display = tlQueueRunning ? "none" : "inline-flex";

    var html = "", doneCount = 0, totalElapsed = 0;
    for (var i = 0; i < tlQueue.length; i++) {
      var q = tlQueue[i];
      var cls = "queue-item", statusHtml = "", removeHtml = '<button class="q-remove" data-tqidx="' + i + '">&times;</button>';
      if (q.status === "done") {
        cls += " q-done"; doneCount++; totalElapsed += q.elapsed || 0;
        var timeStr = q.elapsed ? " \u00b7 " + formatTime(q.elapsed) : "";
        statusHtml = '<span class="q-status">' + t("complete") + timeStr + '</span>'; removeHtml = "";
      } else if (q.status === "active") {
        cls += " q-active"; statusHtml = '<span class="q-status">' + t("translating") + '</span>'; removeHtml = "";
      } else if (q.status === "error") {
        cls += " q-error"; statusHtml = '<span class="q-status">' + t("cancelled") + '</span>'; removeHtml = "";
      } else {
        statusHtml = '<span class="q-status" style="color:var(--muted);">' + t("queue_waiting") + '</span>';
      }
      html += '<div class="' + cls + '"><span class="q-num">' + (i + 1) + '</span><span class="q-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span><span class="q-name" title="' + q.path + '">' + q.name + '</span>' + statusHtml + removeHtml + '</div>';
    }
    listEl.innerHTML = html;
    var summaryText = tlQueue.length + " " + t("queue_files");
    if (doneCount > 0 && totalElapsed > 0) summaryText += " \u00b7 " + t("queue_total_time") + ": " + formatTime(totalElapsed);
    summaryEl.textContent = summaryText;

    // Update title
    var activeIdx = -1;
    for (var i = 0; i < tlQueue.length; i++) { if (tlQueue[i].status === "active") { activeIdx = i; break; } }
    $("#tl-queue-title").textContent = t("input_files") + (activeIdx >= 0 ? " \u2014 " + (activeIdx + 1) + " / " + tlQueue.length : "");

    listEl.querySelectorAll(".q-remove").forEach(function(btn) {
      btn.addEventListener("click", function() {
        var idx = Number(btn.getAttribute("data-tqidx"));
        if (tlQueue[idx] && tlQueue[idx].status !== "active") { tlQueue.splice(idx, 1); renderTlQueue(); }
      });
    });
  }

  // ── Controls ──
  var srtExts = [".srt", ".vtt", ".txt"];
  $("#tl-add-files").addEventListener("click", async function() {
    var f = await window.api.selectFile({ filters: [{ name: "Subtitle Files", extensions: ["srt", "vtt", "txt"] }] });
    if (f) addTlFilesToQueue([f]);
  });
  $("#tl-clear-all").addEventListener("click", function() { if (!tlQueueRunning) { tlQueue = []; renderTlQueue(); } });
  $("#tl-dropzone").addEventListener("click", async function() {
    var f = await window.api.selectFile({ filters: [{ name: "Subtitle Files", extensions: ["srt", "vtt", "txt"] }] });
    if (f) addTlFilesToQueue([f]);
  });

  // Drag and drop for translate
  var tlDropzone = $("#tl-dropzone");
  tlDropzone.addEventListener("dragover", function(e) { e.preventDefault(); e.stopPropagation(); tlDropzone.classList.add("dragover"); });
  tlDropzone.addEventListener("dragleave", function(e) { e.preventDefault(); e.stopPropagation(); tlDropzone.classList.remove("dragover"); });
  tlDropzone.addEventListener("drop", function(e) {
    e.preventDefault(); e.stopPropagation(); tlDropzone.classList.remove("dragover");
    var files = e.dataTransfer.files; if (!files || !files.length) return;
    var paths = [];
    for (var i = 0; i < files.length; i++) {
      var ext = files[i].name.substring(files[i].name.lastIndexOf(".")).toLowerCase();
      if (srtExts.indexOf(ext) >= 0) { var fp = window.api.getFilePathFromDrop(files[i]); if (fp) paths.push(fp); }
    }
    if (paths.length) addTlFilesToQueue(paths);
  });

  // Browse output dir
  $("#tl-browse-outdir").addEventListener("click", async function() { var p = await window.api.selectDirectory(); if (p) $("#tl-outdir").value = p; });

  // Timer helper (reuse transcribe's formatTime)
  var tlTimerInterval = null;

  // ── Translate single file ──
  async function translateSingleFile(inputFile) {
    if (!settings.deeplApiKey) { throw new Error(t("deepl_not_set")); }
    $("#tl-processing").style.display = "block"; $("#tl-result").style.display = "block";
    $("#tl-result-text").textContent = ""; $("#tl-bar").style.width = "0%"; $("#tl-percent").textContent = "";
    $("#tl-progress-text").textContent = t("translating_deepl");
    $("#tl-wave").classList.add("animating"); $("#tl-openfolder").style.display = "none";
    hideMsg("tl-status");

    var timerStart = Date.now();
    $("#tl-timer").textContent = "0:00";
    if (tlTimerInterval) clearInterval(tlTimerInterval);
    tlTimerInterval = setInterval(function() { var e = Math.floor((Date.now() - timerStart) / 1000); $("#tl-timer").textContent = formatTime(e); }, 1000);

    var rm = window.api.onTranslateProgress(function(d) {
      if (d.percent !== undefined) { $("#tl-bar").style.width = d.percent + "%"; $("#tl-percent").textContent = d.percent + "%"; }
      if (d.text) { $("#tl-result-text").textContent += d.text; $("#tl-result-text").scrollTop = $("#tl-result-text").scrollHeight; }
      if (d.status) { $("#tl-progress-text").textContent = d.status; }
    });

    try {
      var r = await window.api.translate({ inputFile: inputFile, targetLang: $("#tl-lang").value, outputFormat: $("#tl-fmt").value, outputDir: $("#tl-outdir").value || null, deeplApiKey: settings.deeplApiKey });
      if (tlTimerInterval) { clearInterval(tlTimerInterval); tlTimerInterval = null; }
      $("#tl-wave").classList.remove("animating"); rm();
      $("#tl-bar").style.width = "100%"; $("#tl-percent").textContent = "100%";
      $("#tl-progress-text").textContent = t("complete") + " \u2014 " + $("#tl-timer").textContent;
      lastTlOutputFile = r.outputFile;
      try { var content = await window.api.readFile(r.outputFile); $("#tl-result-text").textContent = content; } catch (e) {}
      $("#tl-openfolder").style.display = "inline-flex";
      return { success: true, outputFile: r.outputFile };
    } catch (e) {
      if (tlTimerInterval) { clearInterval(tlTimerInterval); tlTimerInterval = null; }
      $("#tl-wave").classList.remove("animating"); rm();
      throw e;
    }
  }

  // ── Queue runner ──
  async function runTlQueue() {
    if (tlQueue.length === 0) return;
    tlQueueRunning = true;
    var btn = $("#tl-start"); btn.disabled = true; btn.textContent = t("translating");
    $("#tl-cancel").style.display = "inline-flex";
    $("#tl-clear-all").style.display = "none";
    var successCount = 0;

    for (var i = 0; i < tlQueue.length; i++) {
      if (!tlQueueRunning) break;
      var q = tlQueue[i];
      if (q.status === "done" || q.status === "error") continue;
      q.status = "active"; var fileStart = Date.now();
      renderTlQueue();
      try {
        await translateSingleFile(q.path);
        q.status = "done"; q.elapsed = Math.floor((Date.now() - fileStart) / 1000); successCount++;
      } catch (e) {
        q.status = "error"; q.elapsed = Math.floor((Date.now() - fileStart) / 1000);
        showMsg("tl-status", "err", q.name + ": " + e.message);
      }
      renderTlQueue();
    }

    tlQueueRunning = false;
    btn.disabled = false; btn.textContent = t("start_translation");
    $("#tl-cancel").style.display = "none";
    renderTlQueue();
    if (successCount > 0) {
      var msg = tlQueue.length === 1 ? t("translation_complete") : successCount + " / " + tlQueue.length + " " + t("queue_tl_complete");
      showMsg("tl-status", "ok", msg);
    }
  }

  // ── Start / Cancel ──
  $("#tl-start").addEventListener("click", function() {
    if (tlQueue.length === 0) { showMsg("tl-status", "err", t("select_input")); return; }
    for (var i = 0; i < tlQueue.length; i++) { if (tlQueue[i].status !== "done") { tlQueue[i].status = "waiting"; tlQueue[i].elapsed = 0; } }
    runTlQueue();
  });
  $("#tl-cancel").addEventListener("click", function() { tlQueueRunning = false; });

  // Copy + Open Folder
  $("#tl-copy").addEventListener("click", function() {
    var text = $("#tl-result-text").textContent;
    if (text) { navigator.clipboard.writeText(text); $("#tl-copy").innerHTML = t("copied"); setTimeout(function() { $("#tl-copy").innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> <span data-i18n="copy">' + t("copy") + '</span>'; }, 2000); }
  });
  $("#tl-openfolder").addEventListener("click", function() {
    if (lastTlOutputFile) window.api.openFolder(lastTlOutputFile.replace(/[\\/][^\\/]+$/, ""));
  });

