import { describe, expect, it } from "vitest";

import { isStaleDeploymentError } from "../staleDeployment";

describe("isStaleDeploymentError", () => {
    it("recognises the three shapes Next uses for a tab that outlived its deploy", () => {
        expect(
            isStaleDeploymentError({
                message:
                    "Failed to find Server Action. This request might be from an older or newer deployment.",
            }),
        ).toBe(true);
        expect(
            isStaleDeploymentError({
                name: "UnrecognizedActionError",
                message: 'Server Action "4052e4c4" was not found on the server.',
            }),
        ).toBe(true);
        expect(
            isStaleDeploymentError({ message: "An unexpected response was received from the server." }),
        ).toBe(true);
    });

    it("leaves real errors alone", () => {
        expect(isStaleDeploymentError({ message: "Cannot read properties of undefined" })).toBe(false);
        expect(isStaleDeploymentError({ name: "TypeError", message: "fetch failed" })).toBe(false);
        expect(isStaleDeploymentError(null)).toBe(false);
        expect(isStaleDeploymentError({})).toBe(false);
    });
});
