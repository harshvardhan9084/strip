/* ============================================================================
 * STRIP — RUN CEREMONY (Round 34, "The One UI" P0 wave)
 * ============================================================================
 * The audit's P0 dopamine finding: the deck pays XP everywhere but celebrates
 * almost nowhere. Three end-of-run stories disagreed — the LEVEL UP panel
 * (great), a bare "GAME OVER" text (breakout/colorsnap), and a silent board
 * reset (lightsout clear, stacktower death). This is the ONE panel every
 * scored cartridge now reaches for: outcome + hero score + delta-vs-best +
 * one verb button, wearing the LEVEL UP panel's visual language, tier-hued.
 *
 * DESIGN CONTRACT (read before wiring a game):
 *  - PRESENTATION ONLY. The panel never computes XP, never writes saves,
 *    never derives encodings. The game STILL calls api.gameover() exactly
 *    once (template rule 7) and STILL calls api.setHighscore() itself.
 *  - Games pass DISPLAY-READY strings: inverted-encoding cartridges
 *    (reaction/maze/memory/…) render "1 240 ms" or "14 moves", never the
 *    stored CEILING−x. The panel is dumb on purpose — it cannot lie about
 *    an encoding it never sees.
 *  - PANEL IS HOSTED: it mounts INSIDE the game's own container, so the
 *    shell's unmount (body.innerHTML="") always reaps it — no global
 *    overlay lifetime to leak, no cleanup returned, no listeners on window
 *    or document (the R32 lesson: a ceremony must never eat keys, so it is
 *    role=status, pointer-only, and its only listener dies with the node).
 *  - ONE PANEL PER HOST: show() on an occupied host replaces the panel.
 *    hide(host) retires it early (a restart that skips the flourish).
 *  - REDUCE MOTION: html.reduce-motion / prefers-reduced-motion collapses
 *    the entrance to a plain fade (CSS owns it; zero JS here).
 *  - Queues with LEVEL UP by REFUSING to fight it: the panel is card-scoped,
 *    so a global LEVEL UP (rare, brief) simply coexists above it.
 * ==========================================================================*/
(function(){
  "use strict";

  // tone → the panel's voice. The label is the outcome in the deck's own
  // vocabulary; hue + glow follow the tone class (CSS owns the palette).
  const TONES = {
    win:   { cls: "rc-win",   label: "YOU WIN" },
    clear: { cls: "rc-clear", label: "CLEARED" },
    over:  { cls: "rc-over",  label: "GAME OVER" },
    draw:  { cls: "rc-draw",  label: "A DRAW" },
  };

  function panelFor(host, opts){
    const tone = TONES[opts.tone] || TONES.over;
    // overlay (dims THIS playfield only) + card (the LEVEL UP panel's sibling)
    const el = document.createElement("div");
    el.className = "run-ceremony " + tone.cls + (opts.tier ? " " + opts.tier : "");
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");

    const card = document.createElement("div");
    card.className = "rc-card";

    const label = document.createElement("div");
    label.className = "rc-label";
    label.textContent = opts.label || tone.label;

    const score = document.createElement("div");
    score.className = "rc-score";
    score.textContent = opts.score != null ? String(opts.score) : "";
    // hero number is decorative repetition of the visible text — AT reads
    // the label + delta line; the aria-hidden keeps the announcement clean
    score.setAttribute("aria-hidden", "true");

    card.appendChild(label);
    if(opts.score != null) card.appendChild(score);

    if(opts.unit){
      const unit = document.createElement("div");
      unit.className = "rc-unit";
      unit.textContent = opts.unit;
      card.appendChild(unit);
    }
    if(opts.delta){
      const delta = document.createElement("div");
      delta.className = "rc-delta " + (opts.deltaTone === "good" ? "rc-delta-good" : "");
      delta.textContent = opts.delta;
      card.appendChild(delta);
    }
    if(opts.verb){
      const btn = document.createElement("button");
      btn.className = "rc-verb";
      btn.type = "button";
      btn.textContent = opts.verb;
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        hide(host);
        try{ typeof opts.onVerb === "function" && opts.onVerb(); }catch(e){}
      });
      card.appendChild(btn);
    }
    el.appendChild(card);
    return el;
  }

  // live map: host → the panel currently shown. show()/hide() keep it exact
  // so rapid deaths (tap-spam into repeated gameovers) can never let a fading
  // node be mistaken for the live panel, nor survive a replacement.
  const live = new WeakMap();

  function sweepStrays(host){
    // any .run-ceremony still in the host that the map doesn't know about
    // (e.g. left mid-fade by a previous hide) dies instantly
    host.querySelectorAll(":scope > .run-ceremony").forEach(n => {
      if(live.get(host) !== n){
        if(n._rcTtl) clearTimeout(n._rcTtl);
        n.remove();
      }
    });
  }

  function show(host, opts){
    if(!host || !host.appendChild) return null;
    hide(host, true); // one panel per host — instant replacement, no fade overlap
    sweepStrays(host);
    const el = panelFor(host, opts || {});
    host.appendChild(el);
    live.set(host, el);
    // entrance on the next frame so the transition always runs
    requestAnimationFrame(() => el.classList.add("rc-show"));
    if(opts && opts.ttl && Number.isFinite(opts.ttl)){
      const t = setTimeout(() => hide(host), opts.ttl);
      el._rcTtl = t; // hidden with the node
    }
    // game-feel event → Feedback.tone (the Sound setting owns it); a loss
    // lands on the thud, everything else gets the win arpeggio
    try{ window.Feedback && Feedback.tone(opts && opts.tone === "over" ? "thud" : "win"); }catch(e){}
    return el;
  }

  function hide(host, instant){
    if(!host) return;
    const el = live.get(host) || host.querySelector(":scope > .run-ceremony");
    if(!el) return;
    if(el._rcTtl) clearTimeout(el._rcTtl);
    live.delete(host);
    if(instant){
      try{ el.remove(); }catch(e){}
      return;
    }
    el.classList.remove("rc-show");
    const node = el;
    setTimeout(() => { try{ node.remove(); }catch(e){} }, 260);
  }

  // QA seam — the exact tone table + a factory for clean assertions.
  window.RunCeremony = { show, hide, _internals: { TONES } };
})();
