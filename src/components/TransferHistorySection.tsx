import Link from "next/link";
import { getTransferHistory } from "@/app/actions/hoofprint";

export default async function TransferHistorySection() {
    const history = await getTransferHistory();
    if (history.length === 0) return null;

    return (
        <details className="mt-8" id="transfer-history">
            <summary className="hidden">
                📤 Transfer History
                <span className="transfer-history-count">{history.length}</span>
            </summary>
            <div className="grid grid-cols-[repeat(auto-fill, minmax(240px, 1fr))] gap-4 mt-2">
                {history.map((item) => (
                    <Link
                        key={item.id}
                        href={`/community/${item.horseId}`}
                        className="transfer-ghost-card hover:opacity-[0.85]"
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
                            <span className="transfer-ghost-name">
                                {item.horseName || "Unknown Horse"}
                            </span>
                            <span className="transfer-ghost-date">
                                Transferred {new Date(item.releasedAt).toLocaleDateString("en-US", {
                                    month: "short", day: "numeric", year: "numeric",
                                })}
                            </span>
                            {item.isPricePublic && item.salePrice && (
                                <span className="transfer-ghost-price">
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
