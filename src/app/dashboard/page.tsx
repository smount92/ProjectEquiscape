import { createClient } from"@/lib/supabase/server";
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

export const dynamic ="force-dynamic";

// Types for the dashboard query results
interface HorseWithDetails {
 id: string;
 custom_name: string;
 finish_type: string;
 condition_grade: string;
 created_at: string;
 collection_id: string | null;
 sculptor: string | null;
 trade_status: string;
 asset_category: string;
 catalog_items: { title: string; maker: string; item_type: string } | null;
 horse_images: { image_url: string; angle_profile: string }[];
}

interface UserCollection {
 id: string;
 name: string;
 description: string | null;
}

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
 const offset = (page - 1) * HORSES_PER_PAGE;

 // ── Round 1: Independent queries in parallel ──
 const [profileResult, summaryResult, horsesResult, collectionsResult, showRecordsResult, convosResult] =
 await Promise.all([
 supabase.from("users").select("alias_name").eq("id", user.id).single<{ alias_name: string }>(),
 supabase
 .from("user_horses")
 .select(
 `
 id, collection_id, catalog_items:catalog_id(title, maker, item_type)
 `,
 { count:"exact" },
 )
 .eq("owner_id", user.id),
 supabase
 .from("user_horses")
 .select(
 `
 id, custom_name, finish_type, condition_grade, created_at, collection_id, sculptor, trade_status, asset_category,
 catalog_items:catalog_id(title, maker, item_type),
 horse_images(image_url, angle_profile)
 `,
 )
 .eq("owner_id", user.id)
 .order("created_at", { ascending: false })
 .range(offset, offset + HORSES_PER_PAGE - 1),
 supabase.from("user_collections").select("id, name, description").eq("user_id", user.id).order("name"),
 supabase.from("show_records").select("id", { count:"exact", head: true }).eq("user_id", user.id),
 supabase.from("conversations").select("id").or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`),
 ]);

 const profile = profileResult.data;
 const totalHorseCount = summaryResult.count ?? 0;
 const allHorsesSummary =
 (summaryResult.data as unknown as {
 id: string;
 collection_id: string | null;
 catalog_items: { title: string; maker: string; item_type: string } | null;
 }[]) ?? [];
 const horses = (horsesResult.data as unknown as HorseWithDetails[]) ?? [];
 const collections = (collectionsResult.data as unknown as UserCollection[]) ?? [];
 const totalShowRecords = showRecordsResult.count;
 const convoIds = (convosResult.data ?? []).map((c: { id: string }) => c.id);
 const totalPages = Math.ceil(totalHorseCount / HORSES_PER_PAGE);

 // ── Round 2: Dependent queries in parallel ──
 const allHorseIds = allHorsesSummary.map((h) => h.id);
 const thumbnailUrls: string[] = [];
 horses.forEach((horse) => {
 const thumb = horse.horse_images?.find((img) => img.angle_profile ==="Primary_Thumbnail");
 if (thumb) thumbnailUrls.push(thumb.image_url);
 });

 const [vaultsResult, unreadResult, signedUrlMap] = await Promise.all([
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
 .neq("sender_id", user.id)
 .eq("is_read", false)
 .in("conversation_id", convoIds)
 : Promise.resolve({ count: 0 }),
 getPublicImageUrls(thumbnailUrls),
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

 // Count horses per collection and compute vault value per collection
 const collectionCounts = new Map<string, number>();
 const collectionValues = new Map<string, number>();
 allHorsesSummary.forEach((h) => {
 if (h.collection_id) {
 collectionCounts.set(h.collection_id, (collectionCounts.get(h.collection_id) || 0) + 1);
 }
 });
 const horseCollectionMap = new Map<string, string>();
 allHorsesSummary.forEach((h) => {
 if (h.collection_id) horseCollectionMap.set(h.id, h.collection_id);
 });
 vaults.forEach((v) => {
 const colId = horseCollectionMap.get(v.horse_id);
 if (colId) {
 const val = v.estimated_current_value ?? v.purchase_price ?? 0;
 collectionValues.set(colId, (collectionValues.get(colId) || 0) + val);
 }
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
 finishType: horse.finish_type,
 conditionGrade: horse.condition_grade,
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
 <div className="mx-auto max-w-[1600px] px-6 max-lg:px-4">
 <div className="animate-fade-in-up">
 {/* Welcome Card for new users — FULL WIDTH */}
 {horseCards.length === 0 && (
 <div className="bg-card border-edge animate-fade-in-up mb-8 rounded-lg border border-[rgba(44,85,69,0.15)] bg-[linear-gradient(135deg,rgba(44,85,69,0.06)_0%,rgba(44,85,69,0.02)_50%,rgba(129,140,248,0.06)_100%)] px-8 py-16 text-center shadow-md transition-all">
 <h2>Welcome to Model Horse Hub!</h2>
 <p>Let&apos;s get started by adding your first model to your digital stable.</p>
 <div className="mx-auto mb-8 flex max-w-[360px] flex-col gap-4 text-left">
 <div className="flex items-center gap-4 text-[calc(0.95rem*var(--font-scale))]">
 <span className="text-forest flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(44,85,69,0.15)] text-[calc(0.85rem*var(--font-scale))] font-bold">
 1
 </span>
 <span>
 <Camera size={16} strokeWidth={1.5} /> Add your first horse with photos
 </span>
 </div>
 <div className="flex items-center gap-4 text-[calc(0.95rem*var(--font-scale))]">
 <span className="text-forest flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(44,85,69,0.15)] text-[calc(0.85rem*var(--font-scale))] font-bold">
 2
 </span>
 <span>
 <Trophy size={16} strokeWidth={1.5} /> Make it public for the Show Ring
 </span>
 </div>
 <div className="flex items-center gap-4 text-[calc(0.95rem*var(--font-scale))]">
 <span className="text-forest flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(44,85,69,0.15)] text-[calc(0.85rem*var(--font-scale))] font-bold">
 3
 </span>
 <span>
 <Users size={16} strokeWidth={1.5} /> Discover and follow other collectors
 </span>
 </div>
 </div>
 <Link
 href="/add-horse"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 >
 <Plus size={18} strokeWidth={1.5} /> Add Your First Horse
 </Link>
 </div>
 )}

 {/* Shelf Header — FULL WIDTH */}
 <div className="sticky top-[var(--header-height)] z-40 border-b border-edge bg-parchment-dark">
 <div>
 <h1>
 <span className="text-forest">Digital Stable</span>
 {profile?.alias_name && (
 <span
 style={{
 fontSize:"calc(var(--font-size-lg) * var(--font-scale))",
 color:"var(--color-text-muted)",
 fontWeight: 400,
 marginLeft:"var(--space-md)",
 }}
 >
 {profile.alias_name}&apos;s Herd
 </span>
 )}
 </h1>
 </div>
 <div className="gap-4" style={{ display:"flex", alignItems:"center", flexWrap:"wrap" }}>
 {totalHorseCount > 0 && (
 <span className="text-muted text-sm">
 {totalHorseCount} model{totalHorseCount === 1 ?"" :"s"}
 </span>
 )}
 {totalHorseCount > 0 && <ExportButton />}
 {totalHorseCount > 0 && <InsuranceReportButton />}
 <Link
 href="/stable/import"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 id="batch-import-button"
 >
 <FileText size={16} strokeWidth={1.5} /> Batch Import
 </Link>
 <Link
 href="/add-horse/quick"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 id="quick-add-button"
 >
 <Zap size={16} strokeWidth={1.5} /> Quick Add
 </Link>
 <Link
 href="/add-horse"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 id="add-horse-button"
 >
 <Plus size={16} strokeWidth={1.5} /> Add to Stable
 </Link>
 </div>
 </div>

 {/* Success toast */}
 <Suspense fallback={null}>
 <DashboardToast />
 </Suspense>

 {/* ══════════════════════════════════════════════════════════════
 TWO-COLUMN GRID: Main (horses) + Sidebar (widgets)
 ══════════════════════════════════════════════════════════════ */}
 <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px] 2xl:grid-cols-[1fr_360px]">
 {/* ── MAIN COLUMN: Horse Grid ── */}
 <main className="min-w-0">
 <DashboardShell
 horseCards={horseCards}
 collections={collections.map((c) => ({ id: c.id, name: c.name }))}
 />

 {/* Pagination */}
 {totalPages > 1 && (
 <div className="border-edge mt-6 mt-8 flex items-center justify-between border-t pt-6">
 {page > 1 ? (
 <Link
 href={`/dashboard?page=${page - 1}`}
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 >
 ← Previous
 </Link>
 ) : (
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 disabled
 >
 ← Previous
 </button>
 )}
 <span className="text-muted text-sm">
 Page {page} of {totalPages}
 </span>
 {page < totalPages ? (
 <Link
 href={`/dashboard?page=${page + 1}`}
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 >
 Next →
 </Link>
 ) : (
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
 disabled
 >
 Next →
 </button>
 )}
 </div>
 )}
 </main>

 {/* ── SIDEBAR: Widgets ── */}
 <aside className="lg:top-[calc(sticky top-[var(--header-height)] z-40 border-b border-edge bg-parchment-dark">
 {/* Analytics — Compact stat rows */}
 {totalHorseCount > 0 && (
 <div className="bg-card border-edge rounded-lg border p-6 shadow-md transition-all">
 <h3 className="text-muted mb-4 text-xs font-bold tracking-[0.08em] uppercase">
 <BarChart3 size={16} strokeWidth={1.5} /> Stable Overview
 </h3>
 <div className="flex flex-col gap-[2px]">
 <div className="flex items-center justify-between rounded-sm px-1 py-2 transition-colors hover:bg-black/[0.03]">
 <span className="text-ink-light text-sm">
 <Plus size={14} strokeWidth={1.5} /> Total Models
 </span>
 <span className="text-ink text-sm font-bold">{totalHorseCount}</span>
 </div>
 <div className="flex items-center justify-between rounded-sm px-1 py-2 transition-colors hover:bg-black/[0.03]">
 <span className="text-ink-light text-sm">
 <FolderOpen size={14} strokeWidth={1.5} /> Collections
 </span>
 <span className="text-ink text-sm font-bold">{collections.length}</span>
 </div>
 <div className="flex items-center justify-between rounded-sm px-1 py-2 transition-colors hover:bg-black/[0.03]">
 <span className="text-ink-light text-sm">
 <DollarSign size={14} strokeWidth={1.5} /> Vault Value
 </span>
 <span className="text-ink text-sm font-bold">
 {totalVaultValue > 0
 ? `$${totalVaultValue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
 :"—"}
 </span>
 </div>
 <div className="flex items-center justify-between rounded-sm px-1 py-2 transition-colors hover:bg-black/[0.03]">
 <span className="text-ink-light text-sm">
 <Award size={14} strokeWidth={1.5} /> Show Placings
 </span>
 <span className="text-ink text-sm font-bold">{totalShowRecords ?? 0}</span>
 </div>

 {unreadMsgCount > 0 && (
 <Link
 href="/inbox"
 className="flex items-center justify-between rounded-sm px-1 py-2 no-underline transition-colors hover:bg-black/[0.03]"
 style={{ textDecoration:"none" }}
 >
 <span className="text-ink-light text-sm">
 <Mail size={14} strokeWidth={1.5} /> Unread Messages
 </span>
 <span className="text-ink text-forest text-sm font-bold">
 {unreadMsgCount}
 </span>
 </Link>
 )}
 </div>
 </div>
 )}

 {/* Collections — Vertical list */}
 {collections.length > 0 && (
 <div className="bg-card border-edge rounded-lg border p-6 shadow-md transition-all">
 <h3 className="text-muted mb-4 text-xs font-bold tracking-[0.08em] uppercase">
 <FolderOpen size={16} strokeWidth={1.5} /> Collections
 </h3>
 <div className="flex flex-col gap-1">
 {collections.map((col) => (
 <Link
 key={col.id}
 href={`/stable/collection/${col.id}`}
 className="text-ink hover:border-edge flex items-center justify-between rounded-md border border-transparent bg-black/[0.02] px-4 py-2 text-sm no-underline transition-all hover:bg-black/[0.06] hover:no-underline"
 id={`collection-${col.id}`}
 >
 <span>{col.name}</span>
 <span className="text-muted text-xs whitespace-nowrap">
 {collectionCounts.get(col.id) || 0}
 {(collectionValues.get(col.id) || 0) > 0 && (
 <>
 {""}
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
 </div>
 </div>
 );
}
