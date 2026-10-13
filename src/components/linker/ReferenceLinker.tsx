"use client";

/**
 * The new reference linker — the Reference step of the add-horse form
 * redrawn as a funnel: scale first, then the mold with one identity
 * line, then the release by what it looks like, with every missing fact
 * named in the row and fillable on the spot. Opt-in beside the old
 * picker (ReferenceLinkerSwitch) so members can try it and go back.
 *
 * Shapes and rules live in src/lib/linker/model.ts; reads and writes in
 * src/app/actions/linker.ts. This file only lays them out.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { getCatalogItem, type CatalogItem } from "@/app/actions/reference";
import { fileReleaseFact, fileReleaseUnderMold, searchLinker } from "@/app/actions/linker";
import {
    identityLine,
    LINKER_SCALES,
    linkedLabel,
    missingFacts,
    shortScale,
    yearsLabel,
    releaseName,
    type LinkerMold,
    type LinkerMoldSummary,
    type LinkerRelease,
    type LinkerResult,
    type MissingFact,
} from "@/lib/linker/model";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SuggestNewEntryForm from "@/components/SuggestNewEntryForm";
import { useLocalPref } from "@/lib/linker/prefs";

const SCALE_KEY = "mhh:linker-scale";
const SHOW_FIRST = 4;

export interface ReferenceLinkerProps {
    selectedCatalogId: string | null;
    onCatalogSelect: (catalogId: string | null, item: CatalogItem | null) => void;
    /** The finish declared on the horse form; changes the help line, never the list. */
    finishType?: string | null;
    /** After "Suggest an entry" is filed: the host names the horse after it, as the old picker does. */
    onCustomEntry?: (searchTerm: string) => void;
}

