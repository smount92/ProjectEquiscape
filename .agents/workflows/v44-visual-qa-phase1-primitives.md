---
description: "V44 Visual QA Phase 1 — shadcn Primitives. Full audit of all 11 ui/ primitives for contrast, focus states, disabled states, Simple Mode scaling, warm palette compliance, and WCAG keyboard nav."
---

# V44 Visual QA — Phase 1: shadcn Primitives Audit

> **Epic:** V44 Site-Wide Visual QA Audit
> **Goal:** Ensure every base primitive in `src/components/ui/` meets contrast, accessibility, palette, and scaling standards. These components propagate everywhere — a bug here is a bug on every page.
> **Prerequisite:** Phase 0 complete (`visual-qa-checklist.md` + `visual-qa-surface-inventory.json` exist).

**MANDATORY:** Read `.agents/MASTER_BLUEPRINT.md` and `.agents/MASTER_SUPABASE.md` first. All Iron Laws and guardrails apply.

**Palette rules (non-negotiable):**
- Card/input backgrounds: `bg-[#FEFCF8]` (not `bg-white`)
- Borders: `border-[#E0D5C1]` (not `border-stone-200`)
- Hover/active surfaces: `bg-[#F4EFE6]` (not `bg-stone-100`)
- Accent: `text-forest` / `bg-forest` (`#2C5545`)
- Disabled: `opacity-50` + `cursor-not-allowed`

**Simple Mode rules:** When `[data-simple-mode]` is active, font scales to 130%. Every primitive must remain usable at this scale — no text truncation, no overflow, no touch targets below 44×44px.

**WCAG 2.1 AA targets:**
- Text contrast ≥ 4.5:1 (normal text), ≥ 3:1 (large text/UI components)
- Focus indicator: visible 2px ring, ≥ 3:1 contrast against adjacent colors
- Keyboard: all interactive elements reachable via Tab, activatable via Enter/Space

// turbo-all

---

## Pre-flight

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

```
cd c:\Project Equispace\model-horse-hub && git log --oneline -3
```

---

## Task 1.1: Audit `input.tsx`

**File:** `src/components/ui/input.tsx` (~25 lines)

Open the file and verify:

1. **Background:** Must be `bg-[#FEFCF8]` or use a CSS variable that resolves to warm parchment. Flag `bg-white` or `bg-background` if it resolves to `#fff`.
2. **Border:** Must use `border-[#E0D5C1]` or `border-edge`. Not `border-stone-200`.
3. **Focus ring:** Must have `focus-visible:ring-2 focus-visible:ring-ring` with adequate contrast. The `ring` color must be visible against parchment background.
4. **Disabled state:** Must show `disabled:opacity-50 disabled:cursor-not-allowed`. Text must remain readable at 50% opacity on parchment.
5. **Placeholder contrast:** Placeholder text color must be ≥ 4.5:1 against `#FEFCF8`. Common fail: `text-stone-400` on parchment = ~3.2:1 (FAIL). Use `text-stone-500` minimum.
6. **Simple Mode:** At 130% font scale, input must not clip text. Verify `min-h` is adequate (`h-10` = 40px, at 130% effective = ~52px — acceptable).
7. **Height:** Minimum 40px (`h-10`) for touch targets.

Apply fixes inline. Build after.

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 1.2: Audit `textarea.tsx`

**File:** `src/components/ui/textarea.tsx` (~22 lines)

Same checks as input.tsx, plus:

