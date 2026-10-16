import "server-only";

/**
 * Applying and deciding catalog suggestions: the one path every approval
 * takes, whoever approves (a curator's rank, the owner's admin queue, a
 * Registry moderator on the Desk). The Registry itself is written only by
 * src/lib/catalog/write.ts; this module turns a suggestion into those
 * writes and keeps the suggestion's own bookkeeping: status, who decided
 * and in what role, the member's credit and badges, and their notice.
 *
 * Not a "use server" module: nothing here can be called from a browser.
 * Server actions check the role first, then call in.
 */

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";
import { getAdminClient } from "@/lib/supabase/admin";
import { stripGeneration } from "@/lib/linker/model";
import { fieldLabel } from "@/lib/catalog/editableFields";
import { referenceHref } from "@/lib/catalog/referenceUrl";
import {
    BRONZE_THRESHOLD,
    CONTRIBUTOR_THRESHOLD,
    GOLD_THRESHOLD,
    SILVER_THRESHOLD,
    additionYears,
    canonicalVocabulary,
    normalizeFactValue,
} from "@/lib/catalog/corrections";
import {
    deriveAttribution,
    isCatalogGender,
    normalizeCatalogBreed,
    normalizeRunCount,
    normalizeScale,
    resolveNewEntryMaker,
    suggestionItemTypeToDb,
} from "@/lib/catalog/taxonomy";
import { DUPLICATE_SUGGESTION_TYPE, duplicateTarget } from "@/lib/catalog/duplicates";
import {
    insertItem,
    isMissingSchema,
    recordChange,
    requestMerge,
    updateItem,
    type WriteErrorCode,
} from "@/lib/catalog/write";
import { ACTOR_ROLE_LABELS, type RegistryActor } from "@/lib/registry/types";

// Service role: suggestion bookkeeping crosses members (credit, badges,
// notices); callers have already checked who is acting.
function db(): SupabaseClient {
    return getAdminClient() as unknown as SupabaseClient;
}

export interface SuggestionRecord {
    id: string;
    user_id: string;
    catalog_item_id: string | null;
    suggestion_type: string;
    field_changes: Record<string, unknown>;
    reason: string;
    status: string;
    admin_notes: string | null;
    reviewed_by: string | null;
    artist_name?: string | null;
    original_field_changes?: Record<string, unknown> | null;
}

export type ApplyResult =
    | {
          ok: true;
          status: "applied" | "awaiting_second_look";
          catalogItemId: string | null;
          actionId: string | null;
          summary: string;
      }
    /** `requeued`: the apply failed and the suggestion is back in the queue with the reason. */
    | { ok: false; error: string; code?: WriteErrorCode; requeued?: boolean };

// ══════════════════════════════════════════════════════════════
// Molds a new entry is filed under (moved from catalog-suggestions.ts)
// ══════════════════════════════════════════════════════════════

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A release filed with `parent_catalog_id` (the reference linker) is
 * filed under that mold when the id names a plastic mold that exists.
 * Anything else, including a stale id, falls back to the typed mold name,
 * then to no parent and the mold_name attribute, as before.
 */
