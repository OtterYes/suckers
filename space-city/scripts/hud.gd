## The screen around the station: supplies along the top, the build bar along the bottom,
## the station log on the left, and whoever or whatever you picked on the right.
class_name Hud
extends CanvasLayer

var game  # main.gd
var _bars := {}
var _info: Label
var _clock: Label
var _speed_btns := []
var _build_btns := {}
var _side: PanelContainer
var _side_box: VBoxContainer
var _log: Label
var _toast: Label
var _toast_t := 0.0
var _slow := 0.0
var _confirm: ConfirmationDialog

const ACT := {"walk": "Walking", "work": "Working", "eat": "Eating", "drink": "Drinking", "sleep": "Sleeping", "rest": "Taking a break", "fire": "Fighting a fire", "idle": "Deciding"}

func _ready() -> void:
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	var theme := Theme.new()
	theme.default_font_size = 15
	root.theme = theme

	# top bar
	var top := _panel(root)
	top.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE, Control.PRESET_MODE_MINSIZE, 8)
	var hb := HBoxContainer.new()
	hb.add_theme_constant_override("separation", 14)
	top.add_child(hb)
	for k in [["power", "Power", "#FFC933"], ["food", "Food", "#6BCB77"], ["water", "Water", "#5C9DFF"]]:
		var l := Label.new()
		l.text = k[1]
		hb.add_child(l)
		var pb := ProgressBar.new()
		pb.custom_minimum_size = Vector2(110, 18)
		pb.show_percentage = false
		var fill := StyleBoxFlat.new()
		fill.bg_color = Color(k[2])
		fill.set_corner_radius_all(4)
		pb.add_theme_stylebox_override("fill", fill)
		pb.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		hb.add_child(pb)
		_bars[k[0]] = pb
	_info = Label.new()
	hb.add_child(_info)
	var sp := Control.new()
	sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hb.add_child(sp)
	_clock = Label.new()
	hb.add_child(_clock)
	for s in [[0, "Pause"], [1, "1×"], [3, "3×"], [10, "10×"]]:
		var b := Button.new()
		b.text = s[1]
		b.toggle_mode = true
		b.focus_mode = Control.FOCUS_NONE
		b.pressed.connect(func():
			if s[0] == 0:
				game.paused = not game.paused
			else:
				game.speed = s[0]
				game.paused = false
			refresh())
		hb.add_child(b)
		_speed_btns.append([s[0], b])
	var nb := Button.new()
	nb.text = "New station"
	nb.focus_mode = Control.FOCUS_NONE
	hb.add_child(nb)
	_confirm = ConfirmationDialog.new()
	_confirm.dialog_text = "Start a new station? This one will be replaced."
	_confirm.confirmed.connect(func(): game.new_station(); refresh())
	add_child(_confirm)
	nb.pressed.connect(func(): _confirm.popup_centered())

	# build bar
	var bot := _panel(root)
	bot.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT, Control.PRESET_MODE_MINSIZE, 8)
	bot.grow_vertical = Control.GROW_DIRECTION_BEGIN
	var bb := HBoxContainer.new()
	bot.add_child(bb)
	var bl := Label.new()
	bl.text = "Build "
	bb.add_child(bl)
	for k in StationSim.BUILDABLE:
		var D: Dictionary = StationSim.TYPES[k]
		var b := Button.new()
		b.text = "%s\n%d cr" % [D["name"], D["cost"]]
		b.toggle_mode = true
		b.focus_mode = Control.FOCUS_NONE
		b.add_theme_color_override("font_color", D["col"].lerp(Color.WHITE, 0.35))
		b.tooltip_text = _tip(k)
		b.pressed.connect(func():
			game.view.build_kind = "" if game.view.build_kind == k else k
			game.view.selected = 0
			game.view.selected_mod = 0
			if game.view.build_kind != "":
				toast("Click a glowing spot next to the station to attach a %s. Hold Shift to keep building." % D["name"])
			refresh())
		bb.add_child(b)
		_build_btns[k] = b

	# the picked resident or module
	_side = _panel(root)
	_side.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT, Control.PRESET_MODE_MINSIZE, 8)
	_side.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	_side.offset_top = 64
	_side.custom_minimum_size = Vector2(300, 0)
	_side_box = VBoxContainer.new()
	_side.add_child(_side_box)

	_log = Label.new()
	_log.position = Vector2(14, 64)
	_log.custom_minimum_size = Vector2(360, 0)
	_log.autowrap_mode = TextServer.AUTOWRAP_WORD
	_log.add_theme_color_override("font_color", Color("#A6B5CC"))
	_log.add_theme_color_override("font_shadow_color", Color.BLACK)
	root.add_child(_log)

	var help := Label.new()
	help.text = "Left-drag or right-drag: turn   Shift+right or middle drag: pan   Wheel: zoom\nW A S D: move   Q E: down and up   PgUp PgDn: hide upper levels   F: follow   Space: pause   1 2 3: speed"
	help.add_theme_font_size_override("font_size", 12)
	help.add_theme_color_override("font_color", Color("#7F8EA6"))
	help.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	help.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT, Control.PRESET_MODE_MINSIZE, 10)
	root.add_child(help)
	help.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	help.grow_vertical = Control.GROW_DIRECTION_BEGIN

	_toast = Label.new()
	_toast.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM, Control.PRESET_MODE_MINSIZE, 110)
	_toast.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_toast.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_toast.add_theme_color_override("font_color", Color("#FFC933"))
	_toast.add_theme_color_override("font_shadow_color", Color.BLACK)
	_toast.add_theme_font_size_override("font_size", 17)
	root.add_child(_toast)
	refresh()

