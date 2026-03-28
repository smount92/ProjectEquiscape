"use client";

import { useState } from"react";
import { useRouter } from"next/navigation";
import { createOrFindConversation } from"@/app/actions/messaging";
import MakeOfferModal from"@/components/MakeOfferModal";

interface MessageSellerButtonProps {
 sellerId: string;
 horseId: string;
 horseName?: string;
 tradeStatus?: string;
 askingPrice?: number | null;
 compact?: boolean;
}

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

 const isOfferable = tradeStatus ==="Open to Offers" || tradeStatus ==="For Sale";

 const handleClick = async (e: React.MouseEvent) => {
 e.preventDefault();
 e.stopPropagation();

 // If tradeable → show offer modal
 if (isOfferable) {
 setShowOfferModal(true);
 return;
 }

 // Otherwise → open/find DM conversation
 if (loading) return;
 setLoading(true);
 const result = await createOrFindConversation(sellerId, horseId);

 if (result.success && result.conversationId) {
 router.push(`/inbox/${result.conversationId}`);
 } else {
 setLoading(false);
 }
 };

 if (compact) {
 return (
 <>
 <button
 className="bg-emerald-50 border-emerald-300 flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded-full border p-0 text-[#2C5545] transition-all"
 onClick={handleClick}
 disabled={loading}
 title={isOfferable ?"Make Offer" :"Message Seller"}
 aria-label={isOfferable ?"Make Offer" :"Message Seller"}
 >
 {loading ? (
 <span
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 aria-hidden="true"
 />
 ) : isOfferable ? (
 <span className="text-[12]">💰</span>
 ) : (
 <svg
 width="14"
 height="14"
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
 )}
 </button>
 {showOfferModal && (
 <MakeOfferModal
 horseId={horseId}
 horseName={horseName ||"This Horse"}
 sellerId={sellerId}
 askingPrice={askingPrice}
 onClose={() => setShowOfferModal(false)}
 />
 )}
 </>
 );
 }

 return (
 <>
 <button
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 onClick={handleClick}
 disabled={loading}
 >
 {loading ? (
 <>
 <span
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 aria-hidden="true"
 />
 {isOfferable ?"Opening…" :"Opening…"}
 </>
 ) : isOfferable ? (
 <>💰 Make Offer</>
 ) : (
 <>
 <svg
 width="14"
 height="14"
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
 Message Seller
 </>
 )}
 </button>
 {showOfferModal && (
 <MakeOfferModal
 horseId={horseId}
 horseName={horseName ||"This Horse"}
 sellerId={sellerId}
 askingPrice={askingPrice}
 onClose={() => setShowOfferModal(false)}
 />
 )}
 </>
 );
}
