/**
 * /learn — the education shelf (Wave 2). A small public hub for the
 * hobby guides so the footer, shows, and glossary anchors all have a
 * home to point at. Static, anon-safe SSR.
 */

import type { Metadata } from "next";
import Link from "next/link";

import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";

const TITLE = "Learn the Model Horse Hobby";
const DESCRIPTION =
    "New to model horses or model horse showing? Start here: a plain-spoken glossary of the hobby's terms and a step-by-step guide to entering your first photo show.";

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: TITLE,
        description: DESCRIPTION,
        openGraph: {
            title: TITLE,
            description: DESCRIPTION,
            type: "website",
            siteName: "Model Horse Hub",
        },
    };
}

const GUIDES = [
    {
        href: "/learn/glossary",
        icon: "📖",
        title: "The Glossary",
        blurb: "OF, CM, LSQ, NAN, body-box… the hobby's language, explained honestly for outsiders — every term anchor-linkable.",
    },
    {
        href: "/learn/enter-your-first-photo-show",
        icon: "📸",
        title: "Enter Your First Photo Show",
        blurb: "A warm, step-by-step walk from finding an open show to your first results — including how to take a photo that can win.",
    },
] as const;

export default function LearnPage() {
    return (
        <ExplorerLayout noHeader>
            <div className="animate-fade-in-up mx-auto max-w-[860px]">
                <PageMasthead
                    icon="🎓"
                    title="Learn"
                    subtitle="Guides to the hobby, for newcomers and old hands"
                />

                <p className="mb-8 text-base leading-relaxed text-secondary-foreground">
                    The model horse hobby is deep — decades of terms, formats, and unwritten
                    rules. These guides are the written version: plain-spoken, honest about the
                    quirks, and free to read with or without an account.
                </p>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {GUIDES.map((guide) => (
                        <Link
                            key={guide.href}
                            href={guide.href}
                            className="ledger-paper block p-8 no-underline transition-transform duration-300 hover:-translate-y-1"
                        >
                            <div className="mb-3 text-3xl" aria-hidden="true">
                                {guide.icon}
                            </div>
                            <h2 className="mb-2 text-lg font-bold text-foreground">{guide.title}</h2>
                            <p className="m-0 text-sm leading-relaxed text-secondary-foreground">
                                {guide.blurb}
                            </p>
                            <span className="mt-3 inline-block text-sm font-semibold text-forest">
                                Read the guide →
                            </span>
                        </Link>
                    ))}
                </div>

                <p className="mt-10 mb-12 text-sm text-secondary-foreground">
                    Looking for how the site itself works? See{" "}
                    <Link href="/getting-started" className="font-semibold text-forest underline decoration-2 underline-offset-2">
                        Getting Started
                    </Link>{" "}
                    and the{" "}
                    <Link href="/faq" className="font-semibold text-forest underline decoration-2 underline-offset-2">
                        FAQ
                    </Link>
                    .
                </p>
            </div>
        </ExplorerLayout>
    );
}
