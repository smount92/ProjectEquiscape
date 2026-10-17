"use client";

import { useEffect, useId, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import {
    DESK_GROUP_LABELS,
    DESK_GROUP_ORDER,
    addableFields,
    buildDeskFields,
    deskChanges,
    type DeskFieldEdit,
    type DeskFieldGroup,
    type DeskSource,
} from "@/lib/catalog/editableFields";
import { referenceHref } from "@/lib/catalog/referenceUrl";
import { CATEGORY_LABELS } from "@/lib/catalog/taxonomy";
import type { DeskRelease } from "@/app/actions/registry-desk";
import DeskField, { deskFieldId } from "@/components/desk/DeskField";
import FlagChips from "@/components/desk/FlagChips";
import SuggestedFixes from "@/components/desk/SuggestedFixes";
import ConflictNotice from "@/components/desk/ConflictNotice";
import { isMacLike } from "@/components/desk/useDeskKeys";

const FOLDED: ReadonlySet<DeskFieldGroup> = new Set(["import", "record"]);

function linkNote(entry: DeskRelease): string {
    const isMold = entry.row.item_type === "plastic_mold";
    const what = isMold ? "this mold" : "this release";
    const bits: string[] = [];
    if (entry.horses) bits.push(`${entry.horses} horse${entry.horses === 1 ? "" : "s"} in members' stables`);
    if (entry.wantLists) bits.push(`${entry.wantLists} want list${entry.wantLists === 1 ? "" : "s"}`);
    if (bits.length > 0) {
        return `${bits.join(" and ")} point at ${what}, so it can be merged into another entry but never removed.`;
    }
    return isMold
        ? "No horses or want lists point at this mold. Its releases stay with it whatever you change here."
        : "No horses or want lists point at this release, so it can be removed if it is junk.";
}

const noSubscribe = () => () => {};

/** "⌘S" on a Mac, "Ctrl+S" elsewhere; read after the page has loaded, so the server and browser agree first. */
function useSaveKeyWords(): string {
    return useSyncExternalStore(
        noSubscribe,
        () => (isMacLike(typeof navigator === "undefined" ? undefined : navigator) ? "⌘S" : "Ctrl+S"),
        () => "Ctrl+S",
    );
}

/**
 * The full record of one row, every field, ready to edit and save. The
 * Mold view owns the drafts (so they survive moving between releases) and
 * hands this editor the one in view; Save, Prev and Next live in the Mold
 * view's bar, outside this editor, so they keep focus while it changes.
 */
export default function ItemEditor({
    entry,
    parentTitle,
    draft,
    displays,
    onChange,
    onUseFix,
    conflict,
    onKeepMine,
    onUseTheirs,
    onRemove,
    fieldKeys = [],
    added = [],
    onAddField,
    error = null,
}: {
    entry: DeskRelease;
    parentTitle: string | null;
    draft: Record<string, string>;
    displays: Record<string, string>;
    onChange: (key: string, value: string, display?: string) => void;
    onUseFix: (changes: Record<string, string>) => void;
    conflict: DeskSource | null;
    onKeepMine: () => void;
    onUseTheirs: () => void;
    onRemove?: () => void;
    /** Every attribute key the Registry keeps: "Add a field" offers those not shown. */
    fieldKeys?: readonly string[];
    /** Keys added with "Add a field" on this row. */
    added?: readonly string[];
    onAddField?: (key: string) => void;
    /** The field the last save refused, and why. */
    error?: { field: string | null; message: string } | null;
}) {
    const row = entry.row;
    const fields = buildDeskFields(row, { parentTitle, added });
    const valueOf = (f: DeskFieldEdit) => (f.key in draft ? draft[f.key] : f.original);
    const changes = deskChanges(fields, draft);
    const changedKeys = new Set(Object.keys(changes));
    const changed = [...changedKeys].filter((k) => k in draft).length;
    const isMold = row.item_type === "plastic_mold";
    const title = (draft.title ?? row.title) || "Untitled";
    const idPrefix = `desk-${row.id.slice(0, 8)}`;
    const addId = useId();
    const saveKey = useSaveKeyWords();
    const offered = onAddField ? addableFields(fields, fieldKeys) : [];
    const errorField = error?.field ? fields.find((f) => f.key === error.field) : undefined;

    // A refused value: its box is marked and takes focus.
    useEffect(() => {
        if (!error?.field) return;
        document.getElementById(deskFieldId(idPrefix, error.field))?.focus();
    }, [error, idPrefix]);

    const groups = DESK_GROUP_ORDER.map((g) => ({ g, list: fields.filter((f) => f.group === g) })).filter(
        (x) => x.list.length > 0 || (x.g === "extras" && offered.length > 0),
    );

    return (
        <section aria-label={isMold ? "Edit the mold" : "Edit the release"} className="ledger-card flex flex-col gap-4">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                        {isMold ? "The mold itself" : (CATEGORY_LABELS[row.item_type] ?? "Entry")} ·{" "}
                        {row.id.slice(0, 8)}
                    </div>
                    <h2 className="m-0 font-serif text-xl leading-tight font-bold break-words text-foreground">
                        {title}
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                        <a href={referenceHref(row)} target="_blank" rel="noreferrer" className="text-forest underline">
                            Open its page
                        </a>
                        {changed > 0 && (
                            <span className="rounded-full bg-warning/15 px-2 py-0.5 font-semibold text-warning">
                                {changed} unsaved change{changed === 1 ? "" : "s"}
                            </span>
                        )}
                        <span className="hidden text-muted-foreground md:inline" data-testid="key-hint">
                            J and K move between releases · {saveKey} saves
                        </span>
                    </div>
                </div>
                <FlagChips flags={entry.flags} />
            </header>

            {conflict && (
                <ConflictNotice theirs={conflict} draft={draft} onKeepMine={onKeepMine} onUseTheirs={onUseTheirs} />
            )}

            {error && !errorField && (
                <p role="alert" className="m-0 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error.message}
                </p>
            )}

            <SuggestedFixes fixes={entry.fixes} onUse={onUseFix} />

            {groups.map(({ g, list }) => {
                const body = (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {list.map((f) => (
                            <DeskField
                                key={f.key}
                                field={f}
                                value={valueOf(f)}
                                display={displays[f.key] ?? f.display}
                                idPrefix={idPrefix}
                                dirty={!f.readOnly && changedKeys.has(f.key) && f.key in draft}
                                error={error?.field === f.key ? error.message : null}
                                onChange={(v, d) => onChange(f.key, v, d)}
                            />
                        ))}
                    </div>
                );
                if (FOLDED.has(g)) {
                    return (
                        <details key={g} className="rounded-lg border border-input bg-card/60 p-3">
                            <summary className="cursor-pointer text-sm font-semibold text-foreground max-md:min-h-11">
                                {DESK_GROUP_LABELS[g]}
                            </summary>
                            <div className="mt-3">{body}</div>
                        </details>
                    );
                }
                return (
                    <fieldset key={g} className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
                        <legend className="mb-2 font-serif text-base font-bold text-forest">
                            {DESK_GROUP_LABELS[g]}
                        </legend>
                        {list.length > 0 && body}
                        {g === "extras" && offered.length > 0 && onAddField && (
                            <div className="flex flex-col gap-1 sm:max-w-sm">
                                <label htmlFor={addId} className="text-sm font-semibold text-foreground">
                                    Add a field
                                </label>
                                <NativeSelect
                                    id={addId}
                                    value=""
                                    data-testid="add-field"
                                    onChange={(e) => {
                                        const key = e.target.value;
                                        if (!key) return;
                                        onAddField(key);
                                        // The new box takes focus once it is drawn.
                                        requestAnimationFrame(() =>
                                            document.getElementById(deskFieldId(idPrefix, key))?.focus(),
                                        );
                                    }}
                                >
                                    <option value="">Pick one the Registry keeps ...</option>
                                    {offered.map((o) => (
                                        <option key={o.key} value={o.key}>
                                            {o.label}
                                        </option>
                                    ))}
                                </NativeSelect>
                                <span className="text-xs text-muted-foreground">
                                    Every field the Registry keeps can be filled in here, whatever kind of entry this
                                    is.
                                </span>
                            </div>
                        )}
                    </fieldset>
                );
            })}

            <p className="m-0 text-sm text-muted-foreground">{linkNote(entry)}</p>
            {onRemove && (
                <div>
                    <Button type="button" variant="destructive-outline" size="sm" onClick={onRemove}>
                        Remove {isMold ? "this mold" : "this release"} ...
                    </Button>
                </div>
            )}
        </section>
    );
}
