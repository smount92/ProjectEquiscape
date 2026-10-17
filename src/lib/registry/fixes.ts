/**
 * Suggested fixes: what a Registry style rule would change on one row.
 *
 * A fix is only ever offered when a moderator style rule that names it
 * (`registry_style_rules.check_key`) is in effect: the moderators agree
 * the house style first, then the Desk suggests it on every row it
 * touches (the "Use this" button in the Mold view). Nothing is written
 * here; the moderator applies the change through the one Registry writer,
 * whose checks (`validateChanges` in src/lib/catalog/write.ts) every fix
 * must pass.
 *
 * A fix returns flat field changes (`{ title: "...", model_number: "..." }`),
 * real columns and attribute keys alike, the shape the Desk's editor fills.
 * When the fix can't be worked out safely (a number in the title that
 * disagrees with the number box, a year that isn't a year), it returns
 * nothing and the moderator decides.
 */
import { tidyName } from "@/lib/catalog/corrections";
import { reconcileTitleNumber } from "@/lib/catalog/titleNumber";
import { setLabel, stripGeneration } from "@/lib/linker/model";
import {
    colourBeforeMoldName,
    descriptionInTitle,
    isPureColourPhrase,
    isShopOrSaleTitle,
    type CheckRow,
    type FlagKey,
} from "@/lib/registry/checks";

/** What a fix may know besides the row: the mold it is filed under. */
export interface FixContext {
    mold?: CheckRow | null;
}

export interface FixRule {
    /** The `check_key` a style rule names. */
    key: string;
    /** The flag this fix answers. */
    flag: FlagKey;
    /** The fix in words, for the rule form's picker. */
    label: string;
    example: { before: string; after: string };
    /** The changes, or null when the fix can't be worked out for this row. */
    make: (row: CheckRow, ctx: FixContext) => Record<string, unknown> | null;
}

/** A style rule that is in effect (a row of registry_style_rules with status in_effect). */
export interface RuleInEffect {
    id: string;
    title: string;
    check_key: string | null;
    params?: Record<string, unknown> | null;
}

