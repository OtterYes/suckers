# Agent Ecosystem: Home

A desktop app for my Windows PC: a small, living 3D world where a team of AI agents helps with school, business, TikTok, and Roblox work.

> **Status:** Design approved (M0). Building **M1, the demo loop**. See [[Goal]].

## Start here
- [[Goal]]: what we are building right now and how we'll know it's done
- [[Product Summary]]
- [[MVP Scope]]: what is in the first version and what waits
- [[Milestones]]: the build order, with checks I can see for myself

## Design
- [[Tech Stack]] · [[Architecture]] · [[Data Model]]
- [[Scheduling]] (first focus) · [[World Design]] · [[Dashboard]]
- [[Permissions and Safety]] · [[Integrations]]
- Agents: [[Coordinator]] · [[Roblox Builder]] (first focus) · [[Tutor]] · [[Strategist]] · [[Producer]]
- [[Astra Model Specs]]: the 3D models I'll make with Astra

## Records
- [[Decisions]]: every major choice and the reason for it
- [[Open Questions]]
- [[Glossary]]: plain-language meanings of the technical terms

## How this vault works with Claude
- This vault is the **source of truth** for the design. Claude reads it before working and updates it when something changes.
- I can edit any note in Obsidian, commit, and push. Claude will pick up my edits.
- Claude can't see my PC. It only sees what is pushed to the GitHub repo.
- The empty `.gdignore` file tells Godot to skip this folder, so notes never end up inside the app.
