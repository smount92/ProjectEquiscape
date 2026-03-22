import { createClient } from"@/lib/supabase/server";
import { notFound } from"next/navigation";
import type { Metadata } from"next";
import SuggestEditModal from"@/components/SuggestEditModal";
import Link from"next/link";

interface Props {
 params: Promise<{ id: string }>;
 searchParams: Promise<{ suggest?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
 const { id } = await params;
 const supabase = await createClient();
 const { data } = await supabase.from("catalog_items").select("title, maker").eq("id", id).single();

 if (!data) return { title:"Entry Not Found — Model Horse Hub" };
 const d = data as { title: string; maker: string };
 return {
 title: `${d.title} by ${d.maker} — Reference Catalog — Model Horse Hub`,
 description: `View details for ${d.title} by ${d.maker} in the Model Horse Hub reference catalog.`,
 };
}

export const dynamic ="force-dynamic";

export default async function CatalogItemPage({ params, searchParams }: Props) {
 const { id } = await params;
 const { suggest } = await searchParams;
 const supabase = await createClient();

 const { data: item, error } = await supabase.from("catalog_items").select("*").eq("id", id).single();

 if (error || !item) notFound();

 const catalogItem = item as {
 id: string;
 item_type: string;
 parent_id: string | null;
 title: string;
 maker: string;
 scale: string | null;
 attributes: Record<string, unknown>;
 created_at: string;
 };

 // Get pending suggestions for this item
 const { data: suggestions, count: suggestionCount } = await supabase
 .from("catalog_suggestions")
 .select("id, suggestion_type, status, upvotes, created_at", {
 count:"exact",
 })
 .eq("catalog_item_id", id)
 .in("status", ["pending","under_review"])
 .order("created_at", { ascending: false })
 .limit(5);

 // Check auth for suggest button
 const {
 data: { user },
 } = await supabase.auth.getUser();

 // Extract attributes for display
 const attrs = catalogItem.attributes ?? {};
 const displayFields = [
 { label:"Title", value: catalogItem.title },
 { label:"Maker", value: catalogItem.maker },
 { label:"Type", value: formatItemType(catalogItem.item_type) },
 { label:"Scale", value: catalogItem.scale ??"—" },
 ...(typeof attrs ==="object"
 ? Object.entries(attrs)
 .filter(([, v]) => v != null && v !=="")
 .map(([k, v]) => ({
 label: formatLabel(k),
 value: String(v),
 }))
 : []),
 ];

 return (
 <div className="mx-auto max-w-[var(--max-width)] px-6 py-8">
 {/* Breadcrumb */}
 <nav className="text-muted mb-6 flex items-center gap-1 text-sm">
 <Link href="/catalog">📚 Reference Catalog</Link>
 <span className="text-muted mb-6-sep flex items-center gap-1 text-sm">
 ›
 </span>
 <span>{catalogItem.title}</span>
 </nav>

 <div className="flex flex-col gap-6">
 {/* Main Card */}
 <div className="bg-card border-edge animate-fade-in-up rounded-lg border p-6 shadow-md transition-all">
 <div className="mb-6 flex items-start justify-between">
 <div>
 <h1 className="m-0 font-sans text-2xl">{catalogItem.title}</h1>
 <p className="text-muted mt-[4px] text-base">
 by {catalogItem.maker}
 </p>
 </div>
 <span className="bg-glass border-edge rounded-lg border px-[12px] py-[4px] text-sm whitespace-nowrap">
 {formatItemType(catalogItem.item_type)}
 </span>
 </div>

 <div className="grid-cols-[repeat(auto-fill,minmax(200px,1fr))] mb-6 grid gap-4">
 {displayFields.map((field) => (
 <div key={field.label} className="flex flex-col gap-[2px]">
 <span className="text-muted text-xs font-semibold tracking-[0.05em] uppercase">
 {field.label}
 </span>
 <span className="text-base font-medium">
 {field.value}
 </span>
 </div>
 ))}
 </div>

 {/* Action Buttons */}
 <div className="flex gap-2">
 {user ? (
 <SuggestEditModal catalogItem={catalogItem} openOnMount={suggest ==="true"} />
 ) : (
 <Link
 href="/login"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 >
 Log in to Suggest Edit
 </Link>
 )}
 </div>
 </div>

 {/* Pending Suggestions */}
 {(suggestionCount ?? 0) > 0 && (
 <div className="bg-card border-edge rounded-lg border p-4 shadow-md transition-all">
 <h3>📝 Pending Suggestions ({suggestionCount})</h3>
 <ul className="my-2 list-none p-0">
 {(
 suggestions as {
 id: string;
 suggestion_type: string;
 status: string;
 upvotes: number;
 created_at: string;
 }[]
 )?.map((s) => (
 <li
 key={s.id}
 className="flex items-center gap-2 px-0 py-1 text-[var(--color-text)] no-underline"
 >
 <Link href={`/catalog/suggestions/${s.id}`}>
 <span className="text-xs font-semibold uppercase text-forest">
 {s.suggestion_type ==="correction"
 ?"🔧"
 : s.suggestion_type ==="addition"
 ?"📗"
 : s.suggestion_type ==="photo"
 ?"📸"
 :"🗑"}
 </span>
 <span>{formatItemType(s.suggestion_type)} suggestion</span>
 <span className="text-muted ml-auto text-sm">
 ▲ {s.upvotes}
 </span>
 </Link>
 </li>
 ))}
 </ul>
 <Link
 href={`/catalog/suggestions?item=${id}`}
 className="text-forest text-sm"
 >
 View all suggestions →
 </Link>
 </div>
 )}
 </div>
 </div>
 );
}

function formatItemType(type: string): string {
 return type.replace(/_/g,"").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatLabel(key: string): string {
 return key.replace(/_/g,"").replace(/\b\w/g, (c) => c.toUpperCase());
}
