Strip.register({
  id: "kaleidoscope",
  label: "TOY",
  title: "Kaleidoscope",
  tag: "🎨",
  hint: "Drag to paint symmetrically",
  mount(container, api){
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:10px; width:100%;";

    const canvas = document.createElement("canvas");
    canvas.style.cssText = "background:#0c0c12; border-radius:50%; width:min(78vw,280px); height:min(78vw,280px); touch-action:none;";
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
    let cx, cy;
    function fit(){
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * devicePixelRatio;
      canvas.height = rect.height * devicePixelRatio;
      ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
      cx = rect.width/2; cy = rect.height/2;
    }
    requestAnimationFrame(fit);

    const SEGMENTS = 8;
    const HUE_STEP = 0.6;
    let hue = Math.random()*360;
    let drawing = false, lastX = 0, lastY = 0;

    function pos(e){
      const rect = canvas.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }

    function drawSegmentLine(x1,y1,x2,y2){
      ctx.strokeStyle = `hsl(${hue % 360}, 80%, 65%)`;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      for(let i=0;i<SEGMENTS;i++){
        const angle = (Math.PI*2/SEGMENTS) * i;
        [1,-1].forEach(mirror => {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(angle);
          ctx.scale(mirror, 1);
          ctx.beginPath();
          ctx.moveTo(x1-cx, y1-cy);
          ctx.lineTo(x2-cx, y2-cy);
          ctx.stroke();
          ctx.restore();
        });
      }
      hue += HUE_STEP;
    }

    function start(e){ drawing = true; const p = pos(e); lastX=p.x; lastY=p.y; }
    function move(e){
      if(!drawing) return;
      const p = pos(e);
      drawSegmentLine(lastX, lastY, p.x, p.y);
      lastX = p.x; lastY = p.y;
    }
    function end(){ drawing = false; }

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    canvas.addEventListener("touchstart", (e)=>{e.preventDefault(); start(e);}, {passive:false});
    canvas.addEventListener("touchmove", (e)=>{e.preventDefault(); move(e);}, {passive:false});
    canvas.addEventListener("touchend", end);

    clearBtn.addEventListener("click", () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0,0,rect.width,rect.height);
    });

    // re-fit on rotation/resize (canvas is cleared — the pattern is gone anyway)
    let resizeTimer = null;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(fit, 150);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("mouseup", end);
      window.removeEventListener("resize", onResize);
      clearTimeout(resizeTimer);
    };
  }
});
