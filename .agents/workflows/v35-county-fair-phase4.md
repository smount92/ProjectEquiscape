---
description: "Digital County Fair Phase 4 — Visual Judging Interface. Replace the spreadsheet dropdowns with a tactile click-to-pin ribbon stamping interface."
---

# 🎨 Phase 4: The "WOW" Visual Judging Interface

**Epic:** Digital County Fair UX  
**Goal:** Replace the spreadsheet-style placing dropdowns with a highly visual, tactile, click-to-pin ribbon interface using Framer Motion.

---

## Task 4.1: Rewrite `ExpertJudgingPanel.tsx`

**Target File:** `src/components/ExpertJudgingPanel.tsx` (269 lines)

### Current State
- Lines 1–6: Imports — `useState`, `useRouter`, `saveExpertPlacings`, `overrideFinalPlacings`, `Textarea`
- Lines 8–21: Interfaces — `EntryForJudging`, `ClassInfo`
- Lines 23–39: `PLACING_OPTIONS` array — flat list with value/label pairs
- Lines 41–116: Main component — `placings` state as `Record<string, string>`, notes state, save handler
- Lines 130–268: Render — single-column list, each entry is a row with tiny 40px thumbnail, name, notes toggle emoji, and a `<select>` dropdown for placing

**Problem:** This is a "B2B spreadsheet" — tiny thumbnails, dropdown selects, cramped rows. Judges can't see the horses properly, and assigning ribbons feels like filling out a form.

### New Architecture

The rebuilt component has two main sections:

#### Section 1: The Ribbon Palette (Sticky Top)

A sticky `<Card>` from shadcn sits at the top of the panel. It contains a row of beautiful, tactile ribbon buttons:

```
🥇 1st  |  🥈 2nd  |  🥉 3rd  |  4th  |  5th  |  6th  |  🎗️ HM  |  🏆 Champ  |  🥈 Reserve
```

**State:**
```typescript
const [activeRibbon, setActiveRibbon] = useState<string | null>(null);
```

**Behavior:**
- Clicking a ribbon button sets `activeRibbon` to that placing value
- The active ribbon button gets a distinct visual state: `ring-2 ring-forest scale-105 shadow-lg`
- Clicking the same ribbon again deselects it (sets to `null`)
- The ribbon palette uses `flex flex-wrap gap-2` for responsive wrapping

**Ribbon button styling:**
```
rounded-full px-4 py-2 text-sm font-bold cursor-pointer transition-all
border border-edge bg-card hover:shadow-md
```
- Active: `ring-2 ring-forest bg-forest/10 scale-105 shadow-lg`
- Each ribbon has a distinct background tint when assigned (gold for 1st, silver for 2nd, bronze for 3rd, etc.)

#### Section 2: The Entry Grid (Bottom Half)

Replace the single-column list with a responsive image grid:

```
grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6
```

Each entry is a shadcn `<Card>` containing:
1. **Large image** — `aspect-[4/3] object-cover rounded-t-lg` — this is the PRIMARY interactive target
2. **Horse name + owner** below the image
3. **Ribbon badge** — if assigned, absolutely positioned in the top-right corner of the image

**Imports needed:**
```typescript
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MessageCircle } from "lucide-react";
```

**Note:** Check if `popover` exists in `src/components/ui/`. If not, install: `npx shadcn@latest add popover`.

#### The Click-to-Pin Interaction

1. **Image area wrapped in framer-motion:**
   ```tsx
   <motion.div 
     whileTap={{ scale: 0.95 }} 
     className="cursor-pointer relative"
     onClick={() => handlePinRibbon(entry.id)}
   >
     <img ... />
     {/* Ribbon badge overlay */}
   </motion.div>
   ```

2. **`handlePinRibbon(entryId)`:**
   ```typescript
   const handlePinRibbon = (entryId: string) => {
     if (!activeRibbon) return; // No ribbon selected — do nothing
     
     // Uniqueness check for singular awards
     const MULTI_ALLOWED = ["HM", "Top 3", "Top 5", "Top 10"];
     if (!MULTI_ALLOWED.includes(activeRibbon)) {
       // Find if this ribbon is already assigned to another entry IN THIS CLASS
       const existingEntry = Object.entries(placings).find(
         ([id, placing]) => placing === activeRibbon && id !== entryId
       );
       if (existingEntry) {
         // Remove from previous entry
         setPlacings(prev => {
           const next = { ...prev };
           delete next[existingEntry[0]];
           return next;
         });
       }
     }
     
     // Assign to clicked entry
     setPlacings(prev => ({ ...prev, [entryId]: activeRibbon }));
   };
   ```

3. **Removing a ribbon:** If you click an entry that already has the active ribbon assigned, toggle it off:
   ```typescript
   if (placings[entryId] === activeRibbon) {
     // Remove the ribbon
     setPlacings(prev => {
       const next = { ...prev };
       delete next[entryId];
       return next;
     });
     return;
   }
   ```

