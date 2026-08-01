import { describe, expect, it } from "vitest";

import {
    SHOW_PHOTO_ANGLE,
    SHOW_PHOTO_CAP,
    isValidShowPhotoPath,
} from "@/lib/shows/entryPhoto";

const HORSE = "123e4567-e89b-42d3-a456-426614174000";

describe("entryPhoto — show-photo constants", () => {
    it("files show photos under an existing angle_profile enum member", () => {
        // angle_profile is a constrained Postgres enum (no Show_Photo
        // member; migrations out of scope) — "Other" is the neutral
        // member no upload flow writes today.
        expect(SHOW_PHOTO_ANGLE).toBe("Other");
    });

    it("caps at 5 per horse — the flaw-photo precedent", () => {
        expect(SHOW_PHOTO_CAP).toBe(5);
    });
});

describe("isValidShowPhotoPath", () => {
    it("accepts the client pipeline's own output shape", () => {
        expect(isValidShowPhotoPath(`horses/${HORSE}/show_photo_1722500000000.webp`, HORSE)).toBe(
            true,
        );
    });

    it("rejects a path under a different horse's folder", () => {
        const other = "999e4567-e89b-42d3-a456-426614174999";
        expect(isValidShowPhotoPath(`horses/${other}/show_photo_1.webp`, HORSE)).toBe(false);
    });

    it("rejects traversal and separator tricks", () => {
        expect(isValidShowPhotoPath(`horses/${HORSE}/../evil.webp`, HORSE)).toBe(false);
        expect(isValidShowPhotoPath(`horses/${HORSE}//x.webp`, HORSE)).toBe(false);
        expect(isValidShowPhotoPath(`horses/${HORSE}/a\\b.webp`, HORSE)).toBe(false);
    });

    it("rejects nested folders and non-webp files", () => {
        expect(isValidShowPhotoPath(`horses/${HORSE}/sub/x.webp`, HORSE)).toBe(false);
        expect(isValidShowPhotoPath(`horses/${HORSE}/x.png`, HORSE)).toBe(false);
        expect(isValidShowPhotoPath(`horses/${HORSE}/x.webp.exe`, HORSE)).toBe(false);
    });

    it("rejects paths outside the horses root", () => {
        expect(isValidShowPhotoPath(`avatars/${HORSE}/x.webp`, HORSE)).toBe(false);
        expect(isValidShowPhotoPath("", HORSE)).toBe(false);
    });
});
