class_name UiUtil
extends RefCounted
## Small helpers shared by the dashboard panels.
## Status is always shown as words, never by color alone (vault/Dashboard.md).

const STATUS_TEXT := {
	"proposed": "Proposed", "queued": "Queued", "working": "Working",
	"review": "Needs your review", "done": "Done", "blocked": "Blocked",
	"failed": "Failed", "cancelled": "Cancelled",
}
const STATUS_COLOR := {
	"proposed": Color("9aa4b2"), "queued": Color("9aa4b2"), "working": Color("5fb3f9"),
	"review": Color("f5c451"), "done": Color("6fcf8a"), "blocked": Color("ef6b6b"),
	"failed": Color("ef6b6b"), "cancelled": Color("7a808a"),
}
const AGENT_STATE_TEXT := {
	"working": "Working", "blocked": "Blocked", "waiting_for_you": "Review ready",
	"queued": "Work queued", "idle": "Idle",
}
const AGENT_STATE_COLOR := {
	"working": Color("5fb3f9"), "blocked": Color("ef6b6b"), "waiting_for_you": Color("f5c451"),
	"queued": Color("9aa4b2"), "idle": Color("7a808a"),
}

const BG := Color("1d2027")
const PANEL := Color("262a33")
const PANEL_LIGHT := Color("2f3440")
const TEXT := Color("e8e6e1")
const MUTED := Color("a3a9b4")
const ACCENT := Color("f28c38")


static func label(text: String, size := 0, color := Color(0, 0, 0, 0), wrap := true) -> Label:
	var l := Label.new()
	l.text = text
	if wrap:
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	if size > 0:
		l.add_theme_font_size_override("font_size", size)
	if color.a > 0:
		l.add_theme_color_override("font_color", color)
	return l


static func heading(text: String) -> Label:
	return label(text, 18, TEXT)


static func muted(text: String) -> Label:
	return label(text, 13, MUTED)


static func button(text: String, callback: Callable, tooltip := "") -> Button:
	var b := Button.new()
	b.text = text
	b.tooltip_text = tooltip
	b.pressed.connect(callback)
	return b


static func panel(padding := 12, color := PANEL) -> PanelContainer:
	var p := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = color
	sb.set_corner_radius_all(8)
	sb.set_content_margin_all(padding)
	p.add_theme_stylebox_override("panel", sb)
	return p


## A small colored tag with text, e.g. [DEMO] or [Working].
static func badge(text: String, color: Color) -> PanelContainer:
	var p := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = color.darkened(0.55)
	sb.border_color = color
	sb.set_border_width_all(1)
	sb.set_corner_radius_all(10)
	sb.content_margin_left = 8
	sb.content_margin_right = 8
	sb.content_margin_top = 2
	sb.content_margin_bottom = 2
	p.add_theme_stylebox_override("panel", sb)
	p.add_child(label(text, 12, color.lightened(0.35), false))
	return p


static func vbox(sep := 8) -> VBoxContainer:
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", sep)
	return v


static func hbox(sep := 8) -> HBoxContainer:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", sep)
	return h


static func expand(c: Control) -> Control:
	c.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return c


static func clear(node: Node) -> void:
	for child in node.get_children():
		node.remove_child(child)
		child.queue_free()


static func agent_name(agent_id: String) -> String:
	return AgentDefs.find(agent_id).get("name", agent_id)


static func duration(minutes: int) -> String:
	return Coordinator._duration(minutes)


static func mono_font() -> Font:
	var f := SystemFont.new()
	f.font_names = PackedStringArray(["Cascadia Mono", "Consolas", "DejaVu Sans Mono", "Liberation Mono", "monospace"])
	return f


static func make_theme(scale := 1.0) -> Theme:
	var t := Theme.new()
	t.default_font_size = int(15 * scale)
	t.set_stylebox("normal", "Button", _flat(PANEL_LIGHT))
	t.set_stylebox("hover", "Button", _flat(PANEL_LIGHT.lightened(0.1)))
	t.set_stylebox("pressed", "Button", _flat(ACCENT.darkened(0.3)))
	var focus := _flat(Color(0, 0, 0, 0))
	focus.border_color = ACCENT
	focus.set_border_width_all(2)
	t.set_stylebox("focus", "Button", focus)
	t.set_stylebox("normal", "LineEdit", _flat(Color("181b21")))
	t.set_stylebox("normal", "TextEdit", _flat(Color("181b21")))
	for s in ["normal", "pressed", "hover", "hover_pressed", "focus"]:
		t.set_stylebox(s, "CheckBox", StyleBoxEmpty.new() if s != "focus" else focus)
	t.set_color("font_color", "Label", TEXT)
	t.set_color("font_color", "Button", TEXT)
	return t


static func _flat(c: Color) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = c
	sb.set_corner_radius_all(6)
	sb.content_margin_left = 10
	sb.content_margin_right = 10
	sb.content_margin_top = 6
	sb.content_margin_bottom = 6
	return sb
