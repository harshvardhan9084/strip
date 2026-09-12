Strip.register({
  id: "reaction",
  label: "REFLEX",
  title: "Reaction Time",
  tag: "ms",
  hint: "Tap the moment it turns green",
  async mount(container, api){
    let best = await api.getHighscore(); // lower ms is better -> store as (100000 - ms)
    let recent = []; // rolling last-5 for the average readout

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:16px; width:100%;";

    const bestRow = document.createElement("div");
    bestRow.style.cssText = "font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    bestRow.textContent = `BEST ${best ? (100000-best)+"ms" : "-"}`;
    wrap.appendChild(bestRow);

    const zone = document.createElement("button");
    zone.style.cssText = `
      width:min(70vw,240px); height:min(40vh,200px); border-radius:16px; border:none; cursor:pointer;
      background:var(--danger); color:#fff; font-family:var(--font-display); font-size:13px;
      display:flex; align-items:center; justify-content:center; text-align:center; padding:20px;
    `;
    zone.textContent = "Wait for green…";
    wrap.appendChild(zone);

    container.appendChild(wrap);

    let state = "idle"; // idle -> waiting -> ready -> done
    let timeoutId = null, startTime = 0;

    function startRound(){
      state = "waiting";
      zone.style.background = "var(--danger)";
      zone.textContent = "Wait for green…";
      const delay = 1200 + Math.random()*2500;
      timeoutId = setTimeout(() => {
        state = "ready";
        zone.style.background = "#6FCF97";
        zone.textContent = "TAP NOW";
        startTime = performance.now();
      }, delay);
    }

    zone.addEventListener("click", () => {
      if(state === "idle"){
        startRound();
      } else if(state === "waiting"){
        clearTimeout(timeoutId);
        state = "idle";
        Feedback.buzz("error");
        zone.style.background = "var(--amber-dim)";
        zone.textContent = "Too soon! Tap to retry";
      } else if(state === "ready"){
        const ms = Math.round(performance.now() - startTime);
        state = "done";
        Feedback.tone("success"); Feedback.haptic("medium");
        zone.style.background = "var(--purple)";
        // Round 19 (TOY hook): rolling last-5 average + an honest human
        // baseline — self-calibration is the hook this toy was missing
        recent.push(ms);
        if(recent.length > 5) recent.shift();
        const avg = Math.round(recent.reduce((s, v) => s + v, 0) / recent.length);
        const vs = ms < 250 ? "faster than typical" : ms > 320 ? "slower than typical" : "about typical";
        zone.textContent = `${ms} ms — tap to retry · avg5 ${avg} (${vs} adult: ~250ms)`;
        const scoreValue = 100000 - ms;
        api.setHighscore(scoreValue).then(v => {
          best = v;
          bestRow.textContent = `BEST ${100000-best}ms`;
        });
      } else if(state === "done"){
        startRound();
      }
    });

    return () => clearTimeout(timeoutId);
  }
});
