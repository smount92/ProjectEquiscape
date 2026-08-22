// Server-only auth utility — imported by server actions and API routes

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { entitledTier } from "@/lib/entitlement/clock";
import type { SupabaseClient } from "@supabase/supabase-js";

export class AuthError extends Error {
    constructor(message = "Not authenticated.") {
        super(message);
        this.name = "AuthError";
    }
}

/**
 * getUser() is a network call to the auth server every time, and the
 * auth server sits on the same Postgres as everything else. A single
 * page render used to ask "who is this?" three to eight times through
 * the four helpers below; `cache()` makes it once per request.
 *
 * Deliberately memoizes the whole `{ supabase, user }` pair so callers
 * keep getting a client alongside the user, as they always have.
 */
const resolveViewer = cache(async function resolveViewer(): Promise<{
    supabase: SupabaseClient;
    user: { id: string; email?: string; app_metadata?: Record<string, unknown> } | null;
}> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    return { supabase, user };
});

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
    const { supabase, user } = await resolveViewer();
    if (!user) throw new AuthError();
    // Suspension gate (v4 safety): suspendUser() stamps app_metadata
    // via the auth admin API, so this costs no extra query — getUser()
    // is server-validated. Read surfaces (optionalAuth) stay open;
    // every mutation funnels through here.
    if (user.app_metadata?.is_suspended) {
        throw new AuthError("This account is suspended.");
    }
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
    return resolveViewer();
}

/**
 * Require the platform admin (ADMIN_EMAIL). Returns Supabase client + user.
 * Throws AuthError if not authenticated OR not the admin — callers catch and
 * return their error format. Use on every admin-only server action: a hidden
 * UI is not authorization; the action itself must gate.
 *
 * Usage:
 *   const { supabase, user } = await requireAdmin();
 */
export async function requireAdmin(): Promise<{
    supabase: SupabaseClient;
    user: { id: string; email?: string };
}> {
    const { supabase, user } = await resolveViewer();
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
    if (!user || !adminEmail || user.email?.toLowerCase() !== adminEmail) {
        throw new AuthError("Admin access required.");
    }
    return { supabase, user };
}

export type UserTier = "studio" | "pro" | "free";

/**
 * Get the current user's subscription tier from app_metadata.
 * Uses getUser() (server-validated) instead of getSession() (cached JWT)
 * to ensure tier changes are reflected immediately.
 * Returns 'studio' | 'pro' | 'free'. Defaults to 'free' if unauthenticated.
 * (The old signature claimed 'pro' | 'free' — studio passed through the
 * value untyped and then failed every `=== "pro"` gate, denying paying
 * Studio subscribers the Pro benefits their tier includes. Use isPro().)
 *
 * THE CLOCK IS APPLIED HERE, and this is the only place it has to be
 * applied for the site to be correct. A prepaid or fixed term whose
 * `paid_through` has passed reads as `free` on the very next request —
 * no cron has to run, and there is no window in which an ended term
 * still opens a door. See src/lib/entitlement/clock.ts.
 *
 * Members with no `paid_through` — which today is all of them, and every
 * open-ended Stripe or PayPal subscriber forever — are completely
 * unaffected: absent means "no expiry", never "expired".
 */
export async function getUserTier(): Promise<UserTier> {
    const { user } = await resolveViewer();
    if (!user) return "free";
    // Admin always gets Pro
    if (user.email?.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase()) return "pro";
    return entitledTier(user.app_metadata);
}

/** Studio includes everything in Pro — every Pro gate must use this. */
export function isPro(tier: UserTier | string | null | undefined): boolean {
    return tier === "pro" || tier === "studio";
}
