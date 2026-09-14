/**
 * qa/r21-regression.js — pins the Round 21 user-directed fixes.
 *
 * Run: serve the app root, open in a browser, then
 * `agent-browser eval "$(cat qa/r21-regression.js)"; sleep N; agent-browser eval "window.__qa21.then(r => JSON.stringify(r))"`.
 * Resolves to an array of { name, pass, info } on window.__qa21.
 *
 * Pinned invariants (every directive from the Round 21 brief):
 *  1. Registry: 51 cartridges (Perfect Ring joined the deck).
 *  2. Settings CONTROLS: the Fullscreen row is the FIRST row after the
 *     CONTROLS label (user ask: fullscreen first).
 *  3. Theme: fresh state resolves to ICE as the default skin; the document
 *     wears data-theme="ice"; the ICE button exists in the picker; an
 *     explicit AMBER pick still applies (choice preserved) and ICE returns.
 *  4. Teleport confirm: the Daily chip's jump now opens a sheet naming the
 *     pick; STAY does not move the strip; COMMIT scrolls the strip to the
 *     pick's card (user ask: confirmation on the daily-pick teleport).
 *  5. Minesweeper: switching field mid-run leaves the clock at 0s (the
 *     running-timer leak is dead); the fresh board waits for the first dig.
 *  6. Garden: a legacy/NaN-shaped save (no lastSeen/lastWater/health) mounts
 *     with real numbers — no "NaN%" bar; Golden-can and Greenhouse buttons
 *     exist (the new economy sinks).
 *  7. Blob Merge: a saved board (grid+score) survives an unmount/remount
 *     cycle — scrolling away no longer wipes a run.
 *  8. Perfect Ring: mounts with a canvas in the idle state; a pointer tap
 *     begins a run (hint flips to "tap inside the arc") — click to begin.
 */
