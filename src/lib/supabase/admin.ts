import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.generated";

let adminClient: SupabaseClient<Database> | null = null;

/**
 * Get a Supabase admin client (Service Role).
 * Only for use in server actions — NEVER import in client components.
 */
export function getAdminClient(): SupabaseClient<Database> {
    if (!adminClient) {
        adminClient = createClient<Database>(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
    }
    return adminClient;
}


