/**
 * The words the Registry Desk uses for who did what (migration 242).
 *
 * Every list here is also a CHECK in the database; a test reads the
 * migration and fails if the two ever disagree.
 */

/** Who made a Registry change, as the history shows it. */
export const ACTOR_ROLES = ["member", "curator", "moderator", "owner"] as const;
export type ActorRole = (typeof ACTOR_ROLES)[number];

/** The person behind a Registry write: their account, their alias, their role. */
export interface RegistryActor {
    userId: string;
    alias: string;
    role: ActorRole;
}

/** What a History entry did. */
export const ACTION_KINDS = ["edit", "add", "refile", "approve", "revert", "merge", "remove", "undo"] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];

/** Where a History entry stands. */
export const ACTION_STATUSES = ["applied", "awaiting_second_look", "declined", "undone", "failed"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

/** What happened to one row inside a History entry. */
export const ROW_OUTCOMES = ["applied", "skipped_changed_since", "refused", "restored"] as const;
export type RowOutcome = (typeof ROW_OUTCOMES)[number];

/** A moderator seat's state (registry_moderators.status). */
export const MODERATOR_STATUSES = ["active", "resting", "stepped_down", "removed"] as const;
export type ModeratorStatus = (typeof MODERATOR_STATUSES)[number];

/** The actor for a Desk action, from what requireRegistryModerator() returned. */
export function actorOf(seat: { user: { id: string }; role: "owner" | "moderator"; alias: string }): RegistryActor {
    return { userId: seat.user.id, alias: seat.alias, role: seat.role };
}

/** How a History entry's role reads to people. */
export const ACTOR_ROLE_LABELS: Record<ActorRole, string> = {
    member: "member",
    curator: "curator",
    moderator: "Registry moderator",
    owner: "site owner",
};
