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

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:16px; font-family:var(--font-display); font-size:9px; color:var(--ink-dim);";
    statRow.innerHTML = `<div>DROPS <span id="pk-drops" style="color:var(--amber)">${state.drops}</span></div><div>BEST SLOT <span id="pk-best" style="color:var(--purple)">${best}</span></div>`;
    wrap.appendChild(statRow);

    const canvas = document.createElement("canvas");
    canvas.style.cssText = "background:#12121a; border-radius:12px; width:min(78vw,280px); height:min(55vh,340px); touch-action:none;";
    wrap.appendChild(canvas);

    const dropBtn = document.createElement("button");
    dropBtn.className = "btn accent";
    dropBtn.textContent = "Drop ball";
    wrap.appendChild(dropBtn);

    container.appendChild(wrap);

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
        ctx.fillStyle = i === Math.floor(SLOTS/2) ? "rgba(255,179,71,.15)" : "rgba(255,255,255,.03)";
        ctx.fillRect(i*slotW, ch-36, slotW-2, 34);
        ctx.fillStyle = "rgba(237,234,227,0.6)"; // canvas can't resolve CSS vars like "var(--ink-dim)" — the old value made slot labels render in an arbitrary color
        ctx.font = "9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(SLOT_SCORES[i], i*slotW + slotW/2, ch-16);
      }

      ctx.fillStyle = "rgba(255,255,255,.3)";
      pegs.forEach(p => {
        ctx.beginPath(); ctx.arc(p.x, p.y, PEG_R, 0, Math.PI*2); ctx.fill();
      });

      ctx.fillStyle = "#FFB347";
      balls.forEach(b => {
        ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, Math.PI*2); ctx.fill();
      });
    }

    function step(){
      balls.forEach(b => {
        if(b.settled) return;
        b.vy += 0.25;
        b.x += b.vx;
        b.y += b.vy;
        b.vx *= 0.995;

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
          q("#pk-drops").textContent = state.drops;
          api.save(state);
          if(score > best){
            best = score;
            api.setHighscore(best);
            q("#pk-best").textContent = best;
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

    return () => cancelAnimationFrame(rafId);
  }
});
