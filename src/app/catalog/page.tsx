import { createClient } from"@/lib/supabase/server";
import type { Metadata } from"next";
import CatalogBrowser from"@/components/CatalogBrowser";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
 title:"Reference Catalog — Model Horse Hub",
 description:
"Browse 10,500+ model horse reference entries. Search by name, maker, mold, color, and scale. Community-maintained catalog for Breyer, Stone, and Artist Resins.",
};


export default async function ReferencePage() {
 const supabase = await createClient();

 // Fetch initial page of catalog items
 const { data: items, count } = await supabase
 .from("catalog_items")
 .select("*", { count:"exact" })
 .order("title", { ascending: true })
 .range(0, 49);

 // Distinct maker/scale facets in one round-trip (get_catalog_facets,
 // migration 125) instead of two full-table scans of ~10.5k rows each.
 const { data: facetData } = await supabase.rpc("get_catalog_facets");
 const facets = (facetData ?? {}) as { makers?: string[]; scales?: string[] };
 const makers = facets.makers ?? [];
 const scales = facets.scales ?? [];

 // Fetch top curators
 const { data: curators } = await supabase
 .from("users")
 .select("id, alias_name, avatar_url, approved_suggestions_count")
 .gt("approved_suggestions_count", 0)
 .order("approved_suggestions_count", { ascending: false })
 .limit(5);

 // Get pending suggestion count
 const { count: pendingSuggestions } = await supabase
 .from("catalog_suggestions")
 .select("id", { count:"exact", head: true })
 .eq("status","pending");

 // Get recent changelog count (last 7 days)
 const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
 const { count: recentChanges } = await supabase
 .from("catalog_changelog")
 .select("id", { count:"exact", head: true })
 .gte("created_at", weekAgo);

 return (
 <ExplorerLayout
  title={<>📚 <span className="text-forest">Reference Catalog</span></>}
  description={`${(count ?? 0).toLocaleString()}+ model horse entries, maintained by the community`}
 >
  {/* Stats */}
  <div className="mt-2 mb-8 flex flex-wrap items-center justify-center gap-8">
  <div className="flex flex-col items-center">
   <span className="text-3xl font-bold text-foreground">{(count ?? 0).toLocaleString()}</span>
   <span className="text-sm text-secondary-foreground">Catalog Entries</span>
  </div>
  <div className="flex flex-col items-center">
   <span className="text-3xl font-bold text-foreground">{pendingSuggestions ?? 0}</span>
   <span className="text-sm text-secondary-foreground">Pending Suggestions</span>
  </div>
  <div className="flex flex-col items-center">
   <span className="text-3xl font-bold text-foreground">{recentChanges ?? 0}</span>
   <span className="text-sm text-secondary-foreground">Changes This Week</span>
  </div>
  </div>

  <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px]">
  {/* Main Content */}
  <div className="space-y-6">
   <CatalogBrowser
   initialItems={(items ?? []) as CatalogItemRow[]}
   totalCount={count ?? 0}
   makers={makers}
   scales={scales}
   />
  </div>

  {/* Sidebar */}
  <aside className="flex flex-col gap-4">
   {/* Quick Links */}
   <div className="flex flex-col gap-3 rounded-lg border border-input bg-card p-5 shadow-sm">
   <h3 className="text-sm font-bold uppercase tracking-wider text-secondary-foreground">📋 Community</h3>
   <div className="flex flex-col gap-2">
    <Button asChild variant="outline"><a
    href="/catalog/suggestions"
    >
    View Suggestions
    {(pendingSuggestions ?? 0) > 0 && (
     <span className="bg-forest rounded-[10px] px-[6px] py-[2px] text-[0.7rem] font-bold text-white">
     {pendingSuggestions}
     </span>
    )}
    </a></Button>
    <Button asChild><a
    href="/catalog/suggestions/new"
    >
    📗 Suggest New Entry
    </a></Button>
    <Button asChild variant="outline"><a
    href="/catalog/changelog"
    >
    📋 View Changelog
    </a></Button>
   </div>
   </div>

   {/* Top Curators */}
   {(curators ?? []).length > 0 && (
   <div className="flex flex-col gap-3 rounded-lg border border-input bg-card p-5 shadow-sm">
    <h3 className="text-sm font-bold uppercase tracking-wider text-secondary-foreground">🏆 Top Curators</h3>
    <ul className="m-0 flex flex-col list-none p-0">
    {(
     curators as {
     id: string;
     alias_name: string;
     avatar_url: string | null;
     approved_suggestions_count: number;
     }[]
    ).map((curator, i) => (
     <li key={curator.id} className="flex items-center gap-2 border-b border-input py-2.5 last:border-b-0">
     <span className="min-w-[24px] text-center">
      {i === 0 ?"🥇" : i === 1 ?"🥈" : i === 2 ?"🥉" : `#${i + 1}`}
     </span>
     <a
      href={`/profile/${curator.alias_name}`}
      className="text-forest text-sm font-semibold"
     >
      @{curator.alias_name}
     </a>
     <span className="text-muted-foreground ml-auto text-xs">
      {curator.approved_suggestions_count} contributions
     </span>
     </li>
    ))}
    </ul>
   </div>
   )}
  </aside>
  </div>
 </ExplorerLayout>
 );
}

// Type for catalog items passed to client component
interface CatalogItemRow {
 id: string;
 item_type: string;
 parent_id: string | null;
 title: string;
 maker: string;
 scale: string | null;
 attributes: Record<string, unknown>;
 created_at: string;
}
