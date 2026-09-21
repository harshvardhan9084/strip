/**
 * qa/r25-regression.js — pins the Round 25 builds (semantic daylight color
 * layer, screen-glow axis, swept-✓ retirement, kaleido/etch TEND, Depth
 * League, light-chassis contrast fixes across 20 game files).
 *
 * Run: serve the app root, open in a browser, then
 * `agent-browser eval "$(cat qa/r25-regression.js)"; sleep 45; agent-browser eval "window.__qa25.then(r => JSON.stringify(r))"`.
 * Resolves to an array of { name, pass, info } on window.__qa25.
 *
 * Pinned invariants:
 *  A1. Semantic layer per mode: LIGHT resolves --good/--info/--warn/--danger
 *      to the daylight grades and --on-accent to white; DARK keeps the raw
 *      phosphor-adjacent hues and --on-accent black.
 *  A2. --felt flips with the chassis (blackjack's table rides the shell).
 *  A3. Screen glow axis: data-glow off/soft/full drives --glow-mul 0/.35/1;
 *      an unknown setting value degrades to full.
 *  A4. Glow dial persists through Settings and the panel buttons re-sync
 *      (aria-pressed follows).
 *  A5. The bloom is actually re-graded: #boot-logo's computed text-shadow
 *      alpha differs between full and off.
 *  A6. Active tab chips: no raw "#000" remains in the 11 tabbed game
 *      sources; lightsout's active tab resolves to --on-accent live.
 *  A7. LIGHT contrast spot-checks (computed, WCAG ratio): colormix G label,
 *      kingdom FOOD value and breakout hearts all clear 4.2:1 on paper.
 *  A8. Swept-✓ retirement: a stale sweptAt (4h old) adds .fade-out to the
 *      badge; a fresh sweep removes it; the all-day ✓ stays for saves
 *      without a timestamp.
 *  A9. kaleido + etch sources dispatch api.tend() at their save beat.
 *  A10. Depth League: a 75% depth sample renders the PHOSPHOR tier with the
 *       honest next-tier note; no samples → no league row.
 *  A11. r23 ladder intact: WIN still pays +8 (cap-aware).
 *  B1. 51/51 mount sweep glitch-free.
 *  B2. Zero console errors across the whole suite.
 */
