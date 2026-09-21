Strip.register({
  id: "breakout",
  label: "ARCADE",
  title: "Breakout",
  tag: "3 lives",
  hint: "Drag to move the paddle · clear the wall",
  async mount(container, api){
    let best = await api.getHighscore();
    const W = 240, H = 320;
    const COLS = 7, BW = 30, BH = 12, GAP = 3;
    const ROW_COLORS = ["#FFB347", "#E8637F", "#8B7FE8", "#5AC98A", "#6FA8FF"];

    let score, lives, level, bricks, running, rafId, lastTs;
    let paddle = { w: 52, x: W / 2 - 26, h: 8, y: H - 22 };
    let ball = { x: 0, y: 0, r: 4, vx: 0, vy: 0, speed: 3 };

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:10px;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:18px; font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    wrap.appendChild(statRow);

    const canvas = document.createElement("canvas");
    // R33 daylight screens: glass follows the chassis (light-only token);
    // dark keeps the raw hex via the var() fallback.
    canvas.style.cssText = "width:min(70vw,240px); height:auto; aspect-ratio:240/320; border-radius:10px; background:var(--screen, #101018); touch-action:none; display:block;";
    wrap.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    // R33 — daylight ink resolved from the light-only tokens (dark falls
    // back to the raw CRT values); re-resolved on a mid-mount chassis flip.
    const _sv = getComputedStyle(document.documentElement);
    let INK = _sv.getPropertyValue("--screen-ink").trim() || "#EDEAE3";
    let INK_RGB = _sv.getPropertyValue("--screen-ink-rgb").trim() || "237,234,227";
    let LIGHT = document.documentElement.dataset.mode === "light";
    const onModeChanged = () => {
      INK = _sv.getPropertyValue("--screen-ink").trim() || "#EDEAE3";
      INK_RGB = _sv.getPropertyValue("--screen-ink-rgb").trim() || "237,234,227";
      LIGHT = document.documentElement.dataset.mode === "light";
    };
    window.addEventListener("strip:mode-changed", onModeChanged);

    // DPR-aware backing store — without this the canvas renders at 240x320
    // physical pixels and looks visibly blurrier than its DPR-aware neighbors
    function fit(){
      const rect = canvas.getBoundingClientRect();
      if(!rect.width) return;
      const dpr = Math.min(2.5, window.devicePixelRatio || 1);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.width * dpr * (H / W));
      ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    }
    // layout must exist before measuring — fit after first paint
    requestAnimationFrame(fit);

    const startBtn = document.createElement("button");
    startBtn.className = "btn accent";
    startBtn.textContent = "Start";
    startBtn.addEventListener("click", launch);
    wrap.appendChild(startBtn);

    container.appendChild(wrap);

    function statUpdate(){
      statRow.innerHTML = `<div>SCORE <span style="color:var(--amber)">${score}</span></div><div>LIVES <span style="color:var(--danger)">${"♥".repeat(lives) || "—"}</span></div><div>BEST <span style="color:var(--purple)">${best}</span></div>`;
    }

    function buildWall(){
      bricks = [];
      const rows = Math.min(5, 4 + Math.floor(level / 2));
      // Round 22 (P2 tail): HP tiers. From level 2 the top row takes TWO
      // hits, from level 4 the top two rows take THREE — the wall gains
      // armor as you climb, so late levels are a siege instead of a sweep.
      // Every hit pays (10 × level), the shatter pays a bonus, and damaged
      // bricks visibly dim so the plan of attack reads at a glance.
      const hpFor = (r) => 1 + (level >= 2 && r === 0 ? 1 : 0) + (level >= 4 && r <= 1 ? 1 : 0);
      for(let r = 0; r < rows; r++){
        for(let c = 0; c < COLS; c++){
          const hp = hpFor(r);
          bricks.push({ x: c * (BW + GAP) + 4, y: r * (BH + GAP) + 22, w: BW, h: BH, alive: true, row: r, hp, maxHp: hp });
        }
      }
    }

    function resetBall(){
      ball.x = W / 2; ball.y = H - 40;
      ball.speed = 3 + Math.min(2.5, (level - 1) * 0.4);
      // serve upward at a slight random angle — straight vertical serves are dull
      const ang = (Math.random() * 0.5 - 0.25);
      ball.vx = Math.sin(ang) * ball.speed;
      ball.vy = -Math.cos(ang) * ball.speed;
    }

    function launch(){
      if(running) return;
      // fresh match only when the last one is over — otherwise resume this run
      if(lives <= 0) startGame();
      running = true;
      startBtn.disabled = true;
      startBtn.textContent = "Playing…";
      resetBall();
      lastTs = 0;
      rafId = requestAnimationFrame(tick);
    }

    function startGame(){
      score = 0; lives = 3; level = 1;
      buildWall();
      statUpdate();
    }

    function tick(ts){
      if(!running) return;
      if(!lastTs) lastTs = ts;
      // dt in frame-units, clamped so a tab-switch spike can't teleport the ball
      const dt = Math.min((ts - lastTs) / 16.667, 3);
      lastTs = ts;
      step(dt);
      draw();
      rafId = requestAnimationFrame(tick);
    }

    function step(dt){
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      if(ball.x < ball.r){ ball.x = ball.r; ball.vx = Math.abs(ball.vx); Feedback.tone("tap"); }
      if(ball.x > W - ball.r){ ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); Feedback.tone("tap"); }
      if(ball.y < ball.r + 14){ ball.y = ball.r + 14; ball.vy = Math.abs(ball.vy); Feedback.tone("tap"); }

      // paddle bounce — hit offset steers the angle, like the arcade original
      if(ball.vy > 0 &&
         ball.y + ball.r >= paddle.y && ball.y + ball.r <= paddle.y + paddle.h + 6 &&
         ball.x >= paddle.x - ball.r && ball.x <= paddle.x + paddle.w + ball.r){
        const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2); // -1..1
        ball.speed = Math.min(ball.speed * 1.02 + 0.02, 6);
        ball.vx = hit * ball.speed * 0.75;
        ball.vy = -Math.sqrt(Math.max(ball.speed * ball.speed - ball.vx * ball.vx, 1));
        ball.y = paddle.y - ball.r;
        Feedback.tone("blip"); Feedback.haptic("light");
      }

      // brick collisions (AABB, resolve by shallower overlap axis)
      for(const b of bricks){
        if(!b.alive) continue;
        if(ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w &&
           ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h){
          b.hp--;
          score += 10 * level; // every hit pays — armored bricks are worth the siege
          if(b.hp <= 0){ b.alive = false; score += 5; }
          statUpdate();
          Feedback.tone("ok");
          const overlapX = Math.min(ball.x + ball.r - b.x, b.x + b.w - (ball.x - ball.r));
          const overlapY = Math.min(ball.y + ball.r - b.y, b.y + b.h - (ball.y - ball.r));
          if(overlapX < overlapY) ball.vx = -ball.vx; else ball.vy = -ball.vy;
          break;
        }
      }

      if(bricks.every(b => !b.alive)){
        level++;
        score += 50;
        buildWall();
        resetBall();
        statUpdate();
      }

      if(ball.y > H + ball.r * 2){
        lives--;
        statUpdate();
        if(lives <= 0){
          gameOver();
        } else {
          Feedback.buzz("lose");
          resetBall();
        }
      }
    }

    function gameOver(){
      running = false;
      cancelAnimationFrame(rafId);
      Feedback.buzz("lose");
      startBtn.disabled = false;
      startBtn.textContent = "Wall won — retry";
      const prevBest = best;
api.gameover("over", score);
      api.setHighscore(score).then(v => { best = v; statUpdate(); });
      // R34: the bare text swaps for the standard end-of-run panel —
      // same ceremony as LEVEL UP, with the run's numbers and one verb.
      RunCeremony.show(container, {
        tone: "over",
        label: "THE WALL WON",
        score: score,
        unit: "points",
        delta: score > prevBest ? "NEW BEST" : (prevBest ? "BEST " + prevBest : ""),
        deltaTone: score > prevBest ? "good" : "",
        verb: "RETRY",
        onVerb: launch,
      });
    }

    function draw(){
      ctx.clearRect(0, 0, W, H);
      for(const b of bricks){
        if(!b.alive) continue;
        // damaged bricks dim toward their last hit — the wall shows its scars
        ctx.globalAlpha = 0.45 + 0.55 * (b.hp / b.maxHp);
        ctx.fillStyle = ROW_COLORS[b.row % ROW_COLORS.length];
        ctx.fillRect(b.x, b.y, b.w, b.h);
        if(b.maxHp > 1){
          ctx.globalAlpha = 1;
          ctx.strokeStyle = "rgba(0,0,0,.45)";
          ctx.lineWidth = 1;
          ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
          // armor pips: one notch per extra hit the brick can still take
          ctx.fillStyle = "rgba(0,0,0,.5)";
          for(let k = 0; k < b.hp - 1 && k < 2; k++) ctx.fillRect(b.x + 3 + k * 5, b.y + b.h - 4, 3, 2);
        }
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = INK;
      ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fillStyle = "#FFB347";
      ctx.fill();
      // R33 daylight detail: thin ink ring around the raw amber ball on the
      // daylight glass; dark keeps the pure phosphor look.
      if(LIGHT){
        ctx.strokeStyle = `rgba(${INK_RGB},.55)`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      if(!running){
        ctx.fillStyle = `rgba(${INK_RGB},.6)`;
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(lives > 0 ? "PRESS START" : "GAME OVER", W / 2, H / 2 - 20);
      }
    }

    function pointerToX(e){
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * W;
      paddle.x = Math.max(0, Math.min(W - paddle.w, x - paddle.w / 2));
    }
    canvas.addEventListener("pointerdown", pointerToX);
    canvas.addEventListener("pointermove", (e) => { if(e.buttons || e.pointerType === "touch") pointerToX(e); });

    startGame();
    running = false;
    draw();

    // refit the backing store on rotation/resize (debounced, like Bubble Shooter)
    let resizeTimer = null;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(fit, 150);
    };
    window.addEventListener("resize", onResize);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("strip:mode-changed", onModeChanged);
      clearTimeout(resizeTimer);
    };
  }
});
