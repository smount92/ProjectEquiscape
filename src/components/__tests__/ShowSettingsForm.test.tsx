// @vitest-environment jsdom
/**
 * Wave 2 — the console Settings tab. The form is a DIFF editor over
 * updateShowSettings: only changed fields enter the patch, mode and
 * judging are draft-only, and schedule edits after entries open
 * pause for a confirm (the hourly cron enforces stored times).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import ShowSettingsForm, {
    buildSettingsPatch,
    initialValues,
    isoToLocalInput,
    localInputToIso,
    patchTouchesDates,
} from "@/components/shows/ShowSettingsForm";
import type { ConsoleShow } from "@/lib/shows/console";

const actions = vi.hoisted(() => ({
    updateShowSettings: vi.fn(),
}));
vi.mock("@/app/actions/shows-v2", () => actions);

const SHOW_ID = "123e4567-e89b-42d3-a456-426614174000";

function consoleShow(overrides: Partial<ConsoleShow> = {}): ConsoleShow {
    return {
        id: SHOW_ID,
        title: "Spring Fling Online",
        mode: "online",
        judging: "judged",
        status: "draft",
        venueName: null,
        venueAddress: null,
        showDate: null,
        entriesOpenAt: "2027-05-01T12:00:00.000Z",
        entriesCloseAt: "2027-05-15T12:00:00.000Z",
        judgingEndsAt: null,
        aboutMd: "Welcome!",
        rulesMd: null,
        feeInfo: null,
        capacity: null,
        isMhhQualifying: true,
        sanctioningNote: null,
        blindBrowsing: true,
        createdAt: "2026-07-09T00:00:00Z",
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    actions.updateShowSettings.mockResolvedValue({ success: true });
});

describe("buildSettingsPatch — the diff is the patch", () => {
    it("returns an empty patch when nothing changed (datetime seeding never registers as a change)", () => {
        const show = consoleShow();
        const patch = buildSettingsPatch(show, initialValues(show));
        expect(patch).toEqual({});
    });

    it("includes only the fields that changed", () => {
        const show = consoleShow();
        const values = { ...initialValues(show), title: "Summer Fling Online" };
        expect(buildSettingsPatch(show, values)).toEqual({ title: "Summer Fling Online" });
    });

    it("clears a nullable text field with null, not empty string", () => {
        const show = consoleShow();
        const values = { ...initialValues(show), aboutMd: "" };
        expect(buildSettingsPatch(show, values)).toEqual({ aboutMd: null });
    });

    it("only patches mode/judging while the show is a draft", () => {
        const draft = consoleShow({ status: "draft" });
        const draftValues = { ...initialValues(draft), judging: "community_vote" as const };
        expect(buildSettingsPatch(draft, draftValues)).toEqual({ judging: "community_vote" });

        const published = consoleShow({ status: "published" });
        const values = {
            ...initialValues(published),
            mode: "live" as const,
            judging: "community_vote" as const,
        };
        expect(buildSettingsPatch(published, values)).toEqual({});
    });

    it("converts a changed datetime to ISO and a cleared one to null", () => {
        const show = consoleShow();
        const values = {
            ...initialValues(show),
            entriesCloseAt: "2027-05-20T09:30",
            judgingEndsAt: "",
        };
        const patch = buildSettingsPatch(show, values);
        // The exact ISO depends on the test runner's zone — assert the
        // instant round-trips, not the literal string.
        expect(patch.entriesCloseAt).toBe(localInputToIso("2027-05-20T09:30"));
        expect("judgingEndsAt" in patch).toBe(false); // was already null
        expect(patchTouchesDates(patch)).toBe(true);
    });

    it("round-trips ISO → local input → ISO at minute precision", () => {
        const iso = "2027-05-01T12:34:00.000Z";
        const roundTripped = localInputToIso(isoToLocalInput(iso));
        expect(roundTripped).not.toBeNull();
        expect(new Date(roundTripped as string).getTime()).toBe(new Date(iso).getTime());
    });

    it("parses capacity text and clears it with null", () => {
        const show = consoleShow({ mode: "live", capacity: 40 });
        expect(
            buildSettingsPatch(show, { ...initialValues(show), capacity: "55" }),
        ).toEqual({ capacity: 55 });
        expect(
            buildSettingsPatch(show, { ...initialValues(show), capacity: "" }),
        ).toEqual({ capacity: null });
    });
});

describe("ShowSettingsForm — draft locks and saving", () => {
    it("enables mode + judging for a draft and locks them once published", () => {
        const { unmount } = render(<ShowSettingsForm show={consoleShow({ status: "draft" })} />);
        expect(screen.getByTestId("settings-mode")).not.toBeDisabled();
        expect(screen.getByTestId("settings-judging")).not.toBeDisabled();
        unmount();

        render(<ShowSettingsForm show={consoleShow({ status: "published" })} />);
        expect(screen.getByTestId("settings-mode")).toBeDisabled();
        expect(screen.getByTestId("settings-judging")).toBeDisabled();
        expect(
            screen.getAllByText(/locked — .* can only change while the show is a draft/i).length,
        ).toBeGreaterThan(0);
    });

    it("refuses to save when nothing changed", async () => {
        render(<ShowSettingsForm show={consoleShow()} />);
        fireEvent.click(screen.getByTestId("settings-save"));
        expect(await screen.findByText("Nothing has changed yet.")).toBeInTheDocument();
        expect(actions.updateShowSettings).not.toHaveBeenCalled();
    });

    it("saves a title edit as a one-field patch and toasts", async () => {
        render(<ShowSettingsForm show={consoleShow()} />);
        fireEvent.change(screen.getByDisplayValue("Spring Fling Online"), {
            target: { value: "Autumn Gala Online" },
        });
        fireEvent.click(screen.getByTestId("settings-save"));
        await waitFor(() =>
            expect(actions.updateShowSettings).toHaveBeenCalledWith({
                showId: SHOW_ID,
                patch: { title: "Autumn Gala Online" },
            }),
        );
        expect(await screen.findByText("Settings saved.")).toBeInTheDocument();
    });

    it("rejects a window where entries close before they open — before calling the action", async () => {
        render(<ShowSettingsForm show={consoleShow({ status: "draft" })} />);
        fireEvent.change(screen.getByLabelText("Entries close"), {
            target: { value: "2027-04-01T09:00" },
        });
        fireEvent.click(screen.getByTestId("settings-save"));
        expect(
            await screen.findByText("Entries must open before they close."),
        ).toBeInTheDocument();
        expect(actions.updateShowSettings).not.toHaveBeenCalled();
    });

    it("surfaces the action's refusal verbatim", async () => {
        actions.updateShowSettings.mockResolvedValue({
            success: false,
            error: "Only the host or a co-host can edit show settings.",
        });
        render(<ShowSettingsForm show={consoleShow()} />);
        fireEvent.change(screen.getByDisplayValue("Spring Fling Online"), {
            target: { value: "Autumn Gala Online" },
        });
        fireEvent.click(screen.getByTestId("settings-save"));
        expect(
            await screen.findByText("Only the host or a co-host can edit show settings."),
        ).toBeInTheDocument();
    });
});

describe("ShowSettingsForm — the post-open schedule confirm", () => {
    it("pauses date edits for a confirm once entries have opened, then saves on confirm", async () => {
        render(<ShowSettingsForm show={consoleShow({ status: "entries_open" })} />);
        fireEvent.change(screen.getByLabelText("Entries close"), {
            target: { value: "2027-05-20T09:30" },
        });
        fireEvent.click(screen.getByTestId("settings-save"));

        // Confirm dialog, not a save.
        expect(await screen.findByText("Change the schedule?")).toBeInTheDocument();
        expect(
            screen.getByText(
                /entrants will see the change, and the hourly clock enforces the new time/i,
            ),
        ).toBeInTheDocument();
        expect(actions.updateShowSettings).not.toHaveBeenCalled();

        fireEvent.click(screen.getByTestId("settings-confirm-save"));
        await waitFor(() =>
            expect(actions.updateShowSettings).toHaveBeenCalledWith({
                showId: SHOW_ID,
                patch: { entriesCloseAt: localInputToIso("2027-05-20T09:30") },
            }),
        );
    });

    it("saves non-date edits after entries open without the confirm", async () => {
        render(<ShowSettingsForm show={consoleShow({ status: "entries_open" })} />);
        fireEvent.change(screen.getByDisplayValue("Welcome!"), {
            target: { value: "Welcome, welcome!" },
        });
        fireEvent.click(screen.getByTestId("settings-save"));
        await waitFor(() =>
            expect(actions.updateShowSettings).toHaveBeenCalledWith({
                showId: SHOW_ID,
                patch: { aboutMd: "Welcome, welcome!" },
            }),
        );
        expect(screen.queryByText("Change the schedule?")).not.toBeInTheDocument();
    });
});