func _panel(root: Control) -> PanelContainer:
	var p := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.04, 0.07, 0.13, 0.86)
	sb.border_color = Color("#24324A")
	sb.set_border_width_all(1)
	sb.set_corner_radius_all(10)
	sb.set_content_margin_all(9)
	p.add_theme_stylebox_override("panel", sb)
	root.add_child(p)
	return p

func _tip(k: String) -> String:
	var D: Dictionary = StationSim.TYPES[k]
	var s: String = {"hall": "A junction: connects modules so the station can grow in any direction.",
		"reactor": "Makes power. Workers use Strength.", "farm": "Grows food; residents eat here. Workers use Agility.",
		"water": "Recycles water; residents drink here. Workers use Perception.", "habitat": "Four beds. More beds bring more residents.",
		"lab": "Earns credits. Workers use Intellect.", "lounge": "Residents relax here. Workers use Charisma to lift everyone's mood."}[k]
	return s

func typing() -> bool:
	return false

func toast(s: String) -> void:
	_toast.text = s
	_toast_t = 3.0

func _process(dt: float) -> void:
	_toast_t -= dt
	_toast.visible = _toast_t > 0.0
	_slow -= dt
	if _slow <= 0.0:
		_slow = 0.25
		refresh()

func _bar(v: float) -> ProgressBar:
	var pb := ProgressBar.new()
	pb.custom_minimum_size = Vector2(140, 14)
	pb.show_percentage = false
	pb.value = v * 100.0
	var fill := StyleBoxFlat.new()
	fill.bg_color = Color("#FF5C5C") if v > 0.7 else Color("#FFC933") if v > 0.4 else Color("#6BCB77")
	pb.add_theme_stylebox_override("fill", fill)
	pb.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	return pb

func _row(label: String, right) -> void:
	var h := HBoxContainer.new()
	var l := Label.new()
	l.text = label
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(l)
	if right is String:
		var r := Label.new()
		r.text = right
		h.add_child(r)
	else:
		h.add_child(right)
	_side_box.add_child(h)

func _text(s: String, dim := false, size := 15) -> Label:
	var l := Label.new()
	l.text = s
	l.autowrap_mode = TextServer.AUTOWRAP_WORD
	l.custom_minimum_size = Vector2(280, 0)
	l.add_theme_font_size_override("font_size", size)
	if dim:
		l.add_theme_color_override("font_color", Color("#8FA0B8"))
	_side_box.add_child(l)
	return l

