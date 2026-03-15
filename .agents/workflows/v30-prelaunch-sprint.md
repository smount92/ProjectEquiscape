---
description: V30 Pre-Launch Sprint — Polish, modal audit, CSS cleanup, insurance PDF report generator. The final sprint before opening public registration.
---

# V30: Pre-Launch Sprint

> **Context:** Testing foundation complete (132 Vitest + 20 E2E). Settings page already fully built (profile, avatar, password, notifications, currency, watermark, account deletion). This sprint clears the remaining technical debt and adds the last high-value feature (Insurance PDF) before public launch.
>
> **Scope:** 4 phases, 12 tasks. Estimated ~5 hours total.
>
> **Pre-requisites:** Test Sprint C complete. Clean build.

// turbo-all

---

## Developer Agent Rules

> **MANDATORY:**
> - Run `npx next build` after each phase.
> - Commit after each phase with a descriptive message.
> - Do NOT modify test files unless a test is broken by your changes.
> - When modifying CSS, check mobile (375px) and desktop (1440px) viewport behavior.

---

# ═══════════════════════════════════════
# PHASE 1: Technical Debt Cleanup
# ═══════════════════════════════════════

## Task 1: Modal Portal Audit

**Problem:** 8 components use `.modal-overlay`, but only 4 use `createPortal`. Modals nested inside CSS-transformed containers will be misaligned.

**Components with `modal-overlay`:**
| Component | Has `createPortal`? | Action |
|-----------|:-------------------:|--------|
| `DeleteHorseModal.tsx` | ✅ Yes | No change |
| `SuggestReferenceModal.tsx` | ✅ Yes | No change |
| `MakeOfferModal.tsx` | ✅ Yes | No change |
| `ImageCropModal.tsx` | ✅ Yes | No change |
| `TransferModal.tsx` | ❌ No | **Add portal** |
| `CollectionPicker.tsx` | ❌ No | **Add portal** |
| `CollectionManager.tsx` | ❌ No | **Add portal** |
| `DashboardShell.tsx` | ❌ No | **Add portal** |
| `community/events/[id]/manage/page.tsx` | ❌ No | **Add portal** |

**For each missing component:**

1. Add import: `import { createPortal } from "react-dom";`
2. Find the `<div className="modal-overlay"` JSX block
3. Wrap the entire overlay in: `createPortal(<div className="modal-overlay">...</div>, document.body)`
4. Verify the modal still opens/closes correctly

**Pattern:**
```tsx
// BEFORE
{showModal && (
    <div className="modal-overlay" onClick={handleClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
            ...
        </div>
    </div>
)}

// AFTER
{showModal && createPortal(
    <div className="modal-overlay" onClick={handleClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
            ...
        </div>
    </div>,
    document.body
)}
```

---

## Task 2: Deduplicate `.modal-overlay` CSS

**Problem:** 3 separate `.modal-overlay` definitions in `globals.css` (lines ~2339, ~3499, ~10063) with different z-index values.

**Fix:**

1. View all three definitions:
   ```
   View globals.css lines 2339-2360
   View globals.css lines 3499-3520
   View globals.css lines 10063-10100
   ```

2. Create ONE canonical definition (keep the most complete one, likely line ~10063):
   ```css
   .modal-overlay {
       position: fixed;
       inset: 0;
       z-index: 1000;
       display: flex;
       align-items: center;
       justify-content: center;
       background: rgba(0, 0, 0, 0.7);
       backdrop-filter: blur(4px);
       -webkit-backdrop-filter: blur(4px);
       padding: var(--space-lg);
       animation: fadeIn 0.2s ease;
   }
   ```

3. Delete the other two duplicate definitions (lines ~2339 and ~3499)

4. Verify: `npx next build` + visually check DeleteHorseModal, TransferModal, CollectionManager

---

## Task 3: UnifiedReferenceSearch UX Verification

**Problem:** The `handleMoldClick` fix now pre-selects the mold immediately. Need to verify edge cases.

**Steps:**
1. Go to `/add-horse` in the browser
2. Search for "Ideal" in the reference search
3. Click a mold with multiple releases → verify the releases panel appears for drill-down
4. Click a mold WITHOUT releases → verify the "selected" badge shows immediately
5. For a mold with releases, click a specific release → verify it overrides the mold selection
6. Proceed without picking a release → verify the mold is saved correctly

