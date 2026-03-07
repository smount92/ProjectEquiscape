---
description: Implement the Social Layer feature (Favorites & Comments) — step-by-step through 4 atomic tasks
---

# Social Layer Implementation Workflow

This workflow walks through building Favorites (❤️) and Comments (💬) for the Community Show Ring. Execute each task in order — each one depends on the previous.

> **IMPORTANT:** Run `/onboard` first if this is your first time in this session.

---

## Pre-flight Check

1. Confirm you understand the project conventions by reviewing the developer conventions document.
2. Confirm the dev server runs without errors:

// turbo
```
cd c:\Project Equispace\model-horse-hub && npm run dev
```

If there are build errors, fix them before proceeding.

---

## Task 1: Database Migration

**Goal:** Create the `horse_favorites` and `horse_comments` tables with RLS.

1. Read the full task spec from the brain artifacts directory (task_1_migration.md).

2. Create the file `supabase/migrations/010_social_layer.sql` with the exact SQL from the spec.

3. The migration needs to be run in the **Supabase Dashboard SQL Editor** (or via CLI). Inform the user:
   > "Migration file created. Please run `supabase/migrations/010_social_layer.sql` in your Supabase Dashboard SQL Editor, then confirm when done."

4. **STOP and wait for user confirmation** that the migration has been applied before proceeding.

---

## Task 2: TypeScript Types + Server Actions

**Goal:** Add types for the new tables and create the `social.ts` server actions file.

1. Read the full task spec from the brain artifacts directory (task_2_types_and_actions.md).

2. Edit `src/lib/types/database.ts`:
   - Add `HorseFavorite` and `HorseComment` interfaces after `UserWishlist`
   - Add `horse_favorites` and `horse_comments` to the `Database.public.Tables` interface

3. Create `src/app/actions/social.ts` with three functions:
   - `toggleFavorite(horseId)` — insert/delete toggle, returns `{ success, isFavorited, count }`
   - `addComment(horseId, content)` — validates input, 500 char max
   - `deleteComment(commentId)` — relies on RLS for authorization

4. Verify TypeScript compiles:

// turbo
```
cd c:\Project Equispace\model-horse-hub && npx tsc --noEmit
```

---

## Task 3: FavoriteButton + Show Ring Integration

**Goal:** Build the FavoriteButton component and wire it into the Community Show Ring.

1. Read the full task spec from the brain artifacts directory (task_3_favorite_button.md).

2. Create `src/components/FavoriteButton.tsx`:
   - Heart icon with count display
   - Optimistic toggle (fill/unfill immediately, revert on error)
   - `e.preventDefault()` + `e.stopPropagation()` (CRITICAL — it's inside a `<Link>`)

3. Modify `src/app/community/page.tsx`:
   - Add Supabase queries after `signedUrlMap` to fetch favorite counts + user's favorites
   - Add `favoriteCount` and `isFavorited` to `communityCards` map output

4. Modify `src/components/ShowRingGrid.tsx`:
   - Import `FavoriteButton`
   - Add `favoriteCount: number` and `isFavorited: boolean` to `CommunityCardData` interface
   - Render `<FavoriteButton>` in card footer next to `<WishlistButton>`

5. Add CSS for `.favorite-btn` to `src/app/globals.css` (see task spec for exact styles).

6. Verify the build:

// turbo
```
cd c:\Project Equispace\model-horse-hub && npm run build
```

7. **Test in browser:** Hearts should appear on Show Ring cards, toggle fill/count on click.

---

## Task 4: CommentSection + Passport Integration

**Goal:** Build the CommentSection component and wire it into the Public Passport page.

1. Read the full task spec from the brain artifacts directory (task_4_comments_and_passport.md).

2. Create `src/components/CommentSection.tsx`:
   - Comment input with character counter (500 max)
   - Optimistic prepend on submit
   - Delete button visible on hover for comment author + horse owner
   - `timeAgo` formatting
   - Link to commenter's profile via `@alias`

3. Modify `src/app/community/[id]/page.tsx`:
   - Import `FavoriteButton` and `CommentSection`
   - Add queries: favorite count, user's fav status, comments with `users!inner(alias_name)` join
   - Add `<FavoriteButton>` next to `<ShareButton>` in sidebar actions
   - Add `<CommentSection>` below the `passport-layout` div

4. Add all comment CSS to `src/app/globals.css`:
   - `.comment-section`, `.comment-input-row`, `.comment-input`, `.comment-item`, etc.
   - Glassmorphism card style matching `passport-detail-card`
   - Delete button: revealed on hover (opacity transition)
   - Responsive: stack input on mobile

5. Verify the build:

// turbo
```
cd c:\Project Equispace\model-horse-hub && npm run build
```

6. **Test in browser:**
   - Navigate to `/community/[id]` (any public horse)
   - Verify comment section renders below gallery
   - Post a comment → appears immediately
   - Favorite button toggles with count

---

## Final Verification

1. Run the full build:

// turbo
```
cd c:\Project Equispace\model-horse-hub && npm run build
```

2. Walk through the complete test checklist:
   - [ ] Favoriting a horse toggles the heart icon on Show Ring cards
   - [ ] Favorite count updates + persists on page refresh
   - [ ] Un-favoriting decrements the count
   - [ ] Favorite heart appears and works on Public Passport page
   - [ ] Comments appear in reverse chronological order
   - [ ] 500 character limit enforced with live counter
   - [ ] Comment author sees delete button on hover
   - [ ] Horse owner sees delete button on ALL comments
   - [ ] Other users cannot see delete buttons
   - [ ] Empty state: "No comments yet" message

3. Commit and push:
```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "feat: Social Layer — Favorites & Comments on Show Ring and Passport" && git push
```

---

## Documentation Update (MANDATORY)

> **You are NOT done until this step is complete.** Skipping documentation is not acceptable.

4. Update the **Master Architecture Report** (`00_master_architecture.md` in the brain artifacts directory):
   - Bump the version number (e.g., V1.1 → V1.2)
   - Add `social.ts` to the actions list in the project structure tree
   - Add `FavoriteButton.tsx` and `CommentSection.tsx` to the components list
   - Add `010_social_layer.sql` to the migrations list
   - Add `horse_favorites` and `horse_comments` to the "Marketplace & Social" DB schema table
   - Add "Social Layer (Favorites + Comments)" as a new row in the "Completed Features" table
   - Move "Social Layer" from the roadmap to completed, and update the **NEXT** pointer

5. Update the **Social Layer Plan** (`01_social_layer_plan.md` in the brain artifacts directory):
   - Add a `> [!NOTE]` banner at the top marking it as **STATUS: COMPLETE** with the date

6. Update the **Future Roadmap** (`03_future_roadmap.md` in the brain artifacts directory):
   - Update the priority queue diagram to show Social Layer as DONE
   - Update the NEXT pointer to the next feature in the queue

7. Mark all task files as complete:
   - Add a completion note to `task_1_migration.md`, `task_2_types_and_actions.md`, `task_3_favorite_button.md`, and `task_4_comments_and_passport.md`

8. Inform the user: **"✅ Social Layer — Complete!"** with:
   - Summary of files created and modified
   - Confirmation that all documentation has been updated
   - What the next feature on the roadmap is
