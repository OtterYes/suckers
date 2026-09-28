"""Ask the Decision Council a question from your terminal.

    python ask_council.py "Should I lease or buy a car? Budget $400/month, ..."
    python ask_council.py --file my_question.txt
    python ask_council.py --budget 5 --file my_question.txt

Before anything is spent, the script asks you to confirm and shows the
spending cap. The cap is enforced by the platform. When the council finishes,
the report is saved in the reports/ folder.
"""

import argparse
import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path

import anthropic

HERE = Path(__file__).resolve().parent
IDS_FILE = HERE / "council_ids.json"
REPORTS = HERE / "reports"

DEFAULT_BUDGET_DOLLARS = 3.00


def dollars(cents) -> str:
    return f"${int(cents) / 100:.2f}"


def text_of(content) -> str:
    """Join the text blocks of an event's content."""
    return "\n".join(b.text for b in (content or []) if getattr(b, "type", None) == "text").strip()


def ask_yes_no(prompt: str) -> bool:
    return input(f"{prompt} [y/N] ").strip().lower() in ("y", "yes")


class CouncilRun:
    def __init__(self, client, session_id, question, report_path):
        self.client = client
        self.session_id = session_id
        self.question = question
        self.report_path = report_path
        self.seen = set()
        self.pending_asks = {}  # tool-use events waiting for your approval, by event ID
        self.cost_cents = 0
        self.transcript = []  # ("you" | "Coordinator" | member name, text)
        self.problems = []

    # -- Events --------------------------------------------------------------

    def handle(self, ev):
        """Print and record one event. Returns the idle/terminated event when a turn ends."""
        if ev.id in self.seen:
            return None
        self.seen.add(ev.id)
        t = ev.type

        if t == "agent.message":
            text = text_of(ev.content)
            if text:
                print(f"\n{text}\n")
                self.transcript.append(("Coordinator", text))
        elif t == "session.thread_created":
            print(f"  [{ev.agent_name} joined]")
        elif t == "agent.thread_message_sent":
            print(f"  [Coordinator -> {ev.to_agent_name}: task sent]")
        elif t == "agent.thread_message_received":
            print(f"  [{ev.from_agent_name} -> Coordinator: report received]")
            self.transcript.append((ev.from_agent_name, text_of(ev.content)))
        elif t in ("agent.tool_use", "agent.mcp_tool_use"):
            if ev.evaluated_permission == "ask":
                self.pending_asks[ev.id] = ev
        elif t == "session.error":
            err = ev.error
            msg = f"{getattr(err, 'type', 'error')}: {getattr(err, 'message', '')}".strip()
            print(f"  [Platform error: {msg}]")
            self.problems.append(msg)
        elif t == "session.usage":
            if ev.usage.list_cost is not None:
                self.cost_cents = int(ev.usage.list_cost.amount)
        elif t == "session.status_terminated":
            return ev
        elif t == "session.status_idle":
            return ev
        return None

    def approve_pending(self, event_ids):
        """Ask you about each tool call that is waiting for approval."""
        confirmations = []
        for eid in event_ids:
            ev = self.pending_asks.pop(eid, None)
            if ev is None:
                print(f"  [A step ({eid}) is waiting for a reply this script can't give. Denying it.]")
                continue
            print("\nA council member wants to take this action:")
            print(f"  Tool:  {ev.name}")
            print(f"  Input: {json.dumps(ev.input, indent=2, default=str)}")
            allowed = ask_yes_no("Allow it?")
            c = {"type": "user.tool_confirmation", "tool_use_id": eid, "result": "allow" if allowed else "deny"}
            if not allowed:
                c["deny_message"] = "The user declined this action. Continue without it and list it as a next step for the user."
            if getattr(ev, "session_thread_id", None):
                c["session_thread_id"] = ev.session_thread_id
            confirmations.append(c)
        if confirmations:
            self.client.beta.sessions.events.send(self.session_id, events=confirmations)

    def run_turn(self, message=None):
        """Send a message (if any), then follow the council until it stops.

        Returns the stop reason: "end_turn", "budget_reached",
        "retries_exhausted" or "terminated".
        """
        while True:
            try:
                # Open the stream before sending, so no events are missed.
                with self.client.beta.sessions.events.stream(self.session_id) as stream:
                    if message is not None:
                        self.transcript.append(("you", message))
                        self.client.beta.sessions.events.send(
                            self.session_id,
                            events=[{"type": "user.message", "content": [{"type": "text", "text": message}]}],
                        )
                        message = None
                    else:
                        # Resuming or reconnecting: catch up on anything missed.
                        for ev in self.client.beta.sessions.events.list(self.session_id):
                            stop = self.handle(ev)
                            if stop is not None:
                                reason = self._stop_reason(stop)
                                if reason != "requires_action":
                                    return reason
                                self.approve_pending(stop.stop_reason.event_ids)
                    for ev in stream:
                        stop = self.handle(ev)
                        if stop is None:
                            continue
                        reason = self._stop_reason(stop)
                        if reason == "requires_action":
                            self.approve_pending(stop.stop_reason.event_ids)
                            continue
                        return reason
            except (anthropic.APIConnectionError, anthropic.APITimeoutError):
                print("  [Connection dropped, reconnecting...]")
                time.sleep(2)

    @staticmethod
    def _stop_reason(ev) -> str:
        if ev.type == "session.status_terminated":
            return "terminated"
        return ev.stop_reason.type

    # -- Budget and report ---------------------------------------------------

    def refresh_cost(self):
        try:
            s = self.client.beta.sessions.retrieve(self.session_id)
            if s.usage and s.usage.list_cost is not None:
                self.cost_cents = int(s.usage.list_cost.amount)
        except anthropic.APIError:
            pass

    def raise_budget(self, extra_cents: int) -> None:
        self.refresh_cost()
        new_cap = self.cost_cents + extra_cents
        self.client.beta.sessions.update(
            self.session_id,
            budget={"type": "limit", "max_list_cost": {"amount": str(new_cap), "currency": "USD"}},
        )
        print(f"  [Budget raised to {dollars(new_cap)}. The council is continuing.]")

    def save_report(self):
        lines = [
            "# Decision Council report",
            "",
            f"- Date: {datetime.now():%Y-%m-%d %H:%M}",
            f"- Session: {self.session_id}",
            f"- Cost so far (list price): {dollars(self.cost_cents)}",
            "",
            "## Your question",
            "",
            self.question,
            "",
            "## Conversation with the Coordinator",
            "",
        ]
        members = []
        for who, text in self.transcript:
            if who == "you":
                lines += [f"**You:** {text}", ""]
            elif who == "Coordinator":
                lines += [text, ""]
            else:
                members.append((who, text))
        if self.problems:
            lines += ["## Platform errors during this run", ""] + [f"- {p}" for p in self.problems] + [""]
        if members:
            lines += ["## Appendix: council member reports (in the order received)", ""]
            for who, text in members:
                lines += [f"### {who}", "", text or "_(empty report)_", ""]
        REPORTS.mkdir(exist_ok=True)
        self.report_path.write_text("\n".join(lines), encoding="utf-8")


