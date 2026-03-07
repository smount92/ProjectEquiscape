import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import MarkReadButton from "@/components/MarkReadButton";
import AdminReplyForm from "@/components/AdminReplyForm";
import FeatureHorseForm from "@/components/FeatureHorseForm";
import CreateShowForm from "@/components/CreateShowForm";

export const metadata = {
    title: "Admin Console — Model Horse Hub",
    description: "Founder's Command Center.",
};

export const dynamic = "force-dynamic";

interface ContactMessage {
    id: string;
    name: string;
    email: string;
    subject: string | null;
    message: string;
    is_read: boolean;
    created_at: string;
}

export default async function AdminPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // CRITICAL: Security gate — only ADMIN_EMAIL can access (case-insensitive)
    if (!user || user.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()) {
        redirect("/dashboard");
    }

    // Service role client to bypass RLS
    const supabaseAdmin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch metrics in parallel
    const [usersResult, horsesResult, unreadResult, messagesResult] =
        await Promise.all([
            // Total registered users
            supabaseAdmin.auth.admin.listUsers({ perPage: 1, page: 1 }),
            // Total horses
            supabaseAdmin
                .from("user_horses")
                .select("id", { count: "exact", head: true }),
            // Unread support messages
            supabaseAdmin
                .from("contact_messages")
                .select("id", { count: "exact", head: true })
                .eq("is_read", false),
            // All contact messages
            supabaseAdmin
                .from("contact_messages")
                .select("id, name, email, subject, message, is_read, created_at")
                .order("created_at", { ascending: false })
                .limit(100),
        ]);

    // listUsers returns total in a different way — use the users array length or total
    // The admin API returns { data: { users: [], total: number } }
    const totalUsers =
        (usersResult.data as unknown as { users: unknown[]; total?: number })
            ?.total ?? 0;
    const totalHorses = horsesResult.count ?? 0;
    const unreadMessages = unreadResult.count ?? 0;
    const messages = (messagesResult.data as ContactMessage[]) ?? [];

    function formatDate(dateStr: string): string {
        return new Date(dateStr).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    }

    return (
        <div className="page-container form-page">
            <div className="animate-fade-in-up">
                {/* Header */}
                <div className="shelf-header">
                    <div>
                        <h1>
                            <span className="text-gradient">⚡ Admin Console</span>
                        </h1>
                        <p
                            style={{
                                color: "var(--color-text-muted)",
                                marginTop: "var(--space-xs)",
                            }}
                        >
                            Founder&apos;s Command Center — Full system overview
                        </p>
                    </div>
                    <div className="admin-shield-badge">
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        Service Role Access
                    </div>
                </div>

                {/* Metrics Row */}
                <div className="admin-metrics-row">
                    <div className="admin-metric-card">
                        <div className="admin-metric-icon">👥</div>
                        <div className="admin-metric-value">{totalUsers}</div>
                        <div className="admin-metric-label">Registered Users</div>
                    </div>
                    <div className="admin-metric-card">
                        <div className="admin-metric-icon">🐴</div>
                        <div className="admin-metric-value">
                            {totalHorses.toLocaleString()}
                        </div>
                        <div className="admin-metric-label">Horses in Database</div>
                    </div>
                    <div className="admin-metric-card admin-metric-alert">
                        <div className="admin-metric-icon">📨</div>
                        <div className="admin-metric-value">{unreadMessages}</div>
                        <div className="admin-metric-label">Unread Messages</div>
                    </div>
                </div>

                {/* Mailbox */}
                <div className="admin-section">
                    <h2 className="admin-section-title">
                        📬 Support Mailbox
                        <span className="admin-section-count">
                            {messages.length} message{messages.length !== 1 ? "s" : ""}
                        </span>
                    </h2>

                    {messages.length === 0 ? (
                        <div className="card shelf-empty">
                            <div className="shelf-empty-icon">📬</div>
                            <h2>No Messages Yet</h2>
                            <p>Contact form submissions will appear here.</p>
                        </div>
                    ) : (
                        <div className="admin-mailbox">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`admin-message ${msg.is_read ? "admin-message-read" : "admin-message-unread"}`}
                                >
                                    <div className="admin-message-header">
                                        <div className="admin-message-sender">
                                            <span className="admin-message-name">{msg.name}</span>
                                            <a
                                                href={`mailto:${msg.email}`}
                                                className="admin-message-email"
                                            >
                                                {msg.email}
                                            </a>
                                        </div>
                                        <div className="admin-message-actions">
                                            <span className="admin-message-date">
                                                {formatDate(msg.created_at)}
                                            </span>
                                        </div>
                                    </div>
                                    {msg.subject && (
                                        <div className="admin-message-subject">
                                            {!msg.is_read && <span className="admin-unread-dot" />}
                                            {msg.subject}
                                        </div>
                                    )}
                                    <div className="admin-message-body">{msg.message}</div>
                                    <div className="admin-message-footer">
                                        <AdminReplyForm
                                            messageId={msg.id}
                                            recipientEmail={msg.email}
                                            recipientName={msg.name}
                                            originalSubject={msg.subject}
                                            originalMessage={msg.message}
                                        />
                                        <MarkReadButton messageId={msg.id} isRead={msg.is_read} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Feature a Horse */}
                <div className="admin-section">
                    <h2 className="admin-section-title">
                        🌟 Feature a Horse
                        <span className="admin-section-count">Horse of the Week</span>
                    </h2>
                    <FeatureHorseForm />
                </div>

                {/* Create Photo Show */}
                <div className="admin-section">
                    <h2 className="admin-section-title">
                        📸 Create Photo Show
                        <span className="admin-section-count">Virtual Shows</span>
                    </h2>
                    <CreateShowForm />
                </div>
            </div>
        </div>
    );
}
