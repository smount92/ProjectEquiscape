"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { DESK_FIELDS, deskFieldLabel, type DeskFieldEdit } from "@/lib/catalog/editableFields";
import type { QueueItem } from "@/app/actions/registry-desk";
import DeskField from "@/components/desk/DeskField";

/** A new entry's own keys, read as the Desk field they fill. */
const ADDITION_KEYS: Record<string, string> = {
    year: "release_year_start",
    year_end: "release_year_end",
    color: "color_description",
};
/** ... and back: the key a new entry stores a Desk field under. */
const ADDITION_KEY_FOR: Record<string, string> = Object.fromEntries(
    Object.entries(ADDITION_KEYS).map(([a, d]) => [d, a]),
);

/** Keys the moderator does not retype here (the mold link is checked when it is applied). */
const NOT_RETYPED = new Set(["parent_catalog_id", "duplicate_of", "duplicate_of_title"]);

/** Every Desk field a moderator can add while fixing a suggestion (not the mold link, not the record's facts). */
const ADDABLE = [
    ...new Map(DESK_FIELDS.filter((f) => !f.readOnly && f.kind !== "mold").map((f) => [f.key, f])).values(),
];

function asField(key: string, label: string, original: string): DeskFieldEdit {
    const def = DESK_FIELDS.find((f) => f.key === (ADDITION_KEYS[key] ?? key));
    return {
        key,
        label,
        kind: def && def.kind !== "mold" ? def.kind : "text",
        options: def?.options,
        optionLabels: def?.optionLabels,
        placeholder: def?.placeholder,
        group: "identity",
        appliesTo: "all",
        original,
    };
}

/**
 * Fix a capital letter or a typo and approve, instead of saying no to good
 * work. Any Desk field can be added: "#5038 Morgan Mare" becomes the title
 * "Morgan Mare" and the model number 5038. The member's own version is
 * kept; their notice shows what changed.
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
    // Fields the moderator added: the key this suggestion stores it under, and where it started.
    const [extra, setExtra] = useState<{ key: string; label: string; from: string }[]>([]);
    const [note, setNote] = useState("");
    const formRef = useRef<HTMLFormElement | null>(null);
    const addId = useId();
    const idPrefix = `eta-${item.id.slice(0, 8)}`;

    // The first box takes focus as the form opens.
    useEffect(() => {
        formRef.current?.querySelector<HTMLElement>("input, select, textarea")?.focus();
    }, []);

    const present = new Set([
        ...editable.map((c) => ADDITION_KEYS[c.key] ?? c.key),
        ...extra.map((e) => ADDITION_KEYS[e.key] ?? e.key),
    ]);
    const offered = ADDABLE.filter((f) => !present.has(f.key) && !(isAddition && f.key === "item_type"));

    function addField(deskKey: string) {
        const key = isAddition ? (ADDITION_KEY_FOR[deskKey] ?? deskKey) : deskKey;
        const from = isAddition ? "" : (item.current?.[deskKey] ?? "");
        setExtra((x) => [...x, { key, label: deskFieldLabel(deskKey), from }]);
        setValues((s) => ({ ...s, [key]: from }));
        requestAnimationFrame(() => document.getElementById(`${idPrefix}-${key}`)?.focus());
    }

    function edited(): Record<string, unknown> {
        const out: Record<string, unknown> = { ...item.fields };
        for (const c of editable) {
            const v = (values[c.key] ?? "").trim();
            if (isAddition) out[c.key] = v;
            else out[c.key] = { ...((item.fields[c.key] as object) ?? {}), from: c.from, to: v };
        }
        for (const e of extra) {
            const v = (values[e.key] ?? "").trim();
            if (isAddition) {
                if (v !== "") out[e.key] = v;
            } else if (v !== e.from.trim()) {
                out[e.key] = { from: e.from, to: v };
            }
        }
        return out;
    }

    const rows = [
        ...editable.map((c) => ({ key: c.key, label: c.label, original: c.to })),
        ...extra.map((e) => ({ key: e.key, label: e.label, original: e.from })),
    ];

    return (
        <form
            ref={formRef}
            className="flex flex-col gap-3 rounded-lg border border-forest/30 bg-forest/5 p-3"
            onSubmit={(e) => {
                e.preventDefault();
                onApprove(edited(), note.trim());
            }}
            aria-label="Edit, then approve"
        >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {rows.map((r) => (
                    <DeskField
                        key={r.key}
                        field={asField(r.key, r.label, r.original)}
                        value={values[r.key] ?? ""}
                        idPrefix={idPrefix}
                        onChange={(v) => setValues((s) => ({ ...s, [r.key]: v }))}
                    />
                ))}
            </div>
            {offered.length > 0 && (
                <div className="flex flex-col gap-1 sm:max-w-sm">
                    <label htmlFor={addId} className="text-sm font-semibold text-foreground">
                        Add a field
                    </label>
                    <NativeSelect
                        id={addId}
                        value=""
                        data-testid="eta-add-field"
                        onChange={(e) => e.target.value && addField(e.target.value)}
                    >
                        <option value="">
                            {isAddition ? "Fill in one they left out ..." : "Fix another field on the entry ..."}
                        </option>
                        {offered.map((f) => (
                            <option key={f.key} value={f.key}>
                                {f.label}
                            </option>
                        ))}
                    </NativeSelect>
                    <span className="text-xs text-muted-foreground">
                        For example, move “#5038” out of the name into the Model number box.
                    </span>
                </div>
            )}
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
