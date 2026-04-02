---
description: Modals, overlaps, and touch targets — Dialog mobile widths, flexbox stacking, word-break, and WCAG touch target enforcement
---

# 074 — Modals, Overlaps, and Touch Targets

> **Purpose:** Fix the four remaining categories of mobile UX pain: dialogs getting cut off, flex rows overlapping, long text breaking layouts, and buttons too small to tap.
> **Depends On:** `073-mobile-macro-layouts.md` (macro layouts must be fixed first)
> **Output:** Every modal, flex bar, text element, and button is mobile-safe across all 121 components.

// turbo-all

---

## Task 1: Dialog Width & Height Containment

### 1.1 Current state of `DialogContent`

**File:** `src/components/ui/dialog.tsx` (line 63–64)

The base `DialogContent` currently uses:
```
w-full max-w-[calc(100%-2rem)] ... sm:max-w-sm
```

This means on mobile it's `100% - 32px` wide (good!) but on desktop it defaults to `sm:max-w-sm` (384px). The problem is that **individual consumers override this** with `sm:max-w-[420px]`, `sm:max-w-[520px]`, etc. — but they don't set a `max-h` or `overflow-y-auto`, so tall dialogs get cut off on mobile.

### 1.2 Fix the base DialogContent

**File:** `src/components/ui/dialog.tsx`

Update the default className on line 64 to include mobile-safe height constraints:

```tsx
// BEFORE (line 63-64):
className={cn(
    "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
    className
)}

// AFTER:
className={cn(
    "fixed top-1/2 left-1/2 z-50 grid w-[95vw] max-h-[90dvh] overflow-y-auto -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:w-full sm:max-w-lg data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
    className
)}
```

**Changes:**
- `max-w-[calc(100%-2rem)]` → `w-[95vw]` — more predictable, always 95% of viewport
- Added `max-h-[90dvh]` — dialog never exceeds 90% of viewport height (uses `dvh` for iOS)
- Added `overflow-y-auto` — long content scrolls inside the dialog, not behind it
- `sm:max-w-sm` → `sm:w-full sm:max-w-lg` — slightly wider default on desktop (512px vs 384px)

### 1.3 Audit all DialogContent consumers

Every component that passes a `className` to `<DialogContent>` may override the base styles. Audit each one:

| Component | File | Current Override | Action |
|-----------|------|-----------------|--------|
| `TransferModal` | `TransferModal.tsx:93` | `sm:max-w-[420px]` | Keep — within `sm:max-w-lg` range |
| `MakeOfferModal` | `MakeOfferModal.tsx:63` | `sm:max-w-[420px]` | Keep |
| `DeleteHorseModal` | `DeleteHorseModal.tsx:56` | `sm:max-w-md` | Keep |
| `DashboardShell` | `DashboardShell.tsx:248` | `sm:max-w-md` | Keep |
| `ShowEntryForm` | `ShowEntryForm.tsx:365` | `sm:max-w-[560px]` | Keep — stable picker needs width |
| `SuggestReferenceModal` | `SuggestReferenceModal.tsx:79` | `sm:max-w-[520px]` | Keep |
| `SuggestEditModal` | `SuggestEditModal.tsx:127` | `sm:max-w-[580px] max-h-[85vh]` | Update `max-h-[85vh]` to `max-h-[85dvh]` |
| `ImageCropModal` | `ImageCropModal.tsx:294` | `sm:max-w-2xl` | Keep — crop tool needs space |
| `CollectionPicker` | `CollectionPicker.tsx:157` | `sm:max-w-[480px]` | Keep |
| `CollectionManager` | `CollectionManager.tsx:69` | `sm:max-w-[480px]` | Keep |

**Key fix:** `SuggestEditModal` uses `max-h-[85vh]` — change to `max-h-[85dvh]` for iOS compatibility.

### 1.4 Search for any remaining portal modals

```powershell
cmd /c "npx rg -n 'createPortal' src/ --include '*.tsx' -l 2>&1"
```

Any component still using `createPortal` instead of shadcn `<Dialog>` needs to be flagged for migration. Expected: only `PhotoLightbox.tsx` (intentional exception — fullscreen photo viewer). 

### Validation Checklist
- [ ] `DialogContent` base has `w-[95vw] max-h-[90dvh] overflow-y-auto`
- [ ] `DialogContent` desktop default is `sm:w-full sm:max-w-lg`
- [ ] All consumer overrides use viewport-safe `dvh` units for `max-h`
- [ ] No `max-h-[85vh]` remains — all converted to `dvh`
- [ ] On iPhone: dialogs don't get cut off at the bottom
- [ ] On iPhone: long dialog content scrolls within the dialog

---

## Task 2: Flexbox Overlap & Stacking Fixes

### 2.1 The problem

`flex items-center` without a wrapping or stacking fallback causes elements to overlap or get clipped on narrow viewports. Elements that sit side-by-side on desktop need to stack vertically on mobile.

