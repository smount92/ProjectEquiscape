import Link from"next/link";
import type { Metadata } from"next";
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
} from"lucide-react";

export const metadata: Metadata = {
 title:"Model Horse Hub — The Digital Home for the Model Horse Hobby",
 description:
"The all-in-one platform for model horse collectors and artists. 10,500+ reference releases, Hoofprint™ provenance tracking, LSQ photography, private financial vault, community marketplace, virtual photo shows, and artist commission tools. Free forever.",
};

export default function LandingPage() {
 return (
 <div className="overflow-x-hidden">
 {/* ─── Hero Section ─── */}
 <section
 className="flex min-h-[calc(100vh-var(--header-height))] items-center justify-center px-6 py-12"
 id="hero"
 >
 <div className="absolute inset-0 rounded-full bg-forest/10 blur-3xl" aria-hidden="true" />
 <div className="absolute inset-0 rounded-full bg-forest/10 blur-3xl hidden" aria-hidden="true" />
 <div className="animate-fade-in-up relative z-[1] max-w-[780px]">
 <span className="text-forest border-[rgba(44,85,69,0.25)] mb-8 inline-block rounded-full border bg-[var(--color-accent-primary-glow)] px-6 py-1 text-sm font-semibold tracking-[0.01em]">
 <Fingerprint size={16} strokeWidth={1.5} /> Hoofprint™ — The First Living Provenance System for
 Model Horses
 </span>
 <h1 className="text-[clamp(2rem, 5vw, 3.5rem)] mb-6 leading-[1.1] font-extrabold tracking-[-0.03em]">
 The Only Platform Built <span className="text-forest">for This Hobby</span>
 </h1>
 <p className="text-ink-light mx-auto mb-10 max-w-[620px] text-base leading-[1.7]">
 Catalog your herd with a 10,500+ reference database. Track provenance from blank resin to
 finished custom. Sell with verified trust signals. And soon — manage commissions, plan show
 strings, and join collector groups. All in one place. Built by collectors, for collectors.
 </p>
 <div className="mb-8 flex flex-wrap items-center justify-center gap-4">
 <Link
 href="/signup"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 id="hero-cta-signup"
 >
 Create Free Account
 </Link>
 <Link
 href="/community"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 id="hero-cta-explore"
 >
 Explore the Show Ring
 </Link>
 </div>
 <p className="text-muted text-xs tracking-[0.03em]">
 ✦ No credit card required &nbsp;·&nbsp; ✦ Privacy-first &nbsp;·&nbsp; ✦ Free forever tier
 </p>
 </div>
 </section>

 {/* ─── How It Works ─── */}
 <section className="px-8 py-12 text-center" id="how-it-works">
 <div className="mx-auto max-w-[1100px]">
 <h2 className="mb-2 text-2xl font-extrabold tracking-[-0.02em]">
 Get Started in <span className="text-forest">3 Steps</span>
 </h2>
 <p className="text-ink-light mx-auto mb-12 max-w-[540px] text-base">
 From your shelf to the Show Ring in under 5 minutes.
 </p>
 <div className="mt-12 flex items-start justify-center gap-6">
 <div className="bg-[rgba(0,0,0,0.03)] border-[rgba(0,0,0,0.06)] max-w-[320px] flex-1 rounded-xl border px-6 py-8 text-center transition-colors">
 <div className="bg-[rgba(0,0,0,0.03)] border-[rgba(0,0,0,0.06)] transition-colors-number max-w-[320px] flex-1 rounded-xl border px-6 py-8 text-center">
 1
 </div>
 <div className="bg-[rgba(0,0,0,0.03)] border-[rgba(0,0,0,0.06)] transition-colors-icon max-w-[320px] flex-1 rounded-xl border px-6 py-8 text-center">
 <Camera size={28} strokeWidth={1.5} />
 </div>
 <h3>Add Your Horse</h3>
 <p>
 Search our 10,500+ reference database to instantly identify your model. Upload
 multi-angle LSQ photos, set condition grades, and track purchase details in your private
 financial vault.
 </p>
 </div>
 <div
 className="bg-[rgba(0,0,0,0.03)] border-[rgba(0,0,0,0.06)] transition-colors-arrow max-w-[320px] flex-1 rounded-xl border px-6 py-8 text-center"
 aria-hidden="true"
 >
 →
 </div>
 <div className="bg-[rgba(0,0,0,0.03)] border-[rgba(0,0,0,0.06)] max-w-[320px] flex-1 rounded-xl border px-6 py-8 text-center transition-colors">
 <div className="bg-[rgba(0,0,0,0.03)] border-[rgba(0,0,0,0.06)] transition-colors-number max-w-[320px] flex-1 rounded-xl border px-6 py-8 text-center">
 2
 </div>
 <div className="bg-[rgba(0,0,0,0.03)] border-[rgba(0,0,0,0.06)] transition-colors-icon max-w-[320px] flex-1 rounded-xl border px-6 py-8 text-center">
 <Trophy size={28} strokeWidth={1.5} />
 </div>
 <h3>Join the Community</h3>
 <p>
 Publish your best models to the Show Ring for the community to discover. Enter virtual
 photo shows, follow other collectors, and build your reputation with verified ratings.
 </p>
 </div>
 <div
 className="bg-[rgba(0,0,0,0.03)] border-[rgba(0,0,0,0.06)] transition-colors-arrow max-w-[320px] flex-1 rounded-xl border px-6 py-8 text-center"
 aria-hidden="true"
 >
 →
 </div>
 <div className="bg-[rgba(0,0,0,0.03)] border-[rgba(0,0,0,0.06)] max-w-[320px] flex-1 rounded-xl border px-6 py-8 text-center transition-colors">
 <div className="bg-[rgba(0,0,0,0.03)] border-[rgba(0,0,0,0.06)] transition-colors-number max-w-[320px] flex-1 rounded-xl border px-6 py-8 text-center">
 3
 </div>
 <div className="bg-[rgba(0,0,0,0.03)] border-[rgba(0,0,0,0.06)] transition-colors-icon max-w-[320px] flex-1 rounded-xl border px-6 py-8 text-center">
 <PawPrint size={28} strokeWidth={1.5} />
 </div>
 <h3>Build Your Hoofprint</h3>
 <p>
 Every horse gets a permanent digital identity. Track it from blank resin to finished
 custom, through ownership changes, with a provenance chain that follows the horse
 forever.
 </p>
 </div>
 </div>
 </div>
 </section>

 {/* ─── Features Grid ─── */}
 <section className="relative px-8 py-12" id="features">
 <div className="mx-auto max-w-[var(--max-width)] text-center">
 <h2 className="mb-2 text-2xl font-extrabold tracking-[-0.02em]">
 Everything You Need. <span className="text-forest">Nothing You Don&apos;t.</span>
 </h2>
 <p className="text-ink-light mx-auto mb-12 max-w-[540px] text-base">
 Every feature exists because a real collector said &ldquo;I wish this existed.&rdquo;
 </p>

 <div className="grid-cols-[repeat(auto-fit,minmax(300px,1fr))] grid gap-8">
 {/* Feature 1 — Reference Database */}
 <div
 className="bg-card border-edge relative overflow-hidden rounded-lg border text-left shadow-md transition-all"
 id="feature-reference"
 >
 <div className="text-forest mb-6 flex h-[56px] w-[56px] items-center justify-center rounded-md bg-[var(--color-accent-primary-glow)]">
 <svg
 width="32"
 height="32"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="1.5"
 strokeLinecap="round"
 strokeLinejoin="round"
 >
 <path d="M12 2L9.5 8.5 3 10l5 4.5L6.5 21 12 17.5 17.5 21 16 14.5l5-4.5-6.5-1.5z" />
 </svg>
 </div>
 <h3 className="bg-card border-edge overflow-hidden-title relative rounded-lg border text-left shadow-md transition-all">
 10,500+ Reference Releases
 </h3>
 <p className="bg-card border-edge overflow-hidden-desc relative rounded-lg border text-left shadow-md transition-all">
 Stop Googling &ldquo;Breyer palomino 1995.&rdquo; Our database covers 7,000+ Breyer and
 Stone releases plus 3,500+ artist resins from the Equine Resin Directory. Search by
 mold, sculptor, scale, or year — and identify any model in seconds.
 </p>
 </div>

 {/* Feature 2 — Financial Vault */}
 <div
 className="bg-card border-edge relative overflow-hidden rounded-lg border text-left shadow-md transition-all"
 id="feature-vault"
 >
 <div className="text-forest bg-[rgba(240,160,108,0.15)] mb-6 flex h-[56px] w-[56px] items-center justify-center rounded-md bg-[var(--color-accent-primary-glow)] text-[var(--color-accent-secondary)]">
 <svg
 width="32"
 height="32"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="1.5"
 strokeLinecap="round"
 strokeLinejoin="round"
 >
 <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
 <path d="M7 11V7a5 5 0 0 1 10 0v4" />
 </svg>
 </div>
 <h3 className="bg-card border-edge overflow-hidden-title relative rounded-lg border text-left shadow-md transition-all">
 Private Financial Vault
 </h3>
 <p className="bg-card border-edge overflow-hidden-desc relative rounded-lg border text-left shadow-md transition-all">
 Know what your collection is really worth — without anyone else seeing. Track purchase
 prices, estimated values, and insurance notes in a vault that only you can access. Even
 our team can&apos;t see your data.
 </p>
 </div>

 {/* Feature 3 — Community Show Ring */}
 <div
 className="bg-card border-edge relative overflow-hidden rounded-lg border text-left shadow-md transition-all"
 id="feature-showring"
 >
 <div className="text-forest bg-[rgba(92,224,160,0.12)] text-success mb-6 flex h-[56px] w-[56px] items-center justify-center rounded-md bg-[var(--color-accent-primary-glow)]">
 <svg
 width="32"
 height="32"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="1.5"
 strokeLinecap="round"
 strokeLinejoin="round"
 >
 <circle cx="12" cy="8" r="7" />
 <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
 </svg>
 </div>
 <h3 className="bg-card border-edge overflow-hidden-title relative rounded-lg border text-left shadow-md transition-all">
 Community Show Ring
 </h3>
 <p className="bg-card border-edge overflow-hidden-desc relative rounded-lg border text-left shadow-md transition-all">
 Your proudest models deserve an audience. Browse other collectors&apos; herds, filter by
 scale, manufacturer, and finish type, and discover your next obsession — or your next
 purchase.
 </p>
 </div>

 {/* Feature 4 — Social Community */}
 <div
 className="bg-card border-edge relative overflow-hidden rounded-lg border text-left shadow-md transition-all"
 id="feature-social"
 >
 <div className="text-forest flex items-center justify-center w-14 h-14 rounded-md bg-forest/10-social mb-6 flex h-[56px] w-[56px] items-center justify-center rounded-md bg-[var(--color-accent-primary-glow)]">
 <svg
 width="32"
 height="32"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="1.5"
 strokeLinecap="round"
 strokeLinejoin="round"
 >
 <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
 <circle cx="9" cy="7" r="4" />
 <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
 <path d="M16 3.13a4 4 0 0 1 0 7.75" />
 </svg>
 </div>
 <h3 className="bg-card border-edge overflow-hidden-title relative rounded-lg border text-left shadow-md transition-all">
 Follow Your Favorite Collectors
 </h3>
 <p className="bg-card border-edge overflow-hidden-desc relative rounded-lg border text-left shadow-md transition-all">
 No more scrolling through Facebook groups hoping to see updates. Follow the collectors
 you care about, see their new additions in your feed, and build real connections in a
 space made for the hobby.
 </p>
 </div>

 {/* Feature 5 — Virtual Photo Shows */}
 <div
 className="bg-card border-edge relative overflow-hidden rounded-lg border text-left shadow-md transition-all"
 id="feature-shows"
 >
 <div className="text-forest flex items-center justify-center w-14 h-14 rounded-md bg-forest/10-shows mb-6 flex h-[56px] w-[56px] items-center justify-center rounded-md bg-[var(--color-accent-primary-glow)]">
 <svg
 width="32"
 height="32"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="1.5"
 strokeLinecap="round"
 strokeLinejoin="round"
 >
 <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
 <circle cx="8.5" cy="8.5" r="1.5" />
 <polyline points="21 15 16 10 5 21" />
 </svg>
 </div>
 <h3 className="bg-card border-edge overflow-hidden-title relative rounded-lg border text-left shadow-md transition-all">
 Virtual Photo Shows
 </h3>
 <p className="bg-card border-edge overflow-hidden-desc relative rounded-lg border text-left shadow-md transition-all">
 Can&apos;t make it to a live show? Enter themed virtual shows, vote for your favorites,
 and compete for placement — all from home. Shows run on deadlines with real results.
 </p>
 </div>

 {/* Feature 6 — Trusted Marketplace */}
 <div
 className="bg-card border-edge relative overflow-hidden rounded-lg border text-left shadow-md transition-all"
 id="feature-marketplace"
 >
 <div className="text-forest flex items-center justify-center w-14 h-14 rounded-md bg-forest/10-market mb-6 flex h-[56px] w-[56px] items-center justify-center rounded-md bg-[var(--color-accent-primary-glow)]">
 <svg
 width="32"
 height="32"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="1.5"
 strokeLinecap="round"
 strokeLinejoin="round"
 >
 <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
 </svg>
 </div>
 <h3 className="bg-card border-edge overflow-hidden-title relative rounded-lg border text-left shadow-md transition-all">
 Buy, Sell &amp; Trade with Confidence
 </h3>
 <p className="bg-card border-edge overflow-hidden-desc relative rounded-lg border text-left shadow-md transition-all">
 List models for sale with multi-angle photos, message buyers directly, and build your
 seller rating. Wishlist matchmaking alerts you when your dream horse goes on the market.
 </p>
 </div>
 </div>
 </div>
 </section>

 {/* ─── Hoofprint™ Teaser ─── */}
 <section className="hoofprint-teaser-section" id="hoofprint-teaser">
 <div className="mx-auto max-w-[720px]">
 <div className="bg-[rgba(245,158,11,0.1)] border-[rgba(245,158,11,0.25)] mb-8 inline-block rounded-full border px-6 py-1 text-sm font-semibold tracking-[0.02em] text-[#f59e0b]">
 <PawPrint size={16} strokeWidth={1.5} /> Now Live
 </div>
 <h2 className="text-[clamp(1.5rem, 3.5vw, 2.5rem)] mb-6 leading-[1.2] font-extrabold">
 Every Horse Has a Story. <span className="text-forest">Hoofprint™ Tells It.</span>
 </h2>
 <p className="text-muted mb-4 text-base leading-[1.7]">
 Imagine a permanent digital identity for every model horse. From the moment a blank resin is
 cast, through the artist&apos;s brushstrokes, to the collector who treasures it for years — and
 the next collector after that.
 </p>
 <p className="text-muted mb-4 text-base leading-[1.7]">
 Hoofprint™ is the first-ever living provenance system for model horses. Photos, ownership
 transfers, customization records, and show results all follow the horse — not the owner. Like a
 passport that never expires.
 </p>
 <div className="mt-12 flex flex-wrap justify-center gap-6">
 <div className="flex max-w-[220px] min-w-[180px] flex-1 flex-col items-center gap-1">
 <span>
 <Camera size={20} strokeWidth={1.5} />
 </span>
 <strong>Photo Timeline</strong>
 <span>Track every stage from blank to finished</span>
 </div>
 <div className="flex max-w-[220px] min-w-[180px] flex-1 flex-col items-center gap-1">
 <span>
 <Handshake size={20} strokeWidth={1.5} />
 </span>
 <strong>Ownership Chain</strong>
 <span>Verified history follows the horse forever</span>
 </div>
 <div className="flex max-w-[220px] min-w-[180px] flex-1 flex-col items-center gap-1">
 <span>
 <Package size={20} strokeWidth={1.5} />
 </span>
 <strong>One-Click Transfer</strong>
 <span>Sell a horse and pass its entire history along</span>
 </div>
 </div>
 </div>
 </section>

 {/* ─── Who It's For ─── */}
 <section className="px-8 py-16 text-center" id="who-its-for">
 <div className="mx-auto max-w-[var(--max-width)] text-center">
 <h2 className="mb-2 text-2xl font-extrabold tracking-[-0.02em]">
 Built for <span className="text-forest">Every Part of the Hobby</span>
 </h2>
 <div className="mt-12 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-8">
 <div className="[&_p]:text-ink-light rounded-xl border border-[rgba(0,0,0,0.06)] bg-[rgba(0,0,0,0.03)] p-8 text-center transition-transform duration-300 hover:-translate-y-1 hover:border-[rgba(44,85,69,0.3)] [&_h3]:mb-2 [&_h3]:text-[calc(1.1rem*var(--font-scale))] [&_p]:text-sm">
 <div className="mb-4 text-[3rem]">
 <Home size={32} strokeWidth={1.5} />
 </div>
 <h3>The Collector</h3>
 <p>
 From 20 models to 2,000+. Catalog your herd with reference data, multi-angle photos, and
 a private vault. Import your entire spreadsheet in minutes — not months.
 </p>
 </div>
 <div className="[&_p]:text-ink-light rounded-xl border border-[rgba(0,0,0,0.06)] bg-[rgba(0,0,0,0.03)] p-8 text-center transition-transform duration-300 hover:-translate-y-1 hover:border-[rgba(44,85,69,0.3)] [&_h3]:mb-2 [&_h3]:text-[calc(1.1rem*var(--font-scale))] [&_p]:text-sm">
 <div className="mb-4 text-[3rem]">
 <Palette size={32} strokeWidth={1.5} />
 </div>
 <h3>The Artist &amp; Customizer</h3>
 <p>
 Manage commissions, share WIP progress with clients, and build a portfolio that speaks
 for itself. When you deliver a custom, your creation story becomes part of its
 Hoofprint&trade; — forever.
 </p>
 </div>
 <div className="[&_p]:text-ink-light rounded-xl border border-[rgba(0,0,0,0.06)] bg-[rgba(0,0,0,0.03)] p-8 text-center transition-transform duration-300 hover:-translate-y-1 hover:border-[rgba(44,85,69,0.3)] [&_h3]:mb-2 [&_h3]:text-[calc(1.1rem*var(--font-scale))] [&_p]:text-sm">
 <div className="mb-4 text-[3rem]">
 <Trophy size={32} strokeWidth={1.5} />
 </div>
 <h3>The Shower &amp; Competitor</h3>
 <p>
 Log show records, track NAN qualifications digitally, and plan your show string before
 you pack the car. When you sell a champion, its ribbons follow through Hoofprint&trade;.
 </p>
 </div>
 </div>
 </div>
 </section>

 {/* ─── Social Proof / Stats ─── */}
 <section
 className="border-edge border-t border-b bg-[var(--color-bg-secondary)] px-8 py-12"
 id="stats"
 >
 <div className="mx-auto flex max-w-[var(--max-width)] items-center justify-center gap-12">
 <div className="flex flex-col items-center gap-1">
 <span className="text-ink text-2xl font-extrabold">10,500+</span>
 <span className="text-muted text-sm font-medium">Releases &amp; Resins</span>
 </div>
 <div className="bg-edge h-[48px] w-[1px]" aria-hidden="true" />
 <div className="flex flex-col items-center gap-1">
 <span className="text-ink text-2xl font-extrabold">
 <PawPrint size={28} strokeWidth={1.5} />
 </span>
 <span className="text-muted text-sm font-medium">Hoofprint™ Tracking</span>
 </div>
 <div className="bg-edge h-[48px] w-[1px]" aria-hidden="true" />
 <div className="flex flex-col items-center gap-1">
 <span className="text-ink text-2xl font-extrabold">
 <Shield size={28} strokeWidth={1.5} />
 </span>
 <span className="text-muted text-sm font-medium">Privacy-First</span>
 </div>
 <div className="bg-edge h-[48px] w-[1px]" aria-hidden="true" />
 <div className="flex flex-col items-center gap-1">
 <span className="text-ink text-2xl font-extrabold">100%</span>
 <span className="text-muted text-sm font-medium">Free to Start</span>
 </div>
 </div>
 </section>

 {/* ─── Coming Soon ─── */}
 <section className="px-8 py-16 text-center" id="coming-soon">
 <div className="mx-auto max-w-[var(--max-width)] text-center">
 <h2 className="mb-2 text-2xl font-extrabold tracking-[-0.02em]">
 On the <span className="text-forest">Horizon</span>
 </h2>
 <p className="text-ink-light mx-auto mb-12 max-w-[540px] text-base">
 We&apos;re building the operating system for the hobby. Here&apos;s what&apos;s next.
 </p>
 <div className="mt-12 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-8">
 <div className="[&_p]:text-ink-light rounded-xl border border-[rgba(0,0,0,0.06)] bg-[rgba(0,0,0,0.03)] p-8 text-center transition-transform duration-300 hover:-translate-y-1 hover:border-[rgba(44,85,69,0.3)] [&_h3]:mb-2 [&_h3]:text-[calc(1.1rem*var(--font-scale))] [&_p]:text-sm">
 <div className="mb-4 text-[3rem]">
 <Palette size={32} strokeWidth={1.5} />
 </div>
 <h3>Art Studio</h3>
 <p>
 Commission tracking, WIP photo portals, and artist portfolios. Artists manage their
 queue. Clients watch their custom come to life. Every brushstroke becomes provenance.
 </p>
 </div>
 <div className="[&_p]:text-ink-light rounded-xl border border-[rgba(0,0,0,0.06)] bg-[rgba(0,0,0,0.03)] p-8 text-center transition-transform duration-300 hover:-translate-y-1 hover:border-[rgba(44,85,69,0.3)] [&_h3]:mb-2 [&_h3]:text-[calc(1.1rem*var(--font-scale))] [&_p]:text-sm">
 <div className="mb-4 text-[3rem]">
 <Package size={32} strokeWidth={1.5} />
 </div>
 <h3>Bulk Import</h3>
 <p>
 Upload your entire spreadsheet and we&apos;ll fuzzy-match every row against our 10,500+
 reference database. Go from CSV to cataloged in minutes.
 </p>
 </div>
 <div className="[&_p]:text-ink-light rounded-xl border border-[rgba(0,0,0,0.06)] bg-[rgba(0,0,0,0.03)] p-8 text-center transition-transform duration-300 hover:-translate-y-1 hover:border-[rgba(44,85,69,0.3)] [&_h3]:mb-2 [&_h3]:text-[calc(1.1rem*var(--font-scale))] [&_p]:text-sm">
 <div className="mb-4 text-[3rem]">
 <TrendingUp size={32} strokeWidth={1.5} />
 </div>
 <h3>Price Guide</h3>
 <p>
 Real sale data from real collectors. Search market values for 10,500+ models based on
 completed transactions. The Blue Book for model horses.
 </p>
 </div>
 </div>
 </div>
 </section>

 {/* ─── Final CTA ─── */}
 <section className="px-8 py-12 text-center" id="final-cta">
 <div className="animate-fade-in-up mx-auto max-w-[600px]">
 <h2>
 Ready to Give Your Herd <span className="text-forest">a Real Home</span>?
 </h2>
 <p>
 Join collectors and artists who catalog, connect, and trade on the only platform built for the
 model horse hobby.
 </p>
 <Link
 href="/signup"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 id="final-cta-signup"
 >
 Create Your Free Account →
 </Link>
 </div>
 </section>
 </div>
 );
}
