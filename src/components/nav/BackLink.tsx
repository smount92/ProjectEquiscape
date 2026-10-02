"use client";
/**
 * "← Parent" — THE back link. It is a real link to the page's logical
 * parent (so it works cold, with JavaScript off, and for crawlers), but
 * when the reader actually came from that parent it goes back through
 * history instead, which returns them to it as they left it: same
 * filters, same scroll position.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { cameFrom } from "@/lib/nav/trail";
import { readTrail } from "@/components/nav/NavTrail";

export default function BackLink({
    href,
    children,
    className,
    style,
}: {
    /** The logical parent — where "back" goes when there is no history to go back through. */
    href: string;
    children: ReactNode;
    className?: string;
    style?: CSSProperties;
}) {
    const router = useRouter();
    return (
        <Link
            href={href}
            className={className}
            style={style}
            onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                if (cameFrom(readTrail(), href)) {
                    e.preventDefault();
                    router.back();
                }
            }}
        >
            {children}
        </Link>
    );
}
