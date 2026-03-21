"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createOrFindConversation } from "@/app/actions/messaging";
import MakeOfferModal from "@/components/MakeOfferModal";

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

    const isOfferable = tradeStatus === "Open to Offers" || tradeStatus === "For Sale";

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
                    className="flex items-center justify-center w-[28px] h-[28px] p-0 bg-[rgba(44, 85, 69, 0.1)] border border-[rgba(44, 85, 69, 0.25)] rounded-full text-[#2C5545] cursor-pointer transition-all"
                    onClick={handleClick}
                    disabled={loading}
                    title={isOfferable ? "Make Offer" : "Message Seller"}
                    aria-label={isOfferable ? "Make Offer" : "Message Seller"}
                >
                    {loading ? (
                        <span className="btn-spinner" style={{ width: 12, height: 12 }} aria-hidden="true" />
                    ) : isOfferable ? (
                        <span style={{ fontSize: 12 }}>💰</span>
                    ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                    )}
                </button>
                {showOfferModal && (
                    <MakeOfferModal
                        horseId={horseId}
                        horseName={horseName || "This Horse"}
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
                className="message-seller-btn"
                onClick={handleClick}
                disabled={loading}
            >
                {loading ? (
                    <>
                        <span className="btn-spinner" style={{ width: 14, height: 14 }} aria-hidden="true" />
                        {isOfferable ? "Opening…" : "Opening…"}
                    </>
                ) : isOfferable ? (
                    <>💰 Make Offer</>
                ) : (
                    <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        Message Seller
                    </>
                )}
            </button>
            {showOfferModal && (
                <MakeOfferModal
                    horseId={horseId}
                    horseName={horseName || "This Horse"}
                    sellerId={sellerId}
                    askingPrice={askingPrice}
                    onClose={() => setShowOfferModal(false)}
                />
            )}
        </>
    );
}