> This is a **manual verification task**. If issues are found, document them and fix the UX in `UnifiedReferenceSearch.tsx` or `CatalogSearchPanel.tsx`.

---

## Phase 1 Commit

```
git add -A && git commit -m "fix: modal portal audit (5 components) + CSS overlay dedup + reference UX verification"
```

---

# ═══════════════════════════════════════
# PHASE 2: CSS Diet
# ═══════════════════════════════════════

## Task 4: Identify Largest Remaining Style Blocks in globals.css

`globals.css` is ~9,300 lines. Identify the 5 largest style blocks that could be extracted to CSS modules.

```
Search globals.css for large comment headers like /* === ... === */ or /* --- ... --- */
```

For each large block:
1. Note the component it belongs to (e.g., `.passport-*` → passport page)
2. Check if that component already has a `.module.css` file
3. If NOT, it's a candidate for extraction

**Do NOT extract blocks that are used by multiple components** (e.g., `.form-input`, `.btn`). Only extract page-level or single-component styles.

---

## Task 5: Extract Top 3 CSS Blocks to Modules

For the 3 largest extractable blocks found in Task 4:

1. Create `ComponentName.module.css` alongside the component
2. Move the CSS rules into the module (prefix removed — CSS modules auto-scope)
3. Update the component to `import styles from "./ComponentName.module.css"`
4. Replace `className="old-class"` with `className={styles.newClass}`
5. Remove the extracted lines from `globals.css`
6. Build and verify

> **Caution:** Some class names are generated dynamically (e.g., `ribbon-${color}`). These cannot be extracted to CSS modules. Leave them in globals.

---

## Phase 2 Commit

```
git add -A && git commit -m "refactor: extract 3 CSS blocks to modules, globals.css down to ~Xk lines"
```

---

# ═══════════════════════════════════════
# PHASE 3: Insurance PDF Report Generator
# ═══════════════════════════════════════

## Task 6: Install @react-pdf/renderer

```
npm install @react-pdf/renderer
```

> **Note:** `@react-pdf/renderer` works server-side in Next.js API routes and can generate PDFs without a browser. It uses a React-like API for layout.

---

## Task 7: Create the PDF Generation Endpoint

Create `src/app/api/insurance-report/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
// Import the PDF document component (Task 8)
import { InsuranceReportDocument } from "@/lib/pdf/InsuranceReport";

export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Fetch all horses with vault data
    const { data: horses } = await supabase
        .from("user_horses")
        .select(`
            id, custom_name, finish_type, condition_grade, trade_status, created_at,
            catalog_items:catalog_id(title, maker, scale),
            financial_vault(purchase_price, purchase_date, estimated_current_value, insurance_notes)
        `)
        .eq("owner_id", user.id)
        .order("custom_name");

    // Fetch owner profile for report header
    const { data: profile } = await supabase
        .from("users")
        .select("alias_name, full_name, email")
        .eq("id", user.id)
        .single();

    // Fetch primary thumbnail URLs for each horse
    const horseIds = (horses || []).map(h => (h as { id: string }).id);
    const { data: images } = await supabase
        .from("horse_images")
        .select("horse_id, image_url")
        .in("horse_id", horseIds)
        .eq("angle_profile", "Primary_Thumbnail");

    const thumbnailMap = new Map<string, string>();
    (images || []).forEach((img: { horse_id: string; image_url: string }) => {
        thumbnailMap.set(img.horse_id, img.image_url);
    });

    // Render PDF
    const buffer = await renderToBuffer(
        InsuranceReportDocument({
            owner: profile as { alias_name: string; full_name: string | null; email: string },
            horses: (horses || []) as Array<{
                id: string;
                custom_name: string;
                finish_type: string;
                condition_grade: string;
                trade_status: string | null;
                created_at: string;
                catalog_items: { title: string; maker: string; scale: string | null } | null;
                financial_vault: { purchase_price: number | null; purchase_date: string | null; estimated_current_value: number | null; insurance_notes: string | null }[];
            }>,
            thumbnailMap,
            generatedAt: new Date().toISOString(),
        })
    );

    return new NextResponse(buffer, {
        status: 200,
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="insurance_report_${new Date().toISOString().split("T")[0]}.pdf"`,
            "Cache-Control": "no-cache, no-store",
        },
    });
}
```

---

## Task 8: Create the PDF Document Component

Create `src/lib/pdf/InsuranceReport.tsx`:

Design a professional insurance report with:

### Cover Page
- "Collection Insurance Report"
- Owner name / alias
- Date generated
- Model Horse Hub logo text (no image needed)
- Total models count
- Total estimated value

### Summary Page
- Table: Name | Reference | Condition | Purchase Price | Current Value
- Totals row at bottom

### Per-Horse Detail Pages (one per horse)
- Horse name (large)
- Reference info (mold/maker/scale)
- Condition grade
- Finish type
- Purchase price and date
- Estimated current value
- Insurance notes
- Date added to collection
- Thumbnail image (if available — use the public URL from `thumbnailMap`)

### Styling Guidelines
- Use `@react-pdf/renderer` components: `Document`, `Page`, `View`, `Text`, `Image`, `StyleSheet`
- Professional color scheme: dark header bar, clean white pages
- Consistent typography: one serif font for headings, sans-serif for body
- Page numbers on every page
- "Generated by Model Horse Hub" footer on every page

---

## Task 9: Add the "Download Report" Button to Settings

In `src/app/settings/page.tsx`, add a new section between Notifications and Danger Zone:

```tsx
{/* ═══ Data & Reports ═══ */}
<div className={styles.section}>
    <h2 className={styles.sectionTitle}>📊 Data & Reports</h2>
    <div className={styles.card}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            {/* CSV Export (already exists at /api/export) */}
            <div>
                <a href="/api/export" className="btn btn-ghost" download>
                    📄 Download Collection (CSV)
                </a>
                <p className="form-hint" style={{ marginTop: 4 }}>
                    Spreadsheet format — compatible with Excel, Google Sheets.
                </p>
            </div>
            
            {/* Insurance PDF */}
            <div>
                <a href="/api/insurance-report" className="btn btn-primary" download>
                    🛡️ Download Insurance Report (PDF)
                </a>
                <p className="form-hint" style={{ marginTop: 4 }}>
                    Professional PDF with photos and values — share with your insurance agent.
                </p>
            </div>
        </div>
    </div>
