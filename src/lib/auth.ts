// Server-only auth utility — imported by server actions and API routes

import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export class AuthError extends Error {
    constructor(message = "Not authenticated.") {
        super(message);
        this.name = "AuthError";
    }
}

/**
 * Require an authenticated user. Returns Supabase client + user.
 * Throws AuthError if not authenticated — callers must catch and return their error format.
 *
 * Usage:
 *   const { supabase, user } = await requireAuth();
 */
export async function requireAuth(): Promise<{
    supabase: SupabaseClient;
    user: { id: string; email?: string };
}> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new AuthError();
    return { supabase, user };
}

/**
 * Get Supabase client + optional user (for pages that work both authenticated and anonymous).
 * Never throws.
 */
export async function optionalAuth(): Promise<{
    supabase: SupabaseClient;
    user: { id: string; email?: string } | null;
}> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    return { supabase, user };
}

/**
 * Get the current user's subscription tier from JWT app_metadata.
 * Zero-latency: reads from the session token, no DB query.
 * Returns 'pro' | 'free'. Defaults to 'free' if unauthenticated.
 */
export async function getUserTier(): Promise<"pro" | "free"> {
    const supabase = await createClient();
    const {
        data: { session },
    } = await supabase.auth.getSession();
    return (session?.user?.app_metadata?.tier as "pro" | "free") || "free";
}
