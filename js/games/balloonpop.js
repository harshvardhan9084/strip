Strip.register({
  id: "balloonpop",
  label: "REFLEX",
  title: "Balloon Pop",
  tag: "60s",
  hint: "Pop balloons, avoid the bombs",
  async mount(container, api){
    // lookups scoped to THIS card — duplicate ids across two copies of a
    // cartridge coexist briefly in the strip, and getElementById could
    // update the stale copy instead of the visible one
    const q = (sel) => container.querySelector(sel);
    let best = await api.getHighscore();
    const ROUND_MS = 60000;

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:10px; width:100%;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:16px; font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    statRow.innerHTML = `<div>SCORE <span id="bp-score" style="color:var(--amber)">0</span></div><div>TIME <span id="bp-time" style="color:var(--purple)">60</span></div><div>BEST <span id="bp-best" style="color:var(--ink)">${best}</span></div>`;
    wrap.appendChild(statRow);

    const field = document.createElement("div");
    field.style.cssText = "position:relative; width:min(78vw,280px); height:min(50vh,320px); background:#12121a; border-radius:14px; overflow:hidden;";
    wrap.appendChild(field);

    const startBtn = document.createElement("button");
    startBtn.className = "btn accent";
    startBtn.textContent = "Start";
    wrap.appendChild(startBtn);

    container.appendChild(wrap);

    let running = false, score = 0, timeLeft = 60, spawnTimer = null, countdownTimer = null, activeEls = [];

    function spawnItem(){
      if(!running) return;
      const isBomb = Math.random() < 0.18;
      const el = document.createElement("div");
      const size = 34 + Math.random()*14;
      el.style.cssText = `
        position:absolute; left:${Math.random()*80}%; bottom:-40px;
        font-size:${size}px; cursor:pointer; user-select:none;
        transition:bottom ${3 + Math.random()*2}s linear;
      `;
      if(isBomb){
        el.textContent = "💣";
      } else {
        // CSS balloons, not emoji: hue-rotate() silently does nothing on color
        // emoji glyphs, so every balloon used to be the same red. Real painted
        // colors give the game actual variety (and filters that work).
        const BALLOON_COLORS = ["#E8637F","#FFB347","#8B7FE8","#5AC98A","#6FA8FF","#F2A65A"];
        const color = BALLOON_COLORS[Math.floor(Math.random()*BALLOON_COLORS.length)];
        const body = document.createElement("div");
        body.style.cssText = `
          width:${size}px; height:${size*1.18}px;
          background:radial-gradient(circle at 32% 28%, rgba(255,255,255,.55), ${color} 46%);
          border-radius:50% 50% 50% 50% / 56% 56% 44% 44%;
        `;
        const knot = document.createElement("div");
        knot.style.cssText = `
          width:0; height:0; margin:0 auto;
          border-left:${size*0.10}px solid transparent;
          border-right:${size*0.10}px solid transparent;
          border-bottom:${size*0.16}px solid ${color};
        `;
        const string = document.createElement("div");
        string.style.cssText = `
          width:1px; height:${size*0.5}px; margin:0 auto;
          background:rgba(237,234,227,.4);
        `;
        el.appendChild(body);
        el.appendChild(knot);
        el.appendChild(string);
      }
      field.appendChild(el);
      activeEls.push(el);
      requestAnimationFrame(() => { el.style.bottom = "110%"; });

      const cleanup = () => {
        el.remove();
        activeEls = activeEls.filter(e => e !== el);
      };
      const timeout = setTimeout(cleanup, 5200);

      el.addEventListener("click", () => {
        clearTimeout(timeout);
        if(isBomb){
          score = Math.max(0, score - 3);
          Feedback.buzz("error");
        } else {
          score += 1;
          Feedback.tone("pop"); Feedback.haptic("light");
        }
        q("#bp-score").textContent = score;
        cleanup();
      });
    }

    // Independent spawn loop, decoupled from any single item's lifecycle — this is
    // what actually keeps a continuous stream of balloons coming. The old version
    // chained the next spawn from inside spawnItem() through one shared timer
    // variable, so only one item's lifecycle was ever "in flight" driving spawns.
    function spawnLoop(){
      if(!running) return;
      spawnItem();
      spawnTimer = setTimeout(spawnLoop, 420 + Math.random()*380);
    }

    function tickCountdown(){
      timeLeft--;
      q("#bp-time").textContent = timeLeft;
      if(timeLeft <= 0) endGame();
    }

    function endGame(){
      running = false;
      Feedback.tone("toggle");
      clearTimeout(spawnTimer);
      clearInterval(countdownTimer);
      activeEls.forEach(el => el.remove());
      activeEls = [];
      startBtn.textContent = "Play again";
      startBtn.disabled = false;
      api.setHighscore(score).then(v => {
        best = v;
        q("#bp-best").textContent = best;
      });
    }

    function start(){
      score = 0; timeLeft = 60; running = true;
      q("#bp-score").textContent = 0;
      q("#bp-time").textContent = 60;
      startBtn.disabled = true;
      startBtn.textContent = "Popping…";
      spawnLoop();
      countdownTimer = setInterval(tickCountdown, 1000);
    }

    startBtn.addEventListener("click", start);

    return () => {
      clearTimeout(spawnTimer);
      clearInterval(countdownTimer);
    };
  }
});
