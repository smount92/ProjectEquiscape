import Link from "next/link";

/**
 * The front door's leather cover.
 *
 * `.leather-masthead` is full-bleed (no radius) and restyles what sits on
 * it: `.text-forest` reads brass, and any link that is NOT
 * `.text-engraved-brass` gets the pale leather border treatment. So the
 * primary CTA is the brass plate and the other two are quiet outlines —
 * no bg-forest utilities needed, and none would survive anyway.
 */
export default function LandingHero() {
    return (
        <section
            className="leather-panel stitched leather-masthead flex items-center justify-center px-6 py-12 md:py-16"
            id="hero"
        >
            <div className="animate-fade-in-up relative z-[1] max-w-[820px] text-center">
                <span className="text-forest mb-5 inline-flex items-center gap-2 rounded-full border px-5 py-1 font-serif text-[0.72rem] tracking-[0.18em] uppercase">
                    Model Horse Hub
                </span>

                <h1 className="text-engraved-light mb-5 font-serif text-[clamp(1.7rem,4.2vw,2.6rem)] leading-[1.15] font-extrabold tracking-[0.1em] uppercase">
                    Your herd, <span className="text-forest">on the record</span>
                </h1>

                <p className="text-secondary-foreground mx-auto mb-4 max-w-[640px] text-base leading-[1.7]">
                    One place to keep the herd, campaign it, and sell out of it. What&rsquo;s
                    different here is the record: a placing exists because a show was run on this
                    site, so every card on a horse links back to the class it was won in — the
                    judge, the date, the size of the field.
                </p>
                <p className="text-secondary-foreground mx-auto mb-7 max-w-[640px] text-base leading-[1.7]">
                    And it belongs to the horse. When the horse changes hands, the record goes with
                    it.
                </p>

                <div className="strap-nav mb-5 flex flex-wrap items-center justify-center gap-4">
                    <Link
                        href="/signup"
                        className="text-engraved-brass inline-flex min-h-[44px] items-center justify-center rounded-lg px-8 py-2.5 text-sm no-underline"
                        id="hero-cta-signup"
                    >
                        Create a free account
                    </Link>
                    <Link
                        href="/shows"
                        className="inline-flex min-h-[44px] items-center justify-center rounded-lg border px-8 py-2.5 text-sm no-underline"
                        id="hero-cta-shows"
                    >
                        See what&rsquo;s showing
                    </Link>
                    <Link
                        href="/market"
                        className="inline-flex min-h-[44px] items-center justify-center rounded-lg border px-8 py-2.5 text-sm no-underline"
                        id="hero-cta-market"
                    >
                        Browse the market
                    </Link>
                </div>

                <p className="text-muted-foreground text-xs leading-relaxed tracking-[0.03em]">
                    Free tier, no card asked for. Show records, condition grades and ownership
                    history stay free for everyone — those are the parts that have to be
                    trustworthy, so they are never sold.
                </p>
            </div>
        </section>
    );
}
