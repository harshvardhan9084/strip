Strip.register({
  id: "breathe",
  label: "TOY",
  title: "Breathe",
  tag: "zen",
  hint: "Follow the circle — in, hold, out",
  async mount(container, api){
    // Round 22 (P2 tail): a session counter. Breathing exercises work BECAUSE
    // they repeat daily — but the old card never remembered a single cycle,
    // so there was no ritual, only a toy. Now every completed in-hold-out
    // cycle counts: TODAY (resets at midnight) and ALL TIME, saved through
    // the same api every game uses. Day-rolling keeps the number honest.
    const saved = await api.load().catch(() => null);
    const dk = () => new Date().toDateString();
    const stats = {
      day: saved && typeof saved.day === "string" ? saved.day : dk(),
      today: saved && Number.isFinite(saved.today) ? saved.today : 0,
      total: saved && Number.isFinite(saved.total) ? saved.total : 0,
    };
    if(stats.day !== dk()){ stats.day = dk(); stats.today = 0; }
    const save = () => { api.save(stats).catch(() => {}); };
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:18px; width:100%;";

    const stage = document.createElement("div");
    stage.style.cssText = "position:relative; width:220px; height:220px; display:flex; align-items:center; justify-content:center;";

    const ring = document.createElement("div");
    ring.style.cssText = `
      position:absolute; width:200px; height:200px; border-radius:50%;
      border:2px solid var(--purple-dim);
    `;

    const circle = document.createElement("div");
    circle.style.cssText = `
      width:80px; height:80px; border-radius:50%;
      background:radial-gradient(circle at 35% 30%, var(--purple), #4A4470 75%);
      transition:transform 4s ease-in-out, background 4s ease-in-out;
      box-shadow:0 0 40px rgba(139,127,232,.4);
    `;

    const label = document.createElement("div");
    label.style.cssText = "position:absolute; bottom:8px; font-size:13px; color:var(--ink-dim); font-weight:600;";
    label.textContent = "Tap to begin";

    stage.appendChild(ring);
    stage.appendChild(circle);
    stage.appendChild(label);

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "btn purple";
    toggleBtn.textContent = "Start";

    const counterRow = document.createElement("div");
    counterRow.style.cssText = "display:flex; gap:20px; font-family:var(--font-display); font-size:9px; color:var(--ink-dim);";
    const todayEl = document.createElement("span");
    const totalEl = document.createElement("span");
    counterRow.appendChild(todayEl);
    counterRow.appendChild(totalEl);

    wrap.appendChild(stage);
    wrap.appendChild(toggleBtn);
    wrap.appendChild(counterRow);
    container.appendChild(wrap);

    function paintCounter(){
      todayEl.innerHTML = `TODAY <span style="color:var(--purple)">${stats.today}</span>`;
      totalEl.innerHTML = `ALL TIME <span style="color:var(--ink)">${stats.total}</span>`;
    }
    paintCounter();

    const PHASES = [
      { text: "Breathe in…", scale: 1.6, duration: 4000 },
      { text: "Hold", scale: 1.6, duration: 3000 },
      { text: "Breathe out…", scale: 1.0, duration: 4000 },
      { text: "Hold", scale: 1.0, duration: 2000 },
    ];

    let running = false, phaseIdx = 0, timeoutId = null;

    function runPhase(){
      if(!running) return;
      const phase = PHASES[phaseIdx];
      Feedback.tone(phaseIdx === 0 ? 392 : phaseIdx === 2 ? 294 : 349, 0.3);
      label.textContent = phase.text;
      circle.style.transition = `transform ${phase.duration}ms ease-in-out, background ${phase.duration}ms ease-in-out`;
      circle.style.transform = `scale(${phase.scale})`;
      timeoutId = setTimeout(() => {
        if(phaseIdx === PHASES.length - 1){
          // a full in-hold-out cycle landed — the ritual counts it
          if(stats.day !== dk()){ stats.day = dk(); stats.today = 0; }
          stats.today++;
          stats.total++;
          save();
          paintCounter();
        }
        phaseIdx = (phaseIdx + 1) % PHASES.length;
        runPhase();
      }, phase.duration);
    }

    function start(){
      running = true;
      phaseIdx = 0;
      toggleBtn.textContent = "Stop";
      runPhase();
    }
    function stop(){
      running = false;
      clearTimeout(timeoutId);
      circle.style.transition = "transform .6s ease";
      circle.style.transform = "scale(1)";
      label.textContent = "Tap to begin";
      toggleBtn.textContent = "Start";
    }

    toggleBtn.addEventListener("click", () => running ? stop() : start());
    // the label says "Tap to begin" ON the stage — so the stage itself must
    // honor it. Tapping the circle/stage now toggles exactly like the button
    // (the old stage was inert, which made the label a lie).
    stage.style.cursor = "pointer";
    stage.addEventListener("click", () => running ? stop() : start());

    return () => clearTimeout(timeoutId);
  }
});
