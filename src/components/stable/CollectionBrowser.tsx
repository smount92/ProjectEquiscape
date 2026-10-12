"use client";

/**
 * Collection page grid (Digital Stable v2) — the shared StableHorseCard
 * plus the same numbered pages as the dashboard (?page=&per= in the
 * URL, so Back from a horse lands on the page it was opened from, and
 * ReturnToCard brings its card back into view). No filter bar here;
 * the fixed collection filter is baked in.
 */

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import StableHorseCard from "@/components/stable/StableHorseCard";
import StablePagination from "@/components/stable/StablePagination";
import ReturnToCard from "@/components/stable/ReturnToCard";
import { stableHref, withPage, withPer, type StablePer } from "@/lib/stable/filterParams";
import type { StableCard } from "@/lib/stable/types";

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
    cards,
    totalCount,
    page,
    per,
    pageCount,
}: {
    cards: StableCard[];
    totalCount: number;
    page: number;
    per: StablePer;
    pageCount: number;
}) {
    const router = useRouter();
    const path = usePathname();

    const goToPage = useCallback(
        (p: number) =>
            router.push(stableHref(withPage({ sort: "newest", per }, Math.max(1, Math.min(p, pageCount))), path)),
        [path, per, pageCount, router],
    );
    const changePer = useCallback(
        (next: StablePer) => {
            if (next !== per) router.push(stableHref(withPer({ sort: "newest", page, per }, next), path));
        },
        [page, path, per, router],
    );

    return (
        <>
            <StablePagination
                placement="top"
                page={page}
                pageCount={pageCount}
                per={per}
                totalCount={totalCount}
                shown={cards.length}
                onPage={goToPage}
                onPer={changePer}
            />

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

            <StablePagination
                placement="bottom"
                page={page}
                pageCount={pageCount}
                per={per}
                totalCount={totalCount}
                shown={cards.length}
                onPage={goToPage}
                onPer={changePer}
            />
            <ReturnToCard ids={cards.map((c) => c.id)} />
        </>
    );
}
