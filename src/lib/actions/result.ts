/**
 * The one shape a server action returns (docs/STANDARDS.md §1).
 *
 *   ({ success: true } & payload) | { success: false; error: string }
 *
 * The error is a sentence a member can read. A database message ("duplicate
 * key value violates unique constraint ...") is logged for us and never
 * shown: safeError() does both in one call.
 */
import { logger } from "@/lib/logger";

export type ActionResult<T extends object = object> = ({ success: true } & T) | { success: false; error: string };

export type ActionFailure = { success: false; error: string };

/** The words a member sees when an action needs them to be logged in. */
export const NOT_LOGGED_IN = "Please log in to do that.";

/** The words a suspended member sees when an action is refused for that reason. */
export const ACCOUNT_SUSPENDED =
    "Your account is suspended, so you can't do that right now. To talk to us about it, write to us through the contact page.";

/** The words a member sees when something failed that they can't fix. */
export const GENERIC_FAILURE = "Something went wrong. Please try again.";

/**
 * Log the real error for us; return plain words for the member.
 *
 *   if (error) return safeError("Wishlist", error, "Could not add it to your Want List.");
 */
export function safeError(context: string, error: unknown, message: string = GENERIC_FAILURE): ActionFailure {
    logger.error(context, message, error);
    return { success: false, error: message };
}

/** A failure whose message is already written for the member. */
export function fail(message: string): ActionFailure {
    return { success: false, error: message };
}
