"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const DESK_TABS = [
    { href: "/catalog/desk", label: "Queue", emoji: "📥", count: "queue" },
    { href: "/catalog/desk/mold", label: "Mold view", emoji: "🐴", count: null },
    { href: "/catalog/desk/todo", label: "To-do", emoji: "📋", count: null },
    { href: "/catalog/desk/rules", label: "Rules", emoji: "📏", count: "rules" },
    { href: "/catalog/desk/history", label: "History", emoji: "🕰️", count: null },
] as const;

/** What the numbers on the tabs count: open suggestions, rules waiting for agreement. */
export interface DeskTabCounts {
    queue: number;
    rules: number;
}

/** Which Desk tab a path belongs to: the Queue only at the Desk's own address. */
export function activeDeskTab(pathname: string): string {
    if (pathname === "/catalog/desk" || pathname === "/catalog/desk/") return "/catalog/desk";
    const hit = DESK_TABS.find((t) => t.href !== "/catalog/desk" && pathname.startsWith(t.href));
    return hit?.href ?? "/catalog/desk";
}

/**
 * The Desk's five sections, in the admin console's tab style, with how
 * much waits on each. The strip wraps onto a second line on a phone, so
 * every tab stays in sight.
 */
export default function DeskTabs({ counts = null }: { counts?: DeskTabCounts | null }) {
    const pathname = usePathname() ?? "/catalog/desk";
    const active = activeDeskTab(pathname);
    return (
        <nav aria-label="Desk sections" className="mb-6 flex flex-wrap gap-x-1 border-b border-border">
            {DESK_TABS.map((t) => {
                const on = t.href === active;
                const n = t.count && counts ? counts[t.count] : null;
                return (
                    <Link
                        key={t.href}
                        href={t.href}
                        aria-current={on ? "page" : undefined}
                        className={`-mb-px flex items-center gap-1.5 border-b-[3px] px-3 py-2 text-sm font-semibold whitespace-nowrap no-underline transition-colors max-md:min-h-11 sm:px-4 ${
                            on
                                ? "border-forest text-forest"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <span aria-hidden="true">{t.emoji}</span>
                        {t.label}
                        {n !== null && n > 0 && (
                            <span
                                className={`rounded-full px-1.5 text-xs tabular-nums ${on ? "bg-forest/10" : "bg-muted"}`}
                                data-testid={`tab-count-${t.count}`}
                            >
                                <span className="sr-only">(</span>
                                {n}
                                <span className="sr-only">{t.count === "queue" ? " waiting)" : " proposed)"}</span>
                            </span>
                        )}
                    </Link>
                );
            })}
        </nav>
    );
}
