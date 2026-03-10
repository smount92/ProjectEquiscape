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
        <div className="page-container">
            <div className="page-content">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-md)", marginBottom: "var(--space-xl)" }}>
                    <div>
                        <h1>📅 Events</h1>
                        <p style={{ color: "var(--color-text-muted)", marginTop: "var(--space-xs)" }}>
                            Shows, swap meets, meetups, and more
                        </p>
                    </div>
                    <Link href="/community/events/create" className="btn btn-primary">+ Create Event</Link>
                </div>

                <EventBrowser events={events} typeLabels={EVENT_TYPE_LABELS} />
            </div>
        </div>
    );
}
