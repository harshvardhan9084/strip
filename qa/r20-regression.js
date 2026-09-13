/**
 * qa/r20-regression.js — pins the Round 20 "Console Feel" shell upgrades.
 *
 * Run: serve the app root, open in a browser, then
 * `agent-browser eval "$(cat qa/r20-regression.js)"; sleep N; agent-browser eval "window.__qa20.then(r => JSON.stringify(r))"`.
 * Resolves to an array of { name, pass, info } on window.__qa20.
 *
 * Pinned invariants (XP engine → controls → data ownership → surfaces):
 *  1. xp.js level curve: 49 XP stays LV 1, 50 crosses to LV 2; daily XP
 *     caps at 65 for streak 11+ (the anti-farm ceiling).
 *  2. Settle award: a NEW centered id pays exactly +1 XP; the SAME id
 *     re-settling pays nothing (consecutive dedupe).
 *  3. New-best award (the production makeApi hook): a bigger score pays
 *     +25, a smaller one pays 0 — replaying can't farm XP.
 *  4. HUD pill renders the same level the pure curve says.
 *  5. Volume setting flows into Feedback's master gain; haptic strength
 *     flows into Feedback (and restores cleanly).
 *  6. Export shape: app:"strip" envelope, state+scores objects, and the
 *     device-settings record is NEVER exported.
 *  7. Import validation: real envelope accepted, junk/degraded shapes
 *     rejected.
 *  8. Nav arrows exist, are visible by default, and a #nav-next hop
 *     actually moves the centered card.
 *  9. Trophy case: Player Card renders (ring + 4 stats); CLOSEST TO UNLOCK
 *     block renders with ≥1 bar whenever any metric trophy is still locked.
 * 10. Drawer chips: ≥4 chips (ALL + ★ + categories), a category chip
 *     narrows the grid, ALL restores it.
 */
