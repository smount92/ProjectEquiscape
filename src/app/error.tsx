"use client";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="page-container">
            <div className="card shelf-empty animate-fade-in-up" style={{ maxWidth: "500px", margin: "0 auto" }}>
                <div className="shelf-empty-icon">⚠️</div>
                <h2>Something Went Wrong</h2>
                <p>An unexpected error occurred. Please try again.</p>
                <button className="btn btn-primary" onClick={reset}>
                    Try Again
                </button>
            </div>
        </div>
    );
}
