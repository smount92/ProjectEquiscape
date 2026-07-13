import Link from "next/link";
import type { Metadata } from "next";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import AiDataPolicySection from "@/components/AiDataPolicySection";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles, PawPrint, Gavel, Users, Palette, Package, Smartphone, Handshake } from "lucide-react";

export const metadata: Metadata = {
    title: "About",
    description:
        "Learn about Model Horse Hub — the first digital stable built by a collector who was tired of notebooks, spreadsheets, and scattered albums. 10,500+ reference entries, Hoofprint provenance, and a privacy-first design.",
};

export default function AboutPage() {
    return (
        <ExplorerLayout noHeader>
            <div className="animate-fade-in-up">
                <PageMasthead
                    icon="🐎"
                    title="About Model Horse Hub"
                    subtitle="Built by a collector who was tired of the status quo"
                />

                {/* Founders */}
                <section className="mb-12">
                    <h2>A Husband-and-Wife Team</h2>
                    <div className="text-secondary-foreground space-y-4 text-base leading-relaxed">
                        <p>
                            Model Horse Hub is built by <strong>Amanda</strong> and <strong>Stephen Mount</strong> — a
                            husband-and-wife team, and yes, that&apos;s really it. No boardroom, no investors, no growth
                            team. Just two people who love this hobby and got tired of watching it get let down by tools
                            that weren&apos;t built for it.
                        </p>
                        <p>
                            Amanda is the collector. She&apos;s the one who&apos;s lived inside spreadsheets, notebooks,
                            and Facebook albums trying to keep track of a growing herd, and she knows this hobby from
                            the inside — what LSQ means, why OF and CM aren&apos;t the same thing, what a showholder
                            actually needs on class day. Every feature on this platform starts as an idea from Amanda,
                            usually phrased as &ldquo;I wish this existed.&rdquo;
                        </p>
                        <p>
                            Stephen builds them. He turns &ldquo;I wish this existed&rdquo; into working software — the
                            database that holds 10,500+ reference releases, the ring console that has to work from a
                            phone at a fairgrounds with one bar of signal, the row-level security that keeps your
                            financial vault actually private. If something on this site works well, Amanda probably
                            asked for it and Stephen probably lost a weekend making it real.
                        </p>
                    </div>
                </section>

                {/* Our Story */}
                <section className="mb-12">
                    <h2>Our Story</h2>
                    <div className="text-secondary-foreground space-y-4 text-base leading-relaxed">
                        <p>
                            It started the way it starts for most of us: a notebook. Then a spreadsheet. Then another
                            spreadsheet because the first one got too messy. Then Facebook albums and mental notes about
                            &ldquo;that palomino I sold in 2019 — what was her name?&rdquo;
                        </p>
                        <p>
                            The model horse hobby has exploded in size and sophistication, but the tools for managing a
                            collection haven&apos;t kept up. There was no single platform where you could catalog your
                            herd with proper multi-angle photos, track what you paid and what it&apos;s worth, and
                            connect with other collectors — all in one place, with real privacy protections.
                        </p>
                        <p>
                            So we built one. Model Horse Hub is a purpose-built digital stable backed by a{" "}
                            <strong>10,500+ entry reference database</strong> — 7,000+ Breyer and Stone releases
                            hand-verified from official catalogs, plus 3,500+ artist resins sourced from the Equine
                            Resin Directory. When you add a horse, you&apos;re not typing in data from scratch.
                            You&apos;re selecting from real reference data with mold, manufacturer, scale, and year
                            already filled in.
                        </p>
                        <p>
                            Whether you collect Breyer Traditionals, Stone Artist Resins, or anything in between, Model
                            Horse Hub is designed to grow with your herd — from a handful of childhood favorites to a
                            serious collection of hundreds.
                        </p>
                    </div>
                </section>

                {/* What Makes Us Different */}
                <section className="mb-12">
                    <h2>What Makes Us Different</h2>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        <div className="ledger-paper [&_p]:text-secondary-foreground p-8 text-center transition-transform duration-300 hover:-translate-y-1 [&_h3]:mb-2 [&_h3]:text-lg [&_p]:text-sm">
                            <div className="text-forest mb-4 flex justify-center">
                                <Lock size={32} strokeWidth={1.5} />
                            </div>
                            <h3>Your Data is YOURS</h3>
                            <p>
                                Row-level security means even our team can&apos;t see your financial vault. No ads, no
                                selling your collection data, no &ldquo;we may share with partners&rdquo; clauses. Your
                                purchase prices, estimated values, and insurance notes stay locked behind cryptographic
                                access controls. Period.
                            </p>
                        </div>
                        <div className="ledger-paper [&_p]:text-secondary-foreground p-8 text-center transition-transform duration-300 hover:-translate-y-1 [&_h3]:mb-2 [&_h3]:text-lg [&_p]:text-sm">
                            <div className="text-forest mb-4 flex justify-center">
                                <Sparkles size={32} strokeWidth={1.5} />
                            </div>
                            <h3>Built for the Hobby&apos;s Nuances</h3>
                            <p>
                                We know what LSQ means. We know the difference between OF and CM. We know that a Breyer
                                #5 is fundamentally different from a Beswick #5. Every feature was designed around how
                                collectors actually work — not how a generic inventory app thinks you should.
                            </p>
                        </div>
                        <div className="ledger-paper [&_p]:text-secondary-foreground p-8 text-center transition-transform duration-300 hover:-translate-y-1 [&_h3]:mb-2 [&_h3]:text-lg [&_p]:text-sm">
                            <div className="text-forest mb-4 flex justify-center">
                                <PawPrint size={32} strokeWidth={1.5} />
                            </div>
                            <h3>Hoofprint — A First for the Hobby</h3>
                            <p>
                                No platform has ever built provenance tracking for model horses. Hoofprint creates a
                                permanent digital identity for every horse — ownership history, customization records,
                                show results, and photos that follow the horse, not the owner. The CarFax of model
                                horses.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Continuity */}
                <section className="mb-12">
                    <h2>Will This Still Be Here Next Year?</h2>
                    <div className="text-secondary-foreground space-y-4 text-base leading-relaxed">
                        <p>
                            It&apos;s a fair question, and this hobby has earned the right to ask it. Model Horse Blab,
                            the hobby&apos;s longtime forum, went dark for almost two years. MH$P — the sales hub this
                            hobby relied on since 1996 — was hit by ransomware and never fully came back. We built Model
                            Horse Hub knowing that history, not despite it.
                        </p>
                        <p>
                            So here&apos;s our commitment, in plain English: your data is backed up automatically, every
                            single night. You can export your entire collection — every horse, every Hoofprint record,
                            every qualification card — as a CSV or PDF, anytime you want, straight from your dashboard.
                            You don&apos;t have to ask us, and you don&apos;t have to wait.
                        </p>
                        <p>
                            And if we ever have to wind Model Horse Hub down — we hope we never do, but we&apos;re not
                            going to promise you &ldquo;never&rdquo; — we commit to giving every user real advance
                            notice and a full export window before anything shuts off. Your herd&apos;s history belongs
                            to you, not to us.
                        </p>
                    </div>
                </section>

                {/* What's Live Now */}
                <section className="mb-12">
                    <h2>What&apos;s Live Now</h2>
                    <div className="text-secondary-foreground space-y-4 text-base leading-relaxed">
                        <p>Not someday — these are running right now, and you can use them today.</p>
                    </div>
                    <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div className="ledger-paper [&_p]:text-secondary-foreground p-8 text-center transition-transform duration-300 hover:-translate-y-1 [&_h3]:mb-2 [&_h3]:text-lg [&_p]:text-sm">
                            <div className="text-forest mb-4 flex justify-center">
                                <Gavel size={32} strokeWidth={1.5} />
                            </div>
                            <h3>Live &amp; Online Show Hosting</h3>
                            <p>
                                Host a show your way — in the ring or online. One-click NAMHSA-style classlists build
                                your entire show structure in seconds. Run live shows from a phone-based ring console
                                with table-side placings and champion callbacks, or host an online photo show with judge
                                or community voting. Every result becomes a qualification card on the horse&apos;s
                                Hoofprint — publicly verifiable, so a buyer can check a card before they buy.
                            </p>
                        </div>
                        <div className="ledger-paper [&_p]:text-secondary-foreground p-8 text-center transition-transform duration-300 hover:-translate-y-1 [&_h3]:mb-2 [&_h3]:text-lg [&_p]:text-sm">
                            <div className="text-forest mb-4 flex justify-center">
                                <Users size={32} strokeWidth={1.5} />
                            </div>
                            <h3>Notice Board — Groups &amp; Community</h3>
                            <p>
                                Join or create groups for your region, your collecting focus, or any shared interest.
                                Every group gets its own Notice Board — threaded discussions, channels, and pinned posts
                                — so conversations stay organized instead of scattered across Facebook and Discord.
                            </p>
                        </div>
                        <div className="ledger-paper [&_p]:text-secondary-foreground p-8 text-center transition-transform duration-300 hover:-translate-y-1 [&_h3]:mb-2 [&_h3]:text-lg [&_p]:text-sm">
                            <div className="text-forest mb-4 flex justify-center">
                                <Palette size={32} strokeWidth={1.5} />
                            </div>
                            <h3>Art Studio &amp; Commission Tracking</h3>
                            <p>
                                Artists manage their commission queue, share WIP photos with clients, and build a
                                portfolio that speaks for itself. When a custom is delivered, the creation story flows
                                into the horse&apos;s Hoofprint — permanently.
                            </p>
                        </div>
                        <div className="ledger-paper [&_p]:text-secondary-foreground p-8 text-center transition-transform duration-300 hover:-translate-y-1 [&_h3]:mb-2 [&_h3]:text-lg [&_p]:text-sm">
                            <div className="text-forest mb-4 flex justify-center">
                                <Package size={32} strokeWidth={1.5} />
                            </div>
                            <h3>Bulk Import &amp; Insurance Reports</h3>
                            <p>
                                Upload your spreadsheet and we&apos;ll fuzzy-match every row against 10,500+ references.
                                Generate insurance PDF reports with photos, values, and condition grades, ready whenever
                                your insurer asks.
                            </p>
                        </div>
                    </div>
                </section>

                {/* The Vision */}
                <section className="mb-12">
                    <h2>Where We&apos;re Going</h2>
                    <div className="text-secondary-foreground space-y-4 text-base leading-relaxed">
                        <p>
                            Model Horse Hub isn&apos;t just a collection manager &mdash; it&apos;s becoming the
                            operating system for the hobby. Every feature on this platform exists because a real
                            collector said &ldquo;I wish this existed.&rdquo;
                        </p>
                        <p>And here&apos;s what&apos;s still ahead:</p>
                    </div>
                    <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div className="ledger-paper [&_p]:text-secondary-foreground p-8 text-center transition-transform duration-300 hover:-translate-y-1 [&_h3]:mb-2 [&_h3]:text-lg [&_p]:text-sm">
                            <div className="text-forest mb-4 flex justify-center">
                                <Smartphone size={32} strokeWidth={1.5} />
                            </div>
                            <h3>Deeper Mobile Tools</h3>
                            <p>
                                A camera-first upload flow for adding a horse straight from the show floor, and push
                                notifications for offers, messages, and show results &mdash; so you&apos;re never stuck
                                refreshing a tab.
                            </p>
                        </div>
                        <div className="ledger-paper [&_p]:text-secondary-foreground p-8 text-center transition-transform duration-300 hover:-translate-y-1 [&_h3]:mb-2 [&_h3]:text-lg [&_p]:text-sm">
                            <div className="text-forest mb-4 flex justify-center">
                                <Handshake size={32} strokeWidth={1.5} />
                            </div>
                            <h3>Your Ideas</h3>
                            <p>
                                We build what you ask for. Every feature request from the community gets heard,
                                prioritized, and built. This is your platform.
                            </p>
                        </div>
                    </div>
                </section>

                {/* AI, Data Collection, and Copyright Policy */}
                <AiDataPolicySection />

                {/* CTA */}
                <div className="ledger-paper mx-auto max-w-[720px] px-8 py-10 text-center">
                    <p>Your herd is waiting. Give it the home it deserves.</p>
                    <Button asChild variant="outline">
                        <Link href="/signup" id="about-cta-signup">
                            Start Your Digital Stable — Free
                        </Link>
                    </Button>
                </div>
            </div>
        </ExplorerLayout>
    );
}
