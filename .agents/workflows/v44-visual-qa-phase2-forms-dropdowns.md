---
description: "V44 Visual QA Phase 2 — Forms & Dropdowns. Audit every form surface across 4 groups: multi-step wizards, single-page forms, inline forms, and filter bars. Label visibility, mobile select readability, alignment on all breakpoints."
---

# V44 Visual QA — Phase 2: Forms & Dropdowns

> **Epic:** V44 Site-Wide Visual QA Audit
> **Goal:** Every form on the platform has visible labels, readable selects, consistent alignment, and works in Simple Mode. Forms are the #1 source of beta user complaints.
> **Prerequisite:** Phase 1 complete (primitives are clean, so form-level issues are layout/composition bugs, not component bugs).

**MANDATORY:** Read `.agents/MASTER_BLUEPRINT.md` and `.agents/MASTER_SUPABASE.md` first. All Iron Laws and guardrails apply.

**Palette/WCAG rules:** Same as Phase 1. Warm parchment only. All labels ≥ 4.5:1 contrast. Touch targets ≥ 44px.

// turbo-all

---

## Pre-flight

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Group A — Multi-Step Wizards

### Task 2.1: Add to Stable — `src/app/add-horse/page.tsx`

This is the largest form (1,684 lines, 4 steps). Audit each step:

**Step 1 (Gallery):**
1. Photo slot labels visible on mobile (not clipped by image)
2. Upload button touch target ≥ 44px
3. AI detection badge readable on all backgrounds
4. Extra photos grid doesn't overflow on 375px

**Step 2 (Reference Link):**
5. `UnifiedReferenceSearch` input has visible label (not placeholder-only)
6. Search results dropdown readable on mobile
7. Selected reference badge has adequate contrast
8. "Skip" button visually distinct from "Next"

**Step 3 (Identity):**
9. Every `<select>` has a visible `<label>` above it (not just placeholder)
10. Finish Type, Condition Grade, Life Stage selects readable when closed
11. Show Bio section labels aligned with inputs on all breakpoints
12. Edition Info `#` and `of` inline layout doesn't break on mobile
13. Validation error messages (red shake) visible in Simple Mode

**Step 4 (Vault):**
14. Currency inputs properly formatted
15. Date input works on mobile browsers
16. Private data warning badge visible

**Step indicator:**
17. Progress dots/bar visible on parchment background
18. Current step label readable in Simple Mode

Apply fixes. Build after.

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 2.2: Studio Setup — `src/app/studio/setup/page.tsx`

1. All text inputs have visible labels
2. Specialty/medium selects readable when closed
3. Bio textarea has adequate min-height
4. Submit button visible in viewport on mobile (not pushed below fold)

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Group B — Single-Page Forms

### Task 2.3: Settings — `src/app/settings/page.tsx`

1. Every toggle/switch has a visible label
2. Currency select readable when closed
3. "Save" button position consistent (sticky bottom or inline)
4. Profile photo upload area visible on parchment
5. Password change fields have visible labels (not just placeholders)
6. Simple Mode toggle section clearly explains what it does

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 2.4: Event Create — `src/app/community/events/create/page.tsx`

1. Date/time inputs work on mobile
2. Event type select readable
3. Division/class builder inputs have labels
4. "NAMHSA Sanctioned" toggle visible and labeled

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 2.5: Group Create — `src/app/community/groups/create/page.tsx`

1. Group name, description inputs have labels
2. Privacy select readable
3. Submit button visible on mobile

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 2.6: Catalog New Suggestion — `src/app/catalog/suggestions/new/page.tsx`

1. All suggestion fields have visible labels
2. Manufacturer/mold selects readable when closed
3. "Suggest" button has adequate contrast

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Group C — Inline Forms

### Task 2.7: Stable Edit — `src/app/stable/[id]/edit/page.tsx`

1. Pre-populated fields distinguish "filled" from "placeholder" visually
2. Catalog re-link search input has visible label
3. Image reorder drag handles visible
4. Delete confirmation dialog readable (Phase 5 cross-ref)
5. Save/Cancel buttons always visible (sticky or in viewport)

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 2.8: Inbox Chat + Offer — `src/app/inbox/[id]/page.tsx`

1. Message input has visible placeholder AND adequate height
2. Offer form fields (price, notes) have labels
3. Rating stars are tappable on mobile (≥ 44px each)
4. File attachment button (📎) visible on parchment
5. Chat input doesn't get hidden behind mobile keyboard

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 2.9: Commission Request — `src/app/studio/[slug]/request/page.tsx`

1. Budget/timeline fields have labels
2. Description textarea min-height adequate
3. Reference photo upload area visible

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 2.10: CSV Import — `src/app/stable/import/page.tsx`

1. File drop zone visible on parchment (border must be distinct)
2. Column mapping selects readable
3. Preview table scrollable on mobile (cross-ref Phase 3)

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Group D — Filter Bars

### Task 2.11: Market Filters — `src/app/market/page.tsx`

1. All filter selects (scale, finish, price range) have visible labels
2. Active filter state visually distinct from inactive
3. "Clear filters" button visible
4. Filter bar doesn't overflow on mobile — wraps or collapses

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 2.12: Community Browse Filters — `src/app/community/page.tsx`

1. Sort/filter selects readable when closed
2. Category tabs/chips don't overflow on 375px

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 2.13: Catalog Filters — `src/app/catalog/page.tsx`

1. Search input has visible label or adequate placeholder
2. Manufacturer/scale filter selects readable
3. Sidebar filters accessible on mobile (stacked below, per prior fix)

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 2.14: Show Planner Filters — `src/app/shows/planner/page.tsx`

1. Horse selection picker readable
2. Class filter selects have labels

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 2.15: Event Manage — `src/app/community/events/[id]/manage/page.tsx`

1. Tab content forms (Edit Details, Class List, Judges) all have labeled inputs
2. Class/division management selects readable
3. Judge assignment UI accessible on mobile

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 2.16: Commit

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "fix(v44): phase 2 — forms & dropdowns audit, labels + readability + mobile fixes across 15 surfaces"
```

---

## ✅ DONE Protocol

Mark this phase complete when:
- [ ] Every `<select>` on the platform has a visible `<label>` (not placeholder-only)
- [ ] Every select's selected value is readable when dropdown is closed
- [ ] All filter bars wrap or collapse on mobile (no horizontal overflow)
- [ ] Multi-step wizard progress indicator visible in Simple Mode
- [ ] All form validation errors visible with adequate contrast
- [ ] Build passes with 0 errors
- [ ] Committed to git

**Next:** Run `/v44-visual-qa-phase3-tables-grids` for table and grid audit.
