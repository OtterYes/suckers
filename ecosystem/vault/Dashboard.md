# Dashboard (2D)

The fast, accessible version of everything. **F1** shows it and **F2** shows the world. Tab is kept for moving between buttons ([[Decisions]] D17).

## Layout
- **Top bar:** mode badge (**DEMO: no AI calls, $0**), AI usage and estimated cost today and this month, Save (plus an autosave time), a Pending approvals counter, and View toggle
- **Left:** *New goal* (text, optional area, optional deadline, **Plan it**), then *Plan review* (checkboxes, editable titles, owners, estimates, **Approve** / **Discard**)
- **Center tabs:** **Today** · **Board** (columns by status, filter by project or area) · **Week** (see [[Scheduling]]) · **Activity**
- **Right side panel:** whatever is selected: a task (details plus the deliverable editor), an agent (profile, queue, memory), or an approval request

## Deliverable editor
- A readable text editor for Markdown and Luau, with a monospace font for code
- Labels at the top: *Demo template* or *AI draft (model, cost)*, *Edited by you*, and for Luau *Not tested in Roblox Studio*
- Buttons: **Save edits**, **Mark done**, **Ask for changes** (reruns with my note; AI in M4), **Copy**, and later **Export .md or .luau** (to a folder I choose; not built yet)
- Unsaved edits are kept automatically when I click away or mark the task done

## Accessibility
- Full keyboard use, with visible focus
- Status is never shown by color alone. It always has text or an icon too.
- UI scale setting (100–200%), high-contrast theme option
- Nothing important depends on the 3D view
