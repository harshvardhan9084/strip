/**
 * qa/r17-regression.js — pins the Round 17 behavioral fixes.
 *
 * Run: serve the app root with any static server, open it in a browser,
 * then eval this file (e.g. `agent-browser eval "$(cat qa/r17-regression.js)"`).
 * Resolves to an array of { name, pass, info } on window.__qa17.
 *
 * Pinned invariants:
 *  1. kingdom legacy-save migration: a pre-fix save (population 6, 2 farmers
 *     on 1 farm) mounts clamped to the current rules, and Advance pays
 *     exactly 1 farm's yield — no phantom-worker payout.
 *  2. blobmerge two-pointer isolation: blob A follows its own pointer only
 *     (per-element pointer capture).
 *  3. towerdefense hover ghost renders during an active wave (mid-wave
 *     building is the core decision).
 */
window.__qa17 = (async () => {
  const results = [];
  const ok = (name, pass, info) => results.push({ name, pass: !!pass, info });
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
    if (!card) return false;
    strip.style.scrollBehavior = 'auto';
    strip.scrollTop = cards.indexOf(card) * strip.clientHeight;
    strip.style.scrollBehavior = '';
    strip.dispatchEvent(new Event('scroll'));
    await wait(800);
    return true;
  };
  const stats = (b) => b.querySelector('div[style*="flex-wrap"]').textContent.replace(/\s+/g, ' ');
  const LEGACY = { day: 3, gold: 44, food: 50, population: 6, farms: 1, mines: 0, houses: 1, assign: { farm: 2, mine: 0 } };

  // ---- 1. kingdom: clamp at mount, clamp before yield ----
  try {
    // seed BEFORE the card ever mounts — a mounted card's unmount persist
    // would otherwise race (and can overwrite) the seeded row
    await StripDB.saveState('kingdom', LEGACY);
    const row = await StripDB.loadState('kingdom');
    ok('kingdom: legacy row seeded', row && row.population === 6, JSON.stringify(row).slice(0, 60));
    await goto('Kingdom');
    const b = bodyOf('Kingdom');
    const mounted = stats(b);
    ok('kingdom: legacy population clamped 6 -> housing cap', /POP4\/4/.test(mounted), mounted);
    ok('kingdom: rest of legacy save preserved', /DAY3/.test(mounted) && /GOLD44/.test(mounted), mounted);
    const adv = [...b.querySelectorAll('button')].find(x => /Advance day/.test(x.textContent));
    // Round 19 note: Kingdom gained random day events (drought/bandits/etc).
    // Stub Math.random above the event threshold so this yield pin stays
    // deterministic — the event layer itself is pinned in qa/r19-regression.js.
    const realRandom = Math.random;
    Math.random = () => 0.9;
    adv.click();
    await wait(300);
    Math.random = realRandom;
    const after = stats(b);
    // 50 + (1 farm * 4) - (4 pop * 1.2) = 49.2 — a double payout would be 53.2
    ok('kingdom: advance pays exactly one farm (49.2, not 53.2)', /FOOD49\.2/.test(after), after);
  } catch (e) { ok('kingdom: suite errored', false, String(e).slice(0, 80)); }

  // ---- 2. blobmerge: two-pointer isolation ----
  try {
    await goto('Blob Merge');
    await wait(500);
    const b = bodyOf('Blob Merge');
    const board = b.querySelector('div[style*="touch-action: none"]');
    const [A, B] = [...board.children];
    const ra = A.getBoundingClientRect(), rb = B.getBoundingClientRect();
    const a0 = A.style.left;
    // pointer 90 grabs A and drags +40px; pointer 91 grabs B — A must ignore 91 entirely
    A.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 90, clientX: ra.left + 20, clientY: ra.top + 20 }));
    A.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 90, clientX: ra.left + 60, clientY: ra.top + 20 }));
    B.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 91, clientX: rb.left + 20, clientY: rb.top + 20 }));
    B.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 91, clientX: rb.left + 20, clientY: rb.top + 80 }));
    B.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 91, clientX: rb.left + 20, clientY: rb.top + 80 }));
    await wait(100);
    ok('blobmerge: blob A follows its own pointer (+40px), not B\u2019s', A.style.left === (parseFloat(a0) + 40) + 'px', a0 + ' -> ' + A.style.left);
    A.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 90, clientX: ra.left + 60, clientY: ra.top + 20 }));
    await wait(150);
  } catch (e) { ok('blobmerge: suite errored', false, String(e).slice(0, 80)); }

  // ---- 3. towerdefense: hover ghost during a wave ----
  try {
    await goto('Tower Defense');
    await wait(600);
    const b = bodyOf('Tower Defense');
    const canvas = b.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const waveBtn = [...b.querySelectorAll('button')].find(x => /Start wave/.test(x.textContent));
    if (waveBtn && !waveBtn.disabled) waveBtn.click();
    await wait(400);
    canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, pointerType: 'mouse', clientX: rect.left + rect.width * 0.35, clientY: rect.top + rect.height * 0.55 }));
    await wait(150);
    // the ghost ring is #FFB347 at ~53% alpha over a dark board — blended it
    // reads ~rgb(140,105,55), so look for warm-over-dark, not pure amber
    const ctx = canvas.getContext('2d');
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let warm = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 110 && d[i + 1] > 80 && d[i] > d[i + 1] && d[i + 1] > d[i + 2]) warm++;
    }
    ok('towerdefense: hover ghost renders during a wave', warm > 120, 'warm px: ' + warm);
  } catch (e) { ok('towerdefense: suite errored', false, String(e).slice(0, 80)); }

  return results;
})();
'qa17 running -> window.__qa17';
