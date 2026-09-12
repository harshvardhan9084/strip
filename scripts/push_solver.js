#!/usr/bin/env node
/** Push-based A* sokoban solver (standard normalization: state = crates +
 * player-reachability canonical cell). Returns min PUSH count. */
const fs = require("fs");

function parse(rows){
  const walls = new Set(), crates = new Set(), goals = new Set();
  let player = null;
  rows.forEach((line, r) => {
    for(let c = 0; c < line.length; c++){
      const ch = line[c];
      if(ch === "#") walls.add(r + "," + c);
      if(ch === "$") crates.add(r + "," + c);
      if(ch === ".") goals.add(r + "," + c);
      if(ch === "*"){ crates.add(r + "," + c); goals.add(r + "," + c); }
      if(ch === "@") player = [r, c];
    }
  });
  return { walls, crates, goals, player };
}

function solve(rows, budget = 300000){
  const { walls, crates, goals, player } = parse(rows);
  const R = rows.length, C = Math.max(...rows.map(r => r.length));
  const key = (r,c) => r + "," + c;
  const walk = (r,c) => r >= 0 && r < R && c >= 0 && c < C && !walls.has(key(r,c));

  // player-reachable set from a position given crates (flood fill)
  function reach(p, crates){
    const seen = new Set([p]);
    const q = [p];
    while(q.length){
      const [r,c] = q.shift().split(",").map(Number);
      for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
        const nr=r+dr, nc=c+dc, k=key(nr,nc);
        if(walk(nr,nc) && !crates.has(k) && !seen.has(k)){ seen.add(k); q.push(k); }
      }
    }
    return seen;
  }

  const goalArr = [...goals];
  function h(crates){
    let s = 0;
    for(const ck of crates){
      const [r,c] = ck.split(",").map(Number);
      let best = Infinity;
      for(const gk of goalArr){
        const [gr,gc] = gk.split(",").map(Number);
        best = Math.min(best, Math.abs(r-gr)+Math.abs(c-gc));
      }
      s += best;
    }
    return s;
  }

  const dead = new Set();
  for(let r = 0; r < R; r++) for(let c = 0; c < C; c++){
    if(walls.has(key(r,c)) || goals.has(key(r,c))) continue;
    const up = r-1<0||walls.has(key(r-1,c));
    const dn = r+1>=R||walls.has(key(r+1,c));
    const lf = c-1<0||walls.has(key(r,c-1));
    const rt = c+1>=C||walls.has(key(r,c+1));
    if((up&&lf)||(up&&rt)||(dn&&lf)||(dn&&rt)) dead.add(key(r,c));
  }

  const startCrates = new Set(crates);
  const startReach = reach(player.join(","), startCrates);
  const norm = [...startReach].sort()[0];
  const startKey = norm + "|" + [...startCrates].sort().join(";");
  const open = [{ crates: [...startCrates].sort(), pnorm: norm, g: 0, f: h(startCrates) }];
  const seen = new Map([[startKey, 0]]);
  let expanded = 0;

  while(open.length){
    open.sort((a,b) => a.f - b.f);
    const node = open.shift();
    if(node.crates.every(k => goals.has(k))) return { solvable: true, pushes: node.g };
    // player stands anywhere in the region containing pnorm
    const region = reach(node.pnorm, new Set(node.crates));
    for(const ck of node.crates){
      const [r,c] = ck.split(",").map(Number);
      for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
        // player must stand opposite the push direction
        const standK = key(r-dr, c-dc);
        if(!region.has(standK)) continue;
        const br = r+dr, bc = c+dc, bk = key(br,bc);
        if(!walk(br,bc) || node.crates.includes(bk) || dead.has(bk)) continue;
        const cs2 = node.crates.map(k => k === ck ? bk : k).sort();
        if(cs2.every(k => goals.has(k))) return { solvable: true, pushes: node.g + 1 };
        // new player position = the crate's old cell
        const reach2 = reach(ck, new Set(cs2));
        const norm2 = [...reach2].sort()[0];
        const sk2 = norm2 + "|" + cs2.join(";");
        const g2 = node.g + 1;
        if(seen.has(sk2) && seen.get(sk2) <= g2) continue;
        seen.set(sk2, g2);
        if(++expanded > budget) return { solvable: null, note: "budget " + expanded };
        open.push({ crates: cs2, pnorm: norm2, g: g2, f: g2 + h(cs2) });
      }
    }
  }
  return { solvable: false };
}

// standalone mode: L20 of the shipped game (the open 4-crate finale that
// plain BFS cannot bound) — reads the level straight out of sokoban.js
const src = fs.readFileSync(__dirname + "/../js/games/sokoban.js", "utf8");
const levels = eval(src.match(/const LEVELS = (\[[\s\S]*?\n    \]);/)[1]);
const arr = [levels[19]];
const r = solve(arr[0]);
console.log(r.solvable === true ? "L20 finale: SOLVED pushes=" + r.pushes : "L20 finale: FAIL " + (r.note || "unsolvable"));
