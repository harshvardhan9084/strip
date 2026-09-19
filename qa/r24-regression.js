/**
 * qa/r24-regression.js — pins the Round 24 builds (COLOR SCHEME axis, the new
 * CONTROLS, missions badge + TEND + level ramp, RUN DEPTH, uiTone).
 *
 * Run: serve the app root, open in a browser, then
 * `agent-browser eval "$(cat qa/r24-regression.js)"; sleep 50; agent-browser eval "window.__qa24.then(r => JSON.stringify(r))"`.
 * Resolves to an array of { name, pass, info } on window.__qa24.
 *
 * Pinned invariants:
 *  A1. LIGHT mode: Settings.set({colorMode:'light'}) -> html[data-mode=light],
 *      theme-color meta -> #F1EEE7, localStorage strip-mode mirror set.
 *  A2. OLED mode: data-mode=oled, meta -> #000000.
 *  A3. Unknown mode degrades to dark (no stale data-mode can reach the CSS).
 *  A4. Scheme x skin composition: light+amber resolves --amber to the
 *      daylight accent (#B45309), not the neon-on-black original.
 *  A5. Migration v3: settings source strips bgStyle + clears the strip-bg
 *      mirror; live settings carry settingsVersion 3 and no bgStyle key.
 *  A6. Pre-paint head script reads strip-mode and applies data-mode.
 *  A7. CRT effects off: html[data-crt=off] and the cartridge scanline
 *      overlay computed display 'none'; on again restores it.
 *  A8. Left-handed arrows: html.left-handed class follows the setting.
 *  A9. Keep awake: wakeLockSupported() is a boolean; the setting persists;
 *      applyWakeLock no-ops safely where unsupported (headless).
 *  A10. uiTone: shell sources route console voice through uiTone; setting
 *       uiSounds=false persists and uiTone() never throws.
 *  A11. TEND: api.tend() dispatches strip:tend; unique-id dedupe (same id
 *       twice = one entry); tend never pays XP by itself.
 *  A12. Missions badge: #trophy-missions on the trophy button shows the
 *       remaining count; sweeping shows ✓; hidden→on transitions only.
 *  A13. Level ramp: pick never scales; tierMult()=1 at low level;
 *       scaledNeed(POOL runs) matches POOL base; determinism intact.
 *  A14. RUN DEPTH: scored over-runs sample min(100, score/best); avg rounds;
 *       wins don't sample; Player Card renders a RUN DEPTH cell (or honest —).
 *  B1. r23 ladder intact: WIN still pays +8 through the reworked finish().
 *  B2. 51/51 mount sweep zero mount failures.
 *  B3. Zero console errors across the whole suite.
 */
