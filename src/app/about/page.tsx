/**
 * /about — the story, the stance, and the limits.
 *
 * REWRITTEN FOR THE FIVE-ROOM SITE (August 2026). The old copy sold a
 * "digital stable" with a Show Ring, Groups and a Notice Board, and
 * closed with a roadmap of things that did not exist. All of that is
 * gone. Every claim on this page is either visible on the landing page,
 * published in /shows/rules, or enforced in code — nothing here promises
 * a feature.
 *
 * STAYS STATIC. The Supporters' Ledger reads through the cookie-less
 * anon RPC, so the page keeps its hourly revalidate and never touches
 * the SSR (cookie) client. Do not add a session read here.
 *
 * The #ai-data-policy anchor is linked from the landing page's Plain
 * Terms panel — AiDataPolicySection owns that id, so keep it mounted.
 */

import Link from "next/link";
import type { Metadata } from "next";

import AiDataPolicySection from "@/components/AiDataPolicySection";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import { Button } from "@/components/ui/button";
import { Lamp } from "lucide-react";
import { fetchSupportersLedger, formatSupporterSince } from "@/lib/supporter";

const TITLE = "About Model Horse Hub — Who Builds It, and What It's For";
const DESCRIPTION =
    "Model Horse Hub is built by two collectors: a place to catalog your model horses, campaign them in the MHH Championship Series, and sell out of your stable with a show record a buyer can actually verify. Free tier, no cut of sales, trust features never paywalled.";

export const metadata: Metadata = {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "/about" },
    openGraph: {
        title: TITLE,
        description: DESCRIPTION,
        type: "website",
        siteName: "Model Horse Hub",
        url: "/about",
    },
};

export const revalidate = 3600;

function Section({ id, tab, title, children }: { id: string; tab: string; title: string; children: React.ReactNode }) {
    return (
        <section className="ledger-card" aria-labelledby={`about-${id}`}>
            <span className="ledger-tab" id={`about-${id}`}>
                {tab}
            </span>
            <div className="brass-heading mb-4">
                <span className="brass-heading-bar" aria-hidden="true" />
                <h2 className="text-foreground m-0 font-serif text-xl font-bold">{title}</h2>
            </div>
            <div className="text-foreground flex flex-col gap-3 text-[0.95rem] leading-relaxed">{children}</div>
        </section>
    );
}

