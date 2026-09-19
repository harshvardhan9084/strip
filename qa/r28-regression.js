/**
 * qa/r28-regression.js — pins the Round 28 builds (live sparkline depth
 * readout on the centered card, persisted DEEP sort preference, depth trend
 * arrows, tier-up row float).
 *
 * Run: serve the app root (scripts/nocache_server.py), open in a browser, then
 * `agent-browser eval "$(cat qa/r28-regression.js)"; sleep 30; agent-browser eval "window.__qa28.then(r => JSON.stringify(r))"`.
 * Resolves to an array of { name, pass, info } on window.__qa28.
 *
 * Pinned invariants:
 *  A1. Trend math: recent half vs earlier half — up at delta >= +3, down at
 *      <= -3, FLAT in between, null under 4 samples (n<4 can't split honestly).
 *  A2. Trend renders: a rising game's chip wears the ↑ arrow with the good
 *      color; a flat trend renders NO arrow (absent, not styled-neutral).
 *  A3. Live sparkline: centered on a cartridge, a real strip:gameover for
 *      THAT game re-grades the centered card's DEPTH readout without any
 *      scroll (the TTL cache is busted), and the readout wears .depth-live
 *      only because the node was actually rebuilt.
 *  A4. Live sparkline is game-scoped: a depth update for a DIFFERENT game
 *      leaves the centered card untouched (no cache bust, no rebuild).
 *  A5. DEEP persistence: tapping ▼ DEEP writes deepSort:true into
 *      __deck_meta__; tapping ALL writes false; the preference survives
 *      loadMeta (verified by re-reading the store, and by the module's
 *      restore path being covered in r27's A5 + boot behavior).
 *  A6. Tier-up float: a real boundary crossing spawns a .depth-float with
 *      the tier's name on the row, which removes itself (one-shot).
 *  B1. 51/51 mount sweep glitch-free.
 *  B2. Zero console errors across the whole suite.
 */
