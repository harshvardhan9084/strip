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

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:20px; font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    statRow.innerHTML = `<div>SCORE <span id="wm-score" style="color:var(--amber)">0</span></div><div>TIME <span id="wm-time" style="color:var(--purple)">30</span></div><div>BEST <span id="wm-best" style="color:var(--ink)">${best}</span></div>`;
    wrap.appendChild(statRow);

    const board = document.createElement("div");
    board.style.cssText = `display:grid; grid-template-columns:repeat(${GRID},1fr); gap:10px; width:min(70vw,240px);`;
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
        background:#1a1510; box-shadow:inset 0 6px 12px rgba(0,0,0,.6);
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

    function waveBanner(text){
      const b = document.createElement("div");
      b.textContent = text;
      b.style.cssText = "position:absolute; left:50%; top:38%; transform:translate(-50%,-50%); font-family:var(--font-display); font-size:11px; color:var(--amber); background:rgba(10,10,16,.85); border:1px solid var(--amber-dim); border-radius:10px; padding:8px 12px; z-index:4; pointer-events:none;";
      wrap.style.position = "relative";
      wrap.appendChild(b);
      setTimeout(() => b.remove(), 1200);
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
        q("#wm-score").textContent = score;
        h.textContent = "💥";
        setTimeout(() => { if(h.textContent === "💥") h.textContent = ""; }, 180);
        Feedback.haptic("light");
        Feedback.tone("pop");
      });
    });

    function tickCountdown(){
      timeLeft--;
      q("#wm-time").textContent = timeLeft;
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
      startBtn.textContent = "Play again";
      startBtn.disabled = false;
      api.setHighscore(score).then(v => {
        best = v;
        q("#wm-best").textContent = best;
      });
    }

    function start(){
      score = 0; timeLeft = 30; wave = 1; running = true;
      active.forEach(t => clearTimeout(t));
      active.clear();
      q("#wm-score").textContent = 0;
      q("#wm-time").textContent = 30;
      startBtn.disabled = true;
      startBtn.textContent = "Playing…";
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
