/**
 * Announcement banner (phase 1) — owner-authored site notices.
 *
 * Graceful degradation contract: until migration 165 lands the
 * table doesn't exist — any error returns [] and no banner renders.
 * Reads ride the cookie-less anon client (the banner is identical
 * for everyone; RLS serves only live rows).
 */

import { createAnonClient } from "@/lib/supabase/anon";

export interface Announcement {
    id: string;
    message: string;
    linkUrl: string | null;
    placement: "site" | "stable" | "shows";
}

type UntypedSelect = (table: string) => {
    select: (cols: string) => {
        in: (
            col: string,
            vals: string[],
        ) => {
            order: (
                col: string,
                opts: { ascending: boolean },
            ) => PromiseLike<{ data: unknown; error: unknown }>;
        };
    };
};

export async function getLiveAnnouncements(
    placements: ("site" | "stable" | "shows")[] = ["site"],
): Promise<Announcement[]> {
    try {
        const supabase = createAnonClient();
        const from = supabase.from.bind(supabase) as unknown as UntypedSelect;
        const { data, error } = await from("announcements")
            .select("id, message, link_url, placement")
            .in("placement", placements)
            .order("created_at", { ascending: false });
        if (error || !Array.isArray(data)) return [];
        return data
            .filter(
                (r): r is { id: string; message: string; link_url: string | null; placement: string } =>
                    !!r && typeof (r as { id?: unknown }).id === "string",
            )
            .map((r) => ({
                id: r.id,
                message: r.message,
                linkUrl: r.link_url ?? null,
                placement: (r.placement as Announcement["placement"]) ?? "site",
            }));
    } catch {
        return [];
    }
}
