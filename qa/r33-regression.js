/**
 * qa/r33-regression.js — pins the Round 33 build ("Daylight Screens"):
 * the light-chassis CRT fix the real-device pass reported (light mode used
 * to keep every in-game screen dark, which read as a photo negative — dark
 * 2048 tiles on a paper board, near-white ink stranded on white), plus the
 * weekly ON DECK recap and the win-depth contract for Dice Pig.
 *
 * IMPORTANT (determinism): this suite WIPES the meta stores + localStorage
 * BEFORE it runs (same preamble discipline as r31/r32), then reloads, then
 * PINS THE CHASSIS to dark via Settings.set — the token scoping assertion
 * (A1) needs a known starting axis. The suite restores the mode it found at
 * the end. Run:
 *   agent-browser eval "<wipe>"; agent-browser reload; sleep 3;
 *   agent-browser eval "$(cat qa/r33-regression.js)"; sleep 45;
 *   agent-browser eval "window.__qa33.then(r => JSON.stringify(r))"
 *
 * Pinned invariants:
 *  A1. DAYLIGHT TOKENS ARE LIGHT-ONLY: in dark/OLED the --screen* tokens
 *      resolve to "" (undefined) so every game's var(--screen, <raw hex>)
 *      falls back pixel-identically; in light they resolve to the daylight
 *      values. One engine, two chassis, dark untouched BY CONSTRUCTION.
 *  A2. The re-grades are REAL: snake's board computes #12121a in dark and
 *      #FBFAF6 in light; a .s2-t2 tile computes #3F3F4D in dark (R34
 *      daylighted the dark low ramp; was #2A2A34 pre-R34) and the
 *      daylight beige #EAE5DA in light — dark values EXACTLY the hexes the
 *      game used to inline.
 *  A3. LIVE RETINT: the same mounted fixture re-grades on a real
 *      Settings.set chassis flip (no remount) — the strip:mode-changed
 *      handoff canvas games rely on, plus zero errors across the flip.
 *  A4. WIN-DEPTH: dicepig opts in at register() (winDepth:true), an
 *      inverted-encoding game (lightsout) does NOT, a REAL scripted Dice
 *      Pig run carries winDepth through strip:gameover detail, and the run
 *      (win OR over — both are honest samples for an opted-in game with a
 *      seeded best) lands in the Depth ring with sane 1..100 math.
 *  A5. WEEKLY RECAP: last7() is 7 zero-filled local days oldest→today,
 *      weekMs === the sum, the label floors honestly, and the Player Card
 *      renders THIS WEEK with seven bars.
 *  B1. 52/52 mount sweep glitch-free (registry-length self-consistent).
 *  B2. Zero console errors across the whole suite (mode flips included).
 */
