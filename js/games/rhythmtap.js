Strip.register({
  id: "rhythmtap",
  label: "REFLEX",
  title: "Rhythm Tap",
  tag: "beat",
  hint: "Tap the pad exactly when the ring closes",
  async mount(container, api){
    // lookups scoped to THIS card — duplicate ids across two copies of a
    // cartridge coexist briefly in the strip, and getElementById could
    // update the stale copy instead of the visible one
    const q = (sel) => container.querySelector(sel);
    let best = await api.getHighscore();

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:14px; width:100%;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:20px; font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    statRow.innerHTML = `<div>STREAK <span id="rt-score" style="color:var(--amber)">0</span></div><div>BEST <span id="rt-best" style="color:var(--purple)">${best}</span></div>`;
    wrap.appendChild(statRow);

    const stage = document.createElement("div");
    stage.style.cssText = "position:relative; width:180px; height:180px;";
    wrap.appendChild(stage);

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 180 180");
    svg.style.cssText = "position:absolute; inset:0;";
    stage.appendChild(svg);

    const targetRing = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    targetRing.setAttribute("cx","90"); targetRing.setAttribute("cy","90"); targetRing.setAttribute("r","70");
    targetRing.setAttribute("fill","none"); targetRing.setAttribute("stroke","var(--amber)");
    targetRing.setAttribute("stroke-width","3"); targetRing.setAttribute("opacity","0.5");
    svg.appendChild(targetRing);

    const shrinkRing = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    shrinkRing.setAttribute("cx","90"); shrinkRing.setAttribute("cy","90"); shrinkRing.setAttribute("r","78");
    shrinkRing.setAttribute("fill","none"); shrinkRing.setAttribute("stroke","var(--purple)");
    shrinkRing.setAttribute("stroke-width","4");
    svg.appendChild(shrinkRing);

    const padBtn = document.createElement("button");
    padBtn.style.cssText = `
      position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
      width:100px; height:100px; border-radius:50%; border:none; cursor:pointer;
      background:var(--panel-2); font-size:13px; color:var(--ink);
    `;
    padBtn.textContent = "TAP";
    stage.appendChild(padBtn);

    const feedback = document.createElement("div");
    feedback.style.cssText = "font-size:13px; font-weight:700; min-height:20px;";
    wrap.appendChild(feedback);

    container.appendChild(wrap);

    const TARGET_R = 70;
    const START_R = 78;
    const MAX_R = 160;
    let streak = 0, running = false, r = START_R, rafId = null, speed = 0.9;

    function reset(){
      streak = 0;
      q("#rt-score").textContent = 0;
      speed = 0.9;
      spawnRing();
    }

    function spawnRing(){
      r = MAX_R;
      running = true;
    }

    function loop(){
      if(running){
        r -= speed;
        shrinkRing.setAttribute("r", Math.max(0, r));
        if(r < TARGET_R - 30){
          // missed the window entirely
          miss();
        }
      }
      rafId = requestAnimationFrame(loop);
    }

    function miss(){
      running = false;
      feedback.textContent = "Missed";
      feedback.style.color = "var(--danger)";
      Feedback.buzz("error");
      if(streak > 0){
        api.setHighscore(streak).then(v => {
          best = v;
          q("#rt-best").textContent = best;
        });
      }
      streak = 0;
      q("#rt-score").textContent = 0;
      setTimeout(() => { feedback.textContent = ""; spawnRing(); }, 700);
    }

    function tap(){
      if(!running) return;
      const diff = Math.abs(r - TARGET_R);
      if(diff < 6){
        feedback.textContent = "PERFECT";
        feedback.style.color = "var(--amber)";
        Feedback.tone("select"); Feedback.haptic("medium");
        streak++;
        speed = Math.min(3.2, speed + 0.06);
      } else if(diff < 16){
        feedback.textContent = "Good";
        feedback.style.color = "var(--purple)";
        Feedback.tone("tap"); Feedback.haptic("light");
        streak++;
        speed = Math.min(3.2, speed + 0.03);
      } else {
        miss();
        return;
      }
      q("#rt-score").textContent = streak;
      if(streak > best){
        best = streak;
        api.setHighscore(best);
        q("#rt-best").textContent = best;
      }
      setTimeout(() => { feedback.textContent = ""; }, 400);
      spawnRing();
    }

    padBtn.addEventListener("click", tap);
    rafId = requestAnimationFrame(loop);
    reset();

    return () => cancelAnimationFrame(rafId);
  }
});
