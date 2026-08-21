/**
 * /getting-started — the new member's first week.
 *
 * REWRITTEN FOR THE FIVE-ROOM SITE (August 2026). The old version walked
 * people through a "Financial Vault", a "Show Ring" browse and a Want
 * List as if those were the site's spine; it never mentioned the
 * Championship Series, barns, the Paddock or the Market. This version
 * follows the actual arc — add a horse → enter a show → join a barn →
 * browse the market — and every route it links is one that exists.
 *
 * STATIC on purpose: no session read, no `createClient()`. This is an
 * SEO landing surface for "how do I start" traffic and it must render
 * without a database round trip.
 *
 * Do not describe the premium add-horse forms here: they ship dark
 * behind NEXT_PUBLIC_FORM_ENGINE and the legacy form is what a member
 * actually sees. The wording below is true of either.
 */

import Link from "next/link";
import type { Metadata } from "next";

import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import { Button } from "@/components/ui/button";

const TITLE = "Getting Started — Your First Week on Model Horse Hub";
const DESCRIPTION =
    "New here? Add your first model horse, enter your first show in the MHH Championship Series, join a barn in The Paddock, and browse the Market. A step-by-step first week, with nothing you have to pay for.";

export const metadata: Metadata = {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "/getting-started" },
    openGraph: {
        title: TITLE,
        description: DESCRIPTION,
        type: "article",
        siteName: "Model Horse Hub",
        url: "/getting-started",
    },
};

function StepHeading({ number, title }: { number: number; title: string }) {
    return (
        <div className="brass-heading mb-4">
            <span className="brass-heading-bar" aria-hidden="true" />
            <h2 className="text-foreground m-0 font-serif text-lg font-bold">
                Step {number} — {title}
            </h2>
        </div>
    );
}

function Card({ children }: { children: React.ReactNode }) {
    return (
        <div className="ledger-card text-foreground space-y-4 text-[0.95rem] leading-relaxed">{children}</div>
    );
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
    return (
        <Link href={href} className="text-forest font-semibold hover:underline">
            {children}
        </Link>
    );
}

