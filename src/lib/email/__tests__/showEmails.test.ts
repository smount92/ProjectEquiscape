import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import {
    absoluteUrl,
    EMAIL_FROM,
    escapeEmailHtml,
    htmlToPlainText,
    renderBrandedEmail,
    renderBrandedEmailText,
    renderEmailQuote,
    renderEmailStats,
} from "../layout";
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

    it("drops the CTA block entirely when no button is wanted", () => {
        // The admin reply is read, not clicked — a button pointing at the
        // site would be noise.
        const html = renderBrandedEmail({
            title: "Re: your message",
            heading: "A reply",
            bodyHtml: "<p>body</p>",
            footerNote: "You wrote to us.",
        });
        expect(html).not.toContain("#B8860B");
        expect(html).toContain("<p>body</p>");
    });

    it("can hide the notification-settings link", () => {
        // An answer to a message you sent us is not a preference you can
        // switch off, so offering the toggle would be a lie.
        const input = {
            title: "Re: your message",
            heading: "A reply",
            bodyHtml: "<p>body</p>",
            footerNote: "You wrote to us.",
        };
        expect(renderBrandedEmail(input)).toContain("Notification settings");
        expect(renderBrandedEmail({ ...input, hideSettingsLink: true })).not.toContain(
            "Notification settings",
        );
    });
});

describe("EMAIL_FROM", () => {
    it("is one constant, in RFC 5322 display-name form", () => {
        // Was copy-pasted into four files, fallback literal and all.
        expect(EMAIL_FROM).toMatch(/^.+<[^@\s]+@[^@\s]+>$/);
    });
});

describe("the branded masthead", () => {
    it("takes the logo from the app origin, not a hardcoded prod URL", () => {
        // Staging mail used to pull the production logo.
        const html = renderBrandedEmail({
            title: "t",
            heading: "h",
            bodyHtml: "<p>b</p>",
            footerNote: "f",
        });
        const origin = absoluteUrl("/");
        expect(html).toContain(`src="${origin.replace(/\/$/, "")}/logo.png"`);
    });
});

describe("htmlToPlainText", () => {
    it("keeps the structure the body was written with", () => {
        const text = htmlToPlainText(
            `<p style="margin:0 0 12px 0;">Ribbons went up at <strong>Summer Classic</strong>:</p>` +
                `<ul style="margin:0;"><li><strong>Maple</strong> placed <strong>1st</strong> in Halter</li>` +
                `<li>Ruffian placed 3rd in Collectibility</li></ul>`,
        );
        expect(text).toBe(
            [
                "Ribbons went up at Summer Classic:",
                "",
                "· Maple placed 1st in Halter",
                "· Ruffian placed 3rd in Collectibility",
            ].join("\n"),
        );
    });

    it("un-escapes entities so the text part reads as the member wrote it", () => {
        expect(htmlToPlainText(escapeEmailHtml(`Tom & "Jerry" <both>`))).toBe(
            `Tom & "Jerry" <both>`,
        );
    });

    it("turns <br /> into a line break and drops no words", () => {
        expect(htmlToPlainText("<p>one<br />two</p>")).toBe("one\ntwo");
    });

    it("renders the stat table as a label/value line each, not a run-on", () => {
        const text = htmlToPlainText(
            renderEmailStats([
                { label: "Models", value: "12" },
                { label: "Est. Value", value: "$3,400" },
            ]),
        );
        // A blank line separates the tiles, mirroring the HTML row.
        expect(text).toBe("Models\n12\n\nEst. Value\n$3,400");
    });

    it("collapses runs of blank lines rather than leaving a hole", () => {
        expect(htmlToPlainText("<p>a</p><div></div><div></div><p>b</p>")).toBe("a\n\nb");
    });
});

describe("renderBrandedEmailText", () => {
    const card = {
        title: "Results — Summer Classic",
        heading: "Congratulations, dapplegrey!",
        bodyHtml: "<p>Ribbons went up at <strong>Summer Classic</strong>.</p>",
        ctaLabel: "See the full results",
        ctaUrl: "/shows/show-1",
        footerNote: "You entered this show.",
    };

    it("carries the same words as the HTML part, without the markup", () => {
        const text = renderBrandedEmailText(card);
        expect(text).toContain("MODEL HORSE HUB");
        expect(text).toContain("Congratulations, dapplegrey!");
        expect(text).toContain("Ribbons went up at Summer Classic.");
        expect(text).toContain("You entered this show.");
        expect(text).not.toContain("<");
        expect(text).not.toContain("style=");
    });

    it("spells the CTA out as a label and an absolute URL", () => {
        // A text part whose only link is "/shows/show-1" is unclickable.
        expect(renderBrandedEmailText(card)).toMatch(
            /See the full results: https?:\/\/[^\s]+\/shows\/show-1/,
        );
    });

    it("omits the CTA line when the card has no button", () => {
        const { ctaLabel: _l, ctaUrl: _u, ...noCta } = card;
        expect(renderBrandedEmailText(noCta)).not.toContain("See the full results");
    });

    it("honours hideSettingsLink, same as the HTML part", () => {
        expect(renderBrandedEmailText(card)).toContain("Notification settings:");
        expect(renderBrandedEmailText({ ...card, hideSettingsLink: true })).not.toContain(
            "Notification settings",
        );
    });
});

describe("renderEmailQuote", () => {
    it("escapes the quoted text and keeps line breaks", () => {
        const html = renderEmailQuote('Line one\nLine <two> & "three"');
        expect(html).not.toContain("<two>");
        expect(html).toContain("&lt;two&gt;");
        expect(html).toContain("&amp;");
        expect(html).toContain("<br />");
    });

    it("escapes the optional label too", () => {
        expect(renderEmailQuote("body", "Your <original> message")).toContain("&lt;original&gt;");
    });
});

describe("renderEmailStats", () => {
    it("lays the figures out as a table, not flex", () => {
        // display:flex is ignored by Outlook on Windows, which stacked the
        // monthly report's three tiles into a column.
        const html = renderEmailStats([
            { label: "Models", value: "12" },
            { label: "Est. Value", value: "$3,400" },
        ]);
        expect(html).toContain("<table");
        expect(html).not.toContain("display:flex");
        expect(html).toContain("Models");
        expect(html).toContain("$3,400");
        // Two cells split the row evenly.
        expect(html).toContain('width="50%"');
    });

    it("escapes labels and values", () => {
        expect(renderEmailStats([{ label: "A & B", value: "<b>1</b>" }])).not.toContain("<b>1</b>");
    });

    it("renders nothing for an empty set", () => {
        expect(renderEmailStats([])).toBe("");
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