### 2.2 Search for at-risk flex patterns

```powershell
cmd /c "npx rg -n 'flex items-center justify-between' src/ --include '*.tsx' 2>&1"
```

This finds flex rows that split left/right content — the #1 pattern that breaks on mobile when both sides contain too much content.

### 2.3 Fix patterns

**Pattern A: Header bars with text + buttons**
```tsx
// BEFORE:
<div className="flex items-center justify-between">
    <h2 className="text-xl font-bold">Long Section Title</h2>
    <div className="flex gap-2">
        <Button>Action 1</Button>
        <Button>Action 2</Button>
    </div>
</div>

// AFTER:
<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <h2 className="text-xl font-bold">Long Section Title</h2>
    <div className="flex gap-2">
        <Button>Action 1</Button>
        <Button>Action 2</Button>
    </div>
</div>
```

**Pattern B: Inline metadata rows**
```tsx
// BEFORE:
<div className="flex items-center gap-4">
    <span>Owner: LongUsername123</span>
    <span>Added: March 31, 2026</span>
    <span>Condition: LSQ</span>
</div>

// AFTER:
<div className="flex flex-wrap items-center gap-x-4 gap-y-1">
    <span>Owner: LongUsername123</span>
    <span>Added: March 31, 2026</span>
    <span>Condition: LSQ</span>
</div>
```

### 2.4 Key components to audit

| Component | Pattern | Fix |
|-----------|---------|-----|
| `Header.tsx` | Priority+ nav | Already handles overflow via ResizeObserver ✅ |
| `ExplorerLayout.tsx:24` | Title + header actions | Already has `flex-col sm:flex-row` ✅ |
| `CommandCenterLayout.tsx:24` | Title + header actions | Already has `flex-col sm:flex-row` ✅ |
| Show detail page | Entry count + action buttons | Check for `flex-wrap` or `flex-col sm:flex-row` |
| Passport page | Horse metadata row | Add `flex-wrap gap-y-1` |
| Profile page | Stats bar | Check wrapping |
| Dashboard page | Quick actions bar | Check stacking |

### 2.5 Strategy for the full sweep

```powershell
# Find all flex-between without responsive stacking
cmd /c "npx rg -n 'flex items-center justify-between' src/components/ --include '*.tsx' 2>&1"
cmd /c "npx rg -n 'flex items-center justify-between' src/app/ --include '*.tsx' 2>&1"
```

For each result, check if the parent has enough width for its contents at 390px. If not, add `flex-col gap-3 sm:flex-row` or `flex-wrap`.

### Validation Checklist
- [ ] No flex row causes content overlap at 390px viewport
- [ ] Header action bars stack vertically on mobile
- [ ] Metadata rows wrap naturally with `flex-wrap gap-y-1`
- [ ] No text is clipped or hidden behind sibling elements

---

## Task 3: Word Break & Text Overflow Protection

### 3.1 The problem

Long strings — horse names, URLs, user aliases, mold names, hash IDs — can push containers wider than the viewport. CSS `word-break` and `overflow-wrap` prevent this.

### 3.2 Add utility classes to high-risk text elements

**Pattern: Horse names in cards**
```tsx
// Add to any element rendering user-provided text:
className="break-words"
// or for single-line truncation:
className="truncate"
```

### 3.3 Key locations to audit

```powershell
# Find card components (likely contain horse names)
cmd /c "npx rg -n 'horseName|horse_name|horse\.name|horse\.custom_name' src/ --include '*.tsx' 2>&1"

# Find URL rendering
cmd /c "npx rg -n 'href=\{|url|URL' src/components/ --include '*.tsx' -l 2>&1"
```

### 3.4 Priority fix targets

| Element | Component(s) | Class to Add |
|---------|-------------|-------------|
| Horse card title | `StableGrid.tsx`, `ShowRingGrid.tsx` | `truncate` (single-line with ellipsis) |
| Horse passport title | `stable/[id]/page.tsx` | `break-words` (allow wrapping) |
| User alias in comments | `PostCard.tsx`, various | `truncate max-w-[200px]` |
| Mold/release name | `UnifiedReferenceSearch.tsx` | `truncate` in result rows |
| Chat message URLs | `ChatThread.tsx` | `break-all` (URLs have no natural break points) |
| Transfer claim PIN | `TransferModal.tsx` | `font-mono break-all` |
| Hoofprint events | `HoofprintTimeline.tsx` | `break-words` on event descriptions |

### 3.5 Global CSS safety net

**File:** `src/app/globals.css`

Add after the iOS zoom fix:

```css
/* Prevent long words from causing horizontal overflow */
h1, h2, h3, h4, h5, h6 {
    overflow-wrap: break-word;
    word-break: break-word;
}
```

### Validation Checklist
- [ ] Horse names in card grids truncate with ellipsis
- [ ] Horse passport page wraps long names
- [ ] URLs in chat messages break correctly
- [ ] No single long string causes a container to exceed viewport width
- [ ] Headings use `overflow-wrap: break-word` globally

