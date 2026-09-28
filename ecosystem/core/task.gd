class_name Task
extends RefCounted
## One unit of work: the shared task structure every agent uses.
## Field meanings are in vault/Data Model.md.

const PROPOSED := "proposed"    # in a plan I haven't approved yet
const QUEUED := "queued"        # approved, waiting for its dependencies or its agent
const WORKING := "working"      # a job is actually running
const REVIEW := "review"        # a deliverable is ready for me to check
const DONE := "done"
const BLOCKED := "blocked"      # needs me, or something is missing
const FAILED := "failed"        # ran out of retries
const CANCELLED := "cancelled"
const STATUSES := [PROPOSED, QUEUED, WORKING, REVIEW, DONE, BLOCKED, FAILED, CANCELLED]
const PRIORITIES := ["high", "medium", "low"]

## Which status changes make sense. Anything else is refused, which catches bugs early.
const TRANSITIONS := {
	PROPOSED: [QUEUED, CANCELLED],
	QUEUED: [WORKING, BLOCKED, CANCELLED],
	WORKING: [REVIEW, QUEUED, FAILED, BLOCKED, CANCELLED],
	REVIEW: [DONE, QUEUED, CANCELLED],
	DONE: [REVIEW],
	BLOCKED: [QUEUED, CANCELLED],
	FAILED: [QUEUED, CANCELLED],
	CANCELLED: [QUEUED],
}

var id := ""
var title := ""
var goal := ""
var project_id := ""
var plan_id := ""
var area := ""
var owner := ""
var kind := ""
var priority := "medium"
var due := ""
var estimate_min := 30
var depends_on: Array = []
var status := PROPOSED
var deliverable_id := ""
var attempts := 0
var blocker := ""
var log: Array = []
var created_at := ""
var updated_at := ""


func add_log(time: String, message: String) -> void:
	log.append({"t": time, "msg": message})


func can_move_to(new_status: String) -> bool:
	return new_status in TRANSITIONS.get(status, [])


## True when later tasks may use this task's result (see Decisions D12).
func is_ready_for_dependents() -> bool:
	return status == REVIEW or status == DONE


## True when nothing more will happen to this task.
func is_closed() -> bool:
	return status == DONE or status == CANCELLED


func to_dict() -> Dictionary:
	return {
		"id": id, "title": title, "goal": goal, "project_id": project_id,
		"plan_id": plan_id, "area": area, "owner": owner, "kind": kind,
		"priority": priority, "due": due, "estimate_min": estimate_min,
		"depends_on": depends_on.duplicate(), "status": status,
		"deliverable_id": deliverable_id, "attempts": attempts,
		"blocker": blocker, "log": log.duplicate(true),
		"created_at": created_at, "updated_at": updated_at,
	}


static func from_dict(d: Dictionary) -> Task:
	var t := Task.new()
	t.id = str(d.get("id", ""))
	t.title = str(d.get("title", ""))
	t.goal = str(d.get("goal", ""))
	t.project_id = str(d.get("project_id", ""))
	t.plan_id = str(d.get("plan_id", ""))
	t.area = str(d.get("area", ""))
	t.owner = str(d.get("owner", ""))
	t.kind = str(d.get("kind", ""))
	t.priority = str(d.get("priority", "medium"))
	t.due = str(d.get("due", ""))
	# JSON stores every number as a float, so convert back to whole numbers.
	t.estimate_min = int(d.get("estimate_min", 30))
	t.depends_on = Array(d.get("depends_on", [])).map(func(x): return str(x))
	t.status = str(d.get("status", PROPOSED))
	if t.status not in STATUSES:
		t.status = BLOCKED
		t.blocker = "Unknown status in save file"
	t.deliverable_id = str(d.get("deliverable_id", ""))
	t.attempts = int(d.get("attempts", 0))
	t.blocker = str(d.get("blocker", t.blocker))
	t.log = Array(d.get("log", [])).duplicate(true)
	t.created_at = str(d.get("created_at", ""))
	t.updated_at = str(d.get("updated_at", ""))
	return t
