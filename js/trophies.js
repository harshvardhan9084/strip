/**
 * STRIP — Trophy Case
 * -------------------
 * Shell-level achievements that reward *exploring the deck* rather than any
 * single game. Everything is derived from observable shell events, so no game
 * needed to change:
 *
 *   strip:card-centered  -> fired by app.js when the strip settles on a card
 *   strip:fav-changed    -> fired by drawer.js when a favorite is toggled
 *
 * Data persists under the reserved id "__trophies__" in the same IndexedDB
 * store games use (reserved "__" prefix can never collide with a game id).
 *
 * Public API (window.Trophies):
 *   whenReady()        -> Promise (state hydrated)
 *   getVisitedCount()  -> number of distinct cartridges explored
 *   hasUnseen()        -> true while an unlocked trophy hasn't been seen
 *   markSeen()         -> clear the unseen flag (called when panel opens)
 */
window.Trophies = (function(){
  const TROPHY_ID = "__trophies__";
  const VISITED_MAX = 200;

  // ---------- trophy definitions ----------
  // check(state, ctx) is re-evaluated after every relevant event; ctx carries
  // live lookups (favorites count, highscore check) that aren't persisted here.
  const DEFS = [
    { id:"first-spark", medal:"✦", name:"FIRST SPARK",
      desc:"Center your first cartridge. Every collection starts somewhere." },
    { id:"shelf-life", medal:"▤", name:"SHELF LIFE",
      desc:"Explore 10 different cartridges.", need:10, metric:"visited" },
    { id:"quarter-deck", medal:"▧", name:"QUARTER DECK",
      desc:"Explore 25 different cartridges.", need:25, metric:"visited" },
    { id:"half-century", medal:"◈", name:"HALF CENTURY",
      desc:"Explore all 50 cartridges. The full shelf.", need:50, metric:"visited" },
    { id:"curator", medal:"★", name:"CURATOR",
      desc:"Pin 5 cartridges as favorites.", need:5, metric:"favs" },
    { id:"marathon", medal:"⚡", name:"MARATHON",
      desc:"30 cartridge visits in a single day.", need:30, metric:"dayVisits" },
    { id:"night-shift", medal:"☾", name:"NIGHT SHIFT",
      desc:"Browse the deck between midnight and 5 AM. We won't tell." },
    { id:"record-breaker", medal:"♛", name:"RECORD BREAKER",
      desc:"Revisit a cartridge where you already hold a highscore." },
  ];

  // ---------- state ----------
  let state = {
    unlocked: {},          // trophyId -> unlock timestamp (ms)
    visited: [],           // distinct cartridge ids, insertion order
    visitsTotal: 0,
    dayVisits: {},         // "YYYY-MM-DD" -> visit count
    favCount: 0,           // hydrated from drawer meta, maintained via events
  };
  let seenCount = 0;       // how many unlocked trophies the panel has shown
  let readyResolve;
  const readyPromise = new Promise(res => { readyResolve = res; });

  function load(){
    return StripDB.loadState(TROPHY_ID).catch(() => null);
  }
  function persist(){
    StripDB.saveState(TROPHY_ID, state).catch(()=>{});
  }

  function dayKey(d){
    d = d || new Date();
    return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  }

  // ---------- unlock machinery ----------
  let toastQueue = [];
  let toastShowing = false;

  function showToast(def){
    toastQueue.push(def);
    if(!toastShowing) nextToast();
  }
  function nextToast(){
    const def = toastQueue.shift();
    if(!def){ toastShowing = false; return; }
    toastShowing = true;
    const medal = toastEl.querySelector(".trophy-toast-medal");
    const name = toastEl.querySelector(".trophy-toast-name");
    medal.textContent = def.medal;
    name.textContent = def.name;
    toastEl.classList.add("show");
    try{ Feedback.tone("win"); Feedback.haptic([12,40,12]); }catch(e){}
    setTimeout(() => {
      toastEl.classList.remove("show");
      setTimeout(nextToast, 350);
    }, 2400);
  }

  function evaluate(ctx){
    const newlyUnlocked = [];
    for(const def of DEFS){
      if(state.unlocked[def.id]) continue;
      let ok = false;
      if(def.id === "first-spark") ok = state.visited.length >= 1;
      else if(def.id === "night-shift"){
        const h = new Date().getHours();
        ok = h < 5;
      }
      else if(def.id === "record-breaker") ok = !!ctx.holdsRecord;
      else if(def.metric === "favs") ok = state.favCount >= def.need;
      else if(def.metric === "dayVisits") ok = (state.dayVisits[dayKey()] || 0) >= def.need;
      else if(def.metric === "visited") ok = state.visited.length >= def.need;
      if(ok){
        state.unlocked[def.id] = Date.now();
        newlyUnlocked.push(def);
      }
    }
    if(newlyUnlocked.length){
      persist();
      newlyUnlocked.forEach(showToast);
      updateBadge();
    }
  }

  function updateBadge(){
    if(!trophyBtn) return;
    const unseen = Object.keys(state.unlocked).length > seenCount;
    trophyBtn.classList.toggle("news", unseen);
  }

  // ---------- panel ----------
  let trophyBtn, overlay, panelEl, gridEl, subEl;

  function fmtDate(ts){
    const d = new Date(ts);
    return d.getFullYear() + "." + String(d.getMonth()+1).padStart(2,"0") + "." + String(d.getDate()).padStart(2,"0");
  }

  function renderGrid(){
    gridEl.innerHTML = "";
    const unlockedCount = Object.keys(state.unlocked).length;
    subEl.textContent = unlockedCount + " / " + DEFS.length + " unlocked · " +
      state.visited.length + "/50 cartridges explored · " + state.visitsTotal + " visits";
    for(const def of DEFS){
      const ts = state.unlocked[def.id];
      const item = document.createElement("div");
      item.className = "trophy-item" + (ts ? " unlocked" : "");
      const medal = document.createElement("div");
      medal.className = "trophy-medal";
      medal.textContent = def.medal;
      medal.setAttribute("aria-hidden", "true");
      const text = document.createElement("div");
      text.className = "trophy-text";
      const name = document.createElement("div");
      name.className = "trophy-name";
      name.textContent = def.name;
      const desc = document.createElement("div");
      desc.className = "trophy-desc";
      desc.textContent = ts ? def.desc : "??? — " + def.desc;
      text.appendChild(name); text.appendChild(desc);
      item.appendChild(medal); item.appendChild(text);
      if(ts){
        const date = document.createElement("div");
        date.className = "trophy-date";
        date.textContent = fmtDate(ts);
        item.appendChild(date);
      }
      gridEl.appendChild(item);
    }
    if(!DEFS.length){
      const empty = document.createElement("div");
      empty.className = "trophy-empty";
      empty.textContent = "No trophies defined.";
      gridEl.appendChild(empty);
    }
  }

  function buildPanel(){
    overlay = document.createElement("div");
    overlay.id = "trophy-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Trophy case");
    overlay.innerHTML =
      '<div id="trophy-panel">' +
        '<div class="trophy-header">' +
          '<div class="trophy-title">TROPHY CASE</div>' +
          '<button id="trophy-close" aria-label="Close trophy case">' +
            '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
          '</button>' +
        '</div>' +
        '<div id="trophy-sub"></div>' +
        '<div id="trophy-grid"></div>' +
      '</div>';
    document.body.appendChild(overlay);
    panelEl = overlay.querySelector("#trophy-panel");
    gridEl = overlay.querySelector("#trophy-grid");
    subEl = overlay.querySelector("#trophy-sub");

    overlay.addEventListener("click", (e) => { if(e.target === overlay) close(); });
    overlay.querySelector("#trophy-close").addEventListener("click", close);
    document.addEventListener("keydown", (e) => {
      if(e.key === "Escape" && overlay.classList.contains("open")) close();
    });
  }

  function open(){
    if(!overlay) buildPanel();
    markSeen();
    renderGrid();
    overlay.classList.add("open");
    try{ Feedback.tone("select"); }catch(e){}
  }
  function close(){
    overlay.classList.remove("open");
  }
  function markSeen(){
    seenCount = Object.keys(state.unlocked).length;
    updateBadge();
    persistSeen();
  }
  function persistSeen(){
    // seenCount rides along in the same record so the badge survives reloads
    state.seenCount = seenCount;
    persist();
  }

  // ---------- event wiring ----------
  let lastCenteredId = null;

  async function onCardCentered(e){
    const id = e.detail && e.detail.id;
    if(!id || id === lastCenteredId) return;
    lastCenteredId = id;

    state.visitsTotal++;
    const dk = dayKey();
    state.dayVisits[dk] = (state.dayVisits[dk] || 0) + 1;
    // prune day buckets older than 7 days so the record stays tiny
    if(Object.keys(state.dayVisits).length > 7){
      const cutoff = Date.now() - 7 * 864e5;
      for(const k of Object.keys(state.dayVisits)){
        const [y,m,d] = k.split("-").map(Number);
        if(new Date(y, m-1, d).getTime() < cutoff) delete state.dayVisits[k];
      }
    }
    if(!state.visited.includes(id)){
      state.visited.push(id);
      if(state.visited.length > VISITED_MAX) state.visited = state.visited.slice(-VISITED_MAX);
    }
    persist();

    let holdsRecord = false;
    try{ holdsRecord = (await StripDB.getHighscore(id)) > 0; }catch(err){}
    evaluate({ holdsRecord });
  }

  function onFavChanged(e){
    const detail = e.detail || {};
    if(typeof detail.count === "number"){
      state.favCount = detail.count;
      evaluate({});
    }
  }

  // ---------- boot ----------
  async function init(){
    const saved = await load();
    if(saved && typeof saved === "object"){
      state = Object.assign(state, saved);
      if(!Array.isArray(state.visited)) state.visited = [];
      if(!state.unlocked || typeof state.unlocked !== "object") state.unlocked = {};
      if(!state.dayVisits || typeof state.dayVisits !== "object") state.dayVisits = {};
      seenCount = state.seenCount || 0;
      // favor the drawer's live favorites record if it exists (drawer owns that data)
      try{
        const meta = await StripDB.loadState("__deck_meta__");
        if(meta && Array.isArray(meta.favorites)) state.favCount = meta.favorites.length;
      }catch(e){}
    }
    // HUD button (markup lives in index.html, next to the other HUD buttons)
    trophyBtn = document.getElementById("trophy-btn");
    if(trophyBtn) trophyBtn.addEventListener("click", open);
    // toast element
    toastEl = document.createElement("div");
    toastEl.id = "trophy-toast";
    toastEl.setAttribute("aria-live", "polite");
    toastEl.innerHTML =
      '<div class="trophy-toast-medal" aria-hidden="true">✦</div>' +
      '<div><div class="trophy-toast-label">TROPHY UNLOCKED</div>' +
      '<div class="trophy-toast-name"></div></div>';
    document.body.appendChild(toastEl);

    window.addEventListener("strip:card-centered", onCardCentered, { passive:true });
    window.addEventListener("strip:fav-changed", onFavChanged, { passive:true });
    updateBadge();
    readyResolve();
  }

  let toastEl = null;

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return {
    whenReady: () => readyPromise,
    getVisitedCount: () => state.visited.length,
    isVisited: (id) => state.visited.indexOf(id) !== -1,
    hasUnseen: () => Object.keys(state.unlocked).length > seenCount,
    markSeen
  };
})();
