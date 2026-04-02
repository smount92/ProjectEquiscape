---
description: Root Viewport & Typography Fixes — body overflow-x-hidden, dvh viewport units, iOS Safari auto-zoom prevention
---

# 072 — Root Viewport & Typography Fixes

> **Purpose:** Fix the 3 foundational CSS issues that cause mobile UX problems globally — before touching any individual component.
> **Depends On:** `071-mobile-qa-automation.md` (baseline audit must be established first)
> **Output:** Global CSS/layout fixes that prevent horizontal scrolling, address-bar overlap, and iOS Safari auto-zoom.

// turbo-all

---

## Task 1: Root Overflow Restraint

**Files:** `src/app/layout.tsx`, `src/app/globals.css`

### 1.1 Add `overflow-x-hidden` to `<body>`

**File:** `src/app/layout.tsx`

The `<body>` tag currently has only `className="antialiased"` (line 87). This provides no horizontal overflow protection — any single child element wider than the viewport causes horizontal scrolling on the entire page.

**Change:**
```tsx
// BEFORE (line 87):
<body className="antialiased">

// AFTER:
<body className="w-full overflow-x-hidden antialiased">
```

**Why both classes:**
- `w-full` — constrains the body to 100% of viewport width
- `overflow-x-hidden` — clips any child element that exceeds the viewport width

> ⚠️ **Do NOT use `overflow-hidden` (both axes)** — this would break vertical scrolling.

### 1.2 Add global CSS safety net

**File:** `src/app/globals.css`

Add at the end of the base reset section (after the `@theme` block, near the top of the file):

```css
/* Mobile viewport safety net */
html, body {
    max-width: 100vw;
    overflow-x: hidden;
}
```

This is belt-and-suspenders — the Tailwind classes on `<body>` handle it, but this CSS rule catches any edge case where a component renders before hydration.

### Validation Checklist
- [ ] `<body>` tag has `w-full overflow-x-hidden antialiased`
- [ ] `globals.css` has `html, body { max-width: 100vw; overflow-x: hidden; }`
- [ ] Vertical scrolling still works on all pages
- [ ] No visible horizontal scrollbar on any page in mobile viewport

---

## Task 2: Dynamic Viewport Height (`dvh`)

### 2.1 Audit `h-screen` and `min-h-screen` usages

`h-screen` maps to `100vh` which on iOS Safari includes the area behind the address bar — users see content covered by the browser chrome. `100dvh` (dynamic viewport height) adjusts when the address bar collapses.

**Search:**
```powershell
cmd /c "npx rg -n 'h-screen|min-h-screen' src/ --include '*.tsx' --include '*.css' 2>&1"
```

**Known files from baseline audit:**
- `src/app/~offline/page.tsx` — offline fallback page
- `src/app/global-error.tsx` — error page

### 2.2 Replace viewport height utilities

For each occurrence found:

| Old Class | New Class | Why |
|-----------|-----------|-----|
| `h-screen` | `h-dvh` | Tailwind v4 supports `dvh` natively |
| `min-h-screen` | `min-h-dvh` | Same — dynamic viewport height |

**Example fix:**
```tsx
// BEFORE:
<div className="flex h-screen items-center justify-center">

// AFTER:
<div className="flex h-dvh items-center justify-center">
```

> **Note:** Tailwind CSS v4 includes `h-dvh` and `min-h-dvh` as built-in utilities. No custom config needed.

### 2.3 Verify no remaining `vh`-based heights

```powershell
cmd /c "npx rg -n 'h-screen|min-h-screen|100vh' src/ --include '*.tsx' --include '*.css' 2>&1"
```

Should return 0 results.

### Validation Checklist
- [ ] Zero occurrences of `h-screen` or `min-h-screen` in `src/`
- [ ] Offline page and error page use `h-dvh` / `min-h-dvh`
- [ ] On iOS Safari, no content is hidden behind the address bar

---

## Task 3: iOS Safari Auto-Zoom Fix (The 16px Rule)

