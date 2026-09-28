# Decision Council

Five Claude agents that look at a decision from different angles and give you one practical recommendation.

There are two ways to run it:

| | **Option A: Claude subscription** | **Option B: API credits** |
|---|---|---|
| Pays with | Your Claude Pro or Max plan's usage limits | Pay-as-you-go credits on platform.claude.com |
| Runs in | Claude Code (terminal, desktop app, or claude.ai/code) | The Python scripts in this folder |
| Extra cost | None beyond your plan | Per question (with a spending cap) |
| How | Type `/council your decision` | `python ask_council.py "your decision"` |

## Option A: Run it on your Claude subscription

Pro and Max plans include Claude Code. Claude Code usage counts against the same usage limits as the Claude apps. The council is set up as Claude Code **subagents**:

- `.claude/agents/council-researcher.md`, `council-strategist.md`, `council-critic.md`, `council-verifier.md`: the four members. The Researcher and Verifier have web search and web fetch. The Strategist and Critic can only read files.
- `.claude/skills/council/SKILL.md`: the `/council` command. When you use it, your main Claude Code session acts as the Coordinator.

These files are at the top of the repository, not in this folder.

To use it:

1. Open Claude Code in this repository: run `claude` in the repository folder, open it in the desktop app, or start a session for it at claude.ai/code. Sign in with your Claude account, not an API key.
2. Type `/council` followed by your decision, for example:
   `/council Should I switch jobs? Offer is 15% more pay but a 1-hour commute. I value time with family.`
3. The Coordinator may ask you up to three questions, then runs the rounds and writes the report in the chat.

Two notes:
- **Start a new session after you first get these files.** Claude Code only picks up a new `.claude/agents` folder when a session starts.
- **Don't set the `ANTHROPIC_API_KEY` environment variable on the same computer.** If it's set, Claude Code uses the key and bills your API credits instead of your subscription.

Five agents at once use your plan's limits faster than a normal chat. If you reach a limit, Claude Code shows your options, such as waiting for the reset.

## Option B: Run it with API credits (Claude Managed Agents)

The rest of this README covers Option B. It uses the platform's hosted multi-agent feature and pay-as-you-go API credits, which are separate from any Claude subscription. You run the council from your computer's terminal; you don't need a browser after the one-time setup in step 3.

| Agent | What it does | Tools |
|---|---|---|
| **Coordinator** | Clarifies the goal, assigns work, runs the review rounds, and writes the final answer | Can only delegate to the four members below |
| **Researcher** | Finds the facts, with a source link for each | Web search and web fetch |
| **Strategist** | Lays out the options and their tradeoffs | None (reasons from what it is given) |
| **Critic** | Challenges assumptions, finds risks and missing information | None |
| **Verifier** | Checks key claims itself and checks the recommendation against your requirements | Web search and web fetch |

This uses **Claude Managed Agents** multiagent orchestration, the multi-agent feature on the Claude Developer Platform (platform.claude.com). It is currently in **beta**.

### Where things run

- **On your PC:** the two Python scripts, the agent instructions (the `prompts/` folder), and the saved reports.
- **On Anthropic's servers:** the AI models themselves, the web searches, and the platform that passes messages between the five agents. Every Claude model runs this way; none of them can run on your own machine.

---

## How a question flows

