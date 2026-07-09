/**
 * Shows domain — row types derived from the generated schema.
 *
 * Base shapes come from `database.generated.ts` (migrations 117/118
 * applied 2026-07-09), so column additions flow in automatically on
 * `npm run gen-types`. Columns whose values are constrained by CHECK
 * constraints are overlaid with the narrow domain unions below —
 * the generator renders them as plain `string`/`number`, which would
 * silently accept invalid values.
 */

import type { Database } from "@/lib/types/database.generated";

type Tables = Database["public"]["Tables"];

// ── Domain unions ──

export type ShowMode = "live" | "online";

export type ShowJudging = "judged" | "community_vote";

export type ShowStatus =
    | "draft"
    | "published"
    | "entries_open"
    | "entries_closed"
    | "running"
    | "judging"
    | "results_review"
    | "completed"
    | "archived";

export type ClassStatus =
    | "scheduled"
    | "called"
    | "judging"
    | "placed"
    | "combined"
    | "cancelled";

export type EntryStatus = "entered" | "scratched" | "placed";

export type StaffRole = "host" | "co_host" | "steward" | "judge";

export type CardStatus = "issued" | "transferred" | "redeemed" | "void";

export type DivisionAxis =
    | "halter"
    | "performance"
    | "workmanship"
    | "collectibility"
    | "other";

export type CallbackScope = "section" | "division" | "show";

/** Places are 1..6; null = participation. One vocabulary, everywhere. */
export type Place = 1 | 2 | 3 | 4 | 5 | 6;

// ── Row types (generated base + domain-union overlays) ──

export type ShowRow = Omit<Tables["shows"]["Row"], "mode" | "judging" | "status"> & {
    mode: ShowMode;
    judging: ShowJudging;
    status: ShowStatus;
};

export type ShowStaffRow = Omit<Tables["show_staff"]["Row"], "role"> & {
    role: StaffRole;
};

export type ShowDivisionRow = Omit<Tables["show_divisions"]["Row"], "axis"> & {
    axis: DivisionAxis;
};

export type ShowSectionRow = Tables["show_sections"]["Row"];

export type ShowClassRow = Omit<Tables["show_classes"]["Row"], "status"> & {
    status: ClassStatus;
};

export type ShowClassEntryRow = Omit<Tables["show_class_entries"]["Row"], "status"> & {
    status: EntryStatus;
};

export type ShowPlacingRow = Omit<Tables["show_placings"]["Row"], "place"> & {
    place: Place | null;
};

export type ShowCallbackRow = Omit<Tables["show_callbacks"]["Row"], "scope"> & {
    scope: CallbackScope;
};

export type QualificationCardRow = Omit<
    Tables["qualification_cards"]["Row"],
    "earned_place" | "status"
> & {
    /** The short code IS the primary key (8-char URL-safe) — `id`. */
    earned_place: 1 | 2;
    status: CardStatus;
};

export type ShowResultsDocRow = Tables["show_results_docs"]["Row"];
