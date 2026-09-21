/**
 * qa/r31-regression.js — pins the Round 31 builds: the hint's dismiss ×
 * (decline WITHOUT opening — persisted through the same single-writer flag),
 * the daylight-graded chip/hint pills (LIGHT mode no longer puts dark
 * daylight ink on a hardcoded dark pill), the reduce-motion exit contract,
 * and the depth-tier trophies (IN THE GROOVE / PLASMA FRONT / SUPERNOVA
 * TOUCH — unlocked by the average a cartridge is HOLDING, ring >= 2).
 *
 * IMPORTANT (determinism): this suite WIPES __trophies__ / __depth__ /
 * ladderHintDone BEFORE it runs — see the wipe preamble in the round notes.
 * Run: serve the app root, open the page, eval the wipe snippet, reload,
 * then `agent-browser eval "$(cat qa/r31-regression.js)"; sleep 45;
 * agent-browser eval "window.__qa31.then(r => JSON.stringify(r))"`.
 *
 * Pinned invariants:
 *  A0. Module surfaces present (Trophies, Depth, Strip 51).
 *  A1. HOLDING gate: a SINGLE over-run sample (count=1, avg 100) unlocks
 *      nothing — one lucky run is not a habit.
 *  A2. Two samples at exactly 60 unlock IN THE GROOVE only (boundary-
 *      inclusive, PLASMA not yet); two more at 100 (avg 80) unlock PLASMA
 *      FRONT; more 100s to avg 95 unlock SUPERNOVA TOUCH (R32: canonical
 *      Depth.tiers threshold) — all observed via
 *      the public strip:trophy-unlocked contract.
 *  A3. Closest-to-Unlock reads in PERCENT units for depth rows
 *      ("80% / 95%" — R32), not counts.
 *  A4. Hint anatomy (R31): container is PLAIN (no role — it now contains
 *      two buttons), label role=button opens the ladder, × role=button
 *      with a Dismiss aria-label.
 *  A5. × click declines: bubble dies, NO ladder opens, the REAL
 *      dismissLadderHint was invoked (a choice is a choice — persisted).
 *  A6. Reduce-motion: hint-in animation is 'none', and the bye class
 *      collapses the bubble (display:none — the exit still clears).
 *  A7. Hint sits fully inside the viewport (no horizontal overflow).
 *  B1. 51/51 mount sweep glitch-free.
 *  B2. Zero console errors across the whole suite.
 */
