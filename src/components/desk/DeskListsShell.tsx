/**
 * INTERIM frame for Package C's Desk pages (To-do, Rules, History), used
 * only until Package B's shared `src/app/catalog/desk/layout.tsx` (the
 * masthead and DeskTabs) is merged. At that merge, replace
 * `<DeskListsShell active="...">...</DeskListsShell>` in the four Package C
 * pages with a fragment and delete this file, or the tabs show twice.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import CatalogSubMasthead from "@/components/catalog/CatalogSubMasthead";
import { cn } from "@/lib/utils";

export type DeskTab = "queue" | "mold" | "todo" | "rules" | "history";

const TABS: { key: DeskTab; label: string; href: string }[] = [
    { key: "queue", label: "Queue", href: "/catalog/desk" },
    { key: "mold", label: "Mold view", href: "/catalog/desk/mold" },
    { key: "todo", label: "To-do", href: "/catalog/desk/todo" },
    { key: "rules", label: "Rules", href: "/catalog/desk/rules" },
    { key: "history", label: "History", href: "/catalog/desk/history" },
];

export default function DeskListsShell({ active, children }: { active: DeskTab; children: ReactNode }) {
    return (
        <ExplorerLayout noHeader>
            <CatalogSubMasthead
                icon="🗂️"
                title="Registry Desk"
                subtitle="Every change is recorded with your name and can be undone for 30 days"
            />
            <nav aria-label="Desk sections" className="mb-5 overflow-x-auto border-b-2 border-input">
                <ul className="m-0 flex min-w-max list-none gap-1 p-0">
                    {TABS.map((t) => (
                        <li key={t.key}>
                            <Link
                                href={t.href}
                                aria-current={t.key === active ? "page" : undefined}
                                className={cn(
                                    "-mb-0.5 inline-flex min-h-11 items-center rounded-t-lg border border-transparent px-4 text-sm font-semibold no-underline",
                                    t.key === active
                                        ? "border-input border-b-card bg-card text-foreground"
                                        : "text-muted-foreground hover:text-foreground",
                                )}
                            >
                                {t.label}
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>
            {children}
        </ExplorerLayout>
    );
}
