/**
 * STRIP — ON DECK time (Round 32)
 * -------------------------------
 * The Player Card counts cartridges, visits, trophies, streaks — everything
 * except the one thing a player actually gives the deck: TIME. This engine
 * keeps that number honestly.
 *
 * Rules the engine lives by:
 *   - accrues ONLY while the page is visibly open (document.hidden stops the
 *     clock — a background tab is not "on the deck")
 *   - one heartbeat tick every HEARTBEAT_MS while visible; the tick adds the
 *     real elapsed time since the last tick (not the nominal interval), so a
 *     throttled timer can never inflate the day
 *   - a gap longer than MAX_GAP_MS (tab slept, device slept, debugger pause)
 *     is DISCARDED — the clock treats it as "away" rather than billing a
 *     dead tab as play
 *   - one bucket per local day, keyed "YYYY-MM-DD"; the store keeps the last
 *     30 days (pruned on rollover + boot)
 *   - persists on a throttled schedule (~1 write/min while playing), on
 *     visibilitychange-hidden, and on the daily rollover — never per second
 *   - data lives under the reserved id "__ontime__" (same store as games),
 *     so export/import and Clear-all ride StripDB with zero extra wiring
 *
 * Consumers:
 *   - trophies.js: LONG HAUL (30 minutes in a day) — evaluate() reads
 *     todayMinutes() fresh on every strip:ontime-updated
 *   - trophies.js renderPlayerCard: the ON DECK TODAY stat
 *
 * Like XP/Daily/Depth: a failed boot read keeps the session in-memory rather
 * than letting defaults overwrite a real record (the disk-write gate).
 */
window.Ontime = (function(){
  const STORE_ID = "__ontime__";
  const HEARTBEAT_MS = 15000;   // one tick while visible
  const MAX_GAP_MS = 60000;     // longer gap = away, not play
  const KEEP_DAYS = 30;         // buckets retained
  const MAX_DAY_MS = 20 * 3600000; // 20h cap — hostile saves can't mint hours
  const PERSIST_EVERY = 4;      // persist every Nth heartbeat (~1/min)

  let state = { days: {} };     // "YYYY-MM-DD" -> ms accrued
  let hydrated = false;
  let lastTick = 0;
  let tickCount = 0;
  let timer = null;
  let readyResolve;
  const readyPromise = new Promise(res => { readyResolve = res; });

  function dayKey(d){
    d = d || new Date();
    return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  }

  function persist(){
    if(!hydrated) return; // defaults must never overwrite a record we couldn't read
    StripDB.saveState(STORE_ID, state).catch(() => {});
  }

  // Hostile-save hygiene: numbers only, capped per day, sane keys, empty
  // buckets dropped, ring capped. typeof check FIRST — Number(null) is 0,
  // and a loose map would turn junk into real (zero) time.
  function sanitize(raw){
    const src = raw && typeof raw.days === "object" ? raw.days : {};
    const out = {};
    for(const k in src){
      const v = src[k];
      if(typeof v !== "number" || !Number.isFinite(v) || v <= 0) continue;
      if(!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
      out[k] = Math.min(Math.round(v), MAX_DAY_MS);
    }
    state = { days: prune(out) };
  }

  // Keep the newest KEEP_DAYS buckets (string keys sort chronologically).
  function prune(days){
    const keys = Object.keys(days).sort();
    while(keys.length > KEEP_DAYS){ delete days[keys.shift()]; }
    return days;
  }

  // THE accrual path — every millisecond of ON DECK enters here, including
  // the QA seam. One honest funnel: clamp, add to TODAY's bucket (the bucket
  // the tick STARTED in — a tick straddling midnight bills the older day,
  // and the next tick bills the new one; no split needed at 15s grain).
  // Round 32 fix (live-caught in QA): the strip:ontime-updated event fires
  // HERE, inside the funnel — tick() used to own it, which meant an accrual
  // from the visibility-hidden flush (or the documented QA seam) updated the
  // bucket silently and the LONG HAUL evaluate never heard the news. One
  // funnel, one event: every consumer reads fresh anyway.
  function accrue(ms){
    if(!Number.isFinite(ms) || ms <= 0) return 0;
    ms = Math.min(Math.round(ms), MAX_DAY_MS);
    const k = dayKey();
    state.days[k] = (state.days[k] || 0) + ms;
    if(state.days[k] > MAX_DAY_MS) state.days[k] = MAX_DAY_MS;
    try{
      window.dispatchEvent(new CustomEvent("strip:ontime-updated", {
        detail: { todayMs: todayMs(), ts: Date.now() }
      }));
    }catch(e){}
    return ms;
  }

  function tick(){
    const now = Date.now();
    const gap = now - lastTick;
    lastTick = now;
    if(document.hidden) return;          // background: the clock is stopped
    if(gap > MAX_GAP_MS) return;         // slept/suspended: away, not play
    const added = accrue(gap);
    if(added > 0){
      tickCount++;
      if(tickCount % PERSIST_EVERY === 0) persist();
      // the ontime-updated event fires inside accrue() — consumers read the
      // engine fresh, so a trigger from the funnel covers every caller
    }
  }

  function todayMs(){
    return state.days[dayKey()] || 0;
  }
  function todayMinutes(){
    return Math.floor(todayMs() / 60000);
  }
  // Humanized for the Player Card stat: 0 → "—", sub-minute → "<1m",
  // under an hour → "42m", an hour+ → "1h 05m". Honest rounding: the floor
  // means the stat never claims a minute that wasn't played.
  function todayLabel(){
    const m = todayMinutes();
    if(m < 1) return (todayMs() > 0 || hydrated) ? "<1m" : "—";
    if(m < 60) return m + "m";
    return Math.floor(m / 60) + "h " + String(m % 60).padStart(2, "0") + "m";
  }

  function onVisChange(){
    if(document.hidden){
      // closing the lid: bank the elapsed visible time NOW, persist, stop
      const now = Date.now();
      const gap = now - lastTick;
      lastTick = now;
      if(gap > 0 && gap <= MAX_GAP_MS) accrue(gap);
      persist();
    } else {
      lastTick = Date.now(); // returning: the gap while hidden was never billed
    }
  }

  function onRollover(){
    try{ state.days = prune(state.days); persist(); }catch(e){}
  }

  async function init(){
    window.addEventListener("strip:daily-rollover", onRollover, { passive:true });
    document.addEventListener("visibilitychange", onVisChange);
    let res = null;
    try{ res = await StripDB.loadStateChecked(STORE_ID); }catch(e){ res = null; }
    if(res && res.status === "ok"){
      sanitize(res.data);
      hydrated = true;
    }
    // on a failed read we stay in-memory this session (XP/Daily/Depth's gate)
    lastTick = Date.now();
    timer = setInterval(tick, HEARTBEAT_MS);
    readyResolve();
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  return {
    whenReady: () => readyPromise,
    todayMs,
    todayMinutes,
    todayLabel,
    _internals: { accrue, tick, sanitize, HEARTBEAT_MS, MAX_GAP_MS, KEEP_DAYS },
  };
})();
