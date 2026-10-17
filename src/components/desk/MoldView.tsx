"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/context/ToastContext";
import { buildDeskFields, deskChanges, type DeskSource } from "@/lib/catalog/editableFields";
import { addItem, getItemForEdit, saveItem, type DeskRelease } from "@/app/actions/registry-desk";
import { undoAction } from "@/app/actions/registry-desk-lists";
import FlagChips from "@/components/desk/FlagChips";
import ItemEditor from "@/components/desk/ItemEditor";
import LeaveDialog from "@/components/desk/LeaveDialog";
import MergeDialog from "@/components/desk/MergeDialog";
import MoldMergeDialog from "@/components/desk/MoldMergeDialog";
import ReleaseRail, { type RailEntry } from "@/components/desk/ReleaseRail";
import RemoveDialog from "@/components/desk/RemoveDialog";
import useDeskKeys from "@/components/desk/useDeskKeys";
import useLeaveGuard from "@/components/desk/useLeaveGuard";

export type MoldFilter = "all" | "needs" | "good";
type Drafts = Record<string, Record<string, string>>;
type FieldError = { field: string | null; message: string };

const text = (v: unknown) => (v == null ? "" : Array.isArray(v) ? v.join(", ") : String(v));
const UNDO_TOAST_MS = 9000;

function railEntry(e: DeskRelease, dirty: boolean): RailEntry {
    const a = e.row.attributes ?? {};
    const start = text(a.release_year_start);
    const end = text(a.release_year_end);
    return {
        id: e.row.id,
        title: e.row.title,
        isMold: e.row.item_type === "plastic_mold",
        number: text(a.model_number),
        colour: text(a.color_description),
        years: start && end && end !== start ? `${start}–${end}` : start || end,
        run: text(a.run_type),
        horses: e.horses,
        wantLists: e.wantLists,
        flags: e.flags,
        dirty,
    };
}

/** Keep ?release= in the address so a reload or a shared link opens the same release. */
function rememberRelease(id: string | null, moldId: string | null) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (!id || id === moldId) url.searchParams.delete("release");
    else url.searchParams.set("release", id);
    window.history.replaceState(window.history.state, "", url.toString());
}

/**
 * The Mold view: pick a mold, click through its releases one by one, and
 * each release's full record opens below to edit and save (owner,
 * 2026-10-16). Unsaved changes are kept per release while moving around,
 * marked with a dot, and leaving with any unsaved (a link, Back, or
 * closing the tab) asks first. Save, Prev and Next sit in one bar under
 * the editor, outside it, so they keep focus from release to release.
 */
