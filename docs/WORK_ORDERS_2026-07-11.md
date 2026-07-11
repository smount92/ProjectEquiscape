# Work Orders — Public Pages & Documentation Refresh (2026-07-11)

Self-contained batch instructions from the July 11 audits. Any agent
executing these MUST first read `docs/OPERATOR_PLAYBOOK.md` (house rules:
worktree builds, branch → push → main-session merges, Husky suite must
stay green at 1,031+, token-only styling, migrations are owner-applied).
Owner decisions are already baked in below — do not re-ask.

**Ground truth (verified 2026-07-11, use these numbers, don't re-derive):**
tests 1,031 / 71 files · migrations 001–123 (119 files; 045/047/049/051
skipped) · 73 page routes · ~175 client components · 42 action files ·
11 shadcn primitives · 9 e2e specs · flags NEXT_PUBLIC_SHOWS_V2 /
GROUPS_FORUM / STABLE_V2 / SHOWRING_V2 — **ALL FOUR LIVE IN PROD Vercel**
· zod-at-boundary exists in exactly 5 action files (shows-v2, shows-v2-ring,
groups-forum, stable, showring) · new domains src/lib/{shows,groups,stable,
showring,commerce}/ · migrations 113–123 added 13 tables (shows, show_staff,
show_divisions, show_sections, show_classes, show_class_entries,
show_placings, show_callbacks, qualification_cards, show_results_docs,
show_entry_votes, group_last_read, stable_saved_views) and ~19 functions
(show_role_check, verify_qualification_card, split_show_class,
combine_show_classes, entry_vote_open, get_stable_summary,
get_stable_facets, add_post_reply rework, cards-follow-horse trigger, …).

**Owner decisions (locked):** About page founders = **Amanda Mount &
Stephen Mount** — framing: Amanda is the collector/visionary behind the
ideas, Stephen executes/builds. Warm, human, two-person team. Getting
Started's "Beta Tester?" section = **retire** (replace with a confident
one-line feedback invitation). All four flags = live (docs update to
"shipped", not "pending").

---

## BATCH A — Public pages CONTENT (judgment; Opus/strong-Sonnet session)

Full findings: July 11 marketing-pages audit (summarized here — enough to
execute without it).

