import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { registryRoleOf } from "@/lib/auth";
import { getItemForEdit, getMoldView } from "@/app/actions/registry-desk";
import MoldView, { type MoldFilter } from "@/components/desk/MoldView";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** "Back to the list" only ever returns to a page on the Desk. */
function deskBack(raw: string | undefined): string | null {
    if (!raw || !raw.startsWith("/catalog/desk/") || raw.startsWith("//") || raw.includes("\\")) return null;
    return raw.slice(0, 300);
}

/**
 * One mold, its releases and the editor. Opened with a release's own id
 * (from the Queue, a to-do list or the Desk search) it moves to that
 * release's mold with the release picked; anything with no mold opens on
 * its own. A to-do list opens it on "Needs work" with a way back.
 */
export default async function DeskMoldPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const who = await registryRoleOf();
    if (!who) notFound();
    const { id } = await params;
    const sp = await searchParams;
    const release = one(sp.release);
    const filterAsked = one(sp.filter);
    const initialFilter: MoldFilter = filterAsked === "needs" || filterAsked === "good" ? filterAsked : "all";
    const backHref = deskBack(one(sp.back));

    const view = await getMoldView(id);
    if (view.success) {
        return (
            <MoldView
                key={id}
                mold={view.view.mold}
                releases={view.view.releases}
                initialReleaseId={release ?? null}
                role={who.role}
                fieldKeys={view.view.fieldKeys}
                initialFilter={initialFilter}
                backHref={backHref}
            />
        );
    }

    // Not a mold: a release or another entry.
    const item = await getItemForEdit(id);
    if (!item.success) {
        return (
            <div className="flex flex-col gap-3">
                <p role="alert" className="m-0 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {view.error}
                </p>
                <Link href="/catalog/desk/mold" className="text-sm font-semibold text-forest underline">
                    Pick another mold
                </Link>
            </div>
        );
    }
    if (item.item.row.parent_id) {
        const keep = new URLSearchParams({ release: id });
        if (initialFilter !== "all") keep.set("filter", initialFilter);
        if (backHref) keep.set("back", backHref);
        redirect(`/catalog/desk/mold/${item.item.row.parent_id}?${keep.toString()}`);
    }
    return (
        <MoldView
            key={id}
            mold={null}
            releases={[item.item]}
            initialReleaseId={id}
            role={who.role}
            parentTitle={item.parentTitle}
            fieldKeys={item.fieldKeys}
            backHref={backHref}
        />
    );
}
