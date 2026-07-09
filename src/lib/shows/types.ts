/**
 * Shows domain — interim hand-written row/domain types.
 *
 * REPLACE with generated types after migration 117 is applied +
 * `npm run gen-types` (then import from
 * `@/lib/types/database.generated` and delete the Row interfaces
 * below; keep the domain unions/aliases).
 *
 * These mirror supabase/migrations/117_shows_domain.sql exactly.
 */

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

// ── Row types (interim — see header) ──

export interface ShowRow {
    id: string;
    host_id: string;
    title: string;
    mode: ShowMode;
    judging: ShowJudging;
    status: ShowStatus;
    venue_name: string | null;
    venue_address: string | null;
    show_date: string | null; // DATE as ISO string
    entries_open_at: string | null;
    entries_close_at: string | null;
    judging_ends_at: string | null;
    rules_md: string | null;
    fee_info: string | null;
    capacity: number | null;
    is_mhh_qualifying: boolean;
    sanctioning_note: string | null;
    show_year: number | null;
    created_at: string;
    updated_at: string;
}

export interface ShowStaffRow {
    id: string;
    show_id: string;
    user_id: string;
    role: StaffRole;
    coi_flag: boolean;
    coi_note: string | null;
    created_at: string;
}

export interface ShowDivisionRow {
    id: string;
    show_id: string;
    name: string;
    axis: DivisionAxis;
    sort_order: number;
    created_at: string;
}

export interface ShowSectionRow {
    id: string;
    division_id: string;
    name: string;
    sort_order: number;
    created_at: string;
}

export interface ShowClassRow {
    id: string;
    section_id: string;
    class_number: string | null;
    name: string;
    status: ClassStatus;
    split_from_class_id: string | null;
    combined_into_class_id: string | null;
    max_per_entrant: number | null;
    allowed_scales: string[] | null;
    allowed_finishes: string[] | null;
    is_qualifying: boolean;
    sort_order: number;
    created_at: string;
}

export interface ShowClassEntryRow {
    id: string;
    show_id: string;
    class_id: string;
    horse_id: string;
    owner_id: string;
    handler_id: string | null;
    entry_number: number | null;
    photo_id: string | null;
    status: EntryStatus;
    /** Staff/system annotation (e.g. auto-scratch reason on combine). */
    note: string | null;
    created_at: string;
}

export interface ShowPlacingRow {
    id: string;
    class_id: string;
    entry_id: string;
    place: Place | null;
    judge_id: string | null;
    note: string | null;
    created_at: string;
}

export interface ShowCallbackRow {
    id: string;
    show_id: string;
    scope: CallbackScope;
    scope_id: string | null;
    champion_entry_id: string | null;
    reserve_entry_id: string | null;
    judge_id: string | null;
    created_at: string;
}

export interface QualificationCardRow {
    /** The short code IS the primary key (8-char URL-safe). */
    id: string;
    show_id: string;
    class_id: string;
    horse_id: string;
    earned_place: 1 | 2;
    earned_by_owner_id: string;
    current_owner_id: string;
    status: CardStatus;
    show_year: number | null;
    issued_at: string;
}

export interface ShowResultsDocRow {
    id: string;
    show_id: string;
    format: string;
    storage_path: string;
    generated_at: string;
}
