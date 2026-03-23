# Model Horse Hub — Documentation Index

> **Last Updated:** March 23, 2026
> **For AI Agents:** This file is the navigation hub. Use it to find the right document for any topic. Each section links to the canonical reference.

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
| **Understand CSS architecture** | [Guides → CSS Conventions](guides/css-conventions.md) |
| **Add a database migration** | [Guides → Adding a Migration](guides/adding-a-migration.md) |
| **Find a component** | [Components → Catalog](components/catalog.md) |
| **Find a page route** | [Routes → Route Map](routes/route-map.md) |
| **Understand catalog curation** | [Guides → Catalog Curation](guides/catalog-curation.md) |
| **Understand an architecture decision** | [Architecture → ADRs](architecture/adrs/) |

---

## Document Map

```
docs/
├── README.md                          ← YOU ARE HERE (navigation index)
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
│       ├── 002-vanilla-css-over-tailwind.md  # ⚠️ SUPERSEDED — migrated to Tailwind CSS v4
│       ├── 003-manual-types-over-generated.md # ⚠️ SUPERSEDED — now uses generated types via `npm run gen-types`
│       ├── 004-materialized-views-for-reads.md
│       ├── 005-soft-delete-tombstone.md
│       ├── 006-private-storage-signed-urls.md
│       └── 007-polymorphic-catalog.md
├── database/
│   ├── schema-overview.md             # Visual ERD + table groups
│   ├── rls-policies.md                # Row Level Security inventory
│   ├── materialized-views.md          # Computed views and refresh schedules
│   ├── migrations.md                  # Migration index (001—097)
│   └── seed-data.md                   # Reference catalog seeding
├── api/
│   ├── server-actions.md              # Index of all 36 server action files
│   └── routes.md                      # API route reference (6 routes)
├── components/
│   ├── catalog.md                     # 95-component index by domain
│   ├── patterns.md                    # 7 common component patterns
│   └── design-system.md              # Tokens, colors, typography, primitives
├── guides/
│   ├── adding-a-feature.md            # End-to-end feature workflow
│   ├── adding-a-migration.md          # SQL migration guide
│   ├── css-conventions.md             # CSS architecture rules
│   ├── testing.md                     # Test strategy and commands
│   ├── catalog-curation.md            # Catalog curation guide (V32)
│   └── deployment.md                  # Vercel + Supabase deployment
└── routes/
    └── route-map.md                   # Complete URL → page mapping (57 routes)
```


---

## Related Documents (Outside `docs/`)

| Document | Location | Purpose |
|---|---|---|
| `CONTRIBUTING.md` | Project root | Code style, commit conventions, PR process |
| `Model Horse Hub Complete Report.md` | Project root | Comprehensive project report (March 18, 2026 snapshot) |
| `.agents/workflows/onboard.md` | `.agents/` | AI agent onboarding workflow |
| `.agents/workflows/dev-nextsteps.md` | `.agents/` | Living development task queue |
| `.agents/docs/` | `.agents/` | Strategic planning documents and research briefs |

---

## Security Note

> ⚠️ **No secrets in documentation.** Environment variables, API keys, database URLs, and test credentials are NEVER committed to documentation files. All docs reference `.env.local` (which is gitignored) and describe *what* variables are needed, not their values.
