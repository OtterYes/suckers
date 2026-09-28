# Goal

This note is written so any work session (or a `/goal`-style command) can start from it alone.
It links to [[Home]], [[Milestones]], and [[Decisions]].

## Active goal: M0, lock the design
**Status:** waiting for my confirmation.

Done when:
- [ ] I've read [[Product Summary]], [[MVP Scope]], and [[Milestones]] and said "approved", or listed changes
- [ ] [[Open Questions]] 1–3 are answered, or I've accepted the defaults

## Next goal: M1, the demo loop (vertical slice)
Build the smallest complete version of the workflow in **demo mode** (no AI calls, $0):

1. I type a goal, e.g. *"Prototype a Roblox obstacle game and plan three TikToks about building it"*.
2. The [[Coordinator]] proposes 3–8 tasks with owners, priorities, estimates, and dependencies.
3. I edit or uncheck tasks, then approve the plan.
4. Tasks go to the specialists' queues.
5. A simple 3D world shows each agent's **real** task state (idle, working, waiting for me, blocked).
6. The specialists (mock templates) produce editable deliverables that are **labeled as demo content**.
7. I review and edit the deliverables, mark tasks done, and save. After I close and reopen the app, everything is still there.

Done when (checks I can see):
- [ ] The app opens on Windows from the Godot editor with no errors
- [ ] I can do steps 1–7 above in under 5 minutes
- [ ] Every agent state in the 3D world matches the task board
- [ ] Every demo deliverable says it is a template and not AI output
- [ ] Every Luau draft says "Not tested in Roblox Studio"
- [ ] Automated headless tests pass (Claude runs them in the cloud; I can run them too)
- [ ] Closing and reopening the app keeps all tasks, deliverables, and edits

## Rules for every session
- Build on branch `claude/determined-brown-uqabil`, in the `ecosystem/` folder only. Never touch the To 1520 game files.
- Never say something was run or tested unless it actually was. Say what was checked and how.
- Demo and decorative behavior must always be labeled as such.
- Ask before anything that changes cost or scope (see [[Permissions and Safety]]).
- Update this note, [[Milestones]], and [[Decisions]] when things change.
