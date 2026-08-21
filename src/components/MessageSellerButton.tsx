"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOrFindConversation } from "@/app/actions/messaging";
import MakeOfferModal from "@/components/MakeOfferModal";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";

interface MessageSellerButtonProps {
 sellerId: string;
 horseId: string;
 horseName?: string;
 tradeStatus?: string;
 askingPrice?: number | null;
 compact?: boolean;
}

/** Speech-bubble glyph shared by the DM actions. */
function MessageIcon({ size = 14 }: { size?: number }) {
 return (
 <svg
 width={size}
 height={size}
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2"
 strokeLinecap="round"
 strokeLinejoin="round"
 aria-hidden="true"
 >
 <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
 </svg>
 );
}

/**
 * The buyer's contact actions for a horse.
 *
 * Listed horses (For Sale / Open to Offers) get TWO visible actions:
 * "💰 Make Offer" (offer modal) and "✉️ Ask a question" (plain DM) —
 * a buyer with a question must never be forced to invent an offer
 * amount just to talk to the seller. Unlisted horses keep the single
 * "Message Seller" DM button, unchanged.
 */
export default function MessageSellerButton({
 sellerId,
 horseId,
 horseName,
 tradeStatus,
 askingPrice,
 compact = false,
}: MessageSellerButtonProps) {
 const [loading, setLoading] = useState(false);
 const [showOfferModal, setShowOfferModal] = useState(false);
 const [asking, setAsking] = useState(false);
 const [draft, setDraft] = useState(
 horseName ? `Hi! I'm interested in ${horseName} — is it still available?` : "",
 );
 const router = useRouter();

 const isOfferable = tradeStatus === "Open to Offers" || tradeStatus === "For Sale";

 /**
  * Open (or find) the DM with the seller, sending the opening line.
  *
  * The old flow created a conversation with ZERO messages, which lands
  * both people in a thread reading "No messages yet" — a dead end for
  * the buyer, who now has to think of an opener cold, and for the
  * seller, who gets a notification about nothing. The line is suggested
  * and fully editable: it is the buyer's message, not ours.
  */
 const openConversation = async (e: React.MouseEvent) => {
 e.preventDefault();
 e.stopPropagation();
 if (loading) return;
 setLoading(true);
 const result = await createOrFindConversation(
 sellerId,
 horseId,
 draft.trim() || undefined,
 );

 if (result.success && result.conversationId) {
 track("message_seller", { horse_id: horseId });
 router.push(`/inbox/${result.conversationId}`);
 } else {
 setLoading(false);
 setAsking(false);
 }
 };

 const askComposer = asking && (
 // Fixed rather than absolute: this button is rendered inside card
 // grids, table rows and sticky bars all over the site, and a
 // positioned popover in any of them clips.
 <div className="border-input bg-card fixed inset-x-4 bottom-4 z-50 rounded-lg border p-4 shadow-md sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[360px]">
 <label className="mb-1 block text-sm font-semibold" htmlFor="first-message">
 Message {horseName ? `about ${horseName}` : "the seller"}
 </label>
 <textarea
 id="first-message"
 className="border-input bg-card mb-3 min-h-[80px] w-full rounded-md border px-3 py-2 text-sm"
 maxLength={2000}
 value={draft}
 onChange={(ev) => setDraft(ev.target.value)}
 autoFocus
 />
 <div className="flex flex-wrap gap-2">
 <Button onClick={openConversation} disabled={loading || !draft.trim()}>
 {loading ? "Sending…" : "Send"}
 </Button>
 <Button
 variant="outline"
 size="wide"
 onClick={(ev) => {
 ev.preventDefault();
 ev.stopPropagation();
 setAsking(false);
 }}
 disabled={loading}
 >
 Cancel
 </Button>
 </div>
 </div>
 );

 const startAsking = (e: React.MouseEvent) => {
 e.preventDefault();
 e.stopPropagation();
 setAsking(true);
 };

 const openOfferModal = (e: React.MouseEvent) => {
 e.preventDefault();
 e.stopPropagation();
 setShowOfferModal(true);
 };

 const offerModal = showOfferModal && (
 <MakeOfferModal
 horseId={horseId}
 horseName={horseName || "This Horse"}
 sellerId={sellerId}
 askingPrice={askingPrice}
 onClose={() => setShowOfferModal(false)}
 />
 );

 if (compact) {
 return (
 <>
 {isOfferable && (
 <button
 className="bg-emerald-50 border-emerald-300 flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded-full border p-0 text-forest transition-all"
 onClick={openOfferModal}
 title="Make Offer"
 aria-label="Make Offer"
 >
 <span className="text-[12]">💰</span>
 </button>
 )}
 <button
 className="bg-emerald-50 border-emerald-300 flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded-full border p-0 text-forest transition-all"
 onClick={startAsking}
 disabled={loading}
 title={isOfferable ? "Ask a question" : "Message Seller"}
 aria-label={isOfferable ? "Ask a question" : "Message Seller"}
 >
 {loading ? (
 <span
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 aria-hidden="true"
 />
 ) : (
 <MessageIcon />
 )}
 </button>
 {askComposer}
 {offerModal}
 </>
 );
 }

 return (
 <>
 {isOfferable && (
 <Button variant="outline" onClick={openOfferModal}>
 💰 Make Offer
 </Button>
 )}
 <Button variant="outline" onClick={startAsking} disabled={loading}>
 {loading ? (
 <>
 <span
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 aria-hidden="true"
 />
 Opening…
 </>
 ) : isOfferable ? (
 <>✉️ Ask a question</>
 ) : (
 <>
 <MessageIcon />
 Message Seller
 </>
 )}
 </Button>
 {askComposer}
 {offerModal}
 </>
 );
}
