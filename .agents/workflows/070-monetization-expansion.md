---
description: Monetization Expansion — eBay affiliate engine, printable show tags PDF (Pro-gated)
---

# Monetization Expansion (Affiliates, Printables, Premium Shows)

> **Constraint:** Passive monetization only — no payment processing for these features. eBay uses EPN affiliate links (commission-based). Printable Show Tags are gated behind Pro tier.
> **Last Updated:** 2026-03-29
> **Status:** ✅ COMPLETE (2026-03-29)
> **Commit:** `80313ba`
> **Prerequisite:** Pro tier system must be functional (user has `app_metadata.tier`)
> **Env Var Required:** `NEXT_PUBLIC_EBAY_CAMPAIGN_ID` — set from EPN Dashboard for affiliate revenue tracking
> **Current State:** eBay affiliate links live on catalog detail pages. Show Tags PDF at `/api/export/show-tags?showId=X` (Pro-gated).

// turbo-all

---

# ═══════════════════════════════════════
# FEATURE 1: eBay Affiliate Engine
# ═══════════════════════════════════════

## Step 1.1 — Add EPN Campaign ID to environment

**Target File:** `.env.local` (add — DO NOT commit)

```
NEXT_PUBLIC_EBAY_CAMPAIGN_ID=your-epn-campaign-id
```

**Target File:** `docs/guides/deployment.md` — add to env var table:

| Variable | Purpose | Source |
|----------|---------|--------|
| `NEXT_PUBLIC_EBAY_CAMPAIGN_ID` | eBay Partner Network affiliate tracking | EPN Dashboard → Campaign Management |

## Step 1.2 — Create eBay search URL builder

**Target File:** `src/lib/utils/ebayAffiliate.ts` (NEW FILE)

```ts
/**
 * Construct an eBay affiliate search URL for a catalog reference entry.
 * Uses the eBay Partner Network (EPN) "rover" redirect format.
 *
 * @param moldName - e.g. "Alborozo"
 * @param manufacturer - e.g. "Breyer"
 * @param moldNumber - e.g. "712053"
 */
export function buildEbaySearchUrl(
    moldName: string,
    manufacturer?: string | null,
    moldNumber?: string | null
): string {
    const campaignId = process.env.NEXT_PUBLIC_EBAY_CAMPAIGN_ID;

    // Build a smart search query
    const parts: string[] = [];
    if (manufacturer) parts.push(manufacturer);
    parts.push(moldName);
    if (moldNumber) parts.push(`#${moldNumber}`);
    // Add "model horse" to narrow results
    parts.push("model horse");

    const query = encodeURIComponent(parts.join(" "));

    // eBay Partner Network redirect URL format
    // This tracks the click-through and awards commission on purchase
    if (campaignId) {
        return `https://www.ebay.com/sch/i.html?_nkw=${query}&mkcid=1&mkrid=711-53200-19255-0&siteid=0&campid=${campaignId}&toolid=10001&mkevt=1`;
    }

    // Fallback: direct eBay search (no affiliate tracking)
    return `https://www.ebay.com/sch/i.html?_nkw=${query}&_sacat=417`;
}
```

## Step 1.3 — Add "Find on eBay" button to catalog detail page

**Target File:** `src/app/catalog/[id]/page.tsx`

Import the utility and render a CTA button in the detail view:

```tsx
import { buildEbaySearchUrl } from "@/lib/utils/ebayAffiliate";

// In the component, after loading the reference entry:
const ebayUrl = buildEbaySearchUrl(
    entry.mold_name,
    entry.manufacturer,
    entry.mold_number
);

// In the JSX, add alongside other action buttons:
<a
    href={ebayUrl}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100"
>
    🔎 Find on eBay
    <span className="text-xs text-blue-400">↗</span>
</a>
```

## Step 1.4 — Add "Find on eBay" to individual horse pages

**Target File:** `src/app/stable/[id]/page.tsx`

If the horse has a `catalog_entry_id` (linked to a reference entry), show the same button:

```tsx
{horse.catalog_entry && (
    <a
        href={buildEbaySearchUrl(
            horse.catalog_entry.mold_name,
            horse.catalog_entry.manufacturer,
            horse.catalog_entry.mold_number
        )}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100"
    >
        🔎 Find on eBay
    </a>
)}
```

## Verify Feature 1

```
cmd /c "npx next build 2>&1 | findstr /C:error /C:Error /C:compiled"
```

Check that:
- [ ] eBay search URL includes campaign ID when env var is set
- [ ] Falls back to direct search when env var is missing
- [ ] Button renders on catalog detail page
- [ ] Button renders on horse detail page (when catalog entry is linked)
- [ ] Link opens in new tab with `noopener noreferrer`
- [ ] Build passes

---

# ═══════════════════════════════════════
# FEATURE 2: Printable Show Tags (Pro-Gated)
# ═══════════════════════════════════════

## Step 2.1 — Create the ShowTags PDF component

**Target File:** `src/components/pdf/ShowTags.tsx` (NEW FILE)

Uses `@react-pdf/renderer` to generate an 8.5×11" sheet of cut-out show tags.

```tsx
import { Document, Page, View, Text, StyleSheet, Font } from "@react-pdf/renderer";

