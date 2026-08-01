/**
 * Shows domain — "get show-ready" shapes + pure derivation for the
 * first-entry ramp (Batch 3). Lives OUTSIDE the "use server" action
 * file (src/app/actions/show-readiness.ts) so the client panel and
 * unit tests can import the same logic — same split as ./public.
 *
 * The panel is guidance, not validation: the server (entryRules +
 * RLS) stays the only authority on what may actually enter.
 */

import type { ShowMode } from "./types";

/** Cheap counts over the viewer's stable, computed server-side. */
export interface ShowReadiness {
    /** Owned, not deleted. */
    totalHorses: number;
    /** …and public. */
    publicHorses: number;
    /** …with at least one photo (any visibility). */
    horsesWithPhotos: number;
    /** Public AND photographed — enterable in online shows. */
    eligibleCount: number;
}

export type ReadinessState =
    | { kind: "empty" }
    | {
          kind: "gaps";
          privateCount: number;
          /** Public horses without a photo (blocking only for online shows). */
          publicNoPhotoCount: number;
          /** Honest per-bucket lines, ready to render. */
          messages: string[];
      }
    | { kind: "ready"; readyCount: number };

/**
 * Turn raw stable counts into the panel's state. Live shows need a
 * public horse; online shows need a public horse WITH a photo (the
 * judged object is the photo).
 */
export function deriveReadinessState(r: ShowReadiness, mode: ShowMode): ReadinessState {
    if (r.totalHorses <= 0) return { kind: "empty" };

    const privateCount = Math.max(0, r.totalHorses - r.publicHorses);
    const publicNoPhotoCount = Math.max(0, r.publicHorses - r.eligibleCount);

    const readyCount = mode === "online" ? r.eligibleCount : r.publicHorses;
    if (readyCount > 0) return { kind: "ready", readyCount };

    const messages: string[] = [];
    if (privateCount > 0) {
        messages.push(
            privateCount === 1
                ? "1 horse is private — make it public to enter."
                : `${privateCount} horses are private — make one public to enter.`,
        );
    }
    if (mode === "online" && publicNoPhotoCount > 0) {
        messages.push(
            publicNoPhotoCount === 1
                ? "1 public horse has no photo yet — online shows judge the photo."
                : `${publicNoPhotoCount} public horses have no photo yet — online shows judge the photo.`,
        );
    }
    // Belt-and-braces: gaps should never render blank.
    if (messages.length === 0) {
        messages.push(
            "Your horses aren't enterable yet — check visibility and photos in your stable.",
        );
    }

    return { kind: "gaps", privateCount, publicNoPhotoCount, messages };
}
