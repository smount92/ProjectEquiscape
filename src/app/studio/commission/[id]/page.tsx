import { createClient } from"@/lib/supabase/server";
import { redirect, notFound } from"next/navigation";
import Link from"next/link";
import { getCommission, getCommissionUpdates } from"@/app/actions/art-studio";
import CommissionTimeline from"@/components/CommissionTimeline";
import RatingForm from"@/components/RatingForm";
import GuestLinkButton from"@/components/GuestLinkButton";
import LinkHorseToCommission from"@/components/LinkHorseToCommission";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";


const STATUS_STYLES: Record<string, string> = {
 requested: "bg-stone-500/20 text-secondary-foreground border-stone-500/40",
 accepted: "bg-blue-500/20 text-blue-600 border-blue-500/40",
 in_progress: "bg-amber-500/20 text-amber-600 border-amber-500/40",
 review: "bg-violet-500/20 text-violet-600 border-violet-500/40",
 revision: "bg-orange-500/20 text-orange-600 border-orange-500/40",
 completed: "bg-green-500/20 text-green-600 border-green-500/40",
 shipping: "bg-sky-500/20 text-sky-600 border-sky-500/40",
 delivered: "bg-teal-500/20 text-teal-600 border-teal-500/40",
 declined: "bg-red-500/20 text-red-600 border-red-500/40",
 cancelled: "bg-red-500/20 text-red-600 border-red-500/40",
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
   className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap border ${STATUS_STYLES[commission.status] || "bg-stone-500/20 text-secondary-foreground border-stone-500/40"}`}
  >
   {commission.statusLabel}
  </span>
  }
 >
  {/* Header Card */}
  <div className="bg-card border-input rounded-lg border p-6 shadow-md transition-all">
  <div className="bg-card rounded-md p-4">
   <h3 className="text-secondary-foreground mb-1 text-sm">Description</h3>
   <p className="text-sm leading-[1.6] whitespace-pre-wrap">
   {commission.description}
   </p>
  </div>

  <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
   {commission.priceQuoted && (
   <div>
    <span className="text-muted-foreground block text-xs">Price Quoted</span>
    <span className="text-base font-bold">${commission.priceQuoted}</span>
   </div>
   )}
   {commission.depositAmount && (
   <div>
    <span className="text-muted-foreground block text-xs">Deposit</span>
    <span className="font-bold">
    ${commission.depositAmount}
    {commission.depositPaid ?" ✅" :" ⏳"}
    </span>
   </div>
   )}
   {commission.estimatedCompletion && (
   <div>
    <span className="text-muted-foreground block text-xs">Est. Completion</span>
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
    <span className="text-muted-foreground block text-xs">Slot</span>
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
   className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-secondary-foreground no-underline transition-all"
   >
   ← Dashboard
   </Link>
  )}
  {isClient && (
   <Link
   href="/studio/my-commissions"
   className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-8 py-2 text-sm font-semibold text-secondary-foreground no-underline transition-all"
   >
   ← My Commissions
   </Link>
  )}
  </div>
 </ExplorerLayout>
 );
}
