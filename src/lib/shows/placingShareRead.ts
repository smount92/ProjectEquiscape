/**
 * Shows domain — the ONE read behind the public placing page, its
 * generateMetadata, and its OG image (SHARE-YOUR-PLACING).
 *
 * Anon-safe by construction: every table touched is anon-readable
 * for visible shows (RLS 118 — shows / classes / sections /
 * divisions / entries / placings), the alias comes from the
 * anon-granted get_public_aliases RPC (136), and horse name /
 * photo reads fall under the public-horse anon policies (112).
 * Callers pass either the cookie-bound session client (the page)
 * or the cookie-less anon client (metadata + OG image) — same
 * result either way for published results.
 *
 * PUBLIC-DATA GATE: returns null — the caller 404s — unless the
 * show's results are published (status completed/archived), the
 * entry is live (not scratched), and the entry actually placed.
 * Pre-publish placings never leave this function even for staff:
 * the celebration page simply does not exist until results do.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { RESULTS_STATUSES } from "./gallery";
import { isValidPlace } from "./placings";
import { getAliases, getEntryPhotoUrls, getHorseNames } from "./queries";
import type { Place, ShowMode, ShowStatus } from "./types";
import { resolveShowRecordDate } from "./writeShowRecords";

export interface PublicPlacingData {
    show: {
        id: string;
        title: string;
        mode: ShowMode;
        status: ShowStatus;
        /** The result's date (same rule as the trophy case). */
        resultDate: string | null;
    };
    entry: {
        id: string;
        entryNumber: number | null;
        horseId: string;
    };
    place: Place;
    horseName: string;
    ownerAlias: string;
    /** Public storage URL of the entry photo; null = no photo. */
    photoUrl: string | null;
    className: string;
    classNumber: string | null;
    sectionName: string | null;
    divisionName: string | null;
    /** Live entries in the class (the "of N entries" field). */
    totalEntries: number;
}

/**
 * OG-card photo loader. Entry photos are webp (the upload
 * pipeline's output) and satori/ImageResponse cannot decode webp —
 * so the OG route fetches a JPEG rendition through Supabase's
 * image-transform endpoint and inlines it as a data URI (satori
 * never fetches the image itself, so no Accept-header roulette).
 * Any failure — transform unavailable, non-Supabase URL, network —
 * returns null and the card renders its 🐴 block instead of
 * breaking the share preview.
 */
export async function loadOgPhotoDataUri(photoUrl: string | null): Promise<string | null> {
    if (!photoUrl) return null;
    const candidates = photoUrl.includes("/storage/v1/object/public/")
        ? [
              `${photoUrl.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/")}?width=800&quality=80`,
              photoUrl,
          ]
        : [photoUrl];
    for (const url of candidates) {
        try {
            const res = await fetch(url, { headers: { Accept: "image/jpeg, image/png" } });
            if (!res.ok) continue;
            const type = res.headers.get("content-type") ?? "";
            if (!/image\/(jpeg|png|gif)/.test(type)) continue; // webp et al: satori can't
            const buf = Buffer.from(await res.arrayBuffer());
            return `data:${type.split(";")[0]};base64,${buf.toString("base64")}`;
        } catch {
            // try the next candidate
        }
    }
    return null;
}

export async function loadPublicPlacing(
    supabase: SupabaseClient,
    showId: string,
    entryId: string,
): Promise<PublicPlacingData | null> {
    // ── The show — results must be PUBLISHED ──
    const { data: show } = await supabase
        .from("shows")
        .select("id, title, mode, status, show_date, entries_close_at, judging_ends_at")
        .eq("id", showId)
        .maybeSingle();
    if (!show || !RESULTS_STATUSES.includes(show.status as ShowStatus)) return null;

    // ── The entry — must belong to this show and be live ──
    const { data: entry } = await supabase
        .from("show_class_entries")
        .select("id, class_id, horse_id, owner_id, entry_number, photo_id, status")
        .eq("id", entryId)
        .eq("show_id", showId)
        .maybeSingle();
    if (!entry || entry.status === "scratched") return null;

    // ── The placing — participation rows have no share page ──
    const { data: placing } = await supabase
        .from("show_placings")
        .select("place")
        .eq("entry_id", entryId)
        .eq("class_id", entry.class_id as string)
        .maybeSingle();
    const place = placing?.place as number | null | undefined;
    if (place === null || place === undefined || !isValidPlace(place)) return null;

    // ── Class → section → division names ──
    const { data: cls } = await supabase
        .from("show_classes")
        .select("id, name, class_number, section_id")
        .eq("id", entry.class_id as string)
        .maybeSingle();
    if (!cls) return null;

    let sectionName: string | null = null;
    let divisionName: string | null = null;
    const { data: section } = await supabase
        .from("show_sections")
        .select("name, division_id")
        .eq("id", cls.section_id as string)
        .maybeSingle();
    if (section) {
        sectionName = section.name as string;
        const { data: division } = await supabase
            .from("show_divisions")
            .select("name")
            .eq("id", section.division_id as string)
            .maybeSingle();
        divisionName = (division?.name as string | undefined) ?? null;
    }

    // ── The field: live entries in the class ──
    const { data: classEntries } = await supabase
        .from("show_class_entries")
        .select("id, status")
        .eq("class_id", entry.class_id as string);
    const totalEntries = (classEntries ?? []).filter(
        (e: { status: string }) => e.status !== "scratched",
    ).length;

    // ── Names + photo (anon-safe helper reads) ──
    const horseNames = await getHorseNames(supabase, [entry.horse_id as string]);
    const aliases = await getAliases(supabase, [entry.owner_id as string]);
    const photoUrls = entry.photo_id
        ? await getEntryPhotoUrls(supabase, [entry.photo_id as string])
        : new Map<string, string>();

    return {
        show: {
            id: show.id as string,
            title: show.title as string,
            mode: show.mode as ShowMode,
            status: show.status as ShowStatus,
            resultDate: resolveShowRecordDate({
                id: show.id as string,
                title: show.title as string,
                mode: show.mode as ShowMode,
                showDate: (show.show_date as string | null) ?? null,
                entriesCloseAt: (show.entries_close_at as string | null) ?? null,
                judgingEndsAt: (show.judging_ends_at as string | null) ?? null,
            }),
        },
        entry: {
            id: entry.id as string,
            entryNumber: (entry.entry_number as number | null) ?? null,
            horseId: entry.horse_id as string,
        },
        place,
        horseName:
            horseNames instanceof Map
                ? (horseNames.get(entry.horse_id as string) ?? "Unnamed horse")
                : "Unnamed horse",
        ownerAlias:
            aliases instanceof Map ? (aliases.get(entry.owner_id as string) ?? "unknown") : "unknown",
        photoUrl:
            entry.photo_id && photoUrls instanceof Map
                ? (photoUrls.get(entry.photo_id as string) ?? null)
                : null,
        className: cls.name as string,
        classNumber: (cls.class_number as string | null) ?? null,
        sectionName,
        divisionName,
        totalEntries,
    };
}
