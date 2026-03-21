"use client";

import { useState } from"react";
import { addToWishlist } from"@/app/actions/wishlist";

interface WishlistButtonProps {
 catalogId: string | null;
}

export default function WishlistButton({ catalogId }: WishlistButtonProps) {
 const [status, setStatus] = useState<"idle" |"saving" |"saved" |"error">("idle");

 if (!catalogId) return null;

 const handleClick = async (e: React.MouseEvent) => {
 e.preventDefault();
 e.stopPropagation();
 if (status ==="saving" || status ==="saved") return;

 setStatus("saving");
 const result = await addToWishlist(catalogId);

 if (result.success) {
 setStatus("saved");
 } else if (result.error ==="Already in your wishlist!") {
 setStatus("saved");
 } else {
 setStatus("error");
 setTimeout(() => setStatus("idle"), 2000);
 }
 };

 return (
 <button
 className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 transition-all duration-200 ${status ==="saved" ?"text-saddle animate-[wishlistPop_0.3s_ease]" :"text-muted hover:text-saddle hover:scale-115 hover:bg-[rgba(139,90,43,0.08)]"}`}
 onClick={handleClick}
 disabled={status ==="saving"}
 title={status ==="saved" ?"In your wishlist" :"Add to wishlist"}
 aria-label={status ==="saved" ?"In your wishlist" :"Add to wishlist"}
 >
 {status ==="saving" ? (
 <span
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 aria-hidden="true"
 />
 ) : (
 <svg
 width="16"
 height="16"
 viewBox="0 0 24 24"
 fill={status ==="saved" ?"currentColor" :"none"}
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
