import { describe, it, expect, afterEach, vi } from "vitest";
import { paypalBillingEnabled, paypalConfigured, paypalPathLive } from "../flag";
import { paypalEnv, paypalBaseUrl } from "../client";
import { isPaypalCertUrl } from "../webhook";
import { planKeyForPlanId, isEntitlingStatus } from "../subscriptions";
import { toMirrorStatus } from "../entitlement";

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("paypalBillingEnabled", () => {
    it("is OFF by default (unset)", () => {
        vi.stubEnv("NEXT_PUBLIC_PAYPAL_BILLING", "");
        expect(paypalBillingEnabled()).toBe(false);
    });

    it("only the literal '1' turns it on", () => {
        vi.stubEnv("NEXT_PUBLIC_PAYPAL_BILLING", "1");
        expect(paypalBillingEnabled()).toBe(true);
        for (const truthy of ["true", "yes", "on", "0", "01", " 1"]) {
            vi.stubEnv("NEXT_PUBLIC_PAYPAL_BILLING", truthy);
            expect(paypalBillingEnabled()).toBe(false);
        }
    });
});

describe("paypalPathLive", () => {
    it("needs BOTH the flag and the credentials", () => {
        vi.stubEnv("NEXT_PUBLIC_PAYPAL_BILLING", "1");
        vi.stubEnv("PAYPAL_CLIENT_ID", "");
        vi.stubEnv("PAYPAL_CLIENT_SECRET", "");
        expect(paypalConfigured()).toBe(false);
        expect(paypalPathLive()).toBe(false);

        vi.stubEnv("PAYPAL_CLIENT_ID", "id");
        vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
        expect(paypalPathLive()).toBe(true);

        // Credentials present but flag off is still off.
        vi.stubEnv("NEXT_PUBLIC_PAYPAL_BILLING", "0");
        expect(paypalPathLive()).toBe(false);
    });

    it("a half-set credential pair is not configured", () => {
        vi.stubEnv("NEXT_PUBLIC_PAYPAL_BILLING", "1");
        vi.stubEnv("PAYPAL_CLIENT_ID", "id");
        vi.stubEnv("PAYPAL_CLIENT_SECRET", "");
        expect(paypalPathLive()).toBe(false);
    });
});

describe("paypalEnv", () => {
    it("defaults to sandbox — never to live — when unset or unrecognised", () => {
        vi.stubEnv("PAYPAL_ENV", "");
        expect(paypalEnv()).toBe("sandbox");
        for (const junk of ["production", "prod", "LIVE ", "yes"]) {
            vi.stubEnv("PAYPAL_ENV", junk);
            // "LIVE " trims and lowercases to "live", which IS live.
            expect(paypalEnv()).toBe(junk.trim().toLowerCase() === "live" ? "live" : "sandbox");
        }
    });

    it("routes to the right base URL", () => {
        vi.stubEnv("PAYPAL_ENV", "live");
        expect(paypalBaseUrl()).toBe("https://api-m.paypal.com");
        vi.stubEnv("PAYPAL_ENV", "sandbox");
        expect(paypalBaseUrl()).toBe("https://api-m.sandbox.paypal.com");
    });
});

describe("isPaypalCertUrl", () => {
    it("accepts genuine PayPal certificate hosts", () => {
        expect(isPaypalCertUrl("https://api.paypal.com/v1/notifications/certs/CERT-1")).toBe(true);
        expect(isPaypalCertUrl("https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1")).toBe(true);
        expect(isPaypalCertUrl("https://paypal.com/cert")).toBe(true);
    });

    it("rejects lookalike and non-HTTPS hosts", () => {
        for (const bad of [
            "https://paypal.com.evil.test/cert",
            "https://notpaypal.com/cert",
            "https://evilpaypal.com/cert",
            "http://api.paypal.com/cert",
            "ftp://api.paypal.com/cert",
            "not a url",
            "",
        ]) {
            expect(isPaypalCertUrl(bad)).toBe(false);
        }
    });
});

describe("planKeyForPlanId", () => {
    it("maps configured plan ids to their tier, and nothing else", () => {
        vi.stubEnv("PAYPAL_PRO_PLAN_ID", "P-PRO");
        vi.stubEnv("PAYPAL_STUDIO_PLAN_ID", "P-STUDIO");
        expect(planKeyForPlanId("P-PRO")).toBe("pro");
        expect(planKeyForPlanId("P-STUDIO")).toBe("studio");
        expect(planKeyForPlanId("P-UNKNOWN")).toBeNull();
        expect(planKeyForPlanId(null)).toBeNull();
        expect(planKeyForPlanId("")).toBeNull();
    });

    it("never matches when the plans are unconfigured", () => {
        vi.stubEnv("PAYPAL_PRO_PLAN_ID", "");
        vi.stubEnv("PAYPAL_STUDIO_PLAN_ID", "");
        // The dangerous case: an empty env var must not make every
        // unrecognised plan id resolve to a paid tier.
        expect(planKeyForPlanId("")).toBeNull();
        expect(planKeyForPlanId("anything")).toBeNull();
    });
});

describe("isEntitlingStatus", () => {
    it("only ACTIVE entitles — APPROVED has not been charged yet", () => {
        expect(isEntitlingStatus("ACTIVE")).toBe(true);
        expect(isEntitlingStatus("active")).toBe(true);
        for (const status of ["APPROVED", "APPROVAL_PENDING", "SUSPENDED", "CANCELLED", "EXPIRED", "", null]) {
            expect(isEntitlingStatus(status)).toBe(false);
        }
    });
});

describe("toMirrorStatus", () => {
    it("translates PayPal statuses into the mirror's Stripe vocabulary", () => {
        expect(toMirrorStatus("ACTIVE", true)).toBe("active");
        expect(toMirrorStatus("SUSPENDED", false)).toBe("paused");
        expect(toMirrorStatus("CANCELLED", false)).toBe("canceled");
        expect(toMirrorStatus("EXPIRED", false)).toBe("canceled");
        expect(toMirrorStatus("APPROVAL_PENDING", false)).toBe("incomplete");
    });

    it("falls back to the caller's entitlement reading for an unknown status", () => {
        // The two records must never disagree about whether someone pays.
        expect(toMirrorStatus("SOMETHING_NEW", true)).toBe("active");
        expect(toMirrorStatus("SOMETHING_NEW", false)).toBe("canceled");
        expect(toMirrorStatus(undefined, false)).toBe("canceled");
    });
});
