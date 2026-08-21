"use client";

/**
 * One field, rendered from its spec.
 *
 * Every select in the three legacy forms was a raw `<select>` carrying a
 * hand-copied Tailwind string — and they had already drifted (`h-9` in
 * add-horse, `h-10` in edit). There is one control per type here, and the
 * spec decides which.
 *
 * The DOM id comes off the spec, never from this component. `e2e/
 * inventory.spec.ts` drives the whole wizard by id.
 */

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import GlossaryLink from "@/components/GlossaryLink";
import { conditionToneVar, getConditionGrade } from "@/lib/conditionGrades";
import { resolveLabel } from "@/lib/forms/registry";
import { getDomId, isFieldDisabled, isFieldRequired } from "@/lib/forms/rules";
import type { FieldContext, FieldSpec } from "@/lib/forms/types";

/** Shared control chrome so a select can never drift from an input again. */
const CONTROL_CLASS =
    "h-10 w-full min-w-0 rounded-lg border border-input bg-card px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

export interface FieldControlProps {
    spec: FieldSpec;
    context: FieldContext;
    value: unknown;
    onChange: (name: string, value: unknown) => void;
    /** Fields the user has been told are missing — drawn in the error tone. */
    invalid?: boolean;
    /** One-shot shake when a Next click was refused. */
    shake?: boolean;
    autoFocus?: boolean;
}

