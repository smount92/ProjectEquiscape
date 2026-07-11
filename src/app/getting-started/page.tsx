import Link from "next/link";
import type { Metadata } from "next";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import { Button } from "@/components/ui/button";
import {
    Camera,
    Lock,
    PawPrint,
    Trophy,
    Flag,
    Handshake,
    Settings,
    Home,
    Package,
    Users,
    Newspaper,
    Heart,
    Mail,
    Lightbulb,
} from "lucide-react";

export const metadata: Metadata = {
    title: "Getting Started — Model Horse Hub",
    description:
        "Learn how to set up your digital stable on Model Horse Hub. Add your first horse, explore the Show Ring, and discover Hoofprint provenance tracking.",
};

export default function GettingStartedPage() {
    return (
        <ExplorerLayout
            title={
                <>
                    Getting Started with <span className="text-forest">Model Horse Hub</span>
                </>
            }
            description="Your digital stable is ready. Here's how to make the most of it."
        >
            <div className="animate-fade-in-up">
                {/* Page Header */}
                <div className="mb-8">
                    <h1>
                        Getting Started with <span className="text-forest">Model Horse Hub</span>
                    </h1>
                    <p className="text-secondary-foreground mt-2 text-lg">
                        Your digital stable is ready. Here&apos;s how to make the most of it.
                    </p>
                </div>

                {/* Step 1 */}
                <section className="mb-12">
                    <h2 className="flex items-center gap-2">
                        <Camera size={22} strokeWidth={1.5} className="text-forest" /> Step 1: Add Your First Horse
                    </h2>
                    <p>
                        Click{" "}
                        <strong className="inline-flex items-center gap-1">
                            <Home size={15} strokeWidth={1.5} /> &ldquo;Digital Stable&rdquo;
                        </strong>{" "}
                        in the navigation, then hit <strong>&ldquo;+ Add Horse&rdquo;</strong>.
                    </p>
                    <p>
                        Start by selecting your model type &mdash; <strong>Breyer/Stone</strong> or{" "}
                        <strong>Artist Resin</strong>. Our database has <strong>10,500+ reference entries</strong>, so
                        search by name, mold, or manufacturer to auto-fill the details. If your model isn&apos;t in the
                        database, you can enter it manually.
                    </p>
                    <p>
                        Upload up to <strong>5 LSQ-style photos</strong> (Near-Side, Off-Side, Front, Hindquarters,
                        Belly/Maker&apos;s Mark) plus unlimited extra detail shots. Set your condition grade, finish
                        type, and give your horse a name.
                    </p>
                    <div className="border-forest/20 bg-forest/5 mt-4 rounded-lg border px-6 py-4 text-sm leading-relaxed">
                        <strong className="inline-flex items-center gap-1.5">
                            <Lightbulb size={16} strokeWidth={1.5} className="text-forest" /> Tip:
                        </strong>{" "}
                        Set your horse to <strong>&ldquo;Public&rdquo;</strong> to share it in the Show Ring for the
                        community to discover. Private horses are visible only to you.
                    </div>
                </section>

                {/* Step 2 */}
                <section className="mb-12">
                    <h2 className="flex items-center gap-2">
                        <Lock size={22} strokeWidth={1.5} className="text-forest" /> Step 2: Track Your Financials
                        (Private)
                    </h2>
                    <p>
                        During the add-horse process, you&apos;ll see the <strong>Financial Vault</strong> section. This
                        is where you can record:
                    </p>
                    <ul className="my-3 list-none p-0">
                        <li>Purchase price and date</li>
                        <li>Estimated current value</li>
                        <li>Insurance notes</li>
                    </ul>
                    <p>
                        <strong>This data is strictly private.</strong> It&apos;s protected by row-level security
                        &mdash; even our team cannot access it. Only you can see your financial data, ever.
                    </p>
                </section>

                {/* Step 3 */}
                <section className="mb-12">
                    <h2 className="flex items-center gap-2">
                        <PawPrint size={22} strokeWidth={1.5} className="text-forest" /> Step 3: Meet Hoofprint
                    </h2>
                    <p>
                        Every horse you add automatically gets a{" "}
                        <strong>Hoofprint &mdash; a permanent digital identity</strong>. Think of it like a passport
                        that follows the horse, not the owner.
                    </p>
                    <p>Your Hoofprint timeline tracks:</p>
                    <ul className="my-3 list-none p-0">
                        <li>
                            <strong>Life stages</strong> &mdash; from blank resin to work-in-progress to completed
                            custom
                        </li>
                        <li>
                            <strong>Ownership history</strong> &mdash; a verified chain of custody
                        </li>
                        <li>
                            <strong>Show results</strong> &mdash; placements that follow the horse
                        </li>
                        <li>
                            <strong>Custom notes</strong> &mdash; any events you want to document
                        </li>
                    </ul>
                    <p>
                        When you sell or trade a horse, you can generate a <strong>6-character transfer code</strong>{" "}
                        from its passport page. The buyer enters the code at{" "}
                        <Link href="/claim" className="text-forest inline-flex items-center gap-1.5 font-semibold">
                            <Package size={16} strokeWidth={1.5} /> Claim
                        </Link>{" "}
                        &mdash; and the horse moves to their stable with its entire history intact.
                    </p>
                </section>

                {/* Step 4 */}
                <section className="mb-12">
                    <h2 className="flex items-center gap-2">
                        <Trophy size={22} strokeWidth={1.5} className="text-forest" /> Step 4: Explore the Community
                    </h2>
                    <p>Once you&apos;ve added a few horses, explore what other collectors are sharing:</p>
                    <ul className="my-3 list-none p-0">
                        <li>
                            <strong>
                                <Link href="/community" className="inline-flex items-center gap-1.5">
                                    <Trophy size={16} strokeWidth={1.5} /> Show Ring
                                </Link>
                            </strong>{" "}
                            &mdash; Browse all public models. Filter by finish type, trade status, manufacturer, scale,
                            and the full set of facets in your Stable &mdash; then save the combinations you use most as
                            a view you can jump back to anytime.
                        </li>
                        <li>
                            <strong>
                                <Link href="/discover" className="inline-flex items-center gap-1.5">
                                    <Users size={16} strokeWidth={1.5} /> Discover
                                </Link>
                            </strong>{" "}
                            &mdash; Find and follow other collectors. See their public herds and show records.
                        </li>
                        <li>
                            <strong>
                                <Link href="/feed" className="inline-flex items-center gap-1.5">
                                    <Newspaper size={16} strokeWidth={1.5} /> Feed
                                </Link>
                            </strong>{" "}
                            &mdash; See activity from collectors you follow &mdash; new additions, favorites, comments,
                            and show results.
                        </li>
                        <li>
                            <strong>
                                <Link href="/shows" className="inline-flex items-center gap-1.5">
                                    <Camera size={16} strokeWidth={1.5} /> Photo Shows
                                </Link>
                            </strong>{" "}
                            &mdash; Enter your best models in themed virtual photo shows. Vote for your favorites and
                            compete for ribbon placement.
                        </li>
                    </ul>
                </section>

                {/* Step 5 — Host Your First Show */}
                <section className="mb-12">
                    <h2 className="flex items-center gap-2">
                        <Flag size={22} strokeWidth={1.5} className="text-forest" /> Step 5: Host Your First Show
                    </h2>
                    <p>
                        Ready to run your own show instead of just entering one? Head to{" "}
                        <Link href="/shows/host" className="text-forest font-semibold">
                            Show Office
                        </Link>{" "}
                        and pick your mode &mdash; live or online. Either way, a one-click NAMHSA-style template builds
                        your entire classlist for you in seconds.
                    </p>
                    <p>
                        Hosting a <strong>live, in-person show</strong>? Run show day from your phone with a ring
                        console: record leg-tag placings table by table, run champion callbacks, and export
                        NAMHSA-format results when you&apos;re done.
                    </p>
                    <p>
                        Hosting <strong>online</strong>? Open entries, let entrants submit photos to your classes, then
                        judge it yourself or open it to community voting.
                    </p>
                    <p>
                        Either way, every result becomes a permanent record &mdash; and a qualification card &mdash; on
                        the horse&apos;s Hoofprint, with a public verification page anyone can check.
                    </p>
                </section>

                {/* Step 6 */}
                <section className="mb-12">
                    <h2 className="flex items-center gap-2">
                        <Handshake size={22} strokeWidth={1.5} className="text-forest" /> Step 6: Buy, Sell &amp;
                        Connect
                    </h2>
                    <p>
                        Set any horse&apos;s trade status to <strong>&ldquo;For Sale&rdquo;</strong> or{" "}
                        <strong>&ldquo;Open to Offers&rdquo;</strong> and it becomes visible as a listing in the Show
                        Ring. Other collectors can message you directly through the built-in inbox.
                    </p>
                    <p>
                        After a transaction, leave a <strong>rating</strong> for the other collector. Ratings build
                        trust and reputation across the community.
                    </p>
                    <p>
                        Add models to your{" "}
                        <Link href="/wishlist" className="text-forest inline-flex items-center gap-1.5 font-semibold">
                            <Heart size={16} strokeWidth={1.5} /> Wishlist
                        </Link>{" "}
                        and you&apos;ll get notified when a matching model is listed for sale.
                    </p>
                </section>

                {/* Step 7 */}
                <section className="mb-12">
                    <h2 className="flex items-center gap-2">
                        <Settings size={22} strokeWidth={1.5} className="text-forest" /> Step 7: Customize Your
                        Experience
                    </h2>
                    <p>
                        Visit{" "}
                        <Link href="/settings" className="text-forest inline-flex items-center gap-1.5 font-semibold">
                            <Settings size={16} strokeWidth={1.5} /> Settings
                        </Link>{" "}
                        to:
                    </p>
                    <ul className="my-3 list-none p-0">
                        <li>Upload a profile avatar</li>
                        <li>Update your bio and alias</li>
                        <li>Manage notification preferences</li>
                        <li>Change your password</li>
                    </ul>
                    <p>
                        You can also toggle <strong>Simple Mode</strong> (the eye icon in the header) for high-contrast,
                        large text &mdash; great for accessibility or photo show judging.
                    </p>
                </section>

                {/* Feedback */}
                <section className="mb-12">
                    <p className="text-secondary-foreground text-base leading-relaxed">
                        Got an idea, or found something that could work better? We build what collectors ask for &mdash;{" "}
                        <Link href="/contact" className="text-forest inline-flex items-center gap-1.5 font-semibold">
                            <Mail size={16} strokeWidth={1.5} /> tell us what you&apos;d love to see
                        </Link>
                        .
                    </p>
                </section>

                {/* CTA */}
                <div className="bg-card border-input rounded-lg border text-center">
                    <p>Ready to start?</p>
                    <Button asChild variant="outline">
                        <Link href="/dashboard" id="getting-started-cta">
                            Go to Your Digital Stable →
                        </Link>
                    </Button>
                </div>
            </div>
        </ExplorerLayout>
    );
}
