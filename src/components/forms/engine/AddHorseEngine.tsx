"use client";

/**
 * The premium create wizard — one engine, driven by the registry.
 *
 * Shape: a leather masthead, a kraft index-tab rail, and one ledger leaf
 * per step. The leaves come from `getActiveGroups`, so a tack item gets an
 * attributes leaf and a model gets a show-bio leaf without a single
 * `isModel &&` in this file.
 *
 * Every DOM id the old wizard emitted is preserved — the field ids come
 * off the specs, and the nav ids (#step-1-next … #submit-horse,
 * .success-overlay) are pinned below, because `e2e/inventory.spec.ts`
 * drives the entire flow by them and nothing else asserts them.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, Link2, Tag, Lock, ScrollText } from "lucide-react";

import FocusLayout from "@/components/layouts/FocusLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import UnifiedReferenceSearch from "@/components/UnifiedReferenceSearch";
import CollectionPicker from "@/components/CollectionPicker";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { entitledTier } from "@/lib/entitlement/clock";
import { getCatalogItem, type CatalogItem } from "@/app/actions/reference";
import { createHorseRecord, getMyTier } from "@/app/actions/horse";
import { setHorseCollections } from "@/app/actions/collections";
import { notifyHorsePublic } from "@/app/actions/horse-events";
import { initializeHoofprint } from "@/app/actions/hoofprint";
import { getProfile } from "@/app/actions/settings";
import { track } from "@/lib/analytics";
import type { UserTier } from "@/lib/utils/imageCompression";
import type { AssetCategory } from "@/lib/types/database";
import { getAssetConfig, getGallerySlots } from "@/lib/config/assetFields";
import { getFieldSpec } from "@/lib/forms/registry";
import { getDomId, getGroupFields } from "@/lib/forms/rules";
import { packAttributes } from "@/lib/forms/attributes";
import { firstProblemMessage, toActionInput } from "@/lib/forms/schema";
import type { FieldGroup } from "@/lib/forms/types";

import { useHorseForm } from "./useHorseForm";
import FieldControl from "./FieldControl";
import { LedgerLeaf, LeafHeading } from "./LedgerLeaf";
import StepRail, { type RailStep } from "./StepRail";
import PhotoStudio, { EMPTY_STUDIO, type PhotoStudioValue } from "./PhotoStudio";
import PassportReview from "./PassportReview";
import CompletionLeaf from "./CompletionLeaf";
import { uploadStudioPhotos } from "./uploadPhotos";

/** Same open-redirect rule as the auth safeRedirectPath. */
function safeReturnToPath(value: string | null): string | null {
    if (!value || !value.startsWith("/")) return null;
    if (value.startsWith("//") || value.startsWith("/\\")) return null;
    return value;
}

const CATEGORY_CHOICES: { value: AssetCategory; icon: string; label: string }[] = [
    { value: "model", icon: "🐎", label: "Model Horse" },
    { value: "tack", icon: "🏇", label: "Tack & Gear" },
    { value: "prop", icon: "🌲", label: "Prop" },
    { value: "diorama", icon: "🎭", label: "Diorama" },
    { value: "other_model", icon: "🐄", label: "Other Model" },
];

/**
 * The leaves of the ledger.
 *
 * Deliberately the SAME count and order as the legacy wizard: four for the
 * model-like categories, three for the rest. The review is not a fifth
 * step — it is the bottom half of the final leaf, under the vault, so the
 * last page reads as the finished document you are about to sign.
 *
 * This matters beyond taste. `e2e/inventory.spec.ts` clicks
 * `#step-1-next` → `#step-2-next` → fills the details → `#step-3-next` →
 * `#submit-horse`. A fifth step would leave the submit button one page
 * further on and the only coverage this flow has would silently fail.
 */
type LeafKey = "gallery" | "reference" | "identity" | "vault";

/**
 * Nav ids, keyed by LEAF rather than by index — which is how the legacy
 * forms emitted them. A three-step category's Details leaf carried
 * `#step-3-back` there too, even though it sits at index 1.
 */
const NAV_IDS: Record<LeafKey, { back?: string; next?: string }> = {
    gallery: { next: "step-1-next" },
    reference: { back: "step-2-back", next: "step-2-next" },
    identity: { back: "step-3-back", next: "step-3-next" },
    vault: { back: "step-4-back" },
};

