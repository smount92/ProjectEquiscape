---
name: ticket
description: Use whenever work should be tracked - a new bug, idea, chore, member report, owner ruling, or follow-up - and when starting, pausing or finishing tracked work. Creates and updates Backlog.md tickets in one consistent shape.
---

# Tickets (Backlog.md)

The board is the one tracker. Tickets are markdown files in `backlog/tasks/`,
created and edited with the `backlog` CLI (never by hand-editing the
front matter). Open the board with `backlog browser` (web) or `backlog board`
(terminal).

## Every ticket has

| Field | Rule |
|---|---|
| **Title** | What will be true when it's done, in member words, starting with a verb. "Old Registry addresses forward to the new one", not "slug history table". |
| **Type** (`--type`) | `bug` (something is wrong), `feature` (new), `enhancement` (better), `chore` (upkeep, no member-visible change), `docs`, `spike` (find out / decide). |
| **Labels** (`-l`) | One area: `registry`, `stable`, `shows`, `market`, `paddock`, `studio`, `admin`, `billing`, `accounts`, `moderation`, `platform`, `data`. Add `member-reported` when a member raised it. |
| **Priority** | `high` = members are hurt now or it blocks a release; `medium` = this release; `low` = when there's room. |
| **Milestone** (`-m`) | The release it ships in. Each release is **one push, one rebuild**. Unscheduled work goes in `Later`. |
| **Description** (`-d`) | Three short parts: **Why** (the problem, with the member's exact words if any), **Source** (who/where: alias, decision Q-number, gap G-number, audit), **Notes** (links, files, anything known). Never emails or private details. |
| **Acceptance criteria** (`--ac`) | Checkable outcomes, each one a sentence a person could verify. At least one. |
| **Status** | `To Do` → `In Progress` → `Done`. `Waiting on owner` when it needs a ruling, a paste, or a send. |
| **Due date** | Only for real deadlines (season end, a promised date). |

Owner decisions go in `docs/DECISIONS.md`; the ticket links the Q-number.

## Commands

```bash
backlog task create "Title" --type bug -l registry,member-reported --priority high -m "Release 1 - Standards and Registry batch" -d "**Why** ... **Source** ... **Notes** ..." --ac "..." --ac "..."
backlog task list --plain
backlog task edit MHH-012 -s "In Progress"
backlog task edit MHH-012 --check-ac 1
backlog task edit MHH-012 -s Done --final-summary "What changed, and the commit"
```

## When working

1. Before starting work that isn't tracked, create the ticket first.
2. Set `In Progress` when you start; one ticket in progress at a time per session.
3. Commit messages name the ticket: `MHH-012: Old Registry addresses forward`.
4. When done: tick the acceptance criteria, add a final summary, set `Done`. The ticket ships with the release's milestone.
5. Found something out of scope? A new ticket, not a bigger one.

## Releases

A release is a milestone. Work collects on a branch; when the owner says
go, it merges to `main` and the site rebuilds once. Then the milestone is
archived (`backlog milestone archive "<name>"`) and the next one starts.
