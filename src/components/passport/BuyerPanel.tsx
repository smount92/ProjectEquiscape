/**
 * Passport v2 buyer panel (NEXT_PUBLIC_PASSPORT_V2) — the ONE honest
 * commerce surface on a For Sale / Open to Offers passport. Bordered
 * brass panel on lit paper:
 *
 *   row 1  trade-status rubber stamp + the asking price, large
 *   row 2  condition pill + its plain-English gloss (conditionGrades)
 *   row 3  the record line (recordChipLabel / verifiedChipLabel) +
 *          qualification-card count "(transfer with the horse)"
 *   row 4  "✉️ Ask a question" + "💰 Make Offer" — MessageSellerButton
 *          COMPOSED, not forked; the anon variant renders login-CTA
 *          equivalents with redirectTo (AnonPassport's pattern)
 *   row 5  trust line — each phrase anchors to its passport section
 *
 * The market ESTIMATE (MarketValueBadge) deliberately lives OUTSIDE
 * this panel — asking price and estimate must never read as the same
 * number.
 *
 * Lit paper stays cream under Lamplight: PARCHMENT_INK pins the ink
 * tokens day-side for the whole subtree (same trick as the ledger
 * card), so stamps, pills and buttons keep daylight contrast.
 */

import Link from "next/link";
import MessageSellerButton from "@/components/MessageSellerButton";
import { Button } from "@/components/ui/button";
import { getConditionGrade, conditionToneVar } from "@/lib/conditionGrades";
import {
    recordChipLabel,
    verifiedChipLabel,
    type HorseRecordSummary,
} from "@/lib/market/recordSummary";
import { PARCHMENT_INK } from "@/lib/theme/parchment";

export interface BuyerPanelProps {
    horseId: string;
    horseName: string;
    tradeStatus: "For Sale" | "Open to Offers";
    listingPrice: number | null;
    conditionGrade: string | null;
    /** Aggregate record (null / total 0 → the record line hides itself). */
    recordSummary: HorseRecordSummary | null;
    /** Live MHH qualification cards on the horse (0 → no cards phrase). */
    cardsCount: number;
    /** Anon variant: login-CTA buttons with this redirect target. */
    variant: "member" | "anon";
    loginHref?: string;
    /** Member variant: the composed contact actions need the seller. */
    sellerId?: string | null;
    /** The owner viewing their own listing gets no contact buttons. */
    isOwner?: boolean;
    /**
     * Trust-line anchor for "Hoofprint provenance" — "#passport-hoofprint"
     * on the member page; the anon page has no inline hoofprint section,
     * so it points at the public /community/[id]/hoofprint report.
     */
    hoofprintHref: string;
}

/** "$1,250" / "Open to offers" — locale-formatted, never raw. */
export function formatAskingPrice(listingPrice: number | null): string {
    return listingPrice != null ? `$${Number(listingPrice).toLocaleString("en-US")}` : "Open to offers";
}

