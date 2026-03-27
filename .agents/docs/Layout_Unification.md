# 🏛️ SYSTEM DIRECTIVE: MHH "Macro-Layout" Unification Blueprint

> ## ✅ STATUS: COMPLETE (2026-03-27)
> All 3 phases executed. 55+ pages migrated to 4 layout archetypes. Build passes, 245 tests green.
> - Phase 1: Design System docs created (`docs/guides/design-system.md`, `CONTRIBUTING.md` updated)
> - Phase 2: 4 Layout Archetype components built (`src/components/layouts/`)
> - Phase 3: All page.tsx files refactored — only root landing page retains bespoke layout

**Agent Role:** You are "AntiGravity", acting as the Lead UI/UX Architect for Model Horse Hub (MHH).
**Objective:** Eradicate "Component Myopia" and "Macro-Layout Drift" across the entire application. You will establish a permanent Design System document, build 4 strict Page Archetypes (Layout Wrappers), and systematically refactor existing pages to use these wrappers.
**Current State:** `shadcn/ui` and `framer-motion` are ALREADY installed. Do not attempt to run `npm install` for them.

### 📜 STRICT STRUCTURAL CONSTRAINTS:
1. **NO CUSTOM PAGE CONTAINERS:** You are FORBIDDEN from using `max-w-[var(--max-width)]`, `mx-auto`, `px-6`, or custom grid layouts on the root `div` of any individual `page.tsx` file. All pages MUST pass their content as `children` or props to one of the 4 new Archetype components.
2. **PRESERVE DATA FETCHING:** Do NOT alter the Supabase data fetching, server actions, or async logic in the page components. Your job is purely DOM manipulation and CSS class restructuring at the macro-level.
3. **USE SHADCN & FRAMER MOTION:** The layout wrappers must utilize `framer-motion` for smooth, uniform page load animations, and `shadcn/ui` components for structural boundaries.
4. **EXECUTION FLOW:** You MUST stop execution completely at every `[🛑 HUMAN VERIFICATION GATE]`. Do not proceed to the next phase until the human developer approves.

---

## 📄 PHASE 1: The Constitution (Design Documentation)
**Goal:** Create a single source of truth for all future UI work so you never guess layouts again.

### Task 1.1: Create the Design System Guide
*   **Target File:** `docs/guides/design-system.md` (Create or overwrite this file)
*   **Action:** Write a comprehensive markdown document detailing the "Cozy Scrapbook" design philosophy. 
*   **Content Must Include:**
    *   **The Core Philosophy:** "The Cozy Scrapbook" - Warm, tactile, physical, hobby-focused. No sterile SaaS UI.
    *   **Typography:** Playfair Display (`font-serif`) for headers/hero text, Inter (`font-sans`) for UI. Text should be `text-stone-900` or `text-stone-600`. No `#000` pure black text.
    *   **Spacing & Borders:** Strict adherence to the 8-point Tailwind grid (`p-4`, `p-6`, `p-8`, `gap-6`). No nested borders ("boxes within boxes"). Use background contrast (`bg-stone-50`) or subtle dividers (`border-b border-stone-200`) instead.
    *   **The 4 Page Archetypes:** Detail the exact rules, max-widths, and use-cases for "The Explorer", "The Scrapbook Ledger", "The Command Center", and "The Focus Desk" (as defined in Phase 2).
    *   **Component Rules:** Mandate `shadcn/ui` for ALL inputs, selects, dialogs, and buttons. Mandate `framer-motion` for tactile hover effects. NEVER use inline `style={{...}}` for layout or padding.

### Task 1.2: Update `CONTRIBUTING.md`
*   **Action:** Modify `CONTRIBUTING.md` to add a bold section pointing to `docs/guides/design-system.md`. Add a rule under "Client Components" stating that custom page wrapper `divs` and inline `style={}` objects are strictly forbidden for layout or spacing.

> ### 🛑 HUMAN VERIFICATION GATE 1 🛑
> **Agent Instructions:** Halt execution. Print this checklist. Await human input: **"Phase 1 Verified. Proceed to Phase 2."**
> - [ ] Read `docs/guides/design-system.md`. Does it clearly establish the visual rules and the 4 layout templates?

---

## 🧱 PHASE 2: Building the Skeletons (Archetype Components)
**Goal:** Build the 4 reusable layout wrapper components in `src/components/layouts/` that dictate page bounds and structure. These must accept React nodes as props to remain compatible with Server Components.

### Task 2.1: Setup Layout Directory
*   **Action:** Create the directory `src/components/layouts/` if it does not exist.

### Task 2.2: Build `ExplorerLayout.tsx` (For browsing grids)
*   **File:** `src/components/layouts/ExplorerLayout.tsx`
*   **Props:** `title` (string/node), `description` (string/node), `headerActions` (node), `controls` (node - for search/filters), `children` (node).
*   **Structure:** 
    *   Container: `<div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-8">`
    *   Header Row: Flex container aligning `title`/`description` on the left and `headerActions` on the right. Use `font-serif text-3xl md:text-4xl font-bold tracking-tight text-stone-900` for the title.
    *   Controls Row: `<div className="sticky top-[calc(var(--header-height)+1rem)] z-40 bg-background/90 backdrop-blur-md pb-4 pt-2 border-b border-stone-200 mb-8">` (Inject `controls` here).
    *   Content: Wrap `children` in a `framer-motion` `<motion.div>` with `initial={{ opacity: 0, y: 10 }}` and `animate={{ opacity: 1, y: 0 }}`.

