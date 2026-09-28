# Permissions and Safety

## Agents may do freely
Draft, suggest, plan, schedule, write deliverables, and write notes to their own memory (which I can see).

## Needs my approval first (an Approval card appears)
- Publishing or posting anything
- Sending any message or email
- Spending money, including any real AI call over the per-task cap, and turning on real AI at all
- Deleting a project, deliverables, or memory in bulk (single deletes go to a Trash I can restore from)
- Writing files outside the app's own folder (e.g. exporting Luau to a Roblox project folder)
- Changing anything in a live Roblox game (not possible in the MVP)
- Connecting any new account or service

## Default limits (editable in Settings)
| Limit | Default |
|---|---|
| Runtime per task | 60 s real AI · 3 s simulated in demo |
| Retries per task | 1 |
| Delegation depth (agent hands to agent) | 1 hop, max 2 handoffs per plan step, never back and forth |
| Tasks per plan | 8 |
| Parallel jobs | 2 (1 per agent) |
| Real AI budget | $0.05 per task · $0.50 per day · $20 per month (hard stop) |

## Keys and secrets
- API keys never go in the repo or in project files.
- The key is stored in the app's user folder on my PC (`%APPDATA%\...`), in a separate `secrets.cfg` file. A `.gitignore` rule backs this up. Settings shows only the last 4 characters.
- (Later) Option to use Windows Credential Manager instead.

## Untrusted input
Documents I paste, files I import, and anything from the web are **data, not instructions**. Agents quote them and never obey commands inside them. The AI prompt says this explicitly, and imported text is visibly marked.

## Honesty rules (built into templates and prompts)
- Demo output is labeled as demo. AI output shows its model and cost.
- Luau is never marked tested unless I mark it tested after running it in Studio.
- Business notes separate **Verified** (with a source) from **Assumption**.
- No invented trends, stats, or analytics. The Producer says "I need data" instead.
