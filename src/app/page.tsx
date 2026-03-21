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
    <div className="landing-page">
      {/* ─── Hero Section ─── */}
      <section className="hero-section" id="hero">
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-glow hero-glow-secondary" aria-hidden="true" />
        <div className="hero-content animate-fade-in-up">
          <span className="hero-badge"><Fingerprint size={16} strokeWidth={1.5} /> Hoofprint™ — The First Living Provenance System for Model Horses</span>
          <h1 className="hero-headline">
            The Only Platform Built{" "}
            <span className="text-gradient">for This Hobby</span>
          </h1>
          <p className="hero-subheadline">
            Catalog your herd with a 10,500+ reference database. Track provenance
            from blank resin to finished custom. Sell with verified trust signals.
            And soon — manage commissions, plan show strings, and join collector groups.
            All in one place. Built by collectors, for collectors.
          </p>
          <div className="hero-cta-group">
            <Link href="/signup" className="btn btn-primary btn-lg" id="hero-cta-signup">
              Create Free Account
            </Link>
            <Link href="/community" className="btn btn-ghost btn-lg" id="hero-cta-explore">
              Explore the Show Ring
            </Link>
          </div>
          <p className="hero-trust-line">
            ✦ No credit card required &nbsp;·&nbsp; ✦ Privacy-first &nbsp;·&nbsp; ✦ Free forever tier
          </p>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="how-it-works-section" id="how-it-works">
        <div className="how-inner">
          <h2 className="features-title">
            Get Started in <span className="text-gradient">3 Steps</span>
          </h2>
          <p className="features-subtitle">
            From your shelf to the Show Ring in under 5 minutes.
          </p>
          <div className="how-steps">
            <div className="how-step">
              <div className="how-step-number">1</div>
              <div className="how-step-icon"><Camera size={28} strokeWidth={1.5} /></div>
              <h3>Add Your Horse</h3>
              <p>
                Search our 10,500+ reference database to instantly identify your model.
                Upload multi-angle LSQ photos, set condition grades, and track purchase details
                in your private financial vault.
              </p>
            </div>
            <div className="how-step-arrow" aria-hidden="true">→</div>
            <div className="how-step">
              <div className="how-step-number">2</div>
              <div className="how-step-icon"><Trophy size={28} strokeWidth={1.5} /></div>
              <h3>Join the Community</h3>
              <p>
                Publish your best models to the Show Ring for the community to discover.
                Enter virtual photo shows, follow other collectors, and build your reputation
                with verified ratings.
              </p>
            </div>
            <div className="how-step-arrow" aria-hidden="true">→</div>
            <div className="how-step">
              <div className="how-step-number">3</div>
              <div className="how-step-icon"><PawPrint size={28} strokeWidth={1.5} /></div>
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
      <section className="features-section" id="features">
        <div className="features-inner">
          <h2 className="features-title">
            Everything You Need.{" "}
            <span className="text-gradient">Nothing You Don&apos;t.</span>
          </h2>
          <p className="features-subtitle">
            Every feature exists because a real collector said &ldquo;I wish this existed.&rdquo;
          </p>

          <div className="features-grid">
            {/* Feature 1 — Reference Database */}
            <div className="feature-card" id="feature-reference">
              <div className="feature-icon">
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
              <h3 className="feature-card-title">10,500+ Reference Releases</h3>
              <p className="feature-card-desc">
                Stop Googling &ldquo;Breyer palomino 1995.&rdquo; Our database covers 7,000+ Breyer and Stone
                releases plus 3,500+ artist resins from the Equine Resin Directory. Search by mold,
                sculptor, scale, or year — and identify any model in seconds.
              </p>
            </div>

            {/* Feature 2 — Financial Vault */}
            <div className="feature-card" id="feature-vault">
              <div className="feature-icon feature-icon-vault">
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
              <h3 className="feature-card-title">Private Financial Vault</h3>
              <p className="feature-card-desc">
                Know what your collection is really worth — without anyone else seeing.
                Track purchase prices, estimated values, and insurance notes in a vault
                that only you can access. Even our team can&apos;t see your data.
              </p>
            </div>

            {/* Feature 3 — Community Show Ring */}
            <div className="feature-card" id="feature-showring">
              <div className="feature-icon feature-icon-ring">
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
              <h3 className="feature-card-title">Community Show Ring</h3>
              <p className="feature-card-desc">
                Your proudest models deserve an audience. Browse other collectors&apos; herds,
                filter by scale, manufacturer, and finish type, and discover
                your next obsession — or your next purchase.
              </p>
            </div>

            {/* Feature 4 — Social Community */}
            <div className="feature-card" id="feature-social">
              <div className="feature-icon feature-icon-social">
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
              <h3 className="feature-card-title">Follow Your Favorite Collectors</h3>
              <p className="feature-card-desc">
                No more scrolling through Facebook groups hoping to see updates.
                Follow the collectors you care about, see their new additions in your feed,
                and build real connections in a space made for the hobby.
              </p>
            </div>

            {/* Feature 5 — Virtual Photo Shows */}
            <div className="feature-card" id="feature-shows">
              <div className="feature-icon feature-icon-shows">
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
              <h3 className="feature-card-title">Virtual Photo Shows</h3>
              <p className="feature-card-desc">
                Can&apos;t make it to a live show? Enter themed virtual shows, vote for your favorites,
                and compete for placement — all from home. Shows run on deadlines with
                real results.
              </p>
            </div>

            {/* Feature 6 — Trusted Marketplace */}
            <div className="feature-card" id="feature-marketplace">
              <div className="feature-icon feature-icon-market">
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
              <h3 className="feature-card-title">Buy, Sell &amp; Trade with Confidence</h3>
              <p className="feature-card-desc">
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
        <div className="hoofprint-teaser-inner">
          <div className="hoofprint-teaser-badge"><PawPrint size={16} strokeWidth={1.5} /> Now Live</div>
          <h2 className="hoofprint-teaser-title">
            Every Horse Has a Story.{" "}
            <span className="text-gradient">Hoofprint™ Tells It.</span>
          </h2>
          <p className="hoofprint-teaser-desc">
            Imagine a permanent digital identity for every model horse.
            From the moment a blank resin is cast, through the artist&apos;s brushstrokes,
            to the collector who treasures it for years — and the next collector after that.
          </p>
          <p className="hoofprint-teaser-desc">
            Hoofprint™ is the first-ever living provenance system for model horses.
            Photos, ownership transfers, customization records, and show results
            all follow the horse — not the owner. Like a passport that never expires.
          </p>
          <div className="hoofprint-teaser-features">
            <div className="hoofprint-teaser-feature">
              <span><Camera size={20} strokeWidth={1.5} /></span>
              <strong>Photo Timeline</strong>
              <span>Track every stage from blank to finished</span>
            </div>
            <div className="hoofprint-teaser-feature">
              <span><Handshake size={20} strokeWidth={1.5} /></span>
              <strong>Ownership Chain</strong>
              <span>Verified history follows the horse forever</span>
            </div>
            <div className="hoofprint-teaser-feature">
              <span><Package size={20} strokeWidth={1.5} /></span>
              <strong>One-Click Transfer</strong>
              <span>Sell a horse and pass its entire history along</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Who It's For ─── */}
      <section className="py-16 px-8 text-center" id="who-its-for">
        <div className="features-inner">
          <h2 className="features-title">
            Built for <span className="text-gradient">Every Part of the Hobby</span>
          </h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-8 mt-12">
            <div className="p-8 rounded-xl bg-[rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.06)] text-center transition-transform duration-300 hover:-translate-y-1 hover:border-[rgba(44,85,69,0.3)] [&_h3]:text-[calc(1.1rem*var(--font-scale))] [&_h3]:mb-sm [&_p]:text-[calc(var(--font-size-sm)*var(--font-scale))] [&_p]:text-text-secondary">
              <div className="text-[3rem] mb-4"><Home size={32} strokeWidth={1.5} /></div>
              <h3>The Collector</h3>
              <p>
                From 20 models to 2,000+. Catalog your herd with reference data,
                multi-angle photos, and a private vault. Import your entire
                spreadsheet in minutes — not months.
              </p>
            </div>
            <div className="p-8 rounded-xl bg-[rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.06)] text-center transition-transform duration-300 hover:-translate-y-1 hover:border-[rgba(44,85,69,0.3)] [&_h3]:text-[calc(1.1rem*var(--font-scale))] [&_h3]:mb-sm [&_p]:text-[calc(var(--font-size-sm)*var(--font-scale))] [&_p]:text-text-secondary">
              <div className="text-[3rem] mb-4"><Palette size={32} strokeWidth={1.5} /></div>
              <h3>The Artist &amp; Customizer</h3>
              <p>
                Manage commissions, share WIP progress with clients, and build
                a portfolio that speaks for itself. When you deliver a custom,
                your creation story becomes part of its Hoofprint&trade; — forever.
              </p>
            </div>
            <div className="p-8 rounded-xl bg-[rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.06)] text-center transition-transform duration-300 hover:-translate-y-1 hover:border-[rgba(44,85,69,0.3)] [&_h3]:text-[calc(1.1rem*var(--font-scale))] [&_h3]:mb-sm [&_p]:text-[calc(var(--font-size-sm)*var(--font-scale))] [&_p]:text-text-secondary">
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
      <section className="stats-section" id="stats">
        <div className="stats-inner">
          <div className="stat-item">
            <span className="stat-value">10,500+</span>
            <span className="stat-label">Releases &amp; Resins</span>
          </div>
          <div className="stat-divider" aria-hidden="true" />
          <div className="stat-item">
            <span className="stat-value"><PawPrint size={28} strokeWidth={1.5} /></span>
            <span className="stat-label">Hoofprint™ Tracking</span>
          </div>
          <div className="stat-divider" aria-hidden="true" />
          <div className="stat-item">
            <span className="stat-value"><Shield size={28} strokeWidth={1.5} /></span>
            <span className="stat-label">Privacy-First</span>
          </div>
          <div className="stat-divider" aria-hidden="true" />
          <div className="stat-item">
            <span className="stat-value">100%</span>
            <span className="stat-label">Free to Start</span>
          </div>
        </div>
      </section>

      {/* ─── Coming Soon ─── */}
      <section className="py-16 px-8 text-center" id="coming-soon">
        <div className="features-inner">
          <h2 className="features-title">
            On the <span className="text-gradient">Horizon</span>
          </h2>
          <p className="features-subtitle">
            We&apos;re building the operating system for the hobby. Here&apos;s what&apos;s next.
          </p>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-8 mt-12">
            <div className="p-8 rounded-xl bg-[rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.06)] text-center transition-transform duration-300 hover:-translate-y-1 hover:border-[rgba(44,85,69,0.3)] [&_h3]:text-[calc(1.1rem*var(--font-scale))] [&_h3]:mb-sm [&_p]:text-[calc(var(--font-size-sm)*var(--font-scale))] [&_p]:text-text-secondary">
              <div className="text-[3rem] mb-4"><Palette size={32} strokeWidth={1.5} /></div>
              <h3>Art Studio</h3>
              <p>
                Commission tracking, WIP photo portals, and artist portfolios.
                Artists manage their queue. Clients watch their custom come to life.
                Every brushstroke becomes provenance.
              </p>
            </div>
            <div className="p-8 rounded-xl bg-[rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.06)] text-center transition-transform duration-300 hover:-translate-y-1 hover:border-[rgba(44,85,69,0.3)] [&_h3]:text-[calc(1.1rem*var(--font-scale))] [&_h3]:mb-sm [&_p]:text-[calc(var(--font-size-sm)*var(--font-scale))] [&_p]:text-text-secondary">
              <div className="text-[3rem] mb-4"><Package size={32} strokeWidth={1.5} /></div>
              <h3>Bulk Import</h3>
              <p>
                Upload your entire spreadsheet and we&apos;ll fuzzy-match every row against
                our 10,500+ reference database. Go from CSV to cataloged in minutes.
              </p>
            </div>
            <div className="p-8 rounded-xl bg-[rgba(0,0,0,0.03)] border border-[rgba(0,0,0,0.06)] text-center transition-transform duration-300 hover:-translate-y-1 hover:border-[rgba(44,85,69,0.3)] [&_h3]:text-[calc(1.1rem*var(--font-scale))] [&_h3]:mb-sm [&_p]:text-[calc(var(--font-size-sm)*var(--font-scale))] [&_p]:text-text-secondary">
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
      <section className="final-cta-section" id="final-cta">
        <div className="final-cta-inner animate-fade-in-up">
          <h2>
            Ready to Give Your Herd{" "}
            <span className="text-gradient">a Real Home</span>?
          </h2>
          <p>
            Join collectors and artists who catalog, connect, and trade on the only platform built for the model horse hobby.
          </p>
          <Link href="/signup" className="btn btn-primary btn-lg" id="final-cta-signup">
            Create Your Free Account →
          </Link>
        </div>
      </section>
    </div>
  );
}
