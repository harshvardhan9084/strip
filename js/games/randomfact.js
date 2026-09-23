Strip.register({
  id: "randomfact",
  label: "ODDBALL",
  title: "Random Fact",
  tag: "🧠",
  hint: "Tap for another",
  async mount(container, api){
    const state = (await api.load()) || { seen: 0, bag: null };
    const FACTS = [
      "Octopuses have three hearts, and two of them stop beating when they swim.",
      "A day on Venus is longer than a year on Venus.",
      "Bananas are berries, but strawberries aren't.",
      "The Eiffel Tower can grow about 15cm taller in summer heat.",
      "Wombat poop is cube-shaped.",
      "There are more possible chess games than atoms in the observable universe.",
      "Honey never spoils — edible jars have been found in 3000-year-old tombs.",
      "A group of flamingos is called a 'flamboyance'.",
      "Sharks existed before trees.",
      "Your nose can remember 50,000 different scents.",
      "The shortest war in history lasted 38 minutes (Britain vs Zanzibar, 1896).",
      "A single cloud can weigh over a million pounds.",
      "Sea otters hold hands while sleeping so they don't drift apart.",
      "Scotland's national animal is the unicorn.",
      "The Great Wall of China isn't visible from space with the naked eye.",
      "Cows have best friends and get stressed when separated.",
      "It technically rains diamonds on Jupiter and Saturn.",
      "A bolt of lightning is about 5x hotter than the surface of the sun.",
      "Some turtles can breathe through their butts.",
      "The inventor of the frisbee was turned into a frisbee after he died.",
      "Butterflies taste with their feet.",
      "There's a species of jellyfish that is biologically immortal.",
      "Humans share about 60% of their DNA with bananas.",
      "The longest recorded flight of a chicken is 13 seconds.",
      "Venus is the only planet that rotates clockwise.",
      "A shrimp's heart is located in its head.",
      "The unicorn is Scotland's national animal because it symbolized purity and dominance in myth.",
      "Cleopatra lived closer in time to the Moon landing than to the building of the Great Pyramid.",
      "A bolt of lightning contains enough energy to toast about 100,000 slices of bread.",
      "There are more stars in the universe than grains of sand on all of Earth's beaches.",
      "Elephants are the only mammals that can't jump.",
      "The Mona Lisa has no eyebrows — it was fashionable to shave them off in Renaissance Florence.",
      "A crocodile can't stick its tongue out.",
      "Hot water can freeze faster than cold water under certain conditions — it's called the Mpemba effect.",
      "The dot over a lowercase 'i' or 'j' is called a tittle.",
      "Starfish don't have brains.",
      "A blue whale's heart is roughly the size of a small car.",
      "The world's oldest known living tree is over 4,800 years old.",
      "Wearing headphones for just an hour can increase the bacteria in your ear by 700 times.",
      "Polar bears have black skin under their white fur.",
      "The first computer 'bug' was an actual moth found in a Harvard Mark II relay in 1947.",
      "Peanuts aren't nuts — they're legumes, related to beans and lentils.",
      "It's impossible to hum while holding your nose closed.",
      "Some cats are allergic to humans.",
      "A single strand of spaghetti is called a 'spaghetto'.",
      "The Eiffel Tower was originally meant to be a temporary structure, dismantled after 20 years.",
      "Oxford University is older than the Aztec Empire.",
      "A 'jiffy' is an actual unit of time — 1/100th of a second.",
      "Koalas have fingerprints almost indistinguishable from human ones.",
      "The inventor of the microwave oven, Percy Spencer, discovered it after a chocolate bar melted in his pocket.",
      "Dolphins have names for each other — unique signature whistles.",
      "The total weight of ants on Earth is roughly comparable to the total weight of humans.",
      "Antarctica is the largest desert in the world, not the Sahara.",
      "A group of crows is called a 'murder'.",
      "The human body contains enough carbon to fill about 9,000 pencils.",
      "It rains sulfuric acid on Venus, but it evaporates before reaching the ground.",
      "The King of Hearts is the only king in a standard deck without a mustache.",
      "Space smells like seared steak and hot metal, according to astronauts.",
      "A crocodile can live to be over 70 years old.",
      "Squirrels forget where they bury up to 25% of their nuts, accidentally planting trees.",
      "The inventor of the Pringles can, Fredric Baur, had his ashes buried in one.",
      "Kangaroos can't walk backwards.",
      "A hummingbird's heart beats up to 1,200 times per minute.",
      "The Statue of Liberty's copper skin is only about as thick as two pennies stacked together.",
      "There's enough gold in Earth's core to coat the entire surface of the planet about 1.5 feet deep.",
      "Wasps can recognize individual human faces.",
      "The longest word in English without a vowel is 'rhythm'.",
      "A day on Mercury lasts about 176 Earth days.",
      "Grasshoppers have their ears on their bellies.",
      "The first oranges weren't orange — they were originally green.",
      "Astronauts can grow up to 5cm taller temporarily in zero gravity.",
      "Cows can have best friends and become anxious when separated from them.",
      "The dot on top of a chess king is actually a cross, called a 'finial'.",
      "Chewing gum was originally made from tree sap, called chicle.",
      "A snail can sleep for up to three years.",
      "Bubble wrap was originally invented as a textured wallpaper in 1957.",
      "The average person walks the equivalent of three times around the world in a lifetime.",
      "There's a basketball court inside the U.S. Supreme Court building, nicknamed 'the highest court in the land'.",
      "Slugs have four noses.",
      "Rats laugh — in a high-pitched sound humans can't hear — when tickled.",
      "The first alarm clock could only ring at 4 a.m.",
      "It would take about 1.2 million mosquitoes, each biting once, to drain all the blood from a human.",
      "A rainbow can only be seen if the sun is behind you.",
      "Human teeth are almost as strong as shark teeth in terms of hardness.",
      "The Twitter (X) bird's original name was Larry.",
      "A single bolt of lightning could power a lightbulb for about 3 months.",
      "Otters have a favorite rock they keep for cracking open shellfish.",
      "The shortest commercial flight in the world lasts under 2 minutes, between two Scottish islands.",
      "Tigers have striped skin, not just striped fur.",
      "A 'moment' was historically defined as 90 seconds.",
      "The world's quietest room is so silent people can hear their own heartbeat and blood flow.",
      "Cats can't taste sweetness.",
      "There are more possible iterations of a game of chess than there are seconds since the universe began.",
      "The Amazon rainforest produces roughly 20% of the world's oxygen.",
      "An ostrich's eye is bigger than its brain.",
      "The average cumulus cloud weighs about as much as 100 elephants.",
      "It takes about 8 minutes and 20 seconds for sunlight to reach Earth.",
      "Vending machines kill more people annually than sharks, usually from tipping over.",
      "A newborn kangaroo is about the size of a jellybean.",
      "Some fish cough.",
      "The inventor of the Ferris wheel built it to rival the Eiffel Tower at the 1893 World's Fair.",
      "A group of pandas is called an 'embarrassment'.",
      "The human eye can distinguish about 10 million different colors.",
      "The world's largest snowflake on record was 15 inches wide.",
      "A jellyfish is about 95% water.",
      "Owls don't have eyeballs — they have eye tubes, which is why they can't move their eyes.",
      "There's a lake in Bolivia so reflective it's used to calibrate satellites.",
      "The heart of a shrimp pumps colorless blood.",
      "Bananas are naturally slightly radioactive due to their potassium content.",
      "A single tree can absorb about 48 pounds of carbon dioxide per year.",
      "Space is completely silent — there's no medium for sound to travel through.",
      "The world's smallest reptile, a chameleon species, can fit on the tip of a matchstick.",
      "Woodpeckers can peck up to 20 times per second without getting concussions.",
      "The Sahara desert was once a lush green savanna a few thousand years ago.",
      "A 'group' of jellyfish is called a 'smack'.",
      "There are more trees on Earth than stars in the Milky Way.",
      "Human bones are about as strong as steel by weight, but much lighter.",
      "The inventor of the modern toothbrush was arrested and used his time in prison to perfect the design.",
      "Male seahorses, not females, carry and give birth to the babies.",
      "The world's largest living organism is a fungus in Oregon spanning over 2,000 acres.",
      "A hedgehog's heart beats up to 300 times per minute.",
      "It's estimated that over 90% of the ocean remains unexplored.",
      "Giraffes only need 5 to 30 minutes of sleep per day.",
      "The Great Barrier Reef is the largest living structure on Earth, visible from space.",
      "A cockroach can live for several days without its head before dying of dehydration.",
      "The moon is slowly drifting away from Earth at about 3.8cm per year.",
    ];

    const bag = ShuffleBag.restore(state.bag, FACTS.length);
    let idx = bag.next();
    // Round 22 (P2 tail): FAVORITES. Facts are social currency — people want
    // to KEEP the good ones. A ★ on the live fact persists it; a Favorites
    // toggle flips the card into a favorites dealer (tap-through your stars).
    // The seen counter stays honest: favorites browsing never inflates it.
    if(!Array.isArray(state.favs)) state.favs = [];
    // sanitize: a save from an older build (or a corrupt blob) can carry
    // indices outside the current FACTS pool — those render as "undefined"
    state.favs = state.favs.filter(i => Number.isInteger(i) && i >= 0 && i < FACTS.length);
    let favMode = false;

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:18px; width:100%;";

    const counter = document.createElement("div");
    counter.style.cssText = "font-family:var(--font-display); font-size:9px; color:var(--ink-dim);";

    const card = document.createElement("div");
    card.style.cssText = `
      background:var(--panel-2); border:1px solid var(--line); border-radius:16px;
      padding:26px 22px; max-width:280px; font-size:16px; line-height:1.5; text-align:center;
      min-height:120px; display:flex; align-items:center; justify-content:center;
    `;

    const nextBtn = document.createElement("button");
    nextBtn.className = "btn accent";
    nextBtn.textContent = "Another fact";

    const favRow = document.createElement("div");
    favRow.style.cssText = "display:flex; gap:10px; align-items:center;";
    const starBtn = document.createElement("button");
    starBtn.className = "btn";
    starBtn.style.cssText = "width:52px; font-size:15px;";
    const favBtn = document.createElement("button");
    favBtn.className = "btn";
    favBtn.textContent = "★ Favorites (0)";
    favRow.appendChild(starBtn);
    favRow.appendChild(favBtn);

    wrap.appendChild(counter);
    wrap.appendChild(card);
    wrap.appendChild(favRow);
    wrap.appendChild(nextBtn);
    container.appendChild(wrap);

    function isFav(){ return state.favs.includes(idx); }

    function paintStar(){
      starBtn.textContent = isFav() ? "★" : "☆";
      starBtn.style.color = isFav() ? "var(--amber)" : "";
      starBtn.style.borderColor = isFav() ? "var(--amber-dim)" : "";
      favBtn.textContent = `★ Favorites (${state.favs.length})`;
      favBtn.style.borderColor = favMode ? "var(--amber)" : "";
      favBtn.style.color = favMode ? "var(--amber)" : "";
    }

    function render(){
      if(favMode){
        if(!state.favs.length){
          card.textContent = "No favorites yet — tap ☆ on a fact worth keeping.";
          counter.textContent = `FAVORITES 0`;
        } else {
          card.textContent = FACTS[state.favs[idx % state.favs.length]];
          counter.textContent = `FAVORITES ${state.favs.length}`;
        }
      } else {
        card.textContent = FACTS[idx];
        // R34 (auuudit P3): the counter said FACT #1 while the content
        // changed — `seen` is session-relative, the card is not. Number the
        // FACT ITSELF so the label can never disagree with what's on screen.
        counter.textContent = `FACT #${idx + 1}/${FACTS.length}`;
      }
      state.bag = bag.serialize();
      paintStar();
    }

    function next(){
      Feedback.tone("swap"); Feedback.haptic("light");
      if(favMode){
        if(state.favs.length) idx = bag.next(); // favorites re-deal through the same bag position
      } else {
        idx = bag.next();
        state.seen++;
      }
      state.bag = bag.serialize();
      api.save(state);
      render();
    }

    starBtn.addEventListener("click", () => {
      if(favMode) return; // the star stars the LIVE fact; in favorites mode it's already kept
      const k = state.favs.indexOf(idx);
      if(k >= 0) state.favs.splice(k, 1); else state.favs.push(idx);
      api.save(state);
      Feedback.tone(k >= 0 ? "swap" : "success"); Feedback.haptic("light");
      paintStar();
    });
    favBtn.addEventListener("click", () => {
      favMode = !favMode;
      Feedback.tone("toggle"); Feedback.haptic("light");
      render();
    });

    nextBtn.addEventListener("click", next);
    card.addEventListener("click", next);
    render();
  }
});
