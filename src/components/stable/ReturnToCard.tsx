"use client";

/**
 * Brings the card the member just opened back into view. Mounted beside
 * a stable list (dashboard, collection page). When the reader arrives
 * from a horse's passport (or its edit page) and that horse is on the
 * page being shown, its card — `id="horse-<uuid>"` — is scrolled to the
 * middle of the screen once and briefly ringed. Anything else: nothing.
 *
 * The decision is pure (lib/stable/returnTo); this only reads the nav
 * trail and touches the DOM.
 */

import { useEffect, useRef } from "react";
import { readTrail, readTrailFrom } from "@/components/nav/NavTrail";
import { returnToCardId } from "@/lib/stable/returnTo";

/** A plain ring: no new stylesheet rule, readable by day and night. */
const HIGHLIGHT = ["ring-4", "ring-forest/60", "ring-offset-2", "ring-offset-background"];
const HIGHLIGHT_MS = 2200;

export function horseCardDomId(id: string): string {
    return `horse-${id}`;
}

export default function ReturnToCard({ ids }: { ids: string[] }) {
    // The source already answered (by scrolling), so a refresh of the
    // same page — a bulk edit, router.refresh() — doesn't yank the reader back.
    const handled = useRef<string | null>(null);
    const key = ids.join(",");

    useEffect(() => {
        const from = readTrailFrom();
        const pageIds = key ? key.split(",") : [];
        const id = returnToCardId({ trail: readTrail(), from, ids: pageIds });
        if (!id) return;
        const visit = `${from ?? ""}|${id}`;
        if (handled.current === visit) return;

        let el: HTMLElement | null = null;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const unring = () => el?.classList.remove(...HIGHLIGHT);
        const frame = requestAnimationFrame(() => {
            el = document.getElementById(horseCardDomId(id));
            if (!el) return;
            handled.current = visit;
            el.scrollIntoView({ block: "center" });
            el.classList.add(...HIGHLIGHT);
            timer = setTimeout(unring, HIGHLIGHT_MS);
        });
        return () => {
            cancelAnimationFrame(frame);
            if (timer) {
                clearTimeout(timer);
                unring();
            }
        };
    }, [key]);

    return null;
}
