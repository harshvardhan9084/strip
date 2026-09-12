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
    { id:"daily-driver", medal:"◉", name:"DAILY DRIVER",
      desc:"Play the Daily Pick. Come back tomorrow to grow the streak." },
  ];

  // ---------- state ----------
  let state = {
    unlocked: {},          // trophyId -> unlock timestamp (ms)
    visited: [],           // distinct cartridge ids, insertion order
    visitsTotal: 0,
    dayVisits: {},         // "YYYY-MM-DD" -> visit count
    favCount: 0,           // hydrated from drawer meta, maintained via events
    dailyPlayed: false,    // set via strip:daily-played (Daily Pick, Round 13)
    dailyStreak: 0,        // mirror of the Daily module's streak, for the sub line
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
    // toastEl is built at the end of init(); an unlock that fires during
    // hydration (listeners now register first) must not touch a null node —
    // the queued toast flushes as soon as the element exists.
    if(!toastEl || !toastShowing) nextToast();
  }
  function nextToast(){
    if(!toastEl){
      if(!toastQueue.length){ toastShowing = false; return; }
      // element not ready yet — retry on the next macrotask
      setTimeout(nextToast, 120);
      return;
    }
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
      else if(def.id === "daily-driver") ok = !!state.dailyPlayed;
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

  // ---------- Daily Ritual block (Round 14) ----------
  // Lazy-reads Daily.getState() at render time (same pattern as the drawer's
  // visited dots — always fresh, no event plumbing needed for a static panel).
  function renderDailyStats(){
    if(!window.Daily || !Daily.getState) return;
    const st = Daily.getState();

    const wrap = document.createElement("div");
    wrap.className = "daily-stats";

    const head = document.createElement("div");
    head.className = "daily-stats-head";
    const label = document.createElement("span");
    label.className = "daily-stats-label";
    label.textContent = "DAILY RITUAL";
    const num = document.createElement("span");
    num.className = "daily-stats-num";
    num.textContent = "◉ " + st.streak + "-day streak · best " + st.best;
    head.appendChild(label); head.appendChild(num);
    wrap.appendChild(head);

    // last 7 days — today last, oldest first, day initials from real dates
    const week = document.createElement("div");
    week.className = "daily-week";
    const initials = ["S","M","T","W","T","F","S"];
    let playedCount = 0;
    for(let i = 6; i >= 0; i--){
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
      const on = st.plays.indexOf(key) !== -1;
      if(on) playedCount++;
      const cell = document.createElement("div");
      cell.className = "daily-day" + (on ? " on" : "") + (i === 0 ? " today" : "");
      cell.title = key + (on ? " — played" : " — missed");
      const letter = document.createElement("span");
      letter.textContent = initials[d.getDay()];
      letter.setAttribute("aria-hidden", "true");
      cell.appendChild(letter);
      week.appendChild(cell);
    }
    week.setAttribute("role", "img");
    week.setAttribute("aria-label", "Last 7 days: played the daily pick on " + playedCount +
      (playedCount === 1 ? " day" : " days") + " of 7. Today " +
      (st.playedToday ? "is done." : "is still open."));
    wrap.appendChild(week);

    const shareBtn = document.createElement("button");
    shareBtn.type = "button";
    shareBtn.className = "daily-share-btn";
    shareBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="6" cy="12" r="2.2"/><circle cx="17.5" cy="5.5" r="2.2"/><circle cx="17.5" cy="18.5" r="2.2"/><path d="M8 10.9 15.5 6.6M8 13.1 15.5 17.4"/></svg>' +
      "<span>Share today's pick</span>";
    shareBtn.setAttribute("aria-label", "Share today's pick: " + st.title);
    shareBtn.addEventListener("click", () => {
      try{ Feedback.tone("select"); Feedback.haptic("light"); }catch(e){}
      Daily.share();
    });
    wrap.appendChild(shareBtn);

    gridEl.appendChild(wrap);
  }

  function renderGrid(){
    gridEl.innerHTML = "";
    const unlockedCount = Object.keys(state.unlocked).length;
    subEl.textContent = unlockedCount + " / " + DEFS.length + " unlocked · " +
      state.visited.length + "/50 cartridges explored · " + state.visitsTotal + " visits" +
      (state.dailyStreak > 0 ? " · daily streak " + state.dailyStreak : "");
    // Round 14: the Daily Ritual block (streak + last-7-days + share) leads
    // the panel — it is the one trophy-adjacent thing players use daily.
    renderDailyStats();
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
    // Round 13: Tab cycles inside the open sheet instead of escaping behind it
    if(window.FocusTrap) FocusTrap.attach(overlay, () => overlay.classList.contains("open"));
  }

  function open(){
    if(!overlay) buildPanel();
    markSeen();
    renderGrid();
    overlay.classList.add("open");
    // dialog parity: move focus in (matches drawer/settings sheet behavior).
    // Deferred one frame — the overlay is still visibility:hidden at
    // classList.add time and focus() on hidden elements is silently dropped.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      overlay.querySelector("#trophy-close").focus({ preventScroll: true });
    }));
    try{ Feedback.tone("select"); }catch(e){}
  }
  function close(){
    overlay.classList.remove("open");
    // dialog parity: hand focus back to the HUD button that opened us
    requestAnimationFrame(() => {
      const btn = document.getElementById("trophy-btn");
      if(btn && btn.focus) btn.focus({ preventScroll: true });
    });
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

  // Daily Pick (Round 13): the Daily module owns streak math; we mirror what
  // it announces so DAILY DRIVER + the streak readout stay event-driven like
  // everything else in this file.
  function onDailyPlayed(e){
    const detail = e.detail || {};
    state.dailyPlayed = true;
    if(typeof detail.streak === "number") state.dailyStreak = detail.streak;
    evaluate({});
    if(overlay && overlay.classList.contains("open")) renderGrid();
  }

  // Boot reconciliation (Round 13 critic MINOR-3): daily.js resets a broken
  // streak at boot and announces it here, so the sub line can never claim a
  // streak the HUD chip no longer shows. The detail is also KEPT — if the
  // event lands while our own hydration is still in flight, the saved-state
  // merge below would overwrite the fresh mirror with the stale persisted
  // one, so we re-apply after the merge.
  let lastDailySync = null;
  function applyDailySync(){
    if(!lastDailySync || typeof lastDailySync.streak !== "number") return;
    state.dailyStreak = lastDailySync.streak;
    if(overlay && overlay.classList.contains("open")) renderGrid();
  }
  function onDailySync(e){
    lastDailySync = e.detail || null;
    applyDailySync();
  }

  // ---------- boot ----------
  async function init(){
    // Listeners FIRST (Round 12): the shell's first settle can fire before
    // IndexedDB hydration resolves; registering after the await used to drop
    // that event, delaying FIRST SPARK by a card. Events arriving mid-hydrate
    // simply mutate `state` before the saved record is merged on top.
    window.addEventListener("strip:card-centered", onCardCentered, { passive:true });
    window.addEventListener("strip:fav-changed", onFavChanged, { passive:true });
    window.addEventListener("strip:daily-played", onDailyPlayed, { passive:true });
    window.addEventListener("strip:daily-sync", onDailySync, { passive:true });
    // Round 14 fix: an open panel must not go stale across midnight — same
    // live-refresh contract the drawer holds (streak/playedToday/LED grid)
    window.addEventListener("strip:daily-rollover", () => {
      if(overlay && overlay.classList.contains("open")) renderGrid();
    }, { passive:true });

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
      // fresh daily numbers beat the stale persisted mirror (see onDailySync)
      applyDailySync();
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
