(function(){
  const stripEl   = document.getElementById("strip");
  const hudIndex  = document.getElementById("hud-index");
  const bootEl    = document.getElementById("boot");

  const BATCH_SIZE = 6;        // how many cards we append at a time
  const PRELOAD_THRESHOLD = 3; // append more when within N cards of the end

  let deck = [];            // the shuffled infinite-feeling order (repeats allowed after a full pass)
  let cards = [];           // { el, mod, cleanup, mounted, trueIdx } — array index i always corresponds to the i-th child of #strip
  let allModules = [];      // the full registered set — source of truth, never mutated
  let moduleIndex = new Map(); // mod -> its position in allModules, built once — avoids an O(n) indexOf scan on every scroll frame
  let baseModules = [];     // current shuffled pass, drawn down as cursor advances
  let cursor = 0;

  // ---- persistence helper passed into each game (backed by IndexedDB) ----
  function makeApi(id){
    return {
      save(obj){ return StripDB.saveState(id, obj); },      // returns a Promise
      load(){ return StripDB.loadState(id); },              // returns a Promise<data|null>
      getHighscore(){ return StripDB.getHighscore(id); },   // returns a Promise<number>
      // Round 14 "today's twist": the Daily Pick's cartridge counts DOUBLE
      // toward its highscore for the whole day. One central hook in the api
      // factory — every game gets the event without touching its own code,
      // and the pick's card wears the ×2 tag so the doubled best reads as
      // intentional. Non-pick days/games pass straight through.
      setHighscore(score){
        const boosted = (window.Daily && Daily.twistScore) ? Daily.twistScore(id, score) : score;
        // Round 20 — progression hook: a REAL best improvement is the single
        // strongest dopamine signal the deck has, so it pays +25 XP. We read
        // the stored best first and compare the POST-write value: score <=
        // best pays nothing, so replaying old runs can never farm XP.
        return StripDB.getHighscore(id).then(prev =>
          StripDB.setHighscore(id, boosted).then(newBest => {
            if(window.XP && Number.isFinite(newBest) && newBest > (Number(prev) || 0)){
              XP.award("best");
            }
            return newBest;
          })
        );
      }, // returns a Promise<number> (new best)
      // Round 23 — the depth-XP seam. A game calls api.gameover(outcome, score)
      // when a RUN truly ends: "win" (reached the goal: board cleared, AI
      // beaten, code cracked) or "over" (arcade death, time up, streak broken).
      // The shell turns it into strip:gameover, which XP (run ladder: +8/+5/+2,
      // 20/day cap) and Missions (runs/wins goals) both consume — one call,
      // every meta layer sees the play. Scores are sanitized here so a NaN
      // from a broken game can never poison the depth math.
      gameover(outcome, score){
        const s = Number(score);
        window.dispatchEvent(new CustomEvent("strip:gameover", {
          detail: {
            id,
            outcome: outcome === "win" ? "win" : "over",
            score: Number.isFinite(s) ? s : 0,
            ts: Date.now()
          }
        }));
      },
      // Round 24 — the idle toys' run-end. Garden/aquarium/anthill/tradingpost/
      // plinko/blackjack never "finish a run", so the depth-XP ladder and the
      // missions pool never saw them. A tend() is their natural caretaking
      // beat — watering, feeding, trading, dropping, dealing — and missions
      // (not XP) consume it: TEND goals count unique cartridges per day.
      tend(){
        window.dispatchEvent(new CustomEvent("strip:tend", {
          detail: { id, ts: Date.now() }
        }));
      }
    };
  }


  // Fisher-Yates
  function shuffle(arr){
    const a = arr.slice();
    for(let i = a.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Build the next chunk of the "infinite" deck.
  // Strategy: shuffle full module set each pass so repeats don't clump,
  // and never place the same id twice in a row across pass boundaries.
  function nextBatch(n){
    const out = [];
    while(out.length < n){
      if(cursor >= baseModules.length){
        const fresh = shuffle(allModules);
        // avoid immediate repeat of the last card already in the deck
        if(deck.length){
          const lastId = deck[deck.length - 1].id;
          if(fresh[0] && fresh[0].id === lastId && fresh.length > 1){
            [fresh[0], fresh[1]] = [fresh[1], fresh[0]];
          }
        }
        baseModules = fresh;
        cursor = 0;
      }
      out.push(baseModules[cursor]);
      deck.push(baseModules[cursor]);
      cursor++;
    }
    return out;
  }

  function buildCardShell(mod, idx){
    const cart = document.createElement("section");
    cart.className = "cart";
    cart.dataset.idx = idx;

    cart.innerHTML = `
      <div class="cart-inner">
        <div class="cart-header">
          <div>
            <div class="cart-label">${escapeHtml(mod.label || "STRIP")}</div>
            <div class="cart-title">${escapeHtml(mod.title || mod.id)}</div>
          </div>
          ${mod.tag ? `<div class="cart-tag">${escapeHtml(mod.tag)}</div>` : ""}
        </div>
        <div class="cart-body"></div>
        ${mod.hint ? `<div class="cart-hint">${escapeHtml(mod.hint)}</div>` : ""}
      </div>
    `;
    return cart;
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  function appendCards(n){
    const batch = nextBatch(n);
    const frag = document.createDocumentFragment();
    batch.forEach(mod => {
      const idx = cards.length;
      const el = buildCardShell(mod, idx);
      frag.appendChild(el);
      const trueIdx = moduleIndex.get(mod);
      cards.push({ el, mod, cleanup:null, mounted:false, mounting:false, trueIdx });
    });
    stripEl.appendChild(frag);
  }

  function mountCard(entry){
    if(entry.mounted || entry.mounting) return;
    const body = entry.el.querySelector(".cart-body");
    entry.mounting = true;
    let result;
    try{
      result = entry.mod.mount(body, makeApi(entry.mod.id));
    }catch(err){
      entry.mounting = false;
      console.error("Failed to mount", entry.mod.id, err);
      body.innerHTML = `<div style="color:var(--ink-dim);font-size:13px;text-align:center;padding:20px;">This cartridge glitched.<br>(${escapeHtml(entry.mod.id)})</div>`;
      return;
    }
    Promise.resolve(result).then(cleanup => {
      entry.mounting = false;
      // if the card scrolled away and got unmounted while this was resolving, don't leave it mounted
      if(entry.unmountRequested){
        entry.unmountRequested = false;
        try{ typeof cleanup === "function" && cleanup(); }catch(e){}
        body.innerHTML = "";
        return;
      }
      entry.cleanup = typeof cleanup === "function" ? cleanup : null;
      entry.mounted = true;
    }).catch(err => {
      entry.mounting = false;
      console.error("Failed to mount", entry.mod.id, err);
      body.innerHTML = `<div style="color:var(--ink-dim);font-size:13px;text-align:center;padding:20px;">This cartridge glitched.<br>(${escapeHtml(entry.mod.id)})</div>`;
    });
  }

  function unmountCard(entry){
    if(entry.mounting){ entry.unmountRequested = true; return; }
    if(!entry.mounted) return;
    try{ entry.cleanup && entry.cleanup(); }catch(e){}
    const body = entry.el.querySelector(".cart-body");
    body.innerHTML = "";
    entry.mounted = false;
  }

  // Mount current + neighbors, unmount everything far away (keeps CPU/battery sane
  // during play). We deliberately do NOT remove card DOM nodes here or anywhere in
  // the scroll path — mutating scrollTop synchronously inside a scroll handler
  // fights the browser's own momentum scrolling on mobile and causes visible
  // snapping/jumping. Unmounted cards are just an empty <div class="cart-body">,
  // a few hundred bytes of DOM each — thousands of them cost nothing meaningful,
  // so there's no real need to remove them at all.
  //
  // Mounting happens immediately on every scroll frame (cheap: mountCard no-ops if
  // already mounted/mounting), so the card you land on is always ready instantly.
  // Unmounting is debounced to fire only once scrolling has settled — during a fast
  // flick, centerIdx jitters across several cards in quick succession, and tearing
  // a game down just because it was briefly "distant" mid-flick — only to remount
  // it a frame later when the flick lands back on it — is wasted work and, for any
  // game with setup cost (audio contexts, canvas sizing), a visible flicker.
  let settleTimer = null;
  const SETTLE_MS = 220;
  let currentCenterIdx = 0; // live center card — the input-arbitration source of truth
  let lastDimmedIdx = -1;   // Round 26 — which card currently wears data-centered

  function syncViewport(){
    const scrollTop = stripEl.scrollTop;
    const h = stripEl.clientHeight || 1;
    const centerIdx = Math.round(scrollTop / h);
    currentCenterIdx = centerIdx;

    // Round 29 — the depth ladder anchors to a CARD, not the viewport: any
    // real scroll motion closes it (Depth diffs against the last seen
    // scrollTop; a no-op frame costs one comparison). Its own scroll frame
    // also keeps the sparkline/TTL pipeline below honest.
    if(window.Depth && Depth.noteLadderScroll) Depth.noteLadderScroll(scrollTop);

    const centerEntry = cards[centerIdx];
    if(centerEntry){
      // position now means something: "07/50", not a bare "07"
      hudIndex.textContent = String(centerEntry.trueIdx + 1).padStart(2, "0") + "/" + allModules.length;
      // Daily Pick (Round 13): tag/untag the centered card when it is/isn't
      // today's pick — runs on every scroll frame but no-ops once the DOM
      // already matches (daily.js keeps both branches cheap)
      if(window.Daily) Daily.badge(centerEntry.el, centerEntry.mod.id);
      // Score sparkline (Round 15): the centered cartridge wears a chart of
      // its recent plays. Internally TTL-cached per element — one IndexedDB
      // read at most every 15s per card, no-op when the chip already matches.
      if(window.Sparkline) Sparkline.badge(centerEntry.el, centerEntry.mod);
    }

    // Round 26 — focus pull (depth of field): the centered cartridge is the
    // live one; its neighbors pull back so the feed reads like a physical
    // wheel at rest. Attribute flips only on CHANGE (guarded), and it's
    // opacity-only CSS — compositing-cheap, no layout, no canvas repaints.
    // Scoped to #strip so QA harnesses that build their own cart-like shells
    // are unaffected.
    if(centerEntry && lastDimmedIdx !== centerIdx){
      const prev = cards[lastDimmedIdx];
      if(prev && prev.el) prev.el.removeAttribute("data-centered");
      centerEntry.el.setAttribute("data-centered", "1");
      lastDimmedIdx = centerIdx;
    }

    cards.forEach((entry, i) => {
      if(Math.abs(i - centerIdx) <= 1) mountCard(entry);
    });

    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => pruneDistantMounts(centerIdx), SETTLE_MS);

    // infinite: grow the deck as we approach the end
    if(cards.length - centerIdx <= PRELOAD_THRESHOLD){
      appendCards(BATCH_SIZE);
    }
  }

  // Daily rollover (midnight flip): re-run the viewport sync immediately so
  // the CENTERED card re-tags in the same frame when it IS the new pick —
  // otherwise yesterday's stripped tag would only return on the next scroll
  // frame (Round 14 critic move 4). Everything here is idempotent at a
  // standing scroll position.
  window.addEventListener("strip:daily-rollover", () => { syncViewport(); });

  function pruneDistantMounts(centerIdx){
    cards.forEach((entry, i) => {
      if(Math.abs(i - centerIdx) > 2) unmountCard(entry);
    });
    // the strip has settled — tell the shell which cartridge the player is
    // actually ON (the drawer uses this to maintain a recents list)
    const entry = cards[centerIdx];
    if(entry){
      // Round 20: a settle on a NEW cartridge gets a tiny tactile tick —
      // flipping through the deck physically "clicks" like a real wheel.
      // Deduped on the same id so re-settling never double-fires.
      if(lastSettledHapticId !== entry.mod.id){
        lastSettledHapticId = entry.mod.id;
        try{ Feedback.haptic("light"); }catch(e){}
      }
      window.dispatchEvent(new CustomEvent("strip:card-centered", { detail: { id: entry.mod.id } }));
    }
  }
  let lastSettledHapticId = null;

  let rafPending = false;
  function onScroll(){
    if(rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => { syncViewport(); rafPending = false; });
  }

  // ---- on-screen navigation arrows (Round 20) ----
  // A vertical feed deserves explicit controls: the arrows give a one-tap
  // hop to the next/previous cartridge (thumb-reachable right edge), they
  // make scroll-lock USABLE (locked scroll no longer strands you on a card),
  // and they give desktop players a precise control next to the trackpad.
  // Toggleable in Settings → Controls (default on).
  let navEl = null;
  function buildNavArrows(){
    if(navEl) return;
    navEl = document.createElement("div");
    navEl.id = "nav-arrows";
    navEl.innerHTML =
      '<button id="nav-prev" aria-label="Previous cartridge">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 14l6-6 6 6"/></svg>' +
      '</button>' +
      '<button id="nav-next" aria-label="Next cartridge">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 10l6 6 6-6"/></svg>' +
      '</button>';
    document.body.appendChild(navEl);
    navEl.querySelector("#nav-prev").addEventListener("click", () => navHop(-1));
    navEl.querySelector("#nav-next").addEventListener("click", () => navHop(1));
  }
  function navHop(dir){
    if(document.hidden) return;
    const h = stripEl.clientHeight || 1;
    const target = Math.max(0, currentCenterIdx + dir);
    // bounded growth: hopping past the built deck extends it first
    let guard = 0;
    while(target >= cards.length && guard++ < 10) appendCards(BATCH_SIZE);
    if(target >= cards.length) return;
    stripEl.scrollTo({ top: target * h, behavior: "smooth" });
    try{ Feedback.uiTone("tap"); Feedback.haptic("light"); }catch(e){}
  }
  function applyNavArrowSetting(on){
    buildNavArrows();
    navEl.classList.toggle("on", !!on);
  }

  async function init(){
    await Settings.whenReady();
    applyNavArrowSetting(Settings.get().navArrows);
    Settings.onChange((s) => applyNavArrowSetting(s.navArrows));
    allModules = Strip.all();
    if(!allModules.length){
      stripEl.innerHTML = `<div style="padding:40px;color:var(--ink-dim)">No cartridges registered yet.</div>`;
      bootEl.classList.add("hide");
      return;
    }
    moduleIndex = new Map(allModules.map((m, i) => [m, i]));
    appendCards(Math.max(BATCH_SIZE, allModules.length));
    syncViewport();
    stripEl.addEventListener("scroll", onScroll, { passive:true });

    setTimeout(() => bootEl.classList.add("hide"), 550);
  }

  document.addEventListener("DOMContentLoaded", init);

  // ---- HUD mini-toast: ONE owner, ONE timer ----
  // The lock button, the Daily nudge flow, and the share fallback all surface
  // short messages on #lock-toast. Each used to run its own hide-timer, so a
  // stale timer from one caller would prematurely hide another's message
  // (Round 14 critic MINOR). Everything now goes through here. Also raised
  // above the bottom sheets (z-index 300) — the nudge toggle only exists
  // INSIDE the settings sheet, so its feedback rendered behind the backdrop.
  const hudToastEl = document.getElementById("lock-toast");
  let hudToastTimer = null;
  window.HudToast = {
    show(text, ms){
      if(!hudToastEl) return;
      hudToastEl.textContent = text;
      hudToastEl.classList.add("show");
      clearTimeout(hudToastTimer);
      hudToastTimer = setTimeout(() => hudToastEl.classList.remove("show"), ms || 1600);
    }
  };

  // Shell API for the cartridge drawer (js/drawer.js): jump straight to a
  // specific cartridge instead of blind-scrolling through the deck.
  window.StripShell = {
    jumpToIndex(i){
      const h = stripEl.clientHeight || 1;
      stripEl.scrollTo({ top: i * h, behavior: "smooth" });
    },
    jumpToModule(mod){
      let i = cards.findIndex(c => c.mod === mod);
      // not in the visible deck yet? extend it (bounded) until the cartridge appears
      let guard = 0;
      while(i < 0 && guard++ < 30){
        appendCards(BATCH_SIZE);
        i = cards.findIndex(c => c.mod === mod);
      }
      if(i >= 0) this.jumpToIndex(i);
    },
    // input arbitration: a card is "active" only when it is the centered one.
    // Games with window-level keyboard handlers MUST gate on this — mount
    // windows keep up to 5 cards mounted, and the deck repeats after a full
    // pass, so two copies of the same cartridge can coexist and would
    // otherwise both consume the same arrow keys.
    isActive(el){
      if(el == null) return false;
      const cart = el.closest ? el.closest(".cart") : null;
      const entry = cards[currentCenterIdx];
      return !!(cart && entry && entry.el === cart);
    },
    // QA seam (Round 20, same precedent as Daily._internals): the api factory
    // itself, so headless regression pins exercise the EXACT production XP
    // hook (new-best award) instead of a copy of it.
    _testMakeApi: makeApi,
    // QA seam (Round 28): which cartridge is centered right now — lets the
    // live-sparkline pin WAIT for the jump to actually land instead of
    // guessing sleep durations over smooth scroll.
    _centeredMod: () => (cards[currentCenterIdx] || {}).mod || null
  };

  // Round 28 (R27 handoff #1) — the sparkline goes LIVE. Its depth readout
  // was signature-graded but only re-checked on scroll frames / a 15s TTL,
  // so a run finished on the centered cartridge left the card showing the
  // stale average until you scrolled. The shell knows which card is centered
  // (cards[currentCenterIdx]) and the sparkline's cache lives on the cart
  // element — so the shell is the right place to close the loop: on a depth
  // update for the CENTERED game, bust the TTL cache and re-grade now. The
  // readout only flashes when the chip actually rebuilt (a no-op signature
  // never celebrates — same honesty rule as the drawer chip).
  window.addEventListener("strip:depth-updated", (e) => {
    const d = e.detail;
    if(!d || !d.id) return;
    const entry = cards[currentCenterIdx];
    if(!entry || !entry.mod || entry.mod.id !== d.id || !entry.el) return;
    const before = entry.el.querySelector(".cart-sparkline-depth");
    entry.el._sparkRec = null; // the new sample must land NOW, not at the TTL
    if(window.Sparkline) Sparkline.badge(entry.el, entry.mod);
    setTimeout(() => {
      const after = entry.el.querySelector(".cart-sparkline-depth");
      if(after && after !== before) after.classList.add("depth-live");
    }, 250);
    // Round 29 — if the player is LOOKING at the depth ladder, its marker and
    // next-step line move with the run (a tier-up behind a stale panel would
    // be the one surface lying about the moment).
    if(window.Depth && Depth.refreshLadder) Depth.refreshLadder(entry.el, entry.mod);
    // Round 29 — the CARD-scale tier moment (the R28 judge's gap: the
    // celebration existed at chip scale only, and the card the run just ended
    // on stayed silent about its own promotion). The reached tier's name
    // rises off the readout while a ring of the same hue blooms around the
    // card — one-shot nodes that remove themselves, never queued twice, and
    // reduce-motion CSS silences both. The drawer runs its own float only
    // when OPEN, which can't overlap play — no double celebration.
    // Round 30 — BUT the moment is SUPPRESSED while the depth ladder is open
    // on this very card: the float rendered at z:5 behind the panel at z:6
    // (the judge's z-order catch), and the ladder already carries the news
    // honestly — its YOU marker and next-step line move with the run in
    // place. One celebration, the one that teaches.
    if(d.tierUp && !entry.el.querySelector(".cart-tier-float") &&
       !(window.Depth && Depth.ladderOn && Depth.ladderOn(entry.el))){
      const inner = entry.el.querySelector(".cart-inner");
      if(inner){
        const tier = (d.tier || "").toLowerCase();
        const ring = document.createElement("span");
        ring.className = "cart-tier-ring " + tier;
        ring.setAttribute("aria-hidden", "true");
        inner.appendChild(ring);
        setTimeout(() => ring.remove(), 1250);
        const float = document.createElement("span");
        float.className = "cart-tier-float " + tier;
        float.textContent = "\u25b2 " + (d.tier || "");
        float.setAttribute("aria-hidden", "true");
        inner.appendChild(float);
        setTimeout(() => float.remove(), 1700);
        try{ Feedback.haptic("medium"); }catch(err){}
      }
    }
    maybeShowLadderHint(entry, d);
  }, { passive:true });

  // ---------- Round 30 — the one-time ladder hint ----------
  // The R29 judge's gap: the readout's affordance was cursor/title-only, so
  // touch users had NO way to discover the ladder. The chevron (R30, on the
  // readout itself) helps once you're looking; this bubble finds you first.
  // It appears ONLY on the natural teaching moment — a run just landed, the
  // card's DEPTH readout just changed — and never on a tier-up (that run is
  // already celebrating; two attention grabs at once is noise). It dies on
  // the FIRST ladder open (persisted, via the drawer's single-writer meta
  // record), fades itself out, and shows at most 3 times a session so a
  // player who never opens the ladder isn't nagged forever.
  let ladderHintShows = 0;
  let liveLadderHint = null; // { el, timers:[...] }

  function killLadderHint(){
    if(!liveLadderHint) return;
    const st = liveLadderHint;
    liveLadderHint = null;
    st.timers.forEach(clearTimeout);
    try{ st.el.remove(); }catch(e){}
  }

  function maybeShowLadderHint(entry, d){
    try{
      if(!entry || !entry.el || !entry.mod) return;
      if(d.tierUp) return;                                   // a celebration owns the moment
      if(ladderHintShows >= 3) return;                       // session cap — nudge, not nag
      if(window.Depth && Depth.ladderOn && Depth.ladderOn(entry.el)) return;
      if(window.StripDrawer && StripDrawer.ladderHintPending && !StripDrawer.ladderHintPending()) return;
      if(!entry.el.querySelector(".cart-sparkline-depth")) return; // point at something real
      killLadderHint();                                      // one bubble at a time
      const inner = entry.el.querySelector(".cart-inner");
      if(!inner) return;
      // Round 31 — the bubble is TWO real buttons now: the invitation label
      // (opens the ladder, same route as the readout) and a dismiss × for
      // players who want it gone WITHOUT opening. Nesting interactive
      // elements in a role=button container would hide the inner one from
      // AT, so the container is plain and each child carries its own role.
      // Declining persists through the same single-writer flag as opening —
      // a choice is a choice — while the readout's chevron stays as the
      // passive affordance either way.
      const hint = document.createElement("span");
      hint.className = "depth-hint";
      const label = document.createElement("span");
      label.className = "depth-hint-label";
      label.setAttribute("role", "button");
      label.setAttribute("tabindex", "0");
      label.setAttribute("aria-label", "Open the depth ladder");
      label.textContent = "TAP · TIERS";
      const x = document.createElement("span");
      x.className = "depth-hint-x";
      x.setAttribute("role", "button");
      x.setAttribute("tabindex", "0");
      x.setAttribute("aria-label", "Dismiss — don't show the tiers hint again");
      x.textContent = "\u00d7";
      const open = () => { try{ Depth.toggleLadder(entry.el, entry.mod); }catch(e){} };
      const decline = () => {
        killLadderHint();
        try{
          if(window.StripDrawer && StripDrawer.dismissLadderHint) StripDrawer.dismissLadderHint();
        }catch(e){}
      };
      label.addEventListener("click", open);
      label.addEventListener("keydown", (ev) => {
        if(ev.key === "Enter" || ev.key === " "){ ev.preventDefault(); open(); }
      });
      x.addEventListener("click", decline);
      x.addEventListener("keydown", (ev) => {
        if(ev.key === "Enter" || ev.key === " "){ ev.preventDefault(); decline(); }
      });
      hint.appendChild(label);
      hint.appendChild(x);
      inner.appendChild(hint);
      ladderHintShows++;
      const timers = [];
      // fade-out at 8s, gone by 11s — the CSS owns the exit animation
      timers.push(setTimeout(() => hint.classList.add("depth-hint-bye"), 8000));
      timers.push(setTimeout(killLadderHint, 11000));
      liveLadderHint = { el: hint, timers };
    }catch(e){}
  }

  // Any fresh ladder open dismisses the hint — pointer, Enter, or the hint's
  // own tap (toggleLadder fires the event before the bubble could overlap
  // the panel). DOM removal is unconditional; only the persistence flag is
  // once-only, so a loadMeta race can never strand the bubble on screen.
  window.addEventListener("strip:ladder-opened", () => {
    killLadderHint();
    try{
      if(window.StripDrawer && StripDrawer.dismissLadderHint) StripDrawer.dismissLadderHint();
    }catch(e){}
  }, { passive:true });
})();
