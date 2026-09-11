/**
 * STRIP — Settings
 * ----------------
 * App-level preferences, separate from per-game save data. Persisted via the
 * same StripDB "state" store under a reserved id ("__app_settings__") that
 * can never collide with a game id (all game ids are plain lowercase words).
 *
 * Other code reads current settings synchronously via Settings.get() (backed
 * by an in-memory cache that's hydrated once at boot, before the UI needs it)
 * and reacts to live changes via Settings.onChange(fn). This keeps games and
 * app.js decoupled from the panel UI itself.
 */
window.Settings = (function(){
  const SETTINGS_ID = "__app_settings__";

  const DEFAULTS = {
    lockScroll: false,
    reduceMotion: false,
    haptics: true,
    sound: true,
    theme: "amber",   // "amber" | "green" | "violet" — CRT skin engine (Round 11)
  };

  const THEME_META_COLORS = {
    amber:  "#0B0B0F",
    green:  "#090F0B",
    violet: "#0E0A14",
  };
  // localStorage mirror of just the theme key — IndexedDB hydrates async, which
  // meant green/violet users saw an amber flash on every cold boot. The inline
  // <head> script in index.html reads this synchronously before first paint.
  const THEME_LS_KEY = "strip-theme";

  let current = Object.assign({}, DEFAULTS);
  let listeners = [];
  let ready = false;
  let readyResolve;
  const readyPromise = new Promise(res => { readyResolve = res; });

  function applyToDocument(){
    document.documentElement.classList.toggle("reduce-motion", !!current.reduceMotion);
    document.documentElement.classList.toggle("scroll-locked", !!current.lockScroll);
    // CRT skin: one attribute swap re-tints every glow/veil via the --*-rgb
    // custom properties; the browser UI chrome follows via theme-color meta.
    const theme = THEME_META_COLORS[current.theme] ? current.theme : "amber";
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if(meta) meta.setAttribute("content", THEME_META_COLORS[theme]);
    try{ localStorage.setItem(THEME_LS_KEY, theme); }catch(e){}
  }

  async function hydrate(){
    let saved = null;
    try{ saved = await StripDB.loadState(SETTINGS_ID); }catch(e){}
    current = Object.assign({}, DEFAULTS, saved || {});
    ready = true;
    applyToDocument();
    readyResolve();
  }

  function get(){
    return Object.assign({}, current); // copy, so callers can't mutate our internal state directly
  }

  function set(patch){
    current = Object.assign({}, current, patch);
    applyToDocument();
    StripDB.saveState(SETTINGS_ID, current);
    listeners.forEach(fn => {
      try{ fn(get()); }catch(e){ console.error("Settings listener error", e); }
    });
  }

  function onChange(fn){
    listeners.push(fn);
    return () => { listeners = listeners.filter(f => f !== fn); };
  }

  function whenReady(){
    return readyPromise;
  }

  hydrate();

  return { get, set, onChange, whenReady };
})();
