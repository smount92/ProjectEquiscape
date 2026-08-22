/**
 * PayPal Subscriptions — a second, parallel billing path alongside Stripe.
 *
 * Start at flag.ts for why this exists (Stripe cannot sell PayPal to a US
 * business) and entitlement.ts for the one invariant that keeps the two
 * paths from touching each other.
 */

export { paypalBillingEnabled, paypalConfigured, paypalPathLive } from "./flag";
export { paypalEnv, paypalBaseUrl, paypalFetch, getAccessToken, resetPaypalTokenCache, PaypalApiError } from "./client";
export {
    createSubscription,
    getSubscription,
    planIdFor,
    planKeyForPlanId,
    isEntitlingStatus,
    PLAN_TIER,
} from "./subscriptions";
export { readSignatureHeaders, verifyWebhookSignature, isPaypalCertUrl } from "./webhook";
export { grantPaypalTier, revokePaypalTier, toMirrorStatus } from "./entitlement";
export type { EntitlementOutcome, PaidTier } from "./entitlement";
export {
    isHandledEventType,
    HANDLED_EVENT_TYPES,
} from "./types";
export type {
    PaypalPlanKey,
    PaypalSubscription,
    PaypalSale,
    PaypalWebhookEvent,
    PaypalSubscriptionStatus,
    HandledEventType,
} from "./types";
