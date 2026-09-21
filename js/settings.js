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
    // Round 26 — the marker that separates an EXPLICIT motion choice from a
    // passive default.reduceMotion: false in a save used to be ambiguous
    // ("they chose it" vs "they never opened settings"), so the OS-level
    // prefers-reduced-motion signal could never be honored honestly. From
    // v4: toggling the control records reduceMotionChosen:true and the
    // migration adopts the OS preference exactly once for everyone else.
    reduceMotionChosen: false,
    haptics: true,
    sound: true,
    // Round 21: ICE is the new default skin. A one-time migration below
    // moves legacy players whose stored settings still say "amber" — but
    // only if they never explicitly re-picked a skin after the migration
    // (settingsVersion gates that). "amber" | "green" | "violet" | "ice".
    theme: "ice",
    settingsVersion: 3,
    dailyNudge: false, // Round 14: opt-in local notification on the day flip
    // Round 20 — controls & feel:
    volume: 0.8,          // master loudness 0..1 (Feedback master gain)
    hapticStrength: "normal", // "light" | "normal" | "strong"
    navArrows: true,      // on-screen ▲▼ jump buttons on the strip edges
    // Round 24 — COLOR SCHEME: the axis the old bg-texture setting grew into.
    // The skin picks the phosphor COLOR; this picks what the console CHASSIS
    // is made of: "dark" (classic glow) | "oled" (true black) | "light"
    // (paper daylight terminal). Validated on apply — unknown degrades to dark.
    colorMode: "dark",
    // Round 24 — more controls:
    crtEffects: true,     // scanline overlay + boot flicker (motion stays; that's reduceMotion's job)
    leftHanded: false,    // nav arrows flip to the left edge (thumb-zone choice)
    uiSounds: true,       // shell clicks/chimes (menus, arrows) — game audio stays on "Sound"
    wakeLock: false,      // keep the screen awake during play sessions (Wake Lock API)
    // Round 25 — SCREEN GLOW: "full" | "soft" | "off". The bloom multiplier
    // (--glow-mul) re-grades every glow at once; off = flat terminal.
    glow: "full",
    // Round 35 — ACCESS (the audit's settings wave):
    textSize: "m",        // "s" | "m" | "l" — re-grades the stat-row dust
    colorblind: false,    // shapes ride color-only signals (pads/dots/discs)
    flashSafe: false,     // caps glow bloom + momentary flashes (photosensitivity)
    // Round 35 — SCREEN: auto night chassis. When on, the color scheme
    // follows the local clock (19:00–07:00 → dark chassis); a manual scheme
    // pick turns it off so the two writers never fight.
    autoNight: false,
  };

  const THEME_META_COLORS = {
    ice:    "#070B12",
    amber:  "#0B0B0F",
    green:  "#090F0B",
    violet: "#0E0A14",
  };
  // Round 24 — browser-chrome colors per color scheme. DARK keeps the per-skin
  // chassis colors; OLED is true black; LIGHT is the paper chassis (the same
  // value for every skin — the phosphor lives INSIDE the screen, the chrome
  // follows the chassis).
  const MODE_META_COLORS = {
    dark:  null,          // falls through to THEME_META_COLORS[theme]
    oled:  "#000000",
    light: "#F1EEE7",
  };
  const THEME_MODES = ["dark", "oled", "light"];
  // localStorage mirror of just the theme key — IndexedDB hydrates async, which
  // meant green/violet users saw an amber flash on every cold boot. The inline
  // <head> script in index.html reads this synchronously before first paint.
  const THEME_LS_KEY = "strip-theme";
  // Round 24 — same pre-paint mirror for the color scheme axis.
  const MODE_LS_KEY = "strip-mode";

  // Per-theme manifest (Round 13): an installed PWA's window chrome reads the
  // manifest's theme_color at launch, which was hardcoded to amber — green/violet
  // players got an amber titlebar around a green console. We swap the manifest
  // <link> to a recolored object-URL copy whenever a non-default skin is active.
  // The static manifest.json stays the fallback for the default amber theme.
  let staticManifest = null;   // parsed cache of manifest.json
  let manifestBlobURL = null;  // the copy we currently own (revoked on change)

  function applyManifestTheme(theme, mode){
    const link = document.querySelector('link[rel="manifest"]');
    if(!link) return;
    const origHref = link.dataset.origHref || link.getAttribute("href");

    // Round 24: the chrome color is now mode-aware. DARK uses the per-skin
    // chassis color; LIGHT/OLED use their own (skin-independent) chassis.
    if(mode === "dark" && (theme === "ice" || !THEME_META_COLORS[theme])){
      // default skin+scheme: restore the real manifest so install semantics stay
      // 100% conventional (same-origin file, stable id resolution).
      // Round 21: the default is ICE now, and the static manifest.json ships
      // ICE's theme_color to match.
      if(manifestBlobURL){ URL.revokeObjectURL(manifestBlobURL); manifestBlobURL = null; }
      if(link.getAttribute("href") !== origHref) link.href = origHref;
      return;
    }

    link.dataset.origHref = origHref;
    const bg = mode === "dark" ? THEME_META_COLORS[theme] : MODE_META_COLORS[mode];
    const ready = staticManifest
      ? Promise.resolve(staticManifest)
      : fetch(origHref).then(r => r.json()).then(j => { staticManifest = j; return j; });
    ready.then(j => {
      // EVERY URL in a blob manifest must be absolute: relative members resolve
      // against blob:... which (a) corrupts app identity for id/start_url/scope
      // and (b) THROWS for icons[].src — a thrown icon URL drops the icon, and
      // without the 192+512 icons Chromium refuses to fire beforeinstallprompt
      // at all (Round 13 critic, MAJOR-1: install silently broke for 2/3 skins)
      const abs = (v) => new URL(v || "./", location.href).toString();
      const patched = Object.assign({}, j, {
        id: abs(j.start_url),
        start_url: abs(j.start_url),
        scope: abs(j.scope),
        theme_color: bg,
        background_color: bg,
        icons: (j.icons || []).map(i => Object.assign({}, i, { src: abs(i.src) })),
      });
      if(Array.isArray(j.screenshots)){
        patched.screenshots = j.screenshots.map(s => Object.assign({}, s, { src: abs(s.src) }));
      }
      const url = URL.createObjectURL(new Blob([JSON.stringify(patched)], { type: "application/manifest+json" }));
      if(manifestBlobURL) URL.revokeObjectURL(manifestBlobURL);
      manifestBlobURL = url;
      link.href = url;
    }).catch(() => { /* offline first run: keep the static manifest */ });
  }

  let current = Object.assign({}, DEFAULTS);
  let listeners = [];
  // Round 33 — tracks the last applied chassis so the daylight-screen event
  // below only fires on a REAL mode flip (not on every boot re-apply).
  let lastAppliedMode = null;
  let ready = false;
  let readyResolve;
  const readyPromise = new Promise(res => { readyResolve = res; });

  function applyToDocument(){
    document.documentElement.classList.toggle("reduce-motion", !!current.reduceMotion);
    document.documentElement.classList.toggle("scroll-locked", !!current.lockScroll);
    document.documentElement.classList.toggle("left-handed", !!current.leftHanded);
    // CRT skin: one attribute swap re-tints every glow/veil via the --*-rgb
    // custom properties; the browser UI chrome follows via theme-color meta.
    const theme = THEME_META_COLORS[current.theme] ? current.theme : "ice";
    document.documentElement.dataset.theme = theme;
    // Round 24 — color scheme (chassis axis): validated, then one attribute
    // swap re-builds every chassis channel via the CSS mode engine.
    const mode = THEME_MODES.includes(current.colorMode) ? current.colorMode : "dark";
    document.documentElement.dataset.mode = mode;
    // Round 33 — DAYLIGHT SCREENS handoff: canvas cartridges can't follow a
    // chassis flip through CSS alone (their fills are resolved strings, not
    // var()), so they re-resolve --screen* tokens when this fires. DOM
    // surfaces re-grade themselves through the same tokens; nothing else in
    // the shell listens, and a boot re-apply of the SAME mode stays silent.
    if(lastAppliedMode !== null && lastAppliedMode !== mode){
      try{ window.dispatchEvent(new CustomEvent("strip:mode-changed", { detail: { mode } })); }catch(e){}
    }
    lastAppliedMode = mode;
    const meta = document.querySelector('meta[name="theme-color"]');
    const chrome = mode === "dark" ? THEME_META_COLORS[theme] : MODE_META_COLORS[mode];
    if(meta && chrome) meta.setAttribute("content", chrome);
    // Round 24 — CRT effects dial: scanlines + boot flicker (motion elsewhere
    // is reduceMotion's job — two honest, separate switches).
    document.documentElement.dataset.crt = current.crtEffects === false ? "off" : "on";
    // Round 25 — screen glow dial: one attribute swap re-grades every glow
    // through --glow-mul (1 / .35 / 0). Unknown values degrade to full.
    document.documentElement.dataset.glow = ["full", "soft", "off"].includes(current.glow) ? current.glow : "full";
    // Round 35 — ACCESS dials. Colorblind symbols + flash reduction ride one
    // class each (pure CSS re-grades, live on toggle); text size sets the
    // attribute for CSS-owned sizes AND runs the inline-style pass below.
    document.documentElement.classList.toggle("cb-symbols", !!current.colorblind);
    document.documentElement.classList.toggle("flash-safe", !!current.flashSafe);
    applyTextScale();
    applyManifestTheme(theme, mode);
    try{ localStorage.setItem(THEME_LS_KEY, theme); }catch(e){}
    try{ localStorage.setItem(MODE_LS_KEY, mode); }catch(e){}
    applyWakeLock();
    applyAutoNight();
  }

  // Round 35 — TEXT SIZE. Two halves, because the deck's type lives in two
  // places: CSS-owned sizes (.cart-hint, setting descriptions…) re-grade
  // through html[data-text-size] attribute selectors; game-owned sizes are
  // INLINE styles, which CSS cannot override — so those get a DOM pass.
  // The pass is IDEMPOTENT: the first touch records the base value in
  // data-fs0, every later pass re-derives from that base, so toggling
  // S→L→S round-trips exactly. Only the 8–12px "dust zone" moves (the
  // audit's #1 accessibility debt); body text at 13px+ is untouched.
  function applyTextScale(scope){
    const t = ["s", "m", "l"].includes(current.textSize) ? current.textSize : "m";
    document.documentElement.dataset.textSize = t;
    const root = scope || document;
    const nodes = root.querySelectorAll('.cart-body [style*="font-size"], .cart-body[style*="font-size"]');
    if(t === "m"){
      // the default look is the shipped look — but elements a previous L/S
      // pass bumped must be RESTORED to their pinned base, not left stranded
      nodes.forEach(el => {
        if(el.dataset.fs0 !== undefined) el.style.fontSize = el.dataset.fs0 + "px";
      });
      return;
    }
    const delta = t === "l" ? 2 : -1;
    nodes.forEach(el => {
      if(el.dataset.fs0 === undefined){
        const v = parseFloat(el.style.fontSize);
        if(!Number.isFinite(v)) return;
        el.dataset.fs0 = String(v);
      }
      const base = parseFloat(el.dataset.fs0);
      if(base < 8 || base > 12) return; // the dust zone only
      el.style.fontSize = Math.min(14, Math.max(8, base + delta)) + "px";
    });
  }

  // Round 35 — AUTO NIGHT CHASSIS. When enabled, the color scheme follows
  // the local hour (19:00–07:00 → dark). The interval only ever writes when
  // the bucket CHANGES, so applyToDocument re-entrancy is bounded: set() →
  // applyToDocument → applyAutoNight finds the mode already applied and
  // stops. A manual scheme pick (settings-ui) clears autoNight — two
  // writers on one key is how settings sheets learn to lie.
  let nightTimer = null;
  function nightModeFor(d){ const h = d.getHours(); return (h >= 19 || h < 7) ? "dark" : "light"; }
  function applyAutoNight(){
    if(nightTimer){ clearInterval(nightTimer); nightTimer = null; }
    if(!current.autoNight) return;
    const wanted = nightModeFor(new Date());
    if(THEME_MODES.includes(wanted) && current.colorMode !== wanted) set({ colorMode: wanted });
    nightTimer = setInterval(() => {
      if(!current.autoNight){ if(nightTimer){ clearInterval(nightTimer); nightTimer = null; } return; }
      const w = nightModeFor(new Date());
      if(current.colorMode !== w) set({ colorMode: w });
    }, 10 * 60 * 1000);
  }
  document.addEventListener("visibilitychange", () => {
    if(!document.hidden && current.autoNight) applyAutoNight(); // re-check on return
  });

  // Round 24 — Wake Lock ("keep awake"). A screen that dims mid-run kills
  // the flow the whole deck is built on; the API is exactly one request()
  // away, so the control is real wherever the browser ships it and honestly
  // disabled where it doesn't (the settings panel reads the same support
  // check). The sentinel is re-acquired on every visibility flip — the
  // browser releases the lock whenever the tab is hidden, and the player
  // coming back should not have to re-toggle the setting.
  let wakeLockSentinel = null;
  async function applyWakeLock(){
    const wanted = !!current.wakeLock && "wakeLock" in navigator;
    try{
      if(wanted){
        if(!wakeLockSentinel){
          wakeLockSentinel = await navigator.wakeLock.request("screen");
          wakeLockSentinel.addEventListener("release", () => { wakeLockSentinel = null; });
        }
      } else if(wakeLockSentinel){
        await wakeLockSentinel.release().catch(() => {});
        wakeLockSentinel = null;
      }
    }catch(e){ wakeLockSentinel = null; }
  }
  document.addEventListener("visibilitychange", () => {
    if(!document.hidden) applyWakeLock();
  });
  function wakeLockSupported(){
    return "wakeLock" in navigator;
  }

  // Round 26 — settingsVersion 4: honor the OS. reduceMotion was opt-in
  // only; a player whose device asks for reduced motion (vestibular
  // disorders, OS-level accessibility setting) got the full animation
  // package anyway unless they happened to find the toggle. The migration
  // adopts the OS preference ONE TIME for players without an explicit
  // choice marker; an explicit choice — past (post-marker) or future —
  // always wins. Idempotent: v4 saves never re-migrate.
  function migrateV4(current, osReduce){
    if((current.settingsVersion || 0) < 4 && !current.reduceMotionChosen){
      current.reduceMotion = !!osReduce;
    }
    current.settingsVersion = 4;
    return current;
  }

  async function hydrate(){
    let saved = null;
    try{ saved = await StripDB.loadState(SETTINGS_ID); }catch(e){}
    current = Object.assign({}, DEFAULTS, saved || {});
    // Round 21 — one-time ICE migration. Every pre-R21 save either lacks
    // settingsVersion or has version 1, and its theme is whatever the old
    // DEFAULTS spread wrote ("amber") — a passive default, not a choice.
    // Those players wake up to the new ICE console. A deliberate green or
    // violet pick is untouched, and from now on any explicit re-pick (even
    // back to AMBER) persists with settingsVersion 2 and always wins.
    if((current.settingsVersion || 0) < 2 && current.theme === "amber"){
      current.theme = "ice";
    }
    // Round 24 — the bg-texture axis is RETIRED (players read it as noise;
    // the meaningful version of "background" is the color scheme). Migration
    // 3 strips the dead key from every save and clears the old pre-paint
    // mirror so no stale data-bg attribute can resurface, then seeds the
    // new axis at its default. One-way: version 3 saves never re-migrate.
    if((current.settingsVersion || 0) < 3){
      delete current.bgStyle;
      try{ localStorage.removeItem("strip-bg"); }catch(e){}
      document.documentElement.removeAttribute("data-bg");
      current.colorMode = DEFAULTS.colorMode;
    }
    current.settingsVersion = 3;
    migrateV4(current, !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches));
    ready = true;
    applyToDocument();
    readyResolve();
    // persist the migration so it never re-runs (fire-and-forget: a failed
    // write just means the migration re-runs next boot, which is idempotent)
    StripDB.saveState(SETTINGS_ID, current).catch(()=>{});
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

  return { get, set, onChange, whenReady, wakeLockSupported, applyTextScale, _internals: { migrateV4, DEFAULTS } };
})();
