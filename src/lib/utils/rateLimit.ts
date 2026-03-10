import { getAdminClient } from "@/lib/supabase/admin";
import { headers } from "next/headers";

/**
 * Database-backed rate limiter for serverless.
 * Uses Supabase RPC to check rate limits in Postgres.
 * 
 * @param endpoint - The endpoint identifier (e.g. 'claim_pin', 'contact_form')
 * @param maxAttempts - Maximum attempts allowed in the window
 * @param windowMinutes - Window duration in minutes
 * @param identifierOverride - Optional: use a specific identifier instead of IP
 * @returns true if request is allowed, false if rate-limited
 */
export async function checkRateLimit(
    endpoint: string,
    maxAttempts: number,
    windowMinutes: number,
    identifierOverride?: string,
): Promise<boolean> {
    try {
        const identifier = identifierOverride || await getClientIp();
        const supabaseAdmin = getAdminClient();

        const { data, error } = await supabaseAdmin.rpc("check_rate_limit", {
            p_identifier: identifier,
            p_endpoint: endpoint,
            p_max_attempts: maxAttempts,
            p_window_interval: `${windowMinutes} minutes`,
        });

        if (error) {
            console.error("[RateLimit] RPC error:", error.message);
            return true; // Fail open — don't block legitimate users on DB errors
        }

        return data as boolean;
    } catch (err) {
        console.error("[RateLimit] Unexpected error:", err);
        return true; // Fail open
    }
}

/**
 * Extract client IP from request headers.
 * Vercel provides x-forwarded-for; fallback to x-real-ip.
 */
async function getClientIp(): Promise<string> {
    const headersList = await headers();
    const forwarded = headersList.get("x-forwarded-for");
    if (forwarded) {
        return forwarded.split(",")[0].trim();
    }
    return headersList.get("x-real-ip") || "unknown";
}
