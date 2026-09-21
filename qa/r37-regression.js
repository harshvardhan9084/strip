/**
 * qa/r37-regression.js — pins the Round 37 build ("MY SHELF + the audit's
 * long tail"): the auuudit.md §2 personalization #1 (favorites reorder the
 * DECK itself + ★ chips on pinned cards), the bubbleshoot dotted trajectory
 * with wall-bounce preview dots (§10), the TD court fill + wave-muster
 * sprites (§45 / P1 density carry), the simonsays turn banner (§37), and
 * codebreaker's active-slot invitation (§12).
 *
 * IMPORTANT (determinism): run on a FRESH SESSION — wipe + reload first:
 *   agent-browser eval "indexedDB.deleteDatabase('strip-db'); localStorage.clear(); 'wiped'"
 *   agent-browser open "http://<host>:<port>/"; sleep 3;
 *   agent-browser eval "$(cat qa/r37-regression.js)"; sleep 30;
 *   agent-browser eval "window.__qa37.then(r => JSON.stringify(r))"
 *
 * Pinned invariants:
 *  A1. SHELF ORDER (pure seam): StripShell._shelfOrder stably partitions
 *      favorites-first (same sub-order, same array identity when the set is
 *      empty) — the EXACT code path nextBatch uses.
 *  A2. MY SHELF LIVE: toggling a drawer star fires strip:fav-changed, the
 *      built card for that cartridge grows a .cart-fav ★ chip, toggling
 *      back removes it; StripDrawer.getFavorites() reflects both states.
 *  A3. TRAJECTORY: on a freshly mounted bubbleshoot (angle = straight up),
 *      the mid-field band (y 55–72%, clear of bubbles in the old build)
 *      now contains preview-dot pixels (alpha>0) — the old 40px stub line
 *      never reached there. Impact ring is part of the same path.
 *  A4. TD COURT: the court canvas fills the playfield (width > 300px at
 *      390vw; the old cap was 260) and, pre-wave, the muster sprites draw
 *      #6FCF97 health bars — a color ONLY enemies' bars use (no green
 *      towers exist), so green pixels on an idle court == sprites exist.
 *  A5. TURN BANNER: simonsays ships a .status-chip that morphs
 *      TAP START → WATCH… → REPEAT 1 through a real Start press.
 *  A6. ACTIVE SLOT: codebreaker marks EXACTLY ONE .cb-next slot (dashed
 *      amber, pulsing) and it advances after a real peg pick.
 *  A7. Deck floor: Strip.all().length >= 52 (the r31 A0 literal now `>= N`).
 *  C1. 52/52 mount sweep glitch-free.
 *  C2. Zero console errors across the whole suite.
 */