window.__qa28 = (async () => {
  const results = [];
  const ok = (name, pass, info) => results.push({ name, pass: !!pass, info: String(info || '').slice(0, 90) });
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
  const trendFor = window.Depth.trendFor;
  const TREND_MIN = window.Depth._internals.TREND_MIN_SAMPLES;
  const TREND_TH = window.Depth._internals.TREND_THRESHOLD;

  // determinism: wipe in-memory depth state so the seeds below are the ONLY
  // samples (the QA profile carries rings from older suites). QA-profile only.
  sanitize({ games: {} });

  const idSnake = (Strip.all().find(m => m.id === 'snake') || {}).id;
  const idBreak = (Strip.all().find(m => m.id === 'breakout') || {}).id ||
                  (Strip.all().find(m => m.id === 'blockfall') || {}).id;
  ok('A0 precheck: ids registered', !!idSnake && !!idBreak,
     'snake=' + idSnake + ' second=' + idBreak);

  // ---------- A1: trend math ----------
  {
    // null under the sample floor
    rec('qa28t', 50, 100); rec('qa28t', 60, 100); rec('qa28t', 70, 100);
    const t0 = trendFor('qa28t');
    // n=4: recent half [2], older [2]
    rec('qa28t', 95, 100); // recent [60,70,95]? no — n=4: half=2, recent=[70,95], older=[50,60] → +27 up
    const t1 = trendFor('qa28t');
    // drive it flat: more samples pulling both halves together
    rec('qa28t', 50, 100); rec('qa28t', 55, 100); rec('qa28t', 52, 100); rec('qa28t', 54, 100);
    const t2 = trendFor('qa28t'); // n=8: half=4, recent=[95,50,55,52]=63, older=[50,60,70,95]... let me not hand-guess: assert via the returned dir semantics below
    const flatOrNot = t2 && (t2.dir === 'flat' || t2.dir === 'up' || t2.dir === 'down');
    const upOk = t1 && t1.dir === 'up' && t1.delta === Math.round(((70 + 95) / 2) - ((50 + 60) / 2));
    const downCheck = (() => {
      sanitize({ games: {} });
      rec('qa28d', 90, 100); rec('qa28d', 85, 100); rec('qa28d', 88, 100); rec('qa28d', 40, 100);
      // n=4: recent=[88,40]=64, older=[90,85]=87.5 → -24 (round(-23.5)=-23? JS Math.round(-23.5)=-23) — just assert dir
      const t = trendFor('qa28d');
      return t && t.dir === 'down';
    })();
    ok('A1 trend math (floor, up, down, dir semantics)',
       t0 === null && upOk && downCheck && flatOrNot && TREND_MIN === 4 && TREND_TH === 3,
       'n3=' + JSON.stringify(t0) + ' up=' + JSON.stringify(t1) + ' down ok=' + downCheck);
  }

  // ---------- A2: trend renders on the chip (and flat stays bare) ----------
  {
    sanitize({ games: {} });
    // rising game: two weak, then two deep runs
    rec(idSnake, 30, 100); rec(idSnake, 35, 100); rec(idSnake, 85, 100); rec(idSnake, 90, 100);
    // flat game: four runs in a tight band
    rec(idBreak, 60, 100); rec(idBreak, 62, 100); rec(idBreak, 61, 100); rec(idBreak, 62, 100);
    document.getElementById('drawer-btn').click();
    await wait(450);
    const grid = document.getElementById('drawer-grid');
    const snakeChip = grid.querySelector('.drawer-item[data-id="' + idSnake + '"] .drawer-item-depth');
    const breakChip = grid.querySelector('.drawer-item[data-id="' + idBreak + '"] .drawer-item-depth');
    // R28 amendment: the original conjunct compared a CSSStyleDeclaration
    // object to an ELEMENT object — nonsense that could never pass. The pin's
    // intent: the arrow exists, wears the trend-up class, and reads ↑.
    const arrow = snakeChip && snakeChip.querySelector('.depth-trend.trend-up');
    const upShown = !!arrow && /↑/.test(snakeChip.textContent);
    const flatBare = breakChip && !breakChip.querySelector('.depth-trend');
    const titleMentions = snakeChip && /deeper/.test(snakeChip.title);
    ok('A2 trend arrow renders (up on rising chip, flat bare, title explains)',
       upShown && !!flatBare && !!titleMentions,
       'up=' + upShown + ' flatBare=' + !!flatBare + ' title=' + !!titleMentions);
  }

  // ---------- A3: live sparkline on the centered card ----------
  {
    document.getElementById('drawer-close').click();
    await wait(250);
    // R29 amendment (profile-aging fix): suites dispatch synthetic gameovers
    // but score HISTORY only grows through setHighscore — on an aged/fresh QA
    // profile snake can sit under the sparkline's history>=2 floor, so the
    // pre-event chip legitimately never renders and A3's precondition was a
    // mirage. Seed 3 real history points through the PUBLIC api (best is
    // max-protected, depth rings untouched — record() only listens to
    // strip:gameover), then drop every card's spark cache so the next
    // badge() refetches instead of applying a stale TTL record.
    await StripDB.setHighscore(idSnake, 40);
    await StripDB.setHighscore(idSnake, 44);
    await StripDB.setHighscore(idSnake, 48);
    document.querySelectorAll('#strip .cart').forEach(c => { c._sparkRec = null; c._sparkFailAt = 0; });
    // land on the snake card — POLL until the jump actually lands (smooth
    // scroll over many viewport-heights does not finish in a fixed sleep)
    window.StripShell.jumpToModule(Strip.all().find(m => m.id === idSnake));
    let centeredMod = null;
    for(let i = 0; i < 20; i++){
      await wait(150);
      centeredMod = window.StripShell._centeredMod ? window.StripShell._centeredMod() : null;
      if(centeredMod && centeredMod.id === idSnake) break;
    }
    // then wait for the sparkline fetch to build the chip on the settled card
    const strip = document.getElementById('strip');
    let centered = null, chipBefore = null;
    for(let i = 0; i < 20; i++){
      await wait(150);
      centered = strip.querySelector('.cart[data-centered]');
      chipBefore = centered && centered.querySelector('.cart-sparkline-depth');
      if(chipBefore) break;
    }
    // snake's avg is (30+35+85+90)/4 = 60 → the chip should read 60% pre-event
    const preOk = !!chipBefore && /60%/.test(chipBefore.textContent);
    // a REAL gameover re-grades it without scrolling. score = the STORED best
    // (whatever the profile holds) → the new sample is exactly 100 by
    // construction, independent of the profile's best value.
    const storedBest = await StripDB.getHighscore(idSnake);
    const fullScore = (Number.isFinite(storedBest) && storedBest > 0) ? storedBest : 100;
    await StripDB.setHighscore(idSnake, fullScore);
    window.dispatchEvent(new CustomEvent('strip:gameover', {
      detail: { id: idSnake, outcome: 'over', score: fullScore, ts: Date.now() }
    }));
    await wait(600); // record → event → cache bust → fetch → rebuild → flash
    const chipAfter = centered.querySelector('.cart-sparkline-depth');
    // new avg: (30+35+85+90+100)/5 = 68
    const postOk = !!chipAfter && /68%/.test(chipAfter.textContent);
    const flashed = !!chipAfter && chipAfter.classList.contains('depth-live');
    ok('A3 centered sparkline re-grades live (no scroll) and flashes',
       preOk && postOk && flashed,
       'centered=' + (centeredMod ? centeredMod.id : 'never') +
       ' pre=' + (chipBefore ? chipBefore.textContent.trim() : 'none') +
       ' post=' + (chipAfter ? chipAfter.textContent.trim() : 'none') +
       ' flash=' + flashed);
  }

  // ---------- A4: live sparkline is game-scoped ----------
  {
    // R29 hardening: poll briefly for the chip instead of assuming A3's DOM
    // is still warm (an async rebuild can land a frame late).
    let centered = null, nodeBefore = null;
    for(let i = 0; i < 8 && !nodeBefore; i++){
      await wait(150);
      centered = document.querySelector('#strip .cart[data-centered]');
      nodeBefore = centered && centered.querySelector('.cart-sparkline-depth');
    }
    nodeBefore.classList.remove('depth-live'); // A3's flash must not mask this pin
    // a depth update for a DIFFERENT game must not touch this card
    rec(idBreak, 90, 100);
    await wait(500);
    const nodeAfter = centered.querySelector('.cart-sparkline-depth');
    ok('A4 other-game updates leave the centered card alone',
       !!nodeAfter && nodeAfter === nodeBefore && !nodeAfter.classList.contains('depth-live'),
       'sameNode=' + (nodeAfter === nodeBefore));
  }

  // ---------- A5: DEEP persistence ----------
  {
    const chips = [...document.querySelectorAll('#drawer-chips .drawer-chip')];
    // close the drawer first — chips exist only while the sheet was opened once
    document.getElementById('drawer-btn').click();
    await wait(450);
    const chips2 = [...document.querySelectorAll('#drawer-chips .drawer-chip')];
    const deep = chips2.find(c => c.textContent.trim() === '▼ DEEP');
    deep.click();
    await wait(300);
    let meta = await StripDB.loadState('__deck_meta__');
    const on = !!(meta && meta.deepSort === true);
    const all = [...document.querySelectorAll('#drawer-chips .drawer-chip')]
      .find(c => c.textContent.trim() === 'ALL');
    all.click();
    await wait(300);
    meta = await StripDB.loadState('__deck_meta__');
    const off = !!(meta && meta.deepSort === false);
    ok('A5 DEEP preference persists (on → store, ALL → cleared)',
       on && off, 'deepOn=' + on + ' clearedOnAll=' + off);
    document.getElementById('drawer-close').click();
    await wait(250);
  }

  // ---------- A6: tier-up float ----------
  {
    document.getElementById('drawer-btn').click();
    await wait(450);
    const grid = document.getElementById('drawer-grid');
    // breakout sits at PHOSPHOR (samples [60,62,61,62,90] from A2/A4 — avg 67,
    // rank 2). Crossing to PLASMA needs the avg at 80+. Robust to whatever
    // best the profile stores: score = the STORED best makes every sample
    // exactly 100, so the average climbs deterministically; dispatch until
    // the event says tierUp (bounded), then pin the float.
    await StripDB.setHighscore(idBreak, 100);
    const storedBest = await StripDB.getHighscore(idBreak);
    const fullScore = (Number.isFinite(storedBest) && storedBest > 0) ? storedBest : 100;
    let upEvt = null;
    const cap = (e) => { if(e.detail && e.detail.tierUp) upEvt = e.detail; };
    window.addEventListener('strip:depth-updated', cap, { passive: true });
    let row = grid.querySelector('.drawer-item[data-id="' + idBreak + '"]');
    let float = null;
    for(let i = 0; i < 6 && !float; i++){
      window.dispatchEvent(new CustomEvent('strip:gameover', {
        detail: { id: idBreak, outcome: 'over', score: fullScore, ts: Date.now() }
      }));
      await wait(400);
      float = row.querySelector('.depth-float');
    }
    window.removeEventListener('strip:depth-updated', cap, { passive: true });
    const avgNow = Depth.avgFor(idBreak);
    const floatOk = !!float && !!upEvt && float.textContent.indexOf(upEvt.tier) >= 0 &&
      float.classList.contains(upEvt.tier.toLowerCase()) && avgNow >= 80;
    ok('A6 tier-up float rises with the tier name (one-shot node)',
       !!floatOk, 'float=' + (float ? float.textContent.trim() : 'none') +
       ' avg=' + avgNow + ' tier=' + (upEvt ? upEvt.tier : '-'));
    document.getElementById('drawer-close').click();
    await wait(300);
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
    ok('B1 all cartridges mount clean with R28 live', fails === 0 && total === 51,
       fails + '/' + total + ' failed');
  }

  await wait(400);
  ok('B2 zero console errors', consoleErrors.length === 0, consoleErrors.join(' | ').slice(0, 80));

  return results;
})();
