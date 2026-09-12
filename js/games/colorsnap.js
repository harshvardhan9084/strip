Strip.register({
  id: "colorsnap",
  label: "REFLEX",
  title: "Color Snap",
  tag: "⚡",
  hint: "Tap only when word ≠ color",
  async mount(container, api){
    // lookups scoped to THIS card — duplicate ids across two copies of a
    // cartridge coexist briefly in the strip, and getElementById could
    // update the stale copy instead of the visible one
    const q = (sel) => container.querySelector(sel);
    let best = await api.getHighscore();
    const COLORS = [
      { name:"RED", hex:"#E8637F" },
      { name:"AMBER", hex:"#FFB347" },
      { name:"PURPLE", hex:"#8B7FE8" },
      { name:"GREEN", hex:"#6FCF97" },
      { name:"BLUE", hex:"#56B4E9" },
    ];

    let running = false, score = 0, timer = null, current = null, timeLeft = 0;

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:22px; width:100%;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:24px; font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    statRow.innerHTML = `<div>SCORE <span id="cs-score" style="color:var(--amber)">0</span></div><div>BEST <span id="cs-best" style="color:var(--purple)">${best}</span></div>`;

    const wordEl = document.createElement("div");
    wordEl.style.cssText = "font-size:42px; font-weight:700; height:60px; display:flex; align-items:center;";
    wordEl.textContent = "TAP TO START";
    wordEl.style.color = "var(--ink)";

    const barOuter = document.createElement("div");
    barOuter.style.cssText = "width:220px; height:6px; background:var(--panel-2); border-radius:4px; overflow:hidden;";
    const barInner = document.createElement("div");
    barInner.style.cssText = "height:100%; width:100%; background:var(--amber); transition:width linear;";
    barOuter.appendChild(barInner);

    const btnRow = document.createElement("div");
    btnRow.style.cssText = "display:flex; gap:10px;";
    const matchBtn = document.createElement("button");
    matchBtn.className = "btn accent";
    matchBtn.textContent = "MATCH";
    const noMatchBtn = document.createElement("button");
    noMatchBtn.className = "btn purple";
    noMatchBtn.textContent = "MISMATCH";
    btnRow.appendChild(matchBtn);
    btnRow.appendChild(noMatchBtn);

    wrap.appendChild(statRow);
    wrap.appendChild(wordEl);
    wrap.appendChild(barOuter);
    wrap.appendChild(btnRow);
    container.appendChild(wrap);

    function pick(){
      const wordColor = COLORS[Math.floor(Math.random()*COLORS.length)];
      let inkColor = COLORS[Math.floor(Math.random()*COLORS.length)];
      const isMatch = Math.random() < 0.45;
      if(isMatch) inkColor = wordColor;
      else if(inkColor.name === wordColor.name){
        inkColor = COLORS[(COLORS.indexOf(inkColor)+1) % COLORS.length];
      }
      return { wordColor, inkColor, isMatch: wordColor.name === inkColor.name };
    }

    // Round 19 (S3): the classic Stroop ramp — each correct answer shaves 40 ms
    // off the round (floor 600 ms). Escalation is the whole curve this game had
    // no curve of.
    let ROUND_MS = 1600;
    const ROUND_FLOOR = 600;

    function nextRound(){
      current = pick();
      wordEl.textContent = current.wordColor.name;
      wordEl.style.color = current.inkColor.hex;
      timeLeft = ROUND_MS;
      barInner.style.transition = "none";
      barInner.style.width = "100%";
      requestAnimationFrame(() => {
        barInner.style.transition = `width ${ROUND_MS}ms linear`;
        barInner.style.width = "0%";
      });
      clearTimeout(timer);
      timer = setTimeout(() => answer(null), ROUND_MS);
    }

    function answer(userSaysMatch){
      if(!running) return;
      clearTimeout(timer);
      const correct = userSaysMatch === current.isMatch;
      if(correct){
        Feedback.tone("success"); Feedback.haptic("light");
        score++;
        q("#cs-score").textContent = score;
        ROUND_MS = Math.max(ROUND_FLOOR, ROUND_MS - 40); // the ramp
        nextRound();
      } else {
        Feedback.buzz("error");
        endGame();
      }
    }

    function endGame(){
      running = false;
      clearTimeout(timer);
      api.setHighscore(score).then(newBest => {
        best = newBest;
        q("#cs-best").textContent = best;
      });
      wordEl.textContent = "GAME OVER";
      wordEl.style.color = "var(--danger)";
      barInner.style.width = "0%";
    }

    function start(){
      running = true; score = 0;
      ROUND_MS = 1600; // reset the ramp each run
      q("#cs-score").textContent = 0;
      nextRound();
    }

    wordEl.addEventListener("click", () => { if(!running) start(); });
    matchBtn.addEventListener("click", () => running ? answer(true) : start());
    noMatchBtn.addEventListener("click", () => running ? answer(false) : start());

    return () => clearTimeout(timer);
  }
});