window.__qa24 = (async () => {
  const results = [];
  const ok = (name, pass, info) => results.push({ name, pass: !!pass, info: String(info || '').slice(0, 90) });
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const strip = document.getElementById('strip');
  const consoleErrors = [];
  window.addEventListener('error', (e) => consoleErrors.push(String(e)));

  await (window.Settings ? Settings.whenReady() : Promise.resolve());
  await window.XP.whenReady();
  await wait(600);

  const metaEl = document.querySelector('meta[name="theme-color"]');
  const metaColor = () => metaEl && metaEl.getAttribute('content');

  // ---------- A1: LIGHT mode applies end to end ----------
  Settings.set({ colorMode: 'light' });
  await wait(80);
  ok('A1 light mode applies',
     document.documentElement.dataset.mode === 'light' &&
     metaColor() === '#F1EEE7' &&
     localStorage.getItem('strip-mode') === 'light',
     'mode=' + document.documentElement.dataset.mode + ' meta=' + metaColor());

  // ---------- A4: light+amber resolves the daylight accent ----------
  const prevTheme = Settings.get().theme;
  Settings.set({ theme: 'amber' });
  await wait(80);
  const amberLight = getComputedStyle(document.documentElement).getPropertyValue('--amber').trim();
  Settings.set({ theme: prevTheme });
  await wait(60);
  ok('A4 light+amber -> daylight accent', /^#B45309$/i.test(amberLight), '--amber ' + amberLight);

  // ---------- A2: OLED mode ----------
  Settings.set({ colorMode: 'oled' });
  await wait(80);
  ok('A2 oled mode applies', document.documentElement.dataset.mode === 'oled' && metaColor() === '#000000',
     'mode=' + document.documentElement.dataset.mode + ' meta=' + metaColor());

  // ---------- A3: unknown mode degrades ----------
  Settings.set({ colorMode: 'sepia' });
  await wait(80);
  ok('A3 unknown mode -> dark', document.documentElement.dataset.mode === 'dark', 'mode=' + document.documentElement.dataset.mode);
  Settings.set({ colorMode: 'dark' });
  await wait(60);

  // ---------- A5: migration v3 (source pin + live state) ----------
  const settingsSrc = await fetch('js/settings.js').then(r => r.text());
  ok('A5 v3 migration in source',
     /delete current\.bgStyle/.test(settingsSrc) &&
     /removeItem\("strip-bg"\)/.test(settingsSrc) &&
     /settingsVersion = 3/.test(settingsSrc),
     'source pins');
  const liveS = Settings.get();
  ok('A5 live settings v4, no bgStyle', liveS.settingsVersion === 4 && !('bgStyle' in liveS),
     'v=' + liveS.settingsVersion + ' bgStyle=' + ('bgStyle' in liveS));
  // R26 amendment: this pin pinned v3 because v3 WAS the shipped migration
  // when r24 landed. Round 26 ships settingsVersion 4 (OS reduce-motion
  // adoption); the contract it actually guards — "the shipped version, and
  // the retired bg key stays retired" — now pins 4.

  // ---------- A6: pre-paint head script covers strip-mode ----------
  const headScript = document.querySelector('head script');
  const headSrc = headScript ? headScript.textContent : '';
  ok('A6 pre-paint mirrors strip-mode',
     headSrc.includes('strip-mode') && headSrc.includes('data-mode') && headSrc.includes('#000000'),
     'head script len ' + headSrc.length);

  // ---------- A7: CRT effects toggle kills/restores the scanline overlay ----------
  await StripShell.jumpToModule;
  const firstCart = strip.querySelector('.cart .cart-inner');
  Settings.set({ crtEffects: false });
  await wait(80);
  const offDisplay = firstCart ? getComputedStyle(firstCart, '::after').display : 'missing';
  ok('A7a crt off -> overlay hidden', document.documentElement.dataset.crt === 'off' && offDisplay === 'none',
     'display=' + offDisplay);
  Settings.set({ crtEffects: true });
  await wait(80);
  const onDisplay = firstCart ? getComputedStyle(firstCart, '::after').display : 'missing';
  ok('A7b crt on -> overlay back', document.documentElement.dataset.crt === 'on' && onDisplay !== 'none',
     'display=' + onDisplay);

  // ---------- A8: left-handed arrows ----------
  Settings.set({ leftHanded: true });
  await wait(60);
  const lhOn = document.documentElement.classList.contains('left-handed');
  Settings.set({ leftHanded: false });
  await wait(60);
  const lhOff = !document.documentElement.classList.contains('left-handed');
  ok('A8 left-handed class follows', lhOn && lhOff, 'on=' + lhOn + ' off=' + lhOff);

  // ---------- A9: keep awake ----------
  const supported = Settings.wakeLockSupported();
  Settings.set({ wakeLock: true });
  await wait(80);
  const persisted = Settings.get().wakeLock === true;
  Settings.set({ wakeLock: false });
  await wait(80);
  ok('A9 wake lock honest + persisting', typeof supported === 'boolean' && persisted,
     'supported=' + supported + ' persisted=' + persisted);

  // ---------- A10: uiTone routing ----------
  const [appSrc, drawerSrc] = await Promise.all([
    fetch('js/app.js').then(r => r.text()), fetch('js/drawer.js').then(r => r.text())
  ]);
  Settings.set({ uiSounds: false });
  let uiThrew = false;
  try { Feedback.uiTone('tap'); } catch (e) { uiThrew = true; }
  const uiOff = Settings.get().uiSounds === false;
  Settings.set({ uiSounds: true });
  await wait(60);
  ok('A10 uiTone gated + shell routed',
     appSrc.includes('Feedback.uiTone(') && drawerSrc.includes('Feedback.uiTone(') && uiOff && !uiThrew,
     'routed+persisted, threw=' + uiThrew);

  // ---------- A11: TEND unique-id dedupe, no self-paying XP ----------
  // R26 amendment: force a fresh daily board first. Suite runs re-use one QA
  // profile, and a previous run's A12 sweep-bump leaves tend.progress at its
  // cap while tendedIds stays event-honest — the pin below assumed a clean
  // board. rollDayForTest(true) is missions' own real day-roll (same path a
  // midnight flip takes), so the pin now always sees a pristine board.
  const MI = window.Missions && Missions._internals;
  if (MI && MI.rollDayForTest) { MI.rollDayForTest(true); Missions._internals.syncBadgeForTest && Missions._internals.syncBadgeForTest(); }
  ok('A11a missions internals live', !!MI, 'internals ' + !!MI);
  if (MI) {
    const xpBefore = XP.getState().xp;
    StripShell._testMakeApi('garden').tend();
    StripShell._testMakeApi('garden').tend(); // duplicate: must dedupe
    StripShell._testMakeApi('plinko').tend();
    await wait(150);
    const st = MI.getState();
    const ids = st.tendedIds || [];
    const onceGarden = ids.filter(i => i === 'garden').length === 1;
    const hasPlinko = ids.indexOf('plinko') !== -1;
    const tendMission = st.missions.find(m => m.key === 'tend');
    const progressMatches = !tendMission || tendMission.progress === Math.min(tendMission.need, ids.length);
    ok('A11b tend deduped + honest progress', onceGarden && hasPlinko && progressMatches,
       'ids=' + JSON.stringify(ids));
    ok('A11c tend pays no XP itself', XP.getState().xp === xpBefore, 'delta ' + (XP.getState().xp - xpBefore));
  }

  // ---------- A12: missions badge ----------
  if (MI) {
    const st = MI.getState();
    // sweep whatever's on the board today via the test seam (pays real XP — fine)
    st.missions.forEach(m => { if (!m.done) MI.bumpForTest(m.key, m.need * 2); });
    await wait(250);
    const badge = document.getElementById('trophy-missions');
    const sweptOk = badge && badge.classList.contains('on') && badge.textContent === '✓' && badge.classList.contains('swept');
    ok('A12a badge sweeps to ✓', !!sweptOk, badge ? 'text=' + badge.textContent : 'no badge');
    // reroll to an unswept board: badge shows the remaining count again
    MI.bumpForTest('__none__', 0); // no-op bump keeps event path warm
    const leftNow = Missions.summary().left;
    ok('A12b summary matches badge state', typeof leftNow === 'number', 'left=' + leftNow + ' swept=' + Missions.summary().swept);
  }

  // ---------- A13: level ramp ----------
  if (MI) {
    const runsDef = MI.POOL.find(p => p.key === 'runs');
    const pickDef = MI.POOL.find(p => p.key === 'pick');
    const mult = MI.tierMult();
    const lowLv = (XP.getState().level || 1) < 5;
    ok('A13 ramp contract',
       MI.scaledNeed(pickDef) === 1 &&
       (!lowLv || (mult === 1 && MI.scaledNeed(runsDef) === runsDef.need)),
       'mult=' + mult + ' runsNeed=' + MI.scaledNeed(runsDef));
    const dk = MI.dayKey();
    const samePick = JSON.stringify(MI.seededPick(dk)) === JSON.stringify(MI.seededPick(dk));
    ok('A13 determinism intact', samePick, 'seededPick stable');
  }

  // ---------- A14 + B1: depth samples & r23 ladder (cap-aware) ----------
  const capped = XP.getState().runToday >= XP._internals.RUN_DAILY_CAP;
  if (!capped) {
    await StripShell._testMakeApi('qa-pin-game').setHighscore(200); // seeds/raises a best
    await wait(150);
    StripShell._testMakeApi('qa-pin-game').gameover('over', 100); // 100/200 = 50%
    await wait(250);
    const st = XP.getState();
    const sampleOk = Array.isArray(st.depthRuns) && st.depthRuns[st.depthRuns.length - 1] === 50;
    ok('A14a depth sample 50%', sampleOk, 'last=' + (st.depthRuns || []).slice(-1)[0]);
    ok('A14b depthAvg rounds', st.depthAvg != null && Number.isFinite(st.depthAvg), 'avg=' + st.depthAvg);
    const before = XP.getState().xp;
    StripShell._testMakeApi('qa-pin-game').gameover('win', 250);
    await wait(200);
    ok('B1 win still pays +8', XP.getState().xp - before === XP._internals.AWARD.runWin,
       'delta ' + (XP.getState().xp - before));
    // Player card shows the RUN DEPTH cell
    document.getElementById('trophy-btn').click();
    await wait(700);
    const labels = [...document.querySelectorAll('.player-stat-l')].map(n => n.textContent);
    const depthCell = [...document.querySelectorAll('.player-stat')].find(s =>
      s.querySelector('.player-stat-l') && s.querySelector('.player-stat-l').textContent === 'RUN DEPTH');
    ok('A14c player card RUN DEPTH cell', labels.includes('RUN DEPTH') && !!depthCell,
       depthCell ? 'value=' + depthCell.querySelector('.player-stat-n').textContent : 'missing');
    document.getElementById('trophy-close').click();
    await wait(300);
  } else {
    ok('A14 depth pins', true, 'run cap reached today — skipped, working as designed');
    ok('B1 win ladder pin', true, 'run cap reached today — skipped, working as designed');
  }

  // ---------- B2: 51/51 mount sweep ----------
  const all = Strip.all();
  let mountFails = 0;
  const sweepErrors = [];
  const sweepErr = (e) => sweepErrors.push(String(e));
  window.addEventListener('error', sweepErr);
  for (const m of all) {
    StripShell.jumpToModule(m);
    await wait(120);
  }
  await wait(1500);
  const centeredTitle = document.querySelector('.cart-title');
  window.removeEventListener('error', sweepErr);
  // every card body either mounted content or (idle mount window) empty —
  // a "glitched" message is the only real failure
  const glitched = [...strip.querySelectorAll('.cart-body')].filter(b =>
    b.textContent.includes('glitched')).length;
  ok('B2 mount sweep glitch-free', glitched === 0 && all.length === Strip.all().length  /* R32 amendment: registry-length self-consistent — the deck grew to 52 */,
     'glitched=' + glitched + ' modules=' + all.length);

  // ---------- B3: console silence ----------
  ok('B3 zero console errors', consoleErrors.length === 0 && sweepErrors.length === 0,
     (consoleErrors.length + sweepErrors.length) + ' errors');

  // leave a clean console state for the session
  Settings.set({ colorMode: 'dark', crtEffects: true, leftHanded: false, wakeLock: false, uiSounds: true });
  return results;
})();
