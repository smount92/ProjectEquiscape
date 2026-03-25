# 🎨 SYSTEM DIRECTIVE: MHH "Cozy Scrapbook" UI/UX Overhaul Blueprint

**Agent Role:** You are "AntiGravity", acting as the Lead UI/UX Engineer and Design Systems Architect for Model Horse Hub (MHH).
**Target Stack:** Next.js 16.1, React 19, Tailwind CSS v4, shadcn/ui (Radix UI), Framer Motion, and lucide-react.
**Design Aesthetic:** "The Cozy Scrapbook" (Hobbyist/Tactile). Warmer, tighter spacing, subtle paper textures, slightly rounded UI elements, playful, and "lived-in."
**Objective:** Eradicate legacy CSS/inline styles and implement a premium, tactile, "Cozy Scrapbook" design system utilizing shadcn/ui for accessible primitives and Framer Motion for fluid, tactile micro-interactions.

### 📜 STRICT DESIGN CONSTRAINTS (THE "SCRAPBOOK" RULES):
1. **The Tooling Upgrade:** You will integrate `shadcn/ui` (for accessible, perfectly spaced inputs/dropdowns/modals) and `framer-motion` (for spring-based animations).
2. **The "Cozy" Palette:** 
   - Backgrounds: Warm cream/parchment (`bg-stone-50` or `#FBF7ED`).
   - Text: Never pure black (`#000`); use `text-stone-800` or `text-stone-900` for headers, warm slate (`text-stone-600`) for body text.
   - Accents: Forest Green (`#2C5545`) and Saddle Brown (`#8B5A2B`).
3. **Tactile Elements:** Soften the UI. Use slightly larger border radii (`rounded-xl` or `rounded-2xl` for cards) to make them feel like Polaroids or journal inserts. Use warm, subtle borders (`border-stone-200`) and soft, diffuse shadows (`shadow-sm` or `shadow-md`). No harsh black lines.
4. **Nuke the Inline Styles:** Systematically remove EVERY `style={{...}}` attribute related to layout, spacing, or colors. Replace them strictly with Tailwind utility classes or `shadcn/ui` components.
5. **Typographic Hierarchy:** Use `font-serif` (`Playfair_Display` or similar serif) for `h1`, `h2`, and hero components to give it a classic, established feel. Use `font-sans` (`Inter`) for standard UI elements.
6. **Execution Flow:** You MUST stop execution completely at every `[🛑 HUMAN VERIFICATION GATE]`. Do not proceed to the next phase until the human developer approves.

---

## 📦 PHASE 1: Tooling Injection & The Great Purge
**Goal:** Install the modern UI stack, configure the warm theme, and eradicate the old, poorly spaced inputs.

### Task 1.1: Install & Initialize Tooling
*   **Action:** Run the following installations in the terminal:
    1. `npm install framer-motion clsx tailwind-merge lucide-react`
    2. Initialize shadcn/ui (Ensure it is compatible with Tailwind v4): `npx shadcn@latest init` (Select style: New York, Base color: Stone, CSS variables: Yes).
    3. Install core shadcn components we desperately need: `npx shadcn@latest add button input select textarea dialog card badge skeleton separator`.

