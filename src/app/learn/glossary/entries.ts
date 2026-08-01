/**
 * /learn/glossary — the terms themselves (Wave 2 education).
 *
 * Written for OUTSIDERS, honestly: no term assumes another term, the
 * quirky ones admit they're quirky, and platform-specific vocabulary
 * is labeled as ours (never implied to be hobby-universal). Each id
 * is a stable anchor — /learn/glossary#lsq — so shows, listings, and
 * guides can deep-link a single definition. Kept out of page.tsx so
 * tests and JSON-LD share one source of truth.
 */

export interface GlossaryEntry {
    /** Stable anchor id — never change one once shipped. */
    id: string;
    term: string;
    def: string;
}

export interface GlossarySection {
    heading: string;
    entries: GlossaryEntry[];
}

export const GLOSSARY_SECTIONS: GlossarySection[] = [
    {
        heading: "Finishes & kinds of models",
        entries: [
            {
                id: "of",
                term: "OF — Original Finish",
                def: "A model exactly as it left the factory, factory paint intact. The opposite of a custom. For OF collectors condition is nearly everything — rubs, scratches, and breaks all count against a model in the ring and on the market.",
            },
            {
                id: "cm",
                term: "CM — Custom (customized)",
                def: "A model an artist has deliberately changed — repainted, resculpted, rehaired, or all three. A custom is one of a kind, and it competes against other customs, never against factory-finish models.",
            },
            {
                id: "ar",
                term: "AR — Artist Resin",
                def: "A model cast in resin from an artist's original sculpture, usually in a small run, then painted — often by a second artist. The fine-art end of the hobby: resins are sold both unpainted (for someone else to finish) and finished.",
            },
            {
                id: "mold-release",
                term: "Mold vs. release",
                def: "The mold is the sculpted shape; a release is a production run of that mold in one color and finish. One mold can carry dozens of releases across decades — which is why collectors talk about “the mold” and “the release” as two different facts about the same horse.",
            },
            {
                id: "scale",
                term: "Scale",
                def: "The hobby's size classes. Traditional is roughly 1:9 (about a foot long), Classic about 1:12, Stablemate about 1:32, Micro Mini smaller still. Shows split classes by scale so a Stablemate is never judged against a Traditional.",
            },
            {
                id: "chalky",
                term: "Chalky",
                def: "A 1970s Breyer variation: models cast in opaque white plastic, or painted over a white basecoat, when the oil crisis changed plastic supplies. An accident of history that became a collecting specialty — “chalkies” are sought after today.",
            },
            {
                id: "body",
                term: "Body / body-box",
                def: "A well-loved model destined to become a custom: bought cheap as raw material, not preserved as a collectible. The “body box” is the box of them under an artist's desk. One collector's rough horse is another's canvas — the hobby is honest about this.",
            },
        ],
    },
    {
        heading: "Ways of showing",
        entries: [
            {
                id: "photo-show",
                term: "Photo show",
                def: "A show where the entry is a photograph of your model, judged remotely. The hobby's original distance format — mail-in photo shows ran on stamps and patience decades before the internet. Online shows on Model Horse Hub are this tradition, minus the postage.",
            },
            {
                id: "live-show",
                term: "Live show",
                def: "An in-person show: models on tables, a judge walking the ring, a full day of classes, callbacks, and champions. Showers pack their horses in padded cases and drive surprising distances for this.",
            },
            {
                id: "halter",
                term: "Halter",
                def: "The conformation class family, named for the real-horse classes where horses are shown standing, in hand. A halter class asks: how correct and convincing is this model as a horse — and, in breed halter, as the breed it has been assigned?",
            },
            {
                id: "performance",
                term: "Performance",
                def: "Classes where the model is presented doing a job — western trail, jumping, driving — with miniature tack, props, and usually documentation. Judged on the realism and accuracy of the whole scene, not just the horse.",
            },
            {
                id: "breed-assignment",
                term: "Breed assignment",
                def: "You decide what breed your model represents; nothing is printed on the horse. Judges weigh how well the sculpture's build and the finish's color fit that breed's real-world standard — a thoughtful assignment beats a glamorous one.",
            },
            {
                id: "documentation",
                term: "Documentation",
                def: "Reference material presented with an entry — a breed description, photos of real horses, an explanation of a performance setup — supporting your breed assignment or showing a performance scene is plausible. Optional in easy classes, decisive in hard ones.",
            },
            {
                id: "lsq",
                term: "LSQ — Live Show Quality",
                def: "Shorthand for “condition and finish good enough to be competitive at a live show.” Also used for photos: an “LSQ photo set” shows a model clearly from every angle. It's a judgment call, not a certification — but the hobby uses it constantly.",
            },
            {
                id: "psq",
                term: "PSQ — Photo Show Quality",
                def: "A step below LSQ: presentable in photographs, where tiny flaws may not read. Honest sellers and showers use these grades carefully — the difference is real money and real placings.",
            },
            {
                id: "proxy-showing",
                term: "Proxy showing",
                def: "Having someone else show your model for you at a live show — you ship it or hand it off, they enter and handle it ringside. On Model Horse Hub an entry's handler can be a different member than its owner for exactly this reason.",
            },
            {
                id: "blind-judging",
                term: "Blind judging",
                def: "Judging entries without knowing who owns them — numbers on the table instead of names — so results ride on the model, not the reputation. Online, the same idea hides owner names until results are out.",
            },
        ],
    },
    {
        heading: "In the ring",
        entries: [
            {
                id: "division-section-class",
                term: "Division / section / class",
                def: "The classlist's ladder. A division groups entries by finish and discipline (“OF Plastic Halter”); sections group by type or breed family (“Stock breeds”); the class is the judged unit your model actually stands in.",
            },
            {
                id: "split-combine",
                term: "Split / combine",
                def: "Classlist surgery on show day. A class with too many entries gets split — by breed, age, or gender — so judging stays fair; under-filled classes get combined so nobody stands alone. Completely normal, not a scandal.",
            },
            {
                id: "leg-tag",
                term: "Leg tag",
                def: "The small numbered band or sticker identifying an entry on the table. Your horse shows as a number (see blind judging) and keeps that number across all its classes at one show.",
            },
            {
                id: "callback",
                term: "Callback",
                def: "After classes are placed, the judge calls the top placings back to compete for section or division champion. Being “called back” means you're in the championship conversation.",
            },
            {
                id: "champion-reserve",
                term: "Champion / Reserve",
                def: "First and second in a championship, chosen from called-back winners. “Reserve” is the horse world's word for runner-up, and the model world kept it.",
            },
            {
                id: "rosette",
                term: "Rosette",
                def: "The layered, ruffled ribbon award. Flat ribbons usually mark class placings; rosettes usually mean champion and reserve. Yes, we hang them on walls. Yes, walls fill up.",
            },
            {
                id: "show-string",
                term: "Show string",
                def: "The set of models a shower campaigns in a season — borrowed from real-horse showing, where a trainer's “string” is the horses they bring. Building a string is half the fun.",
            },
        ],
    },
    {
        heading: "Organizations",
        entries: [
            {
                id: "namhsa",
                term: "NAMHSA — North American Model Horse Shows Association",
                def: "The volunteer nonprofit that approves live shows across North America and puts on NAN, the hobby's national championship. Shows sanctioned by NAMHSA can hand out NAN qualification cards.",
            },
            {
                id: "nan",
                term: "NAN — North American Nationals",
                def: "The hobby's championship live show, run by NAMHSA. Models qualify by placing at NAMHSA-approved shows beforehand. (Model Horse Hub's qualification cards are our platform's own system — they are not NAN cards.)",
            },
            {
                id: "mepsa",
                term: "MEPSA — Model Equine Photo Showers Association",
                def: "A long-running organization devoted to photo showing, with its own circuit and championship — living proof the mail-in photo show tradition never died, it organized.",
            },
        ],
    },
    {
        heading: "On Model Horse Hub",
        entries: [
            {
                id: "show-year",
                term: "Show year",
                def: "On Model Horse Hub the qualifying year runs May 1 to April 30 — the hobby season's natural rhythm. A card marked show year 2026–27 was earned between May 2026 and April 2027.",
            },
            {
                id: "qualification-card",
                term: "MHH Qualification Card",
                def: "Earned automatically when a horse places 1st or 2nd in a qualifying class at a qualifying Model Horse Hub show. Each card is a permanent record with a short code anyone can verify — and it transfers with the horse when the horse is sold. These are platform qualifications, not NAMHSA/NAN cards.",
            },
            {
                id: "hoofprint",
                term: "Hoofprint",
                def: "This site's provenance record: a horse's ownership chain, show results, and history, traveling with the horse between owners. It's the reason a buyer can trust a show record they never witnessed.",
            },
        ],
    },
];

/** Flat list for JSON-LD and tests. */
export const GLOSSARY_ENTRIES: GlossaryEntry[] = GLOSSARY_SECTIONS.flatMap(
    (section) => section.entries,
);
