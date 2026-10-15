---
name: member-report
description: Start here whenever a member, visitor, host, judge, artist or buyer says something is wrong, missing, confusing, or asks for a change - a pasted message, a screenshot, a contact-form mail, a report, a suggestion, a barn thread. Sorts the report into the right workflow and makes sure the member hears back.
---

# Member report: sort it, own it, close it

Every report gets three things: a **type** (which workflow), an **owner
decision** where one is needed, and a **reply** to the person who sent it.
A report that was fixed but never answered counts as unfinished.

## 1. Capture before you touch anything

Write down, in the conversation or the ticket:

- **Who** reported it (alias, never email in repo files) and **where** it came in (channel table below).
- **Their words**, quoted exactly. Members often name the symptom, not the cause ("I can't find Montana Harvest" was a linker search bug, not missing data).
- **The links** they gave: stable, passport, reference page, show, deal.
- **What they expected** and **what happened**.

## 2. Sort it

| If the report is about... | Workflow |
|---|---|
| Something on the site not working, erroring, looking wrong, slow | `investigate-bug` |
| Registry facts: wrong colour/number/year, duplicate, missing model, wrong mold, can't find a model, linker trouble | `registry-data-fix` (run `investigate-bug` first if search or display may be the cause) |
| A person, post, comment, listing, horse photo, or DM that breaks the rules | `moderation-report` |
| A sale gone wrong between two members | `deal-dispute` |
| Being charged, a tier that did not apply, a refund, a cancelled plan | `billing-issue` |
| A show: entries, results, cards, scratches, hosting, judging | `show-problem` |
| Login, email change, deleting an account, getting their data | `account-request` |
| An error alert, a failed cron, Sentry, a cost spike - no member involved | `system-alert` |
| "It would be great if..." - a new idea or change of behaviour | `feature-request` |

A report can be two types. Sort by the **cause**, once you know it.

## 3. Where reports come in

| Channel | Member side | Owner sees it in | Member hears back? |
|---|---|---|---|
| Contact form | `/contact` (footer, error page, 404, FAQ) | Admin › Mailbox | Only if you reply (Reply button sends email) |
| Content report | Report button - **horse pages only** today | Admin › Reports | No |
| Registry suggestion / duplicate report / "Suggest an entry" / linker "Mine isn't here" | Registry pages, linker | Admin › Catalog queue + bell | Yes, bell on approve/reject |
| Wrong-model price flag | eBay card on reference page | Bell only (no admin screen) | No |
| Suggestion-box barn | Barn thread | Only as a barn member | No (status change is silent) |
| External show listing | Shows › list a show | Admin › Calendar | No |
| Sanctioning request | Host's show settings | Admin › Sanctioning | On grant only |
| Deal dispute | Deal Room | **Nowhere** - other party only | n/a |
| Error page | "Quote reference …" | Admin › Ops › Errors (Sentry) | Only via contact form |
| Direct message, Facebook, in person | - | Owner pastes it into the conversation | Owner replies |

Known gaps in this table are tracked in `docs/workflows/README.md`.

## 4. Close the loop

1. **Reply to the member** in plain words: what was wrong, what changed, what they need to do (often nothing). Draft it; the owner sends it. Never promise a date.
2. **Record it**: if it led to a fix, the commit message names the symptom. If it needs a decision or more work, create a ticket (`ticket` skill) with the member's words as the source.
3. **Look sideways**: one member's report usually stands for many silent ones. Check whether other rows, horses or members have the same problem, and say how many.
4. **Ask once**: could the member have fixed this themselves? If not, should they be able to? That answer goes in the ticket.
