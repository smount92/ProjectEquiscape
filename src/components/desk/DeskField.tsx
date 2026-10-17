"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { DeskFieldEdit } from "@/lib/catalog/editableFields";
import MoldPicker from "@/components/desk/MoldPicker";

function readableDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * One field in the Desk editor: a box, a list or the mold picker, with its
 * label and help, marked when it holds an unsaved change.
 */
export default function DeskField({
    field,
    value,
    display,
    onChange,
    idPrefix,
}: {
    field: DeskFieldEdit;
    value: string;
    /** Words for the value (a mold's title for its id). */
    display?: string;
    onChange: (value: string, display?: string) => void;
    idPrefix: string;
}) {
    const id = `${idPrefix}-${field.key}`;
    const dirty = !field.readOnly && value.trim() !== field.original.trim();
    const helpId = field.help ? `${id}-help` : undefined;
    const [picking, setPicking] = useState(false);

    const label = (
        <span className="flex items-center gap-2">
            <span>{field.label}</span>
            {dirty && (
                <span className="rounded-full bg-forest/10 px-1.5 text-[0.7rem] font-semibold text-forest">
                    changed
                </span>
            )}
        </span>
    );

    if (field.readOnly) {
        const shown =
            field.key === "created_at" || field.key === "updated_at" ? readableDate(field.original) : field.original;
        return (
            <div className="flex min-w-0 flex-col gap-1" data-field={field.key}>
                <span className="text-xs font-semibold text-muted-foreground">{field.label}</span>
                <span className="text-sm break-all text-foreground">
                    {field.key === "page_address" ? (
                        <a href={shown} target="_blank" rel="noreferrer" className="text-forest underline">
                            {shown}
                        </a>
                    ) : (
                        shown || "—"
                    )}
                </span>
                {field.help && <span className="text-xs text-muted-foreground">{field.help}</span>}
            </div>
        );
    }

    const ring = dirty ? "rounded-lg ring-2 ring-forest/40" : "";
    let control: React.ReactNode;
    if (field.kind === "mold") {
        control = (
            <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    <span id={id} className="text-sm font-semibold text-foreground">
                        {value ? display || "A mold" : "Not filed under a mold"}
                    </span>
                    <Button type="button" variant="outline" size="sm" onClick={() => setPicking((p) => !p)}>
                        {picking ? "Keep it here" : "Move to another mold ..."}
                    </Button>
                    {value && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => onChange("", "")}>
                            Take it off this mold
                        </Button>
                    )}
                </div>
                {picking && (
                    <div className="rounded-lg border border-input bg-card p-3">
                        <MoldPicker
                            autoFocus
                            excludeId={value || null}
                            onPick={(m) => {
                                onChange(m.id, `${m.title}${m.scale ? ` (${m.scale})` : ""}`);
                                setPicking(false);
                            }}
                        />
                    </div>
                )}
            </div>
        );
    } else if (field.kind === "select") {
        const options = field.options ?? [];
        const known = value === "" || options.includes(value);
        control = (
            <NativeSelect
                id={id}
                value={value}
                aria-describedby={helpId}
                onChange={(e) => onChange(e.target.value)}
                className={ring || undefined}
            >
                <option value="">Not known</option>
                {!known && <option value={value}>{value} (not in the list)</option>}
                {options.map((o) => (
                    <option key={o} value={o}>
                        {field.optionLabels?.[o] ?? o}
                    </option>
                ))}
            </NativeSelect>
        );
    } else if (field.kind === "textarea") {
        control = (
            <Textarea
                id={id}
                value={value}
                placeholder={field.placeholder}
                aria-describedby={helpId}
                onChange={(e) => onChange(e.target.value)}
                className={ring}
            />
        );
    } else {
        control = (
            <Input
                id={id}
                value={value}
                inputMode={field.kind === "number" ? "numeric" : undefined}
                placeholder={field.placeholder}
                aria-describedby={helpId}
                onChange={(e) => onChange(e.target.value)}
                className={ring}
            />
        );
    }

    const wide = field.kind === "textarea" || field.kind === "mold" || field.key === "title";
    return (
        <div className={`flex min-w-0 flex-col gap-1 ${wide ? "md:col-span-2" : ""}`} data-field={field.key}>
            {field.kind === "mold" ? (
                <span className="text-sm font-semibold text-foreground">{label}</span>
            ) : (
                <label htmlFor={id} className="text-sm font-semibold text-foreground">
                    {label}
                </label>
            )}
            {control}
            {field.help && (
                <span id={helpId} className="text-xs text-muted-foreground">
                    {field.help}
                </span>
            )}
        </div>
    );
}
