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

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:16px; width:100%;";

    const counter = document.createElement("div");
    counter.style.cssText = "font-family:var(--font-display); font-size:9px; color:var(--ink-dim);";

    const row = document.createElement("div");
    row.style.cssText = "display:flex; gap:10px; width:100%; max-width:280px;";

    const leftBtn = document.createElement("button");
    const rightBtn = document.createElement("button");
    [leftBtn, rightBtn].forEach(b => {
      b.style.cssText = `
        flex:1; padding:24px 10px; border-radius:14px; border:1px solid var(--line);
        background:var(--panel-2); color:var(--ink); font-size:15px; font-weight:700;
        cursor:pointer; text-align:center;
      `;
    });

    row.appendChild(leftBtn);
    row.appendChild(rightBtn);
    wrap.appendChild(counter);
    wrap.appendChild(row);
    container.appendChild(wrap);

    function render(){
      const [a,b] = PAIRS[idx];
      leftBtn.textContent = a;
      rightBtn.textContent = b;
      leftBtn.style.background = "var(--panel-2)";
      rightBtn.style.background = "var(--panel-2)";
      counter.textContent = `PICKED ${state.total}`;
    }

    function pick(side){
      Feedback.tone("select"); Feedback.haptic("light");
      (side === "left" ? leftBtn : rightBtn).style.background = "var(--amber-dim)";
      state.total++;
      state.bag = bag.serialize();
      api.save(state);
      setTimeout(() => {
        idx = bag.next();
        state.bag = bag.serialize();
        api.save(state);
        render();
      }, 220);
    }

    leftBtn.addEventListener("click", () => pick("left"));
    rightBtn.addEventListener("click", () => pick("right"));

    render();
  }
});
