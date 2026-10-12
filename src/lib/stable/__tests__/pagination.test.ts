import { describe, it, expect } from "vitest";
import { clampPage, offsetFor, pageCountFor, pageWindow, rangeOf } from "@/lib/stable/pagination";

describe("stable paging arithmetic", () => {
    it("counts pages, never fewer than one", () => {
        expect(pageCountFor(412, 48)).toBe(9);
        expect(pageCountFor(384, 48)).toBe(8);
        expect(pageCountFor(1, 48)).toBe(1);
        expect(pageCountFor(0, 48)).toBe(1);
    });

    it("clamps into 1..pageCount", () => {
        expect(clampPage(12, 9)).toBe(9);
        expect(clampPage(0, 9)).toBe(1);
        expect(clampPage(-3, 9)).toBe(1);
        expect(clampPage(4, 9)).toBe(4);
        expect(clampPage(3, 0)).toBe(1);
        expect(clampPage(Number.NaN, 9)).toBe(1);
    });

    it("offsets are (page - 1) × per", () => {
        expect(offsetFor(1, 48)).toBe(0);
        expect(offsetFor(3, 48)).toBe(96);
        expect(offsetFor(3, 96)).toBe(192);
    });

    it("gives the Showing from–to numbers", () => {
        expect(rangeOf(3, 48, 48)).toEqual({ from: 97, to: 144 });
        expect(rangeOf(9, 48, 28)).toEqual({ from: 385, to: 412 });
        expect(rangeOf(1, 48, 0)).toEqual({ from: 0, to: 0 });
    });

    it("lists first, current ±2 and last with gaps", () => {
        expect(pageWindow(1, 1)).toEqual([1]);
        expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
        expect(pageWindow(1, 9)).toEqual([1, 2, 3, "gap", 9]);
        expect(pageWindow(5, 9)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        expect(pageWindow(10, 20)).toEqual([1, "gap", 8, 9, 10, 11, 12, "gap", 20]);
        expect(pageWindow(20, 20)).toEqual([1, "gap", 18, 19, 20]);
        // a one-page gap shows the page instead of an ellipsis
        expect(pageWindow(5, 20)).toEqual([1, 2, 3, 4, 5, 6, 7, "gap", 20]);
    });
});
