/**
 * qa/r30-regression.js — pins the Round 30 builds: the VISIBLE affordance
 * (border-drawn chevron on the DEPTH readout, flipping with aria-expanded),
 * the one-time "TAP · TIERS" ladder hint (session-capped, persisted-done on
 * first open through the drawer's single-writer meta record), and the
 * tier-float SUPPRESSION while the depth ladder is open on the same card
 * (the R29 judge's z-order catch — the ladder carries the celebration).
 *
 * Run: serve the app root (scripts/nocache_server.py), open in a browser, then
 * `agent-browser eval "$(cat qa/r30-regression.js)"; sleep 40; agent-browser eval "window.__qa30.then(r => JSON.stringify(r))"`.
 * Resolves to an array of { name, pass, info } on window.__qa30.
 *
 * Pinned invariants:
 *  A0. snake registered (seed target).
 *  A1. The chevron is REAL: a .depth-chev node inside the readout, actually
 *      rendered (~5x5, never display:none), inheriting the tier hue via
 *      currentColor (computed color === readout color).
 *  A2. Opening the ladder flips the chevron: aria-expanded=true and the
 *      computed transform CHANGES (down -> up).
 *  A3. Toggle honesty: a second tap on the readout closes the ladder, it
 *      STAYS closed (no double-fire reopen), aria-expanded and chevron reset.
 *  A4. The hint appears on the teaching moment (a depth update that is NOT a
 *      tier-up), tapping it opens the ladder, the hint dies, and the REAL
 *      dismiss API (StripDrawer.dismissLadderHint) was invoked.
 *  A5. Session cap: after 3 creations the hint stops appearing (nudge, not
 *      nag) — dispatch #3 leaves no bubble.
 *  A6. Tier-up while the ladder is OPEN on this card: NO card float (the
 *      panel is the celebration), the panel's YOU marker + next-step move in
 *      place, and the live-rebuilt readout keeps aria-expanded=true (the
 *      syncLadderAria race fix on its real production path).
 *  A7. Tier-up with the ladder closed still celebrates at card scale
 *      (R29 regression guard) and self-removes.
 *  A8. A chip rebuild while the ladder is open re-syncs aria-expanded=true
 *      on the fresh handle (closed-while-open would be a lie).
 *  B1. 51/51 mount sweep glitch-free.
 *  B2. Zero console errors across the whole suite.
 */
