// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { getCronHealth } = vi.hoisted(() => ({ getCronHealth: vi.fn() }));
vi.mock("@/app/actions/admin", () => ({ getCronHealth }));

import AdminCronCard from "@/components/AdminCronCard";

beforeEach(() => {
    getCronHealth.mockReset();
});

describe("AdminCronCard", () => {
    it("says it is loading until the jobs arrive", async () => {
        getCronHealth.mockReturnValue(new Promise(() => {}));
        render(<AdminCronCard />);
        expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    });

    it("has an empty state", async () => {
        getCronHealth.mockResolvedValue({ success: true, jobs: [], installed: true });
        render(<AdminCronCard />);
        expect(await screen.findByText(/No scheduled jobs are registered/)).toBeInTheDocument();
        expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("a thrown action shows an error instead of loading forever", async () => {
        getCronHealth.mockRejectedValue(new Error("boom"));
        render(<AdminCronCard />);
        expect(await screen.findByRole("alert")).toHaveTextContent("The job list couldn't load just now.");
        expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
    });

    it("lists the jobs", async () => {
        getCronHealth.mockResolvedValue({
            success: true,
            installed: true,
            jobs: [{ job: "ebay-sweep", schedule: "Weekly", lastOkAt: null, state: "unknown", lastError: null }],
        });
        render(<AdminCronCard />);
        expect(await screen.findByText("ebay-sweep")).toBeInTheDocument();
        expect(screen.getByText("No runs yet")).toBeInTheDocument();
    });
});
