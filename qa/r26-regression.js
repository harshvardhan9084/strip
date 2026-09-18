/**
 * qa/r26-regression.js — pins the Round 26 builds (per-cartridge DEPTH
 * engine + drawer chips + sparkline depth readout, drawer open cascade,
 * focus-pull depth of field, OS reduce-motion adoption via settingsVersion 4,
 * tradingpost trend weight fix).
 *
 * Run: serve the app root (scripts/nocache_server.py), open in a browser, then
 * `agent-browser eval "$(cat qa/r26-regression.js)"; sleep 30; agent-browser eval "window.__qa26.then(r => JSON.stringify(r))"`.
 * Resolves to an array of { name, pass, info } on window.__qa26.
 *
 * Pinned invariants:
 *  A1. Depth engine math: record + avgFor (single sample, rounding, min(100))
 *  A2. Junk-proof: score<=0 / best<=0 / non-string id never sample.
 *  A3. Ring cap: 45 records leave exactly 40 samples (the OLDEST drop).
 *  A4. Sanitize: hostile save → numbers in [0,100], junk dropped, capped.
 *  A5. Tier map: league thresholds (40/60/80/95) → NEON/PHOSPHOR/PLASMA/
 *      SUPERNOVA classes; a 62% chip is PHOSPHOR.
 *  A6. Event wiring: a REAL strip:gameover("over") with a stored best
 *      samples once; a "win" never samples (inverted games emit win only).
 *  A7. Persistence: after record(), StripDB.loadState("__depth__") sees it.
 *  A8. Drawer chip: seeded depth renders "62%" on the Snake row before the
 *      star; a game without data has NO chip (absent, not zero).
 *  A9. Sparkline depth: a cart with history + depth shows "· DEPTH n%";
 *      the signature includes avg+count (new run re-grades the chip).
 *  A10. Drawer open cascade: open renders with #drawer-grid.stagger and
 *      capped inline delays; a filter re-render drops the class.
 *  A11. Focus pull: exactly the centered cart wears data-centered after a
 *      jump + settle; others don't.
 *  A12. Settings v4: migrateV4 adopts the OS preference only without an
 *      explicit choice, and always bumps the version; a chosen motion
 *      wins over the OS.
 *  A13. tradingpost trend arrows render at font-weight:700 (R25 3.96:1
 *      cosmetic margin closed).
 *  B1. 51/51 mount sweep glitch-free.
 *  B2. Zero console errors across the whole suite.
 */
