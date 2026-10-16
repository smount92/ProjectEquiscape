"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DESK_GROUP_LABELS,
    DESK_GROUP_ORDER,
    buildDeskFields,
    type DeskFieldEdit,
    type DeskFieldGroup,
    type DeskSource,
} from "@/lib/catalog/editableFields";
import { referenceHref } from "@/lib/catalog/referenceUrl";
import { CATEGORY_LABELS } from "@/lib/catalog/taxonomy";
import type { DeskRelease } from "@/app/actions/registry-desk";
import DeskField from "@/components/desk/DeskField";
import FlagChips from "@/components/desk/FlagChips";
import SuggestedFixes from "@/components/desk/SuggestedFixes";
import ConflictNotice from "@/components/desk/ConflictNotice";

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

/**
 * The full record of one row, every field, ready to edit and save. The
 * Mold view owns the drafts (so they survive moving between releases) and
 * hands this editor the one in view.
 */
export default function ItemEditor({
    entry,
    parentTitle,
    draft,
    displays,
    onChange,
    onUseFix,
    onSave,
    saving,
    conflict,
    onKeepMine,
    onUseTheirs,
    position,
    onPrev,
    onNext,
    onRemove,
}: {
    entry: DeskRelease;
    parentTitle: string | null;
    draft: Record<string, string>;
    displays: Record<string, string>;
    onChange: (key: string, value: string, display?: string) => void;
    onUseFix: (changes: Record<string, string>) => void;
    onSave: () => void;
    saving: boolean;
    conflict: DeskSource | null;
    onKeepMine: () => void;
    onUseTheirs: () => void;
    position: { index: number; total: number };
    onPrev: () => void;
    onNext: () => void;
    onRemove?: () => void;
}) {
    const row = entry.row;
    const fields = buildDeskFields(row, { parentTitle });
    const valueOf = (f: DeskFieldEdit) => (f.key in draft ? draft[f.key] : f.original);
    const changed = fields.filter((f) => !f.readOnly && valueOf(f).trim() !== f.original.trim()).length;
    const isMold = row.item_type === "plastic_mold";
    const title = (draft.title ?? row.title) || "Untitled";
    const idPrefix = `desk-${row.id.slice(0, 8)}`;

    const groups = DESK_GROUP_ORDER.map((g) => ({ g, list: fields.filter((f) => f.group === g) })).filter(
        (x) => x.list.length > 0,
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
                        <span className="hidden text-muted-foreground md:inline">
                            J and K move between releases · Ctrl+S saves
                        </span>
                    </div>
                </div>
                <FlagChips flags={entry.flags} />
            </header>

            {conflict && (
                <ConflictNotice theirs={conflict} draft={draft} onKeepMine={onKeepMine} onUseTheirs={onUseTheirs} />
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
                        {body}
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

            <div
                className="sticky bottom-0 z-10 flex items-center justify-between gap-2 rounded-md border border-input bg-card/95 px-3 py-2 backdrop-blur"
                data-testid="editor-bar"
            >
                <Button type="button" variant="outline" onClick={onPrev} disabled={position.index <= 0}>
                    <ChevronLeft aria-hidden="true" /> Prev
                </Button>
                <span className="text-xs text-muted-foreground tabular-nums">
                    {position.index + 1} of {position.total}
                </span>
                <Button type="button" onClick={onSave} disabled={saving || changed === 0}>
                    {saving ? "Saving ..." : "Save"}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={onNext}
                    disabled={position.index >= position.total - 1}
                >
                    Next <ChevronRight aria-hidden="true" />
                </Button>
            </div>
        </section>
    );
}
