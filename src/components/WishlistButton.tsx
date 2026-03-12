"use client";

import { useState } from "react";
import { addToWishlist } from "@/app/actions/wishlist";
import styles from "./WishlistButton.module.css";

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
            className={status === "saved" ? styles.wishlisted : styles.btn}
            onClick={handleClick}
            disabled={status === "saving"}
            title={status === "saved" ? "In your wishlist" : "Add to wishlist"}
            aria-label={status === "saved" ? "In your wishlist" : "Add to wishlist"}
        >
            {status === "saving" ? (
                <span className="btn-spinner" style={{ width: 14, height: 14 }} aria-hidden="true" />
            ) : (
                <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill={status === "saved" ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
            )}
        </button>
    );
}
