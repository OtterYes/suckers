extends TestCase
## The Runner: queues, dependencies, limits, retries, and cancel.

const EXAMPLE := "Prototype a Roblox obstacle game and plan three TikToks about building it."

var ws: Workspace
var runner: Runner
var provider: MockProvider


func _setup(delay := 0.02) -> void:
	ws = Workspace.new()
	ws.clock = fixed_clock()
	provider = MockProvider.new(tree, delay)
	runner = Runner.new()
	runner.tick_interval = 0.0
	runner.setup(ws, provider)
	tree.root.add_child(runner)


func _teardown() -> void:
	runner.queue_free()


func _plan_and_approve(goal := EXAMPLE) -> String:
	var r := Coordinator.plan(ws, goal)
	Coordinator.approve(ws, r.plan_id)
	return r.plan_id


func _all_in(plan_id: String, status: String) -> bool:
	return ws.tasks_for_plan(plan_id).all(func(t): return t.status == status)


func _task_of_kind(plan_id: String, kind: String) -> Task:
	return ws.tasks_for_plan(plan_id).filter(func(t): return t.kind == kind)[0]


func test_example_runs_to_review_with_rules_respected() -> void:
	_setup()
	var problems: Array = []
	ws.changed.connect(func(kind, id):
		if kind != "task":
			return
		var working := ws.tasks.values().filter(func(t): return t.status == Task.WORKING)
		var owners := {}
		for t in working:
			if owners.has(t.owner):
				problems.append("two jobs for " + t.owner)
			owners[t.owner] = true
		if working.size() > runner.max_parallel:
			problems.append("too many jobs at once")
		var t: Task = ws.get_task(id)
		if t and t.status == Task.WORKING and not ws.dependencies_ready(t):
			problems.append("started before its inputs were ready: " + t.title))
	var plan_id := _plan_and_approve()
	check(await wait_until(func(): return _all_in(plan_id, Task.REVIEW), 10.0), "all 8 tasks reach review")
	check_eq(problems, [], "no agent ran two jobs, and nothing started early")
	for t in ws.tasks_for_plan(plan_id):
		check(ws.deliverables.has(t.deliverable_id), "\"%s\" has a deliverable" % t.title)
		check(ws.deliverables[t.deliverable_id].is_demo(), "and it's labeled demo")
	check(ws.activity.any(func(a): return a.kind == "handoff" and a.get("from_agent") == "roblox_builder"),
		"the concept handoff to the Producer is logged")
	check_eq(ws.usage.calls, 0, "demo mode records no AI calls")
	_teardown()


func test_context_only_includes_dependencies() -> void:
	_setup()
	var plan_id := _plan_and_approve()
	await wait_until(func(): return _all_in(plan_id, Task.REVIEW), 10.0)
	var script_ctx := runner.build_context(_task_of_kind(plan_id, "tiktok_script"))
	check_eq(script_ctx.inputs.size(), 1, "a TikTok script sees only the series plan")
	var series_ctx := runner.build_context(_task_of_kind(plan_id, "tiktok_series"))
	check_eq(series_ctx.inputs.map(func(i): return i.owner), ["roblox_builder"], "the series sees the game concept")
	check(not series_ctx.inputs.any(func(i): return i.kind == "luau"), "the series doesn't see the Luau code")
	_teardown()


func test_failure_retries_then_fails_and_blocks_dependents() -> void:
	_setup()
	provider.fail_kinds = ["roblox_luau"]
	var plan_id := _plan_and_approve("prototype a roblox obby")
	var luau := _task_of_kind(plan_id, "roblox_luau")
	var review := _task_of_kind(plan_id, "roblox_review")
	check(await wait_until(func(): return luau.status == Task.FAILED), "the Luau task fails")
	check_eq(luau.attempts, 2, "it was tried twice (1 retry)")
	check(luau.blocker != "", "the failure has a reason")
	check(await wait_until(func(): return review.status == Task.BLOCKED), "the review is blocked by it")
	check(review.blocker.begins_with(Runner.DEPENDENCY_BLOCK), "the block says what it's waiting on")
	provider.fail_kinds = []
	runner.retry_task(luau.id)
	check(await wait_until(func(): return review.status == Task.REVIEW), "after a retry, the review runs")
	_teardown()


