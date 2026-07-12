# Contributing to Model Horse Hub

## Code Style & Conventions

### TypeScript

- **Strict mode** is enabled in `tsconfig.json`
- **Generated database types** via `npm run gen-types` → `src/lib/types/database.generated.ts` — all three Supabase clients (`createClient`, `getAdminClient`) are typed with the `Database` generic
- **Do not** use `as unknown as` casts on Supabase query results in production code — let TypeScript infer types from the typed client. The only acceptable uses are: test mocks, CSV row parsing, and `Json` → concrete type conversions
- When nullable DB fields (e.g., `finish_type`, `condition_grade`) are passed to components expecting strings, coerce with `?? "default"` rather than casting

### Server Actions (`src/app/actions/*.ts`)

**The standard order, fixed, for every new action:** `zod parse → requireAuth() →
explicit ownership/role check → RLS-first write`. This is the pattern established across the
5 rebuilt domains (`shows-v2`, `shows-v2-ring`, `groups-forum`, `stable`, `showring` — see
`src/lib/{shows,groups,stable,showring}/schemas.ts` for the zod schemas) and is required for
all new action files going forward. It has **not** been retrofitted onto every pre-rebuild
action file yet (`horse.ts`, `market.ts`, `posts.ts`, etc.) — don't assume it's already there
just because the file is old.

1. **`"use server"` at the top** — required by Next.js
2. **Validate the input with `zod` first**, before touching auth or the database. Reject
   malformed input with a clear error before any side effect can happen.
3. **Auth check** — use `requireAuth()` from `@/lib/auth`, never raw `getUser()`
4. **Explicit ownership/role check** — even when RLS would also catch it, check ownership in
   the action so the error message is meaningful and the intent is visible in code review
5. **RLS-first for the actual write** — use the user's own `createClient()` and let RLS do the
   enforcement. Reach for `getAdminClient()` (bypasses RLS) only for genuine cross-user writes
   (notifications, transfers, admin actions) — and leave a code comment justifying why RLS
   can't do the job. An admin-client write with no justification comment is a red flag in review.
6. **Return type:** `{ success: boolean; error?: string; data?: T }`
7. **Wrap background tasks** in `after()` from `next/server` — don't block the response
8. **Call `revalidatePath()`** after mutations to invalidate cached data

```typescript
"use server";

import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

const doSomethingSchema = z.object({
    horseId: z.string().uuid(),
    name: z.string().min(1).max(120),
});

export async function doSomething(input: z.infer<typeof doSomethingSchema>): Promise<{ success: boolean; error?: string }> {
    const parsed = doSomethingSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const { supabase, user } = await requireAuth();

    // explicit ownership check, even though RLS would also enforce it
    const { data: horse } = await supabase.from("user_horses").select("owner_id").eq("id", parsed.data.horseId).single();
    if (horse?.owner_id !== user.id) return { success: false, error: "Not your horse" };

    // ... database mutation via the user's own RLS-scoped client ...

    after(async () => {
        // notifications, activity events (runs after response)
    });

    revalidatePath("/dashboard");
    return { success: true };
}
```

### Flag-Gated Dark-Ship Ritual

User-visible rebuilds of an existing live surface ship dark behind a `NEXT_PUBLIC_<DOMAIN>_V2`
env flag — never as a direct cutover on a surface real users depend on.

1. Build the new surface behind `if (process.env.NEXT_PUBLIC_<DOMAIN>_V2 === "1")`, old code
   path stays in the tree untouched.
2. Preview locally by setting the flag in your own `.env.local`.
3. Owner reviews the look (design changes always need owner + design-lead sign-off — see
   `docs/OPERATOR_PLAYBOOK.md` Part 3).
4. Owner flips the flag on in Vercel + redeploys.
5. Only after the owner is confident in prod does a follow-up PR delete the old code path —
   don't delete it preemptively just because the flag is on.

All four flags shipped this way (`SHOWS_V2`, `GROUPS_FORUM`, `STABLE_V2`, `SHOWRING_V2`) are
live in prod as of July 2026 — check `docs/getting-started/setup.md` for current status rather
than assuming from the code alone; "the flag exists" and "the flag is on in prod" are different
facts.

