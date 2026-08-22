// @vitest-environment jsdom
/**
 * The card promise has to be true.
 *
 * A class carries its own `isQualifying` flag from the classlist, but a
 * SHOW only becomes qualifying when MHH grants the sanctioning its host
 * requested — so a freshly created show sits un-granted with a classlist
 * full of qualifying classes. Card issuance stops dead on the show flag
 * (`cardIssuance.ts` returns immediately when `is_mhh_qualifying` is
 * false), so advertising "cards for 1st & 2nd" on those classes promises
 * entrants something the system will refuse to mint.
 *
 * Found in the Summerween dress rehearsal: a sanctioning-requested show
 * showed the badge on every class while its own console read
 * "Not qualifying".
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { PublicClassRow } from "@/components/shows/ShowEntrySectionParts";
import type { ConsoleClass } from "@/lib/shows/console";

function cls(overrides: Partial<ConsoleClass> = {}): ConsoleClass {
    return {
        id: "c1",
        name: "OF Breyer Halter",
        classNumber: "101",
        status: "scheduled",
        maxPerEntrant: null,
        allowedScales: null,
        allowedFinishes: null,
        isQualifying: true,
        sortOrder: 0,
        entryCount: 0,
        ...(overrides as object),
    } as ConsoleClass;
}

describe("card-gate badge respects the show's sanctioning", () => {
    it("promises cards when the show is sanctioned", () => {
        render(<PublicClassRow cls={cls()} canEnter={false} showIsQualifying />);
        expect(screen.getByText(/cards for 1st/i)).toBeInTheDocument();
    });

    it("promises nothing when the show is not sanctioned", () => {
        render(<PublicClassRow cls={cls()} canEnter={false} showIsQualifying={false} />);
        expect(screen.queryByText(/cards for 1st/i)).not.toBeInTheDocument();
        // The class itself still renders — only the promise is withheld.
        expect(screen.getByText("OF Breyer Halter")).toBeInTheDocument();
    });

    it("withholds the minting badge too, not just the empty-class one", () => {
        // A class that HAS met the gate would otherwise read "minting cards".
        const met = cls({ entryCount: 5, exhibitorCount: 4 } as Partial<ConsoleClass>);
        render(<PublicClassRow cls={met} canEnter={false} showIsQualifying={false} />);
        expect(screen.queryByText(/minting cards/i)).not.toBeInTheDocument();
    });

    it("still says nothing for a non-qualifying class at a sanctioned show", () => {
        render(
            <PublicClassRow cls={cls({ isQualifying: false })} canEnter={false} showIsQualifying />,
        );
        expect(screen.queryByText(/cards for 1st/i)).not.toBeInTheDocument();
    });

    it("assumes sanctioned when the prop is omitted, so existing callers are unchanged", () => {
        render(<PublicClassRow cls={cls()} canEnter={false} />);
        expect(screen.getByText(/cards for 1st/i)).toBeInTheDocument();
    });
});
