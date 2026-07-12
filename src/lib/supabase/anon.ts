import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.generated";

/**
 * Cookie-less anonymous Supabase client for public, anon-safe reads.
 *
 * The SSR client (`@/lib/supabase/server`) reads cookies to resolve the session,
 * which forces any page that uses it to render dynamically (per-request SSR).
 * This client never touches cookies, so pages built purely on anon-safe data
 * (the public reference pages) can be statically generated / ISR-cached instead
 * — fast for visitors, and it keeps a full Googlebot crawl of ~11k pages off the
 * hot request path. Anon RLS + anon-granted RPCs apply; NEVER use it for
 * user-scoped or privileged data.
 */
export function createAnonClient() {
    return createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
    );
}
