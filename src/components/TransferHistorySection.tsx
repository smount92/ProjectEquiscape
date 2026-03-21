import Link from "next/link";
import { getTransferHistory } from "@/app/actions/hoofprint";

export default async function TransferHistorySection() {
    const history = await getTransferHistory();
    if (history.length === 0) return null;

    return (
        <details className="mt-8" id="transfer-history">
            <summary className="hidden">
                📤 Transfer History
                <span className="inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-[rgba(0,0,0,0.06)] px-[6px] py-[0] text-[calc(0.7rem*var(--font-scale))] font-semibold">
                    {history.length}
                </span>
            </summary>
            <div className="grid-cols-[repeat(auto-fill, minmax(240px, 1fr))] mt-2 grid gap-4">
                {history.map((item) => (
                    <Link
                        key={item.id}
                        href={`/community/${item.horseId}`}
                        className="transfer-ghost-bg-card border-edge rounded-lg border p-12 shadow-md transition-all hover:opacity-[0.85] max-[480px]:rounded-[var(--radius-md)]"
                    >
                        {item.horseThumbnail ? (
                            <img
                                src={item.horseThumbnail}
                                alt={item.horseName || "Transferred horse"}
                                className="transfer-ghost-thumb"
                            />
                        ) : (
                            <div className="transfer-ghost-thumb transfer-ghost-placeholder">🐴</div>
                        )}
                        <div className="flex min-w-0 flex-col gap-[2px]">
                            <span className="overflow-hidden text-[calc(0.85rem*var(--font-scale))] font-bold text-ellipsis whitespace-nowrap">
                                {item.horseName || "Unknown Horse"}
                            </span>
                            <span className="text-muted text-[calc(0.7rem*var(--font-scale))]">
                                Transferred{" "}
                                {new Date(item.releasedAt).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                })}
                            </span>
                            {item.isPricePublic && item.salePrice && (
                                <span className="text-[calc(0.7rem*var(--font-scale))] font-semibold text-[var(--color-accent-warm)]">
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
