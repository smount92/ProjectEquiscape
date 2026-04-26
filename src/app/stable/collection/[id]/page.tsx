import { createClient } from"@/lib/supabase/server";
import { redirect, notFound } from"next/navigation";
import Link from"next/link";
import { getPublicImageUrls } from"@/lib/utils/storage";
import CollectionManager from"@/components/CollectionManager";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";



function getFinishBadgeClass(finishType: string): string {
 switch (finishType) {
 case"OF":
 return"of";
 case"Custom":
 return"custom";
 case"Artist Resin":
 return"resin";
 default:
 return"";
 }
}

function formatDate(dateStr: string): string {
 return new Date(dateStr).toLocaleDateString("en-US", {
 month:"short",
 day:"numeric",
 year:"numeric",
 });
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
 const { id } = await params;
 const supabase = await createClient();
 const { data } = await supabase.from("user_collections").select("name").eq("id", id).single<{ name: string }>();

 return {
 title: data ? `${data.name} — Digital Stable` :"Collection Not Found",
 description: data ? `View models in the"${data.name}" collection.` :"Collection not found.",
 };
}

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
 const { id: collectionId } = await params;
 const supabase = await createClient();

 const {
 data: { user },
 } = await supabase.auth.getUser();

 if (!user) {
 redirect("/login");
 }

 // Fetch collection details (RLS ensures owner-only)
 const { data: collection } = await supabase
 .from("user_collections")
 .select("id, name, description, created_at")
 .eq("id", collectionId)
 .single<{ id: string; name: string; description: string | null; created_at: string }>();

 if (!collection) {
 notFound();
 }

 // Fetch horse IDs in this collection via junction table
 const { data: junctionRows } = await supabase
 .from("horse_collections")
 .select("horse_id")
 .eq("collection_id", collectionId);

 const horseIdsInCollection = (junctionRows || []).map((r) => r.horse_id);

 // Fallback: also check legacy FK for horses not yet migrated
 const { data: legacyHorses } = await supabase
 .from("user_horses")
 .select("id")
 .eq("owner_id", user.id)
 .eq("collection_id", collectionId);

 const legacyIds = (legacyHorses || []).map((h) => h.id);
 const allHorseIds = [...new Set([...horseIdsInCollection, ...legacyIds])];

 // Fetch full horse data for the resolved IDs
 const { data: rawHorses } =
 allHorseIds.length > 0
 ? await supabase
 .from("user_horses")
 .select(
  `
  id, custom_name, finish_type, condition_grade, created_at, trade_status,
  catalog_items:catalog_id(title, maker, item_type),
  horse_images(image_url, angle_profile)
  `,
 )
 .eq("owner_id", user.id)
 .in("id", allHorseIds)
 .order("created_at", { ascending: false })
 : { data: [] };

 const horses = rawHorses ?? [];

 // Generate signed URLs
 const thumbnailUrls: string[] = [];
 horses.forEach((horse) => {
 const thumb = horse.horse_images?.find((img) => img.angle_profile ==="Primary_Thumbnail");
 const first = horse.horse_images?.[0];
 const url = thumb?.image_url || first?.image_url;
 if (url) thumbnailUrls.push(url);
 });

 const signedUrlMap = getPublicImageUrls(thumbnailUrls);

 // Fetch financial vault totals for horses in this collection (owner-only via RLS)
 const horseIds = horses.map((h) => h.id);
 const { data: rawVaults } =
 horseIds.length > 0
 ? await supabase
 .from("financial_vault")
 .select("purchase_price, estimated_current_value")
 .in("horse_id", horseIds)
 : { data: [] };

 const vaults = (rawVaults as { purchase_price: number | null; estimated_current_value: number | null }[]) ?? [];

 let collectionVaultValue = 0;
 vaults.forEach((v) => {
 collectionVaultValue += v.estimated_current_value ?? v.purchase_price ?? 0;
 });

 const avgValue = horses.length > 0 && collectionVaultValue > 0 ? collectionVaultValue / horses.length : 0;

 const horseCards = horses.map((horse) => {
 const thumb = horse.horse_images?.find((img) => img.angle_profile ==="Primary_Thumbnail");
 const firstImage = horse.horse_images?.[0];
 const imageUrl = thumb?.image_url || firstImage?.image_url;
 const signedUrl = imageUrl ? signedUrlMap.get(imageUrl) : undefined;

 const refName = horse.catalog_items
 ? `${horse.catalog_items.maker} ${horse.catalog_items.title}`
 :"Unlisted Mold";

 const releaseLine = null; // Now unified in catalog_items

 return {
 id: horse.id,
 customName: horse.custom_name,
 finishType: horse.finish_type ?? "OF",
 conditionGrade: horse.condition_grade ?? "",
 createdAt: horse.created_at,
 refName,
 releaseLine,
 thumbnailUrl: signedUrl || null,
 tradeStatus: horse.trade_status ||"Not for Sale",
 };
 });

 return (
 <ExplorerLayout
  title={<>📁 {collection.name}</>}
  description={collection.description || undefined}
 >
  {/* Breadcrumb */}
  <nav className="text-stone-600 animate-fade-in-up mb-6 flex items-center gap-2 text-sm" aria-label="Breadcrumb">
  <Link href="/dashboard">Digital Stable</Link>
  <span className="separator" aria-hidden="true">
   /
  </span>
  <span>📁 {collection.name}</span>
  </nav>

  {/* Collection Header */}
  <div className="collection-hero animate-fade-in-up max-sm:flex-col max-sm:p-6 max-sm:text-center">
  <div className="shrink-0 text-[2.5rem]">📁</div>
  <div className="text-stone-900 mb-1 text-2xl font-bold">
   <span className="text-stone-500 text-sm">
   {horseCards.length} model{horseCards.length !== 1 ?"s" :""} in this collection
   </span>
   <div className="mt-2">
   <CollectionManager collection={collection} />
   </div>
  </div>
  </div>

  {/* 🔒 Collection Stats — PRIVATE analytics */}
  {horseCards.length > 0 && (
  <div className="grid-cols-[repeat(3,1fr)] animate-fade-in-up mb-8 grid gap-4">
   <div className="bg-card border-input relative flex flex-col items-center gap-1 overflow-hidden rounded-lg border px-4 py-6 text-center shadow-md transition-all">
   <div className="text-2xl leading-none">🐴</div>
   <div className="analytics-value max-[400px]:text-xl">
    {horseCards.length}
   </div>
   <div className="text-stone-500 text-xs font-medium tracking-[0.05em] uppercase">Models</div>
   </div>
   <div className="bg-card border-input relative flex flex-col items-center gap-1 overflow-hidden rounded-lg border px-4 py-6 text-center shadow-md transition-all">
   <div className="text-2xl leading-none">💰</div>
   <div className="analytics-value max-[400px]:text-xl">
    {collectionVaultValue > 0
    ? `$${collectionVaultValue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    :"—"}
   </div>
   <div className="text-stone-500 text-xs font-medium tracking-[0.05em] uppercase">
    Collection Value
   </div>
   </div>
   <div className="bg-card border-input relative flex flex-col items-center gap-1 overflow-hidden rounded-lg border px-4 py-6 text-center shadow-md transition-all">
   <div className="text-2xl leading-none">📊</div>
   <div className="analytics-value max-[400px]:text-xl">
    {avgValue > 0
    ? `$${avgValue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    :"—"}
   </div>
   <div className="text-stone-500 text-xs font-medium tracking-[0.05em] uppercase">Avg. Value</div>
   </div>
  </div>
  )}

  {/* Grid */}
  {horseCards.length === 0 ? (
  <div className="bg-card border-input animate-fade-in-up rounded-lg border px-8 py-12 text-center shadow-md transition-all">
   <div className="mb-4 text-5xl">📂</div>
   <h2>This collection is empty</h2>
   <p>
   Add models to this collection from the &quot;Add to Stable&quot; form or by editing an existing
   model.
   </p>
   <Link
   href="/add-horse"
   className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
   >
   🐴 Add to Stable
   </Link>
  </div>
  ) : (
  <div className="grid-cols-[repeat(auto-fill,minmax(280px,1fr))] animate-fade-in-up grid gap-6">
   {horseCards.map((horse) => (
   <Link
    key={horse.id}
    href={`/stable/${horse.id}`}
    className="group overflow-hidden rounded-lg border border-input bg-card shadow-md transition-all hover:shadow-lg"
    id={`collection-horse-${horse.id}`}
   >
    <div className="relative aspect-square overflow-hidden bg-muted">
    {horse.thumbnailUrl ? (
     // eslint-disable-next-line @next/next/no-img-element
     <img src={horse.thumbnailUrl} alt={horse.customName} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
    ) : (
     <div className="flex h-full flex-col items-center justify-center gap-2 text-stone-500">
     <span className="text-4xl">🐴</span>
     <span className="text-sm">No photo</span>
     </div>
    )}
    <span className={`horse-card-badge ${getFinishBadgeClass(horse.finishType)}`}>
     {horse.finishType}
    </span>
    {horse.tradeStatus ==="For Sale" && (
     <span className="trade-badge border border-emerald-500/50 bg-emerald-500/85 text-white">
     💲 For Sale
     </span>
    )}
    {horse.tradeStatus ==="Open to Offers" && (
     <span className="trade-badge border border-blue-500/50 bg-blue-500/85 text-white">
     🤝 Open to Offers
     </span>
    )}
    </div>
    <div className="px-4 py-3">
    <div className="font-semibold text-stone-900">
     {horse.customName}
    </div>
    <div className="overflow-hidden text-sm text-ellipsis whitespace-nowrap text-[var(--color-text-secondary)]">
     {horse.refName}
    </div>
    {horse.releaseLine && (
     <div className="mt-[2px] overflow-hidden text-xs text-ellipsis whitespace-nowrap text-[var(--color-text-secondary)] opacity-70">
     🎨 {horse.releaseLine}
     </div>
    )}
    <div className="border-input text-stone-500 mt-2 flex items-center justify-between border-t pt-2 text-xs">
     <span>{horse.conditionGrade}</span>
     <span>{formatDate(horse.createdAt)}</span>
    </div>
    </div>
   </Link>
   ))}
  </div>
  )}
 </ExplorerLayout>
 );
}
