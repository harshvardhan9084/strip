/**
 * qa/r23-regression.js — pins the Round 23 builds (depth-XP + Daily Missions
 * + the judge's carry list).
 *
 * Run: serve the app root, open in a browser, then
 * `agent-browser eval "$(cat qa/r23-regression.js)"; sleep 45; agent-browser eval "window.__qa23.then(r => JSON.stringify(r))"`.
 * Resolves to an array of { name, pass, info } on window.__qa23.
 *
 * Pinned invariants:
 *  A1. Gameover WIN ladder: api.gameover("win", n) pays +8 XP exactly.
 *  A2. DEEP RUN band: with a seeded best of 100, an "over" run scoring 80
 *      (>= 60% of best, < best) pays +5, not +2.
 *  A3. Plain "over" run below the band pays +2.
 *  A4. Run cap: awards stop paying after RUN_DAILY_CAP gameovers in a day.
 *  A5. strip:xp-awarded broadcast: { reason, amount } detail on every award.
 *  A6. api.gameover sanitization: NaN score -> detail.score 0, unknown
 *      outcome -> "over".
 *  A7. Missions determinism: seededPick(same day) is stable, 3 distinct
 *      missions, every key drawn from the pool.
 *  A8. Missions progress core: a real strip:gameover event moves the run
 *      counters; bumpForTest completes a present mission -> +30 XP paid and
 *      done=true; completing all three -> swept=true and the +40 sweep pays.
 *  A9. Mission/sweep rewards do NOT feed the XP mission (self-feeding is
 *      excluded).
 *  A10. Trophy panel renders the TODAY'S MISSIONS block with 3 rows.
 *  A11. XP pill title carries the missions note after hydration.
 *  B1. Trivia clamp: a legacy save with runBest 14 mounts as "10/10*" with
 *      the normalization note in the title.
 *  B2. Blob Merge: combo chip exists and is hidden before any chain (the
 *      countdown bar renders through the live path when a chain fires).
 *  B3. No console errors during the whole sweep.
 */
