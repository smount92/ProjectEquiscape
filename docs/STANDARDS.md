# Standards

How code, the database, and Registry data should look on this site, and
**what enforces each rule**. A rule nothing enforces is a wish. Every rule
here is marked:

- **Enforced**: a test, lint rule, constraint or hook fails when it is broken.
- **Ratchet**: a test holds today's count and fails if it goes up; fix outliers when you touch the file.
- **Doc only**: written down, not yet checked. The *Plan* section says how it gets enforced.

Measured 2026-10-14 by reading the codebase, all 226 migrations, and the
live Registry. Counts are the baseline; they should only go down.

---

## 1. Code

### Server actions (`src/app/actions/`)

| Rule | Status | Today |
|---|---|---|
| `"use server"` first; only async functions exported | Enforced (`use-server-exports.test.ts`) | Clean. 3 files in `actions/` are cached readers (`maker-hubs.ts`, `mentions.ts`, `reference-pages.ts`), not actions. |
| Order: zod `safeParse` → `requireAuth()` → ownership check → write through RLS | Doc only | Zod in 17 of 69 files. Raw `auth.getUser()` in 31 action files. |
| Return `{ success: true, ... } \| { success: false, error }`, never throw to the client | Doc only | 13 files each declare their own `ActionResult`; three shapes in use. `requireAuth()` throws `AuthError`, which 12 files never catch, so "not logged in" shows as a 500. |
| Never return raw database error text to the member | Doc only | `error: error.message` 296 times. |
| One wording for "not logged in": **"Please log in to do that."** | Doc only | Six different wordings today. |
| Every mutation revalidates what it changed | Doc only | 12 files write without revalidating. |
| Admin (service-role) client only from `getAdminClient()`, with a comment saying why RLS can't do it | Doc only | 3 admin files build their own client; about 30 call sites have no comment; `lib/supabase/admin.ts` lacks `import "server-only"`. |

### Types

| Rule | Status | Today |
|---|---|---|
| Database types are generated (`npm run gen-types`) after every pasted migration | Doc only | `database.generated.ts` is from 23 Aug and is missing 9 newer tables. |
| The Supabase client is typed (`SupabaseClient<Database>`) | Doc only | `requireAuth()` returns an untyped client, which causes most of the 180 `as unknown as` casts. |
| No `any` | Ratchet (ESLint, advisory) | 18. Healthy. |
| App code type-checks | Enforced (build) | Clean. Test files have 377 type errors (vitest does not type-check). |

### Files and folders

| Rule | Status | Today |
|---|---|---|
| Components PascalCase, default export | Doc only | 323 of 332. |
| `lib/` files camelCase | Doc only | 97 of 99. |
| Tests in `__tests__/` beside the code | Doc only | 245 of 245. |
| Imports use `@/` | Doc only | 1 relative parent import. |
| No barrel files | Doc only | 3 unused barrels to delete. |
| One helper per job: dates, money, paging | Doc only | `formatMoney` defined 3 times; `PAGE = 1000` paging re-written in 6 files; 18 date calls with no locale. |

### Styling (Tailwind v4 + tokens in `globals.css`)

| Rule | Status | Today |
|---|---|---|
| Colours come from tokens, never literals | Ratchet (`hardcoded-colors.test.ts`, baseline 406) | The test misses hex: 205 hex literals outside PDFs, 52 `[#hex]` classes. |
| `text-muted-foreground` for muted text; `text-muted` is a background token | Doc only | 29 `text-muted` uses, likely the wrong colour. |
| Use the `ui/` components (`Button`, `Input` ...) | Doc only | 307 raw `<button>`, 109 `<input>`. |
| Contrast passes in light and Lamplight | Enforced (`npm run test:contrast` + token test) | Clean. |

### Caching

| Rule | Status | Today |
|---|---|---|
| Shared caches are long and carry a tag; mutations clear by tag | Doc only | 3 caches have no tag; 11 `revalidateTag` calls clear tags nothing uses. |
| Cache keys are `domain:thing:vN`; bump `vN` when the shape changes | Doc only | Mixed styles. |

### Copy

| Rule | Status | Today |
|---|---|---|
| Room names: Stable, Shows, Market, The Paddock, Registry | Doc only | "Digital Stable", "The Marketplace", "Catalog Suggestions" still appear. |
| Words from `docs/GLOSSARY.md` | Doc only | |

### Lint and format

| Rule | Status | Today |
|---|---|---|
| ESLint passes | **Advisory in CI** | CI ran `next lint`, which no longer exists in Next 16, so lint never ran. Fixed to `npm run lint`; 30 errors and 73 warnings to clear before it can fail the build. |
| Prettier formatting | Not run anywhere | 987 of 1,059 files differ from `.prettierrc`. |

---

## 2. Database

### Naming

| Rule | Status | Today |
|---|---|---|
| snake_case; uuid `id` keys; `TIMESTAMPTZ` | Followed | Clean (4 text keys by design: card codes, provider event ids). |
| Plural table names | Doc only | ~13 singular (`financial_vault`, `horse_career` ...). Don't rename; follow for new tables. |
| Foreign keys end `_id`; `_by` only for "who did it" columns | Doc only | Followed. |
| Booleans start `is_` / `has_` | Doc only | 27 don't. New columns only. |
| References to people point at `public.users`, not `auth.users` | Doc only | ~47 point at `auth.users`. New columns only. |
| `created_at` on every table; `updated_at` kept by a trigger where it exists | Doc only | Only 2 tables maintain `updated_at`; `catalog_items` and `user_horses` have none. |

