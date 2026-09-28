class_name Workspace
extends RefCounted
## Everything the app knows: projects, plans, tasks, deliverables, memory,
## activity, usage, and settings. The 3D world and the dashboard never change
## these directly. They call App actions, and redraw when `changed` fires.

## Sent after every change. `kind` is "task", "plan", "project",
## "deliverable", "memory", "activity", "usage", "settings", or "all".
signal changed(kind: String, id: String)

const SCHEMA_VERSION := 1
const MAX_ACTIVITY := 500

var meta := {"schema_version": SCHEMA_VERSION, "next_id": 1, "created_at": ""}
var settings := {
	"demo_mode": true,
	"demo_delay_sec": 2.5,       # simulated "working" time in demo mode (labeled)
	"daily_budget_usd": 0.50,
	"monthly_budget_usd": 20.0,
	"ui_scale": 1.0,
}
var projects := {}      # id -> {id, name, area, description, shares_with, created_at}
var plans := {}         # id -> {id, goal, project_id, status, task_ids, notes, created_at}
var tasks := {}         # id -> Task
var deliverables := {}  # id -> Deliverable
var memory: Array = []  # [{id, agent_id, project_id, text, created_at}]
var activity: Array = [] # [{id, t, agent_id, task_id, kind, message}], newest last
var usage := {"calls": 0, "input_tokens": 0, "output_tokens": 0, "est_cost_usd": 0.0,
	"by_day": {}, "by_month": {}, "by_agent": {}}

## Tests set this to a fixed clock. Returns "YYYY-MM-DDTHH:MM:SS".
var clock := Callable()


func _init() -> void:
	meta.created_at = now()


func now() -> String:
	if clock.is_valid():
		return clock.call()
	return Time.get_datetime_string_from_system()


func today() -> String:
	return now().substr(0, 10)


## Short, readable ids like "t_12". The counter is saved, so ids never repeat.
func new_id(prefix: String) -> String:
	var n := int(meta.next_id)
	meta.next_id = n + 1
	return "%s_%d" % [prefix, n]


# --- Projects and plans -------------------------------------------------------

func add_project(project_name: String, area: String, description := "") -> String:
	var id := new_id("p")
	projects[id] = {"id": id, "name": project_name, "area": area,
		"description": description, "shares_with": [], "created_at": now()}
	changed.emit("project", id)
	return id


func add_plan(goal: String, project_id: String, task_ids: Array, notes: Array) -> String:
	var id := new_id("plan")
	plans[id] = {"id": id, "goal": goal, "project_id": project_id, "status": "proposed",
		"task_ids": task_ids.duplicate(), "notes": notes.duplicate(), "created_at": now()}
	for tid in task_ids:
		tasks[tid].plan_id = id
	changed.emit("plan", id)
	return id


func set_plan_status(plan_id: String, status: String) -> void:
	plans[plan_id].status = status
	changed.emit("plan", plan_id)


# --- Tasks --------------------------------------------------------------------

func add_task(t: Task) -> String:
	if t.id == "":
		t.id = new_id("t")
	t.created_at = now()
	t.updated_at = t.created_at
	tasks[t.id] = t
	changed.emit("task", t.id)
	return t.id


## Removes a task that was never approved, and any links to it.
func remove_task(id: String) -> void:
	tasks.erase(id)
	for t in tasks.values():
		t.depends_on.erase(id)
	for p in plans.values():
		p.task_ids.erase(id)
	changed.emit("task", id)


func get_task(id: String) -> Task:
	return tasks.get(id)


## Moves a task to a new status if that change makes sense. Returns false if refused.
func set_task_status(id: String, new_status: String, note := "") -> bool:
	var t: Task = tasks.get(id)
	if t == null or not t.can_move_to(new_status):
		return false
	t.status = new_status
	t.updated_at = now()
	t.add_log(t.updated_at, "%s%s" % [new_status, (": " + note) if note != "" else ""])
	changed.emit("task", id)
	return true


## Saves edits to a task's own fields (title, priority, due...) and announces them.
func touch_task(id: String) -> void:
	tasks[id].updated_at = now()
	changed.emit("task", id)


func tasks_for_agent(agent_id: String) -> Array:
	return tasks.values().filter(func(t): return t.owner == agent_id)


func tasks_for_plan(plan_id: String) -> Array:
	return plans.get(plan_id, {}).get("task_ids", []).map(func(id): return tasks[id])


## True when every task this one depends on has a result ready (Decisions D12).
func dependencies_ready(t: Task) -> bool:
	for dep_id in t.depends_on:
		var dep: Task = tasks.get(dep_id)
		if dep == null or not dep.is_ready_for_dependents():
			return false
	return true


## Works out what an agent is doing from its real tasks (Decisions D13).
## One of: "working", "blocked", "waiting_for_you", "queued", "idle".
func agent_state(agent_id: String) -> String:
	var seen := {}
	for t in tasks_for_agent(agent_id):
		seen[t.status] = true
	if seen.has(Task.WORKING):
		return "working"
	if seen.has(Task.BLOCKED) or seen.has(Task.FAILED):
		return "blocked"
	if seen.has(Task.REVIEW):
		return "waiting_for_you"
	if seen.has(Task.QUEUED):
		return "queued"
	return "idle"


