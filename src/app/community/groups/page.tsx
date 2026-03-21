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
        <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6">
            <div className="page-content">
                <div className="justify-between gap-4 mb-8" style={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}>
                    <div>
                        <h1>🏛️ Groups</h1>
                        <p className="text-muted mt-1" >
                            Clubs, circuits, and communities
                        </p>
                    </div>
                    <Link href="/community/groups/create" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm">+ Create Group</Link>
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
