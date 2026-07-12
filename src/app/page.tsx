import Link from "next/link";
import type { Metadata } from "next";
import {
    Camera,
    Trophy,
    PawPrint,
    Handshake,
    Package,
    Home,
    Palette,
    TrendingUp,
    Shield,
    Fingerprint,
    Sparkles,
    Gavel,
    BookOpen,
    Users,
    Smartphone,
    Bot,
    Flag,
} from "lucide-react";

export const metadata: Metadata = {
    title: "Model Horse Hub — The Digital Home for the Model Horse Hobby",
    description:
        "The all-in-one platform for model horse collectors and artists. 10,500+ reference releases, Hoofprint provenance tracking, LSQ photography, private financial vault, community marketplace, virtual photo shows with NAMHSA templates, AI Stablemaster insights, and artist commission tools. Free forever tier.",
};

export default function LandingPage() {
    return (
        <div className="overflow-x-hidden">
            {/* ─── Hero Section — the leather cover of the ledger book.
           Deliberately shallow (~2/3 of the old viewport-height hero):
           no min-height, tighter rhythm, smaller type. ─── */}
            <section
                className="leather-panel stitched leather-masthead flex items-center justify-center px-6 py-10 md:py-14"
                id="hero"
            >
                <div className="animate-fade-in-up relative z-[1] max-w-[780px] text-center">
                    <span className="text-forest border-forest/20 bg-forest/5 mb-5 inline-flex items-center gap-2 rounded-full border px-5 py-1 text-sm font-semibold tracking-[0.01em]">
                        <Fingerprint size={16} strokeWidth={1.5} /> Hoofprint — Living Provenance for Model Horses
                    </span>
                    <h1 className="text-engraved-light mb-4 font-serif text-[clamp(1.6rem,3.8vw,2.4rem)] leading-[1.15] font-extrabold tracking-[0.12em] uppercase">
                        The Only Platform Built <span className="text-forest">for This Hobby</span>
                    </h1>
                    <p className="text-secondary-foreground mx-auto mb-6 max-w-[620px] text-base leading-[1.6]">
                        Catalog your herd with a 10,500+ reference database. Track provenance from blank resin to
                        finished custom. Enter virtual photo shows with NAMHSA-style class lists. Sell with verified
                        trust signals. All in one place — built by collectors, for collectors.
                    </p>
                    <div className="strap-nav mb-5 flex flex-wrap items-center justify-center gap-4">
                        <Link
                            href="/signup"
                            className="text-engraved-brass bg-forest hover:bg-forest/90 inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg border-0 px-8 py-2.5 text-base font-semibold text-white no-underline shadow-sm transition-all"
                            id="hero-cta-signup"
                        >
                            Create Free Account
                        </Link>
                        <Link
                            href="/shows/host"
                            className="text-forest border-forest/40 bg-forest/5 hover:bg-forest/10 inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg border px-8 py-2.5 text-base font-semibold no-underline transition-all"
                            id="hero-cta-host"
                        >
                            <Flag size={18} strokeWidth={1.5} /> Host a Show
                        </Link>
                        <Link
                            href="/community"
                            className="text-foreground hover:border-forest hover:text-forest inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-stone-300 bg-transparent px-8 py-2.5 text-base font-semibold no-underline transition-all"
                            id="hero-cta-explore"
                        >
                            Explore the Show Ring
                        </Link>
                    </div>
                    <p className="text-muted-foreground text-xs tracking-[0.03em]">
                        ✦ No credit card required &nbsp;·&nbsp; ✦ Privacy-first &nbsp;·&nbsp; ✦ Free forever tier
                        &nbsp;·&nbsp; ✦ Installable as an app
                    </p>
                </div>
            </section>

            {/* ─── How It Works — paper body begins: ledger tabs label the
           sections, brass bars mark the headings. ─── */}
            <section className="px-8 py-14 text-center" id="how-it-works">
                <div className="mx-auto max-w-[1100px]">
                    <span className="ledger-tab">Getting Started</span>
                    <div className="brass-heading mb-2 justify-center">
                        <span className="brass-heading-bar" aria-hidden="true" />
                        <h2 className="font-serif text-2xl font-extrabold">
                            Get Started in <span className="text-forest">3 Steps</span>
                        </h2>
                    </div>
                    <p className="text-secondary-foreground mx-auto mb-10 max-w-[540px] text-base">
                        From your shelf to the Show Ring in under 5 minutes.
                    </p>
                    <div className="mt-10 flex items-start justify-center gap-6 max-md:flex-col max-md:items-center">
                        <div className="ledger-paper max-w-[320px] flex-1 px-6 py-8 text-center transition-all hover:-translate-y-1 hover:shadow-md">
                            <div className="text-foreground mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-lg font-bold shadow-sm">
                                1
                            </div>
                            <div className="bg-forest/10 text-forest mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl">
                                <Camera size={28} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-foreground mb-2 text-xl font-bold">Add Your Horse</h3>
                            <p className="text-secondary-foreground text-sm leading-relaxed">
                                Search our 10,500+ reference database to instantly identify your model. Upload
                                multi-angle LSQ photos, set condition grades, and track purchase details in your private
                                financial vault.
                            </p>
                        </div>
                        <div
                            className="text-muted-foreground flex h-[300px] items-center justify-center text-4xl max-md:hidden"
                            aria-hidden="true"
                        >
                            →
                        </div>
                        <div className="ledger-paper max-w-[320px] flex-1 px-6 py-8 text-center transition-all hover:-translate-y-1 hover:shadow-md">
                            <div className="text-foreground mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-lg font-bold shadow-sm">
                                2
                            </div>
                            <div className="bg-forest/10 text-forest mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl">
                                <Trophy size={28} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-foreground mb-2 text-xl font-bold">Join the Community</h3>
                            <p className="text-secondary-foreground text-sm leading-relaxed">
                                Publish your best models to the Show Ring. Enter virtual photo shows with NAMHSA-style
                                class lists, follow other collectors, and build your reputation with verified reviews.
                            </p>
                        </div>
                        <div
                            className="text-muted-foreground flex h-[300px] items-center justify-center text-4xl max-md:hidden"
                            aria-hidden="true"
                        >
                            →
                        </div>
                        <div className="ledger-paper max-w-[320px] flex-1 px-6 py-8 text-center transition-all hover:-translate-y-1 hover:shadow-md">
                            <div className="text-foreground mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-lg font-bold shadow-sm">
                                3
                            </div>
                            <div className="bg-forest/10 text-forest mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl">
                                <PawPrint size={28} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-foreground mb-2 text-xl font-bold">Build Your Hoofprint</h3>
                            <p className="text-secondary-foreground text-sm leading-relaxed">
                                Every horse gets a permanent digital identity. Track it from blank resin to finished
                                custom, through ownership changes, with a provenance chain that follows the horse
                                forever.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── Features Grid ─── */}
            <section className="relative px-8 py-14" id="features">
                <div className="mx-auto max-w-7xl text-center">
                    <span className="ledger-tab">The Toolkit</span>
                    <div className="brass-heading mb-2 justify-center">
                        <span className="brass-heading-bar" aria-hidden="true" />
                        <h2 className="font-serif text-2xl font-extrabold">
                            Everything You Need. <span className="text-forest">Nothing You Don&apos;t.</span>
                        </h2>
                    </div>
                    <p className="text-secondary-foreground mx-auto mb-12 max-w-[540px] text-base">
                        Every feature exists because a real collector said &ldquo;I wish this existed.&rdquo;
                    </p>

                    <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-8">
                        {/* Feature 1 — Reference Database */}
                        <div
                            className="ledger-paper relative overflow-hidden p-6 text-left transition-all hover:-translate-y-1 hover:shadow-md md:p-8"
                            id="feature-reference"
                        >
                            <div className="bg-forest/10 text-forest mb-6 flex h-14 w-14 items-center justify-center rounded-xl">
                                <BookOpen size={28} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-foreground mb-2 text-xl font-bold">10,500+ Reference Releases</h3>
                            <p className="text-secondary-foreground text-sm leading-relaxed">
                                Stop Googling &ldquo;Breyer palomino 1995.&rdquo; Our database covers 7,000+ Breyer and
                                Stone releases plus 3,500+ artist resins. Search by mold, sculptor, scale, or year — and
                                identify any model in seconds.
                            </p>
                        </div>

                        {/* Feature 2 — Financial Vault */}
                        <div
                            className="ledger-paper relative overflow-hidden p-6 text-left transition-all hover:-translate-y-1 hover:shadow-md md:p-8"
                            id="feature-vault"
                        >
                            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                                <Shield size={28} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-foreground mb-2 text-xl font-bold">Private Financial Vault</h3>
                            <p className="text-secondary-foreground text-sm leading-relaxed">
                                Know what your collection is really worth — without anyone else seeing. Track purchase
                                prices, estimated values, and insurance notes in a vault that only you can access.
                                Generate insurance PDF reports instantly.
                            </p>
                        </div>

                        {/* Feature 3 — Live & Online Show Hosting */}
                        <div
                            className="ledger-paper relative overflow-hidden p-6 text-left transition-all hover:-translate-y-1 hover:shadow-md md:p-8"
                            id="feature-shows"
                        >
                            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                                <Gavel size={28} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-foreground mb-2 text-xl font-bold">Host a Show — Live or Online</h3>
                            <p className="text-secondary-foreground text-sm leading-relaxed">
                                No other platform does this. Build a full classlist in one click from a NAMHSA-style
                                template, then run it your way: a phone-based ring console for placing live-show tables,
                                champion callbacks, and judging on the spot — or an online photo show with judge or
                                community voting. Results become qualification cards on the horse&apos;s Hoofprint
                                forever, each with a public verification page so a buyer can check a card before they
                                buy.
                            </p>
                        </div>

                        {/* Feature 4 — Blue Book Market Guide */}
                        <div
                            className="ledger-paper relative overflow-hidden p-6 text-left transition-all hover:-translate-y-1 hover:shadow-md md:p-8"
                            id="feature-bluebook"
                        >
                            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                                <TrendingUp size={28} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-foreground mb-2 text-xl font-bold">Blue Book Market Guide</h3>
                            <p className="text-secondary-foreground text-sm leading-relaxed">
                                Real sale data from real collectors. Search market values for 10,500+ models based on
                                completed transactions. The definitive price guide for model horses — no more guessing
                                what something is worth.
                            </p>
                        </div>

                        {/* Feature 5 — Art Studio */}
                        <div
                            className="ledger-paper relative overflow-hidden p-6 text-left transition-all hover:-translate-y-1 hover:shadow-md md:p-8"
                            id="feature-studio"
                        >
                            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                                <Palette size={28} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-foreground mb-2 text-xl font-bold">Art Studio &amp; Commissions</h3>
                            <p className="text-secondary-foreground text-sm leading-relaxed">
                                Artists: manage your commission queue, share WIP progress photos, and build a portfolio.
                                Clients: watch your custom come to life. Every brushstroke becomes part of the
                                horse&apos;s Hoofprint.
                            </p>
                        </div>

                        {/* Feature 6 — Trusted Marketplace */}
                        <div
                            className="ledger-paper relative overflow-hidden p-6 text-left transition-all hover:-translate-y-1 hover:shadow-md md:p-8"
                            id="feature-marketplace"
                        >
                            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                                <Handshake size={28} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-foreground mb-2 text-xl font-bold">Buy, Sell &amp; Trade with Trust</h3>
                            <p className="text-secondary-foreground text-sm leading-relaxed">
                                List models for sale with multi-angle photos. Make and receive offers through structured
                                Safe-Trade flows. Verified seller badges, post-transaction reviews, and
                                Want List matchmaking alerts when your dream horse appears.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── Hoofprint Teaser — a page torn from the ledger itself ─── */}
            <section className="hoofprint-teaser-section" id="hoofprint-teaser">
                <div className="ledger-paper mx-auto max-w-[720px] px-8 py-10">
                    <div className="mb-6">
                        <span className="stamp">Now Live</span>
                    </div>
                    <h2 className="mb-6 font-serif text-[clamp(1.5rem,3.5vw,2.5rem)] leading-[1.2] font-extrabold">
                        Every Horse Has a Story. <span className="text-forest">Hoofprint Tells It.</span>
                    </h2>
                    <p className="text-secondary-foreground mb-4 text-base leading-[1.7]">
                        Imagine a permanent digital identity for every model horse. From the moment a blank resin is
                        cast, through the artist&apos;s brushstrokes, to the collector who treasures it — and the next
                        collector after that.
                    </p>
                    <p className="text-secondary-foreground mb-4 text-base leading-[1.7]">
                        Hoofprint is the first-ever living provenance system for model horses. Photos, ownership
                        transfers, customization records, and show results all follow the horse — not the owner. Like a
                        passport that never expires.
                    </p>
                    <div className="mt-10 flex flex-wrap justify-center gap-6">
                        <div className="ledger-tile text-forest flex max-w-[220px] min-w-[180px] flex-1 flex-col items-center gap-1">
                            <span>
                                <Camera size={20} strokeWidth={1.5} />
                            </span>
                            <strong className="text-foreground">Photo Timeline</strong>
                            <span className="text-secondary-foreground text-sm">
                                Track every stage from blank to finished
                            </span>
                        </div>
                        <div className="ledger-tile text-forest flex max-w-[220px] min-w-[180px] flex-1 flex-col items-center gap-1">
                            <span>
                                <Handshake size={20} strokeWidth={1.5} />
                            </span>
                            <strong className="text-foreground">Ownership Chain</strong>
                            <span className="text-secondary-foreground text-sm">
                                Verified history follows the horse forever
                            </span>
                        </div>
                        <div className="ledger-tile text-forest flex max-w-[220px] min-w-[180px] flex-1 flex-col items-center gap-1">
                            <span>
                                <Package size={20} strokeWidth={1.5} />
                            </span>
                            <strong className="text-foreground">One-Click Transfer</strong>
                            <span className="text-secondary-foreground text-sm">
                                Sell a horse and pass its entire history along
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── Who It's For ─── */}
            <section className="px-8 py-14 text-center" id="who-its-for">
                <div className="mx-auto max-w-7xl text-center">
                    <span className="ledger-tab">For Every Collector</span>
                    <div className="brass-heading mb-2 justify-center">
                        <span className="brass-heading-bar" aria-hidden="true" />
                        <h2 className="font-serif text-2xl font-extrabold">
                            Built for <span className="text-forest">Every Part of the Hobby</span>
                        </h2>
                    </div>
                    <div className="mt-10 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-8">
                        <div className="ledger-paper [&_p]:text-secondary-foreground p-8 text-center transition-transform duration-300 hover:-translate-y-1 [&_h3]:mb-2 [&_h3]:text-lg [&_p]:text-sm">
                            <div className="mb-4 flex justify-center">
                                <Home size={32} strokeWidth={1.5} />
                            </div>
                            <h3>The Collector</h3>
                            <p>
                                From 20 models to 2,000+. Catalog your herd with reference data, multi-angle photos, and
                                a private vault. Filter your stable by any facet and save the views you use most. Import
                                your entire spreadsheet in minutes with CSV batch import.
                            </p>
                        </div>
                        <div className="ledger-paper [&_p]:text-secondary-foreground p-8 text-center transition-transform duration-300 hover:-translate-y-1 [&_h3]:mb-2 [&_h3]:text-lg [&_p]:text-sm">
                            <div className="mb-4 flex justify-center">
                                <Palette size={32} strokeWidth={1.5} />
                            </div>
                            <h3>The Artist &amp; Customizer</h3>
                            <p>
                                Manage commissions, share WIP progress with clients, and build a portfolio that speaks
                                for itself. When you deliver a custom, your creation story becomes part of its
                                Hoofprint — forever.
                            </p>
                        </div>
                        <div className="ledger-paper [&_p]:text-secondary-foreground p-8 text-center transition-transform duration-300 hover:-translate-y-1 [&_h3]:mb-2 [&_h3]:text-lg [&_p]:text-sm">
                            <div className="mb-4 flex justify-center">
                                <Trophy size={32} strokeWidth={1.5} />
                            </div>
                            <h3>The Shower &amp; Competitor</h3>
                            <p>
                                Log show records, track NAN qualifications, and pack your live show string with conflict
                                detection. Enter virtual shows with NAMHSA class templates and visual ribbon judging.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── Social Proof / Stats — green strap, engraved brass numerals ─── */}
            <section className="px-8 py-8" id="stats">
                <div className="stats-strap mx-auto max-w-5xl" role="group" aria-label="Platform statistics">
                    <div>
                        <div className="stat-num">10,500+</div>
                        <div className="stat-label">Releases &amp; Resins</div>
                    </div>
                    <div>
                        <div className="stat-num flex justify-center">
                            <PawPrint size={28} strokeWidth={1.5} />
                        </div>
                        <div className="stat-label">Hoofprint Tracking</div>
                    </div>
                    <div>
                        <div className="stat-num flex justify-center">
                            <Shield size={28} strokeWidth={1.5} />
                        </div>
                        <div className="stat-label">Privacy-First</div>
                    </div>
                    <div>
                        <div className="stat-num">100%</div>
                        <div className="stat-label">Free to Start</div>
                    </div>
                </div>
            </section>

            {/* ─── Already Live ─── */}
            <section className="px-8 py-14 text-center" id="already-live">
                <div className="mx-auto max-w-7xl text-center">
                    <span className="ledger-tab">Open Now</span>
                    <div className="brass-heading mb-2 justify-center">
                        <span className="brass-heading-bar" aria-hidden="true" />
                        <h2 className="font-serif text-2xl font-extrabold">
                            Already <span className="text-forest">Live</span>
                        </h2>
                    </div>
                    <p className="text-secondary-foreground mx-auto mb-12 max-w-[540px] text-base">
                        These aren&apos;t promises — they&apos;re features you can use right now.
                    </p>
                    <div className="mt-10 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-8">
                        <div className="ledger-paper [&_p]:text-secondary-foreground p-8 text-center transition-transform duration-300 hover:-translate-y-1 [&_h3]:mb-2 [&_h3]:text-lg [&_p]:text-sm">
                            <div className="text-forest mb-4 flex justify-center">
                                <Users size={32} strokeWidth={1.5} />
                            </div>
                            <h3>Notice Board Groups</h3>
                            <p>
                                Create or join groups with their own Notice Board — threaded discussions, channels, and
                                pinned posts. Share files and manage members with admin tools. Dedicated spaces for
                                breed circles, regional clubs, or trading networks.
                            </p>
                        </div>
                        <div className="ledger-paper [&_p]:text-secondary-foreground p-8 text-center transition-transform duration-300 hover:-translate-y-1 [&_h3]:mb-2 [&_h3]:text-lg [&_p]:text-sm">
                            <div className="text-forest mb-4 flex justify-center">
                                <Smartphone size={32} strokeWidth={1.5} />
                            </div>
                            <h3>Installable App (PWA)</h3>
                            <p>
                                Add Model Horse Hub to your home screen on any device. Works offline at live shows so
                                you can access your stable and show string without cell service.
                            </p>
                        </div>
                        <div className="ledger-paper [&_p]:text-secondary-foreground p-8 text-center transition-transform duration-300 hover:-translate-y-1 [&_h3]:mb-2 [&_h3]:text-lg [&_p]:text-sm">
                            <div className="text-forest mb-4 flex justify-center">
                                <Bot size={32} strokeWidth={1.5} />
                            </div>
                            <h3>AI Stablemaster</h3>
                            <p>
                                Monthly AI-powered collection analysis for Pro members. Insights about your collection
                                trends, value highlights, and personalized recommendations — powered by Google Gemini.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── Pro Tier Teaser ─── */}
            <section className="px-8 py-14" id="pro-tier">
                <div className="ledger-paper mx-auto max-w-[720px] px-8 py-10 text-center">
                    <div className="mb-6 inline-flex items-center gap-2">
                        <Sparkles size={16} strokeWidth={1.5} className="text-amber-600" />
                        <span className="stamp-red stamp">MHH Pro</span>
                    </div>
                    <div className="brass-heading justify-center">
                        <span className="brass-heading-bar" aria-hidden="true" />
                        <h2 className="font-serif text-2xl font-extrabold">
                            Go Pro When You&apos;re <span className="text-forest">Ready</span>
                        </h2>
                    </div>
                    <p className="text-secondary-foreground mx-auto mt-4 mb-8 max-w-[540px] text-base leading-[1.7]">
                        The free tier has everything you need to catalog and connect. When you want more, Pro unlocks
                        the premium tools — but never locks you out of the basics.
                    </p>
                    <div className="mt-8 grid grid-cols-2 gap-4 text-left max-sm:grid-cols-1">
                        <div className="ledger-tile flex items-start gap-3">
                            <span className="mt-0.5 text-amber-500">✦</span>
                            <div>
                                <p className="text-foreground text-sm font-semibold">Photo Suite+</p>
                                <p className="text-muted-foreground text-xs">30 extra photos per horse</p>
                            </div>
                        </div>
                        <div className="ledger-tile flex items-start gap-3">
                            <span className="mt-0.5 text-amber-500">✦</span>
                            <div>
                                <p className="text-foreground text-sm font-semibold">Blue Book PRO Charts</p>
                                <p className="text-muted-foreground text-xs">Historical price trends &amp; analytics</p>
                            </div>
                        </div>
                        <div className="ledger-tile flex items-start gap-3">
                            <span className="mt-0.5 text-amber-500">✦</span>
                            <div>
                                <p className="text-foreground text-sm font-semibold">AI Stablemaster</p>
                                <p className="text-muted-foreground text-xs">Monthly collection analysis</p>
                            </div>
                        </div>
                        <div className="ledger-tile flex items-start gap-3">
                            <span className="mt-0.5 text-amber-500">✦</span>
                            <div>
                                <p className="text-foreground text-sm font-semibold">Show Tags PDF</p>
                                <p className="text-muted-foreground text-xs">Printable show tags with QR codes</p>
                            </div>
                        </div>
                    </div>
                    <Link
                        href="/upgrade"
                        className="mt-8 inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-3 text-base font-bold text-white no-underline shadow-sm transition-all hover:from-amber-600 hover:to-orange-600"
                        id="pro-cta"
                    >
                        💎 View Plans &amp; Pricing
                    </Link>
                </div>
            </section>

            {/* ─── Transparency Banner ─── */}
            <section className="px-8 py-8" id="transparency">
                <div className="ledger-paper mx-auto flex max-w-[720px] items-start gap-4 max-sm:flex-col">
                    <div className="bg-forest/10 text-forest flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
                        <Shield size={24} strokeWidth={1.5} />
                    </div>
                    <div>
                        <h3 className="text-foreground mb-1 text-base font-bold">Your Data &amp; Art Belong to You</h3>
                        <p className="text-secondary-foreground text-sm leading-relaxed">
                            We do <strong>not</strong> use your photos to train AI. Our 10,500+ reference catalog was
                            built using traditional data-gathering scripts — not AI scrapers — from publicly available
                            hobby sources. Read our full{" "}
                            <Link href="/about#ai-data-policy" className="text-forest underline">
                                AI, Data &amp; Copyright Policy
                            </Link>
                            .
                        </p>
                    </div>
                </div>
            </section>

            {/* ─── Final CTA ─── */}
            <section className="px-8 py-16 text-center" id="final-cta">
                <div className="animate-fade-in-up mx-auto max-w-[600px]">
                    <h2 className="font-serif text-2xl font-extrabold">
                        Ready to Give Your Herd <span className="text-forest">a Real Home</span>?
                    </h2>
                    <p className="text-secondary-foreground mx-auto mt-4 mb-8 max-w-[480px]">
                        Join collectors and artists who catalog, connect, and trade on the only platform built for the
                        model horse hobby.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <Link
                            href="/signup"
                            className="bg-forest hover:bg-forest/90 inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg border-0 px-8 py-3 text-base font-semibold text-white no-underline shadow-sm transition-all"
                            id="final-cta-signup"
                        >
                            Create Your Free Account →
                        </Link>
                        <Link
                            href="/shows/host"
                            className="text-forest border-forest/40 bg-forest/5 hover:bg-forest/10 inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg border px-8 py-3 text-base font-semibold no-underline transition-all"
                            id="final-cta-host"
                        >
                            <Flag size={18} strokeWidth={1.5} /> Host a Show
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}
