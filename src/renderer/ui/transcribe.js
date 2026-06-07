  // ═══ TRANSCRIBE ═══
  var lastOutputFile = null;
  var trQueue = [];  // [{path, name, status:"waiting"|"active"|"done"|"error", pct:0, elapsed:0}]
  var trQueueRunning = false;

  // ── Queue UI ──
  var videoExts = [".mp4",".mkv",".avi",".mov",".webm",".wmv"];
  function fileIcon(name) {
    var ext = name.substring(name.lastIndexOf(".")).toLowerCase();
    if (videoExts.indexOf(ext) >= 0) return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>';
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
  }

  function addFilesToQueue(paths) {
    for (var i = 0; i < paths.length; i++) {
      var p = paths[i];
      if (trQueue.some(function(q) { return q.path === p; })) continue;
      var name = p.replace(/^.*[\\/]/, "");
      trQueue.push({ path: p, name: name, status: "waiting", pct: 0 });
    }
    renderQueue();
  }

  function removeFromQueue(idx) {
    if (trQueue[idx] && trQueue[idx].status !== "active") {
      trQueue.splice(idx, 1);
      renderQueue();
    }
  }

  function clearQueue() {
    if (trQueueRunning) return;
    trQueue = [];
    renderQueue();
  }

  function renderQueue() {
    var listEl = $("#tr-queue-list");
    var summaryEl = $("#tr-queue-summary");
    var dropzone = $("#tr-dropzone");
    var clearBtn = $("#tr-clear-all");

    if (trQueue.length === 0) {
      listEl.style.display = "none";
      summaryEl.style.display = "none";
      dropzone.style.display = "block";
      clearBtn.style.display = "none";
      updateQueueTitle();
      return;
    }

    dropzone.style.display = "none";
    listEl.style.display = "block";
    summaryEl.style.display = "block";
    clearBtn.style.display = trQueueRunning ? "none" : "inline-flex";

    var html = "";
    var doneCount = 0;
    var totalElapsed = 0;
    for (var i = 0; i < trQueue.length; i++) {
      var q = trQueue[i];
      var cls = "queue-item";
      var statusHtml = "";
      var removeHtml = '<button class="q-remove" data-qidx="' + i + '">&times;</button>';

      if (q.status === "done") {
        cls += " q-done"; doneCount++;
        totalElapsed += q.elapsed || 0;
        var timeStr = q.elapsed ? " \u00b7 " + formatTime(q.elapsed) : "";
        statusHtml = '<span class="q-status">' + t("complete") + timeStr + '</span>';
        removeHtml = "";
      } else if (q.status === "active") {
        cls += " q-active";
        statusHtml = '<span class="q-status">' + q.pct + '%</span>';
        removeHtml = "";
      } else if (q.status === "error") {
        cls += " q-error";
        statusHtml = '<span class="q-status">' + t("cancelled") + '</span>';
        removeHtml = "";
      } else {
        statusHtml = '<span class="q-status" style="color:var(--muted);">' + t("queue_waiting") + '</span>';
      }

      html += '<div class="' + cls + '">'
        + '<span class="q-num">' + (i + 1) + '</span>'
        + '<span class="q-icon">' + fileIcon(q.name) + '</span>'
        + '<span class="q-name" title="' + q.path + '">' + q.name + '</span>'
        + statusHtml + removeHtml + '</div>';
    }

    listEl.innerHTML = html;
    var summaryText = trQueue.length + " " + t("queue_files");
    if (doneCount > 0 && totalElapsed > 0) {
      summaryText += " \u00b7 " + t("queue_total_time") + ": " + formatTime(totalElapsed);
    }
    summaryEl.textContent = summaryText;

    updateQueueTitle();

    // Attach remove handlers
    listEl.querySelectorAll(".q-remove").forEach(function(btn) {
      btn.addEventListener("click", function() {
        removeFromQueue(Number(btn.getAttribute("data-qidx")));
      });
    });
  }

  function updateQueueTitle() {
    var titleEl = $("#tr-queue-title");
    if (!trQueueRunning || trQueue.length === 0) {
      titleEl.textContent = t("input_files");
      return;
    }
    var activeIdx = -1;
    for (var i = 0; i < trQueue.length; i++) {
      if (trQueue[i].status === "active") { activeIdx = i; break; }
    }
    if (activeIdx >= 0) {
      titleEl.textContent = t("input_files") + " — " + (activeIdx + 1) + " / " + trQueue.length;
    }
  }

  // ── Queue controls ──
  $("#tr-add-files").addEventListener("click", async function() {
    var paths = await window.api.selectFiles();
    if (paths && paths.length) addFilesToQueue(paths);
  });
  $("#tr-add-folder").addEventListener("click", async function() {
    var paths = await window.api.scanFolder();
    if (paths && paths.length) addFilesToQueue(paths);
  });
  $("#tr-clear-all").addEventListener("click", clearQueue);
  // Dropzone click = add files
  $("#tr-dropzone").addEventListener("click", async function() {
    var paths = await window.api.selectFiles();
    if (paths && paths.length) addFilesToQueue(paths);
  });

  // Drag and drop support
  var dropzone = $("#tr-dropzone");
  var audioExts = [".mp3",".wav",".flac",".ogg",".m4a",".wma",".aac",".mp4",".mkv",".avi",".mov",".webm",".wmv"];

  // Prevent default drag behavior on the whole window so files don't open in browser
  document.addEventListener("dragover", function(e) { e.preventDefault(); });
  document.addEventListener("drop", function(e) { e.preventDefault(); });

  dropzone.addEventListener("dragover", function(e) {
    e.preventDefault(); e.stopPropagation();
    dropzone.classList.add("dragover");
  });
  dropzone.addEventListener("dragleave", function(e) {
    e.preventDefault(); e.stopPropagation();
    dropzone.classList.remove("dragover");
  });
  dropzone.addEventListener("drop", function(e) {
    e.preventDefault(); e.stopPropagation();
    dropzone.classList.remove("dragover");
    var files = e.dataTransfer.files;
    if (!files || !files.length) return;
    var paths = [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var ext = f.name.substring(f.name.lastIndexOf(".")).toLowerCase();
      if (audioExts.indexOf(ext) >= 0) {
        var fp = window.api.getFilePathFromDrop(f);
        if (fp) paths.push(fp);
      }
    }
    if (paths.length) addFilesToQueue(paths);
  });

  // Browse output dir
  $("#tr-browse-outdir").addEventListener("click", async function() {
    var p = await window.api.selectDirectory(); if (p) $("#tr-outdir").value = p;
  });

  // Populate CPU/Thread dropdowns
  // CPU Threads — cap at physical cores (hyperthreads don't help whisper.cpp)
  var logicalCpus=navigator.hardwareConcurrency||4;
  var physicalCores=Math.max(1,Math.floor(logicalCpus/2));
  var threadSel=$("#tr-threads");
  for(var i=1;i<=physicalCores;i++){
    var o=document.createElement("option");
    o.value=i;
    o.textContent = i + (i===physicalCores ? " (" + t("recommended") + ")" : "");
    threadSel.appendChild(o);
  }
  threadSel.value=String(physicalCores);

  // Test mode checkbox + duration slider
  $("#tr-test-mode").addEventListener("change",function(){
    $("#tr-duration-row").style.display=this.checked?"block":"none";
  });
  $("#tr-duration").addEventListener("input",function(){
    var val=Number(this.value);
    var m=Math.floor(val/60);var s=val%60;
    $("#tr-duration-val").textContent=(m>0?m+"m ":"")+(s>0?s+"s":"");
  });
  // Custom segment length: show input when "Custom..." is selected
  $("#tr-maxlen").addEventListener("change",function(){
    $("#tr-maxlen-custom").style.display=(this.value==="custom")?"block":"none";
    if(this.value!=="custom")$("#tr-maxlen-custom").value="";
  });

  var copyBtnHtml='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> <span data-i18n="copy">'+t("copy")+'</span>';

  // Timer helper
  function formatTime(sec){var h=Math.floor(sec/3600);var m=Math.floor((sec%3600)/60);var s=sec%60;if(h>0)return h+":"+(m<10?"0":"")+m+":"+(s<10?"0":"")+s;return m+":"+(s<10?"0":"")+s;}
  var trTimerInterval=null;

  // ── Transcribe a single file (used by queue runner) ──
  async function transcribeSingleFile(inputFile) {
    var model=$("#tr-model").value;
    if(!settings.whisperPath){throw new Error(t("whisper_not_configured"));}
    if(!model){throw new Error(t("no_model"));}

    // Show processing UI and start timer IMMEDIATELY
    $("#tr-processing").style.display="block";$("#tr-result").style.display="block";
    $("#tr-result-text").textContent="";$("#tr-bar").style.width="0%";$("#tr-percent").textContent="";
    $("#tr-progress-text").textContent=t("transcribing_whisper");
    $("#tr-wave").classList.add("animating");$("#tr-openfolder").style.display="none";
    $("#tr-to-translate").style.display="none";
    hideMsg("tr-status");

    var timerStart=Date.now();
    $("#tr-timer").textContent="0:00";
    if(trTimerInterval)clearInterval(trTimerInterval);
    trTimerInterval=setInterval(function(){var elapsed=Math.floor((Date.now()-timerStart)/1000);$("#tr-timer").textContent=formatTime(elapsed);},1000);

    // Show "Preparing..." while getting duration + converting
    $("#tr-progress-text").textContent=t("preparing");

    var audioDuration=0;
    try{audioDuration=await window.api.getAudioDuration(inputFile);}catch(e){}

    // Update status to transcribing (conversion + VAD happens inside the IPC call)
    $("#tr-progress-text").textContent=t("transcribing_whisper");

    var maxPct=0;
    var segmentNum=0;

    // Find the queue item for this file to update its percentage
    var qItem = trQueue.find(function(q) { return q.path === inputFile; });

    var rm=window.api.onTranscribeProgress(function(txt){
      if(txt.indexOf("[done]")!==-1){
        $("#tr-bar").style.width="100%";$("#tr-percent").textContent="100%";
        if(qItem){qItem.pct=100;renderQueue();}
        return;
      }
      var lines=txt.split("\n");
      for(var i=0;i<lines.length;i++){
        var line=lines[i];
        var tsMatch=line.match(/\[(-?\d+):(-?\d+):(-?\d+)\.\d{3}\s*-->\s*(-?\d+):(-?\d+):(-?\d+)\.\d{3}\]/);
        if(tsMatch){
          var endSec=Number(tsMatch[4])*3600+Number(tsMatch[5])*60+Number(tsMatch[6]);
          if(endSec>0&&audioDuration>0){
            var pct=Math.min(99,Math.round((endSec/audioDuration)*100));
            if(pct>maxPct){maxPct=pct;$("#tr-bar").style.width=pct+"%";$("#tr-percent").textContent=pct+"%";if(qItem){qItem.pct=pct;renderQueue();}}
          } else if(audioDuration>0&&maxPct>0){
            maxPct=Math.min(99,maxPct+1);
            $("#tr-bar").style.width=maxPct+"%";$("#tr-percent").textContent=maxPct+"%";
          }
          var textPart=line.replace(/\[-?\d+:-?\d+:-?\d+\.\d{3}\s*-->\s*-?\d+:-?\d+:-?\d+\.\d{3}\]\s*/,"");
          if(textPart.trim()){
            segmentNum++;
            var rawTs=line.match(/\[([^\]]+)\]/);
            var srtTs=rawTs?rawTs[1].replace(/\./g,","):"";
            $("#tr-result-text").textContent+=segmentNum+"\n"+srtTs+"\n "+textPart.trim()+"\n\n";
            $("#tr-result-text").scrollTop=$("#tr-result-text").scrollHeight;
          }
        }
      }
      if(audioDuration<=0){
        var fallbackPct=Math.min(95,parseInt($("#tr-bar").style.width)||0);
        if(txt.match(/\[/)){fallbackPct=Math.min(95,fallbackPct+2);}
        $("#tr-bar").style.width=fallbackPct+"%";
        $("#tr-percent").textContent=fallbackPct+"%";
      }
    });

    try{
      var durationMs=$("#tr-test-mode").checked?Number($("#tr-duration").value)*1000:0;
      var maxLenVal=$("#tr-maxlen").value==="custom"?($("#tr-maxlen-custom").value||"0"):$("#tr-maxlen").value;
      var r=await window.api.transcribe({whisperPath:settings.whisperPath,modelPath:model,inputFile:inputFile,language:$("#tr-lang").value,outputFormat:$("#tr-fmt").value,outputDir:$("#tr-outdir").value||null,processors:$("#tr-cpus").value,threads:$("#tr-threads").value,duration:durationMs,maxLen:maxLenVal});
      if(trTimerInterval){clearInterval(trTimerInterval);trTimerInterval=null;}
      $("#tr-wave").classList.remove("animating");
      rm();
      if(r.cancelled){
        $("#tr-bar").style.width="0%";$("#tr-percent").textContent="";
        $("#tr-progress-text").textContent=t("cancelled");
        return {success:false,cancelled:true};
      } else {
        $("#tr-bar").style.width="100%";$("#tr-percent").textContent="100%";
        $("#tr-progress-text").textContent=t("complete")+" \u2014 "+$("#tr-timer").textContent;
        lastOutputFile=r.outputFile;
        try{var content=await window.api.readFile(r.outputFile);$("#tr-result-text").textContent=content;}catch(e){}
        $("#tr-openfolder").style.display="inline-flex";
        var fmt=$("#tr-fmt").value;
        if((fmt==="srt"||fmt==="vtt")&&settings.deeplApiKey){$("#tr-to-translate").style.display="inline-flex";}
        return {success:true,outputFile:r.outputFile,warnings:r.warnings||[]};
      }
    }catch(e){
      if(trTimerInterval){clearInterval(trTimerInterval);trTimerInterval=null;}
      $("#tr-wave").classList.remove("animating");
      rm();
      throw e;
    }
  }

  // ── Queue runner ──
  async function runQueue() {
    if (trQueue.length === 0) return;
    trQueueRunning = true;
    var btn = $("#tr-start"); btn.disabled = true; btn.textContent = t("transcribing");
    $("#tr-cancel").style.display = "inline-flex";
    $("#tr-clear-all").style.display = "none";

    var successCount = 0;
    var lastAutoTranslateFile = null;
    var allWarnings = [];
    var allOutputFiles = [];

    for (var i = 0; i < trQueue.length; i++) {
      if (!trQueueRunning) break;
      var q = trQueue[i];
      if (q.status === "done" || q.status === "error") continue;
      q.status = "active"; q.pct = 0;
      var fileStartTime = Date.now();
      renderQueue();

      try {
        var result = await transcribeSingleFile(q.path);
        if (result.cancelled) {
          q.status = "error";
          q.elapsed = Math.floor((Date.now() - fileStartTime) / 1000);
          // Cancel remaining
          trQueueRunning = false;
          break;
        } else {
          q.status = "done"; q.pct = 100;
          q.elapsed = Math.floor((Date.now() - fileStartTime) / 1000);
          successCount++;
          lastAutoTranslateFile = result.outputFile;
          allOutputFiles.push(result.outputFile);
          if (result.warnings && result.warnings.length > 0) {
            allWarnings.push({ name: q.name, warnings: result.warnings });
          }
        }
      } catch (e) {
        q.status = "error";
        q.elapsed = Math.floor((Date.now() - fileStartTime) / 1000);
        showMsg("tr-status", "err", q.name + ": " + e.message);
      }
      renderQueue();
    }

    // Done
    trQueueRunning = false;
    btn.disabled = false; btn.textContent = t("start_transcription");
    $("#tr-cancel").style.display = "none";
    renderQueue();

    if (successCount > 0) {
      var msg = trQueue.length === 1
        ? t("transcription_complete")
        : successCount + " / " + trQueue.length + " " + t("queue_complete");

      // Show validation warnings if any
      if (allWarnings.length > 0) {
        var warnMsg = "";
        for (var w = 0; w < allWarnings.length; w++) {
          var fw = allWarnings[w];
          for (var j = 0; j < fw.warnings.length; j++) {
            var warn = fw.warnings[j];
            if (warn.indexOf("timestamp_reset:") === 0) {
              warnMsg += fw.name + ": " + t("warn_timestamp_reset").replace("{time}", warn.split(":").slice(1).join(":")) + " ";
            } else if (warn === "timestamp_stuck") {
              warnMsg += fw.name + ": " + t("warn_timestamp_stuck") + " ";
            } else if (warn === "timestamp_negative") {
              warnMsg += fw.name + ": " + t("warn_timestamp_negative") + " ";
            } else if (warn === "hallucinations_detected") {
              warnMsg += fw.name + ": " + t("warn_hallucinations_detected") + " ";
            }
          }
        }
        showMsg("tr-status", "err", msg + " \u2014 " + warnMsg);
      } else {
        showMsg("tr-status", "ok", msg);
      }

      // Auto-translate: add all output files to translate queue
      var fmt = $("#tr-fmt").value;
      if ($("#tr-auto-translate").checked && (fmt === "srt" || fmt === "vtt") && settings.deeplApiKey && allOutputFiles.length > 0) {
        addTlFilesToQueue(allOutputFiles);
        showTab("translate");
        setTimeout(function() { $("#tl-start").click(); }, 500);
      }
    }
  }

  // ── Start button ──
  $("#tr-start").addEventListener("click", function() {
    if (trQueue.length === 0) {
      showMsg("tr-status", "err", t("select_input"));
      return;
    }
    for (var i = 0; i < trQueue.length; i++) {
      trQueue[i].status = "waiting"; trQueue[i].pct = 0;
    }
    runQueue();
  });

  // Cancel
  $("#tr-cancel").addEventListener("click", async function() {
    trQueueRunning = false;
    await window.api.cancelTranscribe();
  });

  // Copy
  $("#tr-copy").addEventListener("click", function() {
    var text = $("#tr-result-text").textContent;
    if (text) { navigator.clipboard.writeText(text); $("#tr-copy").innerHTML = t("copied"); setTimeout(function() { $("#tr-copy").innerHTML = copyBtnHtml; }, 2000); }
  });

  // Open folder
  $("#tr-openfolder").addEventListener("click", function() {
    if (lastOutputFile) { window.api.openFolder(lastOutputFile.replace(/[\\/][^\\/]+$/, "")); }
  });

  // Transfer to Translate
  function transferAndTranslate(filePath) {
    addTlFilesToQueue([filePath]);
    showTab("translate");
  }

  // "Translate this file" button
  $("#tr-to-translate").addEventListener("click", function() {
    if (lastOutputFile) { $("#tl-input").value = lastOutputFile; showTab("translate"); }
  });

