Strip.register({
  id: "stacktower",
  label: "REFLEX",
  title: "Stack Tower",
  tag: "precision",
  hint: "Tap to drop the block — stack as high as you can",
  async mount(container, api){
    // lookups scoped to THIS card — duplicate ids across two copies of a
    // cartridge coexist briefly in the strip, and getElementById could
    // update the stale copy instead of the visible one
    const q = (sel) => container.querySelector(sel);
    let best = await api.getHighscore();

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:10px; width:100%; position:relative;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:20px; font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    statRow.innerHTML = `<div>HEIGHT <span id="st-score" style="color:var(--amber)">0</span></div><div>BEST <span id="st-best" style="color:var(--purple)">${best}</span></div>`;
    wrap.appendChild(statRow);

    const canvas = document.createElement("canvas");
    canvas.style.cssText = "background:#12121a; border-radius:12px; width:min(70vw,240px); height:min(55vh,340px); touch-action:none;";
    wrap.appendChild(canvas);

    const hint = document.createElement("div");
    hint.style.cssText = "font-size:11px; color:var(--ink-dim);";
    hint.textContent = "Tap to start";
    wrap.appendChild(hint);

    container.appendChild(wrap);

    const ctx = canvas.getContext("2d");
    function fit(){
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * devicePixelRatio;
      canvas.height = rect.height * devicePixelRatio;
      ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
    }
    requestAnimationFrame(fit);

    const COLORS = ["#FFB347","#8B7FE8","#E8637F","#6FCF97","#56B4E9"];
    let blocks, current, running, rafId, score, camY;
    let perfectStreak = 0; // consecutive dead-center drops (width regen every 3)

    // PERFECT banner — one shared node, replaced per call
    let stBannerTimer = null;
    function showSt(text){
      let t = canvas.parentElement.querySelector(".st-banner");
      if(!t){
        t = document.createElement("div");
        t.className = "st-banner";
        t.style.cssText = "position:absolute; left:0; right:0; top:30%; text-align:center; font-family:var(--font-display); font-size:15px; color:#6FCF97; letter-spacing:2px; pointer-events:none; text-shadow:0 2px 8px rgba(0,0,0,.7);";
        canvas.parentElement.appendChild(t);
      }
      t.textContent = text;
      t.style.opacity = "1";
      clearTimeout(stBannerTimer);
      stBannerTimer = setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .4s"; }, 800);
    }
    const BLOCK_H = 22;

    function reset(){
      const w = canvas.width / devicePixelRatio;
      blocks = [{ x: w/2 - 40, w: 80, colorIdx: 0 }];
      current = null;
      running = false;
      score = 0;
      camY = 0;
      q("#st-score").textContent = 0;
    }

    function spawnBlock(){
      const w = canvas.width / devicePixelRatio;
      const prev = blocks[blocks.length - 1];
      const dir = Math.random() < 0.5 ? -1 : 1;
      // Round 19 (S3): speed ramps with height (2.6 → 4.6 px/frame by 40 blocks),
      // so a tower run keeps escalating instead of flat-lining at one pace
      const speed = Math.min(4.6, 2.6 + blocks.length * 0.05);
      current = {
        // spawn INSIDE the canvas, flush with the chosen wall. The old version
        // spawned fully offscreen (x = -prev.w or x = w), where the wall-bounce
        // condition (x <= 0 || x + w >= w) was already true — so vx flipped on
        // frame one and the block sat oscillating at the edge, invisible and
        // unplayable, until the next tap measured ~zero overlap and ended the run.
        x: dir > 0 ? 0 : w - prev.w,
        w: prev.w,
        vx: dir > 0 ? speed : -speed,
        colorIdx: blocks.length % COLORS.length,
      };
    }

    function drop(){
      if(!running){
        running = true;
        hint.textContent = "";
        spawnBlock();
        return;
      }
      if(!current) return;
      const prev = blocks[blocks.length - 1];
      const overlapLeft = Math.max(current.x, prev.x);
      const overlapRight = Math.min(current.x + current.w, prev.x + prev.w);
      const overlap = overlapRight - overlapLeft;

      if(overlap <= 4){
        Feedback.buzz("lose");
        gameOver();
        return;
      }

      blocks.push({ x: overlapLeft, w: overlap, colorIdx: current.colorIdx });
      Feedback.tone("place"); Feedback.haptic("light");
      score++;
      // PERFECT-drop streak: a dead-center stack (+2 pts, +2 width regen every
      // 3 in a row) — the genre's best compulsion trick, and the answer to the
      // audit's "width only ever shrinks"
      const perfect = Math.abs(current.x - prev.x) <= 2;
      if(perfect){
        perfectStreak++;
        score += 2;
        if(perfectStreak % 3 === 0){
          const top = blocks[blocks.length - 1];
          top.w = Math.min(top.w + 2, canvas.width / devicePixelRatio - 4);
          showSt("PERFECT ×" + perfectStreak + " +width!");
          Feedback.buzz("success");
        }
      } else {
        perfectStreak = 0;
      }
      q("#st-score").textContent = score;
      current = null;
      if(blocks.length * BLOCK_H > (canvas.height/devicePixelRatio) * 0.6){
        camY += BLOCK_H;
      }
      setTimeout(spawnBlock, 120);
    }

    function gameOver(){
      running = false;
      hint.textContent = "Tap to try again";
      api.setHighscore(score).then(v => {
        best = v;
        q("#st-best").textContent = best;
      });
    }

    let lastFrame = performance.now();
    function loop(now){
      const w = canvas.width / devicePixelRatio;
      const h = canvas.height / devicePixelRatio;
      ctx.clearRect(0,0,w,h);
      // frame-rate independent physics
      const dtF = Math.min(3, Math.max(0, (now - lastFrame) / 16.67));
      lastFrame = now;

      if(current){
        current.x += current.vx * dtF;
        if(current.x <= 0 || current.x + current.w >= w) current.vx *= -1;
      }

      // draw stack from bottom up, offset by camY once we scroll
      const baseY = h - 30;
      blocks.forEach((b, i) => {
        const y = baseY - i*BLOCK_H + camY;
        if(y < -BLOCK_H || y > h) return;
        ctx.fillStyle = COLORS[b.colorIdx];
        ctx.fillRect(b.x, y, b.w, BLOCK_H - 3);
      });

      if(current){
        const y = baseY - blocks.length*BLOCK_H + camY;
        ctx.fillStyle = COLORS[current.colorIdx];
        ctx.fillRect(current.x, y, current.w, BLOCK_H - 3);
      }

      rafId = requestAnimationFrame(loop);
    }

    // Single unified tap handler for both mouse and touch — registering separate
    // mousedown AND touchstart listeners on the same element causes a real bug on
    // touch devices: a physical tap fires touchstart immediately, then the browser
    // often still synthesizes a following mousedown a moment later even when
    // preventDefault was called. That means one tap was silently triggering drop()
    // TWICE — the first call spawned a block, and the second (from the synthetic
    // mousedown) immediately locked it in place at its spawn position before the
    // player ever saw it moving, which is exactly what looked like "the next block
    // places itself at spawn."
    function handleTap(e){
      if(e.cancelable) e.preventDefault();
      if(!running){ reset(); running = true; hint.textContent = ""; spawnBlock(); return; }
      drop();
    }
    canvas.addEventListener("touchstart", handleTap, {passive:false});
    canvas.addEventListener("mousedown", (e) => {
      // ignore synthetic mouse events that mobile browsers fire after a real touch
      if(e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
      handleTap(e);
    });

    reset();
    rafId = requestAnimationFrame(loop);

    // keep geometry aligned when the viewport rotates or resizes
    let resizeTimer = null;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(fit, 150);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      clearTimeout(resizeTimer);
    };
  }
});
