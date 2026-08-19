/**
 * Assigned-gender vocabulary — the single source for both horse forms
 * and the sire/dam validation (previously three hardcoded lists).
 *
 * Longears terminology (user-requested), the hobby's real vocabulary:
 *   Jack  — male donkey          Jenny — female donkey
 *   John  — male mule/hinny      Molly — female mule/hinny
 * These are shown grouped so the horse list stays first and the form
 * stays horse-centric; the DB column is free text, so adding a group
 * here is the whole change.
 */

export interface GenderGroup {
    label: string;
    options: string[];
}

export const GENDER_GROUPS: GenderGroup[] = [
    {
        label: "Horse",
        options: ["Stallion", "Mare", "Gelding", "Colt", "Filly", "Foal"],
    },
    {
        label: "Donkey",
        options: ["Jack", "Jenny"],
    },
    {
        label: "Mule / Hinny",
        options: ["John", "Molly"],
    },
];

/** Sire must not be one of these (dam-side sexes). */
export const FEMALE_GENDERS = ["Mare", "Filly", "Jenny", "Molly"];

/** Dam must not be one of these (sire-side sexes). Foal is neutral. */
export const MALE_GENDERS = ["Stallion", "Gelding", "Colt", "Jack", "John"];
