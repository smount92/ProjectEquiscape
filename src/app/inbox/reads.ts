import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getPublicImageUrls } from "@/lib/utils/storage";
import { resolveAvatarUrl } from "@/lib/utils/avatars.server";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
    dealDb,
    getDealColumnSupport,
    isMissingSchema,
    type DealColumnSupport,
} from "@/lib/deals/columnSupport";
import { coerceTerms, type DealTerms } from "@/lib/deals/terms";
import { coerceInstallments, type Installment } from "@/lib/deals/ledger";
import {
    coerceKind,
    coercePayload,
    previewLine,
    type MessageKind,
} from "@/lib/deals/transcript";
import {
    inferKind,
    stageForTransaction,
    type DealKind,
    type DealParty,
    type DealStage,
} from "@/lib/deals/vocabulary";
import {
    buildEvidencePack,
    type EvidencePack,
    type EvidenceParty,
} from "@/lib/deals/evidence";

/**
 * INBOX READS — the queries behind the deal room.
 *
 * Kept out of the "use server" action files (which may only export async
 * functions that are safe to expose as endpoints) and marked
 * `server-only`, mirroring src/app/profile/reads.ts.
 *
 * The shapes these replace, for the record:
 *
 *   · The inbox list loaded EVERY message the user had ever received,
 *     with no limit, and reduced in JS for previews and unread counts.
 *     It then built an `.or()` filter with one
 *     `metadata->>conversation_id.eq.<uuid>` clause PER CONVERSATION
 *     against transactions — a URL-length bomb over a full jsonb scan.
 *   · The thread view issued roughly ten sequential queries before
 *     render, and marked messages read as a side effect of rendering.
 *
 * Both now read denormalised columns migration 173 maintains by trigger,
 * and both degrade to the old behaviour when 173 has not been pasted.
 */

// ══════════════════════════════════════════════════════════════
// THE INBOX LIST
// ══════════════════════════════════════════════════════════════

export interface InboxThread {
    id: string;
    otherId: string;
    otherAlias: string;
    otherAvatarUrl: string | null;
    /** The horse or commission this thread is about, if any. */
    subjectTitle: string | null;
    subjectThumbUrl: string | null;
    /** Null for a plain conversation — which is most of them. */
    dealKind: DealKind | null;
    stage: DealStage | null;
    /** What this person is in this deal, already de-inverted. */
    roleLabel: string | null;
    preview: string;
    previewIsMine: boolean;
    lastAt: string;
    unreadCount: number;
    muted: boolean;
    archived: boolean;
    disputed: boolean;
}

export interface InboxData {
    threads: InboxThread[];
    /** True once migration 173 is pasted — unlocks archive and mute. */
    support: DealColumnSupport;
}

