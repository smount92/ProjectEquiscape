/**
 * PayPal webhook signature verification.
 *
 * An unverified billing webhook is an entitlement-forgery hole: anyone who
 * learns the URL could POST a BILLING.SUBSCRIPTION.ACTIVATED naming any
 * user id and mint themselves a paid tier. This module is the equivalent
 * of Stripe's `constructEvent` and is treated with the same seriousness —
 * it fails closed on every ambiguity, and the route refuses to look at an
 * event body until this returns true.
 */

import { paypalFetch, paypalBaseUrl } from "./client";
import { logger } from "@/lib/logger";

/** The five headers PayPal signs a delivery with. All are mandatory. */
const SIGNATURE_HEADERS = [
    "paypal-auth-algo",
    "paypal-cert-url",
    "paypal-transmission-id",
    "paypal-transmission-sig",
    "paypal-transmission-time",
] as const;

export interface SignatureHeaders {
    authAlgo: string;
    certUrl: string;
    transmissionId: string;
    transmissionSig: string;
    transmissionTime: string;
}

/**
 * Pull the signature headers out of a request, or null if any is missing.
 *
 * All-or-nothing on purpose: a partial header set is not a "mostly signed"
 * delivery, it is an unsigned one.
 */
export function readSignatureHeaders(headers: Headers): SignatureHeaders | null {
    const values: string[] = [];
    for (const name of SIGNATURE_HEADERS) {
        const value = headers.get(name);
        if (!value || !value.trim()) return null;
        values.push(value.trim());
    }
    const [authAlgo, certUrl, transmissionId, transmissionSig, transmissionTime] = values;
    return { authAlgo, certUrl, transmissionId, transmissionSig, transmissionTime };
}

/**
 * Is this cert URL actually PayPal's?
 *
 * PayPal fetches the certificate itself during verification, but the URL
 * arrives in an attacker-controlled header and gets forwarded to an API
 * call. Pinning the host to paypal.com means a forged delivery cannot
 * point the verifier at a certificate the attacker controls. Requires
 * HTTPS and an exact-suffix host match, so `paypal.com.evil.test` and
 * `notpaypal.com` are both rejected.
 */
export function isPaypalCertUrl(rawUrl: string): boolean {
    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        return false;
    }
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return host === "paypal.com" || host.endsWith(".paypal.com");
}

/**
 * Ask PayPal whether this delivery is genuine.
 *
 * Returns true ONLY on an explicit SUCCESS verdict. Every other
 * outcome — a FAILURE verdict, a missing webhook id, a non-PayPal cert
 * URL, a transport error, a malformed response — returns false, because
 * "we could not confirm this" and "this is forged" must lead to the same
 * place: granting nothing.
 *
 * The raw body is spliced into the verification payload VERBATIM rather
 * than re-serialised from a parsed object. PayPal signs the exact bytes it
 * sent; a round-trip through JSON.parse/stringify can reorder keys or
 * reformat numbers and produce a false FAILURE on a genuine event.
 */
export async function verifyWebhookSignature(
    headers: SignatureHeaders,
    rawBody: string,
): Promise<boolean> {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) {
        logger.error("PayPalWebhook", "PAYPAL_WEBHOOK_ID is not set — refusing to verify");
        return false;
    }

    if (!isPaypalCertUrl(headers.certUrl)) {
        logger.error("PayPalWebhook", "Rejected a delivery whose cert_url is not a PayPal host");
        return false;
    }

    // Built as a string so `webhook_event` keeps the original bytes.
    // JSON.stringify on each header value escapes quotes and control
    // characters, so a header cannot break out of its field.
    const payload =
        "{" +
        `"auth_algo":${JSON.stringify(headers.authAlgo)},` +
        `"cert_url":${JSON.stringify(headers.certUrl)},` +
        `"transmission_id":${JSON.stringify(headers.transmissionId)},` +
        `"transmission_sig":${JSON.stringify(headers.transmissionSig)},` +
        `"transmission_time":${JSON.stringify(headers.transmissionTime)},` +
        `"webhook_id":${JSON.stringify(webhookId)},` +
        `"webhook_event":${rawBody}` +
        "}";

    try {
        const result = await paypalFetch<{ verification_status?: string }>(
            "/v1/notifications/verify-webhook-signature",
            { method: "POST", body: payload },
        );
        const verified = result?.verification_status === "SUCCESS";
        if (!verified) {
            logger.error("PayPalWebhook", "Signature verification returned a non-SUCCESS verdict", {
                verdict: result?.verification_status ?? "none",
                base: paypalBaseUrl(),
            });
        }
        return verified;
    } catch (err) {
        // Transport failure, bad credentials, PayPal outage — all mean
        // "unverified". Returning false makes the route answer 400, and
        // PayPal will redeliver, which is the correct outcome: a genuine
        // event is retried, a forged one never succeeds.
        logger.error("PayPalWebhook", "Signature verification call failed", err);
        return false;
    }
}
