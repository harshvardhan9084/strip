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

    // R36 — the stat row is SHELL-OWNED now (api.setStats): one slot between
    // title and playfield, one type scale, tabular nums, <=4 stats. The old
    // header's span ids live on as value keys so update sites stay one-liners.
    const statVals = {
      "bp-score": "0",
      "bp-time": "60",
      "bp-best": String(best),
    };
    const STAT_KEYS = [
      ["bp-score", "SCORE", "var(--amber)", null],
      ["bp-time", "TIME", "var(--purple)", null],
      ["bp-best", "BEST", "var(--ink)", null],
    ];
    function renderStats(){
      api.setStats(STAT_KEYS.map(([k, label, color, fixed]) => ({
        label,
        value: k ? statVals[k] : fixed,
        color,
      })));
    }
    renderStats();

    const field = document.createElement("div");
    field.style.cssText = "position:relative; width:min(78vw,280px); height:min(50vh,320px); background:var(--screen, #12121a); border-radius:14px; overflow:hidden;";
    wrap.appendChild(field);

    const startBtn = document.createElement("button");
    startBtn.className = "btn accent";
    startBtn.textContent = "Start";
    wrap.appendChild(startBtn);

    container.appendChild(wrap);

    let running = false, score = 0, timeLeft = 60, spawnTimer = null, countdownTimer = null, activeEls = [];

    // R35 density wave juice: a pop used to delete the balloon silently — no
    // burst, no float, no feel. Small shard burst + score float at the pop
    // site; bombs get a pulsing fuse glow BEFORE the tap (the audit's
    // "visual difference before tap, not after").
    const REDUCE = () => document.documentElement.classList.contains("reduce-motion");
    function popBurst(source, text, color){
      const rect = source.getBoundingClientRect();
      const frect = field.getBoundingClientRect();
      const cx = rect.left - frect.left + rect.width/2;
      const cy = rect.top - frect.top + rect.height/2;
      const ft = document.createElement("div");
      ft.textContent = text;
      ft.style.cssText = `position:absolute; left:${cx}px; top:${cy}px; transform:translate(-50%,-50%); font-family:var(--font-display); font-size:12px; color:${color}; pointer-events:none; z-index:3; transition:transform .5s ease-out, opacity .5s ease-out;`;
      field.appendChild(ft);
      requestAnimationFrame(() => { ft.style.transform = "translate(-50%,-160%)"; ft.style.opacity = "0"; });
      setTimeout(() => ft.remove(), 540);
      if(REDUCE()) return; // shards are motion; the float alone carries the news
      for(let i=0;i<6;i++){
        const s = document.createElement("div");
        const a = (Math.PI*2*i)/6 + Math.random()*.5;
        const d = 18 + Math.random()*16;
        s.style.cssText = `position:absolute; left:${cx}px; top:${cy}px; width:5px; height:5px; border-radius:50%; background:${color}; pointer-events:none; z-index:3; transition:transform .38s ease-out, opacity .38s;`;
        field.appendChild(s);
        requestAnimationFrame(() => { s.style.transform = `translate(${Math.cos(a)*d}px,${Math.sin(a)*d}px)`; s.style.opacity = "0"; });
        setTimeout(() => s.remove(), 430);
      }
    }
    let combo = 0, comboTimer = null;
    function bumpCombo(){
      combo++;
      clearTimeout(comboTimer);
      comboTimer = setTimeout(() => { combo = 0; }, 1200);
      if(combo >= 3){
        const chip = document.createElement("div");
        chip.textContent = "COMBO ×" + combo;
        chip.style.cssText = "position:absolute; left:50%; top:8%; transform:translateX(-50%); font-family:var(--font-display); font-size:11px; color:var(--amber); text-shadow:0 0 12px rgba(var(--glow-rgb),.8); pointer-events:none; z-index:3; transition:opacity .4s;";
        field.appendChild(chip);
        setTimeout(() => { chip.style.opacity = "0"; }, 650);
        setTimeout(() => chip.remove(), 1100);
      }
    }

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
        el.classList.add("bp-bomb"); // pulsing fuse glow reads before the tap
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
          popBurst(el, "−3", "var(--danger)");
        } else {
          score += 1;
          Feedback.tone("pop"); Feedback.haptic("light");
          popBurst(el, "+1", "var(--amber)");
          bumpCombo();
        }
        statVals["bp-score"] = score; renderStats();
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
      statVals["bp-time"] = timeLeft; renderStats();
      if(timeLeft <= 0) endGame();
    }

    function endGame(){
      if(!running) return; // guard: End button and countdown can both call this
      running = false;
      Feedback.tone("toggle");
      clearTimeout(spawnTimer);
      clearInterval(countdownTimer);
      activeEls.forEach(el => el.remove());
      activeEls = [];
      startBtn.textContent = "Play again";
      startBtn.disabled = false;
      const prevBest = best;
api.gameover("over", score);
      api.setHighscore(score).then(v => {
        best = v;
        statVals["bp-best"] = best; renderStats();
      });
      // R35 ceremony adoption: the 60s run ended in a stat-row flicker —
      // the standard panel carries it out with the honest delta + verb.
      RunCeremony.show(container, {
        tone: "clear",
        label: "TIME UP",
        score: score,
        unit: "popped",
        delta: score > prevBest ? "NEW BEST" : (prevBest ? "BEST " + prevBest : ""),
        deltaTone: score > prevBest ? "good" : "",
        verb: "PLAY AGAIN",
        onVerb: start,
      });
    }

    function start(){
      RunCeremony.hide(container); // a restart never fights the flourish
      score = 0; timeLeft = 60; running = true;
      combo = 0; clearTimeout(comboTimer); // a new round never inherits the last one's combo
      statVals["bp-score"] = 0; renderStats();
      statVals["bp-time"] = 60; renderStats();
      startBtn.disabled = false;
      startBtn.textContent = "End round";
      spawnLoop();
      countdownTimer = setInterval(tickCountdown, 1000);
    }

    startBtn.addEventListener("click", () => {
      // one button, honest states: idle = Start, mid-round = quit early (the
      // old 60s round had NO exit — scrolling away was the only escape),
      // finished = Play again
      if(running) endGame();
      else start();
    });

    return () => {
      clearTimeout(spawnTimer);
      clearTimeout(comboTimer);
      clearInterval(countdownTimer);
    };
  }
});
