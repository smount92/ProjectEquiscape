/**
 * Horseshoe — the Hoofprint mark. Replaces the old 🐾 paw (wrong animal!).
 * Inherits color via currentColor and scales to the surrounding font-size
 * (1em) so it drops into text like an emoji did. Decorative by default.
 */

export default function HorseshoeIcon({
    className = "",
    title,
}: {
    className?: string;
    title?: string;
}) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={`inline-block h-[1em] w-[1em] shrink-0 align-[-0.14em] ${className}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            role={title ? "img" : "presentation"}
            aria-hidden={title ? undefined : true}
            aria-label={title}
        >
            {title ? <title>{title}</title> : null}
            {/* U-shaped shoe, open at the top */}
            <path d="M6.5 3.6C4 5.6 3 9.2 3.7 12.8c.7 3.7 4 6.6 8.3 6.6s7.6-2.9 8.3-6.6c.7-3.6-.3-7.2-2.8-9.2" />
            {/* nail holes */}
            <circle cx="5.3" cy="8.1" r="0.85" fill="currentColor" stroke="none" />
            <circle cx="6.4" cy="12.4" r="0.85" fill="currentColor" stroke="none" />
            <circle cx="18.7" cy="8.1" r="0.85" fill="currentColor" stroke="none" />
            <circle cx="17.6" cy="12.4" r="0.85" fill="currentColor" stroke="none" />
        </svg>
    );
}
