import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import Link from"next/link";
import { getEvents } from"@/app/actions/events";
import EventBrowser from"@/components/EventBrowser";
import { EVENT_TYPE_LABELS } from"@/lib/constants/events";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";
import PageMasthead from"@/components/layouts/PageMasthead";
import { Button } from "@/components/ui/button";


export const metadata = {
 title:"Events",
 description:"Discover shows, swap meets, meetups, and more in the model horse community.",
};

export default async function EventsPage() {
 const supabase = await createClient();
 const {
 data: { user },
 } = await supabase.auth.getUser();
 if (!user) redirect("/login");

 const events = await getEvents({ upcoming: true });

 return (
 <ExplorerLayout noHeader>
  <PageMasthead
   icon="📅"
   title="Events"
   subtitle="Shows, swap meets, meetups, and more"
   actions={
   <Button asChild><Link href="/community/events/create">+ Create Event</Link></Button>
   }
  />
  <EventBrowser events={events} typeLabels={EVENT_TYPE_LABELS} />
 </ExplorerLayout>
 );
}
