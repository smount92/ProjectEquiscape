---
description: Master Documentation Consolidation & Live-Data Guardrail Framework (75+ users, NAMHSA 6-week pitch prep) — FIXED VERSION
---

# V41 — Master Documentation Consolidation & Guardrail Framework (Fixed)

> **Context:** We have a functioning product with 75 registered users and ~900 horses. We now have 89 workflow files, 106 migration SQL files, and 20 docs in `.agents/docs/`. Context drift in the Antigravity chain is real.  
> **Objective:** Create two living Single-Source-of-Truth files (`MASTER_BLUEPRINT.md` and `MASTER_SUPABASE.md`), define their relationship to `onboard.md`, and safely archive obsolete material without breaking references. Prepare for NAMHSA pitch by making live user data bulletproof.

**Target Audience:** Architect Agent (Claude Opus 4.6)  
**Status:** FEATURE FREEZE on new product features until these two MASTER files exist.  
**MANDATORY:** Work strictly within the existing Gemini → Architect → Developer workflow. No process changes.

---

## 🚨 ARCHITECT DIRECTIVES (READ FIRST)

1. **Single Source of Truth Rule** — Every future workflow **must** begin with:  
   `**MANDATORY:** Read .agents/MASTER_BLUEPRINT.md and .agents/MASTER_SUPABASE.md first. All Iron Laws and guardrails apply.`

2. **Live User Data Protection** — Anything that reads/writes `user_horses`, `financial_vault`, `show_records`, `transactions`, `horse_images`, `events`, `event_entries`, or any user profile data requires explicit human review before any DB change.

3. **Mermaid Diagrams** — Use Mermaid where helpful (especially in `MASTER_SUPABASE.md` for the full schema graph).

4. **No Code or Migration Changes** — This sprint touches **only** `.md` files in `.agents/`. Do NOT modify any `.tsx`, `.ts`, `package.json`, or create new migration files.

---

## 📁 FINAL DOCUMENTATION STRUCTURE

After this sprint the `.agents/` folder must look like this:

```
.agents/
├── MASTER_BLUEPRINT.md          ← Timeless Iron Laws + guardrails + agent protocol
├── MASTER_SUPABASE.md           ← Schema reference, RLS, RPCs, Mermaid diagram
├── archive/                     ← Old material (gitignored from repomix)
│   ├── 2026-Q1/
│   │   ├── workflows/
│   │   └── docs/
│   └── README.md
├── docs/                        ← Only current living docs
├── workflows/                   ← Only active + new workflows
│   └── onboard.md               ← Current state snapshot (metrics, counts, inventory)
└── (existing folders stay)
```

Add to `.gitignore`:

```gitignore
.agents/archive/**
!.agents/archive/README.md
```

---

## 📐 RELATIONSHIP TO EXISTING DOCS

| File | Scope | Changes With |
|------|-------|-------------|
| `MASTER_BLUEPRINT.md` | Timeless rules (Iron Laws, guardrails, agent protocol) | Rarely — only on architectural decisions |
| `MASTER_SUPABASE.md` | Schema reference (tables, RLS, RPCs, Mermaid ER diagram) | On each migration |
| `onboard.md` | Current state snapshot (file counts, migration numbers, component inventory) | Every sprint |

- `onboard.md` Step 1 must be updated to read: **"Read `MASTER_BLUEPRINT.md` and `MASTER_SUPABASE.md` first."**

---

## TASK 1: Create `.agents/MASTER_BLUEPRINT.md`

Create this file with these exact sections:

1. **Project Iron Laws** (extract from `Grand_Unification_Plan.md`)
2. **Tech Decisions** (Tailwind v4 + shadcn/ui is now official; vanilla-CSS hybrid is acceptable debt)
3. **Live-Data Guardrails** (copy the detailed section below)
4. **Agent Execution Protocol** (how every future workflow must start)
5. **NAMHSA Readiness Notes** (6-week pitch checklist)

### 🔒 Live User-Data Guardrails (75+ Users — NON-NEGOTIABLE)

```markdown
Any Server Action, API route, RSC, or UI that touches user_horses, financial_vault,
show_records, transactions, horse_images, events, event_entries, or user profiles MUST:

  • Use atomic RPCs or Server Actions with an RLS verification comment
  • Log auth.uid() on every mutation
  • Show a clear UI warning when the change affects public Hoofprint / passport
  • Require human review before merge (even non-breaking changes)

URLs must never expose raw UUIDs for public views (use alias_name or slug).
Never let AI run `supabase db push` or `supabase migration up` directly.
```

---

## TASK 2: Create `.agents/MASTER_SUPABASE.md`

Create this file with:

1. **Current Table Overview** — one concise paragraph per major domain
2. **Key RLS Policies** — focus on user-facing tables
3. **Materialized Views & Important RPCs**
4. **Full Schema Diagram** — include a Mermaid ER diagram showing relationships between core tables
5. **Migration Policy** — CLI-only, dry-run required, human approval before push
6. **Live Metrics Guardrails** — never run destructive SQL without human approval when >50 users

---

## TASK 3: Archive Strategy (Reference-Based — NOT Version-Based)

**Archive Criteria** — A workflow or doc file is safe to archive ONLY if ALL of these are true:

1. Its Status is marked ✅ DONE in `dev-nextsteps.md`
2. It is NOT referenced by `onboard.md`
3. It is NOT cross-referenced by any currently active workflow
4. All migrations it describes are deployed to production

Move qualifying files into `.agents/archive/2026-Q1/` and add `# STATUS: ARCHIVED — Safe to delete after NAMHSA pitch` at the top of each archived file.

---

## FINAL VERIFICATION

After completing both MASTER files:

1. Run `npx next build` — must be clean
2. Update `dev-nextsteps.md` to mark this task ✅
3. Update `onboard.md` Step 1 to reference the two MASTER files
4. Provide a short summary of the new folder structure

---

## Definition of Done

- [ ] Two new MASTER files exist and are complete
- [ ] Old material is safely archived using reference-based criteria
- [ ] `onboard.md` relationship is explicitly defined
- [ ] User-data guardrails are explicit and non-negotiable
- [ ] Mermaid diagram is present in `MASTER_SUPABASE.md`
- [ ] Documentation structure is now sustainable for the next 1,000 users

---

## Agent Execution Protocol

Architect Agent: Acknowledge you have read the `Grand_Unification_Plan.md` and all prior blueprints. Start by creating the two MASTER files exactly as specified. Present both files in full for human review before any archiving step.