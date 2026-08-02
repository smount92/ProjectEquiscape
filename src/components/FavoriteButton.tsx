"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toggleFavorite } from "@/app/actions/social";
import { useToast } from "@/lib/context/ToastContext";

interface FavoriteButtonProps {
 horseId: string;
 initialIsFavorited: boolean;
 initialCount: number;
 /**
  * "labeled" (default) shows a visible "Favorite"/"Favorited" label —
  * for passports and other roomy contexts. "compact" keeps the
  * icon-only face for dense card footers, but the tap target still
  * meets the 44px floor (padding, pulled back with negative margin so
  * card rows don't inflate).
  */
 variant?: "labeled" | "compact";
}

export default function FavoriteButton({
 horseId,
 initialIsFavorited,
 initialCount,
 variant = "labeled",
}: FavoriteButtonProps) {
 const [isFavorited, setIsFavorited] = useState(initialIsFavorited);
 const [count, setCount] = useState(initialCount);
 const [status, setStatus] = useState<"idle" | "saving">("idle");
 const { toast } = useToast();
 const compact = variant === "compact";

 const handleClick = async (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  if (status === "saving") return;

  // Optimistic update
  const wasFavorited = isFavorited;
  const prevCount = count;
  setIsFavorited(!wasFavorited);
  setCount(wasFavorited ? prevCount - 1 : prevCount + 1);
  setStatus("saving");

  const result = await toggleFavorite(horseId);

  if (result.success) {
   setIsFavorited(result.isFavorited ?? !wasFavorited);
   setCount(result.count ?? (wasFavorited ? prevCount - 1 : prevCount + 1));
   if (result.isFavorited ?? !wasFavorited) {
    toast("Added to your Favorites.", "success", 5000, {
     label: "View your Favorites →",
     href: "/favorites",
    });
   } else {
    toast("Removed from your Favorites.", "info");
   }
  } else {
   // Revert — and SAY so (the old silent revert looked like a dead button)
   setIsFavorited(wasFavorited);
   setCount(prevCount);
   toast(result.error || "Couldn't update your Favorites. Please try again.", "error");
  }

  setStatus("idle");
 };

 return (
  <motion.button
   className={`inline-flex cursor-pointer items-center rounded-sm border-none bg-transparent text-xs transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
    compact
     ? "min-h-[44px] min-w-[44px] -my-2 justify-center gap-1 px-1.5"
     : "min-h-[44px] gap-1.5 px-3 py-1 font-medium"
   } ${isFavorited ? "text-[#e74c6f]" : "text-muted-foreground hover:text-[#e74c6f]"}`}
   onClick={handleClick}
   disabled={status === "saving"}
   title={isFavorited ? "Unfavorite" : "Favorite"}
   aria-label={isFavorited ? "Unfavorite" : "Favorite"}
   aria-pressed={isFavorited ? "true" : "false"}
   id={`favorite-btn-${horseId}`}
   whileTap={{ scale: 0.85 }}
   whileHover={{ scale: 1.1 }}
   transition={{ type: "spring" as const, stiffness: 400, damping: 15 }}
  >
   <AnimatePresence mode="wait" initial={false}>
    <motion.div
     key={isFavorited ? "filled" : "empty"}
     initial={{ scale: 0.5 }}
     animate={{ scale: 1 }}
     exit={{ scale: 0.5 }}
     transition={{ type: "spring" as const, stiffness: 500, damping: 15 }}
    >
     <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={isFavorited ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
     >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
     </svg>
    </motion.div>
   </AnimatePresence>
   {!compact && <span>{isFavorited ? "Favorited" : "Favorite"}</span>}
   {count > 0 && <span className="font-semibold tabular-nums">{count}</span>}
  </motion.button>
 );
}