export async function loadInbox(userId: string): Promise<InboxData> {
    const supabase = await createClient();
    const support = await getDealColumnSupport(supabase);

    // ── Conversations ────────────────────────────────────────
    const columns = support.conversationDeal
        ? "id, buyer_id, seller_id, horse_id, created_at, updated_at, last_message_at, last_message_preview, last_message_kind, last_message_sender, deal_kind, disputed_at"
        : "id, buyer_id, seller_id, horse_id, created_at, updated_at";

    const { data: rawConvos, error } = await dealDb(supabase)
        .from("conversations")
        .select(columns)
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .order(support.conversationDeal ? "last_message_at" : "updated_at", {
            ascending: false,
            nullsFirst: false,
        })
        .limit(200);

    if (error && !isMissingSchema(error)) return { threads: [], support };
    const convos = (rawConvos ?? []) as unknown as Record<string, unknown>[];
    if (convos.length === 0) return { threads: [], support };

    const convoIds = convos.map((c) => c.id as string);

    // ── Participants (roles, unread marks, mute, archive) ────
    const participantMap = new Map<
        string,
        { lastReadAt: string | null; muted: boolean; archived: boolean; party: DealParty | null; role: string }
    >();
    if (support.participants) {
        const { data: parts } = await dealDb(supabase)
            .from("conversation_participants")
            .select("conversation_id, last_read_at, muted, archived, party, role")
            .eq("user_id", userId)
            .in("conversation_id", convoIds);
        for (const p of (parts ?? []) as Record<string, unknown>[]) {
            participantMap.set(p.conversation_id as string, {
                lastReadAt: (p.last_read_at as string | null) ?? null,
                muted: p.muted === true,
                archived: p.archived === true,
                party: (p.party as DealParty | null) ?? null,
                role: (p.role as string) ?? "member",
            });
        }
    }

    // ── Unread ───────────────────────────────────────────────
    // One bounded query, not "every message you have ever received".
    const unread = new Map<string, number>();
    {
        const marks = convoIds
            .map((id) => participantMap.get(id)?.lastReadAt)
            .filter(Boolean) as string[];
        const earliest = marks.length === convoIds.length && marks.length > 0
            ? marks.reduce((a, b) => (a < b ? a : b))
            : null;

        let q = supabase
            .from("messages")
            .select("conversation_id, sender_id, created_at, is_read")
            .in("conversation_id", convoIds)
            .neq("sender_id", userId);
        if (support.participants && earliest) q = q.gt("created_at", earliest);
        else q = q.eq("is_read", false);

        const { data: rows } = await q.limit(2000);
        for (const m of (rows ?? []) as {
            conversation_id: string;
            created_at: string;
            is_read: boolean;
        }[]) {
            if (support.participants) {
                const mark = participantMap.get(m.conversation_id)?.lastReadAt;
                if (mark && m.created_at <= mark) continue;
            }
            unread.set(m.conversation_id, (unread.get(m.conversation_id) ?? 0) + 1);
        }
    }

    // ── Counterparties ───────────────────────────────────────
    const otherIds = [
        ...new Set(
            convos.map((c) =>
                (c.buyer_id as string) === userId ? (c.seller_id as string) : (c.buyer_id as string),
            ),
        ),
    ];
    const { data: users } = await supabase
        .from("users")
        .select("id, alias_name, avatar_url")
        .in("id", otherIds);
    const userMap = new Map<string, { alias: string; avatar: string | null }>();
    for (const u of (users ?? []) as { id: string; alias_name: string; avatar_url: string | null }[]) {
        userMap.set(u.id, { alias: u.alias_name, avatar: u.avatar_url });
    }
    // Avatars are signed one level up so the list stays a single pass.
    const avatarUrls = new Map<string, string | null>();
    await Promise.all(
        [...userMap.entries()].map(async ([id, u]) => {
            avatarUrls.set(id, await resolveAvatarUrl(u.avatar));
        }),
    );

    // ── Subjects ─────────────────────────────────────────────
    const horseIds = [
        ...new Set(convos.map((c) => c.horse_id as string | null).filter(Boolean) as string[]),
    ];
    const horseMap = new Map<string, { name: string; thumb: string | null }>();
    if (horseIds.length > 0) {
        const { data: horses } = await supabase
            .from("user_horses")
            .select("id, custom_name, horse_images(image_url, angle_profile)")
            .in("id", horseIds);
        const paths: string[] = [];
        const pending: { id: string; name: string; path: string | null }[] = [];
        for (const h of (horses ?? []) as {
            id: string;
            custom_name: string;
            horse_images: { image_url: string; angle_profile: string }[] | null;
        }[]) {
            const imgs = h.horse_images ?? [];
            const thumb = imgs.find((i) => i.angle_profile === "Primary_Thumbnail") ?? imgs[0];
            if (thumb?.image_url) paths.push(thumb.image_url);
            pending.push({ id: h.id, name: h.custom_name, path: thumb?.image_url ?? null });
        }
        const urlMap = paths.length > 0 ? getPublicImageUrls(paths) : new Map<string, string>();
        for (const p of pending) {
            horseMap.set(p.id, { name: p.name, thumb: p.path ? (urlMap.get(p.path) ?? null) : null });
        }
    }

    // ── Deal state ───────────────────────────────────────────
    // One query against an indexed column, replacing the per-conversation
    // `.or()` chain over transactions.metadata.
    const txnMap = new Map<
        string,
        { status: string; paidAt: string | null; partyAId: string; partyBId: string | null }
    >();
    {
        const { data: txns } = await supabase
            .from("transactions")
            .select("conversation_id, status, paid_at, party_a_id, party_b_id, created_at")
            .in("conversation_id", convoIds)
            .order("created_at", { ascending: false });
        for (const t of (txns ?? []) as {
            conversation_id: string | null;
            status: string;
            paid_at: string | null;
            party_a_id: string;
            party_b_id: string | null;
        }[]) {
            if (!t.conversation_id || txnMap.has(t.conversation_id)) continue;
            txnMap.set(t.conversation_id, {
                status: t.status,
                paidAt: t.paid_at,
                partyAId: t.party_a_id,
                partyBId: t.party_b_id,
            });
        }
    }

    // ── Preview fallback for a pre-173 database ──────────────
    const previewMap = new Map<string, { content: string; senderId: string; createdAt: string }>();
    if (!support.conversationDeal) {
        const { data: msgs } = await supabase
            .from("messages")
            .select("conversation_id, content, sender_id, created_at")
            .in("conversation_id", convoIds)
            .order("created_at", { ascending: false })
            .limit(1000);
        for (const m of (msgs ?? []) as {
            conversation_id: string;
            content: string;
            sender_id: string;
            created_at: string;
        }[]) {
            if (previewMap.has(m.conversation_id)) continue;
            previewMap.set(m.conversation_id, {
                content: m.content,
                senderId: m.sender_id,
                createdAt: m.created_at,
            });
        }
    }

    // ── Assemble ─────────────────────────────────────────────
    const threads: InboxThread[] = convos.map((c) => {
        const id = c.id as string;
        const otherId =
            (c.buyer_id as string) === userId ? (c.seller_id as string) : (c.buyer_id as string);
        const other = userMap.get(otherId);
        const horse = c.horse_id ? horseMap.get(c.horse_id as string) : null;
        const txn = txnMap.get(id);
        const part = participantMap.get(id);
        const fallback = previewMap.get(id);

        const kind =
            ((c.deal_kind as DealKind | null) ?? null) ??
            (txn ? inferKind({ horseId: (c.horse_id as string | null) ?? null }) : null);

        const disputed = !!c.disputed_at;
        const stage: DealStage | null = txn
            ? stageForTransaction({
                  status: txn.status,
                  paidAt: txn.paidAt,
                  disputedAt: disputed ? (c.disputed_at as string) : null,
              })
            : disputed
              ? "disputed"
              : null;

        // The role label is derived from the TRANSACTION, never from
        // buyer_id — the bug that has been labelling sellers as buyers.
        let role: string | null = null;
        if (txn && kind) {
            role = userId === txn.partyAId ? labelA(kind) : labelB(kind);
        } else if (part && part.role !== "member") {
            role = capitalize(part.role);
        }

        const previewKind = coerceKind(c.last_message_kind ?? "chat");
        const previewSender = (c.last_message_sender as string | null) ?? fallback?.senderId ?? null;
        const previewText =
            (c.last_message_preview as string | null) ?? fallback?.content ?? "";

        return {
            id,
            otherId,
            otherAlias: other?.alias ?? "Unknown",
            otherAvatarUrl: avatarUrls.get(otherId) ?? null,
            subjectTitle: horse?.name ?? null,
            subjectThumbUrl: horse?.thumb ?? null,
            dealKind: kind,
            stage,
            roleLabel: role,
            preview: previewLine(previewKind, null, previewText, {
                actorName: previewSender === userId ? "You" : `@${other?.alias ?? "them"}`,
            }),
            previewIsMine: previewSender === userId,
            lastAt:
                (c.last_message_at as string | null) ??
                fallback?.createdAt ??
                (c.updated_at as string) ??
                (c.created_at as string),
            unreadCount: unread.get(id) ?? 0,
            muted: part?.muted ?? false,
            archived: part?.archived ?? false,
            disputed,
        };
    });

    threads.sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
    return { threads, support };
}

