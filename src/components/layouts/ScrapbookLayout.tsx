"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface ScrapbookLayoutProps {
    breadcrumbs?: ReactNode;
    leftContent: ReactNode;
    rightContent: ReactNode;
    belowContent?: ReactNode;
}

export default function ScrapbookLayout({
    breadcrumbs,
    leftContent,
    rightContent,
    belowContent,
}: ScrapbookLayoutProps) {
    return (
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:py-12 lg:px-8">
            {breadcrumbs && <div className="mb-6">{breadcrumbs}</div>}

            <motion.div
                className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-12"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
            >
                {/* Left: Gallery / Timeline */}
                <div className="flex flex-col gap-8">{leftContent}</div>

                {/* Right: Data card (sticky on desktop) */}
                <div className="flex flex-col gap-6 lg:sticky lg:top-[calc(var(--header-height)+2rem)]">
                    {rightContent}
                </div>
            </motion.div>

            {belowContent && <div className="mt-12">{belowContent}</div>}
        </div>
    );
}
