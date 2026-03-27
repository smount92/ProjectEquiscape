import Link from"next/link";

export default function Footer() {
 const currentYear = new Date().getFullYear();

 return (
 <footer className="mt-auto border-t border-stone-200 bg-white px-8 pt-16 text-sm text-stone-600">
 <div className="mx-auto flex max-w-[var(--max-width)] justify-between gap-16 pb-12 max-md:flex-col max-md:gap-12">
 {/* Brand */}
 <div className="max-w-[260px] max-md:max-w-full max-md:text-center">
 <Link
 href="/"
 className="mb-2 inline-block text-lg font-extrabold tracking-tight text-stone-900 no-underline hover:text-forest"
 >
 🐴 Model Horse Hub
 </Link>
 <p className="text-sm leading-relaxed text-stone-400">Built by collectors, for collectors.</p>
 </div>

 {/* Links */}
 <div className="flex gap-16 max-md:flex-wrap max-md:justify-center max-md:gap-12">
 <div className="flex flex-col gap-2 max-md:min-w-[120px] max-md:items-center max-md:text-center [&_a]:text-sm [&_a]:text-stone-600 [&_a]:no-underline [&_a]:transition-colors [&_a:hover]:text-forest">
 <h4 className="mb-1 text-xs font-bold tracking-wider text-stone-400 uppercase">Platform</h4>
 <Link href="/discover">Show Ring</Link>
 <Link href="/market">Price Guide</Link>
 <Link href="/studio">Art Studio</Link>
 <Link href="/shows">Photo Shows</Link>
 </div>
 <div className="flex flex-col gap-2 max-md:min-w-[120px] max-md:items-center max-md:text-center [&_a]:text-sm [&_a]:text-stone-600 [&_a]:no-underline [&_a]:transition-colors [&_a:hover]:text-forest">
 <h4 className="mb-1 text-xs font-bold tracking-wider text-stone-400 uppercase">Community</h4>
 <Link href="/community/groups">Groups</Link>
 <Link href="/community/events">Events</Link>
 <Link href="/feed">Activity Feed</Link>
 <Link href="/community/help-id">Help ID</Link>
 </div>
 <div className="flex flex-col gap-2 max-md:min-w-[120px] max-md:items-center max-md:text-center [&_a]:text-sm [&_a]:text-stone-600 [&_a]:no-underline [&_a]:transition-colors [&_a:hover]:text-forest">
 <h4 className="mb-1 text-xs font-bold tracking-wider text-stone-400 uppercase">Company</h4>
 <Link href="/about">About Us</Link>
 <Link href="/contact">Contact Us</Link>
 <Link href="/faq">FAQ</Link>
 <Link href="/getting-started">Getting Started</Link>
 </div>
 </div>
 </div>

 {/* Bottom bar */}
 <div className="mx-auto flex max-w-[var(--max-width)] items-center justify-between border-t border-stone-100 py-6 text-xs text-stone-400 max-md:flex-col max-md:gap-2 max-md:text-center">
 <span>© {currentYear} Model Horse Hub. All rights reserved.</span>
 <span className="flex items-center gap-1 [&_a]:text-stone-400 [&_a]:no-underline [&_a]:transition-colors [&_a:hover]:text-forest">
 <Link href="/privacy">Privacy</Link>
 <span className="opacity-40">·</span>
 <Link href="/terms">Terms</Link>
 </span>
 </div>
 </footer>
 );
}
