import { formatMoney } from "@/lib/studio/terms";
import type { Commission, CommissionUpdate } from "@/app/actions/art-studio";

/**
 * The handshake — what's been agreed and who has checked what off,
 * pinned above the thread. The owner's design (2026-08-31): "here's
 * the terms of the deal — locked in — here's progress stuff — yep
 * we've both checked off." Terms freeze at acceptance (an immutability
 * trigger guards them, 170); everything below is derived from the
 * thread's own entries, so this ledger can never disagree with it.
 */

interface Tick {
    label: string;
    by: string;
    at: string | null;
    done: boolean;
}

function fmt(d: string | null): string {
    if (!d) return "";
    const dt = new Date(d);
    return isNaN(dt.getTime())
        ? ""
        : dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function WorkbenchLedger({
    commission,
    updates,
}: {
    commission: Commission;
    updates: CommissionUpdate[];
}) {
    const statusDate = (s: string): string | null =>
        updates.find((u) => u.newStatus === s)?.createdAt ?? null;

    const ticks: Tick[] = [];
    ticks.push({
        label:
            commission.agreedPrice != null
                ? `Terms locked — ${formatMoney(commission.agreedPrice)}${
                      commission.depositAmount ? `, ${formatMoney(commission.depositAmount)} deposit` : ""
                  }`
                : "Terms locked",
        by: "both",
        at: commission.acceptedAt,
        done: !!commission.acceptedAt,
    });
    for (const u of updates) {
        if (!u.checkpoint) continue;
        ticks.push({
            label: u.checkpoint.title,
            by: "commissioner",
            at: u.checkpoint.ackedAt,
            done: !!u.checkpoint.ackedAt,
        });
    }
    const approvedAt = statusDate("completed");
    const deliveredAt = statusDate("delivered");
    const receivedAt = statusDate("received");
    const order = ["completed", "delivered", "received"].indexOf(
        ["completed", "delivered", "received"].includes(commission.status) ? commission.status : "",
    );
    ticks.push({ label: "Final approved", by: "commissioner", at: approvedAt, done: order >= 0 });
    ticks.push({ label: "Delivered", by: "artist", at: deliveredAt, done: order >= 1 });
    ticks.push({ label: "Received", by: "commissioner", at: receivedAt, done: order >= 2 });

    // Before acceptance there is nothing locked to show — the quote
    // panel already carries that conversation.
    if (!commission.acceptedAt && ticks.every((t) => !t.done)) return null;

    return (
        <div className="bg-card border-input rounded-lg border p-5 shadow-md">
            <h2 className="m-0 mb-3 font-serif text-lg font-bold">🤝 The handshake</h2>
            <ol className="m-0 grid list-none gap-1.5 p-0">
                {ticks.map((t, i) => (
                    <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                        <span
                            aria-hidden="true"
                            className={t.done ? "text-forest font-bold" : "text-muted-foreground"}
                        >
                            {t.done ? "✓" : "○"}
                        </span>
                        <span className={t.done ? "text-foreground font-medium" : "text-muted-foreground"}>
                            {t.label}
                        </span>
                        <span className="text-muted-foreground text-xs">
                            {t.done ? `${t.by} · ${fmt(t.at)}` : `awaiting ${t.by}`}
                        </span>
                    </li>
                ))}
            </ol>
            {commission.termsSnapshot && (
                <p className="text-muted-foreground mt-3 mb-0 text-xs">
                    The full terms were frozen when both sides agreed — nothing above can be
                    quietly edited, including by us.
                </p>
            )}
        </div>
    );
}
