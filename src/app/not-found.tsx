import Link from "next/link";
import { BookOpen, Camera, Home, Newspaper, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Root 404 — every notFound() in the app lands here, including stale show
 * links shared to Facebook and passports that have since been deleted.
 *
 * Two rules this page has to keep. First: the doors must work for ANONYMOUS
 * visitors, because most people who hit a dead link arrive logged out. The
 * old sole "Back to Stable" button bounced them straight into the login
 * wall; /dashboard is still offered but never alone. Second: no data reads
 * — a 404 that queries can 500, and this is the page that catches the 500s.
 *
 * Doors and icons match Header.tsx and landing/FiveRooms.tsx so the hallway
 * is the same hallway wherever you meet it.
 */

const ROOMS: { href: string; name: string; blurb: string; Icon: LucideIcon; id: string }[] = [
    {
        href: "/dashboard",
        name: "The Stable",
        blurb: "Everything you own",
        Icon: Home,
        id: "notfound-stable",
    },
    {
        href: "/shows",
        name: "Shows",
        blurb: "The championship series",
        Icon: Camera,
        id: "notfound-shows",
    },
    {
        href: "/market",
        name: "The Market",
        blurb: "Priced by the record",
        Icon: TrendingUp,
        id: "notfound-market",
    },
    {
        href: "/catalog",
        name: "The Registry",
        blurb: "What the models are",
        Icon: BookOpen,
        id: "notfound-registry",
    },
    {
        href: "/feed",
        name: "The Paddock",
        blurb: "Where the hobby talks",
        Icon: Newspaper,
        id: "notfound-paddock",
    },
];

export default function NotFound() {
    return (
        <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 md:py-16">
            <div className="leather-band stitched mb-6 rounded-xl px-6 py-8 text-center">
                <p
                    className="relative z-[1] m-0 font-serif text-[0.7rem] tracking-[0.22em] uppercase"
                    style={{ color: "var(--leather-text-muted)" }}
                >
                    Error 404
                </p>
                <h1
                    className="relative z-[1] m-0 mt-2 font-serif text-3xl font-bold tracking-[0.06em] md:text-4xl"
                    style={{ color: "var(--leather-text)" }}
                >
                    This stall is empty
                </h1>
                <p
                    className="relative z-[1] mx-auto m-0 mt-3 max-w-md text-sm leading-relaxed"
                    style={{ color: "var(--leather-text-soft)" }}
                >
                    Nothing lives at this address. The page may have moved, the show may have closed,
                    or the link may have been mistyped somewhere along the way.
                </p>
            </div>

            <div className="ledger-paper py-6">
                <span className="ledger-tab">Try another door</span>
                <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
                    {ROOMS.map(({ href, name, blurb, Icon, id }) => (
                        <li key={href} className="flex">
                            <Link
                                href={href}
                                id={id}
                                className="border-input flex flex-1 items-center gap-3 rounded-md border border-transparent bg-black/[0.02] px-4 py-3 no-underline transition-all hover:border-input hover:bg-black/[0.06] hover:no-underline"
                            >
                                <span className="bg-forest/10 text-forest flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                                    <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
                                </span>
                                <span className="min-w-0">
                                    <span className="text-foreground block font-serif text-sm font-bold">
                                        {name}
                                    </span>
                                    <span className="text-secondary-foreground block text-xs">{blurb}</span>
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>

                <p className="text-muted-foreground m-0 mt-4 text-xs">
                    Looking for something specific?{" "}
                    <Link href="/catalog" className="text-forest font-semibold">
                        Search the Registry
                    </Link>{" "}
                    or{" "}
                    <Link href="/contact" className="text-forest font-semibold">
                        tell us what broke
                    </Link>
                    .
                </p>
            </div>
        </div>
    );
}
