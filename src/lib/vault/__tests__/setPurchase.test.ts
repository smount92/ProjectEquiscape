import { describe, it, expect } from "vitest";
import { groupSizes, isMissingSetColumn, shareOf, vaultValueOf } from "@/lib/vault/setPurchase";

describe("set purchases", () => {
    it("splits a set price into equal shares to the cent", () => {
        expect(shareOf(120, 3)).toBe(40);
        expect(shareOf(100, 3)).toBe(33.33);
        expect(shareOf(50, 0)).toBe(50);
    });

    it("values a horse by its own estimate first, then its share, then its price", () => {
        expect(vaultValueOf({ purchase_price: 120, estimated_current_value: 75, purchase_group_id: "g" }, 3)).toBe(75);
        expect(vaultValueOf({ purchase_price: 120, estimated_current_value: null, purchase_group_id: "g" }, 3)).toBe(40);
        expect(vaultValueOf({ purchase_price: 120, estimated_current_value: null, purchase_group_id: null }, 3)).toBe(120);
        expect(vaultValueOf({ purchase_price: null, estimated_current_value: null }, 1)).toBeNull();
    });

    it("counts group sizes from the rows it is given", () => {
        const sizes = groupSizes([{ purchase_group_id: "g" }, { purchase_group_id: "g" }, { purchase_group_id: null }, { purchase_group_id: "h" }]);
        expect(sizes.get("g")).toBe(2);
        expect(sizes.get("h")).toBe(1);
        expect(sizes.has("null")).toBe(false);
    });

    it("recognises the not-yet-pasted columns and nothing else", () => {
        expect(isMissingSetColumn({ code: "42703", message: "column financial_vault.purchase_group_id does not exist" })).toBe(true);
        expect(isMissingSetColumn({ code: "PGRST204", message: "Could not find the 'purchase_group_label' column" })).toBe(true);
        expect(isMissingSetColumn({ code: "42703", message: "column user_horses.color does not exist" })).toBe(false);
        expect(isMissingSetColumn({ code: "23505", message: "purchase_group_id" })).toBe(false);
        expect(isMissingSetColumn(null)).toBe(false);
    });
});