### Domain Libraries (`src/lib/<domain>/`)

For a rebuilt or newly-built domain, business logic (state machines, eligibility rules, ID/code
generation, results math, filter-param parsing) lives in a pure, framework-free
`src/lib/<domain>/` module with real unit test coverage — not inline in the Server Action, not
inline in the component. The action stays thin: zod-validate → auth/ownership → call the lib →
write. Established for `shows`, `groups`, `stable`, `showring`, `commerce`
(`src/lib/shows/stateMachine.ts`, `src/lib/shows/cardIssuance.ts`, `src/lib/stable/filterParams.ts`,
etc.) — new domains should follow the same split rather than growing another 1,000+ line action
file the way `horse.ts`/`market.ts` did before the rebuild.

### Worktree / Branch Flow

Agents build in a **git worktree**, never in the owner's own checkout, and push a branch — never
`main` directly:

1. Branch off `main` in a worktree (small, focused branches — one concern per branch).
2. Full suite green (`npx vitest run` — check the exit code directly, never pipe through
   `grep`) before pushing.
3. Push the branch; the main session (owner or a reviewing agent) merges after review.
4. `main` auto-deploys to Vercel prod on merge — there is no separate staging step for
   non-flag-gated changes, so the test suite and build are the safety net.
5. Migrations are files only (`supabase/migrations/NNN_*.sql`) — the owner personally pastes
   them into the Supabase SQL editor. An agent must never run `supabase db push` directly.

### Server Components (Pages)

- Default export, `async function`
- Fetch data with `await createClient()` from `@/lib/supabase/server`
- Auth check: `const { data: { user } } = await supabase.auth.getUser()`
- RLS handles row-level access — no manual auth checks on SELECT queries for own data

### Client Components (`src/components/*.tsx`)

- Always `"use client"` at top
- Use `useState` for loading/error states
- Import server actions directly — Next.js handles serialization
- **Modals MUST use `<Dialog>` from `@/components/ui/dialog`** (shadcn/Radix) — NOT `createPortal`. Exception: `PhotoLightbox.tsx` retains `createPortal` for custom keyboard navigation
- **Form inputs MUST use shadcn/ui** primitives (`<Input>`, `<Textarea>`, `<Select>`) — NOT raw `<input>` elements or `.form-input` classes
- **Use Framer Motion** for tactile micro-interactions (`whileTap`, `whileHover`, `staggerChildren`)

### CSS Architecture

The project uses **Tailwind CSS v4** for styling:

| Scope | Where to Add Styles |
|-------|-------------------|
| New component | Tailwind utility classes inline in JSX |
| Shared primitives (`.btn-*`, `.settings-toggle`) | `globals.css` |
| Design tokens | Tailwind theme config + `globals.css` `@theme` block |

