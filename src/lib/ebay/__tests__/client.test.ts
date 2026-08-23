import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    __resetTokenCache,
    buildQuery,
    EbayNotConfiguredError,
    getAppToken,
    searchActiveListings,
} from "@/lib/ebay/client";
import { ebayApiBase, ebayCompsLive, ebayConfigured, ebayMarketplace } from "@/lib/ebay/flag";

/* Every eBay HTTP call is mocked at the fetch boundary, the same way the
   PayPal client is tested. Nothing here reaches eBay. */

const okToken = (expiresIn = 7200) => ({
    ok: true, status: 200,
    json: async () => ({ access_token: "tok-abc", expires_in: expiresIn }),
});

beforeEach(() => {
    __resetTokenCache();
    vi.stubEnv("EBAY_CLIENT_ID", "cid");
    vi.stubEnv("EBAY_CLIENT_SECRET", "csecret");
    vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("the two gates", () => {
    it("is not live on credentials alone", () => {
        vi.stubEnv("NEXT_PUBLIC_EBAY_COMPS", "");
        expect(ebayConfigured()).toBe(true);
        expect(ebayCompsLive()).toBe(false);
    });

    it("is not live on the flag alone", () => {
        vi.stubEnv("NEXT_PUBLIC_EBAY_COMPS", "1");
        vi.stubEnv("EBAY_CLIENT_ID", "");
        vi.stubEnv("EBAY_CLIENT_SECRET", "");
        expect(ebayCompsLive()).toBe(false);
    });

    it("is live only with both", () => {
        vi.stubEnv("NEXT_PUBLIC_EBAY_COMPS", "1");
        expect(ebayCompsLive()).toBe(true);
    });

    // An unset environment must never mean production.
    it("defaults to sandbox", () => {
        vi.stubEnv("EBAY_ENV", "");
        expect(ebayApiBase()).toContain("sandbox");
        vi.stubEnv("EBAY_ENV", "production");
        expect(ebayApiBase()).toBe("https://api.ebay.com");
    });

    it("prices against the US marketplace unless told otherwise", () => {
        vi.stubEnv("EBAY_MARKETPLACE", "");
        expect(ebayMarketplace()).toBe("EBAY_US");
    });
});

describe("the application token", () => {
    it("refuses to fetch without credentials", async () => {
        vi.stubEnv("EBAY_CLIENT_ID", "");
        vi.stubEnv("EBAY_CLIENT_SECRET", "");
        await expect(getAppToken()).rejects.toBeInstanceOf(EbayNotConfiguredError);
        expect(fetch).not.toHaveBeenCalled();
    });

    it("is cached, so a sweep does not mint one per model", async () => {
        (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(okToken());
        const t0 = Date.now();
        await getAppToken(t0);
        await getAppToken(t0 + 1000);
        await getAppToken(t0 + 60_000);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("re-mints once the cached token is near expiry", async () => {
        (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(okToken(120));
        const t0 = Date.now();
        await getAppToken(t0);
        await getAppToken(t0 + 119_000);
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("never puts the secret in the error when auth fails", async () => {
        (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: false, status: 401, json: async () => ({ error: "invalid_client" }),
        });
        await expect(getAppToken()).rejects.toThrow(/401/);
        await expect(getAppToken()).rejects.not.toThrow(/csecret/);
    });
});

describe("searching active listings", () => {
    const listing = (over: Record<string, unknown> = {}) => ({
        itemId: "v1|123|0", title: "Breyer Alborozo 712053",
        price: { value: "129.99", currency: "USD" },
        condition: "Used", itemWebUrl: "https://ebay.com/itm/123", ...over,
    });

    async function withResults(items: unknown[]) {
        (fetch as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce(okToken())
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ itemSummaries: items }) });
        return searchActiveListings("Breyer Alborozo 712053");
    }

    it("returns parsed listings", async () => {
        const got = await withResults([listing()]);
        expect(got).toHaveLength(1);
        expect(got[0]).toMatchObject({ itemId: "v1|123|0", price: 129.99, currency: "USD" });
    });

    it("drops listings with no usable price rather than storing a zero", async () => {
        const got = await withResults([
            listing(),
            listing({ itemId: "v1|2|0", price: { value: "0", currency: "USD" } }),
            listing({ itemId: "v1|3|0", price: undefined }),
            listing({ itemId: "v1|4|0", price: { value: "not-a-number", currency: "USD" } }),
        ]);
        expect(got.map((l) => l.itemId)).toEqual(["v1|123|0"]);
    });

    it("survives an empty or malformed response", async () => {
        (fetch as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce(okToken())
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
        await expect(searchActiveListings("x")).resolves.toEqual([]);
    });

    it("names the rate limit specifically, because a sweep will meet it", async () => {
        (fetch as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce(okToken())
            .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) });
        await expect(searchActiveListings("x")).rejects.toThrow(/rate limit/i);
    });

    it("sends the marketplace header and caps the page size", async () => {
        (fetch as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce(okToken())
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ itemSummaries: [] }) });
        await searchActiveListings("x", { limit: 500 });
        const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[1];
        expect(String(url)).toMatch(/limit=50\b/);
        expect((init.headers as Record<string, string>)["X-EBAY-C-MARKETPLACE-ID"]).toBe("EBAY_US");
    });
});

describe("buildQuery", () => {
    it("asks for the two things matching will insist on", () => {
        expect(buildQuery("Breyer", "Alborozo", "712053")).toBe("Breyer Alborozo 712053");
    });

    it("skips missing parts without leaving gaps", () => {
        expect(buildQuery(null, "Alborozo", null)).toBe("Alborozo");
    });
});