A1. **Landing (src/app/page.tsx, ~542 ln)** [L]
   - Rewrite the shows feature block (~lines 199-215) to sell BOTH modes:
     live + online show hosting — one-click NAMHSA classlist, phone-based
     ring console for live tables, judging, champions, results to
     permanent records, qualification cards with public verification.
     This is the platform's unique feature (no competitor has it) —
     currently invisible.
   - Add a showholder CTA next to "Create Free Account" in hero AND final
     CTA (e.g. brass "Host a Show" → /shows/host; anon users hit login
     first — that's fine).
   - Optional [S]: mention Notice Board threads + stable saved-views in
     their feature cards (currently generic copy).
   - Keep the existing ledger/brass design — this page is design-clean;
     content only.

A2. **About (src/app/about/page.tsx, ~193 ln)** [M]
   - Add founder section near top: Amanda Mount (the collector whose
     ideas drive the product) & Stephen Mount (who builds them). Draft
     warm 2-3 paragraph copy; OWNER REVIEWS WORDING before merge.
   - Add plain-English continuity statement: nightly backups, your data
     is exportable anytime (CSV/PDF), what happens if we ever shut down
     (export window promise). Hobby context: community lost Blab for ~2
     years and MH$P to ransomware — this page must answer "will this die
     too?"
   - Rewrite "Where We're Going" (~lines 133-153): Competition Engine and
     Groups are SHIPPED (shows v2 + Notice Board) — move to a "What's
     live now" list; keep only genuinely-future items.

A3. **FAQ (src/app/faq/page.tsx, ~245 ln)** [M]
   - Add Q&As: hosting a live/in-person show (ring console, classlist
     templates); hosting an online photo show; what qualification cards
     are + /cards/[code] public verification ("buying a horse? verify its
     cards"); rewrite Groups answer for the Notice Board (threads,
     channels, pinned posts).
   - Add FAQPage JSON-LD structured data (script tag, generate from the
     existing FAQ array).
   - Expand the data-export answer with the continuity framing.

A4. **Getting Started (src/app/getting-started/page.tsx, ~214 ln)** [M]
   - NEW step "Host Your First Show" (after the current Step 4): both
     modes, link /shows/host, mention the one-click NAMHSA template.
   - Update Step 4 filter copy: saved views + full facet set now exist.
   - RETIRE the "Beta Tester? We Need Your Feedback!" section (~180-199);
     replace with one confident feedback line.

A5. **Signup (src/app/signup/page.tsx)** [S]
   - Add one continuity/export reassurance line to the existing privacy
     callout (~lines 123-134).

Verification: build + full suite; night-mode sanity (pages must use
tokens only — Batch B handles existing violations, don't duplicate).

## BATCH B — Public pages DESIGN pass (mechanical; Sonnet)

B1. About: replace 10× `bg-white` cards (lines ~61,73,84,111,122,133,144,
    154,164,181) with `.ledger-paper`/`ledger-tile` equivalents; swap
    emoji icons (🔒✨🐾🎨📦🏆🌍📱🤝) for lucide-react icons matching the
    landing page's icon language.
B2. FAQ: replace 4× `bg-white` (lines ~176,197,218,233) with tokens.
B3. Getting Started: replace 1× `bg-white` CTA card (~202); swap
    emoji-as-icons for lucide throughout.
Coordinate with Batch A if run concurrently (same files — prefer A first
or same branch).

## BATCH C — Documentation JUDGMENT tier (Opus/strong-Sonnet)

Fix the agent-onboarding chain FIRST (it's what future sessions read):

C1. `.agents/MASTER_SUPABASE.md`: header → 123 migrations/119 files; add
    the 13 new tables (grouped: Shows v2 domain ×10, show_entry_votes,
    group_last_read, stable_saved_views) + ~19 new functions to the
    domain sections. Derive descriptions from migrations 117-123
    directly.
C2. `.agents/MASTER_BLUEPRINT.md`: migration count; add Iron Laws /
    Tech Decisions for: zod-at-boundary standard, flag-gated dark-ship
    ritual, src/lib/<domain> pure-tested-lib pattern; add a Shows
    v2/Groups Forum/Stable v2/Show Ring v2 architecture section; note the
    legacy photo-show engine is deletable only after a data migration and
    that competition.ts/packer serves real-world shows (KEEP).
C3. `.agents/workflows/dev-nextsteps.md`: append a July 2026 section
    marking the entire rebuild program DONE (shows v2 B-F, groups forum,
    stable filters, showring v2, safe-trade hardening, leather edition,
    button codemod — all merged, all flags live); note the convention
    change (July work ran as ad hoc branches, not workflow files); list
    the CURRENT queue = commerce follow-ups (atomicity RPCs migration,
    S2, manual 2-account buy-flow test), strategy Moves 1-8, Batches A-D
    of this file.
C4. `CONTRIBUTING.md`: rewrite Server Actions section to lead with
    zod → requireAuth → ownership → RLS-first (admin client only with
    justification comment); add sections for the flag ritual, the domain-
    lib pattern, worktree/branch flow; fix counts (tests 1,031/71,
    migrations 123); point design-system reference at the leather/ledger
    materials reality.

## BATCH D — Documentation MECHANICAL tier (Sonnet/Haiku)

All numbers from the ground-truth table above. Run AFTER or parallel-to C
(items don't depend on C's content).

D1. README.md: fix tests (268→1,031 / 24→71), migrations (111→123),
    routes (63→73... wait, verify claimed numbers in file first), scale
    table; ADD feature rows: Show Hosting (live+online), Notice Board
    groups, Stable filters+saved views, Qualification Cards w/ public
    verification. One-line descriptions fine.
D2. docs/getting-started/setup.md: add the four NEXT_PUBLIC_* flags to
    the env-vars table (with "set =1 to enable; all live in prod");
    migration count fix.
D3. docs/getting-started/project-structure.md: add src/lib/{shows,groups,
    stable,showring,commerce}/ to the tree with one-liners; refresh
    counts.
D4. docs/architecture/overview.md: refresh scale table + mermaid labels;
    add two principles: zod-at-boundary, flag-gated rebuilds (short
    prose OK for mechanical since C2 will carry the deep version).
D5. docs/README.md index: link SHOWS_V2_TESTING, NEXT_SYSTEMS_ROADMAP,
    STRATEGY_2026-07, OPERATOR_PLAYBOOK, WORK_ORDERS_2026-07-11; refresh
    inline counts; fix the Related Documents link to the archived
    Complete Report (see D9).
D6. docs/SHOWS_V2_TESTING.md: intro line — flags are LIVE in prod now;
    note checklist items should be verified against production.
D7. docs/NEXT_SYSTEMS_ROADMAP.md: launch checklist step 4 (flag flip) →
    DONE; next action becomes the photo-show→v2 data migration.
    Also mark DONE: Show Ring refactor, Safe-Trade hardening.
D8. Small patches: test-accounts.md (+device-layout, +visual-qa-mobile
    specs); data-flow.md (+cron/transition-shows row);
    design-prototypes/README.md (leather-edition branch merged — past
    tense).
D9. Archive moves: styling_architecture_report.md, "Model Horse Hub
    Complete Report.md", visual_qa_test_plan.md → .agents/archive/
    2026-Q2/ (git mv, update any links); NAMHSA report.txt →
    .agents/docs/ (optional).
D10. docs/guides/design-system.md: refresh counts; retitle the "Cozy
    Scrapbook" framing to the leather/ledger reality; correct the "zero
    legacy tokens remain" claim (About/FAQ violations exist until Batch B
    lands — or run after B and keep the claim).

**Sequencing:** C1-C3 first (agent-onboarding chain), then C4/D in any
order; A independent; B after A (same files). Every batch: branch off
main in the worktree, full suite green, push branch, main session merges.
