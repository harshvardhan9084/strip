/**
 * Trading Post — resource-allocation strategy sim.
 * Distinct from Ant Colony (production/defense tradeoff) and Garden (decay/neglect):
 * this one is about PORTFOLIO ALLOCATION under a fluctuating market.
 *
 * Round 19 (AUDIT.md DEEP DIVE 4 — the 100-click printer with no purpose):
 * four structural repairs turn a click-grind money vacuum into a game:
 *   1. BULK TRADE — ×1 / ×10 / MAX sizing. One decision, one click (S4).
 *   2. REAL SINKS — auto-traders (idle income), caravans (risk/reward),
 *      and a 3-tier Guild Hall ladder (5k / 25k / 100k) with permanent
 *      perks. Gold always has a "next thing to buy" (S1).
 *   3. MARKET EVENTS — random demand spikes/gluts (grain festival, gem
 *      rush…) break the pure-sine certainty; timing the event IS the skill.
 *   4. JUICE — profit floats, ▲▼ trend arrows vs base price, a 30-tick
 *      price sparkline per good, and milestone toasts so the first 10k
 *      actually feels like something (S6/S7).
 */
Strip.register({
  id: "tradingpost",
  label: "COLONY",
  title: "Trading Post",
  tag: "strategy",
  hint: "Buy low, sell high · caravans, traders & the Guild",
  async mount(container, api){
    const GOODS = [
      { key: "grain", icon: "🌾", basePrice: 4 },
      { key: "cloth", icon: "🧵", basePrice: 9 },
      { key: "gems",  icon: "💎", basePrice: 22 },
    ];
    const EVENT_LABELS = {
      grain: { up: "Harvest festival — grain demanded!", down: "Grain surplus — prices slump" },
      cloth: { up: "Royal wedding — cloth fashion!", down: "Looms overflow — cloth glut" },
      gems:  { up: "GEM RUSH — prospectors pay double!", down: "New vein found — gems flood the market" },
    };
    const GUILD_TIERS = [
      { cost: 5000,   name: "Broker",        perk: "sell prices +10%" },
      { cost: 25000,  name: "Cartographer",  perk: "caravans faster & safer" },
      { cost: 100000, name: "Guild Master",  perk: "traders earn ×2" },
    ];
    const TRADER_MAX = 5;
    const CARAVAN_TIME = 30; // seconds (tier 2 → 21)

    const DEFAULT = {
      gold: 100,
      cap: 40,
      stock: { grain: 0, cloth: 0, gems: 0 },
      prices: { grain: 4, cloth: 9, gems: 22 },
      wobble: { grain: 1, cloth: 1, gems: 1 },
      phase: { grain: Math.random()*Math.PI*2, cloth: Math.random()*Math.PI*2, gems: Math.random()*Math.PI*2 },
      traders: 0,
      guild: 0,
      caravan: null,          // { stake, until }
      event: null,            // { good, mult, until, dir }
      milestones: {},
      history: { grain: [], cloth: [], gems: [] },
      lastSeen: Date.now(),
    };
    const saved = await api.load();
    const state = saved ? Object.assign({}, DEFAULT, saved, {
      stock: Object.assign({}, DEFAULT.stock, saved.stock),
      prices: Object.assign({}, DEFAULT.prices, saved.prices),
      wobble: Object.assign({}, DEFAULT.wobble, saved.wobble),
      phase: Object.assign({}, DEFAULT.phase, saved.phase),
      milestones: Object.assign({}, saved.milestones),
      history: Object.assign({}, DEFAULT.history, saved.history),
    }) : DEFAULT;
    let best = await api.getHighscore(); // best = peak net worth ever
    let tradeSize = 1; // 1 | 10 | "max"

    // advance price cycles for elapsed offline time so returning feels alive, capped
    const elapsedSec = Math.min(3600*8, Math.max(0, (Date.now() - state.lastSeen)/1000));
    GOODS.forEach(g => { state.phase[g.key] += elapsedSec * 0.01; });
    updatePrices();

    function eventMult(key){
      return (state.event && state.event.good === key) ? state.event.mult : 1;
    }
    function updatePrices(){
      GOODS.forEach(g => {
        // sine cycle + harmonic + slow random wobble (mean-reverting) + event
        const wave = Math.sin(state.phase[g.key]) * 0.4 + Math.sin(state.phase[g.key]*2.3) * 0.15;
        state.prices[g.key] = Math.max(1, Math.round(g.basePrice * (1 + wave) * state.wobble[g.key] * eventMult(g.key)));
      });
    }
    function sellPrice(key){
      const p = state.prices[key];
      return state.guild >= 1 ? Math.round(p * 1.1) : p; // Broker perk
    }
    function caravanTime(){ return state.guild >= 2 ? 21 : 30; }
    function caravanRisk(){ return state.guild >= 2 ? 0.07 : 0.15; }
    function traderIncome(){ return state.traders * 3 * (state.guild >= 3 ? 2 : 1); }
    function traderCost(){ return Math.round(400 * Math.pow(2.2, state.traders)); }
    function nextGuild(){ return state.guild < GUILD_TIERS.length ? GUILD_TIERS[state.guild] : null; }

    function netWorth(){
      return Math.round(state.gold + GOODS.reduce((sum,g) => sum + state.stock[g.key]*state.prices[g.key], 0));
    }
    function totalStock(){
      return GOODS.reduce((s,g) => s + state.stock[g.key], 0);
    }
    function fmt(n){
      if(n >= 1e6) return (n/1e6).toFixed(2)+"M";
      if(n >= 1e3) return (n/1e3).toFixed(1)+"k";
      return Math.floor(n).toString();
    }

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex; flex-direction:column; align-items:center; gap:10px; width:100%; max-width:300px;";

    const statRow = document.createElement("div");
    statRow.style.cssText = "display:flex; gap:14px; font-family:var(--font-display); font-size:8px; color:var(--ink-dim); text-align:center;";
    wrap.appendChild(statRow);

    // event banner — the market's weather report
    const eventEl = document.createElement("div");
    eventEl.style.cssText = "display:none; width:100%; text-align:center; font-size:10px; padding:5px 8px; border-radius:8px; background:rgba(255,179,71,0.12); color:var(--amber); box-sizing:border-box;";
    wrap.appendChild(eventEl);

    // trade-size selector — the S4 fix: one decision per click, not one unit
    const sizeRow = document.createElement("div");
    sizeRow.style.cssText = "display:flex; gap:6px; align-items:center;";
    const sizeLabel = document.createElement("span");
    sizeLabel.style.cssText = "font-size:9px; color:var(--ink-dim);";
    sizeLabel.textContent = "trade:";
    sizeRow.appendChild(sizeLabel);
    [1, 10, "max"].forEach(v => {
      const b = document.createElement("button");
      b.className = "btn";
      b.textContent = v === "max" ? "MAX" : "×" + v;
      b.style.cssText = "padding:4px 10px; font-size:11px;";
      b.addEventListener("click", () => { tradeSize = v; render(); Feedback.tone("tap"); });
      b._v = v;
      sizeRow.appendChild(b);
    });
    wrap.appendChild(sizeRow);

    const goodsWrap = document.createElement("div");
    goodsWrap.style.cssText = "display:flex; flex-direction:column; gap:6px; width:100%;";
    wrap.appendChild(goodsWrap);

    // facilities: the three sinks with depth
    const facWrap = document.createElement("div");
    facWrap.style.cssText = "display:flex; flex-direction:column; gap:6px; width:100%;";
    wrap.appendChild(facWrap);

    const traderBtn = document.createElement("button");
    traderBtn.className = "btn";
    facWrap.appendChild(traderBtn);

    const caravanBtn = document.createElement("button");
    caravanBtn.className = "btn";
    facWrap.appendChild(caravanBtn);

    const guildBtn = document.createElement("button");
    guildBtn.className = "btn purple";
    facWrap.appendChild(guildBtn);

    const expandBtn = document.createElement("button");
    expandBtn.className = "btn purple";
    facWrap.appendChild(expandBtn);

    container.appendChild(wrap);

    function goodRow(g){
      const row = document.createElement("div");
      row.style.cssText = "display:flex; align-items:center; gap:8px; background:var(--panel-2); border:1px solid var(--line); border-radius:12px; padding:8px 10px;";

      const info = document.createElement("div");
      info.style.cssText = "flex:1; font-size:11px;";
      info.innerHTML = `${g.icon} <b class="own">0</b> owned<br><span class="price" style="color:var(--amber); font-family:var(--font-display); font-size:9px;">0g each</span> <span class="trend"></span><br><canvas class="spark" width="64" height="14" style="margin-top:2px; opacity:.8;"></canvas>`;

      const buyBtn = document.createElement("button");
      buyBtn.className = "btn";
      buyBtn.textContent = "Buy";
      buyBtn.style.cssText = "padding:6px 10px; font-size:12px;";
      buyBtn.addEventListener("click", () => trade(g.key, 1));

      const sellBtn = document.createElement("button");
      sellBtn.className = "btn accent";
      sellBtn.textContent = "Sell";
      sellBtn.style.cssText = "padding:6px 10px; font-size:12px;";
      sellBtn.addEventListener("click", () => trade(g.key, -1));

      row.appendChild(info);
      row.appendChild(buyBtn);
      row.appendChild(sellBtn);
      goodsWrap.appendChild(row);
      return { row, info, buyBtn, sellBtn };
    }

    const rows = Object.fromEntries(GOODS.map(g => [g.key, goodRow(g)]));

    // floating +g chips over a good row — profit you can SEE
    function addFloat(gkey, text, color){
      const r = rows[gkey].row;
      const f = document.createElement("div");
      f.textContent = text;
      f.style.cssText = "position:absolute; font-weight:700; font-size:12px; pointer-events:none; z-index:30; animation:tpFloat .9s ease-out forwards; text-shadow:0 1px 3px rgba(0,0,0,.5); color:" + color + ";";
      const rect = r.getBoundingClientRect();
      f.style.left = Math.min(rect.left + rect.width - 40, rect.right - 46) + "px";
      f.style.top = (rect.top + 4) + "px";
      f.style.position = "fixed";
      document.body.appendChild(f);
      setTimeout(() => f.remove(), 950);
    }
    if(!document.getElementById("tp-float-kf")){
      const st = document.createElement("style");
      st.id = "tp-float-kf";
      st.textContent = "@keyframes tpFloat{from{opacity:1; transform:translateY(0)}to{opacity:0; transform:translateY(-22px)}}";
      document.head.appendChild(st);
    }

    // milestone + caravan-arrival toast (one owner, one timer)
    const toastEl = document.createElement("div");
    toastEl.style.cssText = "position:fixed; left:50%; transform:translateX(-50%); bottom:18%; background:var(--panel-2); border:1px solid var(--amber); color:var(--amber); font-size:11px; padding:8px 14px; border-radius:20px; z-index:50; opacity:0; transition:opacity .3s; pointer-events:none;";
    document.body.appendChild(toastEl);
    let toastTimer = null;
    function toast(text){
      toastEl.textContent = text;
      toastEl.style.opacity = 1;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toastEl.style.opacity = 0; }, 2600);
    }

    const MILESTONES = [
      { at: 1000,   line: "FIRST 1K — the post is humming" },
      { at: 10000,  line: "10K — merchants know your name" },
      { at: 100000, line: "100K — a trading house, not a post" },
      { at: 1000000,line: "1M — the Guild writes YOUR prices" },
    ];

    function trade(key, dir){
      const price = state.prices[key];
      const stock = state.stock[key];
      let n;
      if(dir > 0){
        const affordable = Math.floor(state.gold / price);
        const room = state.cap - totalStock();
        n = tradeSize === "max" ? Math.min(affordable, room) : Math.min(tradeSize, affordable, room);
        if(n <= 0) return;
        state.gold -= n * price;
        state.stock[key] += n;
        Feedback.tone("swap"); Feedback.haptic("light");
        addFloat(key, "-" + fmt(n * price) + "g", "var(--ink-dim)");
      } else {
        n = tradeSize === "max" ? stock : Math.min(tradeSize, stock);
        if(n <= 0) return;
        const proceeds = n * sellPrice(key);
        const margin = proceeds - n * price;
        state.gold += proceeds;
        state.stock[key] -= n;
        Feedback.tone("select"); Feedback.haptic("light");
        addFloat(key, "+" + fmt(proceeds) + "g", margin > 0 ? "#6FCF97" : "var(--ink-dim)");
      }
      checkMilestones();
      persist();
      render();
    }

    function checkMilestones(){
      const worth = netWorth();
      MILESTONES.forEach(m => {
        if(worth >= m.at && !state.milestones[m.at]){
          state.milestones[m.at] = true;
          toast("★ " + m.line);
          Feedback.buzz("win");
        }
      });
    }

    function resolveCaravan(){
      const c = state.caravan;
      if(!c || Date.now() < c.until) return;
      state.caravan = null;
      if(Math.random() < caravanRisk()){
        toast("🚚 caravan lost to bandits — " + fmt(c.stake) + "g gone");
        Feedback.buzz("lose");
      } else {
        const mult = 1.15 + Math.random() * 0.75;
        const back = Math.round(c.stake * mult);
        state.gold += back;
        toast("🚚 caravan returned: +" + fmt(back - c.stake) + "g profit");
        Feedback.buzz("success");
        checkMilestones();
      }
    }

    function maybeEvent(){
      if(state.event){
        if(Date.now() >= state.event.until) state.event = null;
        return;
      }
      if(Math.random() < 0.008){ // ~every 2 min of watching
        const g = GOODS[Math.floor(Math.random() * GOODS.length)];
        const up = Math.random() < 0.5;
        state.event = {
          good: g.key,
          mult: up ? (1.5 + Math.random() * 0.7) : (0.4 + Math.random() * 0.2),
          until: Date.now() + (30 + Math.random() * 20) * 1000,
          dir: up ? "up" : "down",
        };
        toast(EVENT_LABELS[g.key][state.event.dir]);
        Feedback.tone("ok");
      }
    }

    function render(){
      updatePrices();
      resolveCaravan();
      maybeEvent();
      const worth = netWorth();
      statRow.innerHTML = `
        <div>GOLD<br><span style="color:var(--amber); font-size:13px;">${fmt(state.gold)}</span></div>
        <div>STORAGE<br><span style="color:var(--ink); font-size:13px;">${totalStock()}/${state.cap}</span></div>
        <div>NET WORTH<br><span style="color:var(--purple); font-size:13px;">${fmt(worth)}</span></div>
        <div>PEAK<br><span style="color:var(--ink-dim); font-size:13px;">${fmt(best)}</span></div>
      `;
      if(state.event){
        const g = state.event.good;
        const secs = Math.max(0, Math.ceil((state.event.until - Date.now())/1000));
        eventEl.style.display = "block";
        eventEl.textContent = `${GOODS.find(x => x.key === g).icon} ${EVENT_LABELS[g][state.event.dir]} · ${state.event.mult.toFixed(1)}× · ${secs}s`;
      } else {
        eventEl.style.display = "none";
      }
      [...sizeRow.children].forEach(b => {
        if(b._v === undefined) return;
        b.style.borderColor = b._v === tradeSize ? "var(--amber)" : "var(--line)";
        b.style.background = b._v === tradeSize ? "rgba(255,179,71,0.1)" : "var(--panel-2)";
      });
      GOODS.forEach(g => {
        const r = rows[g.key];
        r.info.querySelector(".own").textContent = state.stock[g.key];
        r.info.querySelector(".price").textContent = `${state.prices[g.key]}g each`;
        // trend arrow vs base price — the market's shape at a glance
        const delta = state.prices[g.key] / g.basePrice - 1;
        r.info.querySelector(".trend").innerHTML =
          delta >= 0.15 ? `<span style="color:#6FCF97">▲</span>` :
          delta <= -0.15 ? `<span style="color:var(--danger)">▼</span>` : `<span style="color:var(--ink-dim)">–</span>`;
        // 30-tick sparkline
        const h = state.history[g.key] || [];
        h.push(state.prices[g.key]);
        if(h.length > 30) h.shift();
        state.history[g.key] = h;
        const cv = r.info.querySelector(".spark");
        const c2 = cv.getContext("2d");
        c2.clearRect(0,0,64,14);
        if(h.length > 1){
          const lo = Math.min(...h), hi = Math.max(...h), span = (hi - lo) || 1;
          c2.strokeStyle = state.event && state.event.good === g.key ? "#FFB347" : "#8A93A6";
          c2.lineWidth = 1;
          c2.beginPath();
          h.forEach((p, i) => {
            const x = i / (h.length - 1) * 62 + 1;
            const y = 12 - (p - lo) / span * 10;
            i ? c2.lineTo(x, y) : c2.moveTo(x, y);
          });
          c2.stroke();
        }
        const room = state.cap - totalStock();
        r.buyBtn.disabled = state.gold < state.prices[g.key] || room <= 0;
        r.sellBtn.disabled = state.stock[g.key] <= 0;
        r.buyBtn.style.opacity = r.buyBtn.disabled ? 0.4 : 1;
        r.sellBtn.style.opacity = r.sellBtn.disabled ? 0.4 : 1;
      });
      // facilities
      if(state.traders < TRADER_MAX){
        const cost = traderCost();
        traderBtn.innerHTML = `Hire trader (${fmt(cost)}g) — ${state.traders}/${TRADER_MAX} · ${traderIncome()}g/s`;
        traderBtn.disabled = state.gold < cost;
      } else {
        traderBtn.innerHTML = `Traders ${state.traders}/${TRADER_MAX} · ${traderIncome()}g/s`;
        traderBtn.disabled = true;
      }
      traderBtn.style.opacity = traderBtn.disabled ? 0.5 : 1;
      if(state.caravan){
        const secs = Math.max(0, Math.ceil((state.caravan.until - Date.now())/1000));
        caravanBtn.innerHTML = `🚚 caravan out — ${secs}s`;
        caravanBtn.disabled = true;
      } else {
        caravanBtn.innerHTML = `🚚 Send caravan 250g · 1000g`;
        caravanBtn.disabled = state.gold < 250;
      }
      caravanBtn.style.opacity = caravanBtn.disabled ? 0.5 : 1;
      const gnext = nextGuild();
      if(gnext){
        guildBtn.innerHTML = `Guild Hall ${state.guild+1}: ${gnext.name} (${fmt(gnext.cost)}g) — ${gnext.perk}`;
        guildBtn.disabled = state.gold < gnext.cost;
      } else {
        guildBtn.innerHTML = `Guild Hall MAX — ${GUILD_TIERS[2].name}`;
        guildBtn.disabled = true;
      }
      guildBtn.style.opacity = guildBtn.disabled ? 0.5 : 1;
      const expandCost = Math.round(30 * Math.pow(1.5, (state.cap-40)/20));
      expandBtn.textContent = `Expand storage +20 (${expandCost}g)`;
      expandBtn.disabled = state.gold < expandCost;
      expandBtn.style.opacity = expandBtn.disabled ? 0.5 : 1;

      if(worth > best){
        best = worth;
        api.setHighscore(best);
      }
    }

    traderBtn.addEventListener("click", () => {
      if(state.traders >= TRADER_MAX) return;
      const cost = traderCost();
      if(state.gold < cost) return;
      state.gold -= cost;
      state.traders++;
      Feedback.tone("place"); Feedback.haptic("medium");
      toast("trader hired — +" + traderIncome() + "g/s");
      persist(); render();
    });
    caravanBtn.addEventListener("click", () => {
      if(state.caravan) return;
      // 250g if you can afford it, else everything (never strand the button)
      const stake = state.gold >= 1000 ? 1000 : 250;
      if(state.gold < stake) return;
      state.gold -= stake;
      state.caravan = { stake, until: Date.now() + caravanTime() * 1000 };
      Feedback.tone("place"); Feedback.haptic("medium");
      persist(); render();
    });
    guildBtn.addEventListener("click", () => {
      const g = nextGuild();
      if(!g || state.gold < g.cost) return;
      state.gold -= g.cost;
      state.guild++;
      Feedback.buzz("success");
      toast("Guild Hall " + state.guild + " — " + g.name + ": " + g.perk);
      persist(); render();
    });
    expandBtn.addEventListener("click", () => {
      const expandCost = Math.round(30 * Math.pow(1.5, (state.cap-40)/20));
      if(state.gold < expandCost) return;
      Feedback.tone("place"); Feedback.haptic("medium");
      state.gold -= expandCost;
      state.cap += 20;
      persist();
      render();
    });

    function persist(){
      state.lastSeen = Date.now();
      api.save(state);
    }

    // prices drift live, wobble random-walks, traders pay, caravans land —
    // watching the strip for a bit now has payoff every few seconds
    const driftInterval = setInterval(() => {
      GOODS.forEach(g => {
        state.phase[g.key] += 0.015;
        state.wobble[g.key] = Math.max(0.85, Math.min(1.15, (state.wobble[g.key] + (Math.random() - 0.5) * 0.05) * 0.985 + 0.015));
      });
      if(state.traders > 0){
        state.gold += traderIncome();
        checkMilestones();
      }
      render();
    }, 1000);
    const autosave = setInterval(persist, 8000);

    render();

    return () => {
      clearInterval(driftInterval);
      clearInterval(autosave);
      clearTimeout(toastTimer);
      toastEl.remove();
      persist();
    };
  }
});
