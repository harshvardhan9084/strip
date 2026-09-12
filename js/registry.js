/**
 * STRIP — Game Registry
 * ---------------------
 * Each mini-game/fidget/widget registers itself here as a plain object:
 *
 * Strip.register({
 *   id: "unique-id",           // stable id, used for save-state key
 *   label: "CATEGORY",         // small eyebrow text (e.g. "FIDGET", "PUZZLE")
 *   title: "Display Name",
 *   tag: "⏱ 30s",              // small pill on the top-right of the card
 *   hint: "Tap to pop",        // short instruction line at bottom
 *   mount(container, api) {    // called when the card enters the strip
 *     // build DOM inside `container`, wire up events
 *     // api.save(obj) / api.load() -> persist small JSON state
 *     // return an optional cleanup function
 *   }
 * });
 *
 * Registration order = default deck order, but app.js can shuffle/weight it.
 */
window.Strip = (function(){
  const modules = [];

  function register(mod){
    if(!mod || !mod.id || typeof mod.mount !== "function"){
      console.error("Strip.register: invalid module", mod);
      return;
    }
    // Round 14 tripwire: games that store an INVERTED score (setHighscore(
    // CEILING - moves) so the store's max-wins semantics work) MUST declare
    // scoreEncoding:"inverted", or the Daily ×2 twist doubles their ceiling
    // encoding and their decoded best goes permanently negative. The 7
    // current carriers are annotated; this warns the next author who wires
    // one by hand instead of silently corrupting saves.
    if(mod.scoreEncoding !== "inverted"){
      let src = "";
      try{ src = Function.prototype.toString.call(mod.mount); }catch(e){}
      if(/setHighscore\(\s*[^()]*\s-\s/.test(src)){
        console.warn('Strip.register: "' + mod.id + '" appears to save an inverted score (setHighscore(CEILING - x)) without declaring scoreEncoding:"inverted" — the Daily ×2 twist would corrupt its best.');
      }
    }
    modules.push(mod);
  }

  function all(){ return modules.slice(); }

  return { register, all };
})();
