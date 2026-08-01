/**
 * /learn/enter-your-first-photo-show — the warm on-ramp (Wave 2
 * education). A step-by-step first-entry guide that reflects THIS
 * site's actual flow: find a show → get show-ready → take the photo
 * → enter → what happens after. Fully static, anon-safe SSR.
 * Parchment working surface + brass headings, consistent with the
 * about/faq treatment. Article + FAQPage JSON-LD.
 */

import type { Metadata } from "next";
import Link from "next/link";

import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import { Button } from "@/components/ui/button";

const TITLE = "How to Enter Your First Model Horse Photo Show";
const DESCRIPTION =
    "Never shown a model horse before? A warm, step-by-step guide to entering your first online photo show: finding a show, getting your model show-ready, taking a photo that can win, and what happens after you enter.";

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

const FAQ = [
    {
        q: "Do I need to pay to enter a photo show?",
        a: "Model Horse Hub doesn't charge you to browse shows, enter classes, or upload your show photos — every account gets 5 show photos per horse, free. An individual show host may list their own entry fee in the show's rules, so read the show page before entering.",
    },
    {
        q: "Do I need a fancy camera?",
        a: "No. A phone camera in good daylight beats an expensive camera in a dim room. What matters is focus, a level camera at the model's height, and the whole horse in frame — all technique, no equipment.",
    },
    {
        q: "Do I need to be experienced — or have an expensive model — to enter?",
        a: "No. Classes are judged on condition, realism, and presentation, not price tags, and every experienced shower's first show was also their first show. Enter, read the results, look at what placed above you, and your second show will already be better.",
    },
    {
        q: "What do I win?",
        a: "Placings post to the show page and flow into your horse's permanent show record on its passport. If your horse takes 1st or 2nd in a qualifying class at a qualifying show, it also earns an MHH Qualification Card — a verifiable record that stays with the horse even if it's sold one day.",
    },
] as const;

function articleJsonLd(baseUrl: string) {
    return {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: TITLE,
        description: DESCRIPTION,
        url: `${baseUrl}/learn/enter-your-first-photo-show`,
        author: { "@type": "Organization", name: "Model Horse Hub" },
        publisher: { "@type": "Organization", name: "Model Horse Hub" },
    };
}

function faqJsonLd() {
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQ.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
    };
}

function StepHeading({ number, title }: { number: number; title: string }) {
    return (
        <div className="brass-heading mb-4">
            <span className="brass-heading-bar" aria-hidden="true" />
            <h2 className="m-0 text-lg text-foreground">
                Step {number} — {title}
            </h2>
        </div>
    );
}

