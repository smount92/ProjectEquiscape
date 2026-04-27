import { createClient } from"@/lib/supabase/server";

export const dynamic = "force-dynamic";
import { redirect } from"next/navigation";
import Link from"next/link";
import { Suspense } from"react";
import { getPublicImageUrls } from"@/lib/utils/storage";
import {
 Camera,
 Trophy,
 Users,
 FileText,
 Zap,
 Plus,
 BarChart3,
 FolderOpen,
 DollarSign,
 Award,
 Mail,
} from"lucide-react";
import DashboardToast from"@/components/DashboardToast";
import DashboardShell from"@/components/DashboardShell";
import ExportButton from"@/components/ExportButton";
import InsuranceReportButton from"@/components/InsuranceReportButton";
import TransferHistorySection from"@/components/TransferHistorySection";
import NanDashboardWidget from"@/components/NanDashboardWidget";
import ShowHistoryWidget from"@/components/ShowHistoryWidget";
import { getShowHistory } from"@/app/actions/shows";
import CommandCenterLayout from"@/components/layouts/CommandCenterLayout";



const HORSES_PER_PAGE = 48;

/** Async server-side wrapper to fetch show history data */
async function ShowHistoryWidgetWrapper() {
 try {
 const data = await getShowHistory();
 if (data.totalRibbons === 0) return null;
 return <ShowHistoryWidget years={data.years} totalShows={data.totalShows} totalRibbons={data.totalRibbons} />;
 } catch {
 return null;
 }
}

/** Skeleton shown while DashboardContent loads */
function DashboardSkeleton() {
 return (
 <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px] 2xl:grid-cols-[1fr_360px]">
  {/* Main Column Skeleton — Horse Card Grid */}
  <main className="min-w-0">
   <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
    {Array.from({ length: 12 }).map((_, i) => (
     <div key={i} className="bg-card border-input animate-pulse rounded-lg border shadow-sm">
      <div className="aspect-square rounded-t-lg bg-muted" />
      <div className="space-y-2 p-3">
       <div className="h-4 w-3/4 rounded bg-muted" />
       <div className="h-3 w-1/2 rounded bg-muted" />
      </div>
     </div>
    ))}
   </div>
  </main>

  {/* Sidebar Skeleton — Stat Cards */}
  <aside className="space-y-6">
   <div className="bg-card border-input animate-pulse rounded-lg border p-6 shadow-md">
    <div className="mb-4 h-4 w-1/2 rounded bg-muted" />
    <div className="space-y-3">
     {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="flex justify-between">
       <div className="h-3 w-24 rounded bg-muted" />
       <div className="h-3 w-12 rounded bg-muted" />
      </div>
     ))}
    </div>
   </div>
   <div className="bg-card border-input animate-pulse rounded-lg border p-6 shadow-md">
    <div className="mb-4 h-4 w-1/3 rounded bg-muted" />
    <div className="space-y-2">
     {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="h-8 rounded bg-muted" />
     ))}
    </div>
   </div>
  </aside>
 </div>
 );
}

