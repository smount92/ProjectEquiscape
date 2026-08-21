# Model Horse Hub — Documentation Index

> **Last Updated:** August 21, 2026 (the launch release — five rooms, migrations 165–175)
> **For AI Agents:** This file is the navigation hub. Use it to find the right document for any topic. Each section links to the canonical reference. For architecture rules and Iron Laws, start at `.agents/MASTER_BLUEPRINT.md` instead — this index covers `docs/`.
>
> **Dated documents are history, not status.** Anything with a date in its filename — audits, work orders, strategy notes, launch plans — is a point-in-time record and is not maintained. The undated documents below are the ones kept current.

---

## Quick Navigation

| I need to… | Go to |
|---|---|
| **Set up the project locally** | [Getting Started → Setup](getting-started/setup.md) |
| **Understand the folder structure** | [Getting Started → Project Structure](getting-started/project-structure.md) |
| **Configure test accounts for E2E** | [Getting Started → Test Accounts](getting-started/test-accounts.md) |
| **Understand the system architecture** | [Architecture → Overview](architecture/overview.md) |
| **Trace a request through the system** | [Architecture → Data Flow](architecture/data-flow.md) |
| **Understand authentication** | [Architecture → Auth Flow](architecture/auth-flow.md) |
| **Find a specific server action** | [API → Server Actions Index](api/server-actions.md) |
| **Look up a database table** | [Database → Schema Overview](database/schema-overview.md) |
| **Understand a state machine** | [Architecture → State Machines](architecture/state-machines.md) |
| **Learn coding conventions** | [CONTRIBUTING.md](../CONTRIBUTING.md) |
| **Add a new feature end-to-end** | [Guides → Adding a Feature](guides/adding-a-feature.md) |
| **Write or run tests** | [Guides → Testing](guides/testing.md) |
| **Deploy to production** | [Guides → Deployment](guides/deployment.md) |
| **Understand CSS/UI architecture** | [Guides → Design System](guides/design-system.md) |
| **Add a database migration** | [Guides → Adding a Migration](guides/adding-a-migration.md) |
| **Find a component** | [Components → Catalog](components/catalog.md) |
| **Find a page route** | [Routes → Route Map](routes/route-map.md) |
| **Understand catalog curation** | [Guides → Catalog Curation](guides/catalog-curation.md) |
| **Understand an architecture decision** | [Architecture → ADRs](architecture/adrs/) |
| **Know what the rooms are called** | [`.agents/MASTER_BLUEPRINT.md`](../.agents/MASTER_BLUEPRINT.md) → "The Five Rooms" |
| **Style a new surface** | [Guides → Design Language](guides/DESIGN_LANGUAGE.md) |
| **Understand commission practice** | [studio/COMMISSION_RESEARCH.md](studio/COMMISSION_RESEARCH.md) |
| **Manually verify a Shows v2 flow** | [SHOWS_V2_TESTING.md](SHOWS_V2_TESTING.md) |
| **See what's next after the rebuild program** | [NEXT_SYSTEMS_ROADMAP.md](NEXT_SYSTEMS_ROADMAP.md) |
| **Understand the growth strategy / house rules** | [OPERATOR_PLAYBOOK.md](OPERATOR_PLAYBOOK.md) |
| **Know what the site can earn / what break-even needs** | [BUSINESS_MODEL_2026.md](BUSINESS_MODEL_2026.md) |

---

## Document Map

