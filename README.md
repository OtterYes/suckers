# To 1520

A PSAT/NMSQT practice game set in a small town that grows as you learn. Your game estimate climbs from 320
toward 1520; the town, its buildings, and its projects grow with what you actually know.

Open `index.html` in a browser to play. Everything is in that one file: the question bank, the
generators, the game engine, and the UI. Progress saves to the browser. Published as a Claude
artifact, it can also save to your Claude account and write fresh question packs with Claude.

## Start here

- **The title card.** The game opens on a short title card and moves into play by itself the moment
  it has loaded; there is nothing to click. If loading ever fails, the same screen says why, offers
  **Try again** and **Download my save file**, and leaves the saved progress exactly as it was.
- **The town.** You arrive in a small town (rename it at the Town Hall). It is on the main screen from
  the first minute, as a skyline or in 3D, with the question console beside it. Every PSAT skill is a
  building; empty lots say LEARN or BUILD. Practice earns coins for the town and sparks for the
  engine, and what you learn decides what gets built.
- **Places.** The bar at the bottom lists the places: **Town** (where you are), **Town Hall** (plans,
  projects, building, stats), **Progress**, **Arena**, **Upgrades**, **Zones**, and **Ascend**. Only
  the next locked place shows, with what it needs. Every page has a Back button (Escape works too)
  that returns to where you came from.
- **A building is a page.** Open one from the skyline card, from the Town Hall's Build page, or walk
  up to it in 3D and press E. Its page has **Work here** (a round of five questions in its skill, or a
  hard drill), what you have learned there (skill nodes, proficiency, mastery), its **Tools**, and
  **Build**. Rounds keep a tally and pay nothing extra; every answer counts as usual. A round survives
  a reload, and picking another focus ends it.
- **The intro.** A new game opens with a two-minute playable intro: answer a question, watch the town
  respond, pick a free first upgrade, and meet Today's Adventure. Every step can be skipped, and
  Settings → The intro → **Replay it** runs it again (the free upgrade is paid once). Existing saves
  skip it and get a short list of what changed.
- **Today's Adventure.** One guided session a day, in the bar above your questions. It plans, in
  order: the blind spots that are due, the skill that needs it most (with the reason), a challenge on
  that domain, and something to put into the town (a project or tool you can afford, restore a
  landmark, expand a zone, or build). Pick **Quick**, **Standard**, or **Deep**; the practice steps
  are required, the rest optional. The reward is paid once per day. It is a layer over ordinary play:
  picking your own focus pauses it, and it resumes where it was.

## Proficiency, tools, and town projects

- **Proficiency** is what your last twelve answers in a skill show, kept apart from ratings and
  rewards. Each answer is weighted: hard questions 1.5, medium 1, easy 0.5, and any repeat (a
  question you had seen before, or a review) half of that. The weighted accuracy is shrunk toward
  50% while there is little evidence (three units of weight). Bands: **Learning**, **Working** (55%
  and 4 units of evidence), **Skilled** (70%, 8 units, and at least 3 hard questions), **Expert**
  (85%, 12 units, 5 hard questions, and a Bronze medal). A band holds until accuracy falls 8 points
  under its bar, so one bad day never takes it away; twelve easy repeats reach nothing, and easy
  questions alone stop at Working. Purchases never touch it, and it never touches a rating.
- **Tools** are three upgrades per skill building: Better tools (Working), Skilled hands (Skilled),
  and Master craft (Expert). Each makes the building produce 60% more and its right answers pay 25%
  more coins. A tool appears as an offer the moment the band is reached; its price is set then, from
  the building's class and the town's output, and never changes. Coins from anywhere pay for it, once.
  Tools are learning, so they stay through Advance. Tuning lives in `PROF` and `TOOLS` in the engine.
- **The Town Square** is the first town project. The fountain has been dry for years and the lanterns
  are dark. It needs Working proficiency in a skill from two Reading and Writing subjects and two
  Math subjects, then 1,500 coins from the treasury. The evidence is kept once it is complete, the
  coins are paid once, and the square is restored for good: the fountain runs, the lanterns light,
  people gather, an Epic chest is paid, and the town's output is +15%. It shows on the skyline and in
  3D, and it survives Advance. Projects live on the Town Hall's Plans page with the Harbor Bridge.