export default function FirstPhotoShowPage() {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://modelhorsehub.com";

    return (
        <ExplorerLayout noHeader>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd(baseUrl)) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()) }}
            />
            <div className="animate-fade-in-up mx-auto max-w-[860px]">
                <PageMasthead
                    icon="📸"
                    title="Your First Photo Show"
                    subtitle="A step-by-step guide to entering"
                    backHref="/learn"
                    backLabel="Learn"
                />

                <div className="mb-10 space-y-4 text-base leading-relaxed text-secondary-foreground">
                    <p>
                        If you&apos;ve never shown a model horse, an online photo show is the
                        gentlest way in. There&apos;s no travel, no packing a hundred horses into
                        padded cases, no standing at a table at seven in the morning. You take one
                        good photograph of one horse you love, enter it in a class, and a judge —
                        or the community — tells you how it did. That&apos;s the whole ritual, and
                        it&apos;s been the hobby&apos;s welcome mat since photo shows ran by mail.
                    </p>
                    <p>
                        Here&apos;s exactly how it works on Model Horse Hub, start to finish. New
                        to the vocabulary? Keep the{" "}
                        <Link
                            href="/learn/glossary"
                            className="font-semibold text-forest underline decoration-2 underline-offset-2"
                        >
                            glossary
                        </Link>{" "}
                        open in another tab.
                    </p>
                </div>

                {/* Step 1 */}
                <section className="mb-10">
                    <StepHeading number={1} title="Find a show" />
                    <div className="ledger-paper space-y-4 p-6 text-sm leading-relaxed text-secondary-foreground md:p-8">
                        <p>
                            Head to the{" "}
                            <Link href="/shows" className="font-semibold text-forest underline decoration-2 underline-offset-2">
                                shows page
                            </Link>{" "}
                            — browsing is open to everyone, no account needed. Shows are shelved by
                            stage; the <strong>Open now</strong> shelf is the one you want: those
                            shows are accepting entries at this moment.
                        </p>
                        <p className="m-0">On each show card, three things matter for a first-timer:</p>
                        <ul className="m-0 list-disc space-y-2 pl-5">
                            <li>
                                <strong>Online</strong> vs. <strong>Live</strong> — online shows are
                                photo shows (what this guide is for); live shows happen in person.
                            </li>
                            <li>
                                <strong>The entry deadline</strong> — online shows take entries
                                during a window. &ldquo;Entries close&rdquo; is the date that
                                matters; after it, the show moves to judging.
                            </li>
                            <li>
                                <strong>MHH Qualifying</strong> — in qualifying classes at these
                                shows, 1st and 2nd place earn a permanent qualification card for the
                                horse. A lovely bonus, not a requirement to care about yet.
                            </li>
                        </ul>
                        <p className="m-0">
                            Open the show, read its rules and classlist, and find a class that fits
                            a horse you own — a breed halter class is the classic first entry.
                        </p>
                    </div>
                </section>

                {/* Step 2 */}
                <section className="mb-10">
                    <StepHeading number={2} title="Get your horse show-ready" />
                    <div className="ledger-paper space-y-4 p-6 text-sm leading-relaxed text-secondary-foreground md:p-8">
                        <p>
                            Entering takes a free account and a horse in your{" "}
                            <Link href="/dashboard" className="font-semibold text-forest underline decoration-2 underline-offset-2">
                                stable
                            </Link>
                            . Add the model you want to show if it isn&apos;t there yet — the
                            reference database fills in mold, maker, and scale for you.
                        </p>
                        <ul className="m-0 list-disc space-y-2 pl-5">
                            <li>
                                <strong>Make the horse public.</strong> Only public horses can enter
                                shows — judges and other entrants need to be able to see what
                                placed. You control visibility per horse from your stable.
                            </li>
                            <li>
                                <strong>Give it a show identity.</strong> On the horse&apos;s edit
                                page, assign a breed, gender, and age. That breed assignment is what
                                a breed-halter judge weighs your model against — a thoughtful,
                                realistic assignment matters more than an exotic one.
                            </li>
                            <li>
                                <strong>Check the class rules.</strong> Some classes are limited by
                                scale or finish, and a horse enters only one breed halter class per
                                show (entering breed halter declares the model&apos;s breed). Don&apos;t
                                memorize any of this — if something isn&apos;t eligible, the entry
                                form tells you exactly why.
                            </li>
                        </ul>
                    </div>
                </section>

                {/* Step 3 */}
                <section className="mb-10">
                    <StepHeading number={3} title="Take a photo that can win" />
                    <div className="ledger-paper space-y-4 p-6 text-sm leading-relaxed text-secondary-foreground md:p-8">
                        <p>
                            In an online show, the photograph <em>is</em> the entry. The judge can
                            only place what they can see, so the craft is worth ten minutes of
                            care:
                        </p>
                        <ul className="m-0 list-disc space-y-2 pl-5">
                            <li>
                                <strong>Sharp side profile.</strong> For halter, the classic shot is
                                the horse in full side view, in crisp focus. Tap to focus on the
                                horse&apos;s body, and take several — pick the sharpest later.
                            </li>
                            <li>
                                <strong>Level camera, at the horse&apos;s height.</strong> Shoot
                                from the model&apos;s eye level, not looking down at it. Looking
                                down distorts the legs and back — the two things a halter judge
                                studies hardest.
                            </li>
                            <li>
                                <strong>A background suited to the class.</strong> For halter, plain
                                and uncluttered — a sheet of card, a wall, outdoor grass — so
                                nothing competes with the horse. For performance, the opposite: a
                                realistic scene with footing, tack, and props that make the job
                                believable.
                            </li>
                            <li>
                                <strong>The whole horse in frame.</strong> Ears to hooves, with a
                                little room around it. Cropped-off feet are the most common
                                first-show heartbreak.
                            </li>
                            <li>
                                <strong>Natural light.</strong> Daylight near a window (or outside,
                                overcast) flatters paintwork; overhead room lighting flattens it and
                                casts shadows.
                            </li>
                        </ul>
                        <p className="m-0">
                            You don&apos;t need a studio. A phone, daylight, and a steady hand have
                            won plenty of classes.
                        </p>
                    </div>
                </section>

                {/* Step 4 */}
                <section className="mb-10">
                    <StepHeading number={4} title="Enter the class" />
                    <div className="ledger-paper space-y-4 p-6 text-sm leading-relaxed text-secondary-foreground md:p-8">
                        <p>
                            While entries are open, every class on the show page has an{" "}
                            <strong>Enter</strong> button. From there:
                        </p>
                        <ol className="m-0 list-decimal space-y-2 pl-5">
                            <li>Pick which of your horses is entering.</li>
                            <li>
                                Pick the photo — choose from the horse&apos;s existing photos or
                                upload the show photo right in the entry dialog. Show photos are
                                free for every account, up to 5 per horse.
                            </li>
                            <li>
                                Optionally name a handler if another member is showing the horse for
                                you (that&apos;s proxy showing — skip it for your first entry).
                            </li>
                        </ol>
                        <p className="m-0">
                            Enter as many classes as fit your horse. You can scratch (withdraw) an
                            entry while entries are still open, so nothing is irreversible. Then the
                            hard part: waiting for the deadline.
                        </p>
                    </div>
                </section>

                {/* Step 5 */}
                <section className="mb-10">
                    <StepHeading number={5} title="What happens after" />
                    <div className="ledger-paper space-y-4 p-6 text-sm leading-relaxed text-secondary-foreground md:p-8">
                        <ul className="m-0 list-disc space-y-2 pl-5">
                            <li>
                                <strong>Judging.</strong> When entries close, the show moves to
                                judging — a judge places each class (or the community votes,
                                depending on the show). You&apos;ll be notified as things happen;
                                no need to refresh all week.
                            </li>
                            <li>
                                <strong>Results.</strong> When the host publishes results, placings
                                appear on the show page and you get a notification with how your
                                horses did.
                            </li>
                            <li>
                                <strong>The permanent record.</strong> Placings flow into each
                                horse&apos;s show record on its passport automatically — no
                                spreadsheet required. That record travels with the horse for life.
                            </li>
                            <li>
                                <strong>Qualification cards.</strong> A 1st or 2nd in a qualifying
                                class earns the horse an MHH Qualification Card with its own
                                verification link — anyone can check it&apos;s real, and it
                                transfers with the horse if you ever sell.
                            </li>
                        </ul>
                        <p className="m-0">
                            And whatever the ribbons say: look at what placed above you, note one
                            thing to try differently, and enter the next one. That loop — show,
                            look, learn — is the actual hobby.
                        </p>
                    </div>
                </section>

                {/* FAQ */}
                <section className="mb-10">
                    <div className="brass-heading mb-4">
                        <span className="brass-heading-bar" aria-hidden="true" />
                        <h2 className="m-0 text-lg text-foreground">First-show questions</h2>
                    </div>
                    <div className="ledger-paper space-y-5 p-6 md:p-8">
                        {FAQ.map((item) => (
                            <div key={item.q}>
                                <h3 className="mb-1 text-sm font-bold text-foreground">{item.q}</h3>
                                <p className="m-0 text-sm leading-relaxed text-secondary-foreground">
                                    {item.a}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                <div className="ledger-paper mb-12 p-6 text-center md:p-8">
                    <h2 className="mb-2 text-lg font-bold text-foreground">
                        There&apos;s a table with your number on it
                    </h2>
                    <p className="mx-auto mb-4 max-w-[520px] text-sm leading-relaxed text-secondary-foreground">
                        Find a show that&apos;s open, pick the horse you&apos;d grab first in a
                        fire, and enter it in one class. That&apos;s a show career started.
                    </p>
                    <div className="flex flex-wrap justify-center gap-3">
                        <Button asChild>
                            <Link href="/shows">Browse open shows</Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link href="/learn/glossary">Read the glossary</Link>
                        </Button>
                    </div>
                </div>
            </div>
        </ExplorerLayout>
    );
}
