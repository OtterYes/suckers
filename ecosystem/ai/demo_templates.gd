class_name DemoTemplates
extends RefCounted
## Demo-mode deliverables. They are filled in from rules and templates, never by AI,
## and every one says so at the top. They're meant to be useful starting points
## that I edit, not finished work.
##
## `ctx` is the context the Runner builds for a task (see Runner.build_context):
##   {goal, project: {name, area}, task: {title, kind, ...}, inputs: [{title, owner, body}], memory: [...]}

const DEMO_NOTE := "> **Demo template:** filled in from rules, not written by AI. Edit it to make it yours."
const LUAU_NOTE := "-- DEMO TEMPLATE: filled in from rules, not written by AI.\n-- NOT TESTED IN ROBLOX STUDIO. Run it in Studio before trusting it."


## Returns {title, kind, body} for a task kind.
static func render(ctx: Dictionary) -> Dictionary:
	var task: Dictionary = ctx.task
	var info := Coordinator.analyze(str(ctx.get("goal", "")))
	var vars := {
		"goal": str(ctx.get("goal", "")),
		"project": str(ctx.get("project", {}).get("name", "this project")),
		"game": info.game_type,
		"inputs": _input_list(ctx),
	}
	match str(task.kind):
		"roblox_concept":
			return _out(task, "doc", _fill(ROBLOX_CONCEPT, vars))
		"roblox_milestones":
			return _out(task, "doc", _fill(ROBLOX_MILESTONES, vars))
		"roblox_luau":
			var code := ROBLOX_LUAU_OBBY if info.game_type == "obby" else ROBLOX_LUAU_COLLECT
			return _out(task, "luau", LUAU_NOTE + "\n" + _fill(code, vars))
		"roblox_review":
			return _out(task, "checklist", _fill(ROBLOX_REVIEW, vars))
		"tiktok_series":
			return _out(task, "doc", _fill(TIKTOK_SERIES, vars))
		"tiktok_script":
			vars["n"] = str(_number_in(str(task.title)))
			vars["angle"] = SCRIPT_ANGLES[(_number_in(str(task.title)) - 1) % SCRIPT_ANGLES.size()]
			return _out(task, "script", _fill(TIKTOK_SCRIPT, vars))
		"business_idea":
			return _out(task, "doc", _fill(BUSINESS_IDEA, vars))
		"business_experiment":
			return _out(task, "doc", _fill(BUSINESS_EXPERIMENT, vars))
		"study_breakdown":
			return _out(task, "checklist", _fill(STUDY_BREAKDOWN, vars))
		"study_plan":
			return _out(task, "doc", _fill(STUDY_PLAN, vars))
		"study_practice":
			return _out(task, "doc", _fill(STUDY_PRACTICE, vars))
	return _out(task, "doc", _fill(GENERIC, vars))


static func _out(task: Dictionary, kind: String, body: String) -> Dictionary:
	if kind != "luau":
		body = "# %s\n\n%s\n\n%s" % [task.title, DEMO_NOTE, body]
	return {"title": str(task.title), "kind": kind, "body": body.strip_edges() + "\n"}


static func _fill(text: String, vars: Dictionary) -> String:
	for key in vars:
		text = text.replace("{{%s}}" % key, str(vars[key]))
	return text


## Lists the results this task was given from earlier tasks, so I can see what it used.
static func _input_list(ctx: Dictionary) -> String:
	var inputs: Array = ctx.get("inputs", [])
	if inputs.is_empty():
		return "_No earlier results were used._"
	var lines: Array = []
	for i in inputs:
		lines.append("- **%s** (from %s)" % [i.title, AgentDefs.find(i.owner).get("name", i.owner)])
	return "\n".join(lines)


static func _number_in(title: String) -> int:
	var at := title.find("#")
	if at == -1:
		return 1
	var digits := ""
	for ch in title.substr(at + 1):
		if not ch.is_valid_int():
			break
		digits += ch
	return maxi(1, int(digits)) if digits != "" else 1


const SCRIPT_ANGLES := [
	"Day 1: I'm building a {{game}} from scratch",
	"The first bug that broke everything (and the fix)",
	"Watching my friends play it for the first time",
	"What I'd change after the first playtest",
	"Numbers from the first week (only if you have real ones)",
]

