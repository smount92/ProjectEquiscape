"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Get data for the Header component: alias, avatar URL, unread notification count.
 * Called on every page load via the root layout.
 * @returns Header display data or null if not authenticated
 */
export async function getHeaderData() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { user: null, aliasName: null, avatarUrl: null, unreadCount: 0 };
    }

    // Fetch alias_name
    const { data: profile } = await supabase
        .from("users")
        .select("alias_name, avatar_url")
        .eq("id", user.id)
        .single();

    const aliasName = profile?.alias_name ?? null;
    const avatarUrl = profile?.avatar_url ?? null;

    // Fetch unread count
    const { data: convos } = await supabase
        .from("conversations")
        .select("id")
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);

    let unreadCount = 0;
    if (convos && convos.length > 0) {
        const convoIds = convos.map((c: { id: string }) => c.id);
        const { count } = await supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .in("conversation_id", convoIds)
            .neq("sender_id", user.id)
            .eq("is_read", false);

        unreadCount = count ?? 0;
    }

    // Check admin status server-side (never expose admin email to client)
    const isAdmin = !!user.email && !!process.env.ADMIN_EMAIL &&
        user.email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase();

    // Check if user has an artist profile (for nav link)
    const { data: artistProfile } = await supabase
        .from("artist_profiles")
        .select("studio_slug")
        .eq("user_id", user.id)
        .maybeSingle();

    return {
        user: { id: user.id, email: user.email },
        aliasName,
        avatarUrl,
        unreadCount,
        isAdmin,
        artistStudioSlug: (artistProfile as { studio_slug: string } | null)?.studio_slug || null,
    };
}
