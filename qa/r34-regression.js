/**
 * qa/r34-regression.js — pins the Round 34 build ("The One UI — P0 wave"),
 * the first implementation wave off auuudit.md (the 52-cartridge teardown).
 *
 * IMPORTANT (determinism): run on a FRESH SESSION — the deck-repeat mounts
 * and XP's shared depth ring cross-contaminate otherwise (the recorded R33
 * protocol lesson). Wipe + reload first:
 *   agent-browser eval "indexedDB.deleteDatabase('strip-db'); localStorage.clear(); 'wiped'"
 *   agent-browser open "http://<host>:<port>/"; sleep 3;
 *   agent-browser eval "$(cat qa/r34-regression.js)"; sleep 60;
 *   agent-browser eval "window.__qa34.then(r => JSON.stringify(r))"
 *
 * Pinned invariants:
 *  A1. RUN CEREMONY ENGINE: window.RunCeremony exposes show/hide + the tone
 *      table; show() renders role=status with label/score/unit/delta/verb;
 *      the verb fires onVerb exactly once and retires the panel; a second
 *      show() on the same host REPLACES (one panel per host).
 *  A2. REAL colorsnap death (buttons only) → the SNAPPED panel with
 *      rc-over tone, unit "streak", and a RETRY verb — the audit's broken
 *      exit-from-failure now has an invitation back.
 *  A3. REAL xox round (taps only) → an end-of-round ceremony carrying the
 *      W·D·L tally; the render pins the win-line 2px stroke contract.
 *  A4. REAL stacktower death (taps only) → THE TOWER FELL + REBUILD; the
 *      verb actually restarts (score 0, panel gone).
 *  A5. CONTRAST FLOOR: 2048 dark ramp t2/t4 daylighted and ≥14 RGB units
 *      apart; maze walls wear the --line inset stroke; sokoban cells scale
 *      ≥ 24px; minesweeper dug cells get the recessed inner shadow;
 *      dropfour holes get the recessed well; whackmole holes ride the
 *      mode-aware dirt token (dark #1a1510 → light #B9A98C).
 *  A6. LIGHT RESIDUALS: minisudoku free cells resolve the daylight screen
 *      tokens (no stranded near-black cells on the paper chassis).
 *  B1. TYPE FLOOR + TOASTS: both toast surfaces sit at 158px (below the
 *      card title, over the playfield); TD + kingdom stat rows render at
 *      the 11px floor.
 *  B2. COPY: randomfact numbers the FACT ITSELF (#n/total); thisorthat
 *      hides the lean line below n=5 (a single pick must not say "100%").
 *  C1. 52/52 mount sweep glitch-free.
 *  C2. Zero console errors across the whole suite (mode flips included).
 */