- **What is still open.** A permanent campaign completion tied to 1520 is planned; the story and the
  mechanics are undecided, so nothing here pretends to be it. The game estimate stays a game
  estimate, and completing projects is never a test score.

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
- **Unlocks.** Upgrades, zones, domain hubs, and the Arcade are open from the first answer, so
  there's always something to spend sparks on. Bosses open at stage 1, pathways and the city at
  stage 2, the Gauntlet and the league at stage 3, and Ascend at stage 5.
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

## Zones

Every domain is its own zone, with a rule that changes how its questions pay, an upgrade tree, and
five tiers of expansion. A strip under every question shows its zone's meter, and the Zones tab
has a page for each one.

| Zone | Domain | Rule |
| --- | --- | --- |
| The Archive | Information and Ideas | **Evidence Chain:** right answers in a row build links, +10% each. A miss here breaks the chain. |
| The Word Forge | Craft and Structure | **Heat:** five right answers fill the forge, and the next one is Forged for ×3. A miss cools it by 2. |
| The Bridgeworks | Expression of Ideas | **Bridges:** +15% for each other domain in your last 6 answers. |
| The Clockworks | Standard English Conventions | **Perfect Tick:** double the pace bonus, and ×2 for a right answer in under half the pace time. |
| Engine Works | Algebra | **Production Line:** every 5 right answers build a machine, +10% to the hub and +2% to Algebra. |
| The Launch Lab | Advanced Math | **Rocket Fuel:** each right answer compounds fuel ×1.1. Launch it for sparks; a miss spills half. |
| The Exchange | Problem-Solving and Data | **Interest Vault:** answers here deposit extra sparks that earn 1.5% per right answer. Withdraw any time. |
| The Crystal Caves | Geometry and Trigonometry | **Facets:** right answers cut triangles, squares, pentagons, and hexagons. Hexagons leave gems (+1% sparks). |

- **The tree.** Five rows, one per tier, bought with sparks: the zone's hub, its rule, its domain's
  sparks, its Arcade game, its boss, XP, chests, and all sparks. Tree levels and rule meters reset
  when you Ascend or Advance.
- **Expansions.** Tiers 2 to 5 open as you light that domain's skill nodes (10%, 30%, 55%, and 80%
  of them); tier 4 also needs a Bronze medal in the domain, and tier 5 a Silver. Each tier costs
  sparks once, adds 50% to the hub and 10% to the domain's sparks, and opens a row of the tree.
  Tiers stay for good, and tier 5 earns the zone's title.
- **Keystones.** Two per zone, at tiers 3 and 5, bought with talent points. They bend the rule: the
  Archive's chain can count Craft and Structure, the Launch Lab's launches can pay double, the
  Exchange's vault can survive Ascend, and so on. Keystones stay for good.

## Levels

- **Talent points.** Every level is a talent point. Spend them on zone keystones and on ten talents
  grouped by the way you like to play: **Reviewer** (Second Wind: comebacks pay 50% more; Spaced
  Out: blind-spot reviews pay 20% more), **Explorer** (Pathfinder: +10% city coins and Expedition
  supplies; Night Shift), **Challenger** (Boss Hunter: beaten bosses pay 50% more; Tough as Nails;
  Arcade Regular; Combo Artist), and **All-rounder** (Quick Study, Lucky Find). Reset them any time
  for free. Relics carry the same playstyle tags.
- **The Level Road.** Open it from your level in the top bar. Each level still pays sparks and a
  chest the moment you reach it, and the road adds one more reward to claim: a chest or a boost,
  with a title and a bigger chest at the milestones.
- **Titles.** Newcomer, Apprentice, Scholar, and on up to Legend at level 100, plus one for each
  zone you expand to tier 5. Wear any title you've earned.
- **Prestige.** Past level 100, levels turn into prestige stars (Mythic at ★5, Eternal at ★10).
  XP needs grow faster past level 40, so the road stays long.

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
  Progress shows how often each call is right.
- **Pick a card.** Every finished set deals three face-down cards (sparks, a boost, or a chest).
  Pick one, or two after a perfect set.
- **Surge orbs.** On a streak of 3 or more, a right answer can spark a golden orb on the engine.
  Catch it (or press O) within 12 seconds for sparks or a short Double Sparks.
- **The core.** Tap it to pulse; press and hold to charge a shockwave.
- **Question tools.** Select text in a passage to highlight it (tap a highlight to clear it), draw
  on any question with the pen, and open the math reference sheet.
