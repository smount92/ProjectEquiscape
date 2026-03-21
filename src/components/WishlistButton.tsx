"use client";

import { useState } from "react";
import { addToWishlist } from "@/app/actions/wishlist";


interface WishlistButtonProps {
    catalogId: string | null;
}

export default function WishlistButton({ catalogId }: WishlistButtonProps) {
    const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

    if (!catalogId) return null;

    const handleClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (status === "saving" || status === "saved") return;

        setStatus("saving");
        const result = await addToWishlist(catalogId);

        if (result.success) {
            setStatus("saved");
        } else if (result.error === "Already in your wishlist!") {
            setStatus("saved");
        } else {
            setStatus("error");
            setTimeout(() => setStatus("idle"), 2000);
        }
    };

    return (
        <button
            className={`flex items-center justify-center w-8 h-8 border-none bg-transparent cursor-pointer rounded-full p-0 transition-all duration-200 ${status === "saved" ? "text-saddle animate-[wishlistPop_0.3s_ease]" : "text-muted hover:text-saddle hover:bg-[rgba(139,90,43,0.08)] hover:scale-115"}`}
            onClick={handleClick}
            disabled={status === "saving"}
            title={status === "saved" ? "In your wishlist" : "Add to wishlist"}
            aria-label={status === "saved" ? "In your wishlist" : "Add to wishlist"}
        >
            {status === "saving" ? (
                <span className="btn-spinner" style={{ width: 14, height: 14 }} aria-hidden="true" />
            ) : (
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill={status === "saved" ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
            )}
        </button>
    );
}
