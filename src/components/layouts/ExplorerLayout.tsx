"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface ExplorerLayoutProps {
    title: ReactNode;
    description?: ReactNode;
    headerActions?: ReactNode;
    controls?: ReactNode;
    children: ReactNode;
}

export default function ExplorerLayout({
    title,
    description,
    headerActions,
    controls,
    children,
}: ExplorerLayoutProps) {
    return (
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:py-12 lg:px-8">
            {/* Header row */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="font-serif text-3xl font-bold tracking-tight text-ink md:text-4xl">
                        {title}
                    </h1>
                    {description && (
                        <p className="mt-2 max-w-2xl text-lg leading-relaxed text-muted-foreground">{description}</p>
                    )}
                </div>
                {headerActions && <div className="flex gap-3">{headerActions}</div>}
            </div>

            {/* Controls row (sticky) */}
            {controls && (
                <div className="sticky top-[calc(var(--header-height)+1rem)] z-40 mb-8 border-b border-edge bg-[#F4EFE6]/90 pb-4 pt-2 backdrop-blur-md">
                    {controls}
                </div>
            )}

            {/* Content — animated */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
            >
                {children}
            </motion.div>
        </div>
    );
}
