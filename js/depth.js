/**
 * STRIP — Per-Cartridge Depth (Round 26)
 * --------------------------------------
 * The Depth League (Round 25) tells the WHOLE-DECK story on the Player Card:
 * how deep your finished runs land on average, everywhere. This module tells
 * the PER-CARTRIDGE story the league can't: in Snake specifically, how close
 * do your runs typically land to YOUR Snake best? Surfaced where the question
 * actually comes up — the drawer row, right next to the cartridge you're
 * deciding to open — as a small tiered chip (PAPER/NEON/PHOSPHOR/PLASMA/
 * SUPERNOVA, the league's own thresholds), plus a DEPTH readout on the
 * centered card's sparkline chip.
 *
 * The contract matches XP.recordDepthSample exactly (one source of truth for
 * what a "depth sample" is):
 *   - only "over" runs sample — a win IS the goal, there's no edge to measure
 *   - the run needs a real best (> 0) and a real score (> 0) to mean anything
 *   - sample = min(100, round(score / best * 100)); ring of the last 40
 *   - inverted-encoding games (codebreaker/lightsout/maze/memorymatch/
 *     minesweeper/minisudoku/slidepuzzle) emit ONLY "win" gameovers, so they
 *     can never poison the ratio with the inverted scale — safe by design
 *
 * Data persists under the reserved id "__depth__" (the "__" prefix can never
 * collide with a game id), so export/import ride StripDB naturally. Same
 * disk-write gate as XP/Daily: a failed boot read keeps the session
 * in-memory rather than letting defaults overwrite a real record.
 */
