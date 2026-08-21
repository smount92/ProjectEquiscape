import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getNotifications } from "@/app/actions/notifications";
import NotificationList from "@/components/NotificationList";
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import PageMasthead from "@/components/layouts/PageMasthead";

/**
 * /notifications — the activity ledger.
 *
 * frameless + noHeader: the masthead below is this page's header, and the
 * list brings its own ledger leaf, so the layout must not frame it twice.
 */

export const metadata: Metadata = {
    title: "Notifications",
    description: "Show results, offers, comments and transfers — everything that happened to you.",
    robots: { index: false, follow: false },
};

export default async function NotificationsPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login?redirectTo=%2Fnotifications");

    const notifications = await getNotifications(100);
    const unread = notifications.filter((n) => !n.isRead).length;

    return (
        <ExplorerLayout noHeader frameless>
            <PageMasthead
                compact
                icon="🔔"
                title="Notifications"
                subtitle={
                    notifications.length === 0
                        ? "Nothing on the record yet"
                        : unread === 0
                          ? `${notifications.length} on the record · all read`
                          : `${unread} unread of ${notifications.length}`
                }
                backHref="/dashboard"
                backLabel="Digital Stable"
            />

            <div className="mx-auto max-w-[820px]">
                <NotificationList initialNotifications={notifications} />
            </div>
        </ExplorerLayout>
    );
}
