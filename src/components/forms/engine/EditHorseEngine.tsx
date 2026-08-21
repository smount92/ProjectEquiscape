"use client";

/**
 * The edit page — the same engine, a scroll instead of a wizard.
 *
 * Loads the horse into the registry's key space (columns straight across,
 * the JSONB bag through `unpackAttributes`), renders the same leaves the
 * create wizard does, and writes back through `updateHorseAction` with the
 * asset category named — which is what lets the server apply that
 * category's rules instead of the permissive fallback.
 *
 * Every DOM id the hand-written edit form emitted (`#edit-name`,
 * `#edit-condition`, `#edit-save`, …) is preserved: the field ids come off
 * the specs, and the two action ids are pinned below.
 *
 * Existing photos are shown and can be removed; adding new ones runs the
 * same PhotoStudio the create form does — which is how the edit page picks
 * up the file-size cap and HEIC support it never had.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import FocusLayout from "@/components/layouts/FocusLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import CollectionPicker from "@/components/CollectionPicker";
import UnifiedReferenceSearch from "@/components/UnifiedReferenceSearch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { getCatalogItem, type CatalogItem } from "@/app/actions/reference";
import {
    deleteHorseImageAction,
    getMyTier,
    updateHorseAction,
} from "@/app/actions/horse";
import { getHorseCollections, setHorseCollections } from "@/app/actions/collections";
import { getProfile } from "@/app/actions/settings";
import { track } from "@/lib/analytics";
import type { UserTier } from "@/lib/utils/imageCompression";
import type { AssetCategory } from "@/lib/types/database";
import { getAssetConfig, getGallerySlots } from "@/lib/config/assetFields";
import { getColumnFields } from "@/lib/forms/registry";
import { getGroupFields } from "@/lib/forms/rules";
import { packAttributes, unpackAttributes } from "@/lib/forms/attributes";
import { firstProblemMessage } from "@/lib/forms/schema";
import type { FieldGroup, FormValues } from "@/lib/forms/types";

import { useHorseForm } from "./useHorseForm";
import FieldControl from "./FieldControl";
import { LedgerLeaf, LeafHeading } from "./LedgerLeaf";
import PhotoStudio, { EMPTY_STUDIO, type PhotoStudioValue } from "./PhotoStudio";
import { uploadStudioPhotos } from "./uploadPhotos";

interface ExistingImage {
    recordId: string;
    imageUrl: string;
    /** Bucket-relative path — deleting a photo must remove the object too. */
    storagePath: string | null;
    angle: string;
}

/** The columns the edit form reads. Derived so a new field can't be forgotten. */
const HORSE_COLUMNS = [
    "id",
    "owner_id",
    "custom_name",
    "sculptor",
    "finishing_artist",
    "edition_number",
    "edition_size",
    "finish_type",
    "condition_grade",
    "is_public",
    "visibility",
    "collection_id",
    "catalog_id",
    "trade_status",
    "listing_price",
    "marketplace_notes",
    "life_stage",
    "asset_category",
    "finish_details",
    "public_notes",
    "assigned_breed",
    "assigned_gender",
    "assigned_age",
    "regional_id",
    "attributes",
].join(", ");

