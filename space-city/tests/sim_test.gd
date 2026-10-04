## Headless checks for the station sim:
##   godot --headless --path space-city --script res://tests/sim_test.gd
extends SceneTree

var fails := 0

func check(ok: bool, what: String) -> void:
	print(("ok   " if ok else "FAIL ") + what)
	if not ok:
		fails += 1

func _init() -> void:
	var s := StationSim.create(7)
	check(s.people.size() == 5, "five residents to start")
	check(s.can_build("lab", Vector3i(5, 0, 0)) != "", "can't build a floating module")
	check(s.can_build("hall", Vector3i(0, -1, 0)) == "", "can build below the core")
	check(s.add_module("hall", Vector3i(0, -1, 0)) == "", "built a junction below")
	check(s.add_module("hall", Vector3i(0, -1, -1)) == "", "built a junction sideways off it")
	check(s.add_module("habitat", Vector3i(0, -2, -1)) == "", "built a habitat two levels down")
	s.credits += 400
	check(s.add_module("water", Vector3i(0, 0, -1)) == "", "built a second water recycler")
	check(s.add_module("farm", Vector3i(-1, 0, 1)) == "", "built a second farm")
	s.auto_assign()
	var r := s.route(Vector3i(1, 0, 0), Vector3i(0, -2, -1))
	check(r.size() == 4, "route from the reactor to the deep habitat is 4 steps: %d" % r.size())
	var ys := {}
	var acts := {}
	for i in 10 * 2400:
		s.tick(0.1)
		for p in s.people:
			ys[roundi(p["pos"].y)] = true
			acts[p["act"]] = true
		if i % 2400 == 0:
			print("day %d  power %.0f food %.0f water %.0f  credits %.0f  people %d  happy %.2f" % [s.day, s.res["power"], s.res["food"], s.res["water"], s.credits, s.people.size(), s.avg_happy()])
	check(s.people.size() >= 5, "the station kept its people for ten days (%d)" % s.people.size())
	check(s.people.size() > 5, "new people arrived once there were beds")
	check(ys.size() >= 3, "residents used three levels: %s" % str(ys.keys()))
	for a in ["walk", "work", "sleep", "eat", "drink"]:
		check(acts.has(a), "someone did: " + a)
	check(s.res["food"] > 0 and s.res["water"] > 0, "food and water never ran out at the end")
	var s2 := StationSim.from_dict(JSON.parse_string(JSON.stringify(s.to_dict())))
	check(s2.people.size() == s.people.size() and s2.modules.size() == s.modules.size(), "save and load keep people and modules")
	s2.tick(1.0)
	print("%d failed" % fails)
	quit(1 if fails else 0)
