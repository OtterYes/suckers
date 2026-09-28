class_name MockProvider
extends AIProvider
## Demo mode. Fills in templates after a short *simulated* delay, so the world can
## show the task moving through its states. The delay is labeled as simulated in
## the app, and nothing is sent anywhere.

var tree: SceneTree
var delay_sec := 2.5
## Tests can make a task kind fail on purpose, to check retries and error handling.
var fail_kinds: Array = []


func _init(scene_tree: SceneTree, delay := 2.5) -> void:
	tree = scene_tree
	delay_sec = delay


func source_name() -> String:
	return Deliverable.SOURCE_DEMO


func is_demo() -> bool:
	return true


func start(job: Job) -> void:
	if delay_sec > 0.0:
		await tree.create_timer(delay_sec).timeout
	else:
		await tree.process_frame
	if job.done:
		return
	if str(job.context.task.kind) in fail_kinds:
		job.finish({"ok": false, "error": "Simulated failure (test)"})
		return
	var out := DemoTemplates.render(job.context)
	out.merge({"ok": true, "source": source_name(),
		"usage": {"input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0}})
	job.finish(out)
