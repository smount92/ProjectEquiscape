import Link from"next/link";
import type { Metadata } from"next";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";
import AiDataPolicySection from"@/components/AiDataPolicySection";

export const metadata: Metadata = {
 title:"About — Model Horse Hub",
 description:
"Learn about Model Horse Hub — the first digital stable built by a collector who was tired of notebooks, spreadsheets, and scattered albums. 10,500+ reference entries, Hoofprint™ provenance, and a privacy-first design.",
};

export default function AboutPage() {
 return (
 <ExplorerLayout title={<>About <span className="text-forest">Model Horse Hub</span></>} description="Built by a collector who was tired of the status quo.">
 <div className="animate-fade-in-up">
 {/* Page Header */}
 <div className="mb-8">
 <h1>
 About <span className="text-forest">Model Horse Hub</span>
 </h1>
 <p className="mt-2 text-lg text-stone-600">
 Built by a collector who was tired of the status quo.
 </p>
 </div>

 {/* Our Story */}
 <section className="mb-12">
 <h2>Our Story</h2>
 <div className="space-y-4 text-base leading-relaxed text-stone-600">
 <p>
 It started the way it starts for most of us: a notebook. Then a spreadsheet. Then another
 spreadsheet because the first one got too messy. Then Facebook albums and mental notes about
 &ldquo;that palomino I sold in 2019 — what was her name?&rdquo;
 </p>
 <p>
 The model horse hobby has exploded in size and sophistication, but the tools for managing a
 collection haven&apos;t kept up. There was no single platform where you could catalog your herd
 with proper multi-angle photos, track what you paid and what it&apos;s worth, and connect with
 other collectors — all in one place, with real privacy protections.
 </p>
 <p>
 So we built one. Model Horse Hub is a purpose-built digital stable backed by a{""}
 <strong>10,500+ entry reference database</strong> — 7,000+ Breyer and Stone releases
 hand-verified from official catalogs, plus 3,500+ artist resins sourced from the Equine Resin
 Directory. When you add a horse, you&apos;re not typing in data from scratch. You&apos;re
 selecting from real reference data with mold, manufacturer, scale, and year already filled in.
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
 <div className="bg-white border-input rounded-lg border p-8 text-center shadow-md transition-all">
 <span className="mb-4 block text-[2rem]" aria-hidden="true">
 🔒
 </span>
 <h3>Your Data is YOURS</h3>
 <p>
 Row-level security means even our team can&apos;t see your financial vault. No ads, no
 selling your collection data, no &ldquo;we may share with partners&rdquo; clauses. Your
 purchase prices, estimated values, and insurance notes stay locked behind cryptographic
 access controls. Period.
 </p>
 </div>
 <div className="bg-white border-input rounded-lg border p-8 text-center shadow-md transition-all">
 <span className="mb-4 block text-[2rem]" aria-hidden="true">
 ✨
 </span>
 <h3>Built for the Hobby&apos;s Nuances</h3>
 <p>
 We know what LSQ means. We know the difference between OF and CM. We know that a Breyer
 #5 is fundamentally different from a Beswick #5. Every feature was designed around how
 collectors actually work — not how a generic inventory app thinks you should.
 </p>
 </div>
 <div className="bg-white border-input rounded-lg border p-8 text-center shadow-md transition-all">
 <span className="mb-4 block text-[2rem]" aria-hidden="true">
 🐾
 </span>
 <h3>Hoofprint™ — A First for the Hobby</h3>
 <p>
 No platform has ever built provenance tracking for model horses. Hoofprint™ creates a
 permanent digital identity for every horse — ownership history, customization records,
 show results, and photos that follow the horse, not the owner. The CarFax of model
 horses.
 </p>
 </div>
 </div>
 </section>

 {/* The Vision */}
 <section className="mb-12">
 <h2>Where We&apos;re Going</h2>
 <div className="space-y-4 text-base leading-relaxed text-stone-600">
 <p>
 Model Horse Hub isn&apos;t just a collection manager &mdash; it&apos;s becoming the operating
 system for the hobby. Every feature on this platform exists because a real collector said
 &ldquo;I wish this existed.&rdquo;
 </p>
 <p>Here&apos;s what&apos;s on the roadmap:</p>
 </div>
 <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
 <div className="bg-white border-input rounded-lg border p-8 text-center shadow-md transition-all">
 <span className="mb-4 block text-[2rem]" aria-hidden="true">
 🎨
 </span>
 <h3>Art Studio &amp; Commission Tracking</h3>
 <p>
 Artists will manage their commission queue, share WIP photos with clients, and build
 portfolios. When a custom is delivered, the creation story flows into the horse&apos;s
 Hoofprint&trade; &mdash; permanently.
 </p>
 </div>
 <div className="bg-white border-input rounded-lg border p-8 text-center shadow-md transition-all">
 <span className="mb-4 block text-[2rem]" aria-hidden="true">
 📦
 </span>
 <h3>Bulk Import &amp; Insurance Reports</h3>
 <p>
 Upload your spreadsheet and we&apos;ll fuzzy-match every row against 10,500+ references.
 Generate one-click PDF reports for your insurance company with photos, values, and
 condition grades.
 </p>
 </div>
 <div className="bg-white border-input rounded-lg border p-8 text-center shadow-md transition-all">
 <span className="mb-4 block text-[2rem]" aria-hidden="true">
 🏆
 </span>
 <h3>Competition Engine</h3>
 <p>
 Digital NAN qualification tracking, show string planning, and verified judge results.
 Show records follow the horse through Hoofprint&trade; transfers &mdash; no more mailing
 paper cards.
 </p>
 </div>
 <div className="bg-white border-input rounded-lg border p-8 text-center shadow-md transition-all">
 <span className="mb-4 block text-[2rem]" aria-hidden="true">
 🌍
 </span>
 <h3>Groups &amp; Regional Community</h3>
 <p>
 Join collector clubs, find hobbyists in your region, and host group shows. All
 integrated with your stable, not scattered across Facebook and Discord.
 </p>
 </div>
 <div className="bg-white border-input rounded-lg border p-8 text-center shadow-md transition-all">
 <span className="mb-4 block text-[2rem]" aria-hidden="true">
 📱
 </span>
 <h3>Mobile &amp; Offline</h3>
 <p>
 Take your collection to live shows. Quick photo capture, offline access at fairgrounds,
 and push notifications &mdash; all from your phone.
 </p>
 </div>
 <div className="bg-white border-input rounded-lg border p-8 text-center shadow-md transition-all">
 <span className="mb-4 block text-[2rem]" aria-hidden="true">
 🤝
 </span>
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
 <div className="bg-white border-input rounded-lg border text-center">
 <p>Your herd is waiting. Give it the home it deserves.</p>
 <Link
 href="/signup"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 id="about-cta-signup"
 >
 Start Your Digital Stable — Free
 </Link>
 </div>
 </div>
  </ExplorerLayout>
 );
}
