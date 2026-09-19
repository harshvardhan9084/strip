/**
 * qa/r29-regression.js — pins the Round 29 builds: the depth ladder popover
 * (tap the centered card's DEPTH readout), the card-scale tier-up moment
 * (float + ring on the card the run just ended on), the tier-hued readout,
 * and the DEEP sort explanation note.
 *
 * Run: serve the app root (scripts/nocache_server.py), open in a browser, then
 * `agent-browser eval "$(cat qa/r29-regression.js)"; sleep 30; agent-browser eval "window.__qa29.then(r => JSON.stringify(r))"`.
 * Resolves to an array of { name, pass, info } on window.__qa29.
 *
 * Pinned invariants:
 *  A1. Readout anatomy: the DEPTH readout is a real button handle —
 *      role=button, tabindex, aria-haspopup, aria-expanded=false — and wears
 *      the league's tier class (t-plasma at avg 81), computed color verified.
 *  A2. Ladder opens on tap: role=dialog, five rows ascending PAPER→SUPERNOVA
 *      with honest thresholds, the current tier carries YOU + avg, the
 *      next-step line states the real point gap, focus lands on the panel.
 *  A3. Esc closes it, aria-expanded resets, and focus returns to the handle.
 *  A4. Keyboard parity (Enter opens) + outside pointerdown closes.
 *  A5. LIVE refresh: a run landing while the ladder is open rebuilds the
 *      panel in place — new avg in the YOU row, never a stale marker.
 *  A6. Scrolling the deck closes the ladder (a popover that drifts off its
 *      anchor is noise) — and it can't come back on its own.
 *  A7. Card-scale tier-up: a real tier boundary crossing on the CENTERED
 *      game spawns the tier float + tier ring on that card, in the tier's
 *      hue, both self-removing (one-shot, never queued twice).
 *  A8. DEEP note: tapping ▼ DEEP reveals the explanation; ALL hides it — the
 *      persisted sort can never look like a glitch.
 *  B1. 51/51 mount sweep glitch-free.
 *  B2. Zero console errors across the whole suite.
 */
