/**
 * Form engine — the closed vocabularies.
 *
 * These lists moved here from `src/lib/config/assetFields.ts` so the
 * registry can read them without importing the module that derives itself
 * from the registry. `assetFields.ts` re-exports every name, so nothing
 * that imported them from there had to change.
 */

export const TACK_TYPES = ["Saddle", "Bridle", "Halter", "Blanket/Sheet", "Boots/Wraps", "Breast Collar", "Girth/Cinch", "Harness Set", "Bit", "Reins", "Pad/Numnah", "Martingale", "Complete Set", "Other"] as const;

export const DISCIPLINES = ["Western", "English", "Dressage", "Jumping/Hunter", "Driving/Harness", "Racing", "Endurance", "Arabian/Native", "Costume", "Multi-Discipline", "Other"] as const;

export const MATERIALS = ["Real Leather", "Faux Leather", "Vinyl", "Metal Hardware", "Fabric", "Nylon", "Wire", "Mixed Media"] as const;

export const PROP_CATEGORIES = ["Fence/Gate", "Jump/Standard", "Arena Obstacle", "Trail Obstacle", "Barrel/Pole", "Building/Barn", "Vegetation/Trees", "Ground Cover/Base", "Water Feature", "Feed/Hay", "Vehicle/Trailer", "Sign/Banner", "Scenery/Backdrop", "Other"] as const;

export const TERRAIN_SETTINGS = ["Arena/Ring", "Pasture/Field", "Trail/Cross-Country", "Barn/Stable", "Ranch/Farm", "Show Grounds", "Other"] as const;

export const SCENE_THEMES = ["Performance Show", "Ranch/Farm", "Trail Ride", "Racing", "Parade/Costume", "Fantasy/Creative", "Historical", "Breeding Farm", "Veterinary/Farrier", "Other"] as const;

export const SPECIES_TYPES = ["Cattle", "Dog", "Cat", "Wildlife", "Rider/Doll", "Bird", "Fantasy Creature", "Other"] as const;

export const WORKING_PARTS = ["Working Buckles", "Removable Bit", "Adjustable Girth", "Working Stirrups"] as const;
