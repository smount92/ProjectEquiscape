import Link from "next/link";

/**
 * The differentiator, stated plainly.
 *
 * Everything else on this page is a feature list any site could write. This
 * section is the one claim no other model-horse platform can make, so it
 * gets its own surface (`.hoofprint-teaser-section`, the landing-only amber
 * wash) and it argues rather than asserts.
 */

const PROOFS: { title: string; body: string }[] = [
    {
        title: "Stamped with the field it beat",
        body: "A card records the size of the class and how many exhibitors were in it — 1st of 12, 8 exhibitors. Scratched entries never pad that number, and a class small enough to be a walkover mints nothing at all.",
    },
    {
        title: "Checkable by a stranger",
        body: "Every card has a public verification page. A buyer looks it up before the money moves, without a login and without asking the seller to prove anything.",
    },
    {
        title: "Tied to the horse, not the shelf",
        body: "Sell through Safe-Trade and the placings, cards, titles and photo history transfer with the model. The next owner inherits a real history instead of your word for it.",
    },
];

export default function TheRecord() {
    return (
        <section className="hoofprint-teaser-section" id="the-record" aria-labelledby="record-heading">
            <div className="ledger-paper mx-auto max-w-[760px] py-10 pr-8 text-left">
                <div className="mb-4">
                    <span className="ledger-tab" id="record-heading">
                        Why bother
                    </span>
                </div>

                <div className="brass-heading mb-5">
                    <span className="brass-heading-bar" aria-hidden="true" />
                    <h2 className="font-serif text-2xl font-extrabold">
                        A record you can <span className="text-forest">check</span>
                    </h2>
                </div>

                <p className="text-secondary-foreground mb-4 text-base leading-[1.7]">
                    Anyone can put &ldquo;NAN qualified&rdquo; in a sale listing. There has never been
                    a way for the buyer to check it, so the claim is worth about what it costs to type.
                </p>
                <p className="text-secondary-foreground mb-4 text-base leading-[1.7]">
                    On Model Horse Hub a placing exists because a show was run here. The class, the
                    judge, the date and the number of entries are all on file, and every card on a
                    horse&rsquo;s record links back to the class it came out of. Nothing is entered by
                    hand after the fact.
                </p>
                <p className="text-secondary-foreground mb-6 text-base leading-[1.7]">
                    The photo history sits underneath it — blank resin, prep, the artist&rsquo;s work,
                    the shelf it lives on now. That chain is the Hoofprint, and it does not start over
                    when the horse changes hands.
                </p>

                <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 p-0">
                    {PROOFS.map(({ title, body }) => (
                        <li key={title} className="ledger-tile">
                            <strong className="text-foreground block text-sm font-bold">{title}</strong>
                            <span className="text-secondary-foreground mt-1 block text-sm leading-relaxed">
                                {body}
                            </span>
                        </li>
                    ))}
                </ul>

                <p className="text-muted-foreground mt-6 mb-0 text-sm">
                    The scoring, the card thresholds and the title requirements are all published:{" "}
                    <Link
                        href="/shows/rules"
                        className="text-forest font-semibold no-underline hover:underline"
                        id="record-rules-link"
                    >
                        read the rulebook
                    </Link>
                    . The numbers on that page are read out of the same code that scores the shows, so
                    they cannot drift from what actually happens in the ring.
                </p>
            </div>
        </section>
    );
}
