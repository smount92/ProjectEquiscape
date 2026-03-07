---
description: Implement the User-to-User Ratings feature (Transaction Feedback) — step-by-step through 4 atomic tasks
---

# User-to-User Ratings — Implementation Workflow

> **Feature:** Transaction Feedback with 5-star reviews
> **Plan:** `05_user_ratings_plan.md` (in brain artifacts)
> **Tasks:** `task_9` through `task_12` (in brain artifacts)

## Prerequisites
- Provenance Tracking must be complete and committed
- The latest `main` branch must be checked out
- The dev server should NOT be running during migration steps

---

## Step 1: Read the Full Plan

Before writing any code, read the implementation plan to understand the full scope:

```
View: 05_user_ratings_plan.md (in brain artifacts directory)
```

Read the developer conventions so you follow established patterns exactly:

```
View: 02_developer_conventions.md (in brain artifacts directory from conversation 2a3da000)
```

---

## Step 2: Database Migration (Task RATE-T1)

Read the task file:
```
View: task_9_ratings_migration.md (in brain artifacts directory)
```

Execute the task:
1. Create `supabase/migrations/012_user_ratings.sql` with the SQL from the task file
2. Apply the migration to the Supabase database via the SQL Editor
3. Verify all tables, policies, and indexes exist per the checklist

---

## Step 3: TypeScript Types + Server Actions (Task RATE-T2)

Read the task file:
```
View: task_10_ratings_types_actions.md (in brain artifacts directory)
```

Execute the task:
1. Add `UserRating` interface to `src/lib/types/database.ts`
2. Add `user_ratings` entry to the `Database` interface
3. Create `src/app/actions/ratings.ts` with `leaveRating`, `deleteRating`, `getUserRatingSummary`
4. Verify: `tsc --noEmit` passes

// turbo
```
cd c:\Project Equispace\model-horse-hub && npx tsc --noEmit
```

---

## Step 4: Client Components + CSS (Task RATE-T3)

Read the task file:
```
View: task_11_ratings_components.md (in brain artifacts directory)
```

Execute the task:
1. Create `src/components/RatingStars.tsx`
2. Create `src/components/RatingForm.tsx`
3. Create `src/components/RatingBadge.tsx`
4. Add all CSS styles to `src/app/globals.css`
5. Verify: `npm run build` passes

// turbo
```
cd c:\Project Equispace\model-horse-hub && npm run build
```

---

## Step 5: Page Integration (Task RATE-T4)

Read the task file:
```
View: task_12_ratings_page_integration.md (in brain artifacts directory)
```

Execute the task:
1. Modify `src/app/inbox/[id]/page.tsx` — add rating form to conversation thread
2. Modify `src/app/profile/[alias_name]/page.tsx` — add rating badge + reviews section
3. Modify `src/app/inbox/page.tsx` — add rated indicator on inbox items
4. Verify: `npm run build` passes

// turbo
```
cd c:\Project Equispace\model-horse-hub && npm run build
```

---

## Step 6: Browser Testing

Start the dev server and verify all functionality:

// turbo
```
cd c:\Project Equispace\model-horse-hub && npm run dev
```

### Test Checklist
1. Open a conversation thread → rating form should appear
2. Select stars (1-5) → label updates (Poor/Fair/Good/Great/Excellent)
3. Type optional review → character counter works (300 max)
4. Submit rating → success message appears
5. Reload page → existing rating shown with retract option
6. Navigate to the other user's profile → ★ badge visible in hero stats
7. Scroll down → Reviews section shows the rating you just left
8. Navigate to inbox list → ⭐ indicator on the rated conversation
9. Retract the rating → form reappears, badge/reviews update on profile

---

## Step 7: Commit + Documentation

1. Verify final build is clean:

// turbo
```
cd c:\Project Equispace\model-horse-hub && npm run build
```

2. Commit and push:

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "feat: User-to-User Ratings - Transaction Feedback with 5-star reviews" && git push
```

3. Update architecture documentation:
   - Update `00_master_architecture.md` — add user_ratings to schema, ratings.ts to actions, new components, mark feature as complete
   - Update `03_future_roadmap.md` — mark Ratings as DONE, advance the priority queue
   - Mark `05_user_ratings_plan.md` as STATUS: COMPLETE
