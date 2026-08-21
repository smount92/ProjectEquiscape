/**
 * /faq — grouped by room, answered honestly.
 *
 * REWRITTEN FOR THE FIVE-ROOM SITE (August 2026). The old FAQ described
 * a site that no longer exists: a "Show Ring" as the main browse,
 * "Groups" with Notice Boards, community-voted shows as the norm, and
 * no mention of the Championship Series, the Market, the Paddock, barns
 * or the Deal Room. It is now grouped the way the site is, and it ends
 * with the things this site deliberately does NOT do.
 *
 * TWO RULES THIS FILE KEEPS:
 *
 * 1. THE NUMBERS ARE IMPORTED, NEVER TYPED. Every showing figure comes
 *    from the same constants the engines run on (points.ts, titles.ts,
 *    cardIssuance.ts), exactly as /shows/rules does, so the FAQ cannot
 *    drift from what actually happens in the ring.
 *
 * 2. NOTHING DARK IS DESCRIBED AS LIVE. No standings page (dark behind
 *    NEXT_PUBLIC_SHOW_STANDINGS), no premium add-horse forms (dark
 *    behind NEXT_PUBLIC_FORM_ENGINE). Only what a member sees today.
 *
 * SERVER COMPONENT, NO STATE. It used to be a "use client" accordion,
 * which meant search engines and Simple-Mode readers only ever got the
 * questions — the answers rendered on click. Native <details> puts every
 * answer in the HTML, costs no JavaScript, and still collapses.
 */

import Link from "next/link";
import type { Metadata } from "next";

import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import { Button } from "@/components/ui/button";
import {
    CARD_GATE,
    SEASON1_CARD_GATE,
    SEASON1_FINAL_SHOW_YEAR,
    STAKES_GATE,
} from "@/lib/shows/cardIssuance";
import { BEST_RESULTS_CAP, MIN_EXHIBITORS_FOR_POINTS, POINTS_CAP } from "@/lib/shows/points";
import {
    CH_CARDS_REQUIRED,
    CH_JUDGES_REQUIRED,
    CH_SHOWS_REQUIRED,
    ROM_POINTS,
    SUPERIOR_POINTS,
} from "@/lib/shows/titles";

const TITLE = "Model Horse Hub FAQ — Collecting, Showing, Buying & Selling";
const DESCRIPTION =
    "Straight answers about Model Horse Hub: cataloging your collection, how points, qualification cards and titles work in the MHH Championship Series, selling with no fees and no escrow, barns and the Paddock, and what this site deliberately doesn't do.";

export const metadata: Metadata = {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "/faq" },
    openGraph: {
        title: TITLE,
        description: DESCRIPTION,
        type: "website",
        siteName: "Model Horse Hub",
        url: "/faq",
    },
};

interface FaqItem {
    q: string;
    /** Plain text — rendered as-is AND used verbatim for FAQPage JSON-LD. */
    a: string;
    /** Optional "where to go next" links. Not part of the structured data. */
    links?: { href: string; label: string }[];
}

interface FaqSection {
    id: string;
    heading: string;
    blurb: string;
    items: FaqItem[];
}

