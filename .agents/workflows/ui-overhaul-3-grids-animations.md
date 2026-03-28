---
description: UI Overhaul Part 3 — Redesign grids with tactile Polaroid-style cards, rework horse passport layouts, add Framer Motion micro-interactions and staggered reveals.
status: "✅ COMPLETE (2026-03-27)"
---

# UI Overhaul Part 3: Tactile Grids & Micro-Interactions

> **Source Plan:** `.agents/docs/UI_Update_Plan.md` (Phases 2.1–2.2, 2.4, 3.1–3.4)
> **Scope:** Card/grid visual rework, passport page layout, badge overhaul, Framer Motion animations, empty states
> **Prerequisite:** Complete `ui-overhaul-1-tooling-forms.md` and `ui-overhaul-2-modals.md` first
> **Last Updated:** 2026-03-25

// turbo-all

## Pre-flight

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

Verify framer-motion is installed:
```
cd c:\Project Equispace\model-horse-hub && node -e "require('framer-motion'); console.log('framer-motion OK')"
```

---

# ═══════════════════════════════════════
# TASK 1: Tactile Card Grid Redesign
# ═══════════════════════════════════════

## Target Files
- `src/components/ShowRingGrid.tsx`
- `src/components/StableGrid.tsx`

## Design Spec — "Polaroid" Cards

Each horse card should feel like a glossy photo pasted into a scrapbook:

```tsx
<div className="group p-3 bg-white rounded-2xl shadow-sm border border-edge
                hover:shadow-md hover:-translate-y-1 transition-all duration-300">
    {/* Image container — locked aspect ratio */}
    <div className="aspect-[4/3] w-full rounded-xl overflow-hidden bg-stone-100">
        <img
            src={horse.imageUrl}
            alt={horse.customName}
            className="w-full h-full object-cover group-hover:scale-105
                       transition-transform duration-500 ease-out"
        />
    </div>

    {/* Content area */}
    <div className="mt-3 px-1">
        <h3 className="font-serif text-lg font-bold text-ink truncate">
            {horse.customName}
        </h3>
        <p className="text-sm text-muted truncate">{horse.moldName}</p>
        {/* Badge row */}
        <div className="flex flex-wrap gap-1.5 mt-2">
            <Badge variant="secondary">{horse.finish}</Badge>
            {horse.tradeStatus === "For Sale" && (
                <Badge className="bg-emerald-50 text-emerald-700">For Sale</Badge>
            )}
        </div>
    </div>
</div>
```

### Grid Layout

Replace the current grid with responsive columns and generous gaps:

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
    {horses.map(...)}
</div>
```

### Step 1.1: Update `ShowRingGrid.tsx`
- Replace current card markup with the Polaroid design above
- Replace current grid classes with the responsive layout above
- Use shadcn `<Badge>` for finish/status tags (import from `@/components/ui/badge`)
- Keep all filtering, sorting, and pagination logic unchanged

### Step 1.2: Update `StableGrid.tsx`
- Apply same card design
- Keep bulk selection checkboxes, view toggle, and sorting logic
- The "Binder" view (list) should remain unchanged — only update the grid/card view

**Build check:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

---

# ═══════════════════════════════════════
# TASK 2: Horse Passport Ledger Redesign
# ═══════════════════════════════════════

## Target Files
- `src/app/stable/[id]/page.tsx` (private passport)
- `src/app/community/[id]/page.tsx` (public passport)

## Design Spec — "The Ledger"

Transform the horse detail page from a standard web dashboard into a clean, asymmetrical ledger:

### Layout
```tsx
<div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8 lg:gap-12">
    {/* Left: Gallery */}
    <div>
        <div className="rounded-2xl shadow-md overflow-hidden">
            <img ... className="w-full" />
        </div>
        {/* Thumbnail strip below */}
    </div>

    {/* Right: The Ledger Card */}
    <div className="bg-white p-6 md:p-10 rounded-3xl shadow-sm border border-stone-200">
        <h1 className="font-serif text-4xl md:text-5xl text-ink font-bold mb-2">
            {horse.customName}
        </h1>
        <p className="text-muted text-lg mb-8">{horse.moldName}</p>

        {/* Data rows — elegant dashed separators */}
        <div className="space-y-0">
            <LedgerRow label="Finish" value={horse.finish} />
            <LedgerRow label="Condition" value={horse.condition} />
            <LedgerRow label="Life Stage" value={horse.lifeStage} />
            <LedgerRow label="Added" value={formatDate(horse.createdAt)} />
        </div>
    </div>
