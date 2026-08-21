import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function ClosingCta() {
    return (
        <section className="px-8 py-16 text-center" id="final-cta">
            <div className="animate-fade-in-up mx-auto max-w-[620px]">
                <div className="brass-heading mb-4 justify-center">
                    <span className="brass-heading-bar" aria-hidden="true" />
                    <h2 className="font-serif text-2xl font-extrabold">
                        Bring the <span className="text-forest">herd over</span>
                    </h2>
                </div>
                <p className="text-secondary-foreground mx-auto mb-8 max-w-[500px] leading-relaxed">
                    Start with one horse, or import the whole spreadsheet in an afternoon. No card
                    asked for. And you can look around first — the shows, the market, the Blue Book and
                    the Registry are all open without an account.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button asChild size="wide">
                        <Link href="/signup" id="final-cta-signup">
                            Create a free account
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="wide">
                        <Link href="/shows" id="final-cta-shows">
                            See what&rsquo;s showing →
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="wide">
                        <Link href="/catalog" id="final-cta-registry">
                            Search the Registry →
                        </Link>
                    </Button>
                </div>
            </div>
        </section>
    );
}