func refresh() -> void:
	if game == null or game.sim == null:
		return
	var sim: StationSim = game.sim
	for k in _bars:
		_bars[k].value = sim.res[k]
	_info.text = "Credits %d    Residents %d/%d    Mood %d%%" % [int(sim.credits), sim.people.size(), sim.beds(), roundi(sim.avg_happy() * 100)]
	var h := sim.hour()
	_clock.text = "Day %d  %02d:%02d%s" % [sim.day + 1, int(h), int(fmod(h, 1.0) * 60), "  night" if sim.is_night() else ""]
	for s in _speed_btns:
		s[1].set_pressed_no_signal(game.paused if s[0] == 0 else (not game.paused and game.speed == s[0]))
	for k in _build_btns:
		_build_btns[k].set_pressed_no_signal(game.view.build_kind == k)
		_build_btns[k].disabled = sim.credits < StationSim.TYPES[k]["cost"] and game.view.build_kind != k
	_log.text = "\n".join(sim.log_lines.slice(0, 7))
	if game.view.slice < 99:
		_log.text = "Showing levels up to %d (PgUp to show more)\n\n" % game.view.slice + _log.text

	for c in _side_box.get_children():
		c.queue_free()
	var p = game._person(game.view.selected)
	var m = sim.by_id.get(game.view.selected_mod)
	_side.visible = p != null or m != null
	if p != null:
		_text(p["name"], false, 19)
		var goal = sim.by_id.get(p["goal"].get("mod", 0))
		_text(ACT.get(p["act"], p["act"]) + (" to the " + StationSim.TYPES[goal["k"]]["name"] if p["act"] == "walk" and goal != null else ""), true)
		var g := GridContainer.new()
		g.columns = 5
		for s in StationSim.STATS:
			var l := Label.new()
			l.text = "%s %d" % [s, p["st"][s]]
			l.tooltip_text = StationSim.STAT_NAMES[s]
			l.mouse_filter = Control.MOUSE_FILTER_PASS
			l.custom_minimum_size = Vector2(54, 0)
			g.add_child(l)
		_side_box.add_child(g)
		_row("Hunger", _bar(p["need"]["hunger"]))
		_row("Thirst", _bar(p["need"]["thirst"]))
		_row("Tired", _bar(p["need"]["tired"]))
		_row("Mood", "%d%%" % roundi(p["happy"] * 100))
		_row("Health", "%d%%" % roundi(p["hp"] * 100))
		var job = sim.by_id.get(p["job"])
		_row("Job", StationSim.TYPES[job["k"]]["name"] if job != null else "none")
		var home = sim.by_id.get(p["home"])
		_row("Bed", StationSim.TYPES[home["k"]]["name"] if home != null else "none")
		_text("Click a Reactor, Hydroponics, Water Recycler, Lab, or Lounge to give %s a job there. Press F to follow." % p["name"].split(" ")[0], true, 13)
	elif m != null:
		var D: Dictionary = StationSim.TYPES[m["k"]]
		_text(D["name"], false, 19)
		_text(_tip(m["k"]) if m["k"] != "core" else "The heart of the station. Everything else grows from here.", true, 13)
		if D["cap"] > 0:
			var ws := sim.workers(m)
			_row("Workers", "%d/%d" % [ws.size(), D["cap"]])
			for w in ws:
				_row("  " + w["name"], "%s %d" % [D["stat"], w["st"][D["stat"]]])
		if D["beds"] > 0:
			_row("Beds", "%d/%d" % [sim.residents_of(m).size(), D["beds"]])
		if m["fire"] > 0.0:
			_text("On fire! Residents nearby will put it out.", false)
		var c: Vector3i = m["cell"]
		_row("Position", "%d, %d, %d" % [c.x, c.y, c.z])