- **Bosses.** Three bosses fight their own way; the questions stay ordinary practice questions.
  - *The Linear Leviathan* (Algebra) is a machine with one part per Algebra skill (four, or five with
    armor from tier 3). Tap a part to target it and its questions come from that skill; a right
    answer shuts it down, or strips armor (two plates inside PSAT pace).
  - *The Inference Hydra* (Information and Ideas) has three heads (four from tier 3). Each needs its
    claim found (a Central Ideas or Inferences question), then backed with evidence (a Command of
    Evidence question) to be cut.
  - *The Comma Splicer* (Standard English Conventions) has spliced a page of sentences together.
    Each right answer repairs one broken joint (two inside PSAT pace), and the repaired sentence
    shows the mark that belongs there, with the rule.
  - The other five take damage: a right answer inside PSAT pace is a quick strike (×1.5), and under a
    quarter health the next right answer is a finisher (×2). Three misses end any fight, and every
    boss answers back after every hit and miss.
- **Feel.** Phones vibrate on hits, misses, crits, and chests; Settings turns it off.
- **What's new.** A short list of what changed in the latest update, once after updating and anytime
  from Settings or Profile. **Earlier updates** opens the tours with live demos: zones and the Level
  Road, units and the Expedition, the city, and the Arcade.
- **Fewer interruptions.** Level-ups, chests, quests, trophies, and adventure steps show as chips in
  the answer's feedback instead of popups, with Open and Claim buttons right there. Rank tiers,
  evolutions, and boss wins still get their moment.

## The question panel and saving

- **Move the questions.** The layout button above the question opens the panel settings. Put
  the panel on the right, the left, or along the bottom (the question on the left, the answers on
  the right, and the engine or city above), make it narrow, normal, or wide, and pick small,
  medium, or large text. The same rows are in Settings.
- **Hide them.** Press **Q** to hide the panel and give the engine, the city, or the 3D city the
  whole screen. Press Q again, or the Questions button, to bring it back where it was. Answer keys
  do nothing while it's hidden.
- **Saving.** The game saves by itself every 10 seconds, after everything you buy or answer, and
  when you switch away. Settings shows when it last saved and has **Save now** (or press
  **Ctrl+S**), **Download a save file** (a text file holding your backup code), and **Load a save
  file**, which replaces the progress in this browser.

## Phones and tablets

- **Where to play.** Open the web version in Safari or Chrome on the phone or tablet. It lays itself
  out for the screen: the town on top, the questions under it, and the places bar along the bottom.
  Turn a phone sideways and the town fits between the top bar and the places bar. In 3D a stick and
  a Jump button appear.
- **Touch.** Tap a building to open its card, drag the skyline sideways to look along it, and in 3D
  drag to look around or tap the ground to walk there. Where the places bar is tight, Town Hall
  reads **Hall**. Small controls are finger-sized, and text fields are large enough that the phone
  doesn't zoom in when you type.
- **The page follows you.** Starting a round, a boss, or a focus scrolls the question into view. A
  building's page fills a phone's screen, and its **Show me** takes you back to the town, looking at
  that building. The intro's cards sit in the page next to what they talk about, never over the
  answers. The Check/Next bar stays within reach while you scroll, and so does the top bar when the
  phone is upright.
- **Your progress is kept per browser.** A phone has its own save. To move progress between
  devices, use Settings → **Download a save file** on one and **Load a save file** on the other (or
  copy the backup code). On the web version, Cloud save keeps a copy in your Claude account. Safari
  may clear a site's saved data if you don't open it for about a week, so download a save file now
  and then. If a browser refuses to save at all (storage full, or blocked in some private windows),
  the game says so and offers the file.

## Your town

The town is there from the first minute, and you can rename it at the Town Hall. Every PSAT skill is a
building, so the skyline shows what you've learned: 29 buildings in eight districts, one district per
domain, with the civic plaza (Town Hall, the wonders, and the Town Square) in the middle.

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
  The Tower's height follows your game estimate, and the Launch Pad sends up a rocket every 90
  seconds.