</div>
```

### Helper Component
```tsx
function LedgerRow({ label, value }: { label: string; value: string | null }) {
    if (!value) return null;
    return (
        <div className="flex justify-between items-center py-3
                        border-b border-dashed border-stone-300 last:border-0">
            <span className="text-sm font-medium text-muted">{label}</span>
            <span className="text-base font-semibold text-ink">{value}</span>
        </div>
    );
}
```

### Step 2.1: Update `stable/[id]/page.tsx`
- Replace the current layout with the asymmetrical grid
- Replace the "boxes within boxes" data display with LedgerRow pattern
- Keep all action buttons, vault section, hoofprint, and provenance unchanged
- Use `font-serif` for the horse name heading

### Step 2.2: Update `community/[id]/page.tsx`
- Apply same layout changes
- This is the public view — different action buttons but same data display
- Keep owner card, report button, message button, trusted badge unchanged

**Build check:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

---

# ═══════════════════════════════════════
# TASK 3: Badge & Tag Overhaul
# ═══════════════════════════════════════

## Target Files
- `src/components/ShowRingGrid.tsx` (if not done in Task 1)
- `src/components/MarketValueBadge.tsx`
- Any component rendering finish/status badges

### Step 3.1: Define badge color scheme

Use soft pastel backgrounds with saturated text — more "watercolor" than "neon":

```tsx
const FINISH_BADGE_CLASSES: Record<string, string> = {
    "Original Finish": "bg-amber-50 text-amber-700",
    "Custom": "bg-indigo-50 text-indigo-700",
    "Custom/Resin": "bg-violet-50 text-violet-700",
    "Artist Resin": "bg-rose-50 text-rose-700",
    "Test Run": "bg-cyan-50 text-cyan-700",
    "Decorator": "bg-emerald-50 text-emerald-700",
    "default": "bg-stone-100 text-stone-600",
};
```

### Step 3.2: Replace raw HTML badges with shadcn `<Badge>`

```tsx
<Badge className={FINISH_BADGE_CLASSES[finish] ?? FINISH_BADGE_CLASSES.default}>
    {finish}
</Badge>
```

**Build check:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

---

# ═══════════════════════════════════════
# TASK 4: Framer Motion — Staggered Reveals
# ═══════════════════════════════════════

> **NOTE:** These are purely additive — no existing behavior changes. Lowest risk of all tasks.

## Target Files
- `src/components/ShowRingGrid.tsx`
- `src/components/StableGrid.tsx`
- `src/components/HoofprintTimeline.tsx`

### Step 4.1: Grid Card Stagger

Wrap the grid container and individual cards in `motion.div`:

```tsx
"use client";
import { motion } from "framer-motion";

const containerVariants = {
    hidden: {},
    visible: {
        transition: { staggerChildren: 0.06 },
    },
};

const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { type: "spring", stiffness: 300, damping: 30 },
    },
};

// In the grid:
<motion.div
    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
    variants={containerVariants}
    initial="hidden"
    animate="visible"
>
    {horses.map((horse) => (
        <motion.div key={horse.id} variants={cardVariants}>
            {/* card content */}
        </motion.div>
    ))}
</motion.div>
```

### Step 4.2: Hoofprint Timeline Stagger

```tsx
const timelineContainerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08 } },
};

const timelineItemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
        opacity: 1,
        x: 0,
        transition: { type: "spring", stiffness: 200, damping: 25 },
    },
};
```

Wrap the timeline container and each event row in `motion.div` with these variants.

**Build check:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

---

# ═══════════════════════════════════════
# TASK 5: Framer Motion — Bouncy Micro-Interactions
# ═══════════════════════════════════════

## Target Files
- `src/components/FavoriteButton.tsx`
- `src/components/WishlistButton.tsx`
- `src/components/LikeToggle.tsx`

### Step 5.1: Add spring physics to toggle buttons

```tsx
import { motion } from "framer-motion";

