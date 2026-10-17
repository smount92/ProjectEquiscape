/**
 * The fields a member may correct on a catalog entry.
 *
 * WHY THIS MODULE EXISTS. The correction form used to build its field list
 * from `Object.entries(attributes).filter(v != null)` — so it offered only
 * the fields that were ALREADY FILLED. Look at a row with no year, no
 * colour and no run type and the form gave you Title, Maker, Scale and
 * nothing else. There was no way to add a missing value at all.
 *
 * That one filter shaped the whole contribution pattern: of 51 suggestions
 * ever received, 45 were whole new entries and only 6 were corrections —
 * because the addition form offered 17 fields and the correction form
 * offered 3. It is also why `breed` and `gender` sit on 0 of 10,945 rows
 * despite both being built, validated and shipped: they were only ever
 * reachable by creating a new entry.
 *
 * The catalog's defect is EMPTINESS, not wrongness — no colour on 4,988
 * rows, no year on 3,589 — and emptiness was the one thing members could
 * not fix.
 *
 * Pure data plus one pure function, so both forms read the same list and
 * the vocabularies cannot drift apart.
 */

import {
    CANONICAL_SCALES,
    CATALOG_CATEGORIES,
    CATALOG_GENDERS,
    CATEGORY_LABELS,
    RUN_TYPES,
} from "@/lib/catalog/taxonomy";
import { referenceHref } from "@/lib/catalog/referenceUrl";

export type FieldKind = "text" | "textarea" | "select" | "number";

export interface EditableField {
    key: string;
    label: string;
    kind: FieldKind;
    /** Present for `select`. The empty option is added by the renderer. */
    options?: readonly string[];
    /** Shown under the input. Keep it about the VALUE, not the mechanics. */
    help?: string;
    placeholder?: string;
}

/**
 * Material's single vocabulary — the new-entry form, the correction
 * form and the silver-auto validator all read this list, so a change
 * here IS the change everywhere. Stored values must match these
 * strings exactly; renaming an option means migrating the rows that
 * carry the old spelling.
 *
 * "China/Ceramic" and "Rubber/PVC/Vinyl" per MHI (2026-08-29): the
 * ceramic family goes by both names, and the play-brand makes
 * (CollectA, Schleich, Safari, Pabo, Julip) are vinyl/PVC — a class
 * the hobby treats as distinct from Breyer's cellulose acetate.
 */
export const MATERIAL_OPTIONS = [
    "Plastic",
    "Rubber/PVC/Vinyl",
    "Resin",
    "Pewter",
    "China/Ceramic",
    "Metal",
    "Other",
] as const;

/**
 * The curated set, in the order a person would fill them in: what it is,
 * then when, then how many, then the details.
 *
 * Ordering is deliberate. A member who opens this and sees `cast_medium`
 * above `color_description` concludes the form is for someone else.
 */
export const CATALOG_EDITABLE_FIELDS: readonly EditableField[] = [
    { key: "title", label: "Name", kind: "text", help: "The model's name as the maker released it." },
    { key: "maker", label: "Maker", kind: "text", help: "Breyer, Peter Stone, North Light, or the artist's name." },
    { key: "item_type", label: "Type", kind: "select", options: CATALOG_CATEGORIES.map((c) => c.value) },
    { key: "scale", label: "Scale", kind: "select", options: CANONICAL_SCALES },
    {
        key: "model_number",
        label: "Model number",
        kind: "text",
        placeholder: "e.g. 712053",
        help: "The maker's own number. The single most useful field for identifying a model.",
    },
    {
        key: "color_description",
        label: "Colour and markings",
        kind: "textarea",
        placeholder: "Bay pinto, blaze, four stockings",
        help: "Base colour first, then markings. Plain hobby terms.",
    },
    { key: "release_year_start", label: "First released", kind: "number", placeholder: "1998" },
    {
        key: "release_year_end",
        label: "Last released",
        kind: "number",
        placeholder: "2004",
        help: "Leave blank if it was a single year.",
    },
    { key: "run_type", label: "Run type", kind: "select", options: RUN_TYPES },
    { key: "run_count", label: "Pieces made", kind: "number", placeholder: "1500" },
    {
        key: "retail_price",
        label: "Original retail price",
        kind: "text",
        placeholder: "59.99",
        help: "What it cost new, in US dollars. Not what it sells for now.",
    },
    { key: "material", label: "Material", kind: "select", options: MATERIAL_OPTIONS },
    { key: "mold_name", label: "Mold", kind: "text", help: "The sculpture this paint job was applied to." },
    { key: "sculptor", label: "Sculptor", kind: "text", help: "Who sculpted the mold." },
    {
        key: "breed",
        label: "Breed",
        kind: "text",
        help: "Free text on purpose — there is no closed breed list good enough to lock you into.",
    },
    { key: "gender", label: "Gender", kind: "select", options: CATALOG_GENDERS },
    // The annotated-registry field: stories live here, facts live in the
    // fields above. Deliberately NOT in SILVER_AUTO_FIELDS — prose is
    // always reviewed by a human before it goes live.
    {
        key: "registry_notes",
        label: "Registry notes",
        kind: "textarea",
        placeholder: "Identification tips, variations lore, the story of this model…",
        help: "A few short paragraphs in your own words. Facts like years and numbers belong in the fields above — this is for the knowledge that doesn't fit a field.",
    },
];

