import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import Link from"next/link";
import { getEvents } from"@/app/actions/events";
import EventBrowser from"@/components/EventBrowser";

import { EVENT_TYPE_LABELS } from"@/lib/constants/events";


export const metadata = {
 title:"Events — Model Horse Hub",
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
 <div className="mx-auto max-w-[var(--max-width)] px-6 py-8">
 <div className="mx-auto max-w-[var(--max-width)] px-6">
 <div
 className="mb-8 flex flex-wrap items-center justify-between gap-4"
 >
 <div>
 <h1>📅 Events</h1>
 <p className="text-ink-light mt-1">Shows, swap meets, meetups, and more</p>
 </div>
 <Link
 href="/community/events/create"
 className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
 >
 + Create Event
 </Link>
 </div>

 <EventBrowser events={events} typeLabels={EVENT_TYPE_LABELS} />
 </div>
 </div>
 );
}
