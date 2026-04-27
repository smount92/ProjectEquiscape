import { createClient } from"@/lib/supabase/server";
import type { Metadata } from"next";
import CatalogBrowser from"@/components/CatalogBrowser";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";

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

 // Fetch unique makers for filter chips
 const { data: makerRows } = await supabase.from("catalog_items").select("maker").not("maker","is", null);

 const makers = [
 ...new Set((makerRows ?? []).map((r: { maker: string }) => r.maker).filter(Boolean)),
 ].sort() as string[];

 // Fetch unique scales
 const { data: scaleRows } = await supabase.from("catalog_items").select("scale").not("scale","is", null);

 const scales = [
 ...new Set((scaleRows ?? []).map((r: { scale: string | null }) => r.scale).filter(Boolean)),
 ].sort() as string[];

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
    <a
    href="/catalog/suggestions"
    className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
    >
    View Suggestions
    {(pendingSuggestions ?? 0) > 0 && (
     <span className="bg-forest rounded-[10px] px-[6px] py-[2px] text-[0.7rem] font-bold text-white">
     {pendingSuggestions}
     </span>
    )}
    </a>
    <a
    href="/catalog/suggestions/new"
    className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
    >
    📗 Suggest New Entry
    </a>
    <a
    href="/catalog/changelog"
    className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
    >
    📋 View Changelog
    </a>
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
