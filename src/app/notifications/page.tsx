import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import { getNotifications } from"@/app/actions/notifications";
import NotificationList from"@/components/NotificationList";

export const metadata = {
 title:"Notifications — Model Horse Hub",
 description:"Your latest activity notifications from the Model Horse Hub community.",
};


export default async function NotificationsPage() {
 const supabase = await createClient();
 const {
 data: { user },
 } = await supabase.auth.getUser();

 if (!user) redirect("/login");

 const notifications = await getNotifications(100);

 return (
 <div className="mx-auto max-w-[var(--max-width)] px-6 py-8">
 {/* Hero */}
 <div className="animate-fade-in-up mb-8">
 <h1 className="text-2xl font-bold tracking-tight">
 🔔 <span className="text-forest">Notifications</span>
 </h1>
 <p className="mt-2 max-w-xl text-base text-ink-light">
 Stay updated on favorites, comments, ratings, and more.
 </p>
 <div className="mt-6 flex items-baseline gap-2">
 <span className="text-2xl font-bold text-forest">
 {notifications.filter((n) => !n.isRead).length}
 </span>
 <span className="text-sm font-medium text-ink-light">Unread</span>
 </div>
 </div>

 <NotificationList initialNotifications={notifications} />
 </div>
 );
}