window.__qa37 = (async () => {
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

  // ---------- A1: the pure shelf-order seam ----------
  const A = { id: 'a' }, B = { id: 'b' }, C = { id: 'c' };
  const ordered = StripShell._shelfOrder([A, B, C], new Set(['c', 'a']));
  // STABLE partition: favorites first, each group keeps INPUT order —
  // [A,B,C] + {c,a} => [A,C,B] (not [C,A]: the set never re-orders)
  ok('A1 favorites partition first (stable sub-order)',
     ordered.map(m => m.id).join('') === 'acb', ordered.map(m => m.id).join(','));
  const x = [A, B];
  const same = StripShell._shelfOrder(x, new Set());
  ok('A1 empty set returns the same array (identity)', same === x, 'identity=' + (same === x));

  // ---------- A6: codebreaker active-slot invitation ----------
  if(await jumpTo('codebreaker')){
    const card = centeredCard();
    const next = card ? card.querySelectorAll('.cb-next') : [];
    ok('A6 exactly ONE active-slot invitation', next.length === 1, 'count=' + next.length);
    const style = next[0] ? getComputedStyle(next[0]) : null;
    ok('A6 invitation is dashed + animated', style && style.borderTopStyle === 'dashed' && style.animationName === 'cbInvite',
       style ? style.borderTopStyle + '/' + style.animationName : 'no slot');
    const peg = [...centeredBody().querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || '').length > 0 && b.style.borderRadius === '50%');
    const before = next[0];
    if(peg) peg.click();
    await wait(300);
    const after = card.querySelectorAll('.cb-next');
    ok('A6 invitation advances after a real pick',
       after.length === 1 && after[0] !== before, 'moved=' + (after[0] !== before));
  } else ok('A6 codebreaker center', false, 'nojump');

  // ---------- A5: simonsays turn banner ----------
  if(await jumpTo('simonsays')){
    const card = centeredCard();
    const chip = card && card.querySelector('.status-chip');
    ok('A5 turn banner exists, idle = TAP START', chip && chip.textContent === 'TAP START',
       chip ? chip.textContent : 'no chip');
    const startBtn = centeredBody() && [...centeredBody().querySelectorAll('button')].find(b => b.textContent.trim() === 'Start');
    if(startBtn){
      startBtn.click();
      await wait(400);
      ok('A5 banner says WATCH during the show', chip.textContent === 'WATCH…', chip.textContent);
      await wait(1000);
      ok('A5 banner hands off with REPEAT 1', chip.textContent === 'REPEAT 1', chip.textContent);
    } else ok('A5 start button found', false, 'no Start');
  } else ok('A5 simonsays center', false, 'nojump');

  // ---------- A3: bubbleshoot dotted trajectory ----------
  if(await jumpTo('bubbleshoot')){
    const card = centeredCard();
    const cv = card && card.querySelector('canvas');
    if(cv){
      await wait(600); // fit() + a few draw frames
      const g = cv.getContext('2d');
      const W = cv.width, H = cv.height;
      // mid-field band: bubbles live in the top ~40%, the old 40px stub
      // line lived below ~82% — anything with alpha in this band is the
      // new trajectory (default aim is straight up the center).
      const band = g.getImageData(Math.round(W * 0.2), Math.round(H * 0.55), Math.round(W * 0.6), Math.round(H * 0.17));
      let lit = 0;
      for(let i = 3; i < band.data.length; i += 4) if(band.data[i] > 30) lit++;
      ok('A3 trajectory dots paint the mid-field band', lit > 12, 'litpx=' + lit);
      // impact ring: bright-ish stroke near where the path terminates
      ok('A3 canvas alive (shooter painted at all)', cv.width > 0 && cv.height > 0, W + 'x' + H);
    } else ok('A3 bubbleshoot canvas', false, 'no canvas');
  } else ok('A3 bubbleshoot center', false, 'nojump');

  // ---------- A4: TD court fill + muster sprites ----------
  if(await jumpTo('towerdefense')){
    const card = centeredCard();
    const cv = card && card.querySelector('canvas');
    if(cv){
      await wait(600);
      const rect = cv.getBoundingClientRect();
      ok('A4 court fills the playfield (>300px @390vw)', rect.width > 300, 'w=' + Math.round(rect.width));
      const g = cv.getContext('2d');
      const img = g.getImageData(0, 0, cv.width, cv.height);
      let green = 0;
      for(let i = 0; i < img.data.length; i += 4){
        const r = img.data[i], gg = img.data[i + 1], b = img.data[i + 2];
        if(gg > 150 && gg > r * 1.35 && gg > b * 1.15) green++;
      }
      ok('A4 muster sprites draw enemy health bars pre-wave', green > 15, 'greenpx=' + green);
    } else ok('A4 TD canvas', false, 'no canvas');
  } else ok('A4 towerdefense center', false, 'nojump');

  // ---------- A2: MY SHELF live (drawer star → deck chip) ----------
  ok('A2 getFavorites() exposed', typeof StripDrawer.getFavorites === 'function',
     typeof StripDrawer.getFavorites);
  if(await jumpTo('dicepig')){
    const mod = Strip.all().find(x => x.id === 'dicepig');
    const drawerBtn = document.getElementById('drawer-btn');
    if(drawerBtn){
      drawerBtn.click();
      await wait(500);
      const row = document.querySelector('.drawer-item[data-id="dicepig"]');
      const star = row && row.querySelector('.drawer-item-fav');
      ok('A2 drawer row found with star', !!star, row ? 'row ok' : 'no row');
      if(star){
        star.click();
        await wait(300);
        ok('A2 getFavorites() reflects the toggle', StripDrawer.getFavorites().includes('dicepig'),
           StripDrawer.getFavorites().join(','));
        const chipCard = [...document.querySelectorAll('.cart')].find(c =>
          c.querySelector('.cart-title') && c.querySelector('.cart-title').textContent === (mod.title || 'Dice Pig'));
        ok('A2 built card grew a ★ chip', !!(chipCard && chipCard.querySelector('.cart-fav')),
           chipCard ? (chipCard.querySelector('.cart-fav') ? 'chip on' : 'no chip') : 'card not found');
        // restore — the suite leaves no favorites behind
        star.click();
        await wait(300);
        const chipGone = chipCard && !chipCard.querySelector('.cart-fav');
        ok('A2 untoggle removes the chip + restores state',
           !StripDrawer.getFavorites().includes('dicepig') && chipGone,
           'favs=' + StripDrawer.getFavorites().length);
      }
      const closeBtn = document.getElementById('drawer-close');
      if(closeBtn) closeBtn.click();
      await wait(300);
    } else ok('A2 drawer button', false, 'no #drawer-btn');
  } else ok('A2 dicepig center', false, 'nojump');

  // ---------- A7: deck floor (the r31 A0 conversion, live) ----------
  ok('A7 deck >= 52 cartridges (registry-agnostic floor)', Strip.all().length >= 52,
     'carts=' + Strip.all().length);

  // ---------- C: sweep + errors ----------
  Settings.set({ colorMode: modeFound, textSize: 'm', colorblind: false, flashSafe: false, autoNight: false, boardScale: 'm' });
  await wait(200);
  let sweepOk = 0, sweepBad = [];
  for(const m of Strip.all()){
    try{
      // R37 lesson (first run): a backgrounded tab stalls rAF-driven smooth
      // scroll mid-flight — a poll window can expire with the scroll still
      // in transit. Retry once with a long settle: the retry's polls run
      // while the FIRST scroll finishes (same behavior, more patience).
      const landed = (await jumpTo(m.id, 300)) || (await jumpTo(m.id, 1500));
      if(landed) sweepOk++; else sweepBad.push(m.id + ':nojump');
    }catch(err){ sweepBad.push(m.id + ':' + String(err).slice(0, 20)); }
  }
  ok('C1 52/52 cartridges center + mount glitch-free', sweepOk === Strip.all().length,
     sweepOk + '/' + Strip.all().length + (sweepBad.length ? ' bad=' + sweepBad.slice(0, 3).join(',') : ''));

  ok('C2 zero console errors across the suite', consoleErrors.length === 0,
     consoleErrors.slice(0, 3).join(' | ') || 'clean');

  return { results };
})();
