# 🗺️ Master Blueprint: Phase 6 — UI/UX Overhaul, CSS Maturity & Safe-Trade Engine

> **Target Audience:** Antigravity Architect Agent
> **Developer Agent:** Claude 3.7 Sonnet / Opus 4.6
> **Guiding Philosophy:** "Right, not fast." We are building an enterprise-grade SaaS. We do not accept technical debt, massive CSS monoliths, or clunky layouts. Quality and architecture over speed.
> **Context:** The platform's backend is robust, but the frontend suffers from "Developer-Driven UI." Components stack vertically, widescreen space is wasted, dropdowns are unstyled, and the global CSS file is a hallucination hazard.
> **Architect Directive:** You will design workflows to execute **Epic 1 (UI Overhaul & Dashboard Redesign)**, **Epic 2 (CSS Modularization)**, **Epic 3 (Feed Quality & Watermarks)**, and **Epic 4 (Commerce State Machine)**.

---

## 🎨 EPIC 1: The "Pro Dashboard" & UI Glow-Up

**Goal:** Eradicate the "Single-Column Stack" design. Utilize widescreen desktop space efficiently, move secondary widgets out of the primary flow, and polish degraded UI components.

### Task 1.1: Dashboard Two-Column Layout
* **The Bug:** Massive empty margins on desktop. The NAN Widget, Collections, and Analytics are stacked vertically, interrupting the core Stable Grid.
* **Architect Action:** Redesign `src/app/dashboard/page.tsx` using a CSS Grid layout for screens > `1024px` (e.g., `grid-template-columns: 1fr 350px; gap: 2rem;`).
  * **Main Content (Left):** Dedicated exclusively to the Search/Sort bar and the `StableGrid`. The horses are the undisputed hero of the page.
  * **Sidebar (Right):** Move "Stable Overview" (Analytics), "Collections", "NAN Qualification Tracker", and "Transfer History" into a sticky right-hand sidebar.

### Task 1.2: Widescreen Container Expansion
* **The Bug:** The `.page-container` max-width is too restrictive on modern 1440p+ monitors.
* **Architect Action:** Increase the max-width of grid-heavy pages (Dashboard, Show Ring, Discover) to `1600px` or `1800px` (or `width: 100%; padding: 0 4vw;`). Ensure grids dynamically fill up to 5-7 columns on ultrawide screens using `auto-fill, minmax(260px, 1fr)`.

### Task 1.3: Form & Dropdown Polish
* **The Bug:** Native HTML `<select>` dropdowns (like in Reference Search or Sort menus) look hideous and break the Glassmorphism illusion.
* **Architect Action:** Apply custom styling to `.form-select`. Remove native browser styling (`appearance: none`) and inject a custom SVG chevron. Ensure dropdown menus have proper backdrop blur, padding, and hover states.

---

## 🏗️ EPIC 2: CSS Architecture Maturity (The Rewrite)

**Goal:** Dismantle the monolithic `globals.css`. Transition to **Next.js CSS Modules** to locally scope styles, prevent regressions, and make the codebase AI-friendly.

### Task 2.1: Global Token Extraction
* **Architect Action:** Strip `src/app/globals.css` down so it ONLY contains `:root` CSS variables (colors, spacing, fonts) and base HTML resets (`*, body, h1, input`). 

### Task 2.2: Component-Level CSS Modules
* **Architect Action:** Systematically extract component-specific styles into `[ComponentName].module.css` files (e.g., `StableGrid.module.css`). Update the `.tsx` files to `import styles from './StableGrid.module.css'` and use `className={styles.horseCard}`.
* **Execution Strategy:** Instruct the Developer Agent to do this iteratively (3-4 components per prompt) to ensure zero visual regressions.

---

## 🛡️ EPIC 3: Feed Quality & Serverless Integrity

**Goal:** Protect high-end collector photos, maintain a visually premium Activity Feed, and guarantee background tasks don't fail.

### Task 3.1: Opt-In Client-Side Watermarking
* **Architect Action:** 
  1. Add a toggle to User Settings: `watermark_photos BOOLEAN DEFAULT false`.
  2. Update `src/lib/utils/imageCompression.ts`. If enabled, utilize the HTML5 `<canvas>` API to draw a tasteful, semi-transparent watermark (e.g., `© @[AliasName] - ModelHorseHub`) in the corner of the image *before* generating the WebP blob for upload.

### Task 3.2: "No Photo, No Feed" Rules
* **Architect Action:** Update `notifyHorsePublic` in `horse-events.ts` and the CSV import logic.
  * **Rule A:** If a horse is made public but has 0 photos, **do not** fire a `new_horse` activity event.
  * **Rule B:** CSV Bulk Imports must be excluded from the feed by default. Add a toggle to the import UI: *"Publish imported models to the community feed (Models without photos will be excluded)."*

### Task 3.3: Serverless Execution Safety
* **The Bug:** Fire-and-forget promises (like sending emails) are killed instantly when Vercel returns the HTTP response.
* **Architect Action:** Globally implement the `after()` API from `next/server`. Wrap all notification triggers, materialized view refreshes, and activity event insertions inside `after(async () => { ... })` across all Server Actions.

---

## 🤝 EPIC 4: The Commerce State Machine (Safe-Trade Engine)

**Goal:** Formalize "Open to Offers" into a strict, secure 4-step state machine. Replace ambiguous messaging with a structured flow that generates the transfer PIN at exactly the right moment.

### Task 4.1: The State Machine Schema
* **Architect Action:** Update the `transactions` table. Ensure `status` supports:
  * `offer_made` (Buyer submitted offer)
  * `pending_payment` (Seller accepted, waiting for buyer to pay off-platform)
  * `funds_verified` (Seller verified funds, PIN generated/Transferred)
  * `completed` (Buyer claimed)

### Task 4.2: The Negotiation UI
* **Architect Action:** Replace the "Message Seller" button with a "Make Offer" modal (Amount + Message). This injects a rich UI "Offer Card" into the `ChatThread`.

### Task 4.3: The Safe-Transfer Flow
* **Architect Action:** 
  1. Seller clicks **[Accept Offer]**. The transaction enters `pending_payment`. The horse's `trade_status` is automatically locked to `"Pending Sale"`.
  2. Buyer pays via PayPal/Venmo (off-platform), then clicks **[I Have Paid]**.
  3. Seller verifies funds in their account, then clicks **[Confirm Funds & Release]**.
  4. The system automatically triggers the `parkHorse` logic, generates the Hoofprint Transfer PIN, shifts the state to `funds_verified`, and reveals the PIN to the buyer in the chat.