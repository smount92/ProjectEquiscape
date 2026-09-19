import { describe, it, expect } from "vitest";

import {
    MAX_PAPER_BYTES,
    extensionFor,
    isPaperKind,
    isValidPaperPath,
    issuedLine,
    linkHost,
    safeHttpUrl,
    validatePaperFile,
} from "@/lib/papers/validate";

const OWNER = "11111111-1111-4111-8111-111111111111";
const HORSE = "22222222-2222-4222-8222-222222222222";

describe("papers vocabulary", () => {
    it("knows its kinds and nothing else", () => {
        expect(isPaperKind("breeding_certificate")).toBe(true);
        expect(isPaperKind("pedigree_chart")).toBe(true);
        expect(isPaperKind("deed")).toBe(false);
    });

    it("maps MIME to the stored extension", () => {
        expect(extensionFor("application/pdf")).toBe("pdf");
        expect(extensionFor("image/png")).toBe("png");
        expect(extensionFor("image/webp")).toBe("webp");
    });
});

describe("validatePaperFile", () => {
    it("takes scans and PDFs under the cap", () => {
        expect(validatePaperFile({ type: "image/jpeg", size: 2_000_000 })).toBeNull();
        expect(validatePaperFile({ type: "application/pdf", size: 500 })).toBeNull();
    });
    it("refuses the rest with a sentence", () => {
        expect(validatePaperFile({ type: "text/plain", size: 10 })).toMatch(/JPG, PNG/);
        expect(validatePaperFile({ type: "image/jpeg", size: MAX_PAPER_BYTES + 1 })).toMatch(/10 MB/);
        expect(validatePaperFile({ type: "image/jpeg", size: 0 })).toMatch(/empty/);
    });
});

describe("isValidPaperPath", () => {
    it("accepts only {owner}/{horse}/{uuid}.{ext}", () => {
        const ok = `${OWNER}/${HORSE}/33333333-3333-4333-8333-333333333333.webp`;
        expect(isValidPaperPath(ok, OWNER, HORSE)).toBe(true);
        expect(isValidPaperPath(ok.replace(".webp", ".pdf"), OWNER, HORSE)).toBe(true);
        expect(isValidPaperPath(ok, OWNER, "44444444-4444-4444-8444-444444444444")).toBe(false);
        expect(isValidPaperPath(`${OWNER}/${HORSE}/../x.webp`, OWNER, HORSE)).toBe(false);
        expect(isValidPaperPath(`${OWNER}/${HORSE}/anything.webp`, OWNER, HORSE)).toBe(false);
        expect(isValidPaperPath(ok.replace(".webp", ".exe"), OWNER, HORSE)).toBe(false);
    });
});

describe("safeHttpUrl", () => {
    it("keeps http(s) pages, adds the scheme, and drops the rest", () => {
        expect(safeHttpUrl("https://www.starrfyre.com/rds/sdlist/hanoverians/winter_wonderland.htm")).toBe(
            "https://www.starrfyre.com/rds/sdlist/hanoverians/winter_wonderland.htm",
        );
        expect(safeHttpUrl("starrfyre.com/rds")).toBe("https://starrfyre.com/rds");
        expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
        expect(safeHttpUrl("not a url")).toBeNull();
        expect(safeHttpUrl("")).toBeNull();
        expect(safeHttpUrl(42)).toBeNull();
    });
    it("labels by host", () => {
        expect(linkHost("https://www.starrfyre.com/rds/x.htm")).toBe("starrfyre.com");
    });
});

describe("issuedLine", () => {
    it("reads like a caption, with whatever is known", () => {
        expect(issuedLine("Starrfyre", "2014-03-15")).toBe("Issued by Starrfyre · March 2014");
        expect(issuedLine("Starrfyre", null)).toBe("Issued by Starrfyre");
        expect(issuedLine(null, "2014-03-15")).toBe("Issued March 2014");
        expect(issuedLine(null, null)).toBeNull();
    });
});
