Strip.register({
  id: "blackjack",
  label: "CARDS",
  title: "Blackjack 21",
  tag: "virtual chips",
  hint: "Beat the dealer · dealer stands on 17",
  async mount(container, api){
    const SUITS = [
      { s: "♠", red: false }, { s: "♥", red: true },
      { s: "♦", red: true },  { s: "♣", red: false }
    ];
    const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
    const CHIPS = [10, 25, 50];

    const saved = await api.load();
    let bank = saved && Number.isFinite(saved.bank) ? saved.bank : 200;
    let bet = 0;
    let deck = [], player = [], dealer = [], phase = "bet"; // bet | play | done
    let holeRevealed = false;
    let settleTimer = null;
    let streak = saved && Number.isFinite(saved.streak) ? saved.streak : 0;

    // Round 19 (AUDIT.md — Blackjack P1): the deck's most session-sticky game
    // had NO highscore hook at all — bank peak now feeds the meta for free;
    // chips scale with the bank so a 1,000-chip bank isn't 20+ taps (S4);
    // double-down adds the classic decision; a 5-win streak pays a bonus.

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:10px;";

    const bankRow = document.createElement("div");
    bankRow.style.cssText = "font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    wrap.appendChild(bankRow);

    const table = document.createElement("div");
    table.style.cssText = "width:min(78vw,280px); min-height:150px; border-radius:12px; background:rgba(16,16,24,.8); padding:10px; display:flex; flex-direction:column; gap:8px;";
    wrap.appendChild(table);

    const dealerRow = document.createElement("div");
    dealerRow.style.cssText = "display:flex; gap:5px; min-height:44px; align-items:center;";
    table.appendChild(dealerRow);
    const msgEl = document.createElement("div");
    msgEl.style.cssText = "font-family:var(--font-display); font-size:9px; color:var(--purple); min-height:12px;";
    table.appendChild(msgEl);
    const playerRow = document.createElement("div");
    playerRow.style.cssText = "display:flex; gap:5px; min-height:44px; align-items:center;";
    table.appendChild(playerRow);

    const betRow = document.createElement("div");
    betRow.style.cssText = "display:flex; gap:8px; flex-wrap:wrap; justify-content:center; max-width:290px;";
    wrap.appendChild(betRow);

    // denominations scale with the bank — richer players think in bigger chips
    function chipValues(){
      const v = [10, 25, 50];
      if(bank >= 400) v.push(100);
      if(bank >= 2000) v.push(500);
      return v;
    }
    let chipBtns = [];
    function rebuildChips(){
      chipBtns.forEach(b => b.remove());
      chipBtns = [];
      chipValues().forEach(v => {
        const b = document.createElement("button");
        b.className = "btn";
        b.textContent = "+" + v;
        b.style.minWidth = "44px";
        b.addEventListener("click", () => {
          if(phase !== "bet") return;
          if(bet + v > bank){ msgEl.textContent = "not enough chips"; return; }
          bet += v;
          Feedback.tone("tap"); Feedback.haptic("light");
          render();
        });
        chipBtns.push(b);
        betRow.insertBefore(b, clearBtn);
      });
    }


    const clearBtn = document.createElement("button");
    clearBtn.className = "btn";
    clearBtn.textContent = "Clear";
    clearBtn.addEventListener("click", () => { if(phase === "bet"){ bet = 0; render(); } });
    betRow.appendChild(clearBtn);

    const actionRow = document.createElement("div");
    actionRow.style.cssText = "display:flex; gap:8px;";
    wrap.appendChild(actionRow);

    const dealBtn = document.createElement("button");
    dealBtn.className = "btn accent";
    dealBtn.textContent = "Deal";
    dealBtn.addEventListener("click", deal);
    actionRow.appendChild(dealBtn);

    const hitBtn = document.createElement("button");
    hitBtn.className = "btn";
    hitBtn.textContent = "Hit";
    hitBtn.addEventListener("click", hit);
    actionRow.appendChild(hitBtn);

    const standBtn = document.createElement("button");
    standBtn.className = "btn";
    standBtn.textContent = "Stand";
    standBtn.addEventListener("click", stand);
    actionRow.appendChild(standBtn);

    const doubleBtn = document.createElement("button");
    doubleBtn.className = "btn purple";
    doubleBtn.textContent = "Double";
    doubleBtn.addEventListener("click", doubleDown);
    actionRow.appendChild(doubleBtn);

    const brokeNote = document.createElement("div");
    brokeNote.style.cssText = "font-size:10px; color:var(--ink-dim); text-align:center;";
    brokeNote.textContent = "Chips are virtual. No real money, no purchases — ever.";
    wrap.appendChild(brokeNote);

    container.appendChild(wrap);

    function newDeck(){
      deck = [];
      for(const suit of SUITS) for(const r of RANKS) deck.push({ r, s: suit.s, red: suit.red });
      // Fisher-Yates — Array.sort(random) is a biased non-shuffle
      for(let i = deck.length - 1; i > 0; i--){
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
    }

    function draw(){
      if(!deck.length) newDeck();
      return deck.pop();
    }

    function handValue(cards){
      // aces count 11 and demote to 1 as needed — the standard soft/hard rule
      let total = 0, aces = 0;
      for(const c of cards){
        if(c.r === "A"){ aces++; total += 11; }
        else if(["J","Q","K"].includes(c.r)) total += 10;
        else total += Number(c.r);
      }
      while(total > 21 && aces > 0){ total -= 10; aces--; }
      return total;
    }

    function cardEl(c, hidden){
      const d = document.createElement("div");
      d.style.cssText = `width:32px; height:44px; border-radius:6px; display:flex; flex-direction:column; align-items:center; justify-content:center; font-size:12px; font-weight:700; background:${hidden ? "var(--panel-2)" : "#EDEAE3"}; color:${hidden ? "var(--ink-dim)" : (c.red ? "#C43B3B" : "#1B1B24")}; border:1px solid var(--line);`;
      if(hidden){
        d.textContent = "?";
      } else {
        const r1 = document.createElement("span"); r1.textContent = c.r;
        const r2 = document.createElement("span"); r2.textContent = c.s; r2.style.fontSize = "11px";
        d.appendChild(r1); d.appendChild(r2);
      }
      return d;
    }

    function renderRow(el, cards, hideHole){
      el.innerHTML = "";
      cards.forEach((c, i) => el.appendChild(cardEl(c, hideHole && i === 1)));
    }

    function render(msg){
      bankRow.innerHTML = `BANK <span style="color:var(--amber)">${bank}</span> · BET <span style="color:var(--purple)">${bet}</span>` +
        (streak > 1 ? ` · <span style="color:#6FCF97">streak ×${streak}</span>` : "");
      renderRow(dealerRow, dealer, !holeRevealed && dealer.length);
      renderRow(playerRow, player, false);
      rebuildChips();
      dealBtn.disabled = phase !== "bet" || bet <= 0;
      hitBtn.disabled = phase !== "play";
      standBtn.disabled = phase !== "play";
      doubleBtn.disabled = phase !== "play" || player.length !== 2 || bank < bet * 2;
      [dealBtn, hitBtn, standBtn, doubleBtn].forEach(b => { b.style.opacity = b.disabled ? ".45" : "1"; });
      const pv = player.length ? handValue(player) : 0;
      msgEl.textContent = msg || (phase === "play" ? `you: ${pv}` : phase === "bet" ? (bet > 0 ? `betting ${bet} — press Deal` : "place a chip") : "");
    }

    function deal(){
      if(phase !== "bet" || bet <= 0) return;
      if(deck.length < 15) newDeck();
      player = [draw(), draw()];
      dealer = [draw(), draw()];
      holeRevealed = false;
      phase = "play";
      Feedback.tone("ok");
      const pv = handValue(player);
      if(pv === 21){
        // natural blackjack — reveal and settle immediately
        holeRevealed = true;
        const dv = handValue(dealer);
        if(dv === 21){ settle(0, "both blackjack — push"); }
        else { settle(Math.ceil(bet * 1.5), "BLACKJACK! pays 3:2"); } // ceil — rounding never eats the player's odd chip
        return;
      }
      render();
    }

    function hit(){
      if(phase !== "play") return;
      player.push(draw());
      Feedback.tone("tap");
      const pv = handValue(player);
      if(pv > 21){
        holeRevealed = true;
        settle(-bet, "bust at " + pv);
      } else if(pv === 21){
        stand();
      } else {
        render();
      }
    }

    function doubleDown(){
      if(phase !== "play" || player.length !== 2 || bank < bet * 2) return;
      // the classic gamble: exactly one more card, stake doubled, then stand
      player.push(draw());
      const pv = handValue(player);
      if(pv > 21){
        holeRevealed = true;
        settle(-bet * 2, "doubled and busted at " + pv);
      } else {
        stand(2); // double stakes flow through the normal dealer resolution
      }
    }

    function stand(stakeMult){
      if(phase !== "play") return;
      stakeMult = stakeMult || 1;
      holeRevealed = true;
      // dealer draws to 17 and stands on ALL 17s including soft (S17 — the
      // player-friendly standard; H17 would have the dealer hit soft 17)
      while(handValue(dealer) < 17){
        dealer.push(draw());
        render("dealer draws…");
      }
      const dv = handValue(dealer), pv = handValue(player);
      const stake = bet * stakeMult;
      if(dv > 21) settle(stake, "dealer busts at " + dv + " — you win!");
      else if(dv > pv) settle(-stake, "dealer " + dv + " beats your " + pv);
      else if(dv < pv) settle(stake, "you win " + pv + " vs " + dv + "!");
      else settle(0, "push — bet returned");
    }

    function settle(delta, msg){
      phase = "done";
      bank += delta;
      if(delta > 0){
        Feedback.buzz("win");
        streak++;
        // the streak meter pays: every 5th consecutive win tips a bonus
        if(streak > 0 && streak % 5 === 0){
          bank += 50;
          msg += " · 5-STREAK BONUS +50";
          Feedback.buzz("win");
        }
      } else if(delta < 0){
        Feedback.buzz("lose");
        streak = 0;
      } else {
        Feedback.tone("ok"); // a push is neither a win nor a loss — neutral
      }
      // the meta finally sees this game: bank peak is the highscore (max-wins
      // store, so every settle just reports and the store keeps the peak)
      api.setHighscore(Math.max(0, bank));
      api.save({ bank, streak });
      settleTimer = setTimeout(() => {
        phase = "bet";
        bet = Math.min(bet, bank);
        if(bank < 10){ bank += 200; streak = 0; }
        render();
      }, 1600);
      render(msg + (bank < 10 ? " · restaked 200" : ""));
    }

    render();

    return () => clearTimeout(settleTimer);
  }
});
