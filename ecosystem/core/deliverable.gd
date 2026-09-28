class_name Deliverable
extends RefCounted
## Something a task produced: a doc, a checklist, a script, or Luau code.

const SOURCE_DEMO := "demo-template"

var id := ""
var task_id := ""
var title := ""
var kind := "doc"          # doc, checklist, script, luau
var body := ""             # Markdown, or code for kind == "luau"
var source := SOURCE_DEMO  # "demo-template" or "ai:<model>"
var edited_by_me := false
var tested := false        # Luau: only true after I say it ran in Roblox Studio
var created_at := ""
var updated_at := ""


func is_demo() -> bool:
	return source == SOURCE_DEMO


## Short labels shown above the editor so I always know what I'm reading.
func labels() -> PackedStringArray:
	var out := PackedStringArray()
	out.append("Demo template (not AI output)" if is_demo() else "AI draft: " + source.trim_prefix("ai:"))
	if edited_by_me:
		out.append("Edited by you")
	if kind == "luau":
		out.append("Tested in Roblox Studio (you confirmed)" if tested else "Not tested in Roblox Studio")
	return out


func to_dict() -> Dictionary:
	return {
		"id": id, "task_id": task_id, "title": title, "kind": kind, "body": body,
		"source": source, "edited_by_me": edited_by_me, "tested": tested,
		"created_at": created_at, "updated_at": updated_at,
	}


static func from_dict(d: Dictionary) -> Deliverable:
	var x := Deliverable.new()
	x.id = str(d.get("id", ""))
	x.task_id = str(d.get("task_id", ""))
	x.title = str(d.get("title", ""))
	x.kind = str(d.get("kind", "doc"))
	x.body = str(d.get("body", ""))
	x.source = str(d.get("source", SOURCE_DEMO))
	x.edited_by_me = bool(d.get("edited_by_me", false))
	x.tested = bool(d.get("tested", false))
	x.created_at = str(d.get("created_at", ""))
	x.updated_at = str(d.get("updated_at", ""))
	return x