def archive_when_idle(client, session_id):
    """Close the session so it stops holding resources. The saved report keeps everything."""
    for _ in range(10):
        if client.beta.sessions.retrieve(session_id).status != "running":
            client.beta.sessions.archive(session_id)
            return
        time.sleep(0.5)


def main():
    parser = argparse.ArgumentParser(description="Ask the Decision Council a question.")
    parser.add_argument("question", nargs="*", help="Your decision or question, in quotes.")
    parser.add_argument("--file", help="Read the question from a text file instead.")
    parser.add_argument("--budget", type=float, default=DEFAULT_BUDGET_DOLLARS,
                        help=f"Spending cap for this question in US dollars (default {DEFAULT_BUDGET_DOLLARS:.2f}).")
    args = parser.parse_args()

    if not IDS_FILE.exists():
        sys.exit("council_ids.json not found. Run  python setup_council.py  first.")
    ids = json.loads(IDS_FILE.read_text(encoding="utf-8"))

    if args.file:
        question = Path(args.file).read_text(encoding="utf-8").strip()
    elif args.question:
        question = " ".join(args.question).strip()
    else:
        question = input("What decision do you want the council to help with?\n> ").strip()
    if not question:
        sys.exit("No question given.")

    budget_cents = round(args.budget * 100)
    if budget_cents <= 0:
        sys.exit("--budget must be more than 0.")

    print(f"\nThe council will work on your question. The platform stops it at a spending cap of {dollars(budget_cents)}")
    print("(model usage, web searches at $10 per 1,000, and session time, all at list prices).")
    if not ask_yes_no("Start?"):
        sys.exit("Cancelled. Nothing was spent.")

    client = anthropic.Anthropic()
    session = client.beta.sessions.create(
        agent=ids["coordinator"],
        environment_id=ids["environment_id"],
        title=question[:80],
        budget={"type": "limit", "max_list_cost": {"amount": str(budget_cents), "currency": "USD"}},
    )
    slug = re.sub(r"[^a-z0-9]+", "-", question.lower())[:40].strip("-") or "question"
    run = CouncilRun(client, session.id, question, REPORTS / f"{datetime.now():%Y-%m-%d_%H%M%S}_{slug}.md")
    print(f"Session {session.id} started. Press Ctrl+C at any time to stop the council.\n")

    message = question
    try:
        while True:
            reason = run.run_turn(message)
            run.refresh_cost()
            run.save_report()

            if reason == "budget_reached":
                print(f"\nThe council reached its spending cap ({dollars(run.cost_cents)} used) and paused.")
                if ask_yes_no(f"Allow another {dollars(budget_cents)} so it can finish?"):
                    run.raise_budget(budget_cents)
                    message = None
                    continue
                print("Stopped at the cap. What the council produced so far is in the report.")
                break
            if reason in ("retries_exhausted", "terminated"):
                print("\nThe session stopped because of an error it could not recover from."
                      " Anything produced so far is in the report.")
                break

            print(f"\n[Report saved to {run.report_path.relative_to(HERE)}. Cost so far: {dollars(run.cost_cents)}]")
            reply = input("\nReply to the council (for example, answer its questions), or press Enter to finish:\n> ").strip()
            if not reply:
                break
            message = reply
    except KeyboardInterrupt:
        print("\nStopping the council...")
        try:
            client.beta.sessions.events.send(session.id, events=[{"type": "user.interrupt"}])
        except anthropic.APIError:
            pass
        run.refresh_cost()
        run.save_report()
    finally:
        try:
            archive_when_idle(client, session.id)
        except anthropic.APIError:
            pass

    print(f"\nFinal report: {run.report_path}")
    print(f"Total cost (list price): {dollars(run.cost_cents)}")


if __name__ == "__main__":
    try:
        main()
    except anthropic.AuthenticationError:
        sys.exit("Your API key was rejected. Check that ANTHROPIC_API_KEY is set to a valid key (see README, step 3).")
    except anthropic.APIStatusError as e:
        sys.exit(f"The platform returned an error ({e.status_code}): {e.message}")
    except anthropic.APIConnectionError:
        sys.exit("Could not reach api.anthropic.com. Check your internet connection and try again.")
