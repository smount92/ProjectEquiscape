import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Trophy } from "lucide-react";

import ExplorerLayout from "@/components/layouts/ExplorerLayout";
import { Button } from "@/components/ui/button";
import InboxRow from "@/components/inbox/InboxRow";
import { loadInbox } from "@/app/inbox/reads";

export const metadata = {
    title: "Inbox",
    description: "Your private conversations with other collectors.",
};

/**
 * THE INBOX.
 *
 * What this replaces: a page that loaded EVERY message the user had
 * ever received, with no limit, reduced it in JS for previews and
 * unread counts, and then built an `.or()` filter with one
 * `metadata->>conversation_id.eq.<uuid>` clause per conversation against
 * the transactions table — a URL-length bomb over a full jsonb scan.
 *
 * What it does now: reads the denormalised last-message columns
 * migration 173 maintains by trigger, one bounded unread query, and one
 * indexed lookup for deal state. See src/app/inbox/reads.ts.
 *
 * The list itself distinguishes deals from chats at a glance, which was
 * the second complaint: a $400 sale in progress and someone asking
 * which mold a horse is looked identical.
 */
export default async function InboxPage({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string }>;
}) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { tab } = await searchParams;
    const view = tab === "deals" || tab === "archived" ? tab : "all";

    const { threads, support } = await loadInbox(user.id);

    const live = threads.filter((t) => !t.archived);
    const visible =
        view === "deals"
            ? live.filter((t) => t.dealKind !== null || t.stage !== null)
            : view === "archived"
              ? threads.filter((t) => t.archived)
              : live;

    const dealCount = live.filter((t) => t.dealKind !== null || t.stage !== null).length;
    const archivedCount = threads.filter((t) => t.archived).length;
    const unreadTotal = live.reduce((s, t) => s + t.unreadCount, 0);

    return (
        <ExplorerLayout
            title={<span className="text-forest">Inbox</span>}
            description={
                threads.length === 0
                    ? "Your private conversations"
                    : `${live.length} thread${live.length === 1 ? "" : "s"}${
                          unreadTotal > 0 ? ` · ${unreadTotal} unread` : ""
                      }`
            }
            headerActions={
                <Button asChild>
                    <Link href="/community" id="browse-showring">
                        <Trophy className="h-4 w-4" /> Browse Show Ring
                    </Link>
                </Button>
            }
        >
            {/* Tabs — deals and chats told apart, which they never were */}
            {(dealCount > 0 || archivedCount > 0) && support.participants && (
                <div className="border-input mb-4 flex flex-wrap gap-2 border-b pb-3">
                    <Tab href="/inbox" active={view === "all"}>
                        All ({live.length})
                    </Tab>
                    <Tab href="/inbox?tab=deals" active={view === "deals"}>
                        Deals ({dealCount})
                    </Tab>
                    {archivedCount > 0 && (
                        <Tab href="/inbox?tab=archived" active={view === "archived"}>
                            Archived ({archivedCount})
                        </Tab>
                    )}
                </div>
            )}

            {visible.length === 0 ? (
                <div className="border-input bg-card rounded-lg border p-12 text-center shadow-md">
                    <div className="mb-4 text-[3rem]">✉️</div>
                    <h3 className="mb-2 font-serif text-xl font-bold">
                        {view === "archived"
                            ? "Nothing archived"
                            : view === "deals"
                              ? "No deals in progress"
                              : "Your inbox is empty"}
                    </h3>
                    <p className="text-secondary-foreground mx-auto max-w-[440px]">
                        {view === "all"
                            ? "Browse the Show Ring and message a seller about a model you're interested in — every deal you strike gets tracked here."
                            : "Threads you archive or deals you strike will appear here."}
                    </p>
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                        <Button asChild variant="outline" size="wide">
                            <Link href="/community">Browse the Show Ring →</Link>
                        </Button>
                        <Button asChild variant="outline" size="wide">
                            <Link href="/market">Visit the marketplace →</Link>
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="bg-card/80 border-input animate-fade-in-up flex flex-col overflow-hidden rounded-lg border backdrop-blur-md">
                    {visible.map((thread) => (
                        <InboxRow key={thread.id} thread={thread} muteEnabled={support.participants} />
                    ))}
                </div>
            )}

            {!support.conversationDeal && threads.length > 0 && (
                <p className="text-muted-foreground mt-4 text-center text-xs">
                    Deal tracking, agreed terms and payment plans arrive with the next database
                    update.
                </p>
            )}
        </ExplorerLayout>
    );
}

function Tab({
    href,
    active,
    children,
}: {
    href: string;
    active: boolean;
    children: React.ReactNode;
}) {
    return (
        <Link
            href={href}
            className={`rounded-full border px-3.5 py-1 text-xs font-semibold no-underline transition-colors ${
                active
                    ? "border-forest/40 bg-forest/10 text-forest"
                    : "border-input bg-card text-muted-foreground hover:text-foreground"
            }`}
        >
            {children}
        </Link>
    );
}
