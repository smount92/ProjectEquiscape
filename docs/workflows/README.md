# How problems reach us, and what we do with them

Every report has a workflow. The workflows are skills in `.claude/skills/`,
so the AI assistant follows them automatically. They are plain markdown, so
a person can follow them too.

| Workflow | For |
|---|---|
| [member-report](../../.claude/skills/member-report/SKILL.md) | **Start here.** Sorts any report and makes sure the member hears back. Also holds the table of intake channels. |
| [investigate-bug](../../.claude/skills/investigate-bug/SKILL.md) | Broken, wrong, missing, slow |
| [registry-data-fix](../../.claude/skills/registry-data-fix/SKILL.md) | Registry data and the suggestion queue |
| [moderation-report](../../.claude/skills/moderation-report/SKILL.md) | Rule-breaking content or people |
| [deal-dispute](../../.claude/skills/deal-dispute/SKILL.md) | Sales between members |
| [billing-issue](../../.claude/skills/billing-issue/SKILL.md) | Charges, tiers, refunds |
| [show-problem](../../.claude/skills/show-problem/SKILL.md) | Entries, results, cards, hosting, judging |
| [account-request](../../.claude/skills/account-request/SKILL.md) | Login, deletion, data export |
| [system-alert](../../.claude/skills/system-alert/SKILL.md) | Errors, crons, cost, deploys |
| [feature-request](../../.claude/skills/feature-request/SKILL.md) | New ideas and changes |
| [add-migration](../../.claude/skills/add-migration/SKILL.md) | Schema changes |

## Gaps in how reports reach us

Found 2026-10-14 by tracing every report path through the code: twelve
places where a member's report could go unseen, or the member never heard
back (G1-G12). Release 2 closed all twelve. If a new one turns up, add a row:

| # | Gap | Effect | Suggested fix |
|---|---|---|---|

When a gap is closed, delete its row and update the channel table in
`member-report`.

## Outside skills worth adding later

Matt Pocock's skills plugin (`claude plugin install mattpocock-skills@claude-plugins-official`)
fits alongside these. Useful ones: `diagnosing-bugs` and `tdd` (they match
`investigate-bug`), `grill-with-docs` (interviews the owner about a design and
writes the answers into `docs/GLOSSARY.md` and the ADRs), `handoff` (hands
a long session to the next one), and `retro` (after a session, lists what
in our setup should change). Skip `triage`, `to-tickets` and `wayfinder`
for now: our board is Backlog.md (see the `ticket` skill).
