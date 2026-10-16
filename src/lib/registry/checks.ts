// PLACEHOLDER for Package A/C: replaced at merge
/* eslint-disable @typescript-eslint/no-unused-vars -- placeholder signatures; the real module uses its arguments */
/**
 * Registry checks (Package C builds them; names from
 * docs/design/registry-desk-phase1-plan.md §2). This stand-in finds
 * nothing, so the Desk shows no flags until Package C's file replaces it.
 */

export type FlagKey =
    | "shop_or_sale_title"
    | "no_colour"
    | "roster_in_title"
    | "description_in_title"
    | "colour_in_title"
    | "number_in_title"
    | "number_clash"
    | "wrong_scale"
    | "no_mold"
    | "mold_no_generation"
    | "set_missing_pieces"
    | "title_lowercase"
    | "title_punctuation"
    | "year_as_text"
    | "mold_name_disagrees"
    | "duplicate_release"
    | "empty_mold"
    | "near_name";

/** The mock's words for each flag. */
export const FLAG_LABELS: Record<FlagKey, string> = {
    shop_or_sale_title: "Shop or sale as the title",
    no_colour: "No colour",
    roster_in_title: "Whole set in the title",
    description_in_title: "Description in the title",
    colour_in_title: "Colour in the title",
    number_in_title: "Model number in the title",
    number_clash: "Shares its number with another release",
    wrong_scale: "Filed under the wrong scale",
    no_mold: "Not filed under a mold",
    mold_no_generation: "No generation tag",
    set_missing_pieces: "Set pieces missing",
    title_lowercase: "Title starts lowercase",
    title_punctuation: "Title ends in punctuation",
    year_as_text: "Year stored as text",
    mold_name_disagrees: "Mold name disagrees",
    duplicate_release: "Possible duplicate",
    empty_mold: "No releases",
    near_name: "Name one letter off another",
};

export interface CheckRow {
    id: string;
    title: string;
    item_type: string;
    maker: string | null;
    scale: string | null;
    parent_id: string | null;
    attributes: Record<string, unknown> | null;
}

export function releaseFlags(
    _row: CheckRow,
    _ctx: { mold: CheckRow | null; siblings: CheckRow[]; sameNumber: CheckRow[] },
): FlagKey[] {
    return [];
}

export function moldFlags(_mold: CheckRow, _releases: CheckRow[]): FlagKey[] {
    return [];
}
