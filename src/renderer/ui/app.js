  // ═══ MAIN APP ═══
  function showMain(){$("#wizard").classList.remove("active");$("#main-sidebar").style.display="flex";showTab("transcribe");if(settings.whisperPath)$("#set-whisper").value=settings.whisperPath;if(settings.deeplApiKey)$("#set-deepl").value=settings.deeplApiKey;refreshModelSelect();}
  $$(".sidebar-btn[data-tab]").forEach(function(b){b.addEventListener("click",function(){showTab(b.getAttribute("data-tab"));});});
  function showTab(name){$$(".sidebar-btn[data-tab]").forEach(function(b){b.classList.toggle("active",b.getAttribute("data-tab")===name);});$$(".panel").forEach(function(p){p.classList.remove("active");});$("#tab-"+name).classList.add("active");if(name==="models")refreshModelsTab();if(name==="settings")fetchDeeplUsage();}

  async function refreshModelSelect(){
    status=await window.api.getSetupStatus();var sel=$("#tr-model");sel.innerHTML="";
    if(!status.downloadedModels||status.downloadedModels.length===0){sel.innerHTML='<option value="">'+t("no_model")+'</option>';return;}
    status.downloadedModels.forEach(function(m){var o=document.createElement("option");o.value=m.path;o.textContent=friendlyModelName(m.name);if(m.path===settings.modelPath)o.selected=true;sel.appendChild(o);});
    autoSelectModel();
  }

  // Auto-select best model based on language
  function autoSelectModel(){
    var lang=$("#tr-lang").value;
    var sel=$("#tr-model");
    var hint=$("#tr-model-hint");
    var isEnglish=(lang==="en");

    // For English: Medium.en (fast + accurate), fallback Medium
    // For non-English/auto: Large V3 Turbo (6x faster, near-same accuracy), fallback Large V3
    var preferred, preferredName, fallback1, fallback1Name, fallback2, fallback2Name;
    if(isEnglish){
      preferred="Medium.en"; fallback1="Medium"; fallback2=null;
    } else {
      preferred="Large V3 Turbo"; fallback1="Large V3"; fallback2="Large V2";
    }

    // Try to select in priority order
    var found=false;
    var candidates=[preferred,fallback1,fallback2];
    for(var c=0;c<candidates.length&&!found;c++){
      if(!candidates[c])continue;
      for(var i=0;i<sel.options.length;i++){
        if(sel.options[i].textContent===candidates[c]){sel.selectedIndex=i;found=true;break;}
      }
    }

    // Update hint
    if(isEnglish){
      hint.textContent="\u2726 "+t("recommended")+": Medium.en \u2014 "+t("recommended_en_hint");
    } else if(lang==="auto"){
      hint.textContent="\u2726 "+t("recommended")+": Large V3 Turbo \u2014 "+t("recommended_auto_hint");
    } else {
      hint.textContent="\u2726 "+t("recommended")+": Large V3 Turbo \u2014 "+t("recommended_multi_hint");
    }
  }

  // Language change → auto-select model
  $("#tr-lang").addEventListener("change",function(){autoSelectModel();});

