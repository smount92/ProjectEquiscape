import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Model Horse Hub — The Ultimate Digital Stable for Collectors",
  description:
    "Catalog your model horse collection with AI mold detection, secure financial tracking, and a vibrant community show ring. Start your digital stable for free.",
};

export default function LandingPage() {
  return (
    <div className="landing-page">
      {/* ─── Hero Section ─── */}
      <section className="hero-section" id="hero">
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-glow hero-glow-secondary" aria-hidden="true" />
        <div className="hero-content animate-fade-in-up">
          <span className="hero-badge">🐴 Built for Collectors, by Collectors</span>
          <h1 className="hero-headline">
            The Ultimate Digital Stable for{" "}
            <span className="text-gradient">Model Horse Collectors</span>
          </h1>
          <p className="hero-subheadline">
            Catalog every model in your herd with multi-angle photography, AI-powered mold
            detection, a private financial vault, and a community show ring — all in one
            beautifully designed platform.
          </p>
          <div className="hero-cta-group">
            <Link href="/signup" className="btn btn-primary btn-lg" id="hero-cta-signup">
              Create Free Account
            </Link>
            <Link href="/community" className="btn btn-ghost btn-lg" id="hero-cta-explore">
              Explore Show Ring
            </Link>
          </div>
          <p className="hero-trust-line">
            ✦ No credit card required &nbsp;·&nbsp; ✦ Privacy-first &nbsp;·&nbsp; ✦ Free forever
            tier
          </p>
        </div>
      </section>

      {/* ─── Features Grid ─── */}
      <section className="features-section" id="features">
        <div className="features-inner">
          <h2 className="features-title">
            Everything Your <span className="text-gradient">Herd</span> Needs
          </h2>
          <p className="features-subtitle">
            Three powerful pillars designed to organize, protect, and celebrate your collection.
          </p>

          <div className="features-grid">
            {/* Feature 1 — AI Mold Detection */}
            <div className="feature-card" id="feature-ai">
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
              <h3 className="feature-card-title">AI Mold Detection</h3>
              <p className="feature-card-desc">
                Upload a photo and our intelligent reference engine helps you identify the exact
                mold, manufacturer, and release — so you never have to guess again.
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
              <h3 className="feature-card-title">Secure Financial Vault</h3>
              <p className="feature-card-desc">
                Track purchase prices, current market values, and insurance details in a
                private vault visible only to you — encrypted and protected by row-level
                security.
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
              <h3 className="feature-card-title">The Community Show Ring</h3>
              <p className="feature-card-desc">
                Publish your proudest models to a shared gallery. Browse other collectors&apos;
                herds, discover rare releases, and connect with the community.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Social Proof / Stats ─── */}
      <section className="stats-section" id="stats">
        <div className="stats-inner">
          <div className="stat-item">
            <span className="stat-value">100%</span>
            <span className="stat-label">Free to Start</span>
          </div>
          <div className="stat-divider" aria-hidden="true" />
          <div className="stat-item">
            <span className="stat-value">🔒</span>
            <span className="stat-label">Privacy-First</span>
          </div>
          <div className="stat-divider" aria-hidden="true" />
          <div className="stat-item">
            <span className="stat-value">♾️</span>
            <span className="stat-label">Unlimited Models</span>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="final-cta-section" id="final-cta">
        <div className="final-cta-inner animate-fade-in-up">
          <h2>
            Ready to Grow Your{" "}
            <span className="text-gradient">Digital Herd</span>?
          </h2>
          <p>
            Join collectors who trust Model Horse Hub to catalog, value, and celebrate their
            collections.
          </p>
          <Link href="/signup" className="btn btn-primary btn-lg" id="final-cta-signup">
            Create Your Free Account →
          </Link>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="landing-footer" id="site-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <span className="footer-logo-icon" aria-hidden="true">🐴</span>
            <span className="footer-logo-text">Model Horse Hub</span>
          </div>
          <nav className="footer-nav" aria-label="Footer navigation">
            <Link href="/about" className="footer-link" id="footer-about">About</Link>
            <Link href="/contact" className="footer-link" id="footer-contact">Contact</Link>
            <Link href="/community" className="footer-link" id="footer-showring">Show Ring</Link>
          </nav>
          <p className="footer-copy">
            &copy; {new Date().getFullYear()} Model Horse Hub. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
