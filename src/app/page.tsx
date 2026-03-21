import Link from "next/link";
import type { Metadata } from "next";
import {
  Camera, Trophy, PawPrint, Handshake, Package,
  Home, Palette, TrendingUp, Shield, Fingerprint
} from "lucide-react";

export const metadata: Metadata = {
  title: "Model Horse Hub — The Digital Home for the Model Horse Hobby",
  description:
    "The all-in-one platform for model horse collectors and artists. 10,500+ reference releases, Hoofprint™ provenance tracking, LSQ photography, private financial vault, community marketplace, virtual photo shows, and artist commission tools. Free forever.",
};

export default function LandingPage() {
  return (
    <div className="overflow-x-hidden">
      {/* ─── Hero Section ─── */}
      <section className="relative flex items-center justify-center min-h-[calc(100vh - var(--sticky top-0 z-[100] h-[var(--header-height)] flex items-center justify-between py-[0] px-8 bg-parchment-dark border-b border-edge transition-all-height))] py-[var(--space-3xl)] px-8 text-center overflow-hidden" id="hero">
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-glow hidden" aria-hidden="true" />
        <div className="relative z-[1] max-w-[780px] animate-fade-in-up">
          <span className="inline-block py-1 px-6 text-sm font-semibold text-forest bg-[var(--color-accent-primary-glow)] border border-[rgba(44, 85, 69, 0.25)] rounded-full mb-8 tracking-[0.01em]"><Fingerprint size={16} strokeWidth={1.5} /> Hoofprint™ — The First Living Provenance System for Model Horses</span>
          <h1 className="text-[clamp(2rem, 5vw, 3.5rem)] font-extrabold leading-[1.1] mb-6 tracking-[-0.03em]">
            The Only Platform Built{" "}
            <span className="text-forest">for This Hobby</span>
          </h1>
          <p className="text-[calc(var(--font-size-md)*var(--font-scale))] text-ink-light leading-[1.7] max-w-[620px] m-[0 auto var(--space-2xl)]">
            Catalog your herd with a 10,500+ reference database. Track provenance
            from blank resin to finished custom. Sell with verified trust signals.
            And soon — manage commissions, plan show strings, and join collector groups.
            All in one place. Built by collectors, for collectors.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap mb-8">
            <Link href="/signup" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm min-h-[52px] py-4 px-12 text-[calc(var(--font-size-md)*var(--font-scale))] rounded-lg" id="hero-cta-signup">
              Create Free Account
            </Link>
            <Link href="/community" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge min-h-[52px] py-4 px-12 text-[calc(var(--font-size-md)*var(--font-scale))] rounded-lg" id="hero-cta-explore">
              Explore the Show Ring
            </Link>
          </div>
          <p className="text-xs text-muted tracking-[0.03em]">
            ✦ No credit card required &nbsp;·&nbsp; ✦ Privacy-first &nbsp;·&nbsp; ✦ Free forever tier
          </p>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="py-[var(--space-3xl)] px-8 text-center" id="how-it-works">
        <div className="max-w-[1100px] mx-auto">
          <h2 className="text-2xl font-extrabold mb-2 tracking-[-0.02em]">
            Get Started in <span className="text-forest">3 Steps</span>
          </h2>
          <p className="text-[calc(var(--font-size-md)*var(--font-scale))] text-ink-light max-w-[540px] m-[0 auto var(--space-3xl)]">
            From your shelf to the Show Ring in under 5 minutes.
          </p>
          <div className="flex items-start justify-center gap-6 mt-12">
            <div className="flex-1 max-w-[320px] text-center py-8 px-6 rounded-xl bg-[rgba(0, 0, 0, 0.03)] border border-[rgba(0, 0, 0, 0.06)] transition-colors">
              <div className="flex-1 max-w-[320px] text-center py-8 px-6 rounded-xl bg-[rgba(0, 0, 0, 0.03)] border border-[rgba(0, 0, 0, 0.06)] transition-colors-number">1</div>
              <div className="flex-1 max-w-[320px] text-center py-8 px-6 rounded-xl bg-[rgba(0, 0, 0, 0.03)] border border-[rgba(0, 0, 0, 0.06)] transition-colors-icon"><Camera size={28} strokeWidth={1.5} /></div>
              <h3>Add Your Horse</h3>
              <p>
                Search our 10,500+ reference database to instantly identify your model.
                Upload multi-angle LSQ photos, set condition grades, and track purchase details
                in your private financial vault.
              </p>
            </div>
            <div className="flex-1 max-w-[320px] text-center py-8 px-6 rounded-xl bg-[rgba(0, 0, 0, 0.03)] border border-[rgba(0, 0, 0, 0.06)] transition-colors-arrow" aria-hidden="true">→</div>
            <div className="flex-1 max-w-[320px] text-center py-8 px-6 rounded-xl bg-[rgba(0, 0, 0, 0.03)] border border-[rgba(0, 0, 0, 0.06)] transition-colors">
              <div className="flex-1 max-w-[320px] text-center py-8 px-6 rounded-xl bg-[rgba(0, 0, 0, 0.03)] border border-[rgba(0, 0, 0, 0.06)] transition-colors-number">2</div>
              <div className="flex-1 max-w-[320px] text-center py-8 px-6 rounded-xl bg-[rgba(0, 0, 0, 0.03)] border border-[rgba(0, 0, 0, 0.06)] transition-colors-icon"><Trophy size={28} strokeWidth={1.5} /></div>
              <h3>Join the Community</h3>
              <p>
                Publish your best models to the Show Ring for the community to discover.
                Enter virtual photo shows, follow other collectors, and build your reputation
                with verified ratings.
              </p>
            </div>
            <div className="flex-1 max-w-[320px] text-center py-8 px-6 rounded-xl bg-[rgba(0, 0, 0, 0.03)] border border-[rgba(0, 0, 0, 0.06)] transition-colors-arrow" aria-hidden="true">→</div>
            <div className="flex-1 max-w-[320px] text-center py-8 px-6 rounded-xl bg-[rgba(0, 0, 0, 0.03)] border border-[rgba(0, 0, 0, 0.06)] transition-colors">
              <div className="flex-1 max-w-[320px] text-center py-8 px-6 rounded-xl bg-[rgba(0, 0, 0, 0.03)] border border-[rgba(0, 0, 0, 0.06)] transition-colors-number">3</div>
              <div className="flex-1 max-w-[320px] text-center py-8 px-6 rounded-xl bg-[rgba(0, 0, 0, 0.03)] border border-[rgba(0, 0, 0, 0.06)] transition-colors-icon"><PawPrint size={28} strokeWidth={1.5} /></div>
              <h3>Build Your Hoofprint</h3>
              <p>
                Every horse gets a permanent digital identity. Track it from blank resin
                to finished custom, through ownership changes, with a provenance chain
                that follows the horse forever.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features Grid ─── */}
      <section className="py-[var(--space-3xl)] px-8 relative" id="features">
        <div className="max-w-[var(--max-width)] mx-auto text-center">
          <h2 className="text-2xl font-extrabold mb-2 tracking-[-0.02em]">
            Everything You Need.{" "}
            <span className="text-forest">Nothing You Don&apos;t.</span>
          </h2>
          <p className="text-[calc(var(--font-size-md)*var(--font-scale))] text-ink-light max-w-[540px] m-[0 auto var(--space-3xl)]">
            Every feature exists because a real collector said &ldquo;I wish this existed.&rdquo;
          </p>

          <div className="grid grid-cols-[repeat(auto-fit, minmax(300px, 1fr))] gap-8">
            {/* Feature 1 — Reference Database */}
            <div className="bg-bg-card border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 text-left relative transition-all overflow-hidden" id="feature-reference">
              <div className="flex items-center justify-center w-[56px] h-[56px] rounded-md bg-[var(--color-accent-primary-glow)] text-forest mb-6">
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
              <h3 className="bg-bg-card border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 text-left relative transition-all overflow-hidden-title">10,500+ Reference Releases</h3>
              <p className="bg-bg-card border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 text-left relative transition-all overflow-hidden-desc">
                Stop Googling &ldquo;Breyer palomino 1995.&rdquo; Our database covers 7,000+ Breyer and Stone
                releases plus 3,500+ artist resins from the Equine Resin Directory. Search by mold,
                sculptor, scale, or year — and identify any model in seconds.
              </p>
            </div>

            {/* Feature 2 — Financial Vault */}
            <div className="bg-bg-card border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 text-left relative transition-all overflow-hidden" id="feature-vault">
              <div className="flex items-center justify-center w-[56px] h-[56px] rounded-md bg-[var(--color-accent-primary-glow)] text-forest mb-6 bg-[rgba(240, 160, 108, 0.15)] text-[var(--color-accent-secondary)]">
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
              <h3 className="bg-bg-card border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 text-left relative transition-all overflow-hidden-title">Private Financial Vault</h3>
              <p className="bg-bg-card border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 text-left relative transition-all overflow-hidden-desc">
                Know what your collection is really worth — without anyone else seeing.
                Track purchase prices, estimated values, and insurance notes in a vault
                that only you can access. Even our team can&apos;t see your data.
              </p>
            </div>

            {/* Feature 3 — Community Show Ring */}
            <div className="bg-bg-card border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 text-left relative transition-all overflow-hidden" id="feature-showring">
              <div className="flex items-center justify-center w-[56px] h-[56px] rounded-md bg-[var(--color-accent-primary-glow)] text-forest mb-6 bg-[rgba(92, 224, 160, 0.12)] text-success">
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
              <h3 className="bg-bg-card border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 text-left relative transition-all overflow-hidden-title">Community Show Ring</h3>
              <p className="bg-bg-card border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 text-left relative transition-all overflow-hidden-desc">
                Your proudest models deserve an audience. Browse other collectors&apos; herds,
                filter by scale, manufacturer, and finish type, and discover
                your next obsession — or your next purchase.
              </p>
            </div>

            {/* Feature 4 — Social Community */}
            <div className="bg-bg-card border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 text-left relative transition-all overflow-hidden" id="feature-social">
              <div className="flex items-center justify-center w-[56px] h-[56px] rounded-md bg-[var(--color-accent-primary-glow)] text-forest mb-6 feature-icon-social">
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
              <h3 className="bg-bg-card border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 text-left relative transition-all overflow-hidden-title">Follow Your Favorite Collectors</h3>
              <p className="bg-bg-card border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 text-left relative transition-all overflow-hidden-desc">
                No more scrolling through Facebook groups hoping to see updates.
                Follow the collectors you care about, see their new additions in your feed,
                and build real connections in a space made for the hobby.
              </p>
            </div>

            {/* Feature 5 — Virtual Photo Shows */}
            <div className="bg-bg-card border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 text-left relative transition-all overflow-hidden" id="feature-shows">
              <div className="flex items-center justify-center w-[56px] h-[56px] rounded-md bg-[var(--color-accent-primary-glow)] text-forest mb-6 feature-icon-shows">
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
              <h3 className="bg-bg-card border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 text-left relative transition-all overflow-hidden-title">Virtual Photo Shows</h3>
              <p className="bg-bg-card border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 text-left relative transition-all overflow-hidden-desc">
                Can&apos;t make it to a live show? Enter themed virtual shows, vote for your favorites,
                and compete for placement — all from home. Shows run on deadlines with
                real results.
              </p>
            </div>

            {/* Feature 6 — Trusted Marketplace */}
            <div className="bg-bg-card border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 text-left relative transition-all overflow-hidden" id="feature-marketplace">
              <div className="flex items-center justify-center w-[56px] h-[56px] rounded-md bg-[var(--color-accent-primary-glow)] text-forest mb-6 feature-icon-market">
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
              <h3 className="bg-bg-card border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 text-left relative transition-all overflow-hidden-title">Buy, Sell &amp; Trade with Confidence</h3>
              <p className="bg-bg-card border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 text-left relative transition-all overflow-hidden-desc">
                List models for sale with multi-angle photos, message buyers directly,
                and build your seller rating. Wishlist matchmaking alerts you when your
                dream horse goes on the market.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Hoofprint™ Teaser ─── */}
      <section className="hoofprint-teaser-section" id="hoofprint-teaser">
        <div className="max-w-[720px] mx-auto">
          <div className="inline-block py-1 px-6 text-sm font-semibold text-[#f59e0b] bg-[rgba(245, 158, 11, 0.1)] border border-[rgba(245, 158, 11, 0.25)] rounded-full mb-8 tracking-[0.02em]"><PawPrint size={16} strokeWidth={1.5} /> Now Live</div>
          <h2 className="text-[clamp(1.5rem, 3.5vw, 2.5rem)] font-extrabold leading-[1.2] mb-6">
            Every Horse Has a Story.{" "}
            <span className="text-forest">Hoofprint™ Tells It.</span>
          </h2>
          <p className="text-base text-muted leading-[1.7] mb-4">
            Imagine a permanent digital identity for every model horse.
            From the moment a blank resin is cast, through the artist&apos;s brushstrokes,
            to the collector who treasures it for years — and the next collector after that.
          </p>
          <p className="text-base text-muted leading-[1.7] mb-4">
            Hoofprint™ is the first-ever living provenance system for model horses.
            Photos, ownership transfers, customization records, and show results
            all follow the horse — not the owner. Like a passport that never expires.
          </p>
          <div className="flex gap-6 mt-12 justify-center flex-wrap">
            <div className="flex flex-col items-center gap-1 flex-1 min-w-[180px] max-w-[220px]">
              <span><Camera size={20} strokeWidth={1.5} /></span>
              <strong>Photo Timeline</strong>
              <span>Track every stage from blank to finished</span>
            </div>
            <div className="flex flex-col items-center gap-1 flex-1 min-w-[180px] max-w-[220px]">
              <span><Handshake size={20} strokeWidth={1.5} /></span>
              <strong>Ownership Chain</strong>
              <span>Verified history follows the horse forever</span>
            </div>
            <div className="flex flex-col items-center gap-1 flex-1 min-w-[180px] max-w-[220px]">
              <span><Package size={20} strokeWidth={1.5} /></span>
              <strong>One-Click Transfer</strong>
              <span>Sell a horse and pass its entire history along</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Who It's For ─── */}
      <section className="py-16 px-8 text-center" id="who-its-for">
        <div className="max-w-[var(--max-width)] mx-auto text-center">
          <h2 className="text-2xl font-extrabold mb-2 tracking-[-0.02em]">
            Built for <span className="text-forest">Every Part of the Hobby</span>
          </h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-8 mt-12">
            <div className="p-8 rounded-xl bg-[rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.06)] text-center transition-transform duration-300 hover:-translate-y-1 hover:border-[rgba(44,85,69,0.3)] [&_h3]:text-[calc(1.1rem*var(--font-scale))] [&_h3]:mb-2 [&_p]:text-[calc(var(--font-size-sm)*var(--font-scale))] [&_p]:text-ink-light">
              <div className="text-[3rem] mb-4"><Home size={32} strokeWidth={1.5} /></div>
              <h3>The Collector</h3>
              <p>
                From 20 models to 2,000+. Catalog your herd with reference data,
                multi-angle photos, and a private vault. Import your entire
                spreadsheet in minutes — not months.
              </p>
            </div>
            <div className="p-8 rounded-xl bg-[rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.06)] text-center transition-transform duration-300 hover:-translate-y-1 hover:border-[rgba(44,85,69,0.3)] [&_h3]:text-[calc(1.1rem*var(--font-scale))] [&_h3]:mb-2 [&_p]:text-[calc(var(--font-size-sm)*var(--font-scale))] [&_p]:text-ink-light">
              <div className="text-[3rem] mb-4"><Palette size={32} strokeWidth={1.5} /></div>
              <h3>The Artist &amp; Customizer</h3>
              <p>
                Manage commissions, share WIP progress with clients, and build
                a portfolio that speaks for itself. When you deliver a custom,
                your creation story becomes part of its Hoofprint&trade; — forever.
              </p>
            </div>
            <div className="p-8 rounded-xl bg-[rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.06)] text-center transition-transform duration-300 hover:-translate-y-1 hover:border-[rgba(44,85,69,0.3)] [&_h3]:text-[calc(1.1rem*var(--font-scale))] [&_h3]:mb-2 [&_p]:text-[calc(var(--font-size-sm)*var(--font-scale))] [&_p]:text-ink-light">
              <div className="text-[3rem] mb-4"><Trophy size={32} strokeWidth={1.5} /></div>
              <h3>The Shower &amp; Competitor</h3>
              <p>
                Log show records, track NAN qualifications digitally, and plan
                your show string before you pack the car. When you sell a champion,
                its ribbons follow through Hoofprint&trade;.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Social Proof / Stats ─── */}
      <section className="py-[var(--space-3xl)] px-8 border-t border-edge border-b border-edge bg-[var(--color-bg-secondary)]" id="stats">
        <div className="max-w-[var(--max-width)] mx-auto flex items-center justify-center gap-[var(--space-3xl)]">
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-extrabold text-ink">10,500+</span>
            <span className="text-sm text-muted font-medium">Releases &amp; Resins</span>
          </div>
          <div className="w-[1px] h-[48px] bg-edge" aria-hidden="true" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-extrabold text-ink"><PawPrint size={28} strokeWidth={1.5} /></span>
            <span className="text-sm text-muted font-medium">Hoofprint™ Tracking</span>
          </div>
          <div className="w-[1px] h-[48px] bg-edge" aria-hidden="true" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-extrabold text-ink"><Shield size={28} strokeWidth={1.5} /></span>
            <span className="text-sm text-muted font-medium">Privacy-First</span>
          </div>
          <div className="w-[1px] h-[48px] bg-edge" aria-hidden="true" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-extrabold text-ink">100%</span>
            <span className="text-sm text-muted font-medium">Free to Start</span>
          </div>
        </div>
      </section>

      {/* ─── Coming Soon ─── */}
      <section className="py-16 px-8 text-center" id="coming-soon">
        <div className="max-w-[var(--max-width)] mx-auto text-center">
          <h2 className="text-2xl font-extrabold mb-2 tracking-[-0.02em]">
            On the <span className="text-forest">Horizon</span>
          </h2>
          <p className="text-[calc(var(--font-size-md)*var(--font-scale))] text-ink-light max-w-[540px] m-[0 auto var(--space-3xl)]">
            We&apos;re building the operating system for the hobby. Here&apos;s what&apos;s next.
          </p>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-8 mt-12">
            <div className="p-8 rounded-xl bg-[rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.06)] text-center transition-transform duration-300 hover:-translate-y-1 hover:border-[rgba(44,85,69,0.3)] [&_h3]:text-[calc(1.1rem*var(--font-scale))] [&_h3]:mb-2 [&_p]:text-[calc(var(--font-size-sm)*var(--font-scale))] [&_p]:text-ink-light">
              <div className="text-[3rem] mb-4"><Palette size={32} strokeWidth={1.5} /></div>
              <h3>Art Studio</h3>
              <p>
                Commission tracking, WIP photo portals, and artist portfolios.
                Artists manage their queue. Clients watch their custom come to life.
                Every brushstroke becomes provenance.
              </p>
            </div>
            <div className="p-8 rounded-xl bg-[rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.06)] text-center transition-transform duration-300 hover:-translate-y-1 hover:border-[rgba(44,85,69,0.3)] [&_h3]:text-[calc(1.1rem*var(--font-scale))] [&_h3]:mb-2 [&_p]:text-[calc(var(--font-size-sm)*var(--font-scale))] [&_p]:text-ink-light">
              <div className="text-[3rem] mb-4"><Package size={32} strokeWidth={1.5} /></div>
              <h3>Bulk Import</h3>
              <p>
                Upload your entire spreadsheet and we&apos;ll fuzzy-match every row against
                our 10,500+ reference database. Go from CSV to cataloged in minutes.
              </p>
            </div>
            <div className="p-8 rounded-xl bg-[rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.06)] text-center transition-transform duration-300 hover:-translate-y-1 hover:border-[rgba(44,85,69,0.3)] [&_h3]:text-[calc(1.1rem*var(--font-scale))] [&_h3]:mb-2 [&_p]:text-[calc(var(--font-size-sm)*var(--font-scale))] [&_p]:text-ink-light">
              <div className="text-[3rem] mb-4"><TrendingUp size={32} strokeWidth={1.5} /></div>
              <h3>Price Guide</h3>
              <p>
                Real sale data from real collectors. Search market values for 10,500+
                models based on completed transactions. The Blue Book for model horses.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="py-[var(--space-3xl)] px-8 text-center" id="final-cta">
        <div className="max-w-[600px] mx-auto animate-fade-in-up">
          <h2>
            Ready to Give Your Herd{" "}
            <span className="text-forest">a Real Home</span>?
          </h2>
          <p>
            Join collectors and artists who catalog, connect, and trade on the only platform built for the model horse hobby.
          </p>
          <Link href="/signup" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm min-h-[52px] py-4 px-12 text-[calc(var(--font-size-md)*var(--font-scale))] rounded-lg" id="final-cta-signup">
            Create Your Free Account →
          </Link>
        </div>
      </section>
    </div>
  );
}
