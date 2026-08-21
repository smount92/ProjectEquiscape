/**
 * POST /api/beacon/view — the view counter's entire write path.
 *
 * A tracked page mounts <ViewBeacon> (src/components/metrics/ViewBeacon.tsx),
 * which fires one keepalive fetch here and ignores the answer. This route
 * therefore has exactly one job and one prohibition: increment a counter,
 * and never make a page's problem out of anything that goes wrong. It
 * answers 204 for success, for junk input, for a database that has not had
 * migration 175 pasted yet, and for its own internal errors. The only
 * status it ever varies is 429, which exists so a runaway loop is visible
 * in the logs rather than silent.
 *
 * What crosses the wire: an entity type from a seven-item allow-list and an
 * entity id. No page URL, no referrer, no title, no session token, no
 * cookie set. The viewer's identity is turned into a daily-salted hash HERE
 * (src/lib/metrics/hash.ts) and only the hash is passed to Postgres, so the
 * database never receives a user id or an IP at all.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isEntityType, isValidEntityId, type EntityType } from "@/lib/metrics/entities";
import { hashViewer, utcDay } from "@/lib/metrics/hash";
import { allowBeacon } from "@/lib/metrics/rateLimit";
import { isMissingMetricsSchema, metricsDb } from "@/lib/metrics/db";

// The viewer hash uses node:crypto, and the session read is cookie-bound.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Every path out of here is a 204 unless it is a 429. */
const NO_CONTENT = new NextResponse(null, { status: 204 });

function clientIp(request: NextRequest): string {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    return request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: NextRequest) {
    try {
        const ip = clientIp(request);
        if (!allowBeacon(ip)) {
            return new NextResponse(null, { status: 429 });
        }

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NO_CONTENT;
        }

        const payload = body as { t?: unknown; id?: unknown; t2?: unknown };

        if (!isEntityType(payload.t) || !isValidEntityId(payload.id)) {
            return NO_CONTENT;
        }

        // At most one secondary type: a for-sale horse reached from the
        // market counts as both a horse view and a listing view, so the
        // seller's total is not split across two numbers while the admin
        // can still see marketplace pull separately.
        const types: EntityType[] = [payload.t];
        if (isEntityType(payload.t2) && payload.t2 !== payload.t) {
            types.push(payload.t2);
        }

        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        const viewerHash = hashViewer(
            {
                userId: user?.id ?? null,
                ip,
                userAgent: request.headers.get("user-agent"),
            },
            utcDay(),
        );

        // Called with the caller's own anon/authed key, not the service
        // role: record_object_view is SECURITY DEFINER precisely so that
        // no key on this path needs write access to the counter tables.
        const { error } = await metricsDb(supabase).rpc("record_object_view", {
            p_entity_types: types,
            p_entity_id: payload.id,
            p_viewer_hash: viewerHash,
            p_is_member: !!user,
        });

        if (error && !isMissingMetricsSchema(error)) {
            // A real failure is worth knowing about, but not worth an
            // error response — the page has already rendered.
            console.error("[ViewBeacon] record_object_view failed:", error.message);
        }

        return NO_CONTENT;
    } catch {
        // Belt and braces. A counter must never be the reason a request
        // 500s, even in a way nobody would see.
        return NO_CONTENT;
    }
}
