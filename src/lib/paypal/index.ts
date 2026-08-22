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
    resolvePlan,
    fixedTermPaidThrough,
    fixedTermPlanId,
    PLAN_TIER,
} from "./subscriptions";
export type { ResolvedPlan } from "./subscriptions";
export { readSignatureHeaders, verifyWebhookSignature, isPaypalCertUrl } from "./webhook";
export {
    grantPaypalTier,
    revokePaypalTier,
    grantPrepaidTerm,
    endPrepaidTerm,
    toMirrorStatus,
} from "./entitlement";
export type { EntitlementOutcome, PaidTier } from "./entitlement";
// Orders v2 — the one-time, non-recurring half. See orders.ts on why the
// approval link is `payer-action` and why WE have to capture.
export {
    createPrepaidOrder,
    getOrder,
    getCapture,
    captureOrder,
    approvalLinkOf,
    orderCustomId,
    encodePrepaidCustomId,
    decodePrepaidCustomId,
    completedCaptureOf,
    captureMatchesPrice,
} from "./orders";
export {
    isHandledEventType,
    HANDLED_EVENT_TYPES,
} from "./types";
export type {
    PaypalPlanKey,
    PaypalSubscription,
    PaypalSale,
    PaypalOrder,
    PaypalCapture,
    PaypalRefund,
    PaypalPurchaseUnit,
    PaypalOrderStatus,
    PaypalWebhookEvent,
    PaypalSubscriptionStatus,
    HandledEventType,
} from "./types";
