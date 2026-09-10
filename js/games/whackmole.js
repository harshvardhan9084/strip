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

    let score = 0, running = false, spawnTimer = null, countdownTimer = null, timeLeft = 30;
    let activeHole = -1;

    function popRandom(){
      holes.forEach(h => h.textContent = "");
      activeHole = Math.floor(Math.random() * holes.length);
      holes[activeHole].textContent = "🐹";
      const upTime = Math.max(450, 950 - score * 15); // gets faster as score climbs
      spawnTimer = setTimeout(() => {
        if(holes[activeHole]) holes[activeHole].textContent = "";
        if(running) popRandom();
      }, upTime);
    }

    holes.forEach((h, i) => {
      h.addEventListener("click", () => {
        if(!running || i !== activeHole) return;
        score++;
        q("#wm-score").textContent = score;
        h.textContent = "";
        clearTimeout(spawnTimer);
        popRandom();
        Feedback.haptic("light");
        Feedback.tone("pop");
      });
    });

    function tickCountdown(){
      timeLeft--;
      q("#wm-time").textContent = timeLeft;
      if(timeLeft <= 0) endGame();
    }

    function endGame(){
      running = false;
      clearTimeout(spawnTimer);
      clearInterval(countdownTimer);
      holes.forEach(h => h.textContent = "");
      startBtn.textContent = "Play again";
      startBtn.disabled = false;
      api.setHighscore(score).then(v => {
        best = v;
        q("#wm-best").textContent = best;
      });
    }

    function start(){
      score = 0; timeLeft = 30; running = true;
      q("#wm-score").textContent = 0;
      q("#wm-time").textContent = 30;
      startBtn.disabled = true;
      startBtn.textContent = "Playing…";
      popRandom();
      countdownTimer = setInterval(tickCountdown, 1000);
    }

    startBtn.addEventListener("click", start);

    return () => {
      clearTimeout(spawnTimer);
      clearInterval(countdownTimer);
    };
  }
});
