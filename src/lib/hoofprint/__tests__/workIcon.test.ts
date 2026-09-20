import { describe, expect, it } from "vitest";

import { workEventIcon } from "../workIcon";

describe("workEventIcon", () => {
    it("tells a repair from a repaint from a prep job", () => {
        expect(workEventIcon("Repair & restoration")).toBe("🔧");
        expect(workEventIcon("Drybrush / OF touch-up")).toBe("🔧");
        expect(workEventIcon("Prep work")).toBe("🪚");
        expect(workEventIcon("Resin prep & finish")).toBe("🪚");
        expect(workEventIcon("Finishwork (repaint)")).toBe("🎨");
        expect(workEventIcon("Hair / mane & tail")).toBe("💇");
        expect(workEventIcon("Tack making")).toBe("🪢");
    });

    it("keeps the scissors for sculpting and for anything it cannot read", () => {
        expect(workEventIcon("Custom (sculpting)")).toBe("✂️");
        expect(workEventIcon(null)).toBe("✂️");
        expect(workEventIcon("Other")).toBe("✂️");
    });
});
