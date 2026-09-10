Strip.register({
  id: "pongduel",
  label: "ARCADE",
  title: "Pong Duel",
  tag: "first to 7",
  hint: "Drag to move your paddle",
  async mount(container, api){
    const saved = await api.load();
    let streak = saved && Number.isFinite(saved.streak) ? saved.streak : 0; // wins in a row
    const W = 240, H = 160, PW = 5, PH = 34, WIN = 7;
    const AI_SPEED = 2.05; // capped below ball speed — beatable but honest

    let you = 0, ai = 0, running = false, rafId = null, lastTs = 0;
    let py = (H - PH) / 2, ay = (H - PH) / 2, target = py;
    let ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, speed: 3 };

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:10px;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:20px; font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    wrap.appendChild(statRow);

    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    canvas.style.cssText = "width:min(76vw,264px); height:auto; border-radius:10px; background:#101018; touch-action:none; display:block;";
    wrap.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    const startBtn = document.createElement("button");
    startBtn.className = "btn accent";
    startBtn.textContent = "Start match";
    startBtn.addEventListener("click", startMatch);
    wrap.appendChild(startBtn);

    container.appendChild(wrap);

    function statUpdate(){
      statRow.innerHTML = `<div>YOU <span style="color:var(--amber)">${you}</span></div><div>AI <span style="color:var(--purple)">${ai}</span></div><div>STREAK <span style="color:var(--ink-dim)">${streak}</span></div>`;
    }

    function serve(dir){
      ball.x = W / 2; ball.y = H / 2;
      ball.speed = 3;
      const ang = (Math.random() * 0.6 - 0.3);
      ball.vx = Math.cos(ang) * ball.speed * dir;
      ball.vy = Math.sin(ang) * ball.speed;
    }

    function startMatch(){
      you = 0; ai = 0;
      running = true;
      startBtn.disabled = true;
      startBtn.textContent = "First to 7…";
      statUpdate();
      serve(Math.random() < 0.5 ? 1 : -1);
      lastTs = 0;
      rafId = requestAnimationFrame(tick);
    }

    function endMatch(winner){
      running = false;
      cancelAnimationFrame(rafId);
      startBtn.disabled = false;
      startBtn.textContent = winner === 1 ? "You win — rematch" : "AI wins — rematch";
      Feedback.buzz(winner === 1 ? "win" : "lose");
      if(winner === 1){ streak++; } else { streak = 0; }
      api.save({ streak });
      statUpdate();
    }

    function tick(ts){
      if(!running) return;
      if(!lastTs) lastTs = ts;
      const dt = Math.min((ts - lastTs) / 16.667, 3);
      lastTs = ts;
      step(dt);
      draw();
      rafId = requestAnimationFrame(tick);
    }

    function step(dt){
      // player paddle follows the drag target with a speed cap so flicks aren't teleports
      const pd = target - (py + PH / 2);
      py += Math.max(-6, Math.min(6, pd)) * dt;
      py = Math.max(0, Math.min(H - PH, py));

      // AI: track the ball with a deadzone — perfect tracking would be unwinnable
      const aim = ball.vx > 0 ? ball.y : H / 2;
      const ad = aim - (ay + PH / 2);
      if(Math.abs(ad) > 3) ay += Math.sign(ad) * AI_SPEED * dt;
      ay = Math.max(0, Math.min(H - PH, ay));

      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      if(ball.y < 3){ ball.y = 3; ball.vy = Math.abs(ball.vy); }
      if(ball.y > H - 3){ ball.y = H - 3; ball.vy = -Math.abs(ball.vy); }

      // player paddle at x=8
      if(ball.vx < 0 && ball.x - 3 <= 8 + PW && ball.x - 3 >= 8 - 4 &&
         ball.y >= py - 3 && ball.y <= py + PH + 3){
        ball.speed = Math.min(ball.speed * 1.06, 5.5);
        const rel = (ball.y - (py + PH / 2)) / (PH / 2);
        const ang = rel * 0.9;
        ball.vx = Math.cos(ang) * ball.speed;
        ball.vy = Math.sin(ang) * ball.speed;
        ball.x = 8 + PW + 4;
        Feedback.tone("blip"); Feedback.haptic("light");
      }
      // AI paddle at x=W-8-PW
      if(ball.vx > 0 && ball.x + 3 >= W - 8 - PW && ball.x + 3 <= W - 8 + 4 &&
         ball.y >= ay - 3 && ball.y <= ay + PH + 3){
        ball.speed = Math.min(ball.speed * 1.06, 5.5);
        const rel = (ball.y - (ay + PH / 2)) / (PH / 2);
        const ang = rel * 0.9;
        ball.vx = -Math.cos(ang) * ball.speed;
        ball.vy = Math.sin(ang) * ball.speed;
        ball.x = W - 8 - PW - 4;
        Feedback.tone("blip");
      }

      if(ball.x < -6){
        ai++;
        statUpdate();
        if(ai >= WIN){ endMatch(2); return; }
        Feedback.tone("thud");
        serve(1);
      }
      if(ball.x > W + 6){
        you++;
        statUpdate();
        if(you >= WIN){ endMatch(1); return; }
        Feedback.tone("ok");
        serve(-1);
      }
    }

    function draw(){
      ctx.clearRect(0, 0, W, H);
      // center line
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = "rgba(237,234,227,.2)";
      ctx.beginPath();
      ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#FFB347";
      ctx.fillRect(8, py, PW, PH);
      ctx.fillStyle = "#8B7FE8";
      ctx.fillRect(W - 8 - PW, ay, PW, PH);
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#EDEAE3";
      ctx.fill();
      if(!running){
        ctx.fillStyle = "rgba(237,234,227,.6)";
        ctx.font = "9px monospace";
        ctx.textAlign = "center";
        ctx.fillText("PRESS START", W / 2, H / 2 + 4);
      }
    }

    function pointerToY(e){
      const rect = canvas.getBoundingClientRect();
      const y = ((e.clientY - rect.top) / rect.height) * H;
      target = Math.max(PH / 2, Math.min(H - PH / 2, y));
    }
    canvas.addEventListener("pointerdown", pointerToY);
    canvas.addEventListener("pointermove", (e) => { if(e.buttons || e.pointerType === "touch") pointerToY(e); });

    statUpdate();
    draw();

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
    };
  }
});
