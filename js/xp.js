/**
 * STRIP — Player XP & Level (Round 20)
 * ------------------------------------
 * The deck-wide meta layer. Every cartridge you settle on, every new best,
 * every trophy, every daily pick and every pin feeds ONE number: your player
 * XP. Levels land fast early (dopamine pacing: the first session should end
 * with a ceremony) and stretch later, so a level-up always feels earned.
 *
 * This is deliberately a SHELL module: every award source is something the
 * shell already observes, so all 50 games feed progression with ZERO per-game
 * edits:
 *
 *   strip:card-centered    -> +1 XP settle (consecutive-dedupe, 30/day cap)
 *   makeApi().setHighscore -> +25 XP on a REAL best improvement (app.js hook)
 *   strip:trophy-unlocked  -> +40 XP (trophies.js dispatches on unlock)
 *   strip:daily-played     -> +15 XP, +5 per streak day (cap +50 bonus)
 *   strip:fav-changed      -> +5 XP when the favorites row GROWS (toggle-safe:
 *                             only counts increases past the highest count seen)
 *
 * Surfaces:
 *   #xp-pill  — HUD pill "LV 4" with a micro progress track (opens the trophy
 *               case, where the full Player Card lives)
 *   +XP float — small chips that rise and fade near the pill, so every award
 *               is SEEN (a reward nobody notices is not a reward)
 *   LEVEL UP  — full-screen phosphor ceremony on crossing a level boundary
 *
 * State persists under the reserved id "__xp__" (reserved "__" prefix can
 * never collide with a game id — same convention as __trophies__/__daily__).
 * Same disk-write gate as Daily: if the store's read fails at boot, the
 * module stays in-memory for the session rather than persisting defaults
 * over a real record.
 */
