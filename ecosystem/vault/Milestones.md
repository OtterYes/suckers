# Milestones

Each milestone ends with things **I can check myself**. At each one, Claude reports what works, what's still simulated, how to verify it, and what's next.

## M0: Design locked ✅ (2026-09-28)
- [x] I've approved this vault
- [x] [[Open Questions]] answered, or defaults accepted

## M1: Demo loop (vertical slice, $0) ← *current*
Steps, each small and runnable:
1. **Data core:** Workspace, Task, and Store (save, load, backups) + headless tests
2. **Coordinator + mock specialists:** goal → plan, templates for all 5 agents (Roblox the most complete)
3. **Runner:** queues, dependencies, one job per agent, simulated delay, cancel, retry
4. **Dashboard:** new goal, plan review, board, side panel with deliverable editor, mark done, save
5. **Graybox world:** HQ + 4 areas as simple shapes, 5 agents whose lights and labels show real states, click an agent → panel, Tab to swap views

Done when: every check in [[Goal]] passes, including close → reopen → everything is still there.

## M2: Scheduling v1
- Commitments (repeating), estimates, 7-day plan, **Today** view, conflict warnings, pin and move blocks, re-plan button
- Done when: I enter my real school week plus 2 deadlines plus a Roblox goal, get a week plan with nothing overlapping a commitment, and anything that can't fit is flagged instead of squeezed in. Tests cover the rules.

## M3: The world comes alive
- Agents walk between their desks and the HQ board, handoff packets fly between areas, the **!** marker appears for review, blocked shows red, the in-world legend (L), camera hotkeys 1–5, and "Give a task" from an agent's panel
- Swap point for [[Astra Model Specs]] models (graybox shapes stay as the fallback)
- Done when: every motion in the legend is triggered by a real event I can trace in the Activity log, and no agent ever animates "working" without a running job

## M4: One real AI (the Roblox Builder)
- *Asks me first:* which provider and which budget caps. Estimated cost is shown before I turn it on.
- API key in the local secrets file (outside the repo), usage and cost meter, cancel button, timeout, retries, hard budget stop, and a fallback to demo if there's no key or budget
- Done when: I ask the Builder for a Luau script and get a real draft that shows the model and cost, cancel works mid-request, and the meter matches the provider's usage page

## M5: Memory, sharing, and the creator loop
- Memory panel (view, edit, delete per project), share a project on purpose, export deliverables to this vault, and the Producer turns Roblox milestones into a TikTok dev-log series
- Done when: a finished Roblox milestone can become 3 TikTok script drafts in one click, and they show which Roblox deliverables they used

## Later
Astra art pass · Forward+ renderer · Tutor and Strategist depth · Rojo export · `.ics` export · TikTok CSV import · more agents only when there's a clear need
