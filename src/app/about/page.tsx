import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "About — Model Horse Hub",
    description:
        "Learn about Model Horse Hub, our mission to empower model horse collectors with modern digital tools, and the passionate team behind the platform.",
};

export default function AboutPage() {
    return (
        <div className="static-page">
            <div className="static-page-inner animate-fade-in-up">
                {/* Page Header */}
                <div className="static-page-header">
                    <h1>
                        About <span className="text-gradient">Model Horse Hub</span>
                    </h1>
                    <p className="static-page-lead">
                        The platform built by collectors, for collectors — because your herd deserves
                        better than a spreadsheet.
                    </p>
                </div>

                {/* Story Section */}
                <section className="static-section">
                    <h2>Our Story</h2>
                    <p>
                        Model Horse Hub was born out of a simple frustration: there was no modern, beautiful,
                        privacy-first tool designed specifically for model horse collectors. We kept track of
                        our herds in notebooks, scattered spreadsheets, and across half a dozen social media
                        platforms — none of which were built for the nuances of our hobby.
                    </p>
                    <p>
                        So we built one. Model Horse Hub is a purpose-built digital stable that lets you
                        catalog every model in your collection with multi-angle photography, detailed mold
                        and release tracking, and a private financial vault to keep your investment data
                        safe.
                    </p>
                    <p>
                        Whether you collect Breyer Traditionals, Stone Artist Resins, or anything in
                        between, Model Horse Hub is designed to grow with your herd — from a handful of
                        childhood favorites to a serious collection of hundreds.
                    </p>
                </section>

                {/* Mission Section */}
                <section className="static-section">
                    <h2>Our Mission</h2>
                    <div className="about-values-grid">
                        <div className="about-value-card">
                            <span className="about-value-icon" aria-hidden="true">🔒</span>
                            <h3>Privacy First</h3>
                            <p>
                                Your financial data, your collection details — they&apos;re yours. We use
                                row-level security to ensure nobody sees your private vault, not even us.
                            </p>
                        </div>
                        <div className="about-value-card">
                            <span className="about-value-icon" aria-hidden="true">✨</span>
                            <h3>Modern Design</h3>
                            <p>
                                We believe collector tools should be as beautiful as the models they catalog.
                                Every screen is crafted with care.
                            </p>
                        </div>
                        <div className="about-value-card">
                            <span className="about-value-icon" aria-hidden="true">🤝</span>
                            <h3>Community Driven</h3>
                            <p>
                                The Show Ring lets you share your proudest models and discover other
                                collectors&apos; herds — a celebration of the hobby we all love.
                            </p>
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <div className="static-cta">
                    <p>Ready to give your collection the home it deserves?</p>
                    <Link href="/signup" className="btn btn-primary btn-lg" id="about-cta-signup">
                        Join Model Horse Hub — It&apos;s Free
                    </Link>
                </div>
            </div>
        </div>
    );
}