# --- Deliverables -------------------------------------------------------------

func add_deliverable(d: Deliverable) -> String:
	if d.id == "":
		d.id = new_id("d")
	d.created_at = now()
	d.updated_at = d.created_at
	deliverables[d.id] = d
	changed.emit("deliverable", d.id)
	return d.id


func edit_deliverable(id: String, new_body: String) -> void:
	var d: Deliverable = deliverables[id]
	if d.body == new_body:
		return
	d.body = new_body
	d.edited_by_me = true
	d.updated_at = now()
	changed.emit("deliverable", id)


# --- Memory (visible, editable, deletable) ----------------------------------

func add_memory(agent_id: String, project_id: String, text: String) -> String:
	var id := new_id("m")
	memory.append({"id": id, "agent_id": agent_id, "project_id": project_id,
		"text": text, "created_at": now()})
	changed.emit("memory", id)
	return id


func delete_memory(id: String) -> void:
	memory = memory.filter(func(m): return m.id != id)
	changed.emit("memory", id)


func memory_for(agent_id: String, project_id: String) -> Array:
	return memory.filter(func(m): return m.agent_id == agent_id and m.project_id == project_id)


# --- Activity and usage -------------------------------------------------------

## `extra` holds details the world uses to animate, e.g. {"from_agent": "roblox_builder"}.
func log_activity(agent_id: String, task_id: String, kind: String, message: String,
		extra := {}) -> Dictionary:
	var entry := {"id": new_id("a"), "t": now(), "agent_id": agent_id,
		"task_id": task_id, "kind": kind, "message": message}
	entry.merge(extra)
	activity.append(entry)
	if activity.size() > MAX_ACTIVITY:
		activity = activity.slice(activity.size() - MAX_ACTIVITY)
	changed.emit("activity", entry.id)
	return entry


func record_usage(agent_id: String, input_tokens: int, output_tokens: int, cost_usd: float) -> void:
	usage.calls += 1
	usage.input_tokens += input_tokens
	usage.output_tokens += output_tokens
	usage.est_cost_usd += cost_usd
	var day := today()
	var month := day.substr(0, 7)
	usage.by_day[day] = float(usage.by_day.get(day, 0.0)) + cost_usd
	usage.by_month[month] = float(usage.by_month.get(month, 0.0)) + cost_usd
	usage.by_agent[agent_id] = float(usage.by_agent.get(agent_id, 0.0)) + cost_usd
	changed.emit("usage", agent_id)


func spent_today() -> float:
	return float(usage.by_day.get(today(), 0.0))


func spent_this_month() -> float:
	return float(usage.by_month.get(today().substr(0, 7), 0.0))


# --- Saving and loading -------------------------------------------------------

func to_dict() -> Dictionary:
	var task_dicts := {}
	for id in tasks:
		task_dicts[id] = tasks[id].to_dict()
	var deliverable_dicts := {}
	for id in deliverables:
		deliverable_dicts[id] = deliverables[id].to_dict()
	return {
		"meta": meta.duplicate(true), "settings": settings.duplicate(true),
		"projects": projects.duplicate(true), "plans": plans.duplicate(true),
		"tasks": task_dicts, "deliverables": deliverable_dicts,
		"memory": memory.duplicate(true), "activity": activity.duplicate(true),
		"usage": usage.duplicate(true),
	}


## Builds a Workspace from saved data. Returns null if the data is from a newer
## app version this one can't read.
static func from_dict(d: Dictionary) -> Workspace:
	var ws := Workspace.new()
	var version := int(d.get("meta", {}).get("schema_version", 1))
	if version > SCHEMA_VERSION:
		return null
	ws.meta.merge(d.get("meta", {}), true)
	ws.meta.next_id = int(ws.meta.next_id)
	ws.meta.schema_version = SCHEMA_VERSION
	ws.settings.merge(d.get("settings", {}), true)
	ws.projects = d.get("projects", {})
	ws.plans = d.get("plans", {})
	for id in d.get("tasks", {}):
		ws.tasks[id] = Task.from_dict(d.tasks[id])
	for id in d.get("deliverables", {}):
		ws.deliverables[id] = Deliverable.from_dict(d.deliverables[id])
	ws.memory = d.get("memory", [])
	ws.activity = d.get("activity", [])
	ws.usage.merge(d.get("usage", {}), true)
	ws.usage.calls = int(ws.usage.calls)
	ws.usage.input_tokens = int(ws.usage.input_tokens)
	ws.usage.output_tokens = int(ws.usage.output_tokens)
	# A job can't survive the app closing, so anything "working" goes back in the queue.
	for t in ws.tasks.values():
		if t.status == Task.WORKING:
			t.status = Task.QUEUED
			t.add_log(ws.now(), "queued: the app closed while this was running")
	return ws
