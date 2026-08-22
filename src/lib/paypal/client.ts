/**
 * PayPal REST transport: base URL, OAuth token caching, and one fetch
 * wrapper that every call in this directory goes through.
 *
 * NO SDK, deliberately. `@paypal/paypal-server-sdk` would add a transport
 * layer, its own retry policy and its own token cache to do what the
 * ~120 lines below do against two endpoints. Plain fetch keeps the failure
 * modes visible, which for money code is the point.
 *
 * SECRETS. PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are read from env at
 * call time and never logged. `paypalFetch` logs status codes and PayPal's
 * own error `name`/`debug_id`, never the Authorization header, never the
 * token, and never a raw response body (PayPal echoes request fields into
 * errors and a subscription payload carries payer detail).
 */

import { logger } from "@/lib/logger";

const SANDBOX_BASE = "https://api-m.sandbox.paypal.com";
const LIVE_BASE = "https://api-m.paypal.com";

/**
 * Which PayPal to talk to. Defaults to SANDBOX when unset or unrecognised:
 * money code fails toward the environment where a mistake costs nothing.
 * Only the exact string "live" reaches production PayPal.
 */
export function paypalEnv(): "sandbox" | "live" {
    return process.env.PAYPAL_ENV?.trim().toLowerCase() === "live" ? "live" : "sandbox";
}

export function paypalBaseUrl(): string {
    return paypalEnv() === "live" ? LIVE_BASE : SANDBOX_BASE;
}

/** Thrown for any non-2xx from PayPal. Carries status so callers can branch. */
export class PaypalApiError extends Error {
    readonly status: number;
    readonly debugId: string | null;

    constructor(message: string, status: number, debugId: string | null = null) {
        super(message);
        this.name = "PaypalApiError";
        this.status = status;
        this.debugId = debugId;
    }
}

interface CachedToken {
    token: string;
    /** Epoch ms after which we must re-mint. */
    expiresAt: number;
    /** The credential+env this token was minted for. */
    key: string;
}

let cached: CachedToken | null = null;

/**
 * Re-mint this many ms BEFORE PayPal's stated expiry. Tokens last ~9
 * hours; a 60s skew means a token can never expire mid-flight between the
 * check and the call it authorizes.
 */
const EXPIRY_SKEW_MS = 60_000;

/** Cache key — client id (not the secret) plus env. */
function credentialKey(clientId: string): string {
    return `${paypalEnv()}:${clientId}`;
}

/** Test seam: drop the cached token. Also called when credentials rotate. */
export function resetPaypalTokenCache(): void {
    cached = null;
}

/**
 * An OAuth2 access token, cached in module scope until shortly before it
 * expires.
 *
 * The cache is keyed on client id + environment so that rotating a
 * credential or flipping PAYPAL_ENV can never serve a token minted for the
 * other one — the failure that would produce (live calls authorized by a
 * sandbox token) is exactly the kind that looks like it works in staging.
 */
export async function getAccessToken(): Promise<string> {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new PaypalApiError("PayPal credentials are not configured", 500);
    }

    const key = credentialKey(clientId);
    if (cached && cached.key === key && cached.expiresAt > Date.now()) {
        return cached.token;
    }

    // Basic auth over the client credentials grant. `toString("base64")`
    // on a Buffer keeps the secret out of any string that could be logged
    // by an interpolation elsewhere.
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    let response: Response;
    try {
        response = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
            method: "POST",
            headers: {
                Authorization: `Basic ${basic}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: "grant_type=client_credentials",
            cache: "no-store",
        });
    } catch (err) {
        // Network-level failure. Nothing to leak, but nothing to cache either.
        logger.error("PayPal", "Token request failed at the network layer", err);
        throw new PaypalApiError("Could not reach PayPal", 502);
    }

    if (!response.ok) {
        // Body is NOT logged: a 401 here echoes the credential back.
        logger.error("PayPal", `Token request rejected with ${response.status}`);
        throw new PaypalApiError("PayPal rejected the credentials", response.status);
    }

    const json = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) {
        throw new PaypalApiError("PayPal returned no access token", 502);
    }

    // Trust PayPal's expires_in but floor it: a malformed or absent value
    // must shorten the cache, never extend it past a real expiry.
    const lifetimeSec = typeof json.expires_in === "number" && json.expires_in > 0 ? json.expires_in : 300;
    cached = {
        token: json.access_token,
        expiresAt: Date.now() + Math.max(lifetimeSec * 1000 - EXPIRY_SKEW_MS, 30_000),
        key,
    };
    return cached.token;
}

/**
 * Authorized JSON call against the PayPal REST API.
 *
 * A 401 invalidates the cached token and retries EXACTLY once — the
 * ordinary cause is a token revoked server-side before its stated expiry,
 * and a single retry turns that into a non-event. It never retries
 * anything else: retrying a 4xx is how a billing integration creates
 * duplicate subscriptions.
 */
export async function paypalFetch<T>(
    path: string,
    init: { method?: string; body?: string; headers?: Record<string, string> } = {},
    { allowRetry = true }: { allowRetry?: boolean } = {},
): Promise<T> {
    const token = await getAccessToken();

    let response: Response;
    try {
        response = await fetch(`${paypalBaseUrl()}${path}`, {
            method: init.method ?? "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                ...(init.headers ?? {}),
            },
            body: init.body,
            cache: "no-store",
        });
    } catch (err) {
        logger.error("PayPal", `Request to ${path} failed at the network layer`, err);
        throw new PaypalApiError("Could not reach PayPal", 502);
    }

    if (response.status === 401 && allowRetry) {
        resetPaypalTokenCache();
        return paypalFetch<T>(path, init, { allowRetry: false });
    }

    if (!response.ok) {
        // PayPal's error envelope has a `name` and a `debug_id` that are
        // safe and genuinely useful in support tickets. The rest of the
        // body is not logged — it echoes the request.
        let name: string | null = null;
        let debugId: string | null = null;
        try {
            const errBody = (await response.json()) as { name?: string; debug_id?: string };
            name = errBody?.name ?? null;
            debugId = errBody?.debug_id ?? null;
        } catch {
            // Non-JSON error body — nothing safe to extract.
        }
        logger.error("PayPal", `${init.method ?? "GET"} ${path} → ${response.status}`, {
            name,
            debugId,
        });
        throw new PaypalApiError(name ?? `PayPal returned ${response.status}`, response.status, debugId);
    }

    // 204s carry no body; callers that expect nothing get undefined.
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
}
