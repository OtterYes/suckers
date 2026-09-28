class_name Runner
extends Node
## Works through the task queues. It is the only part of the app that starts
## AI (or demo) jobs, so every limit is enforced here:
## - one job per agent, and at most `max_parallel` jobs at once
## - a task starts only when the tasks it depends on have results
## - runtime limit, retry limit, and the AI budget
## - cancel stops a job and ignores any late answer

const DEPENDENCY_BLOCK := "Waiting on "

var ws: Workspace
var default_provider: AIProvider
var providers := {}            # agent_id -> AIProvider, for agents that don't use the default
var max_parallel := 2
var tick_interval := 0.25      # seconds between queue checks
var limit_overrides := {}      # tests use this to shorten limits
var active := {}               # task_id -> Job
var _since_tick := 0.0


func setup(workspace: Workspace, provider: AIProvider) -> void:
	ws = workspace
	default_provider = provider
	active.clear()


func provider_for(agent_id: String) -> AIProvider:
	return providers.get(agent_id, default_provider)


func limits_for(agent_id: String) -> Dictionary:
	var out := AgentDefs.limits(agent_id)
	out.merge(limit_overrides, true)
	return out


func _process(delta: float) -> void:
	_since_tick += delta
	if _since_tick >= tick_interval:
		_since_tick = 0.0
		tick()


## One pass over the queues. Safe to call any time.
func tick() -> void:
	if ws == null:
		return
	_check_timeouts()
	_update_dependency_blocks()
	var busy: Array = active.values().map(func(j): return j.agent_id)
	for t in _queue_in_order():
		if active.size() >= max_parallel:
			break
		if t.owner in busy or not ws.dependencies_ready(t):
			continue
		if _start(t):
			busy.append(t.owner)


# --- Actions I can take --------------------------------------------------------

func cancel_task(task_id: String) -> bool:
	var t := ws.get_task(task_id)
	if t == null or not ws.set_task_status(task_id, Task.CANCELLED, "cancelled by you"):
		return false
	if active.has(task_id):
		active[task_id].cancel("Cancelled by you")
	ws.log_activity(t.owner, task_id, "cancelled", "Cancelled \"%s\"" % t.title)
	return true


## Puts a failed, blocked, or cancelled task back in the queue with fresh retries.
func retry_task(task_id: String) -> bool:
	var t := ws.get_task(task_id)
	if t == null or t.status not in [Task.FAILED, Task.BLOCKED, Task.CANCELLED]:
		return false
	t.attempts = 0
	t.blocker = ""
	ws.set_task_status(task_id, Task.QUEUED, "queued again by you")
	ws.log_activity(t.owner, task_id, "retry", "Trying \"%s\" again" % t.title)
	return true


## Sends a task in review back to its agent with a note about what to change.
func request_changes(task_id: String, note: String) -> bool:
	var t := ws.get_task(task_id)
	if t == null or t.status != Task.REVIEW:
		return false
	t.revision_note = note.strip_edges()
	t.attempts = 0
	ws.set_task_status(task_id, Task.QUEUED, "changes requested: " + t.revision_note)
	ws.log_activity(t.owner, task_id, "changes_requested", "You asked for changes to \"%s\"" % t.title)
	return true


func mark_done(task_id: String) -> bool:
	var t := ws.get_task(task_id)
	if t == null or not ws.set_task_status(task_id, Task.DONE, "marked done by you"):
		return false
	ws.log_activity(t.owner, task_id, "done", "\"%s\" is done" % t.title)
	return true


# --- Context: what an agent is allowed to see -----------------------------------

## Only the task, its project, results from tasks it depends on, and the agent's
## own memory for this project. Nothing from other projects (vault/Architecture.md).
func build_context(t: Task) -> Dictionary:
	var project: Dictionary = ws.projects.get(t.project_id, {})
	var inputs: Array = []
	for dep_id in t.depends_on:
		var dep := ws.get_task(dep_id)
		if dep and ws.deliverables.has(dep.deliverable_id):
			var d: Deliverable = ws.deliverables[dep.deliverable_id]
			inputs.append({"task_id": dep.id, "title": d.title, "owner": dep.owner,
				"area": dep.area, "kind": d.kind, "body": d.body})
	var task_info := t.to_dict()
	task_info.erase("log")
	return {
		"goal": ws.plans.get(t.plan_id, {}).get("goal", t.goal),
		"project": {"name": project.get("name", ""), "area": project.get("area", ""),
			"description": project.get("description", "")},
		"task": task_info,
		"inputs": inputs,
		"memory": ws.memory_for(t.owner, t.project_id).map(func(m): return m.text),
		"revision_note": t.revision_note,
	}


# --- Internals -----------------------------------------------------------------

## Highest priority first, then earliest due date, then oldest.
func _queue_in_order() -> Array:
	var queued: Array = ws.tasks.values().filter(func(t): return t.status == Task.QUEUED)
	var rank := {"high": 0, "medium": 1, "low": 2}
	queued.sort_custom(func(a, b):
		if a.priority != b.priority:
			return rank.get(a.priority, 1) < rank.get(b.priority, 1)
		var ad: String = a.due if a.due != "" else "9999"
		var bd: String = b.due if b.due != "" else "9999"
		if ad != bd:
			return ad < bd
		return int(a.id.get_slice("_", 1)) < int(b.id.get_slice("_", 1)))
	return queued


