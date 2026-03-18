# Contributing to Model Horse Hub

## Code Style & Conventions

### TypeScript

- **Strict mode** is enabled in `tsconfig.json`
- Manual database types in `src/lib/types/database.ts` — keep in sync with migrations
- Prefer explicit types over `any`. Use `unknown` when the type is truly unknown, then narrow with type assertions

### Server Actions (`src/app/actions/*.ts`)

Every server action file follows these patterns:

1. **`"use server"` at the top** — required by Next.js
2. **Auth check first** — use `requireAuth()` from `@/lib/auth`
3. **Return type:** `{ success: boolean; error?: string; data?: T }`
4. **Use `getAdminClient()`** for cross-user writes (notifications, transfers)
5. **Wrap background tasks** in `after()` from `next/server` — don't block the response
6. **Call `revalidatePath()`** after mutations to invalidate cached data

```typescript
"use server";

import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

export async function doSomething(data: { ... }): Promise<{ success: boolean; error?: string }> {
    const { supabase, user } = await requireAuth();

    // ... validation ...
    // ... database mutation ...

    after(async () => {
        // notifications, activity events (runs after response)
    });

    revalidatePath("/dashboard");
    return { success: true };
}
```

### Server Components (Pages)

- Default export, `async function`
- Fetch data with `await createClient()` from `@/lib/supabase/server`
- Auth check: `const { data: { user } } = await supabase.auth.getUser()`
- RLS handles row-level access — no manual auth checks on SELECT queries for own data

### Client Components (`src/components/*.tsx`)

- Always `"use client"` at top
- Use `useState` for loading/error states
- Import server actions directly — Next.js handles serialization
- **Modals MUST use `createPortal(overlay, document.body)`** from `react-dom` to avoid CSS containment issues from parent transforms

### CSS Architecture

| Scope | Where to Add Styles |
|-------|-------------------|
| New component | Create a `.module.css` file alongside the component |
| Shared primitives (`.btn-*`, `.card`, `.form-*`, `.modal-*`) | `globals.css` |
| Art Studio features | `studio.css` |
| Competition features | `competition.css` |
| Design tokens (colors, spacing, fonts) | `globals.css` `:root` block |

**Rules:**
- New components should use **CSS Modules** (`styles.className`), not add to `globals.css`
- Use design tokens from `:root` — don't hard-code colors or spacing
- The warm earth-toned theme uses: cream/parchment background (`#faf6f0`), sage green accent (`#3d5a3e`), brown/leather tones
- Simple Mode: `[data-simple-mode="true"]` — 130% font scale, 60px min buttons

### Database

- Migrations in `supabase/migrations/` — **sequential numbering** (currently at 090)
- Always add **RLS policies** to new tables
- Add **foreign key indexes** for any new FK columns
- Use **soft delete** (tombstone) when records are referenced by other tables

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
| CSS Modules | `ComponentName.module.css` | `src/components/ChatThread.module.css` |
| Utility files | `camelCase.ts` | `src/lib/utils/rateLimit.ts` |
| Migrations | `NNN_description.sql` | `supabase/migrations/089_commission_wip_photos.sql` |

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
- **Critical server actions** — When modifying `transactions.ts`, `hoofprint.ts`, `horse.ts`, `collections.ts`, or `competition.ts`, add or update integration tests. Mock `after()` from `next/server` as a no-op.
- **UI components** — Write React Testing Library tests in `src/components/__tests__/`. Use `// @vitest-environment jsdom` and the shared `setup.ts` for mocks. Currently 58 component tests covering 5 components.
- **New features** — If it involves a state machine, complex validation, or financial data, it needs tests.

## Getting Help

- Check `docs/README.md` for the documentation index
- Review `.agents/workflows/onboard.md` for full project context
- Check `.agents/workflows/dev-nextsteps.md` for the current task queue

---

**Full documentation:** [docs/](docs/README.md)
