/**
 * Show-bio vocabulary — breed, colour / pattern and age.
 *
 * These three passport fields are free text on purpose: a hobbyist can
 * assign any breed a judge will accept, and a colour can be as specific
 * as "sooty buckskin sabino". But free text drifts. After the first
 * 1,500 public horses the breed column held 287 spellings for what are
 * perhaps 120 breeds ("Paint", "Paint Horse", "American Paint Horse"),
 * ages ran "Adult" / "adult" / "5" / "Adult, born 2018", and colour had
 * "Bay tobiano" and "Bay Tobiano" side by side within a week of the
 * field shipping. Show tags, breed filters and any future class sorting
 * split on every variant.
 *
 * Two light touches, no picklist:
 *  - the form offers these lists as browser suggestions (datalist), so
 *    the common spelling is one keystroke away;
 *  - on save, a value that matches a list entry or a known alias, case
 *    and spacing aside, is stored in the list's spelling. Anything else
 *    is stored exactly as typed — a breed we have never heard of is
 *    still a breed.
 *
 * Breed and colour names are facts of the hobby; the wording of this
 * file is ours.
 */

export type ShowbioField = "breed" | "color" | "age";

export const BREEDS: readonly string[] = [
    // Light and stock
    "Akhal-Teke", "American Saddlebred", "American Warmblood", "Andalusian", "Anglo-Arabian",
    "Appaloosa", "Appaloosa Sport Horse", "AraAppaloosa", "Arabian", "Azteca", "Barb",
    "Criollo", "Curly Horse", "Florida Cracker", "Foundation Quarter Horse", "Half-Arabian",
    "Kentucky Mountain Saddle Horse", "Lipizzaner", "Lusitano", "Marwari", "Missouri Fox Trotter",
    "Morab", "Morgan", "Mustang", "National Show Horse", "Paint Horse", "Palomino (color breed)",
    "Paso Fino", "Peruvian Paso", "Pinto (color breed)", "Quarab", "Quarter Horse",
    "Quarter Pony", "Racking Horse", "Rocky Mountain Horse", "Spanish Mustang", "Standardbred",
    "Tennessee Walking Horse", "Thoroughbred", "Trakehner",
    // Sport and warmblood
    "Belgian Warmblood", "Danish Warmblood", "Dutch Warmblood", "Hanoverian", "Holsteiner",
    "Irish Sport Horse", "Oldenburg", "Selle Français", "Swedish Warmblood", "Westphalian",
    // Draft
    "American Cream Draft", "Ardennes", "Belgian Draft", "Boulonnais", "Breton", "Clydesdale",
    "Friesian", "Gypsy Vanner", "Haflinger", "Noriker", "Percheron", "Shire", "Suffolk Punch",
    // Pony
    "American Shetland", "Chincoteague Pony", "Connemara", "Dales Pony", "Dartmoor Pony",
    "Exmoor Pony", "Fell Pony", "Fjord", "Hackney Pony", "Highland Pony", "Icelandic",
    "New Forest Pony", "Pony of the Americas", "Shetland Pony", "Welsh Cob", "Welsh Mountain Pony",
    "Welsh Pony",
    // Other and fantasy
    "Miniature Horse", "Falabella", "Donkey", "Mule", "Hinny", "Mammoth Jack", "Zebra",
    "Przewalski's Horse", "Unicorn", "Pegasus", "Fantasy", "Mixed Breed", "Grade Horse",
];

/**
 * Colours are sentence case ("Bay tobiano"), which is how most owners
 * already type them and how the placeholder reads.
 */
export const COLORS: readonly string[] = [
    // Base
    "Bay", "Black", "Brown", "Chestnut", "Liver chestnut", "Flaxen chestnut", "Sorrel",
    "Seal brown", "Grey", "Dapple grey", "Fleabitten grey", "Rose grey", "Steel grey", "White",
    // Dilutes
    "Palomino", "Buckskin", "Cremello", "Perlino", "Smoky black", "Smoky cream", "Dun",
    "Red dun", "Grulla", "Bay dun", "Dunskin", "Dunalino", "Champagne", "Gold champagne",
    "Amber champagne", "Classic champagne", "Silver dapple", "Silver bay", "Pearl", "Mushroom",
    // Roan
    "Bay roan", "Red roan", "Blue roan", "Strawberry roan",
    // Pinto
    "Bay tobiano", "Black tobiano", "Chestnut tobiano", "Palomino tobiano", "Buckskin tobiano",
    "Bay overo", "Black overo", "Chestnut overo", "Bay sabino", "Chestnut sabino", "Tovero",
    "Splash white", "Frame overo", "Medicine hat", "Bay pinto", "Black pinto", "Chestnut pinto",
    "Palomino pinto", "Piebald", "Skewbald",
    // Appaloosa
    "Leopard appaloosa", "Blanket appaloosa", "Snowcap appaloosa", "Varnish roan appaloosa",
    "Fewspot appaloosa", "Snowflake appaloosa", "Bay blanket appaloosa", "Black blanket appaloosa",
    "Chestnut leopard appaloosa",
    // Factory finishes
    "Decorator", "Glossy", "Matte", "Chalky", "Woodgrain", "Gold charm", "Copenhagen",
    "Wedgewood blue", "Florentine", "Blue roan decorator",
];