window.__qa30 = (async () => {
  const results = [];
  const ok = (name, pass, info) => results.push({ name, pass: !!pass, info: String(info || '').slice(0, 100) });
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const consoleErrors = [];
  window.addEventListener('error', (e) => consoleErrors.push(String(e)));
  window.addEventListener('unhandledrejection', (e) => consoleErrors.push('rej:' + String(e.reason || e).slice(0, 60)));

  await (window.Settings ? Settings.whenReady() : Promise.resolve());
  await window.XP.whenReady();
  await window.Depth.whenReady();
  await wait(600);
  if(!Settings.get().hintSeen) Settings.set({ hintSeen: true });

  const rec = window.Depth._internals.record;
  const sanitize = window.Depth._internals.sanitize;

  const idSnake = (Strip.all().find(m => m.id === 'snake') || {}).id;
  ok('A0 precheck: snake registered', !!idSnake, 'snake=' + idSnake);
  if(!idSnake) return results;

  // determinism: wipe in-memory depth state so the seeds below are the ONLY
  // samples (the QA profile carries rings from older suites). QA-profile only.
  sanitize({ games: {} });
  await StripDB.setHighscore(idSnake, 40);
  await StripDB.setHighscore(idSnake, 44);
  await StripDB.setHighscore(idSnake, 48);

  // Round 30 ordering rule: dismiss the hint flag FIRST (through the REAL
  // production API), so the seeding rec()s below — which dispatch real
  // strip:depth-updated events — can't consume the 3-show session cap.
  let dismissCalls = 0;
  const origDismiss = window.StripDrawer.dismissLadderHint;
  window.StripDrawer.dismissLadderHint = () => { dismissCalls++; origDismiss(); };
  origDismiss(); // real call — persists ladderHintDone through the single writer
  let flagDone = false;
  for(let i = 0; i < 12 && !flagDone; i++){
    await wait(180);
    try{
      const meta = await StripDB.loadState('__deck_meta__');
      flagDone = !!(meta && meta.ladderHintDone);
    }catch(e){}
  }
  ok('A0b hint-done flag persists through the single meta writer', flagDone,
     'ladderHintDone=' + flagDone + ' dismissCalls=' + dismissCalls);

  // land on snake and wait out every residual scroll event
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

  // seeds [30, 95] → avg 63 → PHOSPHOR (same math the r29 suite pins)
  rec(idSnake, 30, 100); rec(idSnake, 95, 100);
  {
    cart._sparkRec = null; cart._sparkFailAt = 0;
    if(window.Sparkline) Sparkline.badge(cart, centeredMod);
    for(let i = 0; i < 12; i++){
      await wait(150);
      readout = cart.querySelector('.cart-sparkline-depth');
      if(readout && /63%/.test(readout.textContent)) break;
    }
  }

  // ---------- A1: the chevron is real ----------
  let chev = null;
  {
    chev = readout && readout.querySelector('.depth-chev');
    const rect = chev ? chev.getBoundingClientRect() : null;
    const visible = !!(rect && rect.width > 2 && rect.height > 2);
    const inherits = !!(chev && readout &&
      getComputedStyle(chev).color === getComputedStyle(readout).color);
    ok('A1 chevron is real, visible, and wears the tier hue via currentColor',
       !!(chev && visible && inherits),
       'node=' + !!chev + ' rect=' + (rect ? Math.round(rect.width) + 'x' + Math.round(rect.height) : 'none') +
       ' inherits=' + inherits);
  }

  // ---------- A2: opening the ladder flips the chevron ----------
  {
    const t0 = chev ? getComputedStyle(chev).transform : 'none';
    readout.click();
    await wait(350); // let the .18s transition settle
    const ladder = cart.querySelector('.depth-ladder');
    chev = cart.querySelector('.cart-sparkline-depth .depth-chev');
    const t1 = chev ? getComputedStyle(chev).transform : 'none';
    const flipped = t0 !== t1 && t1 !== 'none';
    const aria = cart.querySelector('.cart-sparkline-depth').getAttribute('aria-expanded') === 'true';
    ok('A2 opening the ladder flips the chevron (aria-expanded=true, transform changes)',
       !!(ladder && flipped && aria),
       'open=' + !!ladder + ' flipped=' + flipped + ' aria=' + aria);
  }

  // ---------- A3: toggle honesty — second tap closes, stays closed ----------
  {
    cart.querySelector('.cart-sparkline-depth').click();
    await wait(300);
    const gone = !cart.querySelector('.depth-ladder');
    await wait(450); // a double-fire reopen would need a beat to show up
    const stayed = !cart.querySelector('.depth-ladder');
    const r2 = cart.querySelector('.cart-sparkline-depth');
    const aria = r2 && r2.getAttribute('aria-expanded') === 'false';
    chev = r2 && r2.querySelector('.depth-chev');
    const tBack = chev ? getComputedStyle(chev).transform : 'none';
    ok('A3 second readout tap closes the ladder and it stays closed',
       !!(gone && stayed && aria && chev && tBack !== 'none'),
       'gone=' + gone + ' stayed=' + stayed + ' ariaReset=' + aria + ' chevBack=' + (tBack !== 'none'));
  }

  // ---------- A4: the one-time hint — show, tap, dismiss ----------
  {
    // injection point (restored in A5): the REAL flag is already done (A0b),
    // so the pending getter is temporarily overridden to exercise the show
    // path without depending on boot order.
    const origPending = window.StripDrawer.ladderHintPending;
    window.StripDrawer.ladderHintPending = () => true;
    window.dispatchEvent(new CustomEvent('strip:depth-updated', {
      detail: { id: idSnake, avg: 63, tierUp: false, ts: Date.now() }
    }));
    await wait(120);
    const hint = cart.querySelector('.depth-hint');
    const anatomyOk = hint && hint.getAttribute('role') === 'button' &&
      hint.tabIndex >= 0 && /TAP/.test(hint.textContent || '');
    if(hint) hint.click();
    await wait(350);
    const ladder = cart.querySelector('.depth-ladder');
    const hintGone = !cart.querySelector('.depth-hint');
    const dismissed = dismissCalls >= 1;
    ok('A4 hint shows on the teaching moment; tapping it opens the ladder and dismisses it',
       !!(anatomyOk && ladder && hintGone && dismissed),
       'hint=' + !!hint + ' anatomy=' + !!anatomyOk + ' ladder=' + !!ladder +
       ' gone=' + hintGone + ' dismissCalled=' + dismissed);
    // close for A5/A6
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wait(300);
    window.StripDrawer.ladderHintPending = origPending;
  }

  // ---------- A5: the session cap ----------
  {
    const origPending = window.StripDrawer.ladderHintPending;
    window.StripDrawer.ladderHintPending = () => true;
    // each real ladder open/close KILLS the live bubble (the production
    // dismiss path), so the next check can't hit a lingering node
    const openClose = async () => {
      cart.querySelector('.cart-sparkline-depth').click();
      await wait(280);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await wait(220);
    };
    const seen = [];
    window.dispatchEvent(new CustomEvent('strip:depth-updated', {
      detail: { id: idSnake, avg: 63, tierUp: false, ts: Date.now() }
    }));
    seen.push(!!cart.querySelector('.depth-hint'));
    await openClose();
    window.dispatchEvent(new CustomEvent('strip:depth-updated', {
      detail: { id: idSnake, avg: 63, tierUp: false, ts: Date.now() }
    }));
    seen.push(!!cart.querySelector('.depth-hint'));
    await openClose();
    window.dispatchEvent(new CustomEvent('strip:depth-updated', {
      detail: { id: idSnake, avg: 63, tierUp: false, ts: Date.now() }
    }));
    seen.push(!!cart.querySelector('.depth-hint'));
    window.StripDrawer.ladderHintPending = origPending;
    // A4 consumed one show; the next two create, the third hits the cap
    const capped = seen[0] === true && seen[1] === true && seen[2] === false;
    ok('A5 hint is session-capped (nudge, not nag)', capped,
       'shows=' + JSON.stringify(seen));
  }

  // ---------- A6: tier-up while the ladder is open is SUPPRESSED ----------
  {
    const r = cart.querySelector('.cart-sparkline-depth');
    r.click();
    await wait(300);
    const open = !!cart.querySelector('.depth-ladder');
    // seeds [30,95] avg 63 PHOSPHOR; two full runs → (30+95+100+100)/4 = 81.25
    // → 81 PLASMA: a REAL crossing, dispatched by the real record() path.
    rec(idSnake, 100, 100); await wait(300);
    rec(idSnake, 100, 100); await wait(650);
    const floated = !!cart.querySelector('.cart-tier-float');
    const ladder2 = cart.querySelector('.depth-ladder');
    const you = ladder2 && ladder2.querySelector('.ladder-row.on .ladder-you');
    const youOk = you && /YOU 81%/.test(you.textContent);
    const nextOk = ladder2 && /SUPERNOVA/.test(ladder2.querySelector('.ladder-next').textContent);
    const r2 = cart.querySelector('.cart-sparkline-depth');
    const ariaKept = r2 && r2.getAttribute('aria-expanded') === 'true';
    ok('A6 tier-up while the ladder is open: float suppressed, panel moves in place, aria kept',
       !!(open && !floated && youOk && nextOk && ariaKept),
       'open=' + open + ' floatSuppressed=' + !floated + ' you=' + (you ? you.textContent : 'none') +
       ' next=' + nextOk + ' aria=' + ariaKept);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wait(300);
  }

  // ---------- A7: tier-up with the ladder closed still celebrates ----------
  {
    // drop below NEON: [30,95,100,100] avg 81 → +5+5 → (330+10)/6 = 56 NEON
    rec(idSnake, 5, 100); rec(idSnake, 5, 100); await wait(300);
    // climb back over 60: (340+100)/7 = 62.8 → 63 PHOSPHOR — a real crossing
    rec(idSnake, 100, 100); await wait(500);
    const float = cart.querySelector('.cart-tier-float');
    const ring = cart.querySelector('.cart-tier-ring');
    const hueOk = float && float.classList.contains('phosphor');
    await wait(2100);
    const selfRemoved = !cart.querySelector('.cart-tier-float') && !cart.querySelector('.cart-tier-ring');
    ok('A7 tier-up with the ladder closed still celebrates at card scale, self-removing',
       !!(float && ring && hueOk && selfRemoved),
       'float=' + (float ? float.textContent.trim() : 'none') + ' hue=' + hueOk + ' removed=' + selfRemoved);
  }

  // ---------- A8: chip rebuild while open re-syncs the fresh handle ----------
  {
    const r = cart.querySelector('.cart-sparkline-depth');
    r.click();
    await wait(300);
    const chipBefore = cart.querySelector('.cart-sparkline');
    // real rebuild path: a run lands (avg 62 → 67: 534/8), sig changes, the
    // chip is replaced WHILE the ladder is open — the fresh handle must not
    // claim "closed".
    rec(idSnake, 99, 100); await wait(120);
    cart._sparkRec = null; cart._sparkFailAt = 0;
    if(window.Sparkline) Sparkline.badge(cart, centeredMod);
    let chipAfter = chipBefore;
    for(let i = 0; i < 12 && chipAfter === chipBefore; i++){
      await wait(180);
      chipAfter = cart.querySelector('.cart-sparkline');
    }
    const rebuilt = chipAfter !== chipBefore;
    const r2 = cart.querySelector('.cart-sparkline-depth');
    const aria = r2 && r2.getAttribute('aria-expanded') === 'true';
    const ladder = cart.querySelector('.depth-ladder');
    const you = ladder && ladder.querySelector('.ladder-row.on .ladder-you');
    const youOk = you && /YOU 67%/.test(you.textContent);
    ok('A8 a chip rebuilt while the ladder is open keeps aria-expanded=true',
       !!(rebuilt && aria && ladder && youOk),
       'rebuilt=' + rebuilt + ' aria=' + aria + ' open=' + !!ladder +
       ' you=' + (you ? you.textContent : 'none'));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
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
    ok('B1 all cartridges mount clean with the R30 affordances live', fails === 0 && total === 51,
       fails + '/' + total + ' failed');
  }

  await wait(400);
  ok('B2 zero console errors', consoleErrors.length === 0, consoleErrors.join(' | ').slice(0, 80));

  return results;
})();
