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

Found 2026-10-14 by tracing every report path through the code. Each one is
a place where a member's report can go unseen, or the member never hears
back. In priority order:

| # | Gap | Effect | Suggested fix |
|---|---|---|---|
| G1 | The Report button exists only on horse pages. Posts, comments, profiles, DMs, market listings, show entries, barn threads and Help ID have none. | Members can't report most bad content except by contact form. | One Report button component mounted everywhere content appears (the reports table already accepts post, comment, user and message). |
| G2 | Deal Room disputes never reach the admin. | A deal can go bad with no one at the site knowing. | Bell the admin on dispute, and count open disputes in the admin pulse. |
| G3 | No admin alert for new contact messages, content reports or external-show submissions. | Messages wait until someone happens to open the tab. | Bell the admin on each, as Registry suggestions already do. |
| G4 | Wrong-model price flags have no admin screen. | A false flag hides a model's price forever. | A small card in Admin › Catalog listing active flags with Resolve. |
| G5 | Stripe refunds and chargebacks are not handled; failed payments don't tell the member. | A refunded member keeps their tier; a failing card goes unnoticed. | Handle `charge.refunded`, `charge.dispute.created`, and notify on `invoice.payment_failed`. |
| G6 | Reporters never hear the outcome of content reports, external-show reviews, sanctioning dismissals, barn thread status, or suspensions. | Members stop reporting. | Notify the reporter on every resolution, as Registry suggestions do. |
| G7 | Content report cards show no link to the content and have no takedown action. "Take action" only saves a note. | Moderation means hunting for the content by hand. | Link plus Hide/Remove on the card. |
| G8 | Show entrants and judges have no way to dispute a result, bar or scratch. | Disputes happen in DMs or nowhere. | "Message the host" on the entry, with the show attached. |
| G9 | The contact form has no category, no status, no account link and no error reference; Admin shows only the last 100. Account deletions are invisible to the admin. | Hard to tell what is open; the error reference must be typed. | Category + Open/Resolved status; prefill the error reference and the signed-in account. |
| G10 | Nothing can be turned into a ticket in one click from a contact message, report, suggestion or barn thread. | Ideas live in two places. | "Add to Roadmap" on contact messages, reports, suggestions and barn threads. |
| G11 | No cron heartbeat; no Sentry push alerts. | A cron that stops is invisible. | Record each cron's last success; show it in Admin › Ops, red when late. |
| G12 | The admin catalog queue loads only `pending`, not `under_review`; the review notification has no link back. | Suggestions can drop out of sight. | Load both; add the link. |

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
