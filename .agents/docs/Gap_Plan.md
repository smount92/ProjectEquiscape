@Architect Please analyze the following architectural directives for "Phase 6.5: Deep Polish & Hardening" and generate detailed step-by-step Developer Workflows for each.

DIRECTIVE 1: COMMERCE STATE MACHINE ESCAPE HATCHES
- Update `src/app/actions/transactions.ts`. 
- Create a `cancelTransaction(transactionId)` action accessible to the Seller when a transaction is in `pending_payment` (e.g., buyer ghosted). This action must set the transaction status to `cancelled`, revert the horse's `trade_status` from "Pending Sale" back to its previous state, and notify the buyer.
- Update `respondToOffer('accept')`: When an offer is accepted, automatically update all other `offer_made` transactions for that specific `horse_id` to `cancelled` and send notifications to the losing buyers.
- Update `OfferCard.tsx` to render a "Cancel / Dispute" button for the seller.

DIRECTIVE 2: BLUE BOOK INTEGRITY (FINISH TYPE SKEW)
- Update Migration `055_market_price_guide.sql`.
- Update the `mv_market_prices` materialized view to `GROUP BY h.catalog_id, h.finish_type`. An OF plastic model and an Artist Custom on the same mold must have separate price tracking.
- Update the `/market` UI and `searchMarketPrices` action to reflect and filter by this split.

DIRECTIVE 3: CRYPTOGRAPHIC PIN GENERATION
- In `src/app/actions/parked-export.ts` and `src/app/actions/hoofprint.ts`, replace the `Math.random()` implementation in `generatePin()` and `generateCode()` with Node's native `crypto.randomInt()` to ensure secure, unpredictable claim codes.

DIRECTIVE 4: HOBBY UX & SUPER-COLLECTOR OOM PREVENTION
- Add 'Body Quality' to the `CONDITION_GRADES` array across the application.
- Update the Insurance Report generation flow. Add a UI step requiring the user to select a specific `Collection` to generate a report for (rather than the entire stable at once) to prevent browser Out-Of-Memory crashes on herds > 200 models.

DIRECTIVE 5: TYPE SAFETY
- Execute `npx supabase gen types typescript` and replace the manual interfaces in `src/lib/types/database.ts` with the generated Supabase types.