  // ═══ WIZARD ═══
  async function showWizard() {
    // Refresh status for re-run
    try{status=await window.api.getSetupStatus();}catch(e){}
    $("#wizard").classList.add("active"); $("#main-sidebar").style.display="none";
    $$(".panel").forEach(function(p){if(p.id!=="wizard")p.classList.remove("active");});
    // Always start at step 0 (language)
    $("#wiz-0").style.display="block";
    $("#wiz-1").style.display="none";
    $("#wiz-2").style.display="none";
    $("#wiz-3").style.display="none";
    if(status.whisperReady&&status.whisperPath){$("#wiz-whisper-path").value=status.whisperPath;$("#whisper-path-row").style.display="block";$("#wiz-dl-whisper").textContent="✓ Whisper.cpp Ready";$("#wiz-dl-whisper").disabled=true;}
    if(status.deeplApiKey)$("#wiz-deepl-key").value=status.deeplApiKey;
    // Reset wizard buttons/sections for re-run
    $("#wiz-next-2").disabled=false;$("#wiz-next-2").innerHTML=t("dl_continue");
    $("#model-dl-sec").style.display="none";
    $("#whisper-dl-sec").style.display="none";
    // Auto-select first downloaded model or default to "base"
    if(status.downloadedModels&&status.downloadedModels.length>0){
      var firstModel=status.downloadedModels[0].name.replace("ggml-","").replace(".bin","");
      selModel=firstModel;
    } else { selModel="base"; }
    // Show skip buttons only if setup was already completed (re-run)
    var canSkip=(status.whisperReady&&status.modelReady);
    $$(".wiz-skip-btn").forEach(function(b){b.style.display=canSkip?"inline-flex":"none";});
    updateWhisperCheck();buildModelCards();
  }
  function updateWhisperCheck(){$("#whisper-status").innerHTML=status.whisperReady?'<div class="check-item"><span class="check-icon done">✓</span> Whisper.cpp is ready</div>':'<div class="check-item"><span class="check-icon pending">!</span> Whisper.cpp not found</div>';}
  function buildModelCards(){var html="";models.forEach(function(m){var dl=(status.downloadedModels||[]).some(function(d){return d.name===m.file;});html+='<div class="model-card'+(m.id===selModel?' selected':'')+'" data-id="'+m.id+'"><div class="model-radio"></div><div class="model-info"><h4>'+m.name+(dl?' <span style="color:var(--ok);font-size:11px;">● Downloaded</span>':'')+'</h4><div class="meta">'+m.file+' — '+m.size+'</div><div class="quality">'+m.quality+'</div></div></div>';});$("#model-choices").innerHTML=html;$$("#model-choices .model-card").forEach(function(card){card.addEventListener("click",function(){$$("#model-choices .model-card").forEach(function(c){c.classList.remove("selected");});card.classList.add("selected");selModel=card.getAttribute("data-id");});});}

  // Skip Setup buttons — skip wizard and go to main app
  $$(".wiz-skip-btn").forEach(function(b){b.addEventListener("click",async function(){settings._forceWizard=false;await window.api.saveSettings(settings);status=await window.api.getSetupStatus();showMain();});});

  // Cancel download buttons in wizard
  $("#wiz-cancel-whisper-dl").addEventListener("click",async function(){await window.api.cancelDownload();$("#whisper-dl-sec").style.display="none";$("#wiz-dl-whisper").disabled=false;$("#wiz-dl-whisper").textContent=t("wiz_dl_whisper");});
  $("#wiz-cancel-dl").addEventListener("click",async function(){await window.api.cancelDownload();$("#model-dl-sec").style.display="none";$("#wiz-next-2").disabled=false;$("#wiz-next-2").textContent=t("dl_continue");});

  // Cancel download button in Models tab
  $("#mdl-cancel-dl").addEventListener("click",async function(){await window.api.cancelDownload();setTimeout(function(){$("#mdl-dl-sec").style.display="none";refreshModelsTab();},500);});
  // Wizard step 0 — language selection
  $("#wiz-next-0").addEventListener("click",function(){$("#wiz-0").style.display="none";$("#wiz-1").style.display="block";});
  $("#wiz-back-1").addEventListener("click",function(){$("#wiz-1").style.display="none";$("#wiz-0").style.display="block";});

  $("#wiz-dl-whisper").addEventListener("click",async function(){var btn=$("#wiz-dl-whisper");btn.disabled=true;btn.textContent="Downloading...";$("#whisper-dl-sec").style.display="block";var rm=window.api.onWhisperDownloadProgress(function(d){$("#whisper-dl-bar").style.width=d.percent+"%";$("#whisper-dl-text").textContent=d.text;});try{var r=await window.api.downloadWhisper({url:"https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.4/whisper-bin-x64.zip",filename:"whisper-bin-x64.zip"});rm();btn.textContent="✓ Whisper.cpp Ready";$("#whisper-dl-bar").style.width="100%";$("#whisper-dl-text").textContent="Installed!";settings.whisperPath=r.path;status.whisperPath=r.path;status.whisperReady=true;$("#wiz-whisper-path").value=r.path;$("#whisper-path-row").style.display="block";updateWhisperCheck();}catch(e){rm();btn.disabled=false;btn.textContent="⬇ Retry";$("#whisper-dl-text").textContent="Failed: "+e.message;}});
  $("#wiz-browse-whisper").addEventListener("click",async function(){var p=await window.api.selectExecutable();if(p){settings.whisperPath=p;status.whisperPath=p;status.whisperReady=true;$("#wiz-whisper-path").value=p;$("#whisper-path-row").style.display="block";$("#wiz-dl-whisper").textContent="✓ Whisper.cpp Ready";$("#wiz-dl-whisper").disabled=true;updateWhisperCheck();}});
  $("#wiz-next-1").addEventListener("click",function(){if(!status.whisperReady){alert("Please download or locate Whisper.cpp first.");return;}settings.whisperPath=$("#wiz-whisper-path").value;$("#wiz-1").style.display="none";$("#wiz-2").style.display="block";});
  $("#wiz-back-2").addEventListener("click",function(){$("#wiz-2").style.display="none";$("#wiz-1").style.display="block";});
  $("#wiz-next-2").addEventListener("click",async function(){var m=models.find(function(x){return x.id===selModel;});if(!m)return;var existing=(status.downloadedModels||[]).find(function(d){return d.name===m.file;});if(existing){settings.modelPath=existing.path;$("#wiz-2").style.display="none";$("#wiz-3").style.display="block";return;}var btn=$("#wiz-next-2");btn.disabled=true;btn.textContent="Downloading...";$("#model-dl-sec").style.display="block";var rm=window.api.onDownloadProgress(function(d){$("#model-dl-bar").style.width=d.percent+"%";$("#model-dl-text").textContent=d.text;});try{var r=await window.api.downloadModel(m);rm();settings.modelPath=r.path;status=await window.api.getSetupStatus();setTimeout(function(){$("#wiz-2").style.display="none";$("#wiz-3").style.display="block";},500);}catch(e){rm();btn.disabled=false;btn.textContent="Retry →";$("#model-dl-text").textContent="Failed: "+e.message;}});
  $("#wiz-back-3").addEventListener("click",function(){$("#wiz-3").style.display="none";$("#wiz-2").style.display="block";});
  $("#wiz-finish").addEventListener("click",async function(){var key=$("#wiz-deepl-key").value.trim();if(key)settings.deeplApiKey=key;settings._forceWizard=false;await window.api.saveSettings(settings);status=await window.api.getSetupStatus();showMain();});

