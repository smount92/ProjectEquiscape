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
import type { HorseDocumentView } from "@/lib/shows/documents";
import type { ConsoleClass, ConsoleDivision, ConsoleSection } from "@/lib/shows/console";
import type {
    ClassStatus,
    ShowJudging,
    ShowMode,
    ShowStatus,
    StaffRole,
    DivisionAxis,
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
/**
 * Show identity for the judge's card: sex · breed · color, from the
 * HORSE first and the REGISTRY (catalog) as fallback — the judge
 * needs to know what she's looking at even when the owner never
 * filled the fields in. Blind-safe: nothing here identifies a person.
 */
export async function getHorseShowIdentities(
    supabase: SupabaseClient,
    horseIds: string[],
): Promise<Map<string, string> | { error: string }> {
    const unique = [...new Set(horseIds)];
    if (unique.length === 0) return new Map();
    const { data, error } = await supabase
        .from("user_horses")
        .select(
            "id, assigned_breed, assigned_gender, finish_type, catalog_items:catalog_id(attributes)",
        )
        .in("id", unique);
    if (error) return { error: error.message };
    const out = new Map<string, string>();
    for (const raw of data ?? []) {
        const r = raw as unknown as {
            id: string;
            assigned_breed: string | null;
            assigned_gender: string | null;
            finish_type: string | null;
            catalog_items: { attributes: Record<string, unknown> | null } | null;
        };
        const cat = r.catalog_items?.attributes ?? {};
        const sex = r.assigned_gender || (cat.gender as string | undefined) || null;
        const breed = r.assigned_breed || (cat.breed as string | undefined) || null;
        const color = (cat.color_description as string | undefined) || r.finish_type || null;
        const line = [sex, breed, color].filter(Boolean).join(" · ");
        if (line) out.set(r.id, line);
    }
    return out;
}

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

/**
 * A horse's documentation, oldest first. RLS decides who sees what:
 * the owner sees all of it; a public horse's documents are public
 * once 209 is applied; before that, non-owners see only documents
 * attached to a visible show entry. Tolerant — a read error is an
 * empty list, never a broken passport.
 */
export async function getHorseDocuments(
    supabase: SupabaseClient,
    horseId: string,
): Promise<HorseDocumentView[]> {
    const { data, error } = await supabase
        .from("horse_documents")
        .select("id, kind, title, body_md, updated_at")
        .eq("horse_id", horseId)
        .order("created_at", { ascending: true });
    if (error) return [];
    const rows = (data ?? []) as {
        id: string;
        kind: string;
        title: string;
        body_md: string;
        updated_at: string;
    }[];
    return rows.map((d) => ({
        id: d.id,
        kind: d.kind,
        title: d.title,
        bodyMd: d.body_md,
        updatedAt: d.updated_at,
    }));
}

/**
 * The classlist tree with live entry + exhibitor counts per class —
 * the SAME walk for the public show page and the admin's sanctioning
 * review, so what the admin reviews is exactly what entrants see.
 * RLS on the supplied client decides visibility (the review passes
 * the service-role client behind verifyAdmin).
 */
export async function loadShowProgram(
    supabase: SupabaseClient,
    showId: string,
): Promise<
    | { divisions: ConsoleDivision[]; entryCount: number; exhibitorCount: number }
    | { error: string }
> {
    const { data: divisionRows, error: dErr } = await supabase
        .from("show_divisions")
        .select("id, name, axis, sort_order")
        .eq("show_id", showId)
        .order("sort_order", { ascending: true });
    if (dErr) return { error: dErr.message };
    const divisionIds = (divisionRows ?? []).map((d: { id: string }) => d.id);

    let sectionRows: { id: string; division_id: string; name: string; sort_order: number }[] = [];
    let classRows: {
        id: string;
        section_id: string;
        name: string;
        class_number: string | null;
        status: string;
        max_per_entrant: number | null;
        allowed_scales: string[] | null;
        allowed_finishes: string[] | null;
        is_qualifying: boolean;
        sort_order: number;
    }[] = [];
    if (divisionIds.length > 0) {
        const { data: sections, error: sErr } = await supabase
            .from("show_sections")
            .select("id, division_id, name, sort_order")
            .in("division_id", divisionIds)
            .order("sort_order", { ascending: true });
        if (sErr) return { error: sErr.message };
        sectionRows = sections ?? [];

        const sectionIds = sectionRows.map((s) => s.id);
        if (sectionIds.length > 0) {
            const { data: classes, error: cErr } = await supabase
                .from("show_classes")
                .select(
                    "id, section_id, name, class_number, status, max_per_entrant, allowed_scales, allowed_finishes, is_qualifying, sort_order",
                )
                .in("section_id", sectionIds)
                .order("sort_order", { ascending: true });
            if (cErr) return { error: cErr.message };
            classRows = classes ?? [];
        }
    }

    // Live entry + exhibitor counts per class (scratched excluded).
    const { data: entryRows, error: eErr } = await supabase
        .from("show_class_entries")
        .select("class_id, status, owner_id")
        .eq("show_id", showId);
    if (eErr) return { error: eErr.message };
    const liveEntries = ((entryRows ?? []) as { class_id: string; status: string; owner_id: string }[]).filter(
        (r) => r.status !== "scratched",
    );
    const entryCountByClass = new Map<string, number>();
    const exhibitorsByClass = new Map<string, Set<string>>();
    const exhibitors = new Set<string>();
    for (const r of liveEntries) {
        entryCountByClass.set(r.class_id, (entryCountByClass.get(r.class_id) ?? 0) + 1);
        const set = exhibitorsByClass.get(r.class_id) ?? new Set<string>();
        set.add(r.owner_id);
        exhibitorsByClass.set(r.class_id, set);
        exhibitors.add(r.owner_id);
    }

    const classesBySection = new Map<string, ConsoleClass[]>();
    for (const c of classRows) {
        const list = classesBySection.get(c.section_id) ?? [];
        list.push({
            id: c.id,
            name: c.name,
            classNumber: c.class_number,
            status: c.status as ClassStatus,
            maxPerEntrant: c.max_per_entrant,
            allowedScales: c.allowed_scales,
            allowedFinishes: c.allowed_finishes,
            isQualifying: c.is_qualifying,
            sortOrder: c.sort_order,
            entryCount: entryCountByClass.get(c.id) ?? 0,
            exhibitorCount: exhibitorsByClass.get(c.id)?.size ?? 0,
        });
        classesBySection.set(c.section_id, list);
    }
    const sectionsByDivision = new Map<string, ConsoleSection[]>();
    for (const sec of sectionRows) {
        const list = sectionsByDivision.get(sec.division_id) ?? [];
        list.push({
            id: sec.id,
            name: sec.name,
            sortOrder: sec.sort_order,
            classes: classesBySection.get(sec.id) ?? [],
        });
        sectionsByDivision.set(sec.division_id, list);
    }
    const divisions: ConsoleDivision[] = (
        (divisionRows ?? []) as { id: string; name: string; axis: string; sort_order: number }[]
    ).map((d) => ({
        id: d.id,
        name: d.name,
        axis: d.axis as DivisionAxis,
        sortOrder: d.sort_order,
        sections: sectionsByDivision.get(d.id) ?? [],
    }));

    return { divisions, entryCount: liveEntries.length, exhibitorCount: exhibitors.size };
}
