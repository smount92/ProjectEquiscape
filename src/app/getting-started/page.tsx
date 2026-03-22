import Link from"next/link";
import type { Metadata } from"next";

export const metadata: Metadata = {
 title:"Getting Started — Model Horse Hub",
 description:
"Learn how to set up your digital stable on Model Horse Hub. Add your first horse, explore the Show Ring, and discover Hoofprint™ provenance tracking.",
};

export default function GettingStartedPage() {
 return (
 <div className="mx-auto max-w-[var(--max-width)] px-6 py-12">
 <div className="animate-fade-in-up">
 {/* Page Header */}
 <div className="mb-8">
 <h1>
 Getting Started with <span className="text-forest">Model Horse Hub</span>
 </h1>
 <p className="mt-2 text-lg text-muted">
 Your digital stable is ready. Here&apos;s how to make the most of it.
 </p>
 </div>

 {/* Step 1 */}
 <section className="mb-12">
 <h2>📸 Step 1: Add Your First Horse</h2>
 <p>
 Click <strong>&ldquo;🏠 Digital Stable&rdquo;</strong> in the navigation, then hit{""}
 <strong>&ldquo;+ Add Horse&rdquo;</strong>.
 </p>
 <p>
 Start by selecting your model type &mdash; <strong>Breyer/Stone</strong> or{""}
 <strong>Artist Resin</strong>. Our database has <strong>10,500+ reference entries</strong>, so
 search by name, mold, or manufacturer to auto-fill the details. If your model isn&apos;t in the
 database, you can enter it manually.
 </p>
 <p>
 Upload up to <strong>5 LSQ-style photos</strong> (Near-Side, Off-Side, Front, Hindquarters,
 Belly/Maker&apos;s Mark) plus unlimited extra detail shots. Set your condition grade, finish
 type, and give your horse a name.
 </p>
 <div className="mt-4 rounded-lg border border-[rgba(44,85,69,0.2)] bg-[rgba(44,85,69,0.08)] px-6 py-4 text-sm leading-relaxed">
 <strong>💡 Tip:</strong> Set your horse to <strong>&ldquo;Public&rdquo;</strong> to share it in
 the Show Ring for the community to discover. Private horses are visible only to you.
 </div>
 </section>

 {/* Step 2 */}
 <section className="mb-12">
 <h2>🔒 Step 2: Track Your Financials (Private)</h2>
 <p>
 During the add-horse process, you&apos;ll see the <strong>Financial Vault</strong> section. This
 is where you can record:
 </p>
 <ul className="my-3 list-none p-0">
 <li>Purchase price and date</li>
 <li>Estimated current value</li>
 <li>Insurance notes</li>
 </ul>
 <p>
 <strong>This data is strictly private.</strong> It&apos;s protected by row-level security
 &mdash; even our team cannot access it. Only you can see your financial data, ever.
 </p>
 </section>

 {/* Step 3 */}
 <section className="mb-12">
 <h2>🐾 Step 3: Meet Hoofprint™</h2>
 <p>
 Every horse you add automatically gets a{""}
 <strong>Hoofprint™ &mdash; a permanent digital identity</strong>. Think of it like a passport
 that follows the horse, not the owner.
 </p>
 <p>Your Hoofprint timeline tracks:</p>
 <ul className="my-3 list-none p-0">
 <li>
 <strong>Life stages</strong> &mdash; from blank resin to work-in-progress to completed
 custom
 </li>
 <li>
 <strong>Ownership history</strong> &mdash; a verified chain of custody
 </li>
 <li>
 <strong>Show results</strong> &mdash; placements that follow the horse
 </li>
 <li>
 <strong>Custom notes</strong> &mdash; any events you want to document
 </li>
 </ul>
 <p>
 When you sell or trade a horse, you can generate a <strong>6-character transfer code</strong>{""}
 from its passport page. The buyer enters the code at{""}
 <Link href="/claim" className="text-forest font-semibold">
 📦 Claim
 </Link>{""}
 &mdash; and the horse moves to their stable with its entire history intact.
 </p>
 </section>

 {/* Step 4 */}
 <section className="mb-12">
 <h2>🏆 Step 4: Explore the Community</h2>
 <p>Once you&apos;ve added a few horses, explore what other collectors are sharing:</p>
 <ul className="my-3 list-none p-0">
 <li>
 <strong>
 <Link href="/community">🏆 Show Ring</Link>
 </strong>{""}
 &mdash; Browse all public models. Filter by finish type, trade status, or manufacturer.
 </li>
 <li>
 <strong>
 <Link href="/discover">👥 Discover</Link>
 </strong>{""}
 &mdash; Find and follow other collectors. See their public herds and show records.
 </li>
 <li>
 <strong>
 <Link href="/feed">📰 Feed</Link>
 </strong>{""}
 &mdash; See activity from collectors you follow &mdash; new additions, favorites, comments,
 and show results.
 </li>
 <li>
 <strong>
 <Link href="/shows">📸 Photo Shows</Link>
 </strong>{""}
 &mdash; Enter your best models in themed virtual photo shows. Vote for your favorites and
 compete for 🥇🥈🥉 placement.
 </li>
 </ul>
 </section>

 {/* Step 5 */}
 <section className="mb-12">
 <h2>💬 Step 5: Buy, Sell &amp; Connect</h2>
 <p>
 Set any horse&apos;s trade status to <strong>&ldquo;For Sale&rdquo;</strong> or{""}
 <strong>&ldquo;Open to Offers&rdquo;</strong> and it becomes visible as a listing in the Show
 Ring. Other collectors can message you directly through the built-in inbox.
 </p>
 <p>
 After a transaction, leave a <strong>rating</strong> for the other collector. Ratings build
 trust and reputation across the community.
 </p>
 <p>
 Add models to your{""}
 <Link href="/wishlist" className="text-forest font-semibold">
 ❤️ Wishlist
 </Link>{""}
 and you&apos;ll get notified when a matching model is listed for sale.
 </p>
 </section>

 {/* Step 6 */}
 <section className="mb-12">
 <h2>⚙️ Step 6: Customize Your Experience</h2>
 <p>
 Visit{""}
 <Link href="/settings" className="text-forest font-semibold">
 ⚙️ Settings
 </Link>{""}
 to:
 </p>
 <ul className="my-3 list-none p-0">
 <li>Upload a profile avatar</li>
 <li>Update your bio and alias</li>
 <li>Manage notification preferences</li>
 <li>Change your password</li>
 </ul>
 <p>
 You can also toggle <strong>Simple Mode</strong> (the eye icon in the header) for high-contrast,
 large text &mdash; great for accessibility or photo show judging.
 </p>
 </section>

 {/* Beta Feedback */}
 <section className="mb-12">
 <h2>🧪 Beta Tester? We Need Your Feedback!</h2>
 <p>
 You&apos;re among the first collectors to use Model Horse Hub. Your feedback directly shapes
 what we build next. If something feels broken, confusing, or missing &mdash;{""}
 <strong>we want to hear about it.</strong>
 </p>
 <p>
 Use the{""}
 <Link href="/contact" className="text-forest font-semibold">
 ✉️ Contact
 </Link>{""}
 page to send us your thoughts, or message the admin directly through the inbox.
 </p>
 <div className="mt-4 rounded-lg border border-[rgba(44,85,69,0.2)] bg-[rgba(44,85,69,0.08)] px-6 py-4 text-sm leading-relaxed">
 <strong>🙏 Thank you</strong> for being part of the founding herd. Every feature on this
 platform exists because a collector said &ldquo;I wish this existed.&rdquo; Keep telling us what
 you wish for.
 </div>
 </section>

 {/* CTA */}
 <div className="bg-card border-edge rounded-lg border text-center">
 <p>Ready to start?</p>
 <Link
 href="/dashboard"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-6 py-2 text-sm font-semibold no-underline transition-all"
 id="getting-started-cta"
 >
 Go to Your Digital Stable →
 </Link>
 </div>
 </div>
 </div>
 );
}