export default function MoldView({
    mold: initialMold,
    releases: initialReleases,
    initialReleaseId,
    role,
    parentTitle: standaloneParentTitle = null,
    fieldKeys = [],
    initialFilter = "all",
    backHref = null,
}: {
    /** Null when one entry is shown on its own (not filed under a mold). */
    mold: DeskRelease | null;
    releases: DeskRelease[];
    initialReleaseId: string | null;
    role: "owner" | "moderator";
    parentTitle?: string | null;
    /** Every attribute key the Registry keeps, for "Add a field". */
    fieldKeys?: readonly string[];
    initialFilter?: MoldFilter;
    /** Where "Back to the list" goes (a to-do list), when opened from one. */
    backHref?: string | null;
}) {
    const { toast } = useToast();
    const router = useRouter();
    const [mold, setMold] = useState(initialMold);
    const [releases, setReleases] = useState(initialReleases);
    const [filter, setFilter] = useState<MoldFilter>(initialFilter);
    const [selectedId, setSelectedId] = useState<string | null>(() => {
        const all = [...(initialMold ? [initialMold] : []), ...initialReleases];
        if (initialReleaseId && all.some((e) => e.row.id === initialReleaseId)) return initialReleaseId;
        const first =
            initialFilter === "needs"
                ? (initialReleases.find((e) => e.flags.length > 0) ?? initialReleases[0])
                : initialReleases[0];
        return first?.row.id ?? initialMold?.row.id ?? null;
    });
    // A release just saved (or opened from a list) stays in view under its
    // filter until the moderator moves on, so Next carries on from it.
    const [stay, setStay] = useState<string | null>(initialReleaseId);
    const [drafts, setDrafts] = useState<Drafts>({});
    // The latest drafts and selection, for a save that comes back after the moderator typed or moved on.
    const draftsRef = useRef<Drafts>({});
    const selectedRef = useRef<string | null>(null);
    const [displays, setDisplays] = useState<Drafts>({});
    const [added, setAdded] = useState<Record<string, string[]>>({});
    const [conflicts, setConflicts] = useState<Record<string, DeskSource>>({});
    const [fieldErrors, setFieldErrors] = useState<Record<string, FieldError>>({});
    const [saving, setSaving] = useState(false);
    const [checked, setChecked] = useState<Set<string>>(new Set());
    const [mergeOpen, setMergeOpen] = useState(false);
    const [moldMergeOpen, setMoldMergeOpen] = useState(false);
    const [removeOpen, setRemoveOpen] = useState(false);
    const [adding, setAdding] = useState(false);
    const [newRelease, setNewRelease] = useState({ title: "", model_number: "", color_description: "" });

    const moldId = mold?.row.id ?? null;
    const parentTitle = mold?.row.title ?? standaloneParentTitle;
    const all = useMemo(() => [...(mold ? [mold] : []), ...releases], [mold, releases]);
    const byId = useMemo(() => new Map(all.map((e) => [e.row.id, e])), [all]);

    const fieldsFor = useCallback(
        (row: DeskSource) =>
            buildDeskFields(row, { parentTitle: row.id === moldId ? null : parentTitle, added: added[row.id] }),
        [added, moldId, parentTitle],
    );
    const changesFor = useCallback(
        (row: DeskSource) => deskChanges(fieldsFor(row), drafts[row.id] ?? {}),
        [drafts, fieldsFor],
    );
    const dirtyIds = useMemo(
        () =>
            new Set(
                all.filter((e) => drafts[e.row.id] && Object.keys(changesFor(e.row)).length > 0).map((e) => e.row.id),
            ),
        [all, drafts, changesFor],
    );

    const needs = releases.filter((e) => e.flags.length > 0);
    const good = releases.filter((e) => e.flags.length === 0);
    const shown = releases.filter((e) =>
        e.row.id === stay ? true : filter === "needs" ? e.flags.length > 0 : filter === "good" ? !e.flags.length : true,
    );
    const entries = [...(mold ? [mold] : []), ...shown];
    const index = entries.findIndex((e) => e.row.id === selectedId);
    const selected = selectedId ? (byId.get(selectedId) ?? null) : null;
    useEffect(() => {
        draftsRef.current = drafts;
        selectedRef.current = selectedId;
    });

    // Leaving with unsaved changes asks first: links and Back in the app...
    const anyDirty = dirtyIds.size > 0;
    const guard = useLeaveGuard(anyDirty);
    const { noteHere } = guard;

    // ... and reloading or closing the tab (the browser's own question).
    useEffect(() => {
        if (!anyDirty) return;
        const warn = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [anyDirty]);

    const select = useCallback(
        (id: string | null) => {
            selectedRef.current = id;
            setSelectedId(id);
            setStay((s) => (s === id ? s : null));
            rememberRelease(id, moldId);
            noteHere();
        },
        [moldId, noteHere],
    );

    const step = (by: number) => {
        if (entries.length === 0) return;
        const from = index < 0 ? (by > 0 ? -1 : entries.length) : index;
        const next = Math.min(entries.length - 1, Math.max(0, from + by));
        select(entries[next].row.id);
    };

    function setField(id: string, key: string, value: string, display?: string) {
        setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? {}), [key]: value } }));
        if (display !== undefined) setDisplays((d) => ({ ...d, [id]: { ...(d[id] ?? {}), [key]: display } }));
        setFieldErrors((f) => {
            if (f[id]?.field !== key) return f;
            const next = { ...f };
            delete next[id];
            return next;
        });
    }

    function replaceEntry(entry: DeskRelease) {
        const id = entry.row.id;
        if (mold && id === mold.row.id) {
            setMold(entry);
            return;
        }
        setReleases((list) => list.map((e) => (e.row.id === id ? entry : e)));
    }

    function replaceRow(row: DeskSource) {
        const old = byId.get(row.id);
        if (old) replaceEntry({ ...old, row });
    }

    function forget(id: string) {
        const drop = <T,>(m: Record<string, T>) => {
            if (!(id in m)) return m;
            const next = { ...m };
            delete next[id];
            return next;
        };
        setDrafts(drop);
        setDisplays(drop);
        setConflicts(drop);
        setAdded(drop);
        setFieldErrors(drop);
    }

    /**
     * A save came back: clear only the draft values it sent that still
     * read the same. Anything typed while it was saving (another box, or
     * the same box again) stays as unsaved work.
     */
    function settle(id: string, sent: Record<string, string>) {
        const kept = (cur: Record<string, string> | undefined) =>
            Object.fromEntries(Object.entries(cur ?? {}).filter(([k, v]) => !(k in sent) || sent[k] !== v));
        // What is typed now (the last render's drafts): the keys still unsaved.
        const left = kept(draftsRef.current[id]);
        setDrafts((d) => {
            const now = kept(d[id]);
            const next = { ...d };
            if (Object.keys(now).length > 0) next[id] = now;
            else delete next[id];
            return next;
        });
        setDisplays((d) => {
            if (!d[id]) return d;
            const still = Object.fromEntries(Object.entries(d[id]).filter(([k]) => k in left));
            const next = { ...d };
            if (Object.keys(still).length > 0) next[id] = still;
            else delete next[id];
            return next;
        });
        setAdded((a) => {
            if (!a[id]) return a;
            const still = a[id].filter((k) => k in left);
            const next = { ...a };
            if (still.length > 0) next[id] = still;
            else delete next[id];
            return next;
        });
        const drop = <T,>(m: Record<string, T>) => {
            if (!(id in m)) return m;
            const next = { ...m };
            delete next[id];
            return next;
        };
        setConflicts(drop);
        setFieldErrors(drop);
    }

    function dropRows(ids: string[]) {
        const gone = new Set(ids);
        const after = entries.filter((e) => !gone.has(e.row.id));
        setReleases((list) => list.filter((e) => !gone.has(e.row.id)));
        setChecked((c) => new Set([...c].filter((x) => !gone.has(x))));
        ids.forEach(forget);
        if (selectedId && gone.has(selectedId)) {
            const next = after[Math.min(Math.max(index, 0), after.length - 1)];
            select(next?.row.id ?? null);
        }
    }

    /** Undo a save from its toast: the History's own undo, then the row as it is now. */
    async function undoSave(actionId: string, id: string) {
        const r = await undoAction(actionId, "Undone on the Desk right after saving.");
        if (!r.success) {
            toast(r.error, "error");
            return;
        }
        const fresh = await getItemForEdit(id);
        if (fresh.success) {
            const back = fresh.item;
            if (moldId && back.row.id !== moldId && back.row.parent_id === moldId && !byId.has(back.row.id)) {
                setReleases((list) => [...list, back]);
            } else {
                replaceEntry(back);
            }
        }
        toast(
            r.drifted.length
                ? `Undone, except what changed since: ${r.drifted.join("; ")}.`
                : "Undone. It is as it was.",
            "success",
        );
    }

    /** Save one release's unsaved changes. True when there was nothing to save or it saved. */
    async function saveRow(id: string, base?: DeskSource): Promise<boolean> {
        const current = byId.get(id);
        if (!current) return true;
        const row = base ?? current.row;
        const sent = { ...(drafts[id] ?? {}) };
        const changes = deskChanges(fieldsFor(row), sent);
        if (Object.keys(changes).length === 0) return true;
        const r = await saveItem({ id, updatedAt: row.updated_at, changes });
        if (!r.success) {
            if ("conflict" in r && r.conflict) {
                setConflicts((c) => ({ ...c, [id]: r.conflict as DeskSource }));
                return false;
            }
            const field = "field" in r && r.field ? r.field : null;
            setFieldErrors((f) => ({ ...f, [id]: { field, message: r.error } }));
            if (!field) toast(r.error, "error");
            return false;
        }
        settle(id, sent);
        const undo =
            "actionId" in r && r.actionId
                ? { label: "Undo", onClick: () => void undoSave(r.actionId as string, id) }
                : undefined;
        const movedAway = id !== moldId && moldId !== null && r.item.parent_id !== moldId;
        if (movedAway) {
            dropRows([id]);
            toast(
                `Saved and moved “${r.item.title}” to another mold. It no longer shows here.`,
                "success",
                UNDO_TOAST_MS,
                undo,
            );
            return true;
        }
        if ("entry" in r && r.entry) replaceEntry(r.entry);
        else replaceRow(r.item);
        // Keep it in view under its filter only if the moderator is still on it.
        if (selectedRef.current === id) setStay(id);
        if (r.warning) toast(`Saved “${r.item.title}”, but: ${r.warning}`, "error", UNDO_TOAST_MS, undo);
        else toast(`Saved “${r.item.title}”. Recorded in the history with your name.`, "success", UNDO_TOAST_MS, undo);
        return true;
    }

    async function save(base?: DeskSource) {
        if (!selected || saving) return;
        const id = selected.row.id;
        if (!base && Object.keys(changesFor(selected.row)).length === 0) {
            toast("Nothing to save on this one yet.", "info");
            return;
        }
        setSaving(true);
        await saveRow(id, base);
        setSaving(false);
    }

    /** "Save all and leave": every unsaved release, one after another; stops at the first that can't save. */
    async function saveAll(): Promise<boolean> {
        setSaving(true);
        try {
            for (const id of [...dirtyIds]) {
                const ok = await saveRow(id);
                if (!ok) {
                    guard.stay();
                    select(id);
                    toast(
                        "That one couldn't be saved, so you're still here. Fix it, or leave without saving.",
                        "error",
                    );
                    return false;
                }
            }
            return true;
        } finally {
            setSaving(false);
        }
    }

    useDeskKeys({
        onNext: () => step(1),
        onPrev: () => step(-1),
        onSave: () => void save(),
        // The Desk's own dialogs pause the keys; a cookie banner or the bell's panel does not.
        paused: mergeOpen || moldMergeOpen || removeOpen || !!guard.target,
    });

    async function addRelease() {
        if (!mold) return;
        const r = await addItem({ parentId: mold.row.id, itemType: "plastic_release", fields: newRelease });
        if (!r.success) {
            toast(r.error, "error");
            return;
        }
        if (r.item) {
            const entry: DeskRelease = { row: r.item, flags: [], fixes: [], horses: 0, wantLists: 0 };
            setReleases((list) => [...list, entry]);
            select(r.item.id);
        }
        setAdding(false);
        setNewRelease({ title: "", model_number: "", color_description: "" });
        toast("Added. Fill in the rest below and save.", "success");
    }

    async function undoRemove(actionId: string, id: string, wasMold: boolean) {
        const r = await undoAction(actionId, "Put back on the Desk right after removing.");
        if (!r.success) {
            toast(r.error, "error");
            return;
        }
        if (wasMold) {
            router.push(`/catalog/desk/mold/${id}`);
        } else {
            const fresh = await getItemForEdit(id);
            if (fresh.success && fresh.item.row.parent_id === moldId) {
                setReleases((list) => (list.some((e) => e.row.id === id) ? list : [...list, fresh.item]));
            }
        }
        toast("Put back, as it was.", "success");
    }

    const checkedRows = releases.filter((e) => checked.has(e.row.id));
    const moldAttrs = mold?.row.attributes ?? {};
    const isMoldSelected = !!selected && selected.row.id === moldId;
    const releaseIndex = shown.findIndex((e) => e.row.id === selectedId);
    const dirtyTitles = all.filter((e) => dirtyIds.has(e.row.id)).map((e) => e.row.title || "Untitled");
    const standalone = !mold ? (releases[0] ?? null) : null;

    return (
        <div className="flex flex-col gap-4">
            {backHref && (
                <Link href={backHref} className="self-start text-sm font-semibold text-forest">
                    ← Back to the list
                </Link>
            )}

            {mold ? (
                <section
                    aria-label="The mold"
                    className="leather-panel flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                >
                    <div className="min-w-0">
                        <div
                            className="text-xs font-bold tracking-wider uppercase"
                            style={{ color: "var(--leather-text-soft)" }}
                        >
                            Mold · {[mold.row.maker, mold.row.scale].filter(Boolean).join(" · ")}
                        </div>
                        <h2 className="text-engraved-light m-0 font-serif text-2xl font-bold break-words">
                            {mold.row.title}
                        </h2>
                        <div className="text-sm" style={{ color: "var(--leather-text-soft)" }}>
                            {[
                                text(moldAttrs.material),
                                moldAttrs.release_year_start
                                    ? `first released ${text(moldAttrs.release_year_start)}`
                                    : "",
                                `${releases.length} release${releases.length === 1 ? "" : "s"} filed here`,
                            ]
                                .filter(Boolean)
                                .join(" · ")}
                        </div>
                    </div>
                    <div className="flex flex-col items-start gap-2">
                        <FlagChips flags={mold.flags} />
                        <div className="flex flex-wrap gap-2">
                            <Button type="button" variant="secondary" size="sm" onClick={() => select(mold.row.id)}>
                                Edit the mold itself
                            </Button>
                            <Button type="button" variant="secondary" size="sm" onClick={() => setMoldMergeOpen(true)}>
                                Merge this mold into ...
                            </Button>
                        </div>
                    </div>
                </section>
            ) : standalone?.row.item_type === "plastic_release" ? (
                <p className="m-0 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
                    This release is not filed under a mold. Pick one in “Filed under mold” below and save.
                </p>
            ) : null}

            {mold && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-input bg-card px-3 py-2">
                    <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
                        {(
                            [
                                ["all", `All ${releases.length}`],
                                ["needs", `Needs work ${needs.length}`],
                                ["good", `Looks right ${good.length}`],
                            ] as [MoldFilter, string][]
                        ).map(([key, label]) => (
                            <Button
                                key={key}
                                type="button"
                                size="sm"
                                variant={filter === key ? "default" : "outline"}
                                aria-pressed={filter === key}
                                onClick={() => setFilter(key)}
                                className="rounded-full"
                            >
                                {label}
                            </Button>
                        ))}
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={() => setAdding((a) => !a)}>
                        <Plus aria-hidden="true" /> Add a release
                    </Button>
                    <p className="m-0 w-full text-xs text-muted-foreground">
                        Only releases filed under this mold show here. A set piece filed under another mold stays with
                        that mold.
                    </p>
                </div>
            )}

            {adding && mold && (
                <form
                    className="flex flex-col gap-3 rounded-lg border border-input bg-card p-3 md:flex-row md:items-end"
                    onSubmit={(e) => {
                        e.preventDefault();
                        void addRelease();
                    }}
                >
                    {(
                        [
                            ["title", "Name", "Saddlebred"],
                            ["model_number", "Model number", "5002"],
                            ["color_description", "Colour and markings", "Bay, solid face"],
                        ] as const
                    ).map(([key, label, ph]) => (
                        <label key={key} className="flex flex-1 flex-col gap-1 text-sm font-semibold text-foreground">
                            {label}
                            <Input
                                value={newRelease[key]}
                                placeholder={ph}
                                onChange={(e) => setNewRelease((n) => ({ ...n, [key]: e.target.value }))}
                            />
                        </label>
                    ))}
                    <Button type="submit" disabled={!newRelease.title.trim()}>
                        Add it
                    </Button>
                </form>
            )}

            {checkedRows.length > 0 && (
                <div
                    role="region"
                    aria-label="Ticked releases"
                    className="sticky top-[calc(var(--header-height,0px)+0.5rem)] z-20 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-forest px-3 py-2 text-primary-foreground"
                >
                    <strong>
                        {checkedRows.length} release{checkedRows.length === 1 ? "" : "s"} ticked
                    </strong>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                                checkedRows.length < 2
                                    ? toast("Tick at least two releases to merge.", "info")
                                    : setMergeOpen(true)
                            }
                        >
                            Merge ...
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-primary-foreground hover:text-foreground"
                            onClick={() => setChecked(new Set())}
                        >
                            Clear
                        </Button>
                    </div>
                </div>
            )}

            {entries.length > 0 && (
                <ReleaseRail
                    entries={entries.map((e) => railEntry(e, dirtyIds.has(e.row.id)))}
                    selectedId={selectedId}
                    onSelect={select}
                    checked={checked}
                    onToggle={(id) =>
                        setChecked((c) => {
                            const next = new Set(c);
                            if (next.has(id)) next.delete(id);
                            else next.add(id);
                            return next;
                        })
                    }
                />
            )}

            {selected ? (
                <ItemEditor
                    key={selected.row.id}
                    entry={selected}
                    parentTitle={selected.row.id === moldId ? null : parentTitle}
                    draft={drafts[selected.row.id] ?? {}}
                    displays={displays[selected.row.id] ?? {}}
                    onChange={(key, value, display) => setField(selected.row.id, key, value, display)}
                    onUseFix={(changes) => {
                        for (const [k, v] of Object.entries(changes)) setField(selected.row.id, k, v);
                    }}
                    conflict={conflicts[selected.row.id] ?? null}
                    onKeepMine={() => {
                        const theirs = conflicts[selected.row.id];
                        if (!theirs) return;
                        replaceRow(theirs);
                        setConflicts((c) => {
                            const next = { ...c };
                            delete next[selected.row.id];
                            return next;
                        });
                        void save(theirs);
                    }}
                    onUseTheirs={() => {
                        const theirs = conflicts[selected.row.id];
                        if (!theirs) return;
                        replaceRow(theirs);
                        forget(selected.row.id);
                    }}
                    onRemove={() => setRemoveOpen(true)}
                    fieldKeys={fieldKeys}
                    added={added[selected.row.id] ?? []}
                    onAddField={(key) =>
                        setAdded((a) => ({
                            ...a,
                            [selected.row.id]: [...(a[selected.row.id] ?? []), key],
                        }))
                    }
                    error={fieldErrors[selected.row.id] ?? null}
                />
            ) : (
                <p className="m-0 rounded-lg border border-dashed border-input bg-card p-6 text-center text-muted-foreground">
                    No releases are filed under this mold yet. Add one above, or edit the mold itself.
                </p>
            )}

            {selected && (
                <div
                    className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-md border border-input bg-card/95 px-2 py-2 backdrop-blur sm:px-3"
                    data-testid="editor-bar"
                >
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => step(-1)}
                        disabled={index <= 0}
                        aria-label="Previous release"
                        className="max-sm:px-3"
                    >
                        <ChevronLeft aria-hidden="true" />
                        <span className="hidden sm:inline">Prev</span>
                    </Button>
                    <span
                        aria-live="polite"
                        aria-atomic="true"
                        className="min-w-0 flex-1 truncate text-center text-xs text-muted-foreground tabular-nums"
                        data-testid="editor-position"
                    >
                        {isMoldSelected ? (
                            <>
                                The mold itself<span className="sr-only">: {selected.row.title}</span>
                            </>
                        ) : (
                            <>
                                <span className="sr-only">Release </span>
                                {releaseIndex >= 0 ? `${releaseIndex + 1} of ${shown.length}` : "Not in this list"}
                                <span className="sr-only">: {selected.row.title}</span>
                            </>
                        )}
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            onClick={() => void save()}
                            disabled={saving || !dirtyIds.has(selected.row.id)}
                        >
                            {saving ? "Saving ..." : "Save"}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => step(1)}
                            disabled={index >= entries.length - 1}
                            aria-label="Next release"
                            className="max-sm:px-3"
                        >
                            <span className="hidden sm:inline">Next</span>
                            <ChevronRight aria-hidden="true" />
                        </Button>
                    </div>
                </div>
            )}

            {mergeOpen && (
                <MergeDialog
                    open={mergeOpen}
                    onOpenChange={setMergeOpen}
                    rows={checkedRows}
                    role={role}
                    onDone={({ keepId, merged, waiting, legacy }) => {
                        setMergeOpen(false);
                        setChecked(new Set());
                        const keepTitle = byId.get(keepId)?.row.title ?? "the one you kept";
                        if (waiting) {
                            toast("Merge sent for a second look. Another moderator will confirm it.", "success");
                        } else {
                            dropRows(merged);
                            toast(
                                legacy
                                    ? `Merged for good into “${keepTitle}”. Members' horses moved with it. This merge can't be undone.`
                                    : `Merged into “${keepTitle}”. Members' horses moved with it. Undo it from History for 30 days.`,
                                "success",
                            );
                        }
                    }}
                />
            )}

            {mold && moldMergeOpen && (
                <MoldMergeDialog
                    open={moldMergeOpen}
                    onOpenChange={setMoldMergeOpen}
                    mold={mold}
                    releaseCount={releases.length}
                    role={role}
                    onDone={({ keep, waiting, legacy }) => {
                        setMoldMergeOpen(false);
                        if (waiting) {
                            toast("Mold merge sent for a second look. Another moderator will confirm it.", "success");
                            return;
                        }
                        toast(
                            legacy
                                ? `Merged for good into “${keep.title}”. This merge can't be undone.`
                                : `Merged into “${keep.title}”. Its releases moved with it. Undo it from History for 30 days.`,
                            "success",
                        );
                        router.push(`/catalog/desk/mold/${keep.id}`);
                    }}
                />
            )}

            {removeOpen && selected && (
                <RemoveDialog
                    key={`remove-${selected.row.id}`}
                    open={removeOpen}
                    onOpenChange={setRemoveOpen}
                    item={{ id: selected.row.id, title: selected.row.title }}
                    onDone={(id, actionId) => {
                        setRemoveOpen(false);
                        const wasMold = id === moldId;
                        toast(
                            "Removed. Hidden now; it can be put back for 30 days from History.",
                            "success",
                            UNDO_TOAST_MS,
                            actionId
                                ? { label: "Undo", onClick: () => void undoRemove(actionId, id, wasMold) }
                                : undefined,
                        );
                        if (wasMold) {
                            router.push("/catalog/desk/mold");
                            return;
                        }
                        dropRows([id]);
                    }}
                />
            )}

            <LeaveDialog
                open={!!guard.target}
                count={dirtyIds.size}
                titles={dirtyTitles}
                onStay={guard.stay}
                onLeave={guard.leave}
                onSaveAll={saveAll}
            />
        </div>
    );
}
