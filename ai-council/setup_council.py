"""Create (or update) the Decision Council on the Claude Developer Platform.

Run this once before your first question, and again whenever you edit a
file in prompts/ or change a setting below. It saves the IDs of everything
it creates in council_ids.json, next to this file.

    python setup_council.py

Setting up costs nothing: you are billed only when a session runs.
"""

import json
import sys
from pathlib import Path

import anthropic

# ---------------------------------------------------------------------------
# Settings you can change
# ---------------------------------------------------------------------------

# Model for the Coordinator and for the four members. To lower costs, set
# MEMBER_MODEL to "claude-sonnet-5".
COORDINATOR_MODEL = "claude-opus-5-5"
MEMBER_MODEL = "claude-opus-5-5"

# How hard each agent thinks: "low", "medium", "high", "xhigh" or "max".
EFFORT = "high"

# ---------------------------------------------------------------------------

HERE = Path(__file__).resolve().parent
PROMPTS = HERE / "prompts"
IDS_FILE = HERE / "council_ids.json"
ENVIRONMENT_NAME = "decision-council-env"

# Web search and web fetch only. Every other built-in tool (shell, file
# writing, and so on) is switched off, so members can read the web but can't
# act on anything.
WEB_TOOLS = [
    {
        "type": "agent_toolset_20260401",
        "default_config": {"enabled": False},
        "configs": [
            {"name": "web_search", "enabled": True},
            {"name": "web_fetch", "enabled": True},
        ],
    }
]
NO_TOOLS = []

MEMBERS = [
    {
        "key": "researcher",
        "name": "Researcher",
        "description": "Finds the facts a decision depends on using web search, and reports each one with its source URL, date, and confidence. Give it the decision brief and the specific facts to look up.",
        "tools": WEB_TOOLS,
    },
    {
        "key": "strategist",
        "name": "Strategist",
        "description": "Lays out the realistic options, compares their tradeoffs (cost, time, risk, reversibility, fit with the requirements), and makes a provisional pick. No web access. Give it the decision brief and any reports it should use.",
        "tools": NO_TOOLS,
    },
    {
        "key": "critic",
        "name": "Critic",
        "description": "Challenges assumptions, ranks risks, and names missing information and decision traps. No web access. Give it the decision brief and any reports or drafts to challenge.",
        "tools": NO_TOOLS,
    },
    {
        "key": "verifier",
        "name": "Verifier",
        "description": "Builds the requirements checklist, checks important claims against sources it retrieves itself, and checks whether a draft recommendation meets the requirements. Give it the brief, the claims, and the draft.",
        "tools": WEB_TOOLS,
    },
]


def read_prompt(key: str) -> str:
    return (PROMPTS / f"{key}.md").read_text(encoding="utf-8")


def load_ids() -> dict:
    if IDS_FILE.exists():
        return json.loads(IDS_FILE.read_text(encoding="utf-8"))
    return {}


def save_ids(ids: dict) -> None:
    IDS_FILE.write_text(json.dumps(ids, indent=2) + "\n", encoding="utf-8")


def create_or_update_agent(client, agent_id, *, name, description, model, system, tools, multiagent=None):
    """Update the agent if it already exists (this makes a new version), otherwise create it."""
    fields = {
        "name": name,
        "description": description,
        "model": {"id": model, "effort": EFFORT},
        "system": system,
    }
    if multiagent is not None:
        fields["multiagent"] = multiagent

    if agent_id:
        # Updating replaces the tool list wholesale; [] clears it.
        agent = client.beta.agents.update(agent_id, tools=tools, **fields)
        action = "Updated"
    else:
        if tools:
            fields["tools"] = tools
        agent = client.beta.agents.create(**fields)
        action = "Created"
    print(f"  {action} {name:<12} {agent.id} (version {agent.version})")
    return agent


def get_environment_id(client, ids: dict) -> str:
    if ids.get("environment_id"):
        print(f"  Using environment {ids['environment_id']}")
        return ids["environment_id"]
    try:
        # The council needs no internet access from its sandbox: web search
        # and web fetch run on Anthropic's servers, not in the sandbox.
        env = client.beta.environments.create(
            name=ENVIRONMENT_NAME,
            config={"type": "cloud", "networking": {"type": "limited"}},
        )
        print(f"  Created environment {env.id}")
        return env.id
    except anthropic.ConflictError:
        # An environment with this name already exists (for example, the IDs
        # file was deleted). Find it and reuse it.
        for env in client.beta.environments.list():
            if env.name == ENVIRONMENT_NAME:
                print(f"  Reusing existing environment {env.id}")
                return env.id
        raise


def main() -> None:
    client = anthropic.Anthropic()
    ids = load_ids()

    print("Setting up the Decision Council...")
    ids["environment_id"] = get_environment_id(client, ids)
    save_ids(ids)

    roster = []
    for member in MEMBERS:
        agent = create_or_update_agent(
            client,
            ids.get(member["key"]),
            name=member["name"],
            description=member["description"],
            model=MEMBER_MODEL,
            system=read_prompt(member["key"]),
            tools=member["tools"],
        )
        ids[member["key"]] = agent.id
        save_ids(ids)
        roster.append({"type": "agent", "id": agent.id})

    # The Coordinator is set up last. Its roster pins each member's latest
    # version at the moment it is saved, so re-running this script after
    # editing a member's prompt also moves the Coordinator to the new version.
    coordinator = create_or_update_agent(
        client,
        ids.get("coordinator"),
        name="Coordinator",
        description="Runs the Decision Council and writes the final recommendation.",
        model=COORDINATOR_MODEL,
        system=read_prompt("coordinator"),
        tools=NO_TOOLS,
        multiagent={"type": "coordinator", "agents": roster},
    )
    ids["coordinator"] = coordinator.id
    save_ids(ids)

    print(f"\nDone. IDs saved to {IDS_FILE.name}.")
    print('Ask your first question with:  python ask_council.py "your decision here"')


if __name__ == "__main__":
    try:
        main()
    except anthropic.AuthenticationError:
        sys.exit("Your API key was rejected. Check that ANTHROPIC_API_KEY is set to a valid key (see README, step 3).")
    except (anthropic.PermissionDeniedError, anthropic.NotFoundError) as e:
        sys.exit(f"The platform refused the request, so Managed Agents may not be available to your account or workspace.\nDetails: {e}")
    except anthropic.APIStatusError as e:
        sys.exit(f"The platform returned an error ({e.status_code}): {e.message}")
    except anthropic.APIConnectionError:
        sys.exit("Could not reach api.anthropic.com. Check your internet connection and try again.")