window.XP = (function(){
  const STORE_ID = "__xp__";
  const SETTLE_DAILY_CAP = 30;

  // ---- award table ----
  const AWARD = {
    settle: 1,
    best: 25,
    trophy: 40,
    dailyBase: 15,
    dailyStreakStep: 5,
    dailyStreakBonusCap: 50,
    fav: 5,
  };

  // ---- level curve ----
  // XP needed to cross L -> L+1. Early levels: ~2 minutes of play. Later:
  // a session each. (L-1)^1.35 keeps the growth gentle enough that level 10
  // is a real month of play, not a grind wall.
  function stepFor(level){
    if(level < 1) level = 1;
    return Math.round(50 + 28 * Math.pow(level - 1, 1.35));
  }
  // Walk the curve. Returns { level, into, need } — into/need drive the HUD
  // micro-bar and the Player Card ring.
  function levelFor(xp){
    let l = 1;
    let rem = Math.max(0, Math.floor(Number(xp) || 0));
    while(rem >= stepFor(l) && l < 999){
      rem -= stepFor(l);
      l++;
    }
    return { level: l, into: rem, need: stepFor(l) };
  }
  function computeDailyXp(streak){
    const s = Math.max(1, Math.floor(Number(streak) || 1));
    return AWARD.dailyBase + Math.min(AWARD.dailyStreakBonusCap, (s - 1) * AWARD.dailyStreakStep);
  }

  const TITLES = [
    "FRESH FOAM", "BUTTON TESTER", "CARTRIDGE CURIOUS", "DECK REGULAR",
    "HIGH SCORER", "PHOSPHOR NATIVE", "COMPELLED", "MARATHON MIND",
    "DECK VETERAN", "CONSOLE SAGE", "STRIP SCHOLAR", "GRANDMASTER",
    "LUDIC LOOP", "RETENTION ROYALTY", "ARCADE IMMORTAL",
  ];
  function titleFor(level){
    return level <= TITLES.length ? TITLES[level - 1] : "BEYOND THE SCREEN";
  }

  // ---------- state ----------
  let state = { xp: 0, day: null, settleToday: 0, favsSeen: 0 };
  let hydrated = false;   // disk-write gate (Daily's pattern)
  let readyResolve;
  const readyPromise = new Promise(res => { readyResolve = res; });

  function dayKey(d){
    d = d || new Date();
    return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  }
  function rollDay(){
    const dk = dayKey();
    if(state.day !== dk){
      state.day = dk;
      state.settleToday = 0;
    }
  }
  function persist(){
    if(!hydrated) return; // defaults must never overwrite a record we couldn't read
    StripDB.saveState(STORE_ID, state).catch(() => {});
  }

  // ---------- HUD ----------
  let pill, pillLevel, pillFill, hudLeft;
  function buildHud(){
    hudLeft = document.getElementById("hud-left");
    pill = document.getElementById("xp-pill");
    if(!pill) return;
    pillLevel = pill.querySelector("#xp-level");
    pillFill = pill.querySelector("#xp-fill");
    pill.addEventListener("click", () => {
      const btn = document.getElementById("trophy-btn");
      if(btn) btn.click();
    });
  }
  function renderHud(){
    if(!pill) buildHud();
    if(!pill) return;
    const { level, into, need } = levelFor(state.xp);
    const text = "LV " + level;
    if(pillLevel.textContent !== text) pillLevel.textContent = text;
    const pct = Math.max(0, Math.min(100, Math.round((into / need) * 100)));
    pillFill.style.width = pct + "%";
    pill.title = "Player level " + level + " — " + titleFor(level) +
      " · " + into + "/" + need + " XP to LV " + (level + 1) +
      " · tap for your player card";
  }

  // ---------- +XP float ----------
  // One chip at a time, re-triggered: three simultaneous floats would stack
  // into unreadable noise. Queue keeps every award visible in sequence.
  let floatEl = null;
  let floatQueue = [];
  let floating = false;
  function enqueueFloat(text, cls){
    floatQueue.push({ text, cls });
    if(floatQueue.length > 4) floatQueue = floatQueue.slice(-4); // burst guard: collapse, don't lag
    if(!floating) nextFloat();
  }
  function nextFloat(){
    const item = floatQueue.shift();
    if(!item){ floating = false; return; }
    floating = true;
    if(!floatEl || !floatEl.parentNode){
      floatEl = document.createElement("div");
      floatEl.id = "xp-float";
      floatEl.setAttribute("aria-hidden", "true");
      (hudLeft || document.body).appendChild(floatEl);
    }
    floatEl.textContent = item.text;
    floatEl.className = item.cls || "";
    void floatEl.offsetWidth; // restart the rise animation
    floatEl.classList.add("rise");
    setTimeout(nextFloat, 560);
  }

  // ---------- LEVEL UP ceremony ----------
  let ceremonyEl = null;
  let ceremonyQueue = [];
  let ceremonyShowing = false;
  function enqueueCeremony(level){
    ceremonyQueue.push(level);
    if(!ceremonyShowing) nextCeremony();
  }
  function nextCeremony(){
    const level = ceremonyQueue.shift();
    if(level == null){ ceremonyShowing = false; return; }
    ceremonyShowing = true;
    if(!ceremonyEl){
      ceremonyEl = document.createElement("div");
      ceremonyEl.id = "levelup-overlay";
      ceremonyEl.setAttribute("role", "status");
      ceremonyEl.setAttribute("aria-live", "polite");
      ceremonyEl.innerHTML =
        '<div id="levelup-card">' +
          '<div class="levelup-burst" aria-hidden="true"></div>' +
          '<div class="levelup-label">LEVEL UP</div>' +
          '<div class="levelup-num" aria-hidden="true"></div>' +
          '<div class="levelup-title"></div>' +
          '<div class="levelup-tap">keep playing</div>' +
        '</div>';
      document.body.appendChild(ceremonyEl);
      ceremonyEl.addEventListener("pointerdown", dismissCeremony);
      document.addEventListener("keydown", onCeremonyKey, true);
    }
    ceremonyEl.querySelector(".levelup-num").textContent = "LV " + level;
    ceremonyEl.querySelector(".levelup-title").textContent = titleFor(level);
    ceremonyEl.classList.add("show");
    try{
      Feedback.tone("win");
      Feedback.haptic([14, 50, 14, 50, 24]);
    }catch(e){}
    ceremonyTimer = setTimeout(dismissCeremony, 3000);
  }
  let ceremonyTimer = null;
  function dismissCeremony(){
    clearTimeout(ceremonyTimer);
    if(!ceremonyEl){ ceremonyShowing = false; return; }
    ceremonyEl.classList.remove("show");
    setTimeout(nextCeremony, 320);
  }
  function onCeremonyKey(e){
    if(ceremonyEl && ceremonyEl.classList.contains("show") &&
       (e.key === "Escape" || e.key === "Enter" || e.key === " ")){
      e.preventDefault();
      e.stopPropagation();
      dismissCeremony();
    }
  }

  // ---------- award core ----------
  // Awards are idempotent per event; reason-specific caps live in the
  // listeners. `silent` skips the float (used for batched/derived awards).
  function award(reason, opts){
    opts = opts || {};
    let amount = 0;
    if(reason === "settle"){
      rollDay();
      if(state.settleToday >= SETTLE_DAILY_CAP) return; // browsing can't out-farm playing
      state.settleToday++;
      amount = AWARD.settle;
    }
    else if(reason === "best") amount = AWARD.best;
    else if(reason === "trophy") amount = AWARD.trophy;
    else if(reason === "daily") amount = computeDailyXp(opts.streak);
    else if(reason === "fav") amount = AWARD.fav;
    if(amount <= 0) return;

    const before = levelFor(state.xp);
    state.xp += amount;
    const after = levelFor(state.xp);
    persist();
    renderHud();

    if(!opts.silent){
      enqueueFloat("+" + amount + " XP" + (reason === "best" ? " · NEW BEST" : ""), reason === "best" ? "big" : "");
    }
    // ceremony per level crossed (a huge trophy batch can cross several —
    // each gets its moment, queued)
    for(let l = before.level + 1; l <= after.level; l++) enqueueCeremony(l);
  }

  // ---------- event listeners ----------
  let lastSettledId = null;
  function onCardCentered(e){
    const id = e.detail && e.detail.id;
    if(!id || id === lastSettledId) return; // consecutive re-settle: not a new visit
    lastSettledId = id;
    award("settle", { silent: false });
  }
  function onDailyPlayed(e){
    const streak = (e.detail && e.detail.streak) || 1;
    award("daily", { streak });
  }
  function onTrophyUnlocked(){
    award("trophy");
  }
  function onFavChanged(e){
    const count = e.detail && e.detail.count;
    if(typeof count !== "number") return;
    // count only GROWTH past the highest count ever seen: unpinning and
    // re-pinning the same cartridge can never farm XP (toggle-safe)
    if(count > state.favsSeen && count > 0){
      state.favsSeen = count;
      award("fav");
    } else if(count > state.favsSeen){
      state.favsSeen = count;
    }
    persist();
  }

  // ---------- boot ----------
  async function init(){
    window.addEventListener("strip:card-centered", onCardCentered, { passive:true });
    window.addEventListener("strip:daily-played", onDailyPlayed, { passive:true });
    window.addEventListener("strip:trophy-unlocked", onTrophyUnlocked, { passive:true });
    window.addEventListener("strip:fav-changed", onFavChanged, { passive:true });
    window.addEventListener("strip:daily-rollover", () => { rollDay(); persist(); }, { passive:true });

    let res = null;
    try{ res = await StripDB.loadStateChecked(STORE_ID); }catch(e){ res = null; }
    if(res && res.status === "ok"){
      if(res.data && typeof res.data === "object"){
        state = Object.assign(state, res.data);
        if(typeof state.xp !== "number" || !Number.isFinite(state.xp) || state.xp < 0) state.xp = 0;
        if(typeof state.settleToday !== "number") state.settleToday = 0;
        if(typeof state.favsSeen !== "number") state.favsSeen = 0;
      }
      hydrated = true; // the store answered — writes are safe from here
    }
    // on a failed read we stay in-memory this session (Daily's gate), so a
    // transient IndexedDB hiccup can never wipe the player's level
    rollDay();
    buildHud();
    renderHud();
    readyResolve();
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  return {
    whenReady: () => readyPromise,
    award,                 // app.js "new best" hook + QA seam
    getState: () => Object.assign({}, state, levelFor(state.xp), { title: titleFor(levelFor(state.xp).level) }),
    _internals: { stepFor, levelFor, computeDailyXp, AWARD, SETTLE_DAILY_CAP, titleFor },
  };
})();
