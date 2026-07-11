"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface FocusLayoutProps {
    title?: ReactNode;
    description?: ReactNode;
    backLink?: ReactNode;
    /** Escape hatch: the page brings its own header (e.g. a leather masthead
     *  inside children) — suppress the default brass header + backLink. */
    noHeader?: boolean;
    children: ReactNode;
}

export default function FocusLayout({
    title,
    description,
    backLink,
    noHeader = false,
    children,
}: FocusLayoutProps) {
    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-12 sm:px-6 md:py-16">
            {!noHeader && backLink && <div>{backLink}</div>}

            {!noHeader && (
            <div>
                <div className="brass-heading">
                    <span className="brass-heading-bar" aria-hidden="true" />
                    <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                        {title}
                    </h1>
                </div>
                {description && (
                    <p className="mt-2 max-w-2xl text-lg leading-relaxed text-muted-foreground">{description}</p>
                )}
            </div>
            )}

            {/* Unruled ledger paper — Focus pages are forms/detail flows;
                the 28px green ruling would fight arbitrary field heights. */}
            <motion.div
                className="w-full ledger-paper"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
            >
                {children}
            </motion.div>
        </div>
    );
}
