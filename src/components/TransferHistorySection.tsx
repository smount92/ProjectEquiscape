import Link from "next/link";
import { getTransferHistory } from "@/app/actions/hoofprint";

export default async function TransferHistorySection() {
    const history = await getTransferHistory();
    if (history.length === 0) return null;

    return (
        <details className="mt-8" id="transfer-history">
            <summary className="hidden">
                📤 Transfer History
                <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] py-[0] px-[6px] rounded-full bg-[rgba(0,0,0,0.06)] text-[calc(0.7rem*var(--font-scale))] font-semibold">{history.length}</span>
            </summary>
            <div className="grid grid-cols-[repeat(auto-fill, minmax(240px, 1fr))] gap-4 mt-2">
                {history.map((item) => (
                    <Link
                        key={item.id}
                        href={`/community/${item.horseId}`}
                        className="transfer-ghost-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all hover:opacity-[0.85]"
                    >
                        {item.horseThumbnail ? (
                            <img
                                src={item.horseThumbnail}
                                alt={item.horseName || "Transferred horse"}
                                className="transfer-ghost-thumb"
                            />
                        ) : (
                            <div className="transfer-ghost-thumb transfer-ghost-placeholder">
                                🐴
                            </div>
                        )}
                        <div className="flex flex-col gap-[2px] min-w-0">
                            <span className="font-bold text-[calc(0.85rem*var(--font-scale))] whitespace-nowrap overflow-hidden text-ellipsis">
                                {item.horseName || "Unknown Horse"}
                            </span>
                            <span className="text-[calc(0.7rem*var(--font-scale))] text-muted">
                                Transferred {new Date(item.releasedAt).toLocaleDateString("en-US", {
                                    month: "short", day: "numeric", year: "numeric",
                                })}
                            </span>
                            {item.isPricePublic && item.salePrice && (
                                <span className="text-[calc(0.7rem*var(--font-scale))] text-[var(--color-accent-warm)] font-semibold">
                                    Sale: ${item.salePrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                </span>
                            )}
                        </div>
                    </Link>
                ))}
            </div>
        </details>
    );
}