window.__qa26 = (async () => {
  const results = [];
  const ok = (name, pass, info) => results.push({ name, pass: !!pass, info: String(info || '').slice(0, 90) });
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const consoleErrors = [];
  window.addEventListener('error', (e) => consoleErrors.push(String(e)));

  await (window.Settings ? Settings.whenReady() : Promise.resolve());
  await window.XP.whenReady();
  await window.Depth.whenReady();
  await wait(600);
  // defensive: a FRESH profile would show the first-run hint overlay, which
  // swallows the clicks the drawer pins below depend on
  if(!Settings.get().hintSeen) Settings.set({ hintSeen: true });

  const NOSTORE = { cache: 'no-store' };
  const rec = window.Depth._internals.record;
  const sanitize = window.Depth._internals.sanitize;
  const tierFor = window.Depth._internals.tierFor;

  // ---------- A1: engine math ----------
  {
    const before = JSON.stringify({ g: (window.Depth._internals, 0) });
    // use a throwaway id no real game shares
    rec('qa26math', 62, 100);
    const a1 = Depth.avgFor('qa26math') === 62 && Depth.countFor('qa26math') === 1;
    rec('qa26math', 83.6, 100); // rounds to 84
    const a2 = Depth.avgFor('qa26math') === 73 && Depth.countFor('qa26math') === 2; // (62+84)/2 = 73
    rec('qa26math', 150, 100);    // clamps to 100
    const a3 = Depth.avgFor('qa26math') === Math.round((62 + 84 + 100) / 3);
    ok('A1 depth engine math', a1 && a2 && a3,
       'avg=' + Depth.avgFor('qa26math') + ' n=' + Depth.countFor('qa26math'));
  }

  // ---------- A2: junk-proof guards ----------
  {
    rec('qa26junk', 50, 0);      // no best
    rec('qa26junk', 0, 100);     // zero score
    rec('qa26junk', -5, 100);    // negative
    rec('', 50, 100);            // junk id
    rec(null, 50, 100);
    ok('A2 junk never samples', Depth.countFor('qa26junk') === 0 && Depth.avgFor('qa26junk') === null,
       'n=' + Depth.countFor('qa26junk'));
  }

  // ---------- A3: ring cap ----------
  {
    for(let i = 1; i <= 45; i++) rec('qa26cap', i * 2, 100); // 2,4,...,90 (and 100-clamped? no: 90 max)
    const arr = Depth.countFor('qa26cap');
    ok('A3 ring caps at 40', arr === 40, 'n=' + arr);
  }

  // ---------- A4: sanitize ----------
  {
    sanitize({ games: { qa26san: [50, 'x', 200, -3, null], qa26empty: [] } });
    const st = window.Depth._internals;
    // read back through avgFor/countFor
    const kept = Depth.countFor('qa26san') === 3 && Depth.avgFor('qa26san') === Math.round((50 + 100 + 0) / 3);
    const empty = Depth.countFor('qa26empty') === 0;
    ok('A4 sanitize hostile save', kept && empty,
       'n=' + Depth.countFor('qa26san') + ' avg=' + Depth.avgFor('qa26san'));
  }

  // ---------- A5: tier map ----------
  {
    const t = (n) => (tierFor(n) || {}).cls;
    ok('A5 tier thresholds match the league',
       tierFor(30).name === 'PAPER' && t(45) === 't-neon' && t(62) === 't-phosphor' &&
       t(85) === 't-plasma' && t(97) === 't-supernova',
       '62→' + t(62) + ' 97→' + t(97));
  }

  // ---------- A6: real event wiring (win exempt, over samples) ----------
  {
    await StripDB.setHighscore('qa26wire', 100);
    const beforeN = Depth.countFor('qa26wire');
    window.dispatchEvent(new CustomEvent('strip:gameover', {
      detail: { id: 'qa26wire', outcome: 'win', score: 70, ts: Date.now() }
    }));
    await wait(250);
    const afterWin = Depth.countFor('qa26wire');
    window.dispatchEvent(new CustomEvent('strip:gameover', {
      detail: { id: 'qa26wire', outcome: 'over', score: 71, ts: Date.now() }
    }));
    await wait(250);
    const afterOver = Depth.countFor('qa26wire');
    ok('A6 gameover wiring: wins exempt, overs sample',
       beforeN === 0 && afterWin === 0 && afterOver === 1 && Depth.avgFor('qa26wire') === 71,
       'before=' + beforeN + ' win=' + afterWin + ' over=' + afterOver + ' avg=' + Depth.avgFor('qa26wire'));
  }

  // ---------- A7: persistence ----------
  {
    rec('qa26persist', 55, 100);
    let seen = null;
    for(let i = 0; i < 20 && !seen; i++){
      await wait(120);
      const st = await StripDB.loadState('__depth__');
      if(st && st.games && Array.isArray(st.games.qa26persist)) seen = st.games.qa26persist;
    }
    ok('A7 depth persists under __depth__', !!seen && seen[seen.length - 1] === 55,
       JSON.stringify(seen || null).slice(0, 60));
  }

  // ---------- A8: drawer chip ----------
  {
    // determinism: this suite runs repeatedly on the same QA profile — wipe
    // depth state so the seeds below are the ONLY samples (a 40-sample ring
    // left by a previous run would shift every avg). QA-profile only.
    sanitize({ games: {} });
    rec('snake', 62, 100); rec('snake', 62, 100); // n=2 avg 62 → PHOSPHOR
    const btn = document.getElementById('drawer-btn');
    btn.click();
    await wait(450); // open + cascade
    const grid = document.getElementById('drawer-grid');
    const rows = [...grid.querySelectorAll('.drawer-item')];
    const snakeRow = rows.find(r => {
      const t = r.querySelector('.drawer-item-title');
      return t && /^snake$/i.test(t.textContent);
    });
    const chip = snakeRow && snakeRow.querySelector('.drawer-item-depth');
    const chipOk = !!chip && chip.textContent.trim() === '62%' &&
      chip.classList.contains('t-phosphor') &&
      // row anatomy: main · depth chip · ★ — the star is the chip's NEXT sibling
      chip.nextElementSibling && chip.nextElementSibling.classList.contains('drawer-item-fav');
    // a game WITHOUT data must have no chip: some bare rows, not all
    const bare = rows.filter(r => !r.querySelector('.drawer-item-depth')).length;
    ok('A8 drawer depth chip renders (and stays absent without data)',
       chipOk && bare > 0 && bare < rows.length,
       'chip=' + (chip ? chip.textContent.trim() : 'none') + ' bare=' + bare + '/' + rows.length);
    // close for the next pins
    document.getElementById('drawer-close').click();
    await wait(250);
  }

  // ---------- A9: sparkline depth readout + signature ----------
  {
    await StripDB.setHighscore('snake', 100);
    await StripDB.setHighscore('snake', 61); // history [100, 61], best 100
    const mod = Strip.all().find(m => m.id === 'snake');
    const host = document.createElement('div');
    host.className = 'cart';
    const inner = document.createElement('div');
    inner.className = 'cart-inner';
    host.appendChild(inner);
    document.body.appendChild(host);
    Sparkline.badge(host, mod);
    await wait(400);
    let chip = host.querySelector('.cart-sparkline');
    const shows = chip && /DEPTH\s+62%/.test(chip.textContent);
    // signature stability: same data → same sig string
    const sig1 = Sparkline._internals ? null : null; // internals not exposed; verify idempotence via DOM
    const html1 = chip ? chip.innerHTML.length : 0;
    Sparkline.badge(host, mod);
    await wait(120);
    chip = host.querySelector('.cart-sparkline');
    const html2 = chip ? chip.innerHTML.length : 0;
    // new depth sample → content re-grades on next badge call
    rec('snake', 82, 100); // avg (62+62+82)/3 → 69
    Sparkline.badge(host, mod);
    await wait(150);
    chip = host.querySelector('.cart-sparkline');
    const shows2 = chip && /DEPTH\s+69%/.test(chip.textContent);
    ok('A9 sparkline depth readout + live re-grade', !!shows && html1 > 0 && html1 === html2 && !!shows2,
       'first=' + (shows ? '62%' : 'MISS') + ' regrade=' + (shows2 ? '69%' : 'MISS'));
    host.remove();
  }

  // ---------- A10: drawer open cascade ----------
  {
    const btn = document.getElementById('drawer-btn');
    btn.click();
    await wait(60);
    const grid = document.getElementById('drawer-grid');
    const staggered = grid.classList.contains('stagger');
    const firstRow = grid.querySelector('.drawer-item');
    const hasDelay = firstRow && (firstRow.style.animationDelay || '') !== '';
    // filter re-render must drop the class (no cascade on keystrokes)
    const input = document.getElementById('drawer-filter');
    input.value = 'sn';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(60);
    const dropped = !grid.classList.contains('stagger');
    ok('A10 drawer cascade on open only', staggered && hasDelay && dropped,
       'stagger=' + staggered + ' delay=' + (firstRow ? firstRow.style.animationDelay : '-') + ' dropped=' + dropped);
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('drawer-close').click();
    await wait(250);
  }

  // ---------- A11: focus pull ----------
  {
    const strip = document.getElementById('strip');
    const carts = [...strip.querySelectorAll('.cart')];
    const centered = carts.filter(c => c.hasAttribute('data-centered'));
    const firstOk = centered.length === 1 && carts.indexOf(centered[0]) === 0;
    // jump to card 3 and let the scroll settle
    window.StripShell.jumpToIndex(3);
    await wait(900);
    const carts2 = [...strip.querySelectorAll('.cart')];
    const centered2 = carts2.filter(c => c.hasAttribute('data-centered'));
    const jumpedOk = centered2.length === 1 && carts2.indexOf(centered2[0]) === 3;
    ok('A11 focus pull follows the centered cart', firstOk && jumpedOk,
       'at=' + carts.indexOf(centered[0]) + '→' + carts2.indexOf(centered2[0]));
    window.StripShell.jumpToIndex(0);
    await wait(500);
  }

  // ---------- A12: settings v4 migration ----------
  {
    const mig = Settings._internals.migrateV4;
    const c1 = mig({ settingsVersion: 3, reduceMotion: false, reduceMotionChosen: false }, true);
    const c2 = mig({ settingsVersion: 3, reduceMotion: false, reduceMotionChosen: true }, true);
    const c3 = mig({ settingsVersion: 4, reduceMotion: false, reduceMotionChosen: false }, true);
    const live = Settings.get().settingsVersion;
    ok('A12 v4 OS adoption + explicit choice wins',
       c1.reduceMotion === true && c1.settingsVersion === 4 &&
       c2.reduceMotion === false && c3.reduceMotion === false && live === 4,
       'adopts=' + c1.reduceMotion + ' chosen=' + c2.reduceMotion + ' live v' + live);
  }

  // ---------- A13: tradingpost trend weight ----------
  {
    let src = '';
    try{
      const r = await fetch('js/games/tradingpost.js', NOSTORE);
      src = await r.text();
    }catch(e){}
    const up = src.includes('var(--good, #6FCF97); font-weight:700;');
    const down = src.includes('var(--danger); font-weight:700;');
    ok('A13 tp trend arrows bold', up && down, 'up=' + up + ' down=' + down);
  }

  // ---------- B1: mount sweep (self-contained: every cartridge mounts clean
  // with the depth module loaded) ----------
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
    ok('B1 all cartridges mount clean with Depth live', fails === 0 && total === 51,
       fails + '/' + total + ' failed');
  }

  await wait(400);
  ok('B2 zero console errors', consoleErrors.length === 0, consoleErrors.join(' | ').slice(0, 80));

  return results;
})();
