# Scheduling (first focus)

The [[Coordinator]] is a real planner, not just a task router. It is **rule-based**: it follows the same steps every time, costs $0, and can explain every placement.

## What I give it
- **Commitments:** school hours, sleep, practice or work shifts, anything fixed. These can repeat weekly.
- **Deadlines:** due dates on tasks (for example, from a school assignment).
- **Estimates:** minutes per task. The coordinator suggests them and I can change them.
- **Preferences:** longest session length (default 90 min), shortest (25 min), a daily cap on hours for non-school work, and days off.

## How it builds the week
1. Find **free blocks** for the next 7 days: awake hours minus commitments, with a 15-minute buffer around each commitment.
2. Sort ready tasks by **urgency**: school deadlines first when they're within 3 days, then earlier due date, then priority, then dependency order.
3. Place each task in the earliest free block that fits. Long tasks are split into sessions (e.g. 120 min becomes 90 + 30).
4. **Never overbook silently.** If a task can't fit before its due date, it's flagged as a *conflict*, with options: move the date, cut scope, lower priority, or drop something else.
5. **Pinned** blocks (ones I placed by hand) are never moved.
6. **Re-plan** runs when I click it, or when something is done early or late. It never runs silently in the middle of my day.

## What I see
- **Today:** my commitments and work blocks in order, the top 3 priorities, and conflicts.
- **Week:** a 7-column view with color by area. Drag a block to move and pin it.
- Every block shows the task, its agent, and **why** it was placed there ("due Friday, high priority").

## Roblox + school example
Goal: "Prototype an obby by Sunday." With school Mon–Fri 8–3 and homework due Wednesday, the plan puts homework on Monday and Tuesday evenings, and Roblox sessions on Wednesday and Thursday evenings plus a longer Saturday block, with the playtest on Sunday.

## Later (not MVP)
- `.ics` export so the plan shows in Google or Outlook Calendar (a file I import myself; no account access)
- Spaced review for study topics
- Learning my real speed from how long tasks actually take
