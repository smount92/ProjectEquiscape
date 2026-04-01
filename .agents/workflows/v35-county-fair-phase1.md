---
description: "Digital County Fair Phase 1 — Fairness & Entry Limits. Fix entry caps to per-class, implement blind voting for photo shows."
---

# ⚖️ Phase 1: Fairness & Entry Limits

**Epic:** Digital County Fair UX  
**Goal:** Fix the entry caps to allow power users to bring their whole herd (3 per class, not 3 per show), and implement server-side blind voting to prevent popularity contests.

---

## Task 1.1: The "3 Per Class" Limit

**Target File:** `src/app/actions/shows.ts` — function `enterShow()` (~line 268–371)

### Current State
- Lines 308–318: The entry limit check counts ALL entries for `event_id = showId AND user_id = user.id` — capped at 3 per show total
- Error message: `"Maximum 3 entries per show."`

### Required Changes

1. **Modify the count query** (lines 309–314):
   - Change the `select` filter from:
     ```typescript
     .eq("event_id", showId)
     .eq("user_id", user.id)
     .eq("entry_type", "entered")
     ```
   - To also filter by `class_id`:
     ```typescript
     .eq("event_id", showId)
     .eq("user_id", user.id)
     .eq("entry_type", "entered")
     .eq("class_id", classId ?? "NO_CLASS")
     ```
   - **Edge case:** If `classId` is undefined/null (no class selected — "General" entry), count entries where `class_id IS NULL`. Use an alternative approach since Supabase `.eq()` doesn't work with null:
     ```typescript
     let entryCountQuery = supabase
       .from("event_entries")
       .select("id", { count: "exact", head: true })
       .eq("event_id", showId)
       .eq("user_id", user.id)
       .eq("entry_type", "entered");
     
     if (classId) {
       entryCountQuery = entryCountQuery.eq("class_id", classId);
     } else {
       entryCountQuery = entryCountQuery.is("class_id", null);
     }
     
     const { count: existingEntries } = await entryCountQuery;
     ```

2. **Update the error message** (line 317):
   - Change from: `"Maximum 3 entries per show."`
   - To: `"Maximum 3 entries per class."`

### Validation Checklist
- [x] A user CAN enter 4+ horses total in a show, as long as no more than 3 are in the same class
- [x] A user CANNOT enter a 4th horse in the same class
- [x] The error message says "Maximum 3 entries per class."
- [x] Entering without a class (General/no class) still caps at 3

> **Additional work (2026-03-31):** Migration `105_multi_class_entry.sql` dropped `event_entries_unique (event_id, horse_id)` and replaced with `event_entries_unique_class (event_id, horse_id, COALESCE(class_id, ...))`. ShowEntryForm converted from single-class radio to multi-select checkboxes with pill chips — one `enterShow()` call per selected class.

---

## Task 1.2: Blind Voting for Photo Shows

**Target Files:**
- `src/app/actions/shows.ts` — function `getShowEntries()` (~line 111–263)
- `src/app/shows/[id]/page.tsx` (~605 lines)

### Step A: Server-Side Masking in `getShowEntries()`

**File:** `src/app/actions/shows.ts`

After the `finalEntries` mapping (around line 247, just before the return), add blind voting masking logic:

```typescript
// Blind voting: mask owner identity in open photo shows for non-hosts/non-judges
if (s.show_status === "open") {
  // Fetch event type to confirm it's a photo show
  const { data: eventMeta } = await supabase
    .from("events")
    .select("event_type, created_by")
    .eq("id", showId)
    .single();
  
  const isPhotoShow = (eventMeta as { event_type: string } | null)?.event_type === "photo_show";
  const isHostOrAdmin = user?.id === s.created_by;
  
  // Check if user is an assigned judge
  let isAssignedJudge = false;
  if (user && !isHostOrAdmin) {
    const { data: judgeCheck } = await supabase
      .from("event_judges")
      .select("id")
      .eq("event_id", showId)
      .eq("user_id", user.id)
      .maybeSingle();
    isAssignedJudge = !!judgeCheck;
  }
  
  if (isPhotoShow && !isHostOrAdmin && !isAssignedJudge) {
    finalEntries = finalEntries.map(entry => ({
      ...entry,
      ownerAlias: entry.ownerId === user?.id ? entry.ownerAlias : "Anonymous Exhibitor",
      ownerId: entry.ownerId === user?.id ? entry.ownerId : "hidden",
    }));
  }
}
```

**Key design decisions:**
- Server-side masking prevents React DevTools inspection cheating
- The user's OWN entries are NOT masked (they need to see their own entries to withdraw, etc.)
- Show host and assigned judges see real names (they need this for judging)
- When show transitions to `judging` or `closed`, the real aliases are revealed automatically (no unmask code needed — the masking only triggers on `status === "open"`)

**Note:** The `event_type` is not currently in the initial `getShowEntries()` event query (line 121). You have two options:
1. Add `event_type` to the existing event SELECT at line 121 (preferred — avoids an extra query)
2. Do a separate fetch as shown above

**Preferred approach — add to existing query:**
- Line 121: Change `select("id, name, description, show_status, show_theme, ends_at, created_at, created_by, judging_method")` to add `, event_type`
- Update the type cast at line 127–132 to include `event_type: string`
- Then use `s.event_type` directly in the masking logic instead of a separate query

### Step B: UI Masking in Show Detail Page

**File:** `src/app/shows/[id]/page.tsx`

In the entries grid (lines 522–590), where the owner alias is rendered as a `<Link>`:

Lines 546–548 currently render:
```tsx
<Link href={`/profile/${encodeURIComponent(entry.ownerAlias)}`}>
  @{entry.ownerAlias}
</Link>
```

Change to:
```tsx
{entry.ownerId === "hidden" ? (
  <span className="text-muted text-sm">@{entry.ownerAlias}</span>
) : (
  <Link href={`/profile/${encodeURIComponent(entry.ownerAlias)}`}>
    @{entry.ownerAlias}
  </Link>
)}
```

Apply the same pattern to the podium/champion sections (lines 352–357 and 391–398) — but these only render when `status === "closed"`, so they won't need masking in practice. Still, add defensive rendering just in case.

### Validation Checklist
- [x] View an Open Photo Show from a non-host account: Owner names show "Anonymous Exhibitor"
- [x] Own entries still show your real alias
- [x] Owner alias is plain text (not a clickable link) when masked
- [x] View a Closed Photo Show: Real names are revealed
- [x] View a Judging Photo Show: Names masked (by design — changed from spec)
- [x] Host/creator can always see real names even during Open status
- [x] Assigned judges can always see real names during Open status

> **Implementation notes (2026-03-31):** Masking condition changed to `s.show_status !== "closed"` (masks during both open AND judging) because the auto-transition at line 135 silently flips open→judging, which bypassed the original `=== "open"` check. Also applied blind voting UI masking to `/community/events/[id]/page.tsx` (second caller of `getShowEntries`).

---

## ✅ HUMAN VERIFICATION GATE 1 — PASSED (2026-03-31)

- [x] Test `enterShow`: Can you enter 4 horses total, as long as no more than 3 are in the same class?
- [x] View an Open Photo Show from a non-host account: Are the owner names hidden ("Anonymous Exhibitor")?
- [x] View a Closed Photo Show: Are the names revealed?

---

## Build Gate
✅ `npx next build` — 0 errors (exit code 0). Phase 1 complete.
