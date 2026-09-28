extends Node
## The global "App" (an autoload, so every script can reach it as `App`).
## It owns the workspace, saving, and the Runner, and it offers the *actions*
## that both the dashboard and the 3D world use. Neither view changes data
## any other way (vault/Architecture.md, rule 1).

## Short messages for the status bar, e.g. "Saved" or an error.
signal notice(text: String, is_error: bool)
## Which task or agent is selected. Both views follow it.
signal selection_changed(kind: String, id: String)

const AUTOSAVE_DELAY_SEC := 3.0

var ws: Workspace
var store: Store
var runner: Runner
var provider: MockProvider
var selected := {"kind": "", "id": ""}
var last_saved_at := ""
## When the save file exists but couldn't be read, saving stays off so the
## unreadable file (and its backups) are never overwritten.
var saving_blocked := false

var _dirty := false
var _since_change := 0.0


func _ready() -> void:
	var args := _user_args()
	store = Store.new(args.get("save-dir", "user://"))
	var loaded := store.load_workspace()
	if loaded == null:
		saving_blocked = true
		loaded = Workspace.new()
		_notice.call_deferred(store.last_error + " Saving is off until this is fixed.", true)
	elif store.last_warning != "":
		_notice.call_deferred(store.last_warning, true)
	ws = loaded
	provider = MockProvider.new(get_tree(), float(ws.settings.demo_delay_sec))
	runner = Runner.new()
	runner.name = "Runner"
	add_child(runner)
	runner.setup(ws, provider)
	ws.changed.connect(_on_changed)
	if args.has("shot") or args.has("scenario"):
		# Only used for automated checks: screenshots and end-to-end runs (tools/app_driver.gd).
		var driver: Node = load("res://tools/app_driver.gd").new()
		driver.options = args
		add_child(driver)


func _process(delta: float) -> void:
	if _dirty:
		_since_change += delta
		if _since_change >= AUTOSAVE_DELAY_SEC:
			save_now()


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		save_now()


func save_now() -> bool:
	if saving_blocked:
		return false
	_dirty = false
	if store.save(ws):
		last_saved_at = ws.now().substr(11, 5)
		notice.emit("Saved at " + last_saved_at, false)
		return true
	notice.emit(store.last_error, true)
	return false


func select(kind: String, id: String) -> void:
	selected = {"kind": kind, "id": id}
	selection_changed.emit(kind, id)


# --- Actions ------------------------------------------------------------------

func plan_goal(goal: String, area: String, deadline: String) -> Dictionary:
	return Coordinator.plan(ws, goal, area, deadline)


func approve_plan(plan_id: String, skip_ids: Array) -> void:
	var n := Coordinator.approve(ws, plan_id, skip_ids)
	notice.emit("Approved. %d tasks sent to the agents." % n, false)


func discard_plan(plan_id: String) -> void:
	Coordinator.discard(ws, plan_id)


func cancel_task(id: String) -> void:
	runner.cancel_task(id)


func retry_task(id: String) -> void:
	runner.retry_task(id)


func mark_done(id: String) -> void:
	runner.mark_done(id)


func request_changes(id: String, note: String) -> void:
	if note.strip_edges() == "":
		notice.emit("Write what you want changed first.", true)
		return
	runner.request_changes(id, note)


func save_deliverable(id: String, body: String) -> void:
	ws.edit_deliverable(id, body)
	notice.emit("Edits saved.", false)


func set_luau_tested(id: String, tested: bool) -> void:
	ws.deliverables[id].tested = tested
	ws.changed.emit("deliverable", id)


## "Give a task" straight to one agent, outside a plan. It goes to that area's inbox project.
func assign_task(agent_id: String, title: String, priority: String, due: String) -> Dictionary:
	title = title.strip_edges()
	if title == "":
		return {"ok": false, "error": "Give the task a title."}
	if due != "" and not Coordinator._is_date(due):
		return {"ok": false, "error": "Write the due date as YYYY-MM-DD."}
	var agent := AgentDefs.find(agent_id)
	var inbox_name := "%s inbox" % AgentDefs.area_name(agent.area)
	var project_id := ""
	for p in ws.projects.values():
		if p.name == inbox_name:
			project_id = p.id
	if project_id == "":
		project_id = ws.add_project(inbox_name, agent.area, "Tasks given directly to %s." % agent.name)
	var t := Task.new()
	t.title = title
	t.goal = title
	t.area = agent.area
	t.owner = agent_id
	t.kind = agent.area + "_custom"
	t.priority = priority
	t.due = due
	t.project_id = project_id
	ws.add_task(t)
	ws.set_task_status(t.id, Task.QUEUED, "given directly by you")
	ws.log_activity(agent_id, t.id, "assigned", "You gave %s \"%s\"" % [agent.name, title])
	return {"ok": true, "task_id": t.id}


func add_memory(agent_id: String, project_id: String, text: String) -> void:
	if text.strip_edges() != "":
		ws.add_memory(agent_id, project_id, text.strip_edges())


func delete_memory(id: String) -> void:
	ws.delete_memory(id)


# --- Internals -----------------------------------------------------------------

func _on_changed(_kind: String, _id: String) -> void:
	_dirty = true
	_since_change = 0.0


func _notice(text: String, is_error: bool) -> void:
	notice.emit(text, is_error)


## Reads "--key=value" arguments given after "--" on the command line.
func _user_args() -> Dictionary:
	var out := {}
	for a in OS.get_cmdline_user_args():
		var parts := a.trim_prefix("--").split("=", true, 1)
		out[parts[0]] = parts[1] if parts.size() > 1 else "true"
	return out