const ROBLOX_CONCEPT := """
**Goal:** {{goal}}

## One-sentence pitch
A short, replayable **{{game}}** where _[who: e.g. friends aged 10–16 who like quick challenges]_ can _[what makes it fun in one phrase]_.
Fill in the brackets. If it takes more than one sentence, the idea isn't clear yet.

## Core loop
| Time scale | What the player does | What keeps them going |
|---|---|---|
| Every 30 seconds | Attempt the next section, fail, retry instantly | Short sections, instant respawn at the checkpoint |
| Every 5 minutes | Reach a new stage or zone | A visible "Stage 7 of 20" counter, a new look for each zone |
| Every session | Beat a personal best or finish a zone | Timer, stage reached, something to show friends |

## What makes it different (pick one, not all)
- A theme nobody expects (e.g. a school-themed obby, a kitchen obby)
- One signature mechanic (e.g. gravity flips, conveyor belts, a rising lava timer)
- Built for friends: a race mode, or helping each other

## Scope for the prototype
- **In:** 10 short stages, checkpoints, kill bricks, a stage counter
- **Out for now:** shop, pets, daily rewards, leaderboards, saving between sessions

## Questions to answer before building
1. Who is the player, and what are they doing right before they open this game?
2. What's the one mechanic you want people to remember?
3. How will you know the prototype is fun? (See the playtest plan.)
"""

const ROBLOX_MILESTONES := """
Built from:
{{inputs}}

Each milestone ends with a check you can actually do in Studio.

| # | Milestone | Playable when… | Estimate |
|---|---|---|---|
| 1 | Graybox 10 stages | You can walk from start to finish using plain parts | 2 sessions |
| 2 | Checkpoints + kill bricks | Falling or touching red parts sends you back to your last checkpoint | 1 session |
| 3 | Stage counter UI | The screen always shows your current stage | 1 session |
| 4 | Theme pass | Each group of stages has its own color and look | 1–2 sessions |
| 5 | First playtest | 3 people play for 10 minutes while you watch silently | 1 session |

## Playtest plan (milestone 5)
- **Who:** 3 people who haven't seen it. Friends are fine; just don't coach them.
- **Watch for:** where they die the most, where they stop smiling, and whether they understand checkpoints without being told
- **Ask afterward:**
  1. What was the most fun part?
  2. Where did you want to quit?
  3. Would you play again tomorrow? Why or why not?
- **Success signal:** at least 2 of 3 reach stage 5 and say they'd play again
- **Write down:** every bug, with the stage number and what they were doing

## After the playtest
Turn the notes into tasks: bugs first, then the #1 "wanted to quit" spot, then new content.
"""

