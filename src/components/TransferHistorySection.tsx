import Link from "next/link";
import { getTransferHistory } from "@/app/actions/hoofprint";

export default async function TransferHistorySection() {
    const history = await getTransferHistory();
    if (history.length === 0) return null;

    return (
        <details className="transfer-history-section" id="transfer-history">
            <summary className="transfer-history-toggle">
                📤 Transfer History
                <span className="transfer-history-count">{history.length}</span>
            </summary>
            <div className="transfer-ghost-grid">
                {history.map((item) => (
                    <Link
                        key={item.id}
                        href={`/community/${item.horseId}`}
                        className="transfer-ghost-card"
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
                        <div className="transfer-ghost-info">
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
