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
- **Unlocks.** Systems come online as the engine evolves, so the first hour is just questions:
  upgrades, domain hubs, and the Arcade at stage 1, pathways and the city at stage 2, bosses, the
  Gauntlet, and the league at stage 3, Ascend at stage 5.
- **Sparks.** Right answers earn sparks. Spend them on domain hubs (one generator per domain,
  capped by how many of its nodes you've lit), pathways (unlocked as your score climbs), and
  upgrades that make each answer worth more. Domains below your average pay up to ×1.5, and a
  question you've already seen pays less unless it's a review.
- **Offline.** The engine earns while you're away, but never more than your answers earned on your
  last day of practice.
- **Ascend.** Trade a run for Insight, a permanent bonus. Each Ascend needs a Gauntlet section score
  since the last one, starting at 440 and rising 20 each time. Scores, nodes, evolutions, the city,
  levels, relics, and trophies stay.
- **Sets.** Questions come in tens. Each set ends with a summary of what moved and a bonus.

## Playing with it

- **The Arcade.** Four quick games in the Arena, each drilling one skill. They pay sparks and XP
  (full pay for the first 2 runs of each game a day) and never move a rating.
  - *Comma Sniper* (60 seconds): tap the word where a sentence breaks, then pick the comma,
    semicolon, or colon that belongs there.
  - *Transition Rush* (60 seconds): tap the transition that fits two sentences. A miss costs 3 seconds.
  - *Line Drawer* (5 rounds): drag two points on a grid until the line matches an equation in
    slope-intercept, standard, or point-slope form. Fast answers score more.
  - *Balance Point* (6 rounds): slide a fulcrum to the mean or median of a dot plot. The beam tips
    to show why the mean is the balance point; later rounds add an outlier.
- **Call it.** Before checking an answer, tap Sure, Think so, or Guess. Sure pays ×1.5 when right
  and costs half the question's base value when wrong (Error Mining doesn't refund a lost Sure);
  a missed Guess is logged in the journal.
  Plan shows how often each call is right.
- **Pick a card.** Every finished set deals three face-down cards (sparks, a boost, or a chest).
  Pick one, or two after a perfect set.
- **Surge orbs.** On a streak of 3 or more, a right answer can spark a golden orb on the engine.
  Catch it (or press O) within 12 seconds for sparks or a short Double Sparks.
- **The core.** Tap it to pulse; press and hold to charge a shockwave.
- **Question tools.** Select text in a passage to highlight it (tap a highlight to clear it), draw
  on any question with the pen, and open the math reference sheet.
- **Bosses.** A right answer inside PSAT pace is a quick strike (×1.5 damage). Under a quarter
  health the next right answer is a finisher (×2). Bosses answer back after every hit and miss.
- **Feel.** Phones vibrate on hits, misses, crits, and chests; Settings turns it off.
- **What's new.** A five-slide tour of the city with live demos and Try it buttons. It opens once
  after an update and anytime from Settings or Profile; the last slide replays the earlier
  seven-slide tour of the Arcade and play features.

## Your city

At stage 2 you found a city and name it. Every PSAT skill is a building, so the skyline shows what
you've learned: 29 buildings in eight districts, one district per domain.

- **Learn to build.** A building opens when you light the first node of its skill. Each further
  node adds 50% to its output, and Bronze, Silver, and Gold mastery multiply it again. Empty lots
  say LEARN (light the node) or BUILD (you can build it now), so the skyline advertises what to
  study next.
- **Coins.** Right answers pay coins: a few seconds of city output, more for hard questions.
  Buildings earn every second while you study and 20% while you're idle or away (up to 12 hours).
  Costs rise 15% per copy, in the Cookie Clicker style; buy ×1, ×10, or Max.
- **Growth.** Each building gets taller at 5, 25, 50, 100, and 200 owned. Upgrades double a
  building at 1, 5, 25, 50, and 100 owned; district upgrades, tuition (more coins per answer),
  blimp upgrades, and zoning discounts unlock as the city grows.
- **Residents.** Population sets the city's rank, from Hamlet to World City, and adds a bonus to
  every spark you earn, with diminishing returns.
- **Golden blimps.** While the city is on screen, a golden blimp crosses the sky every few minutes.
  Tap it (or press O) for a lucky payout, a Frenzy (×5 output), a Study Rush (×5 coins per answer),
  or a Building Boom (one building ×10).
