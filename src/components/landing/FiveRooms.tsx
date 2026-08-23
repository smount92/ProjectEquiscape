import Link from "next/link";
import { BookOpen, Camera, Home, Newspaper, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * The five rooms, in the order the nav lists them.
 *
 * Icons deliberately match Header.tsx so the door and the hallway agree:
 * Stable=Home · Shows=Camera · Market=TrendingUp · Paddock=Newspaper ·
 * Registry=BookOpen.
 *
 * Every link here goes somewhere a logged-out visitor can actually land.
 * The Stable and the Paddock are behind the login, so those cards say so
 * and send people to signup with a redirect rather than bouncing them off
 * a wall.
 */

interface Room {
    name: string;
    /** The one-line answer to "what is this room". */
    standfirst: string;
    Icon: LucideIcon;
    body: React.ReactNode;
    links: { href: string; label: string; id: string }[];
}

const ROOMS: Room[] = [
    {
        name: "The Stable",
        standfirst: "Everything you own",
        Icon: Home,
        body: (
            <>
                One entry per horse: the reference it came from, photos from every angle, condition,
                and what you paid — that last part visible to you and nobody else. Filter the herd by
                mold, maker, finish or status and keep the views you use. When your insurer asks what
                the shelves are worth, print the report. Already keeping a spreadsheet? Import it.
            </>
        ),
        links: [
            { href: "/signup?redirectTo=%2Fdashboard", label: "Start your stable →", id: "room-stable-cta" },
            { href: "/getting-started", label: "How it works →", id: "room-stable-guide" },
        ],
    },
    {
        name: "Shows",
        standfirst: "The MHH Championship Series",
        Icon: Camera,
        body: (
            <>
                Photo shows and live shows, run to one published rulebook. First place pays the size
                of the class, so winning a deep one counts for more than winning a walkover. A 1st or
                2nd in a class with real competition mints a qualification card stamped with the field
                it beat — <em>1st of 12, 8 exhibitors</em> — and cards plus career points earn CH, ROM
                and SUP, which the horse keeps for the rest of its life. Hosting is free, and the ring
                console runs off a phone at the table.
            </>
        ),
        links: [
            { href: "/shows", label: "See what's showing →", id: "room-shows-cta" },
            { href: "/shows/rules", label: "Read the rulebook →", id: "room-shows-rules" },
        ],
    },
    {
        name: "The Market",
        standfirst: "Priced by the record",
        Icon: TrendingUp,
        body: (
            <>
                A listing here is the horse&rsquo;s passport, not a photo and a paragraph: what it
                has won, what condition it&rsquo;s in, who has owned it. The Blue Book sits alongside
                — average, median and range from completed sales, free for everyone and never behind
                the paid tier. We take no cut and hold no money; buyer and seller settle it between
                themselves, the way the hobby already does.
            </>
        ),
        links: [
            { href: "/market", label: "Browse the market →", id: "room-market-cta" },
            { href: "/market/guide", label: "Open the Blue Book →", id: "room-market-guide" },
        ],
    },
    {
        name: "The Registry",
        standfirst: "What the models actually are",
        Icon: BookOpen,
        body: (
            <>
                OF releases, the molds under them, and artist resins — with maker, sculptor, scale,
                finish and year. Look a model up instead of trying to recall whether that palomino was
                a 1994 or a 1995. Collectors correct and extend it, and a correction lands for
                everybody at once, which is the only way a catalog this size stays honest.
            </>
        ),
        links: [
            { href: "/catalog", label: "Search the Registry →", id: "room-registry-cta" },
            { href: "/reference", label: "Browse by maker →", id: "room-registry-makers" },
        ],
    },
    {
        name: "The Paddock",
        standfirst: "Where the hobby talks",
        Icon: Newspaper,
        body: (
            <>
                The feed, plus barns for breed circles, regional clubs and trading groups; an events
                calendar; and Help ID for when you have a body in hand and no idea what it is.
                Members only — it&rsquo;s a room, not a shop window.
            </>
        ),
        links: [{ href: "/signup?redirectTo=%2Ffeed", label: "Join and walk in →", id: "room-paddock-cta" }],
    },
];

export default function FiveRooms() {
    return (
        <section className="px-8 py-14" id="rooms" aria-labelledby="rooms-heading">
            <div className="mx-auto max-w-7xl">
                <div className="text-center">
                    <span className="ledger-tab" id="rooms-heading">
                        Getting your bearings
                    </span>
                    <div className="brass-heading mb-2 justify-center">
                        <span className="brass-heading-bar" aria-hidden="true" />
                        <h2 className="font-serif text-2xl font-extrabold">
                            Five <span className="text-forest">rooms</span>
                        </h2>
                    </div>
                    <p className="text-secondary-foreground mx-auto mb-10 max-w-[560px] text-base">
                        The site is laid out the way the hobby is. You&rsquo;ll know which door you
                        want.
                    </p>
                </div>

                <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-6 p-0">
                    {ROOMS.map(({ name, standfirst, Icon, body, links }) => (
                        <li key={name} className="flex">
                            <div className="ledger-paper flex flex-1 flex-col py-6 pr-6 transition-all hover:-translate-y-1 hover:shadow-md">
                                <div className="bg-forest/10 text-forest mb-4 flex h-12 w-12 items-center justify-center rounded-xl">
                                    <Icon size={24} strokeWidth={1.5} aria-hidden="true" />
                                </div>
                                <h3 className="text-foreground font-serif text-xl font-bold">{name}</h3>
                                <p className="text-forest m-0 mb-3 font-serif text-[0.72rem] tracking-[0.16em] uppercase">
                                    {standfirst}
                                </p>
                                <p className="text-secondary-foreground m-0 text-sm leading-relaxed">
                                    {body}
                                </p>
                                <div className="mt-auto flex flex-wrap gap-x-5 gap-y-1 pt-5">
                                    {links.map((link) => (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            id={link.id}
                                            className="text-forest text-xs font-semibold tracking-[0.08em] uppercase no-underline hover:underline"
                                        >
                                            {link.label}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
