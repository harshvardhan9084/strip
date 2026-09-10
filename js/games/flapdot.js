Strip.register({
  id: "flapdot",
  label: "REFLEX",
  title: "Flap Dot",
  tag: "arcade",
  hint: "Tap to flap, avoid the bars",
  async mount(container, api){
    // lookups scoped to THIS card — duplicate ids across two copies of a
    // cartridge coexist briefly in the strip, and getElementById could
    // update the stale copy instead of the visible one
    const q = (sel) => container.querySelector(sel);
    let best = await api.getHighscore();

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:10px; width:100%;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:20px; font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    statRow.innerHTML = `<div>SCORE <span id="fd-score" style="color:var(--amber)">0</span></div><div>BEST <span id="fd-best" style="color:var(--purple)">${best}</span></div>`;
    wrap.appendChild(statRow);

    const canvas = document.createElement("canvas");
    canvas.style.cssText = "background:#12121a; border-radius:12px; touch-action:none; width:min(70vw,240px); height:min(50vh,320px);";
    wrap.appendChild(canvas);

    const hint = document.createElement("div");
    hint.style.cssText = "font-size:11px; color:var(--ink-dim);";
    hint.textContent = "Tap the canvas to start";
    wrap.appendChild(hint);

    container.appendChild(wrap);

    const ctx = canvas.getContext("2d");
    function fitCanvas(){
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * devicePixelRatio;
      canvas.height = rect.height * devicePixelRatio;
      ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
    }
    requestAnimationFrame(fitCanvas);

    let dotY, vel, gap, pipes, score, running, rafId;
    const GRAVITY = 0.35, FLAP = -6, PIPE_GAP = 90, PIPE_W = 34, PIPE_SPEED = 2.2;

    function reset(){
      dotY = 100; vel = 0; pipes = []; score = 0; running = false;
      q("#fd-score").textContent = 0;
      spawnPipe();
    }

    function spawnPipe(){
      const w = canvas.width / devicePixelRatio;
      const h = canvas.height / devicePixelRatio;
      const gapY = 40 + Math.random() * (h - 80 - PIPE_GAP);
      pipes.push({ x: w, gapY, passed:false });
    }

    let lastFrame = performance.now();
    function loop(now){
      const w = canvas.width / devicePixelRatio;
      const h = canvas.height / devicePixelRatio;
      ctx.clearRect(0,0,w,h);
      // frame-rate independent physics: on 120Hz screens the old per-frame step
      // ran everything twice as fast as on 60fps
      const dtF = Math.min(3, Math.max(0, (now - lastFrame) / 16.67));
      lastFrame = now;

      if(running){
        vel += GRAVITY * dtF;
        dotY += vel * dtF;

        pipes.forEach(p => p.x -= PIPE_SPEED * dtF);
        if(pipes.length && pipes[0].x < -PIPE_W) pipes.shift();
        if(pipes.length && pipes[pipes.length-1].x < w - 140) spawnPipe();

        pipes.forEach(p => {
          if(!p.passed && p.x + PIPE_W < 40){
            p.passed = true;
            score++;
            Feedback.tone("select");
            q("#fd-score").textContent = score;
          }
          const dotX = 40;
          const hitX = dotX + 10 > p.x && dotX - 10 < p.x + PIPE_W;
          const hitY = dotY - 10 < p.gapY || dotY + 10 > p.gapY + PIPE_GAP;
          if(hitX && hitY) gameOver();
        });

        if(dotY > h - 10 || dotY < 10) gameOver();
      }

      // draw pipes
      ctx.fillStyle = "#8B7FE8";
      pipes.forEach(p => {
        ctx.fillRect(p.x, 0, PIPE_W, p.gapY);
        ctx.fillRect(p.x, p.gapY + PIPE_GAP, PIPE_W, h - p.gapY - PIPE_GAP);
      });

      // draw dot
      ctx.fillStyle = "#FFB347";
      ctx.beginPath();
      ctx.arc(40, dotY, 9, 0, Math.PI*2);
      ctx.fill();

      rafId = requestAnimationFrame(loop);
    }

    function gameOver(){
      if(!running) return; // a single frame can collide several pipes plus the floor — only end once
      running = false;
      Feedback.buzz("fail");
      hint.textContent = "Tap to try again";
      api.setHighscore(score).then(v => {
        best = v;
        q("#fd-best").textContent = best;
      });
    }

    function flapOrStart(){
      if(!running){
        reset();
        running = true;
        hint.textContent = "";
      }
      Feedback.tone("tap");
      vel = FLAP;
    }

    canvas.addEventListener("mousedown", flapOrStart);
    canvas.addEventListener("touchstart", (e) => { e.preventDefault(); flapOrStart(); }, {passive:false});

    reset();
    loop(performance.now()); // pass a real timestamp — a bare call makes dtF NaN until the second rAF

    // keep geometry aligned when the viewport rotates or resizes
    let resizeTimer = null;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(fitCanvas, 150);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      clearTimeout(resizeTimer);
    };
  }
});
