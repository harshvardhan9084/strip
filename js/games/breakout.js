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
    canvas.style.cssText = "width:min(70vw,240px); height:auto; aspect-ratio:240/320; border-radius:10px; background:#101018; touch-action:none; display:block;";
    wrap.appendChild(canvas);
    const ctx = canvas.getContext("2d");

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
      for(let r = 0; r < rows; r++){
        for(let c = 0; c < COLS; c++){
          bricks.push({ x: c * (BW + GAP) + 4, y: r * (BH + GAP) + 22, w: BW, h: BH, alive: true, row: r });
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
          b.alive = false;
          score += 10 * level;
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
      api.setHighscore(score).then(v => { best = v; statUpdate(); });
    }

    function draw(){
      ctx.clearRect(0, 0, W, H);
      for(const b of bricks){
        if(!b.alive) continue;
        ctx.fillStyle = ROW_COLORS[b.row % ROW_COLORS.length];
        ctx.fillRect(b.x, b.y, b.w, b.h);
      }
      ctx.fillStyle = "#EDEAE3";
      ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fillStyle = "#FFB347";
      ctx.fill();
      if(!running){
        ctx.fillStyle = "rgba(237,234,227,.6)";
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
      clearTimeout(resizeTimer);
    };
  }
});
