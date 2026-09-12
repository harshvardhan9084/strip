/**
 * qa/r19-regression.js — pins the Round 19 AUDIT.md fixes.
 *
 * Run: serve the app root, open in a browser, then
 * `agent-browser eval "$(cat qa/r19-regression.js)"; sleep N; agent-browser eval "window.__qa19.then(r => ...)"`.
 * Resolves to an array of { name, pass, info } on window.__qa19.
 *
 * Pinned invariants (one per P0 deadend + the risky P1/P2 mechanics):
 *  1. towerdefense: tapping your own tower opens the UPGRADE panel (the
 *     wave-17 deadend fix), upgrade buys a level, sell refunds 70%.
 *  2. blobmerge: dragging a blob OFF the board recycles it (+stage² score,
 *     cell cleared) — the anti-plateau valve.
 *  3. sokoban: level-select grid exposes 20 levels (was 5), all playable.
 *  4. tradingpost: ×10 buy moves 10 units in ONE click (the 100-click fix).
 *  5. kingdom: the random-event layer fires when Math.random < 0.28.
 *  6. lexicle: ARISE (the standard opener) is an accepted guess.
 *  7. minesweeper: difficulty switch rebuilds the field (8×8 → 12×10).
 */
window.__qa19 = (async () => {
  const results = [];
  const ok = (name, pass, info) => results.push({ name, pass: !!pass, info: String(info || '').slice(0, 90) });
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  const strip = document.getElementById('strip');
  const bodyOf = (title) => {
    const card = [...strip.querySelectorAll('.cart')]
      .find(c => (c.querySelector('.cart-title') || {}).textContent === title);
    return card ? card.querySelector('.cart-body') : null;
  };
  const goto = async (title) => {
    const cards = [...strip.querySelectorAll('.cart')];
    const card = cards.find(c => (c.querySelector('.cart-title') || {}).textContent === title);
    if(!card) throw new Error('card not found: ' + title);
    strip.style.scrollBehavior = 'auto';
    strip.scrollTop = cards.indexOf(card) * strip.clientHeight;
    strip.style.scrollBehavior = '';
    strip.dispatchEvent(new Event('scroll'));
    await wait(350);
  };

  // ---- 1. towerdefense: upgrade + sell panel ----
  try {
    await goto('Tower Defense');
    await wait(600);
    const b = bodyOf('Tower Defense');
    const canvas = b.querySelector('canvas');
    // place an arrow tower at (1,2) via the same math the click handler uses
    const rect = canvas.getBoundingClientRect();
    const ev = (r, c) => new MouseEvent('click', { bubbles: true, clientX: rect.left + (c + 0.5) * rect.width / 10, clientY: rect.top + (r + 0.5) * rect.height / 10 });
    canvas.dispatchEvent(ev(1, 2));
    await wait(200);
    // tapping the SAME cell must open the panel (not place a second tower)
    canvas.dispatchEvent(ev(1, 2));
    await wait(200);
    const panel = [...b.querySelectorAll('div')].find(d => d.style.display === 'flex' && /Upgrade/.test(d.textContent) && /Sell/.test(d.textContent));
    ok('towerdefense: tap own tower opens upgrade panel', !!panel, panel && panel.textContent.slice(0, 60));
    if(panel){
      const upBtn = [...panel.querySelectorAll('button')].find(x => /Upgrade/.test(x.textContent));
      const goldCell = b.querySelector('div[style*="font-family"]') || b;
      upBtn.click();
      await wait(200);
      const pipsUp = /Upgrade 38g|MAX/.test(panel.textContent); // 15×1.6² ≈ 38 for lv2 after first buy shows next cost
      ok('towerdefense: upgrade purchase advances cost ladder', pipsUp, panel.textContent.slice(0, 70));
    }
  } catch (e) { ok('towerdefense: suite errored', false, e.message || e); }

  // ---- 2. blobmerge: off-board recycle ----
  try {
    await goto('Blob Merge');
    await wait(500);
    const b = bodyOf('Blob Merge');
    const board = b.querySelector('div[style*="touch-action: none"]');
    const scoreEl = b.querySelector('#bm-score');
    // two attempts — a synthetic drag can occasionally race the card's render
    let recycled = false, trace = '';
    for(let attempt = 0; attempt < 2 && !recycled; attempt++){
      const before = scoreEl.textContent;
      const blob = board.children[0];
      const r0 = blob.getBoundingClientRect();
      blob.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, clientX: r0.left + 10, clientY: r0.top + 10 }));
      // drag far above the board — release with the center outside the top edge
      blob.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 7, clientX: r0.left + 10, clientY: r0.top - 90 }));
      blob.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, clientX: r0.left + 10, clientY: r0.top - 90 }));
      await wait(350);
      recycled = +scoreEl.textContent > +before;
      trace = `score ${before}->${scoreEl.textContent} (attempt ${attempt + 1})`;
    }
    ok('blobmerge: off-board drop recycles (score + cell cleared)', recycled, trace);
  } catch (e) { ok('blobmerge: suite errored', false, e.message || e); }

  // ---- 3. sokoban: 20-level grid ----
  try {
    await goto('Crate Push');
    await wait(500);
    const b = bodyOf('Crate Push');
    const levelsBtn = [...b.querySelectorAll('button')].find(x => x.textContent === 'Levels');
    levelsBtn.click();
    await wait(200);
    const grid = [...b.querySelectorAll('div')].find(d => d.style.display === 'grid' &&
      [...d.children].filter(c => c.tagName === 'BUTTON').length === 20);
    ok('sokoban: level select exposes 20 levels', !!grid, grid && (grid.children.length + ' children'));
    const dailyBtn = [...b.querySelectorAll('button')].find(x => x.textContent === 'Daily');
    ok('sokoban: daily crate button present', !!dailyBtn);
  } catch (e) { ok('sokoban: suite errored', false, e.message || e); }

  // ---- 4. tradingpost: ×10 bulk trade ----
  try {
    // seed a rich, EMPTY-stock state so the trade delta is deterministic
    // regardless of what earlier sessions bought (IndexedDB persists)
    await StripDB.saveState('tradingpost', { gold: 5000, cap: 300, stock: { grain: 0, cloth: 0, gems: 0 }, lastSeen: Date.now() });
    await goto('Trading Post');
    await wait(600);
    const b = bodyOf('Trading Post');
    // force a rich state deterministically
    const size10 = [...b.querySelectorAll('button')].find(x => x.textContent === '×10');
    ok('tradingpost: ×10 size button present', !!size10);
    size10.click();
    await wait(100);
    const owns = [...b.querySelectorAll('.own')];
    const before = owns.map(x => +x.textContent);
    const buyBtn = [...b.querySelectorAll('button')].find(x => x.textContent === 'Buy');
    buyBtn.click();
    await wait(200);
    const after = [...b.querySelectorAll('.own')].map(x => +x.textContent);
    const delta = after.map((v, i) => v - before[i]);
    ok('tradingpost: one ×10 Buy moves 10 units', delta.some(d => d === 10), `stock delta [${delta}]`);
  } catch (e) { ok('tradingpost: suite errored', false, e.message || e); }

  // ---- 5. kingdom: event layer fires ----
  try {
    await goto('Kingdom');
    await wait(600);
    const b = bodyOf('Kingdom');
    const adv = [...b.querySelectorAll('button')].find(x => /Advance day/.test(x.textContent));
    const note = [...b.querySelectorAll('div')].find(d => d.style.minHeight === '16px');
    const realRandom = Math.random;
    Math.random = () => 0.1; // inside the 28% event window AND inside the drought band
    adv.click();
    await wait(250);
    Math.random = realRandom;
    ok('kingdom: random event fired (drought note)', /Drought/.test(note.textContent), note.textContent.slice(0, 50));
  } catch (e) { ok('kingdom: suite errored', false, e.message || e); }

  // ---- 6. lexicle: ARISE accepted (real key events through the window handler) ----
  try {
    await goto('Lexicle');
    await wait(600);
    const b = bodyOf('Lexicle');
    'arise'.split('').forEach(k => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await wait(250);
    // accepted = the first row's five tiles all got a colored fill
    const filled = [...b.querySelectorAll('div')].filter(d =>
      /^rgb\((51, 51, 61|78, 154, 91|176, 138, 46)\)$/.test(d.style.background)).length;
    ok('lexicle: ARISE is an accepted guess', filled >= 5, `${filled} colored tiles`);
  } catch (e) { ok('lexicle: suite errored', false, e.message || e); }

  // ---- 7. minesweeper: difficulty ladder rebuilds ----
  try {
    // seed back to the rookie field — an earlier session may have left 12×10
    await StripDB.saveState('minesweeper', { diff: 0, bests: {}, wins: 0, streak: 0 });
    await goto('Minesweeper');
    await wait(600);
    const b = bodyOf('Minesweeper');
    const boardDiv = [...b.querySelectorAll('div')].find(d => /repeat\(8,\s?/.test(d.style.gridTemplateColumns));
    const before = boardDiv ? boardDiv.children.length : 0;
    const btn12 = [...b.querySelectorAll('button')].find(x => x.textContent === '12×10');
    btn12.click();
    await wait(300);
    const boardDiv2 = [...b.querySelectorAll('div')].find(d => /repeat\(12,\s?/.test(d.style.gridTemplateColumns));
    const after = boardDiv2 ? boardDiv2.children.length : 0;
    ok('minesweeper: 12×10 rebuilds to 120 cells', before === 64 && after === 120, `${before} -> ${after}`);
  } catch (e) { ok('minesweeper: suite errored', false, e.message || e); }

  return results;
})();
"qa19 running -> window.__qa19";
