---
description: Onboard to the Model Horse Hub project — read architecture, conventions, and current state before doing any work
---

# Onboard to Model Horse Hub

Run this workflow before starting ANY work on the project. It loads the full context into your session.

## Steps

1. Read the **Unified Master Implementation Blueprint** — single source of truth for architecture, database schemas, global directives, and all 4 implementation phases:

```
View file: c:\Project Equispace\model-horse-hub\.agents\docs\master_implementation_blueprint.md
```

2. Read the **Project State & Strategic Research Brief** for comprehensive context on what's been built, competitive positioning, and research directions:

```
View file: c:\Project Equispace\model-horse-hub\.agents\docs\model_horse_hub_state_report.md
```

3. Read the **Developer Conventions** reference to understand the strict coding patterns you MUST follow (server components, server actions, client components, CSS, migrations, types):

```
View the developer conventions artifact in the brain directory (02_developer_conventions.md)
```

3. Confirm you understand the following before proceeding:
   - **Frontend:** Next.js 16 App Router, React 19, vanilla CSS (ALL styles in `src/app/globals.css`)
   - **Backend:** Supabase (PostgreSQL) with strict RLS
   - **Auth:** `createClient()` from `@/lib/supabase/server` → `supabase.auth.getUser()`
   - **Patterns:** Server Components for pages, `"use server"` actions return `{ success, error }`, Client Components with `"use client"` and status states
   - **Privacy:** `financial_vault` is NEVER queried on public routes
   - **Storage:** Private `horse-images` bucket — use `getSignedImageUrls()` for rendering

4. If you need to see the actual codebase structure, explore:
   - `src/app/` — pages and actions
   - `src/components/` — client components
   - `src/lib/` — types, utils, supabase clients
   - `supabase/migrations/` — SQL schema history

5. Understand the **documentation responsibility**. This project maintains living documentation that YOU must update after completing any feature work. The documentation artifacts live in the brain directory and include:

   - `00_master_architecture.md` — The master architecture report. Update the version number, project structure tree, database schema tables, completed features list, and roadmap whenever you add a feature.
   - `01_social_layer_plan.md` — Example of a completed feature spec (reference only).
   - `02_developer_conventions.md` — Coding patterns reference. Update if you establish new patterns.
   - `03_future_roadmap.md` — Roadmap outlines. Update the priority queue when features are completed or new ones are planned.
   - `task_*.md` — Atomic task specs. Mark as COMPLETE when finished, or create new ones for new features.

   **RULE:** Every workflow and feature implementation MUST end with a "Documentation Update" step. You are NOT done until the docs reflect reality. See the social-layer workflow for an example.

   **RULE:** When executing a workflow, update the workflow `.md` file itself as you complete each task:
   - Add `✅ DONE` and the date after completed task headings
   - Check off items in any Completion Checklist at the bottom of the workflow
   - Add brief notes about issues encountered or design decisions made
   - Do NOT mark tasks complete unless you have verified the build passes

6. You are now ready to work. Ask the user what they'd like to do next.
