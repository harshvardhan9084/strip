Strip.register({
  id: "blockfall",
  label: "ARCADE",
  title: "Blockfall",
  tag: "classic",
  hint: "Arrows / buttons · full rows clear",
  async mount(container, api){
    let best = await api.getHighscore();
    const COLS = 10, ROWS = 16;

    // 7 tetrominoes as matrices; rotation = transpose + reverse rows (clockwise)
    const SHAPES = {
      I: [[1,1,1,1]],
      O: [[1,1],[1,1]],
      T: [[0,1,0],[1,1,1]],
      S: [[0,1,1],[1,1,0]],
      Z: [[1,1,0],[0,1,1]],
      J: [[1,0,0],[1,1,1]],
      L: [[0,0,1],[1,1,1]]
    };
    const BAG = Object.keys(SHAPES);
    const PIECE_COLOR = { I:"#6FA8FF", O:"#EDEAE3", T:"#8B7FE8", S:"#5AC98A", Z:"#E8637F", J:"#FFB347", L:"#F2A65A" };
    const LINE_SCORE = [0, 100, 300, 500, 800];

    let grid, piece, nextPiece, running, over, gravId;
    let score = 0, lines = 0, level = 1;
    let bag = []; // 7-bag randomizer — no more cruel I-piece droughts

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:10px;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:14px; font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    wrap.appendChild(statRow);

    const playRow = document.createElement("div");
    playRow.style.cssText = "display:flex; gap:10px; align-items:flex-start;";

    const board = document.createElement("div");
    board.style.cssText = `display:grid; grid-template-columns:repeat(${COLS},14px); grid-auto-rows:14px; gap:1px; background:#101018; padding:6px; border-radius:10px;`;
    playRow.appendChild(board);

    const sideCol = document.createElement("div");
    sideCol.style.cssText = "display:flex; flex-direction:column; gap:6px; align-items:center;";
    const nextLabel = document.createElement("div");
    nextLabel.style.cssText = "font-family:var(--font-display); font-size:8px; color:var(--ink-dim);";
    nextLabel.textContent = "NEXT";
    sideCol.appendChild(nextLabel);
    const nextGrid = document.createElement("div");
    nextGrid.style.cssText = "display:grid; grid-template-columns:repeat(4,10px); grid-auto-rows:10px; gap:1px;";
    sideCol.appendChild(nextGrid);
    playRow.appendChild(sideCol);
    wrap.appendChild(playRow);

    const cells = [];
    for(let i = 0; i < COLS * ROWS; i++){
      const d = document.createElement("div");
      d.style.cssText = "width:14px; height:14px; border-radius:3px; background:var(--panel);";
      board.appendChild(d);
      cells.push(d);
    }
    const nextCells = [];
    for(let i = 0; i < 16; i++){
      const d = document.createElement("div");
      d.style.cssText = "width:10px; height:10px; border-radius:2px; background:transparent;";
      nextGrid.appendChild(d);
      nextCells.push(d);
    }

    // touch controls — keyboard alone locks phone players out
    const ctrlRow1 = document.createElement("div");
    ctrlRow1.style.cssText = "display:flex; gap:8px;";
    const ctrlRow2 = document.createElement("div");
    ctrlRow2.style.cssText = "display:flex; gap:8px;";
    wrap.appendChild(ctrlRow1);
    wrap.appendChild(ctrlRow2);

    function mkBtn(label, fn, big){
      const b = document.createElement("button");
      b.className = "btn";
      b.textContent = label;
      b.style.cssText = `min-width:${big ? 74 : 44}px; padding:8px 0; font-size:13px;`;
      b.addEventListener("click", fn);
      return b;
    }
    ctrlRow1.appendChild(mkBtn("◀", () => shift(-1)));
    ctrlRow1.appendChild(mkBtn("⟳", () => rotate()));
    ctrlRow1.appendChild(mkBtn("▶", () => shift(1)));
    ctrlRow2.appendChild(mkBtn("▼ soft", () => softDrop(), true));
    ctrlRow2.appendChild(mkBtn("⇓ drop", () => hardDrop(), true));

    const startBtn = document.createElement("button");
    startBtn.className = "btn accent";
    startBtn.textContent = "Start";
    startBtn.addEventListener("click", startGame);
    wrap.appendChild(startBtn);

    container.appendChild(wrap);

    function idx(r, c){ return r * COLS + c; }

    function randPiece(){
      // 7-bag: shuffle all seven, deal them out before refilling — the classic
      // fairness guarantee pure-random selection lacks
      if(!bag.length){
        bag = BAG.slice();
        for(let i = bag.length - 1; i > 0; i--){
          const j = Math.floor(Math.random() * (i + 1));
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
      }
      const t = bag.pop();
      return { type: t, m: SHAPES[t].map(row => row.slice()), r: 0, c: Math.floor((COLS - SHAPES[t][0].length) / 2) };
    }

    function collides(m, pr, pc){
      for(let r = 0; r < m.length; r++){
        for(let c = 0; c < m[r].length; c++){
          if(!m[r][c]) continue;
          const gr = pr + r, gc = pc + c;
          if(gc < 0 || gc >= COLS || gr >= ROWS) return true;
          if(gr >= 0 && grid[gr][gc]) return true;
        }
      }
      return false;
    }

    function spawn(){
      piece = nextPiece || randPiece();
      nextPiece = randPiece();
      drawNext();
      if(collides(piece.m, piece.r, piece.c)){
        gameOver();
        return;
      }
      // spawn landing check happens on first gravity tick — draw immediately
      draw();
    }

    function drawNext(){
      nextCells.forEach(d => { d.style.background = "transparent"; });
      const m = nextPiece.m;
      const offR = Math.floor((4 - m.length) / 2), offC = Math.floor((4 - m[0].length) / 2);
      for(let r = 0; r < m.length; r++) for(let c = 0; c < m[r].length; c++){
        if(m[r][c]) nextCells[(r + offR) * 4 + (c + offC)].style.background = PIECE_COLOR[nextPiece.type];
      }
    }

    function merge(){
      for(let r = 0; r < piece.m.length; r++) for(let c = 0; c < piece.m[r].length; c++){
        if(piece.m[r][c]){
          const gr = piece.r + r, gc = piece.c + c;
          if(gr >= 0) grid[gr][gc] = piece.type;
        }
      }
    }

    function clearLines(){
      let cleared = 0;
      for(let r = ROWS - 1; r >= 0; r--){
        if(grid[r].every(v => v)){
          grid.splice(r, 1);
          grid.unshift(Array(COLS).fill(null));
          cleared++;
          r++; // re-check this row index after the shift
        }
      }
      if(cleared){
        lines += cleared;
        score += LINE_SCORE[cleared] * level;
        const newLevel = 1 + Math.floor(lines / 8);
        if(newLevel !== level){
          level = newLevel;
          restartGravity();
        }
        statUpdate();
        Feedback.buzz("win");
      }
    }

    function gravity(){
      if(!running || over) return;
      if(!collides(piece.m, piece.r + 1, piece.c)){
        piece.r++;
      } else {
        merge();
        clearLines();
        spawn();
      }
      draw();
    }

    function restartGravity(){
      clearInterval(gravId);
      if(!running || over) return; // gameOver during spawn must not leave a live timer
      const speed = Math.max(140, 620 - (level - 1) * 65);
      gravId = setInterval(gravity, speed);
    }

    function shift(dir){
      if(!running || over) return;
      if(!collides(piece.m, piece.r, piece.c + dir)){
        piece.c += dir;
        Feedback.tone("tap");
        draw();
      }
    }

    function rotate(){
      if(!running || over) return;
      const m = piece.m;
      const rotated = m[0].map((_, i) => m.map(row => row[i]).reverse());
      // wall kicks: try in-place, then nudge left/right — corner rotations no longer fail
      for(const kick of [0, -1, 1, -2, 2]){
        if(!collides(rotated, piece.r, piece.c + kick)){
          piece.m = rotated;
          piece.c += kick;
          Feedback.tone("blip");
          draw();
          return;
        }
      }
    }

    function softDrop(){
      if(!running || over) return;
      score += 1; // credit BEFORE gravity — if this drop ends the game, the
      gravity();  // saved highscore must match what the stat row shows
      statUpdate();
    }

    function hardDrop(){
      if(!running || over) return;
      while(!collides(piece.m, piece.r + 1, piece.c)){
        piece.r++;
        score += 2;
      }
      Feedback.haptic("light");
      gravity();
      statUpdate();
    }

    function statUpdate(){
      statRow.innerHTML = `<div>SCORE <span style="color:var(--amber)">${score}</span></div><div>LINES <span style="color:var(--purple)">${lines}</span></div><div>LV ${level}</div><div>BEST <span style="color:var(--amber)">${best}</span></div>`;
    }

    function draw(){
      const view = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      for(let r = 0; r < ROWS; r++) for(let c = 0; c < COLS; c++) if(grid[r][c]) view[r][c] = grid[r][c];
      if(piece && running && !over){
        for(let r = 0; r < piece.m.length; r++) for(let c = 0; c < piece.m[r].length; c++){
          if(piece.m[r][c]){
            const gr = piece.r + r, gc = piece.c + c;
            if(gr >= 0 && gr < ROWS && gc >= 0 && gc < COLS) view[gr][gc] = piece.type;
          }
        }
      }
      for(let i = 0; i < COLS * ROWS; i++){
        const v = view[Math.floor(i / COLS)][i % COLS];
        cells[i].style.background = v ? PIECE_COLOR[v] : "var(--panel)";
      }
    }

    function startGame(){
      grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      score = 0; lines = 0; level = 1;
      running = true; over = false;
      nextPiece = null;
      startBtn.disabled = true;
      startBtn.textContent = "Playing…";
      statUpdate();
      spawn();
      restartGravity();
    }

    function gameOver(){
      over = true; running = false;
      clearInterval(gravId);
      Feedback.buzz("lose");
      startBtn.disabled = false;
      startBtn.textContent = "Piled up — retry";
      statUpdate(); // final +2s from a hard drop must show before saving
      api.setHighscore(score).then(v => { best = v; statUpdate(); });
      draw();
    }

    function onKey(e){
      if(!running) return;
      if(e.key === "ArrowLeft"){ e.preventDefault(); shift(-1); }
      else if(e.key === "ArrowRight"){ e.preventDefault(); shift(1); }
      else if(e.key === "ArrowDown"){ e.preventDefault(); softDrop(); }
      else if(e.key === "ArrowUp"){ e.preventDefault(); rotate(); }
      else if(e.key === " "){ e.preventDefault(); hardDrop(); }
    }
    window.addEventListener("keydown", onKey);

    statUpdate();
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    nextPiece = randPiece();
    drawNext();
    draw();

    return () => {
      clearInterval(gravId);
      window.removeEventListener("keydown", onKey);
    };
  }
});
