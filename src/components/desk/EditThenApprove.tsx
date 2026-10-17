"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DESK_FIELDS, type DeskFieldEdit } from "@/lib/catalog/editableFields";
import type { QueueItem } from "@/app/actions/registry-desk";
import DeskField from "@/components/desk/DeskField";

/** A new entry's own keys, read as the Desk field they fill. */
const ADDITION_KEYS: Record<string, string> = {
    year: "release_year_start",
    year_end: "release_year_end",
    color: "color_description",
};

/** Keys the moderator does not retype here (the mold link is checked when it is applied). */
const NOT_RETYPED = new Set(["parent_catalog_id", "duplicate_of", "duplicate_of_title"]);

function asField(key: string, label: string, original: string): DeskFieldEdit {
    const def = DESK_FIELDS.find((f) => f.key === (ADDITION_KEYS[key] ?? key));
    return {
        key,
        label,
        kind: def && def.kind !== "mold" ? def.kind : "text",
        options: def?.options,
        optionLabels: def?.optionLabels,
        group: "identity",
        appliesTo: "all",
        original,
    };
}

/**
 * Fix a capital letter or a typo and approve, instead of saying no to good
 * work. The member's own version is kept; their notice shows what changed.
 */
export default function EditThenApprove({
    item,
    busy,
    onApprove,
    onCancel,
}: {
    item: QueueItem;
    busy: boolean;
    onApprove: (edited: Record<string, unknown>, note: string) => void;
    onCancel: () => void;
}) {
    const isAddition = item.kind === "addition";
    const editable = item.changes.filter((c) => !NOT_RETYPED.has(c.key));
    const [values, setValues] = useState<Record<string, string>>(() =>
        Object.fromEntries(editable.map((c) => [c.key, c.to])),
    );
    const [note, setNote] = useState("");

    function edited(): Record<string, unknown> {
        const out: Record<string, unknown> = { ...item.fields };
        for (const c of editable) {
            const v = (values[c.key] ?? "").trim();
            if (isAddition) out[c.key] = v;
            else out[c.key] = { ...((item.fields[c.key] as object) ?? {}), from: c.from, to: v };
        }
        return out;
    }

    return (
        <form
            className="flex flex-col gap-3 rounded-lg border border-forest/30 bg-forest/5 p-3"
            onSubmit={(e) => {
                e.preventDefault();
                onApprove(edited(), note.trim());
            }}
            aria-label="Edit, then approve"
        >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {editable.map((c) => (
                    <DeskField
                        key={c.key}
                        field={asField(c.key, c.label, c.to)}
                        value={values[c.key] ?? ""}
                        idPrefix={`eta-${item.id.slice(0, 8)}`}
                        onChange={(v) => setValues((s) => ({ ...s, [c.key]: v }))}
                    />
                ))}
            </div>
            <label className="flex flex-col gap-1 text-sm font-semibold text-foreground">
                A note for the member (optional)
                <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Capitalised the name to match the box"
                />
            </label>
            <p className="m-0 text-xs text-muted-foreground">
                Their own version is kept, and their notice shows what you changed.
            </p>
            <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={busy}>
                    {busy ? "Approving ..." : "Approve as fixed"}
                </Button>
                <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
                    Cancel
                </Button>
            </div>
        </form>
    );
}