// Wrap the icon/button in motion:
<motion.button
    whileTap={{ scale: 0.85 }}
    whileHover={{ scale: 1.1 }}
    transition={{ type: "spring", stiffness: 400, damping: 15 }}
    onClick={handleToggle}
    className={...}
>
    <HeartIcon ... />
</motion.button>
```

For the "just favorited" state, add a pop animation:
```tsx
<motion.div
    key={isFavorited ? "filled" : "empty"}
    initial={{ scale: 0.5 }}
    animate={{ scale: 1 }}
    transition={{ type: "spring", stiffness: 500, damping: 15 }}
>
    <HeartIcon fill={isFavorited ? "currentColor" : "none"} />
</motion.div>
```

**Build check:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

---

# ═══════════════════════════════════════
# TASK 6: Beautiful Empty States & Skeletons
# ═══════════════════════════════════════

## Target Files
- `src/components/StableGrid.tsx` (empty stable)
- `src/app/inbox/page.tsx` (empty inbox)
- `src/app/loading.tsx` (global loading skeleton)

### Step 6.1: Standardized empty state pattern

```tsx
import { PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

function EmptyState({
    icon: Icon = PackageOpen,
    title,
    description,
    actionLabel,
    actionHref,
}: {
    icon?: React.ElementType;
    title: string;
    description: string;
    actionLabel?: string;
    actionHref?: string;
}) {
    return (
        <div className="flex flex-col items-center justify-center p-16
                        border-2 border-dashed border-stone-200 rounded-3xl
                        bg-stone-50/50">
            <Icon size={64} className="text-stone-300 mb-4" />
            <h3 className="font-serif text-xl font-semibold text-ink mb-2">
                {title}
            </h3>
            <p className="text-muted text-center max-w-sm mb-6">{description}</p>
            {actionLabel && actionHref && (
                <Button asChild>
                    <a href={actionHref}>{actionLabel}</a>
                </Button>
            )}
        </div>
    );
}
```

Create this as `src/components/EmptyState.tsx` and use it in:
- `StableGrid.tsx` — "Your stable is empty" → icon: `PackageOpen`, action: "Add Your First Horse"
- `inbox/page.tsx` — "No conversations yet" → icon: `MessageCircle`

### Step 6.2: Skeleton cards with shadcn

Replace broken `skeleton-bg-card` classes with shadcn `<Skeleton>`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

function HorseCardSkeleton() {
    return (
        <div className="p-3 bg-white rounded-2xl shadow-sm border border-edge">
            <Skeleton className="aspect-[4/3] w-full rounded-xl" />
            <div className="mt-3 px-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex gap-1.5 mt-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-12 rounded-full" />
                </div>
            </div>
        </div>
    );
}
```

Use in `loading.tsx` and any Suspense boundaries.

**Build check:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

---

# ═══════════════════════════════════════
# TASK 7: Clean Up Remaining Legacy CSS
# ═══════════════════════════════════════

After all visual work is done, audit `globals.css` for classes that are no longer referenced:

```
cd c:\Project Equispace\model-horse-hub && Select-String -Path "src\**\*.tsx" -Pattern "community-card" -List
```

Candidates for removal (verify each has zero consumers first):
- `.community-card:hover` (if cards now use Tailwind hover)
- `.profile-hero` (if passport redesigned)
- `.collection-hero` (if collections redesigned)
- Old animation `@keyframes` if replaced by Framer Motion

> **Rule:** Only delete a class from globals.css if `Select-String` returns zero results across all `.tsx` files.

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
- [ ] Horse cards in Show Ring and Stable look like glossy Polaroids with hover lift
- [ ] Horse passport pages use asymmetrical ledger layout
- [ ] Finish badges use soft pastel colors via shadcn `<Badge>`
- [ ] Grid cards stagger-animate on page load
- [ ] Hoofprint timeline slides in with spring physics
- [ ] Favorite/Like buttons bounce on tap
- [ ] Empty states show the dashed-border pattern with large icon
- [ ] Loading skeletons match the new card shape
- [ ] Build passes cleanly
- [ ] All tests pass

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "feat(ui): tactile card grids, passport ledger layout, Framer Motion animations, empty states"
```