/** The heavy async component that fetches all dashboard data and renders the content */
async function DashboardContent({ userId, page }: { userId: string; page: number }) {
 const supabase = await createClient();
 const offset = (page - 1) * HORSES_PER_PAGE;

 // ── Round 1: Independent queries in parallel ──
 const [summaryResult, horsesResult, collectionsResult, showRecordsResult, convosResult] =
 await Promise.all([
 supabase
 .from("user_horses")
 .select(
 `
 id, collection_id, catalog_items:catalog_id(title, maker, item_type)
 `,
 { count:"exact" },
 )
 .eq("owner_id", userId)
 .is("deleted_at", null),
 supabase
 .from("user_horses")
 .select(
 `
 id, custom_name, finish_type, condition_grade, created_at, collection_id, sculptor, trade_status, asset_category,
 catalog_items:catalog_id(title, maker, item_type),
 horse_images(image_url, angle_profile)
 `,
 )
 .eq("owner_id", userId)
 .is("deleted_at", null)
 .order("created_at", { ascending: false })
 .range(offset, offset + HORSES_PER_PAGE - 1),
 supabase.from("user_collections").select("id, name, description").eq("user_id", userId).order("name"),
 supabase.from("show_records").select("id", { count:"exact", head: true }).eq("user_id", userId),
 supabase.from("conversations").select("id").or(`buyer_id.eq.${userId},seller_id.eq.${userId}`),
 ]);

 const totalHorseCount = summaryResult.count ?? 0;
 const allHorsesSummary = summaryResult.data ?? [];
 const horses = horsesResult.data ?? [];
 const collections = collectionsResult.data ?? [];
 const totalShowRecords = showRecordsResult.count;
 const convoIds = (convosResult.data ?? []).map((c) => c.id);
 const totalPages = Math.ceil(totalHorseCount / HORSES_PER_PAGE);

 // ── Round 2: Dependent queries in parallel ──
 const allHorseIds = allHorsesSummary.map((h) => h.id);
 const thumbnailUrls: string[] = [];
 horses.forEach((horse) => {
 const thumb = horse.horse_images?.find((img) => img.angle_profile ==="Primary_Thumbnail");
 if (thumb) thumbnailUrls.push(thumb.image_url);
 });

 const [vaultsResult, unreadResult, signedUrlMap, junctionResult] = await Promise.all([
 allHorseIds.length > 0
 ? supabase
 .from("financial_vault")
 .select("purchase_price, estimated_current_value, horse_id")
 .in("horse_id", allHorseIds)
 : Promise.resolve({
 data: [] as {
 purchase_price: number | null;
 estimated_current_value: number | null;
 horse_id: string;
 }[],
 }),
 convoIds.length > 0
 ? supabase
 .from("messages")
 .select("id", { count:"exact", head: true })
 .neq("sender_id", userId)
 .eq("is_read", false)
 .in("conversation_id", convoIds)
 : Promise.resolve({ count: 0 }),
 getPublicImageUrls(thumbnailUrls),
 // Fetch junction table for all horse↔collection mappings
 supabase
 .from("horse_collections")
 .select("horse_id, collection_id")
 .in("horse_id", allHorseIds.length > 0 ? allHorseIds : ["__none__"]),
 ]);

 const vaults =
 (vaultsResult.data as {
 purchase_price: number | null;
 estimated_current_value: number | null;
 horse_id: string;
 }[]) ?? [];
 const unreadMsgCount = (unreadResult as { count: number | null }).count ?? 0;

 // Compute total vault value
 let totalVaultValue = 0;
 vaults.forEach((v) => {
 totalVaultValue += v.estimated_current_value ?? v.purchase_price ?? 0;
 });

 // Count horses per collection — merge legacy FK + junction table
 const collectionCounts = new Map<string, Set<string>>(); // collection_id → Set of horse_ids
 const collectionValues = new Map<string, number>();

 // Source 1: Legacy FK (user_horses.collection_id)
 allHorsesSummary.forEach((h) => {
 if (h.collection_id) {
 if (!collectionCounts.has(h.collection_id)) collectionCounts.set(h.collection_id, new Set());
 collectionCounts.get(h.collection_id)!.add(h.id);
 }
 });

 // Source 2: Junction table (horse_collections)
 const junctionRows = (junctionResult.data ?? []) as { horse_id: string; collection_id: string }[];
 junctionRows.forEach((row) => {
 if (!collectionCounts.has(row.collection_id)) collectionCounts.set(row.collection_id, new Set());
 collectionCounts.get(row.collection_id)!.add(row.horse_id);
 });

 // Build horse→collection map for vault value assignment (using both sources)
 const horseCollectionMap = new Map<string, string[]>();
 allHorsesSummary.forEach((h) => {
 if (h.collection_id) {
 if (!horseCollectionMap.has(h.id)) horseCollectionMap.set(h.id, []);
 horseCollectionMap.get(h.id)!.push(h.collection_id);
 }
 });
 junctionRows.forEach((row) => {
 if (!horseCollectionMap.has(row.horse_id)) horseCollectionMap.set(row.horse_id, []);
 const cols = horseCollectionMap.get(row.horse_id)!;
 if (!cols.includes(row.collection_id)) cols.push(row.collection_id);
 });

 vaults.forEach((v) => {
 const colIds = horseCollectionMap.get(v.horse_id) || [];
 const val = v.estimated_current_value ?? v.purchase_price ?? 0;
 colIds.forEach((colId) => {
 collectionValues.set(colId, (collectionValues.get(colId) || 0) + val);
 });
 });

 const collectionNameMap = new Map<string, string>();
 collections.forEach((c) => collectionNameMap.set(c.id, c.name));

 // Build display data
 const horseCards = horses.map((horse) => {
 const thumb = horse.horse_images?.find((img) => img.angle_profile ==="Primary_Thumbnail");
 const firstImage = horse.horse_images?.[0];
 const imageUrl = thumb?.image_url || firstImage?.image_url;
 const signedUrl = imageUrl ? signedUrlMap.get(imageUrl) : undefined;

 const refName = horse.catalog_items
 ? `${horse.catalog_items.maker} ${horse.catalog_items.title}`
 :"Unlisted Mold";

 const releaseLine = null;

 const vaultMap = new Map<string, number>();
 vaults.forEach((v) => {
 const val = v.estimated_current_value ?? v.purchase_price ?? 0;
 if (val > 0) vaultMap.set(v.horse_id, val);
 });

 return {
 id: horse.id,
 customName: horse.custom_name,
 finishType: horse.finish_type ?? "OF",
 conditionGrade: horse.condition_grade ?? "",
 createdAt: horse.created_at,
 refName,
 releaseLine,
 thumbnailUrl: signedUrl || null,
 collectionName: horse.collection_id ? collectionNameMap.get(horse.collection_id) || null : null,
 sculptor: horse.sculptor || null,
 tradeStatus: horse.trade_status ||"Not for Sale",
 assetCategory: horse.asset_category ||"model",
 vaultValue: vaultMap.get(horse.id) || null,
 moldName: horse.catalog_items?.title || null,
 releaseName: horse.catalog_items?.title || null,
 };
 });

 return (
 <>
  {/* Welcome Card for new users — FULL WIDTH */}
  {horseCards.length === 0 && (
  <div className="bg-card border-input animate-fade-in-up mb-8 rounded-lg border border-emerald-200 bg-gradient-to-br from-emerald-50 to-indigo-50 px-8 py-16 text-center shadow-md transition-all">
  <h2>Welcome to Model Horse Hub!</h2>
  <p>Let&apos;s get started by adding your first model to your digital stable.</p>
  <div className="mx-auto mb-8 flex max-w-[360px] flex-col gap-4 text-left">
  <div className="flex items-center gap-4 text-base">
  <span className="text-forest flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold">
  1
  </span>
  <span>
  <Camera size={16} strokeWidth={1.5} /> Add your first horse with photos
  </span>
  </div>
  <div className="flex items-center gap-4 text-base">
  <span className="text-forest flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold">
  2
  </span>
  <span>
  <Trophy size={16} strokeWidth={1.5} /> Make it public for the Show Ring
  </span>
  </div>
  <div className="flex items-center gap-4 text-base">
  <span className="text-forest flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold">
  3
  </span>
  <span>
  <Users size={16} strokeWidth={1.5} /> Discover and follow other collectors
  </span>
  </div>
  </div>
  <Link
  href="/add-horse"
  className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
  >
  <Plus size={18} strokeWidth={1.5} /> Add Your First Horse
  </Link>
  </div>
  )}

  {/* Shelf Header — model count + action buttons */}
  <div className="flex flex-wrap items-center gap-4">
  {totalHorseCount > 0 && (
  <span className="text-secondary-foreground text-sm">
  {totalHorseCount} model{totalHorseCount === 1 ?"" :"s"}
  </span>
  )}
  {totalHorseCount > 0 && <ExportButton />}
  {totalHorseCount > 0 && <InsuranceReportButton />}
  </div>

  {/* TWO-COLUMN GRID: Main (horses) + Sidebar (widgets) */}
  <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px] 2xl:grid-cols-[1fr_360px]">
  {/* ── MAIN COLUMN: Horse Grid ── */}
  <main className="min-w-0">
  <DashboardShell
  horseCards={horseCards}
  collections={collections.map((c) => ({ id: c.id, name: c.name }))}
  />

  {/* Pagination */}
  {totalPages > 1 && (
  <div className="border-input mt-6 mt-8 flex flex-wrap items-center justify-between gap-2 border-t pt-6">
  {page > 1 ? (
  <Link
  href={`/dashboard?page=${page - 1}`}
  className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-secondary-foreground no-underline transition-all"
  >
  ← Previous
  </Link>
  ) : (
  <button
  className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-secondary-foreground no-underline transition-all"
  disabled
  >
  ← Previous
  </button>
  )}
  <span className="text-muted-foreground text-sm">
  Page {page} of {totalPages}
  </span>
  {page < totalPages ? (
  <Link
  href={`/dashboard?page=${page + 1}`}
  className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-secondary-foreground no-underline transition-all"
  >
  Next →
  </Link>
  ) : (
  <button
  className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-secondary-foreground no-underline transition-all"
  disabled
  >
  Next →
  </button>
  )}
  </div>
  )}
  </main>

  {/* ── SIDEBAR: Widgets ── */}
  <aside className="space-y-6">
  {/* Analytics — Compact stat rows */}
  {totalHorseCount > 0 && (
  <div className="bg-card border-input rounded-lg border p-6 shadow-md transition-all">
               <h3 className="mb-4 flex items-center gap-2 text-xs font-semibold tracking-widest text-secondary-foreground uppercase">
                 <BarChart3 size={14} strokeWidth={1.5} /> Stable Overview
  </h3>
  <div className="flex flex-col gap-[2px]">
  <div className="flex items-center justify-between rounded-sm px-1 py-2 transition-colors hover:bg-black/[0.03]">
  <span className="text-secondary-foreground text-sm">
  <Plus size={14} strokeWidth={1.5} /> Total Models
  </span>
  <span className="text-foreground text-sm font-bold">{totalHorseCount}</span>
  </div>
  <div className="flex items-center justify-between rounded-sm px-1 py-2 transition-colors hover:bg-black/[0.03]">
  <span className="text-secondary-foreground text-sm">
  <FolderOpen size={14} strokeWidth={1.5} /> Collections
  </span>
  <span className="text-foreground text-sm font-bold">{collections.length}</span>
  </div>
  <div className="flex items-center justify-between rounded-sm px-1 py-2 transition-colors hover:bg-black/[0.03]">
  <span className="text-secondary-foreground text-sm">
  <DollarSign size={14} strokeWidth={1.5} /> Vault Value
  </span>
  <span className="text-foreground text-sm font-bold">
  {totalVaultValue > 0
  ? `$${totalVaultValue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  :"—"}
  </span>
  </div>
  <div className="flex items-center justify-between rounded-sm px-1 py-2 transition-colors hover:bg-black/[0.03]">
  <span className="text-secondary-foreground text-sm">
  <Award size={14} strokeWidth={1.5} /> Show Placings
  </span>
  <span className="text-foreground text-sm font-bold">{totalShowRecords ?? 0}</span>
  </div>

  {unreadMsgCount > 0 && (
  <Link
  href="/inbox"
  className="flex items-center justify-between rounded-sm px-1 py-2 no-underline transition-colors hover:bg-black/[0.03]"
  style={{ textDecoration:"none" }}
  >
  <span className="flex items-center gap-1.5 text-sm text-secondary-foreground">
  <Mail size={14} strokeWidth={1.5} /> Unread Messages
  </span>
  <span className="text-foreground text-forest text-sm font-bold">
  {unreadMsgCount}
  </span>
  </Link>
  )}
  </div>
  </div>
  )}

  {/* Collections — Vertical list */}
  {collections.length > 0 && (
  <div className="bg-card border-input rounded-lg border p-6 shadow-md transition-all">
               <h3 className="mb-4 flex items-center gap-2 text-xs font-semibold tracking-widest text-secondary-foreground uppercase">
                 <FolderOpen size={14} strokeWidth={1.5} /> Collections
  </h3>
  <div className="flex flex-col gap-1">
  {collections.map((col) => (
  <Link
  key={col.id}
  href={`/stable/collection/${col.id}`}
  className="text-foreground hover:border-input flex items-center justify-between rounded-md border border-transparent bg-black/[0.02] px-4 py-2 text-sm no-underline transition-all hover:bg-black/[0.06] hover:no-underline"
  id={`collection-${col.id}`}
  >
  <span>{col.name}</span>
  <span className="text-secondary-foreground text-xs whitespace-nowrap">
   {collectionCounts.get(col.id)?.size || 0}
  {(collectionValues.get(col.id) || 0) > 0 && (
  <>
  · $
  {(collectionValues.get(col.id) || 0).toLocaleString("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  })}
  </>
  )}
  </span>
  </Link>
  ))}
  </div>
  </div>
  )}

  {/* NAN Qualification Dashboard */}
  <Suspense fallback={null}>
  <NanDashboardWidget />
  <ShowHistoryWidgetWrapper />
  </Suspense>

  {/* Transfer History */}
  <TransferHistorySection />
  </aside>
  </div>
 </>
 );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
 const supabase = await createClient();
 const {
 data: { user },
 } = await supabase.auth.getUser();

 if (!user) {
 redirect("/login");
 }

 const params = await searchParams;
 const page = Math.max(1, parseInt(params.page ||"1"));

 // Fast query for profile name (needed for shelf header)
 const { data: profile } = await supabase.from("users").select("alias_name").eq("id", user.id).single<{ alias_name: string }>();

 return (
 <CommandCenterLayout
  title={
  <>
   <span className="text-forest">Digital Stable</span>
   {profile?.alias_name && (
   <span className="ml-4 text-lg font-normal text-muted-foreground">
    {profile.alias_name}&apos;s Herd
   </span>
   )}
  </>
  }
  headerActions={
  <>
   <Link
   href="/stable/import"
   className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-secondary-foreground no-underline transition-all"
   id="batch-import-button"
   >
   <FileText size={16} strokeWidth={1.5} /> Batch Import
   </Link>
   <Link
   href="/add-horse/quick"
   className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-secondary-foreground no-underline transition-all"
   id="quick-add-button"
   >
   <Zap size={16} strokeWidth={1.5} /> Quick Add
   </Link>
   <Link
   href="/add-horse"
   className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
   id="add-horse-button"
   >
   <Plus size={16} strokeWidth={1.5} /> Add to Stable
   </Link>
  </>
  }
  mainContent={
  <>
   {/* Success toast */}
   <Suspense fallback={null}>
   <DashboardToast />
   </Suspense>

   {/* Dashboard content streams in via Suspense */}
   <Suspense fallback={<DashboardSkeleton />}>
   <DashboardContent userId={user.id} page={page} />
   </Suspense>
  </>
  }
 />
 );
}
