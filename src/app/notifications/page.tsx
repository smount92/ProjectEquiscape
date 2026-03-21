import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getNotifications } from "@/app/actions/notifications";
import NotificationList from "@/components/NotificationList";

export const metadata = {
    title: "Notifications — Model Horse Hub",
    description: "Your latest activity notifications from the Model Horse Hub community.",
};

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const notifications = await getNotifications(100);

    return (
        <div className="max-w-[var(--max-width)] mx-auto py-[0] px-6">
            {/* Hero */}
            <div className="text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em] mb-2 animate-fade-in-up">
                <div className="text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em] mb-2-content">
                    <h1>
                        🔔 <span className="text-forest">Notifications</span>
                    </h1>
                    <p className="text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em] mb-2-subtitle">
                        Stay updated on favorites, comments, ratings, and more.
                    </p>
                </div>
                <div className="flex justify-center gap-8 mt-8">
                    <div className="flex flex-col items-center">
                        <span className="flex flex-col items-center-number">
                            {notifications.filter((n) => !n.isRead).length}
                        </span>
                        <span className="flex flex-col items-center-label">Unread</span>
                    </div>
                </div>
            </div>

            <NotificationList initialNotifications={notifications} />
        </div>
    );
}