export default function AddHorseEngine() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = useMemo(() => createClient(), []);

    const returnTo = safeReturnToPath(searchParams.get("returnTo"));
    const showReturnTo = returnTo && returnTo.startsWith("/shows/") ? returnTo : null;

    const [category, setCategory] = useState<AssetCategory>("model");
    const config = getAssetConfig(category);
    const gallerySlots = getGallerySlots(category);

    const form = useHorseForm({
        mode: "create-full",
        category,
        initialValues: { visibility: "public", trade_status: "Not for Sale", life_stage: "completed" },
    });

    const [photos, setPhotos] = useState<PhotoStudioValue>(EMPTY_STUDIO);
    const [reference, setReference] = useState<CatalogItem | null>(null);
    const [nameAutoFilled, setNameAutoFilled] = useState(false);
    const [collectionIds, setCollectionIds] = useState<string[]>([]);

    const [step, setStep] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const submittingRef = useRef(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [saved, setSaved] = useState<{ id: string; name: string } | null>(null);
    const [photoWarning, setPhotoWarning] = useState<string | null>(null);

    const [tier, setTier] = useState<UserTier>("free");
    const [viewerTier, setViewerTier] = useState<string | null>(null);
    const [watermark, setWatermark] = useState({ enabled: false, alias: "", text: "" });

    // ── Leaves for this category ──────────────────────────────────
    const leaves = useMemo<{ key: LeafKey; label: string; icon: string }[]>(() => {
        const list: { key: LeafKey; label: string; icon: string }[] = [
            { key: "gallery", label: "Photos", icon: "📸" },
        ];
        if (config.showReferenceStep) list.push({ key: "reference", label: "Reference", icon: "🔗" });
        list.push({ key: "identity", label: "Details", icon: "🏷️" });
        list.push({ key: "vault", label: "Sign Off", icon: "📜" });
        return list;
    }, [config.showReferenceStep]);

    const identityIdx = leaves.findIndex((l) => l.key === "identity");
    const railSteps: RailStep[] = leaves.map((l) => ({ key: l.key, label: l.label, icon: l.icon }));

    /**
     * The ONE gate. Everything past the details leaf needs the required
     * fields filled; everything up to it is free to wander.
     */
    const identitySatisfied = form.canSubmit;
    const furthestReachable = identitySatisfied ? leaves.length - 1 : identityIdx;

    // ── Boot: tier, watermark prefs, ?catalog= preselect ───────────
    useEffect(() => {
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
        supabase.auth.getUser().then(({ data: { user } }) => {
            // Minus the entitlement clock — an expired term is not Pro.
            if (user?.app_metadata?.tier) setTier(entitledTier(user.app_metadata) as UserTier);
        });

        const catalogParam = searchParams.get("catalog");
        if (catalogParam) {
            form.setValue("catalog_id", catalogParam);
            getCatalogItem(catalogParam).then((item) => {
                if (item) setReference(item);
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // A reference fills the name in, until the user makes it their own.
    useEffect(() => {
        if (!reference) return;
        const current = (form.values.custom_name as string) ?? "";
        if (!current.trim() || nameAutoFilled) {
            form.setValue("custom_name", reference.title);
            setNameAutoFilled(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reference]);

    // A work in progress has no condition to grade.
    useEffect(() => {
        if (form.values.life_stage === "in_progress" && form.values.condition_grade) {
            form.setValue("condition_grade", "");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.values.life_stage]);

    // ── Navigation ────────────────────────────────────────────────
    const goTo = (next: number) => {
        setStep(next);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const goNext = () => {
        // Leaving the details leaf is the only move that can be refused.
        if (step === identityIdx && !form.flagMissing()) {
            const first = form.missing[0];
            if (first) document.getElementById(domIdFor(first.name))?.focus();
            return;
        }
        if (step < leaves.length - 1) goTo(step + 1);
    };

    const goBack = () => {
        if (step > 0) goTo(step - 1);
    };

    // ── Submit ────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (submittingRef.current) return;

        const result = form.validate();
        if (!result.ok) {
            form.flagMissing();
            setSubmitError(firstProblemMessage(result.problems));
            goTo(identityIdx);
            return;
        }

        submittingRef.current = true;
        form.suppressDirtyGuard(true);
        setSubmitting(true);
        setSubmitError(null);

        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) throw new Error("You must be logged in.");

            const values = form.values;
            const attributes = packAttributes(category, values);
            const visibility = (values.visibility as "public" | "unlisted" | "private") ?? "public";
            const name = String(values.custom_name ?? "").trim();

            const payload = {
                ...toActionInput(result.data),
                customName: name,
                assetCategory: category,
                visibility,
                isPublic: visibility !== "private",
                catalogId: (values.catalog_id as string) || undefined,
                selectedCollectionId: collectionIds[0] || undefined,
                attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
            };

            const created = await createHorseRecord(payload as Parameters<typeof createHorseRecord>[0]);
            if (!created.success || !created.horseId) {
                throw new Error(created.error || "Failed to save.");
            }
            const horseId = created.horseId;

            if (collectionIds.length > 0) await setHorseCollections(horseId, collectionIds);

            const outcome = await uploadStudioPhotos({
                supabase,
                horseId,
                photos,
                gallerySlots,
                tier,
                watermark,
            });
            setPhotoWarning(outcome.warning);

            if (visibility === "public") {
                notifyHorsePublic({
                    userId: user.id,
                    horseId,
                    horseName: name,
                    finishType: String(values.finish_type ?? ""),
                    tradeStatus: String(values.trade_status ?? ""),
                    catalogId: (values.catalog_id as string) || null,
                    photoCount: outcome.uploaded,
                });
            }

            if (config.showHoofprint) {
                initializeHoofprint({
                    horseId,
                    horseName: name,
                    lifeStage: String(values.life_stage ?? "completed"),
                });
            }

            track("add_horse", { category, has_catalog: !!values.catalog_id });
            if (values.trade_status === "For Sale" || values.trade_status === "Open to Offers") {
                track("list_for_sale", {
                    status: String(values.trade_status),
                    has_price: !!values.listing_price,
                });
            }

            setSaved({ id: horseId, name });
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
            setSubmitting(false);
            submittingRef.current = false;
            form.suppressDirtyGuard(false);
        }
    };

    // ── Completion ────────────────────────────────────────────────
    if (saved) {
        return (
            <CompletionLeaf
                horseName={saved.name}
                horseId={saved.id}
                visibility={(form.values.visibility as "public" | "unlisted" | "private") ?? "public"}
                categoryLabel={config.label}
                photoWarning={photoWarning}
                showReturnTo={showReturnTo}
                onAddAnother={() => router.refresh()}
            />
        );
    }

    const leaf = leaves[step];
    const isLast = step === leaves.length - 1;

    return (
        <FocusLayout noHeader>
            <PageMasthead
                compact
                icon="🐴"
                title="Add to the Ledger"
                subtitle={config.label}
                backHref="/dashboard"
                backLabel="Dashboard"
            />

            {/* ── Category ── */}
            <div className="mb-6 flex flex-wrap gap-2">
                {CATEGORY_CHOICES.map((choice) => {
                    const active = category === choice.value;
                    return (
                        <button
                            key={choice.value}
                            type="button"
                            onClick={() => {
                                setCategory(choice.value);
                                setStep(0);
                            }}
                            className={`group flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 px-4 py-2.5 transition-all ${
                                active
                                    ? "border-forest bg-forest/10 shadow-sm"
                                    : "border-input bg-card hover:border-forest/40"
                            }`}
                        >
                            <span
                                aria-hidden="true"
                                className={`text-xl transition-all ${
                                    active ? "" : "opacity-60 grayscale group-hover:opacity-90"
                                }`}
                            >
                                {choice.icon}
                            </span>
                            <span
                                className={`font-serif text-[0.75rem] font-bold tracking-[0.1em] uppercase ${
                                    active ? "text-forest" : "text-secondary-foreground"
                                }`}
                            >
                                {choice.label}
                            </span>
                        </button>
                    );
                })}
            </div>

            <StepRail
                steps={railSteps}
                current={step}
                furthestReachable={furthestReachable}
                onJump={goTo}
            />

            {submitError && (
                <div
                    className="mb-5 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
                    role="alert"
                >
                    {submitError}
                </div>
            )}

            {/* ══ GALLERY ══ */}
            {leaf.key === "gallery" && (
                <LedgerLeaf tab="Plate I · Photographs">
                    <LeafHeading
                        note={
                            <>
                                Just cataloguing?{" "}
                                <Link href="/add-horse/quick" className="text-forest underline">
                                    Quick Add
                                </Link>{" "}
                                takes one card and about ten seconds.
                            </>
                        }
                    >
                        <Camera className="mr-2 inline h-4 w-4" aria-hidden="true" />
                        Photographs
                    </LeafHeading>
                    <PhotoStudio
                        gallerySlots={gallerySlots}
                        value={photos}
                        onChange={setPhotos}
                        canAddExtras={viewerTier === "pro" || viewerTier === "studio"}
                    />
                </LedgerLeaf>
            )}

            {/* ══ REFERENCE ══ */}
            {leaf.key === "reference" && (
                <LedgerLeaf tab="Plate II · Reference">
                    <LeafHeading note="Search by mold name, release name (paint job), or artist resin. Linking is optional — a one-of-a-kind is still a horse.">
                        <Link2 className="mr-2 inline h-4 w-4" aria-hidden="true" />
                        Reference Link
                    </LeafHeading>

                    {reference && <ReferenceCard item={reference} />}

                    <UnifiedReferenceSearch
                        finishType={String(form.values.finish_type ?? "") || null}
                        selectedCatalogId={(form.values.catalog_id as string) ?? null}
                        onCatalogSelect={(id, item) => {
                            form.setValue("catalog_id", id ?? "");
                            setReference(item);
                            if (item?.itemType === "artist_resin" && item.maker && !form.values.sculptor) {
                                form.setValue("sculptor", item.maker);
                            }
                        }}
                        onCustomEntry={(term) => {
                            form.setValue("catalog_id", "");
                            setReference(null);
                            const current = (form.values.custom_name as string) ?? "";
                            if (!current.trim() || nameAutoFilled) {
                                form.setValue("custom_name", term);
                                setNameAutoFilled(true);
                            }
                            goTo(identityIdx);
                        }}
                    />
                </LedgerLeaf>
            )}

            {/* ══ IDENTITY ══ */}
            {leaf.key === "identity" && (
                <div className="flex flex-col gap-6">
                    {reference && <ReferenceCard item={reference} />}

                    <LedgerLeaf tab={`Plate ${config.showReferenceStep ? "III" : "II"} · Identity`}>
                        <LeafHeading>
                            <Tag className="mr-2 inline h-4 w-4" aria-hidden="true" />
                            {category === "model" ? "Model Identity" : `${config.label} Details`}
                        </LeafHeading>
                        <GroupFields form={form} group="identity" autoFocusFirst />
                    </LedgerLeaf>

                    <AttributeLeaf form={form} label={config.label} />

                    <ShowBioLeaf form={form} />

                    <LedgerLeaf tab="Collections">
                        <LeafHeading note="Optional — group this horse with others in your stable.">
                            Collections
                        </LeafHeading>
                        <CollectionPicker
                            selectedCollectionIds={collectionIds}
                            onSelect={setCollectionIds}
                        />
                    </LedgerLeaf>

                    <LedgerLeaf tab="Marketplace">
                        <LeafHeading>Marketplace & Visibility</LeafHeading>
                        <GroupFields form={form} group="market" />
                        <GroupFields form={form} group="visibility" />
                    </LedgerLeaf>
                </div>
            )}

            {/* ══ VAULT + REVIEW — the final leaf ══ */}
            {leaf.key === "vault" && (
                <div className="flex flex-col gap-6">
                    <LedgerLeaf tab="Sealed · Private">
                        <LeafHeading note="Optional, and yours alone.">
                            <Lock className="mr-2 inline h-4 w-4" aria-hidden="true" />
                            The Financial Vault
                        </LeafHeading>

                        <div
                            className="mb-6 flex items-start gap-3 rounded-md border border-warning/35 bg-warning/10 p-4"
                            role="note"
                        >
                            <span aria-hidden="true" className="mt-0.5 shrink-0 text-lg">
                                🛡️
                            </span>
                            <p className="m-0 text-sm">
                                <strong>Only you will ever see this.</strong> Purchase
                                prices, valuations and insurance notes are protected by Row
                                Level Security — no other member, not even someone viewing
                                your public horses, can reach them. They are wiped
                                automatically if this horse ever changes hands.
                            </p>
                        </div>

                        <GroupFields form={form} group="vault" />
                    </LedgerLeaf>

                    {/* The finished document, right above the signature. */}
                    <LedgerLeaf tab="The Passport">
                        <PassportReview
                            context={form.context}
                            reference={reference}
                            photos={photos}
                        />
                    </LedgerLeaf>
                </div>
            )}

            {/* ── Nav. The ids below are the e2e contract. ── */}
            <div className="mt-8 flex items-center justify-between gap-4">
                {step > 0 ? (
                    <Button
                        variant="outline"
                        size="wide"
                        onClick={goBack}
                        id={NAV_IDS[leaf.key].back}
                    >
                        ← Back
                    </Button>
                ) : (
                    <div aria-hidden="true" />
                )}

                {isLast ? (
                    <Button onClick={handleSubmit} disabled={submitting} id="submit-horse">
                        {submitting ? (
                            <>
                                <span className="spinner-inline" aria-hidden="true" />
                                Entering in the ledger…
                            </>
                        ) : (
                            <>
                                <ScrollText className="h-4 w-4" aria-hidden="true" />
                                Enter in the ledger
                            </>
                        )}
                    </Button>
                ) : (
                    <Button onClick={goNext} id={NAV_IDS[leaf.key].next}>
                        Next: {leaves[step + 1].label} →
                    </Button>
                )}
            </div>
        </FocusLayout>
    );
}

/* ── Helpers ──────────────────────────────────────────────────── */

/**
 * The id FieldControl will have rendered, for focus management. Asks the
 * registry first so it can never drift from what was actually emitted.
 */
function domIdFor(name: string): string {
    const spec = getFieldSpec(name);
    return (
        (spec && getDomId(spec, "create-full")) ?? `fe-${name.replace(/_/g, "-")}`
    );
}

function GroupFields({
    form,
    group,
    autoFocusFirst = false,
}: {
    form: ReturnType<typeof useHorseForm>;
    group: FieldGroup;
    autoFocusFirst?: boolean;
}) {
    const fields = getGroupFields(form.context, group);
    return (
        <>
            {fields.map((spec, i) => (
                <FieldControl
                    key={spec.name}
                    spec={spec}
                    context={form.context}
                    value={form.values[spec.name]}
                    onChange={form.setValue}
                    invalid={form.flagged.includes(spec.name)}
                    shake={form.shake}
                    autoFocus={autoFocusFirst && i === 0}
                />
            ))}
        </>
    );
}

/** The per-category attributes leaf — only drawn when the category has any. */
function AttributeLeaf({
    form,
    label,
}: {
    form: ReturnType<typeof useHorseForm>;
    label: string;
}) {
    const fields = getGroupFields(form.context, "attributes");
    if (fields.length === 0) return null;
    return (
        <LedgerLeaf tab={`${label} · Particulars`}>
            <LeafHeading>Particulars</LeafHeading>
            <GroupFields form={form} group="attributes" />
        </LedgerLeaf>
    );
}

function ShowBioLeaf({ form }: { form: ReturnType<typeof useHorseForm> }) {
    const fields = getGroupFields(form.context, "showbio");
    if (fields.length === 0) return null;
    return (
        <LedgerLeaf tab="Show Bio">
            <LeafHeading note="The show identity you assign for competition — breed, gender and age decide the ring divisions. All optional.">
                🏅 Show Bio
            </LeafHeading>
            <GroupFields form={form} group="showbio" />
        </LedgerLeaf>
    );
}

/** The linked reference, shown as a mounted card rather than a text line. */
function ReferenceCard({ item }: { item: CatalogItem }) {
    return (
        <div className="flex items-center gap-3 rounded-lg border border-forest/35 bg-forest/6 px-4 py-3">
            <span aria-hidden="true" className="text-lg">
                🔗
            </span>
            <div className="min-w-0">
                <p className="m-0 font-serif text-sm font-bold tracking-[0.04em]">{item.title}</p>
                <p className="m-0 text-xs text-muted-foreground">
                    {[item.maker, item.scale, item.parentTitle].filter(Boolean).join(" · ")}
                </p>
            </div>
        </div>
    );
}
