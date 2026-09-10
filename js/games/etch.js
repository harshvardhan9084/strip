Strip.register({
  id: "etch",
  label: "TOY",
  title: "Etch Pad",
  tag: "🖊",
  hint: "Draw with your finger",
  mount(container, api){
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:14px; width:100%;";

    const canvasWrap = document.createElement("div");
    canvasWrap.style.cssText = `
      width:min(78vw,280px); height:min(50vh,280px);
      background:#E9E4D8; border-radius:14px; overflow:hidden;
      box-shadow:inset 0 4px 14px rgba(0,0,0,.35);
      touch-action:none;
    `;
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "width:100%; height:100%; display:block;";
    canvasWrap.appendChild(canvas);

    const controls = document.createElement("div");
    controls.style.cssText = "display:flex; gap:10px;";
    const clearBtn = document.createElement("button");
    clearBtn.className = "btn accent";
    clearBtn.textContent = "Shake to clear";
    const colorBtn = document.createElement("button");
    colorBtn.className = "btn purple";
    colorBtn.textContent = "Color";

    controls.appendChild(colorBtn);
    controls.appendChild(clearBtn);
    wrap.appendChild(canvasWrap);
    wrap.appendChild(controls);
    container.appendChild(wrap);

    const ctx = canvas.getContext("2d");
    const COLORS = ["#1a1a1a", "#E8637F", "#FFB347", "#8B7FE8", "#2E7D5B"];
    let colorIdx = 0;

    function resize(){
      const rect = canvasWrap.getBoundingClientRect();
      canvas.width = rect.width * devicePixelRatio;
      canvas.height = rect.height * devicePixelRatio;
      ctx.scale(devicePixelRatio, devicePixelRatio);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 3;
      ctx.strokeStyle = COLORS[colorIdx];
    }
    // slight delay so layout is settled
    requestAnimationFrame(resize);

    // re-fit on rotation/resize; drawing is lost on resize (acceptable for an etch pad)
    let resizeTimer = null;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 150);
    };
    window.addEventListener("resize", onResize);

    let drawing = false, lastX = 0, lastY = 0;
    function pos(e){
      const rect = canvas.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    function start(e){
      drawing = true;
      const p = pos(e);
      lastX = p.x; lastY = p.y;
    }
    function move(e){
      if(!drawing) return;
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastX = p.x; lastY = p.y;
    }
    function end(){ drawing = false; }

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    canvas.addEventListener("touchstart", start, {passive:true});
    canvas.addEventListener("touchmove", move, {passive:true});
    canvas.addEventListener("touchend", end);

    clearBtn.addEventListener("click", () => {
      // clear in user-space units (the context is dpr-scaled) so one swipe
      // covers exactly the visible board regardless of device pixel ratio
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
    });
    colorBtn.addEventListener("click", () => {
      colorIdx = (colorIdx + 1) % COLORS.length;
      ctx.strokeStyle = COLORS[colorIdx];
      colorBtn.style.color = COLORS[colorIdx];
      colorBtn.style.borderColor = COLORS[colorIdx];
    });

    return () => {
      window.removeEventListener("mouseup", end);
      window.removeEventListener("resize", onResize);
      clearTimeout(resizeTimer);
    };
  }
});