const ROBLOX_LUAU_OBBY := """-- Obby starter: checkpoints and kill bricks.
--
-- HOW TO SET UP (in Roblox Studio)
--   1. In Workspace, make a Folder named "Checkpoints". Put your checkpoint parts
--      inside and name them 1, 2, 3... in the order players reach them.
--   2. Give every kill brick the tag "KillBrick" (select the part > Properties > Tags).
--   3. Put File 1 in ServerScriptService and File 2 in StarterPlayer > StarterPlayerScripts.
--      With Rojo: save them at the paths shown in the File headers.
--
-- WHY IT'S SPLIT THIS WAY
--   The server decides which checkpoint you reached. The client only shows it.
--   Exploiters can change anything on their own client, so progress must live on the server.

-- ===== File 1: src/server/ObbyServer.server.luau (a Script) =====
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")

local checkpoints = workspace:WaitForChild("Checkpoints")

-- Highest checkpoint number each player has reached (0 = start).
local reached: { [Player]: number } = {}

-- Finds the character model and humanoid that a touching part belongs to.
local function characterFromPart(part: BasePart): (Model?, Humanoid?)
	local model = part:FindFirstAncestorOfClass("Model")
	if not model then
		return nil, nil
	end
	return model, model:FindFirstChildOfClass("Humanoid")
end

local function onCheckpointTouched(number: number, hit: BasePart)
	local character, humanoid = characterFromPart(hit)
	if not character or not humanoid or humanoid.Health <= 0 then
		return
	end
	local player = Players:GetPlayerFromCharacter(character)
	if not player then
		return
	end
	-- Only accept the NEXT checkpoint. This stops "teleport to the last checkpoint" cheats.
	if number == (reached[player] or 0) + 1 then
		reached[player] = number
		player:SetAttribute("Checkpoint", number) -- the client reads this to show the stage
	end
end

for _, child in checkpoints:GetChildren() do
	local number = tonumber(child.Name)
	if child:IsA("BasePart") and number then
		child.Touched:Connect(function(hit)
			onCheckpointTouched(number, hit)
		end)
	else
		warn("Checkpoints should be parts named with numbers. Skipping:", child:GetFullName())
	end
end

local function makeDeadly(part: Instance)
	if not part:IsA("BasePart") then
		return
	end
	part.Touched:Connect(function(hit)
		local _, humanoid = characterFromPart(hit)
		if humanoid and humanoid.Health > 0 then
			humanoid.Health = 0
		end
	end)
end

for _, part in CollectionService:GetTagged("KillBrick") do
	makeDeadly(part)
end
CollectionService:GetInstanceAddedSignal("KillBrick"):Connect(makeDeadly)

-- Respawn players at their last checkpoint.
local function onCharacterAdded(player: Player, character: Model)
	local number = reached[player] or 0
	local spot = checkpoints:FindFirstChild(tostring(number))
	if number > 0 and spot and spot:IsA("BasePart") then
		-- Wait a moment so the default spawn doesn't overwrite our position.
		task.defer(function()
			character:PivotTo(spot.CFrame + Vector3.new(0, 3, 0))
		end)
	end
end

local function onPlayerAdded(player: Player)
	reached[player] = 0
	player:SetAttribute("Checkpoint", 0)
	player.CharacterAdded:Connect(function(character)
		onCharacterAdded(player, character)
	end)
	if player.Character then
		onCharacterAdded(player, player.Character)
	end
end

Players.PlayerAdded:Connect(onPlayerAdded)
for _, player in Players:GetPlayers() do -- players who joined before this script ran
	onPlayerAdded(player)
end
Players.PlayerRemoving:Connect(function(player)
	reached[player] = nil -- saving between sessions comes later (see the review task)
end)

-- ===== File 2: src/client/StageLabel.client.luau (a LocalScript) =====
-- Shows "Stage N" at the top of the screen. It only READS the server's value,
-- so editing this script can't cheat progress.
local Players = game:GetService("Players")
local player = Players.LocalPlayer

local gui = Instance.new("ScreenGui")
gui.Name = "StageGui"
gui.ResetOnSpawn = false

local label = Instance.new("TextLabel")
label.Size = UDim2.fromOffset(220, 40)
label.Position = UDim2.new(0.5, -110, 0, 12)
label.BackgroundTransparency = 0.3
label.TextScaled = true
label.Font = Enum.Font.GothamBold
label.Parent = gui
gui.Parent = player:WaitForChild("PlayerGui")

local function refresh()
	local n = player:GetAttribute("Checkpoint") or 0
	label.Text = if n == 0 then "Start" else "Stage " .. tostring(n)
end

player:GetAttributeChangedSignal("Checkpoint"):Connect(refresh)
refresh()
"""

const ROBLOX_LUAU_COLLECT := """-- Starter mechanic for a {{game}}: touch-to-collect points, owned by the server.
--
-- HOW TO SET UP (in Roblox Studio)
--   1. Make some parts and give them the tag "Collectible" (Properties > Tags).
--   2. Put this Script in ServerScriptService. With Rojo: src/server/Collect.server.luau
--
-- WHY IT'S ON THE SERVER
--   Points are only ever changed here. A client can ask for nothing and change nothing,
--   so exploiters can't give themselves points.

-- ===== File: src/server/Collect.server.luau (a Script) =====
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")

local RESPAWN_SECONDS = 5
local POINTS_PER_PICKUP = 1

-- The leaderboard in the top-right corner of the screen.
local function onPlayerAdded(player: Player)
	local stats = Instance.new("Folder")
	stats.Name = "leaderstats"
	local points = Instance.new("IntValue")
	points.Name = "Points"
	points.Parent = stats
	stats.Parent = player
end
Players.PlayerAdded:Connect(onPlayerAdded)
for _, player in Players:GetPlayers() do
	onPlayerAdded(player)
end

local function setup(part: Instance)
	if not part:IsA("BasePart") then
		return
	end
	local ready = true -- stops one touch from counting many times
	part.Touched:Connect(function(hit)
		if not ready then
			return
		end
		local character = hit:FindFirstAncestorOfClass("Model")
		local player = character and Players:GetPlayerFromCharacter(character)
		local stats = player and player:FindFirstChild("leaderstats")
		if not stats then
			return
		end
		ready = false
		stats.Points.Value += POINTS_PER_PICKUP
		part.Transparency = 1
		part.CanTouch = false
		task.delay(RESPAWN_SECONDS, function()
			part.Transparency = 0
			part.CanTouch = true
			ready = true
		end)
	end)
end

for _, part in CollectionService:GetTagged("Collectible") do
	setup(part)
end
CollectionService:GetInstanceAddedSignal("Collectible"):Connect(setup)
"""

