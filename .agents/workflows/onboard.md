---
description: Onboard to the Model Horse Hub project — read architecture, conventions, and current state before doing any work
---

# Onboard to Model Horse Hub

Run this workflow before starting ANY work on the project. It loads the full context into your session.

## Steps

1. Read the **Master Architecture Report** to understand the tech stack, project structure, database schema, and all completed features:

```
View file: C:\Project Equispace\Architecture&State_Report.txt
```

2. Read the **Developer Conventions** reference to understand the strict coding patterns you MUST follow (server components, server actions, client components, CSS, migrations, types):

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

5. You are now ready to work. Ask the user what they'd like to do next.
