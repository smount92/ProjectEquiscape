---
description: "V44 Visual QA Phase 5 — Modals, Dialogs, Lightboxes. Audit every overlay for content clipping, backdrop contrast, close button visibility, mobile sizing, and keyboard dismissal."
---

# V44 Visual QA — Phase 5: Modals, Dialogs & Lightboxes

> **Epic:** V44 Site-Wide Visual QA Audit
> **Goal:** No modal clips content, every overlay is dismissible, and lightboxes work on mobile.
> **Prerequisite:** Phase 4 complete.

**MANDATORY:** Read `.agents/MASTER_BLUEPRINT.md` and `.agents/MASTER_SUPABASE.md` first. All Iron Laws and guardrails apply.

// turbo-all

---

## Pre-flight

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

First, find all dialog/modal usages:

```
cd c:\Project Equispace\model-horse-hub && Select-String -Path "src\components\*.tsx","src\app\**\*.tsx" -Pattern "Dialog|Modal|Lightbox|createPortal" -Recurse | ForEach-Object { $_.Filename } | Sort-Object -Unique
```

---

### Task 5.1: PhotoLightbox — `src/components/PhotoLightbox.tsx`

**Exception:** This is the ONE component allowed to use `createPortal` (per MASTER_BLUEPRINT).

1. Image fills viewport without distortion (object-fit: contain)
2. Close button (X) visible against both light and dark photos — needs semi-transparent background
3. Navigation arrows (prev/next) visible and tappable (≥ 44px)
4. Swipe gestures work on mobile for navigation
5. Share button / friendly URL button accessible
6. Backdrop fully opaque (black)
7. Keyboard: Escape closes, Arrow keys navigate
8. Simple Mode: UI controls don't overlap image at 130% scale

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 5.2: ImageCropModal

Find the crop modal component:

```
cd c:\Project Equispace\model-horse-hub && Select-String -Path "src\**\*.tsx" -Pattern "crop" -Recurse | ForEach-Object { $_.Filename } | Sort-Object -Unique
```

1. Crop area visible on parchment background
2. Rotation/zoom controls accessible on mobile
3. Confirm/Cancel buttons not clipped at bottom
4. Modal doesn't exceed `90dvh`
5. Image preview area has adequate min-size

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 5.3: MakeOfferModal — `src/components/MakeOfferModal.tsx`

1. Price input has visible label
2. Notes textarea has adequate height
3. Submit button visible without scrolling (or scrollable)
4. Modal max-height ≤ 90dvh with internal scroll
5. Error messages visible inside modal
6. Close button (X) visible on parchment

```
cd c:\Project Equiscape\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 5.4: TransferModal — `src/components/TransferModal.tsx`

1. Transfer code display readable (monospace, large enough)
2. PIN input fields visible and aligned
3. Expiry countdown visible
4. Success/error states clear
5. Modal background parchment, not white

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 5.5: SuggestEditModal — `src/components/SuggestEditModal.tsx`

1. Diff display (before/after) readable inside modal
2. Textarea for suggestion notes has adequate height
3. Submit/Cancel buttons visible
4. Long catalog item names don't overflow modal width

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 5.6: Delete Confirmation Dialogs

Find all delete/confirmation dialogs:

```
cd c:\Project Equispace\model-horse-hub && Select-String -Path "src\**\*.tsx" -Pattern "DialogTitle.*[Dd]elete|confirm.*delete|[Dd]elete.*[Dd]ialog" -Recurse | ForEach-Object { "$($_.Filename):$($_.LineNumber)" }
```

For each:
1. Destructive action button is visually distinct (red/destructive variant)
2. Cancel button is clearly the "safe" option
3. Dialog text explains what will be deleted
4. Modal doesn't appear behind other overlays (z-index)

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 5.7: All remaining shadcn Dialogs

Search for any Dialog usage not covered above:

```
cd c:\Project Equispace\model-horse-hub && Select-String -Path "src\**\*.tsx" -Pattern "<Dialog\b|DialogContent" -Recurse | ForEach-Object { "$($_.Filename):$($_.LineNumber)" } | Sort-Object -Unique
```

For each found:
1. Content not clipped at `90dvh`
2. Background uses parchment
3. Close button visible
4. Keyboard dismissible (Escape)
5. Mobile width doesn't clip edges (has `mx-4` or equivalent padding)

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

### Task 5.8: Commit

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "fix(v44): phase 5 — modals & lightboxes audit, content clipping + backdrop + close button fixes"
```

---

## ✅ DONE Protocol

- [ ] No modal clips content below 90dvh
- [ ] Every dialog has a visible, keyboard-accessible close button
- [ ] PhotoLightbox close/nav buttons visible against any photo
- [ ] All modal backgrounds use parchment, not white
- [ ] Destructive actions use red/destructive button variant
- [ ] Build passes, committed

**Next:** Run `/v44-visual-qa-phase6-mobile-simple-mode`
