extends VBoxContainer
## Left column: type a goal, then review the coordinator's proposed plan.

var _goal: TextEdit
var _area: OptionButton
var _deadline: LineEdit
var _message: Label
var _review: VBoxContainer
var _checks := {}  # task_id -> CheckBox
var _shown_plan := ""

const AREA_CHOICES := [["", "Auto-detect"], ["roblox", "Roblox Lab"], ["student", "Student Hub"],
	["business", "Business Studio"], ["tiktok", "TikTok Studio"]]


func _ready() -> void:
	add_theme_constant_override("separation", 12)
	custom_minimum_size = Vector2(340, 0)
	var form := UiUtil.panel()
	var v := UiUtil.vbox()
	form.add_child(v)
	add_child(form)
	v.add_child(UiUtil.heading("New goal"))
	_goal = TextEdit.new()
	_goal.placeholder_text = "e.g. Prototype a Roblox obstacle game and plan three TikToks about building it."
	_goal.custom_minimum_size = Vector2(0, 90)
	_goal.wrap_mode = TextEdit.LINE_WRAPPING_BOUNDARY
	v.add_child(_goal)
	var row := UiUtil.hbox()
	_area = OptionButton.new()
	for i in AREA_CHOICES.size():
		_area.add_item(AREA_CHOICES[i][1], i)
	_area.tooltip_text = "Which area this goal belongs to. Auto-detect reads the words in your goal."
	row.add_child(UiUtil.expand(_area))
	_deadline = LineEdit.new()
	_deadline.placeholder_text = "Deadline YYYY-MM-DD"
	_deadline.tooltip_text = "Optional. The date everything should be finished."
	row.add_child(UiUtil.expand(_deadline))
	v.add_child(row)
	v.add_child(UiUtil.button("Plan it", _on_plan, "The Coordinator proposes tasks. Nothing runs until you approve."))
	_message = UiUtil.label("", 13, UiUtil.STATUS_COLOR.review)
	v.add_child(_message)

	var review_panel := UiUtil.panel()
	review_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_review = UiUtil.vbox()
	_review.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(_review)
	review_panel.add_child(scroll)
	add_child(review_panel)
	App.ws.changed.connect(func(kind, _id): if kind == "plan": _refresh.call_deferred())
	_refresh()


func _on_plan() -> void:
	var r := App.plan_goal(_goal.text, AREA_CHOICES[_area.selected][0], _deadline.text.strip_edges())
	if r.ok:
		_message.text = ""
		_goal.text = ""
	else:
		_message.text = r.question


func _latest_proposed() -> String:
	var newest := ""
	for p in App.ws.plans.values():
		if p.status == "proposed":
			newest = p.id  # plans are stored in the order they were made
	return newest


func _refresh() -> void:
	var plan_id := _latest_proposed()
	if plan_id == _shown_plan and plan_id != "":
		return
	_shown_plan = plan_id
	UiUtil.clear(_review)
	_checks.clear()
	_review.add_child(UiUtil.heading("Plan review"))
	if plan_id == "":
		_review.add_child(UiUtil.muted("No plan waiting. Type a goal above and press Plan it. The Coordinator will propose tasks here for you to check before anything runs."))
		return
	var plan: Dictionary = App.ws.plans[plan_id]
	_review.add_child(UiUtil.label("\"%s\"" % plan.goal, 14))
	for note in plan.notes:
		_review.add_child(UiUtil.muted("• " + note))
	_review.add_child(HSeparator.new())
	_review.add_child(UiUtil.muted("Uncheck anything you don't want."))
	var tasks := App.ws.tasks_for_plan(plan_id)
	var number := {}
	for i in tasks.size():
		number[tasks[i].id] = i + 1
	for i in tasks.size():
		var t: Task = tasks[i]
		var cb := CheckBox.new()
		cb.button_pressed = true
		cb.text = "%d. %s" % [i + 1, t.title]
		cb.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		cb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_checks[t.id] = cb
		_review.add_child(cb)
		var deps: Array = t.depends_on.map(func(d): return "#%d" % number.get(d, 0))
		var detail := "     %s · %s · %s priority%s" % [UiUtil.agent_name(t.owner),
			UiUtil.duration(t.estimate_min), t.priority,
			(" · after " + ", ".join(deps)) if not deps.is_empty() else ""]
		_review.add_child(UiUtil.muted(detail))
	var buttons := UiUtil.hbox()
	buttons.add_child(UiUtil.expand(UiUtil.button("Approve plan", _on_approve.bind(plan_id))))
	buttons.add_child(UiUtil.button("Discard", _on_discard.bind(plan_id)))
	_review.add_child(buttons)


func _on_approve(plan_id: String) -> void:
	var skip: Array = []
	for id in _checks:
		if not _checks[id].button_pressed:
			skip.append(id)
	App.approve_plan(plan_id, skip)


func _on_discard(plan_id: String) -> void:
	App.discard_plan(plan_id)
