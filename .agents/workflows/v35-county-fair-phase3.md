---
description: "Digital County Fair Phase 3 — Class-First Reverse Entry Flow. Redesign ShowEntryForm so users pick a class first, then pick a horse from a visual modal."
---

# 🔄 Phase 3: The "Class-First" Reverse Entry Flow

**Epic:** Digital County Fair UX  
**Goal:** Match the collector's mental model by letting them pick a class first, then picking a horse from their stable via a visual modal.

---

## Task 3.1: Reverse the `ShowEntryForm.tsx`

**Target File:** `src/components/ShowEntryForm.tsx` (466 lines)

### Current State
The current flow is: **Horse → Class → Photo → Submit**
- Lines 243–262: Horse selector dropdown is first
- Lines 265–342: Class browser appears AFTER horse is selected
- Lines 344–449: Photo picker + caption + submit

### New Flow (3-View Pattern)

The new flow should be: **Class → Horse (Visual Modal) → Photo + Caption → Submit**

### Architecture

The component should have 3 logical views:

#### View 1: Smart Class Browser (Default View)

- Render the class list FIRST — this becomes the primary UI
- Remove the top-level horse `<select>` dropdown entirely
- Keep the existing class search/filter + division grouping (lines 161–175 logic)
- Each class row gets an `<Button size="sm">Enter a Horse</Button>` (shadcn) on the right side
- Clicking this button opens the Stable Picker modal and stores `selectedClassId`
- If there are NO classes configured for the show, skip View 1 and show a simpler flow with a single "Enter a Horse" button

#### View 2: The Stable Picker (shadcn Dialog Modal)

- Use `<Dialog>` from `@/components/ui/dialog` (already imported in the file at line 5)
- **Modal content:** Render a visual grid of the user's `userHorses`
- For each horse, show:
  - Horse thumbnail (fetch from `horse_images` — reuse existing photo fetching logic or fetch in batch)
  - Horse name
  - Scale badge (if available via catalog join)
- **Scale enforcement:** If the selected class has `allowed_scales`, dim/disable horses that don't match. Add a tooltip: `"Scale mismatch — this class requires {allowed_scales}"`
- **Already entered:** If a horse is already entered in this show (track via props or a client-side fetch), dim it with tooltip: `"Already entered in this show"`
- On horse click → store `selectedHorse` → advance to View 3 inside the same modal

**Props change:** The component currently receives `userHorses: { id: string; name: string }[]`. This needs to be expanded to include thumbnail URLs. Update the parent page (`shows/[id]/page.tsx`, lines 40–49) to also fetch horse thumbnails:

In `shows/[id]/page.tsx`, after the `userHorses` query (line 40–44), add a batch thumbnail fetch:
```typescript
// Fetch thumbnails for user's horses
const horseIds = (userHorses ?? []).map(h => h.id);
const { data: horseThumbs } = horseIds.length > 0 
  ? await supabase
      .from("horse_images")
      .select("horse_id, image_url, angle_profile")
      .in("horse_id", horseIds)
  : { data: [] };

const thumbMap = new Map<string, string>();
for (const hId of horseIds) {
  const imgs = (horseThumbs ?? []).filter(r => r.horse_id === hId);
  const primary = imgs.find(i => i.angle_profile === "Primary_Thumbnail");
  const url = (primary ?? imgs[0])?.image_url;
  if (url) thumbMap.set(hId, getPublicImageUrl(url));
}

const horseOptions = (userHorses ?? []).map(h => ({
  id: h.id,
  name: h.custom_name,
  thumbnailUrl: thumbMap.get(h.id) || null,
}));
```

Update the `ShowEntryFormProps` interface:
```typescript
interface ShowEntryFormProps {
  showId: string;
  userHorses: { id: string; name: string; thumbnailUrl: string | null }[];
  classes?: ClassDetail[];
}
```

#### View 3: Finalize (Photo + Caption inside Modal)

- After horse selection, the modal advances to a "Choose Photo & Caption" step
- Reuse the existing photo picker logic (lines 67–120 — `useEffect` that fetches photos for `selectedHorse`)
- Show the photo grid, caption textarea, and "Submit Entry" button
- On submit → call `enterShow()` → close modal on success → show success toast

### Implementation Strategy

Since this is a complete redesign, the recommended approach is:

1. **Preserve the existing interfaces** — don't change the server action signatures
2. **Add a `modalState` to manage the 3-view flow:**
   ```typescript
   const [modalOpen, setModalOpen] = useState(false);
   const [modalStep, setModalStep] = useState<"select-horse" | "choose-photo">("select-horse");
   ```
3. **Keep existing photo fetching logic** — the `useEffect` on `selectedHorse` already works
4. **Use `framer-motion` for transitions** between modal steps:
   ```typescript
   import { motion, AnimatePresence } from "framer-motion";
   ```
   Wrap each step in `<motion.div>` with fade/slide transitions

### Styling Rules
- Use Tailwind v4 classes only — no inline styles
- Horse grid in modal: `grid grid-cols-2 sm:grid-cols-3 gap-4`
- Horse card: `rounded-lg border border-edge bg-card p-2 cursor-pointer hover:ring-2 hover:ring-forest transition-all`
- Disabled horse: `opacity-40 cursor-not-allowed`
- Use warm parchment palette: `bg-card`, `border-edge`, `text-ink`, `text-muted`, `text-forest`

### What NOT to Break
- The `enterShow()` server action call signature is unchanged
- The existing `classId`, `entryImagePath`, and `caption` parameters still work
- The photo fetching logic is the same
- The preview modal can be removed or kept as optional

---

## 🛑 HUMAN VERIFICATION GATE 3 🛑

**Stop execution. Await human input: "Phase 3 Verified. Proceed to Phase 4."**

- [ ] Try entering a show. Do you select the Class *before* selecting the Horse?
- [ ] Does the visual modal pop up showing your stable with horse thumbnails?
- [ ] Are scale-mismatched horses dimmed/disabled with a tooltip?
- [ ] After selecting a horse, does the modal advance to photo selection?
- [ ] Does submitting an entry close the modal and show a success state?
- [ ] Does the flow work for shows WITHOUT any classes configured?

---

## Build Gate
Run `npx next build` (via `cmd /c "npx next build 2>&1"`) and confirm 0 errors before marking complete.