---

## Task 4: Touch Target Enforcement (WCAG 2.2)

### 4.1 The standard

WCAG 2.2 Success Criterion 2.5.8 requires interactive targets to be at least **44×44 CSS pixels** for accessible touch interaction. On mobile, tiny icon buttons are nearly impossible to tap accurately.

### 4.2 Audit core interaction components

```powershell
# Find small icon-only buttons
cmd /c "npx rg -n 'size=\"icon\"' src/ --include '*.tsx' 2>&1"
cmd /c "npx rg -n 'size=\"icon-sm\"' src/ --include '*.tsx' 2>&1"
```

### 4.3 Fix pattern for icon buttons

```tsx
// BEFORE:
<Button variant="ghost" size="icon" onClick={...}>
    <Heart className="size-5" />
</Button>

// AFTER — add mobile touch target padding:
<Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0" onClick={...}>
    <Heart className="size-5" />
</Button>
```

**Why the `sm:` breakpoint reset?** On desktop, 44px buttons look oversized. The `sm:min-h-0 sm:min-w-0` resets the minimum on screens ≥640px, keeping the compact desktop aesthetic.

### 4.4 Priority components to audit

| Component | Type | Current Size | Fix |
|-----------|------|-------------|-----|
| `VoteButton.tsx` | Icon toggle | Likely `size="icon"` (~32px) | Add `min-h-[44px] min-w-[44px]` |
| `LikeToggle.tsx` | Icon toggle | Likely `size="icon"` | Add touch target |
| `FavoriteButton.tsx` | Icon toggle | Likely `size="icon"` | Add touch target |
| `ShareButton.tsx` | Icon button | Check size | Add touch target |
| `BackToTop.tsx` | Floating button | Check size | Ensure ≥ 44px |
| `NotificationBell.tsx` | Header icon | Check size | Add touch target |
| `FollowButton.tsx` | Text button | Usually OK | Verify height ≥ 44px |

### 4.5 Global CSS approach (alternative)

Instead of fixing each button individually, add a global rule:

**File:** `src/app/globals.css`

```css
/* Mobile touch target minimum (WCAG 2.5.8) */
@media (pointer: coarse) {
    button, [role="button"], a[href] {
        min-height: 44px;
        min-width: 44px;
    }
}
```

> ⚠️ **Caution:** This is aggressive and may create unwanted spacing in dense UIs (e.g., badge grids, table action columns). Use the per-component approach from 4.3 if the global rule causes layout issues. Test both approaches and pick one.

### 4.6 Verify with Playwright accessibility audit

The existing `accessibility.spec.ts` may catch some touch target issues via `axe-core`. Add a specific check:

```ts
// In accessibility.spec.ts or a new section of mobile-layout.spec.ts:
test("Touch targets meet WCAG 2.5.8", async ({ page }) => {
    await page.goto("/shows");
    const smallButtons = await page.$$eval("button, [role='button']", (els) =>
        els.filter((el) => {
            const rect = el.getBoundingClientRect();
            return rect.width < 44 || rect.height < 44;
        }).map((el) => ({
            text: el.textContent?.trim().substring(0, 30),
            width: Math.round(el.getBoundingClientRect().width),
            height: Math.round(el.getBoundingClientRect().height),
        }))
    );
    
    // Log violations for manual review
    if (smallButtons.length > 0) {
        console.log("Touch target violations:", JSON.stringify(smallButtons, null, 2));
    }
    
    // This is a soft assertion — log but don't fail (yet)
    // Once all components are fixed, change to expect(smallButtons).toHaveLength(0)
});
```

### Validation Checklist
- [ ] `VoteButton`, `LikeToggle`, `FavoriteButton` have 44×44px minimum on mobile
- [ ] `ShareButton`, `BackToTop`, `NotificationBell` meet touch target
- [ ] Dialog close button (`X` icon) meets touch target
- [ ] No interactive element feels too small to tap on an actual mobile device
- [ ] Desktop sizes are not affected (breakpoint reset or `@media (pointer: coarse)`)

---

## 🛑 FINAL VERIFICATION GATE 🛑

**Stop execution. Run the complete mobile test suite:**

```powershell
cmd /c "npx playwright test e2e/device-layout.spec.ts 2>&1"
```

**Expected result:** All public pages pass the horizontal overflow test.

**Manual verification on device/simulator:**
1. Open `/dashboard` — no horizontal scroll
2. Open `/shows` — entries grid collapses to 1 column
3. Open `/market` — table scrolls horizontally inside its container (not the page)
4. Tap Vote button — no mistaps, target feels comfortable
5. Open any dialog — fits within screen, scrolls if content is tall
6. Rotate landscape ↔ portrait — layout adapts cleanly

Await human input: "Mobile UX Sprint Complete. All 4 phases verified."

---

## Build Gate

Run `npx next build` (via `cmd /c "npx next build 2>&1"`) and confirm 0 errors before marking complete.
