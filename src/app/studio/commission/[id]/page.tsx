import { createClient } from"@/lib/supabase/server";
import { redirect, notFound } from"next/navigation";
import Link from"next/link";
import { getCommission, getCommissionUpdates } from"@/app/actions/art-studio";
import CommissionTimeline from"@/components/CommissionTimeline";
import RatingForm from"@/components/RatingForm";
import GuestLinkButton from"@/components/GuestLinkButton";
import LinkHorseToCommission from"@/components/LinkHorseToCommission";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";


const STATUS_COLORS: Record<string, string> = {
 requested:"#6b7280",
 accepted:"#3b82f6",
 in_progress:"#f59e0b",
 review:"#8b5cf6",
 revision:"#f97316",
 completed:"#22c55e",
 shipping:"#0ea5e9",
 delivered:"#14b8a6",
 declined:"#ef4444",
 cancelled:"#ef4444",
};

export default async function CommissionDetailPage({
 params,
 searchParams,
}: {
 params: Promise<{ id: string }>;
 searchParams: Promise<{ token?: string }>;
}) {
 const { id: commissionId } = await params;
 const { token } = await searchParams;
 const supabase = await createClient();

 let isGuestMode = false;
 let isArtist = false;
 let isClient = false;
 let userId: string | null = null;

 if (token) {
 const { data: guestCheck } = await supabase
  .from("commissions")
  .select("id, guest_token")
  .eq("id", commissionId)
  .eq("guest_token", token)
  .maybeSingle();

 if (!guestCheck) notFound();
 isGuestMode = true;
 } else {
 const {
  data: { user },
 } = await supabase.auth.getUser();
 if (!user) redirect("/login");
 userId = user.id;
 }

 const commission = await getCommission(commissionId);
 if (!commission) notFound();

 if (!isGuestMode && userId) {
 isArtist = commission.artistId === userId;
 isClient = commission.clientId === userId;
 if (!isArtist && !isClient) notFound();
 }

 const updates = await getCommissionUpdates(commissionId);

 let transactionId: string | null = null;
 let existingRating: { id: string; stars: number; reviewText: string | null; createdAt: string } | null = null;
 const targetId = isArtist ? commission.clientId : commission.artistId;
 const targetAlias = isArtist ? commission.clientAlias ||"Client" : commission.artistAlias;

 if (!isGuestMode && commission.status ==="delivered" && targetId && userId) {
 const { data: txn } = await supabase
  .from("transactions")
  .select("id")
  .eq("commission_id", commissionId)
  .eq("type","commission")
  .maybeSingle();

 if (txn) {
  transactionId = (txn as { id: string }).id;

  const { data: rawReview } = await supabase
  .from("reviews")
  .select("id, stars, content, created_at")
  .eq("transaction_id", transactionId)
  .eq("reviewer_id", userId)
  .maybeSingle();

  if (rawReview) {
  const rv = rawReview as { id: string; stars: number; content: string | null; created_at: string };
  existingRating = {
   id: rv.id,
   stars: rv.stars,
   reviewText: rv.content,
   createdAt: rv.created_at,
  };
  }
 }
 }

 return (
 <ExplorerLayout
  title={commission.commissionType}
  description={
  <>
   {isArtist && commission.clientAlias && <span>👤 Client: @{commission.clientAlias} · </span>}
   {isClient && <span>🎨 Artist: @{commission.artistAlias} · </span>}
   <span>
   📅{" "}
   {new Date(commission.createdAt).toLocaleDateString("en-US", {
    month:"short",
    day:"numeric",
    year:"numeric",
   })}
   </span>
  </>
  }
  headerActions={
  <span
   className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap"
    /* eslint-disable-next-line react/forbid-dom-props */ style={{ backgroundColor: `${STATUS_COLORS[commission.status]}20`, color: STATUS_COLORS[commission.status], borderColor: `${STATUS_COLORS[commission.status]}40`, borderWidth: "1px", borderStyle: "solid" }}
  >
   {commission.statusLabel}
  </span>
  }
 >
  {/* Header Card */}
  <div className="bg-white border-stone-200 rounded-lg border p-6 shadow-md transition-all">
  <div className="bg-white rounded-md p-4">
   <h3 className="text-stone-600 mb-1 text-sm">Description</h3>
   <p className="text-sm leading-[1.6] whitespace-pre-wrap">
   {commission.description}
   </p>
  </div>

  <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
   {commission.priceQuoted && (
   <div>
    <span className="text-stone-500 block text-xs">Price Quoted</span>
    <span className="text-base font-bold">${commission.priceQuoted}</span>
   </div>
   )}
   {commission.depositAmount && (
   <div>
    <span className="text-stone-500 block text-xs">Deposit</span>
    <span className="font-bold">
    ${commission.depositAmount}
    {commission.depositPaid ?" ✅" :" ⏳"}
    </span>
   </div>
   )}
   {commission.estimatedCompletion && (
   <div>
    <span className="text-stone-500 block text-xs">Est. Completion</span>
    <span className="font-semibold">
    {new Date(commission.estimatedCompletion).toLocaleDateString("en-US", {
     month:"short",
     day:"numeric",
     year:"numeric",
    })}
    </span>
   </div>
   )}
   {commission.slotNumber && (
   <div>
    <span className="text-stone-500 block text-xs">Slot</span>
    <span className="font-bold">#{commission.slotNumber}</span>
   </div>
   )}
  </div>
  </div>

  {/* Link Horse (for artist when no horse is linked) */}
  {!isGuestMode && !commission.horseId && isArtist && <LinkHorseToCommission commissionId={commission.id} />}

  {/* Guest Link (for artist) */}
  {!isGuestMode && isArtist && commission.guestToken && (
  <div className="mb-4">
   <GuestLinkButton commissionId={commission.id} guestToken={commission.guestToken} />
  </div>
  )}

  {/* Timeline */}
  <CommissionTimeline
  commissionId={commissionId}
  updates={updates}
  isArtist={isArtist}
  isClient={isClient}
  commissionStatus={commission.status}
  />

  {/* Review Prompt (after delivery) */}
  {transactionId && targetId && (
  <div className="animate-fade-in-up mt-6">
   <RatingForm
   transactionId={transactionId}
   targetId={targetId}
   targetAlias={targetAlias}
   existingRating={existingRating}
   />
  </div>
  )}

  {/* Navigation */}
  <div className="mt-6 flex flex-wrap gap-2">
  {isArtist && (
   <Link
   href="/studio/dashboard"
   className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
   >
   ← Dashboard
   </Link>
  )}
  {isClient && (
   <Link
   href="/studio/my-commissions"
   className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-8 py-2 text-sm font-semibold text-stone-600 no-underline transition-all"
   >
   ← My Commissions
   </Link>
  )}
  </div>
 </ExplorerLayout>
 );
}
