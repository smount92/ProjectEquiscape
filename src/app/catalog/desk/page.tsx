import { notFound } from "next/navigation";
import { registryRoleOf } from "@/lib/auth";
import { getQueue, type QueueTab } from "@/app/actions/registry-desk";
import QueueList from "@/components/desk/QueueList";

const TABS: QueueTab[] = ["corrections", "additions", "duplicates", "auto_applied", "second_looks"];

/** The Queue: members' suggestions waiting for a decision. */
export default async function DeskQueuePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
    const who = await registryRoleOf();
    if (!who) notFound();
    const { tab: asked } = await searchParams;
    const tab = TABS.includes(asked as QueueTab) ? (asked as QueueTab) : "corrections";
    const r = await getQueue(tab);
    if (!r.success) {
        return (
            <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {r.error}
            </p>
        );
    }
    return <QueueList queue={r.queue} role={who.role} />;
}
