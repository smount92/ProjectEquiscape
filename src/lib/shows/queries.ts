/**
 * Shows domain — SHARED QUERY HELPERS for the shows-v2 server
 * actions (src/app/actions/shows-v2.ts and shows-v2-ring.ts).
 *
 * Extracted here (Phase E2) because "use server" files may only
 * export async server actions — these helpers take a SupabaseClient
 * and must stay internal plumbing, never network-callable endpoints.
 * Every caller passes its OWN client, so RLS still gates every row.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { getPublicImageUrl } from "@/lib/utils/storage";
import type {
    ClassStatus,
    ShowJudging,
    ShowMode,
    ShowStatus,
    StaffRole,
} from "./types";

export interface ShowCore {
    id: string;
    host_id: string;
    status: ShowStatus;
    mode: ShowMode;
    judging: ShowJudging;
}

/**
 * Load the show and resolve the caller's role on it.
 * Role 'host' comes from shows.host_id; delegated roles from show_staff.
 */
export async function getShowRole(
    supabase: SupabaseClient,
    showId: string,
    userId: string,
): Promise<{ show: ShowCore; role: StaffRole | null } | { error: string }> {
    const { data: show, error } = await supabase
        .from("shows")
        .select("id, host_id, status, mode, judging")
        .eq("id", showId)
        .maybeSingle();
    if (error) return { error: error.message };
    if (!show) return { error: "Show not found." };

    if (show.host_id === userId) return { show: show as ShowCore, role: "host" };

    const { data: staff } = await supabase
        .from("show_staff")
        .select("role")
        .eq("show_id", showId)
        .eq("user_id", userId)
        .maybeSingle();

    return { show: show as ShowCore, role: (staff?.role as StaffRole) ?? null };
}

/** Resolve user ids to alias_name in one query. */
export async function getAliases(
    supabase: SupabaseClient,
    userIds: string[],
): Promise<Map<string, string> | { error: string }> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return new Map();
    // Anon-safe: the users table is SELECT TO authenticated (migrations
    // 022/109), so a direct read returns nothing for logged-out visitors →
    // "@unknown" on public show pages. get_public_aliases (migration 136) is a
    // DEFINER RPC granted to anon that returns only alias_name. Fall back to the
    // direct read if the RPC isn't deployed yet (authed still resolves).
    const rpc = supabase.rpc.bind(supabase) as unknown as (
        fn: string,
        args: { p_ids: string[] },
    ) => Promise<{ data: { id: string; alias_name: string | null }[] | null; error: unknown }>;
    const { data: rpcData, error: rpcErr } = await rpc("get_public_aliases", { p_ids: unique });
    if (!rpcErr && rpcData) {
        return new Map(rpcData.map((r) => [r.id, r.alias_name ?? "unknown"]));
    }

    const { data, error } = await supabase
        .from("users")
        .select("id, alias_name")
        .in("id", unique);
    if (error) return { error: error.message };
    return new Map(
        (data ?? []).map((r: { id: string; alias_name: string | null }) => [
            r.id,
            r.alias_name ?? "unknown",
        ]),
    );
}

/** Horse display names in one query. */
export async function getHorseNames(
    supabase: SupabaseClient,
    horseIds: string[],
): Promise<Map<string, string> | { error: string }> {
    const unique = [...new Set(horseIds)];
    if (unique.length === 0) return new Map();
    const { data, error } = await supabase
        .from("user_horses")
        .select("id, custom_name")
        .in("id", unique);
    if (error) return { error: error.message };
    return new Map(
        (data ?? []).map((r: { id: string; custom_name: string | null }) => [
            r.id,
            r.custom_name ?? "Unnamed horse",
        ]),
    );
}

/** Entry photo urls: photo_id → public storage URL. */
export async function getEntryPhotoUrls(
    supabase: SupabaseClient,
    photoIds: string[],
): Promise<Map<string, string> | { error: string }> {
    const unique = [...new Set(photoIds)];
    if (unique.length === 0) return new Map();
    const { data, error } = await supabase
        .from("horse_images")
        .select("id, image_url")
        .in("id", unique);
    if (error) return { error: error.message };
    return new Map(
        (data ?? []).map((r: { id: string; image_url: string }) => [
            r.id,
            getPublicImageUrl(r.image_url),
        ]),
    );
}

/** Flat class context (skips cancelled/combined classes), ordered
 *  by division → section → class sort. */
export interface ClassContext {
    classId: string;
    className: string;
    classNumber: string | null;
    status: ClassStatus;
    sectionId: string;
    sectionName: string;
    divisionId: string;
    divisionName: string;
}

/** Classlist tree flattened to run order, plus the section/division
 *  lists themselves (the callback ladder needs the structure). */
export interface ClassContextTree {
    contexts: ClassContext[];
    sections: { id: string; name: string; divisionId: string }[];
    divisions: { id: string; name: string }[];
}

export async function loadClassContexts(
    supabase: SupabaseClient,
    showId: string,
): Promise<ClassContextTree | { error: string }> {
    const { data: divisionRows, error: dErr } = await supabase
        .from("show_divisions")
        .select("id, name, sort_order")
        .eq("show_id", showId)
        .order("sort_order", { ascending: true });
    if (dErr) return { error: dErr.message };
    const divisions = (divisionRows ?? []) as { id: string; name: string }[];
    if (divisions.length === 0) return { contexts: [], sections: [], divisions: [] };

    const { data: sectionRows, error: sErr } = await supabase
        .from("show_sections")
        .select("id, name, division_id, sort_order")
        .in("division_id", divisions.map((d) => d.id))
        .order("sort_order", { ascending: true });
    if (sErr) return { error: sErr.message };
    const sections = (sectionRows ?? []) as { id: string; name: string; division_id: string }[];
    if (sections.length === 0) {
        return { contexts: [], sections: [], divisions };
    }

    const { data: classRows, error: cErr } = await supabase
        .from("show_classes")
        .select("id, name, class_number, status, section_id, sort_order")
        .in("section_id", sections.map((s) => s.id))
        .order("sort_order", { ascending: true });
    if (cErr) return { error: cErr.message };

    const divisionById = new Map(divisions.map((d) => [d.id, d]));

    // Walk sections in their division-major order so the flat list
    // matches the published classlist; classes are already sorted.
    const divisionIndex = new Map(divisions.map((d, i) => [d.id, i]));
    const orderedSections = [...sections].sort(
        (a, b) =>
            (divisionIndex.get(a.division_id) ?? 0) - (divisionIndex.get(b.division_id) ?? 0),
    );

    const contexts: ClassContext[] = [];
    for (const section of orderedSections) {
        for (const c of classRows ?? []) {
            if (c.section_id !== section.id) continue;
            const status = c.status as ClassStatus;
            if (status === "cancelled" || status === "combined") continue;
            contexts.push({
                classId: c.id as string,
                className: c.name as string,
                classNumber: (c.class_number as string | null) ?? null,
                status,
                sectionId: section.id,
                sectionName: section.name,
                divisionId: section.division_id,
                divisionName: divisionById.get(section.division_id)?.name ?? "",
            });
        }
    }
    return {
        contexts,
        sections: orderedSections.map((s) => ({
            id: s.id,
            name: s.name,
            divisionId: s.division_id,
        })),
        divisions,
    };
}
