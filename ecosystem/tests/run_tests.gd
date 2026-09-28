extends SceneTree
## Runs every tests/test_*.gd file without opening a window.
##   godot --headless --path ecosystem -s tests/run_tests.gd
## Add "-- <name>" at the end to run only files whose name contains <name>.
## Exits with code 0 when everything passes, 1 otherwise.


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var only := ""
	var user_args := OS.get_cmdline_user_args()
	if user_args.size() > 0:
		only = user_args[0]
	var files: Array = []
	for f in DirAccess.get_files_at("res://tests"):
		if f.begins_with("test_") and f.ends_with(".gd") and f != "test_case.gd" and (only == "" or only in f):
			files.append(f)
	files.sort()
	var passed := 0
	var failed := 0
	var total_checks := 0
	for f in files:
		var script: GDScript = load("res://tests/" + f)
		for m in script.get_script_method_list():
			var method_name: String = m.name
			if not method_name.begins_with("test_"):
				continue
			var t: TestCase = script.new()
			t.tree = self
			await t.call(method_name)
			total_checks += t.checks
			if t.failures.is_empty():
				passed += 1
				print("  ok    %s :: %s" % [f, method_name])
			else:
				failed += 1
				print("  FAIL  %s :: %s" % [f, method_name])
				for msg in t.failures:
					print("        - " + msg)
	_remove_tree("user://test_runs")
	print("\n%d passed, %d failed (%d checks)" % [passed, failed, total_checks])
	quit(0 if failed == 0 else 1)


## Deletes the scratch folders the tests made.
func _remove_tree(path: String) -> void:
	for sub in DirAccess.get_directories_at(path):
		_remove_tree(path.path_join(sub))
	for f in DirAccess.get_files_at(path):
		DirAccess.remove_absolute(path.path_join(f))
	DirAccess.remove_absolute(path)
