/**
 * Perfect Ring — NEW in Round 21 (user ask: "make 'perfect ring' game —
 * click to begin").
 *
 * The deck's purest rush loop: a dot orbits a ring; a target arc sits
 * somewhere on it; tap the instant the dot is inside the arc. Every hit
 * REVERSES the orbit, speeds it up, shrinks the arc, and moves it — so the
 * next window is always tighter and always somewhere new. Dead-center hits
 * pay PERFECT (+2). Round 22 (user ask: "let it circle continuously — don't
 * fail just on the first rotation"): a miss no longer ends the run. You
 * carry three hearts; a full lap through the arc or an early tap burns ONE
 * heart and the orbit keeps spinning — the run ends only when the last
 * heart drops. The rush now has room to breathe, and long runs feel like
 * survival instead of a coin flip on rotation one.
 *
 * Emotion mapping: RUSH (orbit speed ramps), DOPAMINE (PERFECT floats +
 * rising pitch + milestone fanfares), COMPULSION (tap-to-retry restart),
 * PROGRESSION (best score feeds the shell's XP engine for free via
 * setHighscore — no special wiring, it's the same api every game gets).
 *
 * Click-to-begin: the card opens on a dim ring with a pulsing prompt —
 * nothing moves until the player commits. Starting mid-focus is the
 * whole game, so the first input IS the commitment.
 */
