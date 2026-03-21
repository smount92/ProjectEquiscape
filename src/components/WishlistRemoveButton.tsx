"use client";

import { useState } from "react";
import { removeFromWishlist } from "@/app/actions/wishlist";
import { useRouter } from "next/navigation";

export default function WishlistRemoveButton({ wishlistId }: { wishlistId: string }) {
    const [removing, setRemoving] = useState(false);
    const router = useRouter();

    const handleRemove = async () => {
        if (removing) return;
        setRemoving(true);
        const result = await removeFromWishlist(wishlistId);
        if (result.success) {
            router.refresh();
        } else {
            setRemoving(false);
        }
    };

    return (
        <button
            className="absolute top-2 right-2 flex items-center justify-center w-7 h-7 border-none bg-transparent text-muted cursor-pointer rounded-full transition-all p-0 opacity-0 group-hover/card:opacity-100 max-[600px]:opacity-100 hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)]"
            onClick={handleRemove}
            disabled={removing}
            title="Remove from wishlist"
            aria-label="Remove from wishlist"
        >
            {removing ? (
                <span className="btn-spinner" style={{ width: 14, height: 14 }} aria-hidden="true" />
            ) : (
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            )}
        </button>
    );
}
