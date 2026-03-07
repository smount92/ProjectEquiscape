import Link from "next/link";

export default function NotFound() {
    return (
        <div className="page-container">
            <div className="card shelf-empty animate-fade-in-up" style={{ maxWidth: "500px", margin: "0 auto" }}>
                <div className="shelf-empty-icon">🔍</div>
                <h2>Page Not Found</h2>
                <p>The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
                <Link href="/dashboard" className="btn btn-primary">
                    Back to Stable
                </Link>
            </div>
        </div>
    );
}