- **Landmarks: the Harbor Bridge.** A storm broke the bridge in the Harbor district, so nobody can
  reach Lantern Isle and its lantern is dark. Get 10 Transitions questions right, with 7 of your last
  10 right, and **Restore** it from the Town Hall's projects (or from Today's Adventure). The bridge
  is rebuilt with lamps lit, people cross it, the lantern shines, and it pays an Epic chest, once.
  It stays restored for good (Advance doesn't undo it). Saves from before this update count their
  history: until the skill has 10 recent results, the last 10 hard Transitions questions (or overall
  accuracy in the skill) stand in for "your last 10".
- **Town Hall.** Its Plans page has the stage goals, the town projects, and, from 50 residents, one
  policy at a time (switchable once an hour): Study City, Night Owls, Tourism Board, or Green Belt.
  Its Build page has every building by district, the upgrades, and the wonders; Stats has the numbers
  and the screen settings.
- **The skyline.** It is the main screen unless you pick the engine, and it stays in view behind the
  Town Hall and building pages on desktop. The sky follows your clock; tap
  the sun or moon to pick day, dusk, or night. Drag, scroll, or use the arrow keys to look around,
  tap a building to build or train it, and read the news ticker for headlines about what you've
  built.

## Your town in 3D

Pick **3D** on the main-screen switch (or at the Town Hall) to walk through your town.

- **The layout.** The 29 buildings stand around a ring road, one district per domain in the
  skyline's order, with signs where each district begins. Town Hall, the 1520 Tower, the Grand
  Library, and the Launch Pad share the plaza in the middle.
- **Every building is modeled.** Each one grows with its level, just like on the skyline: the Ferris
  Wheel turns, the Mint's coin spins, the clock faces show the real time, the lighthouse sweeps its
  beam at night, and the Newsroom's ticker scrolls. Empty lots have a fence, a see-through preview
  of the building, and a BUILD or LEARN sign.
- **Moving around.** W A S D or the arrow keys walk (Shift runs, Space jumps), and dragging looks
  around; the scroll wheel or a pinch zooms. On a phone, use the stick in the corner and the Jump
  button. Click or tap the ground to walk there.
- **Buildings.** Click or tap one for its card, where you can build or open its page. Walk up to one
  and press E, or tap the prompt, to open the nearest one's page. The Town Square sits in the plaza
  behind the tower: a dry basin under dark lanterns until the project is done, then a running
  fountain under lit ones.
- **The harbor.** Past the Harbor district a path leads to a lagoon, the Harbor Bridge, and Lantern
  Isle. Until the bridge is restored its middle has fallen into the water, a CLOSED barrier blocks
  it, and the water stops you. Once it's restored you can walk over the arched bridge to the isle
  and its lit lighthouse.
- **Life.** The sky follows your clock (or the Sky setting), with lit windows, street lamps, and
  stars at night. Cars stop at the Crossroads light, residents fill the sidewalks as the city grows,
  the Linear Rail runs on an elevated loop, and golden blimps fly low enough to catch: click one
  or press O.
- **Quality.** The 3D view loads a 3D engine (Three.js) the first time you open it. **3D quality**
  in the City tab's Stats picks shadows and sharpness; Auto uses Low on phones and on
  computers with four or fewer processor cores. If the 3D engine can't load, the view says so and offers the 2D city.

## Units and stages

The whole game is a ladder: Unit 1 has stages 1.1 to 1.5, Unit 2 has 2.1 to 2.5, and so on. The
badge in the top bar shows where you are.

- **Checklists.** Each stage asks for the unit's own goals (residents, buildings, tiles, crew,
  Guardians) plus *study* goals that never reset: skill nodes lit, mastery medals, right answers,
  Gauntlet runs, and days with 10+ right. Later stages also call back to earlier units; Unit 2
  asks you to rebuild your city. Clearing a stage pays a chest and +2% sparks and coins for good.
- **Advance.** Clear x.5 and you can Advance to the next unit. Sparks, upgrades, pathways, hubs,
  and the whole city reset to square one, and a new mechanic opens. Scores, skill nodes, mastery,
  evolutions, Insight, level, trophies, and chests stay. Each Advance adds **Legacy**: sparks ×1.25
  and city coins ×2 per level, forever.
- **Pacing.** In the balance sim, a student doing 60 questions a day clears Unit 1 in about four
  weeks and Unit 2 about five weeks later; at 30 a day, seven to eight weeks each. After that the
  Expedition's depths keep going, each a little slower than the last.

## Unit 2: The Expedition

A fogged 13 × 11 map in eight regions, one per domain, with a base camp in the middle.

- **Supplies and exploring.** Right answers pay supplies (more for hard questions). Spend them to
  reveal a tile next to one you have. Tiles hold gems (more in your weaker domains), gem deposits,
  camps (+1 crew slot), caches, and mystery crates. Each tile costs a little more than the last.
