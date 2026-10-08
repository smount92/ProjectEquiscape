"use client";

/**
 * "This entry duplicates another one."
 *
 * Filed from the entry that should go; the member searches for the
 * entry to keep. It lands in the registry suggestion queue as a
 * duplicate report (lib/catalog/duplicates); approving it merges the
 * two. Never auto-approved — a merge cannot be undone.
 */

import { useEffect, useState, useTransition } from "react";
import { createSuggestion } from "@/app/actions/catalog-suggestions";
import { searchCatalogAction } from "@/app/actions/reference";
import { DUPLICATE_SUGGESTION_TYPE } from "@/lib/catalog/duplicates";
import { useToast } from "@/lib/context/ToastContext";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Candidate {
    id: string;
    title: string;
    maker: string;
    scale?: string | null;
    item_type?: string;
}

export default function ReportDuplicateModal({
    catalogItem,
    openOnMount = false,
}: {
    catalogItem: { id: string; title: string; maker: string };
    openOnMount?: boolean;
}) {
    const [open, setOpen] = useState(openOnMount);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<Candidate[]>([]);
    const [searching, setSearching] = useState(false);
    const [keep, setKeep] = useState<Candidate | null>(null);
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");
    const [pending, startTransition] = useTransition();
    const { toast } = useToast();

    // Search as the member types (debounced); the entry being reported
    // never lists itself. State only changes once the search settles.
    const q = query.trim();
    useEffect(() => {
        if (!open || q.length < 2) return;
        let cancelled = false;
        const t = setTimeout(async () => {
            setSearching(true);
            const rows = (await searchCatalogAction(q)) as unknown as Candidate[];
            if (cancelled) return;
            setResults(rows.filter((r) => r.id !== catalogItem.id).slice(0, 8));
            setSearching(false);
        }, 250);
        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [q, open, catalogItem.id]);
    const shownResults = q.length >= 2 ? results : [];

    const submit = () => {
        setError("");
        if (!keep) {
            setError("Pick the entry this one duplicates.");
            return;
        }
        if (reason.trim().length < 10) {
            setError("Say how you can tell (at least 10 characters).");
            return;
        }
        startTransition(async () => {
            const result = await createSuggestion({
                catalogItemId: catalogItem.id,
                suggestionType: DUPLICATE_SUGGESTION_TYPE,
                fieldChanges: { duplicate_of: keep.id, duplicate_of_title: keep.title },
                reason: reason.trim(),
            });
            if (result.success) {
                setOpen(false);
                setKeep(null);
                setQuery("");
                setReason("");
                toast("✅ Thanks — a duplicate report goes to the admins for a merge.", "success");
            } else {
                setError(result.error ?? "Something went wrong.");
            }
        });
    };

    return (
        <>
            <Button variant="outline" onClick={() => setOpen(true)} id="report-duplicate-open">
                Report a duplicate
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[560px]">
                    <DialogHeader>
                        <DialogTitle>Is “{catalogItem.title}” a duplicate?</DialogTitle>
                        <DialogDescription>
                            Find the entry that should stay. If an admin agrees, every horse, wishlist and
                            photo linked to this entry moves to that one and this entry is removed.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-3">
                        {keep ? (
                            <div className="flex items-center justify-between gap-3 rounded-md border border-input bg-muted/40 px-3 py-2">
                                <span className="text-sm">
                                    Keep <strong>{keep.title}</strong>
                                    <span className="text-muted-foreground"> · {keep.maker}</span>
                                </span>
                                <Button variant="ghost" size="sm" onClick={() => setKeep(null)}>
                                    Change
                                </Button>
                            </div>
                        ) : (
                            <label className="flex flex-col gap-1.5 text-sm font-semibold">
                                The entry to keep
                                <Input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search the registry by name…"
                                    id="report-duplicate-search"
                                    autoFocus
                                />
                            </label>
                        )}
                        {!keep && q.length >= 2 && (
                            <ul className="m-0 flex max-h-56 list-none flex-col divide-y divide-input overflow-y-auto rounded-md border border-input p-0">
                                {shownResults.map((r) => (
                                    <li key={r.id}>
                                        <button
                                            type="button"
                                            className="flex w-full cursor-pointer flex-col items-start px-3 py-2 text-left hover:bg-muted"
                                            onClick={() => setKeep(r)}
                                        >
                                            <span className="text-sm font-medium">{r.title}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {[r.maker, r.scale].filter(Boolean).join(" · ")}
                                            </span>
                                        </button>
                                    </li>
                                ))}
                                {shownResults.length === 0 && (
                                    <li className="px-3 py-2 text-sm text-muted-foreground">
                                        {searching ? "Searching…" : "Nothing else matches."}
                                    </li>
                                )}
                            </ul>
                        )}
                        <label className="flex flex-col gap-1.5 text-sm font-semibold">
                            How can you tell?
                            <Textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Same mold, same model number — this one was added under the sculptor's name."
                                rows={3}
                                maxLength={500}
                                id="report-duplicate-reason"
                            />
                        </label>
                        {error && (
                            <p role="alert" className="m-0 text-sm font-semibold text-destructive">
                                {error}
                            </p>
                        )}
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                                Cancel
                            </Button>
                            <Button onClick={submit} disabled={pending} id="report-duplicate-submit">
                                {pending ? "Sending…" : "Send report"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
