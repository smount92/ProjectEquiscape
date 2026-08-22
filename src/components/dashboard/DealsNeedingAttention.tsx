import Link from "next/link";
import { Handshake } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { loadInbox, type InboxThread } from "@/app/inbox/reads";
import { getReviewableTransactions } from "@/app/actions/transactions";
import { dealNoun } from "@/lib/deals/vocabulary";

/**
 * DEALS NEEDING ATTENTION — the sidebar card that answers "is anything
 * waiting on me?" without a trip to the inbox.
 *
 * The audit's complaint was that a member with an offer sitting
 * unanswered had no way to know from their home page; the inbox badge
 * counts unread MESSAGES, and an offer arrives with a message that gets
 * read and then forgotten. This counts moves, not messages.
 *
 * "Waiting on me" is decided in one place — loadInbox's `awaitingMe`,
 * which is the only read that holds the stage, the deal kind, the
 * viewer's party and whose offer is standing at the same time. Nothing
 * about whose turn it is is re-derived here.
 *
 * Review prompts ride along because an unreviewed completed sale is the
 * same kind of debt: a move only the viewer can make. They are matched
 * back to their thread by counterparty so the line still opens the
 * conversation the deal happened in.
 *
 * Renders nothing when there is nothing to do — a card that says "all
 * clear" is a card that trains people to ignore it.
 */

const MAX_ROWS = 5;

/** The sentence for a stage, addressed to the person who has to act. */
function moveFor(thread: InboxThread): string {
    const noun = thread.dealKind ? dealNoun(thread.dealKind) : "deal";

    // A running installment plan outranks the stage: plan payments never
    // move the transaction off pending_payment, so the stage still reads
    // "agreed" while the real move is the seller confirming money that
    // has already arrived (audit C7).
    if (thread.planState === "awaiting_confirmation") {
        return "A payment is marked sent — confirm it arrived";
    }
    if (thread.planState === "awaiting_payment") {
        return "The next payment on the plan is yours";
    }

    switch (thread.stage) {
        case "proposed":
            return "An offer is waiting on your answer";
        case "agreed":
            return "Agreed — the terms and your payment are next";
        case "paying":
            return "They say they have paid — confirm it arrived";
        case "fulfilling":
            return "Funds confirmed — claim your horse";
        default:
            return `Your ${noun} is waiting on you`;
    }
}

export default async function DealsNeedingAttention() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const [inbox, reviewable] = await Promise.all([
        loadInbox(user.id).catch(() => null),
        getReviewableTransactions().catch(() => []),
    ]);

    const threads = (inbox?.threads ?? []).filter((t) => t.awaitingMe && !t.archived);

    // A completed sale the viewer has not reviewed is a move too. Link it
    // to the thread it happened in when we can find one.
    const threadByOther = new Map((inbox?.threads ?? []).map((t) => [t.otherId, t.id]));
    const reviews = reviewable
        .filter((r) => threadByOther.has(r.targetId))
        .map((r) => ({
            key: `review-${r.transactionId}`,
            href: `/inbox/${threadByOther.get(r.targetId)}`,
            who: r.targetAlias,
            subject: r.horseName,
            move: "Leave a review — it is how the next buyer knows",
        }));

    const rows = [
        ...threads.map((t) => ({
            key: t.id,
            href: `/inbox/${t.id}`,
            who: t.otherAlias,
            subject: t.subjectTitle,
            move: moveFor(t),
        })),
        ...reviews,
    ].slice(0, MAX_ROWS);

    if (rows.length === 0) return null;

    return (
        <div
            className="bg-card border-input rounded-lg border p-6 shadow-md transition-all"
            id="deals-needing-attention"
        >
            <h3 className="text-secondary-foreground mb-4 flex items-center gap-2 text-xs font-semibold tracking-widest uppercase">
                <Handshake size={14} strokeWidth={1.5} /> Deals Needing You
            </h3>
            <div className="flex flex-col gap-2">
                {rows.map((row) => (
                    <Link
                        key={row.key}
                        href={row.href}
                        className="hover:border-input block rounded-md border border-transparent bg-black/[0.02] px-3 py-2 no-underline transition-colors hover:bg-black/[0.06] hover:no-underline"
                    >
                        <p className="text-foreground m-0 truncate text-sm font-semibold">
                            {row.subject ?? `@${row.who}`}
                        </p>
                        <p className="text-muted-foreground m-0 text-xs">
                            {row.move}
                            {row.subject ? ` · @${row.who}` : ""}
                        </p>
                    </Link>
                ))}
            </div>
        </div>
    );
}
