---
description: UI Overhaul Part 2 — Replace all createPortal modal patterns with shadcn Dialog components for accessible, consistent overlays.
---

# UI Overhaul Part 2: Modal → shadcn Dialog Migration

> **Source Plan:** `.agents/docs/UI_Update_Plan.md` (Phase 2.3)
> **Scope:** Replace all `createPortal` + `.modal-overlay` patterns with shadcn `<Dialog>` across 12 components + update 2 test files
> **Prerequisite:** Complete `ui-overhaul-1-tooling-forms.md` first (shadcn must be installed)
> **Last Updated:** 2026-03-25

// turbo-all

## Pre-flight

Verify shadcn is installed and build is clean:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

Ensure the Dialog component is installed:
```
cd c:\Project Equispace\model-horse-hub && npx shadcn@latest add dialog
```

---

# ═══════════════════════════════════════
# UNDERSTANDING THE MIGRATION PATTERN
# ═══════════════════════════════════════

## Current Pattern (createPortal)

```tsx
import { createPortal } from "react-dom";

// Component renders:
return isOpen ? createPortal(
    <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Title</h2>
            {/* content */}
            <button onClick={onClose}>Close</button>
        </div>
    </div>,
    document.body
) : null;
```

## Target Pattern (shadcn Dialog)

```tsx
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";

// Component renders:
return (
    <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Title</DialogTitle>
                <DialogDescription>Optional description</DialogDescription>
            </DialogHeader>
            {/* content */}
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleSubmit}>Confirm</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
);
```

**Key benefits:**
- Automatic body scroll lock
- Backdrop blur (`backdrop-blur-sm bg-stone-900/40`)
- Focus trap and keyboard dismissal (Escape)
- Proper ARIA attributes
- No manual `createPortal` or `document.body` references

---

# ═══════════════════════════════════════
# TASK 1: Simple Modals (5 files)
# ═══════════════════════════════════════

These are straightforward confirm/form modals with minimal internal state.

### 1.1: `DeleteHorseModal.tsx`
- Remove `createPortal` import
- Remove `.modal-overlay` / `.modal-content` markup
- Wrap in `<Dialog open={} onOpenChange={}>` → `<DialogContent>`
- "Danger" variant: add `className="border-danger"` to DialogContent
- Keep the confirmation logic unchanged

### 1.2: `TransferModal.tsx`
- Standard form modal — PIN input + submit
- Replace overlay + portal with Dialog
- Keep form submission logic

### 1.3: `SuggestReferenceModal.tsx`
- Catalog suggestion form
- Replace overlay + portal with Dialog
- Keep suggestion submission logic

### 1.4: `SuggestEditModal.tsx`
- Edit suggestion form
- Replace overlay + portal with Dialog

### 1.5: `CollectionManager.tsx`
- Collection CRUD modal
- Replace overlay + portal with Dialog

**Build check:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

---

# ═══════════════════════════════════════
# TASK 2: Complex Modals (5 files)
# ═══════════════════════════════════════

These have more internal state, multi-step flows, or special rendering needs.

### 2.1: `MakeOfferModal.tsx`
- Form modal with price input, message, disclaimer checkbox
- Replace overlay + portal with Dialog
- **Test impact:** `MakeOfferModal.test.tsx` mocks `createPortal` — remove the mock and update assertions
- `.modal-overlay` → gone (Dialog handles backdrop)

### 2.2: `ShowEntryForm.tsx`
- Has an entry selection modal embedded
- Replace the createPortal section with Dialog
- Keep the form logic and horse selection

### 2.3: `CollectionPicker.tsx`
- Multi-select checkbox modal
- Replace overlay + portal with Dialog

### 2.4: `DashboardShell.tsx`
- Has a search overlay modal
- Replace the createPortal section with Dialog
- Note: This may use a different pattern (fullscreen) — use `DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto"`

### 2.5: `ImageCropModal.tsx`
- Complex modal with canvas cropping
- This is the trickiest — the crop canvas needs specific dimensions
- Use `DialogContent className="sm:max-w-2xl"` for a wider modal
- Keep the canvas rendering logic unchanged

**Build check:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

---

# ═══════════════════════════════════════
# TASK 3: PhotoLightbox (Special Case)
# ═══════════════════════════════════════

### 3.1: `PhotoLightbox.tsx`

> **IMPORTANT:** The PhotoLightbox is NOT a standard modal — it's a fullscreen image viewer with keyboard navigation (arrow keys, Escape), wrap-around, and body scroll lock. shadcn `<Dialog>` may not be the right fit here.

**Recommendation:** Keep `createPortal` for PhotoLightbox. It has bespoke keyboard handling and its own scroll lock. Converting it to Dialog would require fighting against Dialog's focus trap and keyboard behavior.

Instead, just clean up its styling:
- Replace `.modal-overlay` class with Tailwind: `fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-sm`
- Keep `createPortal(…, document.body)` pattern

### 3.2: Update Tests

**File: `src/components/__tests__/MakeOfferModal.test.tsx`**
- Remove the `createPortal` mock (lines 7–12)
- The Dialog component renders inline during tests (Radix handles this)
- Update any assertions that rely on `.modal-overlay` class names

**File: `src/components/__tests__/PhotoLightbox.test.tsx`**
- Keep the `createPortal` mock since we're keeping createPortal for this component
- No changes needed

**Test run:**
```
cd c:\Project Equispace\model-horse-hub && npx vitest run
```

---

# ═══════════════════════════════════════
# TASK 4: Clean Up globals.css
# ═══════════════════════════════════════

After all modals are migrated, remove from `globals.css`:
- `.modal-overlay` class (lines ~691–703)
- `.modal-content` class (lines ~705–713)
- `.modal-card.danger` styles (lines ~574–587)
- `@keyframes fadeIn` (lines ~715–723) — if no other consumers
- `@keyframes slideUp` (lines ~725–735) — if no other consumers
- The `@media (max-width: 640px) .modal-content` override (lines ~749–751)

**Search first to make sure no other files reference these classes:**
```
cd c:\Project Equispace\model-horse-hub && Select-String -Path "src\**\*.tsx" -Pattern "modal-overlay|modal-content|modal-card" -List
```

**Build check:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

---

# ═══════════════════════════════════════
# FINAL VERIFICATION
# ═══════════════════════════════════════

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

```
cd c:\Project Equispace\model-horse-hub && npx vitest run
```

Check that:
- [x] 12 components now use shadcn `<Dialog>` instead of `createPortal` (11 listed + event manage copy modal)
- [x] `PhotoLightbox` retains `createPortal` (intentional exception)
- [x] `.modal-overlay` and `.modal-content` removed from `globals.css`
- [x] `MakeOfferModal.test.tsx` updated — uses `getByRole` for Dialog close button
- [x] All 245 tests pass
- [x] Build passes cleanly

**✅ COMPLETED: 2026-03-26**

Committed as `b0c9239` on `main` (local only, not pushed).