/**
 * Pipeline plumbing rather than catalog fact. The reference page hides
 * these, so offering them invites corrections nobody can ever see.
 */
export const HIDDEN_ATTRIBUTES: ReadonlySet<string> = new Set(["source", "source_id", "source_note"]);

export interface FieldEdit {
    key: string;
    label: string;
    kind: FieldKind;
    options?: readonly string[];
    help?: string;
    placeholder?: string;
    original: string;
    current: string;
    /** True when the entry has no value yet — the form says "add" not "fix". */
    isEmpty: boolean;
}

export interface EditableSource {
    title: string;
    maker: string | null;
    scale: string | null;
    item_type?: string | null;
    attributes?: Record<string, unknown> | null;
}

const REAL_COLUMN_KEYS = new Set(["title", "maker", "scale", "item_type"]);

function valueFor(item: EditableSource, key: string): string {
    if (key === "title") return item.title ?? "";
    if (key === "maker") return item.maker ?? "";
    if (key === "scale") return item.scale ?? "";
    if (key === "item_type") return item.item_type ?? "";
    const v = (item.attributes ?? {})[key];
    return v == null ? "" : String(v);
}

/**
 * Every field a member may edit on this entry: the whole curated set
 * whether filled or not, PLUS any other attribute the row already
 * carries, so nothing that exists silently becomes uneditable.
 */
export function buildEditableFields(item: EditableSource): FieldEdit[] {
    // A mold IS its name: asking a mold entry for "Mold" would ask for the
    // same thing twice (a member hit exactly that, 2026-10-12). The field
    // belongs to releases, where it names the parent sculpture.
    const curated = CATALOG_EDITABLE_FIELDS.filter(
        (f) => !(f.key === "mold_name" && item.item_type === "plastic_mold"),
    ).map((f) => {
        const value = valueFor(item, f.key);
        return { ...f, original: value, current: value, isEmpty: value === "" };
    });

    const known = new Set(CATALOG_EDITABLE_FIELDS.map((f) => f.key));
    const extras: FieldEdit[] = Object.entries(item.attributes ?? {})
        .filter(([k, v]) => !known.has(k) && !HIDDEN_ATTRIBUTES.has(k) && v != null && v !== "")
        .map(([k, v]) => ({
            key: k,
            label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            kind: "text" as const,
            original: String(v),
            current: String(v),
            isEmpty: false,
        }));

    return [...curated, ...extras];
}

/**
 * What actually gets submitted. A field the member left blank and that was
 * already blank is NOT a change — without this, opening the form and
 * closing it would propose emptying every unfilled field on the row.
 */
export function changedFields(fields: FieldEdit[]): FieldEdit[] {
    return fields.filter((f) => f.current.trim() !== f.original.trim());
}

/** Which curated fields this entry is still missing — drives the nudge. */
export function missingFieldLabels(item: EditableSource): string[] {
    return (
        CATALOG_EDITABLE_FIELDS
            // Scale has its own prompt in the Details table (ruling Q26), so it is
            // not asked for twice.
            .filter((f) => !REAL_COLUMN_KEYS.has(f.key) && valueFor(item, f.key) === "")
            .map((f) => f.label)
    );
}