export async function resolveParentMold(
    raw: unknown,
    itemType: string,
    typed?: { moldName?: unknown; maker?: string | null; scale?: string | null },
): Promise<{ id: string; scale: string | null } | null> {
    if (itemType !== "plastic_release") return null;
    if (typeof raw === "string" && UUID_RE.test(raw)) {
        const { data } = await db()
            .from("catalog_items")
            .select("id, scale")
            .eq("id", raw)
            .eq("item_type", "plastic_mold")
            .maybeSingle();
        if (data) return { id: (data as { id: string }).id, scale: (data as { scale: string | null }).scale ?? null };
    }
    // The old suggestion form sends the mold as typed text ("G1 Arabian
    // Stallion"). Resolve it the way the linker does: same maker, same
    // scale, same name with the generation token stripped. Two molds with
    // that name resolve to the one that already carries the most releases,
    // then the older one, so the duplicate does not keep collecting children.
    const name = typeof typed?.moldName === "string" ? stripGeneration(typed.moldName).trim() : "";
    if (!name) return null;
    let query = db()
        .from("catalog_items")
        .select("id, scale, created_at")
        .eq("item_type", "plastic_mold")
        .ilike("title", name);
    if (typed?.maker) query = query.ilike("maker", typed.maker);
    const scale = normalizeScale(typed?.scale ?? null);
    if (scale) query = query.eq("scale", scale);
    const { data: molds } = await query.limit(5);
    const candidates = (molds ?? []) as { id: string; scale: string | null; created_at: string }[];
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return { id: candidates[0].id, scale: candidates[0].scale ?? null };
    const { data: kids } = await db()
        .from("catalog_items")
        .select("parent_id")
        .in(
            "parent_id",
            candidates.map((c) => c.id),
        )
        .eq("item_type", "plastic_release")
        .limit(5000);
    const counts = new Map<string, number>();
    for (const k of (kids ?? []) as { parent_id: string }[])
        counts.set(k.parent_id, (counts.get(k.parent_id) ?? 0) + 1);
    candidates.sort(
        (a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.created_at.localeCompare(b.created_at),
    );
    return { id: candidates[0].id, scale: candidates[0].scale ?? null };
}

/**
 * A mold the Registry already holds under this maker, scale and name
 * (generation token ignored). A second copy of a mold is refused
 * outright, at filing and again at approval.
 */
export async function findExistingMold(
    fc: Record<string, unknown>,
): Promise<{ id: string; title: string; scale: string | null } | null> {
    if (suggestionItemTypeToDb(fc.item_type as string | undefined) !== "plastic_mold") return null;
    const title = typeof fc.title === "string" ? fc.title : typeof fc.mold_name === "string" ? fc.mold_name : "";
    const name = stripGeneration(title).trim();
    if (!name) return null;
    const maker = typeof fc.maker === "string" ? fc.maker.trim() : "";
    const scale = normalizeScale(typeof fc.scale === "string" ? fc.scale : null);
    let q = db().from("catalog_items").select("id, title, scale").eq("item_type", "plastic_mold");
    if (maker) q = q.ilike("maker", maker);
    q = scale ? q.eq("scale", scale) : q.is("scale", null);
    const { data } = await q.limit(50);
    const hit = ((data ?? []) as { id: string; title: string; scale: string | null }[]).find(
        (m) => stripGeneration(m.title).trim().toLowerCase() === name.toLowerCase(),
    );
    return hit ?? null;
}

export function existingMoldMessage(m: { title: string; scale: string | null }): string {
    return `The Registry already has the ${m.scale ? m.scale + " " : ""}"${m.title}" mold. Add releases under it instead of a second copy.`;
}

// ══════════════════════════════════════════════════════════════
// Who may decide
// ══════════════════════════════════════════════════════════════

const norm = (s: unknown) =>
    typeof s === "string" ? s.normalize("NFKD").replace(/[̀-ͯ]/g, "").trim().toLowerCase() : "";

/**
 * Why this reviewer may not decide this suggestion, or null. Nobody
 * decides their own suggestion; an artist doesn't approve suggestions
 * about their own pieces (owner ruling Q14). The owner is exempt: the
 * owner is the last word and may have no one else to ask.
 */
export async function reviewRefusal(s: SuggestionRecord, reviewer: RegistryActor): Promise<string | null> {
    if (reviewer.role === "owner") return null;
    if (s.user_id === reviewer.userId) return "Nobody decides their own suggestion. Another moderator will.";

    const { data: profile } = await db()
        .from("artist_profiles")
        .select("studio_name, also_known_as")
        .eq("user_id", reviewer.userId)
        .maybeSingle();
    const p = profile as { studio_name: string | null; also_known_as: string[] | null } | null;
    if (!p) return null;
    const names = new Set([p.studio_name, ...(p.also_known_as ?? [])].map(norm).filter(Boolean));
    if (names.size === 0) return null;

    const credited: unknown[] = [];
    if (s.catalog_item_id) {
        const { data: item } = await db()
            .from("catalog_items")
            .select("artist, maker")
            .eq("id", s.catalog_item_id)
            .maybeSingle();
        const i = item as { artist: string | null; maker: string | null } | null;
        if (i) credited.push(i.artist, i.maker);
    }
    const fc = s.field_changes ?? {};
    for (const key of ["maker", "artist", "sculptor"]) {
        const v = fc[key];
        credited.push(v && typeof v === "object" && "to" in v ? (v as { to: unknown }).to : v);
    }
    if (s.artist_name) credited.push(s.artist_name);
    if (credited.some((c) => names.has(norm(c))))
        return "This suggestion is about your own work, so another moderator decides it.";
    return null;
}

// ══════════════════════════════════════════════════════════════
// Bookkeeping
// ══════════════════════════════════════════════════════════════

async function readSuggestion(id: string): Promise<SuggestionRecord | null> {
    const { data } = await db().from("catalog_suggestions").select("*").eq("id", id).maybeSingle();
    return (data as SuggestionRecord | null) ?? null;
}

async function aliasOf(userId: string): Promise<string> {
    const { data } = await db().from("users").select("alias_name").eq("id", userId).maybeSingle();
    return (data as { alias_name: string | null } | null)?.alias_name ?? "Unknown";
}

/**
 * An approval the Registry refused goes back to the queue with the reason,
 * so it is never marked approved while nothing changed.
 */
async function unapply(suggestionId: string, words: string): Promise<{ ok: false; error: string; requeued: true }> {
    await db()
        .from("catalog_suggestions")
        .update({ status: "pending", admin_notes: `Not applied: ${words}` })
        .eq("id", suggestionId);
    return { ok: false, error: words, requeued: true };
}

/** Write the decision; before 242 (no decided_role column) it is written without the role. */
async function stampDecision(id: string, fields: Record<string, unknown>, role: string | null): Promise<void> {
    const { error } = await db()
        .from("catalog_suggestions")
        .update({ ...fields, decided_role: role })
        .eq("id", id);
    if (!error) return;
    if (isMissingSchema(error)) {
        // Before 242: no claim or role columns.
        const { claimed_by: _claimedBy, claimed_until: _claimedUntil, ...legacy } = fields;
        void _claimedBy;
        void _claimedUntil;
        const { error: retry } = await db().from("catalog_suggestions").update(legacy).eq("id", id);
        if (retry) logger.error("SuggestionApply", "Decision stamp failed", retry);
        return;
    }
    logger.error("SuggestionApply", "Decision stamp failed", error);
}

/** The approval credit, the curator badges and the trusted flag (same thresholds as auto-approval). */
async function creditContributor(userId: string): Promise<void> {
    await db().rpc("increment_approved_suggestions", { target_user_id: userId });
    const { data: profile } = await db().from("users").select("approved_suggestions_count").eq("id", userId).single();
    const count = (profile as { approved_suggestions_count: number } | null)?.approved_suggestions_count ?? 0;
    const badges = [
        { threshold: CONTRIBUTOR_THRESHOLD, badgeId: "catalog_contributor" },
        { threshold: BRONZE_THRESHOLD, badgeId: "bronze_curator" },
        { threshold: SILVER_THRESHOLD, badgeId: "silver_curator" },
        { threshold: GOLD_THRESHOLD, badgeId: "gold_curator" },
    ];
    for (const { threshold, badgeId } of badges) {
        if (count >= threshold) {
            await db()
                .from("user_badges")
                .upsert({ user_id: userId, badge_id: badgeId }, { onConflict: "user_id,badge_id" });
        }
    }
    // Tied to Silver: the same rank that unlocks auto-approval.
    if (count >= SILVER_THRESHOLD) await db().from("users").update({ is_trusted_curator: true }).eq("id", userId);
}

async function notify(userId: string, actorId: string | null, content: string, linkUrl: string): Promise<void> {
    try {
        const { createNotification } = await import("@/lib/notifications/createNotification");
        await createNotification({ userId, type: "system", actorId, content, linkUrl });
    } catch (err) {
        logger.error("SuggestionApply", "Member notice failed (continuing)", err);
    }
}

/** "approved by @Maple, Registry moderator". */
function byLine(actor: RegistryActor): string {
    return `@${actor.alias}, ${ACTOR_ROLE_LABELS[actor.role]}`;
}

const toOf = (v: unknown) => (v && typeof v === "object" && "to" in v ? (v as { to: unknown }).to : v);

/** What the reviewer changed in the member's suggestion, in words. */
export function editDiff(original: Record<string, unknown>, edited: Record<string, unknown>): string {
    const keys = new Set([...Object.keys(original), ...Object.keys(edited)]);
    const parts: string[] = [];
    for (const k of keys) {
        const a = toOf(original[k]);
        const b = toOf(edited[k]);
        if (JSON.stringify(a ?? null) === JSON.stringify(b ?? null)) continue;
        const show = (v: unknown) => (v === undefined || v === null || v === "" ? "(empty)" : String(v));
        parts.push(`${fieldLabel(k)}: ${show(a)} → ${show(b)}`);
    }
    return parts.join(", ");
}

async function revalidateItem(itemId: string | null): Promise<void> {
    revalidatePath("/catalog");
    if (!itemId) return;
    revalidatePath(`/catalog/${itemId}`);
    const { data } = await db()
        .from("catalog_items")
        .select("maker, title, maker_slug, slug")
        .eq("id", itemId)
        .maybeSingle();
    const r = data as {
        maker: string | null;
        title: string | null;
        maker_slug: string | null;
        slug: string | null;
    } | null;
    if (r) revalidatePath(referenceHref({ id: itemId, ...r }));
}

// ══════════════════════════════════════════════════════════════
// Apply
// ══════════════════════════════════════════════════════════════

/** An approved addition's row, as the suggestion form's fields map onto the Registry. */
async function additionPayload(fc: Record<string, unknown>): Promise<Record<string, unknown>> {
    const mappedType = suggestionItemTypeToDb(fc.item_type as string | undefined);
    if (!mappedType)
        logger.error("SuggestionApply", `Unknown item_type "${String(fc.item_type)}", filing as plastic_mold`);
    const itemType = mappedType ?? "plastic_mold";
    const sculptorIn = typeof fc.sculptor === "string" ? fc.sculptor.trim() : "";
    const maker = resolveNewEntryMaker(itemType, fc.maker, fc.sculptor);
    const attribution = deriveAttribution({
        item_type: itemType,
        maker,
        sculptor: sculptorIn || null,
        manufacturer: (fc.manufacturer as string | undefined) ?? null,
    });
    const runCount = normalizeRunCount(fc.run_count);
    const breed = normalizeCatalogBreed(fc.breed);
    // The linker files a release with the id of the mold the member was
    // looking at; the release takes that mold's scale.
    const parent = await resolveParentMold(fc.parent_catalog_id, itemType, {
        moldName: fc.mold_name,
        maker,
        scale: typeof fc.scale === "string" ? fc.scale : null,
    });
    return {
        item_type: itemType,
        title: normalizeFactValue("title", fc.title ?? fc.mold_name ?? "Untitled") as string,
        maker,
        artist: attribution.artist,
        manufacturer: attribution.manufacturer,
        scale: parent?.scale ?? canonicalVocabulary("scale", fc.scale),
        ...(parent ? { parent_id: parent.id } : {}),
        attributes: {
            ...(fc.year ? additionYears(fc.year, fc.year_end) : {}),
            ...(fc.color ? { color_description: normalizeFactValue("color_description", fc.color) } : {}),
            ...(fc.model_number ? { model_number: fc.model_number } : {}),
            ...(canonicalVocabulary("material", fc.material)
                ? { material: canonicalVocabulary("material", fc.material) }
                : {}),
            ...(fc.retail_price ? { retail_price: fc.retail_price } : {}),
            ...(canonicalVocabulary("run_type", fc.run_type)
                ? { run_type: canonicalVocabulary("run_type", fc.run_type) }
                : {}),
            ...(runCount ? { run_count: runCount } : {}),
            ...(breed ? { breed } : {}),
            ...(isCatalogGender(fc.gender) ? { gender: fc.gender } : {}),
            ...(fc.sculptor ? { sculptor: fc.sculptor } : {}),
            ...(fc.mold_name && fc.title ? { mold_name: fc.mold_name } : {}),
            ...(typeof fc.set_name === "string" && fc.set_name.trim() ? { set_name: fc.set_name.trim() } : {}),
        },
    };
}

/**
 * Apply one suggestion to the Registry. `reviewer` is who approved it;
 * null means the contributor's curator rank applied it on its own. With
 * `edited`, the reviewer's version is applied and the member's original
 * is kept (edit-then-approve). A moderator's duplicate approval becomes a
 * merge request that waits for a second look; the owner's applies.
 */
export async function applySuggestion(
    id: string,
    opts: { reviewer: RegistryActor | null; edited?: Record<string, unknown>; note?: string },
): Promise<ApplyResult> {
    const s = await readSuggestion(id);
    if (!s) return { ok: false, error: "that suggestion no longer exists", code: "not_found" };

    const reviewer = opts.reviewer;
    if (reviewer) {
        if (s.status !== "pending" && s.status !== "under_review")
            return { ok: false, error: "This suggestion has already been decided.", code: "invalid" };
        const refusal = await reviewRefusal(s, reviewer);
        if (refusal) return { ok: false, error: refusal, code: "forbidden" };
        if (s.status === "under_review" && s.suggestion_type === DUPLICATE_SUGGESTION_TYPE && reviewer.role !== "owner")
            return { ok: false, error: "This merge already waits for a second look.", code: "invalid" };
    }
    if (!reviewer && s.suggestion_type === DUPLICATE_SUGGESTION_TYPE)
        return { ok: false, error: "A duplicate report always waits for a person.", code: "forbidden" };

    const alias = await aliasOf(s.user_id);
    const contributor = { userId: s.user_id, alias };
    const actor: RegistryActor = reviewer ?? { userId: s.user_id, alias, role: "curator" };

    let fc = (s.field_changes ?? {}) as Record<string, unknown>;
    if (reviewer && opts.edited && Object.keys(opts.edited).length > 0) {
        const original = s.original_field_changes ?? s.field_changes;
        const { error } = await db()
            .from("catalog_suggestions")
            .update({ field_changes: opts.edited, original_field_changes: original })
            .eq("id", s.id);
        if (error && isMissingSchema(error)) {
            await db().from("catalog_suggestions").update({ field_changes: opts.edited }).eq("id", s.id);
        }
        fc = opts.edited;
    }

    let catalogItemId = s.catalog_item_id;
    let actionId: string | null = null;
    let summary = "";

    if (s.artist_name) {
        // Artist notes (200) write the artists table, not a Registry row.
        const to = toOf(fc.registry_notes);
        const text = typeof to === "string" ? to.trim() : "";
        if (text) {
            const { error } = await db()
                .from("artists")
                .upsert(
                    { name: s.artist_name, registry_notes: text, updated_at: new Date().toISOString() },
                    { onConflict: "name" },
                );
            if (error) return unapply(s.id, "the artist's notes could not be saved");
        }
        return { ok: true, status: "applied", catalogItemId: null, actionId: null, summary: "Artist notes saved" };
    }

    if (s.suggestion_type === "correction" && s.catalog_item_id) {
        const changes: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(fc)) {
            if (v && typeof v === "object" && "to" in v) changes[k] = (v as { to: unknown }).to;
        }
        summary = `🔧 Correction: ${Object.entries(fc)
            .map(([k, v]) => {
                const val = v as { from?: unknown; to?: unknown };
                return `${fieldLabel(k)}: ${val?.from} → ${val?.to}`;
            })
            .join(", ")}`;
        const result = await updateItem(actor, {
            id: s.catalog_item_id,
            expectedUpdatedAt: null,
            changes,
            suggestionId: s.id,
            kind: "approve",
            contributor,
            summary,
            note: opts.note,
        });
        if (!result.success) return { ...(await unapply(s.id, result.error)), code: result.code };
        actionId = result.actionId;
    } else if (s.suggestion_type === "addition") {
        const payload = await additionPayload(fc);
        summary = `📗 New entry added: ${String(payload.title)}`;
        const result = await insertItem(actor, {
            payload,
            suggestionId: s.id,
            lenient: true,
            contributor,
            summary,
            note: opts.note,
        });
        if (!result.success) return { ...(await unapply(s.id, result.error)), code: result.code };
        catalogItemId = result.id;
        actionId = result.actionId;
    } else if (s.suggestion_type === DUPLICATE_SUGGESTION_TYPE && s.catalog_item_id) {
        const target = duplicateTarget(fc);
        if (!target) {
            summary = "🔁 Duplicate report approved, but one entry was already gone: nothing merged";
            await recordChange(actor, {
                itemId: s.catalog_item_id,
                changeType: s.suggestion_type,
                summary,
                suggestionId: s.id,
                contributor,
            });
        } else {
            const merged = await requestMerge(actor, {
                keepId: target.duplicate_of,
                removeId: s.catalog_item_id,
                note: opts.note ?? s.reason,
                suggestionId: s.id,
                contributor,
            });
            if (!merged.success) {
                if (merged.code === "not_found") {
                    summary = "🔁 Duplicate report approved, but one entry was already gone: nothing merged";
                    await recordChange(actor, {
                        itemId: s.catalog_item_id,
                        changeType: s.suggestion_type,
                        summary,
                        suggestionId: s.id,
                        contributor,
                    });
                } else if (merged.code === "not_ready" || merged.code === "limit" || merged.code === "forbidden") {
                    // Nothing happened; the suggestion stays where it was.
                    return { ok: false, error: merged.error, code: merged.code };
                } else {
                    return { ...(await unapply(s.id, `the merge failed (${merged.error})`)), code: merged.code };
                }
            } else {
                actionId = merged.actionId;
                summary = `🔁 ${merged.summary}`;
                if (merged.status === "awaiting_second_look") {
                    return { ok: true, status: "awaiting_second_look", catalogItemId, actionId, summary };
                }
                catalogItemId = target.duplicate_of;
            }
        }
    } else if (s.suggestion_type === "photo" || s.suggestion_type === "removal") {
        summary = s.suggestion_type === "photo" ? "📸 Reference photo added" : "🗑 Entry marked for removal";
        await recordChange(actor, {
            itemId: s.catalog_item_id,
            changeType: s.suggestion_type,
            summary,
            suggestionId: s.id,
            contributor,
        });
    }

    await creditContributor(s.user_id);
    await revalidateItem(catalogItemId);
    return { ok: true, status: "applied", catalogItemId, actionId, summary };
}