const ROBLOX_REVIEW := """
Reviewed:
{{inputs}}

This is a checklist, not proof. Nothing here has been run in Roblox Studio.

## Server vs. client
- [ ] Progress (checkpoints, points) is only changed in server Scripts
- [ ] LocalScripts only *show* things (UI, effects) and never decide progress
- [ ] If you add RemoteEvents later, the server checks every request (is it possible? is it too fast? is it too far away?)

## Exploit risks
- [ ] **Skipping checkpoints:** the server only accepts the *next* checkpoint ✔ (already in the draft)
- [ ] **Speed and fly hacks:** later, check on the server how fast players move between checkpoints and ignore impossible times
- [ ] **Touched spam:** kill bricks are safe to trigger repeatedly. Anything that gives rewards needs a cooldown.
- [ ] Never trust values the client sends (names, amounts, positions)

## Performance
- [ ] Fine for tens of kill bricks. For hundreds, use tags (already done) and avoid a script inside every part.
- [ ] Anchor every obby part (unanchored parts cost physics time and can fall)
- [ ] Consider StreamingEnabled for big maps, but test that checkpoints still load

## Saving progress (not built yet, and that's fine for the prototype)
When you add it:
- [ ] Use DataStoreService with `UpdateAsync`, wrapped in `pcall`, with a few retries
- [ ] Save when the player leaves **and** in `game:BindToClose` (servers can shut down)
- [ ] Save a table like `{ checkpoint = 7, version = 1 }` so you can change the format later
- [ ] Test in Studio with "Enable Studio Access to API Services" turned on

## Test in Studio (then mark the Luau as tested)
1. Play solo: touch checkpoint 1, then 2. Reset (Esc > Reset). Do you respawn at 2?
2. Touch checkpoint 3 **before** 2. It should NOT count.
3. Touch a kill brick. Do you respawn at your checkpoint?
4. Test with 2 players (Test tab > Clients and Servers). Is each player's stage separate?
"""

const TIKTOK_SERIES := """
Built from:
{{inputs}}

## Series angle
**"Building my first {{game}} in public."** A dev-log series where each video shows one real step: a win, a bug, or a playtest.
Why this works for you: it's content you're already creating by building, so it costs no extra production time.

## Content pillars
1. **Build progress:** before/after clips of real Studio work
2. **Bugs and fixes:** a funny or frustrating problem, then the fix
3. **Player reactions:** real playtest moments (ask people before filming them)

## Posting schedule (fits around school)
| Day | What | Time needed |
|---|---|---|
| Tuesday | Film clips during your normal build session | +10 min |
| Wednesday evening | Edit and post video 1 | 30 min |
| Saturday | Edit and post video 2 | 30 min |
| Next Wednesday | Edit and post video 3 | 30 min |

## What I don't know
- **No trend research was done.** Demo mode has no web access, so nothing here is based on current trends.
- Once you've posted, paste your real numbers (views, watch time, follows) to get suggestions based on data.
"""

