class_name Coordinator
extends RefCounted
## Turns a goal into a proposed plan with rules, not AI (Decisions D6):
## 1. Match words in the goal to areas ("obby" -> Roblox Lab, "tiktoks" -> TikTok Studio).
## 2. Pick each area's task template, and use numbers in the goal ("three TikToks").
## 3. Link tasks across areas with dependencies (the TikTok series uses the game concept).
## Nothing runs until I approve the plan.

const MAX_TASKS := 8

const KEYWORDS := {
	"roblox": ["roblox", "obby", "obstacle", "luau", "studio", "playtest", "datastore",
		"gameplay", "game", "tycoon", "simulator", "rojo"],
	"tiktok": ["tiktok", "tiktoks", "video", "videos", "content", "hook", "hooks", "caption",
		"captions", "reel", "reels", "devlog", "series", "post", "posts", "creator"],
	"business": ["business", "customer", "customers", "price", "pricing", "sell", "selling",
		"offer", "launch", "validate", "validation", "startup", "revenue", "budget", "market",
		"product"],
	"student": ["study", "test", "exam", "exams", "homework", "assignment", "essay", "class",
		"quiz", "notes", "chapter", "school", "midterm", "final", "finals", "ap", "sat", "psat",
		"lesson", "learn"],
}
## Order used when several areas match, so the plan reads naturally.
const AREA_ORDER := ["student", "roblox", "business", "tiktok"]
const NUMBER_WORDS := {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
	"a": 1, "an": 1, "single": 1, "couple": 2, "few": 3}
const GAME_TYPES := {"obby": "obby", "obstacle": "obby", "tycoon": "tycoon",
	"simulator": "simulator", "horror": "horror game", "rpg": "RPG", "racing": "racing game",
	"tower": "tower defense game", "fighting": "fighting game"}


## What the coordinator understood from the goal. Used by plan() and shown to me.
static func analyze(goal: String, forced_area := "") -> Dictionary:
	var words := _words(goal)
	var matches := {}
	for area in KEYWORDS:
		var hits: Array = []
		for w in words:
			if w in KEYWORDS[area] and w not in hits:
				hits.append(w)
		if not hits.is_empty():
			matches[area] = hits
	# "test the game" or "learn Luau" is Roblox work, not school.
	if matches.has("roblox") and matches.has("student"):
		if matches.student.all(func(w): return w in ["test", "learn"]):
			matches.erase("student")
	var areas: Array = []
	if forced_area != "":
		areas = [forced_area]
	else:
		for area in AREA_ORDER:
			if matches.has(area):
				areas.append(area)
	var game_type := "game"
	for w in words:
		if GAME_TYPES.has(w):
			game_type = GAME_TYPES[w]
			break
	return {"areas": areas, "matches": matches, "video_count": _count_before(words,
		["tiktoks", "tiktok", "videos", "video", "posts", "reels"], 3), "game_type": game_type}


