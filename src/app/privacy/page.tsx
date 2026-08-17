import Link from"next/link";
import type { Metadata } from"next";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";
import AiDataPolicySection from"@/components/AiDataPolicySection";

export const metadata: Metadata = {
 title:"Privacy Policy",
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
 <p className="mt-2 text-lg text-secondary-foreground">
 Your data is yours. Full stop.
 </p>
 <p className="text-secondary-foreground mt-2 text-sm">Last updated: August 17, 2026</p>
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
 Vault data is <strong>never shown to any other user</strong>, never transferred with a horse,
 and never sent to third parties. Access is enforced by row-level security at the database
 level; the only automated reads are features you invoke yourself (your insurance report and
 your monthly collection digest, both computed on our own servers). Like all our data, it is
 encrypted at rest and in transit by our hosting infrastructure.
 </p>

 <h3>Photos</h3>
 <p>
 Images you upload are stored in secure cloud storage. Photos of <strong>public</strong> horses
 are served from stable public URLs so they load fast and can be shared; photos of{""}
 <strong>private</strong> horses are never linked or listed anywhere on the site, and their
 storage addresses are long random identifiers that cannot be guessed or browsed. Uploads are
 limited to image files with a size cap enforced at the storage layer.
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
 <li>Send transactional emails (e.g., message notifications, show results, entry deadline reminders)</li>
 <li>Generate Hoofprint provenance records for your horses</li>
 <li>Improve the platform based on aggregate usage patterns</li>
 </ul>
 <p className="mt-4">
 <strong>We do NOT:</strong>
 </p>
 <ul className="mb-4 list-none p-0">
 <li>Sell your data to third parties &mdash; ever</li>
 <li>Display ads or share data with advertisers</li>
 <li>Use your collection data for machine learning training</li>
 <li>Show your financial vault data to any other user, or share it with any third party</li>
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
 <strong>Storage upload limits</strong> &mdash; image-only uploads with size caps enforced
 at the storage layer, and unguessable storage addresses for every photo
 </li>
 <li>
 <strong>Secure authentication</strong> &mdash; powered by Supabase Auth with the PKCE flow
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
 <strong>Hoofprint transfers</strong> &mdash; when you transfer a horse to another
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
 <strong>Google Analytics</strong> &mdash; anonymized usage analytics (you can decline this
 in the cookie banner)
 </li>
 <li>
 <strong>Stripe</strong> &mdash; payment processing for optional paid tiers. Card details go
 directly to Stripe; we never see or store them
 </li>
 <li>
 <strong>Sentry</strong> &mdash; error monitoring, so we find crashes before you have to
 report them (error reports may include browser and page context, never vault data)
 </li>
 <li>
 <strong>eBay Partner Network</strong> &mdash; some catalog pages include clearly marked
 sponsored eBay search links; if you buy through one, we may earn a small commission. No
 data about you is shared with eBay
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
 from your Settings page
 </li>
 <li>
 <strong>Delete your account</strong> &mdash; from your Settings page. Deletion anonymizes
 your account (your alias, bio, avatar, and message contents are removed or scrubbed) and
 permanently locks it. Records that other collectors rely on &mdash; provenance chains and
 show results attached to horses &mdash; are retained in anonymized form, because they are
 part of other people&apos;s horses&apos; histories too. To request removal of specific
 content beyond this, <Link href="/contact">contact us</Link>
 </li>
 <li>
 <strong>Control visibility</strong> &mdash; make any horse public or private at any time
 </li>
 <li>
 <strong>Opt out of analytics</strong> &mdash; choose &ldquo;Decline Analytics&rdquo; in the
 cookie banner; your choice is remembered and enforced on every visit
 </li>
 </ul>
 </section>

 {/* Cookies */}
 <section className="mb-12">
 <h2>7. Cookies</h2>
 <p>
 We use only <strong>essential cookies</strong> required for authentication and session
 management, plus Google Analytics for anonymized usage statistics. We do not use tracking
 cookies, advertising cookies, or third-party marketing pixels. You can decline analytics via
 the cookie banner &mdash; declining is remembered and disables Google Analytics on every
 subsequent visit.
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
 We may update this Privacy Policy from time to time. Material changes will be announced on the
 site, and the &ldquo;Last updated&rdquo; date at the top of this page always reflects the most
 recent revision.
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
