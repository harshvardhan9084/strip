/**
 * Tower Defense — grid pathfinding + wave economy.
 *
 * Pathfinding: BFS (breadth-first search) on the grid from spawn to base,
 * treating tower cells as walls. BFS guarantees the shortest path on an
 * unweighted grid, and re-runs every time a tower is placed — so enemies
 * genuinely reroute around new blockages, they don't follow a fixed track.
 * If a placement would seal off the only path, that placement is rejected
 * (checked via the same BFS before committing it) so the level can never
 * become unsolvable.
 *
 * Three tower types create real placement decisions rather than one
 * obviously-best choice:
 *   Arrow  — cheap, single-target, fast fire rate
 *   Cannon — splash damage, slow fire rate, good vs groups
 *   Frost  — low damage, slows enemies in radius, good for stacking with the others
 */
Strip.register({
  id: "towerdefense",
  label: "GAME",
  title: "Tower Defense",
  tag: "waves",
  hint: "Place towers, survive the waves",
  async mount(container, api){
    let best = await api.getHighscore(); // best = highest wave survived

    const COLS = 10, ROWS = 10;
    const CELL = 26;

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:8px; width:100%;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:12px; font-family:var(--font-display); font-size:8px; color:var(--ink-dim);";

    const canvas = document.createElement("canvas");
    canvas.style.cssText = `width:min(82vw,${COLS*CELL}px); height:auto; aspect-ratio:${COLS}/${ROWS}; border-radius:8px; background:#0d1420; touch-action:none;`;
    const ctx = canvas.getContext("2d");
    // DPR-aware backing store — logical coordinate space (COLS*CELL x ROWS*CELL)
    // is preserved via the transform, so all render/click math stays unchanged
    function fit(){
      const rect = canvas.getBoundingClientRect();
      if(!rect.width) return;
      const dpr = Math.min(2.5, window.devicePixelRatio || 1);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.width * dpr * (ROWS / COLS));
      ctx.setTransform(canvas.width / (COLS*CELL), 0, 0, canvas.height / (ROWS*CELL), 0, 0);
    }
    requestAnimationFrame(fit);

    const towerRow = document.createElement("div");
    towerRow.style.cssText = "display:flex; gap:6px;";

    const bottomRow = document.createElement("div");
    bottomRow.style.cssText = "display:flex; gap:8px; align-items:center;";
    const waveBtn = document.createElement("button");
    waveBtn.className = "btn accent";
    waveBtn.textContent = "Start wave";
    const msg = document.createElement("div");
    msg.style.cssText = "font-size:10px; color:var(--ink-dim);";
    bottomRow.appendChild(waveBtn);
    bottomRow.appendChild(msg);

    wrap.appendChild(statRow);
    wrap.appendChild(canvas);
    wrap.appendChild(towerRow);
    wrap.appendChild(bottomRow);
    container.appendChild(wrap);

    const TOWER_TYPES = {
      arrow:  { cost: 15, range: 2.4, dmg: 8,  rate: 350, color: "#FFB347", splash: 0, slow: 0 },
      cannon: { cost: 30, range: 2.0, dmg: 18, rate: 900, color: "#E8637F", splash: 1.1, slow: 0 },
      frost:  { cost: 25, range: 1.8, dmg: 3,  rate: 500, color: "#56B4E9", splash: 0, slow: 0.5 },
    };
    let selectedType = "arrow";

    Object.entries(TOWER_TYPES).forEach(([key, t]) => {
      const btn = document.createElement("button");
      btn.style.cssText = `padding:6px 10px; border-radius:10px; border:1px solid var(--line); background:var(--panel-2); cursor:pointer; font-size:10px; color:${t.color};`;
      btn.innerHTML = `${key[0].toUpperCase()+key.slice(1)}<br><span style="color:var(--ink-dim)">${t.cost}g</span>`;
      btn.addEventListener("click", () => { selectedType = key; updateTowerButtons(); });
      btn._key = key;
      towerRow.appendChild(btn);
    });
    function updateTowerButtons(){
      [...towerRow.children].forEach(btn => {
        btn.style.borderColor = btn._key === selectedType ? "var(--amber)" : "var(--line)";
        btn.style.background = btn._key === selectedType ? "rgba(255,179,71,0.1)" : "var(--panel-2)";
      });
    }

    // grid: 0 = open, 1 = tower
    let grid, gold, lives, wave, enemies, towers, projectiles, path, spawnPoint, basePoint, waveActive, gameOver;

    function resetGame(){
      grid = Array.from({length:ROWS}, () => Array(COLS).fill(0));
      spawnPoint = { r: 0, c: 0 };
      basePoint = { r: ROWS-1, c: COLS-1 };
      gold = 60; lives = 12; wave = 0;
      enemies = []; towers = []; projectiles = [];
      waveActive = false; gameOver = false;
      path = bfsPath(grid);
      msg.textContent = "";
      updateStat();
      render();
    }

    // BFS shortest path from spawn to base, treating grid[r][c]===1 as a wall
    function bfsPath(g){
      const visited = Array.from({length:ROWS}, () => Array(COLS).fill(false));
      const prev = {};
      const q = [[spawnPoint.r, spawnPoint.c]];
      visited[spawnPoint.r][spawnPoint.c] = true;
      const key = (r,c) => r+","+c;
      while(q.length){
        const [r,c] = q.shift();
        if(r === basePoint.r && c === basePoint.c){
          const path = [];
          let cur = key(r,c);
          while(cur){
            const [pr,pc] = cur.split(",").map(Number);
            path.unshift({r:pr,c:pc});
            cur = prev[cur];
          }
          return path;
        }
        [[0,1],[0,-1],[1,0],[-1,0]].forEach(([dr,dc]) => {
          const nr=r+dr, nc=c+dc;
          if(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&!visited[nr][nc]&&g[nr][nc]===0){
            visited[nr][nc] = true;
            prev[key(nr,nc)] = key(r,c);
            q.push([nr,nc]);
          }
        });
      }
      return null; // no path exists
    }

    function canPlace(r,c){
      if(grid[r][c] !== 0) return false;
      if((r===spawnPoint.r && c===spawnPoint.c) || (r===basePoint.r && c===basePoint.c)) return false;
      const test = grid.map(row => row.slice());
      test[r][c] = 1;
      return bfsPath(test) !== null; // reject placements that would seal the only route
    }

    function placeTower(r,c){
      const type = TOWER_TYPES[selectedType];
      if(gold < type.cost) { msg.textContent = "Not enough gold"; Feedback.buzz("error"); return; }
      if(!canPlace(r,c)){ msg.textContent = "Can't block the only path"; Feedback.buzz("error"); return; }
      grid[r][c] = 1;
      towers.push({ r, c, type: selectedType, cooldown: 0 });
      Feedback.tone("place"); Feedback.haptic("medium");
      gold -= type.cost;
      path = bfsPath(grid);
      enemies.forEach(e => { e.path = path; e.pathIdx = Math.min(e.pathIdx, path.length-1); });
      msg.textContent = "";
      updateStat();
      render();
    }

    canvas.addEventListener("click", (e) => {
      const rect = canvas.getBoundingClientRect();
      // map into the LOGICAL space (COLS*CELL x ROWS*CELL) — independent of the
      // backing-store size, so DPR scaling never shifts tower placement
      const scaleX = (COLS*CELL) / rect.width, scaleY = (ROWS*CELL) / rect.height;
      const x = (e.clientX - rect.left) * scaleX, y = (e.clientY - rect.top) * scaleY;
      const c = Math.floor(x / CELL), r = Math.floor(y / CELL);
      if(r>=0 && r<ROWS && c>=0 && c<COLS) placeTower(r,c);
    });

    function cellCenter(r,c){ return { x: c*CELL + CELL/2, y: r*CELL + CELL/2 }; }

    function spawnWave(){
      if(waveActive || gameOver) return;
      wave++;
      const count = 5 + wave*2;
      const hp = 20 + wave*8;
      const speed = 0.9 + wave*0.05;
      for(let i=0;i<count;i++){
        enemies.push({
          hp, maxHp: hp, speed,
          pathIdx: 0, path,
          x: cellCenter(spawnPoint.r, spawnPoint.c).x - i*18,
          y: cellCenter(spawnPoint.r, spawnPoint.c).y,
          slowTimer: 0,
        });
      }
      waveActive = true;
      waveBtn.disabled = true;
      updateStat();
    }

    function updateStat(){
      statRow.innerHTML = `<div>GOLD<br><span style="color:var(--amber); font-size:12px;">${gold}</span></div><div>LIVES<br><span style="color:var(--danger); font-size:12px;">${lives}</span></div><div>WAVE<br><span style="color:var(--purple); font-size:12px;">${wave}</span></div><div>BEST<br><span style="color:var(--ink); font-size:12px;">${best}</span></div>`;
    }

    function render(){
      ctx.clearRect(0,0,canvas.width,canvas.height);
      for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
        ctx.fillStyle = (r+c)%2===0 ? "#12182a" : "#0f1424";
        ctx.fillRect(c*CELL, r*CELL, CELL, CELL);
      }
      if(path){
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        path.forEach(p => ctx.fillRect(p.c*CELL, p.r*CELL, CELL, CELL));
      }
      ctx.fillStyle = "#6FCF97";
      ctx.fillRect(spawnPoint.c*CELL+4, spawnPoint.r*CELL+4, CELL-8, CELL-8);
      ctx.fillStyle = "#E8637F";
      ctx.fillRect(basePoint.c*CELL+4, basePoint.r*CELL+4, CELL-8, CELL-8);

      towers.forEach(t => {
        const type = TOWER_TYPES[t.type];
        const {x,y} = cellCenter(t.r,t.c);
        ctx.fillStyle = type.color;
        ctx.beginPath();
        ctx.arc(x,y, CELL*0.32, 0, Math.PI*2);
        ctx.fill();
      });

      enemies.forEach(e => {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(e.x, e.y, 6, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = "#E8637F";
        ctx.fillRect(e.x-8, e.y-12, 16, 3);
        ctx.fillStyle = "#6FCF97";
        ctx.fillRect(e.x-8, e.y-12, 16*(e.hp/e.maxHp), 3);
      });

      projectiles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI*2);
        ctx.fill();
      });
    }

    let lastTick = performance.now();
    function gameLoop(now){
      const dt = Math.min(50, now - lastTick);
      lastTick = now;
      if(!gameOver) update(dt);
      render();
      rafId = requestAnimationFrame(gameLoop);
    }
    let rafId = requestAnimationFrame(gameLoop);

    function update(dt){
      enemies.forEach(e => {
        if(e.pathIdx >= e.path.length - 1){
          e._done = true;
          return;
        }
        const target = cellCenter(e.path[e.pathIdx+1].r, e.path[e.pathIdx+1].c);
        const dx = target.x - e.x, dy = target.y - e.y;
        const dist = Math.hypot(dx,dy) || 1;
        const speedMul = e.slowTimer > 0 ? 0.45 : 1;
        if(e.slowTimer > 0) e.slowTimer -= dt;
        const step = e.speed * speedMul * (dt/16.67);
        if(dist < step){
          e.x = target.x; e.y = target.y; e.pathIdx++;
        } else {
          e.x += (dx/dist)*step; e.y += (dy/dist)*step;
        }
      });

      const reached = enemies.filter(e => e._done);
      if(reached.length){
        lives -= reached.length;
        Feedback.buzz("error");
        enemies = enemies.filter(e => !e._done);
        updateStat();
        if(lives <= 0){ endGame(); return; }
      }

      towers.forEach(t => {
        t.cooldown -= dt;
        if(t.cooldown > 0) return;
        const type = TOWER_TYPES[t.type];
        const {x,y} = cellCenter(t.r,t.c);
        const rangePx = type.range * CELL;
        let target = null, bestDist = Infinity;
        enemies.forEach(e => {
          const d = Math.hypot(e.x-x, e.y-y);
          if(d <= rangePx && d < bestDist){ bestDist = d; target = e; }
        });
        if(target){
          t.cooldown = type.rate;
          projectiles.push({ x, y, tx: target, dmg: type.dmg, splash: type.splash, slow: type.slow, color: type.color, speed: 6 });
        }
      });

      projectiles = projectiles.filter(p => {
        if(!enemies.includes(p.tx)){ return false; }
        const dx = p.tx.x - p.x, dy = p.tx.y - p.y;
        const dist = Math.hypot(dx,dy) || 1;
        if(dist < p.speed*2){
          applyDamage(p.tx, p.dmg);
          if(p.splash > 0){
            enemies.forEach(e => {
              if(e !== p.tx && Math.hypot(e.x-p.tx.x, e.y-p.tx.y) < p.splash*CELL){
                applyDamage(e, p.dmg*0.6);
              }
            });
          }
          if(p.slow > 0) p.tx.slowTimer = 800;
          return false;
        }
        p.x += (dx/dist)*p.speed*(dt/16.67);
        p.y += (dy/dist)*p.speed*(dt/16.67);
        return true;
      });

      const dead = enemies.filter(e => e.hp <= 0);
      if(dead.length){
        Feedback.tone("pop");
        gold += dead.length * 4;
        enemies = enemies.filter(e => e.hp > 0);
        updateStat();
      }

      if(waveActive && enemies.length === 0){
        waveActive = false;
        waveBtn.disabled = false;
        // only reward a CLEAR if the base actually survived the wave — the old
        // code paid out +15g and a success chime even when every enemy leaked
        // through and ended the run
        if(lives > 0){
          Feedback.buzz("success");
          gold += 15;
          if(wave > best){
            best = wave;
            api.setHighscore(best);
          }
          updateStat();
          msg.textContent = `Wave ${wave} cleared`;
        }
      }
    }

    function applyDamage(e, dmg){ e.hp -= dmg; }

    function endGame(){
      gameOver = true;
      Feedback.buzz("lose");
      waveBtn.disabled = true;
      msg.textContent = `Base fell at wave ${wave}. Tap Restart.`;
      waveBtn.textContent = "Restart";
      waveBtn.disabled = false;
      if(wave > best){ best = wave; api.setHighscore(best); }
      updateStat();
    }

    waveBtn.addEventListener("click", () => {
      if(gameOver){ waveBtn.textContent = "Start wave"; resetGame(); return; }
      spawnWave();
    });

    updateTowerButtons();
    resetGame();

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
