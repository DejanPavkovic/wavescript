  var $ = function(s){ return document.querySelector(s); };
  var $$ = function(s){ return document.querySelectorAll(s); };
  var settings = {}, status = {}, models = [], selModel = "base";

  try { settings = (await window.api.loadSettings()) || {}; } catch(e){}
  try { status = (await window.api.getSetupStatus()) || {}; } catch(e){}
  try { models = (await window.api.getAvailableModels()) || []; } catch(e){}