const FAQ_SECTIONS: FaqSection[] = [
    {
        id: "collecting",
        heading: "Collecting",
        blurb: "The Stable, the Registry, and what stays private.",
        items: [
            {
                q: "What is the Stable?",
                a: "One entry per horse: the reference it came from, photos from every angle, its condition, and what you paid — that last part visible to you and nobody else. Filter the herd by mold, maker, finish or status, save the views you use most, and print a report with photos and values when your insurer asks what the shelves are worth.",
                links: [{ href: "/getting-started", label: "Getting Started" }],
            },
            {
                q: "Can I import a collection I already keep in a spreadsheet?",
                a: "Yes. Upload your spreadsheet and each row is fuzzy-matched against the 10,500+ entry reference catalog. You review and confirm the matches before anything is saved, so a bad guess never quietly becomes your data. Most people get a whole collection in during one afternoon.",
                links: [{ href: "/stable/import", label: "Import a spreadsheet" }],
            },
            {
                q: "What is the Registry, and what if my model isn't in it?",
                a: "The Registry is the reference catalog: plastic molds and the releases made from them, artist and factory resins, china, medallions, micro minis, and tack and props too — with maker, sculptor, scale, finish and year where somebody has filled them in. Customs deliberately aren't in it: a custom is a horse in somebody's stable, not a catalog entry, so mold pages gather the customs made from them instead. If your model isn't listed, add it by hand and carry on, then suggest it for the catalog.",
                links: [{ href: "/catalog", label: "Search the Registry" }],
            },
            {
                q: "Can I correct something in the Registry?",
                a: "Yes, and please do. You can suggest a correction, an addition, a removal or a photo, each with a reason attached, and a correction lands for everybody at once — that's the only way a catalog this size stays honest. Additions warn you about likely duplicates before they go in, because the same twenty sculpts once arrived twice under different makers. Curators who have had a lot of suggestions accepted can apply small factual fixes directly, and every change is listed in a public changelog.",
                links: [
                    { href: "/catalog/suggestions", label: "Suggest a change" },
                    { href: "/catalog/changelog", label: "Read the changelog" },
                ],
            },
            {
                q: "How many photos can I upload per horse?",
                a: "Five standard angles on every account — near side, off side, front, hindquarters, and belly or maker's mark — plus five flaw photos for rubs, chips and repairs. Flaw photos are free on every tier and always will be: documenting damage honestly is the point, and charging for it would make condition grades worth less. MHH Pro adds up to thirty extra detail shots per horse for close-ups and markings.",
            },
            {
                q: "Can anyone see what I paid for a horse?",
                a: "No. Purchase prices, estimated values and insurance notes are visible to you alone. They are never shown to another member, never travel with a horse when it sells, and are never handed to a third party. That isn't a policy we promise to follow — the database enforces it with row-level security, so the only automated reads are the ones you run yourself, like your insurance report.",
            },
            {
                q: "What do public, unlisted and private mean?",
                a: "Public horses can be seen and browsed by anyone, and only public horses can enter shows — judges and other entrants have to be able to see what placed. Unlisted horses are visible to anyone you send the link to but appear in no browse or search. Private horses are yours alone. You set this per horse and can change it whenever you like.",
            },
            {
                q: "What is a passport, and what is the Hoofprint?",
                a: "A passport is the horse's own page: its show record, its qualification cards, its condition grade, its ownership chain and its photo history. The Hoofprint is that chain of history itself — blank resin, prep, the artist's work, the shelf it lives on now — and it does not start over when the horse changes hands. Sell the horse and the next owner inherits a real history instead of your word for it.",
            },
        ],
    },
    {
        id: "showing",
        heading: "Showing",
        blurb: "The MHH Championship Series: points, cards, titles, and hosting.",
        items: [
            {
                q: "What is the MHH Championship Series?",
                a: "One published rulebook that every qualifying show on this site runs to, photo shows and live shows alike. Placings earn points toward season standings, a strong placing in a real class mints a qualification card that travels with the horse, and cards plus career points earn permanent titles. The show year runs May 1 to April 30, and only shows with published results count for anything.",
                links: [{ href: "/shows/rules", label: "Read the rulebook" }],
            },
            {
                q: "How do points work?",
                a: `First place earns the number of entries in the class, capped at ${POINTS_CAP}, and each place below earns one point less, never below 1. Winning a deep class is therefore worth more than winning a walkover. A class needs at least ${MIN_EXHIBITORS_FOR_POINTS} different exhibitors before it pays points at all — you can place, but you can't earn points beating only yourself — and only a horse-and-owner pair's best ${BEST_RESULTS_CAP} results count toward season standings, so the awards measure quality rather than attendance.`,
            },
            {
                q: "What is a qualification card, and how does a horse earn one?",
                a: `A 1st or 2nd place in a qualifying class mints one, but only when the class was real competition. Through the first season that means at least ${SEASON1_CARD_GATE.entries} entries from ${SEASON1_CARD_GATE.exhibitors} exhibitors — a starter provision that expires on 30 April ${SEASON1_FINAL_SHOW_YEAR + 1}. From then on it is at least ${CARD_GATE.entries} entries from ${CARD_GATE.exhibitors} exhibitors, permanently. A class of ${STAKES_GATE.entries} or more entries from ${STAKES_GATE.exhibitors} or more exhibitors mints a STAKES card instead — the big win, rare by design. Every card is stamped with the field it beat, as in "1st of 12, 8 exhibitors", and scratched entries never pad that number.`,
            },
            {
                q: "Can a buyer check a qualification card before paying for a horse?",
                a: "Yes, and that is the entire point. Every card has its own public verification page at a short link. Anyone can open it — no account, no login, no asking the seller to prove anything. Buying a horse with a show history? Ask the seller for its card links and read them yourself before the money moves.",
            },
            {
                q: "What titles can a horse earn?",
                a: `Three, and they are permanent. CH (Champion) takes ${CH_CARDS_REQUIRED} cards from ${CH_SHOWS_REQUIRED} different shows under at least ${CH_JUDGES_REQUIRED} different judges. ROM (Register of Merit) takes ${ROM_POINTS} career points, and SUP (Superior) takes ${SUPERIOR_POINTS}. Career points accumulate across every season with no cap, so steady quality gets a horse there without it ever being number one. Titles are granted automatically when results publish, and they are never revoked — a title, once earned, is part of that horse's story whoever owns it next.`,
            },
            {
                q: "What happens to a horse's points if it is sold mid-season?",
                a: "Points belong to the horse-and-owner pair on the entry. The seller keeps the season points they campaigned for, and the buyer starts fresh. The horse's own record carries both chapters, so nothing is lost — it just stops being one person's season.",
            },
            {
                q: "Are MHH qualification cards the same as NAN cards?",
                a: "No. MHH cards are this platform's own program, built on familiar NAMHSA-style class structures but issued, scored and verified by Model Horse Hub. They are not NAMHSA approval and they are not NAN qualifications, and we never describe them as such.",
            },
            {
                q: "Can I host my own show?",
                a: "Yes, and hosting is free for any member. Pick live or online, and a one-click template builds the whole classlist for you. A live show runs from your phone at the table: record placings, run champion callbacks, publish results when you're done. An online show takes photo entries during a window and you judge them at your kitchen table. Either way results flow into every entrant's permanent record automatically.",
                links: [{ href: "/shows/host", label: "Open a show" }],
            },
            {
                q: "Can I make my own show MHH-sanctioned?",
                a: "You can request it, and we grant it. Hosts don't tick their own box: for the first season, sanctioning is reviewed and granted by the platform, because a card is only worth something if the classes behind it were real. Ask for it when you open the show and you'll hear back. An unsanctioned show is still a proper show — it just doesn't mint cards or pay season points.",
            },
            {
                q: "I've never shown anything. Where do I start?",
                a: "An online photo show is the gentlest way in: no travel, no packing horses into padded cases, no standing at a table at seven in the morning. You take one good photograph of one horse, enter it in a class, and a judge tells you how it did. There's a step-by-step guide to exactly that, including how to take a photo that can win.",
                links: [
                    { href: "/learn/enter-your-first-photo-show", label: "Your First Photo Show" },
                    { href: "/learn/glossary", label: "The glossary" },
                ],
            },
        ],
    },
    {
        id: "buying-selling",
        heading: "Buying & selling",
        blurb: "The Market, the Blue Book, and how a deal actually gets done.",
        items: [
            {
                q: "How do I sell a horse?",
                a: 'Open the horse in your stable, choose Edit, and set its trade status to "For Sale" or "Open to Offers". Its passport becomes the listing — show record, qualification cards, condition grade and ownership history, right next to your asking price — and it appears in the Market. There is no separate listing form to fill in, because the listing is the horse.',
                links: [{ href: "/market", label: "Browse the Market" }],
            },
            {
                q: "What do you charge to sell?",
                a: "Nothing. No listing fee, no selling fee, no commission, no cut of the sale price. Subscriptions are how the site gets paid for, and the marketplace isn't part of that.",
            },
            {
                q: "How does payment work?",
                a: "Between you and the other person, exactly as the hobby already does it — PayPal, Venmo, a cheque, whatever you both agree. Model Horse Hub is not a payment processor, holds no money, and offers no escrow. What we do is keep the record: the offer, the terms you agreed, and what each side marked as sent and received.",
            },
            {
                q: "What is the Deal Room?",
                a: "The thread where a deal actually happens. One thread per deal — a sale, a commission or a trade — with the terms you agreed written down in the thread rather than scrolled past, counter-offers, a payment ledger that handles a single payment or a plan across months, and a stage both sides can see at a glance: talking, offer on the table, agreed, payment, on its way, settled. A payment is marked sent by whoever sent it and confirmed by whoever received it, and that's all it does. A late installment is recorded as late; nothing cancels a deal, forfeits money or relists a horse behind your back. What happens if a payment is missed is whatever your terms say it is, in your own words. We record your terms; we never write them.",
                links: [{ href: "/inbox", label: "Open your Deal Room" }],
            },
            {
                q: "What is the Blue Book?",
                a: "The price guide: average, median and range of what a given model has actually sold for, drawn from completed sales on this site rather than from asking prices. It covers the whole 10,500+ item catalog, it's free for everyone, and it is never going behind the paid tier. One honest caveat: because money moves off-platform, the sale prices are what buyer and seller reported. It's a well-founded starting point for pricing, not an appraisal.",
                links: [{ href: "/market/guide", label: "Open the Blue Book" }],
            },
            {
                q: "I'm hunting one specific model. Do I have to keep refreshing?",
                a: "No. Put the mold, release or resin on your Want List and Matchmaker watches the marketplace, telling you when a collector lists one. Matching works off the Registry entry, so a want linked to a catalog item is the one that gets found — if the thing you're after isn't cataloged yet you can still add it as a plain note, but you'll be checking that one yourself. Your Want List is private, and it isn't the same thing as favouriting a horse.",
                links: [{ href: "/wishlist", label: "Open your Want List" }],
            },
            {
                q: "Can I commission a custom, or take commissions myself?",
                a: "Yes to both. The Art Studio is a directory of customizers, finishwork artists, china painters and tack makers, each with their rates by scale, their written terms, and whether they're open right now — you can read it without an account. Request work and the commission walks a set order that both sides can see: requested, quoted, accepted, in progress, awaiting your approval, completed, delivered, with a photo portal for works in progress. A new studio opens closed on purpose, so nobody ends up with a queue they never agreed to. Money is between artist and client, the same as everywhere else here.",
                links: [{ href: "/studio", label: "The Art Studio" }],
            },
            {
                q: "How do seller ratings work?",
                a: "Every rating is tied to a completed transaction on the site, so nobody can review a person they never traded with. You can retract a review you wrote if you change your mind. The person being reviewed can never edit or remove a review about them — that's what makes the ratings worth reading.",
            },
        ],
    },
    {
        id: "community",
        heading: "Community",
        blurb: "The Paddock, barns, events, and finding people.",
        items: [
            {
                q: "What is The Paddock?",
                a: "The community room: one feed carrying members' posts, comments on public horses, barn chatter, and show results as they publish. It's members only — it's a room, not a shop window.",
                links: [{ href: "/feed", label: "The Paddock" }],
            },
            {
                q: "What are Barns?",
                a: "The clubs inside the Paddock: breed circles, regional groups, trading circles, or whatever a few collectors decided to start. Some barns are open to anyone; some are private and take a join request the barn's people approve. Each has its own notice board so conversations stay in one place instead of scattering across Facebook and Discord.",
                links: [{ href: "/community/groups", label: "Find a barn" }],
            },
            {
                q: "Is there an events calendar?",
                a: "Two, doing different jobs. The public Calendar is the hobby's calendar of record: MHH shows and outside listings — live halls, club days, other photo-show circuits — side by side, each stamped with where it lives, and readable without an account. The Events board inside the Paddock is where members post what they're running or attending. A show hosted here doesn't go on either one; it lives on the Shows page.",
                links: [
                    { href: "/calendar", label: "The Calendar" },
                    { href: "/community/events", label: "Events board" },
                ],
            },
            {
                q: "I have a model and no idea what it is. Can someone help?",
                a: "Post it to Help ID. You put up photos of what you have in hand and collectors who know the molds weigh in. It's the hobby's oldest favour, with a proper place to happen.",
                links: [{ href: "/community/help-id", label: "Help ID" }],
            },
            {
                q: "How do I find other collectors?",
                a: "The Members directory lists people you can follow, and the Show Ring lets you browse every public horse on the site — a good way to find someone who collects the way you do. Following someone puts their new horses, sales and show results in your feed.",
                links: [
                    { href: "/discover", label: "Members" },
                    { href: "/community", label: "The Show Ring" },
                ],
            },
        ],
    },
    {
        id: "account",
        heading: "Your account",
        blurb: "Signing up, what it costs, and getting your data back out.",
        items: [
            {
                q: "What do I need to sign up?",
                a: "An email address and a display alias, which is the name other members see. No real name, no mailing address, no phone number, and no card.",
            },
            {
                q: "Is Model Horse Hub really free?",
                a: "Yes, and the free tier is the hobby, not a trial: unlimited horses in your stable, enter shows, host shows, list horses for sale, read the Blue Book, print an insurance report. MHH Pro buys conveniences — extra detail photos, sale-history charts, market replacement values on insurance reports, printable cut-out show tags, a monthly report on what your collection has been doing. There's also a Studio tier aimed at artists taking commissions.",
                links: [{ href: "/upgrade", label: "See what Pro adds" }],
            },
            {
                q: "Which features are never paywalled?",
                a: "Anything that makes a record worth believing. Show results, qualification cards and their verification pages, condition grades, flaw photos, ownership history and the Blue Book are free permanently, for everyone. A proof behind a paywall is not a proof.",
            },
            {
                q: "Can I get my data back out?",
                a: "Any time, and you don't have to ask. Download your whole collection — horses, records and qualification cards — as a CSV, or generate a PDF report, straight from your settings. The database is backed up automatically every night. This hobby has been burned before: Model Horse Blab went dark for years and MH$P was hit by ransomware, so exports were built in from the first week. If Model Horse Hub ever has to wind down, every member gets real advance notice and a full export window first.",
                links: [{ href: "/settings", label: "Settings" }],
            },
            {
                q: "Can I delete my account?",
                a: "Yes, from your settings. Deleting removes your collection data, your photos and your private information. Provenance already attached to a horse that now belongs to somebody else stays with that horse — it is part of its history, and rewriting it would defeat the purpose of having a history at all.",
            },
            {
                q: "Are my photos used to train AI?",
                a: "No. Your photos, descriptions and artwork are not training data and are not for sale, and no feature on this site sends your collection to an AI service. The reference catalog was assembled with ordinary import scripts against public hobby sources — facts like maker, year and scale — never by pointing a scraper at somebody's gallery.",
                links: [{ href: "/about#ai-data-policy", label: "The full AI, data & copyright policy" }],
            },
        ],
    },
    {
        id: "limits",
        heading: "What this site doesn't do",
        blurb: "The honest list. Better you read it here than find out later.",
        items: [
            {
                q: "We don't hold money.",
                a: "There is no escrow, no checkout and no buyer protection fund. Money moves directly between buyer and seller by whatever method they agree, and if it goes astray we cannot claw it back. What we can do is show you a seller's rating history and let you verify a horse's record before you commit.",
            },
            {
                q: "We don't judge disputes.",
                a: "If a deal goes wrong we are not the referee, and we will not decide who was right. What we do is mark the deal disputed, freeze the horse so it can't be quietly relisted or transferred while the argument runs, and keep the record: who the parties were, what they agreed, what money moved and when, who confirmed what, and the conversation around it, in order. Either side can export that as one document. If you end up in front of a payment provider, that is a great deal better than forty unsorted screenshots. It states nothing you didn't state yourselves, and it reaches no conclusion about who is right.",
            },
            {
                q: "We aren't NAMHSA, and MHH cards aren't NAN cards.",
                a: "Model Horse Hub is not affiliated with NAMHSA and does not issue NAN qualifications. The Championship Series is our own program with its own published rules. It borrows the hobby's familiar class structures because that's what everyone knows, not because it carries anyone else's authority.",
            },
            {
                q: "We don't guarantee a model is what the seller says it is.",
                a: "We verify what happened on this site — that a placing came from a real class, that a card matches a real result, that an owner really transferred a horse. We can't inspect a model in somebody's house. Condition grades and flaw photos are the seller's honest work, and the ratings are how the community keeps that honest.",
            },
        ],
    },
];

