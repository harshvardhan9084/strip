/**
 * STRIP — Daily Missions (Round 23)
 * ---------------------------------
 * The compulsion loop's last unbuilt room. XP (Round 20) pays every award the
 * shell observes; Trophies reward the long arc; what was missing is the
 * DAILY CONTRACT — three small, concrete goals that reroll at midnight and
 * pay the moment they complete. Same philosophy as the Daily Pick: no server,
 * every device in the world sees the SAME three missions (deterministic seed
 * from the date), no claim button — completing a mission pays instantly,
 * because the dopamine should not wait behind UI.
 *
 * Progress is observed, never asked for. Missions listen to the same shell
 * events XP listens to, so every game wired to api.gameover() (Round 23)
 * feeds the layer with zero per-game edits on this side:
 *
 *   strip:gameover     -> RUNS (any finished run), WINS (outcome "win")
 *   strip:xp-awarded   -> BESTS (reason "best"), XP TODAY (summed amounts;
 *                         mission/sweep rewards excluded — a reward can never
 *                         feed itself)
 *   strip:card-centered-> VISITS (consecutive-dedupe, same rule as XP settles)
 *   strip:daily-played -> PICK (play today's Daily Pick)
 *
 * Rewards: +30 XP per mission (XP.award "mission"), +40 XP sweep bonus when
 * all three clear the same day (XP.award "sweep") — both announced by XP's
 * float queue and, for the sweep, a HUD toast. State persists under the
 * reserved id "__missions__" ("__" prefix can never collide with a game id),
 * with the same disk-write gate as XP/Daily: if the boot read fails, the
 * module stays in-memory rather than persisting defaults over a record.
 *
 * Rendering: the Trophy Case calls Missions.renderInto(gridEl) — the block
 * live-updates while the panel is open (the one place "1/5" ticking up as
 * you play is visible proof the meta layer is alive).
 */