```
docs/
├── README.md                          ← YOU ARE HERE (navigation index)
├── OPERATOR_PLAYBOOK.md               # Self-contained strategy + house rules
├── BUSINESS_MODEL_2026.md             # Income targets, break-even, the hobby's ceiling
├── business-research/                 # Working notes behind BUSINESS_MODEL_2026.md
│   ├── infra-cost-curve.md            #   what hosting costs at 100 → 10,000 members
│   ├── repo-ground-truth.md           #   prices, tiers and rulings verified in the tree
│   ├── hobby-size.md                  #   how big the model horse hobby actually is
│   └── conversion-benchmarks.md       #   freemium conversion, churn, comparable platforms
├── NEXT_SYSTEMS_ROADMAP.md            # Post-rebuild priority order
├── SHOWS_V2_TESTING.md                # Manual testing checklist for Shows v2
├── studio/COMMISSION_RESEARCH.md      # Researched commission practice (the Studio rebuild's basis)
├── *_2026-*.md                        # HISTORY — dated audits, work orders, strategy notes,
│                                      #   launch plans. Point-in-time records, not maintained.
├── getting-started/
│   ├── setup.md                       # Local dev environment setup
│   ├── project-structure.md           # Annotated directory tree
│   └── test-accounts.md              # Test account configuration for E2E
├── architecture/
│   ├── overview.md                    # High-level system architecture
│   ├── data-flow.md                   # Request lifecycle diagrams
│   ├── auth-flow.md                   # Authentication patterns (PKCE, SSR)
│   ├── state-machines.md              # Commerce, commission, transfer flows
│   └── adrs/
│       ├── 001-server-actions-over-api.md
│       ├── 002-vanilla-css-over-tailwind.md  # Tailwind CSS v4 — migration ✅ COMPLETE
│       ├── 003-manual-types-over-generated.md # ⚠️ SUPERSEDED — now uses generated types via `npm run gen-types`
│       ├── 004-materialized-views-for-reads.md
│       ├── 005-soft-delete-tombstone.md
│       ├── 006-private-storage-signed-urls.md
│       └── 007-polymorphic-catalog.md
│   └── show-infrastructure.md         # Complete show system technical report
├── database/
│   ├── schema-overview.md             # Visual ERD + table groups
│   ├── rls-policies.md                # Row Level Security inventory
│   ├── materialized-views.md          # Computed views and refresh schedules
│   ├── migrations.md                   # Migration index (001—175; 174 is a deliberate gap)
│   └── seed-data.md                   # Reference catalog seeding
├── api/
│   ├── server-actions.md              # Index of the 58 server action files
│   └── routes.md                      # API route reference (18 routes + /auth/callback)
├── components/
│   ├── catalog.md                     # Component index by domain
│   ├── patterns.md                    # 8 common component patterns
│   └── design-system.md              # Tokens, colors, typography, primitives
├── guides/
│   ├── DESIGN_LANGUAGE.md             # ★ Authoritative visual language (leather/ledger/brass)
│   ├── adding-a-feature.md            # End-to-end feature workflow
│   ├── adding-a-migration.md          # SQL migration guide
│   ├── css-conventions.md             # CSS architecture rules — defers to DESIGN_LANGUAGE.md
│   ├── design-system.md               # 4 page archetypes
│   ├── testing.md                     # Test strategy and commands
│   ├── catalog-curation.md            # Catalog curation guide (V32)
│   └── deployment.md                  # Vercel + Supabase deployment
└── routes/
    └── route-map.md                   # Complete URL → page mapping (94 page routes)
```


---

## Related Documents (Outside `docs/`)

| Document | Location | Purpose |
|---|---|---|
| `CONTRIBUTING.md` | Project root | Code style, commit conventions, PR process |
| `.agents/MASTER_BLUEPRINT.md` | `.agents/` | Iron Laws, tech decisions, architecture — read FIRST |
| `.agents/MASTER_SUPABASE.md` | `.agents/` | Schema/RLS/RPC reference — read SECOND |
| `.agents/workflows/onboard.md` | `.agents/` | AI agent onboarding workflow |
| `.agents/workflows/dev-nextsteps.md` | `.agents/` | Living development task queue |
| `.agents/docs/` | `.agents/` | Strategic planning documents and research briefs |
| `Model Horse Hub Complete Report.md` | `.agents/archive/2026-Q2/` | Archived point-in-time project report (April 1, 2026) — superseded by the MASTER files above; kept for historical reference only |

---

## Security Note

> ⚠️ **No secrets in documentation.** Environment variables, API keys, database URLs, and test credentials are NEVER committed to documentation files. All docs reference `.env.local` (which is gitignored) and describe *what* variables are needed, not their values.