window.__qa21 = (async () => {
  const results = [];
  const ok = (name, pass, info) => results.push({ name, pass: !!pass, info: String(info || '').slice(0, 90) });
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  const strip = document.getElementById('strip');

  await (window.Settings ? Settings.whenReady() : Promise.resolve());
  await wait(600);

  // ---- 1. registry count ----
  try {
    ok('51 cartridges registered', Strip.all().length === 51, 'count=' + Strip.all().length);
    ok('perfectring registered', Strip.all().some(m => m.id === 'perfectring'), Strip.all().map(m => m.id).includes('perfectring'));
  } catch (e) { ok('registry pins', false, e.message); }

  // ---- 2. fullscreen first in CONTROLS ----
  try {
    const body = document.querySelector('.settings-body');
    const rows = [...body.children];
    const labelIdx = rows.findIndex(el => el.classList.contains('settings-section-label') && el.textContent.trim() === 'CONTROLS');
    ok('CONTROLS label exists', labelIdx >= 0, 'idx=' + labelIdx);
    const after = rows[labelIdx + 1];
    ok('fullscreen row is first', !!after && !!after.querySelector('#fullscreen-btn'), after ? (after.querySelector('.setting-label') || {}).textContent : 'none');
  } catch (e) { ok('controls order pins', false, e.message); }

  // ---- 3. ICE default + explicit amber still wins ----
  try {
    ok('data-theme is ice', document.documentElement.dataset.theme === 'ice', document.documentElement.dataset.theme);
    ok('ice button exists', !!document.querySelector('.theme-seg-btn[data-theme-value="ice"]'), 'picker');
    const bg = getComputedStyle(document.body).backgroundColor;
    ok('ice chassis color', bg === 'rgb(7, 11, 18)', bg);
    Settings.set({ theme: 'amber' });
    await wait(80);
    ok('explicit amber applies', document.documentElement.dataset.theme === 'amber', document.documentElement.dataset.theme);
    Settings.set({ theme: 'ice' });
    await wait(80);
    ok('ice re-applies', document.documentElement.dataset.theme === 'ice', document.documentElement.dataset.theme);
  } catch (e) { ok('theme pins', false, e.message); }

  // ---- 4. teleport confirmation ----
  try {
    StripShell.jumpToIndex(0);
    await wait(1800); // smooth scroll fully settled
    const before = strip.scrollTop;
    Daily._internals.teleport.request();
    await wait(120);
    ok('teleport sheet opens', Daily._internals.teleport.isOpen(), 'sheet');
    const named = (Daily._internals.teleport.title() || '').length > 0;
    ok('sheet names the pick', named, Daily._internals.teleport.title());
    ok('no jump before confirm', strip.scrollTop === before, 'scrollTop unchanged');
    Daily._internals.teleport.stay();
    await wait(120);
    ok('STAY closes without jumping', !Daily._internals.teleport.isOpen() && strip.scrollTop === before, 'still here');
    Daily._internals.teleport.request();
    await wait(80);
    Daily._internals.teleport.commit();
    await wait(2000); // smooth scroll + settle + mount
    // the real semantic: the card the player is NOW standing on IS the pick
    const centered = [...strip.querySelectorAll('.cart')].find(c => {
      const r = c.getBoundingClientRect();
      return Math.abs(r.top - strip.getBoundingClientRect().top) < 30 && r.height > 50;
    });
    const centeredTitle = centered && centered.querySelector('.cart-title') ? centered.querySelector('.cart-title').textContent : '';
    ok('COMMIT teleports to pick', centeredTitle === Daily.getState().title, 'on="' + centeredTitle + '" want="' + Daily.getState().title + '"');
    await wait(400);
  } catch (e) { ok('teleport pins', false, e.message); }

  // ---- helpers to center a cartridge ----
  async function centerOn(id, timeout) {
    StripShell.jumpToModule(Strip.all().find(m => m.id === id));
    const t0 = Date.now();
    let lastTop = -1, lastMatch = null;
    while (Date.now() - t0 < (timeout || 5000)) {
      await wait(250);
      const top = strip.scrollTop;
      // scroll must be SETTLED (two consecutive identical positions) — a
      // mid-flight rect match once landed on a card the strip was still
      // passing through, and every read after that was race noise
      const settled = top === lastTop;
      lastTop = top;
      if (!settled) { lastMatch = null; continue; }
      const centered = [...strip.querySelectorAll('.cart')].find(c => {
        const r = c.getBoundingClientRect();
        return Math.abs(r.top - strip.getBoundingClientRect().top) < 20 && r.height > 50;
      });
      if (centered && centered.querySelector('.cart-title') &&
          (Strip.all().find(m => m.id === id).title || '') === centered.querySelector('.cart-title').textContent) {
        if (lastMatch === centered) return centered; // stable across two polls
        lastMatch = centered;
      } else {
        lastMatch = null;
      }
    }
    return null;
  }

  // Park at card 0 (all distant mounts prune), seed a save, and VERIFY the
  // store holds it — a still-mounted copy's cleanup persist() can land after
  // the seed write and clobber it, so re-check and re-write once if needed.
  async function seedVerified(id, data) {
    StripShell.jumpToIndex(0);
    await wait(2000); // every distant cleanup persist has landed by now
    await StripDB.saveState(id, data);
    await wait(350);
    let check = await StripDB.loadState(id);
    if (!check || JSON.stringify(check) !== JSON.stringify(data)) {
      await StripDB.saveState(id, data);
      await wait(350);
      check = await StripDB.loadState(id);
    }
    return check && JSON.stringify(check) === JSON.stringify(data);
  }

  // ---- 5. minesweeper: difficulty switch kills the clock ----
  try {
    const cart = await centerOn('minesweeper');
    await wait(400); // async mount: builds the board after its IndexedDB reads
    ok('minesweeper centers', !!cart, cart ? 'ok' : 'not found');
    if (cart) {
      const getPill = (l) => [...cart.querySelectorAll('button')].find(b => b.textContent.trim() === l);
      // force a REAL field switch first — the saved diff may already equal
      // the target, and the same-pill click early-returns by design
      getPill('8×8').click();
      await wait(600);
      // dig a cell to start the clock (fresh board: first dig is safe by design)
      const cells = [...cart.querySelectorAll('button')].filter(b => /aspect-ratio/.test(b.style.cssText));
      ok('minesweeper cells render', cells.length >= 64, 'cells=' + cells.length);
      if (cells.length) {
        cells[20].click();
        await wait(1300); // let the clock tick at least once
        // switch away — the old bug let the clock keep ticking here
        getPill('12×10').click();
        await wait(1400);
        const stat = cart.textContent.match(/TIME\s*(\d+)s/);
        ok('switch resets clock to 0', stat && stat[1] === '0', 'TIME=' + (stat ? stat[1] + 's' : '?'));
      }
    }
  } catch (e) { ok('minesweeper pins', false, e.message); }

  // ---- 6. garden: NaN-proof state + new sinks ----
  try {
    // three legacy plants (no lastWater/lastSeen/_growAccum) — the exact
    // pre-shop save shape that used to NaN-poison the bars
    const seededG = await seedVerified('garden', {
      plants: [
        { species: 'daisy', stage: 0, health: 100 },
        { species: 'daisy', stage: 0, health: 100 },
        { species: 'daisy', stage: 0, health: 100 },
      ],
      coins: 40, album: {}, sprinkler: 0,
    });
    ok('garden seed intact', !!seededG, 'store');
    const cart = await centerOn('garden');
    ok('garden centers', !!cart, cart ? 'ok' : 'not found');
    if (cart) {
      await wait(2300); // async mount + one tick — NaN would surface as "NaN%" here
      const bar = [...cart.querySelectorAll('div')].find(d => /width/.test(d.style.transition));
      const w = bar ? bar.style.width : 'none';
      ok('health bar not NaN', bar && w.indexOf('NaN') === -1, 'width=' + w);
      ok('golden can button exists', /Golden watering can|Water all/.test(cart.textContent), 'can');
      ok('greenhouse button exists', /Greenhouse/.test(cart.textContent), 'greenhouse');
      // 3 plants on the free tier → the NEXT plot (the 4th) costs 20
      ok('plot ladder text', /New plot \(20 coins\)/.test(cart.textContent), cart.textContent.match(/New plot[^"]{0,20}/) ? 'ok' : 'missing');
      // labels are honest: a hydrated, wet plant says Growing
      ok('honest labels render', /Growing|Needs water|Weak · growing|Ready!/.test(cart.textContent), 'labels');
    }
  } catch (e) { ok('garden pins', false, e.message); }

  // ---- 7. blob merge: board survives unmount/remount ----
  try {
    // seed a known board: score 42, a stage-3 pair + a stray
    const row = () => [null, null, null, null];
    const grid = [row(), row(), row(), row(), row()];
    grid[0][0] = { stage: 2 }; grid[1][1] = { stage: 2 }; grid[2][2] = { stage: 0 };
    const seededB = await seedVerified('blobmerge', { grid, score: 42, maxStage: 2, maxStageEver: 3, winShown: false });
    ok('blob seed intact', !!seededB, 'store');
    let cart = await centerOn('blobmerge');
    await wait(700); // async mount: restoreState runs after its IndexedDB reads
    ok('blob centers (pre)', !!cart, cart ? 'ok' : 'not found');
    const scoreEl = cart && cart.querySelector('#bm-score');
    ok('blob restores score', scoreEl && scoreEl.textContent === '42', scoreEl ? scoreEl.textContent : 'none');
    // scroll away (unmount) and come back
    StripShell.jumpToIndex(0);
    await wait(1300);
    cart = await centerOn('blobmerge');
    await wait(700);
    const scoreEl2 = cart && cart.querySelector('#bm-score');
    ok('blob score survives remount', scoreEl2 && scoreEl2.textContent === '42', scoreEl2 ? scoreEl2.textContent : 'none');
  } catch (e) { ok('blob pins', false, e.message); }

  // ---- 8. perfect ring: click to begin ----
  try {
    const cart = await centerOn('perfectring');
    ok('perfect ring centers', !!cart, cart ? 'ok' : 'not found');
    if (cart) {
      const cv = cart.querySelector('canvas');
      ok('ring canvas mounts', !!cv, cv ? cv.width + 'x' + cv.height : 'none');
      const hint = [...cart.querySelectorAll('div')].find(d => /tap inside the arc/.test(d.textContent));
      // idle: hint is empty/absent; tap starts the run
      cv.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await wait(200);
      const hintAfter = [...cart.querySelectorAll('div')].find(d => /tap inside the arc/.test(d.textContent));
      ok('click to begin works', !!hintAfter && !hint, hintAfter ? 'run started' : 'no hint');
      // a second tap while playing (almost surely outside a tiny arc) burns
      // one heart — Round 22 amended this contract per user ask: a miss no
      // longer ends the run (3 hearts), so the pin now asserts the run
      // SURVIVES the miss and the HUD shows a heart was spent (♥♥♡).
      cv.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await wait(200);
      const lives = cart.querySelector('#pr-lives');
      const stillPlaying = ![...cart.querySelectorAll('div')].find(d => /tap to retry|NEW BEST/.test(d.textContent));
      ok('miss costs a heart, run circles on', stillPlaying && lives && /♥♥♡|♥♡♡/.test(lives.textContent),
        lives ? lives.textContent : (stillPlaying ? 'playing, no hud' : 'over'));
    }
  } catch (e) { ok('ring pins', false, e.message); }

  return results;
})();
