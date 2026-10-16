"use server";

/**
 * The reference linker's reads and the two ways it writes.
 *
 * Reads run on the member's own client (catalog_items is public), the
 * same fuzzy RPC the old picker uses, plus two things the old picker
 * never did: a model-number path, and the set rows that name a mold in
 * their title so a Stablemate Arabian Mare stops looking empty.
 *
 * Writes go through createSuggestion like every other member edit. An
 * added release carries `parent_catalog_id`, which the approval path now
 * honours, so a release added from the linker is filed under its mold
 * instead of becoming one more orphan.
 */

import { createClient } from "@/lib/supabase/server";
import { parseCatalogQuery, makerMatches } from "@/lib/catalog/queryParse";
import { referenceHref } from "@/lib/catalog/referenceUrl";
import { createSuggestion } from "@/app/actions/catalog-suggestions";
import { containsEveryWord, sameWords, searchKey } from "@/lib/catalog/searchKey";
import { rosterLast } from "@/lib/catalog/moldSearch";
import {
    collapseSetPieces,
    commonOne,
    factCorrection,
    generationOf,
    markAmbiguous,
    mentionsMold,
    normalizeTerm,
    orderReleases,
    parseTerm,
    rosterPrefilterWords,
    scaleMatches,
    setLabel,
    stripGeneration,
    type LinkerMold,
    type LinkerMoldSummary,
    type LinkerOther,
    type LinkerRelease,
    type LinkerResult,
    type NumberHit,
} from "@/lib/linker/model";

type Row = {
    id: string;
    item_type: string;
    parent_id: string | null;
    title: string;
    maker: string | null;
    scale: string | null;
    attributes: Record<string, unknown> | null;
    maker_slug?: string | null;
    slug?: string | null;
};

const COLS = "id, item_type, parent_id, title, maker, scale, attributes, maker_slug, slug";
const MAX_MOLDS = 6;

function num(v: unknown): number | null {
    const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
    return Number.isFinite(n) ? n : null;
}
function str(v: unknown): string | null {
    return typeof v === "string" && v.trim() ? v.trim() : null;
}

function toRelease(r: Row, isSetPiece: boolean, photos: Record<string, string>): LinkerRelease {
    const a = r.attributes ?? {};
    const model = str(a.model_number)?.replace(/^#/, "") ?? null;
    return {
        id: r.id,
        title: r.title,
        model,
        look: str(a.color_description),
        from: num(a.release_year_start),
        to: num(a.release_year_end),
        run: str(a.run_type),
        setName: setLabel(r.title),
        isSetPiece,
        photo: photos[r.id] ?? null,
        scale: r.scale,
    };
}

function toSummary(r: Row, releaseCount: number): LinkerMoldSummary {
    const a = r.attributes ?? {};
    return {
        id: r.id,
        title: stripGeneration(r.title),
        maker: r.maker ?? "",
        scale: r.scale,
        generation: generationOf(r.title),
        year: num(a.release_year_start),
        releaseCount,
        href: referenceHref({ id: r.id, maker: r.maker, title: r.title, maker_slug: r.maker_slug, slug: r.slug }),
    };
}

function toOther(r: Row): LinkerOther {
    return {
        id: r.id,
        title: r.title,
        itemType: r.item_type,
        maker: r.maker ?? "",
        scale: r.scale,
        look: str(r.attributes?.color_description),
        href: referenceHref({ id: r.id, maker: r.maker, title: r.title, maker_slug: r.maker_slug, slug: r.slug }),
    };
}

type Client = Awaited<ReturnType<typeof createClient>>;

async function photosFor(supabase: Client, ids: string[]): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    if (ids.length === 0) return out;
    try {
        const rpc = supabase.rpc as unknown as (
            fn: string,
            args: { p_ids: string[] },
        ) => Promise<{ data: { catalog_id: string; image_url: string }[] | null }>;
        const { data } = await rpc("get_catalog_browse_thumbs", { p_ids: ids.slice(0, 200) });
        for (const row of data ?? []) if (row.image_url) out[row.catalog_id] = row.image_url;
    } catch {
        /* no thumbs */
    }
    return out;
}