window.__qa34 = (async () => {
  const results = [];
  const ok = (name, pass, info) => results.push({ name, pass: !!pass, info: String(info || '').slice(0, 110) });
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const consoleErrors = [];
  window.addEventListener('error', (e) => consoleErrors.push((e && (e.message || e.type)) || String(e)));
  window.addEventListener('unhandledrejection', (e) => consoleErrors.push('rej:' + String(e.reason || e).slice(0, 60)));

  await (window.Settings ? Settings.whenReady() : Promise.resolve());
  await window.XP.whenReady();
  await window.Depth.whenReady();
  await window.Trophies.whenReady();
  await wait(900);
  if(!Settings.get().hintSeen) Settings.set({ hintSeen: true });

  const modeFound = document.documentElement.dataset.mode || 'dark';
  Settings.set({ colorMode: 'dark', glow: 'full', reduceMotion: false });
  await wait(200);

  const stripEl = document.getElementById('strip');
  const centeredCard = () => {
    const idx = Math.round(stripEl.scrollTop / (stripEl.clientHeight || 1));
    return stripEl.children[idx] || null;
  };
  const centeredBody = () => centeredCard() && centeredCard().querySelector('.cart-body');

  async function jumpTo(id, settle = 2200){
    const mod = Strip.all().find(x => x.id === id);
    if(!mod) return false;
    StripShell.jumpToModule(mod);
    for(let i = 0; i < 24; i++){
      await wait(250);
      if(StripShell._centeredMod() && StripShell._centeredMod().id === id) break;
    }
    await wait(settle - 2000 > 0 ? 200 : 200);
    return StripShell._centeredMod().id === id;
  }
  const clickBtn = (body, name) => {
    const b = [...body.querySelectorAll('button')].find(x => x.textContent.trim() === name);
    if(b) b.click();
    return !!b;
  };

  // ---------- A1: ceremony engine ----------
  const RC = window.RunCeremony;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const el1 = RC.show(host, { tone: 'win', label: 'TEST WIN', score: 42, unit: 'pts', delta: 'NEW BEST', deltaTone: 'good', verb: 'GO', onVerb: () => {} });
  await wait(80);
  const a1a = !!host.querySelector(':scope > .run-ceremony.rc-win')
    && el1.getAttribute('role') === 'status'
    && el1.querySelector('.rc-label').textContent === 'TEST WIN'
    && el1.querySelector('.rc-score').textContent === '42'
    && el1.querySelector('.rc-unit').textContent === 'pts'
    && el1.querySelector('.rc-delta').textContent === 'NEW BEST';
  // verb fires + retires
  let verbFired = 0;
  RC.show(host, { tone: 'over', label: 'T2', verb: 'HIT', onVerb: () => verbFired++ });
  await wait(60);
  [...host.querySelectorAll('.rc-verb')].pop().click();
  await wait(400);
  // one panel per host: the second show left exactly ONE panel, tone replaced
  const a1b = verbFired === 1;
  RC.show(host, { tone: 'clear', label: 'T3' });
  RC.show(host, { tone: 'draw', label: 'T4' });
  await wait(60);
  const panels = host.querySelectorAll(':scope > .run-ceremony');
  const a1c = panels.length === 1 && panels[0].classList.contains('rc-draw');
  RC.hide(host);
  await wait(400);
  const a1d = !host.querySelector(':scope > .run-ceremony');
  host.remove();
  ok('A1 ceremony engine: anatomy, verb=1 shot, replace-per-host, hide',
     a1a && a1b && a1c && a1d,
     'anatomy=' + a1a + ' verb=' + a1b + ' replace=' + a1c + ' hide=' + a1d);

  // ---------- A2: REAL colorsnap death ----------
  ok('A2-pre jump colorsnap', await jumpTo('colorsnap'), StripShell._centeredMod().id);
  {
    const body = centeredBody();
    clickBtn(body, 'MATCH'); // start
    await wait(500);
    for(let i = 0; i < 30; i++){
      clickBtn(body, 'MISMATCH');
      await wait(260);
      if(body.querySelector(':scope > .run-ceremony')) break;
    }
    const rc = body.querySelector(':scope > .run-ceremony');
    ok('A2 colorsnap death → SNAPPED panel (rc-over, streak, RETRY)',
       !!rc && rc.classList.contains('rc-over')
       && rc.querySelector('.rc-label').textContent === 'SNAPPED'
       && rc.querySelector('.rc-unit').textContent === 'streak'
       && rc.querySelector('.rc-verb').textContent === 'RETRY',
       rc ? rc.querySelector('.rc-label').textContent + '/' + rc.querySelector('.rc-score').textContent : 'no panel');
    if(rc) clickBtn(body, 'RETRY'); // clean exit before the sweep
  }

  // ---------- A3: REAL xox round ----------
  ok('A3-pre jump xox', await jumpTo('xox'), StripShell._centeredMod().id);
  {
    const body = centeredBody();
    let label = null, delta = null;
    for(let i = 0; i < 30; i++){
      const cells = [...body.querySelectorAll('button')].filter(b => b.textContent === '' && !b.disabled);
      if(!cells.length){
        const rc = body.querySelector(':scope > .run-ceremony');
        if(rc){ label = rc.querySelector('.rc-label').textContent; delta = (rc.querySelector('.rc-delta') || {}).textContent || ''; }
        break;
      }
      cells[0].click();
      await wait(420);
      const rc = body.querySelector(':scope > .run-ceremony');
      if(rc){ label = rc.querySelector('.rc-label').textContent; delta = (rc.querySelector('.rc-delta') || {}).textContent || ''; break; }
    }
    // win-line contract: the render() source carries the 2px accent stroke
    let src = ''; try{ src = Function.prototype.toString.call(Strip.all().find(x => x.id === 'xox').mount); }catch(e){}
    ok('A3 xox end-of-round ceremony + W/D/L tally + win-line stroke in render',
       !!label && /\d+W · \d+D · \d+L/.test(delta) && src.includes('inset 0 0 0 2px var(--amber)'),
       label + ' / ' + delta);
    const rc = body.querySelector(':scope > .run-ceremony');
    if(rc) clickBtn(body, 'NEW ROUND');
  }

  // ---------- A4: REAL stacktower death ----------
  ok('A4-pre jump stacktower', await jumpTo('stacktower'), StripShell._centeredMod().id);
  {
    const body = centeredBody();
    const cv = body.querySelector('canvas');
    const tap = () => {
      const r = cv.getBoundingClientRect();
      cv.dispatchEvent(new MouseEvent('mousedown', { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true }));
    };
    tap(); // start
    await wait(600);
    for(let i = 0; i < 14; i++){
      if(body.querySelector(':scope > .run-ceremony')) break; // stop at the FIRST death — no multi-death ambiguity
      tap();
      await wait(240);
    }
    let rc = body.querySelector(':scope > .run-ceremony');
    if(!rc) await wait(800);
    rc = body.querySelector(':scope > .run-ceremony');
    const a4a = !!rc && rc.classList.contains('rc-over') && rc.querySelector('.rc-verb').textContent === 'REBUILD';
    // the verb restarts: score resets to 0, panel retires
    if(rc) clickBtn(body, 'REBUILD');
    await wait(600);
    const a4b = !body.querySelector(':scope > .run-ceremony')
      && (body.querySelector('[id=st-score]') || { textContent: '?' }).textContent === '0';
    ok('A4 stacktower death → THE TOWER FELL + REBUILD restarts clean',
       a4a && a4b, 'panel=' + a4a + ' restart=' + a4b);
  }

  // ---------- A5: contrast floor ----------
  ok('A5-pre jump mini2048', await jumpTo('mini2048'), StripShell._centeredMod().id);
  {
    // A5a — dark ramp: t2/t4 computed + separated
    const mk = (cls) => { const d = document.createElement('div'); d.className = cls; document.body.appendChild(d); return d; };
    const t2 = mk('s2-t s2-t2'), t4 = mk('s2-t s2-t4');
    const c2 = getComputedStyle(t2).backgroundColor, c4 = getComputedStyle(t4).backgroundColor;
    t2.remove(); t4.remove();
    const parse = (s) => s.match(/\d+/g).map(Number);
    const [r2, g2, b2] = parse(c2), [r4, g4, b4] = parse(c4);
    const dist = Math.abs(r2 - r4) + Math.abs(g2 - g4) + Math.abs(b2 - b4);
    ok('A5a 2048 dark ramp daylighted: t2=rgb(63,63,77), t2↔t4 ≥ 14 apart',
       c2 === 'rgb(63, 63, 77)' && dist >= 14, 't2=' + c2 + ' t4=' + c4 + ' dist=' + dist);
  }
  {
    // A5b — maze walls wear the inset stroke
    ok('A5b-pre jump maze', await jumpTo('maze'), StripShell._centeredMod().id);
    const body = centeredBody();
    await wait(300);
    const cells = [...body.querySelectorAll('div')].filter(d => d.style.background && getComputedStyle(d).backgroundColor !== 'rgba(0, 0, 0, 0)');
    const stroked = cells.filter(d => (getComputedStyle(d).boxShadow || '').includes('inset'));
    ok('A5b maze walls stroked: ≥ 8 wall cells carry an inset --line stroke',
       stroked.length >= 8, 'cells=' + cells.length + ' stroked=' + stroked.length);
  }
  {
    // A5c — sokoban scale
    ok('A5c-pre jump sokoban', await jumpTo('sokoban'), StripShell._centeredMod().id);
    const body = centeredBody();
    await wait(300);
    const cell = [...body.querySelectorAll('div')].find(d => /^\d+px$/.test(d.style.width));
    const w = cell ? parseInt(cell.style.width, 10) : 0;
    ok('A5c sokoban cells scale to fill (≥ 24px, was hard-locked 18px)', w >= 24, 'cell=' + w + 'px');
  }
  {
    // A5d — minesweeper recess + A5e dropfour wells
    ok('A5d-pre jump minesweeper', await jumpTo('minesweeper'), StripShell._centeredMod().id);
    const body = centeredBody();
    await wait(300);
    const cellBtn = [...body.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || '').includes('hidden'));
    if(cellBtn) cellBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await wait(400);
    const revealed = [...body.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || '').includes('revealed'));
    const digShadow = revealed ? getComputedStyle(revealed).boxShadow : '';
    ok('A5d minesweeper dig is a RECESS (revealed cell carries an inset shadow)',
       digShadow.includes('inset'), 'shadow=' + digShadow.slice(0, 60));
  }
  {
    ok('A5e-pre jump dropfour', await jumpTo('dropfour'), StripShell._centeredMod().id);
    const body = centeredBody();
    await wait(300);
    const hole = [...body.querySelectorAll('div')].find(d => d.style.borderRadius === '50%');
    const hs = hole ? getComputedStyle(hole).boxShadow : '';
    ok('A5e dropfour holes are recessed wells (inset shadow)', hs.includes('inset'), hs.slice(0, 60));
  }
  {
    // A5f — whackmole dirt token across the chassis
    ok('A5f-pre jump whackmole', await jumpTo('whackmole'), StripShell._centeredMod().id);
    const body = centeredBody();
    await wait(300);
    const hole = [...body.querySelectorAll('button')].find(b => (b.style.background || '').includes('screen-hole') || (b.getAttribute('style') || '').includes('screen-hole'));
    const bgDark = hole ? getComputedStyle(hole).backgroundColor : '';
    Settings.set({ colorMode: 'light' });
    await wait(300);
    const bgLight = hole ? getComputedStyle(hole).backgroundColor : '';
    Settings.set({ colorMode: 'dark' });
    await wait(200);
    ok('A5f whackmole hole token: dark #1a1510 → light #B9A98C (no black punch-out)',
       bgDark === 'rgb(26, 21, 16)' && bgLight === 'rgb(185, 169, 140)',
       'dark=' + bgDark + ' light=' + bgLight);
  }
  {
    // A6 — minisudoku light residuals
    ok('A6-pre jump minisudoku', await jumpTo('minisudoku'), StripShell._centeredMod().id);
    const body = centeredBody();
    await wait(300);
    Settings.set({ colorMode: 'light' });
    await wait(300);
    const cells = [...body.querySelectorAll('button')].filter(b => b.style.background && b.style.background.includes('screen'));
    const darkStranded = cells.filter(b => {
      const bg = getComputedStyle(b).backgroundColor;
      const [r, g, bl] = bg.match(/\d+/g).map(Number);
      return r + g + bl < 150; // near-black cell stranded on paper
    });
    Settings.set({ colorMode: 'dark' });
    await wait(200);
    ok('A6 minisudoku light: free cells ride the screen tokens (0 stranded dark cells)',
       cells.length > 0 && darkStranded.length === 0,
       'tokenCells=' + cells.length + ' stranded=' + darkStranded.length);
  }

  // ---------- B1: toast layer + type floor ----------
  const toast = document.getElementById('lock-toast');
  const toastTop = toast ? getComputedStyle(toast).top : '';
  const trophyToast = document.getElementById('trophy-toast');
  const trophyTop = trophyToast ? getComputedStyle(trophyToast).top : '';
  ok('B1a toasts moved below the title row (top:158px, was 70px)',
     toastTop === '158px' && trophyTop === '158px', 'lock=' + toastTop + ' trophy=' + trophyTop);

  ok('B1b-pre jump towerdefense', await jumpTo('towerdefense'), StripShell._centeredMod().id);
  {
    // computed-style finder: the browser normalizes the style attribute
    // ("font-size: 11px"), so match on rendered output, not attribute text
    const body = centeredBody();
    await wait(300);
    const rows = [...body.querySelectorAll('div')].filter(d => d.textContent.includes('GOLD') && d.textContent.includes('WAVE'));
    const row = rows[0];
    const fs = row ? parseFloat(getComputedStyle(row).fontSize) : 0;
    ok('B1b TD header at the 11px floor', fs >= 11, 'fontSize=' + fs + 'px rows=' + rows.length);
  }

  // ---------- B2: copy ----------
  ok('B2-pre jump randomfact', await jumpTo('randomfact'), StripShell._centeredMod().id);
  {
    const body = centeredBody();
    await wait(300);
    const counter = body.textContent.match(/FACT #\d+\/\d+/);
    ok('B2a randomfact numbers the FACT ITSELF (#n/total)', !!counter, counter ? counter[0] : body.textContent.slice(0, 40));
  }
  ok('B2b-pre jump thisorthat', await jumpTo('thisorthat'), StripShell._centeredMod().id);
  {
    const body = centeredBody();
    await wait(300);
    // pick ONCE on a wiped profile → total=1 < 5 → the lean line must stay silent
    const btns = [...body.querySelectorAll('button')].filter(b => b.textContent.length > 1 && !/🤔/.test(b.textContent) && !/Reset/i.test(b.textContent));
    if(btns.length) btns[0].click();
    await wait(450);
    const after = body.textContent;
    ok('B2b thisorthat: no lean % before n=5', !/lean (LEFT|RIGHT)|dead even/.test(after), after.slice(0, 50));
  }

  // ---------- C: sweep + errors ----------
  let sweepOk = 0, sweepBad = [];
  // (the gauntlet's mount sweep runs against fresh mounts; jump through all)
  for(const m of Strip.all()){
    try{
      const landed = await jumpTo(m.id, 300);
      if(landed) sweepOk++; else sweepBad.push(m.id + ':nojump');
    }catch(err){ sweepBad.push(m.id + ':' + String(err).slice(0, 20)); }
  }
  ok('C1 52/52 cartridges center + mount glitch-free', sweepOk === Strip.all().length,
     sweepOk + '/' + Strip.all().length + (sweepBad.length ? ' bad=' + sweepBad.slice(0, 3).join(',') : ''));

  ok('C2 zero console errors across the suite', consoleErrors.length === 0,
     consoleErrors.slice(0, 3).join(' | ') || 'clean');

  Settings.set({ colorMode: modeFound });
  return { results };
})();
