Strip.register({
  id: "whackmole",
  label: "REFLEX",
  title: "Whack-a-Mole",
  tag: "30s",
  hint: "Tap the moles before they duck",
  async mount(container, api){
    // lookups scoped to THIS card — duplicate ids across two copies of a
    // cartridge coexist briefly in the strip, and getElementById could
    // update the stale copy instead of the visible one
    const q = (sel) => container.querySelector(sel);
    let best = await api.getHighscore();
    const GRID = 3;
    const ROUND_MS = 30000;

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:14px;";

    // R36 — the stat row is SHELL-OWNED now (api.setStats): one slot between
    // title and playfield, one type scale, tabular nums, <=4 stats. The old
    // header's span ids live on as value keys so update sites stay one-liners.
    const statVals = {
      "wm-score": "0",
      "wm-time": "30",
      "wm-best": String(best),
    };
    const STAT_KEYS = [
      ["wm-score", "SCORE", "var(--amber)", null],
      ["wm-time", "TIME", "var(--purple)", null],
      ["wm-best", "BEST", "var(--ink)", null],
    ];
    function renderStats(){
      api.setStats(STAT_KEYS.map(([k, label, color, fixed]) => ({
        label,
        value: k ? statVals[k] : fixed,
        color,
      })));
    }
    renderStats();

    const board = document.createElement("div");
    // R34 contrast floor: the 3×3 lawn used to be naked holes floating on the
    // panel — dark-brown-on-dark in DARK, pure-black punch-outs in LIGHT. The
    // lawn gets a framed yard; the holes ride a mode-aware dirt token.
    board.style.cssText = `display:grid; grid-template-columns:repeat(${GRID},1fr); gap:10px; width:min(76vw,calc(272px * var(--board-scale,1))); background:var(--panel-2); border:1px solid var(--line); border-radius:14px; padding:14px;`;
    wrap.appendChild(board);

    const startBtn = document.createElement("button");
    startBtn.className = "btn accent";
    startBtn.textContent = "Start";
    wrap.appendChild(startBtn);

    container.appendChild(wrap);

    const holes = [];
    for(let i=0;i<GRID*GRID;i++){
      const hole = document.createElement("button");
      hole.style.cssText = `
        aspect-ratio:1; border-radius:50%; border:none; cursor:pointer;
        background:var(--screen-hole, #1a1510); box-shadow:inset 0 6px 12px rgba(0,0,0,.45), inset 0 0 0 1px rgba(255,255,255,.05);
        font-size:28px; display:flex; align-items:center; justify-content:center;
        overflow:hidden;
      `;
      board.appendChild(hole);
      holes.push(hole);
    }

    let score = 0, running = false, countdownTimer = null, topupTimer = null, timeLeft = 30, wave = 1;
    // Round 22 (P2 tail): multi-mole WAVES. The old board showed exactly one
    // mole forever — 20 seconds in, the game was a metronome. Now the round
    // escalates: wave 2 (0:20 left) puts TWO moles up at once, wave 3 (0:10
    // left) THREE, and every wave pops faster. Each mole hides on its own
    // clock; a top-up loop keeps the wave's density without clustering spawns.
    let active = new Map(); // holeIndex -> hide timeout id
    const molesForWave = (w) => Math.min(3, w);
    const upTimeFor = (w) => Math.max(430, 950 - (w - 1) * 130 - score * 4);

    let bannerEl = null; // Round 23: one banner slot — a second banner REPLACES
    let bannerTimer = null; // the first instead of stacking into unreadable overlap
    function waveBanner(text){
      wrap.style.position = "relative";
      if(!bannerEl){
        bannerEl = document.createElement("div");
        bannerEl.style.cssText = "position:absolute; left:50%; top:38%; transform:translate(-50%,-50%); font-family:var(--font-display); font-size:11px; color:var(--amber); background:rgba(10,10,16,.85); border:1px solid var(--amber-dim); border-radius:10px; padding:8px 12px; z-index:4; pointer-events:none; transition:opacity .18s;";
        wrap.appendChild(bannerEl);
      }
      clearTimeout(bannerTimer);
      bannerEl.style.opacity = "0";
      requestAnimationFrame(() => { if(bannerEl) bannerEl.style.opacity = "1"; });
      bannerEl.textContent = text;
      bannerTimer = setTimeout(() => { if(bannerEl) bannerEl.style.opacity = "0"; }, 1200);
    }

    function popMole(){
      if(!running) return;
      const free = holes.map((_, i) => i).filter(i => !active.has(i));
      if(!free.length) return;
      const i = free[Math.floor(Math.random() * free.length)];
      holes[i].textContent = "🐹";
      active.set(i, setTimeout(() => {
        holes[i].textContent = "";
        active.delete(i);
      }, upTimeFor(wave)));
    }

    function topUp(){
      if(!running) return;
      let guard = 6; // per-tick spawn cap: a wave flip never dumps 3 at once
      while(active.size < molesForWave(wave) && guard-- > 0) popMole();
    }

    function advanceWave(){
      if(wave < 3){
        wave++;
        waveBanner(`WAVE ${wave} — ${molesForWave(wave)} MOLES!`);
        try{ Feedback.buzz("success"); }catch(e){}
      }
    }

    holes.forEach((h, i) => {
      h.addEventListener("click", () => {
        if(!running || !active.has(i)) return;
        clearTimeout(active.get(i));
        active.delete(i);
        score++;
        statVals["wm-score"] = score; renderStats();
        h.textContent = "💥";
        setTimeout(() => { if(h.textContent === "💥") h.textContent = ""; }, 180);
        Feedback.haptic("light");
        Feedback.tone("pop");
      });
    });

    function tickCountdown(){
      timeLeft--;
      statVals["wm-time"] = timeLeft; renderStats();
      if(timeLeft === 20 || timeLeft === 10) advanceWave();
      if(timeLeft <= 0) endGame();
    }

    function endGame(){
      running = false;
      active.forEach(t => clearTimeout(t));
      active.clear();
      clearInterval(countdownTimer);
      clearInterval(topupTimer);
      holes.forEach(h => h.textContent = "");
      startBtn.className = "btn accent";
      startBtn.textContent = "Play again";
      startBtn.disabled = false;
      const prevBest = best;
api.gameover("over", score);
      api.setHighscore(score).then(v => {
        best = v;
        statVals["wm-best"] = best; renderStats();
      });
      // R35 ceremony adoption: the 30s round used to end in a stat-row
      // flicker — the standard panel carries the run out with the honest
      // delta and one verb back in.
      RunCeremony.show(container, {
        tone: "clear",
        label: "TIME UP",
        score: score,
        unit: "moles",
        delta: score > prevBest ? "NEW BEST" : (prevBest ? "BEST " + prevBest : ""),
        deltaTone: score > prevBest ? "good" : "",
        verb: "PLAY AGAIN",
        onVerb: start,
      });
    }

    function start(){
      RunCeremony.hide(container); // a restart never fights the flourish
      score = 0; timeLeft = 30; wave = 1; running = true;
      active.forEach(t => clearTimeout(t));
      active.clear();
      statVals["wm-score"] = 0; renderStats();
      statVals["wm-time"] = 30; renderStats();
      // R35 verb hierarchy: "Playing…" was a disabled accent control —
      // mid-round the slot is a status chip, not a fake button.
      startBtn.className = "status-chip";
      startBtn.disabled = true;
      startBtn.textContent = "ROUND LIVE";
      topUp();
      topupTimer = setInterval(topUp, 260);
      countdownTimer = setInterval(tickCountdown, 1000);
    }

    startBtn.addEventListener("click", start);

    return () => {
      active.forEach(t => clearTimeout(t));
      active.clear();
      clearInterval(countdownTimer);
      clearInterval(topupTimer);
    };
  }
});
