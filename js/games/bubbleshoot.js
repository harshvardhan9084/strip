Strip.register({
  id: "bubbleshoot",
  label: "PUZZLE",
  title: "Bubble Shooter",
  tag: "aim",
  hint: "Tap to aim & shoot, match 3+ colors",
  async mount(container, api){
    let best = await api.getHighscore();
    const COLORS = ["#FFB347","#8B7FE8","#E8637F","#6FCF97"];
    const COLS = 7, R = 15;

    // scope all element lookups to THIS card (duplicate ids across copies of a
    // cartridge coexist briefly in the strip — getElementById can hit the stale one)
    const q = (sel) => container.querySelector(sel);

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:10px;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:20px; font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    statRow.innerHTML = `<div>SCORE <span id="bs-score" style="color:var(--amber)">0</span></div><div>BEST <span id="bs-best" style="color:var(--purple)">${best}</span></div>`;
    wrap.appendChild(statRow);

    const canvas = document.createElement("canvas");
    canvas.style.cssText = "background:#12121a; border-radius:12px; width:min(70vw,230px); height:min(58vh,340px); touch-action:none;";
    wrap.appendChild(canvas);

    const newBtn = document.createElement("button");
    newBtn.className = "btn accent";
    newBtn.textContent = "New game";
    wrap.appendChild(newBtn);

    container.appendChild(wrap);

    const ctx = canvas.getContext("2d");
    let cw, ch;
    function fit(){
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * devicePixelRatio;
      canvas.height = rect.height * devicePixelRatio;
      ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
      cw = rect.width; ch = rect.height;
    }
    requestAnimationFrame(fit);

    let grid, score, shooter, flying, over, overMessage = "Game Over — tap New game";

    function cellPos(row, col){
      const offset = row % 2 === 0 ? 0 : R;
      return { x: R + col*R*2 + offset, y: R + row*R*1.7 };
    }

    function newGame(){
      grid = [];
      for(let r=0;r<5;r++){
        const row = [];
        const cols = r % 2 === 0 ? COLS : COLS - 1;
        for(let c=0;c<cols;c++) row.push(Math.floor(Math.random()*COLORS.length));
        grid.push(row);
      }
      score = 0;
      over = false;
      flying = null;
      shooter = { colorIdx: Math.floor(Math.random()*COLORS.length), angle: -Math.PI/2 };
      q("#bs-score").textContent = 0;
      draw();
    }

    function draw(){
      ctx.clearRect(0,0,cw,ch);
      grid.forEach((row, r) => row.forEach((colorIdx, c) => {
        if(colorIdx === null || colorIdx === undefined) return;
        const { x, y } = cellPos(r, c);
        ctx.fillStyle = COLORS[colorIdx];
        ctx.beginPath(); ctx.arc(x, y, R-1.5, 0, Math.PI*2); ctx.fill();
      }));

      if(flying){
        ctx.fillStyle = COLORS[flying.colorIdx];
        ctx.beginPath(); ctx.arc(flying.x, flying.y, R-1.5, 0, Math.PI*2); ctx.fill();
      }

      const sx = cw/2, sy = ch - 20;
      ctx.strokeStyle = "rgba(255,255,255,.25)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(shooter.angle)*40, sy + Math.sin(shooter.angle)*40);
      ctx.stroke();
      ctx.fillStyle = COLORS[shooter.colorIdx];
      ctx.beginPath(); ctx.arc(sx, sy, R-1.5, 0, Math.PI*2); ctx.fill();

      if(over){
        ctx.fillStyle = "rgba(0,0,0,.6)";
        ctx.fillRect(0,0,cw,ch);
        ctx.fillStyle = "#EDEAE3";
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(overMessage, cw/2, ch/2);
      }
    }

    // every bubble still attached to the ceiling (row 0), via any chain of
    // hex-grid neighbors. Anything NOT in this set is floating in midair and
    // must fall — the old code left detached bubbles hanging forever.
    function anchoredSet(){
      const anchored = new Set();
      const stack = [];
      for(let c=0;c<(grid[0] ? grid[0].length : 0);c++){
        if(grid[0] && grid[0][c] != null){ stack.push([0,c]); anchored.add("0,"+c); }
      }
      while(stack.length){
        const [r,c] = stack.pop();
        neighborsOf(r,c).forEach(([nr,nc]) => {
          const k = nr+","+nc;
          if(!anchored.has(k) && grid[nr] && grid[nr][nc] != null){
            anchored.add(k);
            stack.push([nr,nc]);
          }
        });
      }
      return anchored;
    }

    // drop floating bubbles, collapse now-empty bottom rows, and report whether
    // the whole board is clear (a win state the old game never had)
    function settleBoard(){
      const anchored = anchoredSet();
      let dropped = 0;
      for(let r=0;r<grid.length;r++) for(let c=0;c<grid[r].length;c++){
        if(grid[r][c] != null && !anchored.has(r+","+c)){
          grid[r][c] = null;
          dropped++;
        }
      }
      if(dropped > 0){
        score += dropped * 10;
        Feedback.tone("pop");
      }
      // collapse trailing rows that are now fully empty so grid.length reflects
      // the real board height — otherwise the death line eventually triggers
      // even when almost everything has been cleared
      while(grid.length && grid[grid.length-1].every(v => v == null)) grid.pop();
      q("#bs-score").textContent = score;
      return grid.every(row => row.every(v => v == null));
    }

    function neighborsOf(r,c){
      const isEven = r % 2 === 0;
      const deltas = isEven
        ? [[0,-1],[0,1],[-1,-1],[-1,0],[1,-1],[1,0]]
        : [[0,-1],[0,1],[-1,0],[-1,1],[1,0],[1,1]];
      return deltas.map(([dr,dc]) => [r+dr, c+dc])
        .filter(([nr,nc]) => grid[nr] && grid[nr][nc] !== undefined);
    }

    function findCluster(r,c,colorIdx){
      const visited = new Set(); const stack = [[r,c]]; const cluster = [];
      while(stack.length){
        const [cr,cc] = stack.pop();
        const key = cr+","+cc;
        if(visited.has(key)) continue;
        visited.add(key);
        if(!grid[cr] || grid[cr][cc] !== colorIdx) continue;
        cluster.push([cr,cc]);
        neighborsOf(cr,cc).forEach(([nr,nc]) => { if(!visited.has(nr+","+nc)) stack.push([nr,nc]); });
      }
      return cluster;
    }

    function snapAndPlace(x,y){
      let bestCell = null, bestDist = Infinity;
      for(let r=0;r<grid.length+1;r++){
        const cols = r % 2 === 0 ? COLS : COLS - 1;
        for(let c=0;c<cols;c++){
          if(grid[r] && grid[r][c] !== undefined && grid[r][c] !== null) continue;
          const p = cellPos(r,c);
          const d = (p.x-x)**2 + (p.y-y)**2;
          if(d < bestDist){ bestDist = d; bestCell = [r,c]; }
        }
      }
      if(!bestCell) return;
      const [r,c] = bestCell;
      // allocate the row with the correct width for its parity — the old code
      // always pushed COLS slots, misaligning odd (offset) hex rows
      while(grid.length <= r){
        const rowIdx = grid.length;
        grid.push(new Array(rowIdx % 2 === 0 ? COLS : COLS - 1).fill(null));
      }
      grid[r][c] = flying.colorIdx;

      const cluster = findCluster(r,c,flying.colorIdx);
      if(cluster.length >= 3){
        cluster.forEach(([cr,cc]) => { grid[cr][cc] = null; });
        Feedback.tone("pop"); Feedback.haptic("medium");
        score += cluster.length * 10;
      } else {
        Feedback.tone("tap"); Feedback.haptic("light");
      }
      flying = null;
      shooter.colorIdx = Math.floor(Math.random()*COLORS.length);

      if(settleBoard()){
        saveBest();
        over = true;
        overMessage = "You cleared the board! Tap New game";
        Feedback.buzz("win");
        return;
      }
      saveBest();

      // game over only if the lowest OCCUPIED row crosses the death line —
      // the old check used grid.length, which never shrank
      const lowestOccupied = grid.reduce((max, row, ri) => row.some(v => v != null) ? ri : max, 0);
      if((lowestOccupied + 1) * R * 1.7 > ch - 60){
        over = true;
        overMessage = "Game Over — tap New game";
        Feedback.buzz("lose");
      }
    }

    function saveBest(){
      if(score > best){
        best = score;
        api.setHighscore(best);
        q("#bs-best").textContent = best;
      }
    }

    function shoot(){
      if(flying || over) return;
      flying = { x: cw/2, y: ch-20, vx: Math.cos(shooter.angle)*5, vy: Math.sin(shooter.angle)*5, colorIdx: shooter.colorIdx };
    }

    function aimAt(clientX, clientY){
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left, y = clientY - rect.top;
      const sx = cw/2, sy = ch-20;
      shooter.angle = Math.atan2(y-sy, x-sx);
      shooter.angle = Math.max(-Math.PI+0.15, Math.min(-0.15, shooter.angle));
    }

    canvas.addEventListener("mousemove", (e) => aimAt(e.clientX, e.clientY));
    canvas.addEventListener("click", (e) => { aimAt(e.clientX, e.clientY); shoot(); });

    // Touch: aim continuously while the finger is down (touchstart + touchmove),
    // fire only on release (touchend). The old version fired instantly on
    // touchstart with zero aiming feedback, so every shot landed wherever the
    // finger happened to first make contact — which for a player re-tapping the
    // same general area to target the same cluster looked like "always the same spot."
    let touching = false;
    canvas.addEventListener("touchstart", (e) => {
      touching = true;
      const t = e.touches[0];
      aimAt(t.clientX, t.clientY);
    }, {passive:true});
    canvas.addEventListener("touchmove", (e) => {
      if(!touching) return;
      const t = e.touches[0];
      aimAt(t.clientX, t.clientY);
    }, {passive:true});
    canvas.addEventListener("touchend", () => {
      if(!touching) return;
      touching = false;
      shoot();
    }, {passive:true});

    let rafId;
    function loop(){
      if(flying){
        flying.x += flying.vx;
        flying.y += flying.vy;
        if(flying.x < R || flying.x > cw-R) flying.vx *= -1;
        let collided = flying.y > ch-30;
        if(!collided){
          outer:
          for(let r=0;r<grid.length;r++){
            for(let c=0;c<grid[r].length;c++){
              if(grid[r][c] === null || grid[r][c] === undefined) continue;
              const p = cellPos(r,c);
              if((p.x-flying.x)**2 + (p.y-flying.y)**2 < (R*1.8)**2){
                collided = true;
                break outer;
              }
            }
          }
        }
        if(collided){
          snapAndPlace(flying.x, Math.min(flying.y, ch-30));
        }
      }
      draw();
      rafId = requestAnimationFrame(loop);
    }

    newBtn.addEventListener("click", newGame);
    newGame();
    rafId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(rafId);
  }
});
