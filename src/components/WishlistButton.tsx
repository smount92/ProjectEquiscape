"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  <motion.button
   className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 transition-colors duration-200 ${
    status === "saved"
     ? "text-saddle"
     : "text-muted-foreground hover:text-saddle hover:bg-amber-50/80"
   }`}
   onClick={handleClick}
   disabled={status === "saving"}
   title={status === "saved" ? "In your wishlist" : "Add to wishlist"}
   aria-label={status === "saved" ? "In your wishlist" : "Add to wishlist"}
   whileTap={{ scale: 0.85 }}
   whileHover={{ scale: 1.15 }}
   transition={{ type: "spring" as const, stiffness: 400, damping: 15 }}
  >
   {status === "saving" ? (
    <span
     className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
     aria-hidden="true"
    />
   ) : (
    <AnimatePresence mode="wait" initial={false}>
     <motion.div
      key={status === "saved" ? "filled" : "empty"}
      initial={{ scale: 0.5 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0.5 }}
      transition={{ type: "spring" as const, stiffness: 500, damping: 15 }}
     >
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
     </motion.div>
    </AnimatePresence>
   )}
  </motion.button>
 );
}
