import { createHash } from "node:crypto";

/**
 * eBay Marketplace Account Deletion — the compliance endpoint every
 * production keyset must have before eBay will enable it.
 *
 * WHY THIS EXISTS AT ALL. We hold no eBay user data — the integration is
 * app-token Browse searches, nothing more — but eBay requires every
 * production application to either subscribe to account-deletion
 * notifications or formally opt out, and the keyset stays DISABLED until
 * one of those happens. This is the subscribe path: acknowledge the
 * notifications, delete nothing, because there is nothing to delete.
 *
 * THE CHALLENGE. On subscription (and periodically after), eBay sends
 *   GET <endpoint>?challenge_code=<code>
 * and expects HTTP 200 with JSON { challengeResponse } where the value is
 * hex(SHA256(challengeCode + verificationToken + endpointUrl)) — hashed
 * IN THAT ORDER, no separators. The endpoint URL must match what was
 * typed into the developer portal byte for byte, https and all.
 */
export function challengeResponseFor(
    challengeCode: string,
    verificationToken: string,
    endpointUrl: string,
): string {
    return createHash("sha256")
        .update(challengeCode)
        .update(verificationToken)
        .update(endpointUrl)
        .digest("hex");
}

/** 32–80 chars, alphanumeric plus underscore and hyphen — eBay's rule. */
export function isValidVerificationToken(token: string): boolean {
    return /^[A-Za-z0-9_-]{32,80}$/.test(token);
}
