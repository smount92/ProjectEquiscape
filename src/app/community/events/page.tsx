import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getEvents } from "@/app/actions/events";
import EventBrowser from "@/components/EventBrowser";

import { EVENT_TYPE_LABELS } from "@/lib/constants/events";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Events — Model Horse Hub",
    description: "Discover shows, swap meets, meetups, and more in the model horse community.",
};

export default async function EventsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const events = await getEvents({ upcoming: true });

    return (
        <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6">
            <div className="page-content">
                <div className="justify-between gap-4 mb-8" style={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}>
                    <div>
                        <h1>📅 Events</h1>
                        <p className="text-muted mt-1" >
                            Shows, swap meets, meetups, and more
                        </p>
                    </div>
                    <Link href="/community/events/create" className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm">+ Create Event</Link>
                </div>

                <EventBrowser events={events} typeLabels={EVENT_TYPE_LABELS} />
            </div>
        </div>
    );
}