async function ownersOf(supabase: Client, moldId: string): Promise<number | null> {
    try {
        const { data, error } = await supabase.rpc("count_catalog_collectors", { p_catalog_id: moldId });
        if (error) return null;
        return Number(data ?? 0);
    } catch {
        return null;
    }
}

/**
 * Candidate set rows for a mold: a title with "with" and every word of the
 * mold's name, in any order. `mentionsMold` then keeps only rows that list
 * the mold as a whole piece; this read is the coarse sieve, sized so a
 * common name (Thoroughbred, 120+ sets) is never cut short (MHH-074).
 */
function setCandidates(supabase: Client, mold: Row, limit: number) {
    let q = supabase
        .from("catalog_items")
        .select(COLS)
        .eq("item_type", "plastic_release")
        .neq("parent_id", mold.id)
        .ilike("title", "%with%");
    for (const w of rosterPrefilterWords(mold.title)) q = q.ilike("title", `%${w.replace(/[%_]/g, "")}%`);
    return q.limit(limit);
}

/** A mold's own releases plus the set rows on other molds whose title names it. */
async function expandMold(supabase: Client, mold: Row, hitIds: Set<string> = new Set()): Promise<LinkerMold> {
    const [{ data: own }, { data: sets }, owners] = await Promise.all([
        supabase
            .from("catalog_items")
            .select(COLS)
            .eq("parent_id", mold.id)
            .eq("item_type", "plastic_release")
            .limit(400),
        setCandidates(supabase, mold, 400),
        ownersOf(supabase, mold.id),
    ]);
    const ownRows = (own ?? []) as Row[];
    const setRows = ((sets ?? []) as Row[]).filter(
        (r) =>
            mentionsMold(r.title, stripGeneration(mold.title)) && (!mold.scale || !r.scale || r.scale === mold.scale),
    );
    const photos = await photosFor(
        supabase,
        [...ownRows, ...setRows].map((r) => r.id),
    );
    const releases = collapseSetPieces(
        orderReleases([
            ...ownRows.map((r) => ({ ...toRelease(r, false, photos), hit: hitIds.has(r.id) })),
            ...setRows.map((r) => ({ ...toRelease(r, true, photos), look: null, hit: hitIds.has(r.id) })),
        ]),
    );
    const a = mold.attributes ?? {};
    return {
        id: mold.id,
        title: stripGeneration(mold.title),
        maker: mold.maker ?? "",
        scale: mold.scale,
        generation: generationOf(mold.title),
        sculptor: str(a.sculptor),
        year: num(a.release_year_start),
        owners,
        releases,
        ambiguous: false,
        href: referenceHref({
            id: mold.id,
            maker: mold.maker,
            title: mold.title,
            maker_slug: mold.maker_slug,
            slug: mold.slug,
        }),
    };
}

async function releaseCounts(supabase: Client, moldIds: string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (moldIds.length === 0) return out;
    const { data } = await supabase
        .from("catalog_items")
        .select("parent_id")
        .in("parent_id", moldIds)
        .eq("item_type", "plastic_release")
        .limit(5000);
    for (const r of (data ?? []) as { parent_id: string }[]) out.set(r.parent_id, (out.get(r.parent_id) ?? 0) + 1);
    return out;
}

/**
 * One search for the linker. `scale` is a canonical scale string or null/"any".
 */
