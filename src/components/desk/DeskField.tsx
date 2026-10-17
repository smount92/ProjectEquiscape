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

/** The id of a field's box (for a mold, its "Move to another mold" button): where focus goes. */
export function deskFieldId(idPrefix: string, key: string): string {
    return `${idPrefix}-${key}`;
}

/**
 * One field in the Desk editor: a box, a list or the mold picker, with its
 * label and help, marked when it holds an unsaved change, and with the
 * Registry's words beside it when a save refused its value.
 */
export default function DeskField({
    field,
    value,
    display,
    onChange,
    idPrefix,
    dirty: dirtyProp,
    error,
}: {
    field: DeskFieldEdit;
    value: string;
    /** Words for the value (a mold's title for its id). */
    display?: string;
    onChange: (value: string, display?: string) => void;
    idPrefix: string;
    /** Holds an unsaved change (the editor decides; by default, the box differs from what is stored). */
    dirty?: boolean;
    /** Why the last save refused this field's value. */
    error?: string | null;
}) {
    const id = deskFieldId(idPrefix, field.key);
    const dirty = dirtyProp ?? (!field.readOnly && value.trim() !== field.original.trim());
    const helpId = field.help ? `${id}-help` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const describedBy = [errorId, helpId].filter(Boolean).join(" ") || undefined;
    const invalid = error ? true : undefined;
    const [picking, setPicking] = useState(false);
    const [confirmOff, setConfirmOff] = useState(false);

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

    const ring = error ? "" : dirty ? "rounded-lg ring-2 ring-forest/40" : "";
    let control: React.ReactNode;
    if (field.kind === "mold") {
        const moldWords = value ? display || "A mold" : "Not filed under a mold";
        control = (
            <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{moldWords}</span>
                    <Button
                        id={id}
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-invalid={invalid}
                        aria-describedby={describedBy}
                        onClick={() => {
                            setConfirmOff(false);
                            setPicking((p) => !p);
                        }}
                    >
                        {picking ? "Keep it here" : "Move to another mold ..."}
                    </Button>
                    {value && !confirmOff && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setPicking(false);
                                setConfirmOff(true);
                            }}
                        >
                            Take it off this mold ...
                        </Button>
                    )}
                </div>
                {confirmOff && (
                    <div
                        role="group"
                        aria-label="Take it off this mold?"
                        className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3"
                    >
                        <p className="m-0 text-sm text-foreground">
                            Take it off “{moldWords}”? It won&apos;t be filed under any mold until you pick one, and it
                            drops off this mold&apos;s list when you save.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                size="sm"
                                variant="destructive-outline"
                                onClick={() => {
                                    onChange("", "");
                                    setConfirmOff(false);
                                }}
                            >
                                Take it off
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setConfirmOff(false)}>
                                Keep it on this mold
                            </Button>
                        </div>
                    </div>
                )}
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
                aria-describedby={describedBy}
                aria-invalid={invalid}
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
                aria-describedby={describedBy}
                aria-invalid={invalid}
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
                placeholder={field.placeholder ?? (field.kind === "list" ? "First, second, third" : undefined)}
                aria-describedby={describedBy}
                aria-invalid={invalid}
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
            {error && (
                <span id={errorId} className="text-sm font-semibold text-destructive" data-testid="field-error">
                    {error}
                </span>
            )}
            {field.storedAsText && !dirty && !error && (
                <span className="text-xs text-muted-foreground">
                    {/^\d{4}$/.test(field.original.trim())
                        ? "Stored as text. Saving this release stores it as a number."
                        : "Stored as text, not as a year. Type the year to fix it."}
                </span>
            )}
            {field.help && (
                <span id={helpId} className="text-xs text-muted-foreground">
                    {field.help}
                </span>
            )}
        </div>
    );
}
