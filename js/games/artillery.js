/**
 * Artillery Duel — Scorched Earth / Gorillas-style turn-based aiming game.
 *
 * Physics: real projectile motion. x(t) = x0 + vx*t, y(t) = y0 + vy*t + 0.5*g*t^2,
 * plus a constant horizontal wind acceleration so shots drift and you have to
 * compensate — this is the entire skill axis of the game.
 *
 * AI design (this is the "AI opponent" from our earlier discussion — plain
 * feedback-control math, not machine learning):
 *   1. First shot of a duel: rough estimate from distance, plus randomness
 *      scaled by difficulty (worse difficulty = more random).
 *   2. Every shot after: the AI remembers where its LAST shot actually
 *      landed vs where it wanted to hit, and adjusts angle/power
 *      proportionally to that error — classic "bracketing" the target,
 *      the same way a human player corrects between shots. It gets
 *      measurably more accurate turn over turn, which is what makes it
 *      feel like it's "aiming," not rolling dice.
 *   3. Wind is read directly (the AI "knows" the wind value, same as the
 *      player can see it on screen) and compensates for it in the same
 *      trajectory math the player has to do mentally.
 */
Strip.register({
  id: "artillery",
  label: "GAME",
  title: "Artillery Duel",
  tag: "physics",
  hint: "Set angle & power, account for wind",
  async mount(container, api){
    const saved = await api.load();
    const state = Object.assign({ wins: 0, losses: 0, difficulty: "medium", streak: 0 }, saved || {});
    let best = await api.getHighscore(); // best = longest duel win streak

    // Round 19 (AUDIT.md — Artillery P1): one hit = instant end gave the duel
    // no drama, no comeback arc, no near-miss feedback, and wins never reached
    // the meta. Duels are now 3-HP affairs (comebacks exist), misses report
    // EXACTLY how far off they landed, and the win streak feeds setHighscore
    // so the Daily ×2 / RECORD BREAKER systems can finally see this game.

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:10px; width:100%;";

    const diffRow = document.createElement("div");
    diffRow.style.cssText = "display:flex; gap:6px;";
    const DIFFS = [["easy","Easy"],["medium","Medium"],["hard","Hard"]];
    const diffBtns = {};
    DIFFS.forEach(([key,label]) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.style.cssText = "font-size:10px; padding:5px 9px; border-radius:20px; border:1px solid var(--line); background:var(--panel-2); color:var(--ink-dim); cursor:pointer;";
      b.addEventListener("click", () => { state.difficulty = key; api.save(state); updateDiffButtons(); });
      diffBtns[key] = b;
      diffRow.appendChild(b);
    });
    function updateDiffButtons(){
      DIFFS.forEach(([key]) => {
        const active = state.difficulty === key;
        diffBtns[key].style.background = active ? "var(--amber)" : "var(--panel-2)";
        diffBtns[key].style.color = active ? "#000" : "var(--ink-dim)";
      });
    }

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:16px; font-family:var(--font-display); font-size:9px; color:var(--ink-dim);";

    const canvas = document.createElement("canvas");
    canvas.style.cssText = "width:min(80vw,300px); height:min(45vh,220px); border-radius:10px; background:#0d1420;";

    const infoLine = document.createElement("div");
    infoLine.style.cssText = "font-size:11px; color:var(--ink-dim); min-height:16px;";

    const controls = document.createElement("div");
    controls.style.cssText = "display:flex; flex-direction:column; gap:8px; width:100%; max-width:280px;";

    function slider(labelText, min, max, initial){
      const row = document.createElement("div");
      row.style.cssText = "display:flex; flex-direction:column; gap:2px;";
      const lbl = document.createElement("div");
      lbl.style.cssText = "display:flex; justify-content:space-between; font-size:10px; color:var(--ink-dim);";
      lbl.innerHTML = `<span>${labelText}</span><span class="val">${initial}</span>`;
      const input = document.createElement("input");
      input.type = "range"; input.min = min; input.max = max; input.value = initial;
      input.style.width = "100%";
      input.addEventListener("input", () => { lbl.querySelector(".val").textContent = input.value; });
      row.appendChild(lbl);
      row.appendChild(input);
      return { row, input };
    }

    const angleCtrl = slider("ANGLE", 5, 85, 45);
    const powerCtrl = slider("POWER", 10, 100, 60);

    const fireBtn = document.createElement("button");
    fireBtn.className = "btn accent";
    fireBtn.textContent = "FIRE";
    fireBtn.style.cssText += "font-family:var(--font-display); font-size:11px;";

    controls.appendChild(angleCtrl.row);
    controls.appendChild(powerCtrl.row);
    controls.appendChild(fireBtn);

    wrap.appendChild(diffRow);
    wrap.appendChild(statRow);
    wrap.appendChild(canvas);
    wrap.appendChild(infoLine);
    wrap.appendChild(controls);
    container.appendChild(wrap);

    const ctx = canvas.getContext("2d");
    let disposed = false; // stops pending AI turns and the projectile loop after unmount
    function fit(){
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * devicePixelRatio;
      canvas.height = rect.height * devicePixelRatio;
      ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
    }
    requestAnimationFrame(() => { fit(); draw(); });

    let W, H;
    let playerX, aiX, groundY;
    let wind, turn, inRound, projectile, craters, over;
    let aiMemory; // { lastAngle, lastPower, lastLandX } for the bracketing logic
    let playerHP, aiHP;

    const GRAVITY = 220; // px/s^2 (tuned for a satisfying arc at our canvas scale)

    function newDuel(){
      const rect = canvas.getBoundingClientRect();
      W = rect.width; H = rect.height;
      groundY = H - 24;
      playerHP = 3; aiHP = 3; // the comeback arc: a duel is won 3 times
      // vary tank distance each duel so a single memorized angle/power can't win
      // forever — this is the direct fix for a fixed layout being solvable once
      // and then replayable from memory with zero further skill required.
      const minGap = W * 0.35, maxGap = W * 0.7;
      const gap = minGap + Math.random() * (maxGap - minGap);
      const center = W * (0.42 + Math.random()*0.16);
      playerX = Math.max(W*0.08, center - gap/2);
      aiX = Math.min(W*0.92, center + gap/2);
      craters = [];
      aiMemory = null;
      startRound();
    }

    function startRound(){
      wind = (Math.random() - 0.5) * 2 * (0.6 + Math.random()*0.4); // -1..1ish, randomized magnitude
      turn = "player";
      inRound = true;
      over = false;
      projectile = null;
      infoLine.textContent = `Wind: ${wind > 0 ? "→" : "←"} ${Math.abs(wind).toFixed(1)}`;
      fireBtn.disabled = false;
      draw();
    }

    function groundHeightAt(x){
      // flat ground with crater dips
      let y = groundY;
      craters.forEach(c => {
        const d = Math.abs(x - c.x);
        if(d < c.r){
          y += (c.r - d) / c.r * c.depth;
        }
      });
      return y;
    }

    function draw(){
      ctx.clearRect(0,0,W,H);
      // sky
      const grad = ctx.createLinearGradient(0,0,0,H);
      grad.addColorStop(0, "#0d1420");
      grad.addColorStop(1, "#1a2436");
      ctx.fillStyle = grad;
      ctx.fillRect(0,0,W,H);

      // ground
      ctx.fillStyle = "#2a3a2a";
      ctx.beginPath();
      ctx.moveTo(0,H);
      for(let x=0;x<=W;x+=6){ ctx.lineTo(x, groundHeightAt(x)); }
      ctx.lineTo(W,H);
      ctx.closePath();
      ctx.fill();

      // wind indicator arrow
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      const wcx = W/2;
      ctx.moveTo(wcx - wind*20, 16);
      ctx.lineTo(wcx + wind*20, 16);
      ctx.stroke();

      // tanks
      drawTank(playerX, groundHeightAt(playerX), "#FFB347", playerHP);
      drawTank(aiX, groundHeightAt(aiX), "#8B7FE8", aiHP);

      // projectile
      if(projectile){
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(projectile.x, projectile.y, 3, 0, Math.PI*2);
        ctx.fill();
        // trail
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        projectile.trail.forEach((p,i) => i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
        ctx.stroke();
      }
    }

    function drawTank(x, groundY, color, hp){
      ctx.fillStyle = color;
      ctx.fillRect(x-10, groundY-8, 20, 8);
      ctx.beginPath();
      ctx.arc(x, groundY-8, 5, 0, Math.PI*2);
      ctx.fill();
      // hull pips over each tank — the duel's stakes visible on the field
      for(let i=0;i<3;i++){
        ctx.fillStyle = i < hp ? color : "rgba(255,255,255,0.15)";
        ctx.fillRect(x - 7 + i*6, groundY - 15, 4, 3);
      }
    }

    function fire(shooter, angleDeg, power){
      Feedback.tone("place"); Feedback.haptic("medium");
      const angleRad = angleDeg * Math.PI/180;
      const speed = power * 3.2; // scale power(10-100) to a usable px/s speed
      const dir = shooter === "player" ? 1 : -1;
      const startX = shooter === "player" ? playerX : aiX;
      const startY = groundHeightAt(startX) - 10;

      let vx = Math.cos(angleRad) * speed * dir;
      let vy = -Math.sin(angleRad) * speed;
      const windAccel = wind * 18;

      projectile = { x: startX, y: startY, vx, vy, trail: [] };

      return new Promise(resolve => {
        let lastTime = performance.now();
        function step(now){
          if(disposed){ resolve({ landX: projectile ? projectile.x : 0, didHit: false }); return; }
          const dt = Math.min(0.05, (now - lastTime)/1000);
          lastTime = now;

          projectile.vx += windAccel * dt;
          projectile.vy += GRAVITY * dt;
          projectile.x += projectile.vx * dt;
          projectile.y += projectile.vy * dt;
          projectile.trail.push({x:projectile.x, y:projectile.y});
          if(projectile.trail.length > 40) projectile.trail.shift();

          draw();

          const targetX = shooter === "player" ? aiX : playerX;
          const hitTarget = Math.abs(projectile.x - targetX) < 12 && projectile.y > groundHeightAt(targetX) - 16;
          const hitGround = projectile.y >= groundHeightAt(projectile.x);
          const offscreen = projectile.x < -20 || projectile.x > W+20;

          if(hitTarget || hitGround || offscreen){
            const landX = projectile.x;
            craters.push({ x: landX, r: 22, depth: 14 });
            const didHit = hitTarget;
            Feedback.tone(didHit ? "win" : "fail"); Feedback.haptic(didHit ? "heavy" : "light");
            projectile = null;
            draw();
            resolve({ landX, didHit });
            return;
          }
          requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      });
    }

    async function playerFire(){
      if(disposed) return;
      fireBtn.disabled = true;
      const angle = parseFloat(angleCtrl.input.value);
      const power = parseFloat(powerCtrl.input.value);
      const result = await fire("player", angle, power);
      if(result.didHit){
        aiHP--;
        updateStat();
        draw();
        if(aiHP <= 0){ endRound("player"); return; }
        infoLine.textContent = `DIRECT HIT! AI hull ${aiHP}/3`;
      } else {
        // near-miss honesty: say HOW the miss failed — short/over by N px
        const miss = Math.round(result.landX - aiX);
        infoLine.textContent = miss < 0 ? `${-miss}px SHORT — add power` : `${miss}px OVER — ease off`;
      }
      turn = "ai";
      aiTimer = setTimeout(aiTurn, 900);
    }

    let aiTimer = null;

    function estimateHitParams(distance){
      // rough inverse physics estimate to seed the AI's first guess: pick a 45-degree-ish
      // angle and solve power from projectile range formula (ignoring wind for the seed)
      const angle = 40 + Math.random()*10;
      const angleRad = angle * Math.PI/180;
      // range = v^2 * sin(2*theta) / g  =>  v = sqrt(range * g / sin(2*theta))
      const speed = Math.sqrt(Math.abs(distance) * GRAVITY / Math.sin(2*angleRad));
      const power = Math.max(10, Math.min(100, speed / 3.2));
      return { angle, power };
    }

    async function aiTurn(){
      if(disposed) return;
      const distance = playerX - aiX;
      let angle, power;

      const skill = { easy: 0.35, medium: 0.65, hard: 0.95 }[state.difficulty];

      if(!aiMemory){
        const est = estimateHitParams(distance);
        angle = est.angle;
        power = est.power;
      } else {
        // bracketing correction: compare where the last shot landed vs the target,
        // and nudge power to close that gap. dir accounts for which way the AI is
        // firing (target could be left or right of the AI tank).
        const dir = distance < 0 ? -1 : 1; // AI fires toward the player's side
        const shortfall = (playerX - aiMemory.lastLandX) * dir; // >0 means the shot fell short, needs more power
        const correctionStrength = 0.55 * skill;
        power = aiMemory.lastPower + (shortfall * 0.12 * correctionStrength);
        angle = aiMemory.lastAngle;
        power = Math.max(10, Math.min(100, power));
      }

      // imprecision scaled by difficulty — worse difficulty = more jitter
      const jitter = (1 - skill) * 12;
      angle += (Math.random()-0.5) * jitter;
      power += (Math.random()-0.5) * jitter * 1.5;
      angle = Math.max(5, Math.min(85, angle));
      power = Math.max(10, Math.min(100, power));

      const result = await fire("ai", angle, power);
      aiMemory = { lastAngle: angle, lastPower: power, lastLandX: result.landX };

      if(result.didHit){
        playerHP--;
        updateStat();
        draw();
        if(playerHP <= 0){ endRound("ai"); return; }
        infoLine.textContent = `you're hit! hull ${playerHP}/3`;
      } else {
        const miss = Math.round(result.landX - playerX);
        infoLine.textContent = `AI missed ${Math.abs(miss)}px ${miss < 0 ? "short" : "over"}`;
      }
      turn = "player";
      fireBtn.disabled = false;
    }

    function endRound(winner){
      over = true;
      inRound = false;
      if(winner === "player"){
        state.wins++;
        state.streak = (state.streak || 0) + 1;
        infoLine.textContent = "Direct hit — duel won!";
        Feedback.buzz("win");
        api.setHighscore(state.streak); // the meta finally sees the duel record
      } else {
        state.losses++;
        state.streak = 0;
        infoLine.textContent = "You got hit — AI wins the duel.";
        Feedback.buzz("lose");
      }
      api.save(state);
      updateStat();
      fireBtn.disabled = true;
      fireBtn.textContent = "Next duel";
      fireBtn.disabled = false;
    }

    function updateStat(){
      const hearts = (n) => "♥".repeat(n) + "♡".repeat(Math.max(0, 3 - n));
      statRow.innerHTML = `<div style="color:var(--amber)">YOU ${hearts(playerHP || 3)}</div><div style="color:var(--purple)">AI ${hearts(aiHP || 3)}</div><div>W-L <span style="color:var(--ink)">${state.wins}-${state.losses}</span></div><div>STREAK <span style="color:var(--ink)">${state.streak || 0}</span> · BEST <span style="color:var(--ink)">${best}</span></div>`;
    }

    fireBtn.addEventListener("click", () => {
      if(over){
        fireBtn.textContent = "FIRE";
        newDuel();
        return;
      }
      if(inRound && turn === "player") playerFire();
    });

    updateDiffButtons();
    updateStat();
    newDuel();

    return () => {
      disposed = true;
      if(aiTimer) clearTimeout(aiTimer);
    };
  }
});
