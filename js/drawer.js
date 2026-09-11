/**
 * STRIP — Cartridge Drawer
 * ------------------------
 * At 41 cartridges blind scrolling was tolerable; at 50 (and growing) it
 * isn't. The drawer is the deck's table of contents:
 *   - every cartridge, grouped by category
 *   - FAVORITES pinned first (persisted, per device)
 *   - RECENT most-recently-played (persisted, max 8)
 *   - text filter across titles
 *   - tap a cartridge to jump the strip straight to it
 *
 * Data lives in the same IndexedDB store games use, under "__deck_meta__".
 */
(function(){
  const META_ID = "__deck_meta__";
  const RECENTS_MAX = 8;

  let favorites = new Set();
  let recents = [];

  // ---------- persistence ----------
  async function loadMeta(){
    try{
      const data = await StripDB.loadState(META_ID);
      if(data && Array.isArray(data.favorites)) favorites = new Set(data.favorites);
      if(data && Array.isArray(data.recents)) recents = data.recents.slice(0, RECENTS_MAX);
    }catch(e){}
  }
  function saveMeta(){
    StripDB.saveState(META_ID, { favorites: [...favorites], recents }).catch(()=>{});
  }

  // ---------- recents tracking ----------
  window.addEventListener("strip:card-centered", (e) => {
    const id = e.detail && e.detail.id;
    if(!id) return;
    recents = [id, ...recents.filter(r => r !== id)].slice(0, RECENTS_MAX);
    saveMeta();
  }, { passive:true });

  // ---------- overlay ----------
  let overlay, panel, filterInput, grid;
  function ensureDom(){
    if(overlay) return;
    overlay = document.createElement("div");
    overlay.id = "drawer-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "All cartridges");
    overlay.innerHTML = `
      <div id="drawer-panel">
        <div class="drawer-header">
          <div class="drawer-title">CARTRIDGES</div>
          <button id="drawer-close" aria-label="Close cartridge list">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <input id="drawer-filter" type="search" placeholder="Filter cartridges…" aria-label="Filter cartridges" autocomplete="off">
        <div id="drawer-grid" role="list"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    panel = overlay.querySelector("#drawer-panel");
    filterInput = overlay.querySelector("#drawer-filter");
    grid = overlay.querySelector("#drawer-grid");

    overlay.querySelector("#drawer-close").addEventListener("click", close);
    overlay.addEventListener("click", (e) => { if(e.target === overlay) close(); });
    filterInput.addEventListener("input", () => renderGrid());
    window.addEventListener("keydown", (e) => { if(e.key === "Escape" && overlay.classList.contains("open")) close(); });
  }

  function close(){
    if(!overlay) return;
    overlay.classList.remove("open");
    // dialog parity: hand focus back to the HUD button that opened us
    requestAnimationFrame(() => {
      const btn = document.getElementById("drawer-btn");
      if(btn && btn.focus) btn.focus({ preventScroll: true });
    });
  }
  function open(){
    ensureDom();
    renderGrid();
    overlay.classList.add("open");
    try{ filterInput.value = ""; }catch(e){}
    // dialog parity: move focus into the sheet (filter first — it's the main
    // tool). Deferred one frame: the overlay is still visibility:hidden at
    // classList.add time (fade-in transition just started), and focus() on a
    // hidden element is silently dropped.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      filterInput.focus({ preventScroll: true });
    }));
  }
  function isOpen(){ return overlay && overlay.classList.contains("open"); }

  // ---------- grid ----------
  // Row anatomy (Round 12 fix): the row is a <div> containing TWO real buttons —
  // the main jump area and a favorite toggle. The old single-<button> + span
  // design gated the fav toggle on `e.target === star`, which keyboard
  // activation can never satisfy (Enter fires the button itself as target), so
  // favorites — and therefore the CURATOR trophy — were pointer-only.
  function itemFor(mod){
    const fav = favorites.has(mod.id);
    const b = document.createElement("div");
    b.className = "drawer-item";
    b.setAttribute("role", "listitem");
    // category spine (CSS keys off data-cat for the colored left bar)
    b.dataset.cat = (mod.label || "STRIP").toUpperCase();

    const main = document.createElement("button");
    main.className = "drawer-item-main";
    main.type = "button";
    main.setAttribute("aria-label", "Jump to " + (mod.title || mod.id));
    const label = document.createElement("span");
    label.className = "drawer-item-label";
    label.textContent = mod.label || "STRIP";
    const title = document.createElement("span");
    title.className = "drawer-item-title";
    title.textContent = mod.title || mod.id;
    // explored marker — Trophy Case keeps the visited set; purely cosmetic here.
    // Lazy per-render check: renderGrid() runs on every drawer open, so the dot
    // reflects hydration state at open time, not at script-load time.
    const visited = document.createElement("span");
    visited.className = "drawer-item-visited";
    visited.title = "Explored";
    try{
      if(window.Trophies && Trophies.isVisited && Trophies.isVisited(mod.id)) visited.classList.add("on");
    }catch(e){}
    main.appendChild(label);
    main.appendChild(title);
    main.appendChild(visited);
    main.addEventListener("click", () => {
      close();
      StripShell.jumpToModule(mod);
    });

    const star = document.createElement("button");
    star.className = "drawer-item-fav" + (fav ? " on" : "");
    star.type = "button";
    star.textContent = fav ? "★" : "☆";
    syncStar(star, mod, fav);
    star.addEventListener("click", () => {
      // toggle favorite without jumping
      const nowFav = !favorites.has(mod.id);
      if(nowFav) favorites.add(mod.id); else favorites.delete(mod.id);
      saveMeta();
      // Trophy Case (and anything else) listens for this to track the
      // CURATOR trophy — carry the fresh count so no extra read is needed
      window.dispatchEvent(new CustomEvent("strip:fav-changed", {
        detail: { id: mod.id, fav: nowFav, count: favorites.size }
      }));
      syncStar(star, mod, nowFav);
      // re-trigger the pop on the live node instead of re-rendering the grid
      // (re-render would steal focus from the button a keyboard user is on)
      star.classList.remove("pop");
      void star.offsetWidth; // restart the animation
      star.classList.add("pop");
      Feedback.haptic("light");
    });

    b.appendChild(main);
    b.appendChild(star);
    return b;
  }

  function syncStar(star, mod, fav){
    star.classList.toggle("on", fav);
    star.textContent = fav ? "★" : "☆";
    star.setAttribute("aria-pressed", fav ? "true" : "false");
    star.setAttribute("aria-label", (fav ? "Unpin " : "Pin ") + (mod.title || mod.id) + (fav ? " from favorites" : " to favorites"));
  }

  function renderGrid(){
    const mods = Strip.all();
    const q = (filterInput.value || "").trim().toLowerCase();
    const match = (m) => !q || (m.title || "").toLowerCase().includes(q) || (m.id || "").includes(q) || (m.label || "").toLowerCase().includes(q);

    grid.innerHTML = "";
    const frag = document.createDocumentFragment();

    const favMods = mods.filter(m => favorites.has(m.id) && match(m));
    const recentMods = recents.map(id => mods.find(m => m.id === id)).filter(m => m && !favorites.has(m.id) && match(m));
    const rest = mods.filter(m => !favorites.has(m.id) && !recents.includes(m.id) && match(m));

    const section = (name, list) => {
      if(!list.length) return;
      const h = document.createElement("div");
      h.className = "drawer-group-label";
      h.textContent = name;
      frag.appendChild(h);
      list.forEach(m => frag.appendChild(itemFor(m)));
    };

    section(favMods.length ? "FAVORITES" : "", favMods);
    section(recentMods.length ? "RECENT" : "", recentMods);
    const groups = new Map();
    rest.forEach(m => {
      const k = m.label || "STRIP";
      if(!groups.has(k)) groups.set(k, []);
      groups.get(k).push(m);
    });
    [...groups.keys()].sort().forEach(k => section(k, groups.get(k)));

    if(!frag.childNodes.length){
      const empty = document.createElement("div");
      empty.className = "drawer-empty";
      empty.textContent = "No cartridge matches that filter.";
      frag.appendChild(empty);
    }
    grid.appendChild(frag);
  }

  // ---------- first-run hint ----------
  function maybeShowHint(){
    if(Settings.get().hintSeen) return;
    const hint = document.createElement("div");
    hint.id = "hint-overlay";
    hint.innerHTML = `
      <div id="hint-card">
        <div id="hint-line1">Scroll to explore ${Strip.all().length} cartridges</div>
        <div id="hint-line2">Tap the grid to browse · ☆ a game to pin it here</div>
        <div id="hint-tap">tap anywhere to start</div>
      </div>
    `;
    document.body.appendChild(hint);
    const dismiss = () => {
      hint.remove();
      Settings.set({ hintSeen: true });
      window.removeEventListener("scroll", dismiss, true);
    };
    hint.addEventListener("pointerdown", dismiss);
    window.addEventListener("scroll", dismiss, { capture:true, once:true, passive:true });
  }

  // ---------- boot ----------
  async function init(){
    await Settings.whenReady();
    await loadMeta();
    const btn = document.getElementById("drawer-btn");
    if(btn) btn.addEventListener("click", () => { isOpen() ? close() : open(); });
    maybeShowHint();
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