export default function FieldControl({
    spec,
    context,
    value,
    onChange,
    invalid = false,
    shake = false,
    autoFocus = false,
}: FieldControlProps) {
    const label = resolveLabel(spec, context.category);
    const required = isFieldRequired(spec, context);
    const disabled = isFieldDisabled(spec, context);
    const id = getDomId(spec, context.mode) ?? `fe-${spec.name.replace(/_/g, "-")}`;

    const tone = invalid
        ? "border-destructive ring-2 ring-destructive/50 bg-destructive/10"
        : "";
    const shakeClass = shake && invalid ? "animate-shake" : "";
    const set = (v: unknown) => onChange(spec.name, v);

    // ── The control itself ────────────────────────────────────────
    let control: React.ReactNode;

    switch (spec.type) {
        case "textarea":
            control = (
                <Textarea
                    id={id}
                    value={(value as string) ?? ""}
                    onChange={(e) => set(e.target.value)}
                    placeholder={spec.placeholder}
                    maxLength={spec.maxLength}
                    rows={3}
                    disabled={disabled}
                    className={`${tone} ${shakeClass}`}
                />
            );
            break;

        case "select":
            control = (
                <select
                    id={id}
                    className={`${CONTROL_CLASS} ${tone} ${shakeClass}`}
                    value={(value as string) ?? ""}
                    onChange={(e) => set(e.target.value)}
                    disabled={disabled}
                    aria-label={label}
                >
                    <option value="">Select {label.toLowerCase()}…</option>
                    {renderOptions(spec)}
                </select>
            );
            break;

        case "segmented":
            control = (
                <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
                    {(spec.options ?? []).map((opt) => {
                        const active = value === opt.value;
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                id={`${spec.name.replace(/_/g, "-")}-${opt.value}`}
                                onClick={() => set(opt.value)}
                                aria-pressed={active}
                                className={`flex min-w-[120px] flex-1 cursor-pointer flex-col items-center gap-0.5 rounded-lg border-2 px-3 py-2.5 transition-all ${
                                    active
                                        ? "border-forest bg-forest/10"
                                        : "border-input bg-card hover:border-forest/40"
                                }`}
                            >
                                <span className="font-serif text-sm font-bold tracking-[0.1em] uppercase">
                                    {opt.label}
                                </span>
                                {opt.hint && (
                                    <span className="text-center text-xs text-muted-foreground">
                                        {opt.hint}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            );
            break;

        case "chips": {
            const chosen = Array.isArray(value) ? (value as string[]) : [];
            control = (
                <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
                    {(spec.options ?? []).map((opt) => {
                        const active = chosen.includes(opt.value);
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() =>
                                    set(
                                        active
                                            ? chosen.filter((c) => c !== opt.value)
                                            : [...chosen, opt.value],
                                    )
                                }
                                aria-pressed={active}
                                className={`cursor-pointer rounded-full border px-3 py-1 text-sm transition-all ${
                                    active
                                        ? "border-forest bg-forest/12 font-semibold text-forest"
                                        : "border-input bg-card text-secondary-foreground hover:border-forest/40"
                                }`}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            );
            break;
        }

        case "checkbox":
            control = (
                <label className="flex cursor-pointer items-center gap-2 select-none">
                    <input
                        id={id}
                        type="checkbox"
                        className="h-4 w-4 rounded border-input accent-forest"
                        checked={value === true}
                        onChange={(e) => set(e.target.checked)}
                    />
                    <span className="text-sm font-medium text-foreground">{label}</span>
                </label>
            );
            break;

        case "number":
        case "money":
            control = (
                <Input
                    id={id}
                    type="number"
                    inputMode="decimal"
                    step={spec.type === "money" ? "0.01" : "1"}
                    min={spec.min}
                    placeholder={spec.placeholder}
                    value={(value as string | number | undefined) ?? ""}
                    onChange={(e) => set(e.target.value)}
                    disabled={disabled}
                    className={`${tone} ${shakeClass} ${disabled ? "opacity-50" : ""}`}
                />
            );
            break;

        case "date":
            control = (
                <Input
                    id={id}
                    type="date"
                    value={(value as string) ?? ""}
                    onChange={(e) => set(e.target.value)}
                    disabled={disabled}
                    className={`${tone} ${shakeClass}`}
                    aria-label={label}
                />
            );
            break;

        default:
            control = (
                <Input
                    id={id}
                    type="text"
                    value={(value as string) ?? ""}
                    onChange={(e) => set(e.target.value)}
                    placeholder={spec.placeholder}
                    maxLength={spec.maxLength}
                    disabled={disabled}
                    autoFocus={autoFocus}
                    className={`${tone} ${shakeClass}`}
                />
            );
    }

    // A checkbox carries its own label; everything else gets the block.
    if (spec.type === "checkbox") {
        return <div className="mb-5">{control}</div>;
    }

    return (
        <div className={`mb-5 ${disabled ? "opacity-45" : ""}`}>
            <label
                htmlFor={spec.type === "segmented" || spec.type === "chips" ? undefined : id}
                className="mb-1.5 block font-serif text-[0.8125rem] font-bold tracking-[0.12em] text-secondary-foreground uppercase"
            >
                {spec.icon && <span aria-hidden="true">{spec.icon} </span>}
                {label}
                {required && (
                    <span className="text-destructive" aria-hidden="true">
                        {" "}
                        *
                    </span>
                )}
                {spec.glossaryAnchor && (
                    <GlossaryLink anchor={spec.glossaryAnchor} term={label} />
                )}
            </label>

            {control}

            {/* The condition ladder speaks for itself once a grade is picked. */}
            {spec.name === "condition_grade" && typeof value === "string" && value && (
                <ConditionGloss value={value} />
            )}

            {invalid && (
                <span className="mt-1 block text-xs font-medium text-destructive">
                    ⚠ {label} is required
                </span>
            )}
            {spec.help && !invalid && (
                <span className="mt-1 block text-xs text-muted-foreground">{spec.help}</span>
            )}
        </div>
    );
}

/** Options, with optgroups when the spec asks for them (gender). */
function renderOptions(spec: FieldSpec) {
    const options = spec.options ?? [];
    const grouped = options.some((o) => o.group);
    if (!grouped) {
        return options.map((o) => (
            <option key={o.value} value={o.value}>
                {o.label}
            </option>
        ));
    }
    const groups: string[] = [];
    for (const o of options) {
        const g = o.group ?? "";
        if (!groups.includes(g)) groups.push(g);
    }
    return groups.map((g) => (
        <optgroup key={g} label={g}>
            {options
                .filter((o) => (o.group ?? "") === g)
                .map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
        </optgroup>
    ));
}

/**
 * "Body Quality — Suitable for customizing. An honest state, not a fault."
 * The grades are a wear ladder, not a judgement; the copy says so.
 */
function ConditionGloss({ value }: { value: string }) {
    const grade = getConditionGrade(value);
    if (!grade) return null;
    return (
        <p
            className="mt-1.5 text-xs font-medium"
            style={{ color: conditionToneVar(value) }}
        >
            {grade.gloss} — an honest state, not a fault.
        </p>
    );
}
