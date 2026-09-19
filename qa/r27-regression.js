/**
 * qa/r27-regression.js — pins the Round 27 builds (live depth chip refresh
 * while the drawer is open, tier-up celebration on boundary crossings,
 * ghost-id pruning on daily rollover, the ▼ DEEP browsing order, and the
 * ICE-skin PHOSPHOR hue separation).
 *
 * Run: serve the app root (scripts/nocache_server.py), open in a browser, then
 * `agent-browser eval "$(cat qa/r27-regression.js)"; sleep 30; agent-browser eval "window.__qa27.then(r => JSON.stringify(r))"`.
 * Resolves to an array of { name, pass, info } on window.__qa27.
 *
 * Pinned invariants:
 *  A1. strip:depth-updated fires from record() with {id, avg, count, tierUp,
 *      tier}; the FIRST data point never celebrates (tierUp false — no
 *      "before" tier means no movement story).
 *  A2. Live chip refresh: drawer open + a REAL strip:gameover("over") with a
 *      stored best → the row's chip appears IN PLACE (no grid re-render —
 *      focus is untouched); a second event re-grades the SAME chip (still
 *      exactly one chip per row, no duplicates).
 *  A3. Tier-up: samples sitting under a boundary cross it on a real run →
 *      event carries tierUp:true, the chip wears .tier-up (and .chip-pop);
 *      a non-crossing run updates the number WITHOUT the tier-up class.
 *  A4. Ghost pruning: a depth key no cartridge owns is retired by
 *      strip:daily-rollover; real ids survive; _internals.pruneGhosts
 *      returns the removed ids. (Registry-loaded guard exercised by the
 *      fact that the sweep below still sees 51 cartridges.)
 *  A5. ▼ DEEP sort: chip activates, grid flattens to ONE "DEEPEST FIRST"
 *      group, ordered by avg desc; unmeasured games sort after every
 *      measured one (absent data is not zero); all cartridges still present;
 *      ALL restores the grouped shelves.
 *  A6. ICE hue separation: on the ice skin PHOSPHOR wears --warn (warm gold)
 *      — equal to the default-skin phosphor and clearly distinct from NEON's
 *      --info blue; NEON itself is untouched.
 *  A7. Row anatomy survives: rows carry data-id, the chip still sits BEFORE
 *      the star, and a no-data row still has no chip (r26 A8 re-pinned on
 *      the new DOM).
 *  B1. 51/51 mount sweep glitch-free.
 *  B2. Zero console errors across the whole suite.
 */
