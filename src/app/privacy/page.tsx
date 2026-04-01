import Link from"next/link";
import type { Metadata } from"next";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";
import AiDataPolicySection from"@/components/AiDataPolicySection";

export const metadata: Metadata = {
 title:"Privacy Policy — Model Horse Hub",
 description:"How Model Horse Hub collects, uses, and protects your data. Privacy-first by design.",
};

export default function PrivacyPage() {
 return (
 <ExplorerLayout title={<><span className="text-forest">Privacy</span> Policy</>} description="Your data is yours. Full stop.">
 <div className="animate-fade-in-up">
 {/* Page Header */}
 <div className="mb-8">
 <h1>
 <span className="text-forest">Privacy</span> Policy
 </h1>
 <p className="mt-2 text-lg text-ink-light">
 Your data is yours. Full stop.
 </p>
 <p className="text-ink-light mt-2 text-sm">Last updated: March 14, 2026</p>
 </div>

 {/* Overview */}
 <section className="mb-12">
 <h2>Our Privacy Philosophy</h2>
 <p>
 Model Horse Hub was built by collectors, for collectors. We believe your collection data,
 financial information, and personal details belong to <strong>you</strong> &mdash; not us, not
 advertisers, and not &ldquo;partner companies.&rdquo; We designed every layer of this platform
 with privacy as a core architectural principle, not an afterthought.
 </p>
 </section>

 {/* What We Collect */}
 <section className="mb-12">
 <h2>1. Information We Collect</h2>

 <h3>Account Information</h3>
 <p>
 When you create an account, we collect your <strong>email address</strong> and a display{""}
 <strong>alias</strong> (username) of your choosing. We do not require your real name, mailing
 address, phone number, or any government ID.
 </p>

 <h3>Collection Data</h3>
 <p>
 Information you voluntarily enter about your model horses, including custom names, condition
 grades, finish types, photos, and reference links to our catalog database. This data is stored
 under your account and protected by row-level security.
 </p>

 <h3>Financial Vault Data</h3>
 <p>
 Purchase prices, estimated values, insurance notes, and purchase dates you optionally provide.
 This data is <strong>encrypted at rest</strong> and accessible only to you. Our team cannot view
 your financial vault &mdash; it is protected by cryptographic row-level security policies that
 enforce access at the database level.
 </p>

 <h3>Photos</h3>
 <p>
 Images you upload are stored in secure cloud storage with signed URL access controls. Photos are
 only accessible via time-limited signed URLs &mdash; they cannot be hotlinked or scraped by
 third parties.
 </p>

 <h3>Usage Data</h3>
 <p>
 We use Google Analytics to understand aggregate usage patterns (page views, feature adoption).
 This data is anonymized and never linked to your collection or financial information.
 </p>
 </section>

 {/* How We Use It */}
 <section className="mb-12">
 <h2>2. How We Use Your Information</h2>
 <p>We use your information exclusively to:</p>
 <ul className="mb-4 list-none p-0">
 <li>Provide and operate the Model Horse Hub platform</li>
 <li>Display your public collection in the Show Ring (only when you opt in)</li>
 <li>Facilitate messaging and commerce features between users</li>
 <li>Send transactional emails (e.g., message notifications, transfer confirmations)</li>
 <li>Generate Hoofprint&trade; provenance records for your horses</li>
 <li>Improve the platform based on aggregate usage patterns</li>
 </ul>
 <p className="mt-4">
 <strong>We do NOT:</strong>
 </p>
 <ul className="mb-4 list-none p-0">
 <li>Sell your data to third parties &mdash; ever</li>
 <li>Display ads or share data with advertisers</li>
 <li>Use your collection data for machine learning training</li>
 <li>Share your financial vault data with anyone, including our own staff</li>
 <li>Send marketing emails without your explicit consent</li>
 </ul>
 </section>

 {/* Data Security */}
 <section className="mb-12">
 <h2>3. Data Security</h2>
 <p>Your data is protected by multiple layers of security:</p>
 <ul className="mb-4 list-none p-0">
 <li>
 <strong>Row-Level Security (RLS)</strong> &mdash; enforced at the PostgreSQL database level,
 meaning even if our application code had a bug, the database itself would refuse to return
 another user&apos;s data
 </li>
 <li>
 <strong>Encrypted connections</strong> &mdash; all data in transit is encrypted via
 TLS/HTTPS
 </li>
 <li>
 <strong>Signed URLs for photos</strong> &mdash; image access requires time-limited
 cryptographic tokens
 </li>
 <li>
 <strong>Secure authentication</strong> &mdash; powered by Supabase Auth with PKCE flow and
 HTTP-only session cookies
 </li>
 <li>
 <strong>Rate limiting</strong> &mdash; sensitive actions are protected against abuse and
 brute-force attacks
 </li>
 </ul>
 </section>

 {/* Data Sharing */}
 <section className="mb-12">
 <h2>4. When We Share Data</h2>
 <p>We share data only in the following limited circumstances:</p>
 <ul className="mb-4 list-none p-0">
 <li>
 <strong>Public profiles</strong> &mdash; if you choose to make horses public, their name,
 photos, reference link, condition, and finish type are visible in the Show Ring. Financial
 data is <em>never</em> shown publicly.
 </li>
 <li>
 <strong>Hoofprint&trade; transfers</strong> &mdash; when you transfer a horse to another
 user, provenance records (ownership dates, show results) transfer with the horse. Financial
 vault data is <em>never</em> transferred.
 </li>
 <li>
 <strong>Commerce</strong> &mdash; when you engage in a Safe-Trade transaction, the other
 party can see the horse listing details you&apos;ve published. No private data is shared.
 </li>
 <li>
 <strong>Legal requirements</strong> &mdash; if required by law, subpoena, or court order. We
 will notify you unless legally prohibited from doing so.
 </li>
 </ul>
 </section>

 {/* Third-Party Services */}
 <section className="mb-12">
 <h2>5. Third-Party Services</h2>
 <p>We use the following third-party services:</p>
 <ul className="mb-4 list-none p-0">
 <li>
 <strong>Supabase</strong> &mdash; database hosting, authentication, and file storage (hosted
 in the US)
 </li>
 <li>
 <strong>Vercel</strong> &mdash; application hosting and edge delivery
 </li>
 <li>
 <strong>Resend</strong> &mdash; transactional email delivery
 </li>
 <li>
 <strong>Google Analytics</strong> &mdash; anonymized usage analytics
 </li>
 <li>
 <strong>Google Gemini</strong> &mdash; optional AI mold identification (images are processed
 but not stored by Google)
 </li>
 </ul>
 <p className="mt-4">
 We do not use any advertising networks, social media trackers, or data brokers.
 </p>
 </section>

 {/* Your Rights */}
 <section className="mb-12">
 <h2>6. Your Rights</h2>
 <p>You have the right to:</p>
 <ul className="mb-4 list-none p-0">
 <li>
 <strong>Export your data</strong> &mdash; download your entire collection as CSV at any time
 from your dashboard
 </li>
 <li>
 <strong>Delete your account</strong> &mdash; request full account deletion from your
 Settings page, which removes all your data including photos
 </li>
 <li>
 <strong>Control visibility</strong> &mdash; set any horse to private, unlisted, or public at
 any time
 </li>
 <li>
 <strong>Opt out of analytics</strong> &mdash; use any standard ad-blocker or Do Not Track
 setting
 </li>
 </ul>
 </section>

 {/* Cookies */}
 <section className="mb-12">
 <h2>7. Cookies</h2>
 <p>
 We use only <strong>essential cookies</strong> required for authentication and session
 management. We do not use tracking cookies, advertising cookies, or third-party marketing
 pixels. The only non-essential cookie is from Google Analytics, which respects Do Not Track
 headers.
 </p>
 </section>

 {/* Children */}
 <section className="mb-12">
 <h2>8. Children&apos;s Privacy</h2>
 <p>
 Model Horse Hub is not directed at children under 13. We do not knowingly collect information
 from children under 13. If you believe a child under 13 has created an account, please{""}
 <Link href="/contact">contact us</Link> and we will promptly delete the account.
 </p>
 </section>

 {/* AI, Data Collection, and Copyright Policy */}
 <AiDataPolicySection />

 {/* Changes */}
 <section className="mb-12">
 <h2>9. Changes to This Policy</h2>
 <p>
 We may update this Privacy Policy from time to time. We will notify registered users of any
 material changes via email. The &ldquo;Last updated&rdquo; date at the top of this page reflects
 the most recent revision.
 </p>
 </section>

 {/* Contact */}
 <section className="mb-12">
 <h2>10. Questions?</h2>
 <p>
 If you have questions about this Privacy Policy or how your data is handled, please reach out
 via our <Link href="/contact">Contact page</Link>.
 </p>
 </section>
 </div>
  </ExplorerLayout>
 );
}