### Values

| Rule | Status | Today |
|---|---|---|
| System states are lowercase snake_case with a CHECK | Mostly followed | ~95 CHECK lists. Outliers: `'canceled'` vs `'cancelled'`, kebab `'no-match'`, Title Case `trade_status`. |
| Registry vocabulary (scale, run type, material) is Title Case display text from `taxonomy.ts` | **Doc only** | No database constraint on `scale`, `run_type`, `material`, `condition_grade`, or currency. This is why the Registry needed seven repair migrations. |
| A vocabulary has one home; CHECK lists match the TypeScript lists | Doc only | Two shipped bugs came from CHECK lists drifting behind the code (migrations 079→172, 101→169). |

### Safety

| Rule | Status | Today |
|---|---|---|
| RLS on every table | Followed | Clean. 9 service-role-only tables, by design. |
| SECURITY DEFINER functions set `search_path = ''` | Doc only | 62 use `''`, 43 use `public`. None missing. |
| Never cascade-delete history | **Not followed** | 27 foreign keys cascade from `user_horses`, including ownership history, transfers and show records. Soft delete protects them today; a hard delete would erase history. |
| Deleting a catalog row cannot strand horses or want lists | **Not followed** | `catalog_id` is `ON DELETE SET NULL`. "Merge, never delete" is held by discipline only. |
| A member can't want the same model twice | **Not followed** | The unique index went away with the old columns in migration 052. |
| No duplicate molds or releases | **Not followed** | No natural key on `catalog_items`; duplicates build up until merged. |

### Migrations

| Rule | Status | Today |
|---|---|---|
| Numbered, never reused | Followed | Gaps 045, 047, 049, 051, 174, 227 (227 was pasted by the owner and its SQL is not in the repo). |
| Re-runnable (`IF NOT EXISTS`, `DROP ... IF EXISTS`, `CREATE OR REPLACE`) | Followed since 166 | 66 older files are not re-runnable. Leave them. |
| Header: `-- NNN: Title` and a plain-words reason | Doc only | Three header styles. |
| A probe in `PENDING_MIGRATIONS` | Doc only | 9 recent migrations can't be probed (`kind: "none"`). |
| Schema in migrations; data repairs in `scripts/catalog-delta/` | Followed since October | 10 older migrations rewrote catalog data. |

---

## 3. Registry data formats

The live Registry, 2026-10-14: 11,806 rows. Run
`node scripts/catalog-delta/registry_health.mjs` for current numbers.

| Field | Standard | Today |
|---|---|---|
| Title | Capitalized, no trailing punctuation, no model number, year at the end as "(2025)" | 65 start lowercase; 279 end in punctuation (a description pasted into the title); 41 start with a model number. |
| Maker / artist | One spelling per person or company, capitalized | 12 pairs one or two letters apart (for example Brigitte / Brigette Eberl, Kristina Katunina / Kantunina, Melody Peña / Pena). |
| Scale | A value from `CANONICAL_SCALES`, or empty when unknown | Clean against the list. 1,290 artist resins have none. |
| Run type | A value from `RUN_TYPES`; original wording in `run_detail` | Clean. |
| Years | Numbers | 1,663 rows store years as text (from the March import). |
| Colour description | *Open question Q23* | 4,016 start lowercase, 2,283 uppercase. |
| Model number | Digits and letters as the maker prints them; no "#" | Clean. |
| Material | Plastic, Resin, Rubber/PVC/Vinyl, China/Ceramic, Pewter, Other | Clean. |
| Every release under a mold of its own scale | — | 99 remain where no same-scale mold exists. |

---

## 4. Plan: from doc-only to enforced

In order. Each step is small and can ship alone.

1. **Lint gate.** Fix the 30 ESLint errors; make the CI lint step fail on error. Add `tsc --noEmit` for app code to CI.
2. **One action result.** A shared `ActionResult` type in `src/lib/actions/result.ts`; `requireAuth()` typed as `SupabaseClient<Database>`; a `safeError()` helper that logs the database error and returns plain words. Convert files as they are touched; a ratchet test counts `error.message` returns and raw `getUser()` calls.
3. **Database guards for the Registry** (one migration, after a data repair clears today's violations):
   - CHECK constraints on `scale`, `attributes->>'run_type'` and `attributes->>'material'`, generated from `taxonomy.ts`, plus a test that fails when the two lists differ;
   - `user_wishlists (user_id, catalog_id)` unique;
   - `catalog_id` foreign keys `ON DELETE RESTRICT`, so a catalog row a horse points at cannot be deleted, only merged;
   - `updated_at` with a shared trigger on `catalog_items` and `user_horses`.
4. **History is never cascade-deleted.** Switch ownership history, transfers and show records to `RESTRICT` (soft delete keeps working).
5. **Data format repair** for titles, text years, and maker spellings, using the `registry-data-fix` workflow, once the owner answers Q23–Q26 in `docs/DECISIONS.md`.
6. **Prettier**: one formatting commit, then `prettier --check` in CI. It touches nearly every file, so do it when no other branch is open.
7. **Caching**: a central `lib/cache/tags.ts`, and a test that every `revalidateTag` names a registered tag.
8. **Colours**: extend the hardcoded-colours test to catch hex and `[#hex]`; fix `text-muted`.
9. **Regenerate types** and add a probe-style check that warns when a table in the database has no generated type.