// ══════════════════════════════════════════════════════════════
// Decide
// ══════════════════════════════════════════════════════════════

export type DecideResult =
    | { success: true; status: "approved" | "rejected" | "awaiting_second_look" }
    | { success: false; error: string; code?: WriteErrorCode; requeued?: boolean };

/**
 * Approve or reject one suggestion as `reviewer`: the status, who decided
 * and in what role, and the member's notice ("approved by @Maple,
 * Registry moderator", with what was changed when the reviewer edited it
 * first). Approval applies it through applySuggestion.
 */
export async function decideSuggestion(
    id: string,
    decision: {
        reviewer: RegistryActor;
        verdict: "approved" | "rejected";
        note?: string;
        edited?: Record<string, unknown>;
    },
): Promise<DecideResult> {
    const { reviewer, verdict } = decision;
    const note = decision.note?.trim() || null;
    const s = await readSuggestion(id);
    if (!s) return { success: false, error: "Suggestion not found.", code: "not_found" };
    if (s.status !== "pending" && s.status !== "under_review")
        return { success: false, error: "This suggestion has already been decided.", code: "invalid" };
    const refusal = await reviewRefusal(s, reviewer);
    if (refusal) return { success: false, error: refusal, code: "forbidden" };
    const link = `/catalog/suggestions/${s.id}`;

    if (verdict === "rejected") {
        await stampDecision(
            s.id,
            {
                status: "rejected",
                admin_notes: note,
                reviewed_by: reviewer.userId,
                reviewed_at: new Date().toISOString(),
                claimed_by: null,
                claimed_until: null,
            },
            reviewer.role,
        );
        await notify(
            s.user_id,
            reviewer.userId,
            `❌ Your catalog suggestion was not approved by ${byLine(reviewer)}.${note ? ` Note: "${note}"` : ""}`,
            link,
        );
        revalidatePath("/catalog/suggestions");
        return { success: true, status: "rejected" };
    }

    if (s.suggestion_type === "addition") {
        const existing = await findExistingMold((decision.edited ?? s.field_changes ?? {}) as Record<string, unknown>);
        if (existing)
            return {
                success: false,
                error: existingMoldMessage(existing) + " Reject this suggestion.",
                code: "invalid",
            };
    }

    const applied = await applySuggestion(s.id, { reviewer, edited: decision.edited, note: note ?? undefined });
    if (!applied.ok) {
        revalidatePath("/catalog/suggestions");
        return { success: false, error: applied.error, code: applied.code, requeued: applied.requeued };
    }
    if (applied.status === "awaiting_second_look") {
        revalidatePath("/catalog/suggestions");
        return { success: true, status: "awaiting_second_look" };
    }

    await stampDecision(
        s.id,
        {
            status: "approved",
            admin_notes: note,
            reviewed_by: reviewer.userId,
            reviewed_at: new Date().toISOString(),
            claimed_by: null,
            claimed_until: null,
        },
        reviewer.role,
    );
    const diff = decision.edited ? editDiff(s.field_changes ?? {}, decision.edited) : "";
    await notify(
        s.user_id,
        reviewer.userId,
        `✅ Your catalog suggestion was approved by ${byLine(reviewer)}.${diff ? ` It was edited first: ${diff}.` : ""}${note ? ` Note: "${note}"` : ""}`,
        link,
    );
    revalidatePath("/catalog/suggestions");
    return { success: true, status: "approved" };
}

