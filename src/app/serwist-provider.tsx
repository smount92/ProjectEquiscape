"use client";

import { useEffect } from "react";

export function SerwistProvider({ swUrl, children }: { swUrl: string; children: React.ReactNode }) {
    useEffect(() => {
        if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
            navigator.serviceWorker.register(swUrl, { scope: "/" }).catch((err) => {
                console.warn("SW registration failed:", err);
            });
        }
    }, [swUrl]);

    return <>{children}</>;
}