</div>
```

Also add a download link on the main dashboard (subtle, near existing export/settings links):

```tsx
<a href="/api/insurance-report" className="btn btn-ghost" download title="Download Insurance Report">
    🛡️ Insurance PDF
</a>
```

---

## Phase 3 Commit

```
git add -A && git commit -m "feat: Insurance PDF report generator — professional collection report for insurance agents"
```

---

# ═══════════════════════════════════════
# PHASE 4: Final Polish & Verification
# ═══════════════════════════════════════

## Task 10: Avatar Display Audit

**Context:** The settings page already has avatar upload. Verify avatars are displayed everywhere they should be.

Check these locations for avatar display:
1. **Settings page** — ✅ Already shows avatar
2. **Public profile** (`/profile/[alias]`) — Check if `avatar_url` is shown
3. **Comment/post authors** — Check if `UniversalFeed` shows avatars
4. **Inbox conversation headers** — Check if avatars appear
5. **Navigation header** — Check if user avatar replaces the generic icon

For each location where avatar is NOT displayed:
1. Query the `avatar_url` from the `users` table join
2. Display with a fallback to the initials avatar or 🐴 emoji
3. Style as a 32px circle with `border-radius: 50%; object-fit: cover`

---

## Task 11: Clean Up Test Horses

**Context:** During debugging, several test horses were created in the production database.

Delete these from Supabase Dashboard SQL Editor:

```sql
DELETE FROM user_horses
WHERE custom_name IN ('Test Horse Bug', 'Test Horse Bug 2', 'Debug Ref Test', 'Test Fix Verify', 'AlboRef Test')
AND owner_id = (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL_HERE');
```

> **Agent note:** This is a manual step for the user. Just document it and move on.

---

## Task 12: Final Build + Push

1. Run full test suite:
   ```
   npm run test:unit
   ```

2. Verify build:
   ```
   npx next build
   ```

3. Final commit and push:
   ```
   git add -A
   git commit -m "chore: V30 Pre-Launch Sprint — modal portals, CSS cleanup, insurance PDF, avatar audit"
   git push
   ```

---

# Expected Outcomes

After this sprint:
- **0 modals** without portal pattern (down from 5)
- **1 canonical `.modal-overlay`** definition (down from 3)
- **globals.css** reduced by ~500-1000 lines via CSS module extraction
- **Insurance PDF** downloadable from Settings + Dashboard
- **Avatar display** verified across all user-facing locations
- **Build clean**, all tests passing
- **Ready for public launch** 🚀
