  // ═══ MODELS TAB ═══

  // Tab switching
  $$(".models-tab").forEach(function(tab){
    tab.addEventListener("click",function(){
      $$(".models-tab").forEach(function(t2){t2.classList.remove("active");});
      tab.classList.add("active");
      $$(".mdl-panel").forEach(function(p){p.classList.remove("active");});
      $("#mdl-panel-"+tab.getAttribute("data-mtab")).classList.add("active");
    });
  });

  // Find model metadata by filename
  function findModelMeta(filename){
    return models.find(function(m){return m.file===filename;});
  }

  // Build an installed model card (with description + delete)
  function buildInstalledCard(m){
    var meta=findModelMeta(m.name);
    var name=friendlyModelName(m.name);
    var desc="";
    if(meta){
      var langLabel=meta.lang==="en"?t("mdl_lang_en"):t("mdl_lang_multi");
      var quality=t(meta.qualityKey);
      desc=meta.size+" \u00b7 "+langLabel+" \u00b7 "+quality;
    }
    var sizeMB=(m.size/1e6).toFixed(0)+" MB";
    return '<div class="model-list-item"><div class="mdl-info"><div class="mdl-name">'+name+'</div><div class="mdl-desc">'+desc+'</div></div><span class="size">'+sizeMB+'</span><button class="btn btn-sm btn-danger" data-del="'+m.path+'">'+t("mdl_delete")+'</button></div>';
  }

  // Build a browse model card (with download or installed badge)
  function buildBrowseCard(m,isInstalled){
    var langLabel=m.lang==="en"?t("mdl_lang_en"):t("mdl_lang_multi");
    var quality=t(m.qualityKey);
    var desc=m.size+" \u00b7 "+langLabel+" \u00b7 "+quality;
    var badges='';
    if(m.recommended)badges+='<span class="mdl-badge rec">'+t("mdl_recommended")+'</span>';
    if(isInstalled)badges+='<span class="mdl-badge installed">'+t("mdl_installed_badge")+'</span>';
    var action=isInstalled?'':'<button class="btn btn-sm btn-primary" data-dlm="'+m.id+'">'+t("mdl_download")+'</button>';
    var cls="mdl-browse-card"+(m.recommended?" recommended":"");
    return '<div class="'+cls+'"><div class="mdl-info"><div class="mdl-name">'+m.name+' '+badges+'</div><div class="mdl-desc">'+desc+'</div></div>'+action+'</div>';
  }

  // Attach download handlers to all [data-dlm] buttons in a container
  function attachDownloadHandlers(container){
    container.querySelectorAll("[data-dlm]").forEach(function(b){
      b.addEventListener("click",async function(){
        var m=models.find(function(x){return x.id===b.getAttribute("data-dlm");});
        b.disabled=true;b.textContent=t("downloading_model")+"...";
        $("#mdl-dl-sec").style.display="block";
        var rm=window.api.onDownloadProgress(function(d){
          $("#mdl-dl-bar").style.width=d.percent+"%";
          $("#mdl-dl-text").textContent=d.text;
        });
        try{
          await window.api.downloadModel(m);rm();
          setTimeout(function(){$("#mdl-dl-sec").style.display="none";refreshModelsTab();refreshModelSelect();},800);
        }catch(e){rm();b.disabled=false;b.textContent=t("mdl_download");$("#mdl-dl-text").textContent="Failed: "+e.message;}
      });
    });
  }

  // Build grouped cards by tier
  function buildTieredList(filteredModels,downloadedModels){
    var tiers=[
      {key:"fast",label:t("mdl_tier_fast")},
      {key:"balanced",label:t("mdl_tier_balanced")},
      {key:"best",label:t("mdl_tier_best")}
    ];
    var html='';
    tiers.forEach(function(tier){
      var tierModels=filteredModels.filter(function(m){return m.tier===tier.key;});
      if(tierModels.length===0)return;
      html+='<div class="mdl-tier-group"><div class="mdl-tier-header">'+tier.label+'</div>';
      tierModels.forEach(function(m){
        var isInstalled=downloadedModels.some(function(d){return d.name===m.file;});
        html+=buildBrowseCard(m,isInstalled);
      });
      html+='</div>';
    });
    return html;
  }

  async function refreshModelsTab(){
    status=await window.api.getSetupStatus();
    var dl=status.downloadedModels||[];

    // Installed tab
    var list=$("#models-list");
    if(dl.length===0){
      list.innerHTML='<p style="color:var(--muted);font-size:13px;">'+t("no_models")+'</p>';
    } else {
      list.innerHTML=dl.map(buildInstalledCard).join("");
      list.querySelectorAll("[data-del]").forEach(function(b){
        b.addEventListener("click",async function(){
          await window.api.deleteModel(b.getAttribute("data-del"));
          refreshModelsTab();refreshModelSelect();
        });
      });
    }

    // All models tab (grouped by tier)
    var allContainer=$("#models-avail-all");
    allContainer.innerHTML=buildTieredList(models,dl);
    attachDownloadHandlers(allContainer);

    // Multilingual tab
    var multiModels=models.filter(function(m){return m.lang==="multi";});
    var multiContainer=$("#models-avail-multi");
    multiContainer.innerHTML=buildTieredList(multiModels,dl);
    attachDownloadHandlers(multiContainer);

    // English tab
    var enModels=models.filter(function(m){return m.lang==="en";});
    var enContainer=$("#models-avail-english");
    enContainer.innerHTML=buildTieredList(enModels,dl);
    attachDownloadHandlers(enContainer);
  }

