import Link from "next/link";

/**
 * Money and data, said out loud on the front door rather than buried on a
 * pricing page. Two commitments the owner has already ruled on: trust
 * features are never paywalled, and nothing here trains on member photos.
 */
export default function PlainTerms() {
    return (
        <section className="px-8 py-14" id="plain-terms" aria-labelledby="terms-heading">
            <div className="ledger-paper mx-auto max-w-[760px] py-8 pr-8">
                <span className="ledger-tab" id="terms-heading">
                    Plain terms
                </span>

                <div className="brass-heading mb-5">
                    <span className="brass-heading-bar" aria-hidden="true" />
                    <h2 className="font-serif text-xl font-extrabold">
                        What it costs, and what we do with your <span className="text-forest">things</span>
                    </h2>
                </div>

                <p className="text-secondary-foreground mb-4 text-base leading-[1.7]">
                    The free tier covers the hobby: catalog the herd, enter shows, host shows, list
                    horses, read the Blue Book. Pro buys extra photo slots, price-history charts,
                    printable show tags and a monthly ledger of what the collection has been doing.
                </p>
                <p className="text-secondary-foreground mb-4 text-base leading-[1.7]">
                    Nothing that makes a record worth believing is in it. Show results, condition
                    grades, ownership history and card verification are free permanently — a proof
                    behind a paywall is not a proof.
                </p>
                <p className="text-secondary-foreground mb-0 text-base leading-[1.7]">
                    Your photos are not training data, and they are not for sale. The Registry was
                    assembled with ordinary import scripts against public hobby sources, not by
                    pointing a scraper at somebody&rsquo;s gallery.
                </p>

                <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
                    <Link
                        href="/upgrade"
                        className="text-forest text-xs font-semibold tracking-[0.08em] uppercase no-underline hover:underline"
                        id="terms-upgrade-link"
                    >
                        See what Pro adds →
                    </Link>
                    <Link
                        href="/about#ai-data-policy"
                        className="text-forest text-xs font-semibold tracking-[0.08em] uppercase no-underline hover:underline"
                        id="terms-policy-link"
                    >
                        AI, data &amp; copyright policy →
                    </Link>
                </div>
            </div>
        </section>
    );
}