export interface SuggestedFix {
    ruleId: string;
    ruleTitle: string;
    checkKey: string;
    flag: FlagKey;
    changes: Record<string, unknown>;
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const joinNote = (existing: unknown, add: string) => (str(existing) ? `${str(existing)}\n${add}` : add);
const joinDetail = (existing: unknown, add: string) => (str(existing) ? `${str(existing)}; ${add}` : add);
const moldName = (ctx: FixContext) => (ctx.mold?.title ? stripGeneration(ctx.mold.title) : "");

export const FIX_RULES: Record<string, FixRule> = {
    number_out_of_title: {
        key: "number_out_of_title",
        flag: "number_in_title",
        label: "Move a model number out of the title into the number box",
        example: { before: "“#5038 Morgan Mare”, number empty", after: "“Morgan Mare”, number 5038" },
        make(row) {
            const r = reconcileTitleNumber(row.title, str(row.attributes?.model_number));
            if (!r.ok || r.title === row.title.trim()) return null;
            const changes: Record<string, unknown> = { title: r.title };
            if (r.model && r.model !== str(row.attributes?.model_number)) changes.model_number = r.model;
            return changes;
        },
    },
    title_no_trailing_punctuation: {
        key: "title_no_trailing_punctuation",
        flag: "title_punctuation",
        label: "Take stray punctuation off the end of a title",
        example: { before: "“Saddlebred.”", after: "“Saddlebred”" },
        make(row) {
            const t = tidyName(row.title);
            return t && t !== row.title ? { title: t } : null;
        },
    },
    title_capital: {
        key: "title_capital",
        flag: "title_lowercase",
        label: "Start a title with a capital letter",
        example: { before: "“lady Phase”", after: "“Lady Phase”" },
        make(row) {
            return /^[a-z]/.test(row.title) ? { title: capital(row.title) } : null;
        },
    },
    years_as_numbers: {
        key: "years_as_numbers",
        flag: "year_as_text",
        label: "Store years as numbers",
        example: { before: "“1975” (text)", after: "1975 (a number)" },
        make(row) {
            const changes: Record<string, unknown> = {};
            for (const key of ["release_year_start", "release_year_end"]) {
                const v = row.attributes?.[key];
                if (typeof v !== "string") continue;
                if (!/^\d{4}$/.test(v.trim())) return null; // not a plain year: a person decides
                changes[key] = Number(v.trim());
            }
            return Object.keys(changes).length ? changes : null;
        },
    },
    shop_to_run_detail: {
        key: "shop_to_run_detail",
        flag: "shop_or_sale_title",
        label: "A shop or sale title becomes the mold's name; the shop or sale moves to run details",
        example: {
            before: "“BreyerFest 1990 — Live Auction 01”",
            after: "“Saddlebred” · One of a Kind · run details “BreyerFest 1990 — Live Auction 01”",
        },
        make(row, ctx) {
            const name = moldName(ctx);
            if (!name || !isShopOrSaleTitle(row.title)) return null;
            const changes: Record<string, unknown> = {
                title: name,
                run_detail: joinDetail(row.attributes?.run_detail, tidyName(row.title)),
            };
            if (/\b(?:auction|raffle|door prize)\b/i.test(row.title) && !str(row.attributes?.run_type))
                changes.run_type = "One of a Kind";
            return changes;
        },
    },
    description_to_notes: {
        key: "description_to_notes",
        flag: "description_in_title",
        label: "Move a description out of the title into the notes",
        example: {
            before: "“Pocket Barn (Replaced in 2006 by American Saddlebred)”",
            after: "“Pocket Barn” · notes “Replaced in 2006 by American Saddlebred”",
        },
        make(row) {
            const at = descriptionInTitle(row.title);
            if (!at) return null;
            const cut = row.title.slice(at.start, at.end);
            const title = tidyName(`${row.title.slice(0, at.start)} ${row.title.slice(at.end)}`.replace(/\s+/g, " "));
            const note = tidyName(cut.replace(/^[\s(.]+|[\s)]+$/g, ""));
            if (!title || !note) return null;
            return { title, registry_notes: joinNote(row.attributes?.registry_notes, capital(note)) };
        },
    },
    colour_out_of_title: {
        key: "colour_out_of_title",
        flag: "colour_in_title",
        label: "Take a colour off the front of a title; it fills an empty colour box",
        example: { before: "“Black Pinto Saddlebred”", after: "“Saddlebred” · colour “Black pinto”" },
        make(row, ctx) {
            const found = colourBeforeMoldName(row.title, ctx.mold?.title);
            if (!found || !isPureColourPhrase(found.prefix)) return null;
            const changes: Record<string, unknown> = { title: tidyName(row.title.slice(found.at)) };
            if (!str(row.attributes?.color_description) || str(row.attributes?.color_description) === "?")
                changes.color_description = capital(found.prefix.toLowerCase());
            return changes;
        },
    },
    set_piece_title: {
        key: "set_piece_title",
        flag: "roster_in_title",
        label: "A set piece is titled with the set's name and, in brackets, the piece",
        example: {
            before: "“12-Piece Stablemates Set With Arabian Mare, Citation, … Saddlebred …”",
            after: "“12-Piece Stablemates Set (Saddlebred)”",
        },
        make(row, ctx) {
            const name = moldName(ctx);
            const label = setLabel(row.title);
            if (!name || !label) return null;
            const title = `${tidyName(label)} (${name})`;
            return title !== row.title ? { title } : null;
        },
    },
};

/**
 * The fixes to offer on a row: one per in-effect rule whose fix answers a
 * flag the row carries. No rule in effect, no fix.
 */
export function suggestedFixes(
    row: CheckRow,
    flags: FlagKey[],
    rulesInEffect: RuleInEffect[],
    ctx: FixContext = {},
): SuggestedFix[] {
    const out: SuggestedFix[] = [];
    for (const rule of rulesInEffect) {
        const fix = rule.check_key ? FIX_RULES[rule.check_key] : undefined;
        if (!fix || !flags.includes(fix.flag)) continue;
        const changes = fix.make(row, ctx);
        if (changes && Object.keys(changes).length)
            out.push({ ruleId: rule.id, ruleTitle: rule.title, checkKey: fix.key, flag: fix.flag, changes });
    }
    return out;
}

/** Is this a fix the Desk knows? (check_key is validated here, not in the database.) */
export function isKnownFix(key: string | null | undefined): boolean {
    return !key || Object.hasOwn(FIX_RULES, key);
}
