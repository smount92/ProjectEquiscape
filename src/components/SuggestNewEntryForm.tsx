"use client";

import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { createSuggestion } from "@/app/actions/catalog-suggestions";
import { pickMold, type MoldChoice } from "@/app/actions/linker";
import { releaseYearFields } from "@/lib/linker/model";
import { reconcileTitleNumber, titleNumberProblem } from "@/lib/catalog/titleNumber";
import { ARTIST_ATTRIBUTED_CATEGORIES, CANONICAL_SCALES, KNOWN_MANUFACTURERS, RUN_TYPES } from "@/lib/catalog/taxonomy";
import { MATERIAL_OPTIONS } from "@/lib/catalog/editableFields";
import { GENDER_GROUPS } from "@/lib/config/genders";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

// "Stone" and "Peter Stone" are the same maker (collapsed), and
// "Artist Resin" is an entry TYPE, not a maker — both fixed here.
// North Light: commercially produced OF resins (North Light factory,
// England — later Wade Ceramics). A FACTORY maker, so its models are
// molds/releases, never "Artist Resin" (owner-approved 2026-08 after
// a user request; 15 catalog items exist under maker_slug north-light).
// Taxonomy v2: the recognized-company list (MHI-reviewed) + Other.
const MAKERS = [...KNOWN_MANUFACTURERS, "Other"];
// Taxonomy v2: canonical DB values (legacy release/mold/resin values in
// old pending suggestions still translate — see taxonomy.ts).
const ITEM_TYPES = [
    { value: "plastic_release", label: "Release (specific color/year of a mold)" },
    { value: "plastic_mold", label: "Mold (sculpture, not a specific release)" },
    { value: "artist_resin", label: "Artist Resin" },
    { value: "factory_resin", label: "Factory Resin (OF resin — Stone, North Light…)" },
    { value: "china", label: "China / Ceramic" },
    { value: "micro_mini", label: "Micro Mini" },
    { value: "medallion", label: "Medallion" },
    { value: "tack", label: "Tack / Accessory" },
];

interface SuggestNewEntryFormProps {
    /** Prefill the title — e.g. the search term that found nothing. */
    initialTitle?: string;
    /** "dialog": hosted inside a Dialog (add-horse picker). Cancel and the
     *  success CTA hand control back to the host instead of navigating. */
    variant?: "page" | "dialog";
    /** Dialog mode: called when the user continues after a successful submit. */
    onSubmitted?: (title: string) => void;
    /** Dialog mode: called when the user cancels. */
    onCancel?: () => void;
    /** Prefills from a mold page's "add this piece" link. */
    initialMoldName?: string;
    initialScale?: string;
    initialMaker?: string;
    initialModelNumber?: string;
}

