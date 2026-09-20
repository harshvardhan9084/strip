/* ============================================================================
 * STRIP — CARTRIDGE TEMPLATE  ·  copy me, rename me, never ship me as-is
 * ============================================================================
 *
 * This file is a GUIDED SKELETON: a complete, contract-compliant mini-game
 * ("Coin Rush") that doubles as a line-by-line walkthrough of every house
 * rule a strip cartridge must honor. It is deliberately NOT wired into the
 * app — index.html must never reference this file (a stray <script> tag here
 * would mount a 53rd cartridge and desync every count).
 *
 * HOW TO USE (the 60-second version):
 *   1. Duplicate-check your idea against GAMES.md (Mechanics Index + aliases)
 *      — the deck is 52 games deep; the most expensive mistake is a dupe.
 *   2. Copy this file to  js/games/<yourid>.js   and rename the id below.
 *   3. Walk the sections: every § block explains WHAT and WHY. Delete nothing
 *      blindly — each rule here was paid for by a real bug (referenced in-line).
 *   4. Add <script src="js/games/<yourid>.js"></script> to index.html, add the
 *      file to sw.js precache, and bump BOTH sw cache versions.
 *   5. `node --check js/games/<yourid>.js`, then the full checklist at the
 *      bottom of GAMES.md ("Adding Cartridge #53").
 *
 * THE CONTRACT — ten rules, zero exceptions:
 *   1.  id is FOREVER. It is the IndexedDB save key. Renaming a shipped id
 *       orphans every player's save. Choose once, lowercase, unique.
 *   2.  DOM lookups scoped to THIS card:  container.querySelector — never
 *       document.getElementById. Two copies of a cartridge can be mounted at
 *       once (the deck shuffles + the drawer can jump); per-card duplicate ids
 *       used to make the stale copy eat the visible copy's updates (R0 #14).
 *   3.  All audio through Feedback (tone/uiTone/haptic/buzz), wrapped in
 *       try/catch. Never construct your own AudioContext — it would bypass
 *       the player's volume + sound setting (R0 #7, tonepad's original sin).
 *   4.  Colors come from CSS tokens (--ink, --panel, --amber, --good, ...).
 *       Hardcoded hexes render wrong the moment LIGHT mode re-grades the
 *       chassis — R33 "Daylight Screens" exists because of this scar tissue.
 *   5.  window-level listeners (keydown especially) must (a) gate on
 *       StripShell.isActive(container) so only the CENTERED card reacts, and
 *       (b) be removed in the cleanup function you return from mount.
 *   6.  Game keys call e.preventDefault() — arrow/space used to scroll the
 *       strip while playing (R0 #12).
 *   7.  Exactly ONE api.gameover(outcome, score) at the natural end of a run.
 *       Never in a loop, never twice per frame (R0 #9, flapdot stacked buzzes
 *       and redundant saves). The shell turns it into strip:gameover, which
 *       pays XP, missions, and depth in one honest call.
 *   8.  Lower-is-better scores (time, moves, rows) are stored INVERTED
 *       (CEILING − x) with scoreEncoding:"inverted" + scoreCeiling declared.
 *       The registry tripwire warns if it sees setHighscore(CEILING − x)
 *       without the declaration — but its regex only matches the subtraction
 *       INLINE inside the call; `const v = CEILING - x; setHighscore(v)`
 *       slips past (reaction.js and colormix.js both lived undeclared this
 *       way until the R34 audit). The Daily ×2 twist gate reads the
 *       DECLARATION — so declare whenever you store an inverted value, even
 *       if the tripwire is silent.
 *   9.  Idle/caretaking cartridges (no "run") call api.tend() on their natural
 *       caretaking beat instead of api.gameover() — missions count it, XP
 *       doesn't. See garden/aquarium/anthill/tradingpost.
 *   10. Persistence is cheap but not free: save on meaningful transitions,
 *       sanitize everything you load (numbers → finite, objects → fresh
 *       factory clones — a shared template object leaked state across resets,
 *       R0 #5/#13).
 *
 * API CHEAT SHEET (the `api` object the shell hands your mount):
 *   api.load()              → Promise<any|null>     this id's saved JSON state
 *   api.save(obj)           → Promise<boolean>      persist state (whole blob)
 *   api.getHighscore()      → Promise<number>       best (0 if never played)
 *   api.setHighscore(n)     → Promise<number>       new best (Daily ×2 twist
 *                                                    + new-best XP happen here)
 *   api.gameover(outcome,score) → void   outcome "win"|"over"; ONE call per run
 *   api.tend()              → void   caretaking beat (idle games, rule 9)
 *
 * CANVAS GAMES: this template is DOM-based (most cartridges are). If you need
 * a canvas, see snake.js / sandbox2048.js for the rAF + devicePixelRatio
 * pattern — the short version is inlined as comments in §2 below, and the
 * one rule that matters is: cancelAnimationFrame in the cleanup function.
 * ==========================================================================*/

