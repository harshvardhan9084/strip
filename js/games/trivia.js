Strip.register({
  id: "trivia",
  label: "PUZZLE",
  title: "Quick Trivia",
  tag: "🧠",
  hint: "Tap the correct answer",
  async mount(container, api){
    // lookups scoped to THIS card — duplicate ids across two copies of a
    // cartridge coexist briefly in the strip, and getElementById could
    // update the stale copy instead of the visible one
    const q = (sel) => container.querySelector(sel);
    let best = await api.getHighscore();
    const savedState = (await api.load()) || { bag: null };
    const Q = [
      { q:"What planet has the most moons?", a:["Jupiter","Saturn","Mars","Neptune"], correct:1 },
      { q:"How many bones in the human body?", a:["186","206","226","246"], correct:1 },
      { q:"What's the fastest land animal?", a:["Lion","Pronghorn","Cheetah","Horse"], correct:2 },
      { q:"What year did WW2 end?", a:["1943","1945","1947","1950"], correct:1 },
      { q:"What's the smallest country?", a:["Monaco","Malta","Vatican City","San Marino"], correct:2 },
      { q:"Who painted the Mona Lisa?", a:["Michelangelo","Raphael","Da Vinci","Donatello"], correct:2 },
      { q:"What's the hardest natural substance?", a:["Gold","Diamond","Quartz","Titanium"], correct:1 },
      { q:"How many continents are there?", a:["5","6","7","8"], correct:2 },
      { q:"What's the largest ocean?", a:["Atlantic","Indian","Arctic","Pacific"], correct:3 },
      { q:"What gas do plants absorb?", a:["Oxygen","CO2","Nitrogen","Hydrogen"], correct:1 },
      { q:"What's the longest river?", a:["Amazon","Nile","Yangtze","Mississippi"], correct:1 },
      { q:"How many strings on a violin?", a:["4","5","6","3"], correct:0 },
      { q:"What's the currency of Japan?", a:["Won","Yuan","Yen","Ringgit"], correct:2 },
      { q:"What year was the first iPhone released?", a:["2005","2007","2009","2010"], correct:1 },
      { q:"What's the tallest mountain?", a:["K2","Kilimanjaro","Everest","Denali"], correct:2 },
      { q:"What's the chemical symbol for gold?", a:["Ag","Au","Gd","Go"], correct:1 },
      { q:"Which planet is known as the Red Planet?", a:["Venus","Jupiter","Mars","Mercury"], correct:2 },
      { q:"How many players are on a soccer team on the field?", a:["9","10","11","12"], correct:2 },
      { q:"What's the capital of Australia?", a:["Sydney","Melbourne","Canberra","Perth"], correct:2 },
      { q:"Who wrote 'Romeo and Juliet'?", a:["Dickens","Shakespeare","Austen","Twain"], correct:1 },
      { q:"What's the largest mammal?", a:["Elephant","Blue whale","Giraffe","Hippo"], correct:1 },
      { q:"How many colors are in a rainbow?", a:["5","6","7","8"], correct:2 },
      { q:"What's the freezing point of water in Celsius?", a:["-5","0","5","10"], correct:1 },
      { q:"Which country invented pizza?", a:["France","Greece","Italy","Spain"], correct:2 },
      { q:"What's the smallest planet in our solar system?", a:["Mars","Mercury","Venus","Pluto"], correct:1 },
      { q:"How many hearts does an octopus have?", a:["1","2","3","4"], correct:2 },
      { q:"What's the capital of Canada?", a:["Toronto","Vancouver","Ottawa","Montreal"], correct:2 },
      { q:"Which element has the chemical symbol 'O'?", a:["Osmium","Oxygen","Gold","Silver"], correct:1 },
      { q:"What year did the Titanic sink?", a:["1905","1912","1918","1923"], correct:1 },
      { q:"How many sides does a hexagon have?", a:["5","6","7","8"], correct:1 },
      { q:"What's the largest desert in the world?", a:["Sahara","Gobi","Antarctic","Arabian"], correct:2 },
      { q:"Who developed the theory of relativity?", a:["Newton","Einstein","Bohr","Curie"], correct:1 },
      { q:"What's the main language spoken in Brazil?", a:["Spanish","Portuguese","French","Italian"], correct:1 },
      { q:"How many legs does a spider have?", a:["6","8","10","12"], correct:1 },
      { q:"What's the tallest animal?", a:["Elephant","Giraffe","Camel","Horse"], correct:1 },
      { q:"Which gas makes up most of Earth's atmosphere?", a:["Oxygen","Nitrogen","CO2","Argon"], correct:1 },
      { q:"What's the largest planet in our solar system?", a:["Saturn","Jupiter","Neptune","Uranus"], correct:1 },
      { q:"How many teeth does an adult human typically have?", a:["28","30","32","34"], correct:2 },
      { q:"What's the capital of Egypt?", a:["Cairo","Alexandria","Giza","Luxor"], correct:0 },
      { q:"Who painted 'Starry Night'?", a:["Monet","Van Gogh","Picasso","Renoir"], correct:1 },
      { q:"What's the speed of light approximately?", a:["300,000 km/s","150,000 km/s","500,000 km/s","1,000,000 km/s"], correct:0 },
      { q:"How many bones are in the human hand?", a:["19","27","32","35"], correct:1 },
      { q:"What's the national sport of Japan?", a:["Karate","Sumo wrestling","Judo","Baseball"], correct:1 },
      { q:"Which country has the most population?", a:["USA","India","China","Indonesia"], correct:1 },
      { q:"What's the boiling point of water at sea level in Celsius?", a:["90","95","100","105"], correct:2 },
      { q:"How many strings does a standard guitar have?", a:["4","5","6","7"], correct:2 },
      { q:"What's the largest bird by wingspan?", a:["Eagle","Albatross","Condor","Pelican"], correct:1 },
      { q:"Who invented the telephone?", a:["Edison","Tesla","Bell","Marconi"], correct:2 },
      { q:"What's the tallest waterfall in the world?", a:["Niagara","Angel Falls","Victoria Falls","Iguazu"], correct:1 },
      { q:"How many rings are on the Olympic flag?", a:["4","5","6","7"], correct:1 },
      { q:"What's the most spoken language in the world?", a:["English","Spanish","Mandarin","Hindi"], correct:2 },
      { q:"Which planet has a day longer than its year?", a:["Mars","Venus","Mercury","Saturn"], correct:1 },
      { q:"How many strings are on a standard harp?", a:["27","47","57","67"], correct:1 },
      { q:"What's the deepest point in the ocean called?", a:["Puerto Rico Trench","Mariana Trench","Java Trench","Tonga Trench"], correct:1 },
      { q:"What's the largest country by area?", a:["China","USA","Canada","Russia"], correct:3 },
      { q:"How many hexagons are on a standard soccer ball?", a:["10","12","14","16"], correct:1 },
      { q:"What's the capital of South Korea?", a:["Busan","Incheon","Seoul","Daegu"], correct:2 },
      { q:"Who composed the 'Ninth Symphony'?", a:["Mozart","Bach","Beethoven","Chopin"], correct:2 },
      { q:"What's the primary language of ancient Rome?", a:["Greek","Latin","Italian","Etruscan"], correct:1 },
      { q:"How many valves does the human heart have?", a:["2","3","4","5"], correct:2 },
      { q:"What's the largest island in the world?", a:["Madagascar","Borneo","Greenland","New Guinea"], correct:2 },
      { q:"Which vitamin is produced from sunlight exposure?", a:["Vitamin A","Vitamin C","Vitamin D","Vitamin E"], correct:2 },
      { q:"What's the smallest bone in the human body?", a:["Stapes","Femur","Radius","Fibula"], correct:0 },
      { q:"Who was the first person to walk on the moon?", a:["Buzz Aldrin","Neil Armstrong","Yuri Gagarin","John Glenn"], correct:1 },
      { q:"What's the capital of Spain?", a:["Barcelona","Madrid","Seville","Valencia"], correct:1 },
      { q:"How many chambers does the human heart have?", a:["2","3","4","5"], correct:2 },
      { q:"What's the most abundant metal in Earth's crust?", a:["Iron","Copper","Aluminum","Zinc"], correct:2 },
      { q:"Which country gifted the Statue of Liberty to the USA?", a:["England","France","Spain","Italy"], correct:1 },
      { q:"What's the fastest bird in a dive?", a:["Eagle","Falcon","Hawk","Owl"], correct:1 },
      { q:"How many degrees are in a right angle?", a:["45","90","180","360"], correct:1 },
      { q:"What's the largest species of shark?", a:["Great White","Hammerhead","Whale shark","Tiger shark"], correct:2 },
      { q:"Who wrote 'Pride and Prejudice'?", a:["Bronte","Austen","Woolf","Dickinson"], correct:1 },
      { q:"What's the driest place on Earth?", a:["Sahara Desert","Atacama Desert","Gobi Desert","Death Valley"], correct:1 },
      { q:"How many Great Lakes are there?", a:["3","4","5","6"], correct:2 },
      { q:"What's the coldest planet in our solar system?", a:["Neptune","Uranus","Pluto","Saturn"], correct:1 },
      { q:"Which organ produces insulin?", a:["Liver","Kidney","Pancreas","Spleen"], correct:2 },
      { q:"What's the tallest building in the world (as of recent record)?", a:["Shanghai Tower","Burj Khalifa","One World Trade","Taipei 101"], correct:1 },
    ];

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:16px; width:100%; max-width:280px;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:20px; font-family:var(--font-display); font-size:10px; color:var(--ink-dim);";
    statRow.innerHTML = `<div>STREAK <span id="tv-score" style="color:var(--amber)">0</span></div><div>BEST <span id="tv-best" style="color:var(--purple)">${best}</span></div>`;
    wrap.appendChild(statRow);

    const qText = document.createElement("div");
    qText.style.cssText = "font-size:15px; font-weight:600; text-align:center; min-height:50px; display:flex; align-items:center;";
    wrap.appendChild(qText);

    const answers = document.createElement("div");
    answers.style.cssText = "display:flex; flex-direction:column; gap:8px; width:100%;";
    wrap.appendChild(answers);

    container.appendChild(wrap);

    let streak = 0, current, answered;
    const bag = ShuffleBag.restore(savedState.bag, Q.length);

    function pickQuestion(){
      current = Q[bag.next()];
      savedState.bag = bag.serialize();
      api.save(savedState);
      answered = false;
      qText.textContent = current.q;
      answers.innerHTML = "";
      current.a.forEach((ans, i) => {
        const btn = document.createElement("button");
        btn.className = "btn";
        btn.style.textAlign = "left";
        btn.textContent = ans;
        btn.addEventListener("click", () => choose(i, btn));
        answers.appendChild(btn);
      });
    }

    function choose(i, btn){
      if(answered) return;
      answered = true;
      const correct = i === current.correct;
      [...answers.children].forEach((b, idx) => {
        if(idx === current.correct) b.style.borderColor = "#6FCF97";
        if(idx === i && !correct) b.style.borderColor = "var(--danger)";
      });
      if(correct){
        Feedback.buzz("success");
        streak++;
        q("#tv-score").textContent = streak;
        if(streak > best){
          best = streak;
          api.setHighscore(best);
          q("#tv-best").textContent = best;
        }
      } else {
        Feedback.buzz("error");
        api.setHighscore(streak);
        streak = 0;
        q("#tv-score").textContent = 0;
      }
      setTimeout(pickQuestion, 900);
    }

    pickQuestion();
  }
});
