import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import Link from"next/link";
import { getGroups, getMyGroups } from"@/app/actions/groups";
import { GROUP_TYPE_LABELS } from"@/lib/constants/groups";
import GroupBrowser from"@/components/GroupBrowser";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";


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
  <Link
   href="/community/groups/create"
   className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-white no-underline shadow-sm transition-all"
  >
   + Create Group
  </Link>
  }
 >
  <GroupBrowser allGroups={allGroups} myGroups={myGroups} typeLabels={GROUP_TYPE_LABELS} />
 </ExplorerLayout>
 );
}
