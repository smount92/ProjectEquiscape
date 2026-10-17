/**
 * The words both merge dialogs (releases, molds) use for what happens
 * next: who confirms, whether it can be undone, and the button. Before
 * update 243 the owner's merge is one-way and moderators can't merge.
 */

export const NOT_UNDOABLE =
    "Update 243 isn't added yet, so this merge can't be undone. Add it in Admin › Ops first, or merge only if you're sure.";

export const MODERATOR_WAITS_FOR_243 = "Merging opens once the site owner adds update 243.";

/** null while the readiness check is still out. */
export type Readiness = boolean | null;

export function mergeNote(role: "owner" | "moderator", ready: Readiness): { text: string; tone: "warn" | "bad" } {
    if (ready === false)
        return role === "owner" ? { text: NOT_UNDOABLE, tone: "bad" } : { text: MODERATOR_WAITS_FOR_243, tone: "bad" };
    return role === "owner"
        ? {
              text: "As the site owner your merge happens at once. It can be undone for 30 days from History.",
              tone: "warn",
          }
        : {
              text: "Merges get a second look: another moderator or the site owner confirms it before it happens. Undoable for 30 days.",
              tone: "warn",
          };
}

export function mergeButton(role: "owner" | "moderator", ready: Readiness, busy: boolean): string {
    if (busy) return "Sending ...";
    if (role !== "owner") return "Ask for a second look";
    return ready === false ? "Merge for good" : "Merge";
}

/** A moderator can't merge before 243; nobody can until the check is back. */
export function canMerge(role: "owner" | "moderator", ready: Readiness): boolean {
    if (ready === null) return false;
    return ready || role === "owner";
}
