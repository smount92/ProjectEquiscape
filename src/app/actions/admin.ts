"use server";

import { createClient } from "@supabase/supabase-js";
import { createClient as createAuthClient } from "@/lib/supabase/server";

/**
 * Toggle a contact message's is_read status.
 * Uses service role to bypass RLS on contact_messages.
 * Only the admin (matched by ADMIN_EMAIL) can call this.
 */
export async function toggleMessageRead(
    messageId: string,
    isRead: boolean
): Promise<{ success: boolean; error?: string }> {
    // Verify the caller is the admin
    const authClient = await createAuthClient();
    const {
        data: { user },
    } = await authClient.auth.getUser();

    if (!user || user.email !== process.env.ADMIN_EMAIL) {
        return { success: false, error: "Unauthorized" };
    }

    // Use service role to bypass RLS
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabaseAdmin
        .from("contact_messages")
        .update({ is_read: isRead })
        .eq("id", messageId);

    if (error) {
        return { success: false, error: error.message };
    }

    return { success: true };
}
