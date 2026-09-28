class_name TestCase
extends RefCounted
## Base class for tests. Any method whose name starts with "test_" is run.
## Tests may use `await`. `tree` is the running SceneTree, for timers and nodes.

var tree: SceneTree
var failures: Array = []
var checks := 0


func check(condition: bool, message: String) -> void:
	checks += 1
	if not condition:
		failures.append(message)


func check_eq(actual, expected, message: String) -> void:
	checks += 1
	if actual != expected:
		failures.append("%s (expected %s, got %s)" % [message, str(expected), str(actual)])


## A clock that starts at a fixed time and moves forward one second per call,
## so tests always see the same timestamps.
func fixed_clock(start := "2026-09-28T16:00:00") -> Callable:
	var state := {"unix": Time.get_unix_time_from_datetime_string(start)}
	return func() -> String:
		state.unix += 1
		return Time.get_datetime_string_from_unix_time(state.unix)


## A fresh, empty folder for save/load tests.
func temp_dir(label: String) -> String:
	var path := "user://test_runs/%s_%d/" % [label, Time.get_ticks_usec()]
	DirAccess.make_dir_recursive_absolute(path)
	return path


## Waits (frame by frame) until `condition` returns true, or gives up after `max_sec`.
func wait_until(condition: Callable, max_sec := 5.0) -> bool:
	var give_up := Time.get_ticks_msec() + int(max_sec * 1000)
	while Time.get_ticks_msec() < give_up:
		if condition.call():
			return true
		await tree.process_frame
	return condition.call()


func wait(seconds: float) -> void:
	await tree.create_timer(seconds).timeout