#### The Ribbon Badge Overlay

When an entry has a placing, render a beautiful badge:

```tsx
<AnimatePresence>
  {placings[entry.id] && (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 25 }}
      className="absolute top-2 right-2 z-10"
    >
      <Badge className="bg-amber-500 text-white text-sm px-3 py-1 shadow-lg">
        {MEDAL_EMOJI[placings[entry.id]]} {placings[entry.id]}
      </Badge>
    </motion.div>
  )}
</AnimatePresence>
```

Where `MEDAL_EMOJI` maps placing strings to emoji:
```typescript
const MEDAL_EMOJI: Record<string, string> = {
  "1st": "🥇", "2nd": "🥈", "3rd": "🥉",
  "4th": "4", "5th": "5", "6th": "6",
  "HM": "🎗️",
  "Champion": "🏆", "Reserve Champion": "🥈",
  "Grand Champion": "🏆", "Reserve Grand Champion": "🥈",
  "Top 3": "🏅", "Top 5": "🏅", "Top 10": "🏅",
};
```

#### Judge Notes (Popover)

Replace the expand/collapse `📝` toggle with a `<Popover>`:

```tsx
<PopoverTrigger asChild>
  <button className="absolute bottom-2 right-2 z-10 rounded-full bg-card/90 p-2 shadow hover:bg-card">
    <MessageCircle className={`h-4 w-4 ${notes[entry.id] ? "text-forest" : "text-muted"}`} />
  </button>
</PopoverTrigger>
<PopoverContent className="w-72">
  <Textarea
    value={notes[entry.id] || ""}
    onChange={(e) => setNotes(prev => ({ ...prev, [entry.id]: e.target.value }))}
    placeholder="Private judge critique…"
    rows={3}
    className="text-sm"
  />
</PopoverContent>
```

#### Class Filter

Keep the existing class filter `<select>` (lines 147–176) but restyle it as a shadcn `<Select>` at the top, between the panel header and the ribbon palette. Show the class name and entry count.

**When filtering by class:** The uniqueness check for singular awards should only apply within the currently selected class filter. If `selectedClassId !== "all"`, only check for conflicts among `filteredEntries`.

#### The Save Button

Keep the global "💾 Save Placings" button prominent at the bottom. Add a summary of assignments:

```tsx
<div className="mt-6 flex items-center justify-between">
  <span className="text-sm text-muted">
    {Object.keys(placings).filter(k => placings[k]).length} of {filteredEntries.length} entries placed
  </span>
  <Button
    onClick={handleSave}
    disabled={saving}
    className="bg-forest text-white"
  >
    {saving ? "Saving…" : "💾 Save Placings"}
  </Button>
</div>
```

#### Override Mode

The `overrideMode` prop changes styling (red border/accents) but uses the same interaction pattern. Keep this behavior.

### Props Interface Update

The `EntryForJudging` interface needs `classId` to be properly passed from the parent page. Currently the parent at `shows/[id]/page.tsx` line 489 hardcodes `classId: null`. Fix this:

```typescript
// shows/[id]/page.tsx line 483-490
entries={entries.map((e) => ({
  id: e.id,
  horseName: e.horseName,
  ownerAlias: e.ownerAlias,
  thumbnailUrl: e.thumbnailUrl,
  placing: e.placing,
  classId: e.className ? classOptions.find(c => c.name.includes(e.className!))?.id || null : null,
}))}
```

Also pass `classes` prop to the panel — it's currently missing at line 481:
```tsx
classes={classOptions.map(c => ({ id: c.id, name: c.name, divisionName: c.divisionName }))}
```

### Styling Rules
- Tailwind v4 only — no inline styles
- Warm parchment palette: `bg-card`, `border-edge`, `text-ink`, `text-muted`, `text-forest`
- Card backgrounds: `bg-[#FEFCF8]`
- **No cold palette** — no `bg-white`, `bg-stone-50`, `bg-stone-100`
- Use `font-serif` for the "Expert Judging Panel" heading

---

## 🛑 HUMAN VERIFICATION GATE 4 🛑

**Stop execution. Await human input: "Phase 4 Verified. Proceed to Phase 5."**

- [ ] Log in as an admin/judge. Go to a judging show.
- [ ] Is the ribbon palette visible at the top?
- [ ] Click a ribbon (e.g., "1st"). Does it highlight with a ring?
- [ ] Click a photo. Does the ribbon appear visually "stamped" onto the image with a spring animation?
- [ ] Assign "1st" to another horse. Does it properly remove the ribbon from the first horse?
- [ ] Can you assign "HM" to multiple horses?
- [ ] Click the MessageCircle icon. Does a popover appear for judge notes?
- [ ] Click "Save Placings". Do the placings persist?

---

## Build Gate
Run `npx next build` (via `cmd /c "npx next build 2>&1"`) and confirm 0 errors before marking complete.