export default async function AboutPage() {
    // Only supporters who opted IN, via DEFINER RPC (migration 142).
    // Empty / RPC-not-deployed → the section renders nothing at all.
    const supporters = await fetchSupportersLedger();

    return (
        <ExplorerLayout noHeader>
            <div className="animate-fade-in-up mx-auto max-w-[860px]">
                <PageMasthead
                    icon="🐎"
                    title="About Model Horse Hub"
                    subtitle="Who builds it, and what it's for"
                />

                <div className="text-secondary-foreground mb-8 space-y-4 text-base leading-[1.7]">
                    <p>
                        Model Horse Hub is one place to keep the herd, campaign it, and sell out of
                        it. The site is laid out in five rooms: the <strong>Stable</strong> holds
                        what you own, <strong>Shows</strong> runs the MHH Championship Series, the{" "}
                        <strong>Market</strong> is where horses change hands, the{" "}
                        <strong>Registry</strong> says what the models actually are, and{" "}
                        <strong>The Paddock</strong> is where the hobby talks.
                    </p>
                    <p>
                        What&apos;s different here is the record. A placing exists because a show was
                        run on this site, so every card on a horse links back to the class it came out
                        of — the judge, the date, the size of the field. And it belongs to the horse.
                        When the horse changes hands, the record goes with it.
                    </p>
                </div>

                <div className="flex flex-col gap-6">
                    <Section id="people" tab="The people" title="Two collectors, no boardroom">
                        <p>
                            Model Horse Hub is <strong>Amanda</strong> and <strong>Stephen Mount</strong>,
                            a husband and wife. That is the whole company. No investors, no growth
                            team, nobody upstairs asking what the engagement numbers look like.
                        </p>
                        <p>
                            Amanda is the collector. She has spent years inside spreadsheets,
                            notebooks and Facebook albums trying to keep track of a growing herd, and
                            she knows the hobby from the inside — what LSQ means, why OF and CM
                            aren&apos;t the same thing, what a showholder actually needs at seven in
                            the morning on class day. Most of what&apos;s on this site started as
                            Amanda saying &ldquo;I wish this existed.&rdquo;
                        </p>
                        <p>
                            Stephen builds them: the catalog behind the Registry, the ring console
                            that has to work from a fairgrounds with one bar of signal, the
                            row-level security that keeps your purchase prices actually private.
                        </p>
                    </Section>

                    <Section id="why" tab="Why bother" title="The notebook, then the spreadsheet">
                        <p>
                            It starts the way it starts for everyone. A notebook. Then a spreadsheet.
                            Then a second spreadsheet because the first one got messy. Then Facebook
                            albums, and a vague memory of that palomino you sold in 2019 — what was
                            her name?
                        </p>
                        <p>
                            The bigger problem is that nothing in this hobby could be checked. Anyone
                            can type &ldquo;NAN qualified&rdquo; into a sale post, and a buyer has
                            never had a way to look it up. Condition grades meant whatever the seller
                            wanted them to mean. Show results lived in one host&apos;s spreadsheet
                            and died there when the laptop did.
                        </p>
                        <p>
                            So: one place for the herd, one published rulebook for the shows, and a
                            record a stranger can verify without asking anyone&apos;s permission.
                        </p>
                    </Section>

                    <Section id="rooms" tab="What’s here" title="What you can actually do today">
                        <ul className="m-0 list-disc space-y-2 pl-6">
                            <li>
                                <strong>Catalog the herd.</strong> One entry per horse — the
                                reference it came from, photos from every angle, condition, and what
                                you paid, that last part visible to you and nobody else. Filter by
                                mold, maker, finish or status, save the views you use, and print the
                                report when your insurer asks. Already keeping a spreadsheet?{" "}
                                <Link href="/stable/import" className="text-forest font-semibold hover:underline">
                                    Import it
                                </Link>
                                .
                            </li>
                            <li>
                                <strong>Show, and host shows.</strong> Photo shows and live shows,
                                run to one{" "}
                                <Link href="/shows/rules" className="text-forest font-semibold hover:underline">
                                    published rulebook
                                </Link>
                                . Placings pay points toward season standings, a 1st or 2nd in a
                                deep enough class mints a qualification card stamped with the field
                                it beat, and cards plus career points earn titles the horse keeps for
                                life. Hosting is free, and the ring console runs off a phone at the
                                table.
                            </li>
                            <li>
                                <strong>Buy and sell.</strong> A listing in{" "}
                                <Link href="/market" className="text-forest font-semibold hover:underline">
                                    the Market
                                </Link>{" "}
                                is the horse&apos;s passport, not a photo and a paragraph: what it
                                has won, what condition it&apos;s in, who has owned it. The{" "}
                                <Link href="/market/guide" className="text-forest font-semibold hover:underline">
                                    Blue Book
                                </Link>{" "}
                                sits alongside it with average, median and range from completed
                                sales.
                            </li>
                            <li>
                                <strong>Look a model up.</strong> The{" "}
                                <Link href="/catalog" className="text-forest font-semibold hover:underline">
                                    Registry
                                </Link>{" "}
                                holds OF releases, the molds under them, and artist resins, with
                                maker, sculptor, scale, finish and year. Collectors correct and
                                extend it, and a correction lands for everybody at once.
                            </li>
                            <li>
                                <strong>Talk to people.</strong>{" "}
                                <Link href="/feed" className="text-forest font-semibold hover:underline">
                                    The Paddock
                                </Link>{" "}
                                is the feed, plus barns for breed circles, regional clubs and trading
                                groups, an events board for what&apos;s happening off-site, and Help
                                ID for when you have a body in hand and no idea what it is.
                            </li>
                        </ul>
                    </Section>

                    <Section id="cost" tab="Money" title="What it costs">
                        <p>
                            The free tier covers the hobby: catalog the herd, enter shows, host
                            shows, list horses, read the Blue Book. Pro buys conveniences — extra
                            photo slots, price-history charts, printable show tags, a monthly ledger
                            of what the collection has been doing.
                        </p>
                        <p>
                            Nothing that makes a record worth believing is in it. Show results,
                            condition grades, ownership history and card verification are free
                            permanently. A proof behind a paywall is not a proof.
                        </p>
                        <p>
                            We take no cut of a sale. There is no listing fee, no selling fee, and no
                            commission —{" "}
                            <Link href="/upgrade" className="text-forest font-semibold hover:underline">
                                subscriptions
                            </Link>{" "}
                            are how this gets paid for.
                        </p>
                    </Section>

                    <Section id="limits" tab="The limits" title="What this site doesn't do">
                        <ul className="m-0 list-disc space-y-2 pl-6">
                            <li>
                                <strong>We don&apos;t hold your money.</strong> There is no escrow
                                and no checkout. Buyer and seller agree terms here and settle payment
                                between themselves, the way the hobby already does.
                            </li>
                            <li>
                                <strong>We don&apos;t judge disputes.</strong> If a deal goes wrong
                                we are not the referee. What we can do is keep the record — the
                                offer, the agreed terms, what was marked sent and received — so
                                whoever does referee has something to read.
                            </li>
                            <li>
                                <strong>We don&apos;t issue NAN cards.</strong> MHH qualification
                                cards are this platform&apos;s own program. They are not NAMHSA or
                                NAN paperwork, and we don&apos;t claim otherwise.
                            </li>
                            <li>
                                <strong>We don&apos;t train on your photos.</strong> They are not
                                training data and they are not for sale — see the policy below.
                            </li>
                        </ul>
                    </Section>

                    <Section id="continuity" tab="Continuity" title="Will this still be here next year?">
                        <p>
                            Fair question, and this hobby has earned the right to ask it. Model Horse
                            Blab, the hobby&apos;s longtime forum, went dark for almost two years.
                            MH$P — the sales hub this hobby leaned on since 1996 — was hit by
                            ransomware and never fully came back. We built this knowing that history,
                            not despite it.
                        </p>
                        <p>
                            So, plainly: your data is backed up automatically, every night. You can
                            export your whole collection — every horse, every record, every
                            qualification card — as a CSV, plus a PDF report, from your{" "}
                            <Link href="/settings" className="text-forest font-semibold hover:underline">
                                settings
                            </Link>
                            , whenever you want. You don&apos;t have to ask us and you don&apos;t
                            have to wait.
                        </p>
                        <p>
                            And if we ever have to wind Model Horse Hub down — we hope not, but
                            we&apos;re not going to promise you &ldquo;never&rdquo; — every member
                            gets real advance notice and a full export window before anything shuts
                            off. Your herd&apos;s history belongs to you.
                        </p>
                    </Section>
                </div>

                {/* Supporters' Ledger — only renders when someone has opted in.
                    Cosmetic recognition for "keep the lights on" contributions;
                    supporters get nothing else, deliberately. */}
                {supporters.length > 0 && (
                    <section className="ledger-card mt-6" aria-labelledby="about-supporters">
                        <span className="ledger-tab" id="about-supporters">
                            The Supporters&rsquo; Ledger
                        </span>
                        <p className="text-foreground mb-4 text-[0.95rem] leading-relaxed">
                            These collectors chip in a little each year to keep the lights on. It
                            buys them nothing — no features, no priority, no fine print — because
                            the parts that matter stay free for everyone. Just this line, a brass
                            plaque on their profile, and our lasting gratitude.
                        </p>
                        <ul className="m-0 grid list-none grid-cols-1 gap-x-8 gap-y-2 p-0 sm:grid-cols-2">
                            {supporters.map((supporter) => {
                                const sinceLabel = formatSupporterSince(supporter.supporter_since);
                                return (
                                    <li
                                        key={supporter.alias_name}
                                        className="flex items-baseline justify-between gap-3 border-b border-dotted border-(--brass) pb-1 text-sm"
                                    >
                                        <Link
                                            href={`/profile/${encodeURIComponent(supporter.alias_name)}`}
                                            className="inline-flex items-center gap-1.5 font-semibold no-underline"
                                        >
                                            <Lamp className="h-3.5 w-3.5 shrink-0 text-(--brass)" aria-hidden="true" />
                                            @{supporter.alias_name}
                                        </Link>
                                        {sinceLabel && (
                                            <span className="text-muted-foreground shrink-0 text-xs">
                                                since {sinceLabel}
                                            </span>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                )}

                {/* AI, Data Collection, and Copyright Policy — owns #ai-data-policy */}
                <div className="mt-10">
                    <AiDataPolicySection />
                </div>

                <div className="ledger-card mb-12 text-center">
                    <h2 className="text-foreground mb-2 font-serif text-lg font-bold">
                        Bring the herd over
                    </h2>
                    <p className="text-secondary-foreground mx-auto mb-4 max-w-[520px] text-sm leading-relaxed">
                        Start with one horse, or import the whole spreadsheet in an afternoon. No card
                        asked for. And you can look around first — the shows, the Market, the Blue
                        Book and the Registry are all open without an account.
                    </p>
                    <div className="flex flex-wrap justify-center gap-3">
                        <Button asChild>
                            <Link href="/signup" id="about-cta-signup">
                                Create a free account
                            </Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link href="/getting-started" id="about-cta-getting-started">
                                Read Getting Started →
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </ExplorerLayout>
    );
}
