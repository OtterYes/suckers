extends Node
## Test helper, not part of normal use. Drives the real app through a scenario
## using the same App actions the buttons call.
##   Screenshots:  godot --path . -- --save-dir=<empty folder> --shot=<out folder> [--scenario=world]
##   End to end:   godot --headless --path . -- --save-dir=<empty folder> --scenario=e2e
##                 then the same command with --scenario=e2e-reopen (checks the save).
## Exit code 0 means every check passed.

var options := {}


func _ready() -> void:
	_run.call_deferred()


func _run() -> void:
	match options.get("scenario", ""):
		"world":
			await _run_world()
			return
		"e2e":
			await _run_e2e()
			return
		"e2e-reopen":
			_run_e2e_reopen()
			return
	var out: String = options.get("shot", "user://shots")
	DirAccess.make_dir_recursive_absolute(out)
	var tree := get_tree()
	var main: Control = tree.current_scene
	App.provider.delay_sec = float(options.get("delay", "0.6"))
	await _frames(20)
	_save(out, "01_empty.png")
	var goal := "Prototype a Roblox obstacle game and plan three TikToks about building it."
	App.plan_goal(goal, "", "2026-10-05")
	await _frames(10)
	_save(out, "02_plan_review.png")
	var plan_id := ""
	for p in App.ws.plans.values():
		plan_id = p.id
	App.approve_plan(plan_id, [])
	await tree.create_timer(0.3).timeout
	_save(out, "03_working.png")
	await tree.create_timer(6.0).timeout
	var luau := ""
	for t in App.ws.tasks.values():
		if t.kind == "roblox_luau":
			luau = t.id
	App.select("task", luau)
	await _frames(10)
	_save(out, "04_luau_review.png")
	App.select("agent", "producer")
	await _frames(10)
	_save(out, "05_agent_panel.png")
	if main.has_method("show_view"):
		main.show_view("world")
		App.select("agent", "roblox_builder")
		await tree.create_timer(1.0).timeout
		_save(out, "06_world.png")
		main.show_view("dashboard")
	main._center_dashboard.current_tab = 1  # Board tab
	await _frames(10)
	_save(out, "07_board.png")
	App.save_now()
	print("SHOTS_DONE tasks=%d deliverables=%d" % [App.ws.tasks.size(), App.ws.deliverables.size()])
	tree.quit()


func _frames(n: int) -> void:
	for i in n:
		await get_tree().process_frame


func _save(dir: String, file: String) -> void:
	var img := get_viewport().get_texture().get_image()
	img.save_png(dir.path_join(file))


## Shows the world while the example plan runs, to check motions and states.
func _run_world() -> void:
	var out: String = options.get("shot", "user://shots")
	DirAccess.make_dir_recursive_absolute(out)
	var tree := get_tree()
	var main: Control = tree.current_scene
	App.provider.delay_sec = 1.5
	main.show_view("world")
	await _frames(20)
	_save(out, "w1_idle.png")
	App.plan_goal("Prototype a Roblox obstacle game and plan three TikToks about building it.", "", "")
	var plan_id := ""
	for p in App.ws.plans.values():
		plan_id = p.id
	App.approve_plan(plan_id, [])
	await tree.create_timer(0.9).timeout
	_save(out, "w2_walking.png")
	await tree.create_timer(1.3).timeout
	_save(out, "w3_working.png")
	# wait for the concept -> series handoff
	while not App.ws.activity.any(func(a): return a.kind == "handoff"):
		await tree.process_frame
	await tree.create_timer(0.7).timeout
	_save(out, "w4_handoff.png")
	var world = main._center_world.world
	world.focus_area("roblox")
	await tree.create_timer(1.0).timeout
	_save(out, "w5_roblox_lab.png")
	world.focus_area("tiktok")
	await tree.create_timer(8.0).timeout
	_save(out, "w6_tiktok_review.png")
	tree.quit()


# --- End to end ---------------------------------------------------------------

var _failures: Array = []


func _check(ok: bool, what: String) -> void:
	print(("  ok    " if ok else "  FAIL  ") + what)
	if not ok:
		_failures.append(what)