window.__qa31 = (async () => {
  const results = [];
  const ok = (name, pass, info) => results.push({ name, pass: !!pass, info: String(info || '').slice(0, 100) });
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const consoleErrors = [];
  window.addEventListener('error', (e) => consoleErrors.push(String(e)));
  window.addEventListener('unhandledrejection', (e) => consoleErrors.push('rej:' + String(e.reason || e).slice(0, 60)));

  await (window.Settings ? Settings.whenReady() : Promise.resolve());
  await window.XP.whenReady();
  await window.Depth.whenReady();
  await window.Trophies.whenReady();
  await wait(900); // boot settle: trophy retro-evaluate + sparkline hydration
  if(!Settings.get().hintSeen) Settings.set({ hintSeen: true });
  Settings.set({ reduceMotion: false });

  const rec = window.Depth._internals.record;
  const sanitize = window.Depth._internals.sanitize;

  ok('A0 module surfaces present',
     !!(window.Trophies && window.Depth && window.Strip && Strip.all().length >= 52  /* R37: the R32 carry — A0 literals converted to >= N (registry-agnostic floor); cartridge #53+ can no longer break this suite */),
     'trophies=' + !!window.Trophies + ' depth=' + !!window.Depth + ' carts=' + Strip.all().length);

  // every depth unlock fires the public trophy contract — collect them
  const unlockedIds = [];
  window.addEventListener('strip:trophy-unlocked', (e) => {
    if(e.detail && e.detail.id) unlockedIds.push(e.detail.id);
  }, { passive: true });

  // hint flag: dismiss FIRST through the real API so seeding below can't
  // consume the session cap (same ordering rule the r30 suite pins)
  const origDismiss = window.StripDrawer.dismissLadderHint;
  let dismissCalls = 0;
  window.StripDrawer.dismissLadderHint = () => { dismissCalls++; origDismiss(); };
  origDismiss();

  sanitize({ games: {} });
  await StripDB.setHighscore('snake', 40);
  await StripDB.setHighscore('snake', 44);
  window.StripShell.jumpToModule(Strip.all().find(m => m.id === 'snake'));
  let centeredMod = null;
  for(let i = 0; i < 25; i++){
    await wait(150);
    centeredMod = window.StripShell._centeredMod ? window.StripShell._centeredMod() : null;
    if(centeredMod && centeredMod.id === 'snake') break;
  }
  await wait(800);
  const cart = document.querySelector('#strip .cart[data-centered]');
  let readout = cart && cart.querySelector('.cart-sparkline-depth');
  for(let i = 0; i < 12 && !readout; i++){
    await wait(150);
    readout = document.querySelector('#strip .cart[data-centered] .cart-sparkline-depth');
  }

  // ---------- A1: one lucky run is not a habit ----------
  {
    rec('snake', 100, 100); // count=1, avg 100
    await wait(600);
    const got = unlockedIds.filter(id => id === 'in-the-groove').length > 0;
    ok('A1 a single over-run sample unlocks no depth trophy',
       !got, 'unlockedAfter1=' + JSON.stringify(unlockedIds));
  }

  // ---------- A2: the holding ladder (60 → 80 → 95, all boundary-inclusive) ----------
  // R32 amendment: SUPERNOVA TOUCH now rides the CANONICAL tier table
  // (Depth.tiers, see trophies.js depthTierDefs) — "Hold Supernova" means
  // avg >= 95, the number every tier surface already used. The old pin at
  // 90 was the drift the R31 judge caught (two vocabularies).
  {
    // deterministic restart: wipe in-memory depth so [60,60] are the ONLY
    // samples — avg exactly 60, the PHOSPHOR boundary, inclusive.
    sanitize({ games: {} });
    unlockedIds.length = 0;
    rec('snake', 60, 100); rec('snake', 60, 100);
    await wait(650);
    const groove = unlockedIds.includes('in-the-groove');
    const plasmaEarly = unlockedIds.includes('plasma-front');
    ok('A2a two samples at exactly 60 unlock IN THE GROOVE (and nothing deeper)',
       groove && !plasmaEarly, 'unlocked=' + JSON.stringify(unlockedIds));

    rec('snake', 100, 100); rec('snake', 100, 100); // [60,60,100,100] avg 80
    await wait(650);
    const plasma = unlockedIds.includes('plasma-front');
    const supernovaEarly = unlockedIds.includes('supernova-touch');
    ok('A2b avg 80 unlocks PLASMA FRONT (and nothing deeper)',
       plasma && !supernovaEarly, 'unlocked=' + JSON.stringify(unlockedIds));
  }

  // ---------- A3: closest-to-unlock reads percent units ----------
  {
    // supernova still locked, peak 80 → 80/95 = 84% there, near top (R32: need is 95)
    document.getElementById('trophy-btn').click();
    await wait(700);
    const nums = [...document.querySelectorAll('.closest-num')].map(n => n.textContent.trim());
    const pctRow = nums.find(t => /^\d+% \/ \d+%$/.test(t));
    document.getElementById('trophy-close').click();
    await wait(300);
    ok('A3 closest-to-unlock depth row reads percent units (R32: 80/95)',
       !!pctRow && pctRow.indexOf('80% / 95%') >= 0,
       'rows=' + JSON.stringify(nums.slice(0, 4)));
  }

  // finish the ladder: [60,60,100,100] + twelve more 100s = 1520/16 = 95
  // exactly (R32 amendment: 95 is the tier's own threshold; 8 samples avg
  // 90 no longer touches it)
  {
    for(let i = 0; i < 12; i++) rec('snake', 100, 100);
    await wait(650);
    const supernova = unlockedIds.includes('supernova-touch');
    ok('A2c avg 95 unlocks SUPERNOVA TOUCH (R32: canonical tier threshold)',
       supernova, 'unlocked=' + JSON.stringify(unlockedIds.filter(i => i.indexOf('groove') >= 0 || i.indexOf('plasma') >= 0 || i.indexOf('supernova') >= 0)));
  }

  // ---------- A4/A5: the dismiss × ----------
  {
    const origPending = window.StripDrawer.ladderHintPending;
    window.StripDrawer.ladderHintPending = () => true;
    window.dispatchEvent(new CustomEvent('strip:depth-updated', {
      detail: { id: 'snake', avg: 90, tierUp: false, ts: Date.now() }
    }));
    await wait(150);
    const hint = cart.querySelector('.depth-hint');
    const label = hint && hint.querySelector('.depth-hint-label');
    const x = hint && hint.querySelector('.depth-hint-x');
    const anatomy = hint && !hint.getAttribute('role') &&       // container plain
      label && label.getAttribute('role') === 'button' && label.tabIndex >= 0 &&
      x && x.getAttribute('role') === 'button' && x.tabIndex >= 0 &&
      /Dismiss/i.test(x.getAttribute('aria-label') || '');
    const dismissBefore = dismissCalls;
    if(x) x.click();
    await wait(300);
    const gone = !cart.querySelector('.depth-hint');
    const noLadder = !cart.querySelector('.depth-ladder');       // × never opens
    const dismissedReal = dismissCalls > dismissBefore;
    window.StripDrawer.ladderHintPending = origPending;
    ok('A4 hint splits into label + × (plain container, both real buttons)',
       !!anatomy, 'anatomy=' + !!anatomy);
    ok('A5 × declines: bubble dies, no ladder, real dismiss invoked',
       gone && noLadder && dismissedReal,
       'gone=' + gone + ' noLadder=' + noLadder + ' dismissed=' + dismissedReal);
  }

  // ---------- A6: reduce-motion contract ----------
  {
    Settings.set({ reduceMotion: true });
    await wait(150);
    const rm = document.documentElement.classList.contains('reduce-motion');
    const origPending = window.StripDrawer.ladderHintPending;
    window.StripDrawer.ladderHintPending = () => true;
    window.dispatchEvent(new CustomEvent('strip:depth-updated', {
      detail: { id: 'snake', avg: 90, tierUp: false, ts: Date.now() }
    }));
    await wait(150);
    const hint = cart.querySelector('.depth-hint');
    const anim = hint ? getComputedStyle(hint).animationName : '';
    let byeClears = false;
    if(hint){
      hint.classList.add('depth-hint-bye');
      await wait(80);
      byeClears = getComputedStyle(hint).display === 'none';
    }
    Settings.set({ reduceMotion: false });
    window.StripDrawer.ladderHintPending = origPending;
    ok('A6 reduce-motion: no entrance animation, bye collapses the bubble',
       rm && hint && anim === 'none' && byeClears,
       'rm=' + rm + ' anim=' + anim + ' byeClears=' + byeClears);
  }

  // ---------- A7: hint stays inside the viewport ----------
  {
    const origPending = window.StripDrawer.ladderHintPending;
    window.StripDrawer.ladderHintPending = () => true;
    window.dispatchEvent(new CustomEvent('strip:depth-updated', {
      detail: { id: 'snake', avg: 90, tierUp: false, ts: Date.now() }
    }));
    await wait(150);
    const hint = cart.querySelector('.depth-hint');
    const r = hint ? hint.getBoundingClientRect() : null;
    const doc = document.documentElement;
    const fits = r && r.left >= 0 && r.right <= doc.clientWidth && r.width > 20;
    window.StripDrawer.ladderHintPending = origPending;
    ok('A7 hint sits fully inside the viewport',
       !!fits, 'rect=' + (r ? Math.round(r.left) + '..' + Math.round(r.right) + ' vw=' + doc.clientWidth : 'none'));
  }

  // ---------- B1: mount sweep ----------
  {
    const apiStub = {
      save(o){ return Promise.resolve(o); },
      load(){ return Promise.resolve(null); },
      getHighscore(){ return Promise.resolve(0); },
      setHighscore(s){ return Promise.resolve(s); },
      gameover(){},
      tend(){}, setStats(){},
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
    ok('B1 all cartridges mount clean with R31 live', fails === 0 && total === Strip.all().length  /* R32 amendment: registry-length self-consistent — the deck grew to 52 */,
       fails + '/' + total + ' failed');
  }

  await wait(400);
  ok('B2 zero console errors', consoleErrors.length === 0, consoleErrors.join(' | ').slice(0, 80));

  return results;
})();
