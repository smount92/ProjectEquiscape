"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface CommandCenterLayoutProps {
    title: ReactNode;
    description?: ReactNode;
    headerActions?: ReactNode;
    mainContent: ReactNode;
    sidebarContent?: ReactNode;
}

export default function CommandCenterLayout({
    title,
    description,
    headerActions,
    mainContent,
    sidebarContent,
}: CommandCenterLayoutProps) {
    return (
        <div className="mx-auto w-full max-w-[1920px] px-4 py-8 sm:px-6 md:py-12 lg:px-8">
            {/* Header row */}
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="font-serif text-3xl font-bold tracking-tight text-ink md:text-4xl">
                        {title}
                    </h1>
                    {description && (
                        <p className="mt-1 text-muted">{description}</p>
                    )}
                </div>
                {headerActions && <div className="flex gap-3">{headerActions}</div>}
            </div>

            {/* Dashboard grid — only use 2-col when sidebar exists */}
            {sidebarContent ? (
                <motion.div
                    className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_320px] 2xl:grid-cols-[1fr_360px]"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                >
                    <main className="flex min-w-0 flex-col gap-8">{mainContent}</main>
                    <aside className="flex flex-col gap-6">{sidebarContent}</aside>
                </motion.div>
            ) : (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                >
                    <main className="flex min-w-0 flex-col gap-8">{mainContent}</main>
                </motion.div>
            )}
        </div>
    );
}
