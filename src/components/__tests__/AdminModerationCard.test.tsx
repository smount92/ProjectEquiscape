// @vitest-environment jsdom
/**
 * The admin's suspend card says what the Members tab says: the member reads
 * the reason (suspendUser sends it to them), it isn't only for the record.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const actions = vi.hoisted(() => ({
    suspendUserByAlias: vi.fn().mockResolvedValue({ success: true }),
    unsuspendUserByAlias: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("@/app/actions/admin", () => actions);

import AdminModerationCard from "@/components/AdminModerationCard";

describe("AdminModerationCard", () => {
    it("says the member is told the reason", () => {
        render(<AdminModerationCard />);
        expect(screen.getByLabelText("Suspension reason")).toHaveAttribute(
            "placeholder",
            "Reason (required — the member is told it, and it lands on the audit trail)",
        );
        fireEvent.change(screen.getByLabelText("User alias"), { target: { value: "Trouble" } });
        fireEvent.click(screen.getByRole("button", { name: "Suspend" }));
        expect(screen.getByRole("alert")).toHaveTextContent(
            "A reason is required — the member is told it, and it lands on the audit trail.",
        );
        expect(actions.suspendUserByAlias).not.toHaveBeenCalled();
    });
});
