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
    const arr = state.games[id] || (state.games[id] = []);
    arr.push(Math.min(100, Math.round((score / best) * 100)));
    if(arr.length > SAMPLES) state.games[id] = arr.slice(-SAMPLES);
    persist();
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

  // ---------- drawer chip ----------
  // Inserted BEFORE the star so the row keeps its anatomy (main · depth · ★).
  // No data → no chip: an absent chip can't lie, same rule as the league row.
  function decorateDrawerItem(row, id){
    const avg = avgFor(id);
    if(avg == null) return;
    const tier = tierFor(avg);
    const n = countFor(id);
    const chip = document.createElement("span");
    chip.className = "drawer-item-depth " + tier.cls;
    chip.innerHTML = "<i></i>" + avg + "%";
    chip.title = "Depth: your last " + n + " finished run" + (n === 1 ? "" : "s") +
      " averaged " + avg + "% of your own best — " + tier.name + " tier";
    chip.setAttribute("role", "img");
    chip.setAttribute("aria-label", chip.title);
    const star = row.querySelector(".drawer-item-fav");
    if(star) row.insertBefore(chip, star);
    else row.appendChild(chip);
  }

  async function init(){
    window.addEventListener("strip:gameover", onGameOver, { passive:true });
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
    decorateDrawerItem,
    _internals: { record, sanitize, SAMPLES, TIERS, tierFor },
  };
})();
