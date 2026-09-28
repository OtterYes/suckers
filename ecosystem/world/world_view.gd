extends Control
## Puts the 3D world on screen with two overlays: controls help, and the
## legend that explains what every motion means (press L).

const WorldScene := preload("res://world/world_3d.gd")

signal open_board

var world: Node3D
var _legend: PanelContainer


func _ready() -> void:
	clip_contents = true
	var container := SubViewportContainer.new()
	container.stretch = true
	container.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(container)
	var viewport := SubViewport.new()
	viewport.physics_object_picking = true  # lets me click agents
	viewport.msaa_3d = Viewport.MSAA_4X
	container.add_child(viewport)
	world = WorldScene.new()
	viewport.add_child(world)
	world.agent_clicked.connect(func(id): App.select("agent", id))
	world.board_clicked.connect(func(): open_board.emit())

	var help := UiUtil.panel(8, Color(0.11, 0.12, 0.15, 0.85))
	help.add_child(UiUtil.label("Keys 1-5: HQ, Roblox, Student, Business, TikTok · right-drag: turn · wheel: zoom · WASD: move · click an agent", 12, UiUtil.TEXT, false))
	help.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	help.position = Vector2(10, -44)
	help.grow_vertical = Control.GROW_DIRECTION_BEGIN
	add_child(help)

	_legend = UiUtil.panel(12, Color(0.11, 0.12, 0.15, 0.92))
	var v := UiUtil.vbox(4)
	_legend.add_child(v)
	v.add_child(UiUtil.label("What you're seeing (L to hide)", 15))
	for line in [
		"Every motion is caused by a real event in the Activity log:",
		"• Walks to the HQ board and back: it was given a task",
		"• Ring stands up and spins, agent bobs: a job is running right now",
		"• Yellow \"!\": a result is waiting for your review",
		"• Red ring + shake: blocked or failed. Click it to read why.",
		"• Glowing ball flies between areas: a result was handed to another agent",
		"• Hop: you marked a task done",
		"• Standing still, flat grey ring: idle",
		"",
		"DEMO MODE: agents fill in templates. The few seconds of \"working\" are a",
		"simulated delay so you can follow the flow. No AI is running.",
		"Decoration: none yet. Anything decorative will be listed here.",
	]:
		v.add_child(UiUtil.label(line, 12, UiUtil.MUTED if line.begins_with("•") else UiUtil.TEXT, false))
	_legend.position = Vector2(10, 52)
	_legend.visible = false
	add_child(_legend)
	var legend_button := UiUtil.button("What do the motions mean? (L)", func(): _legend.visible = not _legend.visible)
	legend_button.position = Vector2(10, 10)
	add_child(legend_button)
	visibility_changed.connect(func(): world.active = is_visible_in_tree())


func _unhandled_key_input(event: InputEvent) -> void:
	if not is_visible_in_tree() or not event.is_pressed() or event.is_echo():
		return
	var n: int = event.keycode - KEY_1
	if n >= 0 and n < WorldScene.FOCUS_ORDER.size():
		world.focus_area(WorldScene.FOCUS_ORDER[n])
		get_viewport().set_input_as_handled()
	elif event.keycode == KEY_L:
		_legend.visible = not _legend.visible
		get_viewport().set_input_as_handled()
