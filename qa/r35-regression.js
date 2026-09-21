/**
 * qa/r35-regression.js — pins the Round 35 build ("The One Anatomy — P1/P2
 * wave"), the second implementation wave off auuudit.md.
 *
 * IMPORTANT (determinism): run on a FRESH SESSION — wipe + reload first:
 *   agent-browser eval "indexedDB.deleteDatabase('strip-db'); localStorage.clear(); 'wiped'"
 *   agent-browser open "http://<host>:<port>/"; sleep 3;
 *   agent-browser eval "$(cat qa/r35-regression.js)"; sleep 30;
 *   agent-browser eval "window.__qa35.then(r => JSON.stringify(r))"
 *
 * Pinned invariants:
 *  A1. SETTINGS SHEET: the audit's 5-group regroup (PLAY/SCREEN/ACCESS/
 *      SESSION/YOUR DATA) with the four new controls present and the
 *      install button living in YOUR DATA.
 *  A2. TEXT SIZE: real S/M/L roundtrip on a mounted card's inline stat row
 *      (10 → 12 → 9 → restore 10); html[data-text-size] follows; the pass
 *      is base-pinned (data-fs0) so round-trips are exact.
 *  A3. COLORBLIND SYMBOLS: html.cb-symbols flips live; simon pads stamp
 *      ▲●■◆; a real dropfour drop leaves the player's ▲ on the disc;
 *      chainlink dots carry a symbol each.
 *  A4. FLASH REDUCTION: --glow-mul collapses to .18 under flash-safe and
 *      restores when off (the photosensitivity tier is real).
 *  A5. AUTO NIGHT: enabling applies the hour bucket (dark 19–07 / light
 *      07–19) and stays on; a manual scheme pick STANDS DOWN the clock.
 *  A6. CEREMONY ADOPTION (real plays): simonsays death → SEQUENCE BROKEN;
 *      typespeed completion → TYPED (wpm); flapdot death → DOWN/bars with
 *      FLY AGAIN restarting; balloonpop End round → TIME UP/PLAY AGAIN.
 *  A7. VERB HIERARCHY: blackjack bet phase shows ONLY Deal, play phase
 *      swaps to Hit/Stand/Double; breakout Start becomes a .status-chip
 *      ("BALL n"); whackmole Start becomes "ROUND LIVE"; unscramble Skip
 *      is demoted (no purple accent); TD's wave button stays accent.
 *  A8. DENSITY: blackjack felt carries the face-down shoe; aquarium tank
 *      fills the playfield (flex-grow 1) and fish doubled (≥ 21px);
 *      balloonpop pops burst with a score float; bombs pulse (bp-bomb).
 *  A9. SINGLE-HINT RULE: dicepig's log narrates state ("Turn 1 of 5 —
 *      roll."); blobmerge's goal is one glanceable line; anthill's vault
 *      carries no duplicated instruction; aquarium's idle status is quiet.
 *  C1. 52/52 mount sweep glitch-free.
 *  C2. Zero console errors across the whole suite.
 */
