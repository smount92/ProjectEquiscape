import { describe, expect, it } from "vitest";

import {
    hasResinIdentity,
    isMissingResinColumn,
    resinIdentityFrom,
    resinMakeupLine,
    withoutResinColumns,
} from "../resinIdentity";

describe("resin identity", () => {
    it("maps a row and drops values outside the vocabulary", () => {
        const r = resinIdentityFrom({
            resin_material: "printed_resin",
            resin_body: "marshmallow",
            cast_by: "  MVS ",
            prep_artist: "",
        });
        expect(r).toEqual({ resinMaterial: "printed_resin", resinBody: null, castBy: "MVS", prepArtist: null });
        expect(hasResinIdentity(r)).toBe(true);
        expect(hasResinIdentity(resinIdentityFrom(null))).toBe(false);
    });

    it("writes the makeup as one line", () => {
        expect(resinMakeupLine(resinIdentityFrom({ resin_material: "cast_resin", resin_body: "hollow" }))).toBe("Cast resin · hollow");
        expect(resinMakeupLine(resinIdentityFrom({ resin_body: "solid" }))).toBe("Solid");
        expect(resinMakeupLine(resinIdentityFrom({}))).toBeNull();
    });

    it("recognises only the pre-paste failure, and only for these columns", () => {
        expect(isMissingResinColumn({ code: "42703", message: "column user_horses.cast_by does not exist" })).toBe(true);
        expect(isMissingResinColumn({ code: "PGRST204", message: "Could not find the 'prep_artist' column of 'user_horses' in the schema cache" })).toBe(true);
        expect(isMissingResinColumn({ code: "42703", message: "column user_horses.hoofprint does not exist" })).toBe(false);
        expect(isMissingResinColumn({ code: "23505", message: "duplicate key value violates cast_by" })).toBe(false);
        expect(isMissingResinColumn(null)).toBe(false);
    });

    it("strips the four columns and nothing else", () => {
        expect(withoutResinColumns({ custom_name: "Smoky", cast_by: "MVS", resin_body: "hollow", finish_type: "Artist Resin" })).toEqual({
            custom_name: "Smoky",
            finish_type: "Artist Resin",
        });
    });
});
