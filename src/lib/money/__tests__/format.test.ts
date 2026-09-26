import { describe, it, expect } from "vitest";
import { formatMoney, moneyLabel } from "@/lib/money/format";

describe("formatMoney", () => {
    it("defaults to dollars and whole numbers", () => {
        expect(formatMoney(1250)).toBe("$1,250");
        expect(formatMoney(1250, null)).toBe("$1,250");
        expect(formatMoney(1250, "  ")).toBe("$1,250");
    });

    it("places each symbol the way its users write it", () => {
        expect(formatMoney(1250, "€")).toBe("€1,250");
        expect(formatMoney(1250, "£")).toBe("£1,250");
        expect(formatMoney(1250, "kr")).toBe("1,250 kr");
        expect(formatMoney(1250, "zł")).toBe("1,250 zł");
        expect(formatMoney(1250, "CHF")).toBe("CHF 1,250");
        expect(formatMoney(1250, "R$")).toBe("R$ 1,250");
    });

    it("keeps cents when asked, as the insurance report does", () => {
        expect(formatMoney(1250.5, "€", { decimals: 2 })).toBe("€1,250.50");
    });

    it("labels a money field with the symbol", () => {
        expect(moneyLabel("Purchase Price", "€")).toBe("Purchase Price (€)");
        expect(moneyLabel("Purchase Price", null)).toBe("Purchase Price ($)");
    });
});
