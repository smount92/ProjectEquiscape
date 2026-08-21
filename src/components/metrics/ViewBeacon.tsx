"use client";

import { useEffect, useRef } from "react";
import type { EntityType } from "@/lib/metrics/entities";

/**
 * One fire-and-forget ping saying "somebody looked at this object".
 *
 * Renders null. No wrapper element, no layout shift, nothing to style —
 * mounting it is a one-line addition to a page and cannot change how that
 * page looks. It sets no cookie and writes nothing to localStorage; the
 * dedupe that makes `unique_viewers` meaningful happens server-side against
 * a hash that is thrown away nightly (see supabase/migrations/175).
 *
 * Two deliberate consequences of doing this in the browser rather than in
 * the server render:
 *
 *   - Crawlers and prefetches mostly do not run it, so the counts lean
 *     toward actual humans without any user-agent sniffing.
 *   - It runs identically in Simple Mode. This is server-side counting of
 *     an object, not a tracker following a person, so there is nothing for
 *     a reduced-interface mode to opt out of.
 *
 * Failure is not handled because failure does not matter: if the request
 * is refused, blocked by an extension, or the route does not exist yet,
 * the number simply does not move.
 */
export default function ViewBeacon({
    entityType,
    entityId,
    secondaryType,
}: {
    entityType: EntityType;
    entityId: string;
    /**
     * An optional second bucket for the same object — used by the horse
     * passport, where a for-sale horse arrived at from the market counts
     * as a listing view as well as a horse view.
     */
    secondaryType?: EntityType;
}) {
    // StrictMode invokes effects twice in development; the ref survives
    // the remount, so the beacon still fires exactly once.
    const fired = useRef(false);

    useEffect(() => {
        if (fired.current) return;
        if (!entityId) return;
        fired.current = true;

        try {
            void fetch("/api/beacon/view", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ t: entityType, id: entityId, t2: secondaryType }),
                keepalive: true,
                credentials: "same-origin",
            }).catch(() => {
                // Counting must never surface to the reader.
            });
        } catch {
            // Same.
        }
    }, [entityType, entityId, secondaryType]);

    return null;
}
