import { describe, it, expect } from "vitest";

import { buildCommissionEmailCard } from "@/lib/email/commissionEmails";

describe("buildCommissionEmailCard", () => {
    it("carries the bell's sentence, greets by alias, and links the room", () => {
        const card = buildCommissionEmailCard({
            recipientName: "blackfoxfarm",
            subject: "New commission request: Custom Painting (OF)",
            body: "New commission request: Custom Painting (OF)",
            ctaUrl: "/studio/commission/abc",
        });
        expect(card.title).toBe("New commission request: Custom Painting (OF)");
        expect(card.bodyHtml).toContain("Hi blackfoxfarm");
        expect(card.bodyHtml).toContain("never handles the money");
        expect(card.ctaUrl).toBe("/studio/commission/abc");
        expect(card.ctaLabel).toBe("Open the commission");
    });

    it("escapes what people typed", () => {
        const card = buildCommissionEmailCard({
            recipientName: "<b>x</b>",
            subject: "Quote",
            body: "You have a quote for your <script>alert(1)</script> commission",
            ctaUrl: "/studio/commission/abc",
        });
        expect(card.bodyHtml).not.toContain("<script>");
        expect(card.bodyHtml).toContain("&lt;script&gt;");
        expect(card.bodyHtml).toContain("&lt;b&gt;x&lt;/b&gt;");
    });
});
