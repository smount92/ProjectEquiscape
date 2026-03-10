import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getGroups, getMyGroups } from "@/app/actions/groups";
import { GROUP_TYPE_LABELS } from "@/lib/constants/groups";
import GroupBrowser from "@/components/GroupBrowser";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Groups — Model Horse Hub",
    description: "Join clubs, circuits, and communities in the model horse hobby.",
};

export default async function GroupsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const [allGroups, myGroups] = await Promise.all([
        getGroups(),
        getMyGroups(),
    ]);

    return (
        <div className="page-container">
            <div className="page-content">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-md)", marginBottom: "var(--space-xl)" }}>
                    <div>
                        <h1>🏛️ Groups</h1>
                        <p style={{ color: "var(--color-text-muted)", marginTop: "var(--space-xs)" }}>
                            Clubs, circuits, and communities
                        </p>
                    </div>
                    <Link href="/community/groups/create" className="btn btn-primary">+ Create Group</Link>
                </div>

                <GroupBrowser
                    allGroups={allGroups}
                    myGroups={myGroups}
                    typeLabels={GROUP_TYPE_LABELS}
                />
            </div>
        </div>
    );
}
