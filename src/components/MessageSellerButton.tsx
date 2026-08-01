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
 const router = useRouter();

 const isOfferable = tradeStatus === "Open to Offers" || tradeStatus === "For Sale";

 /** Open (or find) the plain DM conversation with the seller. */
 const openConversation = async (e: React.MouseEvent) => {
 e.preventDefault();
 e.stopPropagation();
 if (loading) return;
 setLoading(true);
 const result = await createOrFindConversation(sellerId, horseId);

 if (result.success && result.conversationId) {
 track("message_seller", { horse_id: horseId });
 router.push(`/inbox/${result.conversationId}`);
 } else {
 setLoading(false);
 }
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
 onClick={openConversation}
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
 <Button variant="outline" onClick={openConversation} disabled={loading}>
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
 {offerModal}
 </>
 );
}