function labelA(kind: DealKind): string {
    return kind === "commission" ? "Artist" : kind === "trade" ? "Trader" : "Seller";
}
function labelB(kind: DealKind): string {
    return kind === "commission" ? "Commissioner" : kind === "trade" ? "Trader" : "Buyer";
}
function capitalize(s: string): string {
    return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

// ══════════════════════════════════════════════════════════════
// THE THREAD
// ══════════════════════════════════════════════════════════════

export interface ThreadEntry {
    id: string;
    senderId: string | null;
    kind: MessageKind;
    payload: Record<string, unknown>;
    content: string;
    createdAt: string;
    editedAt: string | null;
    isMine: boolean;
    attachments?: { url: string; caption: string | null }[];
}

export interface DealRoom {
    conversationId: string;
    support: DealColumnSupport;

    /** The caller. */
    party: DealParty;
    partyLabel: string;
    otherLabel: string;
    otherId: string;
    otherAlias: string;
    otherAvatarUrl: string | null;
    myAvatarUrl: string | null;
    otherMemberSince: string | null;
    otherTransferCount: number;
    otherAvgRating: number | null;
    otherRatingCount: number;
    isBlocked: boolean;

    /** The pinned subject. */
    subject: {
        horseId: string | null;
        commissionId: string | null;
        title: string;
        reference: string | null;
        thumbUrl: string | null;
        tradeStatus: string | null;
        listingPrice: number | null;
    } | null;

    kind: DealKind | null;
    stage: DealStage | null;
    terms: DealTerms;
    installments: Installment[];
    entries: ThreadEntry[];

    transaction: {
        id: string;
        status: string;
        offerAmount: number | null;
        offerMessage: string | null;
        paidAt: string | null;
        verifiedAt: string | null;
        metadata: Record<string, unknown> | null;
        /** 'a' | 'b' — whose offer is currently standing. */
        offerFrom: DealParty;
        pin: string | null;
    } | null;

    disputed: { at: string; reason: string | null; byMe: boolean } | null;
    muted: boolean;
    archived: boolean;

    /** Review state, so the thread can prompt for one. */
    existingReview: { id: string; stars: number; reviewText: string | null; createdAt: string } | null;
    mutualTransfers: number;
    /** Legacy conversation-completion flow, only when no Safe-Trade row. */
    legacyStatus: string;
}

export async function loadDealRoom(
    conversationId: string,
    userId: string,
): Promise<DealRoom | null> {
    const supabase = await createClient();
    const support = await getDealColumnSupport(supabase);

    const convoColumns = support.conversationDeal
        ? "id, buyer_id, seller_id, horse_id, transaction_status, deal_terms, deal_kind, commission_id, disputed_at, dispute_reason, disputed_by"
        : "id, buyer_id, seller_id, horse_id, transaction_status";

    const { data: convoRaw, error } = await dealDb(supabase)
        .from("conversations")
        .select(convoColumns)
        .eq("id", conversationId)
        .maybeSingle();
    if (error && !isMissingSchema(error)) return null;
    const convo = convoRaw as Record<string, unknown> | null;
    if (!convo) return null;

    const buyerId = convo.buyer_id as string;
    const sellerId = convo.seller_id as string;
    if (userId !== buyerId && userId !== sellerId) return null;

    // ── Everything that can run at once ──────────────────────
    const [txnRes, msgRes, otherRes, meRes] = await Promise.all([
        supabase
            .from("transactions")
            .select(
                "id, status, offer_amount, offer_message, party_a_id, party_b_id, paid_at, verified_at, metadata",
            )
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        loadEntries(supabase, conversationId, support),
        supabase
            .from("users")
            .select("id, alias_name, avatar_url, created_at")
            .eq("id", userId === buyerId ? sellerId : buyerId)
            .maybeSingle(),
        supabase.from("users").select("avatar_url").eq("id", userId).maybeSingle(),
    ]);

    const txn = txnRes.data as {
        id: string;
        status: string;
        offer_amount: number | null;
        offer_message: string | null;
        party_a_id: string;
        party_b_id: string | null;
        paid_at: string | null;
        verified_at: string | null;
        metadata: Record<string, unknown> | null;
    } | null;

    // Party A / B come from the TRANSACTION when there is one
    // (party_a = seller, party_b = buyer, migration 099). The
    // conversation's own columns are the fallback only — buyer_id means
    // "whoever clicked first", which is why the header has been calling
    // sellers buyers since the inbox shipped.
    const aId = txn?.party_a_id ?? sellerId;
    const party: DealParty = userId === aId ? "a" : "b";

    const otherRow = otherRes.data as {
        id: string;
        alias_name: string;
        avatar_url: string | null;
        created_at: string;
    } | null;
    const otherId = otherRow?.id ?? (userId === buyerId ? sellerId : buyerId);

    const commissionId = (convo.commission_id as string | null) ?? null;
    const horseId = (convo.horse_id as string | null) ?? null;
    const kind =
        ((convo.deal_kind as DealKind | null) ?? null) ??
        (txn || commissionId ? inferKind({ commissionId, horseId }) : null);

    // ── Trust signals + the rest ─────────────────────────────
    const [transfersRes, reviewsRes, mutualRes, myReviewRes, blockRes, subject, installments, partRow] =
        await Promise.all([
            supabase
                .from("horse_transfers")
                .select("id", { count: "exact", head: true })
                .eq("status", "claimed")
                .or(`sender_id.eq.${otherId},claimed_by.eq.${otherId}`),
            supabase.from("reviews").select("stars").eq("target_id", otherId),
            supabase
                .from("horse_transfers")
                .select("id", { count: "exact", head: true })
                .eq("status", "claimed")
                .or(
                    `and(sender_id.eq.${userId},claimed_by.eq.${otherId}),and(sender_id.eq.${otherId},claimed_by.eq.${userId})`,
                ),
            txn
                ? supabase
                      .from("reviews")
                      .select("id, stars, content, created_at")
                      .eq("transaction_id", txn.id)
                      .eq("reviewer_id", userId)
                      .maybeSingle()
                : Promise.resolve({ data: null }),
            dealDb(supabase).rpc("are_blocked", { p_user_a: userId, p_user_b: otherId }),
            loadSubject(supabase, horseId, commissionId),
            support.installments ? loadLedger(supabase, conversationId) : Promise.resolve([]),
            support.participants
                ? dealDb(supabase)
                      .from("conversation_participants")
                      .select("muted, archived")
                      .eq("conversation_id", conversationId)
                      .eq("user_id", userId)
                      .maybeSingle()
                : Promise.resolve({ data: null }),
        ]);

    const ratings = (reviewsRes.data ?? []) as { stars: number }[];
    const avgRating =
        ratings.length > 0
            ? Math.round((ratings.reduce((s, r) => s + r.stars, 0) / ratings.length) * 10) / 10
            : null;

    const rv = myReviewRes.data as {
        id: string;
        stars: number;
        content: string | null;
        created_at: string;
    } | null;

    const disputedAt = (convo.disputed_at as string | null) ?? null;
    const meta = txn?.metadata ?? null;
    const offerFrom: DealParty =
        meta && (meta.offer_from === "a" || meta.offer_from === "b")
            ? (meta.offer_from as DealParty)
            : "b";

    return {
        conversationId,
        support,
        party,
        partyLabel: kind ? (party === "a" ? labelA(kind) : labelB(kind)) : "You",
        otherLabel: kind ? (party === "a" ? labelB(kind) : labelA(kind)) : "Member",
        otherId,
        otherAlias: otherRow?.alias_name ?? "Unknown",
        otherAvatarUrl: await resolveAvatarUrl(otherRow?.avatar_url ?? null),
        myAvatarUrl: await resolveAvatarUrl(
            (meRes.data as { avatar_url: string | null } | null)?.avatar_url ?? null,
        ),
        otherMemberSince: otherRow?.created_at ?? null,
        otherTransferCount: transfersRes.count ?? 0,
        otherAvgRating: avgRating,
        otherRatingCount: ratings.length,
        isBlocked: blockRes.data === true,
        subject,
        kind,
        stage: txn
            ? stageForTransaction({ status: txn.status, paidAt: txn.paid_at, disputedAt })
            : disputedAt
              ? "disputed"
              : null,
        terms: coerceTerms(convo.deal_terms),
        installments,
        entries: msgRes,
        transaction: txn
            ? {
                  id: txn.id,
                  status: txn.status,
                  offerAmount: txn.offer_amount,
                  offerMessage: txn.offer_message,
                  paidAt: txn.paid_at,
                  verifiedAt: txn.verified_at,
                  metadata: meta,
                  offerFrom,
                  pin: (meta?.pin as string | undefined) ?? null,
              }
            : null,
        disputed: disputedAt
            ? {
                  at: disputedAt,
                  reason: (convo.dispute_reason as string | null) ?? null,
                  byMe: convo.disputed_by === userId,
              }
            : null,
        muted: (partRow.data as { muted?: boolean } | null)?.muted === true,
        archived: (partRow.data as { archived?: boolean } | null)?.archived === true,
        existingReview: rv
            ? { id: rv.id, stars: rv.stars, reviewText: rv.content, createdAt: rv.created_at }
            : null,
        mutualTransfers: mutualRes.count ?? 0,
        legacyStatus: (convo.transaction_status as string | null) ?? "open",
    };
}

// ══════════════════════════════════════════════════════════════
// THE EVIDENCE PACK
// ══════════════════════════════════════════════════════════════

/**
 * Assemble the exportable deal record.
 *
 * Everything the pack contains already exists in the deal room read;
 * what this adds is the counterparty's trust figures for BOTH sides
 * (a processor's reviewer wants to know who these two people are), the
 * per-message attachment counts, and the Safe-Trade timestamps in full.
 */
export async function loadEvidencePack(
    conversationId: string,
    userId: string,
): Promise<EvidencePack | null> {
    const supabase = await createClient();
    const room = await loadDealRoom(conversationId, userId);
    if (!room) return null;

    const meId = userId;
    const [meRow, transfersMe, attachCounts, txnFull, myAlias] = await Promise.all([
        supabase.from("users").select("alias_name, created_at").eq("id", meId).maybeSingle(),
        supabase
            .from("horse_transfers")
            .select("id", { count: "exact", head: true })
            .eq("status", "claimed")
            .or(`sender_id.eq.${meId},claimed_by.eq.${meId}`),
        supabase
            .from("media_attachments")
            .select("message_id")
            .in(
                "message_id",
                room.entries.map((e) => e.id),
            ),
        room.transaction
            ? supabase
                  .from("transactions")
                  .select("id, status, offer_amount, created_at, accepted_at, paid_at, verified_at, completed_at")
                  .eq("id", room.transaction.id)
                  .maybeSingle()
            : Promise.resolve({ data: null }),
        Promise.resolve(null),
    ]);
    void myAlias;

    const me = meRow.data as { alias_name: string; created_at: string } | null;

    const counts = new Map<string, number>();
    for (const a of (attachCounts.data ?? []) as { message_id: string }[]) {
        counts.set(a.message_id, (counts.get(a.message_id) ?? 0) + 1);
    }

    const mine: EvidenceParty = {
        userId: meId,
        alias: me?.alias_name ?? "you",
        memberSince: me?.created_at ?? null,
        completedTransfers: transfersMe.count ?? 0,
    };
    const theirs: EvidenceParty = {
        userId: room.otherId,
        alias: room.otherAlias,
        memberSince: room.otherMemberSince,
        completedTransfers: room.otherTransferCount,
    };

    const t = txnFull.data as {
        id: string;
        status: string;
        offer_amount: number | null;
        created_at: string | null;
        accepted_at: string | null;
        paid_at: string | null;
        verified_at: string | null;
        completed_at: string | null;
    } | null;

    return buildEvidencePack({
        conversationId,
        kind: room.kind ?? "sale",
        stage: room.stage ?? "talking",
        partyA: room.party === "a" ? mine : theirs,
        partyB: room.party === "b" ? mine : theirs,
        subject: room.subject
            ? {
                  title: room.subject.title,
                  reference: room.subject.reference,
                  horseId: room.subject.horseId,
                  commissionId: room.subject.commissionId,
              }
            : null,
        terms: room.terms,
        installments: room.installments,
        messages: room.entries.map((e) => ({
            id: e.id,
            senderId: e.senderId,
            kind: e.kind,
            payload: e.payload,
            content: e.content,
            createdAt: e.createdAt,
            attachmentCount: counts.get(e.id) ?? 0,
        })),
        transaction: t
            ? {
                  id: t.id,
                  status: t.status,
                  offerAmount: t.offer_amount,
                  createdAt: t.created_at,
                  acceptedAt: t.accepted_at,
                  paidAt: t.paid_at,
                  verifiedAt: t.verified_at,
                  completedAt: t.completed_at,
              }
            : null,
        generatedAt: new Date().toISOString(),
        generatedForAlias: mine.alias,
    });
}

async function loadEntries(
    supabase: SupabaseClient,
    conversationId: string,
    support: DealColumnSupport,
): Promise<ThreadEntry[]> {
    const columns = support.messageKinds
        ? "id, sender_id, content, created_at, kind, payload, edited_at"
        : "id, sender_id, content, created_at";

    const { data, error } = await dealDb(supabase)
        .from("messages")
        .select(columns)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(1000);
    if (error) return [];

    return ((data ?? []) as unknown as Record<string, unknown>[]).map((m) => ({
        id: m.id as string,
        senderId: (m.sender_id as string | null) ?? null,
        kind: coerceKind(m.kind ?? "chat"),
        payload: coercePayload(m.payload),
        content: (m.content as string) ?? "",
        createdAt: m.created_at as string,
        editedAt: (m.edited_at as string | null) ?? null,
        isMine: false, // filled by the caller, which knows the viewer
    }));
}

async function loadLedger(
    supabase: SupabaseClient,
    conversationId: string,
): Promise<Installment[]> {
    const { data, error } = await dealDb(supabase)
        .from("payment_installments")
        .select("id, seq, amount, due_date, marked_sent_at, confirmed_at, note")
        .eq("conversation_id", conversationId)
        .order("seq", { ascending: true });
    if (error) return [];
    return coerceInstallments(data);
}

async function loadSubject(
    supabase: SupabaseClient,
    horseId: string | null,
    commissionId: string | null,
): Promise<DealRoom["subject"]> {
    if (horseId) {
        const { data } = await supabase
            .from("user_horses")
            .select(
                "id, custom_name, trade_status, listing_price, catalog_items:catalog_id(title, maker), horse_images(image_url, angle_profile)",
            )
            .eq("id", horseId)
            .maybeSingle();
        const h = data as {
            id: string;
            custom_name: string;
            trade_status: string;
            listing_price: number | null;
            catalog_items: { title: string; maker: string } | null;
            horse_images: { image_url: string; angle_profile: string }[] | null;
        } | null;
        if (!h) return null;
        const imgs = h.horse_images ?? [];
        const thumb = imgs.find((i) => i.angle_profile === "Primary_Thumbnail") ?? imgs[0];
        const url = thumb?.image_url
            ? (getPublicImageUrls([thumb.image_url]).get(thumb.image_url) ?? null)
            : null;
        return {
            horseId: h.id,
            commissionId: null,
            title: h.custom_name,
            reference: h.catalog_items ? `${h.catalog_items.maker} — ${h.catalog_items.title}` : null,
            thumbUrl: url,
            tradeStatus: h.trade_status,
            listingPrice: h.listing_price,
        };
    }
    if (commissionId) {
        const { data } = await supabase
            .from("commissions")
            .select("id, commission_type, description")
            .eq("id", commissionId)
            .maybeSingle();
        const c = data as { id: string; commission_type: string; description: string } | null;
        if (!c) return null;
        return {
            horseId: null,
            commissionId: c.id,
            title: c.commission_type,
            reference: c.description ? c.description.slice(0, 120) : null,
            thumbUrl: null,
            tradeStatus: null,
            listingPrice: null,
        };
    }
    return null;
}
