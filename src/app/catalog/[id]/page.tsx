import { createClient } from"@/lib/supabase/server";
import { notFound } from"next/navigation";
import type { Metadata } from"next";
import SuggestEditModal from"@/components/SuggestEditModal";
import Link from"next/link";
import FocusLayout from"@/components/layouts/FocusLayout";
import CatalogSubMasthead from"@/components/catalog/CatalogSubMasthead";
import { buildEbaySearchUrl } from"@/lib/utils/ebayAffiliate";
import { Button } from "@/components/ui/button";
import { referenceHref } from"@/lib/catalog/referenceUrl";
import { CATEGORY_LABELS } from"@/lib/catalog/taxonomy";
import { FileEdit, Plus } from"lucide-react";

interface Props {
 params: Promise<{ id: string }>;
 searchParams: Promise<{ suggest?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
 const { id } = await params;
 const supabase = await createClient();
 const { data } = await supabase.from("catalog_items").select("title, maker, maker_slug, slug").eq("id", id).single();

 if (!data) return { title:"Entry Not Found" };
 const d = data as { title: string; maker: string; maker_slug: string | null; slug: string | null };
 // Reference pages are the canonical public view — point this (now
 // edit-only) page's canonical there so Google consolidates the
 // duplicate onto /reference instead of splitting signal.
 const canonicalRef = `${process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com"}${referenceHref({ id, maker: d.maker, title: d.title, maker_slug: d.maker_slug, slug: d.slug })}`;
 return {
 title: `${d.title} by ${d.maker} — Reference Catalog`,
 description: `View details for ${d.title} by ${d.maker} in the Model Horse Hub reference catalog.`,
 alternates: { canonical: canonicalRef },
 };
}


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

 const { data: suggestions, count: suggestionCount } = await supabase
 .from("catalog_suggestions")
 .select("id, suggestion_type, status, upvotes, created_at", {
  count:"exact",
 })
 .eq("catalog_item_id", id)
 .in("status", ["pending","under_review"])
 .order("created_at", { ascending: false })
 .limit(5);

 const {
 data: { user },
 } = await supabase.auth.getUser();

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
   value: formatAttrValue(k, v),
  }))
  : []),
 ];

 return (
 <FocusLayout noHeader>
  <CatalogSubMasthead
   icon="🐴"
   title={catalogItem.title}
   subtitle={<>by {catalogItem.maker}</>}
  />
  <div className="flex flex-col gap-6">
  {/* Main Card */}
  <div className="bg-card border-input rounded-lg border p-6 shadow-md transition-all">
   <div className="mb-6 flex items-start justify-between">
   <div>
    <h2 className="m-0 font-serif text-3xl font-bold text-foreground">{catalogItem.title}</h2>
    <p className="text-secondary-foreground mt-[4px] text-base font-bold text-foreground my-1 font-sans">
    by {catalogItem.maker}
    </p>
   </div>
   <span className="bg-muted border-input rounded-lg border px-[12px] py-[4px] text-sm whitespace-nowrap">
    {formatItemType(catalogItem.item_type)}
   </span>
   </div>

   <div className="grid-cols-[repeat(auto-fill,minmax(200px,1fr))] mb-6 grid gap-4">
   {displayFields.map((field) => (
    <div key={field.label} className="flex flex-col gap-[2px]">
    <span className="text-muted-foreground text-xs font-semibold tracking-[0.05em] uppercase">
     {field.label}
    </span>
    <span className="text-base font-bold text-foreground my-1">
     {field.value}
    </span>
    </div>
   ))}
   </div>

   {/* Action Buttons */}
   <div className="flex flex-wrap gap-2">
   <Button asChild>
    <Link href={`/add-horse?catalog=${id}`}>
    <Plus className="h-4 w-4" /> Add to My Stable
    </Link>
   </Button>
   {user ? (
    <SuggestEditModal catalogItem={catalogItem} openOnMount={suggest ==="true"} />
   ) : (
    <Button asChild><Link
    href={`/login?redirectTo=${encodeURIComponent(`/catalog/${id}?suggest=true`)}`}
    >
    Log in to Suggest Edit
    </Link></Button>
   )}
   <a
    href={buildEbaySearchUrl(catalogItem.title, catalogItem.maker, (attrs as Record<string, string>).item_number ?? null)}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-info/30 bg-info/10 px-4 py-1 text-sm font-semibold text-info no-underline shadow-sm transition-colors hover:bg-info/20"
   >
    🔎 Find on eBay <span className="text-xs text-info/70">↗</span>
   </a>
   </div>
  </div>

  {/* Pending Suggestions */}
  {(suggestionCount ?? 0) > 0 && (
   <div className="bg-card border-input rounded-lg border p-4 shadow-md transition-all">
   <h3 className="flex items-center gap-2"><FileEdit className="h-5 w-5" /> Pending Suggestions ({suggestionCount})</h3>
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
     className="flex items-center gap-2 px-0 py-1 text-foreground no-underline"
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
     <span>{titleCase(s.suggestion_type)} suggestion</span>
     <span className="text-muted-foreground ml-auto text-sm">
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
 </FocusLayout>
 );
}

/* Item type has a display name in the taxonomy; use it. Title-casing the
   raw enum instead printed "Plastic Mold" on North Light resins, directly
   above a Material of Resin — a contradiction the row did not actually
   contain. The stored values say `plastic_mold` for historical reasons but
   the category has always meant simply "a mold", which is why the label is
   "Mold". */
function formatItemType(type: string): string {
 return CATEGORY_LABELS[type] ?? titleCase(type);
}

/* Suggestion types (correction / addition / photo) have no taxonomy entry
   and read correctly title-cased. */
function titleCase(value: string): string {
 return value.replace(/_/g," ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* Attribute-key labels. Keys where generic Title Case reads wrong get a
   name here — kept in step with fmtLabel/fmtAttrValue on the reference
   page, which is the canonical public view of the same attributes. */
function formatLabel(key: string): string {
 if (key ==="retail_price") return"Original retail";
 if (key ==="run_type") return"Run";
 if (key ==="run_count") return"Pieces made";
 return key.replace(/_/g," ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatAttrValue(key: string, v: unknown): string {
 if (key ==="retail_price") {
  const n = Number(v);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : String(v);
 }
 if (key ==="run_count") {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n.toLocaleString("en-US") : String(v);
 }
 return String(v);
}
