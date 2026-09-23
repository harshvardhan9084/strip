Strip.register({
  id: "memorymatch",
  scoreEncoding: "inverted", scoreCeiling: 100000, // stores 100000 - moves (CLASSIC field only); NEVER double it (twist)
  label: "PUZZLE",
  title: "Memory Match",
  tag: "3 fields",
  hint: "Flip two cards, find the pairs",
  async mount(container, api){
    // Round 22 (P2 tail, carried since R19): one 4×3 board forever is a game
    // you outgrow in ninety seconds. Now a 3-size ladder — 4×3 / 6×4 / 6×5 —
    // with per-size bests. The classic field still feeds the highscore store
    // (inverted moves); the two bigger fields keep honest bests inside the
    // save, exactly like Minesweeper's ladder. More pairs = more working
    // memory on the table = the deck's quietest puzzle gets a real slope.
    const POOL = ["🍕","🚀","🎸","🐙","🌵","🔮","🧩","🦊","⚡","🍄","🎲","🦉","🍀","🍉","🛸"];
    const SIZES = [
      { key: "classic", label: "4×3", cols: 4, pairs: 6 },
      { key: "plus",    label: "6×4", cols: 6, pairs: 12 },
      { key: "grand",   label: "6×5", cols: 6, pairs: 15 },
    ];
    const INV = 100000;
    const saved0 = await api.load().catch(() => null);
    let sizeIdx = saved0 && Number.isFinite(saved0.size) ? Math.min(2, Math.max(0, Math.floor(saved0.size))) : 0;
    const bests = saved0 && saved0.bests ? saved0.bests : {};
    const stored = await api.getHighscore();
    let bestClassic = stored ? INV - stored : Infinity;
    let S = SIZES[sizeIdx];
    let best = sizeIdx === 0 ? bestClassic : (bests[S.key] ?? Infinity);

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:14px;";

    // R36 — the stat row is shell-owned (api.setStats): MOVES · PAIRS · BEST
    // in the slot between title and playfield. The solved sentence is the run
    // ceremony's job now.

    // size pills
    const sizeRow = document.createElement("div");
    sizeRow.style.cssText = "display:flex; gap:6px;";
    const sizeBtns = [];
    SIZES.forEach((d, i) => {
      const b = document.createElement("button");
      b.textContent = d.label;
      b.style.cssText = "font-size:10px; padding:4px 9px; border-radius:20px; border:1px solid var(--line); background:var(--panel-2); color:var(--ink-dim); cursor:pointer;";
      b.addEventListener("click", () => {
        if(i === sizeIdx) return;
        sizeIdx = i; S = SIZES[i];
        best = sizeIdx === 0 ? bestClassic : (bests[S.key] ?? Infinity);
        api.save({ size: sizeIdx, bests }).catch(()=>{});
        paintSizes();
        newGame();
      });
      sizeBtns.push(b);
      sizeRow.appendChild(b);
    });
    function paintSizes(){
      sizeBtns.forEach((b, i) => {
        const active = i === sizeIdx;
        b.style.background = active ? "var(--amber)" : "var(--panel-2)";
        b.style.color = active ? "var(--on-accent)" : "var(--ink-dim)";
      });
    }
    wrap.appendChild(sizeRow);

    const board = document.createElement("div");
    wrap.appendChild(board);

    const newBtn = document.createElement("button");
    newBtn.className = "btn accent";
    newBtn.textContent = "New game";
    newBtn.addEventListener("click", newGame);
    wrap.appendChild(newBtn);

    container.appendChild(wrap);

    let cards, flipped, matched, moves, busy;
    let flipTimer = null; // the 700ms mismatch flip-back — armed while a size switch or New game can rebuild the deck under it

    function shuffle(arr){
      const a = arr.slice();
      for(let i=a.length-1;i>0;i--){
        const j = Math.floor(Math.random()*(i+1));
        [a[i],a[j]]=[a[j],a[i]];
      }
      return a;
    }

    function newGame(){
      if(flipTimer){ clearTimeout(flipTimer); flipTimer = null; } // a stale flip-back must never index the NEW deck (size switch → cards[a] undefined → throw)
      RunCeremony.hide(container); // a restart never fights the flourish
      const deck = shuffle(POOL.slice(0, S.pairs).flatMap(e => [e, e]));
      cards = deck.map(e => ({ emoji: e, flipped:false, matched:false }));
      flipped = []; matched = 0; moves = 0; busy = false;
      board.style.cssText = `display:grid; grid-template-columns:repeat(${S.cols},1fr); gap:8px; width:min(78vw,calc(${Math.min(S.pairs * 2, S.cols) * 62}px * var(--board-scale,1)));`;
      renderBoard();
      updateStat();
    }

    function renderBoard(){
      board.innerHTML = "";
      const small = S.pairs > 6; // denser fields get smaller tiles & glyphs
      cards.forEach((c, i) => {
        const btn = document.createElement("button");
        // Round 34 contrast floor + audit faces fix: face-down tiles wear a
        // faint card rim (a flat purple slab read as a colored gap), and the
        // emoji faces grew — 22px orbs were placeholder-grade memory bait.
        btn.style.cssText = `
          aspect-ratio:1; border-radius:8px; border:none; cursor:pointer;
          background:${c.flipped || c.matched ? "var(--panel-2)" : "var(--purple)"};
          box-shadow:${c.flipped || c.matched ? "inset 0 0 0 1px var(--line)" : "inset 0 0 0 1px rgba(255,255,255,.14), inset 0 2px 6px rgba(255,255,255,.10)"};
          font-size:${small ? 24 : 30}px; display:flex; align-items:center; justify-content:center;
          opacity:${c.matched ? 0.4 : 1};
          transition:background .15s ease;
        `;
        btn.textContent = (c.flipped || c.matched) ? c.emoji : "";
        btn.addEventListener("click", () => flip(i));
        board.appendChild(btn);
      });
    }

    function updateStat(){
      api.setStats([
        { label: "MOVES", value: String(moves), color: "var(--amber)" },
        { label: "PAIRS", value: matched + "/" + S.pairs, color: "var(--ink)" },
        { label: "BEST", value: best === Infinity ? "—" : String(best), color: "var(--purple)" },
      ]);
    }

    function flip(i){
      if(busy || cards[i].flipped || cards[i].matched) return;
      Feedback.tone("select"); Feedback.haptic("light");
      cards[i].flipped = true;
      flipped.push(i);
      renderBoard();

      if(flipped.length === 2){
        busy = true;
        moves++;
        const [a,b] = flipped;
        if(cards[a].emoji === cards[b].emoji){
          cards[a].matched = true; cards[b].matched = true;
          matched++;
          Feedback.tone("success"); Feedback.haptic("medium");
          flipped = []; busy = false;
          renderBoard();
          updateStat();
          if(matched === S.pairs){
            Feedback.buzz("win");
            api.gameover("win", moves);
            const prevBest = best;
            if(moves < best){
              best = moves;
              bests[S.key] = moves;
              if(sizeIdx === 0){
                bestClassic = moves;
                api.setHighscore(INV - moves); // only the classic time feeds the store
              } else {
                api.save({ size: sizeIdx, bests }).catch(()=>{});
              }
            }
            updateStat();
            // R35 ceremony adoption: SOLVED was a stat-row swap — the last
            // pair now lands on the standard panel with the honest delta.
            RunCeremony.show(container, {
              tone: "clear",
              label: "SOLVED",
              score: String(moves),
              unit: "moves",
              delta: moves < prevBest ? "NEW BEST" : "BEST " + prevBest,
              deltaTone: moves < prevBest ? "good" : "",
              verb: "NEW GAME",
              onVerb: newGame,
            });
          }
        } else {
          Feedback.tone("fail");
          flipTimer = setTimeout(() => {
            flipTimer = null;
            cards[a].flipped = false; cards[b].flipped = false;
            flipped = []; busy = false;
            renderBoard();
          }, 700);
          updateStat();
        }
      }
    }

    paintSizes();
    newGame();

    return () => { if(flipTimer) clearTimeout(flipTimer); };
  }
});