- **Wonders.** The Grand Library, the 1520 Tower, and a Launch Pad are long, multi-stage projects.
  The Tower's height follows your projected score, and the Launch Pad sends up a rocket every 90
  seconds.
- **Town Hall.** From 50 residents, pass one policy at a time (switchable once an hour): Study City,
  Night Owls, Tourism Board, or Green Belt.
- **The skyline.** Show it on the main screen instead of the engine, or open the City tab (on
  desktop the panel sits on the right so the city stays in view). The sky follows your clock; tap
  the sun or moon to pick day, dusk, or night. Drag, scroll, or use the arrow keys to look around,
  tap a building to build or train it, and read the news ticker for headlines about what you've
  built.

## Coming back

- **Daily review.** Every miss becomes a blind spot that returns after 10 minutes, then 1, 3, and
  7 days. The spots due each morning (up to 10) form the daily review, served before new
  questions. Finishing it pays a chest.
- **Seasons.** Set a test date and target under Plan. The climb becomes a season with a countdown,
  a weekly target based on the gap, and a test-day projection from your trend since placement.
  When the date passes, the season closes, your real score (if you enter it) becomes the baseline
  marker, and a new season starts. Evolutions, relics, and levels carry over.
- **This week.** Each week has a twist (Double Down, Speed Week, Streak Week, Hard Mode, or
  Review Week) and a featured domain whose boss pays a better chest once.
- **Mastery.** Past the five nodes, each skill has Bronze, Silver, and Gold mastery, earned on hard
  questions: 4 right, then 10 right with 70% of the last 10, then 12 right at pace with 80%. Each
  tier is +1% sparks forever and a chest. A hard drill serves only hard questions in one skill.
- **Mistake journal.** After a miss, tap why: misread, didn't know it, fell for a trap, rushed, or
  guessed. Plan shows the week's pattern and what to do about it.
- **Streak freezes.** One a week, up to 2 banked. Each covers a missed day.
- **Weekly league.** In the Arena. League points are 1, 2, or 3 per right answer by difficulty and
  reset every Monday, so anyone can win a week. It's opt-in and runs on the published page for
  people it's shared with; it shares points, level, and engine stage only.
- **Share card.** From Profile, promotions, or evolutions: a PNG of your engine and your climb.

Blind spots, daily quests, chests, relics, bosses, and the timed Gauntlet work as before. Click
any node or domain on the engine to see its details, level its hub, or train just that skill.

## Importing Question Bank items

Press **Import** above the question and paste questions copied from the College Board SAT Suite
Question Bank: one question, or a whole exported page (it splits on each "Question ID"). Include the
"Correct Answer:" and rationale. The domain, skill, and difficulty are read from the text, using the
Question Bank's own names. Imported questions are stored only in your save and are mixed into
practice, skill training, and blind spots like any other question. Grid-in math answers work too.
Questions built on a graph or picture don't copy as text.

On the published page, **Fresh pack** asks Claude for 5 new questions in any domain, including Math
with grid-ins. Plan shows how many unseen Reading and Writing questions are left in each domain.

## Development

The page stays a single hand-edited file. The DOM-free engine (everything above the
`/* ===== UI ===== */` marker) loads in Node for testing.

```sh
node tools/sim.cjs --days 21 --per-day 60   # balance sim: a modeled student plays the real engine

export NODE_PATH=$(npm root -g)             # tools below use Playwright + Chromium
node tools/smoke.cjs                        # boot, answer questions, fail on page errors
node tools/flows.cjs                        # functional checks: buying, bosses, sets, gauntlet, Ascend,
                                            # daily review, mistake tags, seasons, bulk import, unlocks,
                                            # all four Arcade games, Call it, cards, surge orbs, tools,
                                            # founding and building a city, blimps, policies, tours
node tools/flows.cjs city                   # only the checks whose name contains "city"
node tools/shots.cjs out/                   # screenshots of the main screens from simulated saves
```

When the page is opened from a local file, it exposes `window.__g1520` so the Playwright checks can
read the current question, drive the Arcade, and spawn a golden blimp. Published pages don't have it.

The balance sim plays the city too: it founds one at stage 2, buys the best building, upgrade, or
wonder by gain per coin, and catches 40% of blimps.

Saves are versioned (`S.v`). Version 2 saves (from before the engine) migrate automatically, keep
their ratings, skip placement, and catch up on the evolutions their history earned. Version 3 saves
gain the season, review, league, and journal fields. Saves from before version 5 see the
What's New tour once, and saves from before version 6 see the city tour once.
