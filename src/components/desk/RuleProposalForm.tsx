"use client";

/**
 * Propose a Registry style rule: a short name, the rule in a sentence or
 * two, and (optionally) the suggested fix the Desk should offer on every
 * row it touches once the rule is in effect.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { proposeRule } from "@/app/actions/registry-desk-lists";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

export interface FixOption {
    key: string;
    label: string;
    before: string;
    after: string;
}

export default function RuleProposalForm({ fixOptions }: { fixOptions: FixOption[] }) {
    const router = useRouter();
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [checkKey, setCheckKey] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);
    const [pending, startTransition] = useTransition();
    const fix = fixOptions.find((f) => f.key === checkKey);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        startTransition(async () => {
            setError(null);
            setDone(false);
            const r = await proposeRule({ title, body, checkKey: checkKey || null });
            if (!r.success) {
                setError(r.error);
                return;
            }
            setTitle("");
            setBody("");
            setCheckKey("");
            setDone(true);
            router.refresh();
        });
    };

    return (
        <form onSubmit={submit} className="ledger-card flex flex-col gap-3" aria-labelledby="propose-rule-title">
            <h2 id="propose-rule-title" className="m-0 font-serif text-xl font-bold text-foreground">
                Propose a rule
            </h2>
            <p className="m-0 text-sm text-secondary-foreground">
                Say what the Registry should look like. Three other moderators agreeing puts it in effect; the site
                owner can veto. You can propose up to 10 a day.
            </p>
            <label className="flex flex-col gap-1 text-sm font-semibold text-foreground">
                Name
                <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={140}
                    placeholder="e.g. Set piece titles"
                    required
                />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-foreground">
                The rule
                <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    maxLength={2000}
                    placeholder="e.g. A piece of a gift set is titled with the set's name and, in brackets, the piece."
                    required
                />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-foreground">
                Suggested fix (optional)
                <NativeSelect value={checkKey} onChange={(e) => setCheckKey(e.target.value)}>
                    <option value="">None: the rule is guidance only</option>
                    {fixOptions.map((f) => (
                        <option key={f.key} value={f.key}>
                            {f.label}
                        </option>
                    ))}
                </NativeSelect>
            </label>
            {fix && (
                <p className="m-0 text-sm text-secondary-foreground">
                    Before {fix.before}; after {fix.after}. Once the rule is in effect, the Mold view offers this fix on
                    every row it fits, and a moderator still checks and saves each one.
                </p>
            )}
            {error && (
                <p role="alert" className="m-0 text-sm font-semibold text-destructive">
                    {error}
                </p>
            )}
            {done && (
                <p role="status" className="m-0 text-sm font-semibold text-forest">
                    Proposed. The other moderators will see it on this tab.
                </p>
            )}
            <div>
                <Button type="submit" disabled={pending || title.trim().length < 3 || body.trim().length < 10}>
                    Propose this rule
                </Button>
            </div>
        </form>
    );
}
