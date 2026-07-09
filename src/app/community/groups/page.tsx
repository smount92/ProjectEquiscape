import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import Link from"next/link";
import { getGroups, getMyGroups } from"@/app/actions/groups";
import { GROUP_TYPE_LABELS } from"@/lib/constants/groups";
import GroupBrowser from"@/components/GroupBrowser";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";
import { Button } from "@/components/ui/button";


export const metadata = {
 title:"Groups — Model Horse Hub",
 description:"Join clubs, circuits, and communities in the model horse hobby.",
};

export default async function GroupsPage() {
 const supabase = await createClient();
 const {
 data: { user },
 } = await supabase.auth.getUser();
 if (!user) redirect("/login");

 const [allGroups, myGroups] = await Promise.all([getGroups(), getMyGroups()]);

 return (
 <ExplorerLayout
  title={<>🏛️ Groups</>}
  description="Clubs, circuits, and communities"
  headerActions={
  <Button asChild><Link
   href="/community/groups/create"
  >
   + Create Group
  </Link></Button>
  }
 >
  <GroupBrowser allGroups={allGroups} myGroups={myGroups} typeLabels={GROUP_TYPE_LABELS} />
 </ExplorerLayout>
 );
}
