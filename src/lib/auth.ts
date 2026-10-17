// Server-only auth utility — imported by server actions and API routes

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { entitledTier } from "@/lib/entitlement/clock";
import { seatIsActive } from "@/lib/registry/types";
import type { SupabaseClient } from "@supabase/supabase-js";
// (getAdminClient is imported lazily inside resolveRegistryRole: it is
// "server-only", and client components import types from this file.)
import type { Database } from "@/lib/types/database.generated";

/** The AuthError message requireAuth() throws for a suspended account. */
export const SUSPENDED_AUTH_ERROR = "This account is suspended.";

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
    supabase: SupabaseClient<Database>;
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
    supabase: SupabaseClient<Database>;
    user: { id: string; email?: string };
}> {
    const { supabase, user } = await resolveViewer();
    if (!user) throw new AuthError();
    // Suspension gate (v4 safety): suspendUser() stamps app_metadata
    // via the auth admin API, so this costs no extra query — getUser()
    // is server-validated. Read surfaces (optionalAuth) stay open;
    // every mutation funnels through here.
    if (user.app_metadata?.is_suspended) {
        throw new AuthError(SUSPENDED_AUTH_ERROR);
    }
    return { supabase, user };
}

/**
 * Get Supabase client + optional user (for pages that work both authenticated and anonymous).
 * Never throws.
 */
export async function optionalAuth(): Promise<{
    supabase: SupabaseClient<Database>;
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
    supabase: SupabaseClient<Database>;
    user: { id: string; email?: string };
}> {
    const { supabase, user } = await resolveViewer();
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
    if (!user || !adminEmail || user.email?.toLowerCase() !== adminEmail) {
        throw new AuthError("Admin access required.");
    }
    return { supabase, user };
}

// ══════════════════════════════════════════════════════════════
// Registry moderators (migration 242, Registry Desk Phase 1)
// ══════════════════════════════════════════════════════════════

/** Who may use the Registry Desk. The owner always; a moderator while their seat is active. */
export type RegistryRole = "owner" | "moderator";

/** The words a member who is not a Registry moderator sees from any Desk action. */
export const REGISTRY_DESK_REFUSAL = "The Registry Desk is for Registry moderators.";

/** What a moderator whose 12-month term has run out sees from any Desk action. */
export const REGISTRY_TERM_ENDED =
    "Your term as a Registry moderator has ended, so the Registry Desk is closed to you. The site owner can renew it.";

export { seatIsActive };

function isOwnerEmail(email: string | undefined): boolean {
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
    return !!adminEmail && email?.toLowerCase() === adminEmail;
}

type RegistrySeat = { userId: string; alias: string; role: RegistryRole };

/**
 * The viewer's Registry role, read once per request. The seat is read
 * with the service role (registry_moderators has no policies), so a
 * removed moderator is refused on their very next request, and so is one
 * whose 12-month term has run out (term_ends_at in the past), even while
 * the seat still says "active". Before 242 the table is missing and only
 * the owner has a role.
 */
const resolveRegistryRole = cache(async function resolveRegistryRole(): Promise<RegistrySeat | null> {
    return (await resolveRegistrySeat()).seat;
});

const resolveRegistrySeat = cache(async function resolveRegistrySeat(): Promise<{
    seat: RegistrySeat | null;
    termEnded: boolean;
}> {
    const none = { seat: null, termEnded: false };
    const { user } = await resolveViewer();
    if (!user) return none;
    // A suspended account has no Desk, whatever its seat says.
    if (user.app_metadata?.is_suspended) return none;
    const { getAdminClient } = await import("@/lib/supabase/admin");
    const admin = getAdminClient();
    const owner = isOwnerEmail(user.email);
    let alias = owner ? "Owner" : "";
    try {
        const { data } = await admin.from("users").select("alias_name").eq("id", user.id).maybeSingle();
        const name = (data as { alias_name: string | null } | null)?.alias_name;
        if (name) alias = name;
    } catch {
        /* the alias is cosmetic; the role check below decides */
    }
    if (owner) return { seat: { userId: user.id, alias, role: "owner" }, termEnded: false };
    try {
        const { data, error } = await (admin as unknown as SupabaseClient)
            .from("registry_moderators")
            .select("status, term_ends_at")
            .eq("user_id", user.id)
            .maybeSingle();
        // 42P01 / PGRST205: no 242 yet, so nobody but the owner has a seat.
        if (error || !data) return none;
        const row = data as { status: string; term_ends_at?: string | null };
        if (!seatIsActive(row)) return { seat: null, termEnded: row.status === "active" };
    } catch {
        return none;
    }
    return { seat: { userId: user.id, alias: alias || "member", role: "moderator" }, termEnded: false };
});

/**
 * The viewer's Registry role, or null. Never throws: use it to decide
 * whether to show a link to the Desk. Actions use requireRegistryModerator.
 */
export async function registryRoleOf(): Promise<{ userId: string; alias: string; role: RegistryRole } | null> {
    try {
        return await resolveRegistryRole();
    } catch {
        return null;
    }
}

/**
 * Require the owner or an active Registry moderator. Calls requireAuth()
 * first, so a suspended account is refused before any role check. Throws
 * AuthError: "Please log in" style for no session, the suspension words,
 * or REGISTRY_DESK_REFUSAL. Callers catch and return their error format.
 */
export async function requireRegistryModerator(): Promise<{
    supabase: SupabaseClient<Database>;
    user: { id: string; email?: string };
    role: RegistryRole;
    alias: string;
}> {
    const { supabase, user } = await requireAuth();
    const { seat, termEnded } = await resolveRegistrySeat();
    if (!seat || seat.userId !== user.id) throw new AuthError(termEnded ? REGISTRY_TERM_ENDED : REGISTRY_DESK_REFUSAL);
    return { supabase, user, role: seat.role, alias: seat.alias };
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