function Chip({ on, children, onClick, testid }: { on: boolean; children: React.ReactNode; onClick: () => void; testid?: string }) {
    return (
        <button
            type="button"
            aria-pressed={on}
            data-testid={testid}
            onClick={onClick}
            className={`cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors ${
                on ? "border-forest bg-forest/10 font-semibold text-forest" : "border-input bg-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
            {children}
        </button>
    );
}

function Photo({ src, alt }: { src: string | null; alt: string }) {
    return src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-11 w-11 shrink-0 rounded-md border border-input object-cover" />
    ) : (
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-input bg-muted text-center text-[0.6rem] leading-tight text-muted-foreground">
            no photo yet
        </div>
    );
}

function FactForm({ release, fact, onDone }: { release: LinkerRelease; fact: MissingFact; onDone: (msg: string) => void }) {
    const [value, setValue] = useState("");
    const [pending, start] = useTransition();
    const [error, setError] = useState<string | null>(null);
    return (
        <form
            className="mt-2 flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                    const r = await fileReleaseFact({ catalogId: release.id, fact, value });
                    if (!r.success) setError(r.error);
                    else onDone(`Thanks. The ${fact} is filed for review.`);
                });
            }}
        >
            <input
                className="h-8 min-w-0 flex-1 rounded-md border border-input bg-card px-2 text-sm"
                placeholder={fact === "colour" ? "what it looks like" : fact === "year" ? "first year, e.g. 1976" : "e.g. 5022"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                aria-label={`${fact} for ${release.title}`}
            />
            <Button type="submit" size="sm" disabled={pending || !value.trim()}>
                {pending ? "Filing…" : "File it"}
            </Button>
            {error && <span className="text-xs text-destructive">{error}</span>}
        </form>
    );
}

function ReleaseRow({
    mold,
    release,
    selected,
    onPick,
    onNotice,
}: {
    mold: LinkerMold | LinkerMoldSummary | null;
    release: LinkerRelease;
    selected: boolean;
    onPick: () => void;
    onNotice: (msg: string) => void;
}) {
    const [filling, setFilling] = useState<MissingFact | null>(null);
    const gaps = missingFacts(release);
    const years = yearsLabel(release);
    // A release with its own name ("Montana Harvest", "T-Bone") says so; the mold's name and set titles are already on screen.
    // Amanda's rule (trial, 2026-10-12): number, then the release's own name in
    // bold, then everything else below. A release with no name of its own leads
    // with its colour instead, so "the mold in chestnut" still reads at a glance.
    const name = releaseName(release, mold?.title);
    const missingLook = release.isSetPiece ? "colour not recorded for this piece" : "colour not recorded";
    return (
        <li
            className={`grid grid-cols-[44px_1fr] items-center gap-x-3 gap-y-2 border-t border-input px-4 py-2.5 sm:grid-cols-[44px_1fr_auto] ${selected ? "bg-forest/5" : release.hit ? "bg-amber-500/5" : ""}`}
            data-testid="linker-release"
            data-release-id={release.id}
        >
            <Photo src={release.photo} alt="" />
            <div className="min-w-0">
                {name ? (
                    <>
                        <div className="text-sm font-bold text-foreground" data-testid="linker-row-lead">
                            {release.model ? `#${release.model} · ` : ""}
                            {name}
                            {release.hit ? <span className="ml-1 rounded bg-amber-500/15 px-1.5 align-middle text-[0.65rem] font-bold text-amber-800 uppercase dark:text-amber-300">matches your search</span> : null}
                        </div>
                        <div className={`text-xs ${release.look ? "text-secondary-foreground" : "italic text-muted-foreground"}`}>{release.look ?? missingLook}</div>
                    </>
                ) : (
                    <div className={`text-sm ${release.look ? "font-semibold text-foreground" : "italic text-muted-foreground"}`} data-testid="linker-row-lead">
                        {release.model ? `#${release.model} · ` : ""}
                        {release.look ?? missingLook}
                        {release.hit ? <span className="ml-1 rounded bg-amber-500/15 px-1.5 align-middle text-[0.65rem] font-bold text-amber-800 uppercase not-italic dark:text-amber-300">matches your search</span> : null}
                    </div>
                )}
                <div className="text-xs text-muted-foreground">
                    {years ?? <span className="text-amber-700 dark:text-amber-400">year not recorded</span>}
                    {release.run ? ` · ${release.run}` : ""}
                </div>
                {release.setName && <div className="text-xs text-muted-foreground/80">from the {release.setName}</div>}
                {gaps.length > 0 && !filling && (
                    <div className="text-xs text-muted-foreground">
                        know the {gaps.join(" or ")}?{" "}
                        <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-xs text-forest underline" onClick={() => setFilling(gaps[0])}>
                            fill in what you know
                        </button>
                    </div>
                )}
                {filling && <FactForm release={release} fact={filling} onDone={(m) => { setFilling(null); onNotice(m); }} />}
            </div>
            <Button
                type="button"
                size="sm"
                variant={selected ? "default" : "outline"}
                onClick={onPick}
                data-testid="linker-pick"
                className="col-span-2 justify-self-end sm:col-span-1"
            >
                {selected ? "Linked" : "This one"}
            </Button>
        </li>
    );
}

