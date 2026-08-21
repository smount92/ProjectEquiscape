import Link from "next/link";
import { redirect } from "next/navigation";

import { getEvents } from "@/app/actions/events";
import { createClient } from "@/lib/supabase/server";
import EventsIndex from "@/components/events/EventsIndex";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";
import { Button } from "@/components/ui/button";

export const metadata = {
    title: "Events",
    description:
        "What the model horse hobby is doing off-platform — external shows, meetups, club days, swap meets and studio openings.",
};

export default async function EventsPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    // Upcoming is the page; the archive is a footnote, so it's capped.
    const [upcoming, past] = await Promise.all([
        getEvents({ upcoming: true }),
        getEvents({ past: true, limit: 20 }),
    ]);

    return (
        // frameless: the board files itself onto ledger month shelves,
        // so the archetype's own ledger sheet would double-frame them.
        <ExplorerLayout noHeader frameless>
            <div className="animate-fade-in-up mx-auto max-w-[900px]">
                <PageMasthead
                    icon="📅"
                    title="Events"
                    subtitle="Out in the hobby — shows, meetups, club days"
                    actions={
                        <Button asChild>
                            <Link href="/community/events/create">+ Post Event</Link>
                        </Button>
                    }
                />
                <EventsIndex upcoming={upcoming} past={past} />
            </div>
        </ExplorerLayout>
    );
}