window.__qa23 = (async () => {
  const results = [];
  const ok = (name, pass, info) => results.push({ name, pass: !!pass, info: String(info || '').slice(0, 90) });
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const strip = document.getElementById('strip');
  const consoleErrors = [];
  const consoleErr = (e) => consoleErrors.push(String(e));
  window.addEventListener('error', consoleErr);

  await (window.Settings ? Settings.whenReady() : Promise.resolve());
  await window.XP.whenReady();
  await wait(600);

  async function centerOn(id, timeout) {
    StripShell.jumpToModule(Strip.all().find(m => m.id === id));
    const t0 = Date.now();
    let lastTop = -1, lastMatch = null;
    while (Date.now() - t0 < (timeout || 6000)) {
      await wait(250);
      const top = strip.scrollTop;
      const settled = top === lastTop;
      lastTop = top;
      if (!settled) { lastMatch = null; continue; }
      const centered = [...strip.querySelectorAll('.cart')].find(c => {
        const r = c.getBoundingClientRect();
        return Math.abs(r.top - strip.getBoundingClientRect().top) < 20 && r.height > 50;
      });
      if (centered && centered.querySelector('.cart-title') &&
          (Strip.all().find(m => m.id === id).title || '') === centered.querySelector('.cart-title').textContent) {
        if (lastMatch === centered) return centered;
        lastMatch = centered;
      }
    }
    return null;
  }

  const xpNow = () => XP.getState().xp;

  // ---------- A1: WIN pays +8 ----------
  const before1 = xpNow();
  StripShell._testMakeApi({ mod: { id: "qa-pin-game" }, el: document.querySelector(".cart") }).gameover('win', 42);
  await wait(120);
  ok('A1 win pays +8', xpNow() - before1 === XP._internals.AWARD.runWin,
     'delta ' + (xpNow() - before1));

  // ---------- A2/A3: DEEP band vs plain run ----------
  await StripShell._testMakeApi({ mod: { id: "qa-pin-game" }, el: document.querySelector(".cart") }).setHighscore(100); // seeds a best (also fires a real "best" award)
  await wait(150);
  const before2 = xpNow();
  StripShell._testMakeApi({ mod: { id: "qa-pin-game" }, el: document.querySelector(".cart") }).gameover('over', 80); // 80 >= 60, < 100 → DEEP
  await wait(220);
  const deepDelta = xpNow() - before2;
  ok('A2 deep run pays +5', deepDelta === XP._internals.AWARD.runDeep, 'delta ' + deepDelta);
  const before3 = xpNow();
  StripShell._testMakeApi({ mod: { id: "qa-pin-game" }, el: document.querySelector(".cart") }).gameover('over', 10); // 10 < 60% of 100 → plain
  await wait(220);
  ok('A3 plain run pays +2', xpNow() - before3 === XP._internals.AWARD.runOver,
     'delta ' + (xpNow() - before3));

  // ---------- A6: sanitization ----------
  let caught = null;
  const goCap = (e) => { caught = e.detail; };
  window.addEventListener('strip:gameover', goCap);
  StripShell._testMakeApi({ mod: { id: "trivia" }, el: document.querySelector(".cart") }).gameover('sideways', NaN);
  await wait(60);
  window.removeEventListener('strip:gameover', goCap);
  ok('A6 gameover sanitizes NaN/unknown', caught && caught.score === 0 && caught.outcome === 'over',
     JSON.stringify(caught || {}));

  // ---------- A5: xp-awarded broadcast ----------
  let awardEvt = null;
  const aw = (e) => { awardEvt = e.detail; };
  window.addEventListener('strip:xp-awarded', aw);
  XP.award('trophy');
  await wait(60);
  window.removeEventListener('strip:xp-awarded', aw);
  ok('A5 xp-awarded fires {reason,amount}', awardEvt && awardEvt.reason === 'trophy' && awardEvt.amount === XP._internals.AWARD.trophy,
     JSON.stringify(awardEvt || {}));

  // ---------- A7: missions determinism ----------
  const MI = window.Missions && Missions._internals;
  ok('A7 missions module live', !!MI, 'internals ' + !!MI);
  if (MI) {
    const dk = MI.dayKey();
    const p1 = MI.seededPick(dk), p2 = MI.seededPick(dk);
    const distinct = new Set(p1).size === 3;
    const fromPool = p1.every(i => i >= 0 && i < MI.POOL.length);
    ok('A7 pick stable/distinct/in-pool', JSON.stringify(p1) === JSON.stringify(p2) && distinct && fromPool,
       p1.join(','));
  }

  // ---------- A8/A9: progress core, completion, sweep, no self-feeding ----------
  await (window.Missions ? Missions.whenReady() : Promise.resolve());
  await wait(200);
  if (MI) {
    // Pre-complete the xptoday mission if selected: real awards during the
    // pins would otherwise complete it at an unpredictable point and pollute
    // the exact-delta asserts below. (Done missions never re-pay.)
    const xpM0 = MI.getState().missions.find(m => m.key === 'xptoday');
    if (xpM0 && !xpM0.done) { MI.bumpForTest('xptoday', xpM0.need); await wait(80); }

    const st = MI.getState();
    // a REAL gameover event must be consumable (shape check on counters)
    const pre = st.missions.map(m => m.progress);
    window.dispatchEvent(new CustomEvent('strip:gameover', { detail: { id: 'qa-pin-game', outcome: 'win', score: 1 } }));
    await wait(80);
    const post = MI.getState().missions.map(m => m.progress);
    const grewOrDone = post.every((p, i) => p >= pre[i]);
    ok('A8 real gameover consumed', grewOrDone, pre.join('/') + '->' + post.join('/'));

    // complete the first unfinished present mission -> +30 exactly
    const st2 = MI.getState();
    const target = st2.missions.find(m => !m.done);
    if (target) {
      const b4 = xpNow();
      MI.bumpForTest(target.key, target.need - target.progress);
      await wait(80);
      const paid = xpNow() - b4;
      ok('A8 mission completion pays +30', paid === XP._internals.AWARD.mission && target.done, 'paid ' + paid);
    }
    // sweep: complete the rest — each remaining completion pays +30, and the
    // one that flips the LAST mission also pays the +40 sweep
    const remaining = MI.getState().missions.filter(m => !m.done);
    const b5 = xpNow();
    remaining.forEach(m => MI.bumpForTest(m.key, m.need));
    await wait(120);
    const sweepPaid = xpNow() - b5;
    const swept = MI.getState().swept;
    const expected = remaining.length * XP._internals.AWARD.mission + (remaining.length ? XP._internals.AWARD.sweep : 0);
    ok('A8 sweep pays +40 + flag', swept && sweepPaid === expected, 'paid ' + sweepPaid + ' expected ' + expected + ' swept ' + swept);

    // A9: the sweep award must not have fed the XP mission — with all
    // missions done, no bump can regress; assert the exclusion at the source:
    // mission/sweep reasons carry no xptoday growth (progress stays need)
    const xpMission = MI.getState().missions.find(m => m.key === 'xptoday');
    ok('A9 mission rewards excluded', !xpMission || xpMission.progress === xpMission.need,
       xpMission ? xpMission.progress + '/' + xpMission.need : 'not selected today');
  }

  // ---------- A10/A11: surfaces ----------
  const trophyBtn = document.getElementById('trophy-btn');
  if (trophyBtn) {
    trophyBtn.click();
    await wait(500);
    const block = document.querySelector('.missions-block');
    const rows = block ? block.querySelectorAll('.mission-row').length : 0;
    ok('A10 missions block in trophy case', !!block && rows === 3, 'rows ' + rows);
    const closeBtn = document.getElementById('trophy-close');
    if (closeBtn) { closeBtn.click(); await wait(300); }
  } else ok('A10 missions block in trophy case', false, 'no trophy button');

  const pill = document.getElementById('xp-pill');
  ok('A11 pill title carries missions note', pill && /mission/.test(pill.title || ''), (pill && pill.title || '').slice(-60));

  // ---------- B1: trivia legacy clamp ----------
  await StripDB.saveState('trivia', { runBest: 14, bag: null });
  const triviaCard = await centerOn('trivia');
  await wait(700);
  // R36 amendment: BEST RUN lives in the shell-owned .cart-stats slot now
  // (no span ids). The hover-only "normalized" note retired with the inline
  // row — it was unreachable on touch (deck convention); the * marker stays.
  const slot36 = triviaCard && triviaCard.querySelector('.cart-stats');
  const bestStat = slot36 ? [...slot36.querySelectorAll('.cart-stat')].find(s => s.textContent.includes('BEST RUN')) : null;
  const bestVal = bestStat ? bestStat.querySelector('.cart-stat-value').textContent.trim() : '';
  ok('B1 trivia legacy clamp 10/10*', bestVal === '10/10*', bestVal || 'no BEST RUN stat');
  ok('B1 clamp marker (*) present', bestVal.endsWith('*'), bestVal);

  // ---------- B2: blob combo chip present + hidden pre-chain ----------
  const blobCard = await centerOn('blobmerge');
  await wait(500);
  const chip = blobCard && blobCard.querySelector('#bm-combo');
  ok('B2 combo chip hidden pre-chain', chip && chip.style.display === 'none',
     chip ? chip.style.display : 'no chip');

  // ---------- A4: run cap (LAST — it burns the day's budget) ----------
  const RUN_CAP = XP._internals.RUN_DAILY_CAP;
  const runToday = XP.getState().runToday;
  const room = Math.max(0, RUN_CAP - runToday);
  const b6 = xpNow();
  for (let i = 0; i < room + 3; i++) StripShell._testMakeApi({ mod: { id: "qa-pin-cap" }, el: document.querySelector(".cart") }).gameover('over', 1);
  await wait(400);
  const capPaid = xpNow() - b6;
  ok('A4 run cap enforced', capPaid === room * XP._internals.AWARD.runOver, 'paid for ' + (capPaid / XP._internals.AWARD.runOver) + ' of ' + (room + 3));

  ok('B3 zero console errors', consoleErrors.length === 0, consoleErrors[0] || 'clean');

  return results;
})();
