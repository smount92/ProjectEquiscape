"use client";

import Link from "next/link";

interface UserAvatarProps {
    /** Signed avatar URL or null for fallback */
    src: string | null;
    /** Username for fallback initial + color generation */
    alias: string;
    /** Size variant: xs=24, sm=32, md=40, lg=56 */
    size?: "xs" | "sm" | "md" | "lg";
    /** If provided, avatar links to this href */
    href?: string;
}

const SIZE_MAP = {
    xs: { container: "h-6 w-6", text: "text-[0.55rem]" },
    sm: { container: "h-8 w-8", text: "text-xs" },
    md: { container: "h-10 w-10", text: "text-sm" },
    lg: { container: "h-14 w-14", text: "text-lg" },
} as const;

/**
 * Generate a deterministic warm HSL color from a username string.
 * Produces earthy/warm tones that complement the parchment palette.
 */
function hashColor(alias: string): string {
    let hash = 0;
    for (let i = 0; i < alias.length; i++) {
        hash = alias.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Restrict hue to warm ranges: 0-60 (reds/oranges), 120-180 (greens), 280-340 (purples)
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 40%, 55%)`;
}

export default function UserAvatar({ src, alias, size = "sm", href }: UserAvatarProps) {
    const { container, text } = SIZE_MAP[size];
    const fallbackColor = hashColor(alias);
    const initial = alias.charAt(0).toUpperCase();

    const avatar = (
        <div
            className={`${container} inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-[#E0D5C1] shadow-sm font-semibold text-white transition-shadow hover:ring-[#C8B89A]`}
            style={!src ? { backgroundColor: fallbackColor } : undefined}
        >
            {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={src}
                    alt={alias}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                        // On broken URL, hide img and let the fallback show
                        const target = e.currentTarget;
                        target.style.display = "none";
                        const parent = target.parentElement;
                        if (parent) {
                            parent.style.backgroundColor = fallbackColor;
                            parent.textContent = initial;
                        }
                    }}
                />
            ) : (
                <span className={text}>{initial}</span>
            )}
        </div>
    );

    if (href) {
        return (
            <Link href={href} className="shrink-0 no-underline" aria-label={`View ${alias}'s profile`}>
                {avatar}
            </Link>
        );
    }

    return avatar;
}
