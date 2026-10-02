import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStableSummary } from "@/app/actions/stable";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import FoldersManager, { type FolderRow } from "@/components/stable/FoldersManager";

export const metadata = {
    title: "Folders — Digital Stable",
    description: "Name, share and delete the folders that organise your stable.",
};

/**
 * The Folders manager — the one home for folders (see FoldersManager).
 * Counts and values come from the stable summary, which already unions
 * both membership stores.
 */
export default async function FoldersPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login?redirectTo=" + encodeURIComponent("/stable/collections"));

    const [{ data: rows }, summaryResult, { data: profile }] = await Promise.all([
        supabase.from("user_collections").select("id, name, is_public").eq("user_id", user.id).order("name"),
        getStableSummary(),
        supabase.from("users").select("currency_symbol").eq("id", user.id).maybeSingle(),
    ]);
    const stats = new Map(
        (summaryResult.success ? summaryResult.summary.collections : []).map((c) => [c.id, c]),
    );
    const folders: FolderRow[] = ((rows ?? []) as { id: string; name: string; is_public: boolean | null }[]).map((r) => ({
        id: r.id,
        name: r.name,
        isPublic: r.is_public === true,
        count: stats.get(r.id)?.count ?? 0,
        value: stats.get(r.id)?.value ?? 0,
    }));

    return (
        <ExplorerLayout frameless noHeader>
            <PageMasthead
                icon="📁"
                title="Folders"
                subtitle={folders.length === 0 ? "None yet" : `${folders.length} folder${folders.length === 1 ? "" : "s"}`}
                backHref="/dashboard"
                backLabel="Digital Stable"
            />
            <div className="mx-auto max-w-[820px]">
                <FoldersManager
                    folders={folders}
                    currencySymbol={(profile as { currency_symbol?: string | null } | null)?.currency_symbol || "$"}
                />
            </div>
        </ExplorerLayout>
    );
}
