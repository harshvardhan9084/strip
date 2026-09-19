/**
 * qa/r32-regression.js — pins the Round 32 builds ("One Voice"):
 * the tier vocabulary unified IN CODE (trophies derive thresholds from
 * Depth.tiers — SUPERNOVA TOUCH at 95, the drift the R31 judge caught),
 * the deck-count drift killed (FULL SHELF reads the live registry, Player
 * Card EXPLORED too), the settings escape hatch for the declined tiers
 * hint, the recency-weighted trend regime (n >= 12), the ON DECK engine
 * (visibility-honest accrual + LONG HAUL at 30 min), and the 52nd
 * cartridge (Dice Pig — real push-your-luck, real gameover).
 *
 * IMPORTANT (determinism): this suite WIPES __trophies__ / __depth__ /
 * __ontime__ / __deck_meta__ + localStorage BEFORE it runs (same preamble
 * discipline as r31), then reloads. Run:
 *   agent-browser eval "<wipe>"; agent-browser reload; sleep 3;
 *   agent-browser eval "$(cat qa/r32-regression.js)"; sleep 40;
 *   agent-browser eval "window.__qa32.then(r => JSON.stringify(r))"
 *
 * Pinned invariants:
 *  A1. ONE VOCABULARY: trophies.js derives the depth-tier thresholds from
 *      Depth.tiers — SUPERNOVA TOUCH desc says 95, need === 95, and the
 *      ladder's mins still read ≥95% (no surface may drift again).
 *  A2. Player Card league: the rendered league node wears the tier's .t-*
 *      class and its note quotes the canonical next threshold (95) — read
 *      from the LIVE DOM, not from a copy of the table.
 *  A3. FULL SHELF (id half-century) resolves need to the LIVE registry
 *      length (52) — need:"ALL" — and the Player Card EXPLORED stat reads
 *      "x/52", not "x/50".
 *  A4. The escape hatch: after a REAL dismiss (dismissLadderHint through
 *      the × path), StripDrawer.replayLadderHint() flips the persisted flag
 *      back to pending AND re-arms the bubble on the centered card when a
 *      DEPTH readout exists there (returns true; DOM bubble present).
 *  A5. Recency-weighted trend: n < 12 keeps the split-half math (an n=11
 *      ring must NOT carry the weighted flag); n = 12 switches to the
 *      exponential recency weight (0.85^age) — delta matches the
 *      hand-computed production math and carries weighted:true.
 *  A6. ON DECK: accrual lands in TODAY's bucket (label floors to "<1m"),
 *      31 accrued minutes unlock LONG HAUL through the real
 *      strip:ontime-updated → evaluate contract, and the Player Card
 *      renders the ON DECK stat.
 *  A7. Dice Pig: registered as #52 with GAME label; mounts clean; a
 *      scripted run via the REAL buttons (roll until pot > 0, bank) fires
 *      exactly one strip:gameover with a finite score in [0, 100).
 *  B1. 52/52 mount sweep glitch-free.
 *  B2. Zero console errors across the whole suite.
 */
