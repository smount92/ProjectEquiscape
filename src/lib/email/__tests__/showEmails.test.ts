import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { absoluteUrl, escapeEmailHtml, renderBrandedEmail } from "../layout";
import {
    buildDeadlineEmailBody,
    buildResultsEmailBody,
    chunk,
    EMAIL_BATCH_SIZE,
} from "../showEmails";

describe("escapeEmailHtml", () => {
    it("escapes the four HTML metacharacters", () => {
        expect(escapeEmailHtml(`<b>"Tom & Jerry"</b>`)).toBe(
            "&lt;b&gt;&quot;Tom &amp; Jerry&quot;&lt;/b&gt;",
        );
    });
});

describe("absoluteUrl", () => {
    it("prefixes site-relative deep-links and passes absolute URLs through", () => {
        expect(absoluteUrl("/shows/abc")).toMatch(/^https?:\/\/.+\/shows\/abc$/);
        expect(absoluteUrl("https://example.com/x")).toBe("https://example.com/x");
    });
});

describe("renderBrandedEmail", () => {
    it("renders the leather/parchment shell with an escaped heading and working CTA", () => {
        const html = renderBrandedEmail({
            title: "Results — Summer <Classic>",
            heading: `Congrats, <script>alert("x")</script>`,
            bodyHtml: "<p>body</p>",
            ctaLabel: "See results",
            ctaUrl: "/shows/show-1",
            footerNote: "You entered this show.",
        });
        // Brand shell (parchment/ink/forest/brass) — inline hex is the
        // email-safe carrier of the leather rebrand.
        expect(html).toContain("#F5EFDF");
        expect(html).toContain("#2B2418");
        expect(html).toContain("#2F5E40");
        expect(html).toContain("#B8860B");
        // Untrusted heading is escaped; pre-built body passes through.
        expect(html).not.toContain("<script>");
        expect(html).toContain("&lt;script&gt;");
        expect(html).toContain("<p>body</p>");
        // CTA is absolute.
        expect(html).toMatch(/href="https?:\/\/[^"]+\/shows\/show-1"/);
        // No trace of the old indigo DM branding.
        expect(html).not.toContain("#0f0f23");
        expect(html).not.toContain("#818cf8");
    });
});

describe("buildResultsEmailBody", () => {
    it("lists each placement with horse, place, and class — escaped", () => {
        const body = buildResultsEmailBody({
            showTitle: "Summer <Classic>",
            placements: [
                { horseName: "Ruffian & Co", place: 1, className: "Breed Halter" },
                { horseName: "Maple", place: 3, className: "Collectibility" },
            ],
        });
        expect(body).toContain("Ruffian &amp; Co");
        expect(body).toContain("1st");
        expect(body).toContain("3rd");
        expect(body).toContain("Collectibility");
        expect(body).toContain("Summer &lt;Classic&gt;");
    });

    it("unplaced entrants get the kind results-are-up copy", () => {
        const body = buildResultsEmailBody({ showTitle: "Summer Classic", placements: [] });
        expect(body).toContain("have been published");
        expect(body).toContain("Thank you for entering");
    });
});

describe("buildDeadlineEmailBody", () => {
    it("names the show and the closing time", () => {
        const body = buildDeadlineEmailBody({
            showTitle: "Summer Classic",
            entriesCloseAt: "2026-08-02T12:00:00Z",
        });
        expect(body).toContain("Summer Classic");
        expect(body).toContain("close in less than 24 hours");
        expect(body).toContain("Aug 2");
    });

    it("still reads correctly with no timestamp", () => {
        const body = buildDeadlineEmailBody({ showTitle: "Summer Classic", entriesCloseAt: null });
        expect(body).toContain("close in less than 24 hours");
        expect(body).not.toContain("()");
    });
});

describe("chunk", () => {
    it("splits into ≤size groups and keeps order", () => {
        expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
        expect(chunk([], 2)).toEqual([]);
    });

    it("EMAIL_BATCH_SIZE matches the Resend batch API cap", () => {
        expect(EMAIL_BATCH_SIZE).toBe(100);
        const groups = chunk(Array.from({ length: 250 }, (_, i) => i), EMAIL_BATCH_SIZE);
        expect(groups.map((g) => g.length)).toEqual([100, 100, 50]);
    });
});
