import { createClient } from"@/lib/supabase/server";
import { redirect, notFound } from"next/navigation";
import Link from"next/link";
import { getCommission, getCommissionUpdates } from"@/app/actions/art-studio";
import CommissionTimeline from"@/components/CommissionTimeline";
import RatingForm from"@/components/RatingForm";
import GuestLinkButton from"@/components/GuestLinkButton";
import LinkHorseToCommission from"@/components/LinkHorseToCommission";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";
import { Button } from "@/components/ui/button";
import { STATUS_STYLES } from "@/lib/studio/statusStyles";
import { User, Palette, Calendar, CheckCircle, Clock } from "lucide-react";

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
   {isArtist && commission.clientAlias && (
   <span className="inline-flex items-center gap-1"><User className="h-4 w-4" /> Client: @{commission.clientAlias} · </span>
   )}
   {isClient && (
   <span className="inline-flex items-center gap-1"><Palette className="h-4 w-4" /> Artist: @{commission.artistAlias} · </span>
   )}
   <span className="inline-flex items-center gap-1">
   <Calendar className="h-4 w-4" />{" "}
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
   className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap border ${STATUS_STYLES[commission.status] || "bg-muted text-muted-foreground border-input"}`}
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
    <span className="inline-flex items-center gap-1 font-bold">
    ${commission.depositAmount}
    {commission.depositPaid ? <CheckCircle className="h-4 w-4 text-success" /> : <Clock className="h-4 w-4 text-warning" />}
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
   <Button asChild variant="outline" size="wide"><Link
   href="/studio/dashboard"
   >
   ← Dashboard
   </Link></Button>
  )}
  {isClient && (
   <Button asChild variant="outline" size="wide"><Link
   href="/studio/my-commissions"
   >
   ← My Commissions
   </Link></Button>
  )}
  </div>
 </ExplorerLayout>
 );
}
