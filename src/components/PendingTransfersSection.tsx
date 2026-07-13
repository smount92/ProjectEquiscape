import { getMyPendingTransfers } from "@/app/actions/hoofprint";
import RevokeTransferButton from "@/components/RevokeTransferButton";

/** Sidebar card listing the current user's open outgoing transfer codes, with a Revoke action. */
export default async function PendingTransfersSection() {
    const transfers = await getMyPendingTransfers();
    if (transfers.length === 0) return null;

    return (
        <div className="bg-card border-input rounded-lg border p-6 shadow-md transition-all" id="pending-transfers">
            <h3 className="mb-4 flex items-center gap-2 text-xs font-semibold tracking-widest text-secondary-foreground uppercase">
                📤 Pending Transfers
            </h3>
            <div className="flex flex-col gap-2">
                {transfers.map((t) => (
                    <div
                        key={t.id}
                        className="flex items-center justify-between gap-3 rounded-md bg-black/[0.02] px-3 py-2"
                    >
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{t.horseName}</p>
                            <p className="text-muted-foreground text-xs">
                                <span className="font-mono tracking-widest">{t.transferCode}</span>
                                {" · "}
                                {new Date(t.createdAt).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                })}
                            </p>
                        </div>
                        <RevokeTransferButton transferId={t.id} horseName={t.horseName} />
                    </div>
                ))}
            </div>
        </div>
    );
}
