"use client";

/**
 * Quick Add — the same engine, a shorter field list, one card.
 *
 * Quick add stops being a separate implementation. It reads the same
 * registry (the `create-quick` mode filter picks out name, finish,
 * condition and visibility), validates through the same schema, and writes
 * through `createHorseRecord` like everything else.
 *
 * Two long-standing gaps close as a consequence:
 *   • it could never produce an UNLISTED horse — its visibility was a
 *     boolean, so the tri-state the rest of the site offers was
 *     unreachable here;
 *   • it queried `user_collections` straight from the browser instead of
 *     using `<CollectionPicker>`.
 *
 * The rhythm that makes it useful — add, confirm, keep the reference,
 * duplicate as a new finish — is preserved exactly.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import FocusLayout from "@/components/layouts/FocusLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import UnifiedReferenceSearch from "@/components/UnifiedReferenceSearch";
import CollectionPicker from "@/components/CollectionPicker";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { createHorseRecord } from "@/app/actions/horse";
import { getProfile } from "@/app/actions/settings";
import { setHorseCollections } from "@/app/actions/collections";
import { catalogDisplayName } from "@/lib/catalog/displayName";
import { track } from "@/lib/analytics";
import {
    validateImageFile,
    createImagePreviewUrl,
    revokeImagePreviewUrl,
    type UserTier,
} from "@/lib/utils/imageCompression";
import { getGallerySlots } from "@/lib/config/assetFields";
import { getGroupFields } from "@/lib/forms/rules";
import { firstProblemMessage, toActionInput } from "@/lib/forms/schema";
import type { CatalogItem } from "@/app/actions/reference";

import { useHorseForm } from "./useHorseForm";
import FieldControl from "./FieldControl";
import { LedgerLeaf, LeafHeading } from "./LedgerLeaf";
import { uploadStudioPhotos } from "./uploadPhotos";
import { EMPTY_STUDIO } from "./PhotoStudio";

interface RecentAdd {
    id: string;
    name: string;
    finish: string;
    condition: string;
    visibility: string;
    hasPhoto: boolean;
    at: number;
}

const DEFAULTS = { finish_type: "OF", condition_grade: "Mint", visibility: "public" };

export default function QuickAddEngine() {
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);

    const form = useHorseForm({
        mode: "create-quick",
        category: "model",
        initialValues: { ...DEFAULTS },
    });

    const [reference, setReference] = useState<CatalogItem | null>(null);
    const [collectionIds, setCollectionIds] = useState<string[]>([]);
    const [photo, setPhoto] = useState<{ file: File; previewUrl: string } | null>(null);
    const [photoNote, setPhotoNote] = useState<string | null>(null);

    const [adding, setAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [recent, setRecent] = useState<RecentAdd[]>([]);
    const [justAdded, setJustAdded] = useState<RecentAdd | null>(null);
    const [addedSignature, setAddedSignature] = useState<string | null>(null);

    const [tier, setTier] = useState<UserTier>("free");
    const [watermark, setWatermark] = useState({ enabled: false, alias: "", text: "" });
    const photoInput = useRef<HTMLInputElement>(null);

    useEffect(() => {
        getProfile()
            .then((profile) => {
                if (profile) {
                    setWatermark({
                        enabled: profile.watermarkPhotos,
                        alias: profile.aliasName,
                        text: profile.watermarkText,
                    });
                }
            })
            .catch(() => {});
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user?.app_metadata?.tier) setTier(user.app_metadata.tier as UserTier);
        });
    }, [supabase]);

    /**
     * One string per distinct form state. After a success the Add button
     * stays disabled until something changes — this is the guard that
     * stopped the accidental second tap creating duplicate horses.
     */
    const signature = JSON.stringify({
        ...form.values,
        col: collectionIds,
        ph: photo?.previewUrl ?? null,
    });
    const unchangedSinceAdd = signature === addedSignature;

    const displayName = () => {
        const typed = String(form.values.custom_name ?? "").trim();
        if (typed) return typed;
        if (reference) return catalogDisplayName(reference.maker, reference.title);
        return "";
    };

    const canAdd = !!reference || !!String(form.values.custom_name ?? "").trim();

    const pickPhoto = (file: File) => {
        const problem = validateImageFile(file);
        if (problem) {
            setPhotoNote(problem);
            return;
        }
        setPhotoNote(null);
        if (photo) revokeImagePreviewUrl(photo.previewUrl);
        setPhoto({ file, previewUrl: createImagePreviewUrl(file) });
    };

    const handleAdd = async () => {
        const checked = form.validate();
        if (!checked.ok) {
            const stillMissing = checked.problems.filter(
                // The name is optional when a reference carries it.
                (p) => !(p.field === "custom_name" && reference),
            );
            if (stillMissing.length > 0) {
                form.flagMissing();
                setError(firstProblemMessage(stillMissing));
                return;
            }
        }

        setAdding(true);
        setError(null);
        setPhotoNote(null);

        try {
            const name = displayName() || "Unnamed Horse";
            const visibility =
                (form.values.visibility as "public" | "unlisted" | "private") ?? "public";

            const created = await createHorseRecord({
                ...(toActionInput(form.values) as Record<string, unknown>),
                customName: name,
                assetCategory: "model",
                visibility,
                isPublic: visibility !== "private",
                catalogId: reference?.id,
                selectedCollectionId: collectionIds[0],
            } as Parameters<typeof createHorseRecord>[0]);

            if (!created.success || !created.horseId) {
                setError(created.error || "Failed to add horse.");
                return;
            }
            const horseId = created.horseId;

            if (collectionIds.length > 0) await setHorseCollections(horseId, collectionIds);

            track("add_horse", { category: "model", quick: true });

            let hasPhoto = false;
            if (photo) {
                const outcome = await uploadStudioPhotos({
                    supabase,
                    horseId,
                    photos: { ...EMPTY_STUDIO, slots: { Primary_Thumbnail: photo } },
                    gallerySlots: getGallerySlots("model"),
                    tier,
                    watermark,
                });
                hasPhoto = outcome.uploaded > 0;
                if (outcome.warning) setPhotoNote(outcome.warning);
                revokeImagePreviewUrl(photo.previewUrl);
                setPhoto(null);
            }

            const entry: RecentAdd = {
                id: horseId,
                name,
                finish: String(form.values.finish_type ?? ""),
                condition: String(form.values.condition_grade ?? ""),
                visibility,
                hasPhoto,
                at: Date.now(),
            };
            setRecent((prev) => [entry, ...prev].slice(0, 10));
            setJustAdded(entry);

            // Lock against the form as it will look AFTER the clears below.
            form.setValue("custom_name", "");
            setAddedSignature(
                JSON.stringify({
                    ...form.values,
                    custom_name: "",
                    col: collectionIds,
                    ph: null,
                }),
            );
        } catch {
            setError("An unexpected error occurred.");
        } finally {
            setAdding(false);
        }
    };

    const duplicate = () => {
        form.setMany({ finish_type: "OF", condition_grade: "Mint", custom_name: "" });
        if (photo) revokeImagePreviewUrl(photo.previewUrl);
        setPhoto(null);
        setAddedSignature(null);
    };

    const since = (at: number) => {
        const s = Math.floor((Date.now() - at) / 1000);
        if (s < 5) return "just now";
        if (s < 60) return `${s}s ago`;
        return `${Math.floor(s / 60)}m ago`;
    };

    const fields = getGroupFields(form.context, "identity");
    const visibilityFields = getGroupFields(form.context, "visibility");

    return (
        <FocusLayout noHeader>
            <PageMasthead
                compact
                icon="⚡"
                title="Quick Add"
                subtitle="One card, one horse"
                backHref="/dashboard"
                backLabel="Dashboard"
            />

            <div className="mx-auto max-w-[680px]">
                {justAdded && (
                    <div
                        className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm"
                        role="status"
                        aria-live="polite"
                    >
                        <span className="stamp">Recorded</span>
                        <span className="font-serif font-bold text-forest">{justAdded.name}</span>
                        <span className="text-xs text-muted-foreground">
                            {justAdded.visibility !== "public"
                                ? "Set it public to enter shows."
                                : justAdded.hasPhoto
                                  ? "Show-ready — public with a photo."
                                  : "Add a photo before entering a show."}
                        </span>
                        <Link
                            href={`/stable/${justAdded.id}`}
                            className="ml-auto font-semibold text-forest hover:underline"
                        >
                            View →
                        </Link>
                    </div>
                )}

                <LedgerLeaf tab="Quick Entry">
                    <LeafHeading note="Search the Registry, or just type a name. Everything else has a sensible default.">
                        🔍 The Horse
                    </LeafHeading>

                    <UnifiedReferenceSearch
                        selectedCatalogId={reference?.id ?? null}
                        onCatalogSelect={(_id, item) => {
                            setReference(item);
                            form.setValue("custom_name", "");
                        }}
                        onCustomEntry={(name) => {
                            setReference(null);
                            form.setValue("custom_name", name);
                        }}
                    />

                    {reference && (
                        <div className="mt-3 flex items-center gap-3 rounded-lg border border-forest/35 bg-forest/6 px-4 py-2.5">
                            <span aria-hidden="true">🔗</span>
                            <div className="min-w-0">
                                <p className="m-0 font-serif text-sm font-bold">{reference.title}</p>
                                <p className="m-0 text-xs text-muted-foreground">
                                    {[reference.maker, reference.scale].filter(Boolean).join(" · ")}
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="mt-6 grid grid-cols-2 gap-x-5 max-sm:grid-cols-1">
                        {fields.map((spec) => (
                            <FieldControl
                                key={spec.name}
                                spec={spec}
                                context={form.context}
                                value={form.values[spec.name]}
                                onChange={form.setValue}
                                invalid={form.flagged.includes(spec.name)}
                                shake={form.shake}
                            />
                        ))}
                    </div>

                    {visibilityFields.map((spec) => (
                        <FieldControl
                            key={spec.name}
                            spec={spec}
                            context={form.context}
                            value={form.values[spec.name]}
                            onChange={form.setValue}
                        />
                    ))}

                    <CollectionPicker
                        selectedCollectionIds={collectionIds}
                        onSelect={setCollectionIds}
                    />

                    {/* One photo makes it show-ready. */}
                    <div className="mb-5">
                        <p className="mb-2 font-serif text-[0.8125rem] font-bold tracking-[0.12em] text-secondary-foreground uppercase">
                            Photograph
                        </p>
                        <div className="flex items-center gap-4">
                            <label
                                className="fe-mount grid h-[92px] w-[122px] flex-none cursor-pointer place-items-center"
                                data-filled={photo ? "true" : "false"}
                                data-primary="true"
                            >
                                <span className="fe-mount-corners" aria-hidden="true" />
                                <input
                                    ref={photoInput}
                                    id="quick-photo-input"
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                                    className="sr-only"
                                    aria-label="Upload a photo"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        e.target.value = "";
                                        if (file) pickPhoto(file);
                                    }}
                                />
                                {photo ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={photo.previewUrl} alt="Photo preview" />
                                ) : (
                                    <span className="font-serif text-2xl opacity-45" aria-hidden="true">
                                        ⌗
                                    </span>
                                )}
                            </label>
                            <div className="text-sm text-muted-foreground">
                                <p className="m-0">
                                    Optional. One clear side shot makes this horse show-ready.
                                </p>
                                {photo && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            revokeImagePreviewUrl(photo.previewUrl);
                                            setPhoto(null);
                                        }}
                                        className="mt-1 cursor-pointer text-xs underline hover:text-destructive"
                                    >
                                        Remove photo
                                    </button>
                                )}
                            </div>
                        </div>
                        {photoNote && (
                            <p
                                className="mt-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning"
                                role="alert"
                            >
                                {photoNote}
                            </p>
                        )}
                    </div>

                    {error && (
                        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                            ⚠️ {error}
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-4">
                        <Button
                            onClick={handleAdd}
                            disabled={adding || !canAdd || unchangedSinceAdd}
                            id="quick-add-submit"
                        >
                            {adding
                                ? "Adding…"
                                : unchangedSinceAdd
                                  ? "✅ Added"
                                  : "🐴 Add to Stable"}
                        </Button>
                        {reference && recent.length > 0 && (
                            <Button variant="outline" size="wide" onClick={duplicate} id="quick-duplicate">
                                + Duplicate as new finish
                            </Button>
                        )}
                    </div>
                </LedgerLeaf>

                <p className="mt-4 text-center text-sm text-muted-foreground">
                    Need photos from every angle or the full record?{" "}
                    <Link href="/add-horse" className="text-forest underline">
                        Use the full intake form →
                    </Link>
                </p>

                {recent.length > 0 && (
                    <LedgerLeaf tab={`Today · ${recent.length}`} className="mt-8">
                        <LeafHeading>Entered this session</LeafHeading>
                        <dl>
                            {recent.map((item) => (
                                <div key={item.id} className="fe-passport-row">
                                    <dt>{item.name}</dt>
                                    <span className="fe-passport-leader" aria-hidden="true" />
                                    <dd className="font-normal text-muted-foreground">
                                        {item.finish} · {item.condition} · {since(item.at)}{" "}
                                        <Link
                                            href={`/stable/${item.id}`}
                                            className="ml-2 font-semibold text-forest hover:underline"
                                        >
                                            View →
                                        </Link>
                                    </dd>
                                </div>
                            ))}
                        </dl>
                        <Button
                            variant="outline"
                            className="mt-5 w-full"
                            onClick={() => router.push("/dashboard")}
                        >
                            ← Back to Dashboard ({recent.length} added)
                        </Button>
                    </LedgerLeaf>
                )}
            </div>
        </FocusLayout>
    );
}