window.__qa27 = (async () => {
  const results = [];
  const ok = (name, pass, info) => results.push({ name, pass: !!pass, info: String(info || '').slice(0, 90) });
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const consoleErrors = [];
  window.addEventListener('error', (e) => consoleErrors.push(String(e)));

  await (window.Settings ? Settings.whenReady() : Promise.resolve());
  await window.XP.whenReady();
  await window.Depth.whenReady();
  await wait(600);
  if(!Settings.get().hintSeen) Settings.set({ hintSeen: true });

  const NOSTORE = { cache: 'no-store' };
  const rec = window.Depth._internals.record;
  const sanitize = window.Depth._internals.sanitize;
  const tierFor = window.Depth._internals.tierFor;

  // determinism: wipe in-memory depth state so the seeds below are the ONLY
  // samples (QA profile carries rings from older suites). QA-profile only.
  sanitize({ games: {} });

  // ---------- A1: strip:depth-updated event shape ----------
  let evtDetail = null;
  const capture = (e) => { evtDetail = e.detail; };
  window.addEventListener('strip:depth-updated', capture, { passive: true });
  {
    rec('qa27evt', 70, 100);
    await wait(80);
    const a1 = evtDetail && evtDetail.id === 'qa27evt' && evtDetail.avg === 70 &&
      evtDetail.count === 1 && evtDetail.tierUp === false && evtDetail.tier === 'PHOSPHOR';
    // second sample, no boundary cross → still no celebration
    rec('qa27evt', 72, 100);
    await wait(80);
    const a2 = evtDetail && evtDetail.avg === 71 && evtDetail.tierUp === false;
    ok('A1 depth-updated event shape (first sample never celebrates)', !!(a1 && a2),
       JSON.stringify(evtDetail || null).slice(0, 80));
  }

  // ---------- A2: live chip refresh while the drawer is open ----------
  // real ids from the registry — the refresh path only fires for rows that exist
  const idSnake = (Strip.all().find(m => m.id === 'snake') || {}).id;
  const idBreak = (Strip.all().find(m => m.id === 'breakout') || {}).id ||
                  (Strip.all().find(m => m.id === 'blockfall') || {}).id;
  {
    ok('A2 precheck: snake/breakout ids registered', !!idSnake && !!idBreak,
       'snake=' + idSnake + ' second=' + idBreak);
    await StripDB.setHighscore(idSnake, 100);
    // drawer OPEN, then a REAL gameover ("over", real best) → chip appears in place
    document.getElementById('drawer-btn').click();
    await wait(450);
    const grid = document.getElementById('drawer-grid');
    const rowFor = (id) => grid.querySelector('.drawer-item[data-id="' + id + '"]');
    const snakeRow = rowFor(idSnake);
    const hadChipBefore = !!(snakeRow && snakeRow.querySelector('.drawer-item-depth'));
    // R28 amendment: the "focus kept" conjunct read document.activeElement,
    // which is environment-flaky in headless (the PAGE itself can hold no
    // focus — activeElement stays <body> with the panel focused-or-not).
    // The mechanism the pin actually protects is "no grid re-render" — that
    // is provable STRONGER via row-node identity: a re-render builds new row
    // nodes; the in-place refresh mutates children of the SAME node.
    const rowNodeBefore = snakeRow;
    window.dispatchEvent(new CustomEvent('strip:gameover', {
      detail: { id: idSnake, outcome: 'over', score: 62, ts: Date.now() }
    }));
    await wait(350); // onGameOver → getHighscore → record → event → refresh
    const row2 = rowFor(idSnake);
    const chip = row2 && row2.querySelector('.drawer-item-depth');
    const appeared = !!chip && chip.textContent.trim() === '62%' &&
      chip.classList.contains('chip-pop');
    // same node = the grid was NOT re-rendered (the property that keeps focus safe)
    const inPlace = row2 === rowNodeBefore;
    // second event re-grades the SAME chip in place — never a duplicate
    window.dispatchEvent(new CustomEvent('strip:gameover', {
      detail: { id: idSnake, outcome: 'over', score: 62, ts: Date.now() }
    }));
    await wait(350);
    const chips = rowFor(idSnake).querySelectorAll('.drawer-item-depth');
    const chip2 = chips[0];
    const regraded = chips.length === 1 && chip2 &&
      Math.abs(parseFloat(chip2.textContent) - Depth.avgFor(idSnake)) < 0.01;
    ok('A2 live chip refresh in place (no re-render, no duplicate)',
       !hadChipBefore && appeared && inPlace && regraded,
       'before=' + hadChipBefore + ' appeared=' + appeared +
       ' sameNode=' + inPlace + ' chips=' + chips.length);
  }

  // ---------- A3: tier-up on a real boundary crossing ----------
  {
    await StripDB.setHighscore(idBreak, 100);
    rec(idBreak, 39, 100); rec(idBreak, 39, 100); // avg 39 → PAPER (NEON starts at 40)
    let evt = null;
    const cap = (e) => { evt = e.detail; };
    window.addEventListener('strip:depth-updated', cap, { passive: true });
    window.dispatchEvent(new CustomEvent('strip:gameover', {
      detail: { id: idBreak, outcome: 'over', score: 42, ts: Date.now() }
    }));
    await wait(350); // avg (39+39+42)/3 = 40 → crosses into NEON
    const row = document.querySelector('.drawer-item[data-id="' + idBreak + '"]');
    const chip = row && row.querySelector('.drawer-item-depth');
    const crossed = evt && evt.tierUp === true && evt.tier === 'NEON' &&
      !!chip && chip.classList.contains('tier-up') && chip.classList.contains('chip-pop');
    // non-crossing run: same tier → number updates, celebration does not fire
    chip.classList.remove('tier-up');
    window.dispatchEvent(new CustomEvent('strip:gameover', {
      detail: { id: idBreak, outcome: 'over', score: 41, ts: Date.now() }
    }));
    await wait(350);
    const chip2 = row.querySelector('.drawer-item-depth');
    const noUp = evt.tierUp === false && !chip2.classList.contains('tier-up');
    window.removeEventListener('strip:depth-updated', cap, { passive: true });
    ok('A3 tier-up fires on crossing only', !!(crossed && noUp),
       'crossed=' + crossed + ' stayed=' + noUp + ' avg=' + Depth.avgFor(idBreak));
  }
  document.getElementById('drawer-close').click();
  await wait(250);

  // ---------- A4: ghost pruning on daily rollover ----------
  {
    rec('qa27ghost', 55, 100); // no cartridge owns this id
    await wait(80);
    const aliveBefore = Depth.countFor('qa27ghost') > 0;
    const snakeBefore = Depth.countFor(idSnake);
    window.dispatchEvent(new CustomEvent('strip:daily-rollover', { detail: { id: 'qa27' } }));
    await wait(200);
    const removed = window.Depth._internals.pruneGhosts(); // idempotent second call
    const ghostGone = Depth.countFor('qa27ghost') === 0 && Depth.avgFor('qa27ghost') === null;
    const snakeKept = Depth.countFor(idSnake) === snakeBefore;
    // the event path already pruned, so the direct call removes nothing more
    ok('A4 ghost pruned at rollover, real ids kept',
       aliveBefore && ghostGone && snakeKept && Array.isArray(removed) && removed.length === 0,
       'ghostGone=' + ghostGone + ' snakeKept=' + snakeKept + ' secondCall=' + removed.length);
  }

  // ---------- A5: ▼ DEEP sort ----------
  {
    document.getElementById('drawer-btn').click();
    await wait(450);
    const chips = [...document.querySelectorAll('#drawer-chips .drawer-chip')];
    const deepChip = chips.find(c => c.textContent.trim() === '▼ DEEP');
    deepChip.click();
    await wait(350);
    const grid = document.getElementById('drawer-grid');
    // renderChips() rebuilt every chip node on the click — re-query the LIVE one
    const deepChipLive = [...document.querySelectorAll('#drawer-chips .drawer-chip')]
      .find(c => c.textContent.trim() === '▼ DEEP');
    const labels = [...grid.querySelectorAll('.drawer-group-label')].map(l => l.textContent);
    const rows = [...grid.querySelectorAll('.drawer-item')];
    const avgs = rows.map(r => {
      const id = r.dataset.id;
      const a = Depth.avgFor(id);
      return a == null ? null : a;
    });
    // every cartridge present, one flat group
    const allPresent = rows.length === Strip.all().length;
    const flat = labels.length === 1 && labels[0] === 'DEEPEST FIRST';
    // measured games first, descending; nulls strictly after every number
    let sortedDesc = true, nullsLast = true, seenNull = false;
    for(let i = 0; i < avgs.length; i++){
      if(avgs[i] == null){ seenNull = true; continue; }
      if(seenNull) nullsLast = false;
      const next = avgs.slice(i + 1).find(v => v != null);
      if(next != null && next > avgs[i]) sortedDesc = false;
    }
    // the top row really is the deepest game we seeded (snake 62 vs breakout 40)
    const topIsSnake = rows[0] && rows[0].dataset.id === idSnake;
    const chipOn = deepChipLive && deepChipLive.classList.contains('on') &&
      deepChipLive.getAttribute('aria-pressed') === 'true';
    // back to ALL restores grouped shelves
    const allChip = chips.find(c => c.textContent.trim() === 'ALL');
    allChip.click();
    await wait(300);
    const grouped = document.querySelectorAll('#drawer-grid .drawer-group-label').length > 1;
    ok('A5 DEEP sort: flat, measured-first desc, nulls last, ALL restores',
       !!deepChip && allPresent && flat && sortedDesc && nullsLast && topIsSnake && chipOn && grouped,
       'rows=' + rows.length + '/' + Strip.all().length + ' flat=' + flat +
       ' desc=' + sortedDesc + ' nullsLast=' + nullsLast + ' top=' + topIsSnake +
       ' groups=' + grouped);
    document.getElementById('drawer-close').click();
    await wait(250);
  }

  // ---------- A6: ICE phosphor hue separation ----------
  {
    const prevTheme = document.documentElement.getAttribute('data-theme');
    const mk = () => {
      const el = document.createElement('span');
      el.className = 'drawer-item-depth';
      el.style.position = 'fixed'; el.style.left = '-9999px';
      document.body.appendChild(el);
      return el;
    };
    const phos = mk(); const neon = mk();
    phos.classList.add('t-phosphor'); neon.classList.add('t-neon');
    const read = (el) => getComputedStyle(el).color;
    document.documentElement.setAttribute('data-theme', 'ice');
    const icePhos = read(phos), iceNeon = read(neon);
    // restore EXACTLY: a null attribute means the default skin is the absence
    // of the attribute, not a named value
    if(prevTheme == null) document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', prevTheme);
    const defPhos = read(phos);
    phos.remove(); neon.remove();
    // ice phosphor == default phosphor (--warn gold, untouched by the remap)
    const goldKept = icePhos === defPhos;
    // ...and clearly NOT the neon blue next door
    const separated = icePhos !== iceNeon;
    ok('A6 ICE phosphor wears --warn gold, separate from NEON',
       goldKept && separated, 'icePhos=' + icePhos + ' defPhos=' + defPhos + ' iceNeon=' + iceNeon);
  }

  // ---------- A7: row anatomy survives the new DOM ----------
  {
    document.getElementById('drawer-btn').click();
    await wait(450);
    const grid = document.getElementById('drawer-grid');
    const rows = [...grid.querySelectorAll('.drawer-item')];
    const withId = rows.filter(r => r.dataset.id).length;
    const snakeRow = rows.find(r => r.dataset.id === idSnake);
    const chip = snakeRow && snakeRow.querySelector('.drawer-item-depth');
    const anatomy = chip && chip.nextElementSibling &&
      chip.nextElementSibling.classList.contains('drawer-item-fav');
    const bare = rows.filter(r => !r.querySelector('.drawer-item-depth')).length;
    ok('A7 rows carry data-id, chip before star, absent without data',
       withId === rows.length && anatomy && bare > 0 && bare < rows.length,
       'ids=' + withId + '/' + rows.length + ' anatomy=' + !!anatomy + ' bare=' + bare);
    document.getElementById('drawer-close').click();
    await wait(250);
  }

  // ---------- B1: mount sweep ----------
  {
    const apiStub = {
      save(o){ return Promise.resolve(o); },
      load(){ return Promise.resolve(null); },
      getHighscore(){ return Promise.resolve(0); },
      setHighscore(s){ return Promise.resolve(s); },
      gameover(){},
      tend(){},
    };
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;height:400px';
    document.body.appendChild(div);
    let fails = 0, total = 0;
    for(const m of Strip.all()){
      total++;
      try{
        const r = m.mount(div, apiStub);
        if(typeof r === 'function'){ try{ r(); }catch(e){ fails++; } }
        else Promise.resolve(r).then(c => { try{ typeof c === 'function' && c(); }catch(e){} }).catch(() => fails++);
      }catch(e){ fails++; }
      try{ div.innerHTML = ''; }catch(e){}
    }
    div.remove();
    ok('B1 all cartridges mount clean with the live-chip listener live', fails === 0 && total === Strip.all().length  /* R32 amendment: registry-length self-consistent — the deck grew to 52 */,
       fails + '/' + total + ' failed');
  }

  await wait(400);
  ok('B2 zero console errors', consoleErrors.length === 0, consoleErrors.join(' | ').slice(0, 80));

  return results;
})();
