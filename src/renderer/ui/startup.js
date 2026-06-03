  // ═══ STARTUP — runs after all modules are loaded ═══
  var isSetup = status.whisperReady && status.modelReady && status.deeplReady;
  if (isSetup && !settings._forceWizard) { showMain(); } else { showWizard(); }
  applyI18n();