1. You type your decision in the terminal.
2. The **Coordinator** asks you up to three questions, but only if a missing fact would change the answer. Otherwise it writes down its assumptions and continues.
3. **Independent round:** all four members work on the decision at the same time, without seeing each other's work.
4. **Cross-review:** each member reads the other members' reports and says what it agrees with, what it disputes, and why.
5. **One revision round:** the Coordinator drafts a recommendation. The Verifier checks the draft against your requirements, and the Coordinator can ask other members for specific fixes. There is only one such round.
6. **Final report:** Recommendation, Why, Supporting evidence (each claim marked Sourced, Reasoning, or Assumption, with the Verifier's status), Requirements check, Risks, Unresolved disagreements, What would change the answer, Next steps, and Council notes (anything that failed).

---

## Setup

### Step 1: Get the files onto your PC

If you have git:

```
git clone -b claude/epic-faraday-o3kzvu https://github.com/OtterYes/suckers.git
cd suckers/ai-council
```

Everything you need is in the `ai-council` folder. If you prefer, copy that folder anywhere on your computer.

### Step 2: Install Python and the Anthropic library

1. You need **Python 3.10 or newer**. To check, open a terminal (on Windows, PowerShell) and run `python --version`. If Python is missing, install it from python.org. On Windows, tick "Add python.exe to PATH" during installation.
2. In the `ai-council` folder, run:

   ```
   python -m pip install -r requirements.txt
   ```

   On Windows, if `python` isn't recognized, use `py` instead: `py -m pip install -r requirements.txt`. The same applies to every `python` command below.

### Step 3: Get an API key (one-time, in a browser)

You need a browser for this step only. Creating an account, adding credits, and creating a key are all done on the website.

1. Sign in or sign up at **platform.claude.com** and make sure your account has credits.
2. Go to **platform.claude.com/settings/keys** and create an API key. Copy it right away, because you can't view it again later.
3. Save the key on your PC as an environment variable called `ANTHROPIC_API_KEY`:

   **Windows (PowerShell):**

   ```
   setx ANTHROPIC_API_KEY "paste-your-key-here"
   ```

   Then **close PowerShell and open a new window**, because the key only appears in new windows.

   **macOS / Linux:**

   ```
   echo 'export ANTHROPIC_API_KEY="paste-your-key-here"' >> ~/.zshrc
   source ~/.zshrc
   ```

   If your terminal uses bash rather than zsh, use `~/.bashrc` instead of `~/.zshrc`.

Never paste your key into the prompt files or the scripts.

### Step 4: Create the council (one-time, free)

```
python setup_council.py
```

This creates the five agents and a sandbox configuration on the platform. It saves their IDs in `council_ids.json`. Creating them costs nothing; you pay only when you ask a question.

---

## Asking a question

Short question:

```
python ask_council.py "Should I switch jobs? Offer is 15% more pay but a 1-hour commute. I value time with family."
```

Long question: copy `question_template.txt` to a new file (for example `my_question.txt`), fill it in, then run:

```
python ask_council.py --file my_question.txt
```

What happens next:

1. The script shows the **spending cap** (default $3.00) and asks `Start? [y/N]`. Nothing is spent until you type `y`.
2. While the council works, you'll see progress such as `[Coordinator -> Researcher: task sent]` and `[Critic -> Coordinator: report received]`, followed by the Coordinator's messages.
3. If the Coordinator asks you questions, type your answer at the `Reply to the council` prompt. When you're finished, press **Enter** on an empty line.
4. The full report is saved in the `reports/` folder. It includes every member's report in an appendix, so you can check each member's work yourself.

To stop the council at any time, press **Ctrl+C**. Everything produced so far is saved.

---

## Where each part lives

| File | What it is | When you'd edit it |
|---|---|---|
| `prompts/coordinator.md` | The Coordinator's instructions: the workflow, the report format, and the rules | To change the process or the report layout |
| `prompts/researcher.md`, `strategist.md`, `critic.md`, `verifier.md` | Each member's instructions | To change how a member works |
| `setup_council.py` | The configuration that connects everything: which model each agent uses, which tools each member gets, and the Coordinator's list of members it can delegate to | To change models, thinking effort, or tools |
| `ask_council.py` | Runs a question: confirms the budget, starts the session, shows progress, asks for your approval when needed, and saves the report | Normally never |
| `council_ids.json` | Created by setup. The IDs of your agents and environment | Never. Delete it only if you want setup to create a fresh council |
| `reports/` | Your saved reports | Never |

**After editing any file in `prompts/`, or the settings at the top of `setup_council.py`, run `python setup_council.py` again.** It updates your agents in place. It doesn't create duplicates.

---

## Cost

You pay list prices for what each question uses:

- **Model usage.** Claude Opus 5.5, which every agent uses by default, costs $4 per million input tokens and $20 per million output tokens.
- **Web searches** cost $10 per 1,000 searches. Web fetch has no extra charge beyond tokens.
- **Session time** costs $0.08 per hour, counted only while the council is actively working.

The cost depends on how much research a question needs, so I can't give you a reliable per-question figure. The script shows the actual cost at the end of each run, so check the first few to get a feel for it.

Built-in cost controls:

- **Spending cap per question.** It defaults to $3.00; change it with `--budget 5` (for $5). The platform enforces the cap and pauses the council when it's reached. The last request in progress can go slightly over. The script then asks whether to allow more. If you say no, it stops and saves what the council has produced.
- **To cut costs,** open `setup_council.py`, set `MEMBER_MODEL = "claude-sonnet-5"` ($2 / $10 per million tokens), and run setup again. The Coordinator stays on Opus 5.5.

---

## How the rules you asked for are enforced

| Rule | How |
|---|---|
| Ask before external actions (sending messages, publishing, spending money) | The agents have **no tools that can do these things**: only web search and web fetch, which read pages. Their instructions also forbid such actions and tell them to list any action as a next step for *you*. If the platform ever pauses on an action that needs approval, the script shows it and asks `Allow it? [y/N]`. |
| Ask before spending money | The script asks before every run and before raising a cap, and the platform enforces the cap. |
| Never invent sources; agreement isn't proof | This is written into every agent's instructions. The Verifier must open sources itself rather than trust other members. The final report labels every claim as Sourced, Reasoning, or Assumption. |
| Say clearly when a tool or agent is unavailable | Agents must report failed tools in their reports, and the Coordinator lists them under "Council notes". Platform errors are printed as `[Platform error: ...]` and saved in the report. |
| Clarify only when necessary | The Coordinator may ask at most three questions, and only if the answer would change the recommendation. |
| Independent work → cross-review → one revision round | Written into the Coordinator's instructions. Members can't see each other's work unless the Coordinator passes it on, so the first round is independent by design. |

## Limitations

- **The workflow is followed by instruction, not enforced by code.** The Coordinator decides when to delegate. The appendix of each report shows every member report in the order it arrived, so you can confirm that all the rounds happened.
- **The Strategist and Critic have no web access,** by design. They mark any fact they rely on as unchecked, so the Researcher and Verifier can check it.
- **Managed Agents is in beta,** so the platform may change. If a script starts failing after a platform update, the error message is shown in the terminal.
- **Web sources can be wrong or out of date.** The council reports dates and confidence levels, but for high-stakes decisions (medical, legal, financial), check the key points with a qualified professional.

## Troubleshooting

| Message | Fix |
|---|---|
| `Your API key was rejected` | Check step 3. On Windows, make sure you opened a **new** PowerShell window after `setx`. |
| `council_ids.json not found` | Run `python setup_council.py` first. |
| `The platform refused the request...` | Your account or workspace may not have access to Managed Agents. Check that the key comes from the right workspace and that the account has credits. |
| `[Platform error: ...]` during a run | This is a temporary platform problem, such as an overloaded model. The platform retries automatically. If the run stops, ask again. |
| `Could not reach api.anthropic.com` | Check your internet connection. |

## Optional: watching a session in the browser

You never need this. If you're curious, the Console at platform.claude.com has a session viewer under **Managed Agents → Sessions**. It shows each agent's work, with a separate lane for each member.
