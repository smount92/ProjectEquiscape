import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import { getNotifications } from"@/app/actions/notifications";
import NotificationList from"@/components/NotificationList";
import ExplorerLayout from"@/components/layouts/ExplorerLayout";

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
 <ExplorerLayout
  title={<>🔔 <span className="text-forest">Notifications</span></>}
  description="Stay updated on favorites, comments, ratings, and more."
 >
  <div className="mb-6 flex items-baseline gap-2">
  <span className="text-2xl font-bold text-forest">
   {notifications.filter((n) => !n.isRead).length}
  </span>
  <span className="text-sm font-medium text-ink-light">Unread</span>
  </div>
  <NotificationList initialNotifications={notifications} />
 </ExplorerLayout>
 );
}
