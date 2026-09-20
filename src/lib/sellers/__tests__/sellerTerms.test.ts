import { describe, expect, it } from "vitest";

import { hasSellerTerms, isMissingSellerColumn, sellerTermsFrom, withoutSellerColumns } from "../sellerTerms";

describe("seller terms", () => {
    it("maps an RPC row, upper-casing the country and dropping unknown codes", () => {
        expect(
            sellerTermsFrom({
                user_id: "u-1",
                country: "pl",
                ships_to: " EU and UK ",
                ships_not_to: "",
                open_to_trades: true,
                looking_for: "Sarah Rose resins",
            }),
        ).toEqual({
            userId: "u-1",
            country: "PL",
            shipsTo: "EU and UK",
            shipsNotTo: null,
            openToTrades: true,
            lookingFor: "Sarah Rose resins",
        });
        expect(sellerTermsFrom({ user_id: "u-2", country: "Poland" }).country).toBeNull();
    });

    it("knows when there is nothing worth a panel", () => {
        expect(hasSellerTerms(sellerTermsFrom({ user_id: "u" }))).toBe(false);
        expect(hasSellerTerms(sellerTermsFrom({ user_id: "u", open_to_trades: true }))).toBe(true);
        expect(hasSellerTerms(null)).toBe(false);
    });

    it("recognises the pre-paste failure and strips only its own columns", () => {
        expect(isMissingSellerColumn({ code: "42703", message: "column users.ships_to does not exist" })).toBe(true);
        expect(isMissingSellerColumn({ code: "PGRST204", message: "Could not find the 'looking_for' column of 'users'" })).toBe(true);
        expect(isMissingSellerColumn({ code: "42703", message: "column users.bio does not exist" })).toBe(false);
        expect(withoutSellerColumns({ bio: "hi", country: "PL", open_to_trades: true })).toEqual({ bio: "hi" });
    });
});