export async function searchLinker(rawTerm: string, scale: string | null): Promise<LinkerResult> {
    const supabase = await createClient();
    const chosen = scale && scale !== "any" ? scale : null;
    const parsed = parseTerm(rawTerm);
    const empty: LinkerResult = {
        term: rawTerm,
        kind: parsed.kind,
        scale: chosen,
        molds: [],
        otherScales: [],
        others: [],
        numberHits: [],
    };
    if (parsed.kind === "empty") return empty;

    if (parsed.kind === "number") {
        const n = parsed.value;
        const { data } = await supabase
            .from("catalog_items")
            .select(COLS)
            .eq("item_type", "plastic_release")
            // PostgREST or(): `*` is the wildcard and a space inside a clause breaks it,
            // so the title prefix is matched loosely here and tightened below.
            .or(
                `attributes->>model_number.ilike.${n},attributes->>model_number.ilike.#${n},title.ilike.#${n}*,title.ilike.${n}*`,
            )
            .limit(40);
        const exact = new RegExp("^#?" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(\\s|$)", "i");
        const rows = ((data ?? []) as Row[]).filter((r) => {
            const m = str(r.attributes?.model_number)?.replace(/^#/, "").toLowerCase();
            return m === n || exact.test(r.title);
        });
        const parentIds = [...new Set(rows.map((r) => r.parent_id).filter((x): x is string => !!x))];
        const { data: parents } = parentIds.length
            ? await supabase.from("catalog_items").select(COLS).in("id", parentIds)
            : { data: [] as Row[] };
        const counts = await releaseCounts(supabase, parentIds);
        const parentMap = new Map(((parents ?? []) as Row[]).map((p) => [p.id, p]));
        const photos = await photosFor(
            supabase,
            rows.map((r) => r.id),
        );
        // Every scale is shown for a number: a member who typed it knows what they hold.
        const hits: NumberHit[] = rows.map((r) => {
            const p = r.parent_id ? parentMap.get(r.parent_id) : undefined;
            return { mold: p ? toSummary(p, counts.get(p.id) ?? 0) : null, release: toRelease(r, false, photos) };
        });
        // In-scale rows first, then the rest, so a Stablemate member sees the Stablemate #5022 before a Classic #5022.
        hits.sort(
            (a, b) => Number(!scaleMatches(a.release.scale, chosen)) - Number(!scaleMatches(b.release.scale, chosen)),
        );
        return { ...empty, numberHits: hits };
    }

    // Text: the same fuzzy RPC as the old picker, on a term with alias words stripped.
    const q = parseCatalogQuery(normalizeTerm(parsed.value));
    const term = q.term.length >= 2 ? q.term : normalizeTerm(parsed.value);
    const { data } = await supabase.rpc("search_catalog_fuzzy", { search_term: term, max_results: 80 });
    let rows = ((data ?? []) as Row[]).filter((r) => !q.maker || makerMatches(r.maker, q.maker));

    // Releases whose mold did not surface by itself still point at it.
    const moldIds = new Set(rows.filter((r) => r.item_type === "plastic_mold").map((r) => r.id));
    const missingParents = [
        ...new Set(
            rows
                .filter((r) => r.item_type === "plastic_release" && r.parent_id && !moldIds.has(r.parent_id))
                .map((r) => r.parent_id as string),
        ),
    ];
    if (missingParents.length) {
        const { data: parents } = await supabase
            .from("catalog_items")
            .select(COLS)
            .in("id", missingParents.slice(0, 20));
        rows = rows.concat((parents ?? []) as Row[]);
    }

    const termLower = stripGeneration(term).toLowerCase();
    // A release whose own name matches ("Montana Harvest") pulls its mold in,
    // with that release leading the group; the mold's name need not match.
    // Only the release's own name counts, not the roster after "With": a set
    // that lists Silky Sullivan among its pieces must not drag Man O' War in.
    const hitReleases = rows.filter(
        (r) =>
            r.item_type === "plastic_release" &&
            r.parent_id &&
            titleMatches(r.title.replace(/\s+with\s+.*$/i, ""), termLower),
    );
    const hitIds = new Set(hitReleases.map((r) => r.id));
    const viaRelease = new Map<string, string>();
    for (const r of hitReleases)
        if (!viaRelease.has(r.parent_id as string)) viaRelease.set(r.parent_id as string, r.title);
    const named = (r: Row) => titleMatches(r.title, termLower) || viaRelease.has(r.id);
    const allMolds = rows.filter((r) => r.item_type === "plastic_mold");
    // Named matches first; when nothing is named, the three closest names so the member is not stranded.
    const moldPool = allMolds.some(named) ? allMolds.filter(named) : allMolds.slice(0, 3);
    const molds = moldPool.sort((a, b) => {
        const ea = sameWords(stripGeneration(a.title), termLower) ? 0 : 1;
        const eb = sameWords(stripGeneration(b.title), termLower) ? 0 : 1;
        return ea - eb;
    });
    const inScale = molds.filter((m) => scaleMatches(m.scale, chosen)).slice(0, MAX_MOLDS);
    const outScale = chosen ? molds.filter((m) => !scaleMatches(m.scale, chosen)).slice(0, 12) : [];

    const [expanded, counts] = await Promise.all([
        // A mold found by its own name gets no "matches your search" rows: its
        // regular run and its set rows carry that name too, and tagging them
        // would mean nothing. Only a mold reached through a release gets them.
        Promise.all(
            inScale.map((m) => expandMold(supabase, m, titleMatches(m.title, termLower) ? new Set<string>() : hitIds)),
        ),
        releaseCounts(
            supabase,
            outScale.map((m) => m.id),
        ),
    ]);
    const marked = markAmbiguous(expanded);
    for (const m of marked) {
        const common = commonOne(m.releases);
        if (common)
            m.releases = m.releases.map((r) => (r.id === common ? { ...r, run: r.run ?? "the common one" } : r));
    }

    // A piece found only in a set's roster comes after pieces found by their own name (MHH-075).
    const otherRows = rows.filter(
        (r) => r.item_type !== "plastic_mold" && r.item_type !== "plastic_release" && titleMatches(r.title, termLower),
    );
    const otherOrder = rosterLast(
        otherRows.map((r) => r.id),
        otherRows,
        term,
    );
    const otherById = new Map(otherRows.map((r) => [r.id, r]));
    const others = otherOrder
        .slice(0, 12)
        .map((id) => otherById.get(id) as Row)
        .map(toOther);

    return {
        ...empty,
        molds: marked,
        otherScales: outScale.map((m) => ({
            ...toSummary(m, counts.get(m.id) ?? 0),
            ...(viaRelease.has(m.id) ? { hitTitle: viaRelease.get(m.id) } : {}),
        })),
        others,
    };
}

/** "Mine isn't here": file a release under the mold the member is looking at. */
export async function fileReleaseUnderMold(input: {
    moldId: string;
    name?: string;
    modelNumber?: string;
    look?: string;
    yearFrom?: string;
    setName?: string;
    note?: string;
}): Promise<{ success: true; suggestionId?: string; autoApproved?: boolean } | { success: false; error: string }> {
    const supabase = await createClient();
    const { data: mold } = await supabase
        .from("catalog_items")
        .select(COLS)
        .eq("id", input.moldId)
        .eq("item_type", "plastic_mold")
        .maybeSingle();
    if (!mold) return { success: false, error: "That mold is not in the Registry any more." };
    const m = mold as Row;
    const model = (input.modelNumber ?? "").trim().replace(/^#/, "");
    const look = (input.look ?? "").trim();
    const name = (input.name ?? "").trim();
    const set = (input.setName ?? "").trim();
    if (!model && !look) return { success: false, error: "Give at least a model number or what it looks like." };
    const title = name || set || stripGeneration(m.title);
    const year = parseInt((input.yearFrom ?? "").trim(), 10);
    const result = await createSuggestion({
        catalogItemId: null,
        suggestionType: "addition",
        confirmDuplicates: true,
        fieldChanges: {
            title,
            item_type: "release",
            maker: m.maker,
            manufacturer: m.maker,
            scale: m.scale,
            mold_name: m.title,
            parent_catalog_id: m.id,
            ...(model ? { model_number: model } : {}),
            ...(look ? { color: look } : {}),
            ...(Number.isFinite(year) ? { year } : {}),
            ...(set ? { set_name: set } : {}),
        },
        reason: `Added from the reference linker while linking a horse${input.note?.trim() ? ": " + input.note.trim() : "."}`,
    });
    if (!result.success) return { success: false, error: ("error" in result && result.error) || "Could not file it." };
    return {
        success: true,
        suggestionId: (result as { id?: string }).id,
        autoApproved: (result as { autoApproved?: boolean }).autoApproved,
    };
}

/** "Fill in what you know": one fact on one release. */
export async function fileReleaseFact(input: {
    catalogId: string;
    fact: "colour" | "year" | "model number";
    value: string;
    /** The row is a set piece filed under another mold (see ReleaseRow). */
    isSetPiece?: boolean;
}): Promise<{ success: true } | { success: false; error: string }> {
    const value = input.value.trim();
    if (!value) return { success: false, error: "Type the value first." };
    // A set row's colour describes the piece on the mold it is filed under.
    // A colour for a different piece of the set would overwrite it.
    if (input.isSetPiece && input.fact === "colour") {
        return {
            success: false,
            error: 'This row is the set, filed under another mold. Use "Add my release" to record your piece\'s colour.',
        };
    }
    const field =
        input.fact === "colour" ? "color_description" : input.fact === "year" ? "release_year_start" : "model_number";
    if (field === "release_year_start" && !/^\d{4}$/.test(value))
        return { success: false, error: "Use a four-digit year." };
    // The correction carries what the Registry holds today as `from`, so the
    // queue shows a real diff and a revert knows what to put back.
    const supabase = await createClient();
    const { data: row } = await supabase
        .from("catalog_items")
        .select("attributes")
        .eq("id", input.catalogId)
        .maybeSingle();
    const current = ((row as { attributes?: Record<string, unknown> | null } | null)?.attributes ?? {})[field];
    const result = await createSuggestion({
        catalogItemId: input.catalogId,
        suggestionType: "correction",
        fieldChanges: factCorrection(field, current, value),
        reason: "Filled in from the reference linker by a member holding the horse.",
    });
    if (!result.success) return { success: false, error: ("error" in result && result.error) || "Could not file it." };
    return { success: true };
}

/**
 * The row's name is the term, or contains it, or the term contains it ("G1
 * Silky Sullivan" vs "Silky Sullivan"), or holds every word of it in another
 * order ("Morgan - Prancing" for Prancing Morgan). Compared as search keys,
 * so quotes, hyphens and apostrophes never decide it (MHH-080).
 */
function titleMatches(title: string, termLower: string): boolean {
    const term = searchKey(termLower);
    if (!term) return true;
    const t = searchKey(stripGeneration(title));
    if (!t) return false;
    return t.includes(term) || term.includes(t) || containsEveryWord(t, term);
}

export type MoldChoice = { id: string; title: string; maker: string; scale: string | null };

/**
 * Molds for the "Belongs to mold" picker on the new-entry form: a name
 * match, the member's maker and scale first. Picking one sends the mold's
 * id with the suggestion, so the approved release is filed under it
 * instead of matching typed text later.
 */
export async function pickMold(rawTerm: string, maker: string | null, scale: string | null): Promise<MoldChoice[]> {
    const term = stripGeneration(
        rawTerm
            .replace(/[%*,()]/g, " ")
            .replace(/\s+/g, " ")
            .trim(),
    ).trim();
    if (term.length < 2) return [];
    const supabase = await createClient();
    const search = (makerOnly: string | null) => {
        let q = supabase
            .from("catalog_items")
            .select("id, title, maker, scale")
            .eq("item_type", "plastic_mold")
            .ilike("title", `%${term}%`)
            .order("title")
            .limit(40);
        if (makerOnly) q = q.eq("maker", makerOnly);
        return q;
    };
    // The member's own maker first: common words ("Mare", "Stallion") match
    // hundreds of molds, and theirs must not fall outside the first 40.
    const own = maker ? (((await search(maker)).data ?? []) as MoldChoice[]) : [];
    const rest = own.length >= 8 ? [] : (((await search(null)).data ?? []) as MoldChoice[]);
    const seen = new Set<string>();
    const rows = [...own, ...rest].filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
    const rank = (m: MoldChoice) =>
        (maker && m.maker.toLowerCase() === maker.toLowerCase() ? 0 : 2) + (scale && m.scale === scale ? 0 : 1);
    return rows.sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title)).slice(0, 8);
}