### 3.1 Understanding the problem

iOS Safari automatically zooms into any `<input>`, `<textarea>`, or `<select>` with a computed font-size smaller than 16px. This creates a jarring zoom effect that users can't easily undo.

**The fix:** Set `text-base` (16px) as the default on mobile, and `text-sm` (14px) for desktop where auto-zoom isn't an issue.

### 3.2 Audit shadcn form input primitives

**File 1: `src/components/ui/input.tsx` (line 11)**

**Current state:** Already has `text-base ... md:text-sm` ✅ — NO CHANGE NEEDED.

**File 2: `src/components/ui/textarea.tsx` (line 10)**

**Current state:** Already has `text-base ... md:text-sm` ✅ — NO CHANGE NEEDED.

**File 3: `src/components/ui/select.tsx` — `SelectTrigger` (line 47)**

**Current state:** Has `text-sm` only — ❌ MISSING `text-base` for mobile.

**Change the `className` in `SelectTrigger` (line 47):**
```tsx
// BEFORE:
"flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground ..."

// AFTER:
"flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 py-2 text-base md:text-sm text-foreground ..."
```

This makes `<SelectTrigger>` render at 16px on mobile (preventing Safari zoom) and 14px on desktop (matching the tighter aesthetic).

### 3.3 Audit for raw `<input>`, `<textarea>`, `<select>` elements

Some components may use raw HTML elements instead of shadcn primitives. Search for them:

```powershell
cmd /c "npx rg -n '<input ' src/components/ --include '*.tsx' -l 2>&1"
cmd /c "npx rg -n '<textarea ' src/components/ --include '*.tsx' -l 2>&1"
cmd /c "npx rg -n '<select ' src/components/ --include '*.tsx' -l 2>&1"
```

For each raw element found (outside of `src/components/ui/`), verify it has `text-base md:text-sm` or equivalent 16px mobile sizing. If it has a smaller font size (e.g., `text-sm`, `text-xs`), add the mobile-first pattern.

**Common offenders to check:**
- `CsvImport.tsx` — file input for CSV upload
- `ImageCropModal.tsx` — aspect ratio inputs
- `UnifiedReferenceSearch.tsx` — search input
- `ChatThread.tsx` — message input

### 3.4 Global CSS fallback for native inputs

**File:** `src/app/globals.css`

Add after the viewport safety rules from Task 1:

```css
/* Prevent iOS Safari from zooming on form focus */
@media screen and (max-width: 767px) {
    input, textarea, select {
        font-size: 16px !important;
    }
}
```

This is a nuclear fallback — it catches ANY input element the individual component audits might miss.

> ⚠️ **Why `!important`?** Because some components apply `text-sm` inline via Tailwind which computes to 14px. The `!important` ensures iOS doesn't zoom regardless.

### Validation Checklist
- [ ] `SelectTrigger` in `select.tsx` has `text-base md:text-sm`
- [ ] `Input` in `input.tsx` has `text-base ... md:text-sm` (already has it — verify)
- [ ] `Textarea` in `textarea.tsx` has `text-base ... md:text-sm` (already has it — verify)
- [ ] Raw HTML inputs in components have 16px mobile sizing
- [ ] `globals.css` has the `@media` fallback for native inputs
- [ ] On iPhone Safari: tapping into a text input does NOT trigger auto-zoom

---

## 🛑 HUMAN VERIFICATION GATE 🛑

**Stop execution. Test on an actual iPhone or iOS Simulator:**

1. Open any page with a form (e.g., `/login`, `/settings`, `/add-horse`)
2. Tap into a text input — **no zoom should occur**
3. Tap into a Select dropdown — **no zoom should occur**
4. Scroll vertically — **page scrolls smoothly, no horizontal bounce**
5. Rotate to landscape and back — **layout adjusts, no overflow**

Await human input: "Phase 072 Verified. Proceed."

---

## Build Gate

Run `npx next build` (via `cmd /c "npx next build 2>&1"`) and confirm 0 errors before marking complete.
