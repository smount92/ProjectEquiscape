// @vitest-environment jsdom
/**
 * Message the host: the intro says where the message goes and where the
 * reply lands, the textarea carries its own descriptions (intro, heading,
 * counter), and nothing grabs focus on arrival.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/app/actions/show-host-message", () => ({ messageShowHost: vi.fn() }));

import MessageHostForm from "@/components/shows/MessageHostForm";

const entry = { id: "e-1", entryNumber: 12, horseName: "Ledger Lines", className: "Stock Arabian", scratched: false };

describe("MessageHostForm", () => {
    it("names the host and says the reply comes to the Inbox", () => {
        render(<MessageHostForm showId="s-1" showTitle="Summerween" hostAlias="Amanda" entries={[]} />);
        expect(
            screen.getByText("This goes to @Amanda as a private message. Their reply will appear in your Inbox."),
        ).toBeInTheDocument();
    });

    it("says 'the host' when the alias is unknown", () => {
        render(<MessageHostForm showId="s-1" showTitle="Summerween" hostAlias={null} entries={[]} />);
        expect(screen.getByText(/^This goes to the host as a private message\./)).toBeInTheDocument();
    });

    it("describes the textarea, not the form, and includes the counter", () => {
        const { container } = render(
            <MessageHostForm showId="s-1" showTitle="Summerween" hostAlias="Amanda" entries={[entry]} />,
        );
        const box = screen.getByLabelText("Message");
        expect(box).toHaveAttribute("aria-describedby", "host-note host-message-heading host-message-count");
        expect(container.querySelector("form")).not.toHaveAttribute("aria-describedby");
        expect(container.querySelector("#host-message-count")).toHaveTextContent(/0 of \d+ characters/);
    });

    it("does not take focus on arrival", () => {
        render(<MessageHostForm showId="s-1" showTitle="Summerween" hostAlias="Amanda" entries={[entry]} />);
        expect(screen.getByLabelText("Message")).not.toHaveFocus();
    });

    it("uses the shared select for the entry picker", () => {
        render(<MessageHostForm showId="s-1" showTitle="Summerween" hostAlias="Amanda" entries={[entry]} />);
        const select = screen.getByLabelText("Which entry is this about?");
        expect(select).toHaveAttribute("data-slot", "native-select");
        expect(select.className).toContain("text-base");
        expect(select.className).toContain("focus-visible:ring-3");
    });
});
