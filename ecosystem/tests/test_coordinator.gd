extends TestCase
## The rule-based coordinator and the demo templates.

const EXAMPLE := "Prototype a Roblox obstacle game and plan three TikToks about building it."


func _workspace() -> Workspace:
	var ws := Workspace.new()
	ws.clock = fixed_clock()
	return ws


func test_example_goal_makes_a_linked_plan() -> void:
	var ws := _workspace()
	var r := Coordinator.plan(ws, EXAMPLE)
	check(r.ok, "the example goal gets a plan")
	var tasks := ws.tasks_for_plan(r.plan_id)
	check_eq(tasks.size(), 8, "4 Roblox tasks + series + 3 scripts")
	var owners := {}
	for t in tasks:
		owners[t.owner] = owners.get(t.owner, 0) + 1
		check_eq(t.status, Task.PROPOSED, "nothing runs before approval")
	check_eq(owners.get("roblox_builder", 0), 4, "Roblox Builder gets 4 tasks")
	check_eq(owners.get("producer", 0), 4, "Producer gets the series + 3 scripts")
	var series: Task = tasks.filter(func(t): return t.kind == "tiktok_series")[0]
	var concept: Task = tasks.filter(func(t): return t.kind == "roblox_concept")[0]
	check(concept.id in series.depends_on, "the TikTok series waits for the game concept")
	check(ws.plans[r.plan_id].notes.any(func(n): return "Demo mode" in n), "the plan says it's demo mode")


func test_video_count_and_game_type() -> void:
	var info := Coordinator.analyze("make 2 tiktok videos about my roblox tycoon")
	check_eq(info.video_count, 2, "\"2 ... videos\" is found")
	check_eq(info.game_type, "tycoon", "game type is found")
	check_eq(Coordinator.analyze("one tiktok").video_count, 1, "number words work")


func test_playtest_is_not_school() -> void:
	var info := Coordinator.analyze("test the roblox game with friends")
	check_eq(info.areas, ["roblox"], "\"test the game\" stays in Roblox Lab")
	check("student" in Coordinator.analyze("study for my AP bio test").areas, "school goals go to Student Hub")


func test_unclear_goal_asks_a_question() -> void:
	var ws := _workspace()
	var r := Coordinator.plan(ws, "make my week better")
	check(not r.ok and r.question != "", "asks which area when nothing matches")
	check(ws.tasks.is_empty(), "no tasks were created")
	var forced := Coordinator.plan(ws, "make my week better", "student")
	check(forced.ok, "picking an area makes it work")


func test_bad_deadline_is_refused() -> void:
	var ws := _workspace()
	check(not Coordinator.plan(ws, EXAMPLE, "", "next friday").ok, "a non-date deadline is refused")
	check(not Coordinator.plan(ws, EXAMPLE, "", "2026-02-30").ok, "an impossible date is refused")
	var r := Coordinator.plan(ws, EXAMPLE, "", "2026-10-05")
	check(r.ok, "a real date works")
	check_eq(ws.tasks_for_plan(r.plan_id)[0].due, "2026-10-05", "tasks get the deadline")


func test_plan_never_exceeds_limit() -> void:
	var ws := _workspace()
	var r := Coordinator.plan(ws, "roblox obby, five tiktoks, a business launch, and study for my exam")
	check(r.ok, "big goal still plans")
	check(ws.tasks_for_plan(r.plan_id).size() <= Coordinator.MAX_TASKS, "stays within the task limit")


func test_every_template_is_labeled() -> void:
	var kinds := ["roblox_concept", "roblox_milestones", "roblox_luau", "roblox_review",
		"tiktok_series", "tiktok_script", "business_idea", "business_experiment",
		"study_breakdown", "study_plan", "study_practice", "something_new"]
	for kind in kinds:
		var out := DemoTemplates.render({"goal": EXAMPLE, "project": {"name": "Obby"},
			"task": {"title": "Script TikTok #2", "kind": kind}, "inputs": []})
		check(out.body.length() > 80, kind + " has real content")
		check("DEMO TEMPLATE" in out.body.to_upper(), kind + " says it's a demo template")
		check("{{" not in out.body, kind + " has no unfilled placeholders")


func test_luau_template_is_marked_untested() -> void:
	var out := DemoTemplates.render({"goal": EXAMPLE, "task": {"title": "Luau", "kind": "roblox_luau"}})
	check_eq(out.kind, "luau", "Luau deliverables have kind luau")
	check("NOT TESTED IN ROBLOX STUDIO" in out.body, "Luau says it's untested")
	check("Checkpoints" in out.body, "obby goals get the checkpoint script")


func test_tiktok_never_claims_trend_research() -> void:
	var out := DemoTemplates.render({"goal": EXAMPLE, "task": {"title": "Series", "kind": "tiktok_series"}})
	check("No trend research was done" in out.body, "the series note is honest about trends")
