import { describe, it, expect, beforeEach, vi } from "vitest";

// Stub the environment variable before importing the module
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");

// Dynamic import after env stub to pick up the mocked value
const { extractStoragePath, getPublicImageUrl, getPublicImageUrls } = await import(
    "@/lib/utils/storage"
);

describe("extractStoragePath", () => {
    it("passes through a relative path as-is", () => {
        expect(extractStoragePath("horses/abc/thumb.webp")).toBe("horses/abc/thumb.webp");
    });

    it("extracts path from a public Supabase URL", () => {
        const url =
            "https://xxx.supabase.co/storage/v1/object/public/horse-images/horses/abc/thumb.webp";
        expect(extractStoragePath(url)).toBe("horses/abc/thumb.webp");
    });

    it("extracts path from a signed Supabase URL (strips query params)", () => {
        const url =
            "https://xxx.supabase.co/storage/v1/object/sign/horse-images/horses/abc/thumb.webp?token=xxx";
        expect(extractStoragePath(url)).toBe("horses/abc/thumb.webp");
    });

    it("returns empty string for empty input", () => {
        expect(extractStoragePath("")).toBe("");
    });

    it("handles paths without horse-images marker", () => {
        const result = extractStoragePath("some/other/path.webp");
        expect(result).toBe("some/other/path.webp");
    });
});

describe("getPublicImageUrl", () => {
    it("generates correct public URL from relative path", () => {
        const result = getPublicImageUrl("horses/abc/thumb.webp");
        expect(result).toBe(
            "https://test.supabase.co/storage/v1/object/public/horse-images/horses/abc/thumb.webp"
        );
    });

    it("generates correct public URL from full URL", () => {
        const url =
            "https://xxx.supabase.co/storage/v1/object/public/horse-images/horses/abc/thumb.webp";
        const result = getPublicImageUrl(url);
        expect(result).toContain("/storage/v1/object/public/horse-images/horses/abc/thumb.webp");
    });
});

describe("getPublicImageUrls", () => {
    it("returns Map with correct entries for multiple paths", () => {
        const paths = ["path1.webp", "path2.webp"];
        const result = getPublicImageUrls(paths);
        expect(result.size).toBe(2);
        expect(result.get("path1.webp")).toContain("path1.webp");
        expect(result.get("path2.webp")).toContain("path2.webp");
    });

    it("returns empty Map for empty array", () => {
        const result = getPublicImageUrls([]);
        expect(result.size).toBe(0);
    });

    it("values contain the public base URL", () => {
        const result = getPublicImageUrls(["test.webp"]);
        expect(result.get("test.webp")).toContain("https://test.supabase.co");
    });
});
