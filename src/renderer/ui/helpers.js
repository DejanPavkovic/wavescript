  // ═══ HELPERS ═══
  function showMsg(id,type,msg){var el=$("#"+id);el.className="status show "+type;el.innerHTML="<span>"+msg+"</span>";var x=document.createElement("span");x.className="status-close";x.textContent="\u2715";x.addEventListener("click",function(){hideMsg(id);});el.appendChild(x);}
  function hideMsg(id){var el=$("#"+id);el.className="status";el.innerHTML="";}

  // ═══ RESULT SEARCH (popup bar with navigation) ═══
  function setupResultSearch(prefix) {
    var resultBox = $("#" + prefix + "-result-text");
    var resultCard = resultBox.closest(".card");
    var originalText = "";
    var currentIdx = -1;
    var matchCount = 0;

    // Create the search bar element
    var bar = document.createElement("div");
    bar.className = "result-search-bar";
    bar.id = prefix + "-search-bar";
    bar.innerHTML = '<input type="text" data-i18n-placeholder="search_placeholder" placeholder="' + t("search_placeholder") + '" />'
      + '<span class="search-count"></span>'
      + '<div class="search-nav">'
      + '<button class="search-up" title="' + t("back") + '">\u2191</button>'
      + '<button class="search-down" title="' + t("continue") + '">\u2193</button>'
      + '</div>'
      + '<button class="search-close">\u2715</button>';
    resultBox.parentNode.insertBefore(bar, resultBox);

    var input = bar.querySelector("input");
    var countEl = bar.querySelector(".search-count");
    var upBtn = bar.querySelector(".search-up");
    var downBtn = bar.querySelector(".search-down");
    var closeBtn = bar.querySelector(".search-close");

    // Toggle open/close
    $$(".result-search-toggle[data-target='" + prefix + "']").forEach(function(btn) {
      btn.addEventListener("click", function() {
        if (bar.classList.contains("open")) {
          closeSearch();
        } else {
          bar.classList.add("open");
          input.focus();
        }
      });
    });

    function closeSearch() {
      bar.classList.remove("open");
      input.value = "";
      countEl.textContent = "";
      currentIdx = -1;
      matchCount = 0;
      if (originalText) resultBox.textContent = originalText;
    }

    closeBtn.addEventListener("click", closeSearch);

    // Store original text when content changes
    var observer = new MutationObserver(function() {
      if (!input.value) originalText = resultBox.textContent;
    });
    observer.observe(resultBox, { childList: true, characterData: true, subtree: true });

    function doSearch() {
      var query = input.value.trim();
      if (!originalText) originalText = resultBox.textContent;
      if (!query) {
        resultBox.textContent = originalText;
        countEl.textContent = "";
        currentIdx = -1;
        matchCount = 0;
        return;
      }
      var text = originalText;
      var escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      var regex = new RegExp("(" + escaped + ")", "gi");
      var matches = text.match(regex);
      matchCount = matches ? matches.length : 0;
      currentIdx = matchCount > 0 ? 0 : -1;
      highlightMatches(text, regex);
    }

    function highlightMatches(text, regex) {
      var safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      var idx = 0;
      var html = safe.replace(regex, function(m) {
        var cls = "search-highlight" + (idx === currentIdx ? " active" : "");
        idx++;
        return '<span class="' + cls + '">' + m + '</span>';
      });
      resultBox.innerHTML = html;
      countEl.textContent = matchCount > 0 ? (currentIdx + 1) + " / " + matchCount : "0";
      // Scroll active match into view
      var active = resultBox.querySelector(".search-highlight.active");
      if (active) active.scrollIntoView({ block: "center", behavior: "smooth" });
    }

    input.addEventListener("input", doSearch);
    input.addEventListener("keydown", function(e) {
      if (e.key === "Enter") { e.shiftKey ? navUp() : navDown(); e.preventDefault(); }
      if (e.key === "Escape") closeSearch();
    });

    function navDown() {
      if (matchCount === 0) return;
      currentIdx = (currentIdx + 1) % matchCount;
      var escaped = input.value.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      highlightMatches(originalText, new RegExp("(" + escaped + ")", "gi"));
    }
    function navUp() {
      if (matchCount === 0) return;
      currentIdx = (currentIdx - 1 + matchCount) % matchCount;
      var escaped = input.value.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      highlightMatches(originalText, new RegExp("(" + escaped + ")", "gi"));
    }

    upBtn.addEventListener("click", navUp);
    downBtn.addEventListener("click", navDown);
  }

  setupResultSearch("tr");
  setupResultSearch("tl");