function AddForm({ mold, horseLook, onDone, onCancel }: { mold: LinkerMold; horseLook?: string | null; onDone: (msg: string, moldId: string) => void; onCancel: () => void }) {
    const [v, setV] = useState({ modelNumber: "", look: horseLook ?? "", yearFrom: "", setName: "", name: "" });
    const [pending, start] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const field = (k: keyof typeof v, label: string, placeholder: string) => (
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
            {label}
            <input className="h-9 rounded-md border border-input bg-card px-2 text-sm font-normal text-foreground" placeholder={placeholder} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
        </label>
    );
    return (
        <form
            className="grid gap-2 border-t border-input bg-muted/40 px-4 py-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]"
            data-testid="linker-add"
            onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                    setError(null);
                    const r = await fileReleaseUnderMold({ moldId: mold.id, ...v });
                    if (!r.success) setError(r.error);
                    else onDone(r.autoApproved ? "Added to the Registry under this mold. Your horse is linked to the mold for now; pick the release once it appears." : "Filed under this mold for review. Your horse is linked to the mold for now.", mold.id);
                });
            }}
        >
            <div className="col-span-full text-xs text-muted-foreground">
                Under <strong className="text-foreground">{mold.title}</strong> · {identityLine(mold)}. Nothing here needs retyping later.
            </div>
            {field("modelNumber", "Model number", "5022")}
            {field("look", "What it looks like", "dark chestnut, various socks")}
            {field("yearFrom", "First year", "1976")}
            {field("name", "Name, if it had one", "Andrew")}
            {field("setName", "Came in a set?", "leave blank if sold alone")}
            <div className="col-span-full flex flex-wrap items-center gap-2">
                <Button type="submit" size="sm" disabled={pending}>
                    {pending ? "Filing…" : "Add it under this mold"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={onCancel}>
                    Cancel
                </Button>
                {error && <span className="text-xs text-destructive">{error}</span>}
            </div>
        </form>
    );
}