Strip.register({
  id: "perfectring",
  label: "REFLEX",
  title: "Perfect Ring",
  tag: "1-tap",
  hint: "Tap when the dot crosses the bright arc · dead center = PERFECT",
  async mount(container, api){
    let best = await api.getHighscore();

    const SIZE = 240;            // logical canvas size (CSS-scaled down on small cards)
    const CX = SIZE / 2, CY = SIZE / 2;
    const R = SIZE / 2 - 26;     // orbit radius
    const DOT_R = 9;

    // difficulty ramp — clamped so the game gets frantic, not unfair
    const START_SPEED = 1.15;    // revolutions per second
    const MAX_SPEED = 2.6;
    const SPEED_GROWTH = 1.035;  // per hit
    const START_ARC = 52 * Math.PI / 180;
    const MIN_ARC = 22 * Math.PI / 180;
    const ARC_SHRINK = 0.985;    // per hit
    const PERFECT_FRACTION = 0.4; // center 40% of the arc = PERFECT

    const COLORS = {
      ring: "#23232E",
      ringLit: "#3A3A4A",
      dot: "#EDEAE3",
      arc: "#FFB347",
      arcGlow: "rgba(255,179,71,.35)",
      perfect: "#6FCF97",
      danger: "#E8637F",
      dim: "#8B8A94",
    };

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:10px;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:20px; font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    statRow.innerHTML = `<div>SCORE <span id="pr-score" style="color:var(--amber)">0</span></div><div>BEST <span id="pr-best" style="color:var(--purple)">${best}</span></div><div>LIVES <span id="pr-lives" style="color:var(--danger)">♥♥♥</span></div>`;
    wrap.appendChild(statRow);

    const cv = document.createElement("canvas");
    cv.width = SIZE; cv.height = SIZE;
    cv.style.cssText = `width:min(${SIZE}px, 78vw); aspect-ratio:1; display:block; cursor:pointer; touch-action:manipulation; -webkit-tap-highlight-color:transparent;`;
    wrap.appendChild(cv);
    const ctx = cv.getContext("2d");

    const hintEl = document.createElement("div");
    hintEl.style.cssText = "font-size:11px; color:var(--ink-dim); min-height:15px; text-align:center;";
    wrap.appendChild(hintEl);

    container.appendChild(wrap);

    // ---- state machine: idle → playing → over → (tap) → playing ----
    let mode = "idle";           // idle | playing | over
    let angle = -Math.PI / 2;    // dot position (radians)
    let dir = 1;                 // +1 / -1 — flips every hit
    let speed = START_SPEED;     // rev/s
    let arcWidth = START_ARC;
    let arcCenter = 0;           // radians — where the target arc sits
    let score = 0;
    let lives = 3;               // Round 22: the run survives misses — 3 hearts
    let lastTs = null;
    let rafId = null;
    let wasInArc = false;       // dot is inside the window this pass
    let flash = null;           // { t, text, color } — center flash text
    let shakeUntil = 0;         // miss feedback: tiny canvas shake

    function newTarget(){
      // anywhere BUT near the dot's current position — at least a quarter-lap
      // of travel so the window never spawns under the dot
      let a;
      do {
        a = Math.random() * Math.PI * 2;
      } while(Math.abs(angDiff(a, angle)) < Math.PI / 2);
      arcCenter = a;
      wasInArc = false; // the dot always starts OUTSIDE the fresh window
    }
    function angDiff(a, b){
      let d = (a - b) % (Math.PI * 2);
      if(d > Math.PI) d -= Math.PI * 2;
      if(d < -Math.PI) d += Math.PI * 2;
      return d;
    }
    function inArc(){
      return Math.abs(angDiff(angle, arcCenter)) <= arcWidth / 2;
    }
    function inPerfect(){
      return Math.abs(angDiff(angle, arcCenter)) <= (arcWidth * PERFECT_FRACTION) / 2;
    }

    // floats: "+1" / "PERFECT +2" rise from the arc's position
    function floatText(text, color){
      flash = { t: performance.now(), text, color };
    }

    function startRun(){
      mode = "playing";
      score = 0; lives = 3; speed = START_SPEED; arcWidth = START_ARC;
      dir = Math.random() < 0.5 ? 1 : -1;
      angle = -Math.PI / 2;
      newTarget();
      q("#pr-score").textContent = "0";
      paintLives();
      hintEl.textContent = "tap inside the arc";
      try{ Feedback.tone("place"); Feedback.haptic("light"); }catch(e){}
    }

    function paintLives(){
      q("#pr-lives").textContent = "♥".repeat(lives) + "♡".repeat(Math.max(0, 3 - lives));
    }

    function hit(){
      const perfect = inPerfect();
      score += perfect ? 2 : 1;
      q("#pr-score").textContent = score;
      floatText(perfect ? "PERFECT +2" : "+1", perfect ? COLORS.perfect : COLORS.arc);
      try{
        // rising pitch with the score — the run literally climbs in key
        Feedback.tone(420 + Math.min(score, 24) * 26, 0.06);
        Feedback.haptic(perfect ? "medium" : "light");
      }catch(e){}
      if(score > 0 && score % 10 === 0){
        // milestone: every 10 hits the ring celebrates the climb
        floatText(score + " — RING MASTER", COLORS.perfect);
        try{ Feedback.buzz("success"); }catch(e){}
      }
      dir = -dir;                     // the rhythm never settles
      speed = Math.min(MAX_SPEED, speed * SPEED_GROWTH);
      arcWidth = Math.max(MIN_ARC, arcWidth * ARC_SHRINK);
      newTarget();
    }

    // Round 22 — a miss burns one heart instead of the whole run: the ring
    // circles on, the arc relocates, and the pressure keeps building.
    function miss(){
      lives--;
      paintLives();
      try{ Feedback.buzz("error"); Feedback.haptic("medium"); }catch(e){}
      shakeUntil = performance.now() + 200;
      if(lives <= 0){
        endRun();
        return;
      }
      floatText(lives === 1 ? "LAST HEART" : "MISS −1♥", COLORS.danger);
      hintEl.textContent = lives === 1 ? "one heart left — careful" : "missed — " + lives + " hearts left";
      newTarget(); // fresh window, same orbit — the circle never stops
    }

    function endRun(){
      mode = "over";
      try{ Feedback.buzz("lose"); }catch(e){}
      shakeUntil = performance.now() + 220;
      if(score > best){
        best = score;
        q("#pr-best").textContent = best;
        api.setHighscore(best);
        hintEl.textContent = "NEW BEST — tap to go again";
      } else {
        hintEl.textContent = "tap to retry";
      }
    }

    function onTap(e){
      e.preventDefault();
      if(mode === "idle" || mode === "over"){
        startRun();
        return;
      }
      // playing
      if(inArc()) hit();
      else miss();
    }
    cv.addEventListener("pointerdown", onTap);

    // keyboard parity (desktop): space/enter plays — the card is a button
    function onKey(e){
      if(!StripShell.isActive(cv)) return;
      if(e.key === " " || e.key === "Enter"){
        e.preventDefault();
        onTap(e);
      }
    }
    window.addEventListener("keydown", onKey);

    function draw(ts){
      const now = ts || performance.now();

      // dt-normalized motion (repo convention: no 120Hz double-speed bug)
      if(lastTs == null) lastTs = now;
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;

      if(mode === "playing"){
        const dAngle = dir * speed * Math.PI * 2 * dt;
        angle += dAngle;
        // normalize
        if(angle > Math.PI) angle -= Math.PI * 2;
        if(angle < -Math.PI) angle += Math.PI * 2;
        // the dot entered the arc and left it again without a tap = the
        // window came and went = a miss. (Enter/exit tracking, not lap
        // math: it's exact for every arc size and both directions.)
        const isIn = inArc();
        if(isIn) wasInArc = true;
        else if(wasInArc) miss(); // the window came and went — one heart, not the run
      }

      // shake on miss (brief, tiny)
      let sx = 0, sy = 0;
      if(now < shakeUntil){
        sx = (Math.random() - 0.5) * 4;
        sy = (Math.random() - 0.5) * 4;
      }

      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.save();
      ctx.translate(sx, sy);

      // base ring
      ctx.beginPath();
      ctx.arc(CX, CY, R, 0, Math.PI * 2);
      ctx.lineWidth = 10;
      ctx.strokeStyle = mode === "idle" ? COLORS.ring : COLORS.ringLit;
      ctx.stroke();

      // target arc
      if(mode !== "idle"){
        const a0 = arcCenter - arcWidth / 2, a1 = arcCenter + arcWidth / 2;
        const pf = PERFECT_FRACTION;
        // perfect core (drawn under the full arc glow)
        ctx.beginPath();
        ctx.arc(CX, CY, R, arcCenter - (arcWidth * pf) / 2, arcCenter + (arcWidth * pf) / 2);
        ctx.lineWidth = 10;
        ctx.strokeStyle = COLORS.perfect;
        ctx.stroke();
        // full arc
        ctx.beginPath();
        ctx.arc(CX, CY, R, a0, a1);
        ctx.lineWidth = 10;
        ctx.strokeStyle = COLORS.arc;
        ctx.shadowColor = COLORS.arcGlow;
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // dot (idle: parked at 12 o'clock, breathing)
      const breathe = mode === "idle" ? 1 + Math.sin(now / 400) * 0.12 : 1;
      ctx.beginPath();
      ctx.arc(CX + Math.cos(angle) * R, CY + Math.sin(angle) * R, DOT_R * breathe, 0, Math.PI * 2);
      ctx.fillStyle = mode === "over" ? COLORS.danger : COLORS.dot;
      ctx.fill();

      // center text
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if(mode === "idle"){
        ctx.fillStyle = COLORS.arc;
        ctx.font = '10px "Press Start 2P", monospace';
        const pulse = 0.75 + Math.sin(now / 350) * 0.25;
        ctx.globalAlpha = pulse;
        ctx.fillText("TAP TO", CX, CY - 14);
        ctx.fillText("BEGIN", CX, CY + 6);
        ctx.globalAlpha = 1;
        ctx.fillStyle = COLORS.dim;
        ctx.font = "10px sans-serif";
      } else {
        ctx.fillStyle = mode === "over" ? COLORS.danger : COLORS.dot;
        ctx.font = '22px "Press Start 2P", monospace';
        ctx.fillText(String(score), CX, CY - 8);
        if(mode === "over"){
          ctx.fillStyle = COLORS.dim;
          ctx.font = "10px sans-serif";
          ctx.fillText(score > 0 && score >= best ? "NEW BEST" : "TAP TO RETRY", CX, CY + 16);
        }
      }

      // floating reward text
      if(flash){
        const age = (now - flash.t) / 800;
        if(age >= 1) flash = null;
        else {
          ctx.globalAlpha = 1 - age;
          ctx.fillStyle = flash.color;
          ctx.font = '9px "Press Start 2P", monospace';
          ctx.fillText(flash.text, CX, CY + 34 - age * 22);
          ctx.globalAlpha = 1;
        }
      }

      ctx.restore();
      rafId = requestAnimationFrame(draw);
    }
    rafId = requestAnimationFrame(draw);

    function q(sel){ return container.querySelector(sel); }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKey);
      if(score > best) api.setHighscore(best);
    };
  }
});
