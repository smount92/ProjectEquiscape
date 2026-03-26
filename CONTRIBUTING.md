# Contributing to Model Horse Hub

## Code Style & Conventions

### TypeScript

- **Strict mode** is enabled in `tsconfig.json`
- **Generated database types** via `npm run gen-types` → `src/lib/types/database.generated.ts` — all three Supabase clients (`createClient`, `getAdminClient`) are typed with the `Database` generic
- **Do not** use `as unknown as` casts on Supabase query results in production code — let TypeScript infer types from the typed client. The only acceptable uses are: test mocks, CSV row parsing, and `Json` → concrete type conversions
- When nullable DB fields (e.g., `finish_type`, `condition_grade`) are passed to components expecting strings, coerce with `?? "default"` rather than casting

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
- **Modals MUST use `<Dialog>` from `@/components/ui/dialog`** (shadcn/Radix) — NOT `createPortal`. Exception: `PhotoLightbox.tsx` retains `createPortal` for custom keyboard navigation
- **Form inputs MUST use shadcn/ui** primitives (`<Input>`, `<Textarea>`, `<Select>`) — NOT raw `<input>` elements or `.form-input` classes
- **Use Framer Motion** for tactile micro-interactions (`whileTap`, `whileHover`, `staggerChildren`)

### CSS Architecture

The project uses **Tailwind CSS v4** for styling:

| Scope | Where to Add Styles |
|-------|-------------------|
| New component | Tailwind utility classes inline in JSX |
| Shared primitives (`.btn-*`, `.card`, `.form-*`, `.modal-*`) | `globals.css` |
| Design tokens | Tailwind theme config + `globals.css` `@theme` block |

**Rules:**
- New components should use **Tailwind utility classes** directly in JSX — do not create new CSS Module files
- Legacy CSS Modules (`.module.css`) are tolerated but not for new work
- Use Tailwind theme tokens (`text-forest`, `bg-card`, `border-edge`) — don't hard-code colors or spacing
- Simple Mode: `[data-simple-mode="true"]` — 130% font scale, 60px min buttons

### Database

- Migrations in `supabase/migrations/` — **sequential numbering** (currently at 102)
- Always add **RLS policies** to new tables
- Add **foreign key indexes** for any new FK columns
- Use **soft delete** (tombstone) when records are referenced by other tables

### Design System

All UI work MUST follow the Design System Guide: [`docs/guides/design-system.md`](docs/guides/design-system.md)

**Hard Rules:**
1. **No custom page containers.** Every page must use one of the 4 Layout Archetypes (`ExplorerLayout`, `ScrapbookLayout`, `CommandCenterLayout`, `FocusLayout`).
2. **No inline styles.** `style={{...}}` is forbidden for layout, padding, or colors.
3. **Use shadcn/ui components.** Raw `<input>`, `<select>`, `<button>` elements are forbidden except inside shadcn component primitives.
4. **No pure black text.** Use `text-ink` or `text-stone-900`, never `text-black` or `#000`.

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
- **Critical server actions** — When modifying `transactions.ts`, `hoofprint.ts`, `horse.ts`, `collections.ts`, or `competition.ts`, add or update integration tests. Mock `after()` from `next/server` as a no-op.
- **UI components** — Write React Testing Library tests in `src/components/__tests__/`. Use `// @vitest-environment jsdom` and the shared `setup.ts` for mocks. Currently 245 tests across 23 test files.
- **New features** — If it involves a state machine, complex validation, or financial data, it needs tests.
- **Type safety** — After schema changes, run `npm run gen-types` to regenerate TypeScript types. The build will fail if query shapes drift from the schema.

## Getting Help

- Check `docs/README.md` for the documentation index
- Review `.agents/workflows/onboard.md` for full project context
- Check `.agents/workflows/dev-nextsteps.md` for the current task queue

---

**Full documentation:** [docs/](docs/README.md)