window.Depth = (function(){
  const STORE_ID = "__depth__";
  const SAMPLES = 40;

  let state = { games: {} };
  let hydrated = false;
  let readyResolve;
  const readyPromise = new Promise(res => { readyResolve = res; });

  function persist(){
    if(!hydrated) return; // defaults must never overwrite a record we couldn't read
    StripDB.saveState(STORE_ID, state).catch(() => {});
  }

  // Hostile-save hygiene: whatever was on disk becomes numbers in [0,100],
  // capped per game, with junk entries dropped and empty games removed.
  // typeof check FIRST: Number(null)/Number("") are 0, not NaN — a loose
  // map(Number) would turn junk into real (zero) samples.
  function sanitize(raw){
    const src = raw && typeof raw.games === "object" ? raw.games : {};
    const out = {};
    for(const id in src){
      const arr = src[id];
      if(!Array.isArray(arr)) continue;
      const clean = arr.filter(v => typeof v === "number" && Number.isFinite(v))
        .map(n => Math.max(0, Math.min(100, Math.round(n))))
        .slice(-SAMPLES);
      if(clean.length) out[id] = clean;
    }
    state = { games: out };
  }

  function record(id, score, best){
    if(!id || typeof id !== "string") return;
    if(!(best > 0) || !Number.isFinite(score) || score <= 0) return;
    // Round 27 — capture the pre-run average BEFORE the sample lands, so the
    // live-refresh event can tell the drawer whether this run just crossed a
    // tier boundary (the first data point never celebrates: no "before" means
    // no story about movement, just a fact appearing).
    const before = avgFor(id);
    const arr = state.games[id] || (state.games[id] = []);
    arr.push(Math.min(100, Math.round((score / best) * 100)));
    if(arr.length > SAMPLES) state.games[id] = arr.slice(-SAMPLES);
    persist();
    // Round 27 — the drawer re-grades JUST the affected row's chip from this
    // event (R26 handoff #1: chips used to snapshot at drawer-open, so a run
    // finished while browsing left the row stale until the next open).
    try{
      const after = avgFor(id);
      const rank = (t) => TIERS.indexOf(t);
      const tierUp = before != null && after != null &&
        rank(tierFor(after)) < rank(tierFor(before));
      window.dispatchEvent(new CustomEvent("strip:depth-updated", {
        detail: { id, avg: after, count: countFor(id), tierUp,
                  tier: tierFor(after).name }
      }));
    }catch(e){}
  }

  // ---------- Round 27 — ghost-id pruning (safe at rollover) ----------
  // Depth keys are game ids; when a cartridge is renamed or removed, its
  // samples survive as ghosts that no row will ever render — dead weight in
  // the store, the export file, and the future DEEP sort. Boot-time pruning
  // stays UNSAFE (script order: depth.js initializes before games register,
  // so an early registry read would wipe everything — the R26 analysis), but
  // strip:daily-rollover fires only after the async boot chain, by which
  // point the synchronous game scripts have long registered. Guarded anyway:
  // pruning runs only when the registry is non-empty AND the session is
  // hydrated, so a failed read can never erase real records.
  function pruneGhosts(){
    if(!hydrated) return [];
    if(!window.Strip || typeof Strip.all !== "function") return [];
    const known = new Set(Strip.all().map(m => m.id));
    if(!known.size) return []; // empty registry = registry not loaded yet
    const removed = [];
    for(const id in state.games){
      if(!known.has(id)){ removed.push(id); delete state.games[id]; }
    }
    if(removed.length) persist();
    return removed;
  }

  function avgFor(id){
    const arr = state.games[id];
    if(!Array.isArray(arr) || !arr.length) return null;
    return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  }
  function countFor(id){
    const arr = state.games[id];
    return Array.isArray(arr) ? arr.length : 0;
  }

  // ---------- Round 27 — trend: is the player landing DEEPER lately? ----------
  // The avg answers "how deep am I usually"; this answers "which way am I
  // moving" — the second question a player actually asks before opening a
  // cartridge. Honest by construction: the ring is split in half (recent
  // ⌈n/2⌉ vs the rest), and only a split with enough samples on both sides
  // (n >= 4 → at least 2 per half) may speak. A |delta| under the threshold
  // is a FLAT trend — reported as flat, never dressed up as movement.
  const TREND_MIN_SAMPLES = 4;   // at least 2 per half
  const TREND_THRESHOLD  = 3;    // percentage points that count as movement
  function trendFor(id){
    const arr = state.games[id];
    if(!Array.isArray(arr) || arr.length < TREND_MIN_SAMPLES) return null;
    const n = arr.length;
    const half = Math.ceil(n / 2);
    const older = arr.slice(0, n - half);
    const recent = arr.slice(n - half);
    const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
    const delta = Math.round(mean(recent) - mean(older));
    if(delta >= TREND_THRESHOLD) return { dir: "up", delta };
    if(delta <= -TREND_THRESHOLD) return { dir: "down", delta };
    return { dir: "flat", delta };
  }

  // The Player Card league's own thresholds (trophies.js) drive the chip's
  // tier — one vocabulary everywhere, never two names for the same number.
  const TIERS = [
    { min: 95, name: "SUPERNOVA", cls: "t-supernova" },
    { min: 80, name: "PLASMA",    cls: "t-plasma" },
    { min: 60, name: "PHOSPHOR",  cls: "t-phosphor" },
    { min: 40, name: "NEON",      cls: "t-neon" },
    { min: 0,  name: "PAPER",     cls: "t-paper" },
  ];
  function tierFor(avg){
    return TIERS.find(t => avg >= t.min) || TIERS[TIERS.length - 1];
  }

  function onGameOver(e){
    const d = e.detail;
    if(!d || !d.id || d.outcome !== "over") return;
    const score = Number(d.score);
    if(!Number.isFinite(score) || score <= 0) return;
    if(window.StripDB && StripDB.getHighscore){
      StripDB.getHighscore(d.id).then(best => record(d.id, score, best)).catch(() => {});
    }
  }

  // Round 27 — daily rollover is the one moment the registry is guaranteed
  // loaded (see pruneGhosts): retire ghost ids, keep the store honest.
  function onRollover(){
    try{ pruneGhosts(); }catch(e){}
  }

  // ---------- drawer chip ----------
  // Inserted BEFORE the star so the row keeps its anatomy (main · depth · ★).
  // No data → no chip: an absent chip can't lie, same rule as the league row.
  // Round 28 — the chip may also carry a trend arrow (↑/↓) when the recent
  // half of the ring really is landing deeper/shallower than the earlier
  // half; a flat trend stays bare (a quiet chip is an honest chip).
  function decorateDrawerItem(row, id){
    const avg = avgFor(id);
    if(avg == null) return;
    const tier = tierFor(avg);
    const n = countFor(id);
    const trend = trendFor(id);
    const chip = document.createElement("span");
    chip.className = "drawer-item-depth " + tier.cls;
    chip.innerHTML = "<i></i>" + avg + "%" +
      (trend && trend.dir !== "flat"
        ? '<b class="depth-trend trend-' + trend.dir + '" aria-hidden="true">' +
          (trend.dir === "up" ? "\u2191" : "\u2193") + "</b>"
        : "");
    chip.title = "Depth: your last " + n + " finished run" + (n === 1 ? "" : "s") +
      " averaged " + avg + "% of your own best — " + tier.name + " tier" +
      (trend && trend.dir !== "flat"
        ? " · recent runs landing " + (trend.dir === "up" ? "deeper" : "shallower") +
          " (" + (trend.dir === "up" ? "+" : "") + trend.delta + " vs earlier half)"
        : "");
    chip.setAttribute("role", "img");
    chip.setAttribute("aria-label", chip.title);
    const star = row.querySelector(".drawer-item-fav");
    if(star) row.insertBefore(chip, star);
    else row.appendChild(chip);
  }

  async function init(){
    window.addEventListener("strip:gameover", onGameOver, { passive:true });
    window.addEventListener("strip:daily-rollover", onRollover, { passive:true });
    let res = null;
    try{ res = await StripDB.loadStateChecked(STORE_ID); }catch(e){ res = null; }
    if(res && res.status === "ok"){
      sanitize(res.data);
      hydrated = true;
    }
    // on a failed read we stay in-memory this session (XP/Daily's gate)
    readyResolve();
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  return {
    whenReady: () => readyPromise,
    avgFor,
    countFor,
    trendFor,
    decorateDrawerItem,
    _internals: { record, sanitize, SAMPLES, TIERS, tierFor, pruneGhosts,
                  TREND_MIN_SAMPLES, TREND_THRESHOLD },
  };
})();