/** The label a member reads for a catalog field key ("color_description" → "Colour and markings"). */
export function fieldLabel(key: string): string {
    const f = CATALOG_EDITABLE_FIELDS.find((x) => x.key === key);
    if (f) return f.label;
    const t = key.replace(/_/g, " ");
    return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * A changelog line with raw field keys swapped for their labels, so
 * "Correction: color_description: dun → Black" reads "Colour and
 * markings: dun → Black". Applied at display time, so older rows read
 * the same as new ones.
 */
export function humanizeChangeSummary(summary: string): string {
    return summary.replace(
        /(^|[\s,:])([a-z]+(?:_[a-z]+)+|title|maker|scale|material|breed|gender|sculptor)(?=:\s)/g,
        (_m, pre: string, key: string) => `${pre}${fieldLabel(key)}`,
    );
}

// ── The Registry Desk's field list ────────────────────────────────────
//
// The moderators' editor shows EVERY field on a row (owner, 2026-10-16):
// the real columns, the curated facts, any other attribute the row
// carries, the import plumbing (folded away) and the record's own facts
// (read-only). The member list above is deliberately left alone: it is
// what the correction form offers, and the Desk is not that form.

/** "list": several values typed as comma-separated words ("Leather, Brass"). */
export type DeskFieldKind = FieldKind | "mold" | "list";

export type DeskFieldGroup = "identity" | "release" | "sculpture" | "notes" | "import" | "extras" | "record";

/** The order the editor lays groups out in. */
export const DESK_GROUP_ORDER: readonly DeskFieldGroup[] = [
    "identity",
    "release",
    "sculpture",
    "notes",
    "extras",
    "import",
    "record",
];

export const DESK_GROUP_LABELS: Record<DeskFieldGroup, string> = {
    identity: "What it is",
    release: "Release facts",
    sculpture: "Sculpture and breed",
    notes: "Notes",
    extras: "Everything else",
    import: "Import details",
    record: "The record",
};

export interface DeskFieldDef {
    key: string;
    label: string;
    kind: DeskFieldKind;
    group: DeskFieldGroup;
    /** "release" means every row that is not a mold (releases, resins, tack ...). */
    appliesTo: "release" | "mold" | "all";
    /**
     * Shown by default only on these kinds of entry (resin, tack, props ...);
     * on any other row only when it carries a value, or is added.
     */
    itemTypes?: readonly string[];
    options?: readonly string[];
    /** Words shown for an option value (item types are stored as keys). */
    optionLabels?: Record<string, string>;
    help?: string;
    placeholder?: string;
    readOnly?: boolean;
    /** Shown folded away until opened. */
    collapsed?: boolean;
}

export interface DeskFieldEdit extends DeskFieldDef {
    /** The stored value as text ("" when empty; a list as "a, b"). */
    original: string;
    /** What to show instead of the raw value (a mold's title for its id). */
    display?: string;
    /**
     * A year stored as text ("1975" in quotes, from the March import). It
     * counts as a change once touched (or with any other change), so saving
     * stores it as a number.
     */
    storedAsText?: boolean;
}

/** A catalog row as the Desk reads it: every column. */
export interface DeskSource extends EditableSource {
    id: string;
    item_type: string;
    parent_id: string | null;
    artist: string | null;
    manufacturer: string | null;
    maker_slug: string | null;
    slug: string | null;
    created_at: string;
    updated_at: string;
}

function member(key: string, over: Partial<DeskFieldDef> & Pick<DeskFieldDef, "group" | "appliesTo">): DeskFieldDef {
    const f = CATALOG_EDITABLE_FIELDS.find((x) => x.key === key);
    if (!f) throw new Error(`No member field ${key}`);
    return {
        key: f.key,
        label: f.label,
        kind: f.kind,
        options: f.options,
        help: f.help,
        placeholder: f.placeholder,
        ...over,
    };
}

const IMPORT_LABELS: Record<string, string> = {
    source: "Where it came from",
    source_id: "Its number there",
    source_note: "Import note",
};

const RESIN = ["artist_resin", "factory_resin"] as const;

/** A field kept on resins, tack, props and scenes: under "Everything else", shown by default on its kinds. */
function kindField(
    key: string,
    label: string,
    itemTypes: readonly string[],
    over: Partial<DeskFieldDef> = {},
): DeskFieldDef {
    return { key, label, kind: "text", group: "extras", appliesTo: "all", itemTypes, ...over };
}

/**
 * The attribute keys resins, tack, props and dioramas carry (write.ts
 * knows them all). Each shows by default on its own kinds of entry; on any
 * other row it shows when filled, or through "Add a field".
 */
const KIND_FIELDS: readonly DeskFieldDef[] = [
    kindField("cast_medium", "Cast in", RESIN, { placeholder: "Resin, pewter, bronze" }),
    kindField("edition_size", "Edition size", RESIN, { placeholder: "50" }),
    kindField("finish", "Finish", RESIN, { placeholder: "Unpainted, painted by the artist" }),
    kindField("finish_type", "Finish type", RESIN),
    kindField("coa", "Certificate of authenticity", RESIN, { help: "Whether it came with one, and from whom." }),
    kindField("auction_sale_price", "Auction sale price", RESIN, { placeholder: "450" }),
    kindField("species", "Species", [...RESIN, "china"], { placeholder: "Horse, donkey, dog" }),
    kindField("tack_type", "Tack type", ["tack"], { placeholder: "Saddle, bridle, halter" }),
    kindField("discipline", "Discipline", ["tack", "diorama"], { placeholder: "Western, English, driving" }),
    kindField("materials", "Materials", ["tack", "prop"], {
        kind: "list",
        placeholder: "Leather, brass, fabric",
        help: "Separate them with commas.",
    }),
    kindField("working_parts", "Working parts", ["tack"], {
        kind: "list",
        placeholder: "Buckles, sliding bit",
        help: "Separate them with commas.",
    }),
    kindField("fits_molds", "Fits molds", ["tack"], { placeholder: "Traditional Breyer, Stone ISH" }),
    kindField("prop_category", "Prop category", ["prop"], { placeholder: "Fence, jump, barn" }),
    kindField("dimensions", "Dimensions", ["prop"], { placeholder: '6" x 4" x 3"' }),
    kindField("terrain_setting", "Terrain or setting", ["prop"]),
    kindField("scene_theme", "Scene theme", ["diorama"]),
    kindField("components", "Components", ["diorama"], {
        kind: "textarea",
        placeholder: "Models, tack, props and figures in the scene",
    }),
    kindField("base_dimensions", "Base dimensions", ["diorama"]),
    kindField("documentation_notes", "Documentation notes", ["diorama"], {
        kind: "textarea",
        help: "Reference photos, sources, the story behind the scene.",
    }),
];

export const DESK_FIELDS: readonly DeskFieldDef[] = [
    // What it is
    member("title", { group: "identity", appliesTo: "all" }),
    member("item_type", {
        group: "identity",
        appliesTo: "all",
        optionLabels: CATEGORY_LABELS,
        help: "Mold, release, artist resin and the rest.",
    }),
    member("maker", { group: "identity", appliesTo: "all" }),
    {
        key: "artist",
        label: "Artist",
        kind: "text",
        group: "identity",
        appliesTo: "all",
        help: "The person who sculpted or painted it, for artist pieces.",
    },
    {
        key: "manufacturer",
        label: "Manufacturer",
        kind: "text",
        group: "identity",
        appliesTo: "all",
        help: "The company that made it: Breyer, Peter Stone, Hagen-Renaker ...",
    },
    {
        key: "parent_id",
        label: "Filed under mold",
        kind: "mold",
        group: "identity",
        appliesTo: "release",
        help: "Re-file it under another mold. Its scale follows the mold, and every horse stays linked.",
    },
    member("scale", { group: "identity", appliesTo: "all" }),

    // Release facts
    member("model_number", { group: "release", appliesTo: "release" }),
    member("color_description", { group: "release", appliesTo: "release" }),
    member("release_year_start", { group: "release", appliesTo: "release", label: "First year" }),
    member("release_year_end", { group: "release", appliesTo: "release", label: "Last year" }),
    member("run_type", { group: "release", appliesTo: "release" }),
    {
        key: "run_detail",
        label: "Run details",
        kind: "text",
        group: "release",
        appliesTo: "release",
        placeholder: "Sears Holiday Catalog, 1998",
        help: "Where it was sold or how it was given out, in the maker's or the shop's words.",
    },
    member("run_count", { group: "release", appliesTo: "release" }),
    member("retail_price", { group: "release", appliesTo: "release" }),
    {
        key: "set_name",
        label: "Set",
        kind: "text",
        group: "release",
        appliesTo: "release",
        placeholder: "12-Piece Stablemates Set",
        help: "The gift set or assortment this piece came in.",
    },
    member("mold_name", { group: "release", appliesTo: "release" }),
    member("material", { group: "release", appliesTo: "release" }),

    // Sculpture and breed
    member("sculptor", { group: "sculpture", appliesTo: "all" }),
    member("release_year_start", {
        group: "sculpture",
        appliesTo: "mold",
        label: "First made",
        help: "The year the mold first appeared.",
    }),
    member("breed", { group: "sculpture", appliesTo: "all" }),
    member("gender", { group: "sculpture", appliesTo: "all" }),
    member("material", { group: "sculpture", appliesTo: "mold" }),

    // Notes
    member("registry_notes", { group: "notes", appliesTo: "all" }),

    // Resin, tack, props and scenes (under Everything else).
    ...KIND_FIELDS,

    // Import details: plumbing, folded away but still editable.
    ...[...HIDDEN_ATTRIBUTES].map(
        (key): DeskFieldDef => ({
            key,
            label: IMPORT_LABELS[key] ?? key.replace(/_/g, " "),
            kind: "text",
            group: "import",
            appliesTo: "all",
            collapsed: true,
        }),
    ),

    // The record: facts about the row itself.
    { key: "id", label: "Record number", kind: "text", group: "record", appliesTo: "all", readOnly: true },
    { key: "page_address", label: "Page address", kind: "text", group: "record", appliesTo: "all", readOnly: true },
    { key: "created_at", label: "Added", kind: "text", group: "record", appliesTo: "all", readOnly: true },
    { key: "updated_at", label: "Last changed", kind: "text", group: "record", appliesTo: "all", readOnly: true },
];

/** Keys that are columns on catalog_items rather than attributes. */
const DESK_COLUMN_KEYS = new Set(["title", "item_type", "maker", "artist", "manufacturer", "parent_id", "scale"]);
const DESK_RECORD_KEYS = new Set(["id", "page_address", "created_at", "updated_at"]);

function deskValue(item: DeskSource, key: string): unknown {
    if (key === "page_address") return referenceHref(item);
    if (DESK_COLUMN_KEYS.has(key) || DESK_RECORD_KEYS.has(key)) {
        return (item as unknown as Record<string, unknown>)[key];
    }
    return (item.attributes ?? {})[key];
}

/** A list shows as "a, b"; another nested value as its JSON; anything else as its text. */
const asText = (v: unknown): string =>
    v == null
        ? ""
        : Array.isArray(v)
          ? v.map((x) => (x == null ? "" : typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ")
          : typeof v === "object"
            ? JSON.stringify(v)
            : String(v);

function labelForKey(key: string): string {
    return key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** A list typed into one box: "Leather, brass ," → ["Leather", "brass"]. */
export function splitList(text: string): string[] {
    return text
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s !== "");
}

const YEAR_KEYS = new Set(["release_year_start", "release_year_end"]);

/**
 * The attribute keys that may hold a list (the engine's listAttributeKeys:
 * these four, plus any Desk field of kind "list"). Every other value is
 * text, so a list stored anywhere else is edited and saved as one line.
 */
const LIST_KEYS: ReadonlySet<string> = new Set(["components", "fits_molds", "materials", "working_parts"]);

/** The editor's field for a key no box shows yet (from "Add a field"). */
export function deskFieldFor(key: string): DeskFieldEdit {
    const def = DESK_FIELDS.find((f) => f.key === key && !f.readOnly);
    const base: DeskFieldDef = def
        ? { ...def, group: def.group === "record" ? "extras" : def.group }
        : { key, label: deskFieldLabel(key), kind: "text", group: "extras", appliesTo: "all" };
    return { ...base, original: "" };
}

/**
 * Every field on this row for the Desk editor, in group order: the fields
 * that apply to its kind (mold or not, and the resin, tack and prop keys on
 * those kinds) whether filled or not, any other known field the row
 * happens to carry a value for, every other attribute under "Everything
 * else", the import details and the record's facts. Each key appears once.
 * `added` are keys the moderator added with "Add a field".
 */
export function buildDeskFields(
    item: DeskSource,
    ctx: { parentTitle?: string | null; added?: readonly string[] } = {},
): DeskFieldEdit[] {
    const isMold = item.item_type === "plastic_mold";
    const attrs = item.attributes ?? {};
    const fits = (f: DeskFieldDef) =>
        (f.appliesTo === "all" || f.appliesTo === (isMold ? "mold" : "release")) &&
        (!f.itemTypes || f.itemTypes.includes(item.item_type));
    const filled = (key: string) => asText(deskValue(item, key)) !== "";

    const seen = new Set<string>();
    const out: DeskFieldEdit[] = [];
    const take = (f: DeskFieldDef) => {
        if (seen.has(f.key)) return;
        seen.add(f.key);
        const value = deskValue(item, f.key);
        const edit: DeskFieldEdit = { ...f, original: asText(value) };
        if (f.key === "parent_id" && value) edit.display = ctx.parentTitle ?? undefined;
        if (f.key === "item_type" && typeof value === "string") edit.display = CATEGORY_LABELS[value] ?? value;
        // A list stored under a list key edits as one; anywhere else the
        // Registry keeps text, so it edits (and saves) as one line.
        if (Array.isArray(value) && !f.readOnly && f.kind !== "mold" && LIST_KEYS.has(f.key)) edit.kind = "list";
        if (YEAR_KEYS.has(f.key) && typeof value === "string" && value.trim() !== "") edit.storedAsText = true;
        out.push(edit);
    };

    // Fields for this kind of row first, then known fields it carries anyway.
    for (const f of DESK_FIELDS) if (fits(f)) take(f);
    for (const f of DESK_FIELDS) if (!fits(f) && filled(f.key)) take(f);

    // Everything else the row carries.
    for (const [key, v] of Object.entries(attrs)) {
        if (seen.has(key) || v == null || v === "") continue;
        const isList = Array.isArray(v);
        const nested = typeof v === "object" && !isList;
        const listKey = isList && LIST_KEYS.has(key);
        take({
            key,
            label: labelForKey(key),
            kind: listKey ? "list" : "text",
            group: "extras",
            appliesTo: "all",
            readOnly: nested,
            help: listKey
                ? "Separate the values with commas."
                : isList
                  ? "Stored as a list; a change is saved as one line of text."
                  : nested
                    ? "A value with parts of its own, shown as stored."
                    : undefined,
        });
    }

    // Fields added with "Add a field", empty until typed into.
    for (const key of ctx.added ?? []) {
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(deskFieldFor(key));
    }

    const rank = (g: DeskFieldGroup) => DESK_GROUP_ORDER.indexOf(g);
    // Stable sort keeps the registry order inside each group.
    return out
        .map((f, i) => ({ f, i }))
        .sort((a, b) => rank(a.f.group) - rank(b.f.group) || a.i - b.i)
        .map((x) => x.f);
}

/** Keys no box can add: the real columns (each has its own box) and the record's facts. */
const NOT_ADDABLE = new Set([
    ...DESK_COLUMN_KEYS,
    ...DESK_RECORD_KEYS,
    "slug",
    "maker_slug",
    "sort_key",
    "search_key",
    "attributes",
]);

/**
 * "Add a field": every key the Registry keeps (write.ts knownAttributeKeys,
 * handed to the browser by the Desk's actions) that this row's editor
 * doesn't show yet, with the words a person reads, A to Z.
 */
export function addableFields(
    shown: readonly { key: string }[],
    known: Iterable<string>,
): { key: string; label: string }[] {
    const have = new Set(shown.map((f) => f.key));
    return [...new Set(known)]
        .filter((k) => !have.has(k) && !NOT_ADDABLE.has(k))
        .map((key) => ({ key, label: deskFieldLabel(key) }))
        .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * What a save sends: each editable field whose box differs from what is
 * stored, trimmed. An emptied box is sent as "" (the writer clears it). A
 * list is sent as its values. A year stored as text is sent once its box
 * is touched (a suggested fix fills it the same), or along with any other
 * change, so the save stores it as a number.
 */
export function deskChanges(fields: DeskFieldEdit[], draft: Record<string, string>): Record<string, string | string[]> {
    const changes: Record<string, string | string[]> = {};
    const value = (f: DeskFieldEdit, text: string): string | string[] =>
        f.kind === "list" && text !== "" ? splitList(text) : text;
    for (const f of fields) {
        if (f.readOnly || !(f.key in draft)) continue;
        const next = (draft[f.key] ?? "").trim();
        const same =
            f.kind === "list"
                ? splitList(next).join(", ") === splitList(f.original).join(", ")
                : next === f.original.trim();
        if (!same || (f.storedAsText && next !== "")) changes[f.key] = value(f, next);
    }
    if (Object.keys(changes).length > 0) {
        // Only a plain year rides along: "1975-1988" as text waits for a person.
        for (const f of fields) {
            const year = f.original.trim();
            if (f.storedAsText && !(f.key in draft) && /^\d{4}$/.test(year)) changes[f.key] = year;
        }
    }
    return changes;
}

/** The Desk's label for a field key ("run_detail" → "Run details"). */
export function deskFieldLabel(key: string): string {
    return DESK_FIELDS.find((f) => f.key === key)?.label ?? fieldLabel(key);
}
