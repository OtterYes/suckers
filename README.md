# Grind to 1520

A PSAT/NMSQT practice game where your engine grows from 320 to 1520.

Open `index.html` in a browser to play. Everything is in that one file: the question bank, the
generators, the game engine, and the UI. Progress saves to the browser. Published as a Claude
artifact, it can also save to your Claude account and write fresh question packs with Claude.

## The climb

Progression spans the whole PSAT scale. A new game starts every domain at 160, so the total starts
at 320, the bottom of the scale. The engine is drawn on that scale: 320 at the bottom, 1520 at the
top. Each of the eight domains grows up to its own score, so weak spots are the short stems.

- **Placement.** A domain's first 20 answers set its rating from the most likely ability given
  those answers (a posterior mean with a prior at the bottom of the scale). The climb is visible
  from the first answer, and a domain lands near its real level by the end of placement. After
  that, ordinary Elo takes over.
- **Ranks.** Stone and Copper sit below Iron, so there are rungs from 320 up. From 1000 up the
  original thresholds are unchanged: Gold is still 1240 and Diamond is still 1400.
- **Baseline.** Your last real PSAT score (1160 by default, editable in Settings) is marked on the
  climb. Passing it is a milestone.

## Growing the engine

- **Skill nodes.** Every skill has five nodes. Your 3rd, 10th, 25th, 50th, and 100th right answer
  in that skill light one. Each lit node is a connection.
- **Evolution.** Connections carry the engine through eleven permanent stages. Each stage adds a
  spark bonus and a chest. Stage 5 turns the engine into a Reactor and stage 7 into a Universe;
  you can switch between unlocked forms.
- **Sparks.** Right answers earn sparks. Spend them on domain hubs (one generator per domain,
  capped by how many of its nodes you've lit), pathways (unlocked as your score climbs), and
  upgrades that make each answer worth more.
- **Ascend.** Trade a run for Insight, a permanent bonus. Scores, nodes, evolutions, levels,
  relics, and trophies stay.
- **Sets.** Questions come in tens. Each set ends with a summary of what moved and a bonus.

Blind spots, daily quests, chests, relics, bosses, and the timed Gauntlet work as before. Click
any node or domain on the engine to see its details, level its hub, or train just that skill.

## Development

The page stays a single hand-edited file. The DOM-free engine (everything above the
`/* ===== UI ===== */` marker) loads in Node for testing.

```sh
node tools/sim.cjs --days 21 --per-day 60   # balance sim: a modeled student plays the real engine

export NODE_PATH=$(npm root -g)             # tools below use Playwright + Chromium
node tools/smoke.cjs                        # boot, answer questions, fail on page errors
node tools/flows.cjs                        # functional checks: buying, bosses, sets, gauntlet, Ascend
node tools/shots.cjs out/                   # screenshots of the main screens from simulated saves
```

Saves are versioned (`S.v`). Version 2 saves (from before the engine) migrate automatically, keep
their ratings, skip placement, and catch up on the evolutions their history earned.
