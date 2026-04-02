"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

interface NotificationContextType {
    unreadNotifications: number;
    unreadMessages: number;
    /** Call after marking notifications as read to decrement the counter */
    refreshNotificationCount: () => Promise<void>;
    /** Call after reading inbox to reset message count */
    refreshMessageCount: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
    unreadNotifications: 0,
    unreadMessages: 0,
    refreshNotificationCount: async () => {},
    refreshMessageCount: async () => {},
});

export function useNotifications() {
    return useContext(NotificationContext);
}

export function NotificationProvider({
    children,
    initialUnreadNotifications = 0,
    initialUnreadMessages = 0,
}: {
    children: ReactNode;
    initialUnreadNotifications?: number;
    initialUnreadMessages?: number;
}) {
    const [unreadNotifications, setUnreadNotifications] = useState(initialUnreadNotifications);
    const [unreadMessages, setUnreadMessages] = useState(initialUnreadMessages);
    const lastFetchRef = useRef<number>(0);
    const supabase = createClient();

    const fetchNotificationCount = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { count } = await supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("is_read", false);
        setUnreadNotifications(count ?? 0);
    }, [supabase]);

    const fetchMessageCount = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: convos } = await supabase
            .from("conversations")
            .select("id")
            .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);

        if (!convos || convos.length === 0) {
            setUnreadMessages(0);
            return;
        }

        const convoIds = convos.map(c => c.id);
        const { count } = await supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .neq("sender_id", user.id)
            .eq("is_read", false)
            .in("conversation_id", convoIds);

        setUnreadMessages(count ?? 0);
    }, [supabase]);

    useEffect(() => {
        let cleanup: (() => void) | null = null;

        const setup = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Initial fetch
            fetchNotificationCount();
            fetchMessageCount();

            // Single channel for notification INSERTs/UPDATEs
            const notifChannel = supabase
                .channel(`global-notifications-${user.id}`)
                .on(
                    "postgres_changes",
                    { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
                    () => setUnreadNotifications(prev => prev + 1)
                )
                .on(
                    "postgres_changes",
                    { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
                    (payload) => {
                        if (payload.new && (payload.new as { is_read: boolean }).is_read) {
                            fetchNotificationCount(); // Re-fetch exact count after mark-read
                        }
                    }
                )
                .subscribe();

            // Single channel for incoming messages
            const msgChannel = supabase
                .channel(`global-inbox-${user.id}`)
                .on(
                    "postgres_changes",
                    { event: "INSERT", schema: "public", table: "messages" },
                    (payload) => {
                        const msg = payload.new as { sender_id: string };
                        if (msg.sender_id !== user.id) {
                            setUnreadMessages(prev => prev + 1);
                        }
                    }
                )
                .subscribe();

            // Visibility-based refresh with 30s cooldown
            const handleVisibility = () => {
                if (document.visibilityState === "visible") {
                    const now = Date.now();
                    if (now - lastFetchRef.current > 30_000) {
                        lastFetchRef.current = now;
                        fetchNotificationCount();
                        fetchMessageCount();
                    }
                }
            };
            document.addEventListener("visibilitychange", handleVisibility);

            cleanup = () => {
                supabase.removeChannel(notifChannel);
                supabase.removeChannel(msgChannel);
                document.removeEventListener("visibilitychange", handleVisibility);
            };
        };

        setup();
        return () => cleanup?.();
    }, [supabase, fetchNotificationCount, fetchMessageCount]);

    return (
        <NotificationContext.Provider
            value={{
                unreadNotifications,
                unreadMessages,
                refreshNotificationCount: fetchNotificationCount,
                refreshMessageCount: fetchMessageCount,
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
}
