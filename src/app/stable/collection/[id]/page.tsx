import { createClient } from"@/lib/supabase/server";
import { redirect, notFound } from"next/navigation";
import Link from"next/link";
import CollectionManager from"@/components/CollectionManager";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";
import { Button } from "@/components/ui/button";
import CollectionBrowser from"@/components/stable/CollectionBrowser";
import { getStablePage, getStableSummary } from"@/app/actions/stable";


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

 const [pageResult, summaryResult] = await Promise.all([
  getStablePage({ collection: collectionId }),
  getStableSummary(),
 ]);
 const cards = pageResult.success ? pageResult.cards : [];
 const totalCount = pageResult.success ? pageResult.totalCount : 0;
 const hasMore = pageResult.success ? pageResult.hasMore : false;
 const colStats = summaryResult.success
  ? summaryResult.summary.collections.find((c) => c.id === collectionId)
  : undefined;
 const collectionVaultValue = colStats?.value ?? 0;
 const avgValue = totalCount > 0 && collectionVaultValue > 0 ? collectionVaultValue / totalCount : 0;

 return (
 <ExplorerLayout
  title={<>📁 {collection.name}</>}
  description={collection.description || undefined}
 >
  {/* Breadcrumb */}
  <nav className="text-secondary-foreground animate-fade-in-up mb-6 flex items-center gap-2 text-sm" aria-label="Breadcrumb">
  <Link href="/dashboard">Digital Stable</Link>
  <span className="separator" aria-hidden="true">
   /
  </span>
  <span>📁 {collection.name}</span>
  </nav>

  {/* Collection Header */}
  <div className="collection-hero animate-fade-in-up max-sm:flex-col max-sm:p-6 max-sm:text-center">
  <div className="shrink-0 text-[2.5rem]">📁</div>
  <div className="text-foreground mb-1 text-2xl font-bold">
   <span className="text-muted-foreground text-sm">
   {totalCount} model{totalCount !== 1 ?"" :"s"} in this collection
   </span>
   <div className="mt-2">
   <CollectionManager collection={collection} />
   </div>
  </div>
  </div>

  {/* 🔒 Collection Stats — PRIVATE analytics */}
  {totalCount > 0 && (
  <div className="grid-cols-1 sm:grid-cols-3 animate-fade-in-up mb-8 grid gap-4">
   <div className="bg-card border-input relative flex flex-col items-center gap-1 overflow-hidden rounded-lg border px-4 py-6 text-center shadow-md transition-all">
   <div className="text-2xl leading-none">🐴</div>
   <div className="analytics-value max-[400px]:text-xl">{totalCount}</div>
   <div className="text-muted-foreground text-xs font-medium tracking-[0.05em] uppercase">Models</div>
   </div>
   <div className="bg-card border-input relative flex flex-col items-center gap-1 overflow-hidden rounded-lg border px-4 py-6 text-center shadow-md transition-all">
   <div className="text-2xl leading-none">💰</div>
   <div className="analytics-value max-[400px]:text-xl">
    {collectionVaultValue > 0
    ? `$${collectionVaultValue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    :"—"}
   </div>
   <div className="text-muted-foreground text-xs font-medium tracking-[0.05em] uppercase">
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
   <div className="text-muted-foreground text-xs font-medium tracking-[0.05em] uppercase">Avg. Value</div>
   </div>
  </div>
  )}

  {/* Grid — shared StableHorseCard + Show More */}
  {totalCount === 0 ? (
  <div className="bg-card border-input animate-fade-in-up rounded-lg border px-8 py-12 text-center shadow-md transition-all">
   <div className="mb-4 text-5xl">📂</div>
   <h2>This collection is empty</h2>
   <p>
   Add models to this collection from the &quot;Add to Stable&quot; form or by editing an existing
   model.
   </p>
   <Button asChild><Link
   href="/add-horse"
   >
   🐴 Add to Stable
   </Link></Button>
  </div>
  ) : (
  <CollectionBrowser
   collectionId={collectionId}
   initialCards={cards}
   totalCount={totalCount}
   initialHasMore={hasMore}
  />
  )}
 </ExplorerLayout>
 );
}