export default function BuyerPanel({
    horseId,
    horseName,
    tradeStatus,
    listingPrice,
    conditionGrade,
    recordSummary,
    cardsCount,
    variant,
    loginHref,
    sellerId,
    isOwner = false,
    hoofprintHref,
}: BuyerPanelProps) {
    const grade = getConditionGrade(conditionGrade);
    const toneVar = conditionToneVar(conditionGrade);
    const recordLabel = recordChipLabel(recordSummary);
    const verifiedLabel = verifiedChipLabel(recordSummary);
    const hasRecordRow = recordLabel !== null || cardsCount > 0;

    return (
        <section
            aria-label={`${tradeStatus} — buyer panel`}
            data-testid="buyer-panel"
            className="flex flex-col gap-3 rounded-xl border-2 p-4 shadow-md"
            style={{
                ...PARCHMENT_INK,
                background: "var(--paper-lit, #FEFCF8)",
                borderColor: "var(--brass, #B08D3E)",
                boxShadow:
                    "inset 0 0 0 1px color-mix(in srgb, var(--brass-hi, #E8C878) 40%, transparent), 0 2px 8px rgba(46, 30, 18, 0.25)",
            }}
        >
            {/* Row 1 — status stamp + the asking price */}
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className={tradeStatus === "For Sale" ? "stamp stamp-red" : "stamp"}>{tradeStatus}</span>
                <span
                    data-testid="buyer-panel-price"
                    className={
                        listingPrice != null
                            ? "font-serif text-3xl font-bold text-foreground"
                            : "font-serif text-2xl font-bold text-foreground"
                    }
                >
                    {formatAskingPrice(listingPrice)}
                </span>
            </div>

            {/* Row 2 — condition pill + its honest gloss */}
            {conditionGrade && (
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1" data-testid="buyer-panel-condition">
                    <span
                        className="inline-flex items-center rounded-full border px-2.5 py-[2px] text-sm font-semibold"
                        style={{
                            color: toneVar,
                            borderColor: `color-mix(in srgb, ${toneVar} 45%, transparent)`,
                            background: `color-mix(in srgb, ${toneVar} 10%, transparent)`,
                        }}
                    >
                        {grade?.label ?? conditionGrade}
                    </span>
                    {grade?.gloss && <span className="text-sm text-secondary-foreground">{grade.gloss}</span>}
                </div>
            )}

            {/* Row 3 — the record line (hides itself with nothing to say) */}
            {hasRecordRow && (
                <div
                    className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-secondary-foreground"
                    data-testid="buyer-panel-record"
                >
                    {recordLabel && (
                        <span className="font-semibold text-foreground">
                            <span aria-hidden="true">🏆</span> {recordLabel}
                        </span>
                    )}
                    {verifiedLabel && (
                        <span className="inline-flex items-center gap-1 rounded-sm bg-success/15 px-2 py-[1px] text-xs font-bold text-success">
                            ✅ {verifiedLabel}
                        </span>
                    )}
                    {cardsCount > 0 && (
                        <span>
                            <span aria-hidden="true">🎫</span> {cardsCount} qualification card
                            {cardsCount === 1 ? "" : "s"}{" "}
                            <span className="text-muted-foreground">(transfer with the horse)</span>
                        </span>
                    )}
                </div>
            )}

            {/* Row 4 — contact actions. Member: MessageSellerButton's split
                actions composed as-is. Anon: login-CTA equivalents. Owners
                get no buttons — you can't make yourself an offer. */}
            {variant === "member" && !isOwner && sellerId && (
                <div className="flex flex-wrap items-center gap-2" data-testid="buyer-panel-actions">
                    <MessageSellerButton
                        sellerId={sellerId}
                        horseId={horseId}
                        horseName={horseName}
                        tradeStatus={tradeStatus}
                        askingPrice={listingPrice}
                    />
                </div>
            )}
            {variant === "anon" && loginHref && (
                <div className="flex flex-col gap-1.5" data-testid="buyer-panel-actions">
                    <div className="flex flex-wrap items-center gap-2">
                        <Button asChild variant="outline">
                            <Link href={loginHref}>✉️ Ask a question</Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link href={loginHref}>💰 Make Offer</Link>
                        </Button>
                    </div>
                    <p className="m-0 text-xs text-muted-foreground">
                        Log in or create a free account to contact the seller.
                    </p>
                </div>
            )}

            {/* Row 5 — trust line: each phrase anchors to its section */}
            <div
                className="border-t pt-2 text-xs text-secondary-foreground"
                style={{ borderColor: "color-mix(in srgb, var(--brass, #B08D3E) 35%, transparent)" }}
                data-testid="buyer-panel-trust"
            >
                <span aria-hidden="true">🛡️</span>{" "}
                <a href={hoofprintHref} className="text-forest underline decoration-1 underline-offset-2">
                    Hoofprint provenance
                </a>
                {" · "}
                <a href="#passport-photos" className="text-forest underline decoration-1 underline-offset-2">
                    condition photos below
                </a>
                {" · "}
                <a href="#passport-show-record" className="text-forest underline decoration-1 underline-offset-2">
                    verified show record
                </a>
            </div>
        </section>
    );
}