/**
 * A duplicate report whose merge passed its second look: approved, the
 * credit goes to the member, and they hear who approved it.
 */
export async function finishMergedSuggestion(
    suggestionId: string,
    who: { requester: { userId: string; alias: string }; confirmer: RegistryActor },
): Promise<void> {
    const s = await readSuggestion(suggestionId);
    if (!s || s.status === "approved") return;
    await stampDecision(
        s.id,
        {
            status: "approved",
            reviewed_by: who.requester.userId,
            reviewed_at: new Date().toISOString(),
            claimed_by: null,
            claimed_until: null,
        },
        "moderator",
    );
    await creditContributor(s.user_id);
    await notify(
        s.user_id,
        who.confirmer.userId,
        `✅ Your duplicate report was approved by @${who.requester.alias}, Registry moderator, and the two entries are merged.`,
        `/catalog/suggestions/${s.id}`,
    );
    revalidatePath("/catalog/suggestions");
}

/**
 * An applied suggestion taken back (a revert, or an undone approval):
 * marked rejected with the reason, the approval credit returned, and the
 * author told who did it and why.
 */
export async function withdrawApproval(
    suggestionId: string,
    actor: RegistryActor,
    reason: string,
    drifted: string[] = [],
): Promise<void> {
    const s = await readSuggestion(suggestionId);
    if (!s) return;
    await stampDecision(
        s.id,
        {
            status: "rejected",
            admin_notes: `Reverted: ${reason}${drifted.length ? ` (kept, changed since: ${drifted.join(", ")})` : ""}`,
            reviewed_by: actor.userId,
            reviewed_at: new Date().toISOString(),
        },
        actor.role,
    );
    // A reverted change must not count toward the curator ladder.
    const { data: authorRow } = await db()
        .from("users")
        .select("approved_suggestions_count")
        .eq("id", s.user_id)
        .single();
    const current = (authorRow as { approved_suggestions_count: number } | null)?.approved_suggestions_count ?? 0;
    await db()
        .from("users")
        .update({ approved_suggestions_count: Math.max(0, current - 1) })
        .eq("id", s.user_id);
    await notify(
        s.user_id,
        actor.userId,
        `↩️ ${byLine(actor)} reverted your catalog correction. Note: "${reason}"`,
        `/catalog/suggestions/${s.id}`,
    );
    revalidatePath(`/catalog/suggestions/${s.id}`);
    revalidatePath("/catalog/suggestions");
}
