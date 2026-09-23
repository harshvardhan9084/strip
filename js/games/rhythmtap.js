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

    // R36 — the stat row is SHELL-OWNED now (api.setStats): one slot between
    // title and playfield, one type scale, tabular nums, <=4 stats. The old
    // header's span ids live on as value keys so update sites stay one-liners.
    const statVals = {
      "rt-score": "0",
      "rt-best": String(best),
    };
    const STAT_KEYS = [
      ["rt-score", "STREAK", "var(--amber)", null],
      ["rt-best", "BEST", "var(--purple)", null],
    ];
    function renderStats(){
      api.setStats(STAT_KEYS.map(([k, label, color, fixed]) => ({
        label,
        value: k ? statVals[k] : fixed,
        color,
      })));
    }
    renderStats();

    const stage = document.createElement("div");
    stage.style.cssText = "position:relative; width:180px; height:180px;";
    wrap.appendChild(stage);

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 180 180");
    svg.style.cssText = "position:absolute; inset:0;";
    stage.appendChild(svg);

    const targetRing = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    targetRing.setAttribute("cx","90"); targetRing.setAttribute("cy","90"); targetRing.setAttribute("r","70");
    // strokes ride inline style, not presentation attributes — var() is not
    // reliably parsed inside SVG attributes (chainlink resolves colors too);
    // inline style keeps the token so light mode re-grades the accents
    targetRing.setAttribute("fill","none"); targetRing.style.stroke = "var(--amber)";
    targetRing.setAttribute("stroke-width","3"); targetRing.setAttribute("opacity","0.5");
    svg.appendChild(targetRing);

    const shrinkRing = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    shrinkRing.setAttribute("cx","90"); shrinkRing.setAttribute("cy","90"); shrinkRing.setAttribute("r","78");
    shrinkRing.setAttribute("fill","none"); shrinkRing.style.stroke = "var(--purple)";
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
    let lastTs = null; // dt anchor — the descent is frame-rate normalized, 120Hz must not play double-speed
    // Round 22 (user ask): click-to-begin gate — the card used to open with
    // the ring ALREADY falling, so the first seconds were a forced miss and
    // the streak started at −1 confidence. Now the card opens on an idle,
    // breathing pad; the first tap commits and is never judged.
    let mode = "idle"; // "idle" | "playing"

    // pulsing CTA on the idle pad (transform kept — the pad centers itself)
    if(!document.getElementById("rt-cta-kf")){
      const st = document.createElement("style");
      st.id = "rt-cta-kf";
      st.textContent = "@keyframes rtPulse{0%,100%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.06)}}" +
        ".rt-cta{animation:rtPulse 1.15s ease-in-out infinite; border:2px solid var(--amber-dim) !important;}";
      document.head.appendChild(st);
    }

    function reset(){
      streak = 0;
      statVals["rt-score"] = 0; renderStats();
      speed = 0.9;
      enterIdle();
    }

    function enterIdle(){
      mode = "idle";
      running = false;
      r = MAX_R;
      shrinkRing.setAttribute("r", MAX_R);
      shrinkRing.setAttribute("opacity", "0.3");
      padBtn.innerHTML = "TAP TO<br>BEGIN";
      padBtn.style.fontSize = "10px";
      padBtn.classList.add("rt-cta");
    }

    function spawnRing(){
      r = MAX_R;
      running = true;
    }

    function loop(ts){
      if(lastTs == null) lastTs = ts;
      // dt in frame-units, clamped like flapdot — the tap window is px-based,
      // so its wall-clock width would halve on 120Hz screens without this
      const dtF = Math.min(3, Math.max(0, (ts - lastTs) / 16.67));
      lastTs = ts;
      if(running){
        r -= speed * dtF;
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
        api.gameover("over", streak);
        api.setHighscore(streak).then(v => {
          best = v;
          statVals["rt-best"] = best; renderStats();
        });
      }
      streak = 0;
      statVals["rt-score"] = 0; renderStats();
      setTimeout(() => { feedback.textContent = ""; spawnRing(); }, 700);
    }

    function tap(){
      if(mode === "idle"){
        // the commitment tap: starts the run, never judged
        mode = "playing";
        padBtn.textContent = "TAP";
        padBtn.style.fontSize = "13px";
        padBtn.classList.remove("rt-cta");
        shrinkRing.setAttribute("opacity", "1");
        feedback.textContent = "";
        spawnRing();
        Feedback.tone("place"); Feedback.haptic("light");
        return;
      }
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
      statVals["rt-score"] = streak; renderStats();
      if(streak > best){
        best = streak;
        api.setHighscore(best);
        statVals["rt-best"] = best; renderStats();
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
