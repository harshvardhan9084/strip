Strip.register({
  id: "wouldyourather",
  label: "ODDBALL",
  title: "Would You Rather",
  tag: "∞",
  hint: "Pick a side, see the split",
  async mount(container, api){
    const state = (await api.load()) || { votes: {}, bag: null }; // { [qIdx]: "a"|"b" }
    const QUESTIONS = [
      ["Have teleportation", "Have telepathy"],
      ["Always be 10 min late", "Always be 20 min early"],
      ["Fight one horse-sized duck", "Fight 100 duck-sized horses"],
      ["Never use social media again", "Never watch another movie/show again"],
      ["Know when you'll die", "Know how you'll die"],
      ["Be fluent in every language", "Be a virtuoso at every instrument"],
      ["Live without music", "Live without movies"],
      ["Always say what's on your mind", "Never speak again unless spoken to"],
      ["Have unlimited books", "Have unlimited games"],
      ["Time travel to the past", "Time travel to the future"],
      ["Be famous but broke", "Be rich but unknown"],
      ["Lose your phone forever", "Lose your wallet forever"],
      ["Only eat spicy food", "Only eat bland food"],
      ["Read minds", "See the future"],
      ["Live in space", "Live underwater"],
      ["Have unlimited money but no friends", "Have amazing friends but be broke forever"],
      ["Give up your sense of smell", "Give up your sense of taste"],
      ["Always have to sing instead of talk", "Always have to whisper"],
      ["Be the funniest person in the room", "Be the smartest person in the room"],
      ["Live 100 years in the past", "Live 100 years in the future"],
      ["Have a rewind button for your life", "Have a pause button for your life"],
      ["Never be able to lie", "Never be able to tell the truth get away with it"],
      ["Be able to fly", "Be able to turn invisible"],
      ["Have super strength", "Have super speed"],
      ["Only be able to whisper for a week", "Only be able to shout for a week"],
      ["Live without the internet", "Live without air conditioning/heating"],
      ["Always know if someone is lying to you", "Always be able to get away with a lie"],
      ["Be able to talk to animals", "Be able to speak every human language"],
      ["Have to dance everywhere you go", "Have to sing everything you say"],
      ["Give up sleep for a year but never get tired", "Never eat your favorite food again"],
      ["Live in a world with no music", "Live in a world with no color"],
      ["Be able to control fire", "Be able to control water"],
      ["Have the ability to talk to plants", "Have the ability to talk to insects"],
      ["Win the lottery but lose all your memories", "Stay poor but keep every memory"],
      ["Explore space", "Explore the deep ocean"],
      ["Have unlimited tacos for life", "Have unlimited pizza for life"],
      ["Be able to breathe underwater", "Be able to breathe in space"],
      ["Have a photographic memory", "Have the ability to forget anything on command"],
      ["Always win arguments but be disliked", "Always lose arguments but be liked"],
      ["Live without your phone", "Live without your car"],
      ["Be stuck in traffic for an hour daily", "Have a 2-hour commute but always find a seat"],
      ["Have free WiFi everywhere but slow", "Have paid WiFi everywhere but blazing fast"],
      ["Be able to skip Mondays", "Be able to skip winters"],
      ["Have a personal chef", "Have a personal driver"],
      ["Be able to redo one year of your life", "Be able to skip one year forward"],
      ["Always get the window seat", "Always get free upgrades"],
      ["Be really good at one sport", "Be decent at every sport"],
      ["Live in a treehouse", "Live in a houseboat"],
      ["Have the power to heal others", "Have the power to heal yourself instantly"],
      ["Be able to talk to your past self", "Be able to talk to your future self"],
      ["Never have to do laundry again", "Never have to do dishes again"],
      ["Have unlimited vacation days but half the salary", "Have double salary but no vacation"],
      ["Only be able to text in emojis", "Only be able to text in all caps"],
      ["Have a personal theme song that plays when you enter a room", "Get a slow clap every time you accomplish something"],
      ["Be the best player on a losing team", "Be the worst player on a winning team"],
      ["Have to always agree with your parents", "Have to always agree with your boss"],
      ["Give up fast food forever", "Give up soda forever"],
      ["Be able to change the weather", "Be able to change the time of day"],
      ["Have an extra hour every day", "Have an extra day every week"],
      ["Have the best seat in every movie theater forever", "Have the best seat on every flight forever"],
      ["Never get a paper cut again", "Never stub your toe again"],
      ["Speak every language but write none", "Write every language but speak none"],
      ["Have unlimited data but slow internet", "Have limited data but blazing internet"],
      ["Be able to skip small talk forever", "Never run out of things to say"],
      ["Only listen to one song for the rest of your life", "Never listen to music again"],
      ["Live where it's always summer", "Live where it's always winter"],
      ["Have the power to pause time for everyone but you", "Have the power to rewind time 10 seconds once a day"],
      ["Be a legendary chef", "Be a legendary athlete"],
      ["Have every meal cooked for you but no choice in menu", "Cook every meal yourself but choose anything"],
      ["Get free coffee for life", "Get free internet for life"],
      ["Have a house cleaner forever", "Have a personal trainer forever"],
      ["Be able to instantly learn any skill", "Be able to instantly master any language"],
      ["Live a long, ordinary life", "Live a short, extraordinary life"],
      ["Have unlimited retries in life", "Have one perfect shot at everything"],
      ["Always be slightly late", "Always be way too early"],
      ["Be famous for something embarrassing", "Be completely unknown"],
      ["Have the ability to talk your way out of anything", "Have the ability to always know the right answer"],
      ["Wake up as the opposite gender for a day", "Wake up as an animal for a day"],
      ["Never need to charge your phone again", "Never need to refuel your car again"],
    ];

    const bag = ShuffleBag.restore(state.bag, QUESTIONS.length);
    let qIdx = bag.next();

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:16px; width:100%;";

    const label = document.createElement("div");
    label.style.cssText = "font-family:var(--font-display); font-size:9px; color:var(--ink-dim);";
    label.textContent = "WOULD YOU RATHER…";

    const optA = document.createElement("button");
    const optB = document.createElement("button");
    [optA, optB].forEach(btn => {
      btn.style.cssText = `
        width:100%; max-width:280px; padding:16px 18px; border-radius:14px; border:1px solid var(--line);
        background:var(--panel-2); color:var(--ink); font-size:15px; font-weight:600; text-align:left;
        cursor:pointer; position:relative; overflow:hidden;
      `;
    });

    const nextBtn = document.createElement("button");
    nextBtn.className = "btn purple";
    nextBtn.textContent = "Next question";

    wrap.appendChild(label);
    wrap.appendChild(optA);
    wrap.appendChild(optB);
    wrap.appendChild(nextBtn);
    container.appendChild(wrap);

    function render(){
      const [a, b] = QUESTIONS[qIdx];
      const voted = state.votes[qIdx];
      optA.innerHTML = "";
      optB.innerHTML = "";
      optA.textContent = a;
      optB.textContent = b;

      if(voted){
        // HONESTY RULE: this is a single-player, offline app — there is no
        // server and no real crowd, so showing a bare "63%" would be fake
        // social proof. The split is clearly labeled as imaginary, seeded from
        // the question index so the SAME imaginary crowd stays consistent for
        // the SAME question across visits.
        const seed = (qIdx * 37 + 11) % 100;
        const pctA = 25 + (seed % 51); // 25-75 range
        const note = document.createElement("div");
        note.style.cssText = "font-size:10px; color:var(--ink-dim); text-align:center; margin-top:2px; min-height:14px;";
        note.textContent = "an imaginary crowd agrees… (no one else is asked — this is offline)";
        if(!wrap.contains(note)) wrap.insertBefore(note, nextBtn);
        showResult(optA, pctA, voted === "a");
        showResult(optB, 100 - pctA, voted === "b");
      }
    }

    function showResult(btn, pct, isYours){
      const bar = document.createElement("div");
      bar.style.cssText = `
        position:absolute; inset:0; width:${pct}%; background:${isYours ? "rgba(255,179,71,.18)" : "rgba(255,255,255,.05)"};
        z-index:0; transition:width .4s ease;
      `;
      const text = document.createElement("div");
      text.style.cssText = "position:relative; z-index:1; display:flex; justify-content:space-between;";
      text.innerHTML = `<span>${btn.textContent}</span><span style="color:var(--amber); font-family:var(--font-display); font-size:10px;">${pct}%${isYours ? " ✓" : ""}</span>`;
      btn.innerHTML = "";
      btn.appendChild(bar);
      btn.appendChild(text);
    }

    function vote(choice){
      if(state.votes[qIdx]) return;
      Feedback.tone("select"); Feedback.haptic("light");
      state.votes[qIdx] = choice;
      state.bag = bag.serialize();
      api.save(state);
      render();
    }

    optA.addEventListener("click", () => vote("a"));
    optB.addEventListener("click", () => vote("b"));
    nextBtn.addEventListener("click", () => {
      Feedback.tone("swap"); Feedback.haptic("light");
      qIdx = bag.next();
      state.bag = bag.serialize();
      api.save(state);
      render();
    });

    render();
  }
});
