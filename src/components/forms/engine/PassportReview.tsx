"use client";

/**
 * The review leaf — the horse's future passport, before it exists.
 *
 * The old wizard's last step was the Financial Vault and then a Save
 * button: you never saw what you had written. This sets every entry as a
 * printed passport does — label, dotted leader, value — with the primary
 * photo mounted alongside and the private vault visibly walled off.
 *
 * Only fields the user actually filled in are printed. A passport with
 * fourteen blank lines is not a passport.
 */

import type { CatalogItem } from "@/app/actions/reference";
import { resolveLabel } from "@/lib/forms/registry";
import { getGroupFields } from "@/lib/forms/rules";
import type { FieldContext, FieldGroup, FieldSpec } from "@/lib/forms/types";
import { getConditionGrade } from "@/lib/conditionGrades";
import { LeafHeading } from "./LedgerLeaf";
import type { PhotoStudioValue } from "./PhotoStudio";

export default function PassportReview({
    context,
    reference,
    photos,
}: {
    context: FieldContext;
    reference: CatalogItem | null;
    photos: PhotoStudioValue;
}) {
    const name = (context.values.custom_name as string)?.trim();
    const primary =
        photos.slots.Primary_Thumbnail ?? Object.values(photos.slots).find(Boolean);
    const photoCount =
        Object.keys(photos.slots).length + photos.extras.length + photos.flaws.length;
    const grade = getConditionGrade(context.values.condition_grade as string);

    const publicGroups: FieldGroup[] = ["identity", "attributes", "showbio", "market"];
    const publicFields = publicGroups
        .flatMap((g) => getGroupFields(context, g))
        .filter((spec) => filled(context.values[spec.name]))
        // The name is the passport's title, not one of its lines.
        .filter((spec) => spec.name !== "custom_name");

    const vaultFields = getGroupFields(context, "vault").filter((spec) =>
        filled(context.values[spec.name]),
    );

    const visibility = context.values.visibility as string | undefined;

    return (
        <>
            <LeafHeading note="Everything below is what will be written down. Nothing is saved until you say so.">
                Before you sign
            </LeafHeading>

            {/* ── Title block ── */}
            <div className="mb-6 flex flex-wrap items-start gap-5">
                {primary ? (
                    <div className="fe-mount h-[132px] w-[176px] flex-none" data-filled="true">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={primary.previewUrl} alt={name || "Primary photo"} />
                    </div>
                ) : (
                    <div className="fe-mount grid h-[132px] w-[176px] flex-none place-items-center">
                        <span className="fe-mount-corners" aria-hidden="true" />
                        <span className="px-3 text-center text-xs text-muted-foreground">
                            No photo yet — you can add one later
                        </span>
                    </div>
                )}

                <div className="min-w-[220px] flex-1">
                    <h3 className="m-0 font-serif text-2xl font-bold tracking-[0.02em] text-forest">
                        {name || "Unnamed"}
                    </h3>
                    <p className="mt-1 mb-3 text-sm text-muted-foreground">
                        {reference ? (
                            <>
                                Linked to <strong>{reference.title}</strong>
                                {reference.maker ? ` · ${reference.maker}` : ""}
                            </>
                        ) : (
                            "No reference link — a one-of-a-kind entry"
                        )}
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                        {grade && <span className="stamp">{grade.label}</span>}
                        {visibility && (
                            <span className={visibility === "public" ? "stamp" : "stamp stamp-red"}>
                                {visibility}
                            </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                            {photoCount === 0
                                ? "no photos"
                                : `${photoCount} photo${photoCount === 1 ? "" : "s"}`}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── The public record ── */}
            {publicFields.length > 0 ? (
                <dl className="mb-6">
                    {publicFields.map((spec) => (
                        <PassportRow
                            key={spec.name}
                            label={resolveLabel(spec, context.category)}
                            value={display(spec, context.values[spec.name])}
                        />
                    ))}
                </dl>
            ) : (
                <p className="mb-6 text-sm text-muted-foreground">
                    Nothing beyond the name yet — that is a perfectly good place to start.
                    You can fill the rest in whenever you like.
                </p>
            )}

            {/* ── The vault, visibly walled off ── */}
            {vaultFields.length > 0 && (
                <div className="rounded-lg border border-warning/35 bg-warning/8 px-5 py-4">
                    <div className="fe-leaf-heading">
                        <h3>🔒 Private — only you</h3>
                    </div>
                    <dl>
                        {vaultFields.map((spec) => (
                            <PassportRow
                                key={spec.name}
                                label={resolveLabel(spec, context.category)}
                                value={display(spec, context.values[spec.name])}
                            />
                        ))}
                    </dl>
                    <p className="mt-3 text-xs text-muted-foreground">
                        Row Level Security keeps this off every public surface. Nobody who
                        views this horse can see any of it.
                    </p>
                </div>
            )}
        </>
    );
}

function PassportRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="fe-passport-row">
            <dt>{label}</dt>
            <span className="fe-passport-leader" aria-hidden="true" />
            <dd>{value}</dd>
        </div>
    );
}

function filled(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim() !== "";
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "boolean") return value;
    return true;
}

/** Print a value the way a passport would, not the way JSON would. */
function display(spec: FieldSpec, value: unknown): string {
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "boolean") return value ? "Yes" : "No";
    const raw = String(value);
    if (spec.type === "money") {
        const n = Number(raw);
        return Number.isFinite(n)
            ? n.toLocaleString("en-US", { style: "currency", currency: "USD" })
            : raw;
    }
    if (spec.type === "select" || spec.type === "segmented") {
        // Prefer the option's own wording, minus the gloss the dropdown adds.
        const option = spec.options?.find((o) => o.value === raw);
        if (option) return option.hint ? raw : option.label;
    }
    return raw;
}
