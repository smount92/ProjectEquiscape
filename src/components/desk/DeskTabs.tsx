"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const DESK_TABS = [
    { href: "/catalog/desk", label: "Queue", emoji: "📥" },
    { href: "/catalog/desk/mold", label: "Mold view", emoji: "🐴" },
    { href: "/catalog/desk/todo", label: "To-do", emoji: "📋" },
    { href: "/catalog/desk/rules", label: "Rules", emoji: "📏" },
    { href: "/catalog/desk/history", label: "History", emoji: "🕰️" },
] as const;

/** Which Desk tab a path belongs to: the Queue only at the Desk's own address. */
export function activeDeskTab(pathname: string): string {
    if (pathname === "/catalog/desk" || pathname === "/catalog/desk/") return "/catalog/desk";
    const hit = DESK_TABS.find((t) => t.href !== "/catalog/desk" && pathname.startsWith(t.href));
    return hit?.href ?? "/catalog/desk";
}

/** The Desk's five sections, in the admin console's tab style. */
export default function DeskTabs() {
    const pathname = usePathname() ?? "/catalog/desk";
    const active = activeDeskTab(pathname);
    return (
        <nav
            aria-label="Desk sections"
            className="mb-6 flex gap-1 overflow-x-auto border-b border-border [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
            {DESK_TABS.map((t) => {
                const on = t.href === active;
                return (
                    <Link
                        key={t.href}
                        href={t.href}
                        aria-current={on ? "page" : undefined}
                        className={`flex items-center gap-1.5 border-b-[3px] px-4 py-2 text-sm font-semibold whitespace-nowrap no-underline transition-colors max-md:min-h-11 ${
                            on
                                ? "border-forest text-forest"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <span aria-hidden="true">{t.emoji}</span>
                        {t.label}
                    </Link>
                );
            })}
        </nav>
    );
}
