import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import CatalogSubMasthead from "@/components/catalog/CatalogSubMasthead";
import DeskTabs from "@/components/desk/DeskTabs";
import { registryRoleOf } from "@/lib/auth";

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

    return (
        <ExplorerLayout noHeader>
            <CatalogSubMasthead
                icon="🗂️"
                title="Registry Desk"
                subtitle={`@${who.alias} · ${who.role === "owner" ? "Site owner" : "Registry moderator"}`}
                backHref="/catalog"
                backLabel="Registry"
            />
            <p className="mt-0 mb-4 max-w-[70ch] text-sm text-secondary-foreground">
                Where vetted members keep the Registry tidy. Every change is recorded with your name and can be undone
                for 30 days.
            </p>
            <DeskTabs />
            {children}
        </ExplorerLayout>
    );
}