window.__qa33 = (async () => {
  const results = [];
  const ok = (name, pass, info) => results.push({ name, pass: !!pass, info: String(info || '').slice(0, 110) });
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const consoleErrors = [];
  const onErr = (e) => consoleErrors.push((e && (e.message || e.type)) || String(e) +
    (e && e.lineno ? ' @' + e.lineno : ''));
  window.addEventListener('error', onErr);
  window.addEventListener('unhandledrejection', (e) => consoleErrors.push('rej:' + String(e.reason || e).slice(0, 60)));

  await (window.Settings ? Settings.whenReady() : Promise.resolve());
  await window.XP.whenReady();
  await window.Depth.whenReady();
  await window.Ontime.whenReady();
  await window.Trophies.whenReady();
  await wait(900); // boot settle: trophy retro-evaluate + sparkline hydration
  if(!Settings.get().hintSeen) Settings.set({ hintSeen: true });

  // Pin the chassis deterministically; remember what the player had.
  const modeFound = document.documentElement.dataset.mode || 'dark';
  Settings.set({ colorMode: 'dark', crtEffects: true, glow: 'full', reduceMotion: false });
  await wait(200);

  const rec = window.Depth._internals.record;

  ok('A0 module surfaces present',
     !!(window.Trophies && window.Depth && window.Ontime && window.Strip && Strip.all().length === 52),
     'trophies=' + !!window.Trophies + ' depth=' + !!window.Depth +
     ' ontime=' + !!window.Ontime + ' carts=' + Strip.all().length);

  const htmlStyle = () => getComputedStyle(document.documentElement);
  const readToken = (t) => htmlStyle().getPropertyValue(t).trim();

  // DOM seam (same as r31/r32): the centered card is pure scroll math —
  // the same division app.js performs every frame.
  const stripEl = document.getElementById('strip');
  const centeredCard = () => {
    const idx = Math.round(stripEl.scrollTop / (stripEl.clientHeight || 1));
    return stripEl.children[idx] || null;
  };

  // ---------- A1: the daylight tokens are LIGHT-ONLY ----------
  {
    const darkScreen = readToken('--screen');
    const darkInk = readToken('--screen-ink');
    Settings.set({ colorMode: 'light' });
    await wait(220);
    const lightScreen = readToken('--screen');
    const lightInkRgb = readToken('--screen-ink-rgb');
    const lightVeil = readToken('--screen-veil');
    ok('A1 daylight tokens scoped to LIGHT (dark resolves empty → raw fallbacks)',
       darkScreen === '' && darkInk === '' &&
       lightScreen === '#FBFAF6' && lightInkRgb === '42,38,32' && lightVeil !== '',
       'dark="--' + darkScreen + '" light=' + lightScreen +
       ' ink-rgb=' + lightInkRgb + ' veil=' + (lightVeil ? 'set' : 'EMPTY'));
  }

  // ---------- A2: the re-grades are real, dark values pixel-identical ----------
  // Fixture mounts (not strip scroll): the assertion is the SURFACE COLOR,
  // independent of where the deck happens to be scrolled.
  {
    const snake = Strip.all().find(m => m.id === 'snake');
    const body = document.createElement('div');
    document.body.appendChild(body);
    let cleanupSnake = null;
    try{
      const r = snake.mount(body, {
        save(){ return Promise.resolve(); }, load(){ return Promise.resolve(null); },
        getHighscore(){ return Promise.resolve(0); }, setHighscore(){ return Promise.resolve(0); },
        gameover(){}, tend(){}, setStats(){}
      });
      const c = (r && typeof r.then === 'function') ? await r : r; // async mount resolves to its cleanup
      if(typeof c === 'function') cleanupSnake = c;
    }catch(e){}
    // the board is the only grid with the screen token in its inline style
    const boardEl = [...body.querySelectorAll('div')].find(d => /var\(--screen/.test(d.getAttribute('style') || ''));
    const lightBg = boardEl ? getComputedStyle(boardEl).backgroundColor : '';
    Settings.set({ colorMode: 'dark' });
    await wait(220);
    const darkBg = boardEl ? getComputedStyle(boardEl).backgroundColor : '';
    ok('A2a snake board: #12121a in dark (pixel-identical) → #FBFAF6 in light',
       darkBg === 'rgb(18, 18, 26)' && lightBg === 'rgb(251, 250, 246)',
       'dark=' + darkBg + ' light=' + lightBg);

    // the 2048 ramp: dark values EXACTLY the old inline hexes, light the
    // daylight re-grades — verified on a live element through the SAME flip
    // R34 AMENDMENT (auuudit P0): the DARK low ramp was daylighted — 2/4 were
    // ~4% luminance over the board and over each other ("identical grays").
    // The dark s2-t2 pin moves 2A2A34 → 3F3F4D (rgb 63,63,77); the LIGHT
    // value is untouched. The old pixel-identity guarantee was R33-scoped:
    // the R34 audit supersedes it by design.
    const tile = document.createElement('div');
    tile.className = 's2-t s2-t2';
    document.body.appendChild(tile);
    const tileDark = getComputedStyle(tile).backgroundColor;
    Settings.set({ colorMode: 'light' });
    await wait(220);
    const tileLight = getComputedStyle(tile).backgroundColor;
    ok('A2b 2048 tile ramp: s2-t2 = #3F3F4D dark (R34 daylighted low ramp) → daylight beige in light',
       tileDark === 'rgb(63, 63, 77)' && tileLight === 'rgb(234, 229, 218)',
       'dark=' + tileDark + ' light=' + tileLight);

    // ---------- A3: LIVE retint — same mounted elements, real flip ----------
    // snake board (DOM var()) + the tile both just re-graded live in A2/A3's
    // flips with NO remount; pin the contract explicitly through one more
    // flip, and the canvas handoff event carries no errors.
    let modeEvent = null;
    const onMode = (e) => { modeEvent = (e.detail && e.detail.mode) || 'unknown'; };
    window.addEventListener('strip:mode-changed', onMode);
    Settings.set({ colorMode: 'dark' });
    await wait(220);
    const tileBack = getComputedStyle(tile).backgroundColor;
    window.removeEventListener('strip:mode-changed', onMode);
    // R34 amendment: the dark low ramp moved 2A2A34 → 3F3F4D (see A2b)
    const liveOk = modeEvent === 'dark' && tileBack === 'rgb(63, 63, 77)' &&
                   getComputedStyle(boardEl).backgroundColor === 'rgb(18, 18, 26)';
    if(cleanupSnake) cleanupSnake();
    try{ tile.remove(); }catch(e){}
    try{ body.remove(); }catch(e){}
    ok('A3 live retint: mounted surfaces re-grade on the real flip (no remount, no errors)',
       liveOk && consoleErrors.length === 0,
       'event=' + modeEvent + ' tileBack=' + tileBack + ' errs=' + consoleErrors.length);
  }

  // ---------- A4: win-depth contract (dicepig opts in, plays for real) ----------
  {
    const pig = Strip.all().find(m => m.id === 'dicepig');
    const lights = Strip.all().find(m => m.id === 'lightsout');
    ok('A4a winDepth opt-in: dicepig true, inverted-encoding lightsout untouched',
       !!pig && pig.winDepth === true && !!lights && !lights.winDepth,
       'dicepig=' + (pig && pig.winDepth) + ' lightsout=' + (lights && !!lights.winDepth));

    // seed a real best THROUGH THE SHELL'S OWN API FACTORY so the depth
    // ratio has a denominator no matter how the run ends
    const api = StripShell._testMakeApi({ mod: { id: "dicepig" }, el: document.querySelector(".cart") });
    await api.setHighscore(80);
    // jump the strip to the cartridge and WAIT for the smooth scroll to land
    window.StripShell.jumpToModule(pig);
    let cart = null;
    for(let i = 0; i < 30; i++){
      await wait(100);
      if((window.StripShell._centeredMod() || {}).id === 'dicepig') break;
    }
    await wait(500); // mount window
    cart = centeredCard();
    const mounted = !!cart && !!cart.querySelector('#dp-roll');

    let gameoverCalls = [];
    const onGo = (e) => { if(e.detail && e.detail.id === 'dicepig') gameoverCalls.push(e.detail); };
    window.addEventListener('strip:gameover', onGo);
    // scripted REAL run — the buttons a human taps (r32 A7 discipline)
    let guard = 0;
    while(gameoverCalls.length === 0 && guard++ < 200){
      const rollBtn = cart.querySelector('#dp-roll');
      if(!rollBtn || rollBtn.disabled) break;
      rollBtn.click();
      await wait(480);
      const bank = cart.querySelector('#dp-bank');
      if(bank && !bank.disabled){ bank.click(); await wait(160); }
      if(gameoverCalls.length === 0 && cart.querySelector('#dp-end') &&
         cart.querySelector('#dp-end').style.display !== 'none') break;
    }
    const call = gameoverCalls[0];
    // the flag rides the REAL detail: true on a win, and wins carry ≥ 50
    const flagOk = !!call && (call.outcome === 'over' ? true : call.winDepth === true && call.score >= 50);
    ok('A4b real Dice Pig run: winDepth rides strip:gameover detail (win ⇒ true, score ≥ 50)',
       mounted && gameoverCalls.length === 1 && flagOk,
       'mounted=' + mounted + ' calls=' + gameoverCalls.length +
       ' outcome=' + (call && call.outcome) + ' score=' + (call && call.score) +
       ' winDepth=' + (call && String(call.winDepth)));
    window.removeEventListener('strip:gameover', onGo);

    // the sample lands in the ring (win via win-depth, over via the old rule;
    // best 80 is the denominator either way) — 1..100 honest band
    await wait(900); // async getHighscore → record
    const cnt = Depth.countFor('dicepig') || 0;
    const avg = Depth.avgFor('dicepig');
    ok('A4c the run feeds the Depth ring with sane ratio math',
       cnt >= 1 && avg != null && avg >= 1 && avg <= 100,
       'count=' + cnt + ' avg=' + avg + ' (best seeded 80, run score ' + (call && call.score) + ')');
  }

  // ---------- A5: the weekly recap ----------
  {
    const WDKEY = (d) => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    const week = Ontime.last7();
    const keys = week.map(d => d.key);
    const todayOk = keys[6] === WDKEY(new Date());
    const yesterdayOk = keys[5] === WDKEY(new Date(Date.now() - 86400000));
    Ontime._internals.accrue(90 * 1000); // 90s → the label floors to "1m"
    // sum honesty, computed fresh (a pre-accrue snapshot would race the
    // heartbeat — the funnel accrues while the suite runs, by design)
    const week2 = Ontime.last7();
    const sumOk2 = Ontime.weekMs() === week2.reduce((s, d) => s + d.ms, 0);
    const label = Ontime.weekLabel();
    const labelOk = label === '1m' || label === '2m'; // floor honesty (timing-safe)
    // the Player Card renders THIS WEEK with seven bars
    document.getElementById('trophy-btn').click();
    await wait(650);
    const row = document.querySelector('.player-week');
    const bars = row ? row.querySelectorAll('.player-week-bar') : [];
    const total = row ? row.querySelector('.player-week-total') : null;
    document.getElementById('trophy-close').click();
    await wait(250);
    ok('A5 weekly recap: 7 zero-filled local days oldest→today, sum honest, label floors, card renders 7 bars',
       week.length === 7 && todayOk && yesterdayOk && sumOk2 && labelOk &&
       bars.length === 7 && total && total.textContent === label,
       'keys ' + keys[0] + '→' + keys[6] + ' label=' + label +
       ' bars=' + bars.length + ' total=' + (total && total.textContent));
  }

  // ---------- B1: 52/52 mount sweep ----------
  {
    let fails = 0, total = 0;
    const all = Strip.all();
    for(const m of all){
      const body = document.createElement('div');
      document.body.appendChild(body);
      try{
        const r = m.mount(body, {
          save(){ return Promise.resolve(); }, load(){ return Promise.resolve(null); },
          getHighscore(){ return Promise.resolve(0); }, setHighscore(){ return Promise.resolve(0); },
          gameover(){}, tend(){}, setStats(){}
        });
        if(r && typeof r.then === 'function') await r;
      }catch(err){ fails++; console.error('B1 mount fail', m.id, err); }
      total++;
      try{ body.remove(); }catch(e){}
      if(total % 13 === 0) await wait(60); // yield: timers/RAF breathe like the deck
    }
    await wait(400);
    ok('B1 all cartridges mount clean with R33 live (daylight screens + win-depth)',
       fails === 0 && total === Strip.all().length,
       'fails=' + fails + '/' + total + ' carts=' + Strip.all().length);
  }

  // restore the chassis the profile had when the suite arrived
  Settings.set({ colorMode: modeFound === 'light' ? 'light' : 'dark' });
  await wait(200);

  ok('B2 zero console errors', consoleErrors.length === 0,
     consoleErrors.join(' | ').slice(0, 100));

  window.removeEventListener('error', onErr);

  return results;
})();
