import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getGroups, getMyGroups } from "@/app/actions/groups";
import { GROUP_TYPE_LABELS } from "@/lib/constants/groups";
import GroupBrowser from "@/components/GroupBrowser";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import { Button } from "@/components/ui/button";

export const metadata = {
    title: "Barns",
    description: "Clubs, circuits, and communities in the model horse hobby — find your barn.",
};

export default async function GroupsPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const [allGroups, myGroups] = await Promise.all([getGroups(), getMyGroups()]);

    return (
        <ExplorerLayout noHeader>
            <PageMasthead
                icon="🏚️"
                title="Barns"
                subtitle="Clubs, circuits, and communities"
                actions={
                    <Button asChild>
                        <Link href="/community/groups/create">+ Start a Barn</Link>
                    </Button>
                }
            />
            <GroupBrowser allGroups={allGroups} myGroups={myGroups} typeLabels={GROUP_TYPE_LABELS} />
        </ExplorerLayout>
    );
}
