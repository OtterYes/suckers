# Agent Ecosystem: notes for Claude

This folder holds a Godot 4 desktop app (Windows) that is planned but not yet built. It is separate from the To 1520 game at the repo root, and that game must not be changed.

- **Read `vault/Goal.md` first.** The Obsidian vault in `vault/` is the design source of truth. Follow its links as needed.
- Only work on the goal that `vault/Goal.md` marks as active. If it is still M0 (design), do not write app code.
- When a decision or milestone changes, update `vault/Goal.md`, `vault/Milestones.md`, and `vault/Decisions.md` in the same commit.
- Never claim something was run or tested unless it was. Luau is never "tested" unless the user ran it in Roblox Studio.
- Demo and decorative behavior must be labeled. Agent state is always derived from real task state.
- Ask the user before anything that changes cost or scope, or needs an account or API key.
- Keep API keys out of the repo.
- The user is learning (AP CSP Python). Explain choices in plain language.
