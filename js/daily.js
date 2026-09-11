/**
 * STRIP — Daily Pick (Round 13)
 * -----------------------------
 * A retention hook for the deck: every day, one cartridge is "today's pick",
 * chosen deterministically from the date so every device in the world sees
 * the same cartridge (same deck version, same pick — no server needed).
 *
 *   - HUD chip "◎ DAILY" jumps straight to the pick; gets a ✓ once played
 *   - the pick's card wears a "TODAY'S PICK" tag while it is centered
 *   - playing it (strip settles on it) extends a daily streak, persisted
 *   - fires "strip:daily-played" so the Trophy Case can unlock DAILY DRIVER
 *   - drawer rows for the pick carry a small ◆ marker
 *
 * State lives under the reserved id "__daily__" (reserved "__" prefix can
 * never collide with a game id — same convention as __app_settings__ /
 * __trophies__ / __deck_meta__).
 */
window.Daily = (function(){
  const STORE_ID = "__daily__";

  let todayId = null;    // module id of today's pick (resolved after boot)
  let todayMod = null;   // the module object
  let chip = null;
  let state = {
    lastPlayed: null,    // "YYYY-MM-DD" of the last played day (local time)
    streak: 0,
    best: 0,
  };

  function dayKey(d){
    d = d || new Date();
    return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  }

  // FNV-1a 32-bit — tiny, deterministic, no deps. Uniform enough mod n.
  function hash(str){
    let h = 0x811c9dc5;
    for(let i = 0; i < str.length; i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  // Sorted ids so the pick depends only on the SET of cartridges, not on
  // script order — a registry reorder never silently changes today's pick.
  function pickFor(dateKey){
    const ids = Strip.all().map(m => m.id).sort();
    if(!ids.length) return null;
    return ids[hash(dateKey) % ids.length];
  }

  function load(){
    return StripDB.loadState(STORE_ID).catch(() => null);
  }
  function persist(){
    StripDB.saveState(STORE_ID, state).catch(() => {});
  }

  // ---------- play detection + streak ----------
  function recordPlay(){
    const dk = dayKey();
    if(state.lastPlayed === dk) return; // once per day
    const yesterday = dayKey(new Date(Date.now() - 864e5));
    state.streak = (state.lastPlayed === yesterday) ? state.streak + 1 : 1;
    state.lastPlayed = dk;
    state.best = Math.max(state.best, state.streak);
    persist();
    updateChip();
    window.dispatchEvent(new CustomEvent("strip:daily-played", {
      detail: { id: todayId, streak: state.streak }
    }));
  }

  window.addEventListener("strip:card-centered", (e) => {
    if(!todayId) return;
    if(e.detail && e.detail.id === todayId) recordPlay();
  }, { passive:true });

  // ---------- card badge (called by app.js on every scroll frame) ----------
  // Cheap: one querySelector on the centered card only, and both branches
  // no-op once the DOM is already in the right shape.
  function badge(cartEl, modId){
    if(!cartEl) return;
    const header = cartEl.querySelector(".cart-header");
    if(!header) return;
    const existing = header.querySelector(".cart-daily-tag");
    if(modId === todayId){
      if(!existing){
        const tag = document.createElement("div");
        tag.className = "cart-daily-tag";
        tag.textContent = "TODAY'S PICK";
        // sit next to the game's own tag pill (or as the sole right-side item)
        const right = header.querySelector(".cart-tag");
        (right ? right.parentElement : header).appendChild(tag);
      }
    } else if(existing){
      existing.remove();
    }
  }

  // ---------- HUD chip ----------
  function buildChip(){
    chip = document.getElementById("daily-chip");
    if(!chip) return;
    const title = todayMod ? (todayMod.title || todayId) : "";
    chip.setAttribute("aria-label", "Today's pick: " + title + " — jump to it");
    chip.title = "Today's pick: " + title + (state.streak ? " · streak " + state.streak : "");
    chip.addEventListener("click", () => {
      if(todayMod && window.StripShell) StripShell.jumpToModule(todayMod);
      try{ Feedback.haptic("light"); }catch(e){}
    });
    updateChip();
    chip.hidden = false;
  }

  function updateChip(){
    if(!chip) return;
    const done = state.lastPlayed === dayKey();
    chip.classList.toggle("done", done);
    // compact: glyph always, streak number once it means something
    chip.textContent = done ? "◎✓" : "◎" + (state.streak > 1 ? " " + state.streak : "");
  }

  // ---------- drawer marker ----------
  function decorateDrawerItem(itemEl, modId){
    if(modId !== todayId || !itemEl) return;
    const main = itemEl.querySelector(".drawer-item-main");
    if(!main || main.querySelector(".drawer-item-daily")) return;
    const mark = document.createElement("span");
    mark.className = "drawer-item-daily";
    mark.title = "Today's pick";
    mark.setAttribute("aria-label", "Today's pick");
    mark.textContent = "◆";
    main.appendChild(mark);
  }

  // ---------- boot ----------
  async function init(){
    await Settings.whenReady();
    const saved = await load();
    if(saved && typeof saved === "object"){
      state = Object.assign(state, saved);
      if(typeof state.streak !== "number") state.streak = 0;
      if(typeof state.best !== "number") state.best = 0;
    }
    // yesterday's player who missed a day keeps the stale streak number in
    // the persisted record; display resets to 0 without erasing history
    const yesterday = dayKey(new Date(Date.now() - 864e5));
    if(state.lastPlayed && state.lastPlayed !== dayKey() && state.lastPlayed !== yesterday){
      state.streak = 0; // broken — next play starts a fresh streak
      persist();
    }
    const id = pickFor(dayKey());
    todayId = id;
    todayMod = Strip.all().find(m => m.id === id) || null;
    buildChip();
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  return {
    isToday: (id) => id === todayId,
    badge,                                   // app.js hook (per scroll frame)
    decorateDrawerItem,                      // drawer.js hook (per grid render)
    getStreak: () => state.streak,
    getBest: () => state.best,
    todayId: () => todayId,
  };
})();
