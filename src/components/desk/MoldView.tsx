"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/context/ToastContext";
import { buildDeskFields, deskChanges, type DeskSource } from "@/lib/catalog/editableFields";
import { addItem, getItemForEdit, saveItem, type DeskRelease } from "@/app/actions/registry-desk";
import FlagChips from "@/components/desk/FlagChips";
import ItemEditor from "@/components/desk/ItemEditor";
import MergeDialog from "@/components/desk/MergeDialog";
import ReleaseRail, { type RailEntry } from "@/components/desk/ReleaseRail";
import RemoveDialog from "@/components/desk/RemoveDialog";
import useDeskKeys from "@/components/desk/useDeskKeys";

type Filter = "all" | "needs" | "good";
type Drafts = Record<string, Record<string, string>>;

const text = (v: unknown) => (v == null ? "" : String(v));

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
 * marked with a dot, and leaving the page with any unsaved asks first.
 */
export default function MoldView({
    mold: initialMold,
    releases: initialReleases,
    initialReleaseId,
    role,
    parentTitle: standaloneParentTitle = null,
}: {
    /** Null when one entry is shown on its own (not filed under a mold). */
    mold: DeskRelease | null;
    releases: DeskRelease[];
    initialReleaseId: string | null;
    role: "owner" | "moderator";
    parentTitle?: string | null;
}) {
    const { toast } = useToast();
    const router = useRouter();
    const [mold, setMold] = useState(initialMold);
    const [releases, setReleases] = useState(initialReleases);
    const [filter, setFilter] = useState<Filter>("all");
    const [selectedId, setSelectedId] = useState<string | null>(() => {
        const all = [...(initialMold ? [initialMold] : []), ...initialReleases];
        if (initialReleaseId && all.some((e) => e.row.id === initialReleaseId)) return initialReleaseId;
        return initialReleases[0]?.row.id ?? initialMold?.row.id ?? null;
    });
    const [drafts, setDrafts] = useState<Drafts>({});
    const [displays, setDisplays] = useState<Drafts>({});
    const [conflicts, setConflicts] = useState<Record<string, DeskSource>>({});
    const [saving, setSaving] = useState(false);
    const [checked, setChecked] = useState<Set<string>>(new Set());
    const [mergeOpen, setMergeOpen] = useState(false);
    const [removeOpen, setRemoveOpen] = useState(false);
    const [adding, setAdding] = useState(false);
    const [newRelease, setNewRelease] = useState({ title: "", model_number: "", color_description: "" });

    const moldId = mold?.row.id ?? null;
    const parentTitle = mold?.row.title ?? standaloneParentTitle;
    const all = useMemo(() => [...(mold ? [mold] : []), ...releases], [mold, releases]);
    const byId = useMemo(() => new Map(all.map((e) => [e.row.id, e])), [all]);

    const changesFor = useCallback(
        (e: DeskRelease) =>
            deskChanges(
                buildDeskFields(e.row, { parentTitle: e.row.id === moldId ? null : parentTitle }),
                drafts[e.row.id] ?? {},
            ),
        [drafts, moldId, parentTitle],
    );
    const dirtyIds = useMemo(
        () =>
            new Set(all.filter((e) => drafts[e.row.id] && Object.keys(changesFor(e)).length > 0).map((e) => e.row.id)),
        [all, drafts, changesFor],
    );

    const needs = releases.filter((e) => e.flags.length > 0);
    const good = releases.filter((e) => e.flags.length === 0);
    const shown = filter === "needs" ? needs : filter === "good" ? good : releases;
    const entries = [...(mold ? [mold] : []), ...shown];
    const index = entries.findIndex((e) => e.row.id === selectedId);
    const selected = selectedId ? (byId.get(selectedId) ?? null) : null;

    const select = useCallback(
        (id: string | null) => {
            setSelectedId(id);
            rememberRelease(id, moldId);
        },
        [moldId],
    );

    const step = (by: number) => {
        if (entries.length === 0) return;
        const from = index < 0 ? (by > 0 ? -1 : entries.length) : index;
        const next = Math.min(entries.length - 1, Math.max(0, from + by));
        select(entries[next].row.id);
    };

    // Leaving with unsaved changes asks first.
    const anyDirty = dirtyIds.size > 0;
    useEffect(() => {
        if (!anyDirty) return;
        const warn = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [anyDirty]);

    function setField(id: string, key: string, value: string, display?: string) {
        setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? {}), [key]: value } }));
        if (display !== undefined) setDisplays((d) => ({ ...d, [id]: { ...(d[id] ?? {}), [key]: display } }));
    }

    function replaceRow(row: DeskSource, patch: Partial<DeskRelease> = {}) {
        if (mold && row.id === mold.row.id) {
            setMold({ ...mold, ...patch, row });
            return;
        }
        setReleases((list) => list.map((e) => (e.row.id === row.id ? { ...e, ...patch, row } : e)));
    }

    function forget(id: string) {
        const drop = <T,>(m: Record<string, T>) => {
            const next = { ...m };
            delete next[id];
            return next;
        };
        setDrafts(drop);
        setDisplays(drop);
        setConflicts(drop);
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

    async function save(base?: DeskSource) {
        if (!selected || saving) return;
        const row = base ?? selected.row;
        const isMoldRow = row.id === moldId;
        const fields = buildDeskFields(row, { parentTitle: isMoldRow ? null : parentTitle });
        const changes = deskChanges(fields, drafts[row.id] ?? {});
        if (Object.keys(changes).length === 0) {
            toast("Nothing to save on this one yet.", "info");
            return;
        }
        setSaving(true);
        const r = await saveItem({ id: row.id, updatedAt: row.updated_at, changes });
        setSaving(false);
        if (!r.success) {
            if ("conflict" in r && r.conflict) {
                setConflicts((c) => ({ ...c, [row.id]: r.conflict as DeskSource }));
                return;
            }
            toast(r.error, "error");
            return;
        }
        forget(row.id);
        const movedAway = !isMoldRow && moldId !== null && r.item.parent_id !== moldId;
        if (movedAway) {
            dropRows([row.id]);
            toast(`Saved and moved “${r.item.title}” to another mold. It no longer shows here.`, "success");
            return;
        }
        replaceRow(r.item);
        toast(`Saved “${r.item.title}”. Recorded in the history with your name.`, "success");
        // Fresh flags for what was just fixed.
        const fresh = await getItemForEdit(row.id);
        if (fresh.success) replaceRow(fresh.item.row, { flags: fresh.item.flags, fixes: fresh.item.fixes });
    }

    useDeskKeys({ onNext: () => step(1), onPrev: () => step(-1), onSave: () => void save() });

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

    const checkedRows = releases.filter((e) => checked.has(e.row.id));
    const moldAttrs = mold?.row.attributes ?? {};

    return (
        <div className="flex flex-col gap-4">
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
                        <Button type="button" variant="secondary" size="sm" onClick={() => select(mold.row.id)}>
                            Edit the mold itself
                        </Button>
                    </div>
                </section>
            ) : (
                <p className="m-0 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
                    This entry is not filed under a mold. Pick one in “Filed under mold” below and save.
                </p>
            )}

            {mold && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-input bg-card px-3 py-2">
                    <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
                        {(
                            [
                                ["all", `All ${releases.length}`],
                                ["needs", `Needs work ${needs.length}`],
                                ["good", `Looks right ${good.length}`],
                            ] as [Filter, string][]
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
                    onSave={() => void save()}
                    saving={saving}
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
                    position={{ index: Math.max(index, 0), total: entries.length }}
                    onPrev={() => step(-1)}
                    onNext={() => step(1)}
                    onRemove={() => setRemoveOpen(true)}
                />
            ) : (
                <p className="m-0 rounded-lg border border-dashed border-input bg-card p-6 text-center text-muted-foreground">
                    No releases are filed under this mold yet. Add one above, or edit the mold itself.
                </p>
            )}

            {mergeOpen && (
                <MergeDialog
                    open={mergeOpen}
                    onOpenChange={setMergeOpen}
                    rows={checkedRows}
                    role={role}
                    onDone={({ keepId, merged, waiting }) => {
                        setMergeOpen(false);
                        setChecked(new Set());
                        const keepTitle = byId.get(keepId)?.row.title ?? "the one you kept";
                        if (waiting) {
                            toast("Merge sent for a second look. Another moderator will confirm it.", "success");
                        } else {
                            dropRows(merged);
                            toast(`Merged into “${keepTitle}”. Members' horses moved with it.`, "success");
                        }
                    }}
                />
            )}

            <RemoveDialog
                open={removeOpen}
                onOpenChange={setRemoveOpen}
                item={selected ? { id: selected.row.id, title: selected.row.title } : null}
                onDone={(id) => {
                    setRemoveOpen(false);
                    toast("Removed. Hidden now; it can be put back for 30 days from History.", "success");
                    if (id === moldId) {
                        router.push("/catalog/desk/mold");
                        return;
                    }
                    dropRows([id]);
                }}
            />
        </div>
    );
}