const TIKTOK_SCRIPT := """
Built from:
{{inputs}}

**Angle:** {{angle}}
**Length:** 30–45 seconds

## Hook (first 2 seconds, text on screen + voice)
Pick one and test it:
1. "I'm making a Roblox {{game}} and this is day {{n}}."
2. Start on the most chaotic clip, *then* explain.
3. "Nobody told me this about making Roblox games…"

## Script beats
| Time | On screen | Voice-over |
|---|---|---|
| 0–2 s | Your best clip | The hook |
| 2–10 s | Studio screen recording | What you set out to do today |
| 10–25 s | The problem or the build | What went wrong or what you built |
| 25–35 s | The result, playing it | How it turned out |
| 35–40 s | Your face or the game | "Follow to see if it survives the playtest" |

## Shot list
- [ ] Screen recording of Studio (the moment the thing works or breaks)
- [ ] Gameplay clip in play mode (record at least 20 seconds)
- [ ] Optional: a face-cam reaction (5 seconds)

## Caption
Day {{n}} of building my first Roblox {{game}} 🧱 What should I add next? #roblox #robloxdev #gamedev

## Editing notes
- Captions on screen the whole time (many people watch muted)
- Cut every pause longer than half a second
- End on the game, not a black screen, so it loops cleanly

_Hashtags are common general tags, not trend research._
"""

const BUSINESS_IDEA := """
Built from:
{{inputs}}

## Idea card: {{project}}
| | Answer | Verified or assumption? |
|---|---|---|
| **Problem** | _[what's annoying, slow, or missing?]_ | Assumption |
| **Customer** | _[who has this problem, specifically?]_ | Assumption |
| **Why now** | _[what changed that makes this possible?]_ | Assumption |
| **Current fix** | _[what do they do today instead?]_ | Assumption |
| **Your edge** | _[why you?]_ | Assumption |

Everything starts as an **Assumption**. Change a row to **Verified** only when you have a source: a conversation, a sale, or a number.

## Riskiest assumptions (test these first)
1. People have this problem often enough to care
2. They'd pay (or spend time) for a fix
3. You can reach them cheaply
"""

const BUSINESS_EXPERIMENT := """
Built from:
{{inputs}}

## Experiment: the cheapest test of the riskiest assumption
- **Assumption tested:** people want this enough to act
- **Test:** talk to 5 potential customers. Ask about the problem, not your idea: "Tell me about the last time you…"
- **Cost:** $0 · **Time:** 1 week
- **Success signal:** 3 of 5 describe the problem without prompting, **and** 1 asks how to get the solution
- **Failure signal:** people are polite but vague. That means the problem isn't painful enough.

## Record results here
| Person | Had the problem? | Current fix | Would pay/act? | Quote |
|---|---|---|---|---|
| 1 | | | | |

_Needs your approval before spending anything or contacting anyone._
"""

const STUDY_BREAKDOWN := """
**Assignment:** {{goal}}

A template until you add the details: paste the assignment instructions into the task goal for a better breakdown later.

- [ ] Read the instructions twice and highlight exactly what's graded (10 min)
- [ ] List what you already know vs. what you need to learn (10 min)
- [ ] Gather sources and notes (20 min)
- [ ] Draft or do the first half (1 session)
- [ ] Do the second half (1 session)
- [ ] Check against the rubric, then fix (20 min)
- [ ] Final read and submit a day early (10 min)
"""

const STUDY_PLAN := """
Built from:
{{inputs}}

## Study sessions
Short sessions spread over several days beat one long night, because you remember more when you practice recalling it.

| Session | Focus | Length |
|---|---|---|
| 1 | Learn: go through notes, make a list of key ideas | 25 min |
| 2 | Practice: answer questions without looking | 25 min |
| 3 | Fix: re-study only what you got wrong | 25 min |
| 4 (day before) | Quick self-quiz, then rest | 15 min |

The schedule (Milestone 2) will place these sessions around school automatically.
"""

const STUDY_PRACTICE := """
Built from:
{{inputs}}

## Practice question set
A template: replace the brackets with your topic. (With real AI later, questions will be written from your notes.)

1. In your own words, what is _[key idea 1]_?
2. Give an example of _[key idea 2]_ that wasn't in class.
3. What's the difference between _[term A]_ and _[term B]_?
4. Solve or explain: _[a problem like the ones on the test]_
5. What mistake do people usually make with _[topic]_, and how do you avoid it?

## How to use it
Answer without notes first. Then check, and mark each ✅ (knew it) or 🔁 (needs practice).
"""

const GENERIC := """
**Goal:** {{goal}}

No template exists for this kind of task yet. Write your notes here.
"""
