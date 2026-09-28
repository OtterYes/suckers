extends TestCase
## Data core: tasks, workspace, and saving.


func _workspace() -> Workspace:
	var ws := Workspace.new()
	ws.clock = fixed_clock()
	return ws


func _task(ws: Workspace, title: String, owner := "roblox_builder", deps := []) -> Task:
	var t := Task.new()
	t.title = title
	t.owner = owner
	t.area = "roblox"
	t.depends_on = deps
	ws.add_task(t)
	return t


func test_ids_are_unique_and_readable() -> void:
	var ws := _workspace()
	var a := ws.new_id("t")
	var b := ws.new_id("t")
	check(a != b, "two ids differ")
	check(a.begins_with("t_"), "ids start with their prefix")


func test_status_changes_follow_the_rules() -> void:
	var ws := _workspace()
	var t := _task(ws, "Concept")
	check(not ws.set_task_status(t.id, Task.DONE), "proposed can't jump straight to done")
	check(ws.set_task_status(t.id, Task.QUEUED), "proposed -> queued")
	check(ws.set_task_status(t.id, Task.WORKING), "queued -> working")
	check(ws.set_task_status(t.id, Task.REVIEW), "working -> review")
	check(ws.set_task_status(t.id, Task.DONE), "review -> done")
	check_eq(t.log.size(), 4, "each change is logged")


func test_agent_state_comes_from_tasks() -> void:
	var ws := _workspace()
	check_eq(ws.agent_state("roblox_builder"), "idle", "no tasks means idle")
	var t := _task(ws, "Concept")
	ws.set_task_status(t.id, Task.QUEUED)
	check_eq(ws.agent_state("roblox_builder"), "queued", "queued task")
	ws.set_task_status(t.id, Task.WORKING)
	check_eq(ws.agent_state("roblox_builder"), "working", "working task")
	ws.set_task_status(t.id, Task.REVIEW)
	check_eq(ws.agent_state("roblox_builder"), "waiting_for_you", "task waiting for review")
	check_eq(ws.agent_state("producer"), "idle", "other agents are unaffected")


func test_dependencies_ready_after_review() -> void:
	var ws := _workspace()
	var a := _task(ws, "Concept")
	var b := _task(ws, "Script", "producer", [a.id])
	check(not ws.dependencies_ready(b), "not ready while the concept is proposed")
	ws.set_task_status(a.id, Task.QUEUED)
	ws.set_task_status(a.id, Task.WORKING)
	ws.set_task_status(a.id, Task.REVIEW)
	check(ws.dependencies_ready(b), "ready once the concept is in review")


func test_changed_signal_fires() -> void:
	var ws := _workspace()
	var seen: Array = []
	ws.changed.connect(func(kind, id): seen.append(kind))
	_task(ws, "Concept")
	check("task" in seen, "adding a task announces it")


func test_usage_totals_by_day_and_month() -> void:
	var ws := _workspace()
	ws.record_usage("roblox_builder", 100, 200, 0.01)
	ws.record_usage("roblox_builder", 50, 50, 0.02)
	check_eq(ws.usage.calls, 2, "two calls counted")
	check(absf(ws.spent_today() - 0.03) < 0.0001, "today's spending adds up")
	check(absf(ws.spent_this_month() - 0.03) < 0.0001, "this month's spending adds up")


func test_save_and_load_round_trip() -> void:
	var ws := _workspace()
	var p := ws.add_project("Obby prototype", "roblox")
	var t := _task(ws, "Concept")
	t.project_id = p
	t.estimate_min = 45
	t.depends_on = ["t_99"]
	ws.set_task_status(t.id, Task.QUEUED)
	var d := Deliverable.new()
	d.task_id = t.id
	d.kind = "luau"
	d.body = "print(\"hi\")"
	ws.add_deliverable(d)
	ws.add_memory("roblox_builder", p, "Prefers short explanations")
	var store := Store.new(temp_dir("roundtrip"))
	check(store.save(ws), "save works: " + store.last_error)
	var loaded := store.load_workspace()
	check(loaded != null, "load works: " + store.last_error)
	if loaded == null:
		return
	var lt: Task = loaded.get_task(t.id)
	check_eq(lt.title, "Concept", "title survives")
	check_eq(lt.estimate_min, 45, "numbers come back as whole numbers")
	check_eq(typeof(lt.estimate_min), TYPE_INT, "estimate is an int")
	check_eq(lt.depends_on, ["t_99"], "dependencies survive")
	check_eq(lt.status, Task.QUEUED, "status survives")
	check_eq(loaded.deliverables[d.id].labels()[1], "Not tested in Roblox Studio", "Luau stays untested")
	check_eq(loaded.memory.size(), 1, "memory survives")
	check_eq(loaded.new_id("t"), ws.new_id("t"), "id counter continues where it left off")


func test_working_tasks_requeue_after_restart() -> void:
	var ws := _workspace()
	var t := _task(ws, "Concept")
	ws.set_task_status(t.id, Task.QUEUED)
	ws.set_task_status(t.id, Task.WORKING)
	var loaded := Workspace.from_dict(JSON.parse_string(JSON.stringify(ws.to_dict())))
	check_eq(loaded.get_task(t.id).status, Task.QUEUED, "an interrupted job is queued again, not shown as working")


func test_damaged_save_falls_back_to_backup() -> void:
	var dir := temp_dir("damaged")
	var store := Store.new(dir)
	var ws := _workspace()
	ws.add_project("Keep me", "roblox")
	store.save(ws)
	store.save(ws)  # the second save makes a backup of the first
	check(store.list_backups().size() == 1, "one backup was made")
	var f := FileAccess.open(store.save_path(), FileAccess.WRITE)
	f.store_string("{ this is not json")
	f.close()
	var loaded := store.load_workspace()
	check(loaded != null, "a backup loads")
	check(store.last_warning != "", "you are told a backup was used")
	if loaded != null:
		check_eq(loaded.projects.size(), 1, "the backup has the project")


func test_newer_save_version_is_refused() -> void:
	var data := Workspace.new().to_dict()
	data.meta.schema_version = 999
	check(Workspace.from_dict(data) == null, "a save from a newer app isn't misread")


func test_no_save_yet_gives_empty_workspace() -> void:
	var store := Store.new(temp_dir("empty"))
	var ws := store.load_workspace()
	check(ws != null and ws.tasks.is_empty(), "first launch starts empty")