window.__qa20 = (async () => {
  const results = [];
  const ok = (name, pass, info) => results.push({ name, pass: !!pass, info: String(info || '').slice(0, 90) });
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  const strip = document.getElementById('strip');
  const cards = () => [...strip.querySelectorAll('.cart')];

  await (window.XP ? XP.whenReady() : Promise.resolve());
  await wait(400);

  // ---- 1. pure curve + daily cap ----
  try {
    const I = XP._internals;
    const at49 = I.levelFor(49), at50 = I.levelFor(50);
    ok('curve: 49 stays L1', at49.level === 1, JSON.stringify(at49));
    ok('curve: 50 crosses L2', at50.level === 2, JSON.stringify(at50));
    const cap = I.computeDailyXp(30), mid = I.computeDailyXp(5);
    ok('daily xp cap 65 @ streak30', cap === 65, 'streak30=' + cap);
    ok('daily xp streak5=35', mid === 35, 'streak5=' + mid);
  } catch (e) { ok('curve pins', false, e.message); }

  // ---- 2. settle award + consecutive dedupe ----
  try {
    const before = XP.getState().xp;
    window.dispatchEvent(new CustomEvent('strip:card-centered', { detail: { id: '__qa_settle_probe__' } }));
    await wait(120);
    const afterNew = XP.getState().xp;
    ok('settle pays +1', afterNew === before + 1, before + '->' + afterNew);
    window.dispatchEvent(new CustomEvent('strip:card-centered', { detail: { id: '__qa_settle_probe__' } }));
    await wait(120);
    ok('settle dedupes same id', XP.getState().xp === afterNew, 'still ' + XP.getState().xp);
  } catch (e) { ok('settle pins', false, e.message); }

  // ---- 3. new-best hook through the REAL api factory ----
  try {
    await StripDB.clearHighscore('__qa_best_probe__');
    const api = StripShell._testMakeApi('__qa_best_probe__');
    const before = XP.getState().xp;
    await api.setHighscore(42);
    const afterFirst = XP.getState().xp;
    ok('new best pays +25', afterFirst === before + 25, before + '->' + afterFirst);
    await api.setHighscore(10);
    ok('worse score pays 0', XP.getState().xp === afterFirst, 'still ' + XP.getState().xp);
    await api.setHighscore(50);
    ok('newer best pays +25 again', XP.getState().xp === afterFirst + 25, 'now ' + XP.getState().xp);
    await StripDB.clearHighscore('__qa_best_probe__');
  } catch (e) { ok('best-hook pins', false, e.message); }

  // ---- 4. HUD pill agrees with the curve ----
  try {
    const pill = document.getElementById('xp-pill');
    const shown = document.getElementById('xp-level').textContent;
    const expect = 'LV ' + XP.getState().level;
    ok('HUD pill matches curve', !!pill && shown === expect, shown + ' vs ' + expect);
    const fillW = parseFloat(document.getElementById('xp-fill').style.width);
    ok('HUD fill in 0..100', fillW >= 0 && fillW <= 100, 'width=' + fillW + '%');
  } catch (e) { ok('HUD pill pins', false, e.message); }

  // ---- 5. volume + haptic strength flow ----
  try {
    Settings.set({ volume: 0.45 });
    await wait(80);
    ok('volume 0.45 reaches Feedback', Math.abs(Feedback.getVolume() - 0.45) < 0.001, 'v=' + Feedback.getVolume());
    Settings.set({ hapticStrength: 'strong' });
    await wait(80);
    ok('haptic strong reaches Feedback', Feedback.getHapticStrength() === 'strong', Feedback.getHapticStrength());
    // restore
    Settings.set({ volume: 0.8, hapticStrength: 'normal' });
    await wait(80);
    ok('controls restore', Math.abs(Feedback.getVolume() - 0.8) < 0.001 && Feedback.getHapticStrength() === 'normal', 'v=' + Feedback.getVolume());
  } catch (e) { ok('control prefs', false, e.message); }

  // ---- 6. export shape ----
  try {
    const ex = await StripDB.exportAll();
    ok('export envelope', ex.app === 'strip' && ex.v === 1 && !!ex.state && !!ex.scores,
       JSON.stringify(ex.counts));
    ok('export excludes settings', !('__app_settings__' in ex.state), 'settings leak!');
  } catch (e) { ok('export', false, e.message); }

  // ---- 7. import validation ----
  try {
    ok('valid envelope accepted', StripDB.validImport({ app: 'strip', state: {}, scores: {} }), '');
    ok('junk rejected', !StripDB.validImport({ hello: 1 }), '');
    ok('half envelope rejected', !StripDB.validImport({ app: 'strip', state: {} }), 'scores missing');
    ok('null rejected', !StripDB.validImport(null), '');
  } catch (e) { ok('import validation', false, e.message); }

  // ---- 8. nav arrows hop ----
  try {
    const nav = document.getElementById('nav-arrows');
    ok('nav arrows exist + on', !!nav && nav.classList.contains('on'), 'class=' + (nav && nav.className));
    const idxBefore = document.getElementById('hud-index').textContent;
    document.getElementById('nav-next').click();
    await wait(900); // smooth scroll + settle debounce (220ms)
    const idxAfter = document.getElementById('hud-index').textContent;
    ok('nav hop moves card', idxBefore !== idxAfter, idxBefore + '->' + idxAfter);
  } catch (e) { ok('nav arrows', false, e.message); }

  // ---- 9. trophy case: player card + closest-to-unlock ----
  try {
    document.getElementById('trophy-btn').click();
    await wait(500);
    const pc = document.querySelector('.player-card');
    ok('player card renders', !!pc, pc ? '' : 'missing');
    ok('player ring shows LV', !!pc && /LV \d+/.test(pc.querySelector('.player-ring-level').textContent),
       pc && pc.querySelector('.player-ring-level').textContent);
    ok('player stats x4', !!pc && pc.querySelectorAll('.player-stat').length === 4,
       pc ? pc.querySelectorAll('.player-stat').length + ' stats' : '');
    const cb = document.querySelector('.closest-block');
    const anyLockedMetric = !!document.querySelector('.trophy-item:not(.unlocked)');
    if (cb) {
      ok('closest bars >=1', cb.querySelectorAll('.closest-item').length >= 1,
         cb.querySelectorAll('.closest-item').length + ' bars');
    } else {
      ok('closest block logic', !anyLockedMetric, 'no block + no locked metric trophies = honest');
    }
    document.getElementById('trophy-close').click();
  } catch (e) { ok('trophy case', false, e.message); }

  // ---- 10. drawer chips ----
  try {
    document.getElementById('drawer-btn').click();
    await wait(500);
    const chips = [...document.querySelectorAll('.drawer-chip')];
    ok('chips rendered', chips.length >= 4, chips.length + ' chips');
    const grid = document.getElementById('drawer-grid');
    const allCount = grid.querySelectorAll('.drawer-item').length;
    const catChip = chips.find(c => c.textContent !== 'ALL' && c.textContent !== '★');
    catChip.click();
    await wait(200);
    const catCount = grid.querySelectorAll('.drawer-item').length;
    ok('category chip narrows', catCount > 0 && catCount < allCount, allCount + '->' + catCount);
    chips.find(c => c.textContent === 'ALL').click();
    await wait(200);
    ok('ALL restores', grid.querySelectorAll('.drawer-item').length === allCount,
       grid.querySelectorAll('.drawer-item').length);
    document.getElementById('drawer-close').click();
  } catch (e) { ok('drawer chips', false, e.message); }

  // ---- settings sheet smoke: new controls present ----
  try {
    document.getElementById('settings-btn').click();
    await wait(400);
    ok('volume slider present', !!document.getElementById('volume-slider'), '');
    ok('3 strength buttons', document.querySelectorAll('.seg-btn').length === 3, '');
    ok('fullscreen btn present', !!document.getElementById('fullscreen-btn'), '');
    ok('export/import present', !!document.getElementById('export-save-btn') && !!document.getElementById('import-save-btn'), '');
    ok('replay hint present', !!document.getElementById('replay-hint-btn'), '');
    document.getElementById('settings-close').click();
  } catch (e) { ok('settings sheet', false, e.message); }

  return results;
})();
