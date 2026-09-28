# Notes for Claude

## Decision Council (AI Agent Council)

The user built a five-agent "council" that takes a decision and gives back one practical recommendation.

- **Roles:** Coordinator, Researcher, Strategist, Critic, Verifier.
- **Workflow:** ask clarifying questions only when needed (at most three), then an independent round, cross-review, one targeted revision round, and a final report.
- **Final report:** the recommendation, supporting evidence (each claim labeled Sourced, Reasoning, or Assumption), a requirements check, risks, unresolved disagreements, what would change the answer, next steps, and council notes.
- **Rules:** agreement is not proof; never invent sources; say plainly when a tool or member is unavailable; ask before any external action or spending.

### Two versions

- **Option A (the user's choice):** Claude Code subagents, running on the user's Claude Max subscription ($100/month) with no API credits.
  - Files: `.claude/agents/council-{researcher,strategist,critic,verifier}.md` and `.claude/skills/council/SKILL.md`.
  - Run with `/council <decision>`. The main session acts as the Coordinator.
- **Option B (built, not used):** Claude Managed Agents with API credits, which are separate from the subscription.
  - Files: `ai-council/setup_council.py`, `ai-council/ask_council.py`, and `ai-council/prompts/`.
  - Full guide: `ai-council/README.md`.

Member instructions exist in two places: `ai-council/prompts/*.md` and `.claude/agents/council-*.md`. Keep them in sync. After changing the `.claude/` files, the user re-runs the installer to update their PC.

### User's PC setup (Windows, PowerShell, terminal)

1. Install Claude Code: `irm https://claude.ai/install.ps1 | iex`
2. Open a new PowerShell window and run `claude --version`.
3. Install the council into `%USERPROFILE%\.claude`:
   `irm https://raw.githubusercontent.com/OtterYes/suckers/claude/epic-faraday-o3kzvu/ai-council/install-council.ps1 | iex`
4. Start Claude Code: `mkdir $HOME\council -Force; cd $HOME\council; claude`. On first run, the user logs in with their Claude account in the browser.
5. Ask a question: `/council <decision>`

**Where it stands:**

- `claude --version` printed "'claude' is not recognized".
- The next step is `Test-Path "$env:USERPROFILE\.local\bin\claude.exe"`:
  - If it prints `False`, the install didn't happen. Run step 1 again.
  - If it prints `True`, add the folder to the user PATH, then open a new window:
    ```
    $currentPath = [Environment]::GetEnvironmentVariable('PATH', 'User')
    [Environment]::SetEnvironmentVariable('PATH', "$currentPath;$env:USERPROFILE\.local\bin", 'User')
    ```
- Steps 3 to 5 haven't been done yet. If anything fails, run `claude doctor`.

### Gotchas

- **Never have the user set `ANTHROPIC_API_KEY` on their PC.** When that variable is set, Claude Code bills API credits instead of the subscription. The installer detects it and asks before removing it.
- **Use the right branch.** The files are on branch `claude/epic-faraday-o3kzvu`, and the repo's default branch is different. Browse them at https://github.com/OtterYes/suckers/tree/claude/epic-faraday-o3kzvu/ai-council
- **The repo is public,** which is why the installer downloads from raw.githubusercontent.com without logging in.

### Working with this user

- Explain in plain language and give exact copy-paste commands.
- Verify setup steps against current official docs. Don't invent buttons or features.
- Ask before anything that spends money or acts outside the conversation.
- Keep browser steps to the ones that can't be avoided, such as logging in.
