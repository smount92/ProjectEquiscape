---
description: "Digital County Fair Phase 5 — Rebranding the Live Show Packer. Rename 'Show String Planner' to 'Live Show Packer' and relocate navigation."
---

# 🧳 Phase 5: Rebranding the "Live Show Packer"

**Epic:** Digital County Fair UX  
**Goal:** Distance the physical live-show planner from the virtual photo shows to prevent user confusion. Purely a text/nav change — no logic modifications.

---

## Task 5.1: Terminology Overhaul

### Target Files & Locations

Based on codebase search, "Show String Planner" / "shows/planner" appears in these locations:

| File | Line(s) | Current Text | Change To |
|------|---------|-------------|-----------|
| `src/app/shows/planner/page.tsx` | L10 | `title: "Show String Planner — Model Horse Hub"` | `title: "Live Show Packer — Model Horse Hub"` |
| `src/app/shows/planner/page.tsx` | L37 | `title="📋 Show String Planner"` | `title="🧳 Live Show Packer"` |
| `src/components/ShowStringManager.tsx` | L142 | `+ New Show String` | `+ New Show String` (KEEP — contextually correct within the packer) |
| `src/components/ShowStringManager.tsx` | L146 | `Create Show String` | `Create Show String` (KEEP — this is the individual "string" concept, not the feature name) |
| `src/app/actions/competition.ts` | L232 | `// ── Show String Planner ──` (comment) | `// ── Live Show Packer ──` |
| `src/components/NanDashboardWidget.tsx` | L65 | `href="/shows/planner"` | Keep URL, but update surrounding link text if it says "Show String Planner" |

### Step-by-Step Changes

#### 1. `src/app/shows/planner/page.tsx`

- **Line 10:** Change metadata title to `"Live Show Packer — Model Horse Hub"`
- **Line 37:** Change layout title to `"🧳 Live Show Packer"`
- **Add a subtitle/description** to the `ExplorerLayout` (if the layout supports a `description` prop):
  ```
  Plan your physical trips to real-world live shows (like BreyerFest). 
  Detect ring time conflicts and log your real-world ribbons.
  ```
- **DO NOT change the URL** — keep `/shows/planner` to avoid breaking bookmarks/links

#### 2. `src/components/ShowStringManager.tsx`

- The internal terminology "Show String" (as in "a string of horses you bring to a show") is hobby-correct — **keep it for the individual items**
- Add a contextual subtitle at the top of the component (after the heading):
  ```tsx
  <p className="text-sm text-muted mb-4">
    Pack your string of horses for real-world shows. Detect ring time conflicts 
    and convert results to ribbons when you get home.
  </p>
  ```

#### 3. `src/app/actions/competition.ts` (Line 232)

- Change the section comment from `// ── Show String Planner ──` to `// ── Live Show Packer ──`
- No functional changes.

#### 4. `src/components/NanDashboardWidget.tsx` (Line 65)

- Check the link text around `href="/shows/planner"`. If it says "Show String Planner", change to "🧳 Live Show Packer"
- Keep the URL as `/shows/planner`

#### 5. Navigation Cleanup

**Check if `/shows/planner` is linked from the virtual Shows pages (`/shows` or `/shows/[id]`):**
- Search confirmed: The planner is NOT currently linked from the virtual shows pages or Header — it's only linked from the NAN Dashboard Widget.
- **No removal needed** — but ensure the "🧳 Live Show Packer" link is accessible from the main Dashboard sidebar.

**Dashboard sidebar (`src/components/DashboardShell.tsx` or `src/app/dashboard/page.tsx`):**
- Search confirmed: Neither currently links to `/shows/planner`.
- **ADD a sidebar link** to the Dashboard. Find the sidebar navigation section in `DashboardShell.tsx` and add:
  ```tsx
  <Link href="/shows/planner" className="...existing sidebar link classes...">
    🧳 Live Show Packer
  </Link>
  ```
  Place it near the Shows/Competition section of the sidebar, or after the Show Ring link.

### Summary of Changes

| Action | What | Why |
|--------|------|-----|
| RENAME | Metadata + page title → "Live Show Packer" | Clear physical vs virtual distinction |
| ADD | Description text on planner page + ShowStringManager | Explicit purpose statement |
| ADD | Dashboard sidebar link to `/shows/planner` | Discovery point for physical show tool |
| KEEP | URL `/shows/planner` unchanged | No broken links |
| KEEP | "Show String" terminology for individual strings | Hobby-correct terminology |
| KEEP | Internal code comments updated | Code hygiene |

---

## 🛑 FINAL HUMAN VERIFICATION GATE 5 🛑

**Stop execution. Await human input: "Phase 5 Verified. Show Ring Masterclass Epic Complete."**

- [ ] Navigate to `/shows/planner` — does it say "🧳 Live Show Packer" with the physical show description?
- [ ] Is there NO "Show String Planner" text visible in the virtual Shows pages (`/shows`)?
- [ ] Is the "🧳 Live Show Packer" link accessible from the Dashboard sidebar?
- [ ] Does the NAN Dashboard Widget link still work and use the updated text?

---

## Build Gate
Run `npx next build` (via `cmd /c "npx next build 2>&1"`) and confirm 0 errors before marking complete.