function MoldGroup({
    mold,
    selectedId,
    onPickRelease,
    onPickMold,
    onNotice,
    horseLook,
}: {
    mold: LinkerMold;
    selectedId: string | null;
    onPickRelease: (r: LinkerRelease, m: LinkerMold) => void;
    onPickMold: (m: LinkerMold) => void;
    onNotice: (msg: string) => void;
    horseLook?: string | null;
}) {
    const [open, setOpen] = useState(false);
    const [adding, setAdding] = useState(false);
    const shown = open ? mold.releases : mold.releases.slice(0, SHOW_FIRST);
    const hidden = mold.releases.length - shown.length;
    const hiddenSets = mold.releases.slice(shown.length).filter((r) => r.setName || r.isSetPiece).length;
    const setCount = mold.releases.filter((r) => r.setName || r.isSetPiece).length;
    const moldSelected = selectedId === mold.id;
    return (
        <section className="rounded-lg border border-input bg-card" data-testid="linker-mold" data-mold-id={mold.id}>
            <div className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                    <div className="font-serif text-lg font-bold leading-tight text-foreground">
                        <Link href={mold.href} target="_blank" rel="noreferrer" className="text-foreground no-underline hover:underline">
                            {mold.title}
                        </Link>
                    </div>
                    <div className="text-sm text-secondary-foreground" data-testid="linker-identity">{identityLine(mold)}</div>
                    <div className="text-xs text-muted-foreground">
                        <strong className="text-secondary-foreground">
                            {mold.releases.length} release{mold.releases.length === 1 ? "" : "s"}
                        </strong>
                        {setCount > 0 && `, ${setCount} of them set pieces`}
                        {!!mold.owners && ` · ${mold.owners} collector${mold.owners === 1 ? "" : "s"} linked to this mold`}
                    </div>
                    {mold.ambiguous && (
                        <div className="mt-1 rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-800 dark:text-amber-300" data-testid="linker-ambiguous">
                            Two Registry entries share this name and scale. Pick by the releases below, or link either; a steward will merge them.
                        </div>
                    )}
                </div>
                <span className="rounded bg-muted px-2 py-0.5 text-[0.65rem] font-bold tracking-wide text-muted-foreground uppercase">mold</span>
            </div>

            {mold.releases.length === 0 ? (
                <p className="m-0 border-t border-input px-4 py-3 text-sm text-muted-foreground" data-testid="linker-no-releases">
                    No releases catalogued for this mold yet. Link the mold, or add yours below.
                </p>
            ) : (
                <ul className="m-0 list-none p-0">
                    {shown.map((r) => (
                        <ReleaseRow key={r.id} mold={mold} release={r} selected={selectedId === r.id} onPick={() => onPickRelease(r, mold)} onNotice={onNotice} />
                    ))}
                </ul>
            )}
            {hidden > 0 && (
                <div className="flex items-center justify-between gap-2 border-t border-input px-4 py-2 text-sm text-muted-foreground">
                    <span>
                        {hidden} more{hiddenSets > 0 ? `, including ${hiddenSets} set piece${hiddenSets === 1 ? "" : "s"}` : ""}
                    </span>
                    <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
                        Show all
                    </Button>
                </div>
            )}
            {open && mold.releases.length > SHOW_FIRST && (
                <div className="border-t border-input px-4 py-2 text-right">
                    <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
                        Show fewer
                    </Button>
                </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-input px-4 py-2 text-sm text-muted-foreground">
                <span>
                    <strong className="text-foreground">Mine isn&apos;t here.</strong> Add it under this mold.
                </span>
                <Button type="button" size="sm" variant="outline" onClick={() => setAdding((a) => !a)} data-testid="linker-add-open">
                    Add my release
                </Button>
            </div>
            {adding && <AddForm mold={mold} horseLook={horseLook} onDone={(msg, id) => { setAdding(false); onNotice(msg); onPickMold(mold); void id; }} onCancel={() => setAdding(false)} />}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-input px-4 py-2 text-sm text-muted-foreground">
                <span>Not sure which release? Link the mold and decide later.</span>
                <Button type="button" size="sm" variant={moldSelected ? "default" : "outline"} onClick={() => onPickMold(mold)} data-testid="linker-pick-mold">
                    {moldSelected ? "Linked" : "Link the mold only"}
                </Button>
            </div>
        </section>
    );
}

export default function ReferenceLinker({ selectedCatalogId, onCatalogSelect, finishType, onCustomEntry }: ReferenceLinkerProps) {
    const [scale, chooseScale] = useLocalPref(SCALE_KEY, "any");
    const [q, setQ] = useState("");
    const [suggesting, setSuggesting] = useState(false);
    const [result, setResult] = useState<LinkerResult | null>(null);
    const [searching, setSearching] = useState(false);
    const [banner, setBanner] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
    const seq = useRef(0);

    const run = useCallback(
        (term: string, sc: string) => {
            const n = ++seq.current;
            setSearching(true);
            searchLinker(term, sc === "any" ? null : sc)
                .then((r) => {
                    if (n !== seq.current) return;
                    setResult(r);
                })
                .finally(() => {
                    if (n === seq.current) setSearching(false);
                });
        },
        [],
    );

    useEffect(() => {
        if (debounce.current) clearTimeout(debounce.current);
        if (q.trim().length < 2) return;
        debounce.current = setTimeout(() => run(q, scale), 300);
        return () => {
            if (debounce.current) clearTimeout(debounce.current);
        };
    }, [q, scale, run]);

    const link = async (id: string, label: string, why: string) => {
        setBanner(label);
        setNotice(why);
        const item = await getCatalogItem(id);
        onCatalogSelect(id, item);
    };

    const pickRelease = (r: LinkerRelease, m: LinkerMold | LinkerMoldSummary | null) =>
        link(
            r.id,
            linkedLabel(m, r),
            r.look
                ? "The passport will show the mold, the release and its colour. Values and buyers match on this exact release."
                : "The passport will show the mold and the release. Add the colour when you know it and it will show there too.",
        );
    const pickMold = (m: LinkerMold | LinkerMoldSummary) =>
        link(m.id, linkedLabel(m, null), "Linked to the sculpture. Pick the exact release any time from the passport.");

    const clear = () => {
        setBanner(null);
        setNotice(null);
        onCatalogSelect(null, null);
    };

    const finishNote =
        finishType === "custom" || finishType === "Custom"
            ? "A custom is its own horse. Linking is optional; if you know the base mold, link the mold so the passport can say what it was painted on."
            : finishType && /resin/i.test(finishType)
              ? "Artist resins link to the sculpture, not a release. Search the resin’s name or the artist."
              : null;

    return (
        <div className="flex flex-col gap-3" data-testid="reference-linker">
            <div>
                <p className="m-0 mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Scale</p>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Scale">
                    {LINKER_SCALES.map((s) => (
                        <Chip key={s} on={scale === s} onClick={() => chooseScale(s)} testid={`scale-${shortScale(s).toLowerCase().replace(/\s+/g, "-")}`}>
                            {shortScale(s)}
                        </Chip>
                    ))}
                    <Chip on={scale === "any"} onClick={() => chooseScale("any")} testid="scale-any">
                        Any scale
                    </Chip>
                </div>
            </div>

            {finishNote && <p className="m-0 rounded-md bg-muted px-3 py-2 text-sm text-secondary-foreground">{finishNote}</p>}

            <div className="relative">
                <input
                    id="linker-search"
                    type="search"
                    autoComplete="off"
                    className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                    placeholder="Mold name, release name, or model number"
                    value={q}
                    onChange={(e) => {
                        setQ(e.target.value);
                        if (e.target.value.trim().length < 2) setResult(null);
                    }}
                    aria-label="Find the model"
                />
                {searching && <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">searching…</span>}
            </div>

            {banner && (
                <div className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-forest bg-forest/10 px-4 py-3" data-testid="linker-banner">
                    <div className="min-w-0">
                        <div className="font-serif font-bold text-foreground">Linked: {banner}</div>
                        {notice && <div className="text-sm text-secondary-foreground">{notice}</div>}
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={clear}>
                        Unlink
                    </Button>
                </div>
            )}
            {!banner && notice && (
                <p className="m-0 rounded-md bg-forest/10 px-3 py-2 text-sm text-foreground" role="status">
                    {notice}
                </p>
            )}
            {!banner && selectedCatalogId && (
                <p className="m-0 text-xs text-muted-foreground">Already linked. Pick another below to change it, or carry on.</p>
            )}

            {result && result.kind === "number" && (
                <div className="flex flex-col gap-2" data-testid="linker-number">
                    {result.numberHits.length === 0 ? (
                        <p className="m-0 rounded-md bg-muted px-3 py-2 text-sm text-secondary-foreground">
                            No release with number {result.term.trim()} yet. Search the mold name instead, then add the release under it with that number.
                        </p>
                    ) : (
                        <>
                            <p className="m-0 text-xs text-muted-foreground">
                                Model number {result.term.trim().replace(/^#/, "")} · {result.numberHits.length} match{result.numberHits.length === 1 ? "" : "es"}
                                {result.numberHits.length > 1 ? ", one per mold in the set" : ""}
                            </p>
                            {result.numberHits.map((h) => (
                                <section key={h.release.id} className="rounded-lg border border-input bg-card">
                                    <div className="px-4 py-2">
                                        <div className="font-serif font-bold text-foreground">{h.mold?.title ?? h.release.title}</div>
                                        <div className="text-xs text-secondary-foreground">
                                            {h.mold ? identityLine({ ...h.mold, sculptor: null }) : "not filed under a mold yet"}
                                        </div>
                                    </div>
                                    <ul className="m-0 list-none p-0">
                                        <ReleaseRow mold={h.mold} release={h.release} selected={selectedCatalogId === h.release.id} onPick={() => pickRelease(h.release, h.mold)} onNotice={setNotice} />
                                    </ul>
                                </section>
                            ))}
                        </>
                    )}
                </div>
            )}

            {result && result.kind === "text" && (
                <div className="flex flex-col gap-3">
                    {result.molds.length > 0 ? (
                        <>
                            <p className="m-0 text-xs text-muted-foreground" data-testid="linker-count">
                                {result.molds.length} mold{result.molds.length === 1 ? "" : "s"}
                                {scale !== "any" ? ` at ${shortScale(scale)}` : ""}
                            </p>
                            {result.molds.map((m) => (
                                <MoldGroup key={m.id} mold={m} selectedId={selectedCatalogId} onPickRelease={pickRelease} onPickMold={pickMold} onNotice={setNotice} />
                            ))}
                        </>
                    ) : (
                        <p className="m-0 rounded-md bg-muted px-3 py-2 text-sm text-secondary-foreground" data-testid="linker-none">
                            {scale !== "any" && result.otherScales.length > 0
                                ? `No ${shortScale(scale)} mold by that name. The matches below are other scales; pick one or change the scale above.`
                                : "Nothing in the Registry by that name. Check the spelling, try the maker's name for it, or suggest it below."}
                        </p>
                    )}

                    {result.otherScales.length > 0 && (
                        <div data-testid="linker-other-scales">
                            <p className="m-0 mb-1 text-xs text-muted-foreground">Same name, other scales</p>
                            <div className="flex flex-col gap-2">
                                {result.otherScales.map((m) => (
                                    <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-input bg-card px-4 py-2">
                                        <div className="min-w-0">
                                            <div className="font-serif font-bold text-foreground">{m.title}</div>
                                            <div className="text-xs text-secondary-foreground">
                                                {identityLine({ ...m, sculptor: null })} · {m.releaseCount} release{m.releaseCount === 1 ? "" : "s"}
                                                {m.hitTitle ? ` · has ${m.hitTitle}` : ""}
                                            </div>
                                        </div>
                                        <Button type="button" size="sm" variant="outline" onClick={() => chooseScale(m.scale ?? "any")}>
                                            Look here
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {result.others.length > 0 && (
                        <div data-testid="linker-others">
                            <p className="m-0 mb-1 text-xs text-muted-foreground">Resins and other pieces</p>
                            <div className="flex flex-col gap-2">
                                {result.others.map((o) => (
                                    <div key={o.id} className="flex items-center justify-between gap-3 rounded-lg border border-input bg-card px-4 py-2">
                                        <div className="min-w-0">
                                            <div className="font-semibold text-foreground">{o.title}</div>
                                            <div className="text-xs text-secondary-foreground">
                                                {[o.itemType.replace(/_/g, " "), o.maker, o.scale ? shortScale(o.scale) : null, o.look].filter(Boolean).join(" · ")}
                                            </div>
                                        </div>
                                        <Button type="button" size="sm" variant={selectedCatalogId === o.id ? "default" : "outline"} onClick={() => link(o.id, `${o.title} · ${o.maker}`, "Linked.")}>
                                            {selectedCatalogId === o.id ? "Linked" : "This one"}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-input px-3 py-2 text-xs text-muted-foreground">
                <span>
                    Not in the Registry at all, mold and all? Suggest it; the community reviews it and you get contributor credit.
                </span>
                <Button type="button" size="sm" variant="outline" onClick={() => setSuggesting(true)} data-testid="linker-suggest-open">
                    Suggest an entry
                </Button>
            </div>
            <p className="m-0 text-xs text-muted-foreground">
                Linking is optional. A one-of-a-kind is still a horse.
            </p>

            <Dialog open={suggesting} onOpenChange={(open) => { if (!open) setSuggesting(false); }}>
                <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-[580px]">
                    <DialogHeader>
                        <DialogTitle>Suggest a new entry</DialogTitle>
                        <DialogDescription>
                            For a mold, resin or release the Registry does not hold yet. If the mold is here and only your release is missing, use &quot;Add my release&quot; under that mold instead.
                        </DialogDescription>
                    </DialogHeader>
                    <SuggestNewEntryForm
                        key={q}
                        variant="dialog"
                        initialTitle={q.trim()}
                        onCancel={() => setSuggesting(false)}
                        onSubmitted={(title) => {
                            setSuggesting(false);
                            setNotice("Suggested for the Registry. Your horse keeps that name until the entry is approved; link it then.");
                            onCustomEntry?.(title);
                        }}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}
