/**
 * qa/r22-regression.js — pins the Round 22 fixes (user's 8 + the P2 tail).
 *
 * Run: serve the app root, open in a browser, then
 * `agent-browser eval "$(cat qa/r22-regression.js)"; sleep 40; agent-browser eval "window.__qa22.then(r => JSON.stringify(r))"`.
 * Resolves to an array of { name, pass, info } on window.__qa22.
 *
 * Pinned invariants:
 *  A1. Minesweeper: the board container is display:grid AND its cells have
 *      real height (the R19–R21 "invisible board" regression is dead).
 *  A2. Garden: a save holding NULL plant entries (bought plot, picker
 *      closed) mounts WITHOUT the "This cartridge glitched" card and the
 *      empty plot renders.
 *  A3. Ant Colony: the role rows carry the live per-ant economy line
 *      ("food/s each · ×2 at 25") — synergy + milestones wired.
 *  A4. Perfect Ring: run starts with three hearts in the HUD.
 *  A5. Rhythm Tap: the card opens IDLE (pad reads TAP TO BEGIN, ring not
 *      shrinking); the first tap commits (pad reads TAP).
 *  A6. Background texture axis: all five bgStyles apply html[data-bg] and a
 *      visible body::before layer for the four textures; SOLID clears it;
 *      localStorage mirror updates.
 *  A7. Drawer: opening the sheet focuses the PANEL — never the filter input
 *      (no virtual keyboard on open), and the filter still works when typed into.
 *  B1. Trivia: 10-question run completes to a results screen after 10 taps.
 *  B2. Whack-a-Mole: wave 2 puts TWO moles on the board concurrently.
 *  B3. Etch Pad + Kaleidoscope: Save PNG button present.
 *  B4. Tone Pad: REC/Play loop controls present.
 *  B5. Breathe: TODAY / ALL TIME counters render.
 *  B6. Type Speed: ACC cell in the stat row.
 *  B7. This or That: fold button present; folding does NOT increment PICKED.
 *  B8. Random Fact: starring persists; Favorites counter grows.
 *  B9. Size ladders: Memory Match / Lights Out / Slide Puzzle / Mini Sudoku /
 *      Code Breaker / Maze all expose their size pills.
 */
