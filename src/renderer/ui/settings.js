  // ═══ SETTINGS ═══
  $("#set-browse-whisper").addEventListener("click",async function(){var p=await window.api.selectExecutable();if(p)$("#set-whisper").value=p;});
  $("#set-save").addEventListener("click",async function(){settings.whisperPath=$("#set-whisper").value;settings.deeplApiKey=$("#set-deepl").value;await window.api.saveSettings(settings);showMsg("set-status","ok",t("settings_saved"));fetchDeeplUsage();});
  $("#set-rerun").addEventListener("click",function(){$$(".panel").forEach(function(p){p.classList.remove("active");});$("#main-sidebar").style.display="none";settings._forceWizard=true;showWizard();});

  async function fetchDeeplUsage(){
    var key=settings.deeplApiKey||$("#set-deepl").value;
    if(!key){$("#deepl-usage-card").style.display="none";return;}
    try{
      var u=await window.api.deeplUsage(key);
      var used=u.character_count||0,limit=u.character_limit||500000,remaining=limit-used,pct=Math.round(used/limit*100);
      $("#deepl-used").textContent=used.toLocaleString();
      $("#deepl-limit").textContent=limit.toLocaleString();
      $("#deepl-usage-bar").style.width=pct+"%";
      $("#deepl-remaining").textContent=remaining.toLocaleString()+" "+t("free_chars_left");
      $("#deepl-usage-card").style.display="block";
    }catch(e){$("#deepl-usage-card").style.display="none";}
  }

