"use client";
/**
 * "Bought as a set" — link this horse with others from the stable under
 * one purchase price (224). Lives in the edit form's Sealed leaf, next
 * to the vault fields, and saves on its own: linking touches several
 * horses' vault rows, which the single-horse form save never does.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { linkSetPurchase, listMyHorsesForSet, unlinkSetPurchase } from "@/app/actions/set-purchase";
import { formatMoney } from "@/lib/money/format";
import { shareOf, type SetPurchase } from "@/lib/vault/setPurchase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SetPurchasePanel({
    horseId,
    horseName,
    initial,
    currencySymbol = "$",
}: {
    horseId: string;
    horseName: string;
    initial: SetPurchase | null;
    currencySymbol?: string;
}) {
    const router = useRouter();
    const [set, setSet] = useState<SetPurchase | null>(initial);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [options, setOptions] = useState<{ id: string; name: string }[]>([]);
    const [chosen, setChosen] = useState<{ id: string; name: string }[]>([]);
    const [price, setPrice] = useState("");
    const [label, setLabel] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        const t = setTimeout(() => {
            listMyHorsesForSet(query, horseId)
                .then((rows) => { if (!cancelled) setOptions(rows); })
                .catch(() => { if (!cancelled) setOptions([]); });
        }, 250);
        return () => { cancelled = true; clearTimeout(t); };
    }, [open, query, horseId]);

    const link = async () => {
        const n = Number(price);
        if (!Number.isFinite(n) || n <= 0) { setError("Enter the price paid for the whole set."); return; }
        if (chosen.length === 0) { setError("Pick at least one other horse from the set."); return; }
        setBusy(true);
        setError(null);
        const result = await linkSetPurchase({ horseIds: [horseId, ...chosen.map((c) => c.id)], price: n, label: label || undefined });
        setBusy(false);
        if (!result.success) { setError(result.error); return; }
        setSet({ groupId: result.groupId, label: label.trim() || null, price: n, members: [{ id: horseId, name: horseName }, ...chosen] });
        setOpen(false);
        router.refresh();
    };

    const unlink = async () => {
        setBusy(true);
        setError(null);
        const result = await unlinkSetPurchase(horseId);
        setBusy(false);
        if (!result.success) { setError(result.error); return; }
        setSet(null);
        router.refresh();
    };

    return (
        <div className="mt-6 rounded-lg border border-dashed border-input p-4" data-testid="set-purchase">
            <h3 className="m-0 font-serif text-sm font-bold tracking-wide uppercase">Bought as a set?</h3>
            {set ? (
                <div className="mt-2 text-sm">
                    <p className="m-0">
                        <strong>{set.label || `Set of ${set.members.length}`}</strong> · {formatMoney(set.price, currencySymbol, { decimals: 2 })} for the set ·
                        this horse&apos;s share ≈ {formatMoney(shareOf(set.price, set.members.length), currencySymbol, { decimals: 2 })}
                    </p>
                    <p className="mt-1 mb-0 text-muted-foreground">
                        With{" "}
                        {set.members.filter((m) => m.id !== horseId).map((m, i, arr) => (
                            <span key={m.id}>
                                <Link href={`/stable/${m.id}`} className="underline underline-offset-2">{m.name}</Link>
                                {i < arr.length - 1 ? ", " : ""}
                            </span>
                        ))}
                        . The vault total counts the set once.
                    </p>
                    <Button type="button" variant="outline" size="sm" className="mt-3" onClick={unlink} disabled={busy} id="set-purchase-unlink">
                        Remove this horse from the set
                    </Button>
                </div>
            ) : !open ? (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                    <p className="m-0">
                        Paid one price for several models? Link them, and the vault counts that price once
                        instead of under every horse.
                    </p>
                    <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} id="set-purchase-open">
                        Link horses bought together
                    </Button>
                </div>
            ) : (
                <div className="mt-3 flex flex-col gap-3 text-sm">
                    <label className="flex flex-col gap-1.5 font-semibold">
                        Other horses in the set
                        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your stable by name…" id="set-purchase-search" />
                    </label>
                    {chosen.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {chosen.map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setChosen((prev) => prev.filter((p) => p.id !== c.id))}
                                    className="rounded-full border border-forest/40 bg-forest/10 px-2.5 py-0.5 text-xs font-semibold text-forest"
                                    title="Remove"
                                >
                                    {c.name} ✕
                                </button>
                            ))}
                        </div>
                    )}
                    <ul className="m-0 max-h-40 list-none overflow-y-auto rounded-md border border-input p-0">
                        {options.filter((o) => !chosen.some((c) => c.id === o.id)).map((o) => (
                            <li key={o.id}>
                                <button
                                    type="button"
                                    onClick={() => setChosen((prev) => [...prev, o])}
                                    className="w-full cursor-pointer border-0 bg-transparent px-3 py-1.5 text-left hover:bg-muted"
                                >
                                    + {o.name}
                                </button>
                            </li>
                        ))}
                        {options.length === 0 && <li className="px-3 py-1.5 text-muted-foreground">No other horses match.</li>}
                    </ul>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="flex flex-col gap-1.5 font-semibold">
                            Price paid for the whole set ({currencySymbol})
                            <Input type="number" inputMode="decimal" step="0.01" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="120.00" id="set-purchase-price" />
                        </label>
                        <label className="flex flex-col gap-1.5 font-semibold">
                            What the set was (optional)
                            <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder="VC Classic Mustang Family" id="set-purchase-label" />
                        </label>
                    </div>
                    {error && <p className="m-0 text-destructive">{error}</p>}
                    <div className="flex gap-2">
                        <Button type="button" onClick={link} disabled={busy} id="set-purchase-link">
                            {busy ? "Linking…" : `Link ${chosen.length + 1} horses as one purchase`}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
                    </div>
                </div>
            )}
            {set === null && error && !open && <p className="mt-2 mb-0 text-sm text-destructive">{error}</p>}
        </div>
    );
}
