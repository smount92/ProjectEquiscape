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
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const [allGroups, myGroups] = await Promise.all([getGroups(), getMyGroups()]);

    return (
        <div className="mx-auto max-w-[var(--max-width)] px-6 py-[0]">
            <div className="page-content">
                <div
                    className="mb-8 justify-between gap-4"
                    style={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}
                >
                    <div>
                        <h1>🏛️ Groups</h1>
                        <p className="text-muted mt-1">Clubs, circuits, and communities</p>
                    </div>
                    <Link
                        href="/community/groups/create"
                        className="hover:no-underline-min-h)] bg-forest text-inverse inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-0 border-[transparent] px-8 py-2 font-sans text-base leading-none font-semibold no-underline shadow-sm transition-all duration-150"
                    >
                        + Create Group
                    </Link>
                </div>

                <GroupBrowser allGroups={allGroups} myGroups={myGroups} typeLabels={GROUP_TYPE_LABELS} />
            </div>
        </div>
    );
}