- **Guardians.** Each region's heart holds a Guardian. Once you've scouted enough of its region,
  challenge it: the next 12 right answers in its domain beat it, and a miss there costs a step.
  Each Guardian drops its domain's artifact. Beat all eight to **descend**: a new map where
  exploring costs ×3, rewards pay ×2, and Guardians need 4 more answers. Depths never end.
- **Crew.** Hire Scouts (cheaper exploring), Miners (gems, ×5 on a deposit), Porters (supplies
  every second), and Scholars (more supplies for answers in their tile's domain). They work at 50%
  to 150% of their rate depending on your last 20 answers in that domain, and three different
  roles side by side make a **full team** (×1.5). Level them with gems. Crew work at 20% while
  you're away, for up to 12 hours.
- **Artifacts.** Sixteen, two per domain, kept forever: bonuses to supplies, gems, sparks, coins,
  exploring, crew, or crate luck. A full pair adds a crew slot.
- **Luck, with the odds on screen.** Everything here uses gems, which you only earn by playing.
  Nothing is for sale.
  - *Mystery crates:* Common 60%, Rare 28%, Epic 10%, Legendary 2% (crate luck shifts these).
    An Epic or better is guaranteed within 10 crates.
  - *Fortune Wheel:* one free spin and 12 paid spins a day. Bet 10%, 25%, or 50% of your gems. The
    slices are drawn to the real odds: Bust 30%, ×0.5 20%, ×1.5 20%, ×2 15%, ×3 8%, Crate 5%,
    ×10 1.5%, Jackpot (×25 and an Epic+ crate) 0.5%.
  - *Stakes:* bet 10% or 25% of your gems on your next answer. Right pays +50% (easy), +90%
    (medium), or +150% (hard); wrong loses the stake.
- **Guild.** With the weekly league on, every member's right answers fill one shared bar (150
  points per member). When it's full, everyone who added 40+ points claims an Epic chest.

## Coming back

- **Daily review.** Every miss becomes a blind spot that returns after 10 minutes, then 1, 3, and
  7 days. The spots due each morning (up to 10) form the daily review, served before new
  questions. Finishing it pays a chest.
- **Comebacks.** A miss shows one specific, encouraging line, the explanation, and **Try a fresh
  one**: a new question in the same skill (new numbers in Math, another passage in Reading and
  Writing). The missed question comes back as a blind spot. Winning that first rematch after the
  wait is a **comeback** and pays a bonus (twice as much, a **full comeback**, if you also got the
  fresh one right). It's paid once per question, ever, so there's nothing to farm.
- **Learning evidence.** The Progress tab (formerly Plan) opens with what you've actually learned,
  kept apart from game rewards: your accuracy on questions you hadn't seen before (last 20), skills
  improved this week, blind spots erased, comebacks against misses, and your best timed Gauntlet
  sections, plus a log of recent milestones. The score is always labeled a game estimate; 1520 is
  the game's target (the top tier is Summit), not a "perfect" score.
- **Seasons.** Set a test date and target under Progress. The climb becomes a season with a countdown,
  a weekly target based on the gap, and a test-day projection from your trend since placement.
  When the date passes, the season closes, your real score (if you enter it) becomes the baseline
  marker, and a new season starts. Evolutions, relics, and levels carry over.
- **This week.** Each week has a twist (Double Down, Speed Week, Streak Week, Hard Mode, or
  Review Week) and a featured domain whose boss pays a better chest once.
- **Mastery.** Past the five nodes, each skill has Bronze, Silver, and Gold mastery, earned on hard
  questions: 4 right, then 10 right with 70% of the last 10, then 12 right at pace with 80%. Each
  tier is +1% sparks forever and a chest. A hard drill serves only hard questions in one skill.
- **Mistake journal.** After a miss, tap why: misread, didn't know it, fell for a trap, rushed, or
  guessed. Progress shows the week's pattern and what to do about it.
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
with grid-ins. Progress shows how many unseen Reading and Writing questions are left in each domain.

## Development

The page stays a single hand-edited file. The DOM-free engine (everything above the
`/* ===== UI ===== */` marker) loads in Node for testing.

