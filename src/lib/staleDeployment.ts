/**
 * Recognise the one class of client error that is not a bug: a tab that
 * was open across a deploy calling a server action by an id the new
 * build no longer has. Next reports it as "Failed to find Server Action"
 * / UnrecognizedActionError, and a 404-shaped answer to an action call
 * surfaces as "An unexpected response was received from the server".
 * Retrying re-runs the same stale call; only a reload helps.
 *
 * Vercel's Skew Protection (project settings) keeps old clients talking
 * to the deployment they loaded and is the real cure; this is the honest
 * page for whatever still slips through.
 */
const STALE_DEPLOYMENT =
    /Failed to find Server Action|was not found on the server|UnrecognizedActionError|unexpected response was received from the server/i;

export function isStaleDeploymentError(error: { name?: string; message?: string } | null | undefined): boolean {
    if (!error) return false;
    return STALE_DEPLOYMENT.test(error.message ?? "") || STALE_DEPLOYMENT.test(error.name ?? "");
}
