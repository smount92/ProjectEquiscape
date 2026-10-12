"use client";

/**
 * Roadmap — the owners' goals, problems and chores in one place.
 *
 * Four columns by horizon (Now / Short / Long / Someday); problems
 * carry a red edge so what is broken reads before what is wished for.
 * Every row's status, horizon and priority change in place; the rest
 * edits in an expanding form. Done and dropped items hide behind a
 * toggle so the board only shows what is still open.
 *
 * Self-fetching like the other admin tabs; the actions re-gate on
 * ADMIN_EMAIL and tell us when migration 230 is not pasted yet.
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import {
    createRoadmapItem,
    deleteRoadmapItem,
    listRoadmap,
    updateRoadmapItem,
    type RoadmapItemInput,
} from "@/app/actions/admin-roadmap";
import {
    groupByHorizon,
    HORIZON_HINTS,
    HORIZON_LABELS,
    isClosed,
    isOverdue,
    isStale,
    KIND_LABELS,
    PRIORITY_LABELS,
    ROADMAP_AREAS,
    ROADMAP_HORIZONS,
    ROADMAP_KINDS,
    ROADMAP_PRIORITIES,
    ROADMAP_STATUSES,
    STATUS_LABELS,
    summarize,
    type RoadmapHorizon,
    type RoadmapItem,
    type RoadmapKind,
    type RoadmapStatus,
} from "@/lib/roadmap/model";
import { Button } from "@/components/ui/button";

const SELECT_CLASS =
    "h-8 rounded-md border border-input bg-card px-2 text-xs font-semibold text-foreground";
const INPUT_CLASS =
    "h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground";

function Stat({ value, label, tone = "plain" }: { value: number; label: string; tone?: "plain" | "warn" | "good" }) {
    const toneClass =
        tone === "warn" && value > 0 ? "text-destructive" : tone === "good" && value > 0 ? "text-forest" : "text-foreground";
    return (
        <div className="rounded-lg border border-input bg-card px-4 py-3">
            <div className={`font-serif text-2xl leading-none font-bold tabular-nums ${toneClass}`}>{value}</div>
            <div className="mt-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</div>
        </div>
    );
}

function KindChip({ kind }: { kind: RoadmapKind }) {
    const cls =
        kind === "problem"
            ? "bg-destructive/10 text-destructive"
            : kind === "goal"
              ? "bg-forest/10 text-forest"
              : "bg-muted text-muted-foreground";
    return (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-bold tracking-wide uppercase ${cls}`}>
            {KIND_LABELS[kind]}
        </span>
    );
}

const EMPTY_FORM: RoadmapItemInput = {
    title: "",
    detail: "",
    kind: "goal",
    horizon: "short",
    status: "open",
    priority: 2,
    area: "",
    source: "",
    link: "",
    dueOn: null,
};

function ItemForm({
    initial,
    submitLabel,
    busy,
    onSubmit,
    onCancel,
}: {
    initial: RoadmapItemInput;
    submitLabel: string;
    busy: boolean;
    onSubmit: (values: RoadmapItemInput) => void;
    onCancel?: () => void;
}) {
    const [v, setV] = useState<RoadmapItemInput>(initial);
    const set = <K extends keyof RoadmapItemInput>(key: K, value: RoadmapItemInput[K]) => setV((p) => ({ ...p, [key]: value }));

    return (
        <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
                e.preventDefault();
                onSubmit(v);
            }}
        >
            <input
                className={INPUT_CLASS}
                placeholder="What is it? (one line)"
                value={v.title}
                maxLength={160}
                required
                onChange={(e) => set("title", e.target.value)}
                aria-label="Title"
            />
            <textarea
                className="min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
                placeholder="Detail — what is wrong, what done looks like, where to look"
                value={v.detail ?? ""}
                maxLength={4000}
                onChange={(e) => set("detail", e.target.value)}
                aria-label="Detail"
            />
            <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(130px,1fr))]">
                <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
                    Kind
                    <select className={SELECT_CLASS} value={v.kind} onChange={(e) => set("kind", e.target.value as RoadmapKind)}>
                        {ROADMAP_KINDS.map((k) => (
                            <option key={k} value={k}>
                                {KIND_LABELS[k]}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
                    Horizon
                    <select
                        className={SELECT_CLASS}
                        value={v.horizon}
                        onChange={(e) => set("horizon", e.target.value as RoadmapHorizon)}
                    >
                        {ROADMAP_HORIZONS.map((h) => (
                            <option key={h} value={h}>
                                {HORIZON_LABELS[h]}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
                    Priority
                    <select
                        className={SELECT_CLASS}
                        value={String(v.priority ?? 2)}
                        onChange={(e) => set("priority", Number(e.target.value))}
                    >
                        {ROADMAP_PRIORITIES.map((p) => (
                            <option key={p} value={p}>
                                {p} · {PRIORITY_LABELS[p]}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
                    Status
                    <select
                        className={SELECT_CLASS}
                        value={v.status ?? "open"}
                        onChange={(e) => set("status", e.target.value as RoadmapStatus)}
                    >
                        {ROADMAP_STATUSES.map((s) => (
                            <option key={s} value={s}>
                                {STATUS_LABELS[s]}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
                    Area
                    <input
                        className={SELECT_CLASS}
                        list="roadmap-areas"
                        value={v.area ?? ""}
                        maxLength={40}
                        placeholder="shows, registry…"
                        onChange={(e) => set("area", e.target.value)}
                    />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
                    Due
                    <input
                        type="date"
                        className={SELECT_CLASS}
                        value={v.dueOn ?? ""}
                        onChange={(e) => set("dueOn", e.target.value || null)}
                    />
                </label>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
                <input
                    className={INPUT_CLASS}
                    placeholder="Source — who raised it, or where it came from"
                    value={v.source ?? ""}
                    maxLength={120}
                    onChange={(e) => set("source", e.target.value)}
                    aria-label="Source"
                />
                <input
                    className={INPUT_CLASS}
                    placeholder="Link — https://…"
                    value={v.link ?? ""}
                    maxLength={500}
                    onChange={(e) => set("link", e.target.value)}
                    aria-label="Link"
                />
            </div>
            <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" disabled={busy || !v.title.trim()}>
                    {busy ? "Saving…" : submitLabel}
                </Button>
                {onCancel && (
                    <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={busy}>
                        Cancel
                    </Button>
                )}
            </div>
        </form>
    );
}

function ItemRow({
    item,
    busy,
    onPatch,
    onDelete,
}: {
    item: RoadmapItem;
    busy: boolean;
    onPatch: (id: string, patch: Partial<RoadmapItemInput>) => void;
    onDelete: (id: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const closed = isClosed(item.status);
    const overdue = isOverdue(item);
    const stale = isStale(item);
    const edge =
        item.kind === "problem" && !closed
            ? "border-l-4 border-l-destructive"
            : item.status === "blocked"
              ? "border-l-4 border-l-amber-500"
              : "border-l-4 border-l-transparent";

    return (
        <li
            className={`rounded-md border border-input bg-card px-3 py-2 text-sm ${edge} ${closed ? "opacity-60" : ""}`}
            data-testid="roadmap-item"
            data-kind={item.kind}
            data-status={item.status}
        >
            <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <KindChip kind={item.kind} />
                        <span className="text-[0.65rem] font-bold text-muted-foreground tabular-nums">P{item.priority}</span>
                        {item.area && <span className="text-[0.65rem] text-muted-foreground">· {item.area}</span>}
                        {overdue && (
                            <span className="text-[0.65rem] font-bold text-destructive uppercase" data-testid="overdue">
                                overdue
                            </span>
                        )}
                        {stale && !overdue && (
                            <span className="text-[0.65rem] font-bold text-muted-foreground uppercase" data-testid="stale">
                                untouched 30 days
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        className={`mt-0.5 cursor-pointer border-0 bg-transparent p-0 text-left font-semibold text-foreground ${closed ? "line-through" : ""}`}
                        onClick={() => setOpen((o) => !o)}
                        aria-expanded={open}
                    >
                        {item.title}
                    </button>
                    <div className="text-xs text-muted-foreground">
                        {item.source && <>{item.source} · </>}
                        {item.dueOn && <>due {item.dueOn} · </>}
                        updated {new Date(item.updatedAt).toLocaleDateString()}
                        {item.link && (
                            <>
                                {" · "}
                                <a href={item.link} target="_blank" rel="noreferrer" className="underline">
                                    link ↗
                                </a>
                            </>
                        )}
                    </div>
                </div>
                <select
                    className={SELECT_CLASS}
                    value={item.status}
                    disabled={busy}
                    aria-label={`Status of ${item.title}`}
                    onChange={(e) => onPatch(item.id, { status: e.target.value as RoadmapStatus })}
                >
                    {ROADMAP_STATUSES.map((s) => (
                        <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                        </option>
                    ))}
                </select>
            </div>

            {open && (
                <div className="mt-3 border-t border-input pt-3">
                    {item.detail && (
                        <p className="m-0 mb-3 text-sm whitespace-pre-wrap text-secondary-foreground">{item.detail}</p>
                    )}
                    <ItemForm
                        initial={{
                            title: item.title,
                            detail: item.detail,
                            kind: item.kind,
                            horizon: item.horizon,
                            status: item.status,
                            priority: item.priority,
                            area: item.area,
                            source: item.source,
                            link: item.link,
                            dueOn: item.dueOn,
                        }}
                        submitLabel="Save"
                        busy={busy}
                        onSubmit={(values) => {
                            onPatch(item.id, values);
                            setOpen(false);
                        }}
                        onCancel={() => setOpen(false)}
                    />
                    <div className="mt-3 flex gap-2">
                        {confirming ? (
                            <>
                                <Button variant="destructive" size="sm" disabled={busy} onClick={() => onDelete(item.id)}>
                                    Delete for good
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>
                                    Keep
                                </Button>
                            </>
                        ) : (
                            <Button variant="destructive-outline" size="sm" onClick={() => setConfirming(true)}>
                                Delete
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </li>
    );
}

export default function AdminRoadmapTab() {
    const [items, setItems] = useState<RoadmapItem[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showClosed, setShowClosed] = useState(false);
    const [kindFilter, setKindFilter] = useState<RoadmapKind | "all">("all");
    const [adding, setAdding] = useState(false);
    const [pending, startTransition] = useTransition();

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const result = await listRoadmap();
            if (cancelled) return;
            if (!result.success) setError(result.error);
            else if (!result.schemaReady) setNotice(result.notice);
            else setItems(result.items);
            setLoaded(true);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const summary = useMemo(() => summarize(items), [items]);
    const visible = useMemo(
        () => (kindFilter === "all" ? items : items.filter((i) => i.kind === kindFilter)),
        [items, kindFilter],
    );
    const columns = useMemo(() => groupByHorizon(visible, showClosed), [visible, showClosed]);

    const add = (values: RoadmapItemInput) => {
        startTransition(async () => {
            setError(null);
            const result = await createRoadmapItem(values);
            if (!result.success) {
                setError(result.error);
                return;
            }
            setItems((prev) => [result.item, ...prev]);
            setAdding(false);
        });
    };

    const patch = (id: string, values: Partial<RoadmapItemInput>) => {
        startTransition(async () => {
            setError(null);
            const result = await updateRoadmapItem(id, values);
            if (!result.success) {
                setError(result.error);
                return;
            }
            setItems((prev) => prev.map((i) => (i.id === id ? result.item : i)));
        });
    };

    const remove = (id: string) => {
        startTransition(async () => {
            setError(null);
            const result = await deleteRoadmapItem(id);
            if (!result.success) {
                setError(result.error);
                return;
            }
            setItems((prev) => prev.filter((i) => i.id !== id));
        });
    };

    return (
        <div className="flex flex-col gap-6">
            <datalist id="roadmap-areas">
                {ROADMAP_AREAS.map((a) => (
                    <option key={a} value={a} />
                ))}
            </datalist>

            <section>
                <h2 className="mt-0 mb-1 text-base font-bold text-foreground">🧭 Roadmap</h2>
                <p className="mt-0 mb-4 text-xs text-muted-foreground">
                    Goals, problems and chores with a horizon and a status. Problems carry the red edge; blocked
                    items the amber one. Click a title to read the detail or edit it.
                </p>
                {notice && (
                    <p className="m-0 mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm" role="status">
                        {notice}
                    </p>
                )}
                {error && (
                    <p role="alert" className="m-0 mb-3 text-sm font-semibold text-destructive">
                        {error}
                    </p>
                )}
                <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(130px,1fr))]">
                    <Stat value={summary.openProblems} label="Open problems" tone="warn" />
                    <Stat value={summary.openByHorizon.now} label="Now" />
                    <Stat value={summary.openByHorizon.short} label="Short term" />
                    <Stat value={summary.openByHorizon.long} label="Long term" />
                    <Stat value={summary.blocked} label="Blocked" tone="warn" />
                    <Stat value={summary.overdue} label="Overdue" tone="warn" />
                    <Stat value={summary.doneRecently} label="Done, 30 days" tone="good" />
                </div>
            </section>

            <section className="flex flex-wrap items-center gap-2">
                {!adding ? (
                    <Button size="sm" onClick={() => setAdding(true)} disabled={!!notice}>
                        + Add an item
                    </Button>
                ) : null}
                <label className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    Show
                    <select
                        className={SELECT_CLASS}
                        value={kindFilter}
                        onChange={(e) => setKindFilter(e.target.value as RoadmapKind | "all")}
                    >
                        <option value="all">Everything</option>
                        {ROADMAP_KINDS.map((k) => (
                            <option key={k} value={k}>
                                {KIND_LABELS[k]}s
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
                    Include done &amp; dropped
                </label>
            </section>

            {adding && (
                <section className="rounded-lg border border-input bg-card p-4" data-testid="roadmap-add">
                    <h3 className="mt-0 mb-3 text-sm font-bold">New item</h3>
                    <ItemForm initial={EMPTY_FORM} submitLabel="Add" busy={pending} onSubmit={add} onCancel={() => setAdding(false)} />
                </section>
            )}

            {!loaded ? (
                <p className="m-0 text-sm text-muted-foreground">Reading the roadmap…</p>
            ) : items.length === 0 && !notice ? (
                <div className="rounded-lg border border-input bg-card px-8 py-12 text-center shadow-md">
                    <div className="mb-4 text-5xl">🧭</div>
                    <h2>Nothing on the roadmap yet</h2>
                    <p>Add the first goal or problem above.</p>
                </div>
            ) : (
                <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
                    {ROADMAP_HORIZONS.map((h) => (
                        <section key={h} data-testid={`horizon-${h}`}>
                            <h3 className="mt-0 mb-0.5 flex items-baseline gap-2 text-sm font-bold text-foreground">
                                {HORIZON_LABELS[h]}
                                <span className="text-xs font-semibold text-muted-foreground tabular-nums">{columns[h].length}</span>
                            </h3>
                            <p className="mt-0 mb-2 text-xs text-muted-foreground">{HORIZON_HINTS[h]}</p>
                            {columns[h].length === 0 ? (
                                <p className="m-0 rounded-md border border-dashed border-input px-3 py-4 text-center text-xs text-muted-foreground">
                                    Nothing here
                                </p>
                            ) : (
                                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                                    {columns[h].map((item) => (
                                        <ItemRow key={item.id} item={item} busy={pending} onPatch={patch} onDelete={remove} />
                                    ))}
                                </ul>
                            )}
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
}
