/**
 * /learn/glossary — the hobby's language, explained for outsiders
 * (Wave 2 education). Fully static, anon-safe SSR: no auth, no
 * database — just the terms. Parchment working surface + brass
 * headings, consistent with the about/faq treatment. Every entry is
 * anchor-linkable (#lsq, #nan, …) for deep links from anywhere.
 */

import type { Metadata } from "next";
import Link from "next/link";

import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import { Button } from "@/components/ui/button";
import { GLOSSARY_ENTRIES, GLOSSARY_SECTIONS } from "./entries";

const TITLE = "Model Horse Glossary — OF, CM, LSQ & Every Showing Term";
const DESCRIPTION =
    "What do OF, CM, AR, LSQ, NAN, and NAMHSA actually mean? The model horse hobby's terms — finishes, showing formats, ring vocabulary, and organizations — explained honestly for newcomers.";

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: TITLE,
        description: DESCRIPTION,
        openGraph: {
            title: TITLE,
            description: DESCRIPTION,
            type: "article",
            siteName: "Model Horse Hub",
        },
    };
}

function glossaryJsonLd(baseUrl: string) {
    return {
        "@context": "https://schema.org",
        "@type": "DefinedTermSet",
        name: "Model Horse Hobby Glossary",
        description: DESCRIPTION,
        url: `${baseUrl}/learn/glossary`,
        hasDefinedTerm: GLOSSARY_ENTRIES.map((entry) => ({
            "@type": "DefinedTerm",
            name: entry.term,
            description: entry.def,
            url: `${baseUrl}/learn/glossary#${entry.id}`,
        })),
    };
}

export default function GlossaryPage() {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com";

    return (
        <ExplorerLayout noHeader>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(glossaryJsonLd(baseUrl)) }}
            />
            <div className="animate-fade-in-up mx-auto max-w-[860px]">
                <PageMasthead
                    icon="📖"
                    title="The Glossary"
                    subtitle="The hobby's language, explained honestly"
                    backHref="/learn"
                    backLabel="Learn"
                />

                <p className="mb-8 text-base leading-relaxed text-secondary-foreground">
                    Every hobby has a dialect, and ours is older than the internet. None of it is
                    meant to keep you out — it&apos;s just faster to say <strong>LSQ</strong> than
                    &ldquo;good enough to place at a live show.&rdquo; Here is what collectors and
                    showers actually mean, term by term. Link to any entry directly — every
                    definition has its own anchor.
                </p>

                {GLOSSARY_SECTIONS.map((section) => (
                    <section key={section.heading} className="mb-10">
                        <div className="brass-heading mb-4">
                            <span className="brass-heading-bar" aria-hidden="true" />
                            <h2 className="m-0 text-lg text-foreground">{section.heading}</h2>
                        </div>
                        <div className="ledger-paper p-6 md:p-8">
                            <dl className="m-0 flex flex-col gap-5">
                                {section.entries.map((entry) => (
                                    <div key={entry.id} id={entry.id} className="scroll-mt-24">
                                        <dt className="mb-1 flex flex-wrap items-baseline gap-2">
                                            <span className="text-base font-bold text-foreground">
                                                {entry.term}
                                            </span>
                                            <a
                                                href={`#${entry.id}`}
                                                className="text-xs font-semibold text-muted-foreground no-underline opacity-60 transition-opacity hover:opacity-100"
                                                aria-label={`Link to ${entry.term}`}
                                            >
                                                #
                                            </a>
                                        </dt>
                                        <dd className="m-0 text-sm leading-relaxed text-secondary-foreground">
                                            {entry.def}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    </section>
                ))}

                <div className="ledger-paper mb-12 p-6 text-center md:p-8">
                    <h2 className="mb-2 text-lg font-bold text-foreground">
                        Ready to use the vocabulary?
                    </h2>
                    <p className="mx-auto mb-4 max-w-[520px] text-sm leading-relaxed text-secondary-foreground">
                        The gentlest way into showing is an online photo show — no travel, no
                        packing boxes, and every term above starts making sense the first time you
                        enter.
                    </p>
                    <div className="flex flex-wrap justify-center gap-3">
                        <Button asChild>
                            <Link href="/learn/enter-your-first-photo-show">
                                Enter your first photo show
                            </Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link href="/shows">Browse shows</Link>
                        </Button>
                    </div>
                </div>
            </div>
        </ExplorerLayout>
    );
}