### Task 1.2: The "Warm Equestrian" Tailwind Config
*   **Target File:** `src/app/globals.css`
*   **Action:** 
    *   Overwrite the default shadcn CSS variables with our Cozy Palette. 
    *   `--background: 48 33% 97%;` (Warm cream #FDFBF7)
    *   `--foreground: 31 30% 16%;` (Espresso #2D2318)
    *   `--card: 0 0% 100%;` (White/Cream)
    *   `--primary: 156 32% 25%;` (Forest Green: `#2C5545`)
    *   `--border: 35 25% 85%;` (Warm Almond)
    *   `--radius: 0.75rem;` (Soft, rounded elements)
    *   Apply a subtle warm background color to the `body`: `bg-background text-foreground`.
    *   **DELETE ALL legacy component classes** (`.ref-main`, `.empty-state`, `.hero-glow`, `.page-content`, `.form-input`, `.btn`, etc.) reported in the styling architecture report. Only `@tailwind` imports, shadcn variables, and native HTML resets should remain.

### Task 1.3: Replace Global Inputs & Buttons (Fixing the Layouts)
*   **Target Files:** Global codebase search (focus on `src/app/add-horse/page.tsx`, `src/components/ShowEntryForm.tsx`, `src/components/MakeOfferModal.tsx`, Auth pages, `src/app/settings/page.tsx`).
*   **Action:** 
    *   Replace all `<input className="form-input">` with shadcn `<Input />`.
    *   Replace all `<textarea>` with shadcn `<Textarea />`.
    *   Replace all `<select>` with shadcn `<Select />` components.
    *   Replace raw `<button>` tags with shadcn `<Button variant="default" | "outline" | "ghost">`.
    *   Ensure all forms use standard Tailwind vertical rhythm classes (e.g., `space-y-6`). *This instantly fixes the poorly spaced text boxes.*

> ### 🛑 HUMAN VERIFICATION GATE 1 🛑
> **Agent Instructions:** Halt execution. Print this checklist. Await human input: **"Phase 1 Verified. Proceed to Phase 2."**
> - [ ] Did shadcn and Framer Motion install correctly? Are the components in `components/ui/`?
> - [ ] Check `globals.css` — is it clean, utilizing the new Shadcn variables?
> - [ ] Check the `add-horse` form or `login` page. Are the inputs now beautiful, perfectly padded, with smooth focus rings?

---

## 🖼️ PHASE 2: The "Scrapbook" Layout Overhaul
**Goal:** Redesign the primary views (Grids and Passports) to feel tactile, organized, and premium.

### Task 2.1: Tactile Grids (The Polaroid Effect)
*   **Target Files:** `src/components/ShowRingGrid.tsx`, `src/components/StableGrid.tsx`
*   **Action:** Stop cramping the cards.
    *   Set grid to: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8`.
    *   **Card Redesign:** Use shadcn `<Card>`. Remove harsh inner borders. The image should look like a glossy print pasted onto the card: `p-3 bg-white rounded-2xl shadow-sm border border-[#D4C9B5]`.
    *   **Image Container:** Lock the aspect ratio: `aspect-[4/3] w-full rounded-xl overflow-hidden bg-stone-100`. 
    *   Apply `group-hover:scale-105 transition-transform duration-500 ease-out` to the `<img />` tag inside it for a premium hover feel.
    *   **Typography:** Make the horse name `font-serif text-lg font-bold text-stone-800`. Use `text-stone-500 font-sans text-sm` for the meta-details.

### Task 2.2: The Horse Passport Ledger (`/stable/[id]`)
*   **Target File:** `src/app/stable/[id]/page.tsx`, `src/app/community/[id]/page.tsx`
*   **Action:** Redesign this from a generic web page into a "Ledger/Scrapbook" view.
    *   **Layout:** Change to a clean, asymmetrical split: `grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8 lg:gap-12`.
    *   **Left Side (Gallery):** No heavy borders. Just the main image with `rounded-2xl shadow-md`.
    *   **Right Side (The Ledger):** Remove the dark "tan/brown sidebar". Use a clean parchment background. 
    *   Wrap the data in a clean shadcn `<Card className="p-6 md:p-10 rounded-3xl shadow-sm border-stone-200">`.
    *   Replace the custom "boxes within boxes" with clean, elegant rows: `flex justify-between items-center py-3 border-b border-dashed border-stone-300 last:border-0`.
    *   Typography: Label (`text-sm font-medium text-stone-500`), Value (`text-base font-semibold text-stone-900`).
    *   Use `font-serif` for the Horse Name (`text-4xl md:text-5xl text-stone-900 font-bold mb-2`).

### Task 2.3: Modals to Dialogs
*   **Target Files:** `src/components/ImageCropModal.tsx`, `src/components/MakeOfferModal.tsx`, `src/components/TransferModal.tsx`, `src/components/SuggestReferenceModal.tsx`
*   **Action:** Replace all custom `createPortal` and `.modal-overlay` logic with shadcn `<Dialog>`, `<DialogContent>`, `<DialogHeader>`, and `<DialogTitle>`. This provides beautiful, accessible overlay modals that automatically lock background scrolling and blur the backdrop (`backdrop-blur-sm bg-stone-900/40`).

### Task 2.4: Badges & Tags Overhaul
*   **Target Files:** `src/components/ShowRingGrid.tsx`, `src/components/MarketValueBadge.tsx`
*   **Action:** 
    *   Replace raw HTML badges with shadcn `<Badge variant="secondary">`.
    *   Update Finish badges (OF, Custom, Resin) to use soft pastel backgrounds with saturated text (`bg-amber-50 text-amber-700`, `bg-indigo-50 text-indigo-700`).

> ### 🛑 HUMAN VERIFICATION GATE 2 🛑
> **Agent Instructions:** Halt execution. Print this checklist. Await human input: **"Phase 2 Verified. Proceed to Phase 3."**
> - [ ] Look at the Show Ring. Do the cards feel like beautifully spaced polaroids?
> - [ ] Look at a Horse Passport. Does the information layout look like a clean, elegant ledger rather than a standard web dashboard?
> - [ ] Click "Make Offer" or "Transfer". Does the shadcn `<Dialog>` open smoothly with perfectly spaced inputs?

---

## ✨ PHASE 3: Micro-Interactions & The "WOW" Factor
**Goal:** Use Framer Motion to make the app feel alive, organic, and expensive.

### Task 3.1: Staggered Grid Reveals & Hover Springs
*   **Target Files:** `src/components/ShowRingGrid.tsx`, `src/components/StableGrid.tsx`
*   **Action:** 
    *   Wrap the grid container in a `framer-motion` `<motion.div>` with `variants` for a staggered children reveal (e.g., `staggerChildren: 0.1`).
    *   Wrap the individual Horse Cards in `<motion.div>` items that fade up and scale in (`initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}`).
    *   Add a springy hover state to the cards: `whileHover={{ y: -4, scale: 1.01, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}` for a playful, scrapbook-like lift effect.

### Task 3.2: The Living Hoofprint™ Timeline
*   **Target File:** `src/components/HoofprintTimeline.tsx`
*   **Action:** Bring the provenance timeline to life.
    *   Wrap the timeline container in a `<motion.div>` with `initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1 } } }}`.
    *   Wrap each timeline event (each row) in a `<motion.div>` that slides in and fades up (`initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ type: "spring" }}`).

### Task 3.3: Bouncy Micro-Interactions
*   **Target Files:** `src/components/FavoriteButton.tsx`, `src/components/WishlistButton.tsx`, `src/components/LikeToggle.tsx`
*   **Action:** 
    *   Wrap the heart/star icons in `<motion.button>`.
    *   Add `whileTap={{ scale: 0.8 }}` and `whileHover={{ scale: 1.1 }}`. When a user clicks "Favorite", the heart icon should spring-pop empathetically.

### Task 3.4: Beautiful Empty States & Skeletons
*   **Target Files:** `src/app/loading.tsx`, Empty state returns in `StableGrid.tsx` and `src/app/inbox/page.tsx`.
*   **Action:** 
    *   Replace the broken `skeleton-bg-card` classes with shadcn `<Skeleton>` components that match the exact shape of your new cards.
    *   For Empty States (e.g., "Your Stable is Empty"), remove the bordered box. Center them on the page with a highly padded, dashed-border container: `flex flex-col items-center justify-center p-16 border-2 border-dashed border-stone-200 rounded-3xl bg-stone-50/50`. Use a massive, soft-colored Lucide icon (`<PackageOpen size={64} className="text-stone-300 mb-4" />`), a `font-serif` header, and a clear, primary shadcn `<Button>` to take action.

> ### 🛑 FINAL HUMAN VERIFICATION GATE 3 🛑
> **Agent Instructions:** Halt execution. Await human input: **"Phase 3 Verified. UI/UX Polish Complete."**
>
> *Developer Verification Checklist:*
> - [ ] Navigate to the Show Ring. Do the cards cascade in beautifully?
> - [ ] Hover over a horse card in the Show Ring. Does it feel like picking up a physical photo?
> - [ ] Click the "Favorite" heart. Does it pop with satisfying spring physics?
> - [ ] View a Hoofprint timeline. Does it animate into view?