**Rules:**
- New components should use **Tailwind utility classes** directly in JSX — do not create new CSS Module files
- Legacy CSS Modules (`.module.css`) are tolerated but not for new work
- Use Tailwind `@theme` tokens (`text-ink`, `text-muted`, `border-edge`, `bg-forest`, plus the leather/ledger/brass token ramp) — don't hard-code colors or spacing, and never hardcode the old warm-parchment hex values as a substitute for tokens
- **Cold palette BANNED** — `bg-white`, `bg-stone-50`, `border-stone-200`, `text-stone-900`, `text-stone-500` are banned. Use the semantic tokens for the current "leather at the landmarks, parchment for the work" design language instead (leather/brass/ledger materials on chrome & landmark surfaces, warm parchment on work surfaces, `text-ink`, `text-muted`, `border-edge`, and — critically — the `--leather-text` ramp for any text sitting on a leather surface; dark text on leather is invisible in day mode and light text on leather is invisible in Lamplight dark mode, so pick from the ramp, don't guess). See `docs/guides/design-system.md`. Known violations remain on a few public marketing pages pending a design pass — don't copy them as precedent
- Simple Mode: `[data-simple-mode="true"]` — 130% font scale, 60px min buttons

### Database

- Migrations in `supabase/migrations/` — **sequential numbering** (currently at 123; 119 files, a handful of numbers skipped)
- Always add **RLS policies** to new tables
- Add **foreign key indexes** for any new FK columns
- Use **soft delete** (tombstone) when records are referenced by other tables

### Design System

All UI work MUST follow the Design System Guide: [`docs/guides/design-system.md`](docs/guides/design-system.md)

**Hard Rules:**
1. **No custom page containers.** Every page must use one of the 4 Layout Archetypes (`ExplorerLayout`, `ScrapbookLayout`, `CommandCenterLayout`, `FocusLayout`).
2. **No inline styles.** `style={{...}}` is forbidden for layout, padding, or colors.
3. **Use shadcn/ui components.** Raw `<input>`, `<select>`, `<button>` elements are forbidden except inside shadcn component primitives. **Exception:** Use native `<input type="file">` for image gallery dropzones.
4. **No cold palette.** Use `text-ink` or `text-ink-light`, never `text-stone-900` or `text-black` or `#000`.

## Commit Conventions

Commit messages follow a descriptive format:

```
type: short description

# Examples:
feat: add commission WIP photo portal
fix: commerce state machine cancel from funds_verified
chore: extract ChatThread to CSS Module
docs: add architecture overview
refactor: migrate auth boilerplate to requireAuth()
test: add integration tests for transfer claim flow
```

**Types:** `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `style`

## Build Verification

Before committing, **always verify the build passes**:

```bash
npm run build
```

This catches TypeScript errors, import issues, and dead code. The project should build with **0 errors**.

## Pre-Commit Hooks

Husky runs unit tests on every commit. If tests fail, the commit is rejected.

## File Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Pages | `page.tsx` in route folder | `src/app/dashboard/page.tsx` |
| Server actions | `kebab-case.ts` | `src/app/actions/art-studio.ts` |
| Components | `PascalCase.tsx` | `src/components/CommissionTimeline.tsx` |
| CSS Modules | `ComponentName.module.css` | **Legacy — do not create new** |
| Utility files | `camelCase.ts` | `src/lib/utils/rateLimit.ts` |
| Migrations | `NNN_description.sql` | `supabase/migrations/102_pro_rls.sql` |

## Security Checklist

When adding new features, verify:

- [ ] New tables have **RLS policies** (SELECT, INSERT, UPDATE, DELETE as needed)
- [ ] Server actions use `requireAuth()` for authenticated operations
- [ ] Cross-user writes use `getAdminClient()`, not the user's client
- [ ] `financial_vault` is **never** queried on public routes
- [ ] User input is validated before database writes
- [ ] Rate limiting is applied to sensitive actions (`checkRateLimit()`)
- [ ] No secrets or environment variable values in code or documentation

## Testing Policy

- **Utility functions** (`src/lib/utils/`) — Write unit tests in `__tests__/`. Pure functions are highest-ROI.
- **Critical server actions** — When modifying `transactions.ts`, `hoofprint.ts`, `horse.ts`, `collections.ts`, `competition.ts`, or any of the 5 rebuilt-domain action files (`shows-v2.ts`, `shows-v2-ring.ts`, `groups-forum.ts`, `stable.ts`, `showring.ts`), add or update integration tests. Mock `after()` from `next/server` as a no-op.
- **Domain libs** (`src/lib/<domain>/`) — pure functions get unit tests in their own `__tests__/` folder; this is the highest-ROI test surface in the rebuilt domains (state machines, card issuance, callback ladders, filter params).
- **UI components** — Write React Testing Library tests in `src/components/__tests__/`. Use `// @vitest-environment jsdom` and the shared `setup.ts` for mocks. Currently 1,076 tests across 75 test files.
- **New features** — If it involves a state machine, complex validation, or financial data, it needs tests. Note there are still zero tests in `events`/`art-studio`/`messaging`/`competition`/`posts`/`market` — don't treat their current lack of coverage as precedent for skipping tests on new work in those areas.
- **Type safety** — After schema changes, run `npm run gen-types` to regenerate TypeScript types. The build will fail if query shapes drift from the schema.

## Getting Help

- Check `docs/README.md` for the documentation index
- Review `.agents/workflows/onboard.md` for full project context
- Check `.agents/workflows/dev-nextsteps.md` for the current task queue

---

**Full documentation:** [docs/](docs/README.md)
