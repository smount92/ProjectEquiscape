---
description: Living task queue of dev cleanup, polish, and next-steps items. Run this workflow to pick up and execute pending work items.
---

# Dev Next-Steps — Living Task Queue

> **Purpose:** A persistent, prioritized list of cleanup, polish, and improvement tasks. Run `/dev-nextsteps` to pick up the next batch of work.
> **Last Updated:** 2026-03-07
> **Convention:** Mark items ✅ when done. Add new items at the bottom of the appropriate priority section. Commit this file alongside the code changes.
> **Archive:** Completed tasks are moved to `dev-nextsteps-archive.md` in this same directory.

// turbo-all

## How to Use This Workflow

1. Read this entire file to understand pending tasks
2. Start with 🔴 Critical items first, then 🟡 Medium, then 🟢 Nice-to-Have
3. Each task has clear instructions — follow them exactly
4. After completing a task, mark it ✅ in this file
5. Run `npm run build` after each task to verify nothing broke
6. Commit with a descriptive message after completing a batch of related tasks

---

## Pre-flight

Before starting any work, read the developer conventions:

```
Look for 02_developer_conventions.md in any brain artifacts directory under C:\Users\MTG Test\.gemini\antigravity\brain\
```

Verify the current build is clean:

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

# ═══════════════════════════════════════
# OPTION 7: HOOFPRINT GAPS + PASSPORT WIRING
# ═══════════════════════════════════════

> **Context:** Hoofprint Phases 1-3 are fully implemented. Phase 4 is mostly done (Claim nav ✅, Show Ring badge ✅, Hoofprint Report page ✅). But the HoofprintTimeline component is NOT wired into the passport pages yet, and auto-events from existing actions are missing.

# 🔴 Priority: Critical

## Task HP-1: Wire HoofprintTimeline into Private Passport

**Problem:** `HoofprintTimeline.tsx` exists (285 lines, fully functional), but `src/app/stable/[id]/page.tsx` never imports or renders it.

**What to fix:**

**File:** `src/app/stable/[id]/page.tsx`

1. Add imports at the top:
```typescript
import { getHoofprint } from "@/app/actions/hoofprint";
import HoofprintTimeline from "@/components/HoofprintTimeline";
```

2. After the existing data fetches (pedigree, show records, etc.), add:
```typescript
const { timeline, ownershipChain, lifeStage } = await getHoofprint(horseId);
```

3. Add the component in the JSX. Place it AFTER the Pedigree Card section and BEFORE the Financial Vault section:
```tsx
{/* 🐾 Hoofprint™ Timeline */}
<HoofprintTimeline
    horseId={horseId}
    timeline={timeline}
    ownershipChain={ownershipChain}
    lifeStage={lifeStage}
    isOwner={true}
/>
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task HP-2: Wire HoofprintTimeline into Public Passport

**Problem:** Same gap — the public passport `src/app/community/[id]/page.tsx` doesn't show the Hoofprint timeline.

**What to fix:**

**File:** `src/app/community/[id]/page.tsx`

1. Add imports:
```typescript
import { getHoofprint } from "@/app/actions/hoofprint";
import HoofprintTimeline from "@/components/HoofprintTimeline";
```

2. Fetch hoofprint data:
```typescript
const { timeline, ownershipChain, lifeStage } = await getHoofprint(horseId);
```

3. Add the component + a link to the full report. Place after existing content sections:
```tsx
{/* 🐾 Hoofprint™ Timeline */}
<HoofprintTimeline
    horseId={horseId}
    timeline={timeline}
    ownershipChain={ownershipChain}
    lifeStage={lifeStage}
    isOwner={false}
/>

{/* Link to full Hoofprint Report */}
{(timeline.length > 0 || ownershipChain.length > 0) && (
    <div style={{ textAlign: "center", marginTop: "var(--space-md)" }}>
        <Link href={`/community/${horseId}/hoofprint`} className="btn btn-ghost">
            🐾 View Full Hoofprint™ Report
        </Link>
    </div>
)}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task HP-3: Wire TransferModal into Private Passport

**Problem:** `TransferModal.tsx` exists (211 lines) but may not be rendered on the private passport page.

**What to check and fix:**

**File:** `src/app/stable/[id]/page.tsx`

Check if `TransferModal` is imported and rendered. If not, add:

```typescript
import TransferModal from "@/components/TransferModal";
```

Render it near the Edit/Delete buttons:
```tsx
<TransferModal horseId={horseId} horseName={horse.customName} />
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

# 🟡 Priority: Medium

## Task HP-4: Auto-Create Timeline Events from Show Records

**Problem:** When a user adds a show record via `addShowRecord()` in `src/app/actions/provenance.ts`, no timeline event is created. Show wins should appear in the Hoofprint.

**What to fix:**

**File:** `src/app/actions/provenance.ts` — in the `addShowRecord()` function

After the successful insert into `show_records`, add a fire-and-forget timeline event:

```typescript
// Auto-create Hoofprint timeline event (fire-and-forget)
try {
    await supabase.from("horse_timeline").insert({
        horse_id: data.horseId,
        user_id: user.id,
        event_type: "show_result",
        title: `${data.placing || "Entered"} at ${data.showName}`,
        description: data.division ? `Division: ${data.division}` : null,
        event_date: data.showDate || new Date().toISOString().split("T")[0],
        metadata: {
            show_name: data.showName,
            placing: data.placing,
            division: data.division,
            ribbon_color: data.ribbonColor,
        },
    });
} catch {
    // Non-blocking
}
```

### Verify:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npm run build 2>&1"
```

---

## Task HP-5: Commit & Push

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git add -A && git commit -m "feat: wire Hoofprint into passport pages, auto-events from show records" 2>&1"
```

Then push:

```
cd c:\Project Equispace\model-horse-hub && cmd /c "git push origin main 2>&1"
```
