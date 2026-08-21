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
                id: "five-rooms",
                term: "The five rooms",
                def: "How this site is laid out: the Stable (what you own), Shows (the Championship Series), the Market (where horses change hands), the Registry (what the models actually are), and The Paddock (where the hobby talks). The nav is those five doors, in that order.",
            },
            {
                id: "stable",
                term: "Stable",
                def: "Your collection on Model Horse Hub — one entry per horse, with its reference, photos, condition and private purchase record. Borrowed from the real-horse word for the barn a string of horses lives in, because “inventory” is a word for warehouses.",
            },
            {
                id: "passport",
                term: "Passport",
                def: "A horse's own page: show record, qualification cards, titles, condition grade, ownership chain and photo history in one place. When a horse is for sale, its passport is the listing — there is no separate sale description to write or to doubt.",
            },
            {
                id: "paddock",
                term: "The Paddock",
                def: "This site's community room: one feed carrying members' posts, comments on public horses, barn talk, and show results as they publish. Members only, deliberately — a paddock is where the horses and the people actually mingle, which is the idea.",
            },
            {
                id: "barn",
                term: "Barn",
                def: "A club inside The Paddock — a breed circle, a regional group, a trading circle. Some barns are open to anyone; private ones take a join request their staff approve. Each has a notice board so the conversation stays in one place. (Barns were called “groups” before, and old links still work.)",
            },
            {
                id: "show-year",
                term: "Show year",
                def: "On Model Horse Hub the qualifying year runs May 1 to April 30 — the hobby season's natural rhythm. A card marked show year 2026–27 was earned between May 2026 and April 2027.",
            },
            {
                id: "championship-series",
                term: "MHH Championship Series",
                def: "The season-long program every qualifying show on this site runs to: placings pay points, strong placings in real classes mint qualification cards, and cards plus career points earn titles. One published rulebook covers photo shows and live shows alike.",
            },
            {
                id: "sanctioned-show",
                term: "MHH Sanctioned",
                def: "A show the platform has approved to run under the Championship Series, marked with a badge on the show card. Hosts request sanctioning rather than granting it to themselves — a card is only worth something if somebody checked the classes behind it. Unsanctioned shows are still real shows; they just don't mint cards or pay points.",
            },
            {
                id: "class-room",
                term: "Class room",
                def: "On this site a class is a room you can walk into: the lineup of entries with their photos, the rest of the classlist in run order alongside, and the next class a step away. While a show is blind, no owner names are shown. When that class's results publish, the placings, points, cards and any judge's comments appear in it.",
            },
            {
                id: "season-points",
                term: "Points",
                def: "What a placing pays toward the season. First place earns the number of entries in the class, and each place below earns one less — so winning a deep class beats winning a walkover. Points belong to the horse-and-owner pair, so a horse sold mid-season starts fresh for its new owner while the seller keeps what they campaigned.",
            },
            {
                id: "qualification-card",
                term: "MHH Qualification Card",
                def: "Earned automatically when a horse places 1st or 2nd in a qualifying class at a qualifying Model Horse Hub show. Each card is a permanent record with a short code anyone can verify — and it transfers with the horse when the horse is sold. These are platform qualifications, not NAMHSA/NAN cards.",
            },
            {
                id: "stakes",
                term: "STAKES card",
                def: "The big qualification card, minted only by a 1st or 2nd in a genuinely large class — the entry and exhibitor bar is several times the ordinary one. Rare by design: a STAKES card says the horse beat a full ring, not a quiet one.",
            },
            {
                id: "titles",
                term: "CH · ROM · SUP",
                def: "The three permanent titles a horse can earn here. CH (Champion) comes from qualification cards won at different shows under different judges; ROM (Register of Merit) and SUP (Superior) come from career points, which never reset. Titles are granted automatically when results publish and are never revoked — they belong to the horse for the rest of its life, whoever owns it.",
            },
            {
                id: "hoofprint",
                term: "Hoofprint",
                def: "This site's provenance record: a horse's ownership chain, show results, and history, traveling with the horse between owners. It's the reason a buyer can trust a show record they never witnessed.",
            },
            {
                id: "want-list",
                term: "Want List / Matchmaker",
                def: "Your private list of models you're hunting. Matchmaker watches the marketplace against it and tells you when a collector lists a match. It works off the Registry entry, so a want linked to a catalog item is the one that gets found. Not the same as favouriting a horse, which is a public like on one specific model.",
            },
            {
                id: "deal-room",
                term: "Deal Room",
                def: "Where a sale, commission or trade is actually negotiated: one thread per deal, with the agreed terms written down, counter-offers, and a payment ledger both sides mark — sender marks sent, receiver confirms received. The stages are Talking, Offer on the table, Agreed, Payment, On its way, Settled. The site records the terms; it never writes them, and it holds no money.",
            },
            {
                id: "safe-trade",
                term: "Safe-Trade",
                def: "The structured hand-off used when a horse changes hands here: the deal is agreed in the Deal Room, then the seller issues a transfer code from the horse's passport and the buyer redeems it, which moves the horse — record, cards, titles and photo history intact — into the buyer's stable. Payment is still settled directly between the two people. Safe-Trade moves the horse and the paperwork, never the money.",
            },
            {
                id: "blue-book",
                term: "Blue Book",
                def: "Model Horse Hub's community price guide: sale ranges and medians computed from completed sales logged on the platform, model by model. Named after the used-car guide — a starting point for fair pricing, not a formal appraisal.",
            },
            {
                id: "condition-grades",
                term: "Condition grades",
                def: "The ladder Model Horse Hub uses to describe wear honestly: Mint and Near Mint at the top, Excellent through Good in the solid middle, then Body Quality (a customizing canvas), Fair, Poor, and Play Grade (well-loved). They're honest states, not judgments — one collector's Play Grade is another artist's next masterpiece.",
            },
        ],
    },
];

/** Flat list for JSON-LD and tests. */
export const GLOSSARY_ENTRIES: GlossaryEntry[] = GLOSSARY_SECTIONS.flatMap(
    (section) => section.entries,
);
