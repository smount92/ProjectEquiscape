import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Terms of Service — Model Horse Hub",
    description:
        "Terms of Service for Model Horse Hub. Fair, transparent rules for using the platform.",
};

export default function TermsPage() {
    return (
        <div className="static-page">
            <div className="static-page-inner animate-fade-in-up">
                {/* Page Header */}
                <div className="static-page-header">
                    <h1>
                        <span className="text-gradient">Terms</span> of Service
                    </h1>
                    <p className="static-page-lead">
                        Fair rules for a fair platform.
                    </p>
                    <p style={{ fontSize: "calc(var(--font-size-sm) * var(--font-scale))", color: "var(--color-text-muted)", marginTop: "var(--space-sm)" }}>
                        Last updated: March 14, 2026
                    </p>
                </div>

                {/* Agreement */}
                <section className="static-section">
                    <h2>1. Agreement to Terms</h2>
                    <p>
                        By accessing or using Model Horse Hub (&ldquo;the Platform&rdquo;), you agree to be
                        bound by these Terms of Service. If you do not agree, please do not use the Platform.
                        We may update these terms from time to time, and continued use constitutes acceptance
                        of any changes.
                    </p>
                </section>

                {/* Eligibility */}
                <section className="static-section">
                    <h2>2. Eligibility</h2>
                    <p>
                        You must be at least 13 years of age to create an account. If you are under 18, you
                        represent that you have your parent or guardian&apos;s permission to use the Platform.
                        Model Horse Hub is intended for personal, non-commercial collection management and
                        hobby community use.
                    </p>
                </section>

                {/* Your Account */}
                <section className="static-section">
                    <h2>3. Your Account</h2>
                    <p>
                        You are responsible for maintaining the security of your account credentials. You agree to:
                    </p>
                    <ul className="list-none p-0 m-[0 0 var(--space-lg) 0]">
                        <li>Provide a valid email address</li>
                        <li>Keep your password secure and not share it with others</li>
                        <li>Notify us immediately if you suspect unauthorized access</li>
                        <li>Not create multiple accounts for the purpose of abuse or manipulation</li>
                    </ul>
                    <p style={{ marginTop: "var(--space-md)" }}>
                        Your display alias must not impersonate another person, use offensive language,
                        or violate the rights of others.
                    </p>
                </section>

                {/* Your Content */}
                <section className="static-section">
                    <h2>4. Your Content</h2>
                    <p>
                        You retain full ownership of all content you upload to Model Horse Hub, including
                        photos, descriptions, and collection data. By making content public (e.g., sharing
                        a horse in the Show Ring), you grant us a limited, non-exclusive license to display
                        that content on the Platform.
                    </p>
                    <p>You agree not to upload content that:</p>
                    <ul className="list-none p-0 m-[0 0 var(--space-lg) 0]">
                        <li>You do not own or have the right to share</li>
                        <li>Contains illegal, abusive, or harmful material</li>
                        <li>Infringes on any third party&apos;s intellectual property rights</li>
                        <li>Contains malware, spam, or deceptive content</li>
                        <li>Depicts anything other than model horses, tack, props, or hobby-related items</li>
                    </ul>
                    <p style={{ marginTop: "var(--space-md)" }}>
                        We reserve the right to remove content that violates these guidelines.
                    </p>
                </section>

                {/* Commerce & Safe-Trade */}
                <section className="static-section">
                    <h2>5. Commerce &amp; Safe-Trade</h2>
                    <p>
                        Model Horse Hub provides communication and coordination tools (messaging, offers,
                        PIN-based transfers) to facilitate transactions between users. However:
                    </p>
                    <ul className="list-none p-0 m-[0 0 var(--space-lg) 0]">
                        <li>
                            <strong>We are not a payment processor.</strong> All payments are arranged
                            directly between buyer and seller through external services (PayPal, Venmo, etc.).
                            Model Horse Hub does not handle, hold, or process money.
                        </li>
                        <li>
                            <strong>We are not a party to transactions.</strong> When you buy or sell a model,
                            the transaction is between you and the other user. We provide tools to coordinate,
                            but we are not responsible for the outcome.
                        </li>
                        <li>
                            <strong>Use good judgment.</strong> We provide safety features like off-platform
                            payment warnings and rug-pull protection, but ultimately you are responsible for
                            verifying the identity and trustworthiness of other users.
                        </li>
                        <li>
                            <strong>User ratings are permanent.</strong> Transaction reviews, once submitted,
                            cannot be altered or removed to maintain trust integrity.
                        </li>
                    </ul>
                </section>

                {/* Community Conduct */}
                <section className="static-section">
                    <h2>6. Community Conduct</h2>
                    <p>Model Horse Hub is a hobby community. You agree to:</p>
                    <ul className="list-none p-0 m-[0 0 var(--space-lg) 0]">
                        <li>Treat other users with respect in messages, comments, and group posts</li>
                        <li>Not harass, bully, or threaten other users</li>
                        <li>Not engage in price manipulation, shill bidding, or deceptive trade practices</li>
                        <li>Not misrepresent the condition, provenance, or authenticity of a model</li>
                        <li>Report violations rather than engaging in retaliatory behavior</li>
                    </ul>
                    <p style={{ marginTop: "var(--space-md)" }}>
                        We reserve the right to suspend or terminate accounts that violate these standards.
                    </p>
                </section>

                {/* Hoofprint */}
                <section className="static-section">
                    <h2>7. Hoofprint&trade; Provenance</h2>
                    <p>
                        Hoofprint&trade; records are designed to be a permanent, trustworthy provenance trail
                        for model horses. By using Hoofprint&trade;, you understand that:
                    </p>
                    <ul className="list-none p-0 m-[0 0 var(--space-lg) 0]">
                        <li>Provenance events (ownership transfers, show results, customization records) are permanent and cannot be deleted</li>
                        <li>When you transfer a horse, the Hoofprint&trade; history travels with the horse to the new owner</li>
                        <li>Your display alias will appear in the ownership chain of any horse you&apos;ve owned</li>
                        <li>Financial vault data (prices, values) is <strong>never</strong> included in Hoofprint&trade; transfers</li>
                    </ul>
                </section>

                {/* IP */}
                <section className="static-section">
                    <h2>8. Intellectual Property</h2>
                    <p>
                        The Model Horse Hub platform, including its design, code, features, and branding,
                        is the intellectual property of Model Horse Hub. Reference data (mold names,
                        release names, manufacturer information) is sourced from publicly available
                        catalogs and community databases.
                    </p>
                    <p>
                        &ldquo;Hoofprint&rdquo; and the Hoofprint&trade; mark are trademarks of Model Horse Hub.
                        Breyer, Stone, and all other manufacturer names are trademarks of their respective owners
                        and are used for reference purposes only.
                    </p>
                </section>

                {/* Disclaimers */}
                <section className="static-section">
                    <h2>9. Disclaimers &amp; Limitations</h2>
                    <ul className="list-none p-0 m-[0 0 var(--space-lg) 0]">
                        <li>
                            The Platform is provided &ldquo;as is&rdquo; without warranties of any kind,
                            express or implied.
                        </li>
                        <li>
                            We do not guarantee the accuracy of reference data, market prices, or AI-generated
                            mold identifications. These are provided as helpful tools, not authoritative sources.
                        </li>
                        <li>
                            We are not responsible for losses resulting from transactions between users,
                            including fraud, misrepresentation, or shipping damage.
                        </li>
                        <li>
                            We may experience downtime for maintenance or updates. We will make reasonable
                            efforts to minimize disruption.
                        </li>
                        <li>
                            Our total liability for any claim related to the Platform is limited to the
                            amount you have paid us (which, for our free tier, is zero).
                        </li>
                    </ul>
                </section>

                {/* Termination */}
                <section className="static-section">
                    <h2>10. Account Termination</h2>
                    <p>
                        You may delete your account at any time from your Settings page. Upon deletion,
                        your collection data, photos, and private information will be permanently removed.
                        Hoofprint&trade; provenance records for horses you have already transferred to other
                        users will remain intact, as they are part of the horse&apos;s history, not your account.
                    </p>
                    <p>
                        We may suspend or terminate accounts that violate these Terms, engage in abuse, or
                        threaten the safety of other users.
                    </p>
                </section>

                {/* Governing Law */}
                <section className="static-section">
                    <h2>11. Governing Law</h2>
                    <p>
                        These Terms are governed by the laws of the United States. Any disputes will be
                        resolved through good-faith negotiation first, and if necessary, through binding
                        arbitration.
                    </p>
                </section>

                {/* Contact */}
                <section className="static-section">
                    <h2>12. Questions?</h2>
                    <p>
                        If you have questions about these Terms, please reach out via
                        our <Link href="/contact">Contact page</Link>.
                    </p>
                </section>
            </div>
        </div>
    );
}