window.__qa22 = (async () => {
  const results = [];
  const ok = (name, pass, info) => results.push({ name, pass: !!pass, info: String(info || '').slice(0, 90) });
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const strip = document.getElementById('strip');

  await (window.Settings ? Settings.whenReady() : Promise.resolve());
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
      } else {
        lastMatch = null;
      }
    }
    return null;
  }

  async function seedVerified(id, data) {
    StripShell.jumpToIndex(0);
    await wait(1800);
    await StripDB.saveState(id, data);
    await wait(350);
    let check = await StripDB.loadState(id);
    if (!check || JSON.stringify(check) !== JSON.stringify(data)) {
      await StripDB.saveState(id, data);
      await wait(350);
    }
    return true;
  }

  // ---- A1. minesweeper: the board is VISIBLE ----
  try {
    const cart = await centerOn('minesweeper');
    await wait(500);
    ok('ms centers', !!cart, cart ? 'ok' : 'missing');
    if (cart) {
      const cells = [...cart.querySelectorAll('button')].filter(b => /aspect-ratio/.test(b.style.cssText));
      ok('ms cells exist', cells.length >= 64, 'cells=' + cells.length);
      const board = cells.length ? cells[0].parentElement : null;
      const disp = board ? getComputedStyle(board).display : 'none';
      ok('ms board is grid', disp === 'grid', disp);
      const ch = cells.length ? cells[0].getBoundingClientRect().height : 0;
      ok('ms cells have height', ch > 8, 'h=' + ch.toFixed(1));
    }
  } catch (e) { ok('minesweeper board pins', false, e.message); }

  // ---- A2. garden: null-plant save no longer glitches the cartridge ----
  try {
    await seedVerified('garden', {
      plants: [
        { species: 'daisy', stage: 0, health: 100, lastWater: Date.now(), dead: false },
        null,
        { species: 'daisy', stage: 0, health: 100, lastWater: Date.now(), dead: false },
      ],
      coins: 40, album: {}, sprinkler: 0,
    });
    const cart = await centerOn('garden');
    await wait(2200);
    ok('garden mounts with null plant', !!cart, cart ? 'no glitch card' : 'MOUNT FAILED');
    if (cart) {
      ok('no glitch text', cart.textContent.indexOf('glitched') === -1, 'body');
      ok('empty plot renders', /empty · tap/.test(cart.textContent), 'plot label');
      ok('live plants render', /Growing|Needs water|Ready!/.test(cart.textContent), 'labels');
    }
  } catch (e) { ok('garden null-plant pins', false, e.message); }

  // ---- A3. ant colony: economy line wired ----
  try {
    const cart = await centerOn('anthill');
    await wait(700);
    ok('anthill centers', !!cart, cart ? 'ok' : 'missing');
    if (cart) {
      const desc = [...cart.querySelectorAll('.desc')].map(d => d.textContent).join('|');
      ok('per-ant line present', /food\/s each · ×2 at 25/.test(desc), desc.slice(0, 60));
      ok('milestone target shown', /×2 at 25/.test(desc), 'next milestone');
    }
  } catch (e) { ok('anthill economy pins', false, e.message); }

  // ---- A4. perfect ring: three hearts ----
  try {
    const cart = await centerOn('perfectring');
    await wait(500);
    if (cart) {
      const cv = cart.querySelector('canvas');
      ok('ring canvas', !!cv, cv ? 'ok' : 'missing');
      cv.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await wait(200);
      const lives = cart.querySelector('#pr-lives');
      ok('ring shows 3 hearts', lives && lives.textContent === '♥♥♥', lives ? lives.textContent : 'none');
    }
  } catch (e) { ok('perfect ring pins', false, e.message); }

  // ---- A5. rhythm tap: click-to-begin gate ----
  try {
    const cart = await centerOn('rhythmtap');
    await wait(400);
    ok('rt centers', !!cart, cart ? 'ok' : 'missing');
    if (cart) {
      const pad = [...cart.querySelectorAll('button')].find(b => /TAP TO/.test(b.innerHTML));
      ok('rt opens idle', !!pad, pad ? pad.innerHTML.replace(/<br>/, ' ') : 'playing already');
      const ring = cart.querySelector('svg circle:nth-child(2)');
      const r0 = ring ? Number(ring.getAttribute('r')) : -1;
      await wait(600);
      const r1 = ring ? Number(ring.getAttribute('r')) : -1;
      ok('rt ring frozen while idle', r0 === 160 && r1 === 160, 'r=' + r0 + '->' + r1);
      if (pad) {
        pad.click();
        await wait(150);
        const pad2 = [...cart.querySelectorAll('button')].find(b => b.textContent.trim() === 'TAP');
        ok('rt first tap commits', !!pad2, pad2 ? 'now TAP' : 'no');
      }
    }
  } catch (e) { ok('rhythm tap pins', false, e.message); }

  // ---- A6. background texture axis ----
  // Round 24: the texture axis was RETIRED by user directive — the setting
  // players actually meant by "background" was the app color scheme, so the
  // axis became Settings → Appearance → Color scheme (dark/oled/light) and
  // bgStyle no longer exists (settings migration v3 strips it). These pins
  // are reported as retired-by-design on v3+ saves so a rerun here reads
  // honestly instead of crying wolf; on a pre-v3 save they still verify.
  try {
    if ((Settings.get().settingsVersion || 0) >= 3) {
      ok('bg axis retired (Round 24 color scheme)', true, 'axis removed by design — see r24 suite A1-A4');
    } else {
    for (const bg of ['grid', 'dots', 'horizon', 'scan']) {
      Settings.set({ bgStyle: bg });
      await wait(60);
      const attr = document.documentElement.dataset.bg;
      const layer = getComputedStyle(document.body, '::before').display;
      ok('bg ' + bg + ' applies', attr === bg && layer === 'block', attr + '/' + layer);
    }
    Settings.set({ bgStyle: 'solid' });
    await wait(60);
    const attr = document.documentElement.dataset.bg;
    const layer = getComputedStyle(document.body, '::before').display;
    ok('bg solid clears layer', attr === 'solid' && layer === 'none', attr + '/' + layer);
    ok('bg mirrored for pre-paint', localStorage.getItem('strip-bg') === 'solid', localStorage.getItem('strip-bg'));
    }
  } catch (e) { ok('background axis pins', false, e.message); }

  // ---- A7. drawer focus contract ----
  try {
    const btn = document.getElementById('drawer-btn');
    btn.click();
    await wait(500);
    const overlay = document.getElementById('drawer-overlay');
    const input = document.getElementById('drawer-filter');
    ok('drawer opens', overlay.classList.contains('open'), 'open');
    ok('focus NOT on filter input', document.activeElement !== input, document.activeElement.id || document.activeElement.tagName);
    const panel = document.getElementById('drawer-panel');
    ok('focus on panel', document.activeElement === panel, document.activeElement.id || document.activeElement.tagName);
    input.value = 'snake';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(150);
    const rows = [...overlay.querySelectorAll('.drawer-item-title')].map(t => t.textContent);
    ok('filter still works', rows.length === 1 && rows[0] === 'Snake', rows.join(','));
    document.getElementById('drawer-close').click();
    await wait(300);
  } catch (e) { ok('drawer focus pins', false, e.message); }

  // ---- B1. trivia: a full 10-question run completes ----
  try {
    await seedVerified('trivia', { bag: null });
    const cart = await centerOn('trivia');
    await wait(500);
    if (cart) {
      ok('trivia run meter present', /Q\s*1\/10/.test(cart.textContent) && !!cart.querySelector('div[style*="height: 5px"]'), 'meter');
      for (let k = 0; k < 10; k++) {
        const ans = cart.querySelectorAll('.btn:not(.accent)');
        if (ans.length) ans[0].click();
        await wait(1000);
      }
      await wait(1000);
      ok('trivia run completes', /RUN COMPLETE/.test(cart.textContent), cart.textContent.match(/RUN COMPLETE[^·]{0,12}/) ? 'scored' : 'missing');
      ok('trivia play again offered', [...cart.querySelectorAll('button')].some(b => b.textContent === 'Play again'), 'rematch');
    }
  } catch (e) { ok('trivia run pins', false, e.message); }

  // ---- B2. whack-a-mole: wave 2 doubles the moles ----
  try {
    const cart = await centerOn('whackmole');
    await wait(400);
    if (cart) {
      const startBtn = [...cart.querySelectorAll('button')].find(b => b.textContent === 'Start');
      startBtn.click();
      await wait(10700); // wave 2 fires at the 20s tick... wave flips at 0:20 left = t+10s
      let twoUp = false;
      for (let s = 0; s < 30; s++) {
        const up = [...cart.querySelectorAll('button')].filter(b => b.textContent === '🐹').length;
        if (up >= 2) { twoUp = true; break; }
        await wait(120);
      }
      ok('wave 2 shows 2 moles', twoUp, 'concurrent moles sampled');
    }
  } catch (e) { ok('whackmole wave pins', false, e.message); }

  // ---- B3. etch + kaleidoscope save buttons ----
  try {
    const etch = await centerOn('etch');
    await wait(300);
    ok('etch save png', !!etch && [...etch.querySelectorAll('button')].some(b => b.textContent === 'Save PNG'), 'btn');
    const kal = await centerOn('kaleidoscope');
    await wait(300);
    ok('kaleido save png', !!kal && [...kal.querySelectorAll('button')].some(b => b.textContent === 'Save PNG'), 'btn');
  } catch (e) { ok('save-png pins', false, e.message); }

  // ---- B4. tonepad loop recorder ----
  try {
    const cart = await centerOn('tonepad');
    await wait(300);
    ok('tonepad rec row', !!cart && /● REC/.test(cart.textContent) && /Play loop/.test(cart.textContent), 'controls');
  } catch (e) { ok('tonepad pins', false, e.message); }

  // ---- B5. breathe counter ----
  try {
    const cart = await centerOn('breathe');
    await wait(300);
    ok('breathe counters', !!cart && /TODAY/.test(cart.textContent) && /ALL TIME/.test(cart.textContent), 'row');
  } catch (e) { ok('breathe pins', false, e.message); }

  // ---- B6. typespeed accuracy cell ----
  try {
    const cart = await centerOn('typespeed');
    await wait(300);
    ok('typespeed acc cell', !!cart && /ACC/.test(cart.textContent), 'stat');
  } catch (e) { ok('typespeed pins', false, e.message); }

  // ---- B7. this-or-that fold ----
  try {
    const cart = await centerOn('thisorthat');
    await wait(400);
    if (cart) {
      const fold = [...cart.querySelectorAll('button')].find(b => b.textContent === '🤔');
      ok('fold button exists', !!fold, fold ? 'ok' : 'missing');
      const before = (cart.textContent.match(/PICKED (\d+)/) || [])[1];
      const leftBefore = cart.querySelector('button').textContent;
      fold.click();
      await wait(400);
      const after = (cart.textContent.match(/PICKED (\d+)/) || [])[1];
      ok('fold does not count', before === after, 'PICKED ' + before + '->' + after);
    }
  } catch (e) { ok('thisorthat pins', false, e.message); }

  // ---- B8. random fact favorites ----
  try {
    await seedVerified('randomfact', { seen: 0, bag: null, favs: [] });
    const cart = await centerOn('randomfact');
    await wait(400);
    if (cart) {
      const star = [...cart.querySelectorAll('button')].find(b => b.textContent === '☆');
      ok('star button exists', !!star, star ? '☆' : 'missing');
      if (star) {
        star.click();
        await wait(200);
        ok('star persists', /Favorites \(1\)/.test(cart.textContent), 'count=1');
      }
    }
  } catch (e) { ok('randomfact pins', false, e.message); }

  // ---- B9. size ladders expose pills ----
  try {
    const expect = {
      memorymatch: ['4×3', '6×4', '6×5'],
      lightsout: ['4×4', '5×5', '6×6'],
      slidepuzzle: ['3×3', '4×4', '5×5'],
      minisudoku: ['4×4', '6×6'],
      codebreaker: ['4×5', '4×6', '5×7'],
      maze: ['5×5', '7×7', '9×9'],
    };
    for (const [id, pills] of Object.entries(expect)) {
      const cart = await centerOn(id);
      await wait(350);
      const found = !!cart && pills.every(p => [...cart.querySelectorAll('button')].some(b => b.textContent.trim() === p));
      ok('ladder ' + id, found, cart ? pills.join('/') : 'missing cart');
    }
  } catch (e) { ok('ladder pins', false, e.message); }

  StripShell.jumpToIndex(0);
  return results;
})();
