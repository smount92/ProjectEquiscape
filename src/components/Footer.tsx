import Link from "next/link";

export default function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="site-footer">
            <div className="footer-inner">
                {/* Brand */}
                <div className="footer-brand">
                    <Link href="/" className="footer-logo">
                        🐴 Model Horse Hub
                    </Link>
                    <p className="footer-tagline">
                        Built by collectors, for collectors.
                    </p>
                </div>

                {/* Links */}
                <div className="footer-links">
                    <div className="footer-column">
                        <h4 className="footer-column-title">Platform</h4>
                        <Link href="/discover">Show Ring</Link>
                        <Link href="/market">Price Guide</Link>
                        <Link href="/studio">Art Studio</Link>
                        <Link href="/shows">Photo Shows</Link>
                    </div>
                    <div className="footer-column">
                        <h4 className="footer-column-title">Community</h4>
                        <Link href="/community/groups">Groups</Link>
                        <Link href="/community/events">Events</Link>
                        <Link href="/feed">Activity Feed</Link>
                        <Link href="/community/help-id">Help ID</Link>
                    </div>
                    <div className="footer-column">
                        <h4 className="footer-column-title">Company</h4>
                        <Link href="/about">About Us</Link>
                        <Link href="/contact">Contact Us</Link>
                        <Link href="/faq">FAQ</Link>
                        <Link href="/getting-started">Getting Started</Link>
                    </div>
                </div>
            </div>

            {/* Bottom bar */}
            <div className="footer-bottom">
                <span>© {currentYear} Model Horse Hub. All rights reserved.</span>
                <span className="footer-bottom-links">
                    <Link href="/privacy">Privacy</Link>
                    <span className="footer-dot">·</span>
                    <Link href="/terms">Terms</Link>
                </span>
            </div>
        </footer>
    );
}
