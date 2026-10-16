/**
 * Scheduled jobs report a heartbeat (MHH-029, migration 237).
 *
 * withHeartbeat wraps a cron route's handler: every authorised run records
 * when it ran and whether it worked. Admin › Ops reads the table and shows a
 * job as late when it hasn't succeeded for longer than its schedule allows.
 * Recording never breaks the job: before 237 is pasted it quietly does
 * nothing.
 */
import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

/** Every scheduled job, its schedule in words, and how long before it counts as late. */
export const CRON_JOBS = [
    { job: "transition-shows", schedule: "every hour", lateAfterHours: 3 },
    { job: "ebay-price-signals", schedule: "every 4 hours", lateAfterHours: 10 },
    { job: "refresh-market", schedule: "every day", lateAfterHours: 30 },
    { job: "stablemaster-agent", schedule: "every month", lateAfterHours: 24 * 33 },
] as const;

export type CronJob = (typeof CRON_JOBS)[number]["job"];

type Untyped = {
    from: (t: string) => {
        upsert: (r: Record<string, unknown>, o: { onConflict: string }) => PromiseLike<{ error: unknown }>;
    };
};

async function record(job: CronJob, ok: boolean, error?: string): Promise<void> {
    try {
        const now = new Date().toISOString();
        const db = getAdminClient() as unknown as Untyped;
        await db
            .from("cron_heartbeats")
            .upsert(
                ok
                    ? { job, last_run_at: now, last_ok_at: now }
                    : { job, last_run_at: now, last_failed_at: now, last_error: (error ?? "failed").slice(0, 500) },
                { onConflict: "job" },
            );
    } catch (err) {
        logger.warn("Heartbeat", `Could not record ${job}`, err);
    }
}

/** Run a cron handler and record the outcome. Unauthorised pokes (401) are not runs. */
export async function withHeartbeat(
    job: CronJob,
    request: NextRequest,
    handler: (request: NextRequest) => Promise<Response>,
): Promise<Response> {
    let response: Response;
    try {
        response = await handler(request);
    } catch (err) {
        await record(job, false, err instanceof Error ? err.message : String(err));
        throw err;
    }
    if (response.status === 401) return response;
    if (response.status >= 500) {
        const body = await response
            .clone()
            .text()
            .catch(() => "");
        await record(job, false, `HTTP ${response.status} ${body}`.trim());
    } else {
        await record(job, true);
    }
    return response;
}

export interface CronHealth {
    job: CronJob;
    schedule: string;
    lastRunAt: string | null;
    lastOkAt: string | null;
    lastFailedAt: string | null;
    lastError: string | null;
    state: "ok" | "late" | "failing" | "unknown";
}

/** The state of one job from its row (pure; tested). */
export function cronState(
    row: { last_ok_at: string | null; last_failed_at: string | null } | null,
    lateAfterHours: number,
    now: Date = new Date(),
): CronHealth["state"] {
    if (!row || (!row.last_ok_at && !row.last_failed_at)) return "unknown";
    const ok = row.last_ok_at ? Date.parse(row.last_ok_at) : 0;
    const failed = row.last_failed_at ? Date.parse(row.last_failed_at) : 0;
    if (failed > ok) return "failing";
    if (now.getTime() - ok > lateAfterHours * 3600_000) return "late";
    return "ok";
}
