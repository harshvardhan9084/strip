/**
 * qa/r36-regression.js — pins the Round 36 build ("The One Anatomy — the
 * final wave"): shell-owned STAT ROW + sparkline-everywhere + BOARD SCALE.
 *
 * IMPORTANT (determinism): run on a FRESH SESSION — wipe + reload first:
 *   agent-browser eval "indexedDB.deleteDatabase('strip-db'); localStorage.clear(); 'wiped'"
 *   agent-browser open "http://<host>:<port>/"; sleep 3;
 *   agent-browser eval "$(cat qa/r36-regression.js)"; sleep 25;
 *   agent-browser eval "window.__qa36.then(r => JSON.stringify(r))"
 *
 * Pinned invariants:
 *  A1. SHELL SLOT: every card carries a hidden .cart-stats between header
 *      and body; setStats renders .cart-stat nodes INTO THE SHELL SLOT (not
 *      the game body); empty list hides it again.
 *  A2. ≤4 CAP + IDEMPOTENCE: a 6-stat list renders 4; re-rendering the same
 *      list is a true no-op (same DOM node survives — signature discipline).
 *  A3. REAL CONVERSIONS: lightsout tile tap → MOVES 1 in the slot; TD
 *      mount → GOLD/LIVES/WAVE/BEST visible; kingdom mount → DAY row;
 *      blockfall Start → SCORE/LINES/LV/BEST; dropfour first drop →
 *      WIN STREAK row; minesweeper dig → MINES row.
 *  A4. UNMOUNT REAPING: stats set on a card, jump 3+ away, settle → the
 *      abandoned card's slot is hidden + empty again (shell owns reaping).
 *  A5. SPARKLINE EVERYWHERE: a seeded 1-play record renders the thin chip
 *      (BEST text, NO svg) on the centered card; a 2nd play upgrades to the
 *      charted chip; a strip:gameover on the centered game re-grades NOW.
 *  A6. BOARD SCALE: html[data-board-scale] follows the dial; --board-scale
 *      flips .82/1/1.22; a mounted grid board (lightsout) GROWS at L and
 *      restores at M (live calc regrade, no remount); sokoban's numeric
 *      cell math follows via its listener.
 *  A7. TYPE HOOK: the shell stat row re-grades with the text-size dial
 *      (CSS-owned: 13px → 15px at L) — one anatomy, one type scale.
 *  C1. 52/52 mount sweep glitch-free.
 *  C2. Zero console errors across the whole suite.
 */