func _start(t: Task) -> bool:
	var provider := provider_for(t.owner)
	if not provider.is_demo():
		var reason := _budget_problem()
		if reason != "":
			t.blocker = reason
			ws.set_task_status(t.id, Task.BLOCKED, reason)
			ws.log_activity(t.owner, t.id, "blocked", reason)
			return false
	t.attempts += 1
	ws.set_task_status(t.id, Task.WORKING, "attempt %d" % t.attempts)
	var job := Job.new()
	job.task_id = t.id
	job.agent_id = t.owner
	job.context = build_context(t)
	job.started_ms = Time.get_ticks_msec()
	active[t.id] = job
	# A handoff is a real event: an earlier task's result is passed to this one.
	for input in job.context.inputs:
		if input.owner != t.owner:
			ws.log_activity(t.owner, t.id, "handoff", "Received \"%s\" from %s" % [input.title,
				AgentDefs.find(input.owner).get("name", input.owner)], {"from_agent": input.owner})
	var how := "filling in a demo template (simulated delay)" if provider.is_demo() else "calling " + provider.source_name()
	ws.log_activity(t.owner, t.id, "started", "Started \"%s\": %s" % [t.title, how])
	job.finished.connect(_on_job_finished.bind(t.id, job))
	provider.start(job)
	return true


func _on_job_finished(result: Dictionary, task_id: String, job: Job) -> void:
	if active.get(task_id) == job:
		active.erase(task_id)
	var t := ws.get_task(task_id)
	if t == null:
		return
	var usage: Dictionary = result.get("usage", {})
	if float(usage.get("cost_usd", 0.0)) > 0.0 or int(usage.get("input_tokens", 0)) > 0:
		ws.record_usage(t.owner, int(usage.input_tokens), int(usage.output_tokens), float(usage.cost_usd))
	if result.get("cancelled", false) and result.get("by_user", true):
		return  # cancel_task already recorded this
	if result.get("ok", false):
		var d := Deliverable.new()
		d.task_id = task_id
		d.title = str(result.get("title", t.title))
		d.kind = str(result.get("kind", "doc"))
		d.body = str(result.get("body", ""))
		d.source = str(result.get("source", Deliverable.SOURCE_DEMO))
		if t.revision_note != "" and d.is_demo():
			d.body += "\n\n---\n**Your change request:** %s\n_Demo templates can't apply changes. Edit the text above, or use real AI (Milestone 4)._\n" % t.revision_note
		ws.add_deliverable(d)
		t.deliverable_id = d.id
		t.blocker = ""
		ws.set_task_status(task_id, Task.REVIEW, "deliverable ready")
		ws.log_activity(t.owner, task_id, "produced", "Finished \"%s\". Ready for your review." % t.title)
		return
	var error := str(result.get("error", "Unknown error"))
	if t.attempts <= int(limits_for(t.owner).max_retries):
		ws.set_task_status(task_id, Task.QUEUED, "retrying after: " + error)
		ws.log_activity(t.owner, task_id, "retry", "Problem with \"%s\" (%s). Trying once more." % [t.title, error])
	else:
		t.blocker = error
		ws.set_task_status(task_id, Task.FAILED, error)
		ws.log_activity(t.owner, task_id, "failed", "\"%s\" failed: %s" % [t.title, error])


func _check_timeouts() -> void:
	var now_ms := Time.get_ticks_msec()
	for task_id in active.keys():
		var job: Job = active[task_id]
		var limit_sec := float(limits_for(job.agent_id).max_runtime_sec)
		if now_ms - job.started_ms > limit_sec * 1000.0:
			job.cancel("Took longer than %s seconds" % str(limit_sec), false)


## Queued tasks whose dependency failed or was cancelled can't run, so they're
## marked blocked with the reason. They go back to the queue once it's fixed.
func _update_dependency_blocks() -> void:
	for t in ws.tasks.values():
		if t.status == Task.QUEUED:
			for dep_id in t.depends_on:
				var dep := ws.get_task(dep_id)
				if dep and dep.status in [Task.FAILED, Task.CANCELLED]:
					t.blocker = DEPENDENCY_BLOCK + "\"%s\" (%s)" % [dep.title, dep.status]
					ws.set_task_status(t.id, Task.BLOCKED, t.blocker)
					ws.log_activity(t.owner, t.id, "blocked", t.blocker)
					break
		elif t.status == Task.BLOCKED and t.blocker.begins_with(DEPENDENCY_BLOCK):
			var still_stuck := false
			for dep_id in t.depends_on:
				var dep := ws.get_task(dep_id)
				if dep and dep.status in [Task.FAILED, Task.CANCELLED]:
					still_stuck = true
			if not still_stuck:
				t.blocker = ""
				ws.set_task_status(t.id, Task.QUEUED, "dependency fixed")


func _budget_problem() -> String:
	if ws.spent_today() >= float(ws.settings.daily_budget_usd):
		return "Today's AI budget ($%.2f) is used up. Raise it in Settings or wait until tomorrow." % ws.settings.daily_budget_usd
	if ws.spent_this_month() >= float(ws.settings.monthly_budget_usd):
		return "This month's AI budget ($%.2f) is used up." % ws.settings.monthly_budget_usd
	return ""