export default function GettingStartedPage() {
    return (
        <ExplorerLayout noHeader>
            <div className="animate-fade-in-up mx-auto max-w-[860px]">
                <PageMasthead
                    icon="🚀"
                    title="Getting Started"
                    subtitle="Your first week, in the order it actually goes"
                />

                <div className="text-secondary-foreground mb-8 space-y-4 text-base leading-[1.7]">
                    <p>
                        The site is five rooms. The <strong>Stable</strong> holds what you own,{" "}
                        <strong>Shows</strong> runs the MHH Championship Series, the{" "}
                        <strong>Market</strong> is where horses change hands, the{" "}
                        <strong>Registry</strong> says what the models actually are, and{" "}
                        <strong>The Paddock</strong> is where the hobby talks. You don&apos;t have to
                        visit them in that order, but this is the order most people find useful.
                    </p>
                    <p>
                        Everything below is on the free tier. No card is asked for at any point.
                    </p>
                </div>

                {/* Step 1 */}
                <section className="mb-8">
                    <StepHeading number={1} title="Put one horse in your Stable" />
                    <Card>
                        <p>
                            Open <A href="/add-horse">Add to Stable</A> and start with the model
                            you&apos;d grab first in a fire. The form asks for photos, then a{" "}
                            <strong>reference match</strong> — search the{" "}
                            <A href="/catalog">Registry</A> by name, mold or maker and it fills in
                            mold, manufacturer, scale and year for you. If your model isn&apos;t
                            listed, skip that step and enter it by hand, or suggest it for the
                            catalog.
                        </p>
                        <p>
                            Then the horse&apos;s <strong>identity</strong> — name, finish type,
                            condition grade — and, if you want it, what you paid.{" "}
                            <strong>Purchase prices, values and insurance notes are yours alone.</strong>{" "}
                            No other member can see them, they never travel with a horse when it
                            sells, and the database enforces that with row-level security rather
                            than a promise.
                        </p>
                        <p>
                            Photos: five standard angles on every account — near side, off side,
                            front, hindquarters, belly and maker&apos;s mark — plus five{" "}
                            <strong>flaw photos</strong> for rubs and chips, also free on every
                            tier. Documenting damage honestly is the whole point, so it is never
                            something you have to pay for. Pro adds up to thirty extra detail shots.
                        </p>
                        <p className="m-0">
                            Already keeping a spreadsheet? <A href="/stable/import">Import it</A> —
                            each row is matched against the catalog and you confirm the matches
                            before anything is saved. In a hurry?{" "}
                            <A href="/add-horse/quick">Quick Add</A> gets a horse in with the bare
                            minimum; you can fill in the rest later.
                        </p>
                    </Card>
                </section>

                {/* Step 2 */}
                <section className="mb-8">
                    <StepHeading number={2} title="Enter a show" />
                    <Card>
                        <p>
                            <A href="/shows">Shows</A> is open to everyone, account or not. Shows are
                            shelved by stage — the <strong>Open now</strong> shelf is taking entries
                            right this minute. Photo shows are judged from your photographs; live
                            shows happen on tables in a hall somewhere.
                        </p>
                        <p>
                            Two things to do before you enter: set the horse to{" "}
                            <strong>public</strong> (judges and entrants have to be able to see what
                            placed), and give it a breed, gender and age on its edit page. That breed
                            assignment is what a breed-halter judge weighs the model against. If
                            something isn&apos;t eligible for a class, the entry form tells you why —
                            there is nothing to memorize.
                        </p>
                        <p>
                            A show marked <strong>🏅 MHH Sanctioned</strong> runs to the{" "}
                            <A href="/shows/rules">Championship Series rulebook</A>: placings pay
                            season points, first place is worth the size of the class, and a 1st or
                            2nd in a class with real competition mints a{" "}
                            <strong>qualification card</strong> stamped with the field it beat.
                            Cards and career points earn CH, ROM and SUP — titles the horse keeps for
                            the rest of its life, whoever owns it next.
                        </p>
                        <p className="m-0">
                            Never shown anything before? Read{" "}
                            <A href="/learn/enter-your-first-photo-show">
                                Your First Photo Show
                            </A>{" "}
                            first — it covers finding a show, taking a photo that can win, and what
                            happens after results publish.
                        </p>
                    </Card>
                </section>

                {/* Step 3 */}
                <section className="mb-8">
                    <StepHeading number={3} title="Walk into The Paddock and join a barn" />
                    <Card>
                        <p>
                            <A href="/feed">The Paddock</A> is the community room: one feed carrying
                            posts, comments on public horses, barn chatter, and show results as they
                            publish. It&apos;s members only — a room, not a shop window.
                        </p>
                        <p>
                            <A href="/community/groups">Barns</A> are the clubs inside it: breed
                            circles, regional groups, trading circles, or whatever a few people
                            decided to start. Some are open, some are private and take a join
                            request. Join one or two that match how you collect; that is where the
                            site stops feeling like a database.
                        </p>
                        <p className="m-0">
                            Also down that hallway: <A href="/community/events">Events</A>, a board
                            for live shows, meetups and swap meets happening off-site;{" "}
                            <A href="/community/help-id">Help ID</A>, for when you have a body in
                            hand and no idea what it is; <A href="/discover">Members</A>, to find
                            collectors worth following; and the{" "}
                            <A href="/community">Show Ring</A>, where you can browse every public
                            horse on the site.
                        </p>
                    </Card>
                </section>

                {/* Step 4 */}
                <section className="mb-8">
                    <StepHeading number={4} title="Browse the Market" />
                    <Card>
                        <p>
                            A listing in <A href="/market">the Market</A> is the horse&apos;s
                            passport rather than a photo and a paragraph: what it has won, what
                            condition it&apos;s in, who has owned it, next to the asking price. Every
                            qualification card has a public verification page, so you can check a
                            claim yourself before you commit to anything.
                        </p>
                        <p>
                            Wondering what something is worth? The{" "}
                            <A href="/market/guide">Blue Book</A> gives average, median and range
                            from completed sales on the site, model by model. It is free for
                            everyone and it always will be.
                        </p>
                        <p className="m-0">
                            Hunting one specific model? Put it on your{" "}
                            <A href="/wishlist">Want List</A> and Matchmaker tells you when a
                            collector lists one, instead of you refreshing this page every morning.
                            Pick the model out of the Registry when you add it — that&apos;s the link
                            Matchmaker searches on. Your Want List is private.
                        </p>
                    </Card>
                </section>

                {/* When you're ready */}
                <section className="mb-8">
                    <div className="brass-heading mb-4">
                        <span className="brass-heading-bar" aria-hidden="true" />
                        <h2 className="text-foreground m-0 font-serif text-lg font-bold">
                            When you&apos;re ready
                        </h2>
                    </div>
                    <Card>
                        <p>
                            <strong>Sell out of your stable.</strong> Open a horse, choose Edit, and
                            set its trade status to <em>For Sale</em> or <em>Open to Offers</em>. Its
                            passport becomes the listing — record, condition, ownership history and
                            all. Offers and negotiation happen in the{" "}
                            <A href="/inbox">Deal Room</A>: one thread per deal, with the agreed
                            terms and payments written down rather than scrolled past. We take no
                            cut and hold no money; you and the buyer settle payment between
                            yourselves.
                        </p>
                        <p>
                            <strong>Host a show.</strong> Hosting is free and any member can do it.{" "}
                            <A href="/shows/host">Open a show</A>, pick live or online, and a
                            one-click template builds the classlist. Live shows run from a phone at
                            the table: record placings, run champion callbacks, publish when
                            you&apos;re done. Online shows take photo entries during a window and you
                            judge them at your kitchen table.
                        </p>
                        <p className="m-0">
                            <strong>Commission something, or take commissions.</strong> The{" "}
                            <A href="/studio">Art Studio</A> is the directory of customizers,
                            finishwork artists, china painters and tack makers — rates by scale,
                            written terms, and whether each one is open right now. Browsing it takes
                            no account. If you make horses for other people, you can open a studio of
                            your own in there.
                        </p>
                    </Card>
                </section>

                {/* Settings */}
                <section className="mb-8">
                    <div className="brass-heading mb-4">
                        <span className="brass-heading-bar" aria-hidden="true" />
                        <h2 className="text-foreground m-0 font-serif text-lg font-bold">
                            Two minutes in Settings
                        </h2>
                    </div>
                    <Card>
                        <ul className="m-0 list-disc space-y-2 pl-6">
                            <li>Add an avatar and a line of bio so people know who they&apos;re talking to.</li>
                            <li>Set your notification preferences before show results start landing.</li>
                            <li>
                                Export your collection to CSV any time you like — your data is never
                                trapped here.
                            </li>
                            <li>
                                Turn on <strong>Simple Mode</strong> for high-contrast, large text.
                                It&apos;s in the account menu when you&apos;re signed in, and it is
                                genuinely useful for judging photo shows.
                            </li>
                        </ul>
                        <p className="m-0">
                            <A href="/settings">Open Settings →</A>
                        </p>
                    </Card>
                </section>

                <div className="ledger-card mb-12 text-center">
                    <h2 className="text-foreground mb-2 font-serif text-lg font-bold">
                        Start with one horse
                    </h2>
                    <p className="text-secondary-foreground mx-auto mb-4 max-w-[520px] text-sm leading-relaxed">
                        Everything else follows from having something in the Stable. Stuck on a word?
                        The <A href="/learn/glossary">glossary</A> explains the hobby&apos;s
                        vocabulary without assuming you already know it.
                    </p>
                    <div className="flex flex-wrap justify-center gap-3">
                        <Button asChild>
                            <Link href="/add-horse" id="getting-started-cta-add">
                                Add your first horse
                            </Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link href="/shows" id="getting-started-cta-shows">
                                See what&apos;s showing →
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </ExplorerLayout>
    );
}
