# Model Horse Hub (MHH) — Infrastructure Hardening Blueprint

> **Target Audience:** Antigravity Architect Agent (Verification/SQL) & Developer Agent (Implementation)
> **Status:** 🛑 FEATURE FREEZE. No new product features until this blueprint is implemented.
> **Objective:** Refactor V1.0 to survive Vercel serverless constraints, prevent data loss during network failures, secure against bot abuse, and preserve historical provenance at scale. NO SHORTCUTS.
> **Tech Stack:** Next.js 16.1 (App Router), React 19, Supabase (PostgreSQL 15 + Storage), Vercel Serverless.

## 🚨 GLOBAL AGENT DIRECTIVES
1. **Migrations First:** The Architect Agent MUST generate and validate all Supabase SQL migrations (RLS policies, RPC functions, schema alterations) before the Developer Agent touches Next.js code.
2. **Never move files in Storage during DB transactions:** Storage operations are non-transactional. File paths must be immutable. Access must be controlled dynamically via Postgres RLS.
3. **Respect Serverless Limits:** Assume a strict 4.5MB payload maximum and a 10-second execution timeout for all Server Actions. Offload heavy compute to the client browser.
4. **No In-Memory Security:** Serverless functions are stateless and edge-distributed. All rate-limiting must be Database-backed.
5. **Preserve Provenance:** "Hard deletes" of users break the historical record of physical objects. You must use Tombstones (Soft Deletes).

---

## 🏗️ EPIC 1: Data Resilience & Provenance Preservation