export default function SuggestNewEntryForm({
    initialTitle = "",
    variant = "page",
    onSubmitted,
    onCancel,
    initialMoldName = "",
    initialScale = "",
    initialMaker = "",
    initialModelNumber = "",
}: SuggestNewEntryFormProps = {}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [submittedTitle, setSubmittedTitle] = useState("");

    const [title, setTitle] = useState(initialTitle);
    const [maker, setMaker] = useState(initialMaker);
    const [customMaker, setCustomMaker] = useState("");
    const [sculptor, setSculptor] = useState("");
    // Artist categories: the primary attribution is a PERSON.
    const [artistName, setArtistName] = useState("");
    const [manufacturer, setManufacturer] = useState("");
    const [itemType, setItemType] = useState("plastic_release");
    const [scale, setScale] = useState(initialScale);
    const [color, setColor] = useState("");
    const [material, setMaterial] = useState("");
    const [year, setYear] = useState("");
    // The last year a release was made, when it ended (MHH-077).
    const [yearEnd, setYearEnd] = useState("");
    const [retailPrice, setRetailPrice] = useState("");
    // Tier 1 (2026-08-23). Run type/count describe a FACTORY release, so
    // they are only collected for factory categories (see the payload).
    const [runType, setRunType] = useState("");
    const [runCount, setRunCount] = useState("");
    const [breed, setBreed] = useState("");
    const [gender, setGender] = useState("");
    const [moldName, setMoldName] = useState(initialMoldName);
    // The mold picked from the Registry, if any. Its id travels with the
    // suggestion so approval files the release under it; typed text alone
    // is matched later and can miss (MHH-063).
    const [moldId, setMoldId] = useState<string | null>(null);
    const [moldChoices, setMoldChoices] = useState<MoldChoice[]>([]);
    const [activeMold, setActiveMold] = useState(-1);
    const moldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Each search gets a number; an answer to an older search is ignored, so
    // fast typing (or clearing the box) never brings back a stale list.
    const moldRequest = useRef(0);
    useEffect(
        () => () => {
            if (moldTimer.current) clearTimeout(moldTimer.current);
        },
        [],
    );
    // The mold picker files a factory release; other entry types keep the
    // typed mold name only.
    const picksMold = itemType === "plastic_release";
    const closeMoldList = () => {
        moldRequest.current += 1;
        if (moldTimer.current) clearTimeout(moldTimer.current);
        setMoldChoices([]);
        setActiveMold(-1);
    };
    const chooseMold = (m: MoldChoice) => {
        setMoldName(m.title);
        setMoldId(m.id);
        closeMoldList();
    };
    // A picked mold belongs to one maker, scale and entry type; changing any
    // of them unlinks it (the typed name stays).
    const unlinkMold = () => setMoldId(null);
    const onMoldInput = (value: string) => {
        setMoldName(value);
        setMoldId(null);
        closeMoldList();
        if (!picksMold || value.trim().length < 2) return;
        const request = moldRequest.current;
        moldTimer.current = setTimeout(async () => {
            const makerNow = maker === "Other" ? customMaker.trim() : maker;
            const found = await pickMold(value, makerNow || null, scale || null);
            if (request !== moldRequest.current) return;
            setMoldChoices(found);
            setActiveMold(-1);
        }, 250);
    };
    const onMoldKey = (e: KeyboardEvent<HTMLInputElement>) => {
        if (moldChoices.length === 0) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveMold((i) => (i + 1) % moldChoices.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveMold((i) => (i <= 0 ? moldChoices.length - 1 : i - 1));
        } else if (e.key === "Enter" && activeMold >= 0) {
            e.preventDefault();
            chooseMold(moldChoices[activeMold]);
        } else if (e.key === "Escape") {
            closeMoldList();
        }
    };
    // The model number has its own field: without one, members typed it into
    // the title ("#5022 Silky Sullivan") where search cannot read it.
    const [modelNumber, setModelNumber] = useState(initialModelNumber);
    const [reason, setReason] = useState("");
    // Duplicate speed bump: candidates from the server's title match.
    const [duplicates, setDuplicates] = useState<
        { id: string; title: string; maker: string | null; item_type: string }[] | null
    >(null);

    // A title that starts with a different number from the Model number box:
    // the member says which is right before anything is sent (MHH-079).
    const [numberConflict, setNumberConflict] = useState<{ inTitle: string; inBox: string; title: string } | null>(
        null,
    );

    const handleSubmit = (confirmDuplicates = false, chosen?: { title: string; model: string }) => {
        const titleNow = chosen?.title ?? title;
        const modelNow = chosen?.model ?? modelNumber;
        if (!titleNow.trim()) {
            setError("Title is required.");
            return;
        }
        if (!reason.trim() || reason.trim().length < 10) {
            setError("Please provide a reason (at least 10 characters).");
            return;
        }

        // First and last year as one range, checked the way every year box is (MHH-077).
        if (yearEnd.trim() && !year.trim()) {
            setError("Add the first year too, or leave the last year empty.");
            return;
        }
        const years = releaseYearFields(yearEnd.trim() ? `${year.trim()}-${yearEnd.trim()}` : year);
        if (!years.ok) {
            setError(years.error);
            return;
        }

        // Attribution split: for artist pieces the person IS the primary
        // attribution (maker); for factory pieces the company is.
        const isArtistPiece = ARTIST_ATTRIBUTED_CATEGORIES.has(itemType);
        const isMold = itemType === "plastic_mold";
        const effectiveMaker = isArtistPiece ? artistName.trim() : maker === "Other" ? customMaker.trim() : maker;

        // A number typed at the front of the title: off the title when the box
        // holds it, into the box when it is empty, a question when they differ.
        // Molds and artist pieces have no number field, so their titles stay as typed.
        const hasNumberField = !isArtistPiece && !isMold;
        const numbered = hasNumberField
            ? reconcileTitleNumber(titleNow, modelNow)
            : ({ ok: true, title: titleNow.trim(), model: "" } as const);
        if (!numbered.ok) {
            setNumberConflict({ inTitle: numbered.inTitle, inBox: numbered.inBox, title: numbered.title });
            return;
        }
        setNumberConflict(null);
        const finalTitle = numbered.title;
        const finalModel = numbered.model;

        startTransition(async () => {
            setError(null);
            const result = await createSuggestion({
                catalogItemId: null, // null = new entry suggestion
                suggestionType: "addition",
                fieldChanges: {
                    title: finalTitle,
                    maker: effectiveMaker || undefined,
                    model_number: isArtistPiece || isMold ? undefined : finalModel || undefined,
                    manufacturer: isArtistPiece ? manufacturer.trim() || undefined : undefined,
                    sculptor: isArtistPiece ? undefined : sculptor.trim() || undefined,
                    item_type: itemType,
                    scale: scale || undefined,
                    color: color || undefined,
                    material: material || undefined,
                    year: years.fields.year,
                    year_end: years.fields.year_end,
                    retail_price: /^\d{1,5}([.]\d{1,2})?$/.test(retailPrice.trim()) ? retailPrice.trim() : undefined,
                    // Run fields are factory-only — an artist piece has no "run".
                    run_type: isArtistPiece ? undefined : runType || undefined,
                    run_count: isArtistPiece
                        ? undefined
                        : /^\d{1,7}$/.test(runCount.trim())
                          ? runCount.trim()
                          : undefined,
                    breed: breed.trim() || undefined,
                    gender: gender || undefined,
                    // A mold IS its name: the title is written to both places so the
                    // review screens and the duplicate check keep reading mold_name.
                    // (A member was asked for the same name twice, 2026-10-12.)
                    mold_name: isMold ? finalTitle : moldName || undefined,
                    // A mold picked from the Registry files the release under it at approval.
                    ...(picksMold && moldId ? { parent_catalog_id: moldId } : {}),
                },
                reason: reason.trim(),
                confirmDuplicates,
            });

            if (result.success) {
                setDuplicates(null);
                setSubmittedTitle(finalTitle);
                setSuccess(true);
            } else if (result.error === "possible-duplicates" && "duplicates" in result) {
                setDuplicates(result.duplicates ?? []);
            } else {
                setError(result.error || "Failed to submit suggestion.");
            }
        });
    };

    const handleCancel = () => {
        if (variant === "dialog" && onCancel) {
            onCancel();
        } else {
            router.back();
        }
    };

    if (success) {
        return (
            <div className="p-8 text-center">
                <div className="mb-4 text-[3rem]">✅</div>
                <h2 className="font-display mb-2">Suggestion Submitted!</h2>
                <p className="mb-6 text-muted-foreground">
                    Your new entry suggestion is now pending review. The community can vote and discuss it.
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                    {variant === "dialog" ? (
                        <Button onClick={() => onSubmitted?.(submittedTitle)}>Continue →</Button>
                    ) : (
                        <>
                            <Button onClick={() => router.push("/catalog/suggestions")}>View All Suggestions</Button>
                            <Button
                                variant="outline"
                                size="wide"
                                onClick={() => {
                                    setSuccess(false);
                                    setTitle("");
                                    setReason("");
                                }}
                            >
                                Submit Another
                            </Button>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Title */}
            <div className="mb-6">
                <label className="mb-1 block text-sm font-semibold text-foreground" htmlFor="new-entry-title">
                    {itemType === "plastic_mold" ? "Mold name *" : "Title / Name *"}
                </label>
                <Input
                    id="new-entry-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                        itemType === "plastic_mold" ? "e.g. Family Arabian Stallion" : "e.g. Misty of Chincoteague"
                    }
                    maxLength={200}
                />
                {itemType === "plastic_mold" && (
                    <p className="m-0 mt-1 text-xs text-muted-foreground">
                        The sculpture itself. Releases on this mold are added as their own entries afterwards.
                    </p>
                )}
            </div>

            {/* Item Type */}
            <div className="mb-6">
                <label className="mb-1 block text-sm font-semibold text-foreground" htmlFor="new-entry-type">
                    Entry Type
                </label>
                <select
                    id="new-entry-type"
                    className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
                    value={itemType}
                    onChange={(e) => {
                        setItemType(e.target.value);
                        unlinkMold();
                    }}
                >
                    {ITEM_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                            {t.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Attribution — category-aware (owner decision 2026-08-19):
     artist pieces credit a PERSON first (Artist) with an optional
     company; factory pieces credit a COMPANY first (Manufacturer)
     with an optional sculptor. */}
            {ARTIST_ATTRIBUTED_CATEGORIES.has(itemType) ? (
                <>
                    <div className="mb-6">
                        <label className="mb-1 block text-sm font-semibold text-foreground" htmlFor="new-entry-artist">
                            Artist
                        </label>
                        <Input
                            id="new-entry-artist"
                            value={artistName}
                            onChange={(e) => setArtistName(e.target.value)}
                            placeholder="e.g. Sarah Rose, Maggie Bennett"
                            maxLength={100}
                        />
                    </div>
                    <div className="mb-6">
                        <label
                            className="mb-1 block text-sm font-semibold text-foreground"
                            htmlFor="new-entry-manufacturer"
                        >
                            Manufacturer / casting company{" "}
                            <span className="font-normal text-muted-foreground">(optional)</span>
                        </label>
                        <Input
                            id="new-entry-manufacturer"
                            value={manufacturer}
                            onChange={(e) => setManufacturer(e.target.value)}
                            placeholder="e.g. Resins by Randy — leave blank if the artist casts their own"
                            maxLength={100}
                        />
                    </div>
                </>
            ) : (
                <>
                    <div className="mb-6">
                        <label className="mb-1 block text-sm font-semibold text-foreground" htmlFor="new-entry-maker">
                            Manufacturer
                        </label>
                        <select
                            id="new-entry-maker"
                            className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
                            value={maker}
                            onChange={(e) => {
                                setMaker(e.target.value);
                                unlinkMold();
                            }}
                        >
                            <option value="">— Select —</option>
                            {MAKERS.map((m) => (
                                <option key={m} value={m}>
                                    {m}
                                </option>
                            ))}
                        </select>
                        {maker === "Other" && (
                            <Input
                                className="mt-2"
                                value={customMaker}
                                onChange={(e) => setCustomMaker(e.target.value)}
                                placeholder="Enter manufacturer name"
                                maxLength={100}
                            />
                        )}
                    </div>

                    {/* Sculptor — credit, not maker. Separated after the North Light
     incident: factory pieces have a company maker AND a named
     sculpting artist; one field forced contributors to choose. */}
                    <div className="mb-6">
                        <label
                            className="mb-1 block text-sm font-semibold text-foreground"
                            htmlFor="new-entry-sculptor"
                        >
                            Sculptor <span className="font-normal text-muted-foreground">(optional)</span>
                        </label>
                        <Input
                            id="new-entry-sculptor"
                            value={sculptor}
                            onChange={(e) => setSculptor(e.target.value)}
                            placeholder="e.g. Guy Pocock, Kathleen Moody"
                            maxLength={100}
                        />
                        <p className="mt-1 mb-0 text-xs text-muted-foreground">
                            Manufacturer is the company or brand (Breyer, North Light). Sculptor is the artist who
                            sculpted it — worth crediting even on factory pieces.
                        </p>
                    </div>

                    {/* Run type + pieces made — factory-only. A one-off artist resin
     has no release channel and no run size, so these never render
     for the artist-attributed categories above. */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="mb-6">
                            <label
                                className="mb-1 block text-sm font-semibold text-foreground"
                                htmlFor="new-entry-run-type"
                            >
                                Run <span className="font-normal text-muted-foreground">(optional)</span>
                            </label>
                            <select
                                id="new-entry-run-type"
                                className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
                                value={runType}
                                onChange={(e) => setRunType(e.target.value)}
                            >
                                <option value="">— Select —</option>
                                {RUN_TYPES.map((r) => (
                                    <option key={r} value={r}>
                                        {r}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="mb-6">
                            <label
                                className="mb-1 block text-sm font-semibold text-foreground"
                                htmlFor="new-entry-run-count"
                            >
                                Pieces made <span className="font-normal text-muted-foreground">(optional)</span>
                            </label>
                            <Input
                                id="new-entry-run-count"
                                type="number"
                                inputMode="numeric"
                                value={runCount}
                                onChange={(e) => setRunCount(e.target.value)}
                                placeholder="e.g. 2500"
                                min={1}
                            />
                            <p className="mt-1 text-xs text-muted-foreground">
                                Whole number only, if the run size is documented.
                            </p>
                        </div>
                    </div>
                </>
            )}

            {/* Two-column row: Scale + Color */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="mb-6">
                    <label className="mb-1 block text-sm font-semibold text-foreground" htmlFor="new-entry-scale">
                        Scale
                    </label>
                    <select
                        id="new-entry-scale"
                        className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
                        value={scale}
                        onChange={(e) => {
                            setScale(e.target.value);
                            unlinkMold();
                        }}
                    >
                        <option value="">— Select —</option>
                        {CANONICAL_SCALES.map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="mb-6">
                    <label className="mb-1 block text-sm font-semibold text-foreground" htmlFor="new-entry-color">
                        Color
                    </label>
                    <Input
                        id="new-entry-color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        placeholder="e.g. Bay, Palomino"
                        maxLength={100}
                    />
                </div>
            </div>

            {/* Two-column row: Mold + Year */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* For a mold entry the title IS the mold name, so this field would
     ask for the same thing twice; it is the release's parent only. */}
                {itemType !== "plastic_mold" && (
                    <div className="mb-6">
                        <label className="mb-1 block text-sm font-semibold text-foreground" htmlFor="new-entry-mold">
                            Belongs to mold
                        </label>
                        <Input
                            id="new-entry-mold"
                            value={moldName}
                            onChange={(e) => onMoldInput(e.target.value)}
                            onKeyDown={onMoldKey}
                            onBlur={() => window.setTimeout(closeMoldList, 150)}
                            placeholder="e.g. Family Arabian Stallion"
                            maxLength={200}
                            autoComplete="off"
                            role={picksMold ? "combobox" : undefined}
                            aria-autocomplete={picksMold ? "list" : undefined}
                            aria-expanded={picksMold ? moldChoices.length > 0 : undefined}
                            aria-controls={picksMold ? "new-entry-mold-list" : undefined}
                            aria-activedescendant={activeMold >= 0 ? `new-entry-mold-${activeMold}` : undefined}
                            aria-describedby="new-entry-mold-help"
                        />
                        {picksMold && moldChoices.length > 0 && !moldId && (
                            <ul
                                id="new-entry-mold-list"
                                role="listbox"
                                aria-label="Molds in the Registry"
                                className="m-0 mt-1 list-none rounded-md border border-input bg-card p-1 shadow-sm"
                            >
                                {moldChoices.map((m, i) => (
                                    <li
                                        key={m.id}
                                        id={`new-entry-mold-${i}`}
                                        role="option"
                                        aria-selected={i === activeMold}
                                        className={`cursor-pointer rounded px-2 py-1.5 text-left text-sm hover:bg-muted ${i === activeMold ? "bg-muted" : ""}`}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            chooseMold(m);
                                        }}
                                    >
                                        <span className="font-semibold text-foreground">{m.title}</span>
                                        <span className="text-muted-foreground">
                                            {" "}
                                            · {m.maker}
                                            {m.scale ? ` · ${m.scale}` : ""}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <p
                            id="new-entry-mold-help"
                            aria-live="polite"
                            className="m-0 mt-1 text-xs text-muted-foreground"
                        >
                            {moldId
                                ? "Linked to this mold in the Registry."
                                : picksMold
                                  ? "The sculpture this release was made on, if you know it. Pick it from the list when it appears."
                                  : "The sculpture this piece was made on, if you know it."}
                        </p>
                    </div>
                )}
                {itemType !== "plastic_mold" && !ARTIST_ATTRIBUTED_CATEGORIES.has(itemType) && (
                    <div className="mb-6">
                        <label
                            className="mb-1 block text-sm font-semibold text-foreground"
                            htmlFor="new-entry-model-number"
                        >
                            Model number
                        </label>
                        <Input
                            id="new-entry-model-number"
                            value={modelNumber}
                            onChange={(e) => setModelNumber(e.target.value)}
                            placeholder="e.g. 5022"
                            maxLength={40}
                        />
                        <p className="m-0 mt-1 text-xs text-muted-foreground">
                            The maker&apos;s catalogue number, without the #. Leave it out of the name.
                        </p>
                    </div>
                )}
                <div className="mb-6">
                    <label className="mb-1 block text-sm font-semibold text-foreground" htmlFor="new-entry-year">
                        First year
                    </label>
                    <Input
                        id="new-entry-year"
                        type="number"
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        placeholder="e.g. 1995"
                        min={1900}
                        max={2100}
                    />
                </div>
                <div className="mb-6">
                    <label className="mb-1 block text-sm font-semibold text-foreground" htmlFor="new-entry-year-end">
                        Last year <span className="font-normal text-muted-foreground">(if it ended)</span>
                    </label>
                    <Input
                        id="new-entry-year-end"
                        type="number"
                        value={yearEnd}
                        onChange={(e) => setYearEnd(e.target.value)}
                        placeholder="e.g. 1997"
                        min={1900}
                        max={2100}
                    />
                    <p className="m-0 mt-1 text-xs text-muted-foreground">
                        Leave it empty for a release still made, or made for one year only.
                    </p>
                </div>
                <div className="mb-6">
                    <label className="mb-1 block text-sm font-semibold text-foreground" htmlFor="new-entry-retail">
                        Original retail price (USD)
                    </label>
                    <Input
                        id="new-entry-retail"
                        type="text"
                        inputMode="decimal"
                        value={retailPrice}
                        onChange={(e) => setRetailPrice(e.target.value)}
                        placeholder="e.g. 59.99"
                        maxLength={9}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                        What it sold for new, if you know it — shown beside today&apos;s Blue Book range.
                    </p>
                </div>
            </div>

            {/* Material */}
            <div className="mb-6 sm:w-1/2 sm:pr-2">
                <label className="mb-1 block text-sm font-semibold text-foreground" htmlFor="new-entry-material">
                    Material
                </label>
                <select
                    id="new-entry-material"
                    className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                >
                    <option value="">— Select —</option>
                    {MATERIAL_OPTIONS.map((m) => (
                        <option key={m} value={m}>
                            {m}
                        </option>
                    ))}
                </select>
            </div>

            {/* Breed + gender — what the model DEPICTS, so they apply to any
     horse entry but never to tack. Gender reuses GENDER_GROUPS (the
     horse forms' vocabulary, longears terms included) so a catalog
     row and a user's horse can't disagree about "Jenny". Breed is
     free text: the codebase has no breed vocabulary to reuse and
     inventing a closed list would lock out real breeds. */}
            {itemType !== "tack" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="mb-6">
                        <label className="mb-1 block text-sm font-semibold text-foreground" htmlFor="new-entry-breed">
                            Breed <span className="font-normal text-muted-foreground">(optional)</span>
                        </label>
                        <Input
                            id="new-entry-breed"
                            value={breed}
                            onChange={(e) => setBreed(e.target.value)}
                            placeholder="e.g. Andalusian, Arabian, Quarter Horse"
                            maxLength={100}
                        />
                    </div>
                    <div className="mb-6">
                        <label className="mb-1 block text-sm font-semibold text-foreground" htmlFor="new-entry-gender">
                            Gender <span className="font-normal text-muted-foreground">(optional)</span>
                        </label>
                        <select
                            id="new-entry-gender"
                            className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
                            value={gender}
                            onChange={(e) => setGender(e.target.value)}
                        >
                            <option value="">— Select —</option>
                            {GENDER_GROUPS.map((g) => (
                                <optgroup key={g.label} label={g.label}>
                                    {g.options.map((o) => (
                                        <option key={o} value={o}>
                                            {o}
                                        </option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {/* Reason */}
            <div className="mb-6">
                <label className="mb-1 block text-sm font-semibold text-foreground" htmlFor="new-entry-reason">
                    Reason / Evidence *
                </label>
                <Textarea
                    id="new-entry-reason"
                    className="min-h-[72px] resize-y"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="Explain why this entry should be added. Include sources if available (e.g. 'Listed in the 2019 Breyer dealer catalog, page 12')."
                />
                <span className="mt-1 block text-right text-xs text-muted-foreground">{reason.length}/2000</span>
            </div>

            {error && (
                <p className="mt-2 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                    {error}
                </p>
            )}

            {numberConflict && (
                <div
                    className="mb-4 rounded-lg border border-input bg-muted/50 p-4"
                    role="alert"
                    data-testid="new-entry-number-conflict"
                >
                    <p className="m-0 mb-1 text-sm font-semibold">
                        {titleNumberProblem(numberConflict.inTitle, numberConflict.inBox)}
                    </p>
                    <p className="m-0 mb-3 text-xs text-muted-foreground">
                        The number goes in its own box; the name keeps just “{numberConflict.title}”.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {[numberConflict.inTitle, numberConflict.inBox].map((n) => (
                            <Button
                                key={n}
                                variant="outline"
                                size="sm"
                                disabled={isPending}
                                onClick={() => {
                                    const chosen = { title: numberConflict.title, model: n };
                                    setTitle(chosen.title);
                                    setModelNumber(chosen.model);
                                    handleSubmit(duplicates !== null, chosen);
                                }}
                            >
                                It&apos;s #{n}
                            </Button>
                        ))}
                    </div>
                </div>
            )}

            {/* Actions */}
            {duplicates && (
                <div className="mb-4 rounded-lg border border-input bg-muted/50 p-4" role="alert">
                    <p className="m-0 mb-2 text-sm font-semibold">
                        Is one of these already it? The catalog has similar entries:
                    </p>
                    <ul className="m-0 mb-3 flex list-none flex-col gap-1 p-0">
                        {duplicates.map((d) => (
                            <li key={d.id} className="text-sm">
                                <a
                                    href={`/catalog/${d.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-medium text-forest hover:underline"
                                >
                                    {d.title}
                                </a>{" "}
                                <span className="text-muted-foreground">— {d.maker ?? "unknown maker"}</span>
                            </li>
                        ))}
                    </ul>
                    <p className="m-0 text-xs text-muted-foreground">
                        If your model is one of these, link it from the search instead of suggesting a duplicate. If it
                        really is new, submit anyway.
                    </p>
                </div>
            )}
            <div className="flex justify-end gap-4">
                <Button variant="outline" size="wide" onClick={handleCancel} disabled={isPending}>
                    Cancel
                </Button>
                <Button
                    onClick={() => handleSubmit(duplicates !== null)}
                    disabled={isPending || !title.trim() || !reason.trim()}
                >
                    {isPending ? "Submitting…" : duplicates ? "It's new — submit anyway" : "📗 Submit Suggestion"}
                </Button>
            </div>
        </div>
    );
}