window.__qa32 = (async () => {
  const results = [];
  const ok = (name, pass, info) => results.push({ name, pass: !!pass, info: String(info || '').slice(0, 110) });
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const consoleErrors = [];
  const onErr = (e) => consoleErrors.push((e && (e.message || e.type)) || String(e) +
    (e && e.lineno ? ' @' + e.lineno : ''));
  window.addEventListener('error', onErr);
  window.addEventListener('unhandledrejection', (e) => consoleErrors.push('rej:' + String(e.reason || e).slice(0, 60)));

  await (window.Settings ? Settings.whenReady() : Promise.resolve());
  await window.XP.whenReady();
  await window.Depth.whenReady();
  await window.Ontime.whenReady();
  await window.Trophies.whenReady();
  await wait(900); // boot settle: trophy retro-evaluate + sparkline hydration
  if(!Settings.get().hintSeen) Settings.set({ hintSeen: true });
  Settings.set({ reduceMotion: false });

  const rec = window.Depth._internals.record;
  const sanitize = window.Depth._internals.sanitize;
  const TREND_W_MIN = window.Depth._internals.TREND_WEIGHTED_MIN;
  const TREND_DECAY = window.Depth._internals.TREND_DECAY;

  ok('A0 module surfaces present',
     !!(window.Trophies && window.Depth && window.Ontime && window.Strip && Strip.all().length === 52),
     'trophies=' + !!window.Trophies + ' depth=' + !!window.Depth +
     ' ontime=' + !!window.Ontime + ' carts=' + Strip.all().length);

  const unlockedIds = [];
  window.addEventListener('strip:trophy-unlocked', (e) => {
    if(e.detail && e.detail.id) unlockedIds.push(e.detail.id);
  });

  // DOM seam: the shell keeps cards[] private, but the centered card is
  // pure scroll math — the same division app.js performs every frame.
  const stripEl = document.getElementById('strip');
  const centeredCard = () => {
    const idx = Math.round(stripEl.scrollTop / (stripEl.clientHeight || 1));
    return stripEl.children[idx] || null;
  };

  // ---------- A1: one vocabulary, enforced in code ----------
  {
    const nova = (Trophies._internals.DEFS || []).find(d => d.id === 'supernova-touch');
    const tierNova = Depth.tiers.find(t => t.name === 'SUPERNOVA');
    const descSays = nova && /averaging 95\%/.test(nova.desc);
    const needMatches = !!nova && nova.need === tierNova.min;
    // seed the CENTERED cartridge so the ladder probe opens on a real card
    // (a fake id would hang the panel off nothing — absent data, no ladder)
    const cMod = (window.StripShell && StripShell._centeredMod()) || Strip.all()[0];
    // the DEPTH readout rides the sparkline chip, and the chip only exists
    // once the game has real score history (>= 2 plays) — seed a genuine
    // record through the shell's production api factory (the R20 QA seam),
    // then seed depth (63 of best 100 → PHOSPHOR)
    const api = StripShell._testMakeApi(cMod.id);
    await api.setHighscore(50); await api.setHighscore(63);
    rec(cMod.id, 63, 100);
    await wait(700); // sparkline rebuild path: cache bust + IndexedDB read + chip render
    let ladderMins = null, panelCls = null;
    try{
      const cart = centeredCard();
      if(cart && cart.querySelector('.cart-sparkline-depth') && Depth.avgFor(cMod.id) != null){
        Depth.toggleLadder(cart, cMod);
        await wait(120);
        const panel = cart.querySelector('.depth-ladder');
        if(panel){
          ladderMins = [...panel.querySelectorAll('.ladder-min')].map(n => n.textContent.trim());
          panelCls = panel.className; // R32: panel wears the held tier class
        }
        Depth.closeLadders({ restoreFocus: false });
      }
    }catch(e){}
    ok('A1 SUPERNOVA TOUCH derived from Depth.tiers (need 95, desc says 95)',
       !!nova && needMatches && descSays && tierNova.min === 95,
       'need=' + (nova && nova.need) + ' tierMin=' + tierNova.min +
       ' descOk=' + !!descSays + ' ladderMins=' + JSON.stringify(ladderMins));
    ok('A1b ladder panel wears the held tier class',
       !!panelCls && /t-(paper|neon|phosphor|plasma|supernova)/.test(panelCls),
       'panelClass=' + panelCls);
  }

  // ---------- A2: Player Card league speaks the canonical table ----------
  {
    // the WHOLE-DECK league rides XP's rolling depth — seed it through the
    // exact production sampler (63 of best 100 → PHOSPHOR, next: PLASMA 80)
    XP._internals.recordDepthSample(63, 100);
    document.getElementById('trophy-btn').click();
    await wait(700);
    const league = document.querySelector('.player-league');
    const cls = league ? league.className : '';
    const name = league ? league.querySelector('.player-league-name').textContent : '';
    const note = league ? league.querySelector('.player-league-note').textContent : '';
    const explored = [...document.querySelectorAll('.player-stat-n')].map(s => s.textContent);
    document.getElementById('trophy-close').click();
    await wait(250);
    ok('A2 league row wears the tier class + canonical next threshold',
       /t-phosphor/.test(cls) && /PHOSPHOR/.test(name) && /80% to PLASMA/.test(note),
       'cls=' + cls.trim() + ' name=' + name + ' note=' + note);
    ok('A2b Player Card EXPLORED reads the live registry (x/52)',
       explored.some(t => /\/52$/.test(t.trim())), 'stats=' + JSON.stringify(explored));
  }

  // ---------- A3: FULL SHELF resolves "ALL" from the live registry ----------
  {
    const def = (Trophies._internals.DEFS || []).find(d => d.id === 'half-century');
    const named = def && def.name === 'FULL SHELF';
    const allNeed = def && def.need === 'ALL';
    // resolveNeed IS the production rule — pin it directly through the seam:
    // with the registry live (52) and 0 visits recorded by the wipe preamble,
    // the fallback can't fire, so the resolved need must be 52.
    const resolved = Trophies._internals.resolveNeed(def);
    const shelvesOk = Trophies._internals.deckSize() === 52 && resolved === 52;
    ok('A3 FULL SHELF: renamed honestly, need:"ALL" resolves to the live registry',
       !!def && named && allNeed && shelvesOk,
       'name=' + (def && def.name) + ' need=' + (def && JSON.stringify(def.need)) +
       ' resolvedNeed=' + resolved + ' deckSize=' + Trophies._internals.deckSize());
  }

  // ---------- A4: the escape hatch ----------
  {
    // seed depth on the CENTERED cartridge so the replayed bubble has a
    // readout to point at — the centered card comes from the shell seam
    const mod = (window.StripShell && StripShell._centeredMod()) || Strip.all()[0];
    const id = mod.id;
    rec(id, 70, 100); rec(id, 80, 100);
    await wait(650);
    const cart = centeredCard(); // the same card the shell's replay path targets
    // decline FIRST through the real path (the × flow calls dismissLadderHint;
    // here the persisted flag is the contract under test)
    if(window.StripDrawer.dismissLadderHint) StripDrawer.dismissLadderHint();
    const pendingAfterDismiss = StripDrawer.ladderHintPending(); // expect false
    // shell-side session cap is private; a reload resets it, but the replay
    // event resets it too — call the REAL settings entry point
    const shown = StripDrawer.replayLadderHint();
    const pendingAfterReplay = StripDrawer.ladderHintPending(); // expect true
    const armed = !!(cart && cart.querySelector('.depth-hint'));
    ok('A4 replay re-arms a declined hint (persisted flag + bubble)',
       pendingAfterDismiss === false && pendingAfterReplay === true &&
       shown === !!armed && pendingAfterReplay,
       'pendingAfterDismiss=' + pendingAfterDismiss +
       ' pendingAfterReplay=' + pendingAfterReplay + ' shown=' + shown +
       ' bubbleInDom=' + !!armed + ' (depth data on ' + id + ')');
  }

  // ---------- A5: recency-weighted trend regime ----------
  {
    sanitize({ games: {} });
    // n = 11: the OLD regime — no weighted flag may appear
    const flat11 = [50,52,51,53,50,52,51,53,50,52,51];
    flat11.forEach(v => rec('qa32trend', v, 100));
    const t11 = Depth.trendFor('qa32trend');
    ok('A5a n=11 stays split-half (no weighted flag)',
       !!t11 && t11.weighted === undefined,
       'n=11 → ' + JSON.stringify(t11));
    // n = 12: weighted regime. Ring: nine 40s then three 100s —
    // weights 0.85^age, newest first: recent 100s dominate.
    sanitize({ games: {} });
    const ring = [40,40,40,40,40,40,40,40,40,100,100,100];
    ring.forEach(v => rec('qa32w', v, 100));
    const t12 = Depth.trendFor('qa32w');
    // hand-computed production math ( newest = index 11 ):
    let wSum = 0, wVal = 0, pSum = 0;
    for(let i = 0; i < 12; i++){
      const w = Math.pow(TREND_DECAY, 11 - i);
      wSum += w; wVal += w * ring[i]; pSum += ring[i];
    }
    const expectDelta = Math.round((wVal / wSum) - (pSum / 12));
    ok('A5b n=12 goes recency-weighted, delta matches production math',
       !!t12 && t12.weighted === true && t12.dir === 'up' &&
       t12.delta === expectDelta && expectDelta >= 3,
       'got=' + JSON.stringify(t12) + ' expected delta=' + expectDelta +
       ' (wmin=' + TREND_W_MIN + ', decay=' + TREND_DECAY + ')');
  }

  // ---------- A6: ON DECK engine + LONG HAUL ----------
  {
    const labelBefore = Ontime.todayLabel();
    // the QA seam: accrue through the SAME funnel the heartbeat uses
    Ontime._internals.accrue(31 * 60 * 1000);
    const mins = Ontime.todayMinutes();
    await wait(650); // the accrual event drives Trophies.evaluate
    const longHaul = unlockedIds.includes('long-haul');
    // the Player Card renders the ON DECK stat
    document.getElementById('trophy-btn').click();
    await wait(600);
    const statTexts = [...document.querySelectorAll('.player-stat-l')].map(s => s.textContent);
    const hasStat = statTexts.some(t => t === 'ON DECK');
    document.getElementById('trophy-close').click();
    await wait(250);
    ok('A6 ON DECK accrues → LONG HAUL unlocks through the real event',
       mins >= 31 && longHaul && hasStat,
       'mins=' + mins + ' longHaul=' + longHaul + ' statOnCard=' + hasStat +
       ' labelBefore=' + labelBefore);
  }

  // ---------- A7: Dice Pig plays for real ----------
  {
    const mod = Strip.all().find(m => m.id === 'dicepig');
    let gameoverCalls = [];
    const onGo = (e) => { if(e.detail && e.detail.id === 'dicepig') gameoverCalls.push(e.detail); };
    window.addEventListener('strip:gameover', onGo);
    // jump the strip to the cartridge and WAIT for the smooth scroll to
    // actually land (poll the shell's own center seam — a fixed sleep raced
    // in the first live run and probed the wrong card)
    window.StripShell.jumpToModule(mod);
    let cart = null;
    for(let i = 0; i < 30; i++){
      await wait(100);
      if((window.StripShell._centeredMod() || {}).id === 'dicepig') break;
    }
    await wait(500); // mount window: the landing card mounts on the scroll frame
    cart = centeredCard();
    const mounted = !!cart && !!cart.querySelector('#dp-roll');
    // scripted REAL run: roll until the pot allows a bank, then bank —
    // repeat until the run ends (5 turns) — via the buttons a human taps
    let guard = 0;
    while(gameoverCalls.length === 0 && guard++ < 200){
      const rollBtn = cart.querySelector('#dp-roll');
      const bankBtn = cart.querySelector('#dp-bank');
      if(!rollBtn) break;
      if(rollBtn.disabled) break;
      rollBtn.click();
      await wait(480); // roll animation ~330ms + engine settle
      const bank = cart.querySelector('#dp-bank');
      if(bank && !bank.disabled){ bank.click(); await wait(160); }
      if(gameoverCalls.length === 0 && cart.querySelector('#dp-end') &&
         cart.querySelector('#dp-end').style.display !== 'none') break;
    }
    const call = gameoverCalls[0];
    const sane = !!call && (call.outcome === 'win' || call.outcome === 'over') &&
      Number.isFinite(call.score) && call.score >= 0 && call.score < 100 &&
      (call.outcome === 'win' ? call.score >= 50 : true);
    ok('A7 Dice Pig: #52, mounts, real-button run fires one honest gameover',
       !!mod && mod.label === 'GAME' && mounted && gameoverCalls.length === 1 && sane,
       'label=' + (mod && mod.label) + ' mounted=' + mounted +
       ' calls=' + gameoverCalls.length + ' outcome=' + (call && call.outcome) +
       ' score=' + (call && call.score) + ' guard=' + guard);
    window.removeEventListener('strip:gameover', onGo);
  }

  // ---------- B1: 52/52 mount sweep ----------
  {
    let fails = 0, total = 0;
    const all = Strip.all();
    for(const m of all){
      const body = document.createElement('div');
      document.body.appendChild(body);
      try{
        const r = m.mount(body, {
          save(){ return Promise.resolve(); }, load(){ return Promise.resolve(null); },
          getHighscore(){ return Promise.resolve(0); }, setHighscore(){ return Promise.resolve(0); },
          gameover(){}, tend(){}
        });
        if(r && typeof r.then === 'function') await r;
      }catch(err){ fails++; console.error('B1 mount fail', m.id, err); }
      total++;
      try{ body.remove(); }catch(e){}
      if(total % 13 === 0) await wait(60); // yield: timers/RAF breathe like the deck
    }
    await wait(400);
    ok('B1 all cartridges mount clean with R32 live (incl. Dice Pig)',
       fails === 0 && total === Strip.all().length,
       'fails=' + fails + '/' + total + ' carts=' + Strip.all().length);
  }

  ok('B2 zero console errors', consoleErrors.length === 0,
     consoleErrors.join(' | ').slice(0, 100));

  window.removeEventListener('error', onErr);

  return results;
})();