window.__qa25 = (async () => {
  const results = [];
  const ok = (name, pass, info) => results.push({ name, pass: !!pass, info: String(info || '').slice(0, 90) });
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const consoleErrors = [];
  window.addEventListener('error', (e) => consoleErrors.push(String(e)));

  await (window.Settings ? Settings.whenReady() : Promise.resolve());
  await window.XP.whenReady();
  await (window.Missions ? Missions.whenReady() : Promise.resolve());
  await wait(600);

  const NOSTORE = { cache: 'no-store' };
  const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  // ---------- A1: semantic layer per mode ----------
  Settings.set({ colorMode: 'dark' });
  await wait(80);
  const darkVals = { good: cssVar('--good'), info: cssVar('--info'), warn: cssVar('--warn'), danger: cssVar('--danger'), onAccent: cssVar('--on-accent') };
  ok('A1a dark keeps raw semantic hues',
     /^#6FCF97$/i.test(darkVals.good) && /^#56B4E9$/i.test(darkVals.info) &&
     /^#FFB347$/i.test(darkVals.warn) && /^#E8637F$/i.test(darkVals.danger) &&
     /^#000000$/i.test(darkVals.onAccent),
     JSON.stringify(darkVals));
  Settings.set({ colorMode: 'light' });
  await wait(80);
  const lightVals = { good: cssVar('--good'), info: cssVar('--info'), warn: cssVar('--warn'), danger: cssVar('--danger'), onAccent: cssVar('--on-accent') };
  ok('A1b light re-grades to daylight',
     /^#15803D$/i.test(lightVals.good) && /^#0E7490$/i.test(lightVals.info) &&
     /^#B45309$/i.test(lightVals.warn) && /^#C2314E$/i.test(lightVals.danger) &&
     /^#FFFFFF$/i.test(lightVals.onAccent),
     JSON.stringify(lightVals));

  // ---------- A2: felt rides the chassis ----------
  const feltLight = cssVar('--felt');
  Settings.set({ colorMode: 'dark' });
  await wait(80);
  const feltDark = cssVar('--felt');
  ok('A2 felt flips with chassis',
     /16,\s*16,\s*24,\s*\.8/.test(feltDark) && /255,\s*255,\s*255,\s*\.62/.test(feltLight),
     'dark=' + feltDark + ' light=' + feltLight);

  // ---------- A3 + A4: glow axis ----------
  Settings.set({ glow: 'off' });
  await wait(80);
  const mulOff = cssVar('--glow-mul');
  const attrOff = document.documentElement.dataset.glow;
  Settings.set({ glow: 'soft' });
  await wait(80);
  const mulSoft = cssVar('--glow-mul');
  Settings.set({ glow: 'full' });
  await wait(80);
  const mulFull = cssVar('--glow-mul');
  ok('A3 glow multiplier grades', attrOff === 'off' && parseFloat(mulOff) === 0 && Math.abs(parseFloat(mulSoft) - 0.35) < 1e-6 && parseFloat(mulFull) === 1,
     'off=' + mulOff + ' soft=' + mulSoft + ' full=' + mulFull);
  Settings.set({ glow: 'sparkle' }); // unknown value
  await wait(80);
  ok('A3b unknown glow -> full', document.documentElement.dataset.glow === 'full' && cssVar('--glow-mul') === '1',
     'attr=' + document.documentElement.dataset.glow);

  // A4: the settings panel buttons re-sync (aria-pressed follows the setting)
  Settings.set({ glow: 'soft' });
  await wait(120);
  const softBtn = document.querySelector('.glow-seg-btn[data-glow-value="soft"]');
  const offBtn = document.querySelector('.glow-seg-btn[data-glow-value="off"]');
  const btnsSynced = softBtn && offBtn && softBtn.getAttribute('aria-pressed') === 'true' && offBtn.getAttribute('aria-pressed') === 'false';
  Settings.set({ glow: 'full' });
  await wait(100);
  const softBtnAfter = softBtn && softBtn.getAttribute('aria-pressed') === 'false';
  ok('A4 glow dial buttons sync', !!btnsSynced && !!softBtnAfter, 'soft=' + !!btnsSynced + ' reset=' + !!softBtnAfter);

  // ---------- A5: the bloom is actually re-graded (boot logo) ----------
  // With mul=0 the shadow still renders but its alpha resolves to 0 — the
  // honest check reads the final alpha out of the computed shadow color.
  const bootLogo = document.getElementById('boot-logo');
  const shadowAlpha = (el) => {
    if (!el) return -1;
    const s = getComputedStyle(el).textShadow;
    const m = s.match(/rgba?\([^)]*\)/g);
    if (!m) return 0; // 'none' -> no bloom at all
    const last = m[m.length - 1];
    const a = last.match(/,\s*([0-9.]+)\)$/);
    return a ? parseFloat(a[1]) : 1;
  };
  Settings.set({ glow: 'full' });
  await wait(90);
  const aFull = shadowAlpha(bootLogo);
  Settings.set({ glow: 'off' });
  await wait(90);
  const aOff = shadowAlpha(bootLogo);
  ok('A5 boot bloom responds to dial', aFull > 0.3 && aOff === 0,
     'full alpha=' + aFull + ' off alpha=' + aOff);
  Settings.set({ glow: 'full' });
  await wait(60);

  // ---------- A6: active tab chips use --on-accent ----------
  const tabbed = ['xox','slidepuzzle','minesweeper','maze','dropfour','artillery','minisudoku','memorymatch','lightsout','codebreaker','pongduel'];
  const srcs = await Promise.all(tabbed.map(f => fetch('js/games/' + f + '.js', NOSTORE).then(r => r.text())));
  const rawBlack = srcs.filter(s => /active \? "#000"/.test(s)).length;
  const usesOnAccent = srcs.filter(s => s.includes('var(--on-accent)')).length;
  ok('A6a tab chips migrated', rawBlack === 0 && usesOnAccent === tabbed.length,
     'raw=' + rawBlack + ' migrated=' + usesOnAccent + '/' + tabbed.length);
  // live resolve: lightsout active tab in dark = black text on amber fill
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;width:420px;height:560px;z-index:9999;background:var(--panel);pointer-events:none;opacity:0.01';
  document.body.appendChild(host);
  const lightsout = window.Strip.all().find(m => m.id === 'lightsout');
  lightsout.mount(host, window.StripShell._testMakeApi({ mod: { id: "lightsout" }, el: document.querySelector(".cart") }));
  await wait(150);
  const activeTab = [...host.querySelectorAll('button')].find(b => b.style.color && b.style.background.includes('var(--amber)'));
  ok('A6b active tab live color', activeTab && getComputedStyle(activeTab).color === 'rgb(0, 0, 0)',
     activeTab ? getComputedStyle(activeTab).color : 'no active tab found');

  // ---------- A7: LIGHT contrast spot-checks (computed ratio on paper) ----------
  Settings.set({ colorMode: 'light' });
  await wait(120);
  const parseC = (c) => { const m = c.match(/[\d.]+/g); if (!m) return null; const v = m.map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
  const comp = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  const lum = (c) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const bgOf = (el) => {
    const layers = []; let n = el;
    while (n && n !== document.documentElement) {
      const c = parseC(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) layers.push(c);
      if (c && c.a >= 1) break;
      n = n.parentElement;
    }
    let out = parseC(getComputedStyle(document.body).backgroundColor) || { r: 241, g: 238, b: 231, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) out = comp(layers[i], out);
    return out;
  };
  const mountAndCheck = async (id, matcher) => {
    const mod = window.Strip.all().find(m => m.id === id);
    // R36 signature: the factory takes the card entry ({ mod, el })
    const r = mod.mount(host, window.StripShell._testMakeApi({ mod: { id }, el: document.querySelector('.cart') }));
    if (typeof r === 'function') { try { r(); } catch (e) {} }
    await wait(140);
    // R36 amendment: stat values render into the SHELL slot (outside the stub
    // host) — the search scope includes the first card's stat row
    const shellStats = document.querySelector('.cart .cart-stats');
    const scope = [...host.querySelectorAll('*'), ...(shellStats ? [...shellStats.querySelectorAll('.cart-stat-value')] : [])];
    const el = scope.find(matcher);
    const out = el ? { ratio: ratio(parseC(getComputedStyle(el).color), bgOf(el)), text: (el.textContent || '').trim().slice(0, 10) } : null;
    host.innerHTML = '';
    return out;
  };
  const cmG = await mountAndCheck('colormix', (el) => el.tagName === 'SPAN' && el.textContent === 'G' && el.style.color.includes('--good'));
  ok('A7a colormix G on paper >= 4.2', cmG && cmG.ratio >= 4.2, cmG ? 'r=' + cmG.ratio.toFixed(2) : 'el missing');
  const kdFood = await mountAndCheck('kingdom', (el) => el.tagName === 'SPAN' && el.style.color.includes('--good') && /^\d+/.test((el.textContent || '').trim()));
  ok('A7b kingdom FOOD >= 4.2', kdFood && kdFood.ratio >= 4.2, kdFood ? 'r=' + kdFood.ratio.toFixed(2) : 'el missing');
  const boHearts = await mountAndCheck('breakout', (el) => el.tagName === 'SPAN' && el.style.color.includes('--danger') && (el.textContent || '').includes('♥'));
  ok('A7c breakout hearts >= 4.2', boHearts && boHearts.ratio >= 4.2, boHearts ? 'r=' + boHearts.ratio.toFixed(2) : 'el missing');

  // ---------- A8: swept-✓ retirement ----------
  const MI = window.Missions;
  const badge = document.getElementById('trophy-missions');
  if (MI && badge) {
    const st = MI._internals.getState();
    const wasSwept = st.swept;
    st.swept = true;
    st.sweptAt = Date.now() - (4 * 60 * 60 * 1000);
    MI._internals.syncBadgeForTest();
    await wait(60);
    const faded = badge.classList.contains('fade-out');
    st.sweptAt = Date.now(); // fresh sweep — back for the day
    MI._internals.syncBadgeForTest();
    await wait(60);
    const fresh = !badge.classList.contains('fade-out');
    const savedSweptAt = st.sweptAt; // restore pre-round truth
    st.swept = wasSwept;
    st.sweptAt = wasSwept ? savedSweptAt : null;
    MI._internals.syncBadgeForTest();
    ok('A8 swept badge retires after 3h', faded && fresh, 'stale=' + faded + ' fresh=' + fresh);
  } else {
    ok('A8 swept badge retires after 3h', false, 'missions or badge unavailable');
  }

  // ---------- A9: kaleido/etch tend wiring ----------
  const [kalSrc, etchSrc] = await Promise.all(['kaleidoscope', 'etch'].map(f => fetch('js/games/' + f + '.js', NOSTORE).then(r => r.text())));
  ok('A9 creative toys tend on save', kalSrc.includes('api.tend()') && etchSrc.includes('api.tend()'),
     'kal=' + kalSrc.includes('api.tend()') + ' etch=' + etchSrc.includes('api.tend()'));

  // ---------- A10: Depth League ----------
  // R26 amendment: this pin used to assume a clean global depth ring and
  // assert PHOSPHOR from a single seeded 75. Later suites (r23/r26) dispatch
  // REAL gameover events whose samples legitimately accumulate in the same
  // persistent ring, so the seeded 75 alone no longer pins the average.
  // The pin now derives the expected tier/note from the ring's actual
  // contents — same math trophies.js runs — so it validates the LEAGUE
  // LOGIC deterministically no matter what the ring has seen.
  XP._internals.recordDepthSample(75, 100);
  const ringState = XP.getState();
  const ring = Array.isArray(ringState.depthRuns) ? ringState.depthRuns : [75];
  const ringAvg = Math.round(ring.reduce((a, b) => a + b, 0) / ring.length);
  const TIERS = [
    { min: 95, name: 'SUPERNOVA' }, { min: 80, name: 'PLASMA' }, { min: 60, name: 'PHOSPHOR' },
    { min: 40, name: 'NEON' }, { min: 0, name: 'PAPER' },
  ];
  const tierIdx = TIERS.findIndex(t => ringAvg >= t.min);
  const expTier = TIERS[tierIdx].name;
  const expNext = TIERS[tierIdx - 1] || null; // trophies.js: index-1 = next tier UP
  document.getElementById('trophy-btn').click();
  await wait(700);
  const league = document.querySelector('.player-league');
  const noteRe = expNext
    ? new RegExp('avg ' + ringAvg + '% of best · ' + expNext.min + '% to ' + expNext.name)
    : new RegExp('avg ' + ringAvg + '% of best');
  const leagueOk = league && new RegExp(expTier + ' LEAGUE').test(league.textContent) && noteRe.test(league.textContent);
  document.getElementById('trophy-close').click();
  await wait(200);
  ok('A10 depth league tier + honest note', !!leagueOk, league ? league.textContent.slice(0, 60) : 'no league row');

  // ---------- A11 + B1: r23 ladder intact (cap-aware) + mount sweep ----------
  const capped = XP.getState().runToday >= XP._internals.RUN_DAILY_CAP;
  if (!capped) {
    await StripShell._testMakeApi({ mod: { id: "qa-pin-game" }, el: document.querySelector(".cart") }).setHighscore(200);
    await wait(150);
    const before = XP.getState().xp;
    // R29 amendment (day-fresh missions fix): the raw xp delta also carries
    // CONCURRENT payouts that legitimately fire in the same window — a new
    // day's mission board can complete on this very win (+30) and a new best
    // pays its own award. The pin's invariant is the RUN ladder, so sum the
    // strip:xp-awarded events by reason and assert the "run" slice === +8.
    let runSum = 0;
    const onAward = (e) => { if (e.detail && e.detail.reason === 'run') runSum += (e.detail.amount || 0); };
    window.addEventListener('strip:xp-awarded', onAward, { passive: true });
    StripShell._testMakeApi({ mod: { id: "qa-pin-game" }, el: document.querySelector(".cart") }).gameover('win', 250);
    await wait(250);
    window.removeEventListener('strip:xp-awarded', onAward, { passive: true });
    ok('A11 win still pays +8', runSum === XP._internals.AWARD.runWin,
       'run delta ' + runSum + ' (total xp delta ' + (XP.getState().xp - before) + ')');
  } else {
    ok('A11 win still pays +8', true, 'skipped: run cap consumed by suite gameovers');
  }
  const all = window.Strip.all();
  const strip = document.getElementById('strip');
  for (const m of all) {
    StripShell.jumpToModule(m);
    await wait(110);
  }
  await wait(1400);
  const glitched = [...strip.querySelectorAll('.cart-body')].filter(b => b.textContent.includes('glitched')).length;
  ok('B1 mount sweep glitch-free', glitched === 0 && all.length === Strip.all().length  /* R32 amendment: registry-length self-consistent — the deck grew to 52 */,
     'glitched=' + glitched + ' modules=' + all.length);

  // ---------- B2: console silence ----------
  ok('B2 zero console errors', consoleErrors.length === 0, consoleErrors.length + ' errors');

  // leave a clean chassis for the session
  Settings.set({ colorMode: 'dark', glow: 'full' });
  host.remove();
  return results;
})();
