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

    // R36 — the stat row is SHELL-OWNED now (api.setStats): one slot between
    // title and playfield, one type scale, tabular nums, <=4 stats. The old
    // header's span ids live on as value keys so update sites stay one-liners.
    const statVals = {
      "fd-score": "0",
      "fd-best": String(best),
    };
    const STAT_KEYS = [
      ["fd-score", "SCORE", "var(--amber)", null],
      ["fd-best", "BEST", "var(--purple)", null],
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
    canvas.style.cssText = "background:var(--screen, #12121a); border-radius:12px; touch-action:none; width:min(70vw,240px); height:min(50vh,320px);";
    wrap.appendChild(canvas);

    // R33 — daylight-screen ink (undefined in dark/OLED -> raw fallbacks);
    // re-resolved when the chassis flips mid-mount via strip:mode-changed.
    const _sv = getComputedStyle(document.documentElement);
    let INK_RGB = _sv.getPropertyValue("--screen-ink-rgb").trim() || "237,234,227";
    let LIGHT = document.documentElement.dataset.mode === "light";
    const onModeChanged = () => {
      INK_RGB = _sv.getPropertyValue("--screen-ink-rgb").trim() || "237,234,227";
      LIGHT = document.documentElement.dataset.mode === "light";
    };
    window.addEventListener("strip:mode-changed", onModeChanged);

    // R35 single-hint rule: the in-card "Tap the canvas to start" duplicated
    // the shell hint — removed. The death moment's retry invitation is the
    // ceremony panel's verb now.
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
    const GRAVITY = 0.35, FLAP = -6, PIPE_W = 34;
    // Round 19 (S3): gap 90→70 and speed 2.2→3.0 as the score climbs — a 50
    // run and a 5 run finally play differently
    function currentGap(){ return Math.max(70, 90 - score * 0.4); }
    function currentSpeed(){ return Math.min(3.0, 2.2 + score * 0.016); }

    function reset(){
      dotY = 100; vel = 0; pipes = []; score = 0; running = false;
      statVals["fd-score"] = 0; renderStats();
      spawnPipe();
    }

    function spawnPipe(){
      const w = canvas.width / devicePixelRatio;
      const h = canvas.height / devicePixelRatio;
      const gapY = 40 + Math.random() * (h - 80 - currentGap());
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

        pipes.forEach(p => p.x -= currentSpeed() * dtF);
        if(pipes.length && pipes[0].x < -PIPE_W) pipes.shift();
        if(pipes.length && pipes[pipes.length-1].x < w - 140) spawnPipe();

        pipes.forEach(p => {
          if(!p.passed && p.x + PIPE_W < 40){
            p.passed = true;
            score++;
            Feedback.tone("select");
            statVals["fd-score"] = score; renderStats();
          }
          const dotX = 40;
          const hitX = dotX + 10 > p.x && dotX - 10 < p.x + PIPE_W;
          const GAP = currentGap();
          const hitY = dotY - 10 < p.gapY || dotY + 10 > p.gapY + GAP;
          if(hitX && hitY) gameOver();
        });

        if(dotY > h - 10 || dotY < 10) gameOver();
      }

      // draw pipes
      ctx.fillStyle = "#8B7FE8";
      pipes.forEach(p => {
        ctx.fillRect(p.x, 0, PIPE_W, p.gapY);
        ctx.fillRect(p.x, p.gapY + currentGap(), PIPE_W, h - p.gapY - currentGap());
      });

      // draw dot
      ctx.fillStyle = "#FFB347";
      ctx.beginPath();
      ctx.arc(40, dotY, 9, 0, Math.PI*2);
      ctx.fill();
      // R33 daylight detail: ink ring on the daylight glass; dark untouched.
      if(LIGHT){
        ctx.strokeStyle = `rgba(${INK_RGB},.55)`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      rafId = requestAnimationFrame(loop);
    }

    function gameOver(){
      if(!running) return; // a single frame can collide several pipes plus the floor — only end once
      running = false;
      Feedback.buzz("fail");
      const prevBest = best;
api.gameover("over", score);
      api.setHighscore(score).then(v => {
        best = v;
        statVals["fd-best"] = best; renderStats();
      });
      // R35 ceremony adoption: death used to be an 11px line at the field's
      // bottom edge — the standard panel carries the run out, centered.
      RunCeremony.show(container, {
        tone: "over",
        label: "DOWN",
        score: score,
        unit: "bars",
        delta: score > prevBest ? "NEW BEST" : (prevBest ? "BEST " + prevBest : ""),
        deltaTone: score > prevBest ? "good" : "",
        verb: "FLY AGAIN",
        onVerb: flapOrStart,
      });
    }

    function flapOrStart(){
      if(!running){
        RunCeremony.hide(container); // tapping the glass skips the flourish
        reset();
        running = true;
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
      window.removeEventListener("strip:mode-changed", onModeChanged);
      clearTimeout(resizeTimer);
    };
  }
});
