Strip.register({
  id: "plinko",
  label: "TOY",
  title: "Plinko",
  tag: "physics",
  hint: "Tap to drop a ball through the pegs",
  async mount(container, api){
    // lookups scoped to THIS card — duplicate ids across two copies of a
    // cartridge coexist briefly in the strip, and getElementById could
    // update the stale copy instead of the visible one
    const q = (sel) => container.querySelector(sel);
    const state = (await api.load()) || { drops: 0, totalScore: 0 };
    let best = await api.getHighscore();

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:10px; width:100%;";

    // R36 — the stat row is SHELL-OWNED now (api.setStats): one slot between
    // title and playfield, one type scale, tabular nums, <=4 stats. The old
    // header's span ids live on as value keys so update sites stay one-liners.
    const statVals = {
      "pk-drops": String(state.drops),
      "pk-total": String(state.totalScore || 0),
      "pk-best": String(best),
    };
    const STAT_KEYS = [
      ["pk-drops", "DROPS", "var(--amber)", null],
      ["pk-total", "TOTAL", "var(--ink)", null],
      ["pk-best", "BEST SLOT", "var(--purple)", null],
    ];
    function renderStats(){
      api.setStats(STAT_KEYS.map(([k, label, color, fixed]) => ({
        label,
        value: k ? statVals[k] : fixed,
        color,
      })));
    }
    renderStats();

    const canvas = document.createElement("canvas");
    // R33 daylight screens: the glass follows the chassis via the light-only
    // --screen token; dark keeps the raw hex through the var() fallback.
    canvas.style.cssText = "background:var(--screen, #12121a); border-radius:12px; width:min(78vw,280px); height:min(55vh,340px); touch-action:none;";
    wrap.appendChild(canvas);

    const dropBtn = document.createElement("button");
    dropBtn.className = "btn accent";
    dropBtn.textContent = "Drop ball";
    wrap.appendChild(dropBtn);

    container.appendChild(wrap);

    // R33 — ink resolved from the daylight-screen tokens (undefined in
    // dark/OLED -> raw CRT fallbacks, pixel-identical); re-resolved when the
    // chassis flips mid-mount via strip:mode-changed.
    const _sv = getComputedStyle(document.documentElement);
    let INK_RGB = _sv.getPropertyValue("--screen-ink-rgb").trim() || "237,234,227";
    let CELL = _sv.getPropertyValue("--screen-cell").trim() || "rgba(255,255,255,.03)";
    let LIGHT = document.documentElement.dataset.mode === "light";
    const retint = () => {
      INK_RGB = _sv.getPropertyValue("--screen-ink-rgb").trim() || "237,234,227";
      CELL = _sv.getPropertyValue("--screen-cell").trim() || "rgba(255,255,255,.03)";
      LIGHT = document.documentElement.dataset.mode === "light";
    };
    const onModeChanged = () => { retint(); draw(); };
    window.addEventListener("strip:mode-changed", onModeChanged);

    const ctx = canvas.getContext("2d");
    let cw, ch;
    function fit(){
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * devicePixelRatio;
      canvas.height = rect.height * devicePixelRatio;
      ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
      cw = rect.width; ch = rect.height;
      buildPegs();
    }

    let pegs = [], balls = [];
    const ROWS = 8, PEG_R = 3, BALL_R = 6;
    const SLOTS = 7;
    const SLOT_SCORES = [100, 30, 10, 5, 10, 30, 100];

    function buildPegs(){
      pegs = [];
      const marginTop = 30, marginBottom = 50;
      const usableH = ch - marginTop - marginBottom;
      for(let r=0;r<ROWS;r++){
        const y = marginTop + (r/(ROWS-1))*usableH;
        const count = r + 3;
        const spacing = cw / (count+1);
        for(let i=0;i<count;i++){
          pegs.push({ x: spacing*(i+1), y });
        }
      }
    }
    requestAnimationFrame(fit);

    function drop(){
      api.tend(); // Round 24: every drop is a tend (missions feed on it)
      balls.push({
        x: cw/2 + (Math.random()-0.5)*10,
        y: 10,
        vx: (Math.random()-0.5)*0.5,
        vy: 0,
        settled: false,
      });
    }

    function slotIndexFromX(x){
      const w = cw / SLOTS;
      return Math.max(0, Math.min(SLOTS-1, Math.floor(x / w)));
    }

    function draw(){
      ctx.clearRect(0,0,cw,ch);

      // slots at bottom
      const slotW = cw / SLOTS;
      for(let i=0;i<SLOTS;i++){
        ctx.fillStyle = i === Math.floor(SLOTS/2) ? "rgba(255,179,71,.15)" : CELL;
        ctx.fillRect(i*slotW, ch-36, slotW-2, 34);
        ctx.fillStyle = `rgba(${INK_RGB},0.6)`; // canvas can't resolve CSS vars like "var(--ink-dim)" — the old value made slot labels render in an arbitrary color
        ctx.font = "9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(SLOT_SCORES[i], i*slotW + slotW/2, ch-16);
      }

      ctx.fillStyle = `rgba(${INK_RGB},.3)`;
      pegs.forEach(p => {
        ctx.beginPath(); ctx.arc(p.x, p.y, PEG_R, 0, Math.PI*2); ctx.fill();
      });

      ctx.fillStyle = "#FFB347";
      balls.forEach(b => {
        ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, Math.PI*2); ctx.fill();
        // R33 daylight detail: the raw amber ball is faint on the daylight
        // glass — a thin ink ring keeps it crisp; dark keeps the pure glow.
        if(LIGHT){
          ctx.strokeStyle = `rgba(${INK_RGB},.55)`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });
    }

    let lastFrame = performance.now();
    function step(now){
      const dtF = Math.min(3, Math.max(0, (now - lastFrame) / 16.67));
      lastFrame = now;
      balls.forEach(b => {
        if(b.settled) return;
        b.vy += 0.25 * dtF;
        b.x += b.vx * dtF;
        b.y += b.vy * dtF;
        b.vx *= Math.pow(0.995, dtF);

        pegs.forEach(p => {
          const dx = b.x-p.x, dy = b.y-p.y;
          const dist = Math.hypot(dx,dy);
          if(dist < BALL_R + PEG_R){
            const nx = dx/dist, ny = dy/dist;
            b.x = p.x + nx*(BALL_R+PEG_R);
            b.y = p.y + ny*(BALL_R+PEG_R);
            b.vx = nx * 1.5 + (Math.random()-0.5)*0.8;
            b.vy = Math.max(0.5, ny * 1.5);
          }
        });

        if(b.x < BALL_R){ b.x = BALL_R; b.vx *= -0.5; }
        if(b.x > cw-BALL_R){ b.x = cw-BALL_R; b.vx *= -0.5; }

        if(b.y > ch - 40 && !b.settled){
          b.settled = true;
          const slot = slotIndexFromX(b.x);
          const score = SLOT_SCORES[slot];
          Feedback.tone(score >= 100 ? "win" : "tap"); Feedback.haptic("medium");
          state.drops++;
          state.totalScore += score;
          statVals["pk-drops"] = state.drops; renderStats();
          statVals["pk-total"] = state.totalScore; renderStats();
          api.save(state);
          if(score > best){
            best = score;
            api.setHighscore(best);
            statVals["pk-best"] = best; renderStats();
          }
          setTimeout(() => { balls = balls.filter(x => x !== b); }, 600);
        }
      });
      draw();
      rafId = requestAnimationFrame(step);
    }

    let rafId = requestAnimationFrame(step);
    dropBtn.addEventListener("click", drop);
    canvas.addEventListener("click", drop);

    // keep pegs/slots aligned when the viewport rotates or resizes
    let resizeTimer = null;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(fit, 150);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("strip:mode-changed", onModeChanged);
      clearTimeout(resizeTimer);
    };
  }
});
