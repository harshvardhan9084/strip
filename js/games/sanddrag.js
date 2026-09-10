Strip.register({
  id: "sanddrag",
  label: "FIDGET",
  title: "Sand Drag",
  tag: "🏝",
  hint: "Drag your finger through the sand",
  mount(container, api){
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:10px; width:100%;";

    const canvas = document.createElement("canvas");
    canvas.style.cssText = "border-radius:14px; width:min(78vw,280px); height:min(50vh,280px); touch-action:none;";
    wrap.appendChild(canvas);

    const controls = document.createElement("div");
    controls.style.cssText = "display:flex; gap:10px;";
    const rakeBtn = document.createElement("button");
    rakeBtn.className = "btn accent";
    rakeBtn.textContent = "Smooth sand";
    controls.appendChild(rakeBtn);
    wrap.appendChild(controls);

    container.appendChild(wrap);

    const ctx = canvas.getContext("2d");
    function fit(){
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * devicePixelRatio;
      canvas.height = rect.height * devicePixelRatio;
      ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
      fillSand();
    }

    function fillSand(){
      const w = canvas.width / devicePixelRatio;
      const h = canvas.height / devicePixelRatio;
      const grad = ctx.createLinearGradient(0,0,w,h);
      grad.addColorStop(0, "#E8D5A8");
      grad.addColorStop(1, "#D4BC85");
      ctx.fillStyle = grad;
      ctx.fillRect(0,0,w,h);
    }
    requestAnimationFrame(fit);

    let drawing = false, lastX = 0, lastY = 0;
    function pos(e){
      const rect = canvas.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }

    function groove(x1,y1,x2,y2){
      // draw a shadowed "furrow" line to feel like sand being pushed
      ctx.strokeStyle = "rgba(120,95,50,0.35)";
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();

      ctx.strokeStyle = "rgba(255,240,210,0.5)";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x1,y1-2); ctx.lineTo(x2,y2-2); ctx.stroke();
    }

    function start(e){ drawing = true; const p = pos(e); lastX=p.x; lastY=p.y; }
    function move(e){
      if(!drawing) return;
      const p = pos(e);
      groove(lastX,lastY,p.x,p.y);
      lastX = p.x; lastY = p.y;
    }
    function end(){ drawing = false; }

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    canvas.addEventListener("touchstart", (e)=>{e.preventDefault();start(e);}, {passive:false});
    canvas.addEventListener("touchmove", (e)=>{e.preventDefault();move(e);}, {passive:false});
    canvas.addEventListener("touchend", end);

    rakeBtn.addEventListener("click", () => { Feedback.tone("swap"); fillSand(); });

    // re-fit (and refill the sand) on rotation/resize
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