func _finish() -> void:
	print("E2E %s (%d problems)" % ["PASS" if _failures.is_empty() else "FAIL", _failures.size()])
	get_tree().quit(0 if _failures.is_empty() else 1)


## Milestone 1 workflow, steps 1-7 (vault/Goal.md), through the real app.
func _run_e2e() -> void:
	var tree := get_tree()
	App.provider.delay_sec = 0.2
	App.runner.tick_interval = 0.0
	# 1. Enter a goal.  2. The coordinator proposes a plan.
	var r := App.plan_goal("Prototype a Roblox obstacle game and plan three TikToks about building it.", "", "2026-10-05")
	_check(r.ok, "1-2. The goal gets a proposed plan")
	var tasks := App.ws.tasks_for_plan(r.plan_id)
	_check(tasks.size() == 8 and tasks.all(func(t): return t.status == "proposed"), "2. 8 proposed tasks, none running")
	# 3. Review: uncheck TikTok #3, then approve.  4. Tasks go to specialists.
	var skip: Array = tasks.filter(func(t): return t.title.begins_with("Script TikTok #3")).map(func(t): return t.id)
	App.approve_plan(r.plan_id, skip)
	tasks = App.ws.tasks_for_plan(r.plan_id)
	_check(tasks.size() == 7, "3. The unchecked task was left out")
	_check(App.ws.plans[r.plan_id].status == "approved", "3. The plan is approved")
	# 5. Agent states follow real task states (the world reads the same function).
	var saw_working := false
	var give_up := Time.get_ticks_msec() + 15000
	while Time.get_ticks_msec() < give_up and not tasks.all(func(t): return t.status == "review"):
		if App.ws.agent_state("roblox_builder") == "working":
			saw_working = true
			var running: Array = App.ws.tasks_for_agent("roblox_builder").filter(func(t): return t.status == "working")
			if running.size() != 1:
				_check(false, "5. Working means exactly one real running task")
		await tree.process_frame
	_check(saw_working, "5. The Roblox Builder showed Working while a job ran")
	_check(tasks.all(func(t): return t.status == "review"), "6. Every task produced a deliverable for review")
	_check(App.ws.agent_state("producer") == "waiting_for_you", "5. The Producer shows it's waiting for you")
	var world = tree.current_scene._center_world.world
	_check(world.avatars.roblox_builder.state == "waiting_for_you", "5. The 3D Roblox Builder matches its tasks")
	# 6. Deliverables are labeled and editable.
	var luau: Task = tasks.filter(func(t): return t.kind == "roblox_luau")[0]
	var d: Deliverable = App.ws.deliverables[luau.deliverable_id]
	_check("Not tested in Roblox Studio" in d.labels(), "6. The Luau says it isn't tested in Studio")
	_check(d.is_demo(), "6. The Luau is labeled as a demo template")
	App.save_deliverable(d.id, d.body + "\n-- my edit: checkpoints glow when reached\n")
	# 7. Mark done and save.
	App.mark_done(luau.id)
	_check(App.ws.get_task(luau.id).status == "done", "7. The Luau task is done")
	_check(App.save_now(), "7. The project saved")
	_finish()


## Run after "e2e" with the same --save-dir: is everything still there?
func _run_e2e_reopen() -> void:
	var ws := App.ws
	_check(ws.plans.size() == 1, "Reopen: the plan is still there")
	_check(ws.tasks.size() == 7, "Reopen: all 7 tasks are still there")
	var luau: Array = ws.tasks.values().filter(func(t): return t.kind == "roblox_luau")
	_check(luau.size() == 1 and luau[0].status == "done", "Reopen: the Luau task is still done")
	if luau.size() == 1:
		var d: Deliverable = ws.deliverables.get(luau[0].deliverable_id)
		_check(d != null and "my edit: checkpoints glow" in d.body, "Reopen: my edit to the Luau is still there")
		_check(d != null and d.edited_by_me, "Reopen: it's marked as edited by me")
	_check(ws.tasks.values().filter(func(t): return t.status == "review").size() == 6, "Reopen: 6 tasks still wait for review")
	_check(ws.activity.size() > 10, "Reopen: the activity log is still there")
	_finish()
