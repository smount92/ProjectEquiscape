import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import { getNotifications } from"@/app/actions/notifications";
import NotificationList from"@/components/NotificationList";

export const metadata = {
 title:"Notifications — Model Horse Hub",
 description:"Your latest activity notifications from the Model Horse Hub community.",
};

export const dynamic ="force-dynamic";

export default async function NotificationsPage() {
 const supabase = await createClient();
 const {
 data: { user },
 } = await supabase.auth.getUser();

 if (!user) redirect("/login");

 const notifications = await getNotifications(100);

 return (
 <div className="mx-auto max-w-[var(--max-width)] px-6 py-[0]">
 {/* Hero */}
 <div className="animate-fade-in-up mb-2 text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em]">
 <div className="mb-2-content text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em]">
 <h1>
 🔔 <span className="text-forest">Notifications</span>
 </h1>
 <p className="mb-2-subtitle text-[calc(2.2rem*var(--font-scale))] font-extrabold tracking-[-0.03em]">
 Stay updated on favorites, comments, ratings, and more.
 </p>
 </div>
 <div className="mt-8 flex justify-center gap-8">
 <div className="flex flex-col items-center">
 <span className="items-center-number flex flex-col">
 {notifications.filter((n) => !n.isRead).length}
 </span>
 <span className="items-center-label flex flex-col">Unread</span>
 </div>
 </div>
 </div>

 <NotificationList initialNotifications={notifications} />
 </div>
 );
}
