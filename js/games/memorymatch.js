Strip.register({
  id: "memorymatch",
  scoreEncoding: "inverted", scoreCeiling: 100000, // stores 100000 - moves|seconds; NEVER double it (twist)
  label: "PUZZLE",
  title: "Memory Match",
  tag: "4×3",
  hint: "Flip two cards, find the pairs",
  async mount(container, api){
    let best = await api.getHighscore(); // best = fewest moves (stored inverted, like lights out)
    const EMOJI = ["🍕","🚀","🎸","🐙","🌵","🔮"];

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:14px;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    wrap.appendChild(statRow);

    const board = document.createElement("div");
    board.style.cssText = "display:grid; grid-template-columns:repeat(4,1fr); gap:8px; width:min(78vw,260px);";
    wrap.appendChild(board);

    const newBtn = document.createElement("button");
    newBtn.className = "btn accent";
    newBtn.textContent = "New game";
    newBtn.addEventListener("click", newGame);
    wrap.appendChild(newBtn);

    container.appendChild(wrap);

    let cards, flipped, matched, moves, busy;

    function shuffle(arr){
      const a = arr.slice();
      for(let i=a.length-1;i>0;i--){
        const j = Math.floor(Math.random()*(i+1));
        [a[i],a[j]]=[a[j],a[i]];
      }
      return a;
    }

    function newGame(){
      const deck = shuffle([...EMOJI, ...EMOJI]);
      cards = deck.map(e => ({ emoji: e, flipped:false, matched:false }));
      flipped = []; matched = 0; moves = 0; busy = false;
      renderBoard();
      updateStat();
    }

    function renderBoard(){
      board.innerHTML = "";
      cards.forEach((c, i) => {
        const btn = document.createElement("button");
        btn.style.cssText = `
          aspect-ratio:1; border-radius:8px; border:none; cursor:pointer;
          background:${c.flipped || c.matched ? "var(--panel-2)" : "var(--purple)"};
          font-size:22px; display:flex; align-items:center; justify-content:center;
          opacity:${c.matched ? 0.4 : 1};
          transition:background .15s ease;
        `;
        btn.textContent = (c.flipped || c.matched) ? c.emoji : "";
        btn.addEventListener("click", () => flip(i));
        board.appendChild(btn);
      });
    }

    function updateStat(){
      statRow.textContent = matched === EMOJI.length
        ? `SOLVED in ${moves} moves — best ${best === Infinity ? "-" : best}`
        : `MOVES ${moves} · PAIRS ${matched}/${EMOJI.length}`;
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
          if(matched === EMOJI.length){
            Feedback.buzz("win");
            const scoreValue = 100000 - moves;
            api.setHighscore(scoreValue).then(v => { best = 100000 - v; updateStat(); });
          }
        } else {
          Feedback.tone("fail");
          setTimeout(() => {
            cards[a].flipped = false; cards[b].flipped = false;
            flipped = []; busy = false;
            renderBoard();
          }, 700);
          updateStat();
        }
      }
    }

    best = best ? 100000 - best : Infinity;
    newGame();
  }
});
