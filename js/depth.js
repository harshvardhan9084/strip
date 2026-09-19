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
    // Round 32 — RECENCY WEIGHT once the ring is deep enough. The split-half
    // delta treats a run from eight games ago exactly like yesterday's; at
    // n >= TREND_WEIGHTED_MIN the ring carries enough history for the honest
    // question to change from "did the second half land deeper" to "does the
    // weighted-recent picture sit above the ring's own baseline". Weights
    // decay by TREND_DECAY per sample of age (newest weight 1, each older
    // sample × .85) — a smooth exponential, not a second hard split. Below
    // the weighted floor the split-half math is UNCHANGED, so the R28 pins
    // (n = 3/4/8) keep meaning exactly what they meant.
    if(n >= TREND_WEIGHTED_MIN){
      let wSum = 0, wVal = 0, pSum = 0;
      for(let i = 0; i < n; i++){
        const age = n - 1 - i;              // 0 = newest
        const w = Math.pow(TREND_DECAY, age);
        wSum += w; wVal += w * arr[i];
        pSum += arr[i];
      }
      const delta = Math.round((wVal / wSum) - (pSum / n));
      if(delta >= TREND_THRESHOLD) return { dir: "up", delta, weighted: true };
      if(delta <= -TREND_THRESHOLD) return { dir: "down", delta, weighted: true };
      return { dir: "flat", delta, weighted: true };
    }
    const half = Math.ceil(n / 2);
    const older = arr.slice(0, n - half);
    const recent = arr.slice(n - half);
    const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
    const delta = Math.round(mean(recent) - mean(older));
    if(delta >= TREND_THRESHOLD) return { dir: "up", delta };
    if(delta <= -TREND_THRESHOLD) return { dir: "down", delta };
    return { dir: "flat", delta };
  }
  // Round 32 — the weighted regime's own constants (public via _internals so
  // the suite pins the EXACT production math instead of a copy).
  const TREND_WEIGHTED_MIN = 12; // ring depth where recency weighting kicks in
  const TREND_DECAY = 0.85;      // weight multiplier per sample of age

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

  // ---------- Round 29 — the depth ladder popover ----------
  // The centered card's DEPTH readout answers "how deep, usually"; the drawer
  // chips grade it in the league's vocabulary. But NEITHER surface explains
  // the vocabulary itself — what PLASMA means, how far the next tier sits.
  // The readout becomes a real affordance: tap it and the ladder opens right
  // where the number lives, your position marked. Built FRESH on every
  // open/refresh from live Depth data (never a snapshot — a run that lands
  // while the ladder is open must move the marker), closed by Esc, an outside
  // tap, or scrolling the deck. No data → the readout doesn't exist → the
  // ladder can't either (absent = honest, everywhere).
  function ladderPanel(mod){
    const avg = avgFor(mod.id);
    if(avg == null) return null;
    const n = countFor(mod.id);
    const cur = tierFor(avg);
    const panel = document.createElement("div");
    // Round 32 — the panel wears the CURRENT tier's class, so its header and
    // top hairline re-grade in the league hue the player is actually holding
    // (one more surface speaking the one vocabulary; CSS keys off .t-*).
    panel.className = "depth-ladder " + cur.cls;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Depth ladder — " + (mod.title || mod.id));
    // tabindex=0 (not the popover-typical -1): programmatic focus must work
    // everywhere — focus parity is pinned by the QA suite, and a dialog that
    // can't receive focus strands keyboard users behind their own tap.
    panel.tabIndex = 0;
    // ascending = the climb the player actually experiences
    const rows = [...TIERS].reverse();
    let html = '<div class="ladder-head">DEPTH LADDER</div>' +
      '<div class="ladder-sub">avg of your last ' + n + ' finished run' + (n === 1 ? '' : 's') +
      ' vs your own best</div>';
    for(const t of rows){
      const on = t.name === cur.name;
      html += '<div class="ladder-row ' + t.cls + (on ? ' on' : '') + '">' +
        '<i></i><span class="ladder-name">' + t.name + '</span>' +
        '<span class="ladder-min">' + (t.min > 0 ? '\u2265' + t.min + '%' : 'any run') + '</span>' +
        (on ? '<b class="ladder-you">YOU ' + avg + '%</b>' : '') +
        '</div>';
    }
    // the honest next step: distance in real points, or the top-tier nod
    const next = [...TIERS].reverse().find(t => avg < t.min);
    const gap = next ? next.min - avg : 0;
    html += '<div class="ladder-next">' + (next
      ? gap + ' point' + (gap === 1 ? '' : 's') + ' to ' + next.name
      : 'top tier — hold it') + '</div>';
    panel.innerHTML = html;
    return panel;
  }

  // One ladder open at a time, module-tracked so app.js's scroll frames and
  // sparkline rebuilds can talk to it without owning DOM state.
  let ladderState = null; // { cart, panel, mod, onDocDown, onKey }
  let lastScrollSeen = null;

  function closeLadders(opts){
    if(!ladderState) return;
    const st = ladderState;
    ladderState = null;
    try{ st.panel.remove(); }catch(e){}
    try{
      const btn = st.cart && st.cart.querySelector(".cart-sparkline-depth");
      if(btn) btn.setAttribute("aria-expanded", "false");
    }catch(e){}
    document.removeEventListener("pointerdown", st.onDocDown, true);
    window.removeEventListener("keydown", st.onKey, true);
    // focus returns to the handle for keyboard parity — but never yank it
    // when the close was caused by motion (scroll) or a wiped record
    if(opts && opts.restoreFocus === false) return;
    try{
      const btn = st.cart && st.cart.querySelector(".cart-sparkline-depth");
      if(btn && btn.focus) btn.focus({ preventScroll: true });
    }catch(e){}
  }

  // Round 30 — "is a ladder open on THIS card right now?" The shell needs
  // exactly one boolean for two contracts: suppress the card-scale tier
  // float while the ladder is open (the panel IS the celebration there —
  // its marker and next-step line move with the run), and re-sync a rebuilt
  // sparkline's aria-expanded so the fresh handle doesn't claim "closed"
  // while the panel it owns is on screen.
  function ladderOn(cartEl){
    return !!(ladderState && cartEl && ladderState.cart === cartEl);
  }

  function toggleLadder(cartEl, mod){
    if(!cartEl || !mod) return;
    if(ladderState && ladderState.cart === cartEl){ closeLadders(); return; }
    closeLadders({ restoreFocus: false });
    const panel = ladderPanel(mod);
    if(!panel) return;
    const inner = cartEl.querySelector(".cart-inner") || cartEl;
    inner.appendChild(panel);
    const btn = cartEl.querySelector(".cart-sparkline-depth");
    if(btn) btn.setAttribute("aria-expanded", "true");
    const onDocDown = (e) => {
      if(!ladderState) return;
      if(!panel.contains(e.target) && e.target !== btn) closeLadders({ restoreFocus: false });
    };
    const onKey = (e) => { if(e.key === "Escape") closeLadders(); };
    document.addEventListener("pointerdown", onDocDown, true);
    window.addEventListener("keydown", onKey, true);
    ladderState = { cart: cartEl, panel, mod, onDocDown, onKey };
    // Round 30 — the deck bus hears about every FRESH open (refreshes don't
    // re-fire it): the shell dismisses the one-time ladder hint on the first
    // open, wherever the open came from — pointer, Enter, or the hint itself.
    try{
      window.dispatchEvent(new CustomEvent("strip:ladder-opened", { detail:{ id: mod.id } }));
    }catch(e){}
    // focus moves in for keyboard parity — immediately (headless pages
    // throttle rAF, and a focus that only fires on a rendered frame is a
    // focus that sometimes never happens), then again post-layout as a
    // belt-and-braces for the same-frame layout race.
    try{ panel.focus({ preventScroll: true }); }catch(e){}
    requestAnimationFrame(() => { try{ panel.focus({ preventScroll: true }); }catch(e){} });
  }

  // A run landed while the player is LOOKING at the ladder — the marker and
  // the next-step line must move with it (the exact moment this panel exists
  // for). Rebuilds from live data; a vanished record closes it instead.
  function refreshLadder(cartEl, mod){
    if(!ladderState || !cartEl || ladderState.cart !== cartEl) return;
    const fresh = ladderPanel(mod);
    if(!fresh){ closeLadders({ restoreFocus: false }); return; }
    try{ ladderState.panel.replaceWith(fresh); }catch(e){ return; }
    ladderState.panel = fresh;
    const btn = cartEl.querySelector(".cart-sparkline-depth");
    if(btn){ btn.setAttribute("aria-expanded", "true"); }
  }

  // Called by app.js on every scroll frame with the strip's scrollTop: ANY
  // real movement closes the ladder — a popover that drifts off its anchor
  // is noise, and its anchor is a card, not the viewport.
  function noteLadderScroll(scrollTop){
    if(ladderState && lastScrollSeen != null && Math.abs(scrollTop - lastScrollSeen) > 1){
      closeLadders({ restoreFocus: false });
    }
    lastScrollSeen = scrollTop;
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
    // Round 29 — one tier vocabulary, public: the sparkline readout wears the
    // tier hue, and the ladder popover reads the thresholds straight from
    // TIERS instead of copying numbers.
    tierFor,
    tiers: TIERS,
    toggleLadder,
    refreshLadder,
    closeLadders,
    ladderOn,
    noteLadderScroll,
    _internals: { record, sanitize, SAMPLES, TIERS, tierFor, pruneGhosts,
                  TREND_MIN_SAMPLES, TREND_THRESHOLD,
                  TREND_WEIGHTED_MIN, TREND_DECAY },
  };
})();
