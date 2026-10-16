// PLACEHOLDER for Package A: replaced at merge
//
// Registry Desk Phase 1 shared types. Package A owns this file; this copy
// carries the plan's names (docs/design/registry-desk-phase1-plan.md §2)
// so Package C compiles on its own.

/** Who did something to the Registry, in which role. */
export type ActorRole = "member" | "curator" | "moderator" | "owner";

export interface RegistryActor {
    userId: string;
    alias: string;
    role: ActorRole;
}

/** registry_actions.kind (migration 242). */
export type ActionKind = "edit" | "add" | "refile" | "approve" | "revert" | "merge" | "remove" | "undo";

/** registry_actions.status (migration 242). */
export type ActionStatus = "applied" | "awaiting_second_look" | "declined" | "undone" | "failed";