Strip.register({
  // ── IDENTITY ─────────────────────────────────────────────────────────────
  // Rule 1: this id is the save key forever. "coinrush" here is a placeholder
  // that MUST be renamed in your copy (and never shipped alongside a real
  // game with the same id — registry order is also deck order).
  id: "coinrush",

  // Small eyebrow text on the card. Pick from the deck's fixed category set —
  // GAMES.md "Step 2" lists them all: GAME, PUZZLE, REFLEX, ARCADE, CARDS,
  // STRATEGY, LOGIC, WORD, COLONY, FIDGET, TOY, ODDBALL. Don't invent one.
  label: "REFLEX",

  title: "Coin Rush",                    // display name (card header)
  tag: "15s",                            // small pill, top-right of the card
  hint: "Tap the coins before the clock runs out — 8 wins", // bottom instruction line

  // ── OPTIONAL FLAGS (delete what you don't use) ───────────────────────────
  // Rule 8: ONLY for lower-is-better scores. The demo below is max-wins, so
  // it stays commented. If you uncomment, set your own ceiling and make the
  // arithmetic visible somewhere — a future auditor WILL read it.
  // scoreEncoding: "inverted", scoreCeiling: 100000,

  // Rule (R33): ONLY when a WIN's score is an honest performance number that
  // depth should sample (dicepig's banked total). Inverted-encoding games
  // must never opt in. Delete otherwise.
  // winDepth: true,

  // ── LIFECYCLE ────────────────────────────────────────────────────────────
  // mount is called when the card enters the strip. Return a cleanup function
  // and the shell calls it when the card scrolls away. mount may be async —
  // load your saves before first paint so nothing flickers (lightsout's R0 #8
  // flicker happened when best arrived late).
  async mount(container, api){

    /* §0 — SCOPED LOOKUPS (rule 2) ──────────────────────────────────────────
     * One helper, used everywhere, zero document.getElementById in the file.
     * Every element you create gets a id prefixed with a short unique tag
     * ("cr-" here) purely for debuggability — uniqueness comes from scoping,
     * not from the id string.                                        */
    const q = (sel) => container.querySelector(sel);

    /* §1 — LOAD THE PAST (rule 10) ──────────────────────────────────────────
     * Two independent reads: the shell highscore store and your own state
     * blob. Never derive one from the other — they wipe independently
     * ("clear all progress" clears both; a corrupted state must not take
     * the best down with it).                                         */
    let best = await api.getHighscore();               // Promise<number>

    // Factory function, NOT a shared literal: Object.assign(state, DEFAULTS)
    // copied nested objects BY REFERENCE and kingdoms leaked workers across
    // resets (R0 #5). Every load gets a fresh object.
    const freshState = () => ({ lifetime: 0, runs: 0 });
    const state = Object.assign(freshState(), (await api.load()) || {});

    // Sanitize what you loaded (rule 10): a legacy save can carry anything.
    state.lifetime = Number.isFinite(state.lifetime) ? state.lifetime : 0;
    state.runs     = Number.isFinite(state.runs) ? state.runs : 0;

    /* §2 — BUILD THE DOM (rule 4 + rule 5) ──────────────────────────────────
     * Colors: only CSS tokens. Layout: inline flex/grid like the rest of the
     * deck (cards are small; no stylesheets per game — the shared css handles
     * chrome, you handle the playfield).
     *
     * CANVAS variant (see snake.js for the real thing):
     *   const cv = document.createElement("canvas");
     *   const dpr = Math.min(2, window.devicePixelRatio || 1);
     *   cv.width = W * dpr; cv.height = H * dpr;          // backing store
     *   cv.style.width = W + "px";                        // CSS size
     *   const ctx = cv.getContext("2d");
     *   ctx.scale(dpr, dpr);                              // draw in CSS px
     *   ... and in cleanup: cancelAnimationFrame(rafId);
     *                                                                 */
    const wrap = document.createElement("div");
    wrap.style.cssText =
      "display:flex; flex-direction:column; align-items:center; gap:10px; width:100%;" +
      "font-variant-numeric:tabular-nums; user-select:none;";

    // Top stat row — display font, dim ink, tabular numbers. Match the deck's
    // visual voice; the card chrome (borders, header, hint line) is already
    // rendered by the shell around your playfield.
    const statRow = document.createElement("div");
    statRow.style.cssText =
      "display:flex; gap:18px; font-family:var(--font-display); font-size:10px;" +
      "letter-spacing:.14em; color:var(--ink-dim);";
    statRow.innerHTML =
      '<div>RUN <span id="cr-score" style="color:var(--amber); font-size:13px;">0</span></div>' +
      '<div>GOAL <span style="color:var(--ink)">8</span></div>' +
      '<div>BEST <span id="cr-best" style="color:var(--purple)">' + best + '</span></div>' +
      '<div>TIME <span id="cr-time" style="color:var(--ink)">15</span></div>';
    wrap.appendChild(statRow);

    // The playfield: position:relative, coins are absolutely positioned
    // children. min-height keeps the card from jumping while the run is idle.
    const field = document.createElement("div");
    field.id = "cr-field";
    field.style.cssText =
      "position:relative; width:100%; min-height:180px; border-radius:14px;" +
      "background:var(--panel); border:1px solid var(--line); overflow:hidden;";
    field.setAttribute("aria-label", "Coin field — tap the coins");
    wrap.appendChild(field);

    const status = document.createElement("div");
    status.id = "cr-status";
    status.style.cssText =
      "font-size:11px; color:var(--ink-dim); min-height:15px; text-align:center;";
    status.textContent = "Tap START, then catch 8 coins in 15 seconds.";
    wrap.appendChild(status);

    // Controls: .btn / .btn.accent are the shared button styles. type="button"
    // always — a stray submit inside a form-ish ancestor is a classic footgun.
    const startBtn = document.createElement("button");
    startBtn.id = "cr-start";
    startBtn.className = "btn accent";
    startBtn.type = "button";
    startBtn.textContent = "START";
    wrap.appendChild(startBtn);

    container.appendChild(wrap);

    /* §3 — GAME STATE + RULES ───────────────────────────────────────────────
     * Keep the mutable run state in ONE place (`run`), reset through ONE
     * function (`resetRun`), and let every transition go through named
     * helpers — future-you and the QA suites both read this differently
     * when the state is scattered across loose let-bindings.           */
    const RUN_SECONDS = 15;
    const GOAL = 8;

    let run = null;          // null = idle; otherwise the live run object
    let timers = [];         // every setTimeout/setInterval lands here, so
                             // cleanup can kill them ALL (rule 5's sibling)

    const track = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };

    function resetRun(){
      if(run){ timers.forEach(clearTimeout); timers = []; }
      run = { score: 0, over: false, endsAt: 0 };
      q("#cr-score").textContent = "0";
      q("#cr-time").textContent = RUN_SECONDS;
      field.innerHTML = "";              // removes any coin left over
      status.textContent = "Catch " + GOAL + " coins in " + RUN_SECONDS + " seconds.";
    }

    // Coin spawn: a fresh absolutely-positioned button inside the field.
    // It's a <button> so keyboard/tap semantics come free (a11y rule 0),
    // and its hit area is generous — small targets are mobile lies.
    function spawnCoin(){
      if(!run || run.over) return;
      const coin = document.createElement("button");
      coin.type = "button";
      coin.className = "cr-coin";
      coin.setAttribute("aria-label", "Coin");
      const w = 34;
      coin.style.cssText =
        "position:absolute; width:" + w + "px; height:" + w + "px; border-radius:50%;" +
        "border:2px solid var(--amber); background:rgba(var(--glow-rgb),.14);" +
        "box-shadow:0 0 12px rgba(var(--glow-rgb),.35); cursor:pointer; padding:0;";
      const pad = 6;
      coin.style.left = pad + Math.random() * Math.max(1, field.clientWidth  - w - pad * 2) + "px";
      coin.style.top  = pad + Math.random() * Math.max(1, field.clientHeight - w - pad * 2) + "px";
      coin.addEventListener("click", onCoin);
      field.appendChild(coin);
    }

    /* §4 — FEEDBACK (rule 3) ────────────────────────────────────────────────
     * Named presets only — tap, select, toggle, pop, success, win, fail,
     * error, lose, place, swap, blip, thud, ok — they route through the
     * player's volume + sound settings. try/catch because Feedback can be
     * absent in odd embeds, and a sound must never kill a game.        */
    const sfx = {
      coin(){ try{ Feedback.tone("pop");   Feedback.haptic("light");  }catch(e){} },
      win (){ try{ Feedback.tone("win");   Feedback.haptic("medium"); }catch(e){} },
      lose(){ try{ Feedback.tone("lose");  Feedback.haptic("medium"); }catch(e){} },
      tick(){ try{ Feedback.uiTone("tap");                            }catch(e){} },
    };

    /* §5 — THE RUN LOOP ─────────────────────────────────────────────────────
     * This game's "engine" is a timer chain: spawn coins on a cadence, tick
     * the countdown, end at zero. Arcade cartridges swap this for rAF
     * (§2 canvas note); turn-based ones drop the timers entirely (see
     * kingdom). The shape is always the same: start → transitions →
     * exactly one endRun.                                          */
    function startRun(){
      resetRun();
      run.endsAt = Date.now() + RUN_SECONDS * 1000;
      startBtn.style.display = "none";
      sfx.tick();

      spawnCoin();                       // first coin immediately

      const spawnEvery = track(function next(){
        if(!run || run.over) return;
        spawnCoin();
        track(next, 1100 + Math.random() * 500);   // irregular cadence
      }, 1400);

      // countdown ticks: 1s granularity is honest at this scale
      const tickEvery = setInterval(() => {
        if(!run || run.over){ clearInterval(tickEvery); return; }
        const left = Math.max(0, Math.ceil((run.endsAt - Date.now()) / 1000));
        q("#cr-time").textContent = left;
        if(left <= 0) clearInterval(tickEvery);
      }, 250);
      timers.push(tickEvery);

      track(() => endRun(), RUN_SECONDS * 1000);     // the honest clock
    }

    function onCoin(e){
      if(!run || run.over) return;
      const coin = e.currentTarget;
      coin.remove();
      run.score++;
      state.lifetime++;                  // lifetime is a state-blob number
      q("#cr-score").textContent = run.score;
      sfx.coin();
      // NO save() here — hot-path saves belong to meaningful transitions
      // (rule 10). This run writes once, at the end (§6).
      if(run.score >= GOAL){ endRun(); } // win by reaching the goal early
    }

    /* §6 — END OF RUN: ONE gameover (rule 7) ────────────────────────────────
     * endRun is the ONLY function allowed to call api.gameover, it is
     * idempotent (run.over guards), and it is the natural end: goal
     * reached → "win", clock/collision/streak-break → "over". The shell
     * pays XP (+8/+5/+2 run ladder), missions, and depth from this single
     * event — double calls double-pay.                                */
    function endRun(){
      if(!run || run.over) return;
      run.over = true;
      timers.forEach(clearTimeout); timers.forEach(clearInterval); timers = [];
      field.innerHTML = "";
      startBtn.style.display = "";       // bring the controls back

      const won = run.score >= GOAL;
      if(won){
        status.textContent = "Caught " + run.score + " — that's the rush.";
        sfx.win();
      } else {
        status.textContent = "Time — " + run.score + " coins. " + GOAL + " wins.";
        sfx.lose();
      }

      // Persist AFTER the outcome is decided, in parallel, both awaited-free:
      // the shell's setHighscore handles the Daily ×2 twist + new-best XP.
      state.runs++;
      try{ api.save(state); }catch(e){}
      if(run.score > 0){ try{ api.setHighscore(run.score); }catch(e){} }

      // THE one call (rule 7). Score sanitized? The shell re-sanitizes
      // anyway, but garbage in → garbage missions, so hand it a number.
      try{ api.gameover(won ? "win" : "over", run.score); }catch(e){}

      // Idle/caretaking cartridges instead call, at their natural beat:
      //   try{ api.tend(); }catch(e){}
      // ...and never gameover. Pick ONE lane per interaction (rule 9).
    }

    /* §7 — KEYBOARD (rules 5 + 6) ───────────────────────────────────────────
     * Window-level, but gated: StripShell.isActive(container) is true only
     * when THIS card is the centered one — two copies of a cartridge can be
     * mounted at once, and the stale copy must stay dead. preventDefault on
     * every key you consume, or space/arrow keys scroll the strip.      */
    const onKey = (e) => {
      if(window.StripShell && !StripShell.isActive(container)) return;
      if(e.repeat) return;                          // key-hold is not spam
      if(e.key === " " || e.key === "Enter"){
        e.preventDefault();
        if(!run || run.over) startBtn.click();      // space starts / restarts
        else {
          // no live coin? space does nothing honest — never fake-catch
          const coin = field.querySelector(".cr-coin");
          if(coin) coin.click();
        }
      }
    };
    window.addEventListener("keydown", onKey);

    /* §8 — WIRE + START ─────────────────────────────────────────────────────
     * Buttons last, reset first, and the card renders in a playable idle
     * state with zero timers running (battery + scroll-away safety).    */
    startBtn.addEventListener("click", startRun);
    resetRun();

    /* §9 — CLEANUP: the mount contract (rule 5) ─────────────────────────────
     * The shell calls this when the card scrolls out of range. Kill every
     * window listener, every timer, every rAF, every IntersectionObserver
     * you created. A cartridge that leaks a listener keeps playing (and
     * buzzing) in an invisible card — the deck's oldest ghost story.    */
    return () => {
      window.removeEventListener("keydown", onKey);
      timers.forEach(clearTimeout);
      timers.forEach(clearInterval);
      timers = [];
      run = null;
      // canvas games: cancelAnimationFrame(rafId) here too.
    };

    /* ════════════════════════════════════════════════════════════════════
     * LAUNCH CHECKLIST (mirrors GAMES.md "Adding Cartridge #53"):
     * [ ] id renamed, lowercase, never-shipped-before (it's the save key)
     * [ ] duplicate check done in GAMES.md (Mechanics Index + aliases)
     * [ ] entry block WRITTEN in GAMES.md (5 lines, honest)
     * [ ] label from the fixed category set; tag/hint short and true
     * [ ] scoreEncoding/scoreCeiling declared IF lower-is-better (rule 8)
     * [ ] winDepth declared ONLY if a win's score is depth-worthy (R33)
     * [ ] container-scoped lookups only; ids prefixed for debugging
     * [ ] colors: CSS tokens only — zero hardcoded hexes
     * [ ] audio: Feedback presets in try/catch; no own AudioContext
     * [ ] ONE api.gameover (or tend lane), at the natural end, guarded
     * [ ] window keys: StripShell.isActive + preventDefault + e.repeat
     * [ ] cleanup removes every listener/timer/rAF you created
     * [ ] loads sanitized, saves at meaningful transitions only
     * [ ] <script> added to index.html (registration order)
     * [ ] sw.js precache + BOTH cache versions bumped
     * [ ] node --check passes; mount sweep + zero console errors
     * ════════════════════════════════════════════════════════════════════ */
  }
});
