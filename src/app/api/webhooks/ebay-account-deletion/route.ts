// ============================================================
// eBay Marketplace Account Deletion endpoint
//
// Required for the production keyset to be ENABLED at all — eBay keeps
// it disabled (token requests 401) until this endpoint answers their
// challenge. See src/lib/ebay/accountDeletion.ts for the why and the
// hash contract.
//
// Env:
//   EBAY_DELETION_VERIFICATION_TOKEN — 32-80 chars, also typed into the
//     developer portal. The two must match.
//   EBAY_DELETION_ENDPOINT_URL (optional) — byte-for-byte the URL
//     registered in the portal. Defaults to the canonical production URL,
//     because the challenge hash includes the URL and a proxy-mangled
//     request URL would fail verification.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import {
    challengeResponseFor,
    isValidVerificationToken,
} from "@/lib/ebay/accountDeletion";

function endpointUrl(): string {
    const configured = (process.env.EBAY_DELETION_ENDPOINT_URL ?? "").trim();
    if (configured) return configured;
    const base = process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com";
    return `${base}/api/webhooks/ebay-account-deletion`;
}

/** eBay's verification challenge. */
export async function GET(request: NextRequest) {
    const token = (process.env.EBAY_DELETION_VERIFICATION_TOKEN ?? "").trim();
    if (!isValidVerificationToken(token)) {
        // Misconfigured on our side — say so in the logs, not to eBay.
        logger.error("EbayDeletion", "verification token missing or invalid shape");
        return NextResponse.json({ error: "not configured" }, { status: 500 });
    }

    const challengeCode = request.nextUrl.searchParams.get("challenge_code");
    if (!challengeCode) {
        return NextResponse.json({ error: "missing challenge_code" }, { status: 400 });
    }

    return NextResponse.json({
        challengeResponse: challengeResponseFor(challengeCode, token, endpointUrl()),
    });
}

/**
 * The notifications themselves. We hold no eBay user data — the
 * integration is app-token Browse searches only — so compliance is a
 * prompt acknowledgement. Logged (without the payload's user details)
 * so there is evidence the endpoint is alive.
 */
export async function POST(request: NextRequest) {
    try {
        const body = (await request.json().catch(() => null)) as {
            metadata?: { topic?: string };
            notification?: { notificationId?: string };
        } | null;
        logger.info("EbayDeletion", "notification acknowledged", {
            topic: body?.metadata?.topic ?? "unknown",
            notificationId: body?.notification?.notificationId ?? "unknown",
        });
    } catch {
        /* acknowledge anyway — a parse failure is not a reason to make
           eBay retry against an endpoint that stores nothing */
    }
    return new NextResponse(null, { status: 200 });
}
