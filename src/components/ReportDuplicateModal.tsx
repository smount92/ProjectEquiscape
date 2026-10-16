"use client";

/**
 * "This entry duplicates another one."
 *
 * Filed from the entry that should go; the member searches for the
 * entry to keep. It lands in the registry suggestion queue as a
 * duplicate report (lib/catalog/duplicates); approving it merges the
 * two. Never auto-approved — a merge cannot be undone.
 *
 * The search is the Registry's own (findRegistryEntries, MHH-076): up to
 * 25 entries, the same mold first, each with the number, years, colour
 * and mold that tell look-alikes apart. With nothing typed it offers the
 * other entries on the same mold. The send button says what is missing
 * instead of looking dead.
 */

import { useEffect, useState, useTransition } from "react";
import { createSuggestion } from "@/app/actions/catalog-suggestions";
import { findRegistryEntries, type RegistryPick } from "@/app/actions/reference";
import { DUPLICATE_SUGGESTION_TYPE } from "@/lib/catalog/duplicates";
import { useToast } from "@/lib/context/ToastContext";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/** "#5002 · 1998 · light chestnut pinto · on Saddlebred" — what tells two look-alikes apart. */
export function pickDetail(p: RegistryPick): string {
    return [
        p.modelNumber ? `#${p.modelNumber}` : null,
        p.years,
        p.colour,
        p.moldTitle ? `on ${p.moldTitle}` : p.itemType === "plastic_mold" ? "mold" : null,
    ]
        .filter(Boolean)
        .join(" · ");
}

/** Why the report can't be sent yet, in words for the button; null when it can. */
export function sendBlocker(keep: RegistryPick | null, reason: string): string | null {
    if (!keep) return "Pick the entry to keep first";
    if (reason.trim().length < 10) return "Say how you can tell (10+ characters)";
    return null;
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
    const [results, setResults] = useState<RegistryPick[]>([]);
    const [more, setMore] = useState(false);
    const [searching, setSearching] = useState(false);
    const [searchedFor, setSearchedFor] = useState<string | null>(null);
    const [keep, setKeep] = useState<RegistryPick | null>(null);
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");
    const [pending, startTransition] = useTransition();
    const { toast } = useToast();

    // Search as the member types (debounced); with nothing typed, the other
    // entries on the same mold. State only changes once the search settles.
    const q = query.trim();
    const term = q.length >= 2 ? q : "";
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        const t = setTimeout(
            async () => {
                setSearching(true);
                const found = await findRegistryEntries(term, catalogItem.id);
                if (cancelled) return;
                setResults(found.picks);
                setMore(found.more);
                setSearchedFor(term);
                setSearching(false);
            },
            term ? 250 : 0,
        );
        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [term, open, catalogItem.id]);
    const shown = searchedFor === term ? results : [];

    const blocker = sendBlocker(keep, reason);
    const submit = () => {
        setError("");
        if (blocker || !keep) return;
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
                            Find the entry that should stay. If an admin agrees, every horse, wishlist and photo linked
                            to this entry moves to that one and this entry is removed.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-3">
                        {keep ? (
                            <div
                                className="flex items-center justify-between gap-3 rounded-md border border-input bg-muted/40 px-3 py-2"
                                data-testid="report-duplicate-keep"
                            >
                                <span className="min-w-0 text-sm">
                                    Keep <strong>{keep.title}</strong>
                                    <span className="block text-xs text-muted-foreground">
                                        {[pickDetail(keep), keep.maker].filter(Boolean).join(" · ")}
                                    </span>
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
                                    placeholder="Search by name or model number…"
                                    id="report-duplicate-search"
                                    autoFocus
                                />
                            </label>
                        )}
                        {!keep && (
                            <div className="flex flex-col gap-1">
                                {!term && shown.length > 0 && (
                                    <p className="m-0 text-xs text-muted-foreground">On the same mold</p>
                                )}
                                <ul
                                    className="m-0 flex max-h-72 list-none flex-col divide-y divide-input overflow-y-auto rounded-md border border-input p-0"
                                    data-testid="report-duplicate-results"
                                >
                                    {shown.map((r) => (
                                        <li key={r.id}>
                                            <button
                                                type="button"
                                                className="flex w-full cursor-pointer flex-col items-start px-3 py-2 text-left hover:bg-muted"
                                                onClick={() => setKeep(r)}
                                                data-testid="report-duplicate-pick"
                                            >
                                                <span className="text-sm font-medium">
                                                    {r.title}
                                                    {r.sameMold && term ? (
                                                        <span className="ml-1.5 rounded bg-forest/10 px-1.5 align-middle text-[0.65rem] font-bold text-forest uppercase">
                                                            same mold
                                                        </span>
                                                    ) : null}
                                                </span>
                                                {pickDetail(r) && (
                                                    <span className="text-xs text-secondary-foreground">
                                                        {pickDetail(r)}
                                                    </span>
                                                )}
                                                <span className="text-xs text-muted-foreground">
                                                    {[r.maker, r.scale].filter(Boolean).join(" · ")}
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                    {shown.length === 0 && (
                                        <li className="px-3 py-2 text-sm text-muted-foreground">
                                            {searching || searchedFor !== term
                                                ? "Searching…"
                                                : term
                                                  ? "Nothing else matches. Try the model number, or the mold's name."
                                                  : "Type the name or model number of the entry to keep."}
                                        </li>
                                    )}
                                </ul>
                                {more && shown.length > 0 && (
                                    <p className="m-0 text-xs text-muted-foreground">
                                        Showing the first {shown.length}. Add a word or the model number to narrow it.
                                    </p>
                                )}
                            </div>
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
                            <Button onClick={submit} disabled={pending || !!blocker} id="report-duplicate-submit">
                                {pending ? "Sending…" : (blocker ?? "Send report")}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
