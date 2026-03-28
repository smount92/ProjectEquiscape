"use client";

import { useState } from"react";
import { removeFromWishlist } from"@/app/actions/wishlist";
import { useRouter } from"next/navigation";

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
 className="text-stone-500 opacity-0 transition-opacity group-hover:opacity-100 absolute top-2 right-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full rounded-lg border border-none bg-transparent p-0 opacity-0 shadow-md transition-all hover:bg-red-50 hover:text-[#ef4444] max-[600px]:opacity-100"
 onClick={handleRemove}
 disabled={removing}
 title="Remove from wishlist"
 aria-label="Remove from wishlist"
 >
 {removing ? (
 <span
 className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
 aria-hidden="true"
 />
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
