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
 */
export const RISKY_PAYMENT_WARNING =
    "⚠️ For your protection, please use the Safe-Trade system for all payments. Off-platform payments like Venmo, Zelle, or PayPal F&F have no buyer protection.";
