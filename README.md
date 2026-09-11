# Strip

An endless strip of tiny games. You scroll, a game shows up, you play for half a minute, you scroll again. That's the whole idea. It's called Strip because it's literally a strip of games.

**Play it right now: https://harshvardhan9084.github.io/strip**

Nothing to download. Nothing to sign up for. Open the link and you're playing.

## Why I built this

Every tiny game I liked was trapped inside some big app. One game, five popups, an ad every two minutes, and a login screen asking for my email before it lets me pop a single balloon.

So I built the opposite. One dark little page, one endless strip, and a bunch of small games sitting on it like old cartridges. Scroll down, the next game slides in. Get bored, scroll again. No ads, no accounts, no server somewhere watching you. Your scores and progress stay on your own device, and honestly, that's how it should be.

It's plain HTML, CSS and JavaScript. No frameworks, no build steps, none of that. You can read the whole thing in an afternoon, and I encourage you to.

## Playing it (this part is for everyone)

Open **https://harshvardhan9084.github.io/strip** on your phone or laptop and play. That's it, that's the tutorial.

If you like it, install it. It's a PWA, which is a fancy way of saying: it installs like a normal app and runs without internet.

- On the site, tap the **Install** button (or browser menu, then "Install app" / "Add to Home screen").
- Now Strip lives on your home screen like any other app.
- Once it's installed and has run with internet once, it works **fully offline** from then on. Flight mode, metro tunnels, wifi that died mid-month. Doesn't matter. It opens and plays.

Your saves and high scores live on your device. I can't see them. Nobody can.

## What's on the strip right now

50 cartridges at the moment — the half-century deck. A rough mix:

- **The classics:** Snake, Mini 2048, Mini Sudoku, Maze, Slide Puzzle, Lights Out, Memory Match, Sequence (Simon Says), Bubble Shooter, Whack-a-Mole, XOX, Minesweeper, Blockfall, Breakout, Pong Duel
- **Quick hits:** Reaction Time, Type Speed, Color Snap, Balloon Pop, Flap Dot, Stack Tower, Plinko, Rhythm Tap, Gravity Drop, Blob Merge, Chain Link
- **Slow burns:** Tower Defense, Kingdom, Trading Post, Ant Colony, Garden, Tiny Aquarium, Artillery Duel
- **Puzzles & strategy:** Unscramble, Quick Trivia, Code Breaker, Crate Push, Drop Four
- **Words & cards:** Lexicle, Blackjack 21 (virtual chips only — no real money, ever)
- **Toys & fidgets (all with something real to do):** Sand Drag, Kaleidoscope, Etch Pad, Tone Pad, Color Lab, Spinner, Breathe, Would You Rather, This or That, Random Fact

Every cartridge on the strip gives you something real back — a score, a save, a skill,
or something worth looking at. Pure no-op gag cartridges were removed in the great
cartridge cull of 2026. Weird ideas are still welcome — as long as they *do* something.

## The stuff around the games

- **Daily Pick** (◎ chip in the HUD): one cartridge a day, the same one for everyone,
  picked from the date itself — no server, no account. The chip jumps straight to it;
  the card wears a glowing "TODAY'S PICK" tag while you're on it; play it to grow your
  streak (shown on the chip, best kept forever) and unlock the DAILY DRIVER trophy.
  Come back tomorrow for a new pick.
- **Cartridge drawer** (grid icon): the deck's table of contents. Jump straight to any
  cartridge, filter by name, and star the ones you keep coming back to. Favorites and
  recents are remembered on your device. Today's pick carries a little ◆ in the list.
- **Trophy Case** (cup icon): achievements for exploring — your first cartridge, 10,
  25, all 50; a day with 30 visits; pinning 5 favorites; holding a highscore you went
  back to; playing the Daily Pick. Purely local, no account, no leaderboards, no
  streak-shaming. A cartridge you have already explored gets a small glowing dot in
  the drawer.
- **CRT skins**: Settings → CRT skin. Amber (default), Green phosphor, or Violet.
One tap re-tints the entire console — glows, panels, browser chrome, and (for installed
PWAs) the launch splash / titlebar color follow along. Games keep their own colors;
only the shell changes.
- **Keyboard-friendly dialogs**: every sheet (drawer, settings, trophies) traps Tab
  inside while open, so keyboard and screen-reader users never fall behind the overlay.