```sh
node tools/sim.cjs --days 21 --per-day 60   # balance sim: a modeled student plays the real engine
node tools/guide.cjs                        # engine checks for Today's Adventure (plan, resume, claim
                                            # once), comebacks (paid once), the Harbor Bridge (retroactive,
                                            # paid once), the three boss encounters, learning evidence,
                                            # the intro's free upgrade, and the v8 → v10 migration
node tools/town.cjs                         # engine checks for proficiency (sparse, strong, inconsistent,
                                            # struggling, and easy-repeat histories; hysteresis), tool
                                            # offers (revealed once, price fixed, bought once), the Town
                                            # Square (evidence kept, paid once, +15%, survives Advance),
                                            # rounds, and the v9 → v10 migration with bad-value repair

export NODE_PATH=$(npm root -g)             # tools below use Playwright + Chromium
node tools/smoke.cjs                        # boot, answer questions, fail on page errors
node tools/flows.cjs                        # functional checks: buying, bosses, sets, gauntlet, Ascend,
                                            # daily review, mistake tags, seasons, bulk import, unlocks,
                                            # all four Arcade games, Call it, cards, surge orbs, tools,
                                            # founding and building a city, blimps, policies, stages,
                                            # Advance, exploring, crew, the wheel, stakes, Guardians, tours,
                                            # zones (trees, expansions, forging, launches, the vault), the
                                            # Level Road, talents, titles, the 3D city, the intro and its
                                            # replay, what's new, Today's Adventure (resume after reload,
                                            # claim once), comebacks, the three boss encounters, restoring
                                            # the Harbor Bridge, crossing it in 3D, learning evidence, the
                                            # top bar fitting at 1280 to 1920 wide, the title card and the
                                            # recovery screen, building pages and rounds (resume after a
                                            # reload), tool offers, the Town Square in 2D and 3D, back
                                            # paths, and the late dev save
node tools/flows.cjs city                   # only the checks whose name contains "city"
node tools/flows.cjs touch                  # phones and tablets, driven by real touch events
node tools/shots.cjs out/                   # screenshots of the main screens from simulated saves
node tools/pc.cjs                           # the PC edition: dist/To-1520/ (game file, launcher, readme)
                                            # and a .zip; Three.js and the fonts are built in
GAME=dist/To-1520/to-1520.html node tools/flows.cjs   # run any check against the PC edition
node tools/devsave.cjs                      # a maxed-out save to explore (dist/dev-save.txt): paste it
                                            # into Settings → Backup code → Restore
```

When the page is opened from a local file, it exposes `window.__g1520` so the Playwright checks can
read the current question, drive the Arcade, spawn a golden blimp, and move around the 3D city.
Published pages don't have it.

The 3D city loads Three.js r160 from cdn.jsdelivr.net only when it's opened. The checks block the
network, so `tools/three.cjs` serves a local copy at the same URL. It fetches one with
`npm pack three@0.160.0` into `tools/vendor/` (not committed) the first time it's needed.

The balance sim plays the zones: it expands a zone as soon as learning allows, buys the cheapest
tree node while it costs under a quarter of its sparks, launches fuel at ×4, empties the vault when
it's nearly full, and spends talent points on keystones first. It also plays the city: it founds one at stage 2, buys the best building, upgrade, or
wonder by gain per coin, and catches 40% of blimps. It also clears stages, Advances as soon as it
can, and runs the Expedition: it explores toward the Guardians, fights them with its practice
focus on their domain, hires and levels a crew, places miners on deposits and the rest side by
side, takes the free spin, and descends.

Saves are versioned (`S.v`). Version 2 saves (from before the engine) migrate automatically, keep
their ratings, skip placement, and catch up on the evolutions their history earned. Version 3 saves
gain the season, review, league, and journal fields. Saves from before version 5 see the
What's New tour once, and saves from before version 6 see the city tour once. Version 7 saves
start at stage 1.1 and clear every stage their progress already meets, paying the chests. Version 8
saves get the zones at tier 1, their level's talent points, and every Level Road reward up to
their level to claim, and they see the zones tour once. Version 9 adds the adventure, learning
evidence, comebacks, and landmarks without touching ratings, skills, or blind spots: existing
players skip the intro and see the short what's-new list once, their last Gauntlet seeds the timed
results, and their Transitions history can already have earned the Harbor Bridge. Version 10 ("To 1520")
keeps the same save key and backup-code prefix, so the rename loses nothing. It adds a proficiency
window to each skill, seeded from the kept results as repeats; tools, offers, intro flags, and the
round; founds the town for any save that had not (the Town Hall is open from stage 0); marks the
town intros as seen for existing players; and repairs impossible tool levels or offers. A stored save
that cannot be read is never replaced: the title card becomes a recovery screen instead.
