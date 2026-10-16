// PLACEHOLDER for Package A/C: replaced at merge
/**
 * Registry Desk shared types (Package A owns this file; signatures from
 * docs/design/registry-desk-phase1-plan.md §2). Types only.
 */

export type ActorRole = "member" | "curator" | "moderator" | "owner";

export interface RegistryActor {
    userId: string;
    alias: string;
    role: ActorRole;
}

export type ActionKind = "edit" | "add" | "refile" | "approve" | "revert" | "merge" | "remove" | "undo";

export type ActionStatus = "applied" | "awaiting_second_look" | "declined" | "undone" | "failed";
