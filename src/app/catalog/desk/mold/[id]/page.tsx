import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { registryRoleOf } from "@/lib/auth";
import { getItemForEdit, getMoldView } from "@/app/actions/registry-desk";
import MoldView from "@/components/desk/MoldView";

/**
 * One mold, its releases and the editor. Opened with a release's own id
 * (from the Queue or a to-do list) it moves to that release's mold with
 * the release picked; a release with no mold opens on its own.
 */
export default async function DeskMoldPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ release?: string }>;
}) {
    const who = await registryRoleOf();
    if (!who) notFound();
    const { id } = await params;
    const { release } = await searchParams;

    const view = await getMoldView(id);
    if (view.success) {
        return (
            <MoldView
                mold={view.view.mold}
                releases={view.view.releases}
                initialReleaseId={release ?? null}
                role={who.role}
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
        redirect(`/catalog/desk/mold/${item.item.row.parent_id}?release=${id}`);
    }
    return (
        <MoldView
            mold={null}
            releases={[item.item]}
            initialReleaseId={id}
            role={who.role}
            parentTitle={item.parentTitle}
        />
    );
}
