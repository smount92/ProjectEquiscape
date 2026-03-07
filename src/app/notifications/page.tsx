import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getNotifications } from "@/app/actions/notifications";
import NotificationList from "@/components/NotificationList";

export const metadata = {
    title: "Notifications — Model Horse Hub",
    description: "Your latest activity notifications from the Model Horse Hub community.",
};

export default async function NotificationsPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const notifications = await getNotifications(100);

    return (
        <div className="page-container">
            {/* Hero */}
            <div className="community-hero animate-fade-in-up">
                <div className="community-hero-content">
                    <h1>
                        🔔 <span className="text-gradient">Notifications</span>
                    </h1>
                    <p className="community-hero-subtitle">
                        Stay updated on favorites, comments, ratings, and more.
                    </p>
                </div>
                <div className="community-stats">
                    <div className="community-stat">
                        <span className="community-stat-number">
                            {notifications.filter((n) => !n.isRead).length}
                        </span>
                        <span className="community-stat-label">Unread</span>
                    </div>
                </div>
            </div>

            <NotificationList initialNotifications={notifications} />
        </div>
    );
}