1. **Resize handle:** Verify `resize-none` or `resize-y` is set (not unbounded `resize` which can break layouts).
2. **Min-height:** Should be at least `min-h-[80px]` for usability.
3. **Scrollbar styling:** If content overflows, scrollbar should be visible (no `scrollbar-width:none` on textareas — users need to know there's more content).
4. **Line-height in Simple Mode:** At 130%, verify lines don't overlap. Should use `leading-relaxed` or equivalent.

Apply fixes inline. Build after.

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 1.3: Audit `select.tsx`

**File:** `src/components/ui/select.tsx` (~180 lines — largest primitive)

This is the **#1 reported pain point**. Verify every sub-component:

### SelectTrigger
1. **Closed-state readability:** When a value is selected and dropdown is closed, the selected text must be fully readable — not truncated, not low-contrast.
2. **Background/border:** Same palette rules as input.
3. **Chevron icon:** Must be visible against parchment. Check `text-muted-foreground` contrast.
4. **Min-width:** Trigger should have `min-w-[120px]` to prevent ultra-narrow selects.
5. **Simple Mode:** At 130%, text + chevron must fit without overflow.

### SelectContent (dropdown panel)
6. **Background:** Must be `bg-[#FEFCF8]` with `border-[#E0D5C1]`.
7. **Max-height:** Must have a `max-h` with overflow scroll for long option lists. Verify scrollbar is visible.
8. **Z-index:** Must render above all other content (check for `z-50` or higher).
9. **Shadow:** Needs visible shadow for depth separation (`shadow-md` minimum).

### SelectItem (each option)
10. **Hover state:** Must use `bg-[#F4EFE6]` not `bg-stone-100`.
11. **Selected state:** Must show a checkmark or highlight that's visible.
12. **Padding:** Touch targets ≥ 44px height per item on mobile.
13. **Text truncation:** Long option text (e.g., "Traditional (1:9) — Breyer Classic Scale") must either wrap or truncate with ellipsis, not overflow the container.

### SelectSeparator / SelectLabel
14. **Separator color:** `bg-[#E0D5C1]`.
15. **Label text:** Must use `font-semibold` and adequate contrast for group headers.

Apply fixes inline. Build after.

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 1.4: Audit `button.tsx`

**File:** `src/components/ui/button.tsx` (~90 lines)

Check every variant:

### default variant
1. Background: `bg-forest` (`#2C5545`). Text: white. Contrast: ~9.5:1 ✅
2. Hover: slightly lighter/darker forest. Must remain ≥ 4.5:1.

### destructive variant
3. Background: red tone. Text: white. Verify contrast ≥ 4.5:1.

### outline variant
4. Border: `border-[#E0D5C1]`. Background: transparent or `bg-[#FEFCF8]`.
5. Text: must be readable on parchment background.

### ghost variant
6. No border/background in resting state. Hover: `bg-[#F4EFE6]`.
7. Text color must have ≥ 4.5:1 contrast against both transparent AND hover backgrounds.

### link variant
8. Text: underlined, forest green. Hover: slightly darker.

### All variants — shared checks
9. **Focus ring:** `focus-visible:ring-2` with visible ring color.
10. **Disabled:** `opacity-50 cursor-not-allowed pointer-events-none`.
11. **Min-height:** All sizes must meet 44px touch target on mobile. Check `size="sm"` — if height < 36px, add `min-h-[36px]`.
12. **Simple Mode:** At 130%, button text must not overflow. Verify `whitespace-nowrap` doesn't cause horizontal clipping — consider allowing wrapping on mobile.
13. **Icon-only buttons:** If `size="icon"`, verify the hit area is ≥ 44×44px.

Apply fixes inline. Build after.

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 1.5: Audit `dialog.tsx`

**File:** `src/components/ui/dialog.tsx` (~110 lines)

### DialogOverlay
1. **Backdrop:** Must dim the page adequately. Check `bg-black/50` or similar. Must be dark enough that the dialog stands out but not so dark it feels jarring.
2. **Click-to-close:** Clicking overlay should close the dialog (default Radix behavior — verify not suppressed).

### DialogContent
3. **Background:** `bg-[#FEFCF8]` not `bg-white`.
4. **Border:** `border-[#E0D5C1]`.
5. **Max-height:** Must not exceed `90dvh`. Content overflow should scroll, not clip.
6. **Max-width:** Check mobile — at 375px, dialog should have `mx-4` or `w-[calc(100vw-2rem)]` to prevent edge clipping.
7. **Border-radius:** Consistent with card radius (`rounded-xl` or `rounded-lg`).
8. **Close button:** Must be visible (not hidden behind content), accessible via keyboard (Tab → Enter), and have a visible focus ring.

### DialogTitle / DialogDescription
9. **Heading hierarchy:** Title should be rendered as proper heading level. Description should have adequate contrast.
10. **Simple Mode:** At 130%, title must not overflow the dialog width.

Apply fixes inline. Build after.

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 1.6: Audit `card.tsx`

**File:** `src/components/ui/card.tsx` (~70 lines)

1. **Card background:** `bg-[#FEFCF8]` not `bg-white`.
2. **Card border:** `border-[#E0D5C1]` not `border-stone-200`.
3. **CardHeader padding:** Adequate spacing. Check mobile — should have responsive padding (`p-4 sm:p-6`).
4. **CardTitle:** Font weight and size should be consistent with design system (`text-lg font-semibold`).
5. **CardDescription:** Contrast ≥ 4.5:1 on parchment.
6. **CardFooter:** Should have top border or adequate spacing to separate from content.
7. **Shadow:** Subtle shadow that's visible on parchment (`shadow-sm`).

Apply fixes inline. Build after.

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 1.7: Audit `badge.tsx`

**File:** `src/components/ui/badge.tsx` (~50 lines)

Check every variant (default, secondary, destructive, outline):

1. **Default:** Background + text must have ≥ 4.5:1 contrast.
2. **Secondary:** Often uses `bg-stone-100` — must be `bg-[#F4EFE6]`.
3. **Destructive:** Red + white — verify contrast.
4. **Outline:** Border must be visible on parchment. Text must be readable.
5. **All variants:** Font size should be legible. If using `text-xs`, verify it's still readable at standard DPI. In Simple Mode, badges should scale with surrounding text.
6. **Border-radius:** Should use `rounded-full` or `rounded-md` consistently.

Apply fixes inline. Build after.

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 1.8: Audit `table.tsx`

**File:** `src/components/ui/table.tsx` (~60 lines)

1. **Table wrapper:** Should have `overflow-x-auto` for mobile responsiveness.
2. **TableHeader:** Background `bg-[#F4EFE6]` (not `bg-stone-50`). Text: `font-semibold`.
3. **TableRow hover:** `hover:bg-[#F4EFE6]/50` not `hover:bg-stone-100`.
4. **TableCell padding:** Adequate for touch (minimum `py-3` for row height ≥ 44px).
5. **Border color:** `border-[#E0D5C1]` between rows.
6. **Caption:** If present, adequate contrast and placement.
7. **Simple Mode:** At 130%, table text must not cause column collapse. Verify `whitespace-nowrap` on critical columns.

Apply fixes inline. Build after.

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 1.9: Audit `popover.tsx`

**File:** `src/components/ui/popover.tsx` (~60 lines)

1. **Content background:** `bg-[#FEFCF8]` not `bg-white`.
2. **Border:** `border-[#E0D5C1]`.
3. **Shadow:** `shadow-md` for depth.
4. **Z-index:** Must render above other content (`z-50`).
5. **Max-width on mobile:** Should not exceed viewport. Use `max-w-[calc(100vw-2rem)]`.
6. **Arrow:** If Radix arrow is used, fill color must match content background.
7. **Close on outside click:** Verify default Radix behavior is preserved.

Apply fixes inline. Build after.

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 1.10: Audit `skeleton.tsx`

**File:** `src/components/ui/skeleton.tsx` (~7 lines)

1. **Animation color:** Skeleton pulse must use warm tones (`bg-[#E0D5C1]` to `bg-[#F4EFE6]`), not `bg-stone-200`.
2. **Border-radius:** Should match the component it's replacing (not always `rounded-md` — full-width skeletons should use `rounded-none`).
3. **Animation:** Verify `animate-pulse` is present and not disabled.

Apply fixes inline. Build after.

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 1.11: Audit `separator.tsx`

**File:** `src/components/ui/separator.tsx` (~16 lines)

1. **Color:** Must be `bg-[#E0D5C1]` not `bg-border` if border resolves to cold gray.
2. **Thickness:** `h-[1px]` for horizontal, `w-[1px]` for vertical.
3. **ARIA:** Must have `role="separator"` (Radix default — verify not overridden).
4. **Contrast:** Separator must be visible against parchment backgrounds. `#E0D5C1` on `#FEFCF8` = ~1.3:1 — this may be too subtle. Consider `#C4B8A5` for better visibility if needed.

Apply fixes inline. Build after.

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 1.12: Cross-primitive consistency check

After all individual audits, do a final sweep:

1. **Focus ring color:** Must be identical across all primitives. Check CSS variable `--ring`.
2. **Transition duration:** All hover/focus transitions should use the same duration (`transition-all` or `transition-colors duration-150`).
3. **Font family:** All primitives should inherit from the global font stack — no hardcoded `font-sans` that overrides.
4. **CSS variable resolution:** Check `globals.css` for `--background`, `--foreground`, `--border`, `--ring`, `--input`, `--primary`, `--accent`, `--muted`. Verify each resolves to warm palette values, not cold defaults from shadcn init.

```
cd c:\Project Equispace\model-horse-hub && Select-String -Path "src\app\globals.css" -Pattern "--background|--foreground|--border|--ring|--input|--primary|--accent|--muted" | ForEach-Object { "$($_.LineNumber): $($_.Line.Trim())" }
```

Fix any CSS variables that resolve to cold values.

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 1.13: Commit

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "fix(v44): phase 1 — shadcn primitives audit, warm palette + WCAG fixes across 11 components"
```

---

## ✅ DONE Protocol

Mark this phase complete when:
- [ ] All 11 primitives audited and fixed
- [ ] No `bg-white`, `bg-stone-50`, or `border-stone-200` in any `ui/` file
- [ ] Focus rings visible on all interactive primitives
- [ ] Placeholder text contrast ≥ 4.5:1
- [ ] Select dropdown readable when closed (selected value visible)
- [ ] All touch targets ≥ 44px on mobile
- [ ] CSS variables in `globals.css` resolve to warm palette
- [ ] Build passes with 0 errors
- [ ] Committed to git

**Next:** Run `/v44-visual-qa-phase2-forms-dropdowns` for form-level audit.