// Register Inter for consistency with the app
Font.register({
    family: "Inter",
    src: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2",
});

const styles = StyleSheet.create({
    page: {
        padding: 36, // 0.5" margins
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
    },
    tag: {
        width: "48%",
        height: 120,
        border: "1pt dashed #D4C9B0",
        borderRadius: 6,
        padding: 8,
        justifyContent: "space-between",
    },
    horseName: {
        fontFamily: "Inter",
        fontSize: 11,
        fontWeight: 700,
    },
    moldName: {
        fontFamily: "Inter",
        fontSize: 9,
        color: "#594A3C",
    },
    showInfo: {
        fontFamily: "Inter",
        fontSize: 8,
        color: "#7A6A58",
    },
    classLabel: {
        fontFamily: "Inter",
        fontSize: 10,
        fontWeight: 600,
        color: "#2C5545",
    },
    entryNumber: {
        fontFamily: "Inter",
        fontSize: 14,
        fontWeight: 700,
        textAlign: "right",
    },
});

interface ShowTagEntry {
    horseName: string;
    moldName: string;
    className: string;
    entryNumber: number;
    ownerAlias: string;
}

interface ShowTagsProps {
    showName: string;
    showDate: string;
    entries: ShowTagEntry[];
}

export default function ShowTags({ showName, showDate, entries }: ShowTagsProps) {
    return (
        <Document>
            <Page size="LETTER" style={styles.page}>
                {entries.map((entry, i) => (
                    <View key={i} style={styles.tag}>
                        <View>
                            <Text style={styles.horseName}>{entry.horseName}</Text>
                            <Text style={styles.moldName}>{entry.moldName}</Text>
                            <Text style={styles.classLabel}>{entry.className}</Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
                            <View>
                                <Text style={styles.showInfo}>{showName}</Text>
                                <Text style={styles.showInfo}>{showDate} · @{entry.ownerAlias}</Text>
                            </View>
                            <Text style={styles.entryNumber}>#{entry.entryNumber}</Text>
                        </View>
                    </View>
                ))}
            </Page>
        </Document>
    );
}
```

## Step 2.2 — Create the API route to serve the PDF

**Target File:** `src/app/api/export/show-tags/route.ts` (NEW FILE)

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserTier } from "@/lib/auth";
import { renderToBuffer } from "@react-pdf/renderer";
import ShowTags from "@/components/pdf/ShowTags";

export async function GET(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Pro-gate
    const tier = await getUserTier();
    if (tier === "free") {
        return NextResponse.json(
            { error: "Show Tags are a Pro feature. Upgrade to MHH Pro to print show tags." },
            { status: 403 }
        );
    }

    const { searchParams } = new URL(request.url);
    const showId = searchParams.get("showId");
    if (!showId) {
        return NextResponse.json({ error: "Missing showId" }, { status: 400 });
    }

    // Fetch show + entries
    const { data: show } = await supabase
        .from("shows")
        .select("name, show_date")
        .eq("id", showId)
        .single();

    if (!show) {
        return NextResponse.json({ error: "Show not found" }, { status: 404 });
    }

    const { data: entries } = await supabase
        .from("event_entries")
        .select(`
            id,
            entry_number,
            user_horses!inner(custom_name, catalog_entries(mold_name)),
            event_classes!inner(class_name),
            profiles!inner(alias_name)
        `)
        .eq("show_id", showId)
        .order("entry_number", { ascending: true });

    // Transform to PDF props
    const tagEntries = (entries || []).map((e: any) => ({
        horseName: e.user_horses?.custom_name || "Unknown",
        moldName: e.user_horses?.catalog_entries?.mold_name || "",
        className: e.event_classes?.class_name || "",
        entryNumber: e.entry_number,
        ownerAlias: e.profiles?.alias_name || "Anonymous",
    }));

    const buffer = await renderToBuffer(
        ShowTags({
            showName: show.name,
            showDate: new Date(show.show_date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
            }),
            entries: tagEntries,
        })
    );

    return new NextResponse(buffer, {
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="show-tags-${showId}.pdf"`,
        },
    });
}
```

## Step 2.3 — Add "Print Show Tags" button to show detail page

**Target File:** `src/app/shows/[id]/page.tsx`

Add a Pro-gated button in the show management/detail area:

```tsx
{userTier !== "free" ? (
    <a
        href={`/api/export/show-tags?showId=${show.id}`}
        target="_blank"
        className="btn btn-secondary"
    >
        🏷️ Print Show Tags (PDF)
    </a>
) : (
    <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
        🏷️ Show Tags are a <a href="/upgrade" className="font-semibold underline">Pro feature</a>
    </div>
)}
```

## Verify Feature 2

```
cmd /c "npx next build 2>&1 | findstr /C:error /C:Error /C:compiled"
```

```
cmd /c "npx vitest run 2>&1"
```

Check that:
- [ ] `/api/export/show-tags?showId=X` returns a PDF for Pro users
- [ ] Free users get a 403 with upgrade message
- [ ] PDF renders 2-column grid of cut-out show tags
- [ ] Button appears on show detail page
- [ ] Build passes
- [ ] All tests pass

---

## Commit

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "feat: monetization expansion — eBay affiliate engine, printable show tags PDF (Pro-gated)"
```
