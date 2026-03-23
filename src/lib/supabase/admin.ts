import { createClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let adminClient: any = null;

/**
 * Get a Supabase admin client (Service Role).
 * Only for use in server actions — NEVER import in client components.
 * Note: Once all SQL migrations are deployed to the remote database
 * and gen-types is re-run, this can be typed with Database.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAdminClient(): any {
    if (!adminClient) {
        adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
    }
    return adminClient;
}

