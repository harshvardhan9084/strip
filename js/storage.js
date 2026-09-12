/**
 * STRIP — Storage (IndexedDB)
 * ---------------------------
 * Replaces localStorage. Two object stores:
 *   - "state"      : { id: gameId, data: <any JSON-safe value>, updatedAt }
 *   - "highscores"  : { id: gameId, best: number, history: number[] (capped), updatedAt }
 *
 * Exposes a promise-based API. Falls back to an in-memory Map if IndexedDB
 * is unavailable (private browsing edge cases, very old browsers) so games
 * never crash — they just won't persist for that session.
 */
window.StripDB = (function(){
  const DB_NAME = "strip-db";
  const DB_VERSION = 1;
  const STATE_STORE = "state";
  const SCORE_STORE = "highscores";
  const HISTORY_CAP = 20; // keep last N scores per game, not unbounded — this is what keeps growth predictable long-term

  let dbPromise = null;
  let memoryFallback = null; // Map<storeName, Map<id, record>>

  function useFallback(){
    if(!memoryFallback){
      memoryFallback = new Map([[STATE_STORE, new Map()], [SCORE_STORE, new Map()]]);
    }
    return memoryFallback;
  }

  function openDB(){
    if(dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      if(typeof indexedDB === "undefined" || !indexedDB){
        resolve(null);
        return;
      }
      try{
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if(!db.objectStoreNames.contains(STATE_STORE)){
            db.createObjectStore(STATE_STORE, { keyPath: "id" });
          }
          if(!db.objectStoreNames.contains(SCORE_STORE)){
            db.createObjectStore(SCORE_STORE, { keyPath: "id" });
          }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = () => resolve(null); // treat failure as "no IDB", triggers fallback
      }catch(e){
        resolve(null); // some browsers throw synchronously when IDB is blocked (e.g. strict private mode)
      }
    });
    return dbPromise;
  }

  function tx(storeName, mode){
    return openDB().then(db => {
      if(!db) return null;
      return db.transaction(storeName, mode).objectStore(storeName);
    });
  }

  // ---- generic key/value state (per game) ----
  function saveState(id, data){
    return tx(STATE_STORE, "readwrite").then(store => {
      const record = { id, data, updatedAt: Date.now() };
      if(!store){
        useFallback().get(STATE_STORE).set(id, record);
        return true;
      }
      return new Promise((resolve) => {
        const req = store.put(record);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      });
    });
  }

  function loadState(id){
    return tx(STATE_STORE, "readonly").then(store => {
      if(!store){
        const rec = useFallback().get(STATE_STORE).get(id);
        return rec ? rec.data : null;
      }
      return new Promise((resolve) => {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result ? req.result.data : null);
        req.onerror = () => resolve(null);
      });
    });
  }

  // Tri-state read: { status:"ok", data } when the store answered (data null
  // = genuinely ABSENT, e.g. a fresh player) vs { status:"error" } when the
  // read itself failed. Callers that WRITE what they read back must know the
  // difference — a module that falls back to defaults on a transient IndexedDB
  // hiccup and then persists would overwrite a real record it never saw
  // (Round 14 observed this live with reload racing an in-flight write).
  function loadStateChecked(id){
    return tx(STATE_STORE, "readonly").then(store => {
      if(!store){
        const rec = useFallback().get(STATE_STORE).get(id);
        return { status: "ok", data: rec ? rec.data : null };
      }
      return new Promise((resolve) => {
        const req = store.get(id);
        req.onsuccess = () => resolve({ status: "ok", data: req.result ? req.result.data : null });
        req.onerror = () => resolve({ status: "error", data: null });
      });
    }).catch(() => ({ status: "error", data: null }));
  }

  // ---- highscores (separate store, capped history so size stays bounded) ----
  function getHighscore(id){
    return tx(SCORE_STORE, "readonly").then(store => {
      if(!store){
        const rec = useFallback().get(SCORE_STORE).get(id);
        return rec ? rec.best : 0;
      }
      return new Promise((resolve) => {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result ? req.result.best : 0);
        req.onerror = () => resolve(0);
      });
    });
  }

  function setHighscore(id, score){
    return tx(SCORE_STORE, "readwrite").then(store => {
      const apply = (existing) => {
        const best = Math.max(existing?.best || 0, score);
        const history = (existing?.history || []).concat(score).slice(-HISTORY_CAP);
        return { id, best, history, updatedAt: Date.now() };
      };
      if(!store){
        const map = useFallback().get(SCORE_STORE);
        const record = apply(map.get(id));
        map.set(id, record);
        return record.best;
      }
      return new Promise((resolve) => {
        const getReq = store.get(id);
        getReq.onsuccess = () => {
          const record = apply(getReq.result);
          const putReq = store.put(record);
          putReq.onsuccess = () => resolve(record.best);
          putReq.onerror = () => resolve(record.best);
        };
        getReq.onerror = () => resolve(score);
      });
    });
  }

  // Full record (best + history) — the sparkline (Round 15) charts the last N
  // plays, not just the peak. Returns null when the game has no record at all
  // (getHighscore's `0` default can't distinguish "never played" from a
  // genuine stored zero, and the sparkline must not render for either).
  function getScoreRecord(id){
    return tx(SCORE_STORE, "readonly").then(store => {
      if(!store){
        const rec = useFallback().get(SCORE_STORE).get(id);
        return rec ? { best: rec.best, history: (rec.history || []).slice() } : null;
      }
      return new Promise((resolve) => {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result
          ? { best: req.result.best, history: (req.result.history || []).slice() }
          : null);
        req.onerror = () => resolve(null);
      });
    });
  }

  // Remove a game's highscore record entirely (best + history). Used by the
  // Round 14 twist repair: setHighscore's max() can never LOWER a record,
  // so wiping a corrupted entry needs a real delete. Resolves true if a
  // record was removed.
  function clearHighscore(id){
    return tx(SCORE_STORE, "readwrite").then(store => {
      if(!store){
        const map = useFallback().get(SCORE_STORE);
        const had = map.has(id);
        map.delete(id);
        return had;
      }
      return new Promise((resolve) => {
        // get-first so an ABSENT record resolves false (delete on a missing
        // key succeeds silently — the repair log would over-count)
        const getReq = store.get(id);
        getReq.onsuccess = () => {
          if(getReq.result === undefined){ resolve(false); return; }
          const delReq = store.delete(id);
          delReq.onsuccess = () => resolve(true);
          delReq.onerror = () => resolve(false);
        };
        getReq.onerror = () => resolve(false);
      });
    }).catch(() => false);
  }

  // rough total footprint estimate, for a future "storage used" display if wanted
  function estimateUsage(){
    if(navigator.storage && navigator.storage.estimate){
      return navigator.storage.estimate();
    }
    return Promise.resolve(null);
  }

  // full wipe — used by the "Clear all progress" setting. Clears all game
  // saves and all highscores, but explicitly preserves the app's own settings
  // record (a reserved id inside the "state" store) — clearing your game
  // progress should never silently reset your scroll-lock/sound/motion
  // preferences too. We read it before clearing and write it back after.
  const SETTINGS_KEY = "__app_settings__";

  function clearAll(){
    return loadState(SETTINGS_KEY).then(preservedSettings => {
      return Promise.all([STATE_STORE, SCORE_STORE].map(storeName =>
        tx(storeName, "readwrite").then(store => {
          if(!store){
            useFallback().get(storeName).clear();
            return true;
          }
          return new Promise(resolve => {
            const req = store.clear();
            req.onsuccess = () => resolve(true);
            req.onerror = () => resolve(false);
          });
        })
      )).then(() => {
        if(preservedSettings){
          return saveState(SETTINGS_KEY, preservedSettings);
        }
      });
    });
  }

  return { saveState, loadState, loadStateChecked, getHighscore, getScoreRecord, setHighscore, clearHighscore, estimateUsage, clearAll };
})();
