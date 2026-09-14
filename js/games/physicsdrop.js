Strip.register({
  id: "physicsdrop",
  label: "TOY",
  title: "Gravity Drop",
  tag: "physics",
  hint: "Tap to drop shapes, watch them pile",
  mount(container, api){
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:10px; width:100%;";

    const canvas = document.createElement("canvas");
    canvas.style.cssText = "background:#12121a; border-radius:12px; width:min(78vw,280px); height:min(50vh,300px);";
    wrap.appendChild(canvas);

    const controls = document.createElement("div");
    controls.style.cssText = "display:flex; gap:10px;";
    const clearBtn = document.createElement("button");
    clearBtn.className = "btn accent";
    clearBtn.textContent = "Clear";
    controls.appendChild(clearBtn);
    wrap.appendChild(controls);

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
    let shapes = [];
    const GRAVITY = 0.4, RESTITUTION = 0.45, FRICTION = 0.985;
    const MAX_SHAPES = 40;

    function spawn(x){
      const w = canvas.width / devicePixelRatio;
      shapes.push({
        x: x ?? (20 + Math.random()*(w-40)),
        y: -10,
        vx: (Math.random()-0.5)*2,
        vy: 0,
        r: 10 + Math.random()*8,
        rot: 0,
        vrot: (Math.random()-0.5)*0.1,
        color: COLORS[Math.floor(Math.random()*COLORS.length)],
        kind: Math.random() < 0.5 ? "circle" : "square",
      });
      if(shapes.length > MAX_SHAPES) shapes.shift();
    }

    function step(){
      const w = canvas.width / devicePixelRatio;
      const h = canvas.height / devicePixelRatio;

      shapes.forEach(s => {
        s.vy += GRAVITY;
        s.x += s.vx;
        s.y += s.vy;
        s.rot += s.vrot;
        s.vx *= FRICTION;

        if(s.x - s.r < 0){ s.x = s.r; s.vx *= -RESTITUTION; }
        if(s.x + s.r > w){ s.x = w - s.r; s.vx *= -RESTITUTION; }
        if(s.y + s.r > h){ s.y = h - s.r; s.vy *= -RESTITUTION; if(Math.abs(s.vy) < 0.5) s.vy = 0; }
      });

      // very lightweight pairwise collision (fine at this scale, <=40 shapes)
      for(let i=0;i<shapes.length;i++){
        for(let j=i+1;j<shapes.length;j++){
          const a = shapes[i], b = shapes[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.hypot(dx,dy) || 0.01;
          const minDist = a.r + b.r;
          if(dist < minDist){
            const overlap = (minDist - dist) / 2;
            const nx = dx/dist, ny = dy/dist;
            a.x -= nx*overlap; a.y -= ny*overlap;
            b.x += nx*overlap; b.y += ny*overlap;
            const avgVx = (a.vx+b.vx)/2, avgVy=(a.vy+b.vy)/2;
            a.vx = avgVx*0.9; a.vy = avgVy*0.9;
            b.vx = avgVx*0.9; b.vy = avgVy*0.9;
          }
        }
      }

      ctx.clearRect(0,0,w,h);
      shapes.forEach(s => {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        ctx.fillStyle = s.color;
        if(s.kind === "circle"){
          ctx.beginPath();
          ctx.arc(0,0,s.r,0,Math.PI*2);
          ctx.fill();
        } else {
          // Round 22 (P2 tail) — collision honesty. Squares used to be DRAWN
          // corner-to-corner (half-diagonal r√2) while COLLIDING as discs of
          // radius r, so stacked squares visibly clipped through each other
          // and through the floor. Now the square is drawn inscribed in its
          // own collider (half-side r/√2): everything you see fits inside the
          // physics disc, so the pile can never lie again. A subtle rim keeps
          // the shape legible at the new size.
          const hs = s.r / Math.SQRT2;
          ctx.fillRect(-hs, -hs, hs * 2, hs * 2);
          ctx.strokeStyle = "rgba(0,0,0,.35)";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(-hs, -hs, hs * 2, hs * 2);
        }
        ctx.restore();
      });

      rafId = requestAnimationFrame(step);
    }
    let rafId = requestAnimationFrame(step);

    function onTap(e){
      const rect = canvas.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      Feedback.tone("pop");
      spawn(t.clientX - rect.left);
    }
    canvas.addEventListener("mousedown", onTap);
    canvas.addEventListener("touchstart", (e) => { e.preventDefault(); onTap(e); }, {passive:false});
    clearBtn.addEventListener("click", () => { shapes = []; });

    // seed a couple so it's not empty on load
    spawn(); spawn();

    return () => cancelAnimationFrame(rafId);
  }
});
