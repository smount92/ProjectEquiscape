"use client";

/**
 * Collection page grid (Digital Stable v2) — the shared StableHorseCard
 * plus Show More pagination, replacing the bespoke third grid and its
 * unbounded fetch. No filter bar here this pass; the fixed collection
 * filter is baked in.
 */

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import StableHorseCard from "@/components/stable/StableHorseCard";
import type { StableCard } from "@/lib/stable/types";
import { loadMoreStable } from "@/app/actions/stable";

const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.06 } },
} as const;

const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { type: "spring" as const, stiffness: 300, damping: 30 },
    },
};

export default function CollectionBrowser({
    collectionId,
    initialCards,
    totalCount,
    initialHasMore,
}: {
    collectionId: string;
    initialCards: StableCard[];
    totalCount: number;
    initialHasMore: boolean;
}) {
    const [cards, setCards] = useState<StableCard[]>(initialCards);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [loadingMore, setLoadingMore] = useState(false);

    const handleLoadMore = useCallback(async () => {
        setLoadingMore(true);
        try {
            const result = await loadMoreStable({ collection: collectionId, offset: cards.length });
            if (result.success) {
                setCards((prev) => [...prev, ...result.cards]);
                setHasMore(result.hasMore);
            }
        } finally {
            setLoadingMore(false);
        }
    }, [cards.length, collectionId]);

    return (
        <>
            <motion.div
                className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:gap-8 lg:grid-cols-3 xl:grid-cols-4"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {cards.map((horse) => (
                    <motion.div key={horse.id} variants={cardVariants}>
                        <StableHorseCard horse={horse} />
                    </motion.div>
                ))}
            </motion.div>

            {hasMore && (
                <div className="mt-8 flex justify-center">
                    <button
                        type="button"
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        className="btn-brass disabled:cursor-not-allowed disabled:opacity-60"
                        id="collection-show-more"
                    >
                        {loadingMore ? "Loading…" : `Show more (${cards.length} of ${totalCount} shown)`}
                    </button>
                </div>
            )}
        </>
    );
}
