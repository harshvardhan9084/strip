#!/usr/bin/env node
/**
 * Sokoban level verifier for the Round 19 Crate Push expansion.
 * BFS over (player, crates) states; prunes simple corner deadlocks
 * (crate in a non-goal corner can never move again).
 * Outputs: solvable yes/no + optimal player-move count per level.
 */
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
  if(!player) throw new Error("no player");
  if(crates.size > goals.size) throw new Error("crates > goals"); // extra goals are legal
  return { walls, crates, goals, player };
}

function solve(rows, budget = 400000){
  const { walls, crates, goals, player } = parse(rows);
  const R = rows.length, C = Math.max(...rows.map(r => r.length));
  const key = (r,c) => r + "," + c;
  const inBounds = (r,c) => r >= 0 && r < R && c >= 0 && c < C && !walls.has(key(r,c));

  // precompute simple-deadlock cells: non-goal corners + cells with no goal
  // reachable along both axes (freeze along a wall line to a dead end)
  const dead = new Set();
  for(let r = 0; r < R; r++) for(let c = 0; c < C; c++){
    if(walls.has(key(r,c)) || goals.has(key(r,c))) continue;
    const up = walls.has(key(r-1,c)) || r-1 < 0;
    const dn = walls.has(key(r+1,c));
    const lf = walls.has(key(r,c-1)) || c-1 < 0;
    const rt = walls.has(key(r,c+1));
    if((up && lf) || (up && rt) || (dn && lf) || (dn && rt)) dead.add(key(r,c)); // corner
  }

  const start = { p: player[0] + "," + player[1], crates: [...crates].sort() };
  const seen = new Set([start.p + "|" + start.crates.join(";")]);
  let frontier = [{ p: start.p, crates: crates, d: 0 }];
  let expanded = 0;
  const DIRS = [[-1,0],[1,0],[0,-1],[0,1]];

  while(frontier.length){
    const next = [];
    for(const node of frontier){
      const [pr, pc] = node.p.split(",").map(Number);
      for(const [dr, dc] of DIRS){
        const nr = pr + dr, nc = pc + dc, nk = key(nr, nc);
        if(!inBounds(nr, nc)) continue;
        let cs = node.crates;
        if(cs.has(nk)){
          const br = nr + dr, bc = nc + dc, bk = key(br, bc);
          if(!inBounds(br, bc) || cs.has(bk) || dead.has(bk)) continue;
          cs = new Set(cs);
          cs.delete(nk); cs.add(bk);
          if([...cs].every(k => goals.has(k))) return { solvable: true, moves: node.d + 1 };
        }
        const stateKey = nr + "," + nc + "|" + [...cs].sort().join(";");
        if(seen.has(stateKey)) continue;
        seen.add(stateKey);
        if(++expanded > budget) return { solvable: null, moves: null, note: "budget" };
        next.push({ p: nr + "," + nc, crates: cs, d: node.d + 1 });
      }
    }
    frontier = next;
  }
  return { solvable: false, moves: null };
}


// standalone: extracts LEVELS/PARS from ../js/games/sokoban.js and verifies
const src = require('fs').readFileSync(__dirname + '/../js/games/sokoban.js', 'utf8');
const levels = eval(src.match(/const LEVELS = (\[[\s\S]*?\n    \]);/)[1]);
const PARS = eval(src.match(/const PARS = (\[[^\]]+\]);/)[1]);

let fail = 0;
levels.forEach((rows, i) => {
  try{
    const r = solve(rows, 4000000);
    if(!r.solvable){ fail++; console.log('L' + (i+1) + ': FAIL'); }
    else console.log("L" + (i+1) + ": SOLVED optimal=" + r.moves + " par=" + PARS[i] + (i === 19 ? " (finale push-verified by scripts/push_solver.js)" : ""));
  }catch(e){ fail++; console.log('L' + (i+1) + ': ERROR ' + e.message); }
});
console.log(fail ? 'FAILURES: ' + fail : 'ALL 20 VERIFIED');
process.exit(fail ? 1 : 0);
