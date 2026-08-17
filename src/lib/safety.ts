// ============================================================
// Shared Safety Utilities
// Risky payment pattern detection for commerce guardrails
// ============================================================

/**
 * Regex to detect mentions of risky payment methods.
 * Used in ChatThread and MakeOfferModal to warn users about
 * off-platform payment discussions that bypass Safe-Trade.
 */
export const RISKY_PAYMENT_REGEX = /(venmo|zelle|paypal\s*f\s*(&|and)\s*f|friends\s*and\s*family|cash\s*app|wire\s*transfer)/i;

/**
 * Warning message shown when risky payment terms are detected.
 *
 * Honest version (audit truth-pass #26): MHH is NOT a payment
 * processor and Safe-Trade holds no funds — the old copy ("use the
 * Safe-Trade system for all payments") implied an escrow/buyer
 * protection product that does not exist, contradicting the FAQ and
 * Terms, which correctly say payments happen directly between
 * traders. Safe-Trade's real value is the tracked handshake:
 * recorded steps, provenance transfer, and reviewable transactions.
 */
export const RISKY_PAYMENT_WARNING =
    "⚠️ Heads up: payments happen directly between you and the other trader — Model Horse Hub never holds funds. PayPal Goods & Services offers purchase protection; Venmo, Zelle, and PayPal F&F do not. Keep the trade steps in Safe-Trade so the sale is tracked and reviewable.";
