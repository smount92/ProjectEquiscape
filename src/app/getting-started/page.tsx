import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Getting Started — Model Horse Hub",
    description:
        "Learn how to set up your digital stable on Model Horse Hub. Add your first horse, explore the Show Ring, and discover Hoofprint™ provenance tracking.",
};

export default function GettingStartedPage() {
    return (
        <div className="static-page">
            <div className="static-page-inner animate-fade-in-up">
                {/* Page Header */}
                <div className="static-page-header">
                    <h1>
                        Getting Started with{" "}
                        <span className="text-gradient">Model Horse Hub</span>
                    </h1>
                    <p className="static-page-lead">
                        Your digital stable is ready. Here&apos;s how to make the most of it.
                    </p>
                </div>

                {/* Step 1 */}
                <section className="static-section">
                    <h2>📸 Step 1: Add Your First Horse</h2>
                    <p>
                        Click <strong>&ldquo;🏠 Digital Stable&rdquo;</strong> in the navigation,
                        then hit <strong>&ldquo;+ Add Horse&rdquo;</strong>.
                    </p>
                    <p>
                        Start by selecting your model type &mdash; <strong>Breyer/Stone</strong> or{" "}
                        <strong>Artist Resin</strong>. Our database has{" "}
                        <strong>10,500+ reference entries</strong>, so search by name, mold, or
                        manufacturer to auto-fill the details. If your model isn&apos;t in the database,
                        you can enter it manually.
                    </p>
                    <p>
                        Upload up to <strong>5 LSQ-style photos</strong> (Near-Side, Off-Side, Front,
                        Hindquarters, Belly/Maker&apos;s Mark) plus unlimited extra detail shots. Set
                        your condition grade, finish type, and give your horse a name.
                    </p>
                    <div className="getting-started-tip">
                        <strong>💡 Tip:</strong> Set your horse to <strong>&ldquo;Public&rdquo;</strong> to
                        share it in the Show Ring for the community to discover. Private horses are
                        visible only to you.
                    </div>
                </section>

                {/* Step 2 */}
                <section className="static-section">
                    <h2>🔒 Step 2: Track Your Financials (Private)</h2>
                    <p>
                        During the add-horse process, you&apos;ll see the{" "}
                        <strong>Financial Vault</strong> section. This is where you can record:
                    </p>
                    <ul className="list-none p-0 m-[var(--space-md) 0]">
                        <li>Purchase price and date</li>
                        <li>Estimated current value</li>
                        <li>Insurance notes</li>
                    </ul>
                    <p>
                        <strong>This data is strictly private.</strong> It&apos;s protected by row-level
                        security &mdash; even our team cannot access it. Only you can see your
                        financial data, ever.
                    </p>
                </section>

                {/* Step 3 */}
                <section className="static-section">
                    <h2>🐾 Step 3: Meet Hoofprint™</h2>
                    <p>
                        Every horse you add automatically gets a{" "}
                        <strong>Hoofprint™ &mdash; a permanent digital identity</strong>. Think of it
                        like a passport that follows the horse, not the owner.
                    </p>
                    <p>Your Hoofprint timeline tracks:</p>
                    <ul className="list-none p-0 m-[var(--space-md) 0]">
                        <li>
                            <strong>Life stages</strong> &mdash; from blank resin to work-in-progress
                            to completed custom
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
                        When you sell or trade a horse, you can generate a{" "}
                        <strong>6-character transfer code</strong> from its passport page. The buyer
                        enters the code at{" "}
                        <Link href="/claim" className="text-gradient" style={{ fontWeight: 600 }}>
                            📦 Claim
                        </Link>{" "}
                        &mdash; and the horse moves to their stable with its entire history intact.
                    </p>
                </section>

                {/* Step 4 */}
                <section className="static-section">
                    <h2>🏆 Step 4: Explore the Community</h2>
                    <p>
                        Once you&apos;ve added a few horses, explore what other collectors are sharing:
                    </p>
                    <ul className="list-none p-0 m-[var(--space-md) 0]">
                        <li>
                            <strong>
                                <Link href="/community">🏆 Show Ring</Link>
                            </strong>{" "}
                            &mdash; Browse all public models. Filter by finish type, trade status,
                            or manufacturer.
                        </li>
                        <li>
                            <strong>
                                <Link href="/discover">👥 Discover</Link>
                            </strong>{" "}
                            &mdash; Find and follow other collectors. See their public herds and
                            show records.
                        </li>
                        <li>
                            <strong>
                                <Link href="/feed">📰 Feed</Link>
                            </strong>{" "}
                            &mdash; See activity from collectors you follow &mdash; new additions,
                            favorites, comments, and show results.
                        </li>
                        <li>
                            <strong>
                                <Link href="/shows">📸 Photo Shows</Link>
                            </strong>{" "}
                            &mdash; Enter your best models in themed virtual photo shows. Vote for
                            your favorites and compete for 🥇🥈🥉 placement.
                        </li>
                    </ul>
                </section>

                {/* Step 5 */}
                <section className="static-section">
                    <h2>💬 Step 5: Buy, Sell &amp; Connect</h2>
                    <p>
                        Set any horse&apos;s trade status to <strong>&ldquo;For Sale&rdquo;</strong> or{" "}
                        <strong>&ldquo;Open to Offers&rdquo;</strong> and it becomes visible as a
                        listing in the Show Ring. Other collectors can message you directly through
                        the built-in inbox.
                    </p>
                    <p>
                        After a transaction, leave a <strong>rating</strong> for the other collector.
                        Ratings build trust and reputation across the community.
                    </p>
                    <p>
                        Add models to your{" "}
                        <Link href="/wishlist" className="text-gradient" style={{ fontWeight: 600 }}>
                            ❤️ Wishlist
                        </Link>{" "}
                        and you&apos;ll get notified when a matching model is listed for sale.
                    </p>
                </section>

                {/* Step 6 */}
                <section className="static-section">
                    <h2>⚙️ Step 6: Customize Your Experience</h2>
                    <p>
                        Visit{" "}
                        <Link href="/settings" className="text-gradient" style={{ fontWeight: 600 }}>
                            ⚙️ Settings
                        </Link>{" "}
                        to:
                    </p>
                    <ul className="list-none p-0 m-[var(--space-md) 0]">
                        <li>Upload a profile avatar</li>
                        <li>Update your bio and alias</li>
                        <li>Manage notification preferences</li>
                        <li>Change your password</li>
                    </ul>
                    <p>
                        You can also toggle <strong>Simple Mode</strong> (the eye icon in the
                        header) for high-contrast, large text &mdash; great for accessibility or
                        photo show judging.
                    </p>
                </section>

                {/* Beta Feedback */}
                <section className="static-section">
                    <h2>🧪 Beta Tester? We Need Your Feedback!</h2>
                    <p>
                        You&apos;re among the first collectors to use Model Horse Hub. Your feedback
                        directly shapes what we build next. If something feels broken, confusing, or
                        missing &mdash; <strong>we want to hear about it.</strong>
                    </p>
                    <p>
                        Use the{" "}
                        <Link href="/contact" className="text-gradient" style={{ fontWeight: 600 }}>
                            ✉️ Contact
                        </Link>{" "}
                        page to send us your thoughts, or message the admin directly through the
                        inbox.
                    </p>
                    <div className="getting-started-tip">
                        <strong>🙏 Thank you</strong> for being part of the founding herd. Every
                        feature on this platform exists because a collector said &ldquo;I wish this
                        existed.&rdquo; Keep telling us what you wish for.
                    </div>
                </section>

                {/* CTA */}
                <div className="static-cta">
                    <p>Ready to start?</p>
                    <Link
                        href="/dashboard"
                        className="btn btn-primary btn-lg"
                        id="getting-started-cta"
                    >
                        Go to Your Digital Stable →
                    </Link>
                </div>
            </div>
        </div>
    );
}
