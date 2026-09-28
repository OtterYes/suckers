# Agent Ecosystem: notes for Claude

A Godot 4.7 desktop app for Windows. It's separate from the To 1520 game at the repo root, and that game must not be changed. `README.md` covers setup and layout.

- **Read `vault/Goal.md` first.** The Obsidian vault in `vault/` is the design source of truth. Only work on the goal it marks as active.
- When a decision or milestone changes, update `vault/Goal.md`, `vault/Milestones.md`, and `vault/Decisions.md` in the same commit.
- **Run the checks before every push:** `GODOT=<godot binary> ./run_tests.sh` (unit tests plus the end-to-end run). For UI changes, also take screenshots: `xvfb-run -a -s "-screen 0 1440x900x24" $GODOT --path . --rendering-driver opengl3 -- --save-dir=<empty dir> --shot=<out dir> [--scenario=world]`, and look at them.
- Architecture rules: the UI and world only call `App` actions and redraw on `Workspace.changed`. Agent state comes only from `Workspace.agent_state()`. Only the `Runner` starts jobs. Providers implement `AIProvider`.
- Never claim something was run or tested unless it was. Luau is never "tested" unless the user ran it in Roblox Studio. Claude can't run the app on Windows, only on Linux in the cloud.
- Demo and decorative behavior must be labeled.
- Ask the user before anything that changes cost or scope, or needs an account or API key. Keep API keys out of the repo.
- The user is learning (AP CSP Python). Explain choices in plain language, and comment code at the same density as the existing files.