const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_SECTIONS.flatMap((section) =>
        section.items.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
    ),
};

export default function FaqPage() {
    return (
        <ExplorerLayout noHeader>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
            />
            <div className="animate-fade-in-up mx-auto max-w-[860px]">
                <PageMasthead
                    icon="❓"
                    title="Questions & Answers"
                    subtitle="Grouped the way the site is"
                />

                <div className="text-secondary-foreground mb-8 space-y-4 text-base leading-[1.7]">
                    <p>
                        Straight answers, room by room. If something here contradicts what the site
                        actually does, that&apos;s a bug in this page — please{" "}
                        <Link href="/contact" className="text-forest font-semibold hover:underline">
                            tell us
                        </Link>
                        .
                    </p>
                    <nav aria-label="Jump to a section" className="flex flex-wrap gap-x-4 gap-y-2">
                        {FAQ_SECTIONS.map((section) => (
                            <a
                                key={section.id}
                                href={`#${section.id}`}
                                className="text-forest text-xs font-semibold tracking-[0.08em] uppercase no-underline hover:underline"
                            >
                                {section.heading} →
                            </a>
                        ))}
                    </nav>
                </div>

                <div className="flex flex-col gap-6">
                    {FAQ_SECTIONS.map((section) => (
                        <section
                            key={section.id}
                            id={section.id}
                            className="ledger-card scroll-mt-24"
                            aria-labelledby={`faq-${section.id}`}
                        >
                            <span className="ledger-tab" id={`faq-${section.id}`}>
                                {section.heading}
                            </span>
                            <p className="text-muted-foreground mt-0 mb-4 text-sm">{section.blurb}</p>

                            <div className="flex flex-col">
                                {section.items.map((item) => (
                                    <details
                                        key={item.q}
                                        className="border-forest/15 group border-t py-3 last:pb-0"
                                    >
                                        <summary className="text-foreground marker:content-[''] flex cursor-pointer list-none items-start justify-between gap-4 text-[0.95rem] font-bold [&::-webkit-details-marker]:hidden">
                                            <span>{item.q}</span>
                                            <span
                                                aria-hidden="true"
                                                className="text-forest mt-0.5 shrink-0 text-sm transition-transform group-open:rotate-45"
                                            >
                                                +
                                            </span>
                                        </summary>
                                        <div className="text-secondary-foreground pt-2 text-[0.95rem] leading-[1.75]">
                                            <p className="m-0">{item.a}</p>
                                            {item.links && (
                                                <p className="m-0 mt-2 flex flex-wrap gap-x-5 gap-y-1">
                                                    {item.links.map((link) => (
                                                        <Link
                                                            key={link.href}
                                                            href={link.href}
                                                            className="text-forest text-xs font-semibold tracking-[0.08em] uppercase no-underline hover:underline"
                                                        >
                                                            {link.label} →
                                                        </Link>
                                                    ))}
                                                </p>
                                            )}
                                        </div>
                                    </details>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>

                <div className="ledger-card mt-6 mb-12 text-center">
                    <h2 className="text-foreground mb-2 font-serif text-lg font-bold">
                        Still stuck?
                    </h2>
                    <p className="text-secondary-foreground mx-auto mb-4 max-w-[520px] text-sm leading-relaxed">
                        Ask us directly — it&apos;s two people reading, and questions that come up
                        twice usually end up on this page.
                    </p>
                    <div className="flex flex-wrap justify-center gap-3">
                        <Button asChild>
                            <Link href="/contact" id="faq-cta-contact">
                                Ask a question
                            </Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link href="/getting-started" id="faq-cta-getting-started">
                                Read Getting Started →
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </ExplorerLayout>
    );
}
