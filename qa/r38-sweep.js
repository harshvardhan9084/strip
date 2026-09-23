/**
 * qa/r38-sweep.js — Round 38 per-game runtime smoke: mount EVERY game,
 * poke it (pointer + arrows + enter/space), toggle LIGHT while mounted,
 * toggle back, and record every thrown error / rejection per game.
 * R37 lesson applied: run behind the cache-reload preamble (see
 * scripts/r38_sweep.sh) so the sweep never exercises stale bytes.
 *
 * Result lands on window.__sweep38 = { games:[{id, mounted, errs:[..]}], total }
 */
window.__sweep38 = (async () => {
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const errs = [];
  let onErr = null;
  const errHandler = (e) => { const m = (e && (e.message || e.type)) || String(e); if (onErr) onErr(m); };
  const rejHandler = (e) => { if (onErr) onErr('rej:' + String((e && e.reason) || e).slice(0, 90)); };
  window.addEventListener('error', errHandler);
  window.addEventListener('unhandledrejection', rejHandler);

  await (window.Settings ? Settings.whenReady() : Promise.resolve());
  await window.XP.whenReady();
  await window.Depth.whenReady();
  await window.Trophies.whenReady();
  await wait(800);
  if (!Settings.get().hintSeen) Settings.set({ hintSeen: true });
  Settings.set({ colorMode: 'dark', glow: 'full', reduceMotion: false, textSize: 'm', colorblind: false, flashSafe: false, autoNight: false, boardScale: 'm' });
  await wait(300);

  const stripEl = document.getElementById('strip');
  const games = Strip.all().map(m => m.id);
  const out = [];

  const poke = () => {
    const card = stripEl.children[Math.round(stripEl.scrollTop / (stripEl.clientHeight || 1))];
    const body = card && (card.querySelector('.cart-body') || card);
    if (!body) return;
    const r = body.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + Math.min(r.height / 2, Math.max(120, r.height / 2));
    const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, isPrimary: true };
    try {
      body.dispatchEvent(new PointerEvent('pointerdown', opts));
      body.dispatchEvent(new PointerEvent('pointerup', opts));
      body.dispatchEvent(new PointerEvent('pointercancel', opts));
    } catch (e) { /* headless pointer ctor gap — ignore */ }
    for (const k of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Enter', ' ']) {
      try { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); } catch (e) {}
    }
  };

  for (const id of games) {
    const rec = { id, mounted: false, errs: [] };
    onErr = (m) => { if (rec.errs.length < 8) rec.errs.push(String(m).slice(0, 110)); };
    try {
      const mod = Strip.all().find(x => x.id === id);
      if (!mod) { rec.errs.push('NOT-IN-REGISTRY'); out.push(rec); continue; }
      StripShell.jumpToModule(mod);
      for (let i = 0; i < 24; i++) {
        await wait(200);
        const c = StripShell._centeredMod && StripShell._centeredMod();
        if (c && c.id === id) { rec.mounted = true; break; }
      }
      await wait(900);          // settle: mount, first paint, any timers tick
      poke();
      await wait(500);
      Settings.set({ colorMode: 'light' });   // the R33 class: light re-grades
      await wait(700);
      poke();
      await wait(400);
      Settings.set({ colorMode: 'dark' });
      await wait(350);
    } catch (e) {
      rec.errs.push('sweep:' + String(e && e.message || e).slice(0, 90));
    }
    out.push(rec);
  }

  onErr = null;
  window.removeEventListener('error', errHandler);
  window.removeEventListener('unhandledrejection', rejHandler);
  try { window.scrollTo && 0; } catch (e) {}
  return { games: out, total: out.length };
})();