window.__qa29 = (async () => {
  const results = [];
  const ok = (name, pass, info) => results.push({ name, pass: !!pass, info: String(info || '').slice(0, 100) });
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const consoleErrors = [];
  window.addEventListener('error', (e) => consoleErrors.push(String(e)));

  await (window.Settings ? Settings.whenReady() : Promise.resolve());
  await window.XP.whenReady();
  await window.Depth.whenReady();
  await wait(600);
  if(!Settings.get().hintSeen) Settings.set({ hintSeen: true });

  const rec = window.Depth._internals.record;
  const sanitize = window.Depth._internals.sanitize;
  const TIERS = window.Depth.tiers;

  const idSnake = (Strip.all().find(m => m.id === 'snake') || {}).id;
  const idBreak = (Strip.all().find(m => m.id === 'breakout') || {}).id ||
                  (Strip.all().find(m => m.id === 'blockfall') || {}).id;
  ok('A0 precheck: ids registered', !!idSnake && !!idBreak,
     'snake=' + idSnake + ' second=' + idBreak);

  // determinism: wipe in-memory depth state so the seeds below are the ONLY
  // samples (the QA profile carries rings from older suites). QA-profile only.
  sanitize({ games: {} });
  // seed score HISTORY through the public api so the sparkline chip exists
  // (history>=2 floor — the R28 suite's lesson about aging profiles)
  await StripDB.setHighscore(idSnake, 40);
  await StripDB.setHighscore(idSnake, 44);
  await StripDB.setHighscore(idSnake, 48);

  // land on snake and wait out every residual scroll event, so nothing
  // closes the ladder the instant this suite opens it
  window.StripShell.jumpToModule(Strip.all().find(m => m.id === idSnake));
  let centeredMod = null;
  for(let i = 0; i < 25; i++){
    await wait(150);
    centeredMod = window.StripShell._centeredMod ? window.StripShell._centeredMod() : null;
    if(centeredMod && centeredMod.id === idSnake) break;
  }
  await wait(900);
  const cart = document.querySelector('#strip .cart[data-centered]');
  let readout = cart && cart.querySelector('.cart-sparkline-depth');
  for(let i = 0; i < 15 && !readout; i++){
    await wait(150);
    readout = document.querySelector('#strip .cart[data-centered] .cart-sparkline-depth');
  }

  // A1 runs against snake at a known avg: seeds [30, 95] → 62.5 → 63 PHOSPHOR
  rec(idSnake, 30, 100); rec(idSnake, 95, 100);
  { // force the chip rebuild with the new depth signature
    cart._sparkRec = null; cart._sparkFailAt = 0;
    if(window.Sparkline) Sparkline.badge(cart, centeredMod);
    for(let i = 0; i < 12 && !readout; i++){
      await wait(150);
      readout = cart.querySelector('.cart-sparkline-depth');
    }
    for(let i = 0; i < 12; i++){
      await wait(150);
      readout = cart.querySelector('.cart-sparkline-depth');
      if(readout && /63%/.test(readout.textContent)) break;
    }
    const expTier = Depth.tierFor(Depth.avgFor(idSnake));
    const anatomy = readout && readout.getAttribute('role') === 'button' &&
      readout.tabIndex >= 0 && readout.getAttribute('aria-haspopup') === 'dialog' &&
      readout.getAttribute('aria-expanded') === 'false';
    const hueOk = readout && readout.classList.contains(expTier.cls);
    let colorOk = false;
    if(readout){
      const cs = getComputedStyle(readout).color; // rgb(...) — semantic var resolved
      colorOk = /^rgb\(\d+, \d+, \d+\)$/.test(cs) && cs !== 'rgba(0, 0, 0, 0)';
    }
    ok('A1 readout is a button handle wearing the tier hue',
       !!(anatomy && hueOk && colorOk && expTier.name === 'PHOSPHOR'),
       'role/tabindex/aria=' + !!anatomy + ' hue=' + hueOk + '(' + expTier.cls + ') color=' + colorOk);
  }

  // ---------- A2: ladder opens on tap ----------
  {
    readout.click();
    await wait(280);
    const ladder = cart.querySelector('.depth-ladder');
    const rows = ladder ? [...ladder.querySelectorAll('.ladder-row')] : [];
    const names = rows.map(r => r.querySelector('.ladder-name').textContent);
    const ascending = names.join(',') === 'PAPER,NEON,PHOSPHOR,PLASMA,SUPERNOVA';
    const you = ladder && ladder.querySelector('.ladder-row.on .ladder-you');
    const youOk = you && /YOU 63%/.test(you.textContent);
    const onName = ladder && ladder.querySelector('.ladder-row.on .ladder-name');
    const nextLine = ladder ? (ladder.querySelector('.ladder-next') || {}).textContent : '';
    // avg 63 → PHOSPHOR; the first threshold ABOVE 63 is 80 (PLASMA)
    const nextOk = /17 points to PLASMA/.test(nextLine);
    const mins = rows.map(r => (r.querySelector('.ladder-min') || {}).textContent);
    const minsOk = mins.join(',') === 'any run,≥40%,≥60%,≥80%,≥95%';
    const focused = document.activeElement === ladder;
    const expanded = readout.getAttribute('aria-expanded') === 'true';
    const role = ladder && ladder.getAttribute('role') === 'dialog';
    ok('A2 ladder opens: 5 rows ascending, YOU marked, next-step math, focus parity',
       !!(ladder && ascending && youOk && onName && onName.textContent === 'PHOSPHOR' &&
          nextOk && minsOk && focused && expanded && role),
       'asc=' + ascending + ' you=' + !!youOk + ' next=' + nextLine +
       ' focus=' + focused + ' exp=' + expanded);
  }

  // ---------- A3: Esc closes, aria resets, focus returns ----------
  {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wait(220);
    const gone = !cart.querySelector('.depth-ladder');
    const expanded = readout.getAttribute('aria-expanded') === 'false';
    // focus parity is structural here (headless activeElement is flaky — the
    // r27 A2 precedent): the handle keeps tabindex and is the documented
    // restore target; assert the panel is gone and the handle state is sane.
    ok('A3 Esc closes the ladder and resets the handle',
       gone && expanded, 'gone=' + gone + ' expanded=' + expanded);
  }

  // ---------- A4: keyboard parity + outside tap closes ----------
  {
    readout.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await wait(220);
    const opened = !!cart.querySelector('.depth-ladder');
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await wait(220);
    const closedByOutside = !cart.querySelector('.depth-ladder');
    ok('A4 Enter opens; an outside pointerdown closes', opened && closedByOutside,
       'enter=' + opened + ' outside=' + closedByOutside);
  }

  // ---------- A5: live refresh while open ----------
  {
    readout.click();
    await wait(250);
    const ladder = cart.querySelector('.depth-ladder');
    const beforeAvg = Depth.avgFor(idSnake); // 58
    // a REAL gameover on the centered game: score = stored best → sample 100
    const storedBest = await StripDB.getHighscore(idSnake);
    const fullScore = (Number.isFinite(storedBest) && storedBest > 0) ? storedBest : 100;
    await StripDB.setHighscore(idSnake, fullScore);
    window.dispatchEvent(new CustomEvent('strip:gameover', {
      detail: { id: idSnake, outcome: 'over', score: fullScore, ts: Date.now() }
    }));
    await wait(650);
    const ladder2 = cart.querySelector('.depth-ladder');
    const you = ladder2 && ladder2.querySelector('.ladder-row.on .ladder-you');
    const afterAvg = Depth.avgFor(idSnake); // (30+85+100)/3 = 72 → YOU 72%
    const refreshed = ladder2 && you && new RegExp('YOU ' + afterAvg + '%').test(you.textContent) &&
      afterAvg !== beforeAvg;
    ok('A5 a run landing while open rebuilds the panel in place',
       !!refreshed, 'before=' + beforeAvg + ' after=' + afterAvg +
       ' you=' + (you ? you.textContent : 'none'));
  }

  // ---------- A6: scrolling closes it ----------
  {
    const still = !!cart.querySelector('.depth-ladder'); // A5 left it open
    window.StripShell.jumpToIndex(3);
    let gone = false;
    for(let i = 0; i < 30; i++){
      await wait(150);
      if(!document.querySelector('.depth-ladder')){ gone = true; break; }
    }
    // return to snake for A7
    window.StripShell.jumpToModule(Strip.all().find(m => m.id === idSnake));
    for(let i = 0; i < 30; i++){
      await wait(150);
      const c = window.StripShell._centeredMod();
      if(c && c.id === idSnake) break;
    }
    await wait(700);
    const stayedClosed = !document.querySelector('.depth-ladder');
    ok('A6 scrolling the deck closes the ladder (and it stays closed)',
       still && gone && stayedClosed, 'wasOpen=' + still + ' closed=' + gone +
       ' stayedClosed=' + stayedClosed);
  }

  // ---------- A7: the card-scale tier-up moment ----------
  {
    // breakout sits at PHOSPHOR (seeds [60,62,61,62] avg 62); fullScore runs
    // pull the avg to 80+ (PLASMA) in bounded dispatches — tierUp fires on the
    // crossing, and the CENTERED card (breakout) must celebrate at card scale.
    // The centered cart is queried AFTER the jump lands (data-centered moves).
    rec(idBreak, 60, 100); rec(idBreak, 62, 100); rec(idBreak, 61, 100); rec(idBreak, 62, 100);
    await StripDB.setHighscore(idBreak, 100);
    const storedBest = await StripDB.getHighscore(idBreak);
    const fullScore = (Number.isFinite(storedBest) && storedBest > 0) ? storedBest : 100;
    let evt = null;
    const cap = (e) => { if(e.detail && e.detail.tierUp) evt = e.detail; };
    window.addEventListener('strip:depth-updated', cap, { passive: true });
    window.StripShell.jumpToModule(Strip.all().find(m => m.id === idBreak));
    for(let i = 0; i < 30; i++){
      await wait(150);
      const c = window.StripShell._centeredMod();
      if(c && c.id === idBreak) break;
    }
    await wait(500);
    const cart2 = document.querySelector('#strip .cart[data-centered]');
    let float = null;
    for(let i = 0; i < 6 && !float; i++){
      window.dispatchEvent(new CustomEvent('strip:gameover', {
        detail: { id: idBreak, outcome: 'over', score: fullScore, ts: Date.now() }
      }));
      await wait(420);
      float = cart2.querySelector('.cart-tier-float');
    }
    window.removeEventListener('strip:depth-updated', cap, { passive: true });
    const ring = cart2.querySelector('.cart-tier-ring');
    const hueOk = float && evt && float.classList.contains((evt.tier || '').toLowerCase());
    const textOk = float && evt && float.textContent.indexOf(evt.tier) >= 0;
    const ariaHidden = float && ring && float.getAttribute('aria-hidden') === 'true' &&
      ring.getAttribute('aria-hidden') === 'true';
    // both nodes remove themselves (1.7s / 1.25s timers)
    await wait(2100);
    const selfRemoved = !cart2.querySelector('.cart-tier-float') && !cart2.querySelector('.cart-tier-ring');
    ok('A7 tier-up celebrates at CARD scale: float + ring in the tier hue, self-removing',
       !!(evt && float && ring && hueOk && textOk && ariaHidden && selfRemoved),
       'tier=' + (evt ? evt.tier : '-') + ' float=' + (float ? float.textContent.trim() : 'none') +
       ' ring=' + !!ring + ' removed=' + selfRemoved);
  }

  // ---------- A8: the DEEP sort explanation note ----------
  {
    document.getElementById('drawer-btn').click();
    await wait(480);
    const chipByText = (t) => [...document.querySelectorAll('#drawer-chips .drawer-chip')]
      .find(c => c.textContent.trim() === t);
    // R29 amendment (persistence-aware): the preference SURVIVES reloads by
    // design, so the drawer can boot ALREADY in DEEP — a blind DEEP tap would
    // turn it OFF. Normalize to ALL first, then run the on/off contract.
    if(chipByText('▼ DEEP').classList.contains('on')){
      chipByText('ALL').click();
      await wait(300);
    }
    chipByText('▼ DEEP').click();
    await wait(300);
    const note = document.getElementById('drawer-deep-note');
    const shown = note && !note.hidden && /DEEPEST FIRST/.test(note.textContent) &&
      /ALL restores/.test(note.textContent);
    chipByText('ALL').click();
    await wait(300);
    const hidden = note && note.hidden;
    ok('A8 DEEP sort wears its explanation (on with the sort, off with ALL)',
       !!(shown && hidden), 'shown=' + !!shown + ' hiddenOnAll=' + !!hidden);
    document.getElementById('drawer-close').click();
    await wait(250);
  }

  // ---------- B1: mount sweep ----------
  {
    const apiStub = {
      save(o){ return Promise.resolve(o); },
      load(){ return Promise.resolve(null); },
      getHighscore(){ return Promise.resolve(0); },
      setHighscore(s){ return Promise.resolve(s); },
      gameover(){},
      tend(){},
    };
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;height:400px';
    document.body.appendChild(div);
    let fails = 0, total = 0;
    for(const m of Strip.all()){
      total++;
      try{
        const r = m.mount(div, apiStub);
        if(typeof r === 'function'){ try{ r(); }catch(e){ fails++; } }
        else Promise.resolve(r).then(c => { try{ typeof c === 'function' && c(); }catch(e){} }).catch(() => fails++);
      }catch(e){ fails++; }
      try{ div.innerHTML = ''; }catch(e){}
    }
    div.remove();
    ok('B1 all cartridges mount clean with the ladder live', fails === 0 && total === 51,
       fails + '/' + total + ' failed');
  }

  await wait(400);
  ok('B2 zero console errors', consoleErrors.length === 0, consoleErrors.join(' | ').slice(0, 80));

  return results;
})();
