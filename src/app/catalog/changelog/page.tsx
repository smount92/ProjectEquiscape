import { createClient } from"@/lib/supabase/server";
import Link from"next/link";
import type { Metadata } from"next";

export const metadata: Metadata = {
 title:"Catalog Changelog — Model Horse Hub",
 description:
"See recent community updates to the Model Horse Hub reference catalog. Corrections, additions, and photo submissions.",
};


export default async function ChangelogPage() {
 const supabase = await createClient();

 const { data: entries, count } = await supabase
 .from("catalog_changelog")
 .select("*", { count:"exact" })
 .order("created_at", { ascending: false })
 .limit(50);

 return (
 <div className="mx-auto max-w-[var(--max-width)] px-6 py-8">
 <nav className="text-muted mb-6 flex items-center gap-1 text-sm">
 <Link href="/catalog">📚 Reference Catalog</Link>
 <span className="text-muted mb-6-sep flex items-center gap-1 text-sm">
 ›
 </span>
 <span>Changelog</span>
 </nav>

 <h1 className="mb-1 font-sans text-2xl">
 📋 <span className="text-forest">Catalog Changelog</span>
 </h1>
 <p className="text-muted mb-6">
 Community-approved updates to the reference catalog. {count ?? 0} total changes.
 </p>

 <div className="flex flex-col gap-0">
 {(entries ?? [])?.map((entry) => {
 const timeAgo = getTimeAgo(entry.created_at);

 return (
 <div key={entry.id} className="border-edge flex gap-4 border-b px-0 py-4">
 <span className="min-w-[28px] text-[1.3rem]">
 {entry.change_type ==="correction"
 ?"🔧"
 : entry.change_type ==="addition"
 ?"📗"
 : entry.change_type ==="photo"
 ?"📸"
 :"🗑"}
 </span>
 <div className="space-y-4">
 <p className="mb-[4px] text-sm font-medium">
 {entry.change_summary}
 </p>
 <p className="text-forest">
 Contributed by{""}
 <Link
 href={`/profile/${entry.contributor_alias}`}
 className="text-forest font-semibold"
 >
 @{entry.contributor_alias}
 </Link>
 {" ·"}
 {timeAgo}
 {entry.catalog_item_id && (
 <>
 {" ·"}
 <Link href={`/catalog/${entry.catalog_item_id}`}>View entry →</Link>
 </>
 )}
 </p>
 </div>
 </div>
 );
 })}

 {(entries ?? []).length === 0 && (
 <div className="bg-card border-edge text-muted rounded-lg border p-8 text-center shadow-md transition-all">
 <p>No changes yet. The catalog awaits your contributions!</p>
 <Link
 href="/catalog"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 >
 Browse Catalog
 </Link>
 </div>
 )}
 </div>
 </div>
 );
}

function getTimeAgo(dateStr: string): string {
 const diff = Date.now() - new Date(dateStr).getTime();
 const mins = Math.floor(diff / 60000);
 if (mins < 60) return `${mins}m ago`;
 const hours = Math.floor(mins / 60);
 if (hours < 24) return `${hours}h ago`;
 const days = Math.floor(hours / 24);
 if (days < 30) return `${days}d ago`;
 return new Date(dateStr).toLocaleDateString();
}