### Task 1.1: Immutable Storage Paths (Fixing the Transfer Race Condition)
**Context:** Moving images between `{user_id}/{horse_id}` folders during a Hoofprint transfer will permanently orphan data if the DB transaction succeeds but the network file-move fails.
* **Architect Task (SQL):** Write a dynamic Supabase Storage RLS policy for the `horse-images` bucket that extracts the `horse_id` from the file path `horses/{horse_id}/{filename}.webp` and joins it to `public.user_horses`.
  ```sql
  -- Example: Allow insert/update/delete ONLY if the requester is the current owner
  CREATE POLICY "Dynamic Horse Image Write" ON storage.objects FOR ALL USING (
    bucket_id = 'horse-images' AND 
    EXISTS (
      SELECT 1 FROM public.user_horses 
      WHERE id = (split_part(name, '/', 2))::uuid 
      AND owner_id = auth.uid()
    )
  );


Developer Task (TypeScript):
Update upload paths in horse.ts and art-studio.ts to the global horses/{horse_id}/{timestamp}.webp.
CRITICAL: Delete all supabase.storage.move() logic entirely from claimTransfer() in hoofprint.ts. The DB ownership swap instantly grants the new owner storage access via the new RLS policy. No files need to move.
Task 1.2: The "Tombstone" Account Deletion Pattern
Context: ON DELETE CASCADE destroys commission histories, show records, and transfer histories if a user deletes their account.
Architect Task (SQL):
Add account_status VARCHAR(20) DEFAULT 'active' and deleted_at TIMESTAMPTZ to public.users.
Find all foreign keys pointing to users(id) in horse_timeline, commissions, and show_records. Alter them to ON DELETE SET NULL.
Write a Postgres RPC soft_delete_account(target_uid UUID) that: Sets account_status = 'deleted', anonymizes alias_name = '[Deleted Collector]', and clears bio and avatar_url.
Developer Task (TypeScript): Update the account deletion Server Action in settings.ts to call soft_delete_account via RPC instead of supabase.auth.admin.deleteUser(). Update public UI queries (like /discover) to append .eq('users.account_status', 'active').
⚡ EPIC 2: Serverless Memory & Execution Hardening
Task 2.1: Defuse the PDF Payload Bomb (Fixes OOM & 413 Errors)
Context: Converting 200 images to Base64 in getInsuranceReportData() exceeds Vercel's 4.5MB payload limit and crashes mobile browsers out-of-memory.
Architect Task: Configure CORS on the horse-images Supabase bucket to allow GET requests from https://modelhorsehub.com and http://localhost:3000.
Developer Task:
Refactor getInsuranceReportData() in insurance-report.ts. Remove Base64 conversion entirely. Return standard Supabase signed URLs (5-minute expiry).
Update src/components/pdf/InsurancePDF.tsx to use <Image src={horse.signed_url} />. @react-pdf/renderer will natively fetch the images over the network during blob generation.
Task 2.2: Client-Side CSV Processing (Fixes 10s Timeouts)
Context: matchCsvBatch times out after 10s when running fuzzysort against 10,500 records on the server.
Developer Task:
Create a Next.js Route Handler GET /api/reference-dictionary/route.ts that returns a highly compressed JSON array: [{ id, n: "name", m: "model_num" }]. Cache this aggressively.
In CsvImport.tsx, fetch this dictionary once on component mount.
Run papaparse and fuzzysort entirely in the browser ("use client").
Refactor executeBatchImport() to only accept the final array of user-confirmed, matched UUIDs. Process the inserts in chunks of 50 to prevent DB transaction timeouts.
Task 2.3: The "Fire-and-Forget" Execution Killer
Context: Vercel kills containers the millisecond a response is returned, terminating un-awaited emails and notifications mid-flight.

Developer Task:
1.In notifications.ts, messaging.ts, and social.ts, import import { after } from 'next/server'.
2. Wrap all background operations:
const result = await db.insert(...); // Critical blocking path

after(async () => {
  // Non-blocking background path runs safely after client receives response
  await sendResendEmail({...});
  await createNotification({...});
});

return result;

🛡️ EPIC 3: Security & Abuse Prevention
Task 3.1: Database-Backed Rate Limiting
Context: In-memory limiters fail in serverless. The 6-char Claim PIN and AI endpoints are vulnerable to brute-force and budget-draining.
Architect Task (SQL): Create a rate_limits table (ip_address, endpoint, attempts, window_start). Write a PL/pgSQL RPC check_rate_limit(p_ip, p_endpoint, p_max, p_window_interval) that increments attempts and returns boolean true/false.
Developer Task:
Use headers().get('x-forwarded-for') to capture the IP in Server Actions.
Apply check_rate_limit RPC to claimParkedHorse (Max 5 attempts per 15 minutes to protect PINs) and submitContactForm (Max 5 per hour).
Apply check_rate_limit using auth.uid() to /api/identify-mold (Hard cap at 5 requests per user, per 24 hours). Return HTTP 429 if exceeded.
📱 EPIC 4: Performance & Offline Show Mode (PWA)
Task 4.1: Tailwind CSS Monolith Purge
Context: globals.css is 208KB, destroying mobile load times. Tailwind is failing to purge unused classes.
Architect/Developer Task: Audit tailwind.config.ts. Ensure the content array explicitly and strictly matches component paths (e.g., ./src/app/**/*.{ts,tsx}). Remove dynamic string concatenations (like className={`bg-${color}-500`}) that prevent the compiler from purging unused colors.
Task 4.2: Offline Competition Engine (PWA)
Context: Live shows occur in fairgrounds with zero cell service. The Show String Planner will fail at the judge's table.

Developer Task:
1. Install @serwist/next and idb-keyval. Configure next.config.mjs to cache static assets and the /shows/planner route.
2. In ShowStringManager.tsx, add a UI button: "Sync String for Offline Use". Use idb-keyval to save the JSON to the browser's IndexedDB.
3. In ShowRecordForm.tsx, implement offline queuing:
if (!navigator.onLine) {
   await set('offline_mutations', [...existing, payload]);
   toast("Saved offline. Will sync to database when connection returns.");
   return;
}

4. Add a window.addEventListener('online') hook to automatically flush the offline_mutations queue to the addShowRecord Server Action.
Agent Execution Protocol:
Architect Agent: Review this document. Acknowledge understanding of the Postgres dynamic RLS logic (Epic 1.1) and Next.js after() hook (Epic 2.3). Start with Epic 1. Generate the Supabase SQL migrations first and present them to the human for approval.
Developer Agent: Once SQL is applied, execute the TypeScript refactors for Epic 1.
Developer Agent: Proceed sequentially through Epics 2, 3, and 4. Do not jump ahead.
<!-- end list -->