func test_cancel_stops_a_running_job() -> void:
	_setup(30.0)
	var plan_id := _plan_and_approve("prototype a roblox obby")
	var concept := _task_of_kind(plan_id, "roblox_concept")
	check(await wait_until(func(): return concept.status == Task.WORKING), "the concept starts")
	check(runner.cancel_task(concept.id), "cancel works")
	check_eq(concept.status, Task.CANCELLED, "it's cancelled")
	check(runner.active.is_empty(), "no job is left running")
	check_eq(concept.deliverable_id, "", "no deliverable was made")
	_teardown()


func test_timeout_counts_as_a_failed_try() -> void:
	_setup(30.0)
	runner.limit_overrides = {"max_runtime_sec": 0.1, "max_retries": 0}
	var plan_id := _plan_and_approve("prototype a roblox obby")
	var concept := _task_of_kind(plan_id, "roblox_concept")
	check(await wait_until(func(): return concept.status == Task.FAILED, 3.0), "a slow job times out")
	check("longer than" in concept.blocker, "the reason says it took too long")
	_teardown()


func test_request_changes_and_mark_done() -> void:
	_setup()
	var plan_id := _plan_and_approve("prototype a roblox obby")
	var concept := _task_of_kind(plan_id, "roblox_concept")
	await wait_until(func(): return concept.status == Task.REVIEW)
	var first := concept.deliverable_id
	check(runner.request_changes(concept.id, "Make it space themed"), "changes can be requested")
	check(await wait_until(func(): return concept.status == Task.REVIEW and concept.deliverable_id != first), "a new version arrives")
	check("Make it space themed" in ws.deliverables[concept.deliverable_id].body, "the note is shown")
	check(runner.mark_done(concept.id), "mark done works")
	check_eq(ws.agent_state("coordinator"), "idle", "the coordinator has no tasks")
	_teardown()


func test_real_provider_respects_budget() -> void:
	_setup()
	var paid := PaidStub.new()
	runner.providers["roblox_builder"] = paid
	ws.settings.daily_budget_usd = 0.0
	var plan_id := _plan_and_approve("prototype a roblox obby")
	var concept := _task_of_kind(plan_id, "roblox_concept")
	check(await wait_until(func(): return concept.status == Task.BLOCKED), "no budget means blocked")
	check("budget" in concept.blocker, "the reason mentions the budget")
	check_eq(paid.calls, 0, "the paid provider was never called")
	_teardown()


func test_discard_leaves_nothing_behind() -> void:
	_setup()
	var r := Coordinator.plan(ws, EXAMPLE)
	Coordinator.discard(ws, r.plan_id)
	check(ws.tasks.is_empty(), "discarded tasks are gone")
	check(ws.projects.is_empty(), "the empty project is gone")
	_teardown()


func test_unchecked_tasks_are_left_out() -> void:
	_setup()
	var r := Coordinator.plan(ws, EXAMPLE)
	var review_task := _task_of_kind(r.plan_id, "roblox_review")
	check_eq(Coordinator.approve(ws, r.plan_id, [review_task.id]), 7, "7 of 8 queued")
	check(ws.get_task(review_task.id) == null, "the unchecked task was removed")
	_teardown()


## Pretends to be a paid provider so budget rules can be tested for free.
class PaidStub extends AIProvider:
	var calls := 0
	func is_demo() -> bool:
		return false
	func source_name() -> String:
		return "ai:stub"
	func start(job: Job) -> void:
		calls += 1
		job.finish({"ok": true, "title": "x", "body": "x", "source": "ai:stub",
			"usage": {"input_tokens": 1, "output_tokens": 1, "cost_usd": 0.001}})