- **Everything stays local.** Saves, high scores, favorites, trophies, streaks — all in
your browser's own storage. "Clear all progress" in Settings wipes it all, for real.

## Now, the part I actually care about

The repo description says it in five words: **this game needs developer + gamer.**

Here's my intent, plain and simple. I want Strip to grow into a huge open-source collection of quick games. Not tens, not hundreds. Millions of little cartridges over time, made by people who are gamers at heart and write code because it's fun, not because a sprint board told them to.

I've already built the boring parts so you don't have to:

- the endless strip that scrolls card after card without breaking a sweat (`js/app.js`)
- saving and high scores, handled for you, no setup (`js/storage.js`)
- sound and vibration that respect whatever the player turned on or off (`js/feedback.js`)
- the whole install and offline thing (`manifest.json`, `sw.js`)
- settings, the dark look, the shell around your game
- the cartridge drawer (grid icon in the HUD): jump anywhere, filter by name, pin favorites
- the Trophy Case: shell-level achievements for exploring the deck
- the Daily Pick: a deterministic game-of-the-day with streaks (`js/daily.js`)
- three CRT skins — Amber, Green, Violet — in Settings, down to the PWA titlebar color

What's missing is the fun part. Your game.

## Adding your own game is genuinely easy

Every game on the strip is one JavaScript file. One file, that's the entire game. It tells the app "here I am" and everything else just works:

```js
// js/games/mygame.js
Strip.register({
  id: "mygame",          // unique name, used to save progress
  label: "PUZZLE",       // small tag above the title
  title: "My Game",
  tag: "⏱ 30s",          // little pill on the top right
  hint: "Tap the dot",   // one instruction line at the bottom
  mount(container, api){
    // build your game inside `container`
    // api.save(...) / api.load() keeps player progress
    // api.getHighscore() / api.setHighscore(...) if your game keeps score
    // return a cleanup function (optional) and the app handles the rest
  }
});
```

Then add one line in `index.html` next to the other games:

```html
<script src="js/games/mygame.js"></script>
```

Done. Your game is on the strip. It saves progress, works offline, and shows up in the
deck for every single player. No config, no permissions, no asking me.

The best way to start: open any file in `js/games/`, most are a few hundred lines, pick one that feels close to your idea, copy it, and start messing with it. That's how I build them too.

## Run it on your machine

```
git clone https://github.com/harshvardhan9084/strip.git
cd strip
python -m http.server 8000
```

Open http://localhost:8000 in your browser. No npm install. No build. They're just files.

## House rules (small list, keeps the strip fast)

- One game = one file in `js/games/`. Keep it small.
- No frameworks, no build step, no huge assets.
- Use the shared helpers: `api` for saves, `Feedback` for sound and vibration (never your own AudioContext), `ShuffleBag` when you need randomness that doesn't repeat.
- A game should be fun within seconds. People open this on trains, in queues, while hiding from their boss.
- A cartridge must actually *do* something: a goal, a score, a skill, or a real creative/toy output. No joke cards that exist only to waste a tap.
- Scope element lookups to your card's `container` (two copies of your game can briefly be in the DOM at once; `document.getElementById` can grab the stale one).

When it plays, send a pull request. Tell me what the game is and how to play it, and I'll take it from there.

## Not a developer? You still count

- Got a game idea? Open an issue and describe it. Some of my best cartridges started as dumb ideas typed at 1 AM.
- Found a game that feels broken on your phone? Tell me which phone and what happened. That's a real bug report, don't let anyone tell you otherwise.
- Just share the link with one bored person. That helps more than you think.

## License

I haven't picked a formal license yet, MIT most likely. If you want to use the code before that's sorted, open an issue and ask. I'm easy to reach.

---

Play: https://harshvardhan9084.github.io/strip
Repo: https://github.com/harshvardhan9084/strip
Me: https://github.com/harshvardhan9084

One developer, too many small game ideas. Come build the pile with me.
