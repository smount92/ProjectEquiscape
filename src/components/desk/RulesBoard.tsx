"use client";

/**
 * The Desk's Rules tab: the Registry's house style, written by the
 * moderators. One proposes, the others agree; at 3 agreements (the site
 * owner's counts, the proposer's doesn't) it takes effect, unless the
 * owner vetoes. A rule with a suggested fix then offers that fix on every
 * row it touches, in the Mold view.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { retireRule, vetoRule, voteRule, withdrawRule, type RuleView } from "@/app/actions/registry-desk-lists";
import { AGREEMENTS_NEEDED, ruleStatusLabel, type RuleStatus } from "@/lib/registry/rules";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<RuleStatus, string> = {
    proposed: "border-warning/50 bg-warning/10 text-warning",
    in_effect: "border-forest/40 bg-forest/10 text-forest",
    vetoed: "border-destructive/40 bg-destructive/10 text-destructive",
    withdrawn: "border-input bg-muted text-muted-foreground",
    retired: "border-input bg-muted text-muted-foreground",
};

function RuleCard({ rule, onDone }: { rule: RuleView; onDone: () => void }) {
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [vetoing, setVetoing] = useState(false);
    const [vetoNote, setVetoNote] = useState("");
    const run = (fn: () => Promise<{ success: boolean; error?: string }>) =>
        startTransition(async () => {
            setError(null);
            const r = await fn();
            if (!r.success) setError(r.error ?? "That didn't work. Please try again.");
            else {
                setVetoing(false);
                onDone();
            }
        });

    const meta = [
        `Proposed by @${rule.proposedBy}`,
        rule.agreedBy.length ? `agreed by ${rule.agreedBy.map((a) => `@${a}`).join(", ")}` : null,
        rule.status === "proposed" ? `takes effect at ${AGREEMENTS_NEEDED}, unless the site owner vetoes` : null,
    ]
        .filter(Boolean)
        .join(" · ");

    return (
        <article className="ledger-card flex flex-col gap-2" aria-labelledby={`rule-${rule.id}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 id={`rule-${rule.id}`} className="m-0 text-base font-bold text-foreground">
                    {rule.title}
                </h3>
                <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-bold", STATUS_STYLE[rule.status])}>
                    {ruleStatusLabel(rule.status, rule.agreements)}
                </span>
            </div>
            <p className="m-0 whitespace-pre-line text-foreground">{rule.body}</p>
            {rule.fixExample && (
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-foreground">
                        <span className="font-semibold">Before:</span> {rule.fixExample.before}
                    </div>
                    <div className="rounded-md border border-forest/30 bg-forest/5 px-3 py-2 text-foreground">
                        <span className="font-semibold">After:</span> {rule.fixExample.after}
                    </div>
                </div>
            )}
            {rule.fixLabel && (
                <p className="m-0 text-xs text-muted-foreground">
                    Suggested fix once in effect: {rule.fixLabel.charAt(0).toLowerCase() + rule.fixLabel.slice(1)}.
                </p>
            )}
            {rule.disagreedBy.length > 0 && (
                <ul className="m-0 list-none p-0 text-sm text-secondary-foreground">
                    {rule.disagreedBy.map((d) => (
                        <li key={d.alias}>
                            @{d.alias} disagrees{d.note ? `: “${d.note}”` : "."}
                        </li>
                    ))}
                </ul>
            )}
            {rule.vetoNote && (
                <p className="m-0 text-sm text-secondary-foreground">
                    {rule.status === "vetoed" ? "Why the owner vetoed it" : "Note"}: “{rule.vetoNote}”
                </p>
            )}
            <p className="m-0 text-xs text-muted-foreground">{meta}</p>
            {error && (
                <p role="alert" className="m-0 text-sm font-semibold text-destructive">
                    {error}
                </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
                {rule.canVote && (
                    <>
                        {rule.myVote === "agree" ? (
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={pending}
                                onClick={() => run(() => voteRule(rule.id, "none"))}
                            >
                                Take back my agreement
                            </Button>
                        ) : (
                            <Button size="sm" disabled={pending} onClick={() => run(() => voteRule(rule.id, "agree"))}>
                                I agree
                            </Button>
                        )}
                        {rule.myVote === "disagree" ? (
                            <Button
                                size="sm"
                                variant="ghost"
                                disabled={pending}
                                onClick={() => run(() => voteRule(rule.id, "none"))}
                            >
                                Take back my disagreement
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                variant="ghost"
                                disabled={pending}
                                onClick={() => run(() => voteRule(rule.id, "disagree"))}
                            >
                                I disagree
                            </Button>
                        )}
                    </>
                )}
                {rule.mine && rule.status === "proposed" && (
                    <span className="text-xs text-muted-foreground">Your proposal: the others decide.</span>
                )}
                {rule.canWithdraw && (
                    <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => run(() => withdrawRule(rule.id))}
                    >
                        Withdraw
                    </Button>
                )}
                {rule.canVeto && !vetoing && (
                    <Button size="sm" variant="destructive" disabled={pending} onClick={() => setVetoing(true)}>
                        Veto…
                    </Button>
                )}
                {rule.canRetire && (
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => run(() => retireRule(rule.id))}
                    >
                        Retire
                    </Button>
                )}
            </div>
            {vetoing && (
                <div className="flex flex-col gap-2">
                    <label className="flex flex-col gap-1 text-sm font-semibold text-foreground">
                        Why (the moderators see this)
                        <Textarea value={vetoNote} onChange={(e) => setVetoNote(e.target.value)} maxLength={1000} />
                    </label>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            size="sm"
                            variant="destructive"
                            disabled={pending || vetoNote.trim().length < 3}
                            onClick={() => run(() => vetoRule(rule.id, vetoNote))}
                        >
                            Veto this rule
                        </Button>
                        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setVetoing(false)}>
                            Cancel
                        </Button>
                    </div>
                </div>
            )}
        </article>
    );
}

export default function RulesBoard({ rules }: { rules: RuleView[] }) {
    const router = useRouter();
    const live = rules.filter((r) => r.status === "proposed" || r.status === "in_effect");
    const past = rules.filter((r) => r.status !== "proposed" && r.status !== "in_effect");
    return (
        <section aria-label="Registry rules" className="flex flex-col gap-3">
            {live.length === 0 ? (
                <div className="ledger-card text-secondary-foreground">
                    No rules yet. Propose the first one below: say what the Registry should look like, with an example.
                </div>
            ) : (
                live.map((r) => <RuleCard key={r.id} rule={r} onDone={() => router.refresh()} />)
            )}
            {past.length > 0 && (
                <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-semibold text-secondary-foreground">
                        Vetoed, withdrawn and retired rules ({past.length})
                    </summary>
                    <div className="mt-3 flex flex-col gap-3">
                        {past.map((r) => (
                            <RuleCard key={r.id} rule={r} onDone={() => router.refresh()} />
                        ))}
                    </div>
                </details>
            )}
        </section>
    );
}