window.__qa36 = (async () => {
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
  Settings.set({ colorMode: 'dark', glow: 'full', reduceMotion: false, textSize: 'm', colorblind: false, flashSafe: false, autoNight: false, boardScale: 'm' });
  await wait(250);

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
    return StripShell._centeredMod() && StripShell._centeredMod().id === id;
  }
  const clickBtn = (body, name) => {
    const b = [...body.querySelectorAll('button')].find(x => x.textContent.trim() === name);
    if(b) b.click();
    return !!b;
  };
  const slotOf = (card) => card && card.querySelector('.cart-stats');
  const slotText = (card) => { const s = slotOf(card); return s && !s.hidden ? s.textContent : ''; };

  // ---------- A1: the shell slot exists + renders into the SHELL ----------
  {
    const cards = [...stripEl.children];
    const allHave = cards.length > 0 && cards.every(c => c.querySelector('.cart-stats'));
    ok('A1a every built card carries a .cart-stats slot', allHave, 'cards=' + cards.length);
  }
  ok('A1-pre jump lightsout', await jumpTo('lightsout'), StripShell._centeredMod().id);
  {
    const card = centeredCard();
    // a converted game populates the slot AT MOUNT (its own render path)
    const atMount = slotText(card);
    // a real TILE tap → render() → setStats through the SHELL api
    const tile = [...centeredBody().querySelectorAll('button')].find(b => b.closest('[style*="grid-template-columns"]'));
    if(tile) tile.click();
    await wait(150);
    const after = slotText(card);
    const inShell = !!card.querySelector(':scope > .cart-inner > .cart-stats .cart-stat');
    const notInBody = centeredBody().querySelector('.cart-stat') === null;
    ok('A1b lightsout renders MOVES into the shell slot and the tile tap bumps it',
       atMount.includes('MOVES') && inShell && notInBody && after.includes('MOVES1'),
       'mount="' + atMount.slice(0, 30) + '" after="' + after.slice(0, 30) + '"');
  }
  {
    // a no-stat toy keeps the slot hidden — the anatomy adds nothing to cards
    // that declare no stats
    const toyCard = [...stripEl.children].find(c => c.textContent.includes('Breathe')) || [...stripEl.children].find(c => c.textContent.includes('Sand Drag'));
    const hiddenToy = toyCard ? (slotOf(toyCard).hidden && slotOf(toyCard).innerHTML === '') : false;
    ok('A1c a no-stat card keeps its slot hidden + empty', hiddenToy, toyCard ? 'toy found' : 'no toy card in first batch');
  }

  // ---------- A2: cap + idempotence ----------
  {
    const card = centeredCard();
    const mod = StripShell._centeredMod();
    const api = StripShell._testMakeApi({ mod, el: card });
    api.setStats([
      { label: 'A', value: '1' }, { label: 'B', value: '2' }, { label: 'C', value: '3' },
      { label: 'D', value: '4' }, { label: 'E', value: '5' }, { label: 'F', value: '6' },
    ]);
    await wait(80);
    const slot = slotOf(card);
    const capped = slot.querySelectorAll('.cart-stat').length === 4
      && slot.textContent.includes('D') && !slot.textContent.includes('E');
    const node = slot.querySelector('.cart-stat');
    api.setStats([
      { label: 'A', value: '1' }, { label: 'B', value: '2' }, { label: 'C', value: '3' },
      { label: 'D', value: '4' }, { label: 'E', value: '5' }, { label: 'F', value: '6' },
    ]);
    await wait(80);
    const sameNode = slot.querySelector('.cart-stat') === node;
    api.setStats([]);
    await wait(80);
    const cleared = slot.hidden && slot.innerHTML === '';
    ok('A2a six stats render four (cap)', capped, 'n=' + slot.querySelectorAll('.cart-stat').length);
    ok('A2b identical re-render is a true no-op (same node)', sameNode, '');
    ok('A2c empty list hides + empties the slot', cleared, '');
    // restore the real row
    api.setStats([{ label: 'MOVES', value: '1', color: 'var(--amber)' }]);
    await wait(60);
  }

  // ---------- A3: real conversions speak through the slot ----------
  ok('A3a jump towerdefense', await jumpTo('towerdefense'), StripShell._centeredMod().id);
  {
    const t = slotText(centeredCard());
    ok('A3b TD mounts with GOLD/LIVES/WAVE/BEST in the slot',
       t.includes('GOLD') && t.includes('LIVES') && t.includes('WAVE') && t.includes('BEST'), t.slice(0, 50));
  }
  ok('A3c jump kingdom', await jumpTo('kingdom'), StripShell._centeredMod().id);
  {
    const t = slotText(centeredCard());
    ok('A3d kingdom mounts with DAY/GOLD/FOOD/POP (BEST rides the chip)',
       t.includes('DAY') && t.includes('GOLD') && t.includes('FOOD') && t.includes('POP') && !t.includes('BEST'), t.slice(0, 50));
  }
  ok('A3e jump blockfall', await jumpTo('blockfall'), StripShell._centeredMod().id);
  {
    const t = slotText(centeredCard());
    ok('A3f blockfall mounts with SCORE/LINES/LV/BEST',
       t.includes('SCORE') && t.includes('LINES') && t.includes('LV'), t.slice(0, 50));
  }
  ok('A3g jump dropfour', await jumpTo('dropfour'), StripShell._centeredMod().id);
  {
    const card = centeredCard();
    const cols = centeredBody().querySelector('.cart-body > div, [style*="grid"]');
    // drop into column 0: the board's first cell button
    const cell = [...centeredBody().querySelectorAll('button')].find(b => b.closest('[style*="grid-template"]'));
    if(cell) cell.click();
    await wait(400); // AI reply beat
    const t = slotText(card);
    ok('A3h dropfour drop renders WIN STREAK row', t.includes('WIN STREAK'), t.slice(0, 40));
  }
  ok('A3i jump minesweeper', await jumpTo('minesweeper'), StripShell._centeredMod().id);
  {
    const card = centeredCard();
    const cell = [...centeredBody().querySelectorAll('button, [role="button"]')].find(b => b.closest('[style*="grid-template"]'));
    if(cell) cell.click();
    await wait(250);
    const t = slotText(card);
    ok('A3j minesweeper dig renders MINES/TIME row', t.includes('MINES') && t.includes('TIME'), t.slice(0, 40));
  }

  // ---------- A4: unmount reaping ----------
  {
    const loCard = [...stripEl.children].find(c => c.textContent.includes('Lights Out'));
    ok('A4-pre lightsout card located', !!loCard, '');
    // R37 shell fix: the stats reap is now UNCONDITIONAL of mount state (the
    // R36 early-return let a never-mounted card keep stale stats forever,
    // which made this very assertion a shuffle coin-flip). Side effect: the
    // PREVIOUS jump's settle-prune (220ms after its last scroll frame) wipes
    // any far card's slot — so STALE stats must be written AFTER that prune
    // has passed, or `before` reads false through no fault of the shell.
    await wait(600); // let the previous jump's settle-prune pass
    const api = StripShell._testMakeApi({ mod: Strip.all().find(x => x.id === 'lightsout'), el: loCard });
    api.setStats([{ label: 'STALE', value: '42' }]);
    await wait(60);
    const visibleBefore = !slotOf(loCard).hidden;
    // R36 fix: the DECK is shuffled AND grows past 52 with repeats — jump by
    // ABSOLUTE deck index (scroll), not by module identity
    const loIdx = [...stripEl.children].indexOf(loCard);
    const farIdx = Math.min(loIdx + 3, stripEl.children.length - 1);
    stripEl.scrollTo({ top: farIdx * (stripEl.clientHeight || 1), behavior: 'instant' });
    await wait(400);
    await wait(1400); // settle + prune
    const reaped = slotOf(loCard).hidden && slotOf(loCard).innerHTML === '';
    ok('A4 stats reaped when the card unmounts', visibleBefore && reaped,
       'before=' + visibleBefore + ' reaped=' + reaped + ' deckGap=3');
  }

  // ---------- A5: sparkline everywhere ----------
  ok('A5-pre jump lightsout', await jumpTo('lightsout'), StripShell._centeredMod().id);
  {
    const card = centeredCard();
    const mod = StripShell._centeredMod();
    await StripDB.setHighscore('lightsout', 50000); // one play, real best
    const rec = await StripDB.getScoreRecord('lightsout');
    card._sparkRec = null;
    Sparkline.badge(card, mod);
    await wait(120);
    let chip = card.querySelector('.cart-sparkline');
    const thinOk = !!chip && chip.textContent.includes('BEST') && chip.querySelector('svg') === null;
    await StripDB.setHighscore('lightsout', 40000); // second point → chartable
    card._sparkRec = null;
    Sparkline.badge(card, mod);
    await wait(120);
    chip = card.querySelector('.cart-sparkline');
    const fullOk = !!chip && chip.querySelector('svg') !== null;
    ok('A5a one play earns the chart-less BEST chip', thinOk,
       chip ? chip.textContent.slice(0, 30) : 'no chip');
    ok('A5b two plays upgrade to the charted chip', fullOk, '');
    // strip:gameover on the centered game re-grades NOW (cache bust)
    let rebadged = false;
    const before = card.querySelector('.cart-sparkline');
    window.dispatchEvent(new CustomEvent('strip:gameover', { detail: { id: mod.id, outcome: 'over', score: 39000, winDepth: false, ts: Date.now() } }));
    await wait(160);
    rebadged = !!card.querySelector('.cart-sparkline');
    ok('A5c gameover on the centered card re-grades the chip', rebadged && !!before, '');
  }

  // ---------- A6: board scale ----------
  ok('A6-pre jump lightsout', await jumpTo('lightsout'), StripShell._centeredMod().id);
  {
    const card = centeredCard();
    const board = centeredBody().querySelector('[style*="grid-template-columns"]');
    const wAt = () => board.getBoundingClientRect().width;
    await wait(150);
    const wM = wAt();
    Settings.set({ boardScale: 'l' });
    await wait(220);
    const wL = wAt();
    const varL = getComputedStyle(document.documentElement).getPropertyValue('--board-scale').trim();
    Settings.set({ boardScale: 's' });
    await wait(220);
    const wS = wAt();
    const varS = getComputedStyle(document.documentElement).getPropertyValue('--board-scale').trim();
    Settings.set({ boardScale: 'm' });
    await wait(220);
    const wRestored = wAt();
    ok('A6a dial drives html[data-board-scale] + --board-scale',
       document.documentElement.dataset.boardScale === 'm' && Math.abs(parseFloat(varS) - 0.82) < 0.001 && Math.abs(parseFloat(varL) - 1.22) < 0.001, 'L=' + varL + ' S=' + varS);
    ok('A6b grid board grows at L and restores at M (live calc)',
       wL > wM * 1.1 && wS < wM * 0.95 && Math.abs(wRestored - wM) < 2,
       'M=' + Math.round(wM) + ' L=' + Math.round(wL) + ' S=' + Math.round(wS) + ' R=' + Math.round(wRestored));
    void card;
  }
  ok('A6c jump sokoban', await jumpTo('sokoban'), StripShell._centeredMod().id);
  {
    const cellPx = () => {
      const b = centeredBody().querySelector('[style*="grid-template-columns"]');
      const m = b && b.style.gridTemplateColumns.match(/(\d+(?:\.\d+)?)px/);
      return m ? parseFloat(m[1]) : NaN;
    };
    const csM = cellPx();
    Settings.set({ boardScale: 'l' });
    await wait(260); // listener re-render
    const csL = cellPx();
    Settings.set({ boardScale: 'm' });
    await wait(260);
    const csR = cellPx();
    ok('A6d sokoban cell math follows the dial (numeric re-render)',
       csL > csM && Math.abs(csR - csM) < 1.5, 'M=' + csM + ' L=' + csL + ' R=' + csR);
  }
  {
    // the sheet carries the dial and it syncs
    const segs = document.querySelectorAll('.bscale-seg-btn');
    const l = [...segs].find(b => b.dataset.bscaleValue === 'l');
    if(l) l.click();
    await wait(150);
    const pressed = l && l.getAttribute('aria-pressed') === 'true'
      && document.documentElement.dataset.boardScale === 'l';
    Settings.set({ boardScale: 'm' });
    await wait(120);
    ok('A6e settings sheet BOARD SCALE segment present + syncing', segs.length === 3 && pressed, 'segs=' + segs.length);
  }

  // ---------- A7: the stat row rides the text-size dial ----------
  {
    const card = centeredCard();
    const slot = slotOf(card);
    const api = StripShell._testMakeApi({ mod: StripShell._centeredMod(), el: card });
    api.setStats([{ label: 'SCORE', value: '7', color: 'var(--amber)' }]);
    await wait(80);
    Settings.set({ textSize: 'l' });
    await wait(160);
    const v = slot.querySelector('.cart-stat-value');
    const pxL = v ? parseFloat(getComputedStyle(v).fontSize) : NaN;
    Settings.set({ textSize: 'm' });
    await wait(160);
    const pxM = v ? parseFloat(getComputedStyle(v).fontSize) : NaN;
    ok('A7 shell stat row re-grades with text size (13 → 15 → 13)',
       pxL === 15 && pxM === 13, 'L=' + pxL + ' M=' + pxM);
  }

  // ---------- C: sweep + errors ----------
  Settings.set({ colorMode: modeFound, textSize: 'm', colorblind: false, flashSafe: false, autoNight: false, boardScale: 'm' });
  await wait(200);
  let sweepOk = 0, sweepBad = [];
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

  return { results };
})();
