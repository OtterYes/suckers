class_name Job
extends RefCounted
## One request to an AI provider (or the demo templates) for one task.
## The Runner creates it, a provider fills it in, and `finished` fires exactly once.
##
## Result dictionary:
##   {ok: bool, title, kind, body, source,
##    usage: {input_tokens, output_tokens, cost_usd}, error: String, cancelled: bool}

signal finished(result: Dictionary)

var task_id := ""
var agent_id := ""
var context := {}
var started_ms := 0
var done := false
var cancelled := false


func finish(result: Dictionary) -> void:
	if done:
		return  # a late answer after a cancel or timeout is ignored
	done = true
	finished.emit(result)


func cancel(reason: String) -> void:
	cancelled = true
	finish({"ok": false, "cancelled": true, "error": reason})