window.Missions = (function(){
  const STORE_ID = "__missions__";

  // ---------- mission pool ----------
  // need values sized so a normal 10-minute session can land 1-2 missions,
  // and a playful day sweeps all three — never a grind wall.
  const POOL = [
    { key:"runs",    need:5,  label:n => "FINISH " + n + " RUNS",        hint:"End any run — win or lose counts" },
    { key:"wins",    need:3,  label:n => "WIN " + n + " GAMES",          hint:"Beat the game: clear the board, beat the AI" },
    { key:"bests",   need:2,  label:n => "SET " + n + " NEW BESTS",      hint:"Beat a personal record anywhere in the deck" },
    { key:"pick",    need:1,  label:() => "PLAY TODAY'S PICK",           hint:"The ◎ DAILY cartridge counts" },
    { key:"visits",  need:8,  label:n => "VISIT " + n + " CARTRIDGES",   hint:"Scroll the deck and settle on cards" },
    { key:"xptoday", need:40, label:n => "EARN " + n + " XP",            hint:"Everything you do today feeds this" },
    // Round 24 — the idle toys never emit a run end, so on a toys-only day
    // some past pools could feel unreachable. TENDING is their run: water a
    // plot, feed the fish, trade, drop a ball, play a hand. Unique ids only.
    { key:"tend",    need:3,  label:n => "TEND " + n + " IDLE CARTRIDGES", hint:"Water, feed, trade, drop or deal — any idle toy counts" },
  ];

  // Round 24 — a light difficulty ramp: veterans get stretched needs so the
  // daily contract keeps its bite. Tier is snapshotted AT DAY ROLL (stable
  // for the whole day — mid-day level-ups never move today's goalposts), and
  // the templates themselves stay date-deterministic: same three missions
  // for every device, only the NUMBERS scale with the player's own level.
  function tierMult(){
    let lv = 1;
    try{ if(window.XP && XP.getState) lv = XP.getState().level || 1; }catch(e){}
    return lv >= 10 ? 2 : (lv >= 5 ? 1.5 : 1);
  }
  function scaledNeed(def){
    return def.key === "pick" ? 1 : Math.max(1, Math.round(def.need * tierMult()));
  }

  // ---------- deterministic daily selection ----------
  // FNV-1a over the day key, then an LCG shuffle — the same three missions
  // for every device on the same calendar day, zero coordination needed.
  function seededPick(dayStr){
    let h = 2166136261;
    for(let i = 0; i < dayStr.length; i++){
      h ^= dayStr.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    let s = h >>> 0;
    const bag = POOL.map((_, i) => i);
    const picks = [];
    while(picks.length < 3 && bag.length){
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      picks.push(bag.splice(s % bag.length, 1)[0]);
    }
    return picks;
  }

  function dayKey(d){
    d = d || new Date();
    return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  }

  // ---------- state ----------
  let state = { day:null, missions:[], swept:false, announcedDay:null, tendedIds:[] };
  let hydrated = false;
  let readyResolve;
  const readyPromise = new Promise(res => { readyResolve = res; });

  function persist(){
    if(!hydrated) return; // a failed boot read must never be written over
    StripDB.saveState(STORE_ID, state).catch(() => {});
  }

  function rollDay(force){
    const dk = dayKey();
    if(!force && state.day === dk) return false;
    state.day = dk;
    state.swept = false;
    state.announcedDay = null;
    state.tendedIds = [];
    state.missions = seededPick(dk).map(i => ({
      key: POOL[i].key,
      need: scaledNeed(POOL[i]),
      progress: 0,
      done: false,
    }));
    syncBadge();
    return true;
  }

  function defFor(key){
    for(const d of POOL) if(d.key === key) return d;
    return null;
  }

  // ---------- progress core ----------
  let lastVisitId = null;
  function flashPill(){
    // one-shot pulse on the LV pill: a mission completing while you are deep
    // in a card should still reach the eye — the pill is always on screen
    try{
      const pill = document.getElementById("xp-pill");
      if(pill){
        pill.classList.remove("mission-flash");
        void pill.offsetWidth; // restart the animation
        pill.classList.add("mission-flash");
      }
    }catch(e){}
  }
  function bump(key, amount){
    if(rollDay()) persist();          // midnight flip mid-session
    const m = state.missions.find(x => x.key === key);
    if(!m || m.done) return;
    m.progress = Math.min(m.need, m.progress + amount);
    if(m.progress >= m.need){
      m.done = true;
      m.progress = m.need;
      // pay NOW — no claim button (dopamine should not wait behind UI)
      if(window.XP && XP.award) XP.award("mission");
      flashPill();
      try{ Feedback.tone("win"); Feedback.haptic([10, 40, 10]); }catch(e){}
    }
    persist();
    rerenderIfAttached();
    syncBadge();
    checkSweep();
  }

  // ---------- Round 24 — HUD badge ----------
  // The daily contract finally has a persistent, one-glance HUD presence —
  // WITHOUT a new HUD slot: the trophy button (which already hosts the
  // missions block) wears a count bubble. Remaining count while work is
  // left; a quiet ✓ for the rest of the day once swept. The bubble sits on
  // the opposite corner from the unseen-trophy pip, so both can coexist.
  function syncBadge(){
    try{
      const btn = document.getElementById("trophy-btn");
      if(!btn) return;
      let b = document.getElementById("trophy-missions");
      if(!state.missions.length){ if(b) b.classList.remove("on"); return; }
      if(!b){
        b = document.createElement("span");
        b.id = "trophy-missions";
        b.setAttribute("aria-hidden", "true");
        btn.appendChild(b);
      }
      const left = state.missions.filter(m => !m.done).length;
      const swept = left === 0;
      b.textContent = swept ? "✓" : String(left);
      b.classList.toggle("swept", swept);
      b.classList.add("on");
    }catch(e){}
  }

  function checkSweep(){
    if(state.swept || !state.missions.length) return;
    if(state.missions.every(m => m.done)){
      state.swept = true;
      if(window.XP && XP.award) XP.award("sweep");
      try{ HudToast.show("ALL MISSIONS CLEAR · +" + (window.XP ? XP._internals.AWARD.sweep : 40) + " XP SWEEP BONUS", 2400); }catch(e){}
      persist();
      rerenderIfAttached();
      syncBadge();
    }
  }

  // ---------- event listeners ----------
  function onGameOver(e){
    const d = e.detail;
    if(!d || !d.id) return;
    bump("runs", 1);
    if(d.outcome === "win") bump("wins", 1);
  }
  function onXpAwarded(e){
    const d = e.detail;
    if(!d) return;
    if(d.reason === "best") bump("bests", 1);
    // mission/sweep rewards can never feed the XP mission (self-feeding loop)
    if(d.reason !== "mission" && d.reason !== "sweep") bump("xptoday", d.amount || 0);
  }
  function onCardCentered(e){
    const id = e.detail && e.detail.id;
    if(!id || id === lastVisitId) return; // consecutive re-settle: not a new visit
    lastVisitId = id;
    bump("visits", 1);
    announceIfNewDay();
  }
  function onDailyPlayed(){ bump("pick", 1); }
  // Round 24 — tend events. Idle toys call api.tend() at their natural
  // caretaking moments; only UNIQUE cartridges advance the goal per day, so
  // watering one plot forty times farms nothing (same honesty rule as the
  // visits dedupe).
  function onTend(e){
    const id = e.detail && e.detail.id;
    if(!id) return;
    if(state.tendedIds.indexOf(id) !== -1) return;
    state.tendedIds.push(id);
    bump("tend", 1);
  }

  // ---------- daily discovery ----------
  // The missions live in the trophy case; a player who never opens it would
  // never meet the layer. So the FIRST settle of each new day announces the
  // contract once — one toast, not a nag. Then the pill title carries the
  // count for the rest of the day.
  function announceIfNewDay(){
    const dk = dayKey();
    if(state.announcedDay === dk) return;
    state.announcedDay = dk;
    if(hydrated) persist();
    if(state.missions.some(m => !m.done)){
      try{ HudToast.show("TODAY'S MISSIONS ARE LIVE — tap the LV pill", 2600); }catch(e){}
    }
  }

  // ---------- rendering ----------
  // Rendered into the Trophy Case grid by renderGrid(); keeps a reference so
  // progress ticking up while the panel is open re-renders in place.
  let rootEl = null;
  function renderInto(grid){
    rootEl = renderBlock();
    grid.appendChild(rootEl);
  }
  function rerenderIfAttached(){
    if(!rootEl || !rootEl.isConnected) return;
    const fresh = renderBlock();
    rootEl.replaceWith(fresh);
    rootEl = fresh;
  }
  function renderBlock(){
    const wrap = document.createElement("div");
    wrap.className = "missions-block";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "Today's missions");

    const head = document.createElement("div");
    head.className = "missions-head";
    const doneCount = state.missions.filter(m => m.done).length;
    head.textContent = "TODAY'S MISSIONS · " + doneCount + "/3" + (state.swept ? " · SWEPT ✓" : "");
    wrap.appendChild(head);

    state.missions.forEach(m => {
      const def = defFor(m.key);
      if(!def) return;
      const item = document.createElement("div");
      item.className = "mission-row" + (m.done ? " done" : "");

      const line = document.createElement("div");
      line.className = "mission-line";
      const name = document.createElement("span");
      name.className = "mission-name";
      name.textContent = def.label(m.need);
      const num = document.createElement("span");
      num.className = "mission-num";
      num.textContent = m.done ? "✓ +" + (window.XP ? XP._internals.AWARD.mission : 30) + " XP" : m.progress + "/" + m.need;
      line.appendChild(name); line.appendChild(num);

      const track = document.createElement("div");
      track.className = "mission-track";
      const fill = document.createElement("div");
      fill.className = "mission-fill";
      fill.style.width = Math.round((m.progress / m.need) * 100) + "%";
      track.appendChild(fill);

      item.appendChild(line); item.appendChild(track);
      item.title = def.hint;
      item.setAttribute("role", "img");
      item.setAttribute("aria-label", def.label(m.need) + ": " + m.progress + " of " + m.need +
        (m.done ? " — complete" : ""));
      wrap.appendChild(item);
    });
    return wrap;
  }

  // ---------- boot ----------
  async function init(){
    window.addEventListener("strip:gameover", onGameOver, { passive:true });
    window.addEventListener("strip:xp-awarded", onXpAwarded, { passive:true });
    window.addEventListener("strip:card-centered", onCardCentered, { passive:true });
    window.addEventListener("strip:daily-played", onDailyPlayed, { passive:true });
    window.addEventListener("strip:tend", onTend, { passive:true });
    window.addEventListener("strip:daily-rollover", () => { if(rollDay(true)){ persist(); rerenderIfAttached(); } }, { passive:true });

    let res = null;
    try{ res = await StripDB.loadStateChecked(STORE_ID); }catch(e){ res = null; }
    if(res && res.status === "ok"){
      if(res.data && typeof res.data === "object"){
        // hydrate only the shape we understand; a day-mismatched record is
        // kept just long enough for rollDay to see the mismatch and reroll
        state = Object.assign(state, res.data);
        if(!Array.isArray(state.missions)) state.missions = [];
        if(!Array.isArray(state.tendedIds)) state.tendedIds = [];
        // guard against hand-edited/partial saves: every mission must map to
        // the pool, or the day rerolls (same hostile-save policy as Garden R22)
        const valid = state.missions.length === 3 && state.missions.every(m => m && defFor(m.key) && typeof m.need === "number");
        if(!valid) state.day = null;
      }
      hydrated = true;
    }
    rollDay();
    syncBadge();
    readyResolve();
    // Round 24 — boot-race rescale: if the day rolled before XP finished
    // hydrating its level from IndexedDB, the tier snapshot is stale. Once XP
    // is ready, re-scale needs ONCE to the true level (progress clamps, never
    // resets). Mid-day level-ups never re-open this window.
    try{
      if(window.XP && XP.whenReady) XP.whenReady().then(() => {
        let changed = false;
        state.missions.forEach(m => {
          const def = defFor(m.key);
          if(!def) return;
          const want = scaledNeed(def);
          if(want !== m.need){ m.need = want; m.progress = Math.min(m.progress, m.need); changed = true; }
        });
        if(changed){ persist(); rerenderIfAttached(); }
      }).catch(() => {});
    }catch(e){}
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  return {
    whenReady: () => readyPromise,
    renderInto,                                   // Trophy Case hook
    summary: () => ({ left: state.missions.filter(m => !m.done).length, swept: !!state.swept }),
    _internals: { POOL, seededPick, dayKey, getState: () => state, bumpForTest: bump, scaledNeed, tierMult, syncBadgeForTest: syncBadge },
  };
})();