window.__qa35 = (async () => {
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
  Settings.set({ colorMode: 'dark', glow: 'full', reduceMotion: false, textSize: 'm', colorblind: false, flashSafe: false, autoNight: false });
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
    return StripShell._centeredMod().id === id;
  }
  const clickBtn = (body, name) => {
    const b = [...body.querySelectorAll('button')].find(x => x.textContent.trim() === name);
    if(b) b.click();
    return !!b;
  };
  const cardBody = (titleNeedle) => {
    const c = [...stripEl.children].find(x => x.textContent.includes(titleNeedle));
    return c ? c.querySelector('.cart-body') : null;
  };

  // ---------- A1: settings sheet structure ----------
  {
    const labels = [...document.querySelectorAll('.settings-section-label')].map(e => e.textContent.trim());
    const a1a = labels.join(',') === 'PLAY,SCREEN,ACCESS,SESSION,YOUR DATA';
    const a1b = document.querySelectorAll('.tsize-seg-btn').length === 3;
    const a1c = !!document.querySelector('[data-key="autoNight"]')
      && !!document.querySelector('[data-key="colorblind"]')
      && !!document.querySelector('[data-key="flashSafe"]');
    const install = document.getElementById('install-setting-btn');
    const dataLabel = [...document.querySelectorAll('.settings-section-label')].find(e => e.textContent === 'YOUR DATA');
    const a1d = !!install && !!dataLabel
      && !!(function walk(n){ for(const c of n.children){ if(c === install) return true; if(walk(c)) return true; } return false; })(dataLabel.parentElement);
    ok('A1a sheet regrouped to PLAY/SCREEN/ACCESS/SESSION/DATA', a1a, labels.join(','));
    ok('A1b text-size S/M/L segment present', a1b, 'segs=' + document.querySelectorAll('.tsize-seg-btn').length);
    ok('A1c autoNight + colorblind + flashSafe controls exist', a1c, '');
    ok('A1d install button lives in YOUR DATA', a1d, '');
  }

  // ---------- A2: text size roundtrip ----------
  // R36 amendment: whackmole's inline stat row moved into the shell slot;
  // the inline-pass roundtrip probes codebreaker's inline 10px reveal line
  ok('A2-pre jump codebreaker', await jumpTo('codebreaker'), StripShell._centeredMod().id);
  {
    const body = centeredBody();
    const probe = () => {
      const el = [...body.querySelectorAll('[style*="font-size"]')].find(e => parseFloat(e.style.fontSize) === 10);
      return el || [...body.querySelectorAll('[style*="font-size"]')][0];
    };
    const el0 = probe();
    const base = el0 ? parseFloat(el0.style.fontSize) : NaN;
    Settings.set({ textSize: 'l' });
    await wait(120);
    const afterL = parseFloat(el0 && el0.style.fontSize);
    Settings.set({ textSize: 's' });
    await wait(120);
    const afterS = parseFloat(el0 && el0.style.fontSize);
    Settings.set({ textSize: 'm' });
    await wait(120);
    const restored = parseFloat(el0 && el0.style.fontSize);
    ok('A2 text size L/S/M roundtrip on inline stat rows (base-pinned)',
       base === 10 && afterL === 12 && afterS === 9 && restored === 10
       && document.documentElement.dataset.textSize === 'm',
       'base=' + base + ' L=' + afterL + ' S=' + afterS + ' M=' + restored);
  }

  // ---------- A3: colorblind symbols ----------
  ok('A3-pre jump simonsays', await jumpTo('simonsays'), StripShell._centeredMod().id);
  {
    Settings.set({ colorblind: true });
    await wait(120);
    const pad = document.querySelector('.simon-pad[data-cb]');
    const a3a = document.documentElement.classList.contains('cb-symbols') && !!pad && pad.dataset.cb === '▲';
    ok('A3a simon pads stamp ▲●■◆ under cb-symbols', a3a,
       pad ? 'first=' + pad.dataset.cb : 'no pad');
    ok('A3b-pre jump dropfour', await jumpTo('dropfour'), StripShell._centeredMod().id);
    const body = centeredBody();
    const cell = [...body.querySelectorAll('[style*="aspect-ratio"]')][0];
    if(cell) cell.click();
    await wait(600);
    const disc = body.querySelector('[data-cb="▲"]');
    ok('A3b real dropfour drop leaves the player ▲', !!disc, disc ? 'disc ok' : 'no disc');
    ok('A3c-pre jump chainlink', await jumpTo('chainlink'), StripShell._centeredMod().id);
    const cbDots = document.querySelectorAll('[data-cb]');
    ok('A3c chainlink dots carry symbols', cbDots.length >= 4, 'stamped=' + cbDots.length);
    Settings.set({ colorblind: false });
    await wait(120);
    ok('A3d toggle-off removes the class live', !document.documentElement.classList.contains('cb-symbols'), '');
  }

  // ---------- A4: flash reduction ----------
  {
    const mulOff = getComputedStyle(document.documentElement).getPropertyValue('--glow-mul').trim();
    Settings.set({ flashSafe: true });
    await wait(120);
    const mulSafe = getComputedStyle(document.documentElement).getPropertyValue('--glow-mul').trim();
    Settings.set({ flashSafe: false });
    await wait(120);
    const mulBack = getComputedStyle(document.documentElement).getPropertyValue('--glow-mul').trim();
    ok('A4 flash-safe caps bloom to .18 and restores', mulOff === '1' && mulSafe === '.18' && mulBack === '1',
       'off=' + mulOff + ' safe=' + mulSafe + ' back=' + mulBack);
  }

  // ---------- A5: auto night chassis ----------
  {
    const hour = new Date().getHours();
    const want = (hour >= 19 || hour < 7) ? 'dark' : 'light';
    Settings.set({ colorMode: 'dark', autoNight: true });
    await wait(250);
    const applied = Settings.get().colorMode;
    const kept = Settings.get().autoNight === true;
    // a manual pick stands the clock down
    Settings.set({ colorMode: 'light', autoNight: false });
    await wait(150);
    const manualPickKills = Settings.get().autoNight === false && document.documentElement.dataset.mode === 'light';
    ok('A5 auto night applies the hour bucket (' + hour + 'h → ' + want + ') and a manual pick stands it down',
       applied === want && kept && manualPickKills,
       'applied=' + applied + ' kept=' + kept + ' manualKill=' + manualPickKills);
    Settings.set({ colorMode: 'dark' });
    await wait(150);
  }

  // ---------- A6: ceremony adoption (real plays) ----------
  ok('A6a-pre jump simonsays', await jumpTo('simonsays'), StripShell._centeredMod().id);
  {
    const body = centeredBody();
    clickBtn(body, 'Start');
    await wait(2700); // watch round 1
    // a wrong tap kills; a RIGHT tap grows the sequence and plays it back —
    // so keep tapping (one pad per playback window) until the miss lands.
    // P(die within k rounds) = 1 − (1/4)^k → bounded at 10 windows.
    let rc = null;
    for(let i = 0; i < 10 && !rc; i++){
      const pads = [...body.querySelectorAll('.simon-pad')];
      if(pads[i % 4]) pads[i % 4].click();
      await wait(2650);
      rc = body.querySelector(':scope > .run-ceremony');
    }
    ok('A6a simonsays death → SEQUENCE BROKEN panel',
       !!rc && rc.querySelector('.rc-label').textContent === 'SEQUENCE BROKEN'
       && rc.querySelector('.rc-verb').textContent === 'TRY AGAIN',
       rc ? rc.querySelector('.rc-label').textContent : 'no panel');
    if(rc) clickBtn(body, 'TRY AGAIN');
    await wait(300);
  }
  ok('A6b-pre jump typespeed', await jumpTo('typespeed'), StripShell._centeredMod().id);
  {
    const body = centeredBody();
    await wait(300);
    const box = [...body.querySelectorAll('div')].find(d => d.style.minHeight === '60px');
    const phrase = box ? [...box.querySelectorAll('span')].map(s => s.textContent).join('') : '';
    const input = body.querySelector('input[type="text"]');
    if(phrase && input){
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, phrase);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(500);
    }
    const rc = body.querySelector(':scope > .run-ceremony');
    ok('A6b typespeed completion → TYPED panel (wpm unit)',
       !!rc && rc.querySelector('.rc-label').textContent === 'TYPED'
       && rc.querySelector('.rc-unit').textContent === 'wpm',
       rc ? rc.querySelector('.rc-label').textContent + '/' + rc.querySelector('.rc-score').textContent : 'no panel (phrase=' + phrase.length + ')');
    if(rc) clickBtn(body, 'NEW PHRASE');
  }
  ok('A6c-pre jump flapdot', await jumpTo('flapdot'), StripShell._centeredMod().id);
  {
    const body = centeredBody();
    const canvas = body.querySelector('canvas');
    canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await wait(2600); // one flap, then gravity wins
    const rc = body.querySelector(':scope > .run-ceremony');
    const a6c = !!rc && rc.querySelector('.rc-label').textContent === 'DOWN'
      && rc.querySelector('.rc-unit').textContent === 'bars'
      && rc.querySelector('.rc-verb').textContent === 'FLY AGAIN';
    if(rc) rc.querySelector('.rc-verb').click();
    await wait(500); // the retire fade removes the node at 260ms — wait past it
    ok('A6c flapdot death → DOWN panel; FLY AGAIN retires it', a6c && !body.querySelector(':scope > .run-ceremony'),
       rc ? 'panel ok' : 'no panel');
  }
  ok('A6d-pre jump balloonpop', await jumpTo('balloonpop'), StripShell._centeredMod().id);
  {
    const body = centeredBody();
    clickBtn(body, 'Start');
    await wait(300);
    clickBtn(body, 'End round'); // the honest early exit IS a run end
    await wait(400);
    const rc = body.querySelector(':scope > .run-ceremony');
    ok('A6d balloonpop end-of-round → TIME UP panel + PLAY AGAIN',
       !!rc && rc.querySelector('.rc-label').textContent === 'TIME UP'
       && rc.querySelector('.rc-verb').textContent === 'PLAY AGAIN',
       rc ? rc.querySelector('.rc-label').textContent : 'no panel');
    if(rc) clickBtn(body, 'PLAY AGAIN');
  }

  // ---------- A7: verb hierarchy ----------
  ok('A7a-pre jump blackjack', await jumpTo('blackjack'), StripShell._centeredMod().id);
  {
    const body = centeredBody();
    await wait(300);
    const verbRow = () => [...body.querySelectorAll('button')]
      .filter(b => ['Deal', 'Hit', 'Stand', 'Double'].includes(b.textContent.trim()))
      .filter(b => b.style.display !== 'none')
      .map(b => b.textContent.trim());
    const bet = verbRow().join(',');
    const chip = [...body.querySelectorAll('button')].find(b => b.textContent.startsWith('+'));
    if(chip) chip.click();
    clickBtn(body, 'Deal');
    await wait(500);
    const play = verbRow().join(',');
    ok('A7a blackjack: bet phase = Deal only; play phase = Hit/Stand/Double',
       bet === 'Deal' && play === 'Hit,Stand,Double', 'bet=[' + bet + '] play=[' + play + ']');
    const shoe = body.querySelector('[aria-hidden="true"]');
    ok('A8a blackjack felt carries the face-down shoe', !!shoe && shoe.children.length === 3,
       shoe ? 'layers=' + shoe.children.length : 'no shoe');
  }
  ok('A7b-pre jump breakout', await jumpTo('breakout'), StripShell._centeredMod().id);
  {
    const body = centeredBody();
    clickBtn(body, 'Start');
    await wait(400);
    const chip = body.querySelector('.status-chip');
    ok('A7b breakout mid-run slot is a status chip (BALL n)',
       !!chip && /^BALL \d+$/.test(chip.textContent), chip ? chip.textContent : 'no chip');
  }
  ok('A7c-pre jump whackmole', await jumpTo('whackmole'), StripShell._centeredMod().id);
  {
    const body = centeredBody();
    clickBtn(body, 'Start');
    await wait(300);
    const chip = body.querySelector('.status-chip');
    ok('A7c whackmole mid-round slot is a status chip (ROUND LIVE)',
       !!chip && chip.textContent === 'ROUND LIVE', chip ? chip.textContent : 'no chip');
  }
  ok('A7d-pre jump unscramble', await jumpTo('unscramble'), StripShell._centeredMod().id);
  {
    const body = centeredBody();
    await wait(300);
    const skip = [...body.querySelectorAll('button')].find(b => b.textContent.trim() === 'Skip');
    const demoted = !!skip && !skip.classList.contains('purple') && getComputedStyle(skip).borderColor !== getComputedStyle(document.documentElement).getPropertyValue('--purple').trim();
    ok('A7d unscramble Skip demoted from the purple accent', demoted,
       skip ? skip.className || 'plain btn' : 'no skip');
  }
  ok('A7e-pre jump towerdefense', await jumpTo('towerdefense'), StripShell._centeredMod().id);
  {
    const body = centeredBody();
    await wait(300);
    const wave = [...body.querySelectorAll('button')].find(b => b.textContent.includes('Start wave'));
    ok('A7e TD Start wave keeps the accent verb', !!wave && wave.classList.contains('accent'), wave ? wave.className : 'no btn');
  }

  // ---------- A8: density ----------
  ok('A8b-pre jump aquarium', await jumpTo('aquarium'), StripShell._centeredMod().id);
  {
    const body = centeredBody();
    // the browser normalizes inline colors (hsl → rgb) and re-serializes
    // cssText with spaces — match on style PROPERTIES, not attribute text
    const tank = [...body.querySelectorAll('div')].find(d => d.style.flex === '1' || d.style.flexGrow === '1');
    const grow = tank ? getComputedStyle(tank).flexGrow : '0';
    const fish = [...body.querySelectorAll('.fish')];
    const w = fish.length ? parseFloat(fish[0].style.width) : 0;
    ok('A8b aquarium tank fills the playfield + fish doubled',
       parseFloat(grow) === 1 && w >= 21, 'flexGrow=' + grow + ' fishW=' + w + 'px fishN=' + fish.length);
  }
  ok('A8c-pre jump balloonpop', await jumpTo('balloonpop'), StripShell._centeredMod().id);
  {
    const body = centeredBody();
    clickBtn(body, 'Play again') || clickBtn(body, 'Start');
    // wait for a bomb to pulse (18% spawn rate — bounded poll)
    let sawBomb = false, popped = false;
    const field = [...body.querySelectorAll('div')].find(d => d.style.overflow === 'hidden' && d.style.position === 'relative');
    for(let i = 0; i < 24 && !(sawBomb && popped); i++){
      await wait(400);
      if(!field) break;
      const bombs = [...field.children].filter(e => e.classList.contains('bp-bomb'));
      if(bombs.length) sawBomb = true;
      const balloons = [...field.children].filter(e => !e.classList.contains('bp-bomb') && e.style.transition);
      if(!popped && balloons.length){
        const before = body.querySelector('#bp-score') ? body.querySelector('#bp-score').textContent : '';
        balloons[0].click();
        await wait(160);
        const float = [...field.children].some(e => e.textContent === '+1');
        const after = body.querySelector('#bp-score') ? body.querySelector('#bp-score').textContent : '';
        popped = float || (before !== after);
      }
    }
    ok('A8c balloonpop: bombs pulse a fuse; pops leave a +1 float', sawBomb && popped,
       'bomb=' + sawBomb + ' pop=' + popped);
  }

  // ---------- A9: single-hint rule ----------
  ok('A9a-pre jump dicepig', await jumpTo('dicepig'), StripShell._centeredMod().id);
  {
    const body = centeredBody();
    await wait(300);
    const log = body.querySelector('#dp-log');
    ok('A9a dicepig log narrates state (no restated rules)',
       !!log && log.textContent === 'Turn 1 of 5 — roll.', log ? log.textContent : 'no log');
  }
  ok('A9b-pre jump blobmerge', await jumpTo('blobmerge'), StripShell._centeredMod().id);
  {
    const body = centeredBody();
    await wait(300);
    const note = body.querySelector('#bm-note');
    ok('A9b blobmerge goal compressed to one glanceable line',
       !!note && note.textContent.startsWith('GOAL blob 8') && note.textContent.length <= 46,
       note ? '"' + note.textContent + '"' : 'no note');
  }
  ok('A9c-pre jump anthill', await jumpTo('anthill'), StripShell._centeredMod().id);
  {
    const body = centeredBody();
    await wait(300);
    ok('A9c anthill vault carries no duplicated instruction',
       !body.textContent.includes('Tap to collect into Food'), '');
  }
  ok('A9d-pre jump aquarium', await jumpTo('aquarium'), StripShell._centeredMod().id);
  {
    const body = centeredBody();
    await wait(300);
    const feedHint = [...body.querySelectorAll('div')].find(d => d.style.minHeight === '15px');
    // POSITIVE pin: the status element exists, and while food is in stock
    // and no fish is armed it stays EMPTY — the shell hint owns the how-to
    ok('A9d aquarium idle status stays quiet (shell hint owns the how-to)',
       !!feedHint && feedHint.textContent === '' && !body.textContent.includes('Tap the tank to feed · tap a fish twice'),
       feedHint ? 'idle="' + feedHint.textContent + '"' : 'no status el');
  }

  // ---------- C: sweep + errors ----------
  Settings.set({ colorMode: modeFound, textSize: 'm', colorblind: false, flashSafe: false, autoNight: false });
  await wait(200);
  let sweepOk = 0, sweepBad = [];
  for(const m of Strip.all()){
    try{
      const landed = await jumpTo(m.id, 300);
      if(landed) sweepOk++; else sweepBad.push(m.id + ':nojump');
    }catch(err){ sweepBad.push(m.id + ':' + String(err).slice(0, 20)); }
  }
  ok('C1 52/52 cartridges center + mount glitch-free', sweepOk === Strip.all().length,
     sweepOk + '/' + Strip.all().length + (sweepBad.length ? ' bad=' + sweepBad.slice(0, 3).join(',') : ''));

  ok('C2 zero console errors across the suite', consoleErrors.length === 0,
     consoleErrors.slice(0, 3).join(' | ') || 'clean');

  return { results };
})();