### Task 2.3: Build `ScrapbookLayout.tsx` (For split-view details)
*   **File:** `src/components/layouts/ScrapbookLayout.tsx`
*   **Props:** `breadcrumbs` (node), `leftContent` (node - visuals/timeline), `rightContent` (node - data/actions).
*   **Structure:**
    *   Container: `<div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">`
    *   Breadcrumbs row at the top.
    *   Grid: `<div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8 lg:gap-12 mt-6 items-start">`
    *   Left Column: `<div className="flex flex-col gap-8">{leftContent}</div>` (Scrolls naturally)
    *   Right Column: `<div className="lg:sticky lg:top-[calc(var(--header-height)+2rem)] flex flex-col gap-6">{rightContent}</div>`

### Task 2.4: Build `CommandCenterLayout.tsx` (For high-density dashboards)
*   **File:** `src/components/layouts/CommandCenterLayout.tsx`
*   **Props:** `title` (string/node), `description` (string/node), `headerActions` (node), `mainContent` (node), `sidebarContent` (node).
*   **Structure:**
    *   Container: `<div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-8">`
    *   Header Row: Same elegant typography as ExplorerLayout.
    *   Grid: `<div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] 2xl:grid-cols-[1fr_360px] gap-8 items-start">`
    *   Main: `<main className="min-w-0 flex flex-col gap-8">{mainContent}</main>`
    *   Sidebar: `<aside className="flex flex-col gap-6">{sidebarContent}</aside>`

### Task 2.5: Build `FocusLayout.tsx` (For data entry/forms)
*   **File:** `src/components/layouts/FocusLayout.tsx`
*   **Props:** `title` (string/node), `description` (string/node), `backLink` (node), `children` (node).
*   **Structure:**
    *   Container: `<div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-12 md:py-16 flex flex-col gap-8">`
    *   Header: Optional `backLink` rendered above. Left-aligned or centered `title` (serif) and `description`.
    *   Content: `<div className="w-full">{children}</div>`

> ### 🛑 HUMAN VERIFICATION GATE 2 🛑
> **Agent Instructions:** Halt execution. Await human input: **"Phase 2 Verified. Proceed to Phase 3."**
> - [ ] Check `src/components/layouts/`. Are all 4 layout wrappers created and utilizing strict Tailwind classes without custom CSS?

---

## 🚜 PHASE 3: The Great Alignment (Refactoring Pages)
**Goal:** Strip custom container `divs` from page files and wrap their content in the new layout components. **DO NOT BREAK DATA FETCHING OR STATE.**

### Task 3.1: Apply "The Explorer"
*   **Target Files:** 
    *   `src/app/community/page.tsx` (Show Ring)
    *   `src/app/discover/page.tsx` (Discover)
    *   `src/app/market/page.tsx` (Market)
    *   `src/app/catalog/page.tsx` (Catalog)
    *   `src/app/shows/page.tsx` (Shows)
    *   `src/app/community/groups/page.tsx` (Groups)
*   **Action:** 
    *   Import `ExplorerLayout`.
    *   Remove custom `mx-auto max-w-[var(--max-width)] px-6 py-8` wrappers.
    *   Pass the Page Title and Description to the `title` and `description` props. Pass the filters/search bars to the `controls` prop. Pass the grid components to `children`.

### Task 3.2: Apply "The Scrapbook Ledger"
*   **Target Files:** 
    *   `src/app/stable/[id]/page.tsx` (Private Passport)
    *   `src/app/community/[id]/page.tsx` (Public Passport)
    *   `src/app/studio/[slug]/page.tsx` (Studio Profile)
    *   `src/app/community/events/[id]/page.tsx` (Event Detail)
*   **Action:**
    *   Import `ScrapbookLayout`.
    *   Strip out the current messy grid implementations (e.g. `grid-cols-[1fr_420px]`).
    *   Put the `PassportGallery`, `HoofprintTimeline`, and `ShowRecordTimeline` into the `leftContent` prop.
    *   Take the massive block of typographic data (Name, Finish, Condition, Vault Data, Action Buttons) and put it in the `rightContent` prop. *Remove all old "boxes within boxes" styling from this data.* Instead, use simple flex rows with subtle `border-b border-stone-200 py-3` dividers.

### Task 3.3: Apply "The Command Center"
*   **Target Files:**
    *   `src/app/dashboard/page.tsx` (Digital Stable)
    *   `src/app/admin/page.tsx` (Admin Console)
*   **Action:**
    *   Import `CommandCenterLayout`.
    *   For the Dashboard, pass the `DashboardShell` to `mainContent`. Pass the `NanDashboardWidget`, `TransferHistorySection`, and Analytics cards to the `sidebarContent` prop.

### Task 3.4: Apply "The Focus Desk"
*   **Target Files:**
    *   `src/app/add-horse/page.tsx`
    *   `src/app/add-horse/quick/page.tsx`
    *   `src/app/stable/[id]/edit/page.tsx`
    *   `src/app/settings/page.tsx`
    *   `src/app/claim/page.tsx`
    *   `src/app/login/page.tsx`
    *   `src/app/signup/page.tsx`
    *   `src/app/contact/page.tsx`
*   **Action:**
    *   Import `FocusLayout`.
    *   Remove the heavily nested, center-aligned custom divs (`max-w-[680px]`, `max-w-[500px]`, etc.). Let the layout wrapper handle the centering and max-width. Pass the forms as `children`.

> ### 🛑 FINAL HUMAN VERIFICATION GATE 3 🛑
> **Agent Instructions:** Halt execution. Await human input: **"Phase 3 Verified. Layout Unification Complete."**