export default function EditHorseEngine() {
    const router = useRouter();
    const params = useParams();
    const horseId = params.id as string;
    const supabase = useMemo(() => createClient(), []);

    const [category, setCategory] = useState<AssetCategory>("model");
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [initial, setInitial] = useState<FormValues>({});
    const form = useHorseForm({ mode: "edit", category, initialValues: initial });

    const [reference, setReference] = useState<CatalogItem | null>(null);
    const [collectionIds, setCollectionIds] = useState<string[]>([]);
    const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
    const [newPhotos, setNewPhotos] = useState<PhotoStudioValue>(EMPTY_STUDIO);
    const [hasVault, setHasVault] = useState(false);

    /** The grade this horse arrived with — a change wants a word about why. */
    const [originalCondition, setOriginalCondition] = useState("");
    const [conditionNote, setConditionNote] = useState("");

    const [saving, setSaving] = useState(false);
    const savingRef = useRef(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const [tier, setTier] = useState<UserTier>("free");
    const [viewerTier, setViewerTier] = useState<string | null>(null);
    const [watermark, setWatermark] = useState({ enabled: false, alias: "", text: "" });

    const config = getAssetConfig(category);

    // ── Load ──────────────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;

        (async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) {
                router.push("/login");
                return;
            }
            if (user.app_metadata?.tier) setTier(user.app_metadata.tier as UserTier);

            const { data: horse, error } = await supabase
                .from("user_horses")
                .select(HORSE_COLUMNS)
                .eq("id", horseId)
                .single<Record<string, unknown>>();

            if (cancelled) return;
            if (error || !horse || horse.owner_id !== user.id) {
                setLoadError("Horse not found, or it isn't yours to edit.");
                setLoading(false);
                return;
            }

            const cat = (horse.asset_category as AssetCategory) ?? "model";

            // Columns straight across; the JSONB bag through the registry.
            const values: FormValues = {};
            for (const spec of getColumnFields(cat)) {
                if (spec.table !== "user_horses") continue;
                const raw = horse[spec.name];
                if (raw === null || raw === undefined) continue;
                values[spec.name] = typeof raw === "number" ? String(raw) : raw;
            }
            values.visibility =
                (horse.visibility as string) ?? (horse.is_public ? "public" : "private");
            if (horse.catalog_id) values.catalog_id = horse.catalog_id;
            Object.assign(
                values,
                unpackAttributes(cat, horse.attributes as Record<string, unknown> | null),
            );

            // ── Vault ──
            const { data: vault } = await supabase
                .from("financial_vault")
                .select("purchase_price, purchase_date, estimated_current_value, insurance_notes, purchase_date_text, is_trade")
                .eq("horse_id", horseId)
                .maybeSingle<Record<string, unknown>>();
            if (vault) {
                setHasVault(true);
                for (const spec of getColumnFields(cat)) {
                    if (spec.table !== "financial_vault") continue;
                    const raw = vault[spec.name];
                    if (raw === null || raw === undefined) continue;
                    values[spec.name] = typeof raw === "number" ? String(raw) : raw;
                }
            }

            // ── Photos already on file ──
            const { data: images } = await supabase
                .from("horse_images")
                .select("id, image_url, angle_profile")
                .eq("horse_id", horseId)
                .order("sort_order", { ascending: true });
            if (images) {
                setExistingImages(
                    (images as { id: string; image_url: string; angle_profile: string }[]).map(
                        (img) => {
                            // deleteHorseImageAction needs the bucket-relative
                            // path to remove the object, not just the row.
                            const parts = img.image_url.split("/horse-images/");
                            return {
                                recordId: img.id,
                                imageUrl: img.image_url,
                                storagePath: parts.length > 1 ? parts[1] : null,
                                angle: img.angle_profile,
                            };
                        },
                    ),
                );
            }

            if (cancelled) return;
            setCategory(cat);
            setInitial(values);
            form.reset(values);
            setOriginalCondition((horse.condition_grade as string) ?? "");
            setLoading(false);

            getHorseCollections(horseId).then((ids) => {
                if (ids.length > 0) setCollectionIds(ids);
                else if (horse.collection_id) setCollectionIds([horse.collection_id as string]);
            });
            if (horse.catalog_id) {
                getCatalogItem(horse.catalog_id as string).then((item) => {
                    if (item) setReference(item);
                });
            }
        })();

        getMyTier().then(setViewerTier).catch(() => setViewerTier(null));
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

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [horseId]);

    // A work in progress has no condition to grade.
    useEffect(() => {
        if (form.values.life_stage === "in_progress" && form.values.condition_grade) {
            form.setValue("condition_grade", "");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.values.life_stage]);

    const conditionChanged =
        typeof form.values.condition_grade === "string" &&
        form.values.condition_grade !== originalCondition &&
        originalCondition !== "";

    // ── Save ──────────────────────────────────────────────────────
    const handleSave = async () => {
        if (savingRef.current) return;

        const checked = form.validate();
        if (!checked.ok) {
            form.flagMissing();
            setSaveError(firstProblemMessage(checked.problems));
            return;
        }

        savingRef.current = true;
        form.suppressDirtyGuard(true);
        setSaving(true);
        setSaveError(null);

        try {
            const values = form.values;

            // Split the bag back into its two tables.
            const horseUpdate: Record<string, unknown> = {};
            const vaultData: Record<string, unknown> = {};
            for (const spec of getColumnFields(category)) {
                const raw = values[spec.name];
                const target = spec.table === "financial_vault" ? vaultData : horseUpdate;
                if (spec.type === "number" || spec.type === "money") {
                    const text = String(raw ?? "").trim();
                    target[spec.name] = text === "" ? null : Number(text);
                } else if (spec.type === "checkbox") {
                    target[spec.name] = raw === true;
                } else {
                    const text = String(raw ?? "").trim();
                    target[spec.name] = text === "" ? null : text;
                }
            }

            // `is_public` is derived by trigger 109 from `visibility` —
            // sending it here is what caused the two to disagree.
            delete horseUpdate.is_public;
            horseUpdate.catalog_id = (values.catalog_id as string) || null;

            const attributes = packAttributes(category, values);
            if (Object.keys(attributes).length > 0) horseUpdate.attributes = attributes;

            const result = await updateHorseAction(horseId, {
                horseUpdate,
                vaultData: Object.keys(vaultData).length > 0 ? vaultData : null,
                hasExistingVault: hasVault,
                deleteVault: false,
                conditionChange: conditionChanged
                    ? {
                          newCondition: String(values.condition_grade ?? ""),
                          note: conditionNote.trim() || null,
                      }
                    : null,
                assetCategory: category,
            });

            if (!result.success) {
                throw new Error(result.error || "Failed to save.");
            }

            await setHorseCollections(horseId, collectionIds);

            const hasNew =
                Object.keys(newPhotos.slots).length > 0 ||
                newPhotos.extras.length > 0 ||
                newPhotos.flaws.length > 0;
            if (hasNew) {
                await uploadStudioPhotos({
                    supabase,
                    horseId,
                    photos: newPhotos,
                    gallerySlots: getGallerySlots(category),
                    tier,
                    watermark,
                });
            }

            track("edit_horse", { category });
            router.push(`/stable/${horseId}`);
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : "Something went wrong.");
            setSaving(false);
            savingRef.current = false;
            form.suppressDirtyGuard(false);
        }
    };

    const removeExisting = async (image: ExistingImage) => {
        const result = await deleteHorseImageAction(image.recordId, image.storagePath);
        if (result.success) {
            setExistingImages((prev) => prev.filter((i) => i.recordId !== image.recordId));
        } else {
            setSaveError(result.error ?? "Could not remove that photo.");
        }
    };

    // ── Render ────────────────────────────────────────────────────
    if (loading) {
        return (
            <FocusLayout noHeader>
                <PageMasthead compact icon="✎" title="Loading…" backHref="/dashboard" />
                <LedgerLeaf>
                    <p className="text-muted-foreground">Fetching this horse&apos;s record…</p>
                </LedgerLeaf>
            </FocusLayout>
        );
    }

    if (loadError) {
        return (
            <FocusLayout noHeader>
                <PageMasthead compact icon="⚠" title="Not available" backHref="/dashboard" />
                <LedgerLeaf>
                    <p className="text-destructive">{loadError}</p>
                    <Button asChild variant="outline" className="mt-4">
                        <Link href="/dashboard">← Back to your stable</Link>
                    </Button>
                </LedgerLeaf>
            </FocusLayout>
        );
    }

    return (
        <FocusLayout noHeader>
            <PageMasthead
                compact
                icon="✎"
                title={String(form.values.custom_name ?? "Edit")}
                subtitle={`${config.label} · amending the record`}
                backHref={`/stable/${horseId}`}
                backLabel="Passport"
            />

            {saveError && (
                <div
                    className="mb-5 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
                    role="alert"
                >
                    {saveError}
                </div>
            )}

            <div className="flex flex-col gap-6">
                {/* ── Photos ── */}
                <LedgerLeaf tab="Plate I · Photographs">
                    <LeafHeading>Photographs</LeafHeading>

                    {existingImages.length > 0 && (
                        <div className="mb-6">
                            <p className="mb-3 text-sm text-secondary-foreground">
                                Already on file:
                            </p>
                            <div className="flex flex-wrap gap-3">
                                {existingImages.map((image) => (
                                    <div
                                        key={image.recordId}
                                        className="fe-mount relative h-[92px] w-[122px]"
                                        data-filled="true"
                                        data-primary={
                                            image.angle === "Primary_Thumbnail" ? "true" : "false"
                                        }
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={image.imageUrl} alt={image.angle} />
                                        <button
                                            type="button"
                                            onClick={() => removeExisting(image)}
                                            aria-label={`Remove ${image.angle}`}
                                            className="absolute top-1 right-1 z-[3] grid h-6 w-6 cursor-pointer place-items-center rounded-full border-0 bg-black/70 text-xs text-white"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <PhotoStudio
                        gallerySlots={getGallerySlots(category)}
                        value={newPhotos}
                        onChange={setNewPhotos}
                        canAddExtras={viewerTier === "pro" || viewerTier === "studio"}
                    />
                </LedgerLeaf>

                {/* ── Reference ── */}
                {config.showReferenceStep && (
                    <LedgerLeaf tab="Reference">
                        <LeafHeading note="Changing an identity is recorded on this horse's Hoofprint — provenance is not quietly rewritable.">
                            Reference Link
                        </LeafHeading>
                        <UnifiedReferenceSearch
                            selectedCatalogId={(form.values.catalog_id as string) ?? null}
                            onCatalogSelect={(id, item) => {
                                form.setValue("catalog_id", id ?? "");
                                setReference(item);
                            }}
                        />
                        {reference && (
                            <p className="mt-3 text-sm text-muted-foreground">
                                Linked to <strong>{reference.title}</strong>
                                {reference.maker ? ` · ${reference.maker}` : ""}
                            </p>
                        )}
                    </LedgerLeaf>
                )}

                {/* ── Identity ── */}
                <LedgerLeaf tab="Identity">
                    <LeafHeading>
                        {category === "model" ? "Model Identity" : `${config.label} Details`}
                    </LeafHeading>
                    <EditGroup form={form} group="identity" />

                    {/* A grade change wants a word about why. */}
                    {conditionChanged && (
                        <div className="mb-5 rounded-md border border-info/35 bg-info/8 px-4 py-3">
                            <label
                                htmlFor="condition-note"
                                className="mb-1.5 block font-serif text-[0.8125rem] font-bold tracking-[0.12em] text-secondary-foreground uppercase"
                            >
                                What happened?
                            </label>
                            <Textarea
                                id="condition-note"
                                rows={2}
                                maxLength={300}
                                value={conditionNote}
                                onChange={(e) => setConditionNote(e.target.value)}
                                placeholder="e.g. Ear tip chipped in transit; rub on the near shoulder"
                            />
                            <p className="mt-1 text-xs text-muted-foreground">
                                Optional. This is written into the condition history so the
                                grade change has a reason attached to it.
                            </p>
                        </div>
                    )}
                </LedgerLeaf>

                {/* ── Particulars ── */}
                {getGroupFields(form.context, "attributes").length > 0 && (
                    <LedgerLeaf tab={`${config.label} · Particulars`}>
                        <LeafHeading>Particulars</LeafHeading>
                        <EditGroup form={form} group="attributes" />
                    </LedgerLeaf>
                )}

                {/* ── Show bio ── */}
                {getGroupFields(form.context, "showbio").length > 0 && (
                    <LedgerLeaf tab="Show Bio">
                        <LeafHeading note="The show identity you assign for competition.">
                            🏅 Show Bio
                        </LeafHeading>
                        <EditGroup form={form} group="showbio" />
                    </LedgerLeaf>
                )}

                {/* ── Collections ── */}
                <LedgerLeaf tab="Collections">
                    <LeafHeading>Collections</LeafHeading>
                    <CollectionPicker
                        selectedCollectionIds={collectionIds}
                        onSelect={setCollectionIds}
                    />
                </LedgerLeaf>

                {/* ── Marketplace + visibility ── */}
                <LedgerLeaf tab="Marketplace">
                    <LeafHeading>Marketplace & Visibility</LeafHeading>
                    <EditGroup form={form} group="market" />
                    <EditGroup form={form} group="visibility" />
                </LedgerLeaf>

                {/* ── Vault ── */}
                <LedgerLeaf tab="Sealed · Private">
                    <LeafHeading note="Only you will ever see this. Row Level Security keeps it off every public surface.">
                        🔒 The Financial Vault
                    </LeafHeading>
                    <EditGroup form={form} group="vault" />
                </LedgerLeaf>
            </div>

            {/* ── Actions. The ids are the legacy contract. ── */}
            <div className="mt-8 flex items-center justify-between gap-4">
                <Button asChild variant="outline" size="wide" id="edit-cancel">
                    <Link href={`/stable/${horseId}`}>Cancel</Link>
                </Button>
                <Button onClick={handleSave} disabled={saving} id="edit-save">
                    {saving ? (
                        <>
                            <span className="spinner-inline" aria-hidden="true" />
                            Saving…
                        </>
                    ) : (
                        "Save changes"
                    )}
                </Button>
            </div>
        </FocusLayout>
    );
}

function EditGroup({
    form,
    group,
}: {
    form: ReturnType<typeof useHorseForm>;
    group: FieldGroup;
}) {
    return (
        <>
            {getGroupFields(form.context, group).map((spec) => (
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
        </>
    );
}
