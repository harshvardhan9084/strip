Strip.register({
  id: "thisorthat",
  label: "ODDBALL",
  title: "This or That",
  tag: "pick",
  hint: "Tap a side — no wrong answers",
  async mount(container, api){
    const state = (await api.load()) || { total: 0, bag: null };
    const PAIRS = [
      ["🍕 Pizza","🍔 Burger"], ["🏔 Mountains","🏖 Beach"], ["☕ Coffee","🍵 Tea"],
      ["🌙 Night owl","☀️ Early bird"], ["📚 Books","🎬 Movies"], ["🐱 Cats","🐶 Dogs"],
      ["🎮 Console","🖥 PC gaming"], ["🍫 Chocolate","🍦 Ice cream"], ["🚗 Road trip","✈️ Flying"],
      ["🎧 Headphones","🔊 Speakers"], ["🌧 Rainy days","☀️ Sunny days"], ["🍜 Noodles","🍚 Rice"],
      ["📱 Texting","📞 Calling"], ["🏙 City life","🌲 Countryside"], ["🎸 Guitar","🎹 Piano"],
      ["🍟 Fries","🧀 Mozzarella sticks"], ["🥐 Croissant","🥯 Bagel"], ["🍿 Popcorn","🍬 Candy"],
      ["🛁 Bath","🚿 Shower"], ["📖 Physical books","📱 E-books"], ["🎨 Drawing","✍️ Writing"],
      ["🍺 Beer","🍷 Wine"], ["🥤 Soda","🧃 Juice"], ["🍩 Donuts","🧁 Cupcakes"],
      ["🏊 Swimming","🚴 Cycling"], ["⛷ Skiing","🏄 Surfing"], ["🎤 Karaoke","💃 Dancing"],
      ["📺 TV shows","🎧 Podcasts"], ["🧩 Puzzles","🃏 Card games"], ["🌅 Sunrise","🌇 Sunset"],
      ["🍝 Pasta","🍕 Pizza"], ["🥩 Steak","🐟 Seafood"], ["🍦 Vanilla","🍫 Chocolate"],
      ["🏕 Camping","🏨 Hotels"], ["🚂 Trains","✈️ Planes"], ["📷 Photos","🎥 Videos"],
      ["🎯 Darts","🎳 Bowling"], ["♟️ Chess","🀄 Mahjong"], ["🧗 Rock climbing","🏃 Running"],
      ["🍋 Sour candy","🍬 Sweet candy"], ["🥶 Cold showers","🥵 Hot showers"], ["🌵 Desert","🌊 Ocean"],
      ["🎃 Halloween","🎄 Christmas"], ["🎆 Fireworks","🕯 Candlelight"], ["🖊 Pen","✏️ Pencil"],
      ["🛌 Naps","☕ Caffeine"], ["🧦 Mismatched socks","👞 Formal shoes"], ["🍳 Breakfast","🍽 Dinner"],
      ["🎢 Roller coasters","🎡 Ferris wheels"], ["🐝 Bees","🕷 Spiders"], ["🌍 Traveling alone","👥 Traveling with friends"],
      ["📻 Radio","🎵 Streaming"], ["🖋 Handwriting","⌨️ Typing"], ["🏀 Basketball","⚽ Soccer"],
      ["🎾 Tennis","🏓 Table tennis"], ["🍔 Fast food","🍱 Home cooked"], ["🧊 Ice cream","🍨 Frozen yogurt"],
      ["🎭 Theater","🎬 Cinema"], ["📝 To-do lists","🧠 Mental notes"], ["🌌 Stargazing","🏙 City lights"],
      ["🚶 Walking","🏃 Running"], ["🛹 Skateboarding","🛼 Rollerskating"], ["🍄 Mushrooms","🧅 Onions"],
      ["🥑 Avocado","🍅 Tomato"], ["🧊 Iced coffee","☕ Hot coffee"], ["🎮 Multiplayer","🎮 Single player"],
      ["📅 Planning ahead","🎲 Winging it"], ["🌆 Big city","🏘 Small town"], ["🧗 Adventure sports","🧘 Relaxing hobbies"],
      ["🎹 Classical music","🎸 Rock music"], ["🍇 Grapes","🍓 Strawberries"], ["🥞 Pancakes","🧇 Waffles"],
      ["🌮 Tacos","🌯 Burritos"], ["🎳 Bowling night","🎬 Movie night"], ["🚲 Bike rides","🚗 Car rides"],
      ["🐦 Birds","🐠 Fish"], ["🏝 Tropical vacation","🏔 Mountain vacation"], ["🎧 Loud music","🤫 Silence"],
    ];

    const bag = ShuffleBag.restore(state.bag, PAIRS.length);
    let idx = bag.next();
    // Round 22 (P2 tail): profile-or-fold. Two additions the card always
    // needed: a SKIP for the genuinely unanswerable ("pizza vs burger" is a
    // trap, not a question — no-wrong-answers should include no-forced- ones),
    // and a running PROFILE that turns your picks into a readable identity:
    // a left/right lean line always visible, and a full profile flash every
    // 10 decisions with your recent picks.
    if(!Array.isArray(state.history)) state.history = [];
    if(!Number.isFinite(state.leftCount)) state.leftCount = 0;
    if(!Number.isFinite(state.rightCount)) state.rightCount = 0;
    const sinceProfile = { n: (state.history.length || 0) % 10 };

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:16px; width:100%;";

    const counter = document.createElement("div");
    counter.style.cssText = "font-family:var(--font-display); font-size:9px; color:var(--ink-dim);";

    const row = document.createElement("div");
    row.style.cssText = "display:flex; gap:8px; width:100%; max-width:280px; align-items:stretch;";

    const leftBtn = document.createElement("button");
    const rightBtn = document.createElement("button");
    [leftBtn, rightBtn].forEach(b => {
      b.style.cssText = `
        flex:1; padding:24px 8px; border-radius:14px; border:1px solid var(--line);
        background:var(--panel-2); color:var(--ink); font-size:15px; font-weight:700;
        cursor:pointer; text-align:center;
      `;
    });

    const foldBtn = document.createElement("button");
    foldBtn.textContent = "🤔";
    foldBtn.title = "Can't choose? Fold this one — it doesn't count";
    foldBtn.style.cssText = `
      width:44px; border-radius:14px; border:1px solid var(--line);
      background:var(--panel-2); color:var(--ink-dim); font-size:16px; cursor:pointer;
    `;

    const profileLine = document.createElement("div");
    profileLine.style.cssText = "font-size:11px; color:var(--ink-dim); text-align:center; min-height:16px;";

    row.appendChild(leftBtn);
    row.appendChild(foldBtn);
    row.appendChild(rightBtn);
    wrap.appendChild(counter);
    wrap.appendChild(row);
    wrap.appendChild(profileLine);
    container.appendChild(wrap);

    function leanText(){
      const l = state.leftCount, r = state.rightCount, t = l + r;
      // R34 (auuudit P3): "100%" after ONE pick is statistically silly —
      // the lean line stays silent until n>=5 can actually back it up.
      if(t < 5) return "";
      const lp = Math.round((l / t) * 100);
      return lp >= 60 ? `you lean LEFT · ${lp}% ` : lp <= 40 ? `you lean RIGHT · ${100 - lp}% ` : `dead even · ${lp}% `;
    }

    function render(){
      const [a,b] = PAIRS[idx];
      leftBtn.textContent = a;
      rightBtn.textContent = b;
      leftBtn.style.background = "var(--panel-2)";
      rightBtn.style.background = "var(--panel-2)";
      counter.textContent = `PICKED ${state.total}`;
      profileLine.textContent = leanText();
    }

    function showProfileFlash(){
      const recent = state.history.slice(-5).join(" · ");
      const flash = document.createElement("div");
      flash.style.cssText = "position:fixed; left:50%; bottom:12%; transform:translateX(-50%); z-index:80; background:rgba(10,10,16,.92); border:1px solid var(--amber-dim); border-radius:12px; padding:10px 14px; font-size:12px; color:var(--ink); max-width:82vw; text-align:center;";
      flash.innerHTML = `<div style="font-family:var(--font-display); font-size:9px; color:var(--amber); margin-bottom:4px;">YOUR PROFILE</div><div>${recent}</div><div style="color:var(--ink-dim); font-size:10px; margin-top:3px;">${leanText()}</div>`;
      document.body.appendChild(flash);
      setTimeout(() => flash.remove(), 2400);
    }

    function pick(side){
      Feedback.tone("select"); Feedback.haptic("light");
      (side === "left" ? leftBtn : rightBtn).style.background = "var(--amber-dim)";
      state.total++;
      if(side === "left") state.leftCount++; else state.rightCount++;
      const [a,b] = PAIRS[idx];
      state.history.push(String((side === "left" ? a : b)).split(" ").slice(1).join(" ") || (side === "left" ? a : b));
      if(state.history.length > 12) state.history = state.history.slice(-12);
      state.bag = bag.serialize();
      api.save(state);
      sinceProfile.n++;
      const doFlash = sinceProfile.n >= 10;
      if(doFlash) sinceProfile.n = 0;
      setTimeout(() => {
        idx = bag.next();
        state.bag = bag.serialize();
        api.save(state);
        render();
        if(doFlash) showProfileFlash();
      }, 220);
    }

    foldBtn.addEventListener("click", () => {
      // the fold: an honest non-answer — new pair, no pick recorded
      Feedback.tone("swap"); Feedback.haptic("light");
      idx = bag.next();
      state.bag = bag.serialize();
      api.save(state);
      render();
    });

    leftBtn.addEventListener("click", () => pick("left"));
    rightBtn.addEventListener("click", () => pick("right"));

    render();
  }
});