export const AGES: readonly string[] = [
    "Foal", "Weanling", "Yearling", "2 years", "3 years", "4 years", "Adult", "Senior", "Aged",
];

/** Common shorthand and spelling variants → the list spelling. Keys are normalized (lowercase, single spaces). */
const ALIASES: Record<ShowbioField, Record<string, string>> = {
    breed: {
        "paint": "Paint Horse",
        "american paint horse": "Paint Horse",
        "american paint": "Paint Horse",
        "apha": "Paint Horse",
        "qh": "Quarter Horse",
        "aqha": "Quarter Horse",
        "american quarter horse": "Quarter Horse",
        "tb": "Thoroughbred",
        "appy": "Appaloosa",
        "akhal teke": "Akhal-Teke",
        "akhal-teke": "Akhal-Teke",
        "american mustang": "Mustang",
        "spanish mustang": "Spanish Mustang",
        "tennessee walker": "Tennessee Walking Horse",
        "twh": "Tennessee Walking Horse",
        "gypsy cob": "Gypsy Vanner",
        "gypsy horse": "Gypsy Vanner",
        "irish cob": "Gypsy Vanner",
        "norwegian fjord": "Fjord",
        "fjord horse": "Fjord",
        "icelandic horse": "Icelandic",
        "shetland": "Shetland Pony",
        "welsh": "Welsh Pony",
        "pony of americas": "Pony of the Americas",
        "poa": "Pony of the Americas",
        "mini": "Miniature Horse",
        "miniature": "Miniature Horse",
        "warmblood": "American Warmblood",
        "belgian": "Belgian Draft",
        "kwpn": "Dutch Warmblood",
        "selle francais": "Selle Français",
        "half arabian": "Half-Arabian",
        "half arab": "Half-Arabian",
        "anglo arabian": "Anglo-Arabian",
        "anglo arab": "Anglo-Arabian",
        "grade": "Grade Horse",
        "mixed": "Mixed Breed",
        "crossbred": "Mixed Breed",
    },
    color: {
        "gray": "Grey",
        "dapple gray": "Dapple grey",
        "fleabitten gray": "Fleabitten grey",
        "flea-bitten grey": "Fleabitten grey",
        "flea-bitten gray": "Fleabitten grey",
        "rose gray": "Rose grey",
        "steel gray": "Steel grey",
        "grullo": "Grulla",
        "blue dun": "Grulla",
        "bay roan tobiano": "Bay roan",
        "leopard": "Leopard appaloosa",
        "blanket": "Blanket appaloosa",
        "few spot": "Fewspot appaloosa",
        "fewspot": "Fewspot appaloosa",
        "varnish roan": "Varnish roan appaloosa",
        "snowcap": "Snowcap appaloosa",
        "gloss": "Glossy",
        "wood grain": "Woodgrain",
    },
    age: {
        "grown": "Adult",
        "mature": "Adult",
        "baby": "Foal",
        "suckling": "Foal",
        "2 year old": "2 years",
        "two years": "2 years",
        "3 year old": "3 years",
        "three years": "3 years",
        "4 year old": "4 years",
        "four years": "4 years",
        "old": "Aged",
        "elderly": "Aged",
    },
};

const LISTS: Record<ShowbioField, readonly string[]> = { breed: BREEDS, color: COLORS, age: AGES };

function normalize(value: string): string {
    return value.trim().replace(/\s+/g, " ").toLowerCase();
}

const INDEX: Record<ShowbioField, Map<string, string>> = {
    breed: new Map(),
    color: new Map(),
    age: new Map(),
};
for (const field of Object.keys(LISTS) as ShowbioField[]) {
    for (const entry of LISTS[field]) INDEX[field].set(normalize(entry), entry);
    for (const [alias, canonical] of Object.entries(ALIASES[field])) INDEX[field].set(normalize(alias), canonical);
}

/** The suggestions a form field offers for this show-bio field. */
export function showbioSuggestions(field: ShowbioField): readonly string[] {
    return LISTS[field];
}

/**
 * The value to store. A list entry or alias, ignoring case and spacing,
 * becomes the list spelling; anything else is trimmed and kept as typed.
 * Empty in → null out, so callers can assign the result directly.
 */
export function canonicalShowbio(field: ShowbioField, value: string | null | undefined): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim().replace(/\s+/g, " ");
    if (!trimmed) return null;
    return INDEX[field].get(trimmed.toLowerCase()) ?? trimmed;
}
