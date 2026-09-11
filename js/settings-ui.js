(function(){
  const overlay = document.getElementById("settings-overlay");
  const openBtn = document.getElementById("settings-btn");
  const closeBtn = document.getElementById("settings-close");
  const toggles = Array.from(document.querySelectorAll(".setting-toggle"));
  const clearBtn = document.getElementById("clear-progress-btn");
  const lockBtn = document.getElementById("lock-btn");
  const lockToast = document.getElementById("lock-toast");
  const themeBtns = Array.from(document.querySelectorAll(".theme-seg-btn"));

  function openPanel(){
    overlay.classList.add("show");
  }
  function closePanel(){
    overlay.classList.remove("show");
  }

  openBtn.addEventListener("click", openPanel);
  closeBtn.addEventListener("click", closePanel);
  overlay.addEventListener("click", (e) => { if(e.target === overlay) closePanel(); });

  function syncToggles(settings){
    toggles.forEach(t => { t.checked = !!settings[t.dataset.key]; });
    lockBtn.setAttribute("aria-pressed", settings.lockScroll ? "true" : "false");
  }

  toggles.forEach(t => {
    t.addEventListener("change", () => {
      Settings.set({ [t.dataset.key]: t.checked });
    });
  });

  // CRT skin picker — one settings key, instant repaint via html[data-theme]
  function syncThemeBtns(settings){
    themeBtns.forEach(b => {
      b.setAttribute("aria-pressed", settings.theme === b.dataset.themeValue ? "true" : "false");
    });
  }
  themeBtns.forEach(b => {
    b.addEventListener("click", () => {
      if(Settings.get().theme === b.dataset.themeValue) return;
      Settings.set({ theme: b.dataset.themeValue });
      Feedback.tone("toggle");
      Feedback.haptic("light");
    });
  });

  let toastTimer = null;
  function showLockToast(locked){
    lockToast.textContent = locked ? "Scroll locked" : "Scroll unlocked";
    lockToast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => lockToast.classList.remove("show"), 1400);
  }

  lockBtn.addEventListener("click", () => {
    const next = !Settings.get().lockScroll;
    Settings.set({ lockScroll: next });
    showLockToast(next);
    Feedback.haptic("light");
  });

  clearBtn.addEventListener("click", () => {
    if(!confirm("Erase all game progress and highscores? This can't be undone.")) return;
    StripDB.clearAll().then(() => {
      clearBtn.textContent = "Cleared ✓";
      // Idle games (garden, aquarium, anthill, tradingpost, kingdom...) re-persist
      // their full state from memory on unmount/autosave, which would silently
      // resurrect everything this button just erased. Reloading is the only airtight
      // way to drop every mounted game's in-memory state.
      setTimeout(() => location.reload(), 700);
    });
  });

  // reflect settings changes made anywhere (e.g. the lock button) back into the panel toggles
  Settings.onChange((s) => { syncToggles(s); syncThemeBtns(s); });
  Settings.whenReady().then(() => { const s = Settings.get(); syncToggles(s); syncThemeBtns(s); });
})();
