import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import CatalogSubMasthead from "@/components/catalog/CatalogSubMasthead";
import DeskTabs from "@/components/desk/DeskTabs";
import { registryRoleOf } from "@/lib/auth";
import { getDeskCounts } from "@/app/actions/registry-desk";

export const metadata: Metadata = {
    title: "Registry Desk",
    robots: { index: false, follow: false },
};

/**
 * The Registry Desk: where Registry moderators and the owner keep the
 * Registry tidy (docs/design/registry-moderators.md). Everyone else gets a
 * plain not-found, so the page does not advertise itself; every action
 * checks the role again on its own.
 */
export default async function DeskLayout({ children }: { children: ReactNode }) {
    const who = await registryRoleOf();
    if (!who) notFound();
    const counted = await getDeskCounts();
    const counts = counted.success ? counted.counts : null;
    const looks = counts?.secondLooks ?? 0;

    return (
        <ExplorerLayout noHeader>
            <CatalogSubMasthead
                icon="🗂️"
                title="Registry Desk"
                subtitle={`@${who.alias} · ${who.role === "owner" ? "Site owner" : "Registry moderator"}`}
                backHref="/catalog"
                backLabel="Registry"
            />
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <p className="m-0 max-w-[70ch] text-sm text-secondary-foreground">
                    Where vetted members keep the Registry tidy. Every change is recorded with your name and can be
                    undone for 30 days.{" "}
                    <Link href="/catalog/desk/guide" className="font-semibold text-forest">
                        Read the moderators&apos; guide
                    </Link>
                </p>
                {looks > 0 && (
                    <Link
                        href="/catalog/desk?tab=second_looks"
                        className="rounded-full border border-input bg-card px-3 py-1 text-xs font-semibold text-secondary-foreground no-underline hover:border-forest max-md:min-h-11 max-md:content-center"
                        data-testid="second-looks-chip"
                    >
                        {looks} merge{looks === 1 ? "" : "s"} waiting for a second look
                    </Link>
                )}
            </div>
            <DeskTabs counts={counts ? { queue: counts.queue, rules: counts.rules } : null} />
            {children}
        </ExplorerLayout>
    );
}