## Creates a project and a *proposed* plan in the workspace.
## Returns {ok: true, plan_id} or {ok: false, question} when it needs my help.
static func plan(ws: Workspace, goal: String, forced_area := "", deadline := "") -> Dictionary:
	goal = goal.strip_edges()
	if goal.length() < 4:
		return {"ok": false, "question": "Type a goal first, for example: \"Prototype a Roblox obby and plan three TikToks about it.\""}
	if deadline != "" and not _is_date(deadline):
		return {"ok": false, "question": "Write the deadline as YYYY-MM-DD, for example 2026-10-05."}
	var info := analyze(goal, forced_area)
	if info.areas.is_empty():
		return {"ok": false, "question": "I couldn't tell which area this is for. Pick one in the Area menu and plan again."}

	var specs: Array = []
	for area in info.areas:
		specs.append_array(_template(area, info))
	# Keep the plan small. Drop extra videos first, then anything past the limit.
	while specs.size() > MAX_TASKS and _drop_one_video(specs):
		pass
	var notes: Array = []
	if specs.size() > MAX_TASKS:
		notes.append("Trimmed to %d tasks to keep it manageable. Plan the rest after these." % MAX_TASKS)
		specs = specs.slice(0, MAX_TASKS)

	var primary: String = info.areas[0]
	var project_id := ws.add_project(_project_name(goal), primary, goal)
	var id_for_key := {}
	var task_ids: Array = []
	var total_min := 0
	for spec in specs:
		var t := Task.new()
		t.title = spec.title
		t.goal = spec.goal
		t.kind = spec.kind
		t.area = spec.area
		t.owner = AgentDefs.owner_for_area(spec.area)
		t.priority = spec.priority
		t.estimate_min = spec.estimate_min
		t.project_id = project_id
		t.due = deadline
		# Only link to tasks that made it into this plan.
		for key in spec.deps:
			if id_for_key.has(key):
				t.depends_on.append(id_for_key[key])
		ws.add_task(t)
		id_for_key[spec.key] = t.id
		task_ids.append(t.id)
		total_min += t.estimate_min

	var area_names: Array = info.areas.map(func(a): return AgentDefs.area_name(a))
	var found: Array = []
	for area in info.matches:
		found.append_array(info.matches[area])
	if forced_area != "":
		notes.push_front("Area chosen by you: %s." % area_names[0])
	else:
		notes.push_front("Areas: %s (matched: %s)." % [", ".join(area_names), ", ".join(found)])
	if info.areas.has("tiktok"):
		notes.append("Planned %d TikTok script(s)." % _count_videos(specs))
	if info.areas.has("roblox") and info.areas.size() > 1:
		notes.append("Other areas wait for the Roblox concept, so everything describes the same game.")
	notes.append("Total estimate: %s." % _duration(total_min))
	if deadline == "":
		notes.append("No deadline given. Add one so the schedule can plan around it.")
	notes.append("Demo mode: specialists fill in templates. No AI is called and nothing costs money.")
	var plan_id := ws.add_plan(goal, project_id, task_ids, notes)
	ws.log_activity("coordinator", "", "plan_proposed", "Proposed %d tasks for \"%s\"" % [task_ids.size(), goal])
	return {"ok": true, "plan_id": plan_id}


## Approves a proposed plan. Tasks in `skip_ids` (unchecked in the review) are removed.
## Returns how many tasks were queued.
static func approve(ws: Workspace, plan_id: String, skip_ids := []) -> int:
	var plan: Dictionary = ws.plans.get(plan_id, {})
	if plan.get("status", "") != "proposed":
		return 0
	for id in skip_ids:
		ws.remove_task(id)
	var queued := 0
	for t in ws.tasks_for_plan(plan_id):
		if ws.set_task_status(t.id, Task.QUEUED, "plan approved"):
			queued += 1
			ws.log_activity(t.owner, t.id, "assigned", "%s picked up \"%s\"" % [
				AgentDefs.find(t.owner).get("name", t.owner), t.title])
	ws.set_plan_status(plan_id, "approved")
	ws.log_activity("coordinator", "", "plan_approved", "You approved %d tasks" % queued)
	return queued


## Throws away a plan I didn't approve. Nothing had run, so nothing is lost.
static func discard(ws: Workspace, plan_id: String) -> void:
	var plan: Dictionary = ws.plans.get(plan_id, {})
	if plan.get("status", "") != "proposed":
		return
	for id in plan.task_ids.duplicate():
		ws.remove_task(id)
	ws.set_plan_status(plan_id, "discarded")
	var project_id: String = plan.project_id
	if ws.tasks.values().all(func(t): return t.project_id != project_id):
		ws.projects.erase(project_id)
		ws.changed.emit("project", project_id)
	ws.log_activity("coordinator", "", "plan_discarded", "You discarded the plan for \"%s\"" % plan.goal)


