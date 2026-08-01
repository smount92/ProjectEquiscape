/**
 * Shows domain — constants + pure guards for the in-dialog entry
 * photo upload (Batch 3). Lives outside the "use server" action file
 * (src/app/actions/entry-photo.ts) so the dialog and unit tests can
 * share them.
 *
 * angle_profile is a CONSTRAINED Postgres enum with no Show_Photo
 * member, and migrations are out of scope for this batch — so show
 * photos are filed under the existing neutral "Other" angle (no
 * upload flow writes "Other" today; gallery slots, flaw and extra
 * dropzones all use other members). The cap mirrors the flaw-photo
 * precedent: free for every tier, 5 per horse, the cap is the only
 * rule.
 */

/** The angle_profile value show-photo uploads are filed under. */
export const SHOW_PHOTO_ANGLE = "Other" as const;

/** Show photos per horse — every tier (flaw-photo precedent). */
export const SHOW_PHOTO_CAP = 5;

/**
 * A show-photo storage path must sit inside the horse's own folder
 * (`horses/<horseId>/…`) and look like the client pipeline's webp
 * output — blocks a crafted path from attaching someone else's file
 * or traversing the bucket.
 */
export function isValidShowPhotoPath(path: string, horseId: string): boolean {
    if (!path.startsWith(`horses/${horseId}/`)) return false;
    if (path.includes("..") || path.includes("//") || path.includes("\\")) return false;
    const filename = path.slice(`horses/${horseId}/`.length);
    return /^[A-Za-z0-9_-]+\.webp$/.test(filename);
}
