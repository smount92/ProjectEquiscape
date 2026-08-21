# Working notes — the infrastructure cost curve

**Research date: 2026-08-21.** Prices verified against vendor documentation on that date.
These are working notes for [`../BUSINESS_MODEL_2026.md`](../BUSINESS_MODEL_2026.md); the
report is the thing to read. This file exists so the arithmetic can be checked and so the
assumptions can be swapped for real dashboard numbers later.

---

## 1. Published prices (high confidence — vendor docs)

### Vercel Pro

| Item | Value | Source |
|---|---|---|
| Platform fee | **$20/month**, includes 1 deploying seat | https://vercel.com/docs/plans/pro |
| Monthly usage credit | **$20/month**, expires monthly, applies after included allocations | https://vercel.com/docs/plans/pro |
| Included Fast Data Transfer | **1 TB/month** | https://vercel.com/docs/plans/pro |
| Included Edge (CDN) Requests | **10,000,000/month** | https://vercel.com/docs/plans/pro |
| Extra seats | $20/month each (viewer seats free) | https://vercel.com/docs/plans/pro |

On-demand rates, Washington D.C. (`iad1`) — the default US East region
(https://vercel.com/docs/pricing/regional-pricing/iad1):

| Resource | Rate |
|---|---|
| Fast Data Transfer | $0.15 per GB after the first 1 TB |
| Edge Requests | $2.00 per 1,000,000 after the first 10,000,000 |
| Fast Origin Transfer | $0.06 per GB |
| Function invocations | $0.60 per 1,000,000 (rate quoted in https://vercel.com/docs/functions/usage-and-pricing) |
| Active CPU | $0.128 per CPU-hour (`iad1`) |
| Provisioned Memory | $0.0106 per GB-hour (`iad1`) |
| Image Optimization transformations | $0.05 per 1,000 |
| Image Optimization cache reads / writes | $0.40 per 1M / $4.00 per 1M |
| ISR + Runtime Cache reads / writes | $0.40 per 1M / $4.00 per 1M |
| Edge Request extra CPU duration | $0.30 per hour (requests ≤10 ms are free) |

Note on Vercel Functions: on Pro there is **no included allowance** for Active CPU,
Provisioned Memory or Invocations — every unit is on-demand, offset by the $20 credit.
Fluid compute bills Active CPU only while code actually runs (I/O waits are not billed) but
bills Provisioned Memory for the whole instance lifetime.

### Supabase Pro

From https://supabase.com/pricing:

| Item | Included on Pro | Overage |
|---|---|---|
| Base | **$25/month** | — |
| Compute credit | $10/month (covers one Micro instance) | Small $15, Medium $60, Large $110 /mo |
| Database disk | 8 GB per project | $0.125 per GB |
| Egress (uncached) | 250 GB | $0.09 per GB |
| Cached egress | 250 GB | $0.03 per GB |
| File storage | 100 GB | $0.0213 per GB |
| Monthly active users | 100,000 | $0.00325 per MAU |
| Log retention / backups | 7 days / daily for 7 days | — |

The 100,000-MAU allowance means Supabase's *own* MAU meter will never bind on this project.

### The supporting free tiers

| Service | Free ceiling | First paid tier | Source |
|---|---|---|---|
| Resend | **3,000 emails/month, hard cap of 100/day**, 3 domains | Pro $20/mo for 50,000 emails, then $0.90 per 1,000 | https://resend.com/pricing |
| Sentry | Developer: 5,000 errors/mo, 5M spans, 50 replays, 1 cron monitor, **1 user**, 30-day retention | Team ~$26/mo (annual) for 50,000 errors, unlimited users | https://sentry.io/pricing/ |

**The 100-emails-per-day Resend cap is a near-term operational ceiling, not a distant one.**
It is a *daily* limit, so it bites on bursts long before the monthly 3,000 is touched: a
single show-results announcement to 120 entrants, plus that day's ordinary message and
follow notifications, exceeds it. Any day the Hub runs a show, emails will silently fail.

### Domain

`.com` renewal runs roughly **$15–20/year** at mainstream registrars (~$1.25–1.65/month).
Low-precision figure, but it is also the smallest line item on the sheet.

---

## 2. What the codebase does with those resources (verified in this repo)

These findings materially change the cost curve, and all four cut in the project's favour.

**1. Photos do not go through Vercel Image Optimization.** Only two components import
`next/image` (`src/components/PassportGallery.tsx`,
`src/components/reference/ReferencePhotoGallery.tsx`); there are 91 plain `<img>` tags
across `src/`. Everything else points straight at the public Supabase Storage bucket. So
the image transformation / cache-read / cache-write meters — the ones that usually make an
image-heavy Next.js site expensive — are close to dormant, and photo bytes are billed as
Supabase **cached egress at $0.03/GB**, not Vercel Fast Data Transfer at $0.15/GB. Five
times cheaper for the single largest byte source on the site.

**2. Thumbnails are pre-generated, not transformed per request.**
`src/lib/utils/imageUrl.ts` simply rewrites the filename to `_thumb.webp`; the thumbnail is
a real object written at upload time. There is no per-view transformation bill on either
vendor. (One exception: `src/lib/shows/placingShareRead.ts` uses Supabase's
`/render/image/` endpoint for OG share cards — low volume.)

**3. Uploads are compressed in the browser before they ever reach storage.**
`src/lib/utils/imageCompression.ts`: free tier is capped at 1000 px / quality 0.70, Pro and
Studio at 2500 px / 0.92–0.95, hard ceiling 30 MB per input file. A free-tier photo lands at
roughly 100–200 KB; a Pro photo at roughly 0.6–1.2 MB. This is why storage stays cheap and
why **Pro subscribers cost meaningfully more to host than free members** — a real fact for
the unit economics, though a small one at these prices.

**4. The `horse-images` bucket is public and CDN-cacheable — no signed URLs.** Confirmed in
`.agents/MASTER_BLUEPRINT.md`. Signed URLs would defeat the CDN and push most photo bytes
onto the uncached $0.09/GB meter instead of the cached $0.03/GB one. Keeping that bucket
public is worth about 3× on the largest variable line. Private `chat-attachments` correctly
does use signed URLs, but DM photos are a small fraction of volume.

**5. Three cron jobs** (`vercel.json`): market refresh daily at 06:00, show transitions
hourly, Stablemaster report monthly on the 1st at 09:00. The hourly one is ~730
invocations/month — trivial. The monthly Stablemaster mailing is the single biggest email
burst on the calendar and is the most likely thing to hit Resend's daily cap.

---

## 3. Per-active-member consumption — assumptions (LOW confidence, deliberately)

Nothing below is measured. These are engineering estimates for a logged-in, image-heavy,
server-rendered App Router site, chosen to be *pessimistic* so the cost curve errs high.
The report says plainly that these should be replaced with real numbers.

**How to replace them:** take one full month from the Vercel dashboard's Usage tab and the
Supabase dashboard's Usage page, divide each metric by that month's active-member count,
and substitute. After two or three months the curve becomes fact instead of estimate.

| Per monthly-active member | Low | **Central** | High | Reasoning |
|---|---|---|---|---|
| Page views / month | 60 | **120** | 250 | ~8–12 sessions × ~10–15 views. Collection sites are browse-heavy. |
| Edge requests / page view | 20 | **30** | 45 | RSC payloads, JS chunks, prefetches, fonts, the view beacon. Photos are *not* in this number (they hit Supabase). |
| **Edge requests / member / month** | 1,200 | **3,600** | 11,250 | |
| Vercel bytes / page view (HTML+RSC+JS+CSS) | 80 KB | **150 KB** | 300 KB | Excludes photos. |
| **Vercel Fast Data Transfer / member / month** | 5 MB | **18 MB** | 75 MB | |
| Function invocations / member / month | 70 | **150** | 350 | ~1 per dynamic render plus actions and beacons. |
| Photo bytes served / member / month | 20 MB | **60 MB** | 150 MB | ~250 images/month at a thumb/full mix averaging ~80 KB, mostly cached egress. |
| Supabase file storage added / member | 8 MB | **20 MB** | 60 MB | ~12 horses × 5 free-tier photos + thumbs, avatars, post images. Pro members far higher (up to ~350 MB). |
| Database disk / member | 0.2 MB | **0.5 MB** | 1.5 MB | Rows are small; indexes and the metrics tables dominate. |
| Notification emails / member / month | 3 | **6** | 12 | Assumes digesting. Un-digested per-message email would be several times this. |

### Where each meter runs out (central assumptions)

| Meter | Included | Members at which it is exhausted |
|---|---|---|
| Vercel Edge Requests | 10,000,000 | **~2,800** |
| Vercel Fast Data Transfer | 1 TB | ~55,000 — never binds |
| Supabase egress (250 + 250 GB) | 500 GB | **~8,300** |
| Supabase file storage | 100 GB | **~5,000** (cumulative registrations, not MAU) |
| Supabase database disk | 8 GB | **~16,000** (cumulative) |
| Resend free monthly | 3,000 emails | **~500** — but the 100/day cap bites far sooner on show days |
| Sentry free | 5,000 errors | error-rate dependent, not member-dependent |

**Conclusion: Vercel Edge Requests is the first meter to run out, at roughly 2,800 active
members** — and even then, 2 million excess requests costs $4, which the $20 credit absorbs.
The first bill that actually *rises* is Resend (~$20 at a few hundred active members) and,
later, the Supabase compute instance.

### Supabase compute is the real step function

Metered dimensions on Supabase are cheap; **compute size is the expensive dial**, and it
steps rather than scales: Micro (covered by the $10 credit) → Small +$5 → Medium +$50 →
Large +$100. A server-rendered, DB-chatty App Router app with `force-dynamic` show pages
and per-request auth checks will need Small somewhere in the low thousands of active
members and Medium in the mid thousands. This is a judgement call, not a published
threshold — **low confidence**, and the single biggest source of error in the curve below.

---

## 4. The modelled cost curve

Central assumptions. Vercel's $20 credit is applied before on-demand billing. Rounded.

| Monthly-active members | Vercel | Supabase | Resend | Sentry | Domain | **Total / month** |
|---|---|---|---|---|---|---|
| **~75 (today)** | $20 | $25 | $0 | $0 | $1.50 | **~$47** |
| **100** | $20 | $25 | $0 | $0 | $1.50 | **~$47** |
| **500** | $20 | $25 | $20 | $0 | $1.50 | **~$67** |
| **2,000** | $20 | $30 (Small compute) | $20 | $0 | $1.50 | **~$72** |
| **5,000** | $23 | $80 (Medium) | $20 | $26 | $1.50 | **~$150** |
| **10,000** | $52 | $95 (Medium + egress/storage) | $29 | $26 | $1.50 | **~$205** |

Worked arithmetic for the 10,000-member row:

- Vercel edge requests: 10,000 × 3,600 = 36 M → 26 M over → 26 × $2.00 = $52; less the $20
  credit = $32 on-demand; plus $20 platform = **$52**.
- Vercel Fast Data Transfer: 10,000 × 18 MB = 180 GB — comfortably inside the 1 TB.
- Supabase compute Medium $60, less the $10 credit = +$50, on the $25 base = $75.
- Supabase egress: 10,000 × 60 MB = 600 GB → ~100 GB over, mostly cached → ~$3–9.
- Supabase storage: cumulative registrations well past 100 GB → a few dollars.
- Resend: 10,000 × 6 = 60,000 emails → $20 + 10,000 over at $0.90/1,000 = $29.

**The headline for the report: infrastructure is not the problem.** Going from today's ~75
members to 10,000 multiplies the bill by roughly four, not by 130. Costs grow sub-linearly
because the two fixed platform fees ($45 of today's $47) dominate for a long time. Every
level of income beyond break-even is therefore an audience-and-conversion problem, never a
hosting problem.

### The costs that are NOT on this sheet

Worth stating in the report so the "pays for itself" number is not quietly false:

- **Stripe fees** — netted per subscription in the report, not billed as infrastructure.
- **Time.** Two people with day jobs. Not modelled, but the largest real input.
- Paid tooling the owners may add later (this is what Level 1's headroom is for).
- Legal/accounting if subscription revenue ever becomes material.
- Sentry Team, Vercel Web Analytics Plus, Speed Insights — all optional $10–26/mo add-ons.
