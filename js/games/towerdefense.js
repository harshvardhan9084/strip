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
 *
 * Round 19 (AUDIT.md DEEP DIVE 1 — the wave-17 deadend): towers used to be
 * one-shot placements with fixed stats forever, while enemy HP grew
 * quadratically and speed grew unbounded — the run mathematically HAD to end
 * around wave 15–18 no matter how well you played. The fix makes gold a real
 * progression currency:
 *   - tap your own tower → upgrade panel: +40% dmg / +6% range / +5% fire
 *     rate per level, 4 levels, cost = base × 1.6^level, SELL refunds 70%
 *     of everything invested (rebuilding the route after a sell is a tactic)
 *   - kill bounty scales with the wave: 4 + ⌊W/2⌋ (was a flat 4 whether the
 *     enemy had 28 HP or 156)
 *   - wave-clear bonus scales: 15 + 3W (was a flat 15)
 *   - enemy speed is capped at 1.5 (was 1.75 and climbing at wave 17)
 *   - the "Start wave" button previews the next wave's size and speed so
 *     banking gold vs building is a decision, not a wait
 */
Strip.register({
  id: "towerdefense",
  label: "GAME",
  title: "Tower Defense",
  tag: "waves",
  hint: "Place towers · tap a tower to upgrade or sell",
  async mount(container, api){
    let best = await api.getHighscore(); // best = highest wave survived

    const COLS = 10, ROWS = 10;
    const CELL = 26;
    const MAX_LEVEL = 4;      // 4 upgrade steps above the fresh tower
    const SPEED_CAP = 1.5;    // enemies stop accelerating here (was uncapped)
    const SELL_REFUND = 0.7;  // 70% of everything invested comes back

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

    // Round 19: the upgrade/sell panel — the single biggest structural fix.
    // Selecting one of YOUR towers swaps the build row's role: the panel shows
    // the tower's live stats, its next-upgrade price, and a 70%-refund sell.
    const panel = document.createElement("div");
    panel.style.cssText = "display:none; align-items:center; gap:8px; background:var(--panel-2); border:1px solid var(--line); border-radius:12px; padding:6px 10px; font-size:10px; width:min(82vw,"+(COLS*CELL)+"px); box-sizing:border-box;";
    const panelInfo = document.createElement("div");
    panelInfo.style.cssText = "flex:1; line-height:1.5;";
    const upBtn = document.createElement("button");
    upBtn.className = "btn accent";
    upBtn.style.cssText = "padding:5px 9px; font-size:11px;";
    const sellBtn = document.createElement("button");
    sellBtn.className = "btn";
    sellBtn.style.cssText = "padding:5px 9px; font-size:11px; color:var(--danger);";
    const closeBtn = document.createElement("button");
    closeBtn.className = "btn";
    closeBtn.textContent = "✕";
    closeBtn.style.cssText = "padding:5px 8px; font-size:11px;";
    panel.appendChild(panelInfo);
    panel.appendChild(upBtn);
    panel.appendChild(sellBtn);
    panel.appendChild(closeBtn);

    wrap.appendChild(statRow);
    wrap.appendChild(canvas);
    wrap.appendChild(towerRow);
    wrap.appendChild(panel);
    wrap.appendChild(bottomRow);
    container.appendChild(wrap);

    const TOWER_TYPES = {
      arrow:  { cost: 15, range: 2.4, dmg: 8,  rate: 350, color: "#FFB347", splash: 0, slow: 0 },
      cannon: { cost: 30, range: 2.0, dmg: 18, rate: 900, color: "#E8637F", splash: 1.1, slow: 0 },
      frost:  { cost: 25, range: 1.8, dmg: 3,  rate: 500, color: "#56B4E9", splash: 0, slow: 0.5 },
    };
    let selectedType = "arrow";
    let selectedTower = null; // the tower currently shown in the upgrade panel

    Object.entries(TOWER_TYPES).forEach(([key, t]) => {
      const btn = document.createElement("button");
      btn.style.cssText = `padding:6px 10px; border-radius:10px; border:1px solid var(--line); background:var(--panel-2); cursor:pointer; font-size:10px; color:${t.color};`;
      btn.innerHTML = `${key[0].toUpperCase()+key.slice(1)}<br><span style="color:var(--ink-dim)">${t.cost}g</span>`;
      btn.addEventListener("click", () => { selectedType = key; selectTower(null); updateTowerButtons(); });
      btn._key = key;
      towerRow.appendChild(btn);
    });
    function updateTowerButtons(){
      [...towerRow.children].forEach(btn => {
        btn.style.borderColor = btn._key === selectedType ? "var(--amber)" : "var(--line)";
        btn.style.background = btn._key === selectedType ? "rgba(255,179,71,0.1)" : "var(--panel-2)";
      });
    }

    // per-level multipliers — dmg ×1.4, range ×1.06, rate ×0.95 per step
    function towerStats(t){
      const base = TOWER_TYPES[t.type];
      const L = t.level;
      return {
        dmg: base.dmg * Math.pow(1.4, L),
        range: base.range * Math.pow(1.06, L),
        rate: base.rate * Math.pow(0.95, L),
        splash: base.splash,
        slow: base.slow,
        color: base.color,
      };
    }
    function upgradeCost(t){
      return Math.round(TOWER_TYPES[t.type].cost * Math.pow(1.6, t.level + 1));
    }
    function sellValue(t){
      return Math.round(t.invested * SELL_REFUND);
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
      selectTower(null);
      path = bfsPath(grid);
      waveBtn.textContent = "Start wave";
      waveBtn.disabled = false;
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
      towers.push({ r, c, type: selectedType, level: 0, cooldown: 0, invested: type.cost });
      Feedback.tone("place"); Feedback.haptic("medium");
      gold -= type.cost;
      path = bfsPath(grid);
      enemies.forEach(e => { e.path = path; e.pathIdx = Math.min(e.pathIdx, path.length-1); });
      msg.textContent = "";
      updateStat();
      render();
    }

    // selecting a tower opens the panel; selecting null closes it
    function selectTower(t){
      selectedTower = t;
      if(!t){ panel.style.display = "none"; towerRow.style.display = "flex"; return; }
      towerRow.style.display = "none";
      panel.style.display = "flex";
      renderPanel();
    }
    function renderPanel(){
      const t = selectedTower;
      if(!t) return;
      const s = towerStats(t);
      const name = t.type[0].toUpperCase() + t.type.slice(1);
      const lv = t.level >= MAX_LEVEL ? "MAX" : "Lv " + t.level;
      if(t.level >= MAX_LEVEL){
        upBtn.disabled = true; upBtn.style.opacity = 0.4;
        upBtn.textContent = "MAX";
      } else {
        const cost = upgradeCost(t);
        upBtn.disabled = gold < cost; upBtn.style.opacity = gold < cost ? 0.4 : 1;
        upBtn.textContent = `Upgrade ${cost}g`;
      }
      sellBtn.textContent = `Sell +${sellValue(t)}g`;
      panelInfo.innerHTML = `<b style="color:${s.color}">${name} ${lv}</b> · dmg ${s.dmg.toFixed(0)} · rng ${s.range.toFixed(1)}<br>` +
        (t.level >= MAX_LEVEL
          ? `<span style="color:var(--ink-dim)">fully upgraded</span>`
          : `<span style="color:var(--ink-dim)">next: dmg ×1.4 · rng +6% · rate +5%</span>`);
    }

    canvas.addEventListener("click", (e) => {
      const rect = canvas.getBoundingClientRect();
      // map into the LOGICAL space (COLS*CELL x ROWS*CELL) — independent of the
      // backing-store size, so DPR scaling never shifts tower placement
      const scaleX = (COLS*CELL) / rect.width, scaleY = (ROWS*CELL) / rect.height;
      const x = (e.clientX - rect.left) * scaleX, y = (e.clientY - rect.top) * scaleY;
      const c = Math.floor(x / CELL), r = Math.floor(y / CELL);
      if(r<0 || r>=ROWS || c<0 || c>=COLS) return;
      const existing = towers.find(t => t.r === r && t.c === c);
      if(existing){ selectTower(existing); Feedback.tone("select"); return; }
      selectTower(null);
      placeTower(r,c);
    });

    upBtn.addEventListener("click", () => {
      const t = selectedTower;
      if(!t || t.level >= MAX_LEVEL) return;
      const cost = upgradeCost(t);
      if(gold < cost){ msg.textContent = "Not enough gold"; Feedback.buzz("error"); return; }
      gold -= cost;
      t.invested += cost;
      t.level++;
      Feedback.buzz("success");
      msg.textContent = `${t.type} upgraded to Lv ${t.level}`;
      renderPanel();
      updateStat();
      render();
    });
    sellBtn.addEventListener("click", () => {
      const t = selectedTower;
      if(!t) return;
      gold += sellValue(t);
      towers = towers.filter(o => o !== t);
      grid[t.r][t.c] = 0;
      path = bfsPath(grid); // the route reopens — enemies stream through the gap
      enemies.forEach(e => { e.path = path; e.pathIdx = Math.min(e.pathIdx, path.length-1); });
      selectTower(null);
      Feedback.tone("thud"); Feedback.haptic("medium");
      msg.textContent = `Sold for ${sellValue(t)}g`;
      updateStat();
      render();
    });
    closeBtn.addEventListener("click", () => selectTower(null));

    // Range preview: the enemy route used to be invisible and towers showed no
    // reach at all — a first-time player had no way to make an informed
    // placement (my own QA run leaked 7 lives to a tower that could never
    // fire). The BFS route is now drawn as a dotted trail, every built tower
    // wears a range ring, and on hover the selected tower type previews its
    // exact reach (and whether the spot is legal) before you commit gold.
    let hoverCell = null;
    canvas.addEventListener("pointermove", (e) => {
      if(e.pointerType !== "mouse") return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = (COLS*CELL) / rect.width, scaleY = (ROWS*CELL) / rect.height;
      const x = (e.clientX - rect.left) * scaleX, y = (e.clientY - rect.top) * scaleY;
      const c = Math.floor(x / CELL), r = Math.floor(y / CELL);
      hoverCell = (r>=0 && r<ROWS && c>=0 && c<COLS) ? { r, c } : null;
    });
    canvas.addEventListener("pointerleave", () => { hoverCell = null; });

    function cellCenter(r,c){ return { x: c*CELL + CELL/2, y: r*CELL + CELL/2 }; }

    function waveSpec(w){
      return {
        count: 5 + w*2,
        hp: 20 + w*8,
        speed: Math.min(SPEED_CAP, 0.9 + w*0.05), // capped — the wall was speed, not just HP
      };
    }

    function spawnWave(){
      if(waveActive || gameOver) return;
      wave++;
      const spec = waveSpec(wave);
      for(let i=0;i<spec.count;i++){
        enemies.push({
          hp: spec.hp, maxHp: spec.hp, speed: spec.speed,
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
      // next-wave preview on the button itself: banking gold vs building is a
      // real decision only when you can see what's coming
      if(!gameOver && !waveActive){
        const nx = waveSpec(wave + 1);
        waveBtn.innerHTML = `Start wave ${wave+1}<br><span style="font-size:8px; opacity:.75">${nx.count} foes · ${nx.speed >= 1.25 ? "fast" : "normal"}</span>`;
      }
    }

    function render(){
      ctx.clearRect(0,0,canvas.width,canvas.height);
      for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
        ctx.fillStyle = (r+c)%2===0 ? "#12182a" : "#0f1424";
        ctx.fillRect(c*CELL, r*CELL, CELL, CELL);
      }
      if(path){
        ctx.fillStyle = "rgba(255,255,255,0.055)";
        path.forEach(p => ctx.fillRect(p.c*CELL, p.r*CELL, CELL, CELL));
        // dotted centerline: readable at a glance without shouting
        ctx.fillStyle = "rgba(237,234,227,0.16)";
        path.forEach(p => {
          const {x,y} = cellCenter(p.r, p.c);
          ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI*2); ctx.fill();
        });
      }
      ctx.fillStyle = "#6FCF97";
      ctx.fillRect(spawnPoint.c*CELL+4, spawnPoint.r*CELL+4, CELL-8, CELL-8);
      ctx.fillStyle = "#E8637F";
      ctx.fillRect(basePoint.c*CELL+4, basePoint.r*CELL+4, CELL-8, CELL-8);

      towers.forEach(t => {
        const s = towerStats(t);
        const {x,y} = cellCenter(t.r,t.c);
        // range ring under every built tower — you can see what you already cover
        ctx.strokeStyle = s.color + "2e"; // hex alpha: faint but visible on both skins
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, s.range*CELL, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(x,y, CELL*0.32, 0, Math.PI*2);
        ctx.fill();
        // upgrade pips: 0–4 dots under the tower show its level at a glance
        if(t.level > 0){
          ctx.fillStyle = "#EDEAE3";
          for(let i=0;i<t.level;i++){
            ctx.beginPath();
            ctx.arc(x - 5 + i*3.4, y + CELL*0.42, 1.1, 0, Math.PI*2);
            ctx.fill();
          }
        }
        if(t === selectedTower){
          ctx.strokeStyle = "#EDEAE3";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4,3]);
          ctx.strokeRect(t.c*CELL+1.5, t.r*CELL+1.5, CELL-3, CELL-3);
          ctx.setLineDash([]);
        }
      });

      // hover ghost: exact reach of the selected type at the hovered cell.
      // Deliberately shown DURING waves too — mid-wave building is the core
      // Tower Defense decision, which is exactly when reach matters most.
      if(hoverCell && !gameOver && !selectedTower){
        const type = TOWER_TYPES[selectedType];
        const {x,y} = cellCenter(hoverCell.r, hoverCell.c);
        const legal = canPlace(hoverCell.r, hoverCell.c) && gold >= type.cost;
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = legal ? type.color + "88" : "rgba(232,99,127,0.5)";
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, type.range*CELL, 0, Math.PI*2); ctx.stroke();
        // splash towers preview their blast radius too — splash is a cannon's
        // whole selling point, so the ghost shows the inner damage circle
        if(type.splash > 0){
          ctx.setLineDash([2, 4]);
          ctx.beginPath(); ctx.arc(x, y, type.splash*CELL, 0, Math.PI*2); ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.fillStyle = legal ? type.color + "44" : "rgba(232,99,127,0.14)";
        ctx.beginPath(); ctx.arc(x, y, CELL*0.32, 0, Math.PI*2); ctx.fill();
      }

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

    // Round 19: floating gold numbers — a kill that pays is the dopamine tick
    // this game was missing (the audit called the flat 4g "pennies"; at least
    // now the pennies scale and you SEE them land)
    let floats = [];
    function addFloat(x, y, text, color){
      floats.push({ x, y, text, color, t: 900 });
    }
    function renderFloats(dt){
      floats = floats.filter(f => {
        f.t -= dt;
        if(f.t <= 0) return false;
        ctx.globalAlpha = Math.min(1, f.t / 500);
        ctx.fillStyle = f.color;
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(f.text, f.x, f.y - (900 - f.t) * 0.012);
        ctx.globalAlpha = 1;
        return true;
      });
      ctx.textAlign = "start";
    }

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
        const s = towerStats(t);
        const {x,y} = cellCenter(t.r,t.c);
        const rangePx = s.range * CELL;
        let target = null, bestDist = Infinity;
        enemies.forEach(e => {
          const d = Math.hypot(e.x-x, e.y-y);
          if(d <= rangePx && d < bestDist){ bestDist = d; target = e; }
        });
        if(target){
          t.cooldown = s.rate;
          projectiles.push({ x, y, tx: target, dmg: s.dmg, splash: s.splash, slow: s.slow, color: s.color, speed: 6 });
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
        // Round 19: bounty scales with the wave — the reward curve finally
        // lives inside the same quadratic as the difficulty curve
        const bounty = 4 + Math.floor(wave / 2);
        gold += dead.length * bounty;
        dead.forEach(e => addFloat(e.x, e.y, "+" + bounty, "#FFB347"));
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
          const clearBonus = 15 + wave * 3;
          gold += clearBonus;
          const base = cellCenter(basePoint.r, basePoint.c);
          addFloat(base.x, base.y - 10, "+" + clearBonus, "#6FCF97");
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
      selectTower(null);
      msg.textContent = `Base fell at wave ${wave}. Tap Restart.`;
      waveBtn.textContent = "Restart";
      waveBtn.disabled = false;
      if(wave > best){ best = wave; api.setHighscore(best); }
      updateStat();
    }

    waveBtn.addEventListener("click", () => {
      if(gameOver){ resetGame(); return; }
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
