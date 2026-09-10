/**
 * STRIP — Feedback
 * ----------------
 * Shared sound + haptic layer for all games. Every game should call these
 * instead of touching navigator.vibrate or AudioContext directly, so that:
 *   - Settings.sound / Settings.haptics are respected app-wide
 *   - one AudioContext is shared (mobile browsers cap how many can exist)
 *   - tones stay consistent across games (same envelope/timbre family)
 *
 * Usage:
 *   Feedback.tone("tap")        // short neutral click
 *   Feedback.tone("success")    // rising two-note chime
 *   Feedback.tone("fail")       // short low buzz
 *   Feedback.tone("win")        // bright ascending arpeggio
 *   Feedback.tone(440, 0.08)    // raw: frequency (Hz), duration (s)
 *   Feedback.haptic("light")    // 6ms
 *   Feedback.haptic("medium")   // 15ms
 *   Feedback.haptic("heavy")    // 30ms
 *   Feedback.haptic([10,30,10]) // raw pattern, passed to navigator.vibrate
 *   Feedback.buzz("error")      // combined tone("fail") + haptic("heavy")
 */
window.Feedback = (function(){
  let ctx = null;

  function ensureCtx(){
    if(ctx) return ctx;
    try{
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }catch(e){
      ctx = null;
    }
    return ctx;
  }

  // Unlock/resume audio on first user gesture (iOS/Safari requirement).
  // Games don't need to call this themselves — it's wired once at boot.
  function unlock(){
    const c = ensureCtx();
    if(c && c.state === "suspended") c.resume().catch(()=>{});
  }
  ["pointerdown","touchstart","keydown"].forEach(evt =>
    window.addEventListener(evt, unlock, { once:true, passive:true })
  );

  function soundEnabled(){
    try{ return !!Settings.get().sound; }catch(e){ return true; }
  }
  function hapticsEnabled(){
    try{ return !!Settings.get().haptics; }catch(e){ return true; }
  }

  // Play a single oscillator note with a short percussive envelope.
  function playNote(freq, dur, opts){
    if(!soundEnabled()) return;
    const c = ensureCtx();
    if(!c) return;
    if(c.state === "suspended") c.resume().catch(()=>{});

    opts = opts || {};
    const type = opts.type || "sine";
    const gainPeak = opts.gain != null ? opts.gain : 0.18;
    const delay = opts.delay || 0;

    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if(opts.slideTo){
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), t0 + dur);
    }

    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(gainPeak, t0 + Math.min(0.01, dur / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // Named presets so games don't invent their own frequencies ad hoc.
  const PRESETS = {
    tap:     () => playNote(560, 0.045, { type:"sine", gain:0.14 }),
    select:  () => playNote(720, 0.05,  { type:"sine", gain:0.15 }),
    toggle:  () => playNote(480, 0.06,  { type:"triangle", gain:0.14 }),
    pop:     () => playNote(660, 0.07,  { type:"sine", gain:0.18, slideTo:220 }),
    success: () => { playNote(523.25, 0.09, { gain:0.16 }); playNote(783.99, 0.12, { gain:0.16, delay:0.08 }); },
    win:     () => { [523.25,659.25,783.99,1046.5].forEach((f,i)=> playNote(f, 0.11, { gain:0.16, delay:i*0.09 })); },
    fail:    () => playNote(140, 0.18, { type:"sawtooth", gain:0.12, slideTo:70 }),
    error:   () => playNote(120, 0.22, { type:"square", gain:0.10, slideTo:60 }),
    lose:    () => { playNote(300, 0.12, { type:"triangle", gain:0.14 }); playNote(180, 0.22, { type:"triangle", gain:0.14, delay:0.1 }); },
    place:   () => playNote(340, 0.05,  { type:"square", gain:0.10 }),
    swap:    () => playNote(880, 0.04,  { type:"sine", gain:0.1 }),
    // added in Round 5: dropfour/bubbleshoot/pongduel used these names but the
    // presets didn't exist, so every call silently fell back to 440 Hz
    blip:    () => playNote(980, 0.045, { type:"triangle", gain:0.13 }),
    thud:    () => playNote(120, 0.09,  { type:"sine", gain:0.16, slideTo:60 }),
    ok:      () => playNote(620, 0.06,  { type:"sine", gain:0.15, slideTo:860 }),
  };

  function tone(nameOrFreq, dur){
    if(typeof nameOrFreq === "number"){
      playNote(nameOrFreq, dur || 0.08);
      return;
    }
    const fn = PRESETS[nameOrFreq];
    if(fn) fn();
    else playNote(440, 0.08); // unknown name -> safe fallback rather than silently doing nothing
  }

  const HAPTIC_PRESETS = {
    light:  6,
    medium: 15,
    heavy:  30,
  };

  function haptic(nameOrPattern){
    if(!hapticsEnabled()) return;
    if(!navigator.vibrate) return;
    if(Array.isArray(nameOrPattern)){
      navigator.vibrate(nameOrPattern);
      return;
    }
    const ms = HAPTIC_PRESETS[nameOrPattern] != null ? HAPTIC_PRESETS[nameOrPattern] : (typeof nameOrPattern === "number" ? nameOrPattern : 10);
    navigator.vibrate(ms);
  }

  // Convenience combo for the common "something happened, tell the player" case.
  function buzz(kind){
    kind = kind || "tap";
    const toneMap = { tap:"tap", success:"success", win:"win", fail:"fail", error:"error", lose:"lose" };
    const hapticMap = { tap:"light", success:"medium", win:"heavy", fail:"medium", error:"heavy", lose:"medium" };
    tone(toneMap[kind] || "tap");
    haptic(hapticMap[kind] || "light");
  }

  return { tone, haptic, buzz };
})();
