import Link from "next/link";

export default function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="mt-auto border-t border-[rgba(139,90,43,0.2)] bg-[#3B2A1A] pt-16 px-8 text-sm text-white/70">
            <div className="flex justify-between gap-16 max-w-[var(--max-width)] mx-auto pb-12 max-md:flex-col max-md:gap-12">
                {/* Brand */}
                <div className="max-w-[260px] max-md:max-w-full max-md:text-center">
                    <Link href="/" className="text-lg font-extrabold text-[#F0EAD6] no-underline inline-block mb-2 tracking-tight hover:text-[#D4A76A]">
                        🐴 Model Horse Hub
                    </Link>
                    <p className="text-white/50 leading-relaxed text-sm">
                        Built by collectors, for collectors.
                    </p>
                </div>

                {/* Links */}
                <div className="flex gap-16 max-md:justify-center max-md:gap-12 max-md:flex-wrap">
                    <div className="flex flex-col gap-2 max-md:items-center max-md:text-center max-md:min-w-[120px] [&_a]:text-white/70 [&_a]:no-underline [&_a]:text-sm [&_a]:transition-colors [&_a:hover]:text-[#D4A76A]">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-1">Platform</h4>
                        <Link href="/discover">Show Ring</Link>
                        <Link href="/market">Price Guide</Link>
                        <Link href="/studio">Art Studio</Link>
                        <Link href="/shows">Photo Shows</Link>
                    </div>
                    <div className="flex flex-col gap-2 max-md:items-center max-md:text-center max-md:min-w-[120px] [&_a]:text-white/70 [&_a]:no-underline [&_a]:text-sm [&_a]:transition-colors [&_a:hover]:text-[#D4A76A]">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-1">Community</h4>
                        <Link href="/community/groups">Groups</Link>
                        <Link href="/community/events">Events</Link>
                        <Link href="/feed">Activity Feed</Link>
                        <Link href="/community/help-id">Help ID</Link>
                    </div>
                    <div className="flex flex-col gap-2 max-md:items-center max-md:text-center max-md:min-w-[120px] [&_a]:text-white/70 [&_a]:no-underline [&_a]:text-sm [&_a]:transition-colors [&_a:hover]:text-[#D4A76A]">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-1">Company</h4>
                        <Link href="/about">About Us</Link>
                        <Link href="/contact">Contact Us</Link>
                        <Link href="/faq">FAQ</Link>
                        <Link href="/getting-started">Getting Started</Link>
                    </div>
                </div>
            </div>

            {/* Bottom bar */}
            <div className="flex items-center justify-between max-w-[var(--max-width)] mx-auto py-6 border-t border-white/10 text-xs text-white/40 max-md:flex-col max-md:gap-2 max-md:text-center">
                <span>© {currentYear} Model Horse Hub. All rights reserved.</span>
                <span className="flex items-center gap-1 [&_a]:text-white/40 [&_a]:no-underline [&_a]:transition-colors [&_a:hover]:text-[#D4A76A]">
                    <Link href="/privacy">Privacy</Link>
                    <span className="opacity-40">·</span>
                    <Link href="/terms">Terms</Link>
                </span>
            </div>
        </footer>
    );
}
