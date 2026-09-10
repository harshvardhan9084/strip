Strip.register({
  id: "spinner",
  label: "FIDGET",
  title: "Spinner",
  tag: "🌀",
  hint: "Flick it",
  mount(container, api){
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:14px;";

    const face = document.createElement("div");
    face.style.cssText = `
      width:200px; height:200px; border-radius:50%;
      background:radial-gradient(circle at 50% 50%, var(--panel-2) 0%, var(--panel-2) 22%, transparent 23%),
                 conic-gradient(from 0deg, var(--amber), var(--purple), var(--amber));
      position:relative; touch-action:none; cursor:grab;
      box-shadow:0 10px 40px rgba(0,0,0,.5);
    `;
    const hub = document.createElement("div");
    hub.style.cssText = `
      position:absolute; left:50%; top:50%; width:26px; height:26px;
      background:var(--bg); border-radius:50%; transform:translate(-50%,-50%);
      border:2px solid var(--line);
    `;
    face.appendChild(hub);

    const rpmLabel = document.createElement("div");
    rpmLabel.style.cssText = "font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    rpmLabel.textContent = "flick to spin";

    wrap.appendChild(face);
    wrap.appendChild(rpmLabel);
    container.appendChild(wrap);

    let angle = 0;        // degrees
    let velocity = 0;      // deg per frame
    let lastAngle = 0, lastTime = 0, dragging = false;
    let rafId = null;

    function angleFromEvent(e){
      const rect = face.getBoundingClientRect();
      const cx = rect.left + rect.width/2;
      const cy = rect.top + rect.height/2;
      const t = e.touches ? e.touches[0] : e;
      return Math.atan2(t.clientY - cy, t.clientX - cx) * 180/Math.PI;
    }

    function onDown(e){
      dragging = true;
      face.style.cursor = "grabbing";
      lastAngle = angleFromEvent(e);
      lastTime = performance.now();
      velocity = 0;
    }
    function onMove(e){
      if(!dragging) return;
      const now = performance.now();
      const a = angleFromEvent(e);
      let delta = a - lastAngle;
      if(delta > 180) delta -= 360;
      if(delta < -180) delta += 360;
      const dt = Math.max(1, now - lastTime);
      velocity = delta / (dt/16.67); // normalize to ~per-frame at 60fps
      angle += delta;
      face.style.transform = `rotate(${angle}deg)`;
      lastAngle = a; lastTime = now;
    }
    function onUp(){
      dragging = false;
      face.style.cursor = "grab";
      if(Math.abs(velocity) > 2) Feedback.haptic("light");
    }

    face.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    face.addEventListener("touchstart", onDown, {passive:true});
    window.addEventListener("touchmove", onMove, {passive:true});
    window.addEventListener("touchend", onUp);

    function tick(){
      if(!dragging){
        if(Math.abs(velocity) > 0.01){
          angle += velocity;
          velocity *= 0.975; // friction
          face.style.transform = `rotate(${angle}deg)`;
        } else {
          velocity = 0;
        }
      }
      // velocity is deg/frame. At 60fps: deg/s = v*60; rev/s = deg/s/360;
      // RPM = rev/s*60 = v*60*60/360 = v*10. (Earlier attempts had this off by
      // 3.6x, then 60x — the two 60 factors and the 360 are easy to fumble.)
      const rpm = Math.abs(velocity) * 10;
      rpmLabel.textContent = rpm > 0.5 ? `${rpm.toFixed(0)} rpm` : "flick to spin";
      rafId = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }
});