## Task templates for each area. `deps` use keys from the same plan.
static func _template(area: String, info: Dictionary) -> Array:
	var game: String = info.game_type
	var has_roblox: bool = info.areas.has("roblox")
	match area:
		"roblox":
			var mechanic := "checkpoints and kill bricks" if game == "obby" else "the core mechanic"
			return [
				_spec("r_concept", "roblox", "roblox_concept", "Write the %s concept and core loop" % game,
					"Know exactly what players do every 30 seconds, 5 minutes, and session.", "high", 45, []),
				_spec("r_milestones", "roblox", "roblox_milestones", "Plan prototype milestones and the first playtest",
					"Small steps, each with a clear \"playable when\" check.", "medium", 30, ["r_concept"]),
				_spec("r_luau", "roblox", "roblox_luau", "Draft Luau for %s" % mechanic,
					"A first script to paste into Studio (or sync with Rojo) and test.", "high", 60, ["r_concept"]),
				_spec("r_review", "roblox", "roblox_review", "Review the Luau: server/client, exploits, saving",
					"Catch cheating and data-loss risks before playtesters find them.", "medium", 30, ["r_luau"]),
			]
		"tiktok":
			var out: Array = [_spec("t_series", "tiktok", "tiktok_series",
				"Pick the series angle and posting schedule",
				"A series people can follow, posted at a pace that fits school.", "medium", 20,
				["r_concept"] if has_roblox else [])]
			for i in range(info.video_count):
				out.append(_spec("t_script_%d" % (i + 1), "tiktok", "tiktok_script",
					"Script TikTok #%d: hook, shots, caption" % (i + 1),
					"Ready to film: hook, beats, shot list, caption, and editing notes.", "medium", 30,
					["t_series"]))
			return out
		"business":
			return [
				_spec("b_idea", "business", "business_idea", "Write the idea card: problem, customer, assumptions",
					"Separate what's verified from what's assumed.", "high", 30, ["r_concept"] if has_roblox else []),
				_spec("b_experiment", "business", "business_experiment", "Design one cheap validation experiment",
					"Learn if anyone wants this before spending money.", "medium", 30, ["b_idea"]),
			]
		"student":
			return [
				_spec("s_breakdown", "student", "study_breakdown", "Break the assignment into steps",
					"Small steps that each take one sitting.", "high", 20, []),
				_spec("s_plan", "student", "study_plan", "Plan study sessions before the deadline",
					"Short sessions spread out, not one cram night.", "high", 15, ["s_breakdown"]),
				_spec("s_practice", "student", "study_practice", "Make practice questions",
					"Test yourself so you know what needs more practice.", "medium", 30, ["s_breakdown"]),
			]
	return []


static func _spec(key: String, area: String, kind: String, title: String, goal: String,
		priority: String, estimate_min: int, deps: Array) -> Dictionary:
	return {"key": key, "area": area, "kind": kind, "title": title, "goal": goal,
		"priority": priority, "estimate_min": estimate_min, "deps": deps}


static func _words(text: String) -> Array:
	var cleaned := ""
	for ch in text.to_lower():
		cleaned += ch if (ch >= "a" and ch <= "z") or (ch >= "0" and ch <= "9") else " "
	return Array(cleaned.split(" ", false))


## Finds a count like "three TikToks" or "3 videos". Capped at 5.
static func _count_before(words: Array, nouns: Array, fallback: int) -> int:
	for i in range(1, words.size()):
		if words[i] in nouns:
			var w: String = words[i - 1]
			if w.is_valid_int():
				return clampi(int(w), 1, 5)
			if NUMBER_WORDS.has(w):
				return NUMBER_WORDS[w]
	return fallback


static func _drop_one_video(specs: Array) -> bool:
	if _count_videos(specs) <= 1:
		return false
	for i in range(specs.size() - 1, -1, -1):
		if specs[i].kind == "tiktok_script":
			specs.remove_at(i)
			return true
	return false


static func _count_videos(specs: Array) -> int:
	return specs.filter(func(s): return s.kind == "tiktok_script").size()


static func _project_name(goal: String) -> String:
	var words := goal.split(" ", false)
	var name := " ".join(words.slice(0, 6))
	if words.size() > 6:
		name += "…"
	return name.left(1).to_upper() + name.substr(1)


static func _duration(minutes: int) -> String:
	if minutes < 60:
		return "%d min" % minutes
	return "%dh %02dm" % [minutes / 60, minutes % 60]


static func _is_date(s: String) -> bool:
	var parts := s.split("-")
	if s.length() != 10 or parts.size() != 3 or not (parts[0] + parts[1] + parts[2]).is_valid_int():
		return false
	var y := int(parts[0])
	var m := int(parts[1])
	var d := int(parts[2])
	if m < 1 or m > 12 or d < 1:
		return false
	var days := [31, 29 if (y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)) else 28,
		31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
	return d <= days[m - 1]
