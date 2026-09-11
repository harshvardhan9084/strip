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

  // Per-theme manifest (Round 13): an installed PWA's window chrome reads the
  // manifest's theme_color at launch, which was hardcoded to amber — green/violet
  // players got an amber titlebar around a green console. We swap the manifest
  // <link> to a recolored object-URL copy whenever a non-default skin is active.
  // The static manifest.json stays the fallback for the default amber theme.
  let staticManifest = null;   // parsed cache of manifest.json
  let manifestBlobURL = null;  // the copy we currently own (revoked on change)

  function applyManifestTheme(theme){
    const link = document.querySelector('link[rel="manifest"]');
    if(!link) return;
    const origHref = link.dataset.origHref || link.getAttribute("href");

    if(theme === "amber" || !THEME_META_COLORS[theme]){
      // default skin: restore the real manifest so install semantics stay
      // 100% conventional (same-origin file, stable id resolution)
      if(manifestBlobURL){ URL.revokeObjectURL(manifestBlobURL); manifestBlobURL = null; }
      if(link.href !== origHref) link.href = origHref;
      return;
    }

    link.dataset.origHref = origHref;
    const bg = THEME_META_COLORS[theme];
    const ready = staticManifest
      ? Promise.resolve(staticManifest)
      : fetch(origHref).then(r => r.json()).then(j => { staticManifest = j; return j; });
    ready.then(j => {
      // id/start_url/scope must be ABSOLUTE here: relative URLs in an object-URL
      // manifest resolve against blob:... which would corrupt the app identity
      const abs = (v) => new URL(v || "./", location.href).toString();
      const patched = Object.assign({}, j, {
        id: abs(j.start_url),
        start_url: abs(j.start_url),
        scope: abs(j.scope),
        theme_color: bg,
        background_color: bg,
      });
      const url = URL.createObjectURL(new Blob([JSON.stringify(patched)], { type: "application/manifest+json" }));
      if(manifestBlobURL) URL.revokeObjectURL(manifestBlobURL);
      manifestBlobURL = url;
      link.href = url;
    }).catch(() => { /* offline first run: keep the static manifest */ });
  }

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
    applyManifestTheme(theme);
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
