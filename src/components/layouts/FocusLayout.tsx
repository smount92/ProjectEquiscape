"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface FocusLayoutProps {
    title: ReactNode;
    description?: ReactNode;
    backLink?: ReactNode;
    children: ReactNode;
}

export default function FocusLayout({
    title,
    description,
    backLink,
    children,
}: FocusLayoutProps) {
    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-12 sm:px-6 md:py-16">
            {backLink && <div>{backLink}</div>}

            <div>
                <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                    {title}
                </h1>
                {description && (
                    <p className="mt-2 max-w-2xl text-lg leading-relaxed text-muted-foreground">{description}</p>
                )}
            </div>

            <motion.div
                className="w-full"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
            >
                {children}
            </motion.div>
        </div>
    );